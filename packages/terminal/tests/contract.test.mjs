import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'node:test';
import {
  CUT_STATUSES,
  DEFAULT_MAX_EVENT_BYTES,
  DEFAULT_MAX_SNAPSHOT_BYTES,
  EVENT_TYPES,
  FINDING_STATUSES,
  LOG_LEVELS,
  PROMINENCES,
  RECEIPT_KINDS,
  RUN_STATUSES,
  SCHEMA_VERSION,
  VALIDATION_CODES,
  createStreamValidator,
  describeIssues,
  validateEvent,
  validateSnapshot,
} from '@frame12/terminal';
import { createEventFactory, fixture, fixtures, FIXTURE_NAMES } from '@frame12/terminal/testing';
import { schemaErrors } from './helpers.mjs';

const schema = JSON.parse(fs.readFileSync(new URL('../schema/events.schema.json', import.meta.url), 'utf8'));
const clone = (v) => JSON.parse(JSON.stringify(v));

function eventOf(type, extra = {}) {
  const f = createEventFactory();
  const base = {
    'run-start': { title: 'T' },
    'scene-start': { scene: 's', title: 'S' },
    'cut-start': { cut: 'read-history', title: 'Read history' },
    'cut-progress': { cut: 'read-history', done: 1, total: 2 },
    metric: { metric: { name: 'files', value: 3 } },
    finding: { finding: fixture('success').snapshot.findings[0] },
    receipt: { finding: 'pair-001', receipt: { kind: 'commit', value: 'abc1234' } },
    log: { level: 'info', text: 'hello' },
    warning: { message: 'careful' },
    'cut-end': { cut: 'read-history', status: 'ok' },
    'scene-end': { scene: 's' },
    'run-end': { status: 'completed' },
    snapshot: { snapshot: { ...fixture('empty').snapshot, runId: f.runId } },
  }[type];
  return { ...f.next(type, base), ...extra };
}

describe('contract v1: fixtures', () => {
  it('ships every gallery fixture plus the converted PR #2 fixture', () => {
    assert.deepEqual([...FIXTURE_NAMES], ['success', 'failed', 'canceled', 'empty', 'one-finding', 'forty-findings', 'repo-archaeology']);
  });

  for (const f of fixtures()) {
    it(`${f.name}: every event validates alone, in stream order, and against the JSON Schema`, () => {
      const stream = createStreamValidator();
      for (const ev of f.events) {
        const alone = validateEvent(ev);
        assert.ok(alone.ok, `${ev.type} #${ev.seq}: ${alone.ok ? '' : describeIssues(alone.issues)}`);
        const inStream = stream.push(ev);
        assert.ok(inStream.ok, `${ev.type} #${ev.seq} in stream: ${inStream.ok ? '' : describeIssues(inStream.issues)}`);
        assert.deepEqual(schemaErrors(schema, ev), [], `${ev.type} #${ev.seq} against events.schema.json`);
      }
      assert.equal(stream.ended, true);
      assert.deepEqual(stream.finish(), [], 'the stream is complete');
      const snap = validateSnapshot(f.snapshot);
      assert.ok(snap.ok, snap.ok ? '' : describeIssues(snap.issues));
      assert.deepEqual(schemaErrors({ $ref: '#/$defs/Snapshot', $defs: schema.$defs }, f.snapshot, { $defs: schema.$defs }), []);
      assert.equal(f.events.at(-1).type, 'snapshot');
      assert.deepEqual(f.events.at(-1).snapshot, f.snapshot);
    });
  }

  it('is deterministic: building a fixture twice gives byte-identical NDJSON', () => {
    for (const name of FIXTURE_NAMES) assert.equal(JSON.stringify(fixture(name)), JSON.stringify(fixture(name)));
  });
});

describe('contract v1: event rules', () => {
  it('requires schemaVersion 1 and rejects PR #2 "0-experimental" events without a shim', () => {
    const r = validateEvent({ ...eventOf('run-start'), schemaVersion: '0-experimental' });
    assert.equal(r.ok, false);
    assert.equal(r.issues[0].code, 'unsupported-schema-version');
    assert.equal(r.ignorable, false);
    assert.equal(SCHEMA_VERSION, 1);
  });

  it('ignores unknown event types with a warning (forward compatibility)', () => {
    const r = validateEvent({ ...eventOf('log'), type: 'cut-teleport' });
    assert.equal(r.ok, false);
    assert.equal(r.ignorable, true);
    assert.equal(r.issues[0].code, 'unknown-event-type');
    assert.equal(r.issues[0].severity, 'warning');
  });

  it('preserves unknown fields on valid events and snapshots', () => {
    const ev = eventOf('metric', { vendorExtension: { deep: [1, 2] } });
    const r = validateEvent(ev);
    assert.ok(r.ok);
    assert.deepEqual(r.value.vendorExtension, { deep: [1, 2] });
    const snap = { ...fixture('success').snapshot, x: 1 };
    const s = validateSnapshot(snap);
    assert.ok(s.ok);
    assert.equal(s.value.x, 1);
  });

  it('rejects presentation labels as domain ids (C-01, F-01, E-01)', () => {
    for (const bad of ['C-01', 'c-7', 'F-01', 'E-12']) {
      const r = validateEvent(eventOf('cut-start', { cut: bad }));
      assert.equal(r.ok, false, bad);
      assert.equal(r.issues[0].code, 'presentation-label-id');
    }
    const f = clone(fixture('one-finding').snapshot);
    f.findings[0].id = 'F-01';
    assert.equal(validateSnapshot(f).ok, false);
  });

  it('enforces the 8 KiB event cap and the 1 MiB snapshot cap, both configurable', () => {
    const big = eventOf('log', { text: 'x'.repeat(DEFAULT_MAX_EVENT_BYTES) });
    const r = validateEvent(big);
    assert.equal(r.ok, false);
    assert.equal(r.issues[0].code, 'too-large');
    assert.ok(validateEvent(big, { maxEventBytes: 64 * 1024 }).ok);
    // Multi-byte text is measured in UTF-8 bytes, not characters.
    assert.equal(validateEvent(eventOf('log', { text: '漢'.repeat(3000) })).ok, false);

    const snap = clone(fixture('empty').snapshot);
    snap.warnings = ['w'.repeat(DEFAULT_MAX_SNAPSHOT_BYTES)];
    assert.equal(validateSnapshot(snap).ok, false);
    assert.ok(validateSnapshot(snap, { maxSnapshotBytes: 2 * DEFAULT_MAX_SNAPSHOT_BYTES }).ok);
    // A snapshot event is held to the snapshot cap, not the event cap.
    const forty = fixture('forty-findings');
    const snapEvent = forty.events.at(-1);
    assert.equal(snapEvent.type, 'snapshot');
    assert.ok(JSON.stringify(snapEvent).length > DEFAULT_MAX_EVENT_BYTES);
    assert.ok(validateEvent(snapEvent).ok);
  });

  it('checks every enum against the exported constants', () => {
    const cases = [
      ['cut-end', 'status', CUT_STATUSES],
      ['run-end', 'status', RUN_STATUSES],
      ['log', 'level', LOG_LEVELS],
    ];
    for (const [type, key, values] of cases) {
      for (const v of values) assert.ok(validateEvent(eventOf(type, { [key]: v })).ok, `${type}.${key}=${v}`);
      assert.equal(validateEvent(eventOf(type, { [key]: 'nope' })).ok, false);
    }
    const base = fixture('one-finding').snapshot.findings[0];
    for (const p of PROMINENCES) assert.ok(validateEvent(eventOf('finding', { finding: { ...base, prominence: p } })).ok);
    for (const s of FINDING_STATUSES) assert.ok(validateEvent(eventOf('finding', { finding: { ...base, status: s } })).ok);
    for (const k of RECEIPT_KINDS) assert.ok(validateEvent(eventOf('receipt', { receipt: { kind: k, value: 'v' } })).ok);
  });

  it('rejects malformed findings: missing fields, out-of-range strength, inverted ranges, NaN', () => {
    const base = fixture('one-finding').snapshot.findings[0];
    const bad = [
      { ...base, title: '' },
      { ...base, subject: 'src/a.ts' },
      { ...base, subject: [{ kind: 'file' }] },
      { ...base, strength: { value: 1.2, label: 'x' } },
      { ...base, strength: { value: 0.5, low: 0.6, label: 'x' } },
      { ...base, strength: { value: 0.5, high: 0.4, label: 'x' } },
      { ...base, strength: { value: Number.NaN, label: 'x' } },
      { ...base, strength: { value: 0.5 } },
      { ...base, receipts: [{ kind: 'commit' }] },
      { ...base, receipts: [{ kind: 'gist', value: 'x' }] },
      { ...base, receipts: [{ kind: 'commit', value: 'x', at: 'yesterday' }] },
    ];
    for (const f of bad) assert.equal(validateEvent(eventOf('finding', { finding: f })).ok, false, JSON.stringify(f).slice(0, 120));
  });

  it('rejects bad common fields: seq, ts, id, runId', () => {
    for (const extra of [{ seq: 0 }, { seq: 1.5 }, { seq: '1' }, { ts: '2026-11-10' }, { ts: 'not a date' }, { ts: '2026-11-10T09:00:00' }, { id: '' }, { id: 'has space' }, { runId: undefined }]) {
      assert.equal(validateEvent(eventOf('warning', extra)).ok, false, JSON.stringify(extra));
    }
  });

  it('never throws on hostile input and returns typed issues', () => {
    const cyclic = eventOf('log');
    cyclic.self = cyclic;
    const getter = eventOf('log');
    Object.defineProperty(getter, 'text', { enumerable: true, get() { throw new Error('boom'); } });
    const proxy = new Proxy({}, { get() { throw new Error('trap'); }, has() { throw new Error('trap'); }, ownKeys() { throw new Error('trap'); } });
    const inputs = [undefined, null, 0, 'run-start', [], [eventOf('log')], cyclic, getter, proxy, { ...eventOf('metric'), metric: { name: 'n', value: 10n } }, Object.create(null), new Date()];
    for (const input of inputs) {
      let r;
      assert.doesNotThrow(() => { r = validateEvent(input); });
      assert.equal(r.ok, false);
      assert.ok(r.issues.length > 0 && r.issues.every((i) => VALIDATION_CODES.includes(i.code) && typeof i.message === 'string'));
      assert.doesNotThrow(() => validateSnapshot(input));
    }
  });
});

describe('contract v1: review regressions (PR #31)', () => {
  it('rejects __proto__, constructor and prototype keys at any depth (validation bypass)', () => {
    const base = JSON.stringify(eventOf('cut-progress'));
    for (const key of ['__proto__', 'constructor', 'prototype']) {
      const top = JSON.parse(base.replace('{', `{"${key}":{"done":"NaNstr","total":-5},`));
      const r = validateEvent(top);
      assert.equal(r.ok, false, key);
      assert.equal(r.issues[0].code, 'forbidden-key');
    }
    const deep = clone(fixture('one-finding').snapshot);
    const nested = JSON.parse(JSON.stringify(deep).replace('"kind":"file"', '"kind":"file","__proto__":{"href":"javascript:x"}'));
    assert.equal(validateSnapshot(nested).issues[0].code, 'forbidden-key');
  });

  it("rejects a snapshot event whose snapshot belongs to another run", () => {
    const r = validateEvent(eventOf('snapshot', { snapshot: { ...fixture('empty').snapshot, runId: 'someone-else' } }));
    assert.equal(r.ok, false);
    assert.equal(r.issues[0].code, 'run-id-mismatch');
    assert.equal(r.issues[0].path, 'snapshot.runId');
  });

  it('uses the same timestamp rule in the JSON Schema as in validateEvent', () => {
    for (const ts of ['2026-11-10T09:00:00Z', '2026-11-10T09:00:00.123+02:00', '2026-11-10T09:00Z', '2026-11-10T09:00:00', '2026-11-10 09:00:00Z', '2026-11-10', 'yesterday']) {
      const ev = eventOf('log', { ts });
      assert.equal(schemaErrors(schema, ev).length === 0, validateEvent(ev).ok, ts);
    }
  });
});

describe('contract v1: stream rules', () => {
  it('requires strictly increasing seq, one runId and unique ids; rejected events do not advance the stream', () => {
    const f = createEventFactory();
    const a = f.next('run-start', { title: 'T' });
    const b = f.next('cut-start', { cut: 'x', title: 'X' });
    const v = createStreamValidator();
    assert.ok(v.push(a).ok);
    assert.equal(v.push(a).ok, false); // same seq again
    assert.equal(v.push({ ...b, seq: a.seq }).issues[0].code, 'seq-not-increasing');
    assert.equal(v.push({ ...b, runId: 'other' }).issues[0].code, 'run-id-mismatch');
    assert.equal(v.push({ ...b, id: a.id }).issues[0].code, 'duplicate-id');
    assert.ok(v.push(b).ok, 'the valid event is still accepted after rejected ones');
    assert.equal(v.runId, a.runId);
  });

  it('allows gaps in seq (a producer may drop events) but never repeats', () => {
    const f = createEventFactory();
    const v = createStreamValidator();
    assert.ok(v.push(f.next('run-start', { title: 'T' })).ok);
    f.next('log', { level: 'debug', text: 'dropped' });
    assert.ok(v.push(f.next('log', { level: 'info', text: 'kept' })).ok);
  });

  it('keeps cut-progress.done monotonic per cut', () => {
    const f = createEventFactory();
    const v = createStreamValidator({ lifecycle: false });
    assert.ok(v.push(f.next('cut-progress', { cut: 'a', done: 5, total: 10 })).ok);
    assert.ok(v.push(f.next('cut-progress', { cut: 'b', done: 1 })).ok, 'other cuts are independent');
    assert.ok(v.push(f.next('cut-progress', { cut: 'a', note: 'no count' })).ok);
    assert.equal(v.push(f.next('cut-progress', { cut: 'a', done: 4 })).issues[0].code, 'progress-regressed');
    assert.ok(v.push(f.next('cut-progress', { cut: 'a', done: 5 })).ok, 'equal is not a regression');
  });

  it('accepts only a snapshot after run-end', () => {
    const f = createEventFactory();
    const v = createStreamValidator({ lifecycle: false });
    v.push(f.next('run-end', { status: 'completed' }));
    assert.equal(v.push(f.next('log', { level: 'info', text: 'late' })).issues[0].code, 'after-run-end');
    assert.ok(v.push(f.next('snapshot', { snapshot: { ...fixture('empty').snapshot, runId: f.runId } })).ok);
  });

  it('enforces the run lifecycle (ported from PR #2): run-start first, cuts started before they end, all ended before run-end', () => {
    const f = createEventFactory();
    const v = createStreamValidator();
    assert.equal(v.push(f.next('cut-start', { cut: 'a', title: 'A' })).issues[0].code, 'missing-run-start');
    assert.ok(v.push(f.next('run-start', { title: 'T' })).ok);
    assert.equal(v.push(f.next('run-start', { title: 'again' })).issues[0].code, 'missing-run-start');
    assert.equal(v.push(f.next('cut-end', { cut: 'a', status: 'ok' })).issues[0].code, 'cut-not-started');
    assert.equal(v.push(f.next('cut-progress', { cut: 'a', done: 1 })).issues[0].code, 'cut-not-started');
    assert.ok(v.push(f.next('cut-start', { cut: 'a', title: 'A' })).ok);
    assert.equal(v.push(f.next('cut-start', { cut: 'a', title: 'A' })).issues[0].code, 'cut-already-started');
    assert.equal(v.push(f.next('receipt', { finding: 'nope', receipt: { kind: 'log', value: 'x' } })).issues[0].code, 'unknown-finding');
    assert.equal(v.push(f.next('run-end', { status: 'completed' })).issues[0].code, 'cut-not-ended');
    assert.deepEqual(v.finish().map((i) => i.code), ['missing-run-end', 'cut-not-ended'], 'an incomplete stream is reported');
    assert.ok(v.push(f.next('cut-end', { cut: 'a', status: 'canceled' })).ok);
    assert.equal(v.push(f.next('cut-end', { cut: 'a', status: 'ok' })).issues[0].code, 'cut-not-started', 'a cut ends once');
    assert.ok(v.push(f.next('run-end', { status: 'canceled' })).ok);
    assert.deepEqual(v.finish(), []);
  });

  it('can read a partial stream (the tail of a log) with lifecycle: false', () => {
    const tail = fixture('success').events.slice(10);
    const v = createStreamValidator({ lifecycle: false });
    for (const ev of tail) assert.ok(v.push(ev).ok, ev.type);
    assert.equal(createStreamValidator().push(tail[0]).ok, false);
  });

  it('bounds id memory', () => {
    const f = createEventFactory();
    const v = createStreamValidator({ idMemory: 2, lifecycle: false });
    const first = f.next('log', { level: 'info', text: '1' });
    v.push(first);
    v.push(f.next('log', { level: 'info', text: '2' }));
    v.push(f.next('log', { level: 'info', text: '3' }));
    assert.ok(v.push({ ...f.next('log', { level: 'info', text: '4' }), id: first.id }).ok, 'forgotten ids may recur');
  });
});

describe('contract v1: JSON Schema stays in sync with the TypeScript contract', () => {
  it('lists exactly the event types, in order', () => {
    assert.deepEqual(schema.oneOf.map((r) => r.$ref.replace('#/$defs/Event_', '')), [...EVENT_TYPES]);
    for (const t of EVENT_TYPES) assert.deepEqual(schema.$defs[`Event_${t}`].properties.type, { const: t });
  });

  it('uses the exported enums', () => {
    assert.deepEqual(schema.$defs['Event_cut-end'].properties.status.enum, [...CUT_STATUSES]);
    assert.deepEqual(schema.$defs['Event_run-end'].properties.status.enum, [...RUN_STATUSES]);
    assert.deepEqual(schema.$defs.Finding.properties.prominence.enum, [...PROMINENCES]);
    assert.deepEqual(schema.$defs.Finding.properties.status.enum, [...FINDING_STATUSES]);
    assert.deepEqual(schema.$defs.ReceiptRef.properties.kind.enum, [...RECEIPT_KINDS]);
    assert.deepEqual(schema.$defs.Event_log.properties.level.enum, [...LOG_LEVELS]);
  });

  it('agrees with validateEvent on single-field mutations of every fixture event', () => {
    const mutations = [
      (e) => ({ ...e, schemaVersion: 2 }),
      (e) => ({ ...e, seq: -1 }),
      (e) => ({ ...e, id: 'C-01' }),
      (e) => ({ ...e, runId: '' }),
      (e) => { const { ts, ...rest } = e; return rest; },
      (e) => (e.type === 'cut-end' ? { ...e, status: 'done' } : e.type === 'log' ? { ...e, level: 'trace' } : { ...e, type: 'nope' }),
    ];
    let compared = 0;
    for (const ev of fixture('success').events.concat(fixture('failed').events)) {
      for (const m of mutations) {
        const mutated = m(clone(ev));
        const ts = validateEvent(mutated);
        const js = schemaErrors(schema, mutated);
        assert.equal(ts.ok, js.length === 0, `${ev.type}: TS ${ts.ok} vs schema ${js.join('; ')}`);
        compared++;
      }
    }
    assert.ok(compared > 100);
  });
});
