/**
 * The reference apps in a real pseudo-terminal (node-pty, like live.pty.test.mjs): each runs its
 * live view to the end, and the agent-approval prompt takes exactly one answer, defaulting to No.
 * Skipped unless node-pty is installed in packages/terminal/.pty (CI installs it and sets
 * F12_REQUIRE_PTY=1, which makes a missing node-pty a failure).
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { after, afterEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import headless from '@xterm/headless';

const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pty = null;
try {
  pty = createRequire(path.join(PKG, '.pty', 'package.json'))('node-pty');
} catch {
  pty = null;
}
const REQUIRED = process.env.F12_REQUIRE_PTY === '1';
const WIN = process.platform === 'win32';
const spawned = new Set();

/** Runs an example app in a pty; `onScreen(text, write)` reacts to what is shown. */
function runApp(name, args, onScreen = () => {}) {
  const term = new headless.Terminal({ cols: 110, rows: 40, allowProposedApi: true, scrollback: 2000 });
  const env = { ...process.env, TERM: 'xterm-256color', FRAME12_MOTION: 'still', NODE_ENV: 'test' };
  for (const k of ['CI', 'GITHUB_ACTIONS', 'NO_COLOR', 'FORCE_COLOR', 'NODE_TEST_CONTEXT']) delete env[k];
  const child = pty.spawn(process.execPath, [path.join(PKG, 'examples', name, 'app.mjs'), ...args], { name: 'xterm-256color', cols: 110, rows: 40, cwd: PKG, env });
  spawned.add(child);
  let raw = '';
  const screen = () => {
    const b = term.buffer.active;
    const lines = [];
    for (let i = 0; i < b.length; i++) lines.push(b.getLine(i)?.translateToString(true) ?? '');
    return lines.join('\n');
  };
  child.onData((d) => {
    raw += d;
    term.write(d, () => onScreen(screen(), (s) => child.write(s)));
  });
  return new Promise((resolve) =>
    child.onExit(({ exitCode }) => {
      spawned.delete(child);
      term.write('', () => resolve({ exitCode, raw, screen: screen() }));
    }),
  );
}

afterEach(() => {
  for (const c of spawned) {
    try {
      c.kill();
    } catch {
      // gone
    }
  }
  spawned.clear();
});
after(() => {
  // See live.pty.test.mjs: ConPTY handles can outlive the ptys on Windows.
  if (WIN) setTimeout(() => process.exit(), 3000).unref();
});

describe('examples in a real pty', { skip: !pty && !REQUIRED ? 'node-pty is not installed in packages/terminal/.pty (CI installs it)' : false, timeout: 120_000 }, () => {
  it('requires node-pty when F12_REQUIRE_PTY=1', () => assert.ok(pty));

  for (const [name, args, expected, code] of [
    ['repo-archaeology', ['--fixture'], /src\/helper\/ssg\/index\.ts usually changes with/, 0],
    ['build-pipeline', ['--break', 'test'], /Test failed: 1 failing test/, 1],
  ]) {
    it(`${name} runs its live view to the end and prints the results (exit ${code})`, async () => {
      const r = await runApp(name, [...args, '--format', 'live']);
      assert.equal(r.exitCode, code, r.screen.slice(-1200));
      assert.match(r.screen, expected);
      assert.match(r.raw, /\u001b\[\?25h/, 'cursor restored');
    });
  }

  const prompt = /\[y\/N\] \(No in \d+ s\)/;
  for (const [label, keys, code, outcome] of [
    ['y approves exactly once, even pressed twice', 'yy', 0, /Approved: approved with y\./],
    ['n denies', 'n', 1, /Denied: "n"\./],
    ['Enter takes the default, No', '\r', 1, /Denied: Enter \(the default is No\)\./],
    ['no answer denies when the time is up', null, 1, /Denied: no answer within 1 s\./],
  ]) {
    it(`agent approval: ${label}`, async () => {
      let sent = false;
      const r = await runApp('agent-approval', ['--format', 'live', '--timeout', '1'], (text, write) => {
        if (!sent && keys && prompt.test(text)) {
          sent = true;
          write(keys);
        }
      });
      assert.equal(r.exitCode, code, r.screen.slice(-1500));
      assert.match(r.screen, outcome);
      assert.equal((r.raw.match(/"approved":true/g) ?? []).length, code === 0 ? 1 : 0, 'one approval at most');
      assert.doesNotMatch(r.raw, /OVERRIDE|INJECTION|<script|onerror/, 'the untrusted memo is never shown');
    });
  }
});
