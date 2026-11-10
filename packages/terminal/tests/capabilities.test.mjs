import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { detectCapabilities, detectCi, isCjkLocale, resolveColorLevel } from '@frame12/terminal';
import { fakeStreams } from '@frame12/terminal/testing';

const tty = fakeStreams({ tty: true, columns: 100, rows: 30 });
const pipe = fakeStreams({ tty: false });
const caps = (env, streams = tty, argv = [], platform = 'linux') => detectCapabilities(env, streams, argv, { platform });

describe('capabilities: color precedence (ported from Repo Archaeology RA-13)', () => {
  // [description, env, tty?, argv, expected level]
  const table = [
    ['plain TTY → 16 colors', {}, true, [], 1],
    ['TERM=xterm-256color → 256', { TERM: 'xterm-256color' }, true, [], 2],
    ['COLORTERM=truecolor → truecolor', { COLORTERM: 'truecolor' }, true, [], 3],
    ['COLORTERM=24bit → truecolor', { COLORTERM: '24bit' }, true, [], 3],
    ['Windows Terminal → truecolor', { WT_SESSION: 'abc' }, true, [], 3],
    ['VS Code → truecolor', { TERM_PROGRAM: 'vscode' }, true, [], 3],
    ['pipe → none', {}, false, [], 0],
    ['TERM=dumb on a TTY → none', { TERM: 'dumb' }, true, [], 0],
    ['NO_COLOR=1 → none', { NO_COLOR: '1', COLORTERM: 'truecolor' }, true, [], 0],
    ['NO_COLOR="" is ignored (no-color.org)', { NO_COLOR: '' }, true, [], 1],
    ['NODE_DISABLE_COLORS=1 → none', { NODE_DISABLE_COLORS: '1' }, true, [], 0],
    ['NODE_DISABLE_COLORS=0 is ignored', { NODE_DISABLE_COLORS: '0' }, true, [], 1],
    ['FORCE_COLOR=0 → none', { FORCE_COLOR: '0' }, true, [], 0],
    ['FORCE_COLOR=false → none', { FORCE_COLOR: 'false' }, true, [], 0],
    ['FORCE_COLOR=1 on a pipe → 16', { FORCE_COLOR: '1' }, false, [], 1],
    ['FORCE_COLOR=true on a pipe → 16', { FORCE_COLOR: 'true' }, false, [], 1],
    ['FORCE_COLOR=2 on a pipe → 256', { FORCE_COLOR: '2' }, false, [], 2],
    ['FORCE_COLOR=3 on a pipe → truecolor', { FORCE_COLOR: '3' }, false, [], 3],
    ['FORCE_COLOR=7 → truecolor', { FORCE_COLOR: '7' }, false, [], 3],
    ['FORCE_COLOR=3 beats TERM=dumb', { FORCE_COLOR: '3', TERM: 'dumb' }, true, [], 3],
    ['conflict: NO_COLOR + FORCE_COLOR → NO_COLOR wins', { NO_COLOR: '1', FORCE_COLOR: '3' }, true, [], 0],
    ['conflict: NODE_DISABLE_COLORS + FORCE_COLOR → disabled', { NODE_DISABLE_COLORS: '1', FORCE_COLOR: '2' }, false, [], 0],
    ['--no-color beats FORCE_COLOR', { FORCE_COLOR: '3' }, true, ['--no-color'], 0],
    ['--color beats NO_COLOR', { NO_COLOR: '1', COLORTERM: 'truecolor' }, true, ['--color'], 3],
    ['conflict: CI + --color on a pipe → color', { CI: 'true', GITHUB_ACTIONS: 'true' }, false, ['--color'], 1],
    ['CI without flags on a pipe → none', { CI: 'true' }, false, [], 0],
    ['last of --color / --no-color wins', {}, true, ['--color', '--no-color'], 0],
    ['last of --no-color / --color wins', { TERM: 'xterm-256color' }, true, ['--no-color', '--color'], 2],
    ['flags after -- belong to someone else', {}, true, ['--', '--no-color'], 1],
  ];
  for (const [name, env, isTTY, argv, expected] of table) {
    it(name, () => {
      assert.equal(caps(env, isTTY ? tty : pipe, argv).colorLevel, expected);
      assert.equal(resolveColorLevel(env, argv, isTTY), expected);
    });
  }

  it('computes stdout and stderr levels separately (cmd > out.txt keeps narration styled)', () => {
    const c = detectCapabilities({ COLORTERM: 'truecolor' }, { stdout: { isTTY: false }, stderr: { isTTY: true, columns: 90 } }, [], { platform: 'linux' });
    assert.equal(c.colorLevel, 0);
    assert.equal(c.stderrColorLevel, 3);
    assert.equal(c.attributes, false);
    assert.equal(c.stderrAttributes, true);
    assert.equal(c.columns, 90, 'width comes from the TTY stream');
  });

  it('keeps emphasis (attributes) on a TTY under NO_COLOR, but never on pipes or TERM=dumb', () => {
    assert.equal(caps({ NO_COLOR: '1' }).attributes, true);
    assert.equal(caps({ NO_COLOR: '1' }, pipe).attributes, false);
    assert.equal(caps({ TERM: 'dumb' }).attributes, false);
  });
});

describe('capabilities: unicode and ambiguous width', () => {
  const table = [
    ['UTF-8 locale', { LANG: 'en_US.UTF-8' }, 'linux', [], true],
    ['utf8 spelling', { LC_ALL: 'C.utf8' }, 'linux', [], true],
    ['C locale', { LANG: 'C' }, 'linux', [], false],
    ['POSIX locale with LC_ALL overriding LANG', { LANG: 'en_US.UTF-8', LC_ALL: 'POSIX' }, 'linux', [], false],
    ['no locale at all', {}, 'linux', [], true],
    ['macOS Terminal.app without a locale', { LANG: 'C', TERM_PROGRAM: 'Apple_Terminal' }, 'darwin', [], true],
    ['iTerm2', { LANG: 'C', TERM_PROGRAM: 'iTerm.app' }, 'darwin', [], true],
    ['Windows Terminal', { WT_SESSION: 'x' }, 'win32', [], true],
    ['VS Code on Windows', { TERM_PROGRAM: 'vscode' }, 'win32', [], true],
    ['legacy conhost', {}, 'win32', [], false],
    ['mintty / Git Bash', { TERM: 'xterm-256color' }, 'win32', [], true],
    ['TERM=dumb', { TERM: 'dumb', LANG: 'en_US.UTF-8' }, 'linux', [], false],
    ['--ascii', { LANG: 'en_US.UTF-8' }, 'linux', ['--ascii'], false],
    ['FRAME12_ASCII=1', { LANG: 'en_US.UTF-8', FRAME12_ASCII: '1' }, 'linux', [], false],
    ['--unicode beats a C locale', { LANG: 'C' }, 'linux', ['--unicode'], true],
  ];
  for (const [name, env, platform, argv, expected] of table) {
    it(name, () => assert.equal(caps(env, tty, argv, platform).unicode, expected));
  }

  it('ambiguous-wide follows FRAME12_AMBIGUOUS_WIDE, then a CJK locale', () => {
    assert.equal(caps({ LANG: 'en_US.UTF-8' }).ambiguousWide, false);
    for (const lang of ['ja_JP.UTF-8', 'zh_CN.UTF-8', 'zh_TW', 'ko_KR.UTF-8', 'ja']) assert.equal(caps({ LANG: lang }).ambiguousWide, true, lang);
    assert.equal(caps({ LANG: 'jam_JM.UTF-8' }).ambiguousWide, false, 'only ja/zh/ko, not prefixes of other tags');
    assert.equal(caps({ LANG: 'en_US.UTF-8', FRAME12_AMBIGUOUS_WIDE: '1' }).ambiguousWide, true);
    assert.equal(caps({ LANG: 'ja_JP.UTF-8', FRAME12_AMBIGUOUS_WIDE: '0' }).ambiguousWide, false);
    assert.equal(caps({ LC_ALL: 'ko_KR.UTF-8', LANG: 'en_US.UTF-8' }).ambiguousWide, true, 'LC_ALL wins over LANG');
    assert.equal(isCjkLocale({ LC_CTYPE: 'zh_HK.UTF-8' }), true);
  });
});

describe('capabilities: links', () => {
  const table = [
    ['iTerm2 TTY', { TERM_PROGRAM: 'iTerm.app' }, true, [], true],
    ['WezTerm', { TERM_PROGRAM: 'WezTerm' }, true, [], true],
    ['Ghostty', { TERM_PROGRAM: 'ghostty' }, true, [], true],
    ['kitty', { TERM: 'xterm-kitty' }, true, [], true],
    ['VTE ≥ 0.50 (GNOME Terminal)', { VTE_VERSION: '7600' }, true, [], true],
    ['old VTE', { VTE_VERSION: '4600' }, true, [], false],
    ['Konsole', { KONSOLE_VERSION: '230400' }, true, [], true],
    ['Windows Terminal', { WT_SESSION: 'x' }, true, [], true],
    ['unknown terminal → plain text', { TERM: 'xterm' }, true, [], false],
    ['pipe', { TERM_PROGRAM: 'iTerm.app' }, false, [], false],
    ['CI', { TERM_PROGRAM: 'iTerm.app', CI: 'true' }, true, [], false],
    ['TERM=dumb', { TERM: 'dumb', TERM_PROGRAM: 'iTerm.app' }, true, [], false],
    ['tmux', { TERM_PROGRAM: 'iTerm.app', TMUX: '/tmp/tmux-1/default,1,0' }, true, [], false],
    ['GNU screen', { STY: '1.pts', TERM: 'screen-256color', VTE_VERSION: '7600' }, true, [], false],
    ['conflict: tmux + FRAME12_LINKS=1', { TMUX: 'x', FRAME12_LINKS: '1' }, true, [], true],
    ['FRAME12_LINKS=0 on a capable terminal', { TERM_PROGRAM: 'iTerm.app', FRAME12_LINKS: '0' }, true, [], false],
    ['FORCE_HYPERLINK=1 (Repo Archaeology compatibility)', { TERM: 'xterm' }, true, [], true],
    ['--links on a pipe', {}, false, ['--links'], true],
    ['--no-links beats FRAME12_LINKS=1', { FRAME12_LINKS: '1' }, true, ['--no-links'], false],
  ];
  table[16][1].FORCE_HYPERLINK = '1';
  for (const [name, env, isTTY, argv, expected] of table) {
    it(name, () => assert.equal(caps(env, isTTY ? tty : pipe, argv).links, expected));
  }
});

describe('capabilities: size, interactivity, screen readers and CI', () => {
  it('clamps columns to 20–400 and rows to 5–200, with COLUMNS/LINES fallbacks', () => {
    assert.equal(caps({}, fakeStreams({ tty: true, columns: 10, rows: 2 })).columns, 20);
    assert.equal(caps({}, fakeStreams({ tty: true, columns: 1000, rows: 999 })).rows, 200);
    assert.equal(caps({}, fakeStreams({ tty: true, columns: 1000 })).columns, 400);
    assert.equal(caps({ COLUMNS: '120', LINES: '40' }, pipe).columns, 120);
    assert.equal(caps({ COLUMNS: '120', LINES: '40' }, pipe).rows, 40);
    assert.equal(caps({ COLUMNS: 'wide' }, pipe).columns, 80, 'garbage falls back to 80');
    assert.equal(caps({}, pipe).rows, 24);
    assert.equal(caps({ COLUMNS: '50' }, fakeStreams({ tty: true, columns: 100 })).columns, 100, 'a TTY knows its own size');
    assert.equal(caps({}, tty, ['--columns', '40']).columns, 40);
    assert.equal(caps({}, tty, ['--columns=33', '--rows=7']).rows, 7);
  });

  it('is interactive only with TTY stdin and stdout, raw mode, and no CI', () => {
    assert.equal(caps({}).interactive, true);
    assert.equal(caps({}, fakeStreams({ tty: true, stdinTty: false })).interactive, false);
    assert.equal(caps({}, { stdin: { isTTY: true }, stdout: { isTTY: true } }).interactive, false, 'no raw mode');
    assert.equal(caps({ CI: '1' }).interactive, false);
    assert.equal(caps({ TERM: 'dumb' }).interactive, false);
    assert.equal(caps({}, pipe).interactive, false);
  });

  it('turns on screen-reader mode from --screen-reader, FRAME12_SCREEN_READER=1 or INK_SCREEN_READER=true', () => {
    assert.equal(caps({}).screenReader, false);
    assert.equal(caps({}, tty, ['--screen-reader']).screenReader, true);
    assert.equal(caps({ FRAME12_SCREEN_READER: '1' }).screenReader, true);
    assert.equal(caps({ FRAME12_SCREEN_READER: '0' }).screenReader, false);
    assert.equal(caps({ INK_SCREEN_READER: 'true' }).screenReader, true);
    assert.equal(caps({ INK_SCREEN_READER: '1' }).screenReader, false, "Ink's own variable is exactly 'true'");
  });

  it('detects CI from CI and provider variables', () => {
    assert.deepEqual(detectCi({}), { ci: false, provider: undefined });
    assert.deepEqual(detectCi({ CI: 'true' }), { ci: true, provider: undefined });
    assert.deepEqual(detectCi({ CI: 'false' }), { ci: false, provider: undefined });
    assert.deepEqual(detectCi({ GITHUB_ACTIONS: 'true' }), { ci: true, provider: 'github-actions' });
    assert.deepEqual(detectCi({ GITLAB_CI: 'true' }), { ci: true, provider: 'gitlab' });
    assert.deepEqual(detectCi({ BUILDKITE: 'true' }), { ci: true, provider: 'buildkite' });
    assert.deepEqual(detectCi({ JENKINS_URL: 'https://ci' }), { ci: true, provider: 'jenkins' });
    assert.equal(caps({ TF_BUILD: 'True' }).ciProvider, 'azure-pipelines');
  });

  it('knows which terminals re-wrap on resize; unknown ones and multiplexers do not (fifth review)', () => {
    for (const env of [{ TERM_PROGRAM: 'iTerm.app' }, { TERM_PROGRAM: 'vscode' }, { WT_SESSION: 'x' }, { KITTY_WINDOW_ID: '1' }, { VTE_VERSION: '7600' }, { TERM: 'foot' }]) {
      assert.equal(caps(env).reflow, true, JSON.stringify(env));
    }
    for (const env of [{ TERM: 'xterm-256color' }, { TERM: 'linux' }, { TERM_PROGRAM: 'iTerm.app', TMUX: 'x' }, { TERM: 'screen' }]) {
      assert.equal(caps(env).reflow, false, JSON.stringify(env));
    }
    assert.equal(caps({ TERM: 'xterm', FRAME12_REFLOW: '1' }).reflow, true);
    assert.equal(caps({ TERM_PROGRAM: 'vscode', FRAME12_REFLOW: '0' }).reflow, false);
  });

  it('detects multiplexers', () => {
    assert.equal(caps({ TMUX: 'x' }).multiplexer, 'tmux');
    assert.equal(caps({ TERM: 'screen-256color' }).multiplexer, 'screen');
    assert.equal(caps({}).multiplexer, undefined);
  });

  it('is pure: same inputs, same result, and it never reads process.env', () => {
    const before = { ...process.env };
    process.env.NO_COLOR = '1';
    try {
      assert.equal(caps({}).colorLevel, 1);
      assert.deepEqual(caps({ TERM: 'xterm' }), caps({ TERM: 'xterm' }));
    } finally {
      for (const k of Object.keys(process.env)) if (!(k in before)) delete process.env[k];
      Object.assign(process.env, before);
    }
  });
});
