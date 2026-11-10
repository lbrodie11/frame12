import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'node:test';
import { GLYPHS, stringWidth, stripAnsi, tokenSgr } from '@frame12/terminal';
import { CUT_STATUS_WORDS, FINDING_STATUS_WORDS, renderRich } from '@frame12/terminal/render';
import { fixture, FIXTURE_NAMES } from '@frame12/terminal/testing';
import { GALLERY_FIXTURES, LEVELS, WIDTHS, galleryFiles } from '../scripts/gallery.mjs';

const files = galleryFiles();
const rich = [...files].filter(([k]) => /rich-\d+-\w+\.ansi$/.test(k));

/** Every SGR parameter list in a string, with extended-color operands kept together. */
function sgrs(text) {
  return [...text.matchAll(/\u001b\[([0-9;]*)m/g)].map((m) => m[1]);
}

/** Foreground colors set by an SGR list (ignores background and color operands). */
function foregrounds(params) {
  const ps = params.split(';');
  const out = [];
  for (let i = 0; i < ps.length; i++) {
    if (ps[i] === '38' && ps[i + 1] === '5') (out.push(`38;5;${ps[i + 2]}`), (i += 2));
    else if (ps[i] === '38' && ps[i + 1] === '2') (out.push(`38;2;${ps.slice(i + 2, i + 5).join(';')}`), (i += 4));
    else if (ps[i] === '48' || ps[i] === '58') i += ps[i + 1] === '5' ? 2 : 4;
    else if (/^(3[0-7]|9[0-7])$/.test(ps[i])) out.push(ps[i]);
  }
  return out;
}

const BOX = /[┌┐└┘│├┤┬┴┼═║╔╗╚╝╭╮╯╰┏┓┗┛]/u;

describe('grammar rules on every gallery render', () => {
  it(`covers the full matrix: ${GALLERY_FIXTURES.length} fixtures × ${WIDTHS.length} widths × ${LEVELS.length} color levels`, () => {
    assert.equal(rich.length, GALLERY_FIXTURES.length * WIDTHS.length * LEVELS.length);
  });

  it('never exceeds the width, and never leaves trailing spaces', () => {
    for (const [key, body] of files) {
      const m = /-(40|80|120)/.exec(key);
      if (!m) continue;
      for (const line of body.split('\n')) {
        assert.ok(stringWidth(line) <= Number(m[1]), `${key}: ${JSON.stringify(stripAnsi(line))}`);
        assert.ok(!/ $/.test(stripAnsi(line)), `${key}: trailing space`);
      }
    }
  });

  it('keeps every line within the terminal at every width from 20 to 130, for every fixture (review of PR #33)', () => {
    // verbose is excluded on purpose: it prints each truncated path in full on its own line.
    const steps = [{ command: 'frame12-term render --from run.f12rec --replay --verbose --speed 2 --format rich', description: 'Replay this run.' }];
    let renders = 0;
    for (const name of FIXTURE_NAMES) {
      const snap = fixture(name).snapshot;
      for (let columns = 20; columns <= 130; columns++) {
        for (const [unicode, ambiguousWide] of [[true, false], [false, false], [true, true]]) {
          const out = renderRich(snap, { style: 'truecolor', unicode, ambiguousWide, links: false, columns }, { nextSteps: steps });
          renders++;
          for (const line of out.split('\n')) assert.ok(stringWidth(line, { ambiguousWide }) <= columns, `${name}@${columns} unicode=${unicode} wide=${ambiguousWide}: ${JSON.stringify(stripAnsi(line))}`);
        }
      }
    }
    assert.equal(renders, FIXTURE_NAMES.length * 111 * 3);
  });

  it('uses at most one marker chip, and exactly one when there is a top finding (styled levels)', () => {
    for (const [key, body] of rich) {
      const level = /-(\w+)\.ansi$/.exec(key)[1];
      const name = key.split('/')[0];
      const markerBg = { truecolor: tokenSgr('marker', 'light', 'truecolor', 'bg'), ansi256: tokenSgr('marker', 'light', 'ansi256', 'bg'), ansi16: '103', mono: '1;7' }[level];
      const chips = sgrs(body).filter((p) => (level === 'mono' ? p === markerBg : p.split(';').join(';').includes(markerBg))).length;
      const hasHero = fixture(name).snapshot.findings.some((f) => f.prominence === 'hero');
      assert.equal(chips, hasHero ? 1 : 0, `${key}: ${chips} marker chips`);
    }
  });

  it('never paints yellow as a foreground (SGR 33, 93, 38;5;220/226/11/3, or the marker hex)', () => {
    for (const [key, body] of [...rich, ...[...files].filter(([k]) => k.includes('terminal-'))]) {
      for (const params of sgrs(body)) {
        for (const fg of foregrounds(params)) {
          assert.ok(!['33', '93', '38;5;220', '38;5;226', '38;5;11', '38;5;3', '38;2;255;214;10'].includes(fg), `${key}: yellow foreground ${fg}`);
        }
      }
    }
  });

  it('draws no box frames: only the rule and the hero rule appear from box drawing', () => {
    for (const [key, body] of files) assert.ok(!BOX.test(body), `${key} contains box-drawing frame characters`);
  });

  it('reserves the heavy left rule for the top finding', () => {
    for (const name of GALLERY_FIXTURES) {
      const text = files.get(`${name}/rich-80.txt`);
      const heroLines = text.split('\n').filter((l) => l.startsWith(GLYPHS.heroRule.char)).length;
      const hasHero = fixture(name).snapshot.findings.some((f) => f.prominence === 'hero');
      assert.equal(heroLines > 0, hasHero, name);
    }
  });

  it('gives every status a word', () => {
    for (const name of GALLERY_FIXTURES) {
      const snap = fixture(name).snapshot;
      const text = files.get(`${name}/rich-80.txt`);
      for (const c of snap.cuts.filter((c) => c.status !== 'ok')) assert.ok(text.includes(CUT_STATUS_WORDS[c.status]), `${name}: cut ${c.cut}`);
      for (const f of snap.findings) assert.ok(text.includes(FINDING_STATUS_WORDS[f.status]), `${name}: ${f.id}`);
      assert.ok(text.includes(snap.status), `${name}: run status word`);
      for (const ch of [GLYPHS.ok.char, GLYPHS.error.char, GLYPHS.skipped.char, GLYPHS.canceled.char]) {
        for (const line of text.split('\n').filter((l) => l.includes(ch))) assert.match(line, /done|completed|failed|skipped|canceled/, `${name}: glyph without a word: ${line}`);
      }
    }
  });

  it('uses only ASCII twins with --ascii, and no ambiguous glyphs when ambiguous renders wide', () => {
    const snap = fixture('forty-findings').snapshot;
    const ascii = renderRich(snap, { style: 'truecolor', unicode: false, ambiguousWide: false, links: false, columns: 80 });
    assert.match(stripAnsi(ascii), /^[\x20-\x7e\n]*$/, 'pure ASCII (fixture text is ASCII)');
    const cjk = renderRich(snap, { style: 'truecolor', unicode: true, ambiguousWide: true, links: false, columns: 80 });
    for (const g of Object.values(GLYPHS).filter((g) => g.eaw === 'A')) assert.ok(!cjk.includes(g.char), `${g.char} printed under ambiguousWide`);
    for (const line of cjk.split('\n')) assert.ok(stringWidth(line, { ambiguousWide: true }) <= 80);
  });

  it('labels a replayed snapshot REPLAY', () => {
    const out = stripAnsi(renderRich({ ...fixture('success').snapshot, replay: true }, { style: 'none', unicode: true, ambiguousWide: false, links: false, columns: 80 }));
    assert.match(out.split('\n')[0], /^REPLAY/);
  });

  it('gallery --check reports missing goldens instead of crashing when gallery/ is absent', async () => {
    const { spawnSync } = await import('node:child_process');
    const os = await import('node:os');
    const path = await import('node:path');
    const pkg = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'f12-gallery-'));
    try {
      // A copy of the package without gallery/ (scripts copied; dist linked, it imports only itself).
      fs.cpSync(path.join(pkg, 'scripts'), path.join(tmp, 'scripts'), { recursive: true });
      fs.symlinkSync(path.join(pkg, 'dist'), path.join(tmp, 'dist'), 'junction');
      const r = spawnSync(process.execPath, ['scripts/gallery.mjs', '--check'], { cwd: tmp, encoding: 'utf8' });
      assert.equal(r.status, 1, r.stderr);
      assert.match(r.stderr, /Gallery goldens differ/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('gallery --check reports goldens left behind by a removed fixture, width or level (review of PR #33)', async () => {
    const { spawnSync } = await import('node:child_process');
    const stale = new URL('../gallery/success/rich-200-truecolor.ansi', import.meta.url);
    fs.writeFileSync(stale, 'left behind\n');
    try {
      const r = spawnSync(process.execPath, ['scripts/gallery.mjs', '--check'], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
      assert.equal(r.status, 1);
      assert.match(r.stderr, /rich-200-truecolor\.ansi \(stale\)/);
    } finally {
      fs.rmSync(stale, { force: true });
    }
  });

  it('the committed gallery is current (npm run gallery)', () => {
    for (const [rel, body] of files) assert.equal(fs.readFileSync(new URL(`../gallery/${rel}`, import.meta.url), 'utf8'), body, rel);
  });
});
