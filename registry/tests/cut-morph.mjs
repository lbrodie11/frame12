// F12-10 CutMorph: useCutMorph, CutMorphName, withCutMorphMode and the view-transition grammar
// in frame12.css, on real View Transitions in Chromium, Firefox and WebKit.
//
//   node tests/cut-morph.mjs                        # all three engines
//   BROWSERS=chromium node tests/cut-morph.mjs
//
// Timing: View Transition animations run on the document timeline, not Playwright's fake clock,
// so every pose is sampled by pausing the pseudo-element animations (document.getAnimations())
// and seeking them. Nothing here depends on wall-clock sleeps for correctness.
import { copyFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { launch } from './lib.mjs';
import { bundlePage, loadServerModule, openFixture, REGISTRY_ROOT } from './harness.mjs';

let failures = 0;
function check(ok, label, detail = '') {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`);
}
async function section(name, fn) {
  try {
    await fn();
  } catch (err) {
    check(false, `${name}: threw`, String(err?.stack || err).slice(0, 800));
  }
}

const BROWSERS = (process.env.BROWSERS || 'chromium,firefox,webkit').split(',').map((s) => s.trim()).filter(Boolean);
const FIXTURE = resolve(REGISTRY_ROOT, 'tests/fixtures/cut-morph-fixture.tsx');
const POSE = 1000 / 12;

// A flushSync spy that stands in for `react-dom` inside cut-morph.tsx only.
const flushSyncSpy = {
  name: 'f12-flushsync-spy',
  setup(b) {
    b.onResolve({ filter: /^react-dom$/ }, (args) =>
      /cut-morph(-copy)?\.tsx$/.test(args.importer) ? { path: 'react-dom-spy', namespace: 'f12spy' } : undefined,
    );
    b.onLoad({ filter: /.*/, namespace: 'f12spy' }, () => ({
      contents:
        "import * as RD from 'react-dom'; export * from 'react-dom';" +
        'export function flushSync(fn) { window.__flushSync = (window.__flushSync || 0) + 1; return RD.flushSync(fn); }',
      resolveDir: REGISTRY_ROOT,
      loader: 'js',
    }));
  },
};

const HEAD = `<style>
body{min-height:3000px}
.stage{position:relative;height:260px;width:700px;margin:0}
.mover{position:absolute;top:10px;width:100px;height:50px}
.rows{position:absolute;top:80px;left:0;display:flex;gap:12px;margin:0;padding:0;list-style:none}
.row{width:60px;height:30px;background:rgb(200,200,200)}
.late{position:absolute;left:400px;top:200px;width:120px;height:40px}
.stage [role=status]{position:absolute;top:150px;left:0;margin:0}
#root2 .stage{margin-top:0}
</style>`;

const INIT = (opts = {}) => `(() => {
  window.__unhandled = [];
  addEventListener('unhandledrejection', (e) => window.__unhandled.push(String((e.reason && (e.reason.name + ': ' + e.reason.message)) || e.reason)));
  window.__vtCalls = 0;
  for (const proto of [Document.prototype, Element.prototype]) {
    const orig = proto.startViewTransition;
    if (!orig) continue;
    if (${!!opts.noVT}) { delete proto.startViewTransition; continue; }
    proto.startViewTransition = function (...a) { window.__vtCalls++; return orig.apply(this, a); };
  }
  if (${!!opts.hidden}) Object.defineProperty(document, 'visibilityState', { get: () => 'hidden' });
  const live = [];
  const add = window.addEventListener, rem = window.removeEventListener;
  const tracked = ['scroll', 'resize', 'pointerdown'];
  window.addEventListener = function (t, fn, o) { if (tracked.includes(t)) live.push([t, fn]); return add.call(this, t, fn, o); };
  window.removeEventListener = function (t, fn, o) { const i = live.findIndex(([lt, lf]) => lt === t && lf === fn); if (i >= 0) live.splice(i, 1); return rem.call(this, t, fn, o); };
  window.__liveListeners = () => live.length;
  window.__vtAnims = () => document.getAnimations().filter((a) => a.effect && a.effect.pseudoElement && a.effect.pseudoElement.startsWith('::view-transition'));
  window.__ready = async () => { const vt = document.activeViewTransition; if (!vt) return false; try { await vt.ready; return true; } catch { return false; } };
  window.__pause = () => { const a = window.__vtAnims(); a.forEach((x) => x.pause()); window.__p = a;
    return a.map((x) => ({ pe: x.effect.pseudoElement, name: x.animationName, dur: Math.round(x.effect.getTiming().duration * 10) / 10, easing: (x.effect.getKeyframes()[0] || {}).easing, target: x.effect.target && (x.effect.target.id || x.effect.target.tagName) })); };
  window.__seek = (t) => (window.__p || []).forEach((a) => { a.currentTime = t; });
  window.__play = () => (window.__p || []).forEach((a) => a.play());
  window.__pseudo = (pe, host) => { const cs = getComputedStyle(host || document.documentElement, pe); return { transform: cs.transform, opacity: cs.opacity }; };
  window.__owner = () => globalThis[Symbol.for('frame12.cutmorph')];
})()`;

async function flush(page, rounds = 6) {
  await page.evaluate(async (n) => {
    for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
  }, rounds);
}
/** Waits until no CutMorph transition is active and the given number of calls have settled. */
async function settle(page, results = 0) {
  await page.waitForFunction(
    (n) => !document.activeViewTransition && window.__cm.results.length >= n && !(window.__owner()?.active.length),
    results,
    { timeout: 5000 },
  );
}
const cm = (page) => page.evaluate(() => ({ log: window.__cm.log.slice(), results: window.__cm.results.slice(), unhandled: window.__unhandled.slice(), vtCalls: window.__vtCalls, flushSync: window.__flushSync || 0, html: document.documentElement.className }));
const label = (page, id = 'a') => page.evaluate((i) => document.getElementById(`stage-${i}`)?.dataset.label, id);
const moverX = (page, host) => page.evaluate((h) => Number(window.__pseudo('::view-transition-group(a-mover)', h ? document.getElementById(h) : undefined).transform.split(',')[4]), host);

async function open(browser, html, { reduced = 'no-preference', init = {}, mount } = {}) {
  const r = await openFixture(browser, html, { w: 900, h: 700, reduced, clock: false, init: INIT(init) });
  if (mount) {
    await r.page.evaluate((c) => window.__cm.mount(c), mount);
    await r.page.waitForFunction(() => !!window.__cm.stages.a || !!window.__cm.stages.b, null, { timeout: 5000 });
  }
  return r;
}

// ============================================================================== pure (Node)
await section('names: pure validation', async () => {
  const { mod, React, server } = await loadServerModule(resolve(REGISTRY_ROOT, 'ui/cut-morph.tsx'));
  const { isCutMorphName, CutMorphName, useCutMorph, getCutMorphSupport, withCutMorphMode } = mod;
  const reserved = ['none', 'auto', 'match-element', 'root', 'initial', 'inherit', 'unset', 'revert', 'revert-layer', 'default'];
  check(reserved.every((n) => !isCutMorphName(n)), 'names: every reserved keyword is rejected (none, auto, match-element, root, CSS-wide keywords, default)', reserved);
  const malformed = ['', 'A', 'Row', '1a', '-a', 'a_b', 'a b', 'a.b', 'é', 'a'.repeat(65), null, 42, undefined];
  check(malformed.every((n) => !isCutMorphName(n)), 'names: malformed names are rejected (case, leading digit/dash, _, space, dot, non-ASCII, 65 chars, non-strings)');
  const ok = ['a', 'row-12', 'shot-c-01', `a${'b'.repeat(63)}`];
  check(ok.every((n) => isCutMorphName(n)), 'names: valid names (^[a-z][a-z0-9-]{0,63}$) are accepted', ok);

  // SSR: names render into the style attribute; the hook is inert on the server.
  const html = server.renderToString(
    React.createElement(CutMorphName, { name: 'ssr-row' }, React.createElement('li', { style: { color: 'red' } }, 'x')),
  );
  check(/view-transition-name:\s*ssr-row/.test(html) && /view-transition-class:\s*f12-match/.test(html) && /color:\s*red/.test(html),
    'SSR: CutMorphName renders view-transition-name and view-transition-class into the markup, keeping the child style', html);
  let ran = 0;
  let resolved = false;
  function ServerCaller() {
    const cut = useCutMorph();
    cut(() => { ran++; }).then(() => { resolved = true; });
    return null;
  }
  server.renderToString(React.createElement(ServerCaller));
  await new Promise((r) => setTimeout(r, 0));
  check(ran === 1 && resolved, 'SSR: a cutMorph call on the server runs its update immediately and resolves (no document)', { ran, resolved });
  const s = getCutMorphSupport();
  check(!s.viewTransitions && !s.elementScoped && !s.activeViewTransition, 'SSR: getCutMorphSupport() is all false without a document', s);
  check(withCutMorphMode('stepped', () => 7) === 7, 'SSR: withCutMorphMode runs fn and returns its value without a document');
});

for (const engine of BROWSERS) {
  const browser = await launch(engine);
  const E = `[${engine}]`;
  const html = await bundlePage(FIXTURE, { react: 18, head: HEAD, plugins: [flushSyncSpy] });
  const htmlDev = await bundlePage(FIXTURE, { react: 18, nodeEnv: 'development', head: HEAD, plugins: [flushSyncSpy] });
  try {
    // ======================================================================== resolution table
    await section(`${E} resolution`, async () => {
      // cut → update now, no View Transition, no flushSync.
      {
        const { ctx, page, errors } = await open(browser, html, { mount: { tempo: 'twos' } });
        const sync = await page.evaluate(() => {
          window.__cm.stages.a.cut('C1', { x: 300 }, { kind: 'cut' });
          return window.__cm.log.slice();
        });
        await settle(page, 1);
        const s = await cm(page);
        check(sync.join() === 'C1' && s.vtCalls === 0 && s.flushSync === 0 && s.results[0]?.status === 'resolved' && (await label(page)) === 'C1' && errors.length === 0,
          `${E} resolution: kind "cut" runs update synchronously, never calls startViewTransition or flushSync (spies), resolves`, { sync, ...s });
        await ctx.close();
      }
      // match + effective cut (reduced motion, still, still ancestor) → immediate.
      for (const [name, opts] of [
        ['OS reduced motion', { reduced: 'reduce', mount: { tempo: 'twos' } }],
        ['tempo still', { mount: { tempo: 'still' } }],
      ]) {
        const { ctx, page } = await open(browser, html, opts);
        const sync = await page.evaluate(() => { window.__cm.stages.a.cut('M1', { x: 300 }); return window.__cm.log.slice(); });
        await settle(page, 1);
        const s = await cm(page);
        check(sync.join() === 'M1' && s.vtCalls === 0 && s.flushSync === 0 && s.results[0]?.status === 'resolved',
          `${E} resolution: "match" under ${name} is an immediate update (no View Transition, no flushSync)`, s);
        await ctx.close();
      }
      {
        const { ctx, page } = await open(browser, html, { mount: { tempo: 'ones', nestedStill: true } });
        await page.waitForFunction(() => !!window.__cm.stages.still);
        const sync = await page.evaluate(() => { window.__cm.stages.still.cut('N1', { x: 300 }); return window.__cm.log.slice(); });
        await settle(page, 1);
        const s = await cm(page);
        check(sync.join() === 'N1' && s.vtCalls === 0,
          `${E} resolution: a nested TempoProvider value="still" inside "ones" stays still (resolved from the calling component's context)`, s);
        await ctx.close();
      }
      // No API / hidden document → immediate.
      for (const [name, init] of [['no View Transition API', { noVT: true }], ['hidden document', { hidden: true }]]) {
        const { ctx, page } = await open(browser, html, { init, mount: { tempo: 'twos' } });
        const sync = await page.evaluate(() => { window.__cm.stages.a.cut('H1', { x: 300 }); return window.__cm.log.slice(); });
        await settle(page, 1);
        const s = await cm(page);
        check(sync.join() === 'H1' && s.vtCalls === 0 && s.results[0]?.status === 'resolved', `${E} resolution: "match" with ${name} is an immediate update`, s);
        await ctx.close();
      }
      // A transition CutMorph does not own: fake one, then a real one.
      {
        const { ctx, page } = await open(browser, html, { mount: { tempo: 'twos' } });
        const r = await page.evaluate(() => {
          let skipped = 0;
          const fake = { ready: Promise.resolve(), finished: new Promise(() => {}), updateCallbackDone: Promise.resolve(), skipTransition() { skipped++; } };
          Object.defineProperty(document, 'activeViewTransition', { configurable: true, get: () => fake });
          window.__cm.stages.a.cut('F1', { x: 300 });
          const out = { log: window.__cm.log.slice(), skipped, vtCalls: window.__vtCalls };
          delete document.activeViewTransition;
          return out;
        });
        check(r.log.join() === 'F1' && r.skipped === 0 && r.vtCalls === 0,
          `${E} resolution: a fake foreign document.activeViewTransition → immediate update, and the foreign transition is never skipped`, r);
        await ctx.close();
      }
      {
        const { ctx, page } = await open(browser, html, { mount: { tempo: 'twos' } });
        const r = await page.evaluate(async () => {
          const foreign = document.startViewTransition(() => { document.body.dataset.foreign = '1'; });
          let foreignSkipped = false;
          foreign.ready.catch((e) => { foreignSkipped = e.name; });
          await foreign.updateCallbackDone;
          window.__cm.stages.a.cut('F2', { x: 300 });
          const log = window.__cm.log.slice();
          const stillActive = document.activeViewTransition === foreign;
          await foreign.finished;
          return { log, stillActive, foreignSkipped, vtCalls: window.__vtCalls };
        });
        check(r.log.join() === 'F2' && r.stillActive && r.foreignSkipped === false && r.vtCalls === 1,
          `${E} resolution: a real foreign transition in flight → CutMorph updates immediately and the foreign transition runs to the end`, r);
        await ctx.close();
      }
      // stepped / smooth → a View Transition with the mode key.
      for (const [tempo, mode, dur, easing] of [['twos', 'stepped', 250, 'steps(3)'], ['ones', 'smooth', 260, 'cubic-bezier(0.2, 0.8, 0.2, 1)']]) {
        const { ctx, page } = await open(browser, html, { mount: { tempo } });
        await page.evaluate(() => void window.__cm.stages.a.cut('S1', { x: 300 }));
        await page.evaluate(() => window.__ready());
        const anims = await page.evaluate(() => window.__pause());
        const htmlClass = await page.evaluate(() => document.documentElement.className);
        const g = anims.find((a) => a.pe === '::view-transition-group(a-mover)');
        await page.evaluate(() => window.__play());
        await settle(page, 1);
        const s = await cm(page);
        check(htmlClass.includes(`f12-vt-${mode}`) && g?.dur === dur && String(g?.easing).replace(/\s/g, '') === easing.replace(/\s/g, '') && s.vtCalls === 1 && s.flushSync === 1 && !s.html.includes('f12-vt-'),
          `${E} resolution: "match" at ${tempo} → one View Transition keyed f12-vt-${mode} (${dur}ms ${easing}), flushSync once, class removed after`, { htmlClass, g, ...s });
        await ctx.close();
      }
    });

    // ============================================================================ interruption
    await section(`${E} interruption`, async () => {
      {
        const { ctx, page } = await open(browser, html, { mount: { tempo: 'twos' } });
        await page.evaluate(() => {
          const s = window.__cm.stages.a;
          s.cut('A', { x: 100, rows: ['r3', 'r2', 'r1'] });
          s.cut('B', { x: 200, rows: ['r2', 'r1'] });
          s.cut('C', { x: 300, rows: ['r1', 'r4'] });
        });
        await page.evaluate(() => window.__ready());
        await page.evaluate(() => window.__pause());
        // While C runs, A and B have settled (superseded); their cleanup must leave C's class.
        await page.waitForFunction(() => window.__cm.results.length >= 2, null, { timeout: 3000 });
        const midClass = await page.evaluate(() => document.documentElement.className);
        await page.evaluate(() => window.__play());
        await settle(page, 3);
        const s = await cm(page);
        const rows = await page.evaluate(() => [...document.querySelectorAll('#stage-a .row')].map((r) => r.dataset.id).join());
        check(s.log.join() === 'A,B,C' && (await label(page)) === 'C' && rows === 'r1,r4',
          `${E} interruption: three rapid calls run each update exactly once, in order A, B, C; final DOM is C`, { log: s.log, rows });
        check(s.results.map((r) => `${r.label}:${r.status}`).sort().join() === 'A:resolved,B:resolved,C:resolved' && s.unhandled.length === 0,
          `${E} interruption: superseded calls resolve; no unhandled rejections`, s);
        check(midClass.includes('f12-vt-stepped') && !s.html.includes('f12-vt-'),
          `${E} interruption: a stale generation's cleanup leaves C's mode class; C's own cleanup removes it`, { midClass, after: s.html });
        await ctx.close();
      }
      // A's callback has already run when B arrives: B must not run A again.
      {
        const { ctx, page } = await open(browser, html, { mount: { tempo: 'twos' } });
        await page.evaluate(async () => {
          window.__cm.stages.a.cut('A', { x: 100 });
          await document.activeViewTransition.updateCallbackDone;
          window.__cm.stages.a.cut('B', { x: 200 });
        });
        await settle(page, 2);
        const s = await cm(page);
        check(s.log.join() === 'A,B' && (await label(page)) === 'B' && s.unhandled.length === 0,
          `${E} interruption: A's callback already ran when B arrives → A is not run again; order A, B`, s);
        await ctx.close();
      }
      // A's callback has not run yet when B arrives: B runs it first (flushSync), then its own.
      {
        const { ctx, page } = await open(browser, html, { mount: { tempo: 'twos' } });
        const atB = await page.evaluate(() => {
          window.__cm.stages.a.cut('A', { x: 100 });
          const before = window.__cm.log.slice();
          window.__cm.stages.a.cut('B', { x: 200 });
          return { before, after: window.__cm.log.slice(), label: document.getElementById('stage-a').dataset.label };
        });
        await settle(page, 2);
        const s = await cm(page);
        check(atB.before.length === 0 && atB.after.join() === 'A' && atB.label === 'A' && s.log.join() === 'A,B' && (await label(page)) === 'B',
          `${E} interruption: A's callback not yet run when B arrives → B runs A now (committed synchronously), then B; exactly once each`, { atB, log: s.log });
        await ctx.close();
      }
      // A transition, then a cut: the cut runs A first, without flushSync.
      {
        const { ctx, page } = await open(browser, html, { mount: { tempo: 'twos' } });
        await page.evaluate(() => {
          window.__cm.stages.a.cut('A', { x: 100 });
          window.__cm.stages.a.cut('K', { x: 200 }, { kind: 'cut' });
        });
        await settle(page, 2);
        const s = await cm(page);
        check(s.log.join() === 'A,K' && (await label(page)) === 'K' && s.flushSync === 0 && s.unhandled.length === 0,
          `${E} interruption: a "cut" after a pending "match" keeps order (A, K) without flushSync`, s);
        await ctx.close();
      }
    });

    // ============================================================================ coexistence
    await section(`${E} coexistence`, async () => {
      const { ctx, page } = await open(browser, html, { mount: { tempo: 'twos' } });
      await page.evaluate(() => window.__cm.mountSecond({ tempo: 'twos' }));
      await page.waitForFunction(() => !!window.__cm.stages.b);
      await page.evaluate(() => {
        window.__cm.stages.a.cut('RA', { x: 100 });
        window.__cm.stages.b.cut('RB', { x: 200 });
      });
      const owners = await page.evaluate(() => window.__owner().active.length);
      await settle(page, 2);
      const s = await cm(page);
      check(s.log.join() === 'RA,RB' && owners === 1 && (await label(page, 'a')) === 'RA' && (await label(page, 'b')) === 'RB' && s.unhandled.length === 0,
        `${E} coexistence: two React roots share one owner (one active transition); both updates land once, in order`, { owners, ...s });
      await ctx.close();
    });
    await section(`${E} coexistence: module copies`, async () => {
      mkdirSync(resolve(REGISTRY_ROOT, '.f12-run'), { recursive: true });
      copyFileSync(resolve(REGISTRY_ROOT, 'ui/cut-morph.tsx'), resolve(REGISTRY_ROOT, '.f12-run/cut-morph-copy.tsx'));
      const copies = await bundlePage(resolve(REGISTRY_ROOT, 'tests/fixtures/cut-morph-copies.tsx'), { react: 18 });
      const { ctx, page } = await openFixture(browser, copies, { clock: false, init: INIT() });
      await page.waitForFunction(() => !!window.__copies.a && !!window.__copies.b);
      await page.evaluate(() => { window.__copies.a('CA'); window.__copies.b('CB'); });
      const owners = await page.evaluate(() => window.__owner().active.length);
      await page.waitForFunction(() => window.__copies.results.length === 2, null, { timeout: 5000 });
      const r = await page.evaluate(() => ({ ...window.__copies, unhandled: window.__unhandled }));
      check(!r.sameHook && r.log.join() === 'CA,CB' && owners === 1 && r.results.sort().join() === 'CA:resolved,CB:resolved' && r.unhandled.length === 0,
        `${E} coexistence: two module copies share one owner (Symbol.for('frame12.cutmorph')); the second supersedes the first in order`, { owners, ...r });
      await ctx.close();
    });

    // =============================================================================== isolation
    await section(`${E} isolation`, async () => {
      {
        const { ctx, page } = await open(browser, html, { mount: { tempo: 'twos' } });
        await page.evaluate(() => void window.__cm.stages.a.cut('I1', { x: 300, button: true }));
        await page.evaluate(() => window.__ready());
        const anims = await page.evaluate(() => window.__pause());
        const names = [...new Set(anims.map((a) => a.pe.replace(/^::view-transition-[a-z-]+\((.*)\)$/, '$1')))];
        check(anims.every((a) => !a.pe.includes('(root)')) && names.length > 0 && names.every((n) => n.startsWith('a-')),
          `${E} isolation: the root group has no animation; only CutMorphName subjects animate`, names);
        await page.evaluate(() => window.__seek(120));
        const pe = await page.evaluate(() => getComputedStyle(document.documentElement, '::view-transition').pointerEvents);
        await page.mouse.click(460, 220);
        await flush(page, 3);
        const s = await page.evaluate(() => ({ clicks: window.__cm.clicks.slice(), active: !!document.activeViewTransition }));
        check(pe === 'none' && s.clicks.includes('a-late'), `${E} isolation: ::view-transition has pointer-events: none; a click during the transition reaches the new DOM`, { pe, ...s });
        check(!s.active, `${E} isolation: the pointerdown of that click skipped the owned transition (the DOM was already updated)`, s);
        await settle(page, 1);
        await ctx.close();
      }
      for (const [what, act] of [
        ['scroll', (page) => page.evaluate(() => window.scrollBy(0, 40))],
        ['resize', (page) => page.setViewportSize({ width: 880, height: 690 })],
        ['pointerdown', async (page) => { await page.mouse.move(800, 600); await page.mouse.down(); await page.mouse.up(); }],
      ]) {
        const { ctx, page } = await open(browser, html, { mount: { tempo: 'twos' } });
        await page.evaluate(() => void window.__cm.stages.a.cut('P1', { x: 300 }));
        await page.evaluate(() => window.__ready());
        await page.evaluate(() => window.__pause());
        await act(page);
        let skipped = true;
        try {
          await settle(page, 1);
        } catch {
          skipped = false;
        }
        const s = await cm(page);
        check(skipped && (await label(page)) === 'P1' && s.results[0]?.status === 'resolved' && s.unhandled.length === 0,
          `${E} isolation: ${what} during a document-scoped transition skips it; the update is kept and the call resolves`, s);
        await ctx.close();
      }
    });

    // ================================================================================= grammar
    await section(`${E} grammar`, async () => {
      {
        const { ctx, page } = await open(browser, html, { mount: { tempo: 'twos' } });
        await page.evaluate(() => void window.__cm.stages.a.cut('G1', { x: 300, color: 'rgb(0, 0, 255)' }));
        await page.evaluate(() => window.__ready());
        await page.evaluate(() => window.__pause());
        const xs = [];
        for (const t of [5, 80, 87, 160, 170, 245]) {
          await page.evaluate((x) => window.__seek(x), t);
          xs.push(await moverX(page));
        }
        const op = [];
        for (let i = 0; i <= 16; i++) {
          const t = Math.round((i * 1000) / 60 * 10) / 10;
          await page.evaluate((x) => window.__seek(x), t);
          op.push(await page.evaluate(() => [Number(window.__pseudo('::view-transition-old(a-mover)').opacity), Number(window.__pseudo('::view-transition-new(a-mover)').opacity)]));
        }
        await page.evaluate((x) => window.__seek(x), POSE * 2 - 0.5);
        const justBefore = await page.evaluate(() => window.__pseudo('::view-transition-new(a-mover)').opacity);
        await page.evaluate((x) => window.__seek(x), POSE * 2 + 0.5);
        const justAfter = await page.evaluate(() => window.__pseudo('::view-transition-new(a-mover)').opacity);
        await page.evaluate(() => window.__play());
        await settle(page, 1);
        check(xs.join() === '0,0,100,100,200,200', `${E} grammar: stepped = 3 held poses over 250ms (0 → 1/3 → 2/3 of the move, 83.33ms each)`, xs);
        check(op.every(([o, n]) => (o === 0 || o === 1) && o + n === 1), `${E} grammar: at every 60Hz frame exactly one of old/new is at opacity 1 (never a partial-opacity frame)`, op);
        check(justBefore === '0' && justAfter === '1', `${E} grammar: the hard swap is at the second pose boundary (166.67ms)`, { justBefore, justAfter });
        await ctx.close();
      }
      {
        const { ctx, page } = await open(browser, html, { mount: { tempo: 'ones' } });
        await page.evaluate(() => void window.__cm.stages.a.cut('G2', { x: 300 }));
        await page.evaluate(() => window.__ready());
        const anims = await page.evaluate(() => window.__pause());
        await page.evaluate(() => window.__seek(130));
        const mid = await moverX(page);
        await page.evaluate(() => window.__play());
        await settle(page, 1);
        const g = anims.find((a) => a.pe === '::view-transition-group(a-mover)');
        check(g?.dur === 260 && mid > 200 && mid < 300 && mid !== 100 && mid !== 200, `${E} grammar: smooth = 260ms cubic-bezier(0.2, 0.8, 0.2, 1), continuous`, { g, mid });
        await ctx.close();
      }
      // CSS safety: reduced motion stops f12 animations even when JS forces a mode key.
      {
        const { ctx, page } = await open(browser, html, { reduced: 'reduce', mount: { tempo: 'twos' } });
        const r = await page.evaluate(async () => {
          document.documentElement.classList.add('f12-vt-stepped');
          const el = document.getElementById('a-mover');
          const vt = document.startViewTransition(() => { el.style.left = '300px'; });
          await vt.ready.catch(() => {});
          const anims = window.__vtAnims().map((a) => a.effect.pseudoElement);
          await vt.finished.catch(() => {});
          document.documentElement.classList.remove('f12-vt-stepped');
          return anims;
        });
        check(r.length === 0, `${E} grammar: prefers-reduced-motion CSS sets every f12-* view-transition animation to none, even with JS forcing f12-vt-stepped`, r);
        await ctx.close();
      }
    });

    // =============================================================================== lifecycle
    await section(`${E} lifecycle`, async () => {
      for (const [what, act] of [
        ['reduced motion turned on', (page) => page.emulateMedia({ reducedMotion: 'reduce' })],
        ['tempo set to still', (page) => page.evaluate(() => window.__cm.setTempo('still'))],
        ['the browser skip path (as when the tab is hidden)', (page) => page.evaluate(() => document.activeViewTransition.skipTransition())],
      ]) {
        const { ctx, page } = await open(browser, html, { mount: { tempo: 'twos' } });
        await page.evaluate(() => void window.__cm.stages.a.cut('L1', { x: 300 }));
        await page.evaluate(() => window.__ready());
        await page.evaluate(() => window.__pause());
        await act(page);
        let ok = true;
        try {
          await settle(page, 1);
        } catch {
          ok = false;
        }
        const s = await cm(page);
        check(ok && (await label(page)) === 'L1' && s.results[0]?.status === 'resolved' && !s.html.includes('f12-vt-') && s.unhandled.length === 0,
          `${E} lifecycle: ${what} mid-transition → skipped at once, state kept, promise settles`, s);
        await ctx.close();
      }
      {
        const { ctx, page, errors } = await open(browser, htmlDev, { mount: { tempo: 'twos' } });
        const before = await page.evaluate(() => window.__liveListeners());
        await page.evaluate(() => void window.__cm.stages.a.cut('U1', { x: 300 }));
        await page.evaluate(() => window.__ready());
        const during = await page.evaluate(() => window.__liveListeners());
        await page.evaluate(() => window.__cm.unmount());
        await settle(page, 1);
        const s = await cm(page);
        const after = await page.evaluate(() => window.__liveListeners());
        check(during === before + 3 && after === before && s.results[0]?.status === 'resolved' && !s.html.includes('f12-vt-') && errors.length === 0 && s.unhandled.length === 0,
          `${E} lifecycle: unmount mid-transition → finishes cleanly, no errors, no leaked class or listener`, { before, during, after, errors, ...s });
        await ctx.close();
      }
    });

    // ================================================================================ promises
    await section(`${E} promises`, async () => {
      for (const kind of ['match', 'cut']) {
        const { ctx, page } = await open(browser, html, { mount: { tempo: 'twos' } });
        await page.evaluate((k) => void window.__cm.stages.a.cut('T1', { x: 300 }, { throws: true, kind: k }), kind);
        await settle(page, 1);
        await flush(page, 3);
        const s = await cm(page);
        check(s.results.length === 1 && s.results[0].status === 'rejected' && s.results[0].error === 'boom-T1' && s.unhandled.length === 0 && (await label(page)) === 'A0',
          `${E} promises: update throws (${kind} path) → the hook rejects once with that error; no unhandled browser rejection`, s);
        await ctx.close();
      }
      {
        // A throws while being run by B (superseded): A rejects with its error, B resolves.
        const { ctx, page } = await open(browser, html, { mount: { tempo: 'twos' } });
        await page.evaluate(() => {
          window.__cm.stages.a.cut('TA', {}, { throws: true });
          window.__cm.stages.a.cut('TB', { x: 200 });
        });
        await settle(page, 2);
        await flush(page, 3);
        const s = await cm(page);
        const by = Object.fromEntries(s.results.map((r) => [r.label, r]));
        check(by.TA?.status === 'rejected' && by.TA?.error === 'boom-TA' && by.TB?.status === 'resolved' && s.log.join() === 'TA,TB' && s.unhandled.length === 0,
          `${E} promises: a superseded update that throws rejects its own call once; the next call resolves`, s);
        await ctx.close();
      }
      {
        const { ctx, page } = await open(browser, html, { reduced: 'reduce', mount: { tempo: 'twos' } });
        await page.evaluate(() => void window.__cm.stages.a.cut('FB', { x: 300 }));
        await settle(page, 1);
        const s = await cm(page);
        check(s.results[0]?.status === 'resolved' && s.results[0]?.logAtSettle === 1, `${E} promises: fallback calls resolve after update ran`, s);
        await ctx.close();
      }
      {
        const { ctx, page, warnings } = await open(browser, htmlDev, { mount: { tempo: 'twos' } });
        await page.evaluate(() => void window.__cm.stages.a.cut('AS', { x: 300 }, { asyncUpdate: true, kind: 'cut' }));
        await settle(page, 1);
        check(warnings.some((w) => /returned a promise/.test(w)), `${E} promises: an update that returns a promise gets a development warning`, warnings);
        await ctx.close();
      }
    });

    // =================================================================================== names
    await section(`${E} names`, async () => {
      const { ctx, page, errors, warnings } = await open(browser, htmlDev);
      const style = (id) => page.evaluate((i) => { const el = document.getElementById(i); return el ? { name: el.style.viewTransitionName || getComputedStyle(el).viewTransitionName, cls: el.style.viewTransitionClass ?? '', color: el.style.color, className: el.className } : null; }, id);
      await page.evaluate(() => window.__cm.names('merge'));
      await flush(page, 2);
      const m = await style('merge');
      await page.evaluate(() => document.getElementById('merge').click());
      await flush(page, 2);
      const merged = await page.evaluate(() => ({ n: document.getElementById('merge').dataset.n, ref: window.__refOk }));
      check(m?.name === 'merge-me' && m.cls === 'f12-match extra' && m.color === 'rgb(1, 2, 3)' && m.className === 'own' && merged.n === '1' && merged.ref,
        `${E} names: style, className, ref and handlers of the child are merged, not replaced`, { m, merged });
      await page.evaluate(() => window.__cm.names('forward'));
      await flush(page, 2);
      const f = await style('fwd');
      check(f?.name === 'fwd-name' && f.color === 'rgb(4, 5, 6)', `${E} names: a component that forwards style receives the name`, f);
      for (const variant of ['fragment', 'string', 'array']) {
        errors.length = 0;
        await page.evaluate((v) => window.__cm.names(v), variant);
        await flush(page, 2);
        const text = await page.evaluate(() => document.getElementById('names').textContent);
        check(errors.some((e) => /needs one DOM host element child/.test(e)) && text.length > 0,
          `${E} names: a ${variant} child is a development error and still renders`, { errors: errors.slice(0, 1), text });
      }
      for (const bad of ['root', 'none', 'auto', 'match-element', 'inherit', 'revert-layer', 'Row-1', '1row', 'a_b']) {
        errors.length = 0;
        await page.evaluate((v) => window.__cm.names(`bad:${v}`), bad);
        await flush(page, 2);
        const b = await style('bad');
        check(errors.some((e) => /invalid name/.test(e)) && (!b.name || b.name === 'none'), `${E} names: "${bad}" is rejected (dev error, no view-transition-name set)`, b);
      }
      warnings.length = 0;
      await page.evaluate(() => window.__cm.names('duplicate'));
      await flush(page, 3);
      const dup = warnings.find((w) => /already on screen/.test(w)) || '';
      check(/"twin"/.test(dup) && /first owner/.test(dup) && /second owner/.test(dup), `${E} names: a duplicate live name warns in development with both owners' stacks`, dup.slice(0, 300));
      warnings.length = 0;
      await page.evaluate(() => window.__cm.names('swap-same-name'));
      await flush(page, 2);
      await page.evaluate(() => document.getElementById('swapper').click());
      await flush(page, 3);
      check(!warnings.some((w) => /already on screen/.test(w)), `${E} names: swapping one element for another with the same name in one commit is not a duplicate`, warnings);
      warnings.length = 0;
      await page.evaluate(() => window.__cm.names('strict:merge'));
      await flush(page, 3);
      const reg = await page.evaluate(() => window.__owner().names.get('merge-me')?.length ?? 0);
      check(reg === 1 && !warnings.some((w) => /already on screen/.test(w)), `${E} names: Strict Mode double effects register the name exactly once`, { reg });
      await page.evaluate(() => window.__cm.names('none'));
      await flush(page, 2);
      const gone = await page.evaluate(() => ({ el: !!document.getElementById('merge'), reg: window.__owner().names.has('merge-me'), named: [...document.querySelectorAll('*')].some((e) => e.style && e.style.viewTransitionName === 'merge-me') }));
      check(!gone.el && !gone.reg && !gone.named, `${E} names: unmount removes the name (from the DOM and the development registry)`, gone);
      await ctx.close();
    });
    await section(`${E} names: production duplicate`, async () => {
      const { ctx, page, errors, warnings } = await open(browser, html, { mount: { tempo: 'twos' } });
      await page.evaluate(() => window.__cm.names('duplicate'));
      await flush(page, 2);
      await page.evaluate(() => void window.__cm.stages.a.cut('D1', { x: 300 }));
      await settle(page, 1);
      await flush(page, 3);
      const s = await cm(page);
      // Chromium logs its own console error for the duplicate; anything else would be ours.
      const ours = errors.filter((e) => !/duplicate view-transition-name/i.test(e));
      check(s.results[0]?.status === 'resolved' && (await label(page)) === 'D1' && s.unhandled.length === 0 && ours.length === 0 && !warnings.some((w) => /already on screen/.test(w)),
        `${E} names: in production a duplicate name makes the browser skip (InvalidStateError); the update lands, the call resolves, nothing crashes`, { ...s, errors });
      await ctx.close();
    });
    await section(`${E} names: hydration`, async () => {
      const { mod, React, server } = await loadServerModule(resolve(REGISTRY_ROOT, 'tests/fixtures/cut-morph-ssr.tsx'));
      const markup = server.renderToString(React.createElement(mod.SsrApp));
      const page18 = (await bundlePage(resolve(REGISTRY_ROOT, 'tests/fixtures/cut-morph-ssr-entry.tsx'), { react: 18, nodeEnv: 'development' }))
        .replace('<div id="root"></div>', `<div id="root">${markup}</div>`);
      const { ctx, page, errors } = await openFixture(browser, page18, { clock: false, init: INIT() });
      await flush(page, 4);
      const named = await page.evaluate(() => [...document.querySelectorAll('#ssr li')].map((li) => li.style.viewTransitionName).join());
      await page.click('#ssr-sort');
      await page.waitForFunction(() => document.querySelector('#ssr li')?.dataset.id === 's3', null, { timeout: 5000 });
      check(errors.length === 0 && named === 'ssr-s1,ssr-s2,ssr-s3', `${E} names: server-rendered names hydrate with no mismatch (development build), and the hydrated hook works`, { errors, named });
      await ctx.close();
    });

    // =================================================================================== React
    await section(`${E} React`, async () => {
      {
        const { ctx, page } = await open(browser, html, { mount: { tempo: 'twos' } });
        await page.evaluate(() => void window.__cm.stages.a.cut('SU', { lazy: true }));
        await page.evaluate(async () => { await document.activeViewTransition?.updateCallbackDone; });
        const fallbackInNewState = await page.evaluate(() => !!document.getElementById('a-fallback'));
        await settle(page, 1);
        check(fallbackInNewState, `${E} React: flushSync inside the update commits a Suspense fallback at once (documented: preload, or use the 19.3 <ViewTransition> recipe)`, { fallbackInNewState });
        await ctx.close();
      }
      {
        const { ctx, page } = await open(browser, html, { mount: { tempo: 'twos' } });
        await page.evaluate(() => void window.__cm.stages.a.cut('EB', { explode: true }));
        await settle(page, 1);
        const s = await cm(page);
        const caught = await page.evaluate(() => !!document.getElementById('boundary'));
        check(caught && s.results[0]?.status === 'resolved' && s.unhandled.length === 0, `${E} React: an error boundary catches a render error from the update; the call resolves`, s);
        await ctx.close();
      }
      {
        const { ctx, page } = await open(browser, html, { mount: { tempo: 'twos' } });
        await page.evaluate(() => {
          window.__cm.stages.a.setTransition({ rows: ['r9'] });
          window.__cm.stages.a.cut('CC', { x: 300 });
        });
        await settle(page, 1);
        await page.waitForFunction(() => document.querySelector('#stage-a .row')?.dataset.id === 'r9', null, { timeout: 3000 });
        check((await label(page)) === 'CC', `${E} React: a concurrent startTransition update and a cutMorph call both land`);
        await ctx.close();
      }
      {
        const { ctx, page } = await open(browser, html, { mount: { tempo: 'twos', strict: true } });
        await page.evaluate(() => void window.__cm.stages.a.cut('SM', { x: 300 }));
        await settle(page, 1);
        const s = await cm(page);
        check(s.log.join() === 'SM' && s.vtCalls === 1, `${E} React: Strict Mode (double effects) neither double-runs updates nor double-registers owners`, s);
        await ctx.close();
      }
    });

    // =========================================================================== accessibility
    await section(`${E} a11y`, async () => {
      const { ctx, page } = await open(browser, html, { mount: { tempo: 'twos' } });
      await page.evaluate(() => void window.__cm.stages.a.cut('LIVE', { x: 300 }));
      await page.evaluate(async () => { await document.activeViewTransition?.updateCallbackDone; });
      const status = await page.evaluate(() => ({ text: document.getElementById('a-status').textContent, active: !!document.activeViewTransition }));
      await settle(page, 1);
      check(status.text === 'LIVE' && status.active, `${E} a11y: a live region updated by the update has its new text while the transition is still running (not delayed)`, status);
      await ctx.close();
    });

    // ============================================================================ element scope
    await section(`${E} element-scoped`, async () => {
      const { ctx, page } = await open(browser, html, { mount: { tempo: 'twos', scoped: true } });
      const has = await page.evaluate(() => typeof Element.prototype.startViewTransition === 'function');
      await page.evaluate(() => void window.__cm.stages.a.cut('SC', { x: 300 }));
      if (!has) {
        await settle(page, 1);
        const s = await cm(page);
        check(s.vtCalls === 1 && s.results[0]?.status === 'resolved', `${E} element-scoped: no Element.startViewTransition → a document transition with the root excluded`, s);
        await ctx.close();
        return;
      }
      await page.waitForFunction(() => window.__vtAnims().length > 0, null, { timeout: 3000 });
      const anims = await page.evaluate(() => window.__pause());
      const cls = await page.evaluate(() => ({ html: document.documentElement.className, stage: document.getElementById('stage-a').className, docActive: !!document.activeViewTransition }));
      await page.evaluate(() => window.scrollBy(0, 30));
      await flush(page, 2);
      const stillPaused = await page.evaluate(() => window.__p.some((a) => a.playState === 'paused'));
      await page.evaluate(() => window.__play());
      await page.waitForFunction(() => window.__cm.results.length === 1, null, { timeout: 3000 });
      const g = anims.find((a) => a.pe === '::view-transition-group(a-mover)');
      check(g?.target === 'stage-a' && g.dur === 250 && cls.stage.includes('f12-vt-stepped') && !cls.html.includes('f12-vt-') && stillPaused,
        `${E} element-scoped: scope → transition on the scope element (mode key on it, not <html>); a page scroll does not skip it`, { g, cls, stillPaused });
      await ctx.close();
    });

    // =========================================================================== React 19.3
    await section(`${E} React 19.3 <ViewTransition> recipe`, async () => {
      const r19 = await bundlePage(resolve(REGISTRY_ROOT, 'tests/fixtures/cut-morph-react19.tsx'), { react: 19 });
      const { ctx, page, errors } = await openFixture(browser, r19, { clock: false, init: INIT() });
      await page.waitForFunction(() => typeof window.__r19?.move === 'function');
      await flush(page, 2);
      await page.evaluate(() => window.__r19.move());
      await page.waitForFunction(() => !!document.activeViewTransition, null, { timeout: 5000 });
      const ready = await page.evaluate(() => window.__ready());
      const anims = await page.evaluate(() => window.__pause());
      const htmlClass = await page.evaluate(() => document.documentElement.className);
      const g = anims.find((a) => a.pe === '::view-transition-group(r19-box)');
      check(ready && g?.dur === 250 && g?.easing === 'steps(3)' && htmlClass.includes('f12-vt-stepped') && !anims.some((a) => a.pe.includes('(root)') && a.dur > 0),
        `${E} React 19.3: <ViewTransition default="f12-match"> + withCutMorphMode('stepped') plays the same grammar (250ms steps(3); no root animation runs: React's own is 0ms)`, { g, htmlClass, root: anims.filter((a) => a.pe.includes('(root)')) });
      // CutMorph call while React's transition is in flight: immediate, React's transition not cancelled.
      const react = await page.evaluate(() => document.activeViewTransition);
      const r = await page.evaluate(() => {
        const vt = document.activeViewTransition;
        window.__r19.cut('X');
        return { log: window.__r19.log.slice(), same: document.activeViewTransition === vt };
      });
      await page.evaluate(() => window.__play());
      await page.waitForFunction(() => !document.activeViewTransition && window.__r19.results.length === 1, null, { timeout: 5000 });
      await flush(page, 3);
      const after = await page.evaluate(() => ({ cls: document.documentElement.className, results: window.__r19.results, unhandled: window.__unhandled, label: document.getElementById('r19-label').textContent }));
      check(react !== null && r.log.join() === 'X' && r.same && after.results.join() === 'X:resolved' && after.label === 'X' && after.unhandled.length === 0,
        `${E} React 19.3: a CutMorph call while React's transition is in flight updates at once and never cancels React's transition`, { r, after });
      check(!after.cls.includes('f12-vt-') && errors.length === 0, `${E} React 19.3: withCutMorphMode removes the mode key once React's transition finished`, { after, errors });
      await ctx.close();
    });
  } finally {
    await browser.close();
  }
}

console.log(failures ? `\n${failures} CutMorph check(s) failed` : '\nAll CutMorph checks passed');
process.exit(failures ? 1 : 0);
