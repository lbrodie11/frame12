/**
 * The live view in a real pseudo-terminal (node-pty), with output parsed by @xterm/headless.
 *
 * node-pty compiles native code, so it is not a lockfile dependency: CI installs it into
 * packages/terminal/.pty (see .github/workflows/ci.yml) and sets F12_REQUIRE_PTY=1, which makes a
 * missing node-pty a failure. Locally the suite is skipped unless .pty is installed:
 *   cd packages/terminal && mkdir -p .pty && cd .pty && echo '{"private":true}' > package.json && npm i node-pty@1.1.0
 * On macOS also make node-pty's prebuilt spawn-helper executable (chmod +x, see ci.yml): node-pty
 * 1.1.0 ships it without the execute bit, and every spawn fails with "posix_spawnp failed".
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, it } from 'node:test';
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

/** The child's environment: an interactive truecolor terminal, with every CI marker removed. */
function childEnv(extra) {
  const env = { ...process.env };
  for (const k of Object.keys(env)) {
    if (/^(CI|CONTINUOUS_INTEGRATION|GITHUB_ACTIONS|GITLAB_CI|BUILDKITE|CIRCLECI|TRAVIS|JENKINS_URL|TEAMCITY_VERSION|TF_BUILD|BUILD_BUILDID|BITBUCKET_BUILD_NUMBER|APPVEYOR|DRONE|CODEBUILD_BUILD_ID|SEMAPHORE|NO_COLOR|FORCE_COLOR|NO_MOTION|REDUCED_MOTION|FRAME12_.*|INK_SCREEN_READER|COLUMNS|LINES)$/.test(k)) delete env[k];
  }
  return { ...env, TERM: 'xterm-256color', COLORTERM: 'truecolor', LANG: 'en_US.UTF-8', NODE_ENV: 'test', ...extra };
}

/** Every spawned app, so a failing test never leaves a pty open (which would hang the runner). */
const spawned = new Set();

function spawnApp(args, { cols = 100, rows = 30, env = {} } = {}) {
  const term = new headless.Terminal({ cols, rows, allowProposedApi: true, scrollback: 1000 });
  const child = pty.spawn(process.execPath, [path.join(PKG, 'tests/fixtures/live-app.mjs'), ...args], {
    name: 'xterm-256color',
    cols,
    rows,
    cwd: PKG,
    env: childEnv(env),
  });
  let raw = '';
  const listeners = new Set();
  child.onData((d) => {
    raw += d;
    term.write(d);
    for (const l of listeners) l(d);
  });
  const exited = new Promise((resolve) => child.onExit(({ exitCode, signal }) => (spawned.delete(child), resolve({ exitCode, signal }))));
  spawned.add(child);
  const screen = () => {
    const b = term.buffer.active;
    const lines = [];
    for (let y = 0; y < b.length; y++) lines.push(b.getLine(y)?.translateToString(true) ?? '');
    return lines.join('\n');
  };
  const visible = () => {
    const b = term.buffer.active;
    const lines = [];
    for (let y = b.viewportY; y < b.viewportY + term.rows; y++) lines.push(b.getLine(y)?.translateToString(true) ?? '');
    return lines;
  };
  const waitFor = (pred, ms = 8000) =>
    new Promise((resolve, reject) => {
      const flushed = () => new Promise((r) => term.write('', r));
      const check = async () => {
        await flushed();
        if (pred({ raw, screen: screen() })) {
          clearInterval(timer);
          clearTimeout(deadline);
          resolve();
        }
      };
      const timer = setInterval(check, 10);
      const deadline = setTimeout(() => {
        clearInterval(timer);
        reject(new Error(`timed out waiting; screen:\n${screen().slice(-1500)}`));
      }, ms);
      void check();
    });
  return {
    child,
    term,
    get raw() {
      return raw;
    },
    screen,
    visible,
    waitFor,
    exited,
    onData: (fn) => (listeners.add(fn), () => listeners.delete(fn)),
    resize(c, r) {
      child.resize(c, r);
      term.resize(c, r);
    },
    kill() {
      try {
        child.kill();
      } catch {
        // already gone
      }
    },
  };
}

/** Ready: the live view shows its findings and hint bar, and no cut is running any more. */
const ready = ({ screen }) => /FINDINGS \d+/.test(screen) && /j\/k move/.test(screen) && !/ running/.test(screen);

/** True when the cursor is visible at the end: no hide (?25l) after the last show (?25h). */
function cursorRestored(raw) {
  return raw.lastIndexOf('\u001b[?25l') < raw.lastIndexOf('\u001b[?25h') || !raw.includes('\u001b[?25l');
}

/**
 * The app wrote no cursor movement (only sequences `allowed` rejects are counted). Under ConPTY the
 * bytes a pty reader sees are Windows' own repaint of the screen (?9001h, 2J, X, C, K), not the
 * app's output, so there the check is what is visible: no live region was drawn.
 */
function assertAppendOnly(app, counts, message) {
  if (WIN) {
    assert.doesNotMatch(app.screen(), /j\/k move/, `${message} (no live region under ConPTY)`);
    return;
  }
  const csi = [...app.raw.matchAll(/\u001b\[([0-9;?]*)([A-Za-z])/g)].filter((m) => m[0] !== '\u001b[?25h' && counts(m));
  assert.deepEqual(csi.map((m) => m[0]), [], message);
}

function exitLine(raw) {
  return /F12-EXIT raw=(true|false) code=(\d+)/.exec(raw);
}

import { after, afterEach } from 'node:test';
afterEach(() => {
  for (const child of spawned) {
    try {
      child.kill();
    } catch {
      // already gone
    }
  }
  spawned.clear();
});
// node-pty's ConPTY handles (and its console-list agent) can outlive every killed pty on Windows,
// keeping this test process alive after the last test until the CI job times out. Once the suite
// is done, give the runner time to report, then exit with the code it set. The timer is unref'd:
// it only fires if something else is still holding the process open.
after(() => {
  if (WIN) setTimeout(() => process.exit(), 3000).unref();
});

describe('live view in a real pty', { skip: !pty && !REQUIRED ? 'node-pty is not installed in packages/terminal/.pty (CI installs it)' : false, timeout: 120_000 }, () => {
  it('node-pty is available where the suite is required', () => {
    assert.ok(pty, 'F12_REQUIRE_PTY=1 but node-pty could not be loaded from packages/terminal/.pty');
  });

  it('completes: exit 0, results printed linearly, cursor and raw mode restored', async () => {
    const app = spawnApp(['--scenario', 'complete']);
    const { exitCode } = await app.exited;
    assert.equal(exitCode, 0, app.screen().slice(-800));
    assert.match(app.screen(), /FINDINGS\s+3 \(1 top, 2 primary\)/, 'results are printed after the live view');
    assert.match(app.screen(), /pair-001/);
    assert.ok(cursorRestored(app.raw), 'cursor visible at exit');
    assert.equal(exitLine(app.raw)?.[1], 'false', 'raw mode off at exit');
  });

  it('first Ctrl-C cancels gracefully: canceled, results printed, exit 130, terminal restored', async () => {
    const app = spawnApp(['--scenario', 'hold']);
    await app.waitFor(ready);
    await app.waitFor(({ screen }) => /FINDINGS 3/.test(screen));
    app.child.write('\u0003');
    const { exitCode } = await app.exited;
    assert.equal(exitCode, 130);
    assert.match(app.screen(), /canceled/);
    assert.ok(cursorRestored(app.raw));
    assert.equal(exitLine(app.raw)?.[1], 'false');
  });

  it('a second Ctrl-C within 2 s forces exit when the producer ignores the cancel', async () => {
    const app = spawnApp(['--scenario', 'ignore-cancel']);
    await app.waitFor(ready);
    app.child.write('\u0003');
    await app.waitFor(({ screen }) => /canceled: SIGINT/.test(screen));
    const t0 = Date.now();
    app.child.write('\u0003');
    const { exitCode } = await app.exited;
    assert.equal(exitCode, 130);
    assert.ok(Date.now() - t0 < 2000, 'forced promptly');
    assert.ok(cursorRestored(app.raw));
    assert.equal(exitLine(app.raw)?.[1], 'false');
  });

  it('q never forces: the first cancels, the second finishes and says what it has', async () => {
    const app = spawnApp(['--scenario', 'ignore-cancel']);
    await app.waitFor(ready);
    app.child.write('q');
    await app.waitFor(({ screen }) => /canceled: quit \(q\)/.test(screen));
    app.child.write('q');
    const { exitCode } = await app.exited;
    assert.equal(exitCode, 130);
    assert.match(app.screen(), /No result snapshot arrived/, 'finished through the normal path, not a forced exit');
    assert.ok(cursorRestored(app.raw));
    assert.equal(exitLine(app.raw)?.[1], 'false');
  });

  for (const sig of ['SIGINT', 'SIGTERM']) {
    it(`${sig} cancels like a single Ctrl-C`, { skip: WIN ? 'POSIX signals are not delivered through ConPTY' : false }, async () => {
      const app = spawnApp(['--scenario', 'hold']);
      await app.waitFor(ready);
      app.child.kill(sig);
      const { exitCode } = await app.exited;
      assert.equal(exitCode, 130, app.screen().slice(-600));
      assert.ok(cursorRestored(app.raw));
      assert.equal(exitLine(app.raw)?.[1], 'false');
    });
  }

  for (const scenario of ['crash', 'reject']) {
    it(`restores the terminal after ${scenario === 'crash' ? 'a thrown error' : 'an unhandled rejection'} (exit 1)`, async () => {
      const app = spawnApp(['--scenario', scenario]);
      const { exitCode } = await app.exited;
      assert.equal(exitCode, 1);
      assert.match(app.screen(), scenario === 'crash' ? /fixture crash/ : /fixture rejection/);
      assert.ok(cursorRestored(app.raw));
      assert.equal(exitLine(app.raw)?.[1], 'false');
    });
  }

  it('falls back to linear output below 10 rows, with no cursor movement', async () => {
    const app = spawnApp(['--scenario', 'complete'], { rows: 8 });
    const { exitCode } = await app.exited;
    assert.equal(exitCode, 0);
    assert.match(app.raw, /Live view off: the terminal has fewer than 10 rows/);
    assertAppendOnly(app, (m) => m[2] !== 'm', 'append-only: only styling sequences');
  });

  it('linear mode honors Ctrl-C too: cancel, results, exit 130 (first review)', async () => {
    const app = spawnApp(['--scenario', 'hold'], { rows: 8 });
    await app.waitFor(({ raw }) => /Live view off/.test(raw) && /C-04/.test(raw));
    app.child.write('\u0003');
    const { exitCode } = await app.exited;
    assert.equal(exitCode, 130, app.raw.slice(-600));
    assert.match(app.raw, /canceled/);
  });

  it('re-lays out on resize (120 → 40 → 80) without leftover copies of the live region', async () => {
    // Dev warnings on: the resize cleanup is our own write, so it must not trip the stray-write warning.
    const app = spawnApp(['--scenario', 'hold', '--dev-warnings', 'on'], { cols: 120, rows: 30 });
    await app.waitFor(ready);
    for (const cols of [40, 80]) {
      app.resize(cols, 30);
      await new Promise((r) => setTimeout(r, 250));
    }
    app.child.write('j');
    await app.waitFor(({ screen }) => /› F-02/.test(screen));
    await new Promise((r) => setTimeout(r, 150));
    const vis = app.visible();
    assert.equal(vis.filter((l) => /^FINDINGS \d/.test(l)).length, 1, `one live region:\n${vis.join('\n')}`);
    assert.equal(vis.filter((l) => /j\/k move/.test(l)).length, 1, 'one hint bar');
    for (const l of vis) assert.ok([...l].length <= 80, `line fits 80 columns: ${l}`);
    assert.doesNotMatch(app.screen(), /wrote to stdout directly/, 'no false stray-write warning');
    app.child.write('\u0003');
    await app.exited;
  });

  for (const motion of ['twos', 'ones', 'still']) {
    it(`echoes keys within 50 ms at p95 (${motion})`, async () => {
      const app = spawnApp(['--scenario', 'hold', '--fixture', 'forty-findings', '--delay', '0'], { env: { FRAME12_MOTION: motion } });
      await app.waitFor(ready);
      await app.waitFor(({ screen }) => /› F-01/.test(screen));
      const samples = [];
      for (let i = 2; i <= 21; i++) {
        const target = `› F-${String(i).padStart(2, '0')}`;
        const t0 = performance.now();
        const seen = new Promise((resolve) => {
          const stop = app.onData(() => {
            app.term.write('', () => {
              if (app.visible().some((l) => l.startsWith(target))) {
                stop();
                resolve();
              }
            });
          });
        });
        app.child.write('j');
        await seen;
        samples.push(performance.now() - t0);
      }
      samples.sort((a, b) => a - b);
      const p95 = samples[Math.ceil(samples.length * 0.95) - 1];
      console.log(`keypress-to-frame ${motion}: p50 ${samples[9].toFixed(1)} ms, p95 ${p95.toFixed(1)} ms`);
      assert.ok(p95 <= 50, `p95 ${p95.toFixed(1)} ms`);
      app.child.write('\u0003');
      await app.exited;
    });
  }

  for (const scenario of ['idle', 'hold']) {
    it(`writes nothing while idle (${scenario === 'idle' ? 'after run-end' : 'awaiting input, nothing running'})`, async () => {
      const app = spawnApp(['--scenario', scenario], { env: { FRAME12_MOTION: 'twos' } });
      await app.waitFor(ready);
      await new Promise((r) => setTimeout(r, 400));
      let bytes = 0;
      const stop = app.onData((d) => (bytes += d.length));
      await new Promise((r) => setTimeout(r, 2000));
      stop();
      assert.equal(bytes, 0, `${bytes} bytes written while idle`);
      app.child.write('\u0003');
      await new Promise((r) => setTimeout(r, 300));
      app.kill();
      await app.exited;
    });
  }

  it('routes console.* above the live region instead of corrupting it', async () => {
    const app = spawnApp(['--scenario', 'console']);
    const { exitCode } = await app.exited;
    assert.equal(exitCode, 0);
    const screen = app.screen();
    assert.equal(screen.split('F12-CONSOLE-LINE from the host').length - 1, 1, 'the console line appears exactly once');
    assert.ok(screen.indexOf('F12-CONSOLE-LINE') < screen.lastIndexOf('FINDINGS'), 'above the results');
  });

  it('warns once, in the live view, about a direct stdout write (development)', async () => {
    const app = spawnApp(['--scenario', 'stray']);
    await app.waitFor(({ screen }) => /wrote to stdout directly/.test(screen));
    app.child.write('\u0003');
    const { exitCode } = await app.exited;
    assert.equal(exitCode, 130);
    assert.equal(app.screen().split('wrote to stdout directly').length - 1, 1, 'warned once');
  });

  it('screen-reader mode is append-only plain text, with a note saying so', async () => {
    const app = spawnApp(['--scenario', 'complete'], { env: { FRAME12_SCREEN_READER: '1' } });
    const { exitCode } = await app.exited;
    assert.equal(exitCode, 0);
    assert.match(app.raw, /Note: screen-reader mode prints append-only lines/);
    assert.match(app.raw, /^Cut C-01 resolve-workspace "Resolve workspace": done/m, 'self-describing plain lines');
    assert.match(app.raw, /^Finding F-01 pair-001 \(top finding, needs review\)/m);
    assertAppendOnly(app, () => true, 'no cursor movement and no styling');
    assert.doesNotMatch(app.raw, /[\u2500-\u257f]/, 'no box drawing');
  });

  it('stays within memory bounds under a 10,000 events/s burst for 3 s and shows the last state', async () => {
    const app = spawnApp(['--scenario', 'burst'], { env: { FRAME12_MOTION: 'twos' } });
    const { exitCode } = await app.exited;
    assert.equal(exitCode, 0);
    const heap = Number(/F12-HEAP=(\d+)/.exec(app.raw)?.[1]);
    console.log(`burst heap: ${heap} MB`);
    assert.ok(heap > 0 && heap < 200, `heap ${heap} MB`);
    assert.match(app.screen(), /30000 events/, 'the final state is shown');
  });
});
