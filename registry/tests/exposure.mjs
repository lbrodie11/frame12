// F12-09 ExposureScrubber + useExposure. Every timing assertion runs on Playwright's fake clock
// (page.clock.runFor); React commits are flushed with MessageChannel round-trips, never sleeps.
//   node tests/exposure.mjs                       # Chromium suite + the cross-engine section in
//                                                 # Chromium, Firefox and WebKit (like cross-browser.mjs)
//   BROWSERS=chromium node tests/exposure.mjs     # where only Chromium is installed
import AxeBuilder from '@axe-core/playwright';
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
    check(false, `${name}: threw`, String(err?.stack || err).slice(0, 600));
  }
}

const FIXTURE = resolve(REGISTRY_ROOT, 'tests/fixtures/exposure-fixture.tsx');
const APP = resolve(REGISTRY_ROOT, 'tests/fixtures/exposure-app.tsx');
const HOOK = resolve(REGISTRY_ROOT, 'hooks/use-exposure.ts');
const FRAME_MS = 1000 / 12;

// Counts ExposureRow renders per commit through a minimal React DevTools hook (the same
// "did this fiber render" test DevTools uses: PerformedWork on fibers in changed subtrees).
const RENDER_HOOK = () => {
  window.__rowRenders = 0;
  const renderers = new Map();
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true,
    isDisabled: false,
    renderers,
    inject(r) {
      const id = renderers.size + 1;
      renderers.set(id, r);
      return id;
    },
    onScheduleFiberRoot() {},
    onCommitFiberUnmount() {},
    onPostCommitFiberRoot() {},
    setStrictMode() {},
    checkDCE() {},
    onCommitFiberRoot(_id, root) {
      const walk = (next) => {
        for (let c = next.child; c; c = c.sibling) {
          const prev = c.alternate;
          const t = c.type;
          const name = t && (t.displayName || t.name);
          // Bundlers may rename the memo's inner function (ExposureRow2); match the prefix.
          if (typeof name === 'string' && /^ExposureRow\d*$/.test(name)) {
            if (!prev || c.flags & 1) window.__rowRenders++;
            continue;
          }
          if (prev && prev.child === c.child) continue;
          walk(c);
        }
      };
      walk(root.current);
    },
  };
};

// Live timer / rAF bookkeeping, installed on top of the fake clock.
const TIMER_SPY = `(() => {
  if (window.__spy) return;
  const live = new Set(); const raf = new Set();
  const st = window.setTimeout, ct = window.clearTimeout, ra = window.requestAnimationFrame, ca = window.cancelAnimationFrame;
  window.setTimeout = function (fn, ms, ...a) { let id; id = st.call(window, (...x) => { live.delete(id); typeof fn === 'function' && fn(...x); }, ms, ...a); live.add(id); return id; };
  window.clearTimeout = function (id) { live.delete(id); return ct.call(window, id); };
  window.requestAnimationFrame = function (fn) { let id; id = ra.call(window, (t) => { raf.delete(id); fn(t); }); raf.add(id); return id; };
  window.cancelAnimationFrame = function (id) { raf.delete(id); return ca.call(window, id); };
  window.__spy = { timers: () => live.size, rafs: () => raf.size };
})()`;

const html18 = await bundlePage(FIXTURE, { react: 18 });
const html18dev = await bundlePage(FIXTURE, { react: 18, nodeEnv: 'development' });

/** Lets React finish pending work (scheduler tasks run on MessageChannel, not the fake clock). */
async function flush(page, rounds = 12) {
  await page.evaluate(async (n) => {
    for (let i = 0; i < n; i++) {
      await new Promise((r) => {
        const c = new MessageChannel();
        c.port1.onmessage = () => r();
        c.port2.postMessage(0);
      });
    }
  }, rounds);
}
async function run(page, ms) {
  await page.clock.runFor(ms);
  await flush(page);
}
async function mount(page, props) {
  await page.evaluate((p) => window.__xs(p), props);
  await flush(page, 10);
}
const st = (page, pfx = 'xa') =>
  page.evaluate((p) => {
    const root = document.getElementById(p);
    const cur = root?.querySelector('tbody tr[aria-current="step"] .f12-xs-btn');
    const range = document.getElementById(`${p}-range`);
    const region = root?.querySelector('[role="status"]');
    return {
      index: cur ? Number(cur.dataset.i) : -1,
      playing: root?.dataset.playing === 'true',
      flipping: root?.dataset.flipping === 'true',
      rows: root?.querySelectorAll('tbody tr').length ?? 0,
      range: range ? Number(range.value) : null,
      valuetext: range?.getAttribute('aria-valuetext') ?? null,
      announce: region?.textContent ?? null,
      cut: root?.querySelector('.f12-xs-cut')?.textContent ?? null,
      panel: root?.querySelector('.f12-xs-panel .f12-panel-body')?.textContent ?? '',
      slate: !!root?.querySelector('.f12-xs-slate'),
    };
  }, pfx);
const log = (page) => page.evaluate(() => window.__xsLog.slice());
const clearLog = (page) => page.evaluate(() => (window.__xsLog.length = 0));
const lastValue = (l) => l.filter((e) => e[0] === 'value').at(-1);
const playingEvents = (l) => l.filter((e) => e[0] === 'playing').map((e) => `${e[2]}:${e[3]}`);

// =============================================================================== pure engine
await section('pure', async () => {
  const { mod } = await loadServerModule(HOOK);
  const {
    normalizeExposureFrames: norm,
    exposureStepDuration: dur,
    formatFrameNumber: fnum,
    formatElapsed,
    normalizeStepMs,
    isEditableTarget,
  } = mod;

  const r = norm([
    { id: 'a', label: 'A', hold: 3, at: '2026-01-01T00:00:00Z' },
    { id: 'a', label: 'A2', hold: 0 },
    { id: '', label: 'E', hold: 2.6, durationMs: -5 },
    { id: 7, label: 'N', hold: 99, durationMs: Infinity },
    { id: 'b', label: 'B', hold: NaN, at: 'not a date', causes: ['a', 'b', 'zz', 'c'] },
    { id: 'c', label: 'C', at: '2026-01-01T00:00:04Z', causes: ['b', 'a', 'a'] },
  ]);
  const keys = r.entries.map((e) => e.key);
  check(
    JSON.stringify(keys) === JSON.stringify(['a', 'a#2', '#2', '#3', 'b', 'c']),
    'contract: duplicate ids keep the first; later ones are id#2…; empty or non-string ids are keyed #index',
    keys,
  );
  check(
    JSON.stringify(r.entries.map((e) => e.hold)) === JSON.stringify([3, 1, 3, 12, 1, 1]),
    'contract: hold NaN / ≤ 0 / non-integer / > 12 is rounded and clamped to 1–12',
    r.entries.map((e) => e.hold),
  );
  check(
    r.entries[2].durationMs === undefined && r.entries[3].durationMs === undefined,
    'contract: negative or non-finite durationMs is ignored',
  );
  check(
    r.entries[4].atMs === undefined && r.entries[5].elapsedMs === 4000 && r.entries[0].elapsedMs === 0,
    'contract: unparseable at is missing; elapsed is relative to the first frame with a valid at (never Date.now)',
  );
  check(
    JSON.stringify(r.entries[4].causes) === '[0]' && JSON.stringify(r.entries[5].causes) === '[4,0]',
    'contract: causes naming an unknown id, a later frame or itself are dropped; duplicates collapse',
    [r.entries[4].causes, r.entries[5].causes],
  );
  check(r.issues.length >= 9 && new Set(r.issues).size === r.issues.length, 'contract: each problem yields one distinct issue message', r.issues.length);
  check(
    r.entries.map((e) => e.label).join('') === 'AA2ENBC',
    'contract: array order is the truth (missing / non-monotonic times never reorder frames)',
  );
  check(normalizeStepMs(100) === 250 && normalizeStepMs(NaN) === 1000 && normalizeStepMs(Infinity) === 1000 && normalizeStepMs(400) === 400, 'contract: stepMs < 250 clamps to 250; non-finite → 1000');

  // timing math
  const e = { hold: 3, gapMs: 5000 };
  check(dur(e, 'even', 1, 1000) === 3000 && dur(e, 'even', 2, 1000) === 1500 && dur(e, 'even', 0.5, 1000) === 6000, 'timing even: stepMs × hold ÷ rate');
  check(dur(e, 'elapsed', 1, 1000) === 3000 && dur({ hold: 1, gapMs: 10 }, 'elapsed', 1, 1000) === 250 && dur({ hold: 1, gapMs: 1200 }, 'elapsed', 4, 1000) === 300, 'timing elapsed: clamp(gap, 250, 3000) ÷ rate');
  check(dur({ hold: 2 }, 'elapsed', 1, 1000) === 2000 && dur({ hold: 1, gapMs: -1 }, 'elapsed', 2, 800) === 400, 'timing elapsed: a missing or negative gap falls back to the even duration');
  check(Math.abs(dur({ hold: 2 }, 'flipbook', 1, 1000) - 2 * FRAME_MS) < 1e-9 && Math.abs(dur({ hold: 1 }, 'flipbook', 4, 1000) - FRAME_MS / 4) < 1e-9, 'timing flipbook: FRAME_MS × hold ÷ rate (12 poses per second at 1×)');

  // gaps: durationMs first, else the at-difference to the next frame
  const g = norm([
    { id: '1', label: '', at: '2026-01-01T00:00:00Z' },
    { id: '2', label: '', at: '2026-01-01T00:00:02Z', durationMs: 700 },
    { id: '3', label: '', at: '2026-01-01T00:00:01Z' },
    { id: '4', label: '' },
  ]);
  check(
    JSON.stringify(g.entries.map((x) => x.gapMs ?? null)) === '[2000,700,null,null]' && g.maxGapMs === 2000 && g.hasTiming,
    'timing gaps: durationMs, else the at gap to the next frame; negative gaps are missing',
    g.entries.map((x) => x.gapMs ?? null),
  );
  check(norm([{ id: 'x', label: '' }]).hasTiming === false, 'timing: no durations and no times → no timing data');

  // numbering
  check(
    fnum(0, 9) === 'F-01' && fnum(98, 99) === 'F-99' && fnum(0, 100) === 'F-001' && fnum(99, 100) === 'F-100' && fnum(998, 999) === 'F-999' && fnum(0, 1000) === 'F-0001' && fnum(4999, 5000) === 'F-5000',
    'numbering: zero-padded to the digits of the total (minimum 2): 99 → F-99, 100 → F-001, 1,000 → F-0001',
  );
  check(formatElapsed(0) === '+00:00.0' && formatElapsed(65432) === '+01:05.4' && formatElapsed(-1500) === '-00:01.5', 'elapsed: +mm:ss.s, deterministic');
  check(isEditableTarget(null) === false, 'editable: null target is not editable');
  const gk = norm([{ id: '', label: 'bad id' }, { id: 'a', label: '' }, { id: 'a', label: '' }, { id: 'z', label: '', causes: ['#0', 'a#2', 'a'] }]).entries[3].causes;
  check(JSON.stringify(gk) === '[1]', 'contract: causes resolve against real ids only (generated keys "#0" / "a#2" are never causes; "a" is its first occurrence)', gk);
  const col = norm([{ id: 'a', label: '' }, { id: 'a', label: '' }, { id: 'a#2', label: '' }]).entries.map((e) => e.key);
  check(JSON.stringify(col) === '["a","a#3","a#2"]', 'contract: a generated duplicate key never takes a real id ("a#2" stays with its frame)', col);
  const over = norm(Array.from({ length: 5001 }, (_, i) => ({ id: `x${i}`, label: '' })));
  check(over.entries.length === 5001 && over.issues.some((m) => /exceeds the supported maximum of 5000/.test(m)), 'contract: above 5,000 frames a dev issue is raised and nothing is dropped');
});

// =============================================================================== docs demo data
await section('demo data', async () => {
  const { mod: demo } = await loadServerModule(resolve(REGISTRY_ROOT, '../site/src/lib/exposure-demo-data.ts'));
  const { mod: agentMod } = await loadServerModule(resolve(REGISTRY_ROOT, '../site/src/lib/exposure-agent-demo.ts'));
  const { mod: hook } = await loadServerModule(HOOK);
  const agent = agentMod.buildAgentRunDemo();
  const n = hook.normalizeExposureFrames(agent.frames);
  const mism = agent.frames.filter((f) => f.id.startsWith('check:') && f.status === 'error');
  const ids = new Set(agent.frames.map((f) => f.id));
  check(
    n.issues.length === 0 && mism.length === 3 && mism.every((f) => f.causes.some((c) => c.startsWith('record:')) && f.causes.every((c) => ids.has(c))) && agent.primaryMarker === mism[0].id,
    'agent demo: built from fixtures with no contract issues; every mismatch links to the tool call, the claim and its trusted record(s); the primary marker is the first mismatch',
    mism.map((f) => f.causes),
  );
  check(!agent.rawLog.includes('INDIRECT PROMPT INJECTION') && !agent.rawLog.includes('<script>') && agent.frames.every((f) => !JSON.stringify(f).includes('<script>')), 'agent demo: the tool input\'s untrusted memo is redacted from frames and the raw log');
  const { mod: term } = await loadServerModule(resolve(REGISTRY_ROOT, '../packages/terminal/src/index.ts'));
  const sv = term.createStreamValidator();
  const bad = demo.CI_RECORDED_EVENTS.map((e) => sv.push(e)).filter((r) => !r.ok);
  const fin = sv.finish();
  const ci = demo.buildCiRunDemo();
  const failedEnd = demo.CI_RECORDED_EVENTS.find((e) => e.type === 'cut-end' && e.status === 'error');
  const runEnd = ci.frames.find((f) => f.kind === 'run-end');
  check(
    bad.length === 0 && fin.length === 0 && !ci.illustrative && ci.recorded && /recorded/i.test(ci.title) && /break-test\.f12rec/.test(ci.source) &&
      hook.normalizeExposureFrames(ci.frames).issues.length === 0 && failedEnd?.cut === 'test' && runEnd?.causes?.[0] === failedEnd.id && ci.frames.find((f) => f.id === ci.primaryMarker)?.kind === 'finding',
    'CI demo: the recorded build-pipeline run; every event validates against @frame12/terminal\'s v1 stream validator; run end points at the failing test cut; the marker is its finding',
    { bad: bad.slice(0, 2), fin },
  );
});

const browser = await launch('chromium');

// =============================================================================== boundaries
await section('boundaries', async () => {
  const { ctx, page, errors } = await openFixture(browser, html18, { w: 1280, h: 900 });
  for (const n of [0, 1, 2, 200, 201, 1000, 5000]) {
    await mount(page, { n, genOpts: { statuses: true } });
    const s = await st(page);
    const info = await page.evaluate(() => {
      const root = document.getElementById('xa');
      return {
        caption: root.querySelector('caption')?.textContent ?? null,
        first: root.querySelector('tbody tr .f12-xs-fn')?.textContent ?? null,
        last: [...root.querySelectorAll('tbody tr .f12-xs-fn')].at(-1)?.textContent ?? null,
        play: document.getElementById('xa-play')?.disabled,
        transportDisabled: root.querySelector('.f12-xs-transport').disabled,
        one: root.querySelector('.f12-xs-one')?.textContent ?? null,
        note: root.querySelector('.f12-xs-note')?.textContent ?? null,
        renders: window.__xsCtx.length,
        empty: !!root.querySelector('.f12-xs-empty'),
      };
    });
    if (n === 0) {
      check(
        s.rows === 0 && info.empty && info.renders === 0 && info.transportDisabled && /no frames/i.test(info.note) && !s.announce,
        '0 frames: empty state, transport disabled with an explanation, renderFrame never called, no live-region output',
        info,
      );
    } else if (n === 1) {
      check(
        s.rows === 1 && info.one === '1 frame' && s.range === null && info.play === true && info.caption.endsWith('· 1 frame'),
        '1 frame: rendered; play/step disabled; the range is replaced by "1 frame"',
        info,
      );
    } else {
      const width = Math.max(2, String(n).length);
      check(
        s.rows === n && info.first === `F-${'1'.padStart(width, '0')}` && info.last === `F-${String(n).padStart(width, '0')}` && s.range === 1 && info.caption.endsWith(`· ${n} frames`),
        `${n} frames: every row in the DOM, numbered ${info.first}…${info.last}, range 1–${n}`,
        { rows: s.rows, first: info.first, last: info.last },
      );
    }
  }
  check(errors.length === 0, 'boundaries: no console errors in a production build', errors.slice(0, 3));
  await ctx.close();
});

// =============================================================================== dev errors
await section('dev errors', async () => {
  const bad = [
    { id: 'a', label: 'A' },
    { id: 'a', label: 'dup' },
    { id: '', label: 'empty id' },
    { id: 'h', label: 'bad hold', hold: 40 },
    { id: 'd', label: 'bad duration', durationMs: -3 },
    { id: 't', label: 'bad at', at: 'yesterday' },
    { id: 'c', label: 'bad causes', causes: ['nope', 'c', 'z'] },
    { id: 'z', label: 'later' },
  ];
  const errorsFor = async (html, props) => {
    const { ctx, page, errors } = await openFixture(browser, html, { w: 1024, h: 768 });
    await mount(page, props);
    await mount(page, props); // a remount must not duplicate per-instance messages beyond one each
    const out = errors.filter((e) => /FRAME\/12 ExposureScrubber/.test(e));
    await ctx.close();
    return { out, all: errors };
  };
  const dev = await errorsFor(html18dev, { frames: bad, props: { stepMs: 100, defaultValue: 'missing' } });
  const kinds = [/defaultValue "missing" is not a frame id/, /Duplicate frame id "a"/, /empty or non-string id/, /hold 40/, /durationMs -3/, /at "yesterday"/, /unknown cause "nope"/, /names itself/, /later frame "z"/, /stepMs 100/];
  const missing = kinds.filter((re) => !dev.out.some((m) => re.test(m)));
  check(missing.length === 0, 'dev build: one console.error per distinct input problem (duplicate, empty id, hold, duration, at, causes, stepMs)', missing.map(String));
  const perMount = dev.out.length / 2;
  check(Number.isInteger(perMount) && new Set(dev.out).size === perMount, 'dev build: each distinct problem is logged exactly once per instance', { total: dev.out.length });
  const prod = await errorsFor(html18, { frames: bad, props: { stepMs: 100, defaultValue: 'missing' } });
  check(prod.all.length === 0, 'production build: input problems are silent', prod.all.slice(0, 3));

  const { ctx, page, errors } = await openFixture(browser, html18dev, { w: 1024, h: 768 });
  await mount(page, { n: 4, controlled: true, initialValue: 'f2' });
  await page.evaluate(() => window.__xsSetValue(undefined));
  await flush(page);
  check(errors.some((e) => /switched from controlled to uncontrolled; the first mode wins/.test(e)), 'controlled → uncontrolled: dev warning; the first mode wins');
  await mount(page, { n: 4 });
  await page.evaluate(() => window.__xsSetProps({ value: 'f3' }));
  await flush(page);
  const s = await st(page);
  check(errors.some((e) => /uncontrolled to controlled/.test(e)) && s.index === 0, 'uncontrolled → controlled: dev warning; the later value is ignored (first mode wins)', s.index);
  await ctx.close();
});

// =============================================================================== controlled state
await section('controlled', async () => {
  const { ctx, page } = await openFixture(browser, html18, { w: 1280, h: 900 });
  await mount(page, { n: 6, controlled: true, initialValue: 'f2', genOpts: { markers: [4] } });
  let s = await st(page);
  check(s.index === 1, 'controlled: value selects by id (f2 → row 2)');
  await page.click('#xa tbody tr:nth-child(4) .f12-xs-btn');
  await flush(page);
  s = await st(page);
  check(s.index === 3 && lastValue(await log(page))?.[4] === 'row', 'controlled: the parent accepts a row click (reason row)');
  await page.evaluate(() => (window.__xsAccept = false));
  await page.click('#xa tbody tr:nth-child(6) .f12-xs-btn');
  await flush(page);
  s = await st(page);
  const l = await log(page);
  check(s.index === 3 && lastValue(l)?.[2] === 'f6', 'controlled: the parent rejects a change → the UI stays put, onValueChange still fired', { index: s.index, last: lastValue(l) });

  // a parent that ignores the playback advance → rejected at the next deadline
  await clearLog(page);
  await page.click('#xa-play');
  await flush(page);
  await run(page, 1000);
  s = await st(page);
  const after1 = await log(page);
  await run(page, 1000);
  const after2 = await log(page);
  s = await st(page);
  check(
    lastValue(after1)?.[4] === 'playback' && playingEvents(after2).join(',') === 'true:user,false:rejected' && !s.playing && s.index === 3,
    'controlled: a parent ignoring a playback advance stops playback with reason "rejected" by the next deadline',
    playingEvents(after2),
  );

  // value not found in controlled mode → first frame + onValueChange(firstId, data)
  await page.evaluate(() => (window.__xsAccept = true));
  await clearLog(page);
  await page.evaluate(() => window.__xsSetValue('nope'));
  await flush(page);
  s = await st(page);
  const nf = lastValue(await log(page));
  check(s.index === 0 && nf?.[2] === 'f1' && nf?.[4] === 'data', 'controlled: value not found → first frame and onValueChange(firstId, data)', nf);
  await ctx.close();

  // uncontrolled defaultValue not found → first frame, no callback
  const o = await openFixture(browser, html18, { w: 1280, h: 900 });
  await mount(o.page, { n: 6, props: { defaultValue: 'nope' } });
  s = await st(o.page);
  check(s.index === 0 && (await log(o.page)).length === 0, 'uncontrolled: defaultValue not found → first frame, no callback');
  await mount(o.page, { n: 6, props: { defaultValue: 'f5' } });
  check((await st(o.page)).index === 4, 'uncontrolled: defaultValue selects by id');
  await o.ctx.close();
});

// =============================================================================== reasons
await section('reasons', async () => {
  const { ctx, page } = await openFixture(browser, html18, { w: 1280, h: 900 });
  await mount(page, { n: 12, genOpts: { markers: [3, 8], causes: { 8: ['f2'] } } });
  const reasonOf = async (fn) => {
    await clearLog(page);
    await fn();
    await flush(page);
    return lastValue(await log(page))?.[4];
  };
  const got = {};
  got.rangeKey = await reasonOf(async () => {
    await page.focus('#xa-range');
    await page.keyboard.press('ArrowRight');
  });
  got.rowKey = await reasonOf(async () => {
    await page.focus('#xa tbody tr[aria-current="step"] .f12-xs-btn');
    await page.keyboard.press('ArrowDown');
  });
  got.j = await reasonOf(() => page.keyboard.press('j'));
  got.row = await reasonOf(() => page.click('#xa tbody tr:nth-child(1) .f12-xs-btn'));
  got.marker = await reasonOf(() => page.keyboard.press(']'));
  got.markerBtn = await reasonOf(() => page.click('#xa-next-mark'));
  got.cause = await reasonOf(() => page.click('#xa .f12-xs-cause'));
  got.back = await reasonOf(() => page.click('#xa .f12-xs-back'));
  const box = await page.locator('#xa-range').boundingBox();
  got.pointer = await reasonOf(async () => {
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2, { steps: 4 });
    await page.mouse.up();
  });
  got.playback = await reasonOf(async () => {
    await page.click('#xa-play');
    await run(page, 1000);
  });
  const want = { rangeKey: 'keyboard', rowKey: 'keyboard', j: 'keyboard', row: 'row', marker: 'marker', markerBtn: 'marker', cause: 'cause', back: 'cause', pointer: 'pointer', playback: 'playback' };
  const bad = Object.keys(want).filter((k) => got[k] !== want[k]);
  check(bad.length === 0, 'onValueChange reasons are correct for every path (range key, row key, j, row click, ] and marker button, cause, back, pointer drag, playback)', got);
  // playing reasons: user, scrub, end
  await clearLog(page);
  await page.focus('#xa-range');
  await page.keyboard.press('ArrowLeft');
  await flush(page);
  const scrub = playingEvents(await log(page));
  await page.keyboard.press('End');
  await flush(page);
  await clearLog(page);
  await page.keyboard.press('p'); // play at the end restarts from the first frame
  await flush(page);
  const restart = await st(page);
  const restartLog = await log(page);
  await page.keyboard.press('p');
  await flush(page);
  check(
    scrub.join() === 'false:scrub' && restart.index === 0 && restart.playing && playingEvents(restartLog).join() === 'true:user' && lastValue(restartLog)?.[4] === 'playback',
    'onPlayingChange reasons: a key scrub pauses with "scrub"; Play at the end restarts from the first frame ("user")',
    { scrub, restart: restart.index },
  );
  await ctx.close();
});

// =============================================================================== data mutation
await section('data mutation', async () => {
  const { ctx, page } = await openFixture(browser, html18, { w: 1280, h: 900, init: RENDER_HOOK });
  await mount(page, { n: 10 });
  await page.click('#xa tbody tr:nth-child(5) .f12-xs-btn');
  await flush(page);
  // render counter: one frame change re-renders two rows
  const counts = [];
  for (const key of ['ArrowDown', 'ArrowDown', 'ArrowUp']) {
    await page.evaluate(() => (window.__rowRenders = 0));
    await page.keyboard.press(key);
    await flush(page);
    counts.push(await page.evaluate(() => window.__rowRenders));
  }
  await page.evaluate(() => (window.__rowRenders = 0));
  await page.click('#xa-next');
  await flush(page);
  counts.push(await page.evaluate(() => window.__rowRenders));
  check(counts.every((c) => c === 2), 'render counter: each current-frame change re-renders exactly 2 rows (memo rows keyed by id)', counts);

  // remove the current frame while paused → nearest surviving frame at the previous index
  await mount(page, { n: 10 });
  await page.click('#xa tbody tr:nth-child(5) .f12-xs-btn');
  await flush(page);
  await clearLog(page);
  await page.evaluate(() => window.__xsSetFrames((fs) => fs.filter((f) => f.id !== 'f5')));
  await flush(page);
  let s = await st(page);
  let l = await log(page);
  check(s.index === 4 && lastValue(l)?.[2] === 'f6' && lastValue(l)?.[4] === 'data', 'remove current (paused): moves to the nearest surviving frame at the previous index, reason data', lastValue(l));

  // reorder: the id survives with a new index
  await page.evaluate(() => window.__xsSetFrames((fs) => [...fs].reverse()));
  await flush(page);
  s = await st(page);
  const curId = await page.evaluate(() => document.querySelector('#xa .fx-detail')?.dataset.frame);
  check(curId === 'f6' && s.index === 4, 'reorder: the current id survives; its index changes', { curId, index: s.index });

  // remove last frame when it is current → clamp
  await page.click('#xa tbody tr:last-child .f12-xs-btn');
  await flush(page);
  await page.evaluate(() => window.__xsSetFrames((fs) => fs.slice(0, -1)));
  await flush(page);
  s = await st(page);
  check(s.index === 7 && s.rows === 8, 'remove the last frame while current: clamps to the new last frame');

  // remove current while playing → pause with data
  await mount(page, { n: 10 });
  await page.click('#xa-play');
  await run(page, 2000);
  await clearLog(page);
  const id = await page.evaluate(() => document.querySelector('#xa .fx-detail')?.dataset.frame);
  await page.evaluate((x) => window.__xsSetFrames((fs) => fs.filter((f) => f.id !== x)), id);
  await flush(page);
  l = await log(page);
  s = await st(page);
  check(id === 'f3' && playingEvents(l).join() === 'false:data' && lastValue(l)?.[4] === 'data' && !s.playing, 'remove current (playing): pauses with reason data', { id, ev: playingEvents(l) });

  // append during playback continues
  await mount(page, { n: 3 });
  await page.click('#xa-play');
  await run(page, 1000);
  await page.evaluate(() => window.__xsSetFrames((fs) => [...fs, ...window.__gen(3, { prefix: 'g' })]));
  await flush(page);
  await run(page, 1000);
  await run(page, 1000);
  s = await st(page);
  check(s.playing && s.index === 3 && s.rows === 6, 'append during playback: playback continues into the new frames', s);

  // shrink to 0 and grow back
  await clearLog(page);
  await page.evaluate(() => window.__xsSetFrames(() => []));
  await flush(page);
  const empty = await st(page);
  l = await log(page);
  await page.evaluate(() => window.__xsSetFrames(() => window.__gen(5, { prefix: 'h' })));
  await flush(page);
  s = await st(page);
  check(
    empty.rows === 0 && playingEvents(l).join() === 'false:data' && s.rows === 5 && s.index >= 0 && !s.playing,
    'shrink to 0 pauses (data) and shows the empty state; growing back selects a valid frame',
    { empty: empty.rows, ev: playingEvents(l), back: s.index },
  );
  await ctx.close();
});

// =============================================================================== timing
await section('timing', async () => {
  const { ctx, page } = await openFixture(browser, html18, { w: 1280, h: 900 });
  // even honors hold and rate
  await mount(page, { n: 4, genOpts: { holds: [2, 1, 3, 1] } });
  await page.click('#xa-play');
  await flush(page);
  await run(page, 1999);
  const a = (await st(page)).index;
  await run(page, 1);
  const b = (await st(page)).index;
  await run(page, 1000);
  const c = (await st(page)).index;
  check(a === 0 && b === 1 && c === 2, 'even: each frame shows for stepMs × hold (hold 2 → 2 s, hold 1 → 1 s)', [a, b, c]);
  await page.click('#xa-play');
  await mount(page, { n: 4, props: { defaultRate: 4 } });
  await page.click('#xa-play');
  await flush(page);
  await run(page, 249);
  const r1 = (await st(page)).index;
  await run(page, 1);
  check(r1 === 0 && (await st(page)).index === 1, 'even: ÷ rate (4× → 250 ms per frame)');
  await page.click('#xa-play');

  // stepMs clamp
  await mount(page, { n: 4, props: { stepMs: 50 } });
  await page.click('#xa-play');
  await flush(page);
  await run(page, 249);
  const sc = (await st(page)).index;
  await run(page, 1);
  check(sc === 0 && (await st(page)).index === 1, 'stepMs below 250 is clamped to 250');
  await page.click('#xa-play');

  // elapsed clamps and falls back
  const frames = [
    { id: 'e1', label: 'short', at: '2026-01-01T00:00:00.000Z' },
    { id: 'e2', label: 'long', at: '2026-01-01T00:00:00.100Z' },
    { id: 'e3', label: 'mid', at: '2026-01-01T00:00:10.000Z', durationMs: 1200 },
    { id: 'e4', label: 'none' },
    { id: 'e5', label: 'end' },
  ];
  await mount(page, { frames, props: { timing: 'elapsed' } });
  await page.click('#xa-play');
  await flush(page);
  const trace = [];
  let t = 0;
  let prev = 0;
  while (t < 7000 && trace.length < 4) {
    await run(page, 50);
    t += 50;
    const i = (await st(page)).index;
    if (i !== prev) {
      trace.push([i, t]);
      prev = i;
    }
  }
  // e1 gap 100 → 250; e2 gap 9900 → 3000; e3 duration 1200; e4 none → even 1000
  check(JSON.stringify(trace) === JSON.stringify([[1, 250], [2, 3250], [3, 4450], [4, 5450]]), 'elapsed: clamp(gap, 250, 3000), durationMs first, missing gap → even', trace);

  // flipbook: 12 poses/s × hold; slate; settles
  await mount(page, { n: 40, genOpts: { holds: [1, 2] } });
  await page.check('#xa-timing-flipbook', { force: true });
  await flush(page);
  await page.click('#xa-play');
  await flush(page);
  // hold 1 → 83.3 ms, hold 2 → 166.7 ms: frame 1 from 83.3 ms, frame 2 from 250 ms.
  const fp = [];
  let at = 0;
  for (const t of [80, 87, 170, 245, 254]) {
    await run(page, t - at);
    at = t;
    fp.push((await st(page)).index);
  }
  const mid = await st(page);
  const ctxCalls = await page.evaluate(() => window.__xsCtx.length);
  await run(page, 1000);
  const ctxCalls2 = await page.evaluate(() => window.__xsCtx.length);
  await page.click('#xa-play');
  await flush(page);
  const settled = await st(page);
  check(JSON.stringify(fp) === JSON.stringify([0, 1, 1, 1, 2]), 'flipbook: FRAME_MS × hold per pose (12 per second at 1×)', fp);
  check(mid.slate && mid.flipping && /FLIPPING/.test(mid.cut) && ctxCalls2 === ctxCalls, 'flipbook: the panel shows the FLIPPING slate and renderFrame is not called while flipping', { ctxCalls, ctxCalls2 });
  check(!settled.slate && settled.cut === `CURRENT CUT / F-${String(settled.index + 1).padStart(2, '0')}` && /Full detail/.test(settled.panel), 'flipbook: pausing settles the panel on the frame where playback stopped', settled.cut);

  // end, loop, rapid toggles
  await mount(page, { n: 3 });
  await page.click('#xa-play');
  await clearLog(page);
  await run(page, 5000);
  let s = await st(page);
  check(!s.playing && s.index === 2 && playingEvents(await log(page)).join() === 'false:end', 'end: playback stops at the last frame (reason end)');
  await mount(page, { n: 3, props: { loop: true } });
  await page.click('#xa-play');
  await run(page, 3000);
  s = await st(page);
  check(s.playing && s.index === 0, 'loop: playback wraps to the first frame', s.index);
  await page.click('#xa-play');
  await mount(page, { n: 5 });
  await page.evaluate(TIMER_SPY);
  for (let i = 0; i < 20; i++) await page.click('#xa-play');
  await flush(page);
  s = await st(page);
  const timers = await page.evaluate(() => window.__spy.timers());
  const ev = playingEvents(await log(page));
  check(!s.playing && ev.length === 20 && timers <= 1, 'rapid play/pause (20 toggles): ends paused, 20 events, no leaked step timers', { ev: ev.length, timers });
  await ctx.close();
});

// =============================================================================== lifecycle
await section('lifecycle', async () => {
  const { ctx, page } = await openFixture(browser, html18, { w: 1280, h: 900 });
  await page.evaluate(TIMER_SPY);
  await mount(page, { n: 6 });
  await run(page, 2000); // let the segmented-control settle frames and announcer timers expire
  const idle = await page.evaluate(() => ({ t: window.__spy.timers(), r: window.__spy.rafs() }));
  check(idle.t === 0 && idle.r === 0, 'idle: zero timers and zero rAF callbacks pending', idle);
  await page.click('#xa-play');
  await run(page, 1500);
  const playingTimers = await page.evaluate(() => window.__spy.timers());
  await page.click('#xa-play');
  await run(page, 1500);
  const paused = await page.evaluate(() => ({ t: window.__spy.timers(), r: window.__spy.rafs() }));
  check(playingTimers >= 1 && paused.t === 0 && paused.r === 0, 'paused: zero timers and zero rAF (one step timer while playing)', { playingTimers, paused });

  // hidden tab pauses and never auto-resumes
  await clearLog(page);
  await page.click('#xa-play');
  await flush(page);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await flush(page);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await run(page, 3000);
  let s = await st(page);
  check(!s.playing && playingEvents(await log(page)).join() === 'true:user,false:hidden', 'hidden tab: pauses with reason hidden and does not auto-resume', playingEvents(await log(page)));

  // unmount mid-playback leaves no timers
  await page.click('#xa-play');
  await run(page, 500);
  await page.evaluate(() => window.__xsUnmount());
  await flush(page);
  const after = await page.evaluate(() => ({ t: window.__spy.timers(), r: window.__spy.rafs() }));
  check(after.t === 0 && after.r === 0, 'unmount mid-playback: no timers or rAF left', after);

  // two scrubbers on one page are independent
  await mount(page, { n: 6, two: true });
  await page.click('#xa-play');
  await page.click('#xb tbody tr:nth-child(4) .f12-xs-btn');
  await run(page, 1000);
  const A = await st(page, 'xa');
  const B = await st(page, 'xb');
  const ids = await page.evaluate(() => {
    const all = [...document.querySelectorAll('[id]')].map((e) => e.id);
    return { dup: all.length - new Set(all).size, regions: document.querySelectorAll('[role="status"]').length };
  });
  await page.focus('#xb-range');
  await page.keyboard.press('j');
  await flush(page);
  const A2 = await st(page, 'xa');
  const B2 = await st(page, 'xb');
  check(A.playing && A.index === 1 && !B.playing && B.index === 3 && ids.dup === 0 && ids.regions === 2 && A2.index === A.index && B2.index === 4, 'two scrubbers: independent state, unique ids, one live region each, keys handled only by the focused one', { A: A.index, B: B.index, ids, A2: A2.index, B2: B2.index });
  await ctx.close();

  // tempo: still mid-flipbook pauses (tempo); even continues without transitions
  const t = await openFixture(browser, html18, { w: 1280, h: 900 });
  await mount(t.page, { n: 30, tempo: 'twos' });
  await t.page.check('#xa-timing-flipbook', { force: true });
  await t.page.click('#xa-play');
  await run(t.page, 300);
  await clearLog(t.page);
  await t.page.evaluate(() => window.__xsSetTempo('still'));
  await flush(t.page);
  await run(t.page, 1000); // the pause announcement waits out the 1 s rate limit after "Playing"
  s = await st(t.page);
  const flipDisabled = await t.page.evaluate(() => document.getElementById('xa-timing-flipbook').disabled);
  check(!s.playing && playingEvents(await log(t.page)).join() === 'false:tempo' && flipDisabled && /Flipbook needs motion/.test(s.announce), 'tempo → still mid-flipbook: pauses (reason tempo), announces it, flipbook control disabled with an explanation', { ev: playingEvents(await log(t.page)), announce: s.announce });
  await t.page.check('#xa-timing-even', { force: true });
  await t.page.click('#xa-play');
  await run(t.page, 1000);
  s = await st(t.page);
  const trans = await t.page.evaluate(() => getComputedStyle(document.querySelector('#xa .f12-xs-row .f12-xs-f')).transitionDuration);
  check(s.playing && s.index > 0 && /^0s/.test(trans), 'still tempo: Play still works in even timing; transitions are cut', { index: s.index, trans });
  await t.page.click('#xa-play');
  // reduced motion toggled mid-flipbook
  await t.page.evaluate(() => window.__xsSetTempo('twos'));
  await flush(t.page);
  await t.page.check('#xa-timing-flipbook', { force: true });
  await t.page.click('#xa-play');
  await run(t.page, 200);
  await clearLog(t.page);
  await t.page.emulateMedia({ reducedMotion: 'reduce' });
  await flush(t.page);
  s = await st(t.page);
  await run(t.page, 50);
  s = await st(t.page);
  check(!s.playing && playingEvents(await log(t.page)).join() === 'false:tempo', 'reduced motion turned on mid-flipbook: pauses with reason tempo', { s: { playing: s.playing, flipping: s.flipping }, log: await log(t.page) });
  await t.page.check('#xa-timing-even', { force: true }).catch(() => {});
  await t.page.click('#xa-play');
  await run(t.page, 1000);
  check((await st(t.page)).playing, 'reduced motion: even playback still runs (reduced motion limits movement, not intentional progression)');
  await t.ctx.close();
});

// =============================================================================== keyboard
await section('keyboard', async () => {
  const { ctx, page } = await openFixture(browser, html18, { w: 1280, h: 900 });
  await mount(page, { n: 40, genOpts: { markers: [5, 20] }, render: 'input' });
  await page.focus('#xa-range');
  const seq = [];
  for (const k of ['ArrowRight', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'PageUp', 'PageDown', 'End', 'Home']) {
    await page.keyboard.press(k);
    await flush(page);
    seq.push((await st(page)).index);
  }
  check(JSON.stringify(seq) === JSON.stringify([1, 2, 1, 0, 10, 0, 39, 0]), 'range (native): ←/→/↑/↓ ±1, PageUp/PageDown ±10, Home/End', seq);
  // rows: one tab stop, roving
  await page.click('#xa tbody tr:nth-child(3) .f12-xs-btn');
  await flush(page);
  const tabbable = await page.evaluate(() => [...document.querySelectorAll('#xa tbody .f12-xs-btn')].filter((b) => b.tabIndex === 0).length);
  const rs = [];
  for (const k of ['ArrowDown', 'ArrowDown', 'ArrowUp', 'End', 'Home']) {
    await page.keyboard.press(k);
    await flush(page);
    const f = await page.evaluate(() => ({ focus: document.activeElement?.dataset.i, cur: document.querySelector('#xa tbody tr[aria-current="step"] .f12-xs-btn')?.dataset.i }));
    rs.push(`${f.focus}/${f.cur}`);
  }
  check(tabbable === 1 && rs.join() === '3/3,4/4,3/3,39/39,0/0', 'rows: one tab stop; ↑/↓/Home/End move focus and select; aria-current="step" on row and button', { tabbable, rs });
  // shortcuts
  const sc = [];
  for (const k of ['j', 'j', 'k', ']', ']', '[']) {
    await page.keyboard.press(k);
    await flush(page);
    sc.push((await st(page)).index);
  }
  check(JSON.stringify(sc) === JSON.stringify([1, 2, 1, 5, 20, 5]), 'shortcuts: j next, k previous, ] next marker, [ previous marker', sc);
  await page.keyboard.press('p');
  await flush(page);
  const pOn = (await st(page)).playing;
  await page.keyboard.press('p');
  await flush(page);
  check(pOn && !(await st(page)).playing, 'shortcut p toggles play/pause');
  // ignored in inputs and contenteditable inside renderFrame, and in consumer content generally
  const before = (await st(page)).index;
  await page.focus('#note-5');
  await page.keyboard.type('jkp][');
  await page.focus('#ce-5');
  await page.keyboard.type('jk');
  await page.focus('#consumer-btn-5');
  await page.keyboard.press('j');
  await flush(page);
  const typed = await page.evaluate(() => document.getElementById('note-5')?.value);
  check((await st(page)).index === before && typed === 'jkp][' && !(await st(page)).playing, 'shortcuts are ignored in an <input>, in contenteditable, and anywhere in consumer content', { typed });
  // outside the scrubber: nothing
  await page.evaluate(() => {
    const b = document.createElement('button');
    b.id = 'outside';
    b.textContent = 'outside';
    document.body.prepend(b);
  });
  await page.focus('#outside');
  await page.keyboard.press('j');
  await flush(page);
  check((await st(page)).index === before, 'shortcuts work only while focus is inside the scrubber (no global listeners)');
  // Tab order transport → sheet → panel
  await page.focus('#outside');
  const order = [];
  for (let i = 0; i < 16; i++) {
    await page.keyboard.press('Tab');
    order.push(await page.evaluate(() => {
      const a = document.activeElement;
      if (a.closest('.f12-xs-transport')) return a.id === 'xa-play' ? 'play' : a.id === 'xa-range' ? 'range' : 'transport';
      if (a.closest('tbody')) return 'row';
      if (a.closest('.f12-xs-panel')) return 'panel';
      return a.id || a.tagName;
    }));
  }
  const firstIdx = (x) => order.indexOf(x);
  check(firstIdx('play') < firstIdx('range') && firstIdx('range') < firstIdx('row') && firstIdx('row') < firstIdx('panel') && order.filter((x) => x === 'row').length === 1, 'Tab order: transport (play, then range) → sheet (one stop) → panel content', order);
  // playback never moves focus
  await page.focus('#note-5');
  await page.click('#xa-play');
  await page.focus('#xa tbody .f12-xs-btn[tabindex="0"]');
  await run(page, 3000);
  const f = await page.evaluate(() => ({ active: document.activeElement?.dataset.i, roving: document.querySelector('#xa tbody .f12-xs-btn[tabindex="0"]')?.dataset.i }));
  const s = await st(page);
  check(s.playing && f.active !== String(s.index) && f.roving === String(s.index), 'playback never moves focus; the roving target follows the current row', { ...f, index: s.index });
  await ctx.close();
});

// =============================================================================== pointer
await section('pointer', async () => {
  const { ctx, page } = await openFixture(browser, html18, { w: 1280, h: 900 });
  await mount(page, { n: 30 });
  // FRAME-column drag: immediate (same task), clamps outside, ends on pointercancel
  const res = await page.evaluate(async () => {
    const tbody = document.querySelector('#xa tbody');
    const rows = tbody.rows;
    const cell = rows[2].querySelector('.f12-xs-f');
    const r = (i) => rows[i].getBoundingClientRect();
    const at = (i) => r(i).top + r(i).height / 2;
    const cur = () => Number(document.querySelector('#xa tbody tr[aria-current="step"] .f12-xs-btn').dataset.i);
    const ev = (type, y, target = tbody) => target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 7, button: 0, buttons: 1, clientX: r(0).left + 10, clientY: y, isPrimary: true }));
    const out = {};
    ev('pointerdown', at(2), cell);
    await Promise.resolve();
    out.down = cur();
    ev('pointermove', at(5));
    out.move = cur(); // same task, no await: flushSync
    ev('pointermove', r(0).top - 200);
    out.above = cur();
    ev('pointermove', r(rows.length - 1).bottom + 5000);
    out.below = cur();
    ev('pointercancel', 0);
    ev('pointermove', at(3));
    out.afterCancel = cur();
    return out;
  });
  check(res.down === 2 && res.move === 5, 'FRAME-column drag scrubs immediately: the frame changes in the same task as the input event', res);
  check(res.above === 0 && res.below === 29, 'drag outside bounds clamps to the first / last frame', res);
  check(res.afterCancel === 29, 'pointercancel ends the drag cleanly (later moves do nothing)', res);
  await flush(page);
  // lost capture also ends cleanly
  const lost = await page.evaluate(async () => {
    const tbody = document.querySelector('#xa tbody');
    const rows = tbody.rows;
    const cell = rows[1].querySelector('.f12-xs-f');
    const y = (i) => rows[i].getBoundingClientRect().top + 5;
    const ev = (type, yy, target = tbody) => target.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 8, button: 0, buttons: 1, clientY: yy, clientX: 20 }));
    ev('pointerdown', y(1), cell);
    await Promise.resolve(); // a discrete event's update flushes in a microtask (same task)
    tbody.dispatchEvent(new PointerEvent('lostpointercapture', { bubbles: true, pointerId: 8 }));
    ev('pointermove', y(6));
    await Promise.resolve();
    return Number(document.querySelector('#xa tbody tr[aria-current="step"] .f12-xs-btn').dataset.i);
  });
  check(lost === 1, 'lost pointer capture ends the drag cleanly', lost);
  // native range drag
  await mount(page, { n: 30 });
  const box = await page.locator('#xa-range').boundingBox();
  await page.mouse.move(box.x + 6, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2, { steps: 3 });
  await flush(page);
  const mid = (await st(page)).index;
  await page.mouse.move(box.x + box.width + 400, box.y + box.height / 2, { steps: 2 });
  await page.mouse.up();
  await flush(page);
  check(mid > 5 && mid < 25 && (await st(page)).index === 29, 'range drag scrubs; dragging past the end clamps to the last frame', mid);
  // wheel scrolls, never scrubs
  await mount(page, { n: 120 });
  const sheet = await page.locator('#xa .f12-xs-scroll').boundingBox();
  const before = await page.evaluate(() => document.querySelector('#xa .f12-xs-scroll').scrollTop);
  await page.mouse.move(sheet.x + sheet.width / 2, sheet.y + sheet.height / 2);
  await page.mouse.wheel(0, 600);
  // Wheel scrolling is compositor-driven (not on the fake clock): wait for it to land.
  await page.waitForFunction(() => document.querySelector('#xa .f12-xs-scroll').scrollTop > 0, null, { timeout: 3000 }).catch(() => {});
  await flush(page);
  const afterTop = await page.evaluate(() => document.querySelector('#xa .f12-xs-scroll').scrollTop);
  check((await st(page)).index === 0 && afterTop > before, 'wheel scrolls the sheet; the frame never changes', { before, afterTop });
  // targets ≥ 24 × 24
  const small = await page.evaluate(() =>
    [...document.querySelectorAll('#xa button, #xa input[type="range"], #xa .f12-tempo-opt, #xa summary')]
      .map((e) => e.getBoundingClientRect())
      .filter((r) => r.width > 0 && (r.width < 24 || r.height < 24)).length,
  );
  check(small === 0, 'every target is at least 24 × 24 CSS px', small);
  await ctx.close();
});

// =============================================================================== announcements
await section('announcements', async () => {
  const { ctx, page } = await openFixture(browser, html18, { w: 1280, h: 900 });
  await mount(page, { n: 60 });
  await page.evaluate(() => {
    window.__ann = [];
    const region = document.querySelector('#xa [role="status"]');
    new MutationObserver(() => window.__ann.push(region.textContent)).observe(region, { childList: true, characterData: true, subtree: true });
  });
  // a 2 s drag → at most one announcement
  const box = await page.locator('#xa-range').boundingBox();
  await page.mouse.move(box.x + 6, box.y + box.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 20; i++) {
    await page.mouse.move(box.x + (box.width * i) / 22, box.y + box.height / 2);
    await run(page, 100);
  }
  await page.mouse.up();
  await run(page, 1500);
  const drag = await page.evaluate(() => window.__ann.filter(Boolean));
  check(drag.length <= 1 && /^Frame \d+ of 60/.test(drag[0] ?? ''), 'a 2 s drag gives at most one announcement (on settle)', drag);
  // keys: settle 500 ms after the last key
  await page.evaluate(() => (window.__ann = []));
  await page.focus('#xa-range');
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('ArrowRight');
    await run(page, 100);
  }
  const during = await page.evaluate(() => window.__ann.length);
  await run(page, 600);
  const keys = await page.evaluate(() => window.__ann.filter(Boolean));
  check(during === 0 && keys.length === 1, 'keys: announce once, 500 ms after the last key', { during, keys });
  // 10 s of playback → "Playing" + one "Paused at…"
  await page.click('#xa-play');
  await run(page, 1200); // past the 1 s rate limit
  await page.evaluate(() => (window.__ann = []));
  await page.click('#xa-play'); // pause
  await page.click('#xa-play'); // play
  await run(page, 10000);
  await page.click('#xa-play');
  await run(page, 1200);
  const pb = await page.evaluate(() => window.__ann.filter(Boolean).map((t) => t.replace(/\u00a0$/, '')));
  check(pb.length === 2 && pb[0] === 'Playing' && /^Paused at frame \d+ of 60$/.test(pb[1]), '10 s of playback: exactly "Playing" then one "Paused at frame N of 60" (≤ 1 per second, coalesced)', pb);
  await ctx.close();
});

// =============================================================================== causes, markers, errors
await section('causes markers errors', async () => {
  const { ctx, page } = await openFixture(browser, html18, { w: 1280, h: 900 });
  const frames = [
    { id: 'a', label: 'read config', marker: true },
    { id: 'b', label: 'plan', causes: ['a', 'zz', 'b', 'c'] },
    { id: 'c', label: 'write file', marker: true, causes: ['b'] },
    { id: 'd', label: 'run tests', status: 'error', marker: true, causes: ['c', 'a'] },
  ];
  await mount(page, { frames, props: { defaultValue: 'd' } });
  const links = await page.evaluate(() => [...document.querySelectorAll('#xa .f12-xs-cause')].map((b) => b.textContent));
  check(JSON.stringify(links) === JSON.stringify(['F-03 · write file', 'F-01 · read config']), 'causes: "Led here from" buttons come only from data', links);
  const primaries = await page.evaluate(() => [...document.querySelectorAll('#xa tbody .f12-xs-mk-primary')].map((m) => m.closest('tr').querySelector('.f12-xs-fn').textContent));
  check(JSON.stringify(primaries) === '["F-01"]', 'markers: three markers → exactly one marker-yellow (the first by default)', primaries);
  await page.click('#xa .f12-xs-cause >> nth=0');
  await flush(page);
  let s = await st(page);
  const backTxt = await page.evaluate(() => document.querySelector('#xa .f12-xs-back')?.textContent);
  const bLinks = await page.evaluate(() => [...document.querySelectorAll('#xa .f12-xs-cause')].map((b) => b.textContent));
  check(s.index === 2 && /Back to F-04/.test(backTxt) && JSON.stringify(bLinks) === '["F-02 · plan"]', 'causes: activating a link jumps there; "Back to F-04" appears', { index: s.index, backTxt });
  await page.click('#xa .f12-xs-back');
  await flush(page);
  s = await st(page);
  check(s.index === 3 && !(await page.$('#xa .f12-xs-back')), 'causes: Back returns to where you came from (one-level history)');
  await page.click('#xa tbody tr:nth-child(2) .f12-xs-btn');
  await flush(page);
  const bCauses = await page.evaluate(() => [...document.querySelectorAll('#xa .f12-xs-cause')].map((b) => b.textContent));
  check(JSON.stringify(bCauses) === '["F-01 · read config"]', 'causes: forward (c), self (b) and unknown (zz) links are dropped', bCauses);
  await mount(page, { frames, props: { primaryMarker: 'c' } });
  const p2 = await page.evaluate(() => [...document.querySelectorAll('#xa tbody .f12-xs-mk-primary')].length + ':' + document.querySelector('#xa tbody .f12-xs-mk-primary').closest('tr').querySelector('.f12-xs-fn').textContent);
  const ink = await page.evaluate(() => {
    const m = document.querySelector('#xa tbody .f12-xs-mk-primary');
    const cs = getComputedStyle(m);
    return { bg: cs.backgroundColor, color: cs.color };
  });
  check(p2 === '1:F-03' && ink.bg === 'rgb(255, 214, 10)' && ink.color === 'rgb(18, 18, 18)', 'markers: primaryMarker picks the one yellow marker; yellow is a background under --f-marker-ink', { p2, ink });
  // error boundary
  const tf = [{ id: 'ok1', label: 'fine' }, { id: 'boom', label: 'throws' }, { id: 'ok2', label: 'fine again' }];
  const e = await openFixture(browser, html18, { w: 1280, h: 900 });
  await mount(e.page, { frames: tf, render: 'throw' });
  await e.page.click('#xa-next');
  await flush(e.page);
  const msg = await e.page.evaluate(() => document.querySelector('#xa .f12-xs-error')?.textContent);
  await e.page.click('#xa-next');
  await flush(e.page);
  const s2 = await st(e.page);
  check(/This frame couldn.t be rendered \(boom\)/.test(msg ?? '') && s2.index === 2 && /Full detail for fine again/.test(s2.panel), 'error boundary: a throwing renderFrame shows the message with its id; navigation keeps working', msg);
  await e.ctx.close();
  await ctx.close();
});

// =============================================================================== scrubbing ctx (expensive renderFrame)
await section('scrubbing ctx', async () => {
  const { ctx, page } = await openFixture(browser, html18, { w: 1280, h: 900 });
  await mount(page, { n: 50, render: 'heavy' });
  await page.evaluate(() => (window.__xsCtx = []));
  await page.focus('#xa-range');
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
  await flush(page);
  const mid = await page.evaluate(() => window.__xsCtx.slice(-1)[0]);
  await run(page, 600);
  const end = await page.evaluate(() => window.__xsCtx.slice(-1)[0]);
  check(mid?.scrubbing === true && mid.settled === false && end?.scrubbing === false && end.settled === true && end.id === 'f6', 'renderFrame ctx: scrubbing while keys repeat (a light render), settled 500 ms after the last key', { mid, end });
  await ctx.close();
});

// =============================================================================== a11y (Chromium matrix)
async function axeRun(page) {
  const r = await new AxeBuilder({ page }).include('#xs-box').analyze();
  return r.violations.map((v) => `${v.id}(${v.nodes.length})`);
}
await section('a11y', async () => {
  const combos = [
    [320, 320],
    [768, 420],
    [768, 640],
    [1440, 1024],
    [1440, 420],
  ];
  const results = [];
  for (const scheme of ['light', 'dark']) {
    for (const variant of ['expressive', 'quiet']) {
      for (const [vw, cw] of combos) {
        const { ctx, page } = await openFixture(browser, html18, { w: vw, h: 900, scheme, clock: false });
        await mount(page, { n: 24, width: Math.min(cw, vw), genOpts: { statuses: true, markers: [3, 9], causes: { 9: ['f4'] }, gapMs: [400, 2000], detail: true }, props: { variant, defaultValue: 'f10' } });
        if (scheme === 'dark') await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
        const v = await axeRun(page);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        results.push({ k: `${scheme}/${variant}/${vw}/${cw}`, v, overflow });
        await ctx.close();
      }
    }
  }
  const bad = results.filter((r) => r.v.length || r.overflow > 0);
  check(bad.length === 0, `axe: zero violations and no horizontal page scroll in light/dark × expressive/quiet × ${combos.length} viewport/container sizes`, bad.slice(0, 4));

  // the 5,000-frame valuetext / aria-current after jumps
  const { ctx, page } = await openFixture(browser, html18, { w: 1280, h: 900 });
  await mount(page, { n: 5000 });
  await page.focus('#xa-range');
  await page.keyboard.press('End');
  await page.keyboard.press('ArrowLeft');
  await flush(page);
  const big = await page.evaluate(() => ({
    vt: document.getElementById('xa-range').getAttribute('aria-valuetext'),
    rowCur: document.querySelector('#xa tbody tr[aria-current="step"] .f12-xs-fn').textContent,
    btnCur: document.querySelector('#xa tbody .f12-xs-btn[aria-current="step"]').dataset.i,
  }));
  check(big.vt === 'Frame 4999 of 5000: step 4999 · tool call · write_file' && big.rowCur === 'F-4999' && big.btnCur === '4998', 'aria-valuetext and aria-current="step" are correct after a jump to frame 4,999 of 5,000', big);
  // find-in-page reaches content-visibility rows
  const found = await page.evaluate(() => {
    window.getSelection()?.removeAllRanges();
    const ok = window.find('step 4321 · tool call');
    return ok && window.getSelection().anchorNode?.parentElement?.closest('tr')?.querySelector('.f12-xs-fn')?.textContent;
  });
  const cv = await page.evaluate(() => getComputedStyle(document.querySelector('#xa tbody tr')).contentVisibility);
  check(found === 'F-4321' && cv === 'auto', 'content-visibility: auto rows are reachable by find-in-page', { found, cv });
  await ctx.close();

  // forced colors
  const fc = await browser.newContext({ viewport: { width: 1280, height: 900 }, forcedColors: 'active' });
  const fp = await fc.newPage();
  await fp.route('http://f12.test/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: html18 }));
  await fp.goto('http://f12.test/index.html');
  await mount(fp, { n: 10, genOpts: { statuses: true, markers: [2, 6] }, props: { defaultValue: 'f3' } });
  await fp.focus('#xa tbody .f12-xs-btn[tabindex="0"]');
  await fp.keyboard.press('ArrowDown');
  await fp.keyboard.press('ArrowUp');
  await flush(fp);
  const forced = await fp.evaluate(() => {
    const row = document.querySelector('#xa tbody tr[aria-current="step"]');
    const f = getComputedStyle(row.querySelector('.f12-xs-f'));
    const other = getComputedStyle(document.querySelector('#xa tbody tr:not([aria-current]) .f12-xs-f'));
    const mk = getComputedStyle(document.querySelector('#xa .f12-xs-mk-primary'));
    const btn = getComputedStyle(document.activeElement);
    return {
      outline: getComputedStyle(row).outlineStyle,
      curBg: f.backgroundColor,
      otherBg: other.backgroundColor,
      mkBorder: mk.borderTopStyle,
      focus: btn.outlineStyle,
      statusText: document.querySelector('#xa .f12-xs-st').textContent,
    };
  });
  check(forced.outline !== 'none' && forced.curBg !== forced.otherBg && forced.mkBorder === 'double' && forced.focus !== 'none' && /ok|warning|error/.test(forced.statusText), 'forced colors: the current row (outline + Highlight frame cell), status text, the primary marker (double border) and focus stay distinguishable', forced);
  await fc.close();

  // zoom reflow: 200% and 400% of 1280 → 640 and 320 CSS px
  const z = [];
  for (const w of [640, 320]) {
    const o = await openFixture(browser, html18, { w, h: 800, clock: false });
    await mount(o.page, { n: 40, genOpts: { statuses: true, markers: [3], gapMs: 900, detail: true } });
    z.push(await o.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth));
    await o.ctx.close();
  }
  check(z.every((d) => d <= 0), '200% and 400% zoom (640 and 320 CSS px): reflow with no horizontal scroll', z);
});

// =============================================================================== layout & disclosure
await section('layout', async () => {
  const { ctx, page } = await openFixture(browser, html18, { w: 1440, h: 900, clock: false });
  const layout = async (width) => {
    await mount(page, { n: 42, width });
    return page.evaluate(() => {
      const r = (s) => document.querySelector(`#xa ${s}`).getBoundingClientRect();
      const sum = document.querySelector('#xa .f12-xs-sum');
      return { sheet: r('.f12-xs-disc'), panel: r('.f12-xs-panel'), transport: r('.f12-xs-transport'), summary: getComputedStyle(sum).display, sumText: sum.textContent };
    });
  };
  const wide = await layout(1024);
  const drawer = await layout(420);
  check(Math.abs(wide.sheet.top - wide.panel.top) < 2 && wide.sheet.left < wide.panel.left && wide.summary === 'none', '≥ 640 px container: sheet and panel side by side (the disclosure summary is hidden)', { s: wide.sheet.left, p: wide.panel.left });
  check(drawer.transport.top < drawer.panel.top && drawer.panel.top < drawer.sheet.top && drawer.summary !== 'none' && drawer.sumText === 'Exposure sheet · 42 frames', '420 px drawer on a 1440 px screen: transport and panel first, the sheet is a disclosure "Exposure sheet · 42 frames"', drawer.sumText);
  await page.click('#xa .f12-xs-sum');
  const closed = await page.evaluate(() => document.querySelector('#xa .f12-xs-disc').open);
  check(closed === false, 'narrow: the sheet disclosure collapses');
  await ctx.close();
  // landscape phone
  const ph = await openFixture(browser, html18, { w: 844, h: 390, clock: false });
  await mount(ph.page, { n: 42, genOpts: { detail: true } });
  const o = await ph.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(o <= 0, 'landscape phone (844 × 390): no horizontal scroll', o);
  await ph.ctx.close();
});

// =============================================================================== SSR / hydration / no JS
await section('ssr', async () => {
  const props = { n: 30, initialValue: undefined, genOpts: { statuses: true, markers: [4, 9], causes: { 9: ['f5'] }, gapMs: [500, 1500], detail: true }, props: { defaultValue: 'f10', label: 'Run SSR' } };
  for (const major of [18, 19]) {
    const { mod, React, server } = await loadServerModule(APP, { react: major });
    const markup = server.renderToString(React.createElement(mod.Harness, props));
    const again = server.renderToString(React.createElement(mod.Harness, props));
    check(markup === again && !/Date\.now|NaN|undefined/.test(markup.replace(/data-[a-z-]+=/g, '')), `React ${major} SSR: deterministic markup (no time, locale or random ids)`);
    const client = await bundlePage(FIXTURE, { react: major, nodeEnv: 'development', head: `<script>window.__xsSsr=${JSON.stringify(props)}</script>` });
    const page0 = client.replace('<div id="root"></div>', `<div id="root">${markup}</div>`);
    const { ctx, page, errors, warnings } = await openFixture(browser, page0, { w: 1280, h: 900, clock: false });
    await flush(page, 12);
    const hyd = [...errors, ...warnings].filter((m) => /hydrat|did not match|mismatch|server/i.test(m));
    const s = await st(page);
    const enabled = await page.evaluate(() => !document.querySelector('#xa .f12-xs-transport').disabled && !document.querySelector('#xa .f12-xs-note'));
    check(hyd.length === 0 && errors.length === 0 && s.index === 9 && enabled, `React ${major} (dev): server markup hydrates with no hydration warnings; the transport comes alive after hydration`, { hyd: hyd.slice(0, 2), errors: errors.slice(0, 2) });
    await ctx.close();
    if (major === 18) {
      // without JavaScript
      const nj = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 900 } });
      const p = await nj.newPage();
      await p.route('http://f12.test/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: page0 }));
      await p.goto('http://f12.test/index.html');
      const nojs = await p.evaluate(() => {
        const root = document.getElementById('xa');
        const rows = [...root.querySelectorAll('tbody tr')];
        return {
          rows: rows.length,
          allText: rows.every((r) => /step \d+/.test(r.textContent) && /(ok|warning|error)/.test(r.textContent) && /\+\d\d:\d\d\.\d/.test(r.textContent) && /Detail for step/.test(r.textContent)),
          panel: root.querySelector('.f12-xs-cut').textContent,
          disabled: root.querySelector('.f12-xs-transport').disabled,
          note: root.querySelector('.f12-xs-note')?.textContent,
          open: root.querySelector('.f12-xs-disc').open,
        };
      });
      check(nojs.rows === 30 && nojs.allText && nojs.panel === 'CURRENT CUT / F-10' && nojs.disabled && nojs.note === 'Replay needs JavaScript' && nojs.open, 'without JavaScript: the complete table (label, status, elapsed, detail) and the initial panel; the transport is disabled with "Replay needs JavaScript"; the sheet is open', nojs);
      await nj.close();
    }
  }
  // HTML bytes per row (500 frames, light renderFrame, excluding label/detail text)
  const { mod, React, server } = await loadServerModule(APP, { react: 18 });
  const sizeOf = (n) => server.renderToString(React.createElement(mod.Harness, { n, genOpts: { statuses: true, gapMs: 700 } }));
  const h500 = sizeOf(500);
  const h0 = sizeOf(1);
  const labels = await (async () => {
    const { gen } = mod;
    return gen(500, { statuses: true, gapMs: 700 }).reduce((a, f) => a + Buffer.byteLength(f.label) + Buffer.byteLength(f.kind ?? ''), 0);
  })();
  const perRow = (Buffer.byteLength(h500) - Buffer.byteLength(h0) - labels) / 499;
  check(perRow <= 400, `HTML: ${perRow.toFixed(0)} bytes per row of markup for 500 frames (budget ≤ 400, excluding label/kind text)`, { total: Buffer.byteLength(h500) });
});

// =============================================================================== review regressions
await section('review regressions', async () => {
  const { ctx, page } = await openFixture(browser, html18, { w: 1280, h: 900 });
  // Home on the range while flipping goes to frame 1 (not relative to the frozen start).
  await mount(page, { n: 60, tempo: 'twos' });
  await page.click('#xa tbody tr:nth-child(6) .f12-xs-btn');
  await page.check('#xa-timing-flipbook', { force: true });
  await page.click('#xa-play');
  await run(page, 1000);
  await page.focus('#xa-range');
  await page.keyboard.press('Home');
  await flush(page);
  let s = await st(page);
  check(s.index === 0 && !s.playing, 'range Home while flipping selects the first frame (absolute) and pauses', s.index);

  // Flipbook selected under a still tempo: Play still plays (even timing), no instant pause.
  await mount(page, { n: 10, tempo: 'still', props: { timing: 'flipbook' } });
  await clearLog(page);
  await page.click('#xa-play');
  await run(page, 1000);
  s = await st(page);
  check(s.playing && s.index === 1 && playingEvents(await log(page)).join() === 'true:user', 'timing="flipbook" under a still tempo: Play plays in even timing (no immediate tempo pause)', playingEvents(await log(page)));
  await page.click('#xa-play');

  // Controlled value: removing the current frame fires data once and stays at the position.
  await mount(page, { n: 8, controlled: true, initialValue: 'f5' });
  await page.evaluate(() => (window.__xsAccept = false));
  await clearLog(page);
  await page.evaluate(() => window.__xsSetFrames((fs) => fs.filter((f) => f.id !== 'f5')));
  await flush(page);
  await page.evaluate(() => window.__xsSetProps({ loop: true })); // an unrelated re-render
  await flush(page);
  s = await st(page);
  const dv = (await log(page)).filter((e) => e[0] === 'value');
  check(dv.length === 1 && dv[0][2] === 'f6' && dv[0][4] === 'data' && s.index === 4, 'controlled: removing the current frame fires one data change and keeps the position across re-renders', dv);
  await page.evaluate(() => (window.__xsAccept = true));

  // Shortcuts from portalled consumer content are ignored.
  await mount(page, { n: 8, render: 'portal' });
  await page.focus('#portal-btn-0');
  await page.keyboard.press('j');
  await page.keyboard.press('p');
  await flush(page);
  s = await st(page);
  check(s.index === 0 && !s.playing, 'shortcuts are ignored in consumer content portalled out of the scrubber');

  // j moves the current frame; ArrowDown on the (stale) focused row continues from the current frame.
  await mount(page, { n: 12 });
  await page.focus('#xa tbody .f12-xs-btn[tabindex="0"]');
  await page.keyboard.press('j');
  await page.keyboard.press('j');
  await page.keyboard.press('ArrowDown');
  await flush(page);
  check((await st(page)).index === 3, 'rows: arrows continue from the current frame after j/k moved it', (await st(page)).index);

  // Focus is never dropped: Prev at the start stays focusable; cause/back focus the new title.
  await mount(page, { n: 6, genOpts: { causes: { 4: ['f2'] } }, props: { defaultValue: 'f2' } });
  await page.focus('#xa-prev');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await flush(page);
  const prevFocus = await page.evaluate(() => ({ id: document.activeElement?.id, dis: document.getElementById('xa-prev').getAttribute('aria-disabled') }));
  await mount(page, { n: 6, genOpts: { causes: { 4: ['f2'] } }, props: { defaultValue: 'f5' } });
  await page.focus('#xa .f12-xs-cause');
  await page.keyboard.press('Enter');
  await flush(page);
  const afterCause = await page.evaluate(() => document.activeElement?.id);
  await page.focus('#xa .f12-xs-back');
  await page.keyboard.press('Enter');
  await flush(page);
  const afterBack = await page.evaluate(() => document.activeElement?.id);
  check(prevFocus.id === 'xa-prev' && prevFocus.dis === 'true' && afterCause === 'xa-title' && afterBack === 'xa-title' && (await st(page)).index === 4, 'focus: Prev at the first frame stays focused (aria-disabled); following a cause or Back focuses the new frame title', { prevFocus, afterCause, afterBack });
  // (review #1) Back is cleared when the reader returns another way; focus is never dropped and
  // a later row click keeps focus on that row.
  await mount(page, { n: 6, genOpts: { causes: { 3: ['f2'] } }, props: { defaultValue: 'f4' } });
  await page.focus('#xa .f12-xs-cause');
  await page.keyboard.press('Enter');
  await flush(page);
  await page.keyboard.press('j');
  await page.keyboard.press('j');
  await flush(page);
  const backGone = !(await page.$('#xa .f12-xs-back'));
  const stillTitle = await page.evaluate(() => document.activeElement?.id);
  await page.focus('#xa tbody tr:nth-child(1) .f12-xs-btn');
  await page.keyboard.press('Enter');
  await flush(page);
  const rowFocus = await page.evaluate(() => document.activeElement?.closest('tr')?.querySelector('.f12-xs-fn')?.textContent);
  // follow → Back → then a mouse row click: focus stays on the clicked row (no stale request)
  await page.click('#xa tbody tr:nth-child(4) .f12-xs-btn');
  await flush(page);
  await page.focus('#xa .f12-xs-cause');
  await page.keyboard.press('Enter');
  await flush(page);
  await page.focus('#xa .f12-xs-back');
  await page.keyboard.press('Enter');
  await flush(page);
  const afterBack2 = await page.evaluate(() => document.activeElement?.id);
  await page.click('#xa tbody tr:nth-child(6) .f12-xs-btn');
  await flush(page);
  await run(page, 100);
  const afterRowClick = await page.evaluate(() => document.activeElement?.closest('tr')?.querySelector('.f12-xs-fn')?.textContent);
  check(backGone && stillTitle === 'xa-title' && rowFocus === 'F-01' && afterBack2 === 'xa-title' && afterRowClick === 'F-06', 'Back: cleared when the reader returns to that frame another way; focus never drops to <body>; a later row activation keeps focus on that row', { backGone, stillTitle, rowFocus, afterBack2, afterRowClick });

  // A controlled parent that applies the cause jump on a later task still gets "Back".
  await mount(page, { n: 6, controlled: true, initialValue: 'f4', genOpts: { causes: { 3: ['f2'] } } });
  await page.evaluate(() => (window.__xsAcceptLater = true));
  await page.click('#xa .f12-xs-cause');
  await flush(page);
  await run(page, 50);
  const lateBack = await page.evaluate(() => document.querySelector('#xa .f12-xs-back')?.textContent ?? null);
  const lateIndex = (await st(page)).index;
  await page.evaluate(() => (window.__xsAcceptLater = false));
  check(lateIndex === 1 && /Back to F-04/.test(lateBack ?? ''), 'controlled value applied on a later task: "Back to F-04" still appears after the cause jump', { lateIndex, lateBack });

  // Starting a flipbook with p while the title has focus keeps focus (the header persists).
  await mount(page, { n: 30, tempo: 'twos', genOpts: { causes: { 3: ['f2'] } }, props: { defaultValue: 'f4' } });
  await page.check('#xa-timing-flipbook', { force: true });
  await page.focus('#xa .f12-xs-cause');
  await page.keyboard.press('Enter');
  await flush(page);
  await page.keyboard.press('p');
  await run(page, 300);
  const flipFocus = await page.evaluate(() => ({ id: document.activeElement?.id, slate: !!document.querySelector('#xa .f12-xs-slate') }));
  await page.keyboard.press('p');
  await flush(page);
  check(flipFocus.id === 'xa-title' && flipFocus.slate, 'flipbook started with p while the title is focused: the slate shows and focus stays on the title', flipFocus);

  // (review #5) a pointer click on Next mark is settled: no scrubbing render, announced at once.
  await mount(page, { n: 10, genOpts: { markers: [6] } });
  await page.evaluate(() => (window.__xsCtx = []));
  await page.click('#xa-next-mark');
  await flush(page);
  await run(page, 20);
  const markCtx = await page.evaluate(() => window.__xsCtx.map((c) => c.scrubbing));
  const markAnn = (await st(page)).announce;
  check(markCtx.length > 0 && markCtx.every((x) => x === false) && /^Frame 7 of 10/.test(markAnn), 'Next mark by pointer: renderFrame never gets scrubbing; the frame is announced at once (keys still settle after 500 ms)', { markCtx, markAnn });

  // (nit) shortcuts work while a timing radio has focus.
  await mount(page, { n: 10 });
  await page.focus('#xa-timing-even');
  await page.keyboard.press('j');
  await flush(page);
  check((await st(page)).index === 1, 'shortcuts work while a timing radio has focus (radios are not editable)');

  // (review #4) unmount right after a row click / mark click: no timers, no late updates.
  await page.evaluate(TIMER_SPY);
  await mount(page, { n: 10, genOpts: { markers: [6] } });
  await run(page, 2000);
  await page.click('#xa tbody tr:nth-child(3) .f12-xs-btn');
  await page.evaluate(() => {
    document.getElementById('xa-next-mark').click();
    window.__xsUnmount();
  });
  await flush(page);
  const leftTimers = await page.evaluate(() => ({ t: window.__spy.timers(), r: window.__spy.rafs() }));
  await run(page, 1500);
  check(leftTimers.t === 0 && leftTimers.r === 0, 'unmount right after a row click and a mark click: no timers or rAF left', leftTimers);

  await ctx.close();
});

// =============================================================================== cross-engine
// Same default as tests/cross-browser.mjs: all three engines (CI's Playwright image has them).
const engines = (process.env.BROWSERS || 'chromium,firefox,webkit').split(',').map((s) => s.trim()).filter(Boolean);
for (const name of engines) {
  await section(`engine ${name}`, async () => {
    const b = name === 'chromium' ? browser : await launch(name);
    try {
      const { ctx, page } = await openFixture(b, html18, { w: 1280, h: 900, clock: false });
      await mount(page, { n: 12, genOpts: { statuses: true, markers: [3], gapMs: 600 }, props: { defaultValue: 'f4' } });
      const snap = await page.locator('#xa table').ariaSnapshot();
      const disp = await page.evaluate(() => ({
        table: getComputedStyle(document.querySelector('#xa table')).display,
        row: getComputedStyle(document.querySelector('#xa tbody tr')).display,
      }));
      const roles = ['table', 'rowgroup', 'row', 'columnheader', 'cell'].filter((r) => !new RegExp(`(^|\\n)\\s*- ${r}\\b`).test(snap));
      check(roles.length === 0 && disp.table === 'grid' && disp.row === 'grid', `[${name}] accessibility tree keeps table / rowgroup / row / columnheader / cell roles with CSS grid layout`, { missing: roles, disp });
      const v = await axeRun(page);
      check(v.length === 0, `[${name}] axe: zero violations`, v);
      await page.focus('#xa-range');
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('PageUp');
      await page.waitForTimeout(50);
      const s = await st(page);
      check(s.index === 11 && /^Frame 12 of 12/.test(s.valuetext), `[${name}] native range keys and aria-valuetext`, s);
      await ctx.close();
    } finally {
      if (b !== browser) await b.close();
    }
  });
}

await browser.close();
console.log(failures ? `\n${failures} exposure check(s) failed` : '\nAll exposure checks passed');
process.exit(failures ? 1 : 0);
