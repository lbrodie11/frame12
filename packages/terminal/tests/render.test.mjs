import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { detectCapabilities, stringWidth, stripAnsi } from '@frame12/terminal';
import { createLinearWriter, orderFindings, renderJson, renderPlain, renderRich, shortValue, wrapCommand, MAX_CARD_RECEIPTS } from '@frame12/terminal/render';
import { createEventFactory, fakeStreams, fixture, FIXTURE_NAMES } from '@frame12/terminal/testing';

const rcAt = (columns, style = 'truecolor') => ({ style, unicode: true, ambiguousWide: false, links: false, columns });

/** Every fact a reader needs from a snapshot, as strings that must appear in the output. */
function facts(snap, { allReceipts }) {
  const out = [snap.status, String(snap.findings.length)];
  for (const f of snap.findings) {
    out.push(f.id);
    for (const s of f.subject) out.push(s.label);
    if (f.strength) {
      out.push(`${Math.round(f.strength.value * 100)}%`);
      if (f.strength.low !== undefined) out.push(String(Math.round(f.strength.low * 100)));
      if (f.strength.high !== undefined) out.push(`${Math.round(f.strength.high * 100)}%`);
    }
    // Plain lists every receipt. Rich lists up to 3 per card with "+N more", and secondary findings
    // (compact rows) carry the count; the live inspector (PR 3) expands them in place.
    const receipts = f.receipts ?? [];
    if (allReceipts) for (const r of receipts) out.push(r.value);
    else if (f.prominence === 'secondary') out.push(`${receipts.length} receipt`);
    else {
      for (const r of receipts.slice(0, MAX_CARD_RECEIPTS)) out.push(shortValue(r));
      if (receipts.length > MAX_CARD_RECEIPTS) out.push(`+${receipts.length - MAX_CARD_RECEIPTS} more`);
    }
  }
  for (const m of snap.metrics) out.push(String(m.value));
  for (const w of snap.warnings) out.push(w);
  if (snap.error) out.push(snap.error);
  return out;
}

describe('data integrity (non-negotiable)', () => {
  for (const name of FIXTURE_NAMES) {
    it(`${name}: every id, path and number reaches plain and rich; json round-trips byte-identical`, () => {
      const snap = fixture(name).snapshot;
      const plain = renderPlain(snap);
      for (const f of facts(snap, { allReceipts: true })) assert.ok(plain.includes(f), `plain is missing ${JSON.stringify(f)}`);
      for (const c of snap.cuts) assert.ok(plain.includes(c.cut), `plain is missing cut ${c.cut}`);
      // Non-verbose renders middle-truncate what cannot fit; verbose prints every full path and value
      // on its own line, so integrity is checked in verbose at every width and non-verbose where paths fit.
      for (const columns of [40, 80, 120]) {
        for (const verbose of [true, false]) {
          if (!verbose && (columns < 80 || name === 'long-values')) continue;
          const flat = stripAnsi(renderRich(snap, { ...rcAt(columns), verbose })).replace(/\n\s*/g, ' ');
          for (const f of facts(snap, { allReceipts: false })) assert.ok(flat.includes(f), `rich@${columns}${verbose ? ' verbose' : ''} is missing ${JSON.stringify(f)}`);
        }
      }
      const json = renderJson(snap);
      assert.deepEqual(JSON.parse(json), snap);
      assert.equal(renderJson(JSON.parse(json)), json);
    });
  }

  it('shows hidden receipts as a count, numbered so the live inspector can reuse the labels', () => {
    const ordered = orderFindings(fixture('success').snapshot.findings);
    assert.deepEqual(ordered.map((o) => [o.frame, o.firstReceipt]), [['F-01', 1], ['F-02', 7], ['F-03', 10]]);
  });

  it('json escapes characters a terminal could act on, without changing the data', () => {
    const [rlo, nel, ls] = [0x202e, 0x85, 0x2028].map((c) => String.fromCharCode(c));
    const snap = { ...fixture('empty').snapshot, title: `a${rlo}b${nel}c${ls}d` };
    const json = renderJson(snap);
    for (const ch of [rlo, nel, ls]) assert.ok(!json.includes(ch));
    assert.deepEqual(JSON.parse(json), snap);
  });
});

describe('review regressions (PR #33)', () => {
  it('a missing relation is never turned into a claim (rich and plain)', () => {
    const snap = fixture('long-values').snapshot;
    assert.equal(snap.findings[0].relation, undefined);
    const plain = renderPlain(snap);
    assert.ok(!/no code link|references subject 2|relation \(/.test(plain), 'plain states no relation');
    const rich = stripAnsi(renderRich(snap, rcAt(120)));
    assert.ok(!/no code link|references it directly|connected through/.test(rich), 'rich draws no typed connector');
  });

  it('sanitizes the product name in every renderer', () => {
    const product = 'Acme\u001b]52;c;ZXZpbA==\u0007\u001b[2J';
    const snap = fixture('empty').snapshot;
    assert.ok(!renderPlain(snap, { product }).includes('\u001b'));
    assert.ok(stripAnsi(renderRich(snap, rcAt(80), { product })).startsWith('FRAME/12'.replace('FRAME/12', 'Acme')));
    for (const out of [renderRich(snap, rcAt(80), { product })]) assert.ok(!/\u001b\](?!8;)|\u001b\[2J|\u0007/.test(out));
  });

  it('wraps next-step commands with shell continuations, never truncating them', () => {
    const command = 'frame12-term render --from run.f12rec --replay --verbose --format rich --token-file /very/long/path/to/a/credentials-file-that-is-longer-than-a-narrow-terminal.json';
    for (const columns of [20, 24, 40, 80]) {
      const lines = wrapCommand(command, columns - 2, rcAt(columns));
      for (const l of lines) assert.ok(stringWidth(l) <= columns - 2, `${columns}: ${l}`);
      // Rejoin the way a POSIX shell reads it: " \\\n" between words, "\\\n" inside a word.
      assert.equal(lines.join('\n').replace(/ \\\n/g, ' ').replace(/\\\n/g, ''), command, `${columns}: the command survives copy-paste`);
    }
    // Plain's own text is ASCII: a next step long enough to be capped gets the ASCII marker.
    const plain = renderPlain(fixture('success').snapshot, { nextSteps: [{ command, description: 'x'.repeat(2100) }] });
    assert.ok(plain.includes(command));
    const step = plain.split('\n').find((l) => l.startsWith('Next step'));
    assert.match(step, /\.\.\.\+\d+ chars/);
    assert.match(step, /^[\x20-\x7e]+$/, 'plain next steps are ASCII');
  });

  it('results reuse narration cut labels when cuts run in parallel', () => {
    const f = createEventFactory({ runId: 'par' });
    const snap = { ...fixture('failed').snapshot, runId: 'par', cuts: [
      { cut: 'lint', title: 'Lint', status: 'error', durationMs: 900 },
      { cut: 'build', title: 'Build', status: 'ok', durationMs: 1200 },
    ] };
    const events = [
      f.next('run-start', { title: 'T' }),
      f.next('cut-start', { cut: 'build', title: 'Build' }),
      f.next('cut-start', { cut: 'lint', title: 'Lint' }),
      f.next('cut-end', { cut: 'lint', status: 'error', durationMs: 900 }),
      f.next('cut-end', { cut: 'build', status: 'ok', durationMs: 1200 }),
      f.next('run-end', { status: 'failed' }),
      f.next('snapshot', { snapshot: snap }),
    ];
    for (const format of ['rich', 'plain']) {
      const caps = detectCapabilities({}, fakeStreams({ tty: false }), [], { platform: 'linux' });
      let out = '';
      let err = '';
      const w = createLinearWriter({ format, caps, stdout: { write: (s) => void (out += s) }, stderr: { write: (s) => void (err += s) } });
      for (const ev of events) w.write(ev);
      w.end();
      assert.match(err, /C-02 . LINT|Cut C-02 lint/, `${format}: narration calls lint C-02 (it started second)`);
      assert.match(out, /C-02 . LINT|Cut C-02 lint/, `${format}: results call lint C-02 too, though the snapshot lists it first`);
      assert.match(out, /Cut C-01 build|^(?![\s\S]*C-01 . LINT)/, `${format}: build keeps C-01`);
    }
  });

  it('--json stays one valid JSON document when a producer sends two snapshots', () => {
    const evs = fixture('success').events;
    const last = evs.at(-1);
    const caps = detectCapabilities({}, fakeStreams({ tty: false }), [], { platform: 'linux' });
    let out = '';
    let err = '';
    const w = createLinearWriter({ format: 'json', caps, stdout: { write: (s) => void (out += s) }, stderr: { write: (s) => void (err += s) } });
    for (const ev of [...evs, { ...last, seq: last.seq + 1, id: `${last.id}-b` }]) w.write(ev);
    w.end();
    assert.deepEqual(JSON.parse(out), last.snapshot);
    assert.match(err, /second snapshot/);
  });
});

describe('plain renderer', () => {
  it('has no escape sequences, ASCII template text, and one self-describing fact per line', () => {
    for (const name of FIXTURE_NAMES) {
      const out = renderPlain(fixture(name).snapshot);
      assert.ok(!out.includes('\u001b'));
      for (const line of out.trimEnd().split('\n')) assert.match(line, /^(Replay|FRAME\/12 run|Run started|Cut C-\d+|Error|Findings|Finding F-\d+|Receipt E-\d+|Metric|Warning|Next step|End of results)\b/, line);
    }
  });

  it('is independent of terminal width (stable for diffing)', () => {
    const snap = fixture('forty-findings').snapshot;
    assert.equal(renderPlain(snap), renderPlain(snap));
  });

  it('sanitizes hostile input', () => {
    const snap = { ...fixture('empty').snapshot, title: 'x\u001b]52;c;ZXZpbA==\u0007\u001b[2Jy' };
    assert.match(renderPlain(snap), /run "xy"/);
  });
});

describe('streams: narration on stderr, results on stdout', () => {
  const run = (format, streams, events = fixture('success').events, extra = {}) => {
    const caps = detectCapabilities({ COLORTERM: 'truecolor', LANG: 'en_US.UTF-8' }, streams, [], { platform: 'linux' });
    let out = '';
    let err = '';
    const w = createLinearWriter({ format, caps, stdout: { write: (s) => void (out += s) }, stderr: { write: (s) => void (err += s) }, ...extra });
    for (const ev of events) w.write(ev);
    const result = w.end();
    return { out, err, result };
  };

  it('--json writes only the snapshot JSON to stdout', () => {
    const { out, err } = run('json', fakeStreams({ tty: false }));
    assert.deepEqual(JSON.parse(out), fixture('success').snapshot);
    assert.equal(err, '', 'nothing to narrate for a clean run');
  });

  it('rich writes cut narration to stderr and results to stdout, never the other way round', () => {
    const { out, err } = run('rich', fakeStreams({ tty: true, columns: 80 }));
    assert.match(stripAnsi(err), /C-01 · RESOLVE WORKSPACE/);
    assert.ok(!stripAnsi(out).includes('C-01 · RESOLVE'), 'clean cuts are narration, not results');
    assert.match(stripAnsi(out), /^FINDINGS/m);
    assert.doesNotMatch(stripAnsi(err), /^FINDINGS/m, 'the results section is not narration');
  });

  it('pipes get no escape sequences, and stderr is append-only (no CR, no cursor movement, no spinner)', () => {
    const { out, err } = run('rich', fakeStreams({ tty: false }), fixture('forty-findings').events);
    assert.ok(!out.includes('\u001b') && !err.includes('\u001b'));
    for (const stream of [out, err]) assert.ok(!stream.includes('\r'));
    const tty = run('rich', fakeStreams({ tty: true, columns: 80 }), fixture('forty-findings').events);
    for (const m of tty.err.matchAll(/\u001b\[[0-9;?]*([A-Za-z])/g)) assert.equal(m[1], 'm', 'only SGR styling, never cursor control');
  });

  it('cmd > out.txt: stdout keeps results unstyled while a TTY stderr keeps its styling', () => {
    const { out, err } = run('rich', { stdout: { isTTY: false }, stderr: { isTTY: true, columns: 80 } });
    assert.ok(!out.includes('\u001b'));
    assert.ok(err.includes('\u001b['));
  });

  it('plain narration is plain', () => {
    const { out, err } = run('plain', fakeStreams({ tty: true, columns: 80 }), fixture('failed').events);
    assert.ok(!out.includes('\u001b') && !err.includes('\u001b'));
    assert.match(err, /^Cut C-02 read-history "Read history": failed in 2\.4s$/m);
  });

  it('drops invalid events with a visible warning, ignores unknown types, and never invents results', () => {
    const f = createEventFactory({ runId: 'r' });
    const events = [f.next('run-start', { title: 'T' }), { ...f.next('log', { level: 'info', text: 'x' }), type: 'from-the-future' }, { schemaVersion: 1, type: 'cut-start' }, f.next('run-end', { status: 'completed' })];
    const { out, err, result } = run('rich', fakeStreams({ tty: false }), events);
    assert.equal(out, '', 'no snapshot, no results');
    assert.match(err, /ignored event 2: Unknown event type/);
    assert.match(err, /dropped event 3/);
    assert.match(err, /No result snapshot arrived/);
    assert.deepEqual([result.ignored, result.invalid, result.status, result.snapshot], [1, 1, 'completed', undefined]);
  });

  it('writes nothing with a delay: every narration line is written synchronously when its event arrives', () => {
    const caps = detectCapabilities({}, fakeStreams({ tty: false }), [], { platform: 'linux' });
    const lines = [];
    const w = createLinearWriter({ format: 'plain', caps, stdout: { write: () => {} }, stderr: { write: (s) => lines.push(s) } });
    const evs = fixture('success').events;
    let i = 0;
    for (; i < evs.length && evs[i].type !== 'cut-end'; i++) w.write(evs[i]);
    assert.equal(lines.length, 0);
    w.write(evs[i]);
    assert.equal(lines.length, 1, 'the cut line is written before write() returns');
  });
});
