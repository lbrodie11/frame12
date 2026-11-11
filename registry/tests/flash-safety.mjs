// Flash safety (F12-08): an engineering gate that APPROXIMATES WCAG 2.3.1 (Three Flashes or Below
// Threshold). It does not certify conformance.
//
// Every motion consumer and block is driven through state changes at tempo `twos` and `ones`.
// Time is seeked deterministically: Playwright's fake clock drives requestAnimationFrame/timers,
// and every CSS animation/transition from document.getAnimations() is paused and seeked to the
// same 60 Hz sample time, so no real-time screenshots are involved.
//
// Each sample frame is reduced to 8×8 px cells. Per cell, a transition is a rise or fall of
// relative luminance of at least 0.10 (where the darker state is below 0.80), or, for saturated
// red (R / (R+G+B) ≥ 0.8), a change of at least 20 in (R − G − B) × 320. A region transitions
// when at least 25% of a 341 × 256 px region (WCAG's approximation of a 10° visual field at
// 1024 × 768, scaled to the test viewport; sliding grid, one-cell stride) transitions in the same
// direction on the same frame. A flash is a pair of opposing region transitions. The gate fails
// at more than 3 flashes in any 1-second window. Intentionally failing fixtures (a large
// luminance flip and a saturated-red flash) must be caught; a small-area flicker must not.
//   node tests/flash-safety.mjs
import { launch } from './lib.mjs';
import { bundlePage, openFixture, REGISTRY_ROOT } from './harness.mjs';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failures = 0;
function check(ok, label, detail = '') {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`);
}

const VW = 1024;
const VH = 768;
const CELL = 8;
const REGION_W = Math.round((341 * VW) / 1024);
const REGION_H = Math.round((256 * VH) / 768);
const SAMPLE_MS = 1000 / 60;

// ------------------------------------------------------------------------------ frame decoding
async function makeDecoder(browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.setContent('<canvas id="c"></canvas>');
  return {
    close: () => ctx.close(),
    /** JPEG → per-cell { lum: relative luminance, red: saturated-red value } (row-major). */
    decode: (png) =>
      page.evaluate(
        async ({ b64, cell }) => {
          const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
          const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/jpeg' }));
          const c = document.getElementById('c');
          c.width = bmp.width;
          c.height = bmp.height;
          const g = c.getContext('2d', { willReadFrequently: true });
          g.drawImage(bmp, 0, 0);
          const { data } = g.getImageData(0, 0, bmp.width, bmp.height);
          const cw = Math.floor(bmp.width / cell);
          const ch = Math.floor(bmp.height / cell);
          const lin = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
          const LUT = new Float32Array(256).map((_, i) => lin(i / 255));
          const lum = new Array(cw * ch);
          const red = new Array(cw * ch);
          for (let cy = 0; cy < ch; cy++)
            for (let cx = 0; cx < cw; cx++) {
              let L = 0, R = 0, G = 0, B = 0;
              for (let y = cy * cell; y < (cy + 1) * cell; y++)
                for (let x = cx * cell; x < (cx + 1) * cell; x++) {
                  const i = (y * bmp.width + x) * 4;
                  L += 0.2126 * LUT[data[i]] + 0.7152 * LUT[data[i + 1]] + 0.0722 * LUT[data[i + 2]];
                  R += data[i] / 255;
                  G += data[i + 1] / 255;
                  B += data[i + 2] / 255;
                }
              const n = cell * cell;
              L /= n; R /= n; G /= n; B /= n;
              const sum = R + G + B;
              lum[cy * cw + cx] = L;
              red[cy * cw + cx] = sum > 0 && R / sum >= 0.8 ? Math.max(0, (R - G - B) * 320) : 0;
            }
          return { cw, ch, lum, red };
        },
        { b64: png.toString('base64'), cell: CELL },
      ),
  };
}

// ------------------------------------------------------------------------------ flash analysis
/** Per cell: transition events [frame, +1|-1] found with hysteresis on the cell's time series. */
function cellEvents(series, threshold, darkerLimit) {
  const events = [];
  let dir = 0;
  let min = series[0];
  let max = series[0];
  for (let t = 1; t < series.length; t++) {
    const v = series[t];
    if (dir <= 0 && v - min >= threshold && (darkerLimit === null || min < darkerLimit)) {
      events.push([t, 1]);
      dir = 1;
      max = v;
      min = v;
    } else if (dir >= 0 && max - v >= threshold && (darkerLimit === null || v < darkerLimit)) {
      events.push([t, -1]);
      dir = -1;
      min = v;
      max = v;
    }
    min = Math.min(min, v);
    max = Math.max(max, v);
  }
  return events;
}

/** Max flashes (pairs of opposing region transitions) in any 1 s window, over all regions. */
export function analyzeFrames(frames, key, threshold, darkerLimit) {
  const { cw, ch } = frames[0];
  const T = frames.length;
  const rw = Math.round(REGION_W / CELL);
  const rh = Math.round(REGION_H / CELL);
  const need = Math.ceil(rw * rh * 0.25);
  // Per frame: up/down maps of cells that transition on that frame.
  const up = Array.from({ length: T }, () => new Uint8Array(cw * ch));
  const down = Array.from({ length: T }, () => new Uint8Array(cw * ch));
  let anyEvent = false;
  for (let c = 0; c < cw * ch; c++) {
    const series = frames.map((f) => f[key][c]);
    for (const [t, d] of cellEvents(series, threshold, darkerLimit)) {
      (d > 0 ? up : down)[t][c] = 1;
      anyEvent = true;
    }
  }
  if (!anyEvent) return { maxPerSecond: 0, regions: 0 };
  const prefix = (m) => {
    const p = new Int32Array((cw + 1) * (ch + 1));
    for (let y = 0; y < ch; y++)
      for (let x = 0; x < cw; x++)
        p[(y + 1) * (cw + 1) + x + 1] = m[y * cw + x] + p[y * (cw + 1) + x + 1] + p[(y + 1) * (cw + 1) + x] - p[y * (cw + 1) + x];
    return p;
  };
  const sum = (p, x, y) =>
    p[(y + rh) * (cw + 1) + x + rw] - p[y * (cw + 1) + x + rw] - p[(y + rh) * (cw + 1) + x] + p[y * (cw + 1) + x];
  const nx = Math.max(1, cw - rw + 1);
  const ny = Math.max(1, ch - rh + 1);
  const regionEvents = Array.from({ length: nx * ny }, () => []);
  for (let t = 0; t < T; t++) {
    if (!up[t].some(Boolean) && !down[t].some(Boolean)) continue;
    const pu = prefix(up[t]);
    const pd = prefix(down[t]);
    for (let y = 0; y < ny; y++)
      for (let x = 0; x < nx; x++) {
        if (sum(pu, x, y) >= need) regionEvents[y * nx + x].push([t, 1]);
        if (sum(pd, x, y) >= need) regionEvents[y * nx + x].push([t, -1]);
      }
  }
  let maxPerSecond = 0;
  let regions = 0;
  const window = Math.round(1000 / SAMPLE_MS);
  for (const evs of regionEvents) {
    if (!evs.length) continue;
    regions++;
    const flashes = [];
    let pending = null;
    for (const [t, d] of evs) {
      if (pending && pending[1] !== d) {
        flashes.push(t);
        pending = null;
      } else pending = [t, d];
    }
    for (let i = 0; i < flashes.length; i++) {
      let n = 0;
      for (let j = i; j < flashes.length && flashes[j] - flashes[i] < window; j++) n++;
      maxPerSecond = Math.max(maxPerSecond, n);
    }
  }
  return { maxPerSecond, regions };
}

// ------------------------------------------------------------------------------------- capture
const SEEK = `(t) => {
  window.__f12Seen = window.__f12Seen || new Map();
  for (const a of document.getAnimations()) {
    if (!window.__f12Seen.has(a)) {
      window.__f12Seen.set(a, t - (a.currentTime || 0));
      a.pause();
    }
    a.currentTime = Math.max(0, t - window.__f12Seen.get(a));
  }
}`;

/** Drives `act(i)` at the given sample indices and captures `frames` samples at 60 Hz. */
async function capture(page, decoder, { frames = 90, actions = {} } = {}) {
  const out = [];
  let elapsed = 0;
  await page.evaluate(`window.__f12Seek = ${SEEK}`);
  for (let i = 0; i < frames; i++) {
    const target = Math.round(i * SAMPLE_MS);
    if (target > elapsed) {
      await page.clock.runFor(target - elapsed);
      elapsed = target;
    }
    if (actions[i]) {
      await actions[i]();
      await page.waitForTimeout(40); // React commits on a real-time task; the clock stays paused.
    }
    await page.evaluate((t) => window.__f12Seek(t), target);
    // JPEG q90: compression noise is far below the 0.10 luminance threshold on 8×8 cell averages.
    out.push(await decoder.decode(await page.screenshot({ type: 'jpeg', quality: 90, animations: 'allow' })));
  }
  return out;
}

const verdict = (frames) => ({
  general: analyzeFrames(frames, 'lum', 0.1, 0.8),
  red: analyzeFrames(frames, 'red', 20, null),
  // How many sample frames differ visibly from the previous one: proof the capture saw motion.
  changedFrames: frames.filter((f, i) => i > 0 && f.lum.some((v, c) => Math.abs(v - frames[i - 1].lum[c]) > 0.002)).length,
});

const browser = await launch('chromium');
const decoder = await makeDecoder(browser);

// --------------------------------------------------------------------------- failing fixtures
const FIXTURES = {
  'luminance flip (600×400 black/white, 6 Hz)': { css: 'width:600px;height:400px', a: '#000', b: '#fff', hz: 6, expect: 'general' },
  'saturated red flash (600×400 red/black, 6 Hz)': { css: 'width:600px;height:400px', a: '#000', b: '#f00', hz: 6, expect: 'red' },
  'small-area flicker (60×60 black/white, 6 Hz)': { css: 'width:60px;height:60px', a: '#000', b: '#fff', hz: 6, expect: 'none' },
  'slow luminance flip (600×400, 1 Hz)': { css: 'width:600px;height:400px', a: '#000', b: '#fff', hz: 1, expect: 'none' },
};
for (const [name, f] of Object.entries(FIXTURES)) {
  const html = `<!doctype html><html><body style="margin:0;background:#fff"><div id="x" style="${f.css};background:${f.a}"></div><script>
    let on = false; setInterval(() => { on = !on; document.getElementById('x').style.background = on ? '${f.b}' : '${f.a}'; }, ${1000 / f.hz / 2});
  </script></body></html>`;
  const { ctx, page } = await openFixture(browser, html, { w: VW, h: VH });
  const frames = await capture(page, decoder, { frames: 75 });
  const v = verdict(frames);
  const caughtGeneral = v.general.maxPerSecond > 3;
  const caughtRed = v.red.maxPerSecond > 3;
  const ok =
    f.expect === 'general' ? caughtGeneral : f.expect === 'red' ? caughtRed : !caughtGeneral && !caughtRed;
  check(ok, `flash fixture "${name}": ${f.expect === 'none' ? 'passes the gate' : `caught as a ${f.expect} flash`}`, {
    general: v.general.maxPerSecond,
    red: v.red.maxPerSecond,
  });
  await ctx.close();
}

// ------------------------------------------------------------------------ components and blocks
const html = await bundlePage(resolve(REGISTRY_ROOT, 'tests/fixtures/tempo-fixture.tsx'));
const BLOCKS = ['analytics-dashboard', 'developer-console', 'workspace-settings'];
const COMPONENTS = ['metric', 'metric-quiet', 'metric-smooth', 'ghost-wire', 'sheet-stepped', 'sheet-smooth', 'sheet-cut', 'tone-bar-list', 'tone-spark', 'tone-area-chart'];
const CLICK = `(() => {
  const el = [...document.querySelectorAll('#root .f12-rng-btn[aria-pressed="false"], #root [role="tab"][aria-selected="false"]')]
    .find((e) => !e.closest('.f12-tempo'));
  el.scrollIntoView({ block: 'center' });
  return el.id;
})()`;
const jobs = ['twos', 'ones'].flatMap((tempo) => [...COMPONENTS, ...BLOCKS].map((name) => ({ tempo, name })));
const results = new Map();
// Ink line art (F12-14): the whole InkSequence (4 beats × 12 poses = 4.0 s at twos; the same
// duration smooth at ones), started by a user action at frame 0 and captured to the end. Its two
// long captures run in the same worker pool as the components (queued first, as the longest).
const inkHtml = await bundlePage(resolve(REGISTRY_ROOT, 'tests/fixtures/ink-fixture.tsx'));
const INK_JOBS = ['twos', 'ones'].map((tempo) => ({ tempo, name: 'ink-sequence' }));
async function runInkJob({ tempo, name }, dec) {
  const { ctx, page, errors } = await openFixture(browser, inkHtml, { w: VW, h: VH });
  await page.evaluate((t) => window.__render('sequence', { tempo: t }), tempo);
  await page.waitForTimeout(100);
  const frames = await capture(page, dec, { frames: 252, actions: { 0: () => page.evaluate(() => window.__toggle()) } });
  results.set(`${tempo}/${name}`, { ...verdict(frames), errors });
  await ctx.close();
}
// The Edit Room (F12-10): the four CutMorph demos at AUTO, 12 and 60, three quick state changes
// each (333 ms apart, like filtering quickly). View Transition pseudo-element animations are in
// document.getAnimations(), so the same pause-and-seek capture drives them.
const edCss = readFileSync(resolve(REGISTRY_ROOT, '../site/src/components/edit-room.css'), 'utf8');
const edHtml = await bundlePage(resolve(REGISTRY_ROOT, 'tests/fixtures/edit-room-entry.tsx'), { head: `<style>${edCss}</style>` });
const ED_STEPS = {
  filter: ['#er-filter-filter-ink', '#er-filter-filter-final', '#er-filter-filter-all'],
  reorder: ['#er-reorder-sort-length', '#er-reorder-sort-stage', '#er-reorder-sort-cut'],
  open: ['#er-open-row-s002', '#er-open-row-s005', '#er-open-row-s005'],
  cut: ['#er-cut-filter-ink', '#er-cut-filter-final', '#er-cut-filter-all'],
};
const ED_JOBS = ['auto', 'twos', 'ones'].flatMap((tempo) => Object.keys(ED_STEPS).map((demo) => ({ tempo, name: `edit-room-${demo}`, demo })));
async function runEditRoomJob({ tempo, name, demo }, dec) {
  const { ctx, page, errors } = await openFixture(browser, edHtml, { w: VW, h: VH });
  await page.evaluate(([d, t]) => window.__er.mount({ demo: d, tempo: t }), [demo, tempo]);
  await page.waitForTimeout(150);
  const [a, b, c] = ED_STEPS[demo].map((sel) => () => page.evaluate((x) => document.querySelector(x).click(), sel));
  const frames = await capture(page, dec, { frames: 90, actions: { 0: a, 20: b, 40: c } });
  const changed = await page.evaluate(() => document.querySelector('[role="status"]')?.textContent ?? '');
  results.set(`${tempo}/${name}`, { ...verdict(frames), errors, changed });
  await ctx.close();
}
async function runJob({ tempo, name, demo }, dec) {
  if (demo) return runEditRoomJob({ tempo, name, demo }, dec);
  if (name === 'ink-sequence') return runInkJob({ tempo, name }, dec);
  const { ctx, page, errors } = await openFixture(browser, html, { w: VW, h: VH });
  await page.evaluate(([n, t]) => window.__render('consumers', { only: [n], tempo: t }), [name, tempo]);
  await page.clock.runFor(1500);
  await page.waitForTimeout(150);
  await page.clock.runFor(500);
  let act;
  if (BLOCKS.includes(name)) {
    // Click through three different options/tabs, 333 ms apart, scrolled into view.
    await page.evaluate(CLICK);
    await page.waitForTimeout(50);
    act = () =>
      page.evaluate(() => {
        const el = [...document.querySelectorAll('#root .f12-rng-btn[aria-pressed="false"], #root [role="tab"][aria-selected="false"]')]
          .find((e) => !e.closest('.f12-tempo'));
        el?.click();
      });
  } else {
    act = () => page.evaluate(() => window.__step());
  }
  const frames = await capture(page, dec, { frames: 90, actions: { 0: act, 20: act, 40: act } });
  results.set(`${tempo}/${name}`, { ...verdict(frames), errors });
  await ctx.close();
}
const decoders = [decoder, await makeDecoder(browser), await makeDecoder(browser), await makeDecoder(browser)];
const queue = [...INK_JOBS, ...ED_JOBS, ...jobs];
await Promise.all(
  decoders.map(async (dec) => {
    while (queue.length) await runJob(queue.shift(), dec);
  }),
);
for (const { tempo, name } of jobs) {
  const v = results.get(`${tempo}/${name}`);
  check(v.general.maxPerSecond <= 3 && v.red.maxPerSecond <= 3 && v.errors.length === 0,
    `flash safety [${tempo}] ${name}: ≤ 3 general and ≤ 3 red flashes per second in any 341×256 region across 3 state changes`,
    { general: v.general.maxPerSecond, red: v.red.maxPerSecond, changedFrames: v.changedFrames, errors: v.errors });
}
for (const { tempo, name } of INK_JOBS) {
  const v = results.get(`${tempo}/${name}`);
  check(v.general.maxPerSecond <= 3 && v.red.maxPerSecond <= 3 && v.changedFrames > 0 && v.errors.length === 0,
    `flash safety [${tempo}] ink-sequence: full 48-pose play, ≤ 3 general and ≤ 3 red flashes per second in any 341×256 region`,
    { general: v.general.maxPerSecond, red: v.red.maxPerSecond, changedFrames: v.changedFrames, errors: v.errors });
}
for (const { tempo, name } of ED_JOBS) {
  const v = results.get(`${tempo}/${name}`);
  check(v.general.maxPerSecond <= 3 && v.red.maxPerSecond <= 3 && v.changedFrames > 0 && v.errors.length === 0,
    `flash safety [${tempo}] ${name} (CutMorph): ≤ 3 general and ≤ 3 red flashes per second in any 341×256 region across 3 quick edits`,
    { general: v.general.maxPerSecond, red: v.red.maxPerSecond, changedFrames: v.changedFrames, status: v.changed, errors: v.errors });
}

// ExposureScrubber flipbook at 4× (F12-09): 48 poses per second on a 200-frame run. Only the
// sheet's current-row highlight moves (the panel shows a static FLIPPING slate) and the sheet
// pages by whole screens; the gate must hold at the fastest rate.
{
  const xsHtml = await bundlePage(resolve(REGISTRY_ROOT, 'tests/fixtures/exposure-fixture.tsx'));
  for (const width of [1024, 420]) {
    const { ctx, page, errors } = await openFixture(browser, xsHtml, { w: VW, h: VH });
    await page.evaluate(
      (w) => window.__xs({ n: 200, width: w, genOpts: { statuses: true, markers: [40, 120], holds: [1, 1, 2] }, props: { timing: 'flipbook', defaultRate: 4 } }),
      width,
    );
    await page.waitForTimeout(150);
    const play = () => page.evaluate(() => document.getElementById('xa-play').click());
    const frames = await capture(page, decoder, { frames: 120, actions: { 0: play } });
    const v = verdict(frames);
    const flipped = await page.evaluate(() => Number(document.querySelector('#xa tbody tr[aria-current="step"] .f12-xs-btn')?.dataset.i ?? -1));
    check(
      v.general.maxPerSecond <= 3 && v.red.maxPerSecond <= 3 && errors.length === 0 && flipped > 40,
      `flash safety [flipbook 4×] exposure-scrubber (${width}px container): ≤ 3 general and ≤ 3 red flashes per second in any 341×256 region over 2 s of flipping`,
      { general: v.general.maxPerSecond, red: v.red.maxPerSecond, changedFrames: v.changedFrames, posesReached: flipped, errors },
    );
    await ctx.close();
  }
}

await Promise.all(decoders.slice(1).map((d) => d.close()));
await decoder.close();
await browser.close();
console.log(failures ? `\n${failures} flash-safety check(s) failed` : '\nAll flash-safety checks passed (an approximation of WCAG 2.3.1, not a certification)');
process.exit(failures ? 1 : 0);
