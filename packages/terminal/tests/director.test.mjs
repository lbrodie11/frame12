import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FRAME_MS, POSE_MS, createDirector } from '@frame12/terminal';
import { createEventFactory, fixture, FIXTURE_NAMES } from '@frame12/terminal/testing';

/** A deterministic scheduler: time moves only when the test says so. */
function fakeClock() {
  let now = 0;
  let id = 0;
  const timers = new Map();
  return {
    now: () => now,
    setTimeout(fn, ms) {
      timers.set(++id, { at: now + ms, fn });
      return id;
    },
    clearTimeout(h) {
      timers.delete(h);
    },
    advance(ms) {
      const end = now + ms;
      for (;;) {
        const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > end) break;
        timers.delete(next[0]);
        now = next[1].at;
        next[1].fn();
      }
      now = end;
    },
    get pending() {
      return timers.size;
    },
  };
}

const live = { interactive: true };

function setup(motion = 'twos', extra = {}) {
  const clock = fakeClock();
  const director = createDirector({ caps: live, motion, scheduler: clock, ...extra });
  const publishes = [];
  director.subscribe((s) => publishes.push({ version: s.version, pose: s.pose, status: s.status }));
  return { clock, director, publishes, f: createEventFactory() };
}

describe('director: information is never paced', () => {
  for (const [type, payload] of [
    ['cut-end', { cut: 'a', status: 'error' }],
    ['warning', { message: 'careful' }],
    ['log', { level: 'error', text: 'boom' }],
    ['run-end', { status: 'failed' }],
  ]) {
    it(`${type} is published before push() returns`, () => {
      const { director, publishes, f } = setup('twos');
      director.push(f.next('run-start', { title: 'T' }));
      director.push(f.next('cut-start', { cut: 'a', title: 'A' }));
      const before = publishes.length;
      director.push(f.next(type, payload));
      assert.equal(publishes.length, before + 1);
    });
  }

  it('cancellation is acknowledged immediately, once, with running cuts canceled and the signal aborted', () => {
    const reasons = [];
    const { director, publishes, f } = setup('twos', { onCancel: (r) => reasons.push(r) });
    director.push(f.next('run-start', { title: 'T' }));
    director.push(f.next('cut-start', { cut: 'a', title: 'A' }));
    const before = publishes.length;
    director.cancel('SIGINT');
    director.cancel('again');
    assert.equal(publishes.length, before + 1);
    assert.deepEqual(reasons, ['SIGINT']);
    const s = director.snapshot();
    assert.equal(s.status, 'canceled');
    assert.equal(s.cuts[0].status, 'canceled');
    assert.equal(director.signal.aborted, true);
  });

  it('an invalid event is visible at once as a warning', () => {
    const { director, publishes } = setup();
    director.push({ type: 'cut-start' });
    assert.equal(publishes.length, 1);
    assert.match(director.snapshot().warnings[0], /^Dropped event 1/);
    assert.equal(director.snapshot().dropped.invalid, 1);
  });

  it('flush() publishes now (for key echo and focus moves)', () => {
    const { director, publishes } = setup();
    director.flush();
    assert.equal(publishes.length, 1);
  });
});

describe('director: coalescing and memory', () => {
  it('coalesces a 10,000 events/s burst for 3 s into at most one publish per frame, newest state winning', () => {
    const { director, publishes, clock, f } = setup('still', { maxEvents: 5000 });
    director.push(f.next('run-start', { title: 'T' }));
    director.push(f.next('cut-start', { cut: 'a', title: 'A' }));
    const base = publishes.length;
    let done = 0;
    for (let ms = 0; ms < 3000; ms++) {
      for (let k = 0; k < 10; k++) director.push(f.next('cut-progress', { cut: 'a', done: ++done, total: 30_000 }));
      clock.advance(1);
    }
    clock.advance(FRAME_MS);
    const frames = publishes.length - base;
    assert.ok(frames <= Math.ceil(3000 / FRAME_MS) + 2, `${frames} publishes for ${Math.ceil(3000 / FRAME_MS)} frames`);
    assert.ok(frames >= 150, 'still publishes data every frame (data is not paced, even at still)');
    const s = director.snapshot();
    assert.equal(s.cuts[0].progress.done, 30_000, 'the last state is shown');
    assert.equal(s.dropped.events, 30_002 - 5000, 'events beyond maxEvents are summarized as a count');
    assert.equal(clock.pending, 0, 'nothing left queued');
  });

  it('keeps logs in a ring buffer', () => {
    const { director, f } = setup('still', { maxLogs: 500 });
    director.push(f.next('run-start', { title: 'T' }));
    for (let i = 0; i < 10_000; i++) director.push(f.next('log', { level: 'info', text: `line ${i}` }));
    const s = director.snapshot();
    assert.equal(s.logs.length, 500);
    assert.equal(s.logs.at(-1).text, 'line 9999');
    assert.equal(s.dropped.logs, 9500);
  });

  it('caps warnings and counts the rest', () => {
    const { director, f } = setup('still', { maxWarnings: 3 });
    director.push(f.next('run-start', { title: 'T' }));
    for (let i = 0; i < 10; i++) director.push(f.next('warning', { message: `w${i}` }));
    assert.equal(director.snapshot().warnings.length, 3);
    assert.equal(director.snapshot().dropped.warnings, 7);
  });
});

describe('director: tempo paces decoration only', () => {
  const posesIn = (motion, ms) => {
    const { director, clock, f } = setup(motion);
    director.push(f.next('run-start', { title: 'T' }));
    director.push(f.next('cut-start', { cut: 'a', title: 'A' }));
    clock.advance(ms);
    return director.snapshot().pose;
  };

  it('twos advances the pose every 83.33 ms; ones every frame; still never', () => {
    assert.equal(posesIn('twos', 1000), Math.floor(1000 / POSE_MS));
    assert.equal(posesIn('ones', 1000), Math.floor(1000 / FRAME_MS));
    assert.equal(posesIn('still', 1000), 0);
  });

  it('ticks only while a cut is running: nothing animates between cuts', () => {
    const { director, clock, publishes, f } = setup('twos');
    director.push(f.next('run-start', { title: 'T' }));
    director.push(f.next('cut-start', { cut: 'a', title: 'A' }));
    clock.advance(500);
    director.push(f.next('cut-end', { cut: 'a', status: 'ok' }));
    const after = publishes.length;
    clock.advance(2000);
    assert.equal(publishes.length, after, 'zero publishes with the run open but no cut running');
    assert.equal(clock.pending, 0);
    director.push(f.next('cut-start', { cut: 'b', title: 'B' }));
    clock.advance(500);
    assert.ok(publishes.length > after, 'the clock restarts with the next cut');
  });

  it('stops the pose clock when the run ends (no redraw while idle)', () => {
    const { director, clock, publishes, f } = setup('twos');
    director.push(f.next('run-start', { title: 'T' }));
    clock.advance(200);
    director.push(f.next('run-end', { status: 'completed' }));
    const after = publishes.length;
    clock.advance(2000);
    assert.equal(publishes.length, after, 'zero publishes in 2 s after run-end');
    assert.equal(clock.pending, 0);
  });

  it('does not tick before a run starts', () => {
    const { clock, publishes } = setup('twos');
    clock.advance(2000);
    assert.equal(publishes.length, 0);
    assert.equal(clock.pending, 0);
  });
});

describe('director: state', () => {
  for (const name of FIXTURE_NAMES) {
    it(`${name}: folds the narration into state that agrees with the snapshot`, () => {
      const { director, clock } = setup('still');
      for (const ev of fixture(name).events) director.push(ev);
      clock.advance(100);
      const s = director.snapshot();
      const snap = fixture(name).snapshot;
      assert.equal(s.status, snap.status);
      assert.deepEqual(s.cuts.map((c) => [c.cut, c.status]), snap.cuts.map((c) => [c.cut, c.status]));
      // Narration may announce fewer findings than the snapshot holds (a canceled ranking cut), never
      // more, and never different ones: results come from the snapshot, not from narration.
      const inSnap = new Map(snap.findings.map((f) => [f.id, (f.receipts ?? []).length]));
      for (const f of s.findings) assert.equal(inSnap.get(f.id), (f.receipts ?? []).length, f.id);
      if (snap.cuts.every((c) => c.status === 'ok' || c.status === 'warning')) assert.equal(s.findings.length, snap.findings.length);
      assert.deepEqual(s.snapshot, snap, 'the authoritative snapshot is kept verbatim (it is clean fixture data)');
      assert.deepEqual(s.cuts.map((c) => c.label), s.cuts.map((_, i) => `C-${String(i + 1).padStart(2, '0')}`));
    });
  }

  it('sanitizes before anything is stored', () => {
    const { director, f } = setup();
    director.push(f.next('run-start', { title: 'x\u001b]52;c;ZXZpbA==\u0007‮y' }));
    director.log('error', `token ${['ghp', '_', 'q'.repeat(36)].join('')}`);
    const s = director.snapshot();
    assert.equal(s.title, 'x\\u{202e}y');
    assert.equal(s.logs[0].text, 'token [redacted]');
  });

  it('a failing subscriber or onEvent never stops the run', () => {
    const clock = fakeClock();
    const director = createDirector({ caps: live, motion: 'still', scheduler: clock, onEvent: () => { throw new Error('host'); } });
    const seen = [];
    director.subscribe(() => { throw new Error('bad listener'); });
    director.subscribe((s) => seen.push(s.version));
    const f = createEventFactory();
    director.push(f.next('run-start', { title: 'T' }));
    assert.deepEqual(seen, [1]);
  });

  const aFinding = () => structuredClone(fixture('success').snapshot.findings[0]);

  it('a re-sent finding (a status update) does not list its receipts twice (third review)', () => {
    const { director, f } = setup('still');
    director.push(f.next('run-start', { title: 'T' }));
    director.push(f.next('cut-start', { cut: 'rank', title: 'Rank' }));
    const finding = aFinding();
    director.push(f.next('finding', { cut: 'rank', finding }));
    director.push(f.next('receipt', { finding: finding.id, receipt: finding.receipts[0] })); // a repeat
    director.push(f.next('finding', { cut: 'rank', finding: { ...finding, status: 'ok' } }));
    const s = director.snapshot();
    assert.equal(s.findings[0].status, 'ok');
    assert.deepEqual(s.warnings, []);
    assert.equal(s.findings[0].receipts.length, finding.receipts.length);
  });

  it('merges receipts in linear time and stops storing narration past maxEvents (third review)', () => {
    const { director, f } = setup('still', { maxEvents: 5000 });
    director.push(f.next('run-start', { title: 'T' }));
    director.push(f.next('cut-start', { cut: 'rank', title: 'Rank' }));
    const finding = { ...aFinding(), receipts: [] };
    director.push(f.next('finding', { cut: 'rank', finding }));
    const t0 = performance.now();
    for (let i = 0; i < 40_000; i++) director.push(f.next('receipt', { finding: finding.id, receipt: { kind: 'commit', value: `c${i}` } }));
    const ms = performance.now() - t0;
    const s = director.snapshot();
    assert.ok(s.findings[0].receipts.length < 5000, `receipts kept: ${s.findings[0].receipts.length}`);
    assert.equal(s.dropped.events, 40_003 - 5000);
    assert.equal(s.dropped.items, 40_000 + 2 - 5000, 'past maxItems receipts are only counted');
    assert.ok(ms < 3000, `40,000 receipts took ${Math.round(ms)} ms`);
  });

  it('bounds stored items: finding updates with fresh receipts, new metrics and many cuts (fourth review)', () => {
    const { director, f } = setup('still', { maxItems: 50 });
    director.push(f.next('run-start', { title: 'T' }));
    director.push(f.next('cut-start', { cut: 'rank', title: 'Rank' }));
    const finding = { ...aFinding(), receipts: [] };
    director.push(f.next('finding', { cut: 'rank', finding }));
    for (let i = 0; i < 1000; i++) {
      director.push(f.next('finding', { cut: 'rank', finding: { ...finding, status: i % 2 ? 'ok' : 'review', receipts: [{ kind: 'commit', value: `u${i}` }] } }));
    }
    for (let i = 0; i < 1000; i++) director.push(f.next('metric', { metric: { name: `m${i}`, value: i } }));
    for (let i = 0; i < 1000; i++) {
      director.push(f.next('cut-start', { cut: `c${i}`, title: `C${i}` }));
      director.push(f.next('cut-end', { cut: `c${i}`, status: 'ok' }));
    }
    const s = director.snapshot();
    assert.deepEqual(s.warnings, [], 'every event was valid');
    const stored = s.cuts.length + s.findings.length + s.metrics.length + s.findings.reduce((n, x) => n + x.receipts.length, 0);
    assert.ok(stored <= 50, `stored ${stored}`);
    assert.equal(s.dropped.items, 3002 - 50);
    assert.equal(s.findings[0].status, 'ok', 'updates to a stored finding still apply past the cap');
  });

  it('a cancel before run-start stays canceled, and later cuts start canceled (third review)', () => {
    const { director, f, clock } = setup('twos');
    director.cancel('SIGINT');
    director.push(f.next('run-start', { title: 'T' }));
    director.push(f.next('cut-start', { cut: 'a', title: 'A' }));
    const s = director.snapshot();
    assert.equal(s.status, 'canceled');
    assert.equal(s.cuts[0].status, 'canceled');
    assert.equal(clock.pending, 0, 'no pose clock for a canceled run');
  });

  it('publishes nothing after dispose', () => {
    const { director, publishes, clock, f } = setup('twos');
    director.push(f.next('run-start', { title: 'T' }));
    director.dispose();
    const n = publishes.length;
    director.push(f.next('warning', { message: 'late' }));
    clock.advance(1000);
    assert.equal(publishes.length, n);
    assert.equal(clock.pending, 0);
  });
});
