// F12-08 tempo on frame12.dev (production build, Chromium): first paint and hydration with a
// stored tempo, end-to-end propagation from the header control, live reduced-motion safety, the
// `M` shortcut, the Motion Studio stages, header control layout/axe, and asChild neutrality.
//   npm --workspace=@frame12/site run build && node site/tests/tempo.mjs
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import { sampleAt60Hz } from '../../registry/tests/harness.mjs';

const SITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KEY = 'frame12-tempo';

let failures = 0;
function check(ok, label, detail = '') {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`);
}

const port = await new Promise((res, rej) => {
  const srv = net.createServer();
  srv.listen(0, '127.0.0.1', () => {
    const p = srv.address().port;
    srv.close(() => res(p));
  });
  srv.on('error', rej);
});
const baseUrl = `http://127.0.0.1:${port}`;
const nextBin = createRequire(resolve(SITE_ROOT, 'package.json')).resolve('next/dist/bin/next');
const server = spawn(process.execPath, [nextBin, 'start', '-p', String(port), '-H', '127.0.0.1'], {
  cwd: SITE_ROOT,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, NODE_ENV: 'production' },
});

async function waitForServer() {
  const start = Date.now();
  while (Date.now() - start < 30000) {
    try {
      if ((await fetch(`${baseUrl}/r/registry.json`)).ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('next start did not become ready');
}

/** New context; `tempo` is pre-stored (undefined = nothing stored). */
async function open(browser, path, { tempo, w = 1280, h = 900, reduced = 'no-preference', scheme = 'light', clock = false, init } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: reduced, colorScheme: scheme });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' || /hydrat|did not match/i.test(m.text())) errors.push(m.text());
  });
  if (tempo !== undefined) await ctx.addInitScript(([k, t]) => localStorage.setItem(k, t), [KEY, tempo]);
  if (init) await ctx.addInitScript(init);
  if (clock) await page.clock.install();
  await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.site-root[data-hydrated="true"]');
  return { ctx, page, errors };
}

const tempoOf = (page) => page.evaluate(() => document.querySelector('.site-root').getAttribute('data-f12-tempo'));
const choose = async (page, t) => {
  await page.check(`#site-tempo-${t}`);
  await page.waitForFunction((v) => document.querySelector('.site-root').getAttribute('data-f12-tempo') === v, t);
};
/** Pauses the page's fake clock a little ahead of its own current time. */
const pause = async (page) => page.clock.pauseAt((await page.evaluate(() => Date.now())) + 200);

// Records every CSS animation/transition start from the first script on, plus <html data-f12-tempo>.
const RECORD_MOTION = () => {
  window.__motion = { starts: [], firstAttr: null };
  // The value when <body> is first inserted: after the head's first-paint script, before any
  // body content can paint.
  const mo = new MutationObserver(() => {
    if (document.body) {
      window.__motion.firstAttr = document.documentElement.getAttribute('data-f12-tempo');
      mo.disconnect();
    }
  });
  mo.observe(document, { childList: true, subtree: true });
  const rec = (e) => window.__motion.starts.push(`${e.type}:${e.animationName || e.propertyName}:${e.target.className?.baseVal ?? e.target.className}`);
  document.addEventListener('animationstart', rec, true);
  document.addEventListener('transitionrun', rec, true);
};

try {
  await waitForServer();
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] });

  // ---------------------------------------------------------------- default + first paint
  {
    const { ctx, page, errors } = await open(browser, '/');
    const st = await page.evaluate(() => ({
      html: document.documentElement.getAttribute('data-f12-tempo'),
      root: document.querySelector('.site-root').getAttribute('data-f12-tempo'),
      cls: document.querySelector('.site-root').className,
      checked: document.querySelector('#site-tempo-auto').checked,
      stored: localStorage.getItem('frame12-tempo'),
      oldControl: Boolean(document.querySelector('#site-motion-stepped')),
    }));
    check(st.html === 'auto' && st.root === 'auto' && /\bf12-m-stepped\b/.test(st.cls) && st.checked && st.stored === null && !st.oldControl && errors.length === 0,
      'site default: nothing stored → AUTO (the old in-memory stepped default), site root keeps the on-twos default, old 12/60/0 control removed', st);
    await ctx.close();
  }
  for (const [label, block] of [['after hydration', false], ['before hydration (React bundle blocked)', true]]) {
    for (const path of ['/components/skeleton', '/']) {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      await ctx.addInitScript(([k]) => localStorage.setItem(k, 'still'), [KEY]);
      await ctx.addInitScript(RECORD_MOTION);
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => {
        if (m.type() === 'error' || /hydrat|did not match/i.test(m.text())) errors.push(m.text());
      });
      if (block) await page.route('**/_next/static/chunks/**/*.js', (r) => r.abort());
      await page.goto(`${baseUrl}${path}`, { waitUntil: block ? 'load' : 'networkidle' });
      await page.waitForTimeout(1200);
      const st = await page.evaluate(() => ({
        firstAttr: window.__motion.firstAttr,
        starts: window.__motion.starts,
        running: document.getAnimations().length,
        hydrated: document.querySelector('.site-root')?.getAttribute('data-hydrated') === 'true',
        skeletonAnim: document.querySelector('.f12-skeleton-animated') ? getComputedStyle(document.querySelector('.f12-skeleton-animated')).animationName : 'n/a',
      }));
      const blockErrors = block ? [] : errors;
      check(st.firstAttr === 'still' && st.starts.length === 0 && st.running === 0 && st.hydrated === !block && blockErrors.length === 0,
        `site first paint: stored 0 (still) on ${path} ${label}: <html data-f12-tempo="still"> before any script, zero animation/transition frames, no hydration warnings`,
        { ...st, errors: blockErrors });
      await ctx.close();
    }
  }
  {
    // Sensitivity: the same cold load with a stored 12 does animate the Skeleton.
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.addInitScript(([k]) => localStorage.setItem(k, 'twos'), [KEY]);
    await ctx.addInitScript(RECORD_MOTION);
    const page = await ctx.newPage();
    await page.goto(`${baseUrl}/components/skeleton`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    const st = await page.evaluate(() => ({ firstAttr: window.__motion.firstAttr, skel: window.__motion.starts.filter((s) => s.includes('f12SkeletonStep')).length }));
    check(st.firstAttr === 'twos' && st.skel > 0, 'site first paint (control): a stored 12 sets data-f12-tempo="twos" and the Skeleton does step', st);
    await ctx.close();
  }

  // ---------------------------------------------------------- end-to-end propagation (header)
  {
    const { ctx, page, errors } = await open(browser, '/components/metric', { clock: true });
    const metric = () => page.evaluate(() => document.querySelector('.f12-preview-frame .f12-m-value [aria-hidden="true"]').textContent);
    const indicator = () =>
      page.evaluate(() => {
        const ind = document.querySelector('.f12-preview-frame .f12-rng-ind');
        return { tf: getComputedStyle(ind).transitionTimingFunction, dur: getComputedStyle(ind).transitionDuration, x: ind.style.transform };
      });
    const result = {};
    let range = 0;
    for (const t of ['still', 'twos', 'ones']) {
      await choose(page, t);
      await pause(page);
      const target = ['90', '7', '30'][range++];
      await page.click(`#metric-light-metric-rng-${target}`);
      await page.waitForTimeout(80);
      const values = await sampleAt60Hz(page, 900, metric);
      const ind = await indicator();
      const anims = await page.evaluate(() => document.getAnimations().filter((a) => a.effect?.target?.closest?.('.f12-preview-frame')).length);
      result[t] = { poses: new Set(values).size, tf: ind.tf, dur: ind.dur, anims };
      await page.clock.resume();
    }
    // Skeleton per tempo, independently of navigation order.
    for (const t of ['still', 'twos', 'ones']) {
      await page.goto(`${baseUrl}/components/skeleton`, { waitUntil: 'networkidle' });
      await choose(page, t);
      await page.waitForTimeout(50);
      result[t].skeleton = await page.evaluate(() => getComputedStyle(document.querySelector('.f12-preview-frame .f12-skeleton-animated')).animationName);
      // GhostWire draws on after hydration: reload under this tempo and sample its mask offset.
      await page.goto(`${baseUrl}/components/ghost-wire`, { waitUntil: 'domcontentloaded' });
      await pause(page);
      await page.waitForSelector('.site-root[data-hydrated="true"]');
      await page.waitForTimeout(100);
      const offsets = await sampleAt60Hz(page, 700, () =>
        page.evaluate(() => [...document.querySelectorAll('.f12-preview-frame .f12-ghost-wire mask *')].map((n) => n.getAttribute('stroke-dashoffset')).join('|')),
      );
      result[t].wire = new Set(offsets).size;
      await page.clock.resume();
    }
    check(result.still.poses === 1 && result.still.dur === '0s' && result.still.anims === 0 && result.still.skeleton === 'none' && result.still.wire === 1 && errors.length === 0,
      'site propagation: selecting 0 in the header stops the JS-driven Metric count-up and GhostWire draw-on and the CSS-driven segmented indicator and Skeleton', result.still);
    check(result.twos.poses >= 6 && result.twos.poses <= 8 && /steps/.test(result.twos.tf) && result.twos.skeleton === 'f12SkeletonStep',
      'site propagation: 12 gives the stepped count-up (held poses), steps() indicator and stepped Skeleton', result.twos);
    check(result.ones.poses > 15 && /cubic-bezier/.test(result.ones.tf) && result.ones.skeleton === 'f12SkeletonSmooth' && result.ones.wire > result.twos.wire,
      'site propagation: 60 gives a continuous count-up and draw-on, cubic-bezier indicator and smooth Skeleton', result.ones);
    await ctx.close();
  }

  // ------------------------------------------------------------------------- live safety
  {
    const { ctx, page } = await open(browser, '/components/metric', { clock: true, tempo: 'twos' });
    const metric = () => page.evaluate(() => document.querySelector('.f12-preview-frame .f12-m-value [aria-hidden="true"]').textContent);
    const final = () => page.evaluate(() => document.querySelector('.f12-preview-frame .f12-m-value .f12-sr-only').textContent);
    await pause(page);
    await page.click('#metric-light-metric-rng-90');
    await page.waitForTimeout(80);
    await page.clock.runFor(170);
    const mid = await metric();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForTimeout(80);
    const settled = await metric();
    const target = await final();
    const after = await sampleAt60Hz(page, 300, metric);
    check(mid !== target && settled === target && after.every((v) => v === target),
      'site live safety: enabling OS reduced motion mid-tween settles the count-up immediately', { mid, settled, target });
    await page.clock.resume();
    await choose(page, 'ones');
    await choose(page, 'twos');
    const st = await page.evaluate(() => ({
      stored: localStorage.getItem('frame12-tempo'),
      note: document.querySelector('.site-header .f12-tempo-note')?.textContent || '',
    }));
    await pause(page);
    await page.click('#metric-light-metric-rng-7');
    await page.waitForTimeout(80);
    const vals = await sampleAt60Hz(page, 700, metric);
    check(st.stored === 'twos' && st.note.includes('0 · your system setting') && new Set(vals).size === 1,
      'site live safety: selecting 12 under reduced motion keeps the stored preference and shows "0 · your system setting", but nothing moves', { ...st, distinct: new Set(vals).size });
    await ctx.close();
  }

  // ------------------------------------------------------------------------ M shortcut
  {
    const { ctx, page, errors } = await open(browser, '/components/input');
    const seen = [];
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('m');
      await page.waitForTimeout(40);
      seen.push([await tempoOf(page), await page.evaluate(() => document.getElementById('site-tempo-status').textContent)]);
    }
    const order = seen.map((s) => s[0]).join('>');
    const announced = seen.map((s) => s[1]);
    const region = await page.evaluate(() => {
      const r = document.getElementById('site-tempo-status');
      return { live: r.getAttribute('aria-live'), role: r.getAttribute('role') };
    });
    // Typing in an input never changes the tempo.
    const input = page.locator('.f12-preview-frame input[type="text"], .f12-preview-frame input:not([type])').first();
    await input.click();
    await input.press('End');
    await page.keyboard.type('mmM');
    await page.waitForTimeout(40);
    const typed = await input.inputValue();
    const afterTyping = await tempoOf(page);
    check(order === 'twos>ones>still>auto' && announced[0] === 'Animation tempo: 12, on twos' && announced[2] === 'Animation tempo: 0, no motion' &&
      region.live === 'polite' && afterTyping === 'auto' && typed.endsWith('mmM') && errors.length === 0,
      'site M shortcut: cycles auto → twos → ones → still → auto, announces each tempo in a polite live region, and does nothing while typing',
      { order, announced, region, afterTyping, typed: typed.slice(-6) });
    await ctx.close();
  }

  // ---------------------------------------------------------------------- Motion Studio
  for (const [tempo, reduced, wantStepped, wantCompare, note] of [
    ['auto', 'no-preference', 'stepped', 'smooth', false],
    ['twos', 'no-preference', 'stepped', 'smooth', false],
    ['ones', 'no-preference', 'stepped', 'smooth', false],
    ['still', 'no-preference', 'cut', 'cut', true],
    ['twos', 'reduce', 'cut', 'cut', true],
  ]) {
    const { ctx, page, errors } = await open(browser, '/motion', { tempo, reduced });
    const st = await page.evaluate(() => {
      const stages = [...document.querySelectorAll('[data-stage-motion]')];
      const ind = stages[0]?.querySelector('.f12-rng-ind');
      return {
        stages: stages.map((s) => s.getAttribute('data-stage-motion')),
        steppedIndicator: ind ? getComputedStyle(ind).transitionTimingFunction : '',
        note: document.getElementById('motion-off-note')?.textContent || null,
      };
    });
    const ok =
      st.stages[0] === wantStepped && st.stages[1] === wantCompare &&
      (note ? st.note === 'Motion is off (your setting). The timing values below still apply.' : st.note === null) &&
      (wantStepped !== 'stepped' || /steps/.test(st.steppedIndicator)) && errors.length === 0;
    check(ok, `site Motion Studio [tempo ${tempo}${reduced === 'reduce' ? ', OS reduced motion' : ''}]: stages show ${wantStepped} / ${wantCompare}${note ? ' with the "Motion is off" note' : ''}`, st);
    await ctx.close();
  }
  {
    // The comparison stage still switches to Cut, and Play runs.
    const { ctx, page } = await open(browser, '/motion', { tempo: 'ones' });
    await page.click('#stage-compare-mode-cut');
    await page.click('#motion-play-btn');
    await page.waitForTimeout(200);
    const stages = await page.evaluate(() => [...document.querySelectorAll('[data-stage-motion]')].map((s) => s.getAttribute('data-stage-motion')));
    check(stages.join(',') === 'stepped,cut', 'site Motion Studio: under 60 the stepped stage stays stepped and the comparison stage can still be set to cut', stages);
    await ctx.close();
  }

  // ------------------------------------------------- header control: layout, targets, axe
  for (const [label, w] of [['320px', 320], ['390px', 390], ['200% zoom (640 CSS px)', 640], ['400% zoom (320 CSS px)', 320], ['1280px', 1280]]) {
    for (const scheme of ['light', 'dark']) {
      const { ctx, page } = await open(browser, '/', { w, h: 800, scheme });
      const m = await page.evaluate(() => {
        const fs = document.querySelector('.site-header .f12-tempo');
        const r = fs.getBoundingClientRect();
        const targets = [...fs.querySelectorAll('label')].map((l) => l.getBoundingClientRect()).map((t) => [Math.round(t.width), Math.round(t.height)]);
        return { left: Math.round(r.left), right: Math.round(r.right), vw: window.innerWidth, docOverflow: document.documentElement.scrollWidth > window.innerWidth, targets };
      });
      const axe = await new AxeBuilder({ page }).include('.site-header').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
      const minTarget = Math.min(...m.targets.flat());
      check(m.left >= 0 && m.right <= m.vw && !m.docOverflow && minTarget >= 24 && axe.violations.length === 0,
        `site header TempoControl at ${label} (${scheme}): fits without overflow, targets ≥ 24×24 (smallest ${minTarget}px), axe zero violations`,
        { ...m, axe: axe.violations.map((v) => v.id) });
      await ctx.close();
    }
  }

  // ------------------------------------------------------------- asChild layout neutrality
  {
    const boxes = {};
    for (const t of ['auto', 'twos', 'still']) {
      const { ctx, page } = await open(browser, '/', { tempo: t });
      boxes[t] = await page.evaluate(() => {
        const root = document.querySelector('.site-root');
        const box = (el) => {
          const r = el.getBoundingClientRect();
          return [r.x, r.y, r.width, r.height].map(Math.round).join(',');
        };
        return {
          parent: root.parentElement.tagName,
          attr: root.getAttribute('data-f12-tempo'),
          display: getComputedStyle(root).display,
          root: box(root),
          parts: ['.site-header', '.site-main', '.site-footer'].map((s) => box(document.querySelector(s))).join('|'),
        };
      });
      await ctx.close();
    }
    check(boxes.auto.parent === 'BODY' && boxes.auto.root === boxes.twos.root && boxes.auto.root === boxes.still.root &&
      boxes.auto.parts === boxes.twos.parts && boxes.auto.parts === boxes.still.parts && boxes.twos.attr === 'twos',
      'site TempoProvider asChild: no wrapper element (site root is a direct body child carrying data-f12-tempo); root, header, main and footer boxes identical at every tempo', boxes);
  }

  // ------------------------------------------------------------------------- cross-tab
  {
    const { ctx, page: a } = await open(browser, '/');
    const b = await ctx.newPage();
    await b.goto(`${baseUrl}/motion`, { waitUntil: 'networkidle' });
    await choose(a, 'ones');
    await b.waitForFunction(() => document.querySelector('.site-root').getAttribute('data-f12-tempo') === 'ones', null, { timeout: 3000 }).catch(() => {});
    const st = await b.evaluate(() => ({
      root: document.querySelector('.site-root').getAttribute('data-f12-tempo'),
      html: document.documentElement.getAttribute('data-f12-tempo'),
      checked: document.querySelector('#site-tempo-ones').checked,
    }));
    check(st.root === 'ones' && st.html === 'ones' && st.checked, 'site cross-tab: choosing 60 in one tab updates the other tab\'s provider, <html data-f12-tempo> and header control', st);
    await ctx.close();
  }

  await browser.close();
} finally {
  server.kill('SIGTERM');
}

console.log(failures ? `\n${failures} site tempo check(s) failed` : '\nAll site tempo checks passed');
process.exitCode = failures ? 1 : 0;
