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
