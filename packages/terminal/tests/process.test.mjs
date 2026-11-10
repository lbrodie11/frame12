import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createDirector } from '@frame12/terminal';
import { openUrl, spawnLogged } from '@frame12/terminal/process';

const director = () => createDirector({ caps: { interactive: false }, motion: 'still' });
const node = (code) => [process.execPath, ['-e', code]];

describe('process: spawnLogged', () => {
  it('pipes stdout (info) and stderr (warn) line by line into the log and reports the exit code', async () => {
    const d = director();
    const [cmd, args] = node("process.stdout.write('one\\ntwo\\n'); process.stderr.write('progress 50%\\n'); process.stdout.write('partial'); process.exit(3)");
    const r = await spawnLogged(d, cmd, args, { cut: 'build' });
    assert.equal(r.code, 3);
    const logs = d.snapshot().logs.map((l) => [l.level, l.text, l.stream, l.cut]);
    assert.deepEqual(logs.slice(0, 4).sort(), [
      ['info', 'one', 'stdout', 'build'],
      ['info', 'partial', 'stdout', 'build'],
      ['info', 'two', 'stdout', 'build'],
      ['warn', 'progress 50%', 'stderr', 'build'],
    ]);
    assert.match(d.snapshot().logs.at(-1).text, /exited with code 3/);
    assert.equal(d.snapshot().logs.at(-1).level, 'error');
  });

  it('keeps a multi-byte character split across two chunks intact (first review)', async () => {
    const d = director();
    const [cmd, args] = node("const b = Buffer.from('\u6f22\u5b57\u30c6\u30b9\u30c8\\n'); process.stdout.write(b.subarray(0, 4)); setTimeout(() => process.stdout.write(b.subarray(4)), 50)");
    await spawnLogged(d, cmd, args);
    assert.equal(d.snapshot().logs.find((l) => l.stream === 'stdout').text, '\u6f22\u5b57\u30c6\u30b9\u30c8');
  });

  it('sanitizes and redacts child output', async () => {
    const d = director();
    const token = ['ghp', '_', 'z'.repeat(36)].join('');
    const [cmd, args] = node(`process.stdout.write('\\x1b]52;c;ZXZpbA==\\x07\\x1b[2Jtoken ${token}\\n')`);
    await spawnLogged(d, cmd, args);
    const line = d.snapshot().logs[0].text;
    assert.equal(line, 'token [redacted]');
  });

  it('never uses a shell: arguments are passed literally', async () => {
    const d = director();
    const [cmd] = node('');
    const r = await spawnLogged(d, cmd, ['-e', 'console.log(process.argv[1])', '$(echo injected); echo also']);
    assert.equal(r.code, 0);
    assert.equal(d.snapshot().logs[0].text, '$(echo injected); echo also');
  });

  it('kills the child when the run is canceled', async () => {
    const d = director();
    const [cmd, args] = node('setTimeout(() => {}, 60000)');
    const pending = spawnLogged(d, cmd, args);
    setTimeout(() => d.cancel('SIGINT'), 100);
    const r = await pending;
    assert.ok(r.signal === 'SIGTERM' || r.code !== 0, JSON.stringify(r));
  });

  it('reports a command that cannot start, without throwing', async () => {
    const d = director();
    const r = await spawnLogged(d, 'frame12-no-such-command', []);
    assert.equal(r.code, null);
    assert.ok(r.error);
    assert.match(d.snapshot().logs[0].text, /could not start/);
    await new Promise((r) => setTimeout(r, 100)); // 'close' follows 'error' a tick later
    assert.equal(d.snapshot().logs.length, 1, 'no bogus exit line after the start failure (second review)');
  });

  it('sends SIGKILL when a canceled child ignores SIGTERM (second review)', { skip: process.platform === 'win32' && 'kill() is forceful on Windows' }, async () => {
    const d = director();
    const [cmd, args] = node("process.on('SIGTERM', () => {}); console.log('ready'); setInterval(() => {}, 1000)");
    const pending = spawnLogged(d, cmd, args, { killAfterMs: 200 });
    while (!d.snapshot().logs.some((l) => l.text === 'ready')) await new Promise((r) => setTimeout(r, 20));
    d.cancel('SIGINT');
    const r = await pending;
    assert.equal(r.signal, 'SIGKILL', JSON.stringify(r));
  });
});

describe('process: openUrl', () => {
  it('refuses anything but a safe link, before spawning', () => {
    for (const bad of ['javascript:alert(1)', 'http://example.com', 'file:///etc/passwd', 'https://exa‮mple.com']) {
      assert.equal(openUrl(bad, 'linux'), false, bad);
    }
  });
});
