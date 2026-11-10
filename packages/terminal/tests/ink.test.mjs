import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as React from 'react';
import { render } from 'ink-testing-library';
import { createDirector, stripAnsi } from '@frame12/terminal';
import { Storyboard, exitCodeFor, linearReason } from '@frame12/terminal/ink';
import { fixture } from '@frame12/terminal/testing';

const rc = { style: 'none', unicode: true, ambiguousWide: false, links: false, columns: 80 };
const tick = () => new Promise((r) => setTimeout(r, 30));

function mount(name = 'success', { upTo, rows = 30, onQuit = () => {}, onInterrupt = () => {}, onOpen = () => {} } = {}) {
  const director = createDirector({ caps: { interactive: true }, motion: 'still' });
  const events = fixture(name).events;
  for (const ev of upTo === undefined ? events : events.slice(0, upTo)) director.push(ev);
  director.flush();
  const app = render(React.createElement(Storyboard, { director, rc, rows, onQuit, onInterrupt, onOpen }));
  const all = () => stripAnsi(app.frames.join('\n'));
  return { app, director, all, last: () => stripAnsi(app.lastFrame() ?? '') };
}

describe('ink: the live view draws the PR 2 grammar', () => {
  it('writes completed cuts once (Static) and lists findings with the focus on the first', async () => {
    const { app, last } = mount('success');
    await tick();
    assert.match(last(), /FINDINGS 3/);
    assert.match(last(), /› F-01/);
    app.stdin.write('j'); // force another frame: Static items must not be written again
    await tick();
    for (const c of ['C-01 · RESOLVE WORKSPACE', 'C-02 · READ HISTORY', 'C-04 · RANK FINDINGS']) {
      assert.equal(last().split(c).length - 1, 1, `${c} is written exactly once`);
    }
    app.unmount();
  });

  it('writes the masthead and each completed cut once when events arrive after mount (fourth review)', async () => {
    const director = createDirector({ caps: { interactive: true }, motion: 'still' });
    const app = render(React.createElement(Storyboard, { director, rc, rows: 30, onQuit() {}, onInterrupt() {} }));
    for (const ev of fixture('success').events) {
      director.push(ev);
      await tick();
    }
    const last = stripAnsi(app.lastFrame() ?? '');
    assert.equal(last.split('FRAME/12').length - 1, 1, `masthead once:\n${last}`);
    for (const c of ['C-01 · RESOLVE WORKSPACE', 'C-02 · READ HISTORY', 'C-03 · PAIR CHANGES', 'C-04 · RANK FINDINGS']) {
      assert.equal(last.split(c).length - 1, 1, `${c} once:\n${last}`);
    }
    app.unmount();
  });

  it('shows a running cut with its progress, and the pose only as decoration', async () => {
    const events = fixture('success').events;
    const upTo = events.findIndex((e) => e.type === 'cut-progress' && e.cut === 'read-history') + 1;
    const { app, last } = mount('success', { upTo });
    await tick();
    assert.match(last(), /C-02 · READ HISTORY .* running/);
    assert.match(last(), /\d+%\s+200\/400 commits/);
    app.unmount();
  });

  it('moves focus with j/k and arrows, inspects with Enter, collapses with Esc', async () => {
    const { app, last } = mount('success');
    await tick();
    app.stdin.write('j');
    await tick();
    assert.match(last(), /› F-02/);
    app.stdin.write('\u001b[A'); // up arrow
    await tick();
    assert.match(last(), /› F-01/);
    app.stdin.write('\r');
    await tick();
    assert.match(last(), /E-06/, 'the Inspector lists every receipt, not just three');
    assert.doesNotMatch(last(), /more receipts/);
    app.stdin.write('\u001b');
    await tick();
    assert.match(last(), /› F-01/);
    app.unmount();
  });

  it('toggles help with ?, and routes q and Ctrl-C to the host', async () => {
    let quit = 0;
    let interrupted = 0;
    const { app, last } = mount('success', { onQuit: () => quit++, onInterrupt: () => interrupted++ });
    await tick();
    app.stdin.write('?');
    await tick();
    assert.match(last(), /ctrl-c: cancel/);
    app.stdin.write('q');
    app.stdin.write('\u0003');
    await tick();
    assert.deepEqual([quit, interrupted], [1, 1]);
    app.unmount();
  });

  it('asks before opening a link, and opens only on y', async () => {
    const snap = structuredClone(fixture('one-finding').snapshot);
    snap.findings[0].receipts[0].href = 'https://example.com/commit/abc';
    const director = createDirector({ caps: { interactive: true }, motion: 'still' });
    for (const ev of fixture('one-finding').events.slice(0, -1)) director.push(ev);
    director.push({ ...fixture('one-finding').events.at(-1), snapshot: snap });
    const opened = [];
    const app = render(React.createElement(Storyboard, { director, rc, rows: 30, onQuit() {}, onInterrupt() {}, onOpen: (u) => opened.push(u) }));
    await tick();
    app.stdin.write('o');
    await tick();
    assert.match(stripAnsi(app.lastFrame()), /Open https:\/\/example\.com\/commit\/abc in your browser\? y\/N/);
    app.stdin.write('n');
    await tick();
    assert.deepEqual(opened, []);
    app.stdin.write('o');
    await tick();
    app.stdin.write('y');
    await tick();
    assert.deepEqual(opened, ['https://example.com/commit/abc']);
    app.unmount();
  });

  it('keeps focus on the same finding when the order changes (second review)', async () => {
    const events = fixture('success').events;
    const runEnd = events.findIndex((e) => e.type === 'run-end');
    const { app, director, last } = mount('success', { upTo: runEnd });
    await tick();
    app.stdin.write('j');
    await tick();
    assert.match(last(), /› F-02 .*Module 2/);
    // The snapshot lists Module 3 before Module 2, so Module 2 becomes F-03.
    const snap = structuredClone(events.at(-1).snapshot);
    snap.findings = [snap.findings[0], snap.findings[2], snap.findings[1]];
    director.push(events[runEnd]);
    director.push({ ...events.at(-1), snapshot: snap });
    await tick();
    assert.match(last(), /› F-03 .*Module 2/, 'the cursor followed the finding');
    app.unmount();
  });

  it('keeps the focused finding in view in a short terminal', async () => {
    const { app, last } = mount('forty-findings', { rows: 12 });
    await tick();
    for (let i = 0; i < 20; i++) app.stdin.write('j');
    app.stdin.write('jjjjj'); // keys that arrive together (key repeat, paste) all count
    await tick();
    assert.match(last(), /› F-26/);
    const live = last().slice(last().indexOf('FINDINGS'));
    assert.ok(live.split('\n').length <= 12, `the live region fits the rows (${live.split('\n').length} lines)`);
    app.unmount();
  });
});

describe('ink: startLive in linear mode (first review)', () => {
  const sink = () => {
    let text = '';
    return { stream: { write: (s) => ((text += s), true), on() {}, off() {}, isTTY: false }, text: () => text };
  };
  for (const [name, code] of [['success', 0], ['failed', 1], ['canceled', 130]]) {
    it(`resolves done by itself on the snapshot (${name} → exit ${code})`, async () => {
      const { detectCapabilities } = await import('@frame12/terminal');
      const { startLive } = await import('@frame12/terminal/ink');
      const out = sink();
      const caps = detectCapabilities({}, { stdout: { isTTY: false }, stderr: { isTTY: false } }, [], { platform: 'linux' });
      const run = startLive({ caps, motion: 'still', stdout: out.stream, stderr: out.stream, handleSignals: false });
      assert.equal(run.mode, 'linear');
      for (const ev of fixture(name).events) run.push(ev);
      assert.equal(await run.done, code);
      assert.equal(await run.end(), code, 'end() after the fact returns the same code');
    });
  }

  const linear = async (extra = {}) => {
    const { detectCapabilities } = await import('@frame12/terminal');
    const { startLive } = await import('@frame12/terminal/ink');
    const caps = detectCapabilities({}, { stdout: { isTTY: false }, stderr: { isTTY: false } }, [], { platform: 'linux' });
    return startLive({ caps, motion: 'still', handleSignals: false, ...extra });
  };

  it('prints the results before it ends, with no false "no snapshot" warning (second review)', async () => {
    const out = sink();
    const err = sink();
    const run = await linear({ stdout: out.stream, stderr: err.stream });
    for (const ev of fixture('success').events) run.push(ev);
    assert.equal(await run.done, 0);
    assert.match(out.text(), /FINDINGS/);
    assert.doesNotMatch(err.text(), /No result snapshot/);
  });

  it('leaves a Director the host passed in usable after the run (second review)', async () => {
    const director = createDirector({ caps: {}, motion: 'still' });
    const out = sink();
    const run = await linear({ director, stdout: out.stream, stderr: out.stream });
    for (const ev of fixture('success').events) run.push(ev);
    await run.done;
    const before = director.snapshot().logs.length;
    director.log('info', 'after the run');
    assert.equal(director.snapshot().logs.length, before + 1);
  });

  it('exits 0 on EPIPE and 1 on any other stdout error, restoring first (second review)', async () => {
    const { EventEmitter } = await import('node:events');
    for (const [code, expected] of [['EPIPE', 0], ['EIO', 1]]) {
      const stdout = Object.assign(new EventEmitter(), { write: () => true, isTTY: false });
      const err = sink();
      const exits = [];
      await linear({ stdout, stderr: err.stream, exit: (c) => exits.push(c) });
      stdout.emit('error', Object.assign(new Error(`write ${code}`), { code }));
      assert.deepEqual(exits, [expected], code);
      if (expected === 1) assert.match(err.text(), /stdout failed: write EIO/);
    }
  });
});

describe('ink: lifecycle helpers', () => {
  it('maps run status to exit codes', () => {
    assert.deepEqual(['completed', 'failed', 'canceled', 'running'].map(exitCodeFor), [0, 1, 130, 1]);
  });

  it('chooses the linear view and says why', () => {
    const base = { screenReader: false, ci: false, isTTY: true, rows: 30, interactive: true };
    assert.equal(linearReason(base), undefined);
    assert.match(linearReason({ ...base, rows: 9 }), /fewer than 10 rows/);
    assert.match(linearReason({ ...base, interactive: false }), /stdin is not a terminal/);
    assert.match(linearReason({ ...base, screenReader: true }), /screen-reader/);
    assert.match(linearReason({ ...base, ci: true }), /CI/);
    assert.match(linearReason({ ...base, isTTY: false }), /stdout is not a terminal/);
  });
});

describe('ink: startLive end to end with fake streams (fourth review)', async () => {
  const { PassThrough, Writable } = await import('node:stream');
  const { detectCapabilities } = await import('@frame12/terminal');
  const { startLive } = await import('@frame12/terminal/ink');
  const { spawnLogged } = await import('@frame12/terminal/process');

  /** A Writable that records text; `failOn` makes the matching write fail asynchronously. */
  const out = ({ tty = false, failOn, code = 'EPIPE' } = {}) => {
    let text = '';
    const w = new Writable({
      write(chunk, _enc, cb) {
        const s = String(chunk);
        if (failOn?.test(stripAnsi(s))) return setImmediate(() => cb(Object.assign(new Error(`write ${code}`), { code })));
        text += s;
        cb();
      },
    });
    return Object.assign(w, tty ? { isTTY: true, columns: 80, rows: 30 } : {}, { text: () => text });
  };
  const ttyIn = () => Object.assign(new PassThrough(), { isTTY: true, setRawMode() {}, ref() {}, unref() {} });
  const capsFor = (live) => ({
    ...detectCapabilities({ TERM: 'xterm-256color' }, { stdout: { isTTY: live, columns: 80, rows: 30 }, stderr: { isTTY: live } }, [], { platform: 'linux' }),
    interactive: live,
  });
  const start = (live, extra = {}) =>
    startLive({ caps: capsFor(live), motion: 'still', stdin: ttyIn(), stdout: out({ tty: live }), stderr: out({ tty: live }), handleSignals: false, devWarnings: false, ...extra });

  it('the final results keep the cut labels the live view showed, whatever the snapshot order', async () => {
    const stdout = out({ tty: true });
    const run = start(true, { stdout });
    assert.equal(run.mode, 'live');
    const events = fixture('failed').events;
    for (const ev of events.slice(0, -1)) run.push(ev);
    const last = events.at(-1);
    run.push({ ...last, snapshot: { ...last.snapshot, cuts: [...last.snapshot.cuts].reverse() } });
    assert.equal(await run.done, 1);
    const text = stripAnsi(stdout.text());
    const results = text.slice(text.lastIndexOf('RUN · 4 CUTS'));
    // The failed-run summary lists the cuts that did not finish ok, in snapshot (reversed) order.
    const listed = run.director.snapshot().cuts.filter((c) => results.includes(`· ${c.title.toUpperCase()}`));
    assert.ok(listed.length >= 3, results);
    for (const c of listed) assert.match(results, new RegExp(`${c.label} · ${c.title.toUpperCase()}`), c.title);
  });

  for (const live of [true, false]) {
    const view = live ? 'live' : 'linear';
    it(`calls onCancel once for a Director the host supplied (${view})`, async () => {
      const director = createDirector({ caps: capsFor(live), motion: 'still' });
      const reasons = [];
      const run = start(live, { director, onCancel: (why) => reasons.push(why) });
      assert.equal(run.mode, view);
      run.push(fixture('success').events[0]);
      director.cancel('SIGINT');
      director.cancel('again');
      assert.deepEqual(reasons, ['SIGINT']);
      assert.equal(director.snapshot().status, 'canceled');
      void run.end();
      await run.done;
    });

    it(`an asynchronous EPIPE while printing the final results exits 0 quietly (${view})`, async () => {
      const exits = [];
      const stdout = out({ tty: live, failOn: /FINDINGS\s+3 \(/ });
      const run = start(live, { stdout, exit: (c) => exits.push(c) });
      for (const ev of fixture('success').events) run.push(ev);
      await run.done;
      await new Promise((r) => setTimeout(r, 50));
      assert.deepEqual(exits, [0]);
    });
  }

  it('narrates a child process failure in the linear view (spawnLogged through startLive)', async () => {
    const stderr = out();
    const run = start(false, { stderr });
    run.push(fixture('success').events[0]);
    const r = await spawnLogged(run.director, process.execPath, ['-e', "process.stderr.write('UNIQUE_CHILD_ERROR\\n'); process.exit(3)"], { stderrLevel: 'error' });
    assert.equal(r.code, 3);
    for (const ev of fixture('success').events.slice(1)) run.push(ev);
    await run.done;
    const text = stderr.text();
    assert.equal(text.split('UNIQUE_CHILD_ERROR').length - 1, 1, `printed once:\n${text}`);
    assert.match(text, /exited with\s+code 3/); // the line may wrap (a long node path)
  });

  it('the linear view narrates events pushed straight to a supplied Director (fifth review)', async () => {
    const stdout = out();
    const stderr = out();
    const director = createDirector({ caps: capsFor(false), motion: 'still' });
    const run = start(false, { director, stdout, stderr });
    for (const ev of fixture('success').events) director.push(ev);
    assert.equal(await run.done, 0);
    assert.match(stripAnsi(stdout.text()), /FINDINGS\s+3 \(/);
    assert.doesNotMatch(stderr.text(), /No result snapshot|without run-end/);
  });

  it('an EPIPE on stderr (`2>&1 | head`) exits 0 quietly (fifth review)', async () => {
    const exits = [];
    const stderr = out({ failOn: /C-02/ });
    const run = start(false, { stderr, exit: (c) => exits.push(c) });
    for (const ev of fixture('success').events) run.push(ev);
    await run.done;
    await new Promise((r) => setTimeout(r, 50));
    assert.deepEqual(exits, [0]);
  });

  it('prints the final results at the width the terminal has now (fifth review)', async () => {
    const { stringWidth } = await import('@frame12/terminal');
    const stdout = out({ tty: true });
    stdout.columns = 120;
    const run = start(true, { stdout });
    const events = fixture('success').events;
    for (const ev of events.slice(0, -1)) run.push(ev);
    stdout.columns = 50;
    stdout.emit('resize');
    await new Promise((r) => setTimeout(r, 30));
    run.push(events.at(-1));
    await run.done;
    const text = stripAnsi(stdout.text());
    const results = text.slice(text.lastIndexOf('FINDINGS'));
    const wide = results.split('\n').filter((l) => stringWidth(l) > 50);
    assert.deepEqual(wide, []);
  });

  it('does not print an event-borne log line twice in the linear view', async () => {
    const stderr = out();
    const run = start(false, { stderr });
    const events = fixture('success').events;
    const { snapshot: _s, ...envelope } = events[0];
    const list = [events[0], { ...envelope, type: 'log', id: `${events[0].id}-log`, seq: events[0].seq + 1, level: 'error', text: 'EVENT_LOG_LINE' }];
    for (const ev of events.slice(1)) list.push({ ...ev, seq: ev.seq + 1 });
    for (const ev of list) run.push(ev);
    await run.done;
    assert.equal(stderr.text().split('EVENT_LOG_LINE').length - 1, 1, stderr.text());
  });
});
