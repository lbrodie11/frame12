#!/usr/bin/env node
/**
 * ExposureScrubber synthetic performance measurements (F12-09). NOT field INP: these are lab
 * numbers from one machine, in Chromium, with synthetic input.
 *
 *   node registry/scripts/measure-exposure-perf.mjs [--out=<dir>] [--runs=<n>]
 *
 * "Interaction to next paint" here = from the input event's timeStamp to the first task after the
 * next animation frame (requestAnimationFrame → MessageChannel), measured in the page for every
 * key press and pointer move. Long tasks come from PerformanceObserver('longtask'). Hydration is
 * the server markup from react-dom/server hydrated by the React 18.3 production bundle. Traces are
 * Chromium performance traces (open in chrome://tracing or the Performance panel).
 *
 * Same conventions as scripts/measure-perf-baseline.mjs: fresh contexts per run, an unthrottled
 * pass and a 4× CPU-throttled pass (Emulation.setCPUThrottlingRate), medians reported per run set.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { cpus, totalmem, platform, release } from 'node:os';
import { resolve } from 'node:path';
import { launch } from '../tests/lib.mjs';
import { bundlePage, loadServerModule, REGISTRY_ROOT } from '../tests/harness.mjs';

const arg = (name, dflt) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? dflt;
const OUT = resolve(arg('out', resolve(REGISTRY_ROOT, 'test-results/exposure-perf')));
const RUNS = Number(arg('runs', 3));
mkdirSync(OUT, { recursive: true });

const FIXTURE = resolve(REGISTRY_ROOT, 'tests/fixtures/exposure-fixture.tsx');
const APP = resolve(REGISTRY_ROOT, 'tests/fixtures/exposure-app.tsx');
const clientHtml = await bundlePage(FIXTURE, { react: 18 });
const { mod, React, server } = await loadServerModule(APP, { react: 18 });

const pct = (xs, p) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return +s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)].toFixed(1);
};
const median = (xs) => pct(xs, 50);

const PROBE = () => {
  window.__lat = [];
  window.__long = [];
  const after = (ts, kind) =>
    requestAnimationFrame(() => {
      const c = new MessageChannel();
      c.port1.onmessage = () => window.__lat.push({ kind, ms: performance.now() - ts });
      c.port2.postMessage(0);
    });
  addEventListener('keydown', (e) => after(e.timeStamp, 'key'), true);
  addEventListener('pointermove', (e) => e.buttons && after(e.timeStamp, 'drag'), true);
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__long.push({ start: e.startTime, ms: e.duration });
    }).observe({ type: 'longtask', buffered: true });
  } catch {
    /* longtask unsupported */
  }
  // Leak accounting for the unmount check.
  const live = { listeners: 0, timers: new Set(), observers: 0 };
  window.__live = live;
  const wrapTarget = (t) => {
    const add = t.addEventListener.bind(t);
    const rem = t.removeEventListener.bind(t);
    // React's own one-time document listener (selectionchange) is not the component's.
    const counted = (type) => type !== 'keydown' && type !== 'pointermove' && type !== 'selectionchange';
    t.addEventListener = (type, fn, o) => {
      if (counted(type)) live.listeners++;
      return add(type, fn, o);
    };
    t.removeEventListener = (type, fn, o) => {
      if (counted(type)) live.listeners--;
      return rem(type, fn, o);
    };
  };
  wrapTarget(document);
  const st = window.setTimeout;
  const ct = window.clearTimeout;
  window.setTimeout = (fn, ms, ...a) => {
    const id = st(() => {
      live.timers.delete(id);
      fn(...a);
    }, ms);
    live.timers.add(id);
    return id;
  };
  window.clearTimeout = (id) => {
    live.timers.delete(id);
    ct(id);
  };
  for (const Name of ['ResizeObserver', 'MutationObserver', 'IntersectionObserver']) {
    const O = window[Name];
    if (!O) continue;
    window[Name] = class extends O {
      constructor(cb) {
        super(cb);
        // Playwright's injected script creates its own MutationObserver when locators are used.
        this.__on = !/InjectedScript/.test(new Error().stack || '');
        if (this.__on) live.observers++;
      }
      disconnect() {
        if (this.__on) live.observers--;
        this.__on = false;
        return super.disconnect();
      }
    };
  }
};

async function open(browser, html, { throttle = 1, ssr = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.addInitScript(PROBE);
  if (ssr) await page.addInitScript((p) => (window.__xsSsr = p), ssr.props);
  const cdp = await ctx.newCDPSession(page);
  if (throttle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  await page.route('http://f12.test/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: html }));
  return { ctx, page, cdp };
}

async function scrubRun(browser, { n = 500, render = 'light', throttle = 1, trace = null }) {
  const { ctx, page } = await open(browser, clientHtml, { throttle });
  await page.goto('http://f12.test/index.html');
  // Baseline before mounting: React keeps its own document listeners (e.g. selectionchange).
  const baseline = await page.evaluate(() => ({ l: window.__live.listeners, t: window.__live.timers.size, o: window.__live.observers }));
  await page.evaluate(([nn, r]) => window.__xs({ n: nn, render: r, genOpts: { statuses: true, markers: [10, 200], gapMs: [300, 1200], detail: true } }), [n, render]);
  await page.waitForSelector('#xa tbody tr');
  await page.waitForTimeout(300);
  if (trace) await browser.startTracing(page, { path: trace, screenshots: false });
  await page.evaluate(() => {
    window.__lat = [];
    window.__long = [];
  });
  // 60 key presses on the range (scrubbing), then 60 pointer-drag moves on the FRAME column.
  await page.focus('#xa-range');
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press(i % 10 === 9 ? 'PageUp' : 'ArrowRight');
    await page.waitForTimeout(30);
  }
  const box = await page.locator('#xa tbody tr:nth-child(2) .f12-xs-f').boundingBox();
  await page.mouse.move(box.x + 10, box.y + 5);
  await page.mouse.down();
  for (let i = 0; i < 60; i++) {
    await page.mouse.move(box.x + 10, box.y + 5 + (i % 12) * 20);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  await page.waitForTimeout(700);
  if (trace) await browser.stopTracing();
  const r = await page.evaluate(() => ({ lat: window.__lat, long: window.__long }));
  // Unmount leaves nothing behind.
  await page.waitForTimeout(1200);
  const before = await page.evaluate(() => ({ l: window.__live.listeners, t: window.__live.timers.size, o: window.__live.observers }));
  await page.evaluate(() => window.__xsUnmount());
  await page.waitForTimeout(1200);
  const after = await page.evaluate(() => ({ l: window.__live.listeners, t: window.__live.timers.size, o: window.__live.observers }));
  await ctx.close();
  const leaked = { listeners: after.l - baseline.l, timers: after.t - baseline.t, observers: after.o - baseline.o };
  return { ...r, before, after, leaked };
}

async function hydrateRun(browser, n, throttle = 1) {
  const props = { n, genOpts: { statuses: true, markers: [10], gapMs: [300, 1200], detail: true } };
  const markup = server.renderToString(React.createElement(mod.Harness, props));
  const html = clientHtml.replace('<div id="root"></div>', `<div id="root">${markup}</div>`);
  const { ctx, page } = await open(browser, html, { throttle, ssr: { props } });
  await page.goto('http://f12.test/index.html');
  await page.waitForFunction(() => !document.querySelector('#xa .f12-xs-transport')?.disabled, null, { timeout: 60000 });
  await page.waitForTimeout(500);
  const long = await page.evaluate(() => window.__long);
  await ctx.close();
  const htmlBytes = Buffer.byteLength(markup);
  return { long, htmlBytes };
}

const browser = await launch('chromium');
const version = browser.version();
const results = { machine: { platform: `${platform()} ${release()}`, cpu: cpus()[0]?.model, cores: cpus().length, memGB: +(totalmem() / 2 ** 30).toFixed(1) }, browser: `Chromium ${version}`, runs: RUNS, note: 'Synthetic lab measurements (input timeStamp → first task after the next frame). Not field INP.' };

const summarize = (all) => {
  const keys = all.flatMap((r) => r.lat.filter((x) => x.kind === 'key').map((x) => x.ms));
  const drags = all.flatMap((r) => r.lat.filter((x) => x.kind === 'drag').map((x) => x.ms));
  const both = [...keys, ...drags];
  const long = all.flatMap((r) => r.long.map((x) => x.ms));
  return {
    interactions: both.length,
    p50: pct(both, 50),
    p75: pct(both, 75),
    p95: pct(both, 95),
    worst: both.length ? +Math.max(...both).toFixed(1) : null,
    keys: { p50: pct(keys, 50), p75: pct(keys, 75), p95: pct(keys, 95) },
    drag: { p50: pct(drags, 50), p75: pct(drags, 75), p95: pct(drags, 95) },
    longTasks: long.length,
    longestTask: long.length ? +Math.max(...long).toFixed(1) : 0,
    leakedAfterUnmount: all.map((r) => r.leaked),
  };
};

for (const [name, opts] of [
  ['scrub-500-light', { n: 500 }],
  ['scrub-500-light-4x', { n: 500, throttle: 4 }],
  ['scrub-500-heavy-renderFrame', { n: 500, render: 'heavy' }],
  ['scrub-5000-light', { n: 5000 }],
]) {
  const all = [];
  for (let i = 0; i < RUNS; i++) all.push(await scrubRun(browser, { ...opts, trace: i === 0 ? resolve(OUT, `${name}.trace.json`) : null }));
  results[name] = summarize(all);
  console.log(name, JSON.stringify(results[name]));
}
for (const n of [500, 5000]) {
  const runs = [];
  for (let i = 0; i < RUNS; i++) runs.push(await hydrateRun(browser, n));
  const longs = runs.map((r) => r.long.filter((x) => x.ms > 50));
  results[`hydrate-${n}`] = {
    longTasksOver50ms: median(longs.map((l) => l.length)),
    longestTaskMs: median(longs.map((l) => (l.length ? Math.max(...l.map((x) => x.ms)) : 0))),
    htmlBytes: runs[0].htmlBytes,
    htmlBytesPerRow: +(runs[0].htmlBytes / n).toFixed(0),
  };
  console.log(`hydrate-${n}`, JSON.stringify(results[`hydrate-${n}`]));
}
await browser.close();
writeFileSync(resolve(OUT, 'exposure-perf.json'), JSON.stringify(results, null, 2));
console.log(`\nWrote ${resolve(OUT, 'exposure-perf.json')} and traces in ${OUT}`);
