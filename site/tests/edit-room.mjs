// /motion/edit-room (F12-10): the four CutMorph demos and the pose inspector on the built site,
// in Chromium, Firefox and WebKit. Keyboard, focus, live regions, tempo, interruption, axe and
// forced colors. Run after `next build`.
//
//   node tests/edit-room.mjs
//   BROWSERS=chromium node tests/edit-room.mjs
import AxeBuilder from '@axe-core/playwright';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import { launch } from '../../registry/tests/lib.mjs';

const SITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KEY = 'frame12-tempo';
const BROWSERS = (process.env.BROWSERS || 'chromium,firefox,webkit').split(',').map((s) => s.trim()).filter(Boolean);

let failures = 0;
function check(ok, label, detail = '') {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`);
}
async function section(name, fn) {
  try {
    await fn();
  } catch (err) {
    check(false, `${name}: threw`, String(err?.stack || err).slice(0, 700));
  }
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
      if ((await fetch(`${baseUrl}/motion/edit-room`)).ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('next start did not become ready');
}

const INIT = `(() => {
  window.__vt = [];
  window.__pending = 0;
  window.__unhandled = [];
  addEventListener('unhandledrejection', (e) => window.__unhandled.push(String(e.reason)));
  for (const proto of [Document.prototype, Element.prototype]) {
    const orig = proto.startViewTransition;
    if (!orig) continue;
    proto.startViewTransition = function (...a) {
      const vt = orig.apply(this, a);
      window.__pending++;
      const done = () => { window.__pending--; };
      vt.finished.then(done, done);
      window.__vt.push({ scope: this === document ? 'document' : this.getAttribute('data-er-demo') || this.tagName, at: performance.now() });
      return vt;
    };
  }
  window.__vtAnims = () => document.getAnimations().filter((a) => a.effect && a.effect.pseudoElement && a.effect.pseudoElement.startsWith('::view-transition'));
})()`;

async function open(browser, { tempo = 'twos', w = 1280, h = 900, reduced = 'no-preference', scheme = 'light', forcedColors = 'none' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: reduced, colorScheme: scheme, forcedColors });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' || /hydrat|did not match/i.test(m.text())) errors.push(m.text());
  });
  await page.addInitScript(([k, t]) => {
    try {
      localStorage.setItem(k, t);
    } catch {
      /* storage blocked */
    }
  }, [KEY, tempo]);
  await page.addInitScript(INIT);
  await page.goto(`${baseUrl}/motion/edit-room`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!document.getElementById('er-engine') && !/Checking/.test(document.getElementById('er-engine').textContent));
  return { ctx, page, errors };
}
const stageButton = (page, demo, label) => page.locator(`[data-er-demo="er-${demo}"] [role="group"] button`, { hasText: new RegExp(`^${label}`) }).first();
// Never polls document.getAnimations(): calling it every frame during a transition with many
// exiting groups crashes WebKit 27.2's web process (docs/architecture/cut-morph.md).
const idle = (page) => page.waitForFunction(() => window.__pending === 0 && !document.activeViewTransition, null, { timeout: 5000 });
/** Waits until `cond` holds, then reports whether the transition was still running at that moment. */
const whileRunning = (page, cond) =>
  page.waitForFunction(new Function(`return (${cond})() ? { running: window.__pending > 0 } : false;`), null, { timeout: 5000, polling: 'raf' }).then((h) => h.jsonValue());

await waitForServer();
try {
  for (const engine of BROWSERS) {
    const browser = await launch(engine);
    const E = `[${engine}]`;
    try {
      await section(`${E} filter`, async () => {
        const { ctx, page, errors } = await open(browser);
        const ink = stageButton(page, 'filter', 'Ink');
        await ink.focus();
        await page.keyboard.press('Enter');
        // The live region has its new text while the transition still runs (the update lands on
        // the next frame, after the old state is captured, not when the animation ends).
        const live = await whileRunning(page, "() => /· Ink/.test(document.getElementById('er-filter-status').textContent)");
        const mid = await page.evaluate(() => ({ status: document.getElementById('er-filter-status').textContent, vt: window.__vt.slice() }));
        mid.runningWhenAnnounced = live.running;
        await idle(page);
        const after = await page.evaluate(() => ({ rows: document.querySelectorAll('#er-filter-list li').length, focus: document.activeElement?.id, named: getComputedStyle(document.querySelector('#er-filter-list li')).viewTransitionName }));
        const scope = mid.vt[0]?.scope;
        check(/Showing \d+ of 200 shots · Ink/.test(mid.status) && mid.runningWhenAnnounced && mid.vt.length === 1 && (engine === 'chromium' ? scope === 'er-filter' : scope === 'document') && after.rows < 200 && after.focus?.startsWith('er-filter-filter') && /^er-filter-s\d{3}$/.test(after.named),
          `${E} filter: Enter on a stage runs one ${engine === 'chromium' ? 'element-scoped' : 'document'} match cut; the live region updates at once; focus stays on the control`, { mid, after });
        // Filter quickly three times: every change lands, in order; nothing unhandled.
        for (const l of ['Key', 'Color', 'Final']) await stageButton(page, 'filter', l).click();
        await idle(page);
        const s = await page.evaluate(() => ({ status: document.getElementById('er-filter-status').textContent, pressed: document.querySelector('[data-er-demo="er-filter"] [aria-pressed="true"]')?.textContent, unhandled: window.__unhandled }));
        check(/· Final$/.test(s.status) && /^Final/.test(s.pressed) && s.unhandled.length === 0 && errors.length === 0, `${E} filter: three quick filters land on the last one; no errors or unhandled rejections`, { ...s, errors });
        await ctx.close();
      });

      await section(`${E} reorder`, async () => {
        const { ctx, page, errors } = await open(browser);
        const len = stageButton(page, 'reorder', 'Length');
        await len.focus();
        await page.keyboard.press('Enter');
        await whileRunning(page, "() => /longest/.test(document.getElementById('er-reorder-status').textContent)");
        const during = await page.evaluate(() => document.activeElement?.textContent);
        await idle(page);
        const r = await page.evaluate(() => ({ focus: document.activeElement?.textContent, status: document.getElementById('er-reorder-status').textContent, first: document.querySelector('#er-reorder-list li .er-len').textContent, frames: [...document.querySelectorAll('#er-reorder-list li .er-len')].map((e) => parseInt(e.textContent, 10)) }));
        const sortedDesc = r.frames.every((f, i, a) => i === 0 || a[i - 1] >= f);
        check(/^Length/.test(during) && /^Length/.test(r.focus) && /longest first/.test(r.status) && sortedDesc && errors.length === 0,
          `${E} reorder: sorting by Length keeps focus on the sort control, during and after the transition`, r);
        await ctx.close();
      });

      await section(`${E} open`, async () => {
        const { ctx, page, errors } = await open(browser);
        await page.locator('#er-open-row-s002').focus();
        await page.keyboard.press('Enter');
        const moved = await whileRunning(page, "() => document.activeElement?.id === 'er-open-detail-title'");
        const focusNow = await page.evaluate(() => document.activeElement?.id);
        // Keep interacting during the transition: Tab reaches the Close button.
        await page.keyboard.press('Tab');
        const tabbed = await page.evaluate(() => document.activeElement?.id);
        await idle(page);
        const open1 = await page.evaluate(() => ({ expanded: document.getElementById('er-open-row-s002').getAttribute('aria-expanded'), heading: document.getElementById('er-open-detail-title')?.textContent, shared: getComputedStyle(document.getElementById('er-open-detail')).viewTransitionName, slot: getComputedStyle(document.getElementById('er-open-row-s002')).viewTransitionName }));
        check(moved.running && focusNow === 'er-open-detail-title' && tabbed === 'er-open-close' && open1.expanded === 'true' && open1.shared === 'er-open-s002' && open1.slot === 'er-open-s002-slot',
          `${E} open: Enter on a row match-cuts it into the panel (shared name); focus moves to the panel heading (the demo's job); Tab works mid-transition`, { runningWhenFocused: moved.running, focusNow, tabbed, ...open1 });
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => document.activeElement?.id === 'er-open-row-s002', null, { timeout: 5000 });
        const back = await page.evaluate(() => document.activeElement?.id);
        await idle(page);
        const closed = await page.evaluate(() => ({ detail: !!document.getElementById('er-open-detail'), focus: document.activeElement?.id }));
        check(back === 'er-open-row-s002' && !closed.detail && closed.focus === 'er-open-row-s002' && errors.length === 0, `${E} open: Escape closes it and returns focus to the row`, { back, ...closed, errors });
        await ctx.close();
      });

      await section(`${E} cut`, async () => {
        const { ctx, page } = await open(browser);
        await stageButton(page, 'cut', 'Ink').click();
        const r = await page.evaluate(() => ({ vt: window.__vt.length, status: document.getElementById('er-cut-status').textContent, named: [...document.querySelectorAll('#er-cut-list li')].some((li) => getComputedStyle(li).viewTransitionName !== 'none') }));
        check(r.vt === 0 && /· Ink$/.test(r.status) && !r.named, `${E} cut: the Cut demo changes at once with no View Transition and no names`, r);
        await ctx.close();
      });

      await section(`${E} tempo`, async () => {
        for (const [tempo, expectVt] of [['still', 0], ['ones', 1]]) {
          const { ctx, page } = await open(browser, { tempo });
          await stageButton(page, 'filter', 'Ink').click();
          await idle(page);
          const r = await page.evaluate(() => ({ vt: window.__vt.length, status: document.getElementById('er-filter-status').textContent }));
          check(r.vt === expectVt && /· Ink$/.test(r.status), `${E} tempo ${tempo === 'still' ? '0' : '60'}: ${expectVt ? 'a smooth match cut' : 'an instant cut'} from the real Tempo control`, r);
          await ctx.close();
        }
        const { ctx, page } = await open(browser, { reduced: 'reduce' });
        await stageButton(page, 'filter', 'Ink').click();
        const r = await page.evaluate(() => window.__vt.length);
        check(r === 0, `${E} reduced motion: the filter is an instant cut`, { vt: r });
        await ctx.close();
      });

      await section(`${E} inspector`, async () => {
        const { ctx, page, errors } = await open(browser);
        await page.locator('#er-inspect-inspect').scrollIntoViewIfNeeded();
        await page.click('#er-inspect-inspect');
        await page.waitForFunction(() => /Paused at C-01/.test(document.getElementById('er-inspect-status').textContent), null, { timeout: 5000 });
        const xAt = () => page.evaluate(() => Number(getComputedStyle(document.documentElement, '::view-transition-group(er-inspect-subject)').transform.split(',')[4]));
        const x0 = await xAt();
        await page.click('#er-inspect-stop-p2');
        const s2 = await page.evaluate(() => document.getElementById('er-inspect-status').textContent);
        const x2 = await xAt();
        await page.click('#er-inspect-stop-p3');
        const x3 = await xAt();
        const swap = await page.evaluate(() => [getComputedStyle(document.documentElement, '::view-transition-old(er-inspect-subject)').opacity, getComputedStyle(document.documentElement, '::view-transition-new(er-inspect-subject)').opacity]);
        await page.click('#er-inspect-stop-c02');
        await page.waitForFunction(() => !document.getElementById('er-inspect-stop-c01')?.matches('[aria-pressed="true"]') && document.getElementById('er-inspect-stop-c01').disabled, null, { timeout: 5000 });
        const end = await page.evaluate(() => ({ subject: document.querySelector('.er-subject').textContent, cls: document.documentElement.className }));
        const step = (x2 - x0);
        check(/Pose 2/.test(s2) && step > 0 && Math.abs((x3 - x0) - 2 * step) < 1 && swap[0] === '0' && swap[1] === '1' && end.subject === 'C-02' && !/f12-vt-/.test(end.cls) && errors.length === 0,
          `${E} inspector: pauses a live edit at each pose via getAnimations (even steps, new image on pose 3), releases to C-02, cleans up`, { x0, x2, x3, swap, end, errors });
        await ctx.close();
      });

      await section(`${E} axe`, async () => {
        for (const [scheme, forcedColors, w] of [['light', 'none', 1280], ['dark', 'none', 1280], ['light', 'active', 1280], ['light', 'none', 390]]) {
          const { ctx, page, errors } = await open(browser, { scheme, forcedColors, w, h: 844 });
          await page.locator('#er-open-row-s001').click();
          await idle(page);
          const axe = await new AxeBuilder({ page }).analyze();
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          check(axe.violations.length === 0 && overflow <= 1 && errors.length === 0,
            `${E} axe (${scheme}${forcedColors === 'active' ? ', forced colors' : ''}, ${w}px): zero violations with a panel open; no horizontal overflow`,
            { violations: axe.violations.map((v) => `${v.id}: ${v.nodes.length}`), overflow, errors });
          await ctx.close();
        }
      });
    } finally {
      await browser.close();
    }
  }
} finally {
  server.kill();
}
console.log(failures ? `\n${failures} Edit Room check(s) failed` : '\nAll Edit Room checks passed');
process.exit(failures ? 1 : 0);
