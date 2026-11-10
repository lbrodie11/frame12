import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { GLYPHS, eastAsianWidthClass, glyph, stringWidth } from '@frame12/terminal';

describe('glyphs: the one table of non-ASCII glyphs', () => {
  for (const [name, g] of Object.entries(GLYPHS)) {
    it(`${name} (${g.char})`, () => {
      assert.equal([...g.char].length, 1, 'one code point');
      const cls = eastAsianWidthClass(g.char.codePointAt(0));
      assert.notEqual(cls, 'W', 'wide glyphs are never used');
      assert.equal(cls === 'A' ? 'A' : 'N', g.eaw, 'the table states the real UAX #11 class');
      assert.ok(!/\p{Emoji}/u.test(g.char), 'no emoji-capable code points (they may render as pictures)');
      assert.match(g.ascii, /^[\x21-\x7e]+$/, 'the twin is printable ASCII');
      assert.ok(g.use.length > 0);
    });
  }

  it('substitutes the twin for ambiguous glyphs when ambiguous renders wide, and for every glyph without Unicode', () => {
    for (const [name, g] of Object.entries(GLYPHS)) {
      assert.equal(glyph(name, { unicode: false, ambiguousWide: false }), g.ascii);
      assert.equal(glyph(name, { unicode: true, ambiguousWide: false }), g.char);
      assert.equal(glyph(name, { unicode: true, ambiguousWide: true }), g.eaw === 'A' ? g.ascii : g.char);
      const shown = glyph(name, { unicode: true, ambiguousWide: true });
      assert.equal(stringWidth(shown, { ambiguousWide: true }), [...shown].length, `${name} keeps one cell per character`);
    }
  });
});
