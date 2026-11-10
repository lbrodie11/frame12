import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { tokens as upstream } from '@frame12/tokens';
import {
  ANSI16,
  GUTTER_CELLS,
  ROLES,
  TOKENS_PACKAGE_VERSION,
  hexToRgb,
  nearestAnsi256,
  paint,
  roleSgr,
  styleLevel,
  tokenGutterPx,
  tokenMotion,
  tokenPalette,
  tokenSgr,
  xterm256Rgb,
} from '@frame12/terminal';

const LEVELS = ['none', 'mono', 'ansi16', 'ansi256', 'truecolor'];

describe('tokens: derived from @frame12/tokens at build time', () => {
  it('matches the installed @frame12/tokens exactly', async () => {
    const { default: tokensPkg } = await import('@frame12/tokens/package.json', { with: { type: 'json' } });
    assert.equal(TOKENS_PACKAGE_VERSION, tokensPkg.version);
    for (const theme of ['light', 'dark']) {
      for (const [name, hex] of Object.entries(tokenPalette[theme])) {
        const source = name === 'paper' ? upstream[theme].sheet : upstream[theme][name];
        assert.equal(hex, source, `${theme}.${name}`);
      }
    }
    assert.deepEqual(tokenGutterPx, { pair: 12, scene: 20, change: 32 });
    assert.equal(tokenMotion.fps, upstream.motion.fps);
  });

  it('translates the 12/20/32 px gutters to 1/2/3 cells, preserving order', () => {
    assert.deepEqual(GUTTER_CELLS, { pair: 1, scene: 2, change: 3 });
    assert.ok(tokenGutterPx.pair < tokenGutterPx.scene && tokenGutterPx.scene < tokenGutterPx.change);
  });
});

describe('tokens: color levels', () => {
  it('computes the xterm-256 palette', () => {
    assert.deepEqual(xterm256Rgb(16), [0, 0, 0]);
    assert.deepEqual(xterm256Rgb(196), [255, 0, 0]);
    assert.deepEqual(xterm256Rgb(220), [255, 215, 0]);
    assert.deepEqual(xterm256Rgb(231), [255, 255, 255]);
    assert.deepEqual(xterm256Rgb(232), [8, 8, 8]);
    assert.deepEqual(xterm256Rgb(255), [238, 238, 238]);
    assert.throws(() => xterm256Rgb(15));
  });

  it('picks the nearest 256 index (never 0–15) for every token, minimizing distance', () => {
    const dist = (a, b) => {
      const rm = (a[0] + b[0]) / 2;
      return (2 + rm / 256) * (a[0] - b[0]) ** 2 + 4 * (a[1] - b[1]) ** 2 + (2 + (255 - rm) / 256) * (a[2] - b[2]) ** 2;
    };
    for (const theme of ['light', 'dark']) {
      for (const hex of Object.values(tokenPalette[theme])) {
        const idx = nearestAnsi256(hex);
        assert.ok(idx >= 16 && idx <= 255);
        const d = dist(hexToRgb(hex), xterm256Rgb(idx));
        for (let i = 16; i <= 255; i++) assert.ok(dist(hexToRgb(hex), xterm256Rgb(i)) >= d, `${hex}: ${i} is closer than ${idx}`);
      }
    }
    assert.equal(nearestAnsi256('#ffd60a'), 220, 'marker (matches Repo Archaeology)');
    assert.equal(nearestAnsi256('#121212'), 233, 'marker-ink');
    assert.equal(nearestAnsi256('#ffffff'), 231);
    assert.equal(nearestAnsi256('#000000'), 16);
  });

  it('has a hand-tuned 16-color entry for every token in both themes', () => {
    for (const theme of ['light', 'dark']) {
      assert.deepEqual(Object.keys(ANSI16[theme]).sort(), Object.keys(tokenPalette[theme]).sort());
      for (const { fg, bg } of Object.values(ANSI16[theme])) {
        assert.ok((fg >= 30 && fg <= 37) || (fg >= 90 && fg <= 97));
        assert.ok((bg >= 40 && bg <= 47) || (bg >= 100 && bg <= 107));
      }
    }
    assert.equal(ANSI16.light.marker.bg, 103, 'bright yellow: standard yellow is olive in many themes');
    assert.equal(tokenSgr('marker', 'light', 'truecolor', 'bg'), '48;2;255;214;10');
    assert.equal(tokenSgr('marker', 'light', 'ansi256', 'bg'), '48;5;220');
    assert.equal(tokenSgr('ink', 'dark', 'ansi16', 'fg'), '97');
    assert.equal(tokenSgr('ink', 'dark', 'mono', 'fg'), '');
  });

  it('maps capabilities to style levels', () => {
    assert.equal(styleLevel(3, true), 'truecolor');
    assert.equal(styleLevel(2, true), 'ansi256');
    assert.equal(styleLevel(1, true), 'ansi16');
    assert.equal(styleLevel(0, true), 'mono');
    assert.equal(styleLevel(0, false), 'none');
  });
});

describe('tokens: roles obey the grammar', () => {
  const params = (role, level) => {
    const { open } = roleSgr(role, level);
    return open === '' ? [] : open.slice(2, -1).split(';');
  };

  it('emits nothing at all at level none', () => {
    for (const role of ROLES) {
      assert.deepEqual(roleSgr(role, 'none'), { open: '', close: '' });
      assert.equal(paint('x', role, 'none'), 'x');
    }
  });

  it('uses only bold, dim, underline and inverse at mono', () => {
    for (const role of ROLES) for (const p of params(role, 'mono')) assert.ok(['1', '2', '4', '7'].includes(p), `${role}: ${p}`);
    assert.notDeepEqual(roleSgr('status-danger', 'mono'), roleSgr('marker', 'mono'), 'inverse is reserved for the one marker chip at mono');
  });

  it('never paints yellow as a foreground, and sets marker yellow only as a background', () => {
    for (const level of LEVELS) {
      for (const role of ROLES) {
        const open = roleSgr(role, level).open;
        assert.ok(!/(?:^|\[|;)(?:33|93)(?:;|m)/.test(open), `${role}@${level}: SGR 33/93`);
        assert.ok(!/38;5;(?:220|226|11|3)\b/.test(open), `${role}@${level}: 256 yellow foreground`);
        assert.ok(!/38;2;255;214;10/.test(open), `${role}@${level}: marker as foreground`);
      }
    }
    assert.match(roleSgr('marker', 'ansi16').open, /103;30/);
    assert.match(roleSgr('marker', 'truecolor').open, /48;2;255;214;10;38;2;18;18;18/);
  });

  it('never fixes ink to a color: ink follows the terminal foreground at every level', () => {
    for (const level of LEVELS) {
      for (const role of ROLES.filter((r) => r !== 'marker')) {
        assert.ok(!/38;|48;|\b(3\d|4\d|9\d|10\d)\b/.test(roleSgr(role, level).open), `${role}@${level}`);
      }
    }
  });

  it('nests safely: an inner role ending never ends the outer role early (review regression)', () => {
    for (const level of ['mono', 'ansi16', 'ansi256', 'truecolor']) {
      const dim = roleSgr('ink2', level);
      const out = paint(`dim ${paint('bold', 'strong', level)} still dim`, 'ink2', level);
      const tail = out.slice(out.indexOf('bold'));
      // After the bold part closes, dim is opened again before " still dim".
      assert.ok(tail.includes(`\u001b[22m${dim.open} still dim`), `${level}: ${JSON.stringify(out)}`);
      const marker = roleSgr('marker', level);
      const chip = paint(`F-01 ${paint('!', 'status-danger', level)} hero`, 'marker', level);
      assert.ok(chip.slice(chip.indexOf('!')).includes(marker.open), `${level}: the marker chip resumes after a nested status`);
      assert.equal(paint('plain', 'ink2', level), `${dim.open}plain${dim.close}`, 'no extra sequences without nesting');
    }
  });

  it('closes what it opens', () => {
    for (const level of LEVELS) {
      for (const role of ROLES) {
        const { open, close } = roleSgr(role, level);
        assert.equal(open === '', close === '');
        assert.equal(paint('', role, level), '', 'empty text gets no escapes');
      }
    }
  });
});
