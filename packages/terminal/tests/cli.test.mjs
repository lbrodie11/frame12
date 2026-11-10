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
    assert.match(r.err, /dropped line 2: .*seq/i);
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
  /** A clock the test moves: one step per event read, never by itself. */
  const steppingScheduler = () => {
    let now = 0;
    return {
      scheduler: { now: () => now, setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: (h) => clearTimeout(h) },
      step: () => (now += 25),
    };
  };
  const record = async (file) => {
    const { scheduler, step } = steppingScheduler();
    const lines = fixture('success').events.map((e) => JSON.stringify(e));
    const stdin = Object.assign(Readable.from((function* () { for (const l of lines) { step(); yield Buffer.from(`${l}\n`); } })()), { isTTY: false });
    const stdout = sink();
    const stderr = sink();
    const code = await main(['render', '--plain', '--record', file], { stdin, stdout, stderr, env: {}, handleSignals: false, scheduler });
    return { code, out: stdout.text() };
  };

  it('--record writes a deterministic .f12rec: byte-identical across runs with the same clock', async () => {
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
    assert.ok(ts.at(-1) > 0);
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
    assert.ok(waits.length > 0 && waits.every((w) => w === 25 / 4), JSON.stringify(waits));
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
