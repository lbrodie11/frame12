import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable, Writable } from 'node:stream';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createDirector, isRecordingHeader, parseRecordingEntry, stripAnsi, validateEvent } from '@frame12/terminal';
import { fixture, toNdjson } from '@frame12/terminal/testing';
import { MAX_LINE_BYTES, main } from '../dist/cli/main.js';

const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN = path.join(PKG, 'dist/cli/bin.js');

function sink() {
  let text = '';
  const w = new Writable({
    write(chunk, _enc, cb) {
      text += String(chunk);
      cb();
    },
  });
  return Object.assign(w, { text: () => text });
}

/** Runs the CLI in-process on `input` (a string or lines); returns its code and output. */
async function cli(argv, input = '', extra = {}) {
  const stdout = sink();
  const stderr = sink();
  const lines = Array.isArray(input) ? input.map((l) => `${l}\n`).join('') : input;
  const stdin = Object.assign(Readable.from([Buffer.from(lines)]), { isTTY: false });
  const code = await main(argv, { stdin, stdout, stderr, env: { TERM: 'xterm-256color' }, handleSignals: false, ...extra });
  return { code, out: stdout.text(), err: stderr.text() };
}

const ndjson = (name) => toNdjson(fixture(name).events);
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'f12-cli-'));

describe('frame12-term render: formats and exit codes', () => {
  for (const [name, code] of [['success', 0], ['failed', 1], ['canceled', 130]]) {
    it(`renders ${name} from stdin and exits ${code}; narration on stderr, results on stdout`, async () => {
      const r = await cli(['render', '--plain'], ndjson(name));
      assert.equal(r.code, code, r.err);
      assert.match(r.out, /^FRAME\/12 run "/m, 'results on stdout');
      assert.match(r.err, /^Cut C-01/m, 'narration on stderr');
      assert.doesNotMatch(r.err, /FRAME\/12 run "/, 'no results on stderr');
    });
  }

  it('--json writes exactly the snapshot as JSON to stdout', async () => {
    const r = await cli(['render', '--json'], ndjson('success'));
    assert.equal(r.code, 0);
    assert.deepEqual(JSON.parse(r.out), fixture('success').snapshot);
  });

  it('rich is the default; pipes get no escape sequences', async () => {
    const r = await cli(['render'], ndjson('success'));
    assert.equal(r.code, 0);
    assert.match(r.out, /FINDINGS\s+3 \(/);
    assert.doesNotMatch(r.out + r.err, /\u001b/);
  });

  it('stops reading once the run is over, even if the producer keeps its output open', async () => {
    const { PassThrough } = await import('node:stream');
    const stdin = Object.assign(new PassThrough(), { isTTY: false });
    stdin.write(ndjson('success')); // never ended
    const stdout = sink();
    const result = await Promise.race([
      main(['render', '--plain'], { stdin, stdout, stderr: sink(), env: {}, handleSignals: false }),
      new Promise((r) => setTimeout(() => r('still waiting'), 3000)),
    ]);
    assert.equal(result, 0);
    assert.match(stdout.text(), /completed/);
  });

  it('an input that stops early exits 1 and says the snapshot is missing', async () => {
    const r = await cli(['render', '--plain'], toNdjson(fixture('success').events.slice(0, 5)));
    assert.equal(r.code, 1);
    assert.match(r.err, /No result snapshot/);
  });
});

describe('frame12-term render: malformed input', () => {
  const events = fixture('success').events.map((e) => JSON.stringify(e));

  it('reports a line that is not JSON with its line number, skips it, and finishes the run', async () => {
    const input = [events[0], events[1], '{not json', '', ...events.slice(2)];
    const r = await cli(['render', '--plain'], input);
    assert.equal(r.code, 0, r.err);
    assert.match(r.err, /line 3: not valid JSON \(.+\) \(skipped\)/);
    assert.match(r.out, /completed/);
  });

  it('names the line of an invalid event', async () => {
    const bad = { ...JSON.parse(events[1]), seq: 1 }; // seq must increase
    const r = await cli(['render', '--plain'], [events[0], JSON.stringify(bad), ...events.slice(1)]);
    assert.match(r.err, /line 2: dropped: .*seq/i);
  });

  it(`skips a line longer than 64 KiB without buffering it, and keeps going`, async () => {
    const huge = `{"pad":"${'x'.repeat(MAX_LINE_BYTES + 10)}"}`;
    const r = await cli(['render', '--plain'], [events[0], huge, ...events.slice(1)]);
    assert.equal(r.code, 0, r.err);
    assert.match(r.err, /line 2: longer than 64 KiB \(skipped\)/);
  });

  it('a line of exactly 64 KiB is still read', async () => {
    const ev = JSON.parse(events[0]);
    const base = JSON.stringify({ ...ev, pad: '' });
    const exact = JSON.stringify({ ...ev, pad: 'x'.repeat(MAX_LINE_BYTES - Buffer.byteLength(base)) });
    assert.equal(Buffer.byteLength(exact), MAX_LINE_BYTES);
    const r = await cli(['render', '--plain'], [exact, ...events.slice(1)]);
    assert.doesNotMatch(r.err, /longer than/);
  });

  it('--strict stops at the first malformed line with exit 2', async () => {
    const r = await cli(['render', '--plain', '--strict'], [events[0], 'oops', ...events.slice(1)]);
    assert.equal(r.code, 2);
    assert.match(r.err, /line 2: not valid JSON .*\(stopped: --strict\)/);
    assert.doesNotMatch(r.err, /C-01/, 'nothing after the failure is rendered');
  });

  it('--strict stops at the first invalid event with exit 2', async () => {
    const bad = { ...JSON.parse(events[1]), type: 'cut-end' }; // a cut that never started... and no status
    const r = await cli(['render', '--plain', '--strict'], [events[0], JSON.stringify(bad), ...events.slice(1)]);
    assert.equal(r.code, 2);
    assert.match(r.err, /line 2: .*\(stopped: --strict\)/);
  });

  it('sanitizes what it quotes from the input in diagnostics (no raw escapes reach the terminal)', async () => {
    const attack = '\u001b]52;c;ZXZpbA==\u0007\u001b[2J{oops';
    const r = await cli(['render', '--plain'], [events[0], attack, ...events.slice(1)]);
    assert.match(r.err, /line 2: not valid JSON/);
    assert.doesNotMatch(r.err, /[\u0000-\u0008\u000b-\u001f\u007f]/, 'no control characters in stderr');
    const missing = await cli(['render', '--from', `${tmp()}/\u001b[31mred.ndjson`]);
    assert.doesNotMatch(missing.err, /\u001b/);
  });

  it('accepts CRLF line endings and a last line without a newline', async () => {
    const r = await cli(['render', '--plain'], events.join('\r\n'));
    assert.equal(r.code, 0, r.err);
  });
});

describe('frame12-term render: replay', () => {
  /** Events whose timestamps are `gaps` ms apart (the fixture's own, retimed). */
  const timed = (gaps) => {
    const evs = fixture('one-finding').events;
    let t = Date.parse(evs[0].ts);
    return evs.map((e, i) => {
      if (i > 0) t += gaps[i - 1] ?? 0;
      return JSON.stringify({ ...e, ts: new Date(t).toISOString() });
    });
  };

  it('honors the original timing, ×4 by default, never waiting more than 1 s', async () => {
    const waits = [];
    const r = await cli(['render', '--plain', '--replay'], timed([2000, 8000, 400]), { sleep: async (ms) => void waits.push(ms) });
    assert.equal(r.code, 0, r.err);
    assert.deepEqual(waits, [500, 1000, 100]);
  });

  it('--speed scales the timing', async () => {
    const waits = [];
    await cli(['render', '--plain', '--replay', '--speed', '2'], timed([1000, 600]), { sleep: async (ms) => void waits.push(ms) });
    assert.deepEqual(waits, [500, 300]);
  });

  it('labels the output REPLAY in every format that has a label', async () => {
    const plain = await cli(['render', '--plain', '--replay'], ndjson('success'), { sleep: async () => {} });
    assert.match(plain.out, /^Replay: this output was recorded earlier/m);
    const rich = await cli(['render', '--replay'], ndjson('success'), { sleep: async () => {} });
    assert.match(rich.out, /^REPLAY · FRAME\/12/m);
    const json = await cli(['render', '--json', '--replay'], ndjson('success'), { sleep: async () => {} });
    assert.equal(JSON.parse(json.out).replay, true, 'the JSON snapshot says replay too');
  });

  it('does not wait without --replay', async () => {
    const waits = [];
    await cli(['render', '--plain'], timed([2000, 8000]), { sleep: async (ms) => void waits.push(ms) });
    assert.deepEqual(waits, []);
  });
});

describe('frame12-term render: recordings', () => {
  const record = async (file, input = ndjson('success'), extra = []) => {
    const r = await cli(['render', '--plain', '--record', file, ...extra], input);
    return { code: r.code, out: r.out, err: r.err };
  };
  /** The fixture's own times: ms since its first event. */
  const fixtureTimes = () => {
    const ts = fixture('success').events.map((e) => Date.parse(e.ts));
    return ts.map((t) => t - ts[0]);
  };

  it('--record writes a deterministic .f12rec: byte-identical across runs (no clock is read)', async () => {
    const dir = tmp();
    const [a, b] = [path.join(dir, 'a.f12rec'), path.join(dir, 'b.f12rec')];
    assert.equal((await record(a)).code, 0);
    assert.equal((await record(b)).code, 0);
    assert.equal(fs.readFileSync(a, 'utf8'), fs.readFileSync(b, 'utf8'));
  });

  it('a recording is a header, then every event with its time, ending with the snapshot', async () => {
    const file = path.join(tmp(), 'run.f12rec');
    await record(file);
    const lines = fs.readFileSync(file, 'utf8').trimEnd().split('\n').map((l) => JSON.parse(l));
    assert.ok(isRecordingHeader(lines[0]));
    const entries = lines.slice(1).map(parseRecordingEntry);
    assert.equal(entries.length, fixture('success').events.length);
    for (const e of entries) assert.ok(validateEvent(e.event).ok, JSON.stringify(e));
    assert.equal(entries.at(-1).event.type, 'snapshot');
    const ts = entries.map((e) => e.t);
    assert.deepEqual(ts, [...ts].sort((x, y) => x - y), 'times never go backwards');
    assert.deepEqual(ts, fixtureTimes(), 't is the events\' own timing, however fast they were read (review of #40, item 5)');
  });

  it('re-recording a replay keeps the original timing (review of #40, item 5)', async () => {
    const dir = tmp();
    const [a, b] = [path.join(dir, 'a.f12rec'), path.join(dir, 'b.f12rec')];
    await record(a);
    const r = await cli(['render', '--plain', '--replay', '--from', a, '--record', b], '', { sleep: async () => {} });
    assert.equal(r.code, 0, r.err);
    assert.equal(fs.readFileSync(b, 'utf8'), fs.readFileSync(a, 'utf8'));
  });

  it('a recording renders back to the same results, labeled REPLAY', async () => {
    const file = path.join(tmp(), 'run.f12rec');
    const original = await record(file);
    const replayed = await cli(['render', '--plain', '--from', file]);
    assert.equal(replayed.code, 0, replayed.err);
    assert.equal(replayed.out.replace(/^Replay: .*\n/, ''), original.out);
    assert.match(replayed.out, /^Replay:/);
  });

  it('--replay of a recording waits by its recorded times', async () => {
    const file = path.join(tmp(), 'run.f12rec');
    await record(file);
    const waits = [];
    await cli(['render', '--plain', '--replay', '--from', file], '', { sleep: async (ms) => void waits.push(ms) });
    const t = fixtureTimes();
    const expected = t.slice(1).map((x, i) => x - t[i]).filter((g) => g > 0).map((g) => Math.min(1000, g / 4));
    assert.deepEqual(waits, expected);
  });

  it('the Director records sanitized events and runs links through the redaction hook', () => {
    const lines = [];
    const redact = (text, { field }) => (field === 'link' ? text.replace('secret-org', 'org') : field === 'identifier' ? text.replace('/home/alice', '~') : text);
    const d = createDirector({ caps: {}, motion: 'still', safety: { redact }, record: { write: (l) => lines.push(l), end: () => lines.push('END') } });
    const evs = fixture('success').events;
    const finding = evs.find((e) => e.type === 'finding');
    for (const e of evs) {
      if (e !== finding) d.push(e);
      else d.push({ ...e, finding: { ...e.finding, subject: [{ kind: 'file', label: '/home/alice/src/a.ts', href: 'https://example.com/secret-org/repo' }] } });
    }
    assert.equal(lines.at(-1), 'END', 'ended after the snapshot');
    const text = lines.join('');
    assert.doesNotMatch(text, /secret-org|\/home\/alice/);
    assert.match(text, /https:\/\/example\.com\/org\/repo/);
  });
});

describe('frame12-term: usage', () => {
  for (const [argv, pattern] of [
    [[], /Usage: frame12-term render/],
    [['draw'], /unknown command "draw"/],
    [['render', '--nope'], /Unknown option: --nope/],
    [['render', '--format', 'html'], /--format must be one of rich, plain, json, live/],
    [['render', '--speed', '0'], /--speed must be a number greater than 0/],
    [['render', '--from'], /--from needs a value/],
  ]) {
    it(`${JSON.stringify(argv)} is a usage error (exit 2)`, async () => {
      const r = await cli(argv);
      assert.equal(r.code, 2);
      assert.match(r.err, pattern);
    });
  }

  it('--help and --version exit 0 on stdout', async () => {
    assert.match((await cli(['--help'])).out, /Exit codes:/);
    assert.match((await cli(['--version'])).out, /^\d+\.\d+\.\d+\n$/);
  });

  it('a --from file that cannot be read exits 2', async () => {
    const r = await cli(['render', '--from', path.join(tmp(), 'missing.ndjson')]);
    assert.equal(r.code, 2);
    assert.match(r.err, /cannot read .*missing\.ndjson/);
  });

  it('--format live without the optional peers says what to install', async () => {
    const r = await cli(['render', '--format', 'live'], ndjson('success'), { loadLive: async () => { throw new Error("Cannot find package 'ink'"); } });
    assert.equal(r.code, 2);
    assert.match(r.err, /needs the optional peers ink@\^8 and react@\^19\.3/);
  });

  it('--format live reading events from stdin falls back to the linear view (stdin is not the keyboard)', async () => {
    const r = await cli(['render', '--format', 'live'], ndjson('success'));
    assert.equal(r.code, 0, r.err);
    assert.match(r.out, /FINDINGS\s+3 \(/);
  });
});

describe('frame12-term: the executable', () => {
  it('runs as a process: exit code, streams, and no React or Ink loaded for linear formats', () => {
    const r = spawnSync(process.execPath, ['--import', './tests/loader/register.mjs', BIN, 'render', '--plain'], { cwd: PKG, input: ndjson('failed'), encoding: 'utf8' });
    assert.equal(r.status, 1, r.stderr);
    assert.match(r.stdout, /failed/);
    const seen = r.stderr.split('\n').filter((l) => l.startsWith('F12-RESOLVE ')).map((l) => l.slice(12));
    assert.ok(seen.length > 0, 'the loader hook observed imports');
    assert.deepEqual(seen.filter((s) => /^(react|ink)(\/|$)|child_process/.test(s)), []);
  });

  it('`| head -1` is not an error: the CLI itself exits 0 (EPIPE)', { skip: process.platform === 'win32' && 'needs bash' }, () => {
    // Bash's PIPESTATUS[0] is the CLI's own exit code, not head's.
    const r = spawnSync('bash', ['-c', `"${process.execPath}" "${BIN}" render --plain 2>/dev/null | head -1 >/dev/null; echo "\${PIPESTATUS[0]}"`], { cwd: PKG, input: ndjson('forty-findings'), encoding: 'utf8' });
    assert.equal(r.stdout.trim(), '0', r.stderr);
  });
});

describe('frame12-term: review of #40', () => {
  const ghp = ['ghp', '_', 'A'.repeat(36)].join('');

  for (const viaFrom of [false, true]) {
    it(`1. --record to a path that cannot be opened is a clear usage error (${viaFrom ? '--from' : 'stdin'})`, async () => {
      const dir = tmp();
      const input = path.join(dir, 'in.ndjson');
      fs.writeFileSync(input, ndjson('success'));
      const bad = path.join(dir, 'nodir', 'x.f12rec');
      const r = await cli(['render', '--plain', '--record', bad, ...(viaFrom ? ['--from', input] : [])], viaFrom ? '' : ndjson('success'));
      assert.equal(r.code, 2);
      assert.match(r.err, /^frame12-term: cannot write .*nodir.*x\.f12rec: /m);
      assert.doesNotMatch(r.err, /cannot read|\n\s+at /, 'blames the record path, no stack trace');
    });
  }

  it('2. --record onto the --from file is refused, and the input is untouched', async () => {
    const dir = tmp();
    const same = path.join(dir, 'same.ndjson');
    fs.writeFileSync(same, ndjson('success'));
    const r = await cli(['render', '--plain', '--from', same, '--record', path.join(dir, '.', 'same.ndjson')]);
    assert.equal(r.code, 2);
    assert.match(r.err, /is the input file/);
    assert.equal(fs.readFileSync(same, 'utf8'), ndjson('success'));
  });

  it('3. a redaction hook that throws on links drops the link; the recording is still complete', () => {
    const lines = [];
    const redact = (text, { field }) => {
      switch (field) {
        case 'log': case 'receipt': case 'text': case 'identifier': return text;
        default: throw new Error(`unexpected field ${field}`);
      }
    };
    const d = createDirector({ caps: {}, motion: 'still', safety: { redact }, record: { write: (l) => lines.push(l), end: () => lines.push('END') } });
    // Receipts with links, so the hook really sees `field: 'link'`.
    for (const e of fixture('success').events) d.push(e.type === 'receipt' ? { ...e, receipt: { ...e.receipt, href: 'https://example.com/c/1' } } : e);
    assert.ok(!lines.join('').includes('example.com'), 'the links the hook threw on were dropped');
    assert.equal(lines.at(-1), 'END');
    assert.match(lines.at(-2), /"type":"snapshot"/);
    assert.equal(lines.length, 1 + fixture('success').events.length + 1);
    assert.deepEqual(d.snapshot().warnings, []);
  });

  it('3. a sink that fails mid-run stops the recording with a warning, calls end(), and the CLI exits 1', async () => {
    let writes = 0;
    let ended = 0;
    const openRecord = (name) => ({
      name,
      write() {
        if (++writes === 5) throw new Error('ENOSPC: no space left on device');
      },
      end: () => ended++,
    });
    // A temp path even though the sink is injected: a run that ignored the injection must not litter the package.
    const target = path.join(tmp(), 'r.f12rec');
    const r = await cli(['render', '--plain', '--record', target], ndjson('success'), { openRecord: () => openRecord(target) });
    assert.equal(r.code, 1, 'the run completed, but the requested recording did not');
    assert.equal(ended, 1);
    assert.match(r.err, /Recording stopped: ENOSPC: no space left on device; .*r\.f12rec is incomplete/);
    assert.match(r.out, /completed/, 'the run itself goes on');
  });

  it('4. a token in a link is masked: never in the recording, never in an OSC 8 link', async () => {
    const { createSanitizer } = await import('@frame12/terminal');
    const href = `https://ci.example.com/run/1?access_token=${ghp}`;
    assert.doesNotMatch(String(createSanitizer().href(href)), /ghp_/);
    const events = fixture('success').events.map((e) =>
      e.type === 'receipt' ? { ...e, receipt: { ...e.receipt, href } } : e,
    );
    const file = path.join(tmp(), 'tok.f12rec');
    const r = await cli(['render', '--plain', '--record', file], toNdjson(events));
    assert.equal(r.code, 0, r.err);
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /ghp_/);
    const linked = await cli(['render', '--links', '--color'], toNdjson(events), { env: { TERM_PROGRAM: 'iTerm.app', FORCE_COLOR: '3' } });
    assert.doesNotMatch(linked.out + linked.err, /ghp_/);
  });

  it('6. a recording of another version is one clear error (exit 2), not one per line', async () => {
    for (const header of [{ f12rec: 2, schemaVersion: 1 }, { f12rec: 1, schemaVersion: 2 }]) {
      const entries = fixture('success').events.map((e, i) => JSON.stringify({ t: i, event: e }));
      const r = await cli(['render', '--plain'], [JSON.stringify(header), ...entries]);
      assert.equal(r.code, 2);
      assert.equal(r.err.trim().split('\n').length, 1, r.err);
      assert.match(r.err, /line 1: unsupported (recording version 2|event schema 2)/);
    }
  });

  it('7. a UTF-8 byte-order mark does not cost line 1', async () => {
    const r = await cli(['render', '--plain', '--strict'], `﻿${ndjson('success')}`);
    assert.equal(r.code, 0, r.err);
  });

  it('8. recording an empty input still writes a recognizable recording', async () => {
    const file = path.join(tmp(), 'empty.f12rec');
    await cli(['render', '--plain', '--record', file], '');
    assert.ok(isRecordingHeader(JSON.parse(fs.readFileSync(file, 'utf8'))));
    const replay = await cli(['render', '--plain', '--from', file]);
    assert.doesNotMatch(replay.err, /not valid|dropped/);
  });

  it('9. thousands of malformed lines give 20 warnings and one summary, not thousands', async () => {
    const garbage = Array.from({ length: 5000 }, (_, i) => `garbage ${i}`);
    const r = await cli(['render', '--plain'], [...garbage, ...fixture('success').events.map((e) => JSON.stringify(e))]);
    assert.equal(r.code, 0, r.err.slice(0, 500));
    assert.equal((r.err.match(/: not valid JSON \(/g) ?? []).length, 20);
    assert.match(r.err, /… and 4980 more problems with the input, the first at line 21 \(skipped\)/);
  });

  it('nit: --version is the package version', async () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(PKG, 'package.json'), 'utf8'));
    assert.equal((await cli(['--version'])).out.trim(), pkg.version);
  });

  it('nit: reading events from a terminal says how to end them; --speed without --replay says it does nothing', async () => {
    const stdout = sink();
    const stderr = sink();
    const stdin = Object.assign(Readable.from([Buffer.from(ndjson('success'))]), { isTTY: true });
    await main(['render', '--plain', '--speed', '2'], { stdin, stdout, stderr, env: {}, handleSignals: false });
    assert.match(stderr.text(), /reading events from the terminal \(Ctrl-D ends them\)/);
    assert.match(stderr.text(), /--speed has no effect without --replay/);
  });

  it('nit: an event stamped earlier adds no wait during --replay', async () => {
    const evs = fixture('one-finding').events;
    const base = Date.parse(evs[0].ts);
    const offsets = [0, 10_000, 5_000, 6_000];
    const lines = evs.map((e, i) => JSON.stringify({ ...e, ts: new Date(base + (offsets[i] ?? 6_000 + i)).toISOString() }));
    const waits = [];
    await cli(['render', '--plain', '--replay'], lines, { sleep: async (ms) => void waits.push(ms) });
    // 0 → 10 s: one capped wait. 5 s and 6 s are earlier than 10 s: no wait at all.
    assert.equal(waits[0], 1000);
    assert.deepEqual(waits.slice(1, 3), [], `no wait measured from the earlier stamps: ${JSON.stringify(waits)}`);
  });

  it('nit: a flag value is not read as a capability flag (--from --no-color)', async () => {
    const r = await cli(['render', '--from', '--no-color'], '', {
      env: { FORCE_COLOR: '3', TERM: 'xterm-256color' },
      open: () => Readable.from([Buffer.from(ndjson('success'))]),
    });
    assert.equal(r.code, 0, r.err);
    assert.match(r.out, /\u001b\[/, 'color stays on: "--no-color" was the file name');
  });
});

describe('frame12-term: second review of #40', () => {
  it('1. an event just under 64 KiB is recorded and read back from its own recording', async () => {
    const events = fixture('forty-findings').events;
    const last = events.at(-1);
    // Grow the snapshot with many small receipts (the sanitizer keeps them; it would shorten one
    // long text field) until its line is just under the limit.
    const withReceipts = (n) => {
      const findings = structuredClone(last.snapshot.findings);
      findings[0].receipts = [...(findings[0].receipts ?? []), ...Array.from({ length: n }, (_, i) => ({ kind: 'commit', value: `c${String(i).padStart(7, '0')}` }))];
      return { ...last, snapshot: { ...last.snapshot, findings } };
    };
    let n = 0;
    while (Buffer.byteLength(JSON.stringify(withReceipts(n + 50))) <= MAX_LINE_BYTES) n += 50;
    while (Buffer.byteLength(JSON.stringify(withReceipts(n + 1))) <= MAX_LINE_BYTES) n += 1;
    const big = withReceipts(n);
    // Fill the last few bytes exactly: the line is 2 bytes under the limit, the recorded entry over it.
    const r = big.snapshot.findings[0].receipts.at(-1);
    r.value += 'x'.repeat(MAX_LINE_BYTES - 2 - Buffer.byteLength(JSON.stringify(big)));
    assert.equal(Buffer.byteLength(JSON.stringify(big)), MAX_LINE_BYTES - 2);
    const input = toNdjson([...events.slice(0, -1), big]);
    const file = path.join(tmp(), 'big.f12rec');
    const live = await cli(['render', '--plain', '--record', file], input);
    assert.equal(live.code, 0, live.err);
    const back = await cli(['render', '--plain', '--from', file]);
    assert.equal(back.code, 0, back.err);
    assert.doesNotMatch(back.err, /longer than|No result snapshot/);
    assert.equal(back.out.replace(/^Replay: .*\n/, ''), live.out);
  });

  it('1. a completed run whose snapshot never arrived exits 1', async () => {
    const r = await cli(['render', '--plain'], toNdjson(fixture('success').events.slice(0, -1)));
    assert.equal(r.code, 1);
    assert.match(r.err, /No result snapshot/);
  });

  it('2. under --strict, lines after the snapshot are not read: the completed run exits 0', async () => {
    for (const trailer of ['garbage', '{"type":"log"}']) {
      const r = await cli(['render', '--strict', '--plain'], `${ndjson('success')}${trailer}\n`);
      assert.equal(r.code, 0, `${trailer}: ${r.err}`);
    }
  });

  for (const [name, argv] of [
    ['a --from file that does not exist', (dir) => ['--from', path.join(dir, 'missing.ndjson')]],
    ['an unsupported recording', (dir) => (fs.writeFileSync(path.join(dir, 'v9.f12rec'), '{"f12rec":9}\n'), ['--from', path.join(dir, 'v9.f12rec')])],
  ]) {
    it(`3. an early exit (${name}) leaves an existing recording untouched`, async () => {
      const dir = tmp();
      const keep = path.join(dir, 'keep.f12rec');
      fs.writeFileSync(keep, 'precious\n');
      const r = await cli(['render', '--plain', '--record', keep, ...argv(dir)]);
      assert.equal(r.code, 2);
      assert.equal(fs.readFileSync(keep, 'utf8'), 'precious\n');
      assert.deepEqual(fs.readdirSync(dir).filter((f) => f.endsWith('.tmp')), [], 'no temporary file left behind');
    });
  }

  it('4. --record onto the input is refused when it is the same file under another name (hard link)', async () => {
    const dir = tmp();
    const a = path.join(dir, 'a.ndjson');
    fs.writeFileSync(a, ndjson('success'));
    fs.linkSync(a, path.join(dir, 'b.ndjson'));
    const r = await cli(['render', '--plain', '--from', a, '--record', path.join(dir, 'b.ndjson')]);
    assert.equal(r.code, 2);
    assert.match(r.err, /is the input file/);
    assert.equal(fs.readFileSync(a, 'utf8'), ndjson('success'));
  });

  it('4. --record onto the file redirected to stdin is refused', () => {
    const dir = tmp();
    const input = path.join(dir, 'in.ndjson');
    fs.writeFileSync(input, ndjson('success'));
    const fd = fs.openSync(input, 'r');
    try {
      const r = spawnSync(process.execPath, [BIN, 'render', '--plain', '--record', input], { stdio: [fd, 'pipe', 'pipe'], encoding: 'utf8' });
      assert.equal(r.status, 2, r.stderr);
      assert.match(r.stderr, /is the input file/);
    } finally {
      fs.closeSync(fd);
    }
    assert.equal(fs.readFileSync(input, 'utf8'), ndjson('success'));
  });

  it('5. an unsupported recording header is sanitized before it is printed', async () => {
    const r = await cli(['render', '--plain'], [JSON.stringify({ f12rec: `\u009b2J‮evil${'x'.repeat(5000)}` })]);
    assert.equal(r.code, 2);
    assert.doesNotMatch(r.err, /[\u0080-\u009f‮]/);
    assert.ok(r.err.length < 600, `capped: ${r.err.length} chars`);
  });

  it('7. thousands of invalid events give 20 warnings and one count, like malformed lines', async () => {
    const evs = fixture('success').events;
    const junk = Array.from({ length: 5000 }, () => '{"type":"nope"}');
    const r = await cli(['render', '--plain'], [JSON.stringify(evs[0]), ...junk, ...evs.slice(1).map((e) => JSON.stringify(e))]);
    assert.equal(r.code, 0, r.err.slice(0, 400));
    assert.equal((r.err.match(/^Log warn: line \d+:/gm) ?? []).length, 20);
    assert.match(r.err, /… and 4980 more problems with the input, the first at line 22 \(skipped\)/);
  });

  it('8. only line 1 can be a recording header', async () => {
    const file = path.join(tmp(), 'run.f12rec');
    await cli(['render', '--plain', '--record', file], ndjson('success'));
    const r = await cli(['render', '--plain'], `garbage\n${fs.readFileSync(file, 'utf8')}`);
    assert.doesNotMatch(r.out, /FINDINGS|run "/, 'not rendered as a run without its REPLAY label');
  });

  it('9. paths in errors are not shortened', async () => {
    const long = path.join(tmp(), `${'d'.repeat(150)}.ndjson`);
    const r = await cli(['render', '--from', long]);
    assert.ok(r.err.includes(long), r.err);
  });
});
