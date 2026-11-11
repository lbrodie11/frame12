#!/usr/bin/env node
/**
 * CutMorph synthetic performance measurements (F12-10). NOT field INP: these are lab numbers from
 * one machine, with synthetic input, on The Edit Room's 200-row filter demo
 * (site/src/components/edit-room-demos.tsx through tests/fixtures/edit-room-entry.tsx).
 *
 *   node registry/scripts/measure-cut-morph-perf.mjs [--out=<dir>] [--runs=<n>] [--docs]
 *
 * Same conventions as measure-exposure-perf.mjs: fresh contexts per run, an unthrottled pass and a
 * 4× CPU-throttled pass (Emulation.setCPUThrottlingRate: Chromium only; Firefox and WebKit have no
 * throttling API, so their 4× rows are null), medians/percentiles over the run set.
 *
 * Per click on a stage filter (12 per run, 700 ms apart), measured in the page:
 * - lab input-to-next-paint: the click's timeStamp → the first task after the next animation frame
 *   (requestAnimationFrame → MessageChannel), as in measure-exposure-perf.mjs;
 * - input → DOM updated: timeStamp → the MutationObserver callback that sees the new live-region
 *   text (the update ran and React committed);
 * - React commit: the synchronous render + commit of the update (with CutMorph: the flushSync
 *   inside the View Transition callback; without: setState → the MutationObserver microtask);
 * - long tasks over 50 ms (PerformanceObserver 'longtask', Chromium only), attributed from a
 *   Chromium performance trace of the first run (top child events of each long RunTask);
 * - layout shifts ('layout-shift', Chromium only) and scroll jumps (scrollY before/after);
 * - "added delay" on the cut and fallback paths: whether the DOM was already updated before the
 *   next animation frame (it must be: no View Transition, no waiting).
 * Size: cut-morph.tsx (React and use-tempo external) and the CutMorph CSS block, esbuild-minified
 * and gzipped, separately and together.
 */
import { build, transform } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus, totalmem, platform, release } from 'node:os';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { launch } from '../tests/lib.mjs';
import { bundlePage, REGISTRY_ROOT, REPO_ROOT } from '../tests/harness.mjs';

const arg = (name, dflt) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? dflt;
const OUT = resolve(arg('out', resolve(REGISTRY_ROOT, 'test-results/cut-morph-perf')));
const RUNS = Number(arg('runs', 3));
const DOCS = process.argv.includes('--docs');
const BROWSERS = (process.env.BROWSERS || 'chromium,firefox,webkit').split(',').map((s) => s.trim()).filter(Boolean);
mkdirSync(OUT, { recursive: true });

const css = readFileSync(resolve(REPO_ROOT, 'site/src/components/edit-room.css'), 'utf8');
const html = await bundlePage(resolve(REGISTRY_ROOT, 'tests/fixtures/edit-room-entry.tsx'), { react: 18, head: `<style>${css}</style>` });

const pct = (xs, p) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return +s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)].toFixed(1);
};
const stats = (xs) => ({ n: xs.length, p50: pct(xs, 50), p75: pct(xs, 75), p95: pct(xs, 95) });

const PROBE = () => {
  window.__m = { clicks: [], long: [], shifts: [], commits: [] };
  const m = window.__m;
  // Time the synchronous update inside each View Transition callback (render + commit).
  for (const proto of [Document.prototype, Element.prototype]) {
    const orig = proto.startViewTransition;
    if (!orig) continue;
    proto.startViewTransition = function (cb) {
      return orig.call(this, () => {
        const t = performance.now();
        const r = cb();
        m.commits.push(performance.now() - t);
        return r;
      });
    };
  }
  addEventListener(
    'click',
    (e) => {
      const rec = { ts: e.timeStamp, sy: scrollY, inp: null, dom: null, beforeFrame: false, cutCommit: null };
      m.clicks.push(rec);
      const status = document.querySelector('[role="status"]');
      const before = status?.textContent;
      let frameSeen = false;
      const handlerStart = performance.now();
      const mo = new MutationObserver(() => {
        if (status.textContent === before || rec.dom !== null) return;
        rec.dom = performance.now() - rec.ts;
        rec.beforeFrame = !frameSeen;
        rec.cutCommit = performance.now() - handlerStart;
        mo.disconnect();
      });
      if (status) mo.observe(status, { childList: true, characterData: true, subtree: true });
      requestAnimationFrame(() => {
        frameSeen = true;
        const c = new MessageChannel();
        c.port1.onmessage = () => {
          rec.inp = performance.now() - rec.ts;
        };
        c.port2.postMessage(0);
      });
      setTimeout(() => {
        rec.syAfter = scrollY;
        mo.disconnect();
      }, 650);
    },
    true,
  );
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) m.long.push({ start: e.startTime, ms: e.duration });
    }).observe({ type: 'longtask', buffered: true });
    m.longSupported = true;
  } catch {
    m.longSupported = false;
  }
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (!e.hadRecentInput) m.shifts.push(e.value);
    }).observe({ type: 'layout-shift', buffered: true });
    m.shiftSupported = true;
  } catch {
    m.shiftSupported = false;
  }
};

const STAGES = ['ink', 'color', 'final', 'layout', 'key', 'all'];

async function run(browser, { demo, tempo = 'twos', reduced = 'no-preference', throttle = 1, trace = null }) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: reduced });
  const page = await ctx.newPage();
  await page.addInitScript(PROBE);
  await page.route('http://f12.test/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: html }));
  if (throttle > 1) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  }
  await page.goto('http://f12.test/index.html');
  await page.evaluate(([d, t]) => window.__er.mount({ demo: d, tempo: t }), [demo, tempo]);
  await page.waitForSelector('#er-filter-list li');
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    window.__m.clicks = [];
    window.__m.long = [];
    window.__m.shifts = [];
    window.__m.commits = [];
  });
  if (trace) await browser.startTracing(page, { path: trace, screenshots: false });
  for (let i = 0; i < 12; i++) {
    await page.click(`#er-filter-filter-${STAGES[i % STAGES.length]}`);
    await page.waitForTimeout(700);
  }
  if (trace) await browser.stopTracing();
  const m = await page.evaluate(() => window.__m);
  await ctx.close();
  return m;
}

/** Top child events (by total duration) inside each RunTask over 50 ms, from a Chromium trace. */
function attribute(tracePath) {
  try {
    const events = JSON.parse(readFileSync(tracePath, 'utf8')).traceEvents.filter((e) => e.ph === 'X' && typeof e.dur === 'number');
    const tasks = events.filter((e) => e.name === 'RunTask' && e.dur > 50000);
    return tasks.map((t) => {
      const kids = new Map();
      for (const e of events) {
        if (e === t || e.tid !== t.tid || e.pid !== t.pid || e.ts < t.ts || e.ts + e.dur > t.ts + t.dur) continue;
        if (e.name === 'RunTask' || e.name === 'ThreadControllerImpl::RunTask') continue;
        kids.set(e.name, (kids.get(e.name) || 0) + e.dur);
      }
      const top = [...kids].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([n, d]) => `${n} ${(d / 1000).toFixed(1)}ms`);
      // Playwright's own evaluate/tracing calls arrive as V8 API interrupts on the main thread.
      const harness = top.some((x) => x.startsWith('V8.InvokeApiInterruptCallbacks'));
      return { ms: +(t.dur / 1000).toFixed(1), top, ...(harness ? { harness: true } : {}) };
    });
  } catch (e) {
    return [{ error: String(e).slice(0, 120) }];
  }
}

const results = {
  machine: { platform: `${platform()} ${release()}`, cpu: cpus()[0]?.model, cores: cpus().length, memGB: +(totalmem() / 2 ** 30).toFixed(1) },
  runs: RUNS,
  clicksPerRun: 12,
  note: 'Synthetic lab measurements on one machine (input timeStamp → first task after the next frame). Not field INP.',
  engines: {},
};

for (const name of BROWSERS) {
  const browser = await launch(name);
  const engine = { version: browser.version() };
  for (const [label, opts] of [
    ['with-cutmorph', { demo: 'filter' }],
    ['without-cutmorph', { demo: 'filter-cut' }],
    ['with-cutmorph-4x', { demo: 'filter', throttle: 4 }],
    ['without-cutmorph-4x', { demo: 'filter-cut', throttle: 4 }],
    ['fallback-still', { demo: 'filter', tempo: 'still' }],
    ['fallback-reduced-motion', { demo: 'filter', reduced: 'reduce' }],
  ]) {
    if (opts.throttle && name !== 'chromium') {
      engine[label] = null;
      continue;
    }
    const all = [];
    for (let i = 0; i < RUNS; i++) {
      const trace = name === 'chromium' && i === 0 && !label.startsWith('fallback') ? resolve(OUT, `${label}.trace.json`) : null;
      const m = await run(browser, { ...opts, trace });
      if (trace) m.attribution = attribute(trace);
      all.push(m);
    }
    const clicks = all.flatMap((m) => m.clicks);
    const long = all.flatMap((m) => m.long.filter((x) => x.ms > 50).map((x) => x.ms));
    const transition = opts.demo === 'filter' && !label.startsWith('fallback');
    engine[label] = {
      inputToNextPaint: stats(clicks.map((c) => c.inp).filter((x) => x != null)),
      inputToDomUpdated: stats(clicks.map((c) => c.dom).filter((x) => x != null)),
      reactCommit: transition ? stats(all.flatMap((m) => m.commits)) : stats(clicks.map((c) => c.cutCommit).filter((x) => x != null)),
      longTasksOver50ms: all[0].longSupported ? { count: long.length, longest: long.length ? +Math.max(...long).toFixed(1) : 0 } : null,
      attribution: all[0].attribution ?? undefined,
      layoutShift: all[0].shiftSupported ? +all.flatMap((m) => m.shifts).reduce((a, b) => a + b, 0).toFixed(4) : null,
      scrollJumps: clicks.filter((c) => c.syAfter !== undefined && c.syAfter !== c.sy).length,
      updatedBeforeNextFrame: `${clicks.filter((c) => c.beforeFrame).length}/${clicks.length}`,
    };
    console.log(name, label, JSON.stringify(engine[label]));
  }
  results.engines[name] = engine;
  await browser.close();
}

// Zero added delay on the cut and fallback paths: every update is in the DOM before the next frame.
const assertions = [];
for (const [name, e] of Object.entries(results.engines)) {
  for (const label of ['without-cutmorph', 'fallback-still', 'fallback-reduced-motion']) {
    const r = e[label];
    const [ok, n] = r.updatedBeforeNextFrame.split('/').map(Number);
    assertions.push({ engine: name, path: label, pass: ok === n && n > 0, updatedBeforeNextFrame: r.updatedBeforeNextFrame });
  }
}
results.zeroAddedDelay = assertions;

// Size: min+gzip, JS and CSS separately and together.
const js = await build({
  entryPoints: [resolve(REGISTRY_ROOT, 'ui/cut-morph.tsx')],
  bundle: true,
  minify: true,
  format: 'esm',
  write: false,
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  external: ['react', 'react-dom', 'react/jsx-runtime', '@/hooks/use-tempo'],
  logLevel: 'silent',
});
const fullCss = readFileSync(resolve(REGISTRY_ROOT, 'styles/frame12.css'), 'utf8');
const block = fullCss.slice(fullCss.indexOf('/* ===================================================================== CutMorph'), fullCss.indexOf('/* ===================================================================== Print'));
const minCss = (await transform(block, { loader: 'css', minify: true })).code;
const gz = (s) => gzipSync(Buffer.from(s), { level: 9 }).length;
const jsGz = gz(js.outputFiles[0].text);
const cssGz = gz(minCss);
results.size = {
  jsMinBytes: js.outputFiles[0].text.length,
  jsMinGzipBytes: jsGz,
  cssMinBytes: minCss.length,
  cssMinGzipBytes: cssGz,
  togetherMinGzipBytes: gz(js.outputFiles[0].text + minCss),
  budgetBytes: 3072,
};
results.size.withinBudget = results.size.togetherMinGzipBytes <= 3072;
console.log('size', JSON.stringify(results.size));
console.log('zero added delay', JSON.stringify(assertions));

writeFileSync(resolve(OUT, 'cut-morph-perf.json'), `${JSON.stringify(results, null, 2)}\n`);
if (DOCS) writeFileSync(resolve(REPO_ROOT, 'docs/architecture/cut-morph-perf.json'), `${JSON.stringify({ recorded: new Date().toISOString().slice(0, 10), ...results }, null, 2)}\n`);
console.log(`\nWrote ${resolve(OUT, 'cut-morph-perf.json')}${DOCS ? ' and docs/architecture/cut-morph-perf.json' : ''}; traces in ${OUT}`);
const failed = assertions.filter((a) => !a.pass);
if (failed.length) {
  console.error(`FAIL zero added delay: ${JSON.stringify(failed)}`);
  process.exit(1);
}
