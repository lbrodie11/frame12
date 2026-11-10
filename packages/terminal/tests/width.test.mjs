import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  EAST_ASIAN_WIDTH_UNICODE_VERSION,
  codePointWidth,
  eastAsianWidthClass,
  graphemeWidth,
  graphemes,
  padEnd,
  stringWidth,
  stripAnsi,
  truncateEnd,
  truncateMiddle,
  wrap,
} from '@frame12/terminal';
import { rng } from './helpers.mjs';

const narrow = {};
const wide = { ambiguousWide: true };

describe('width: golden tables', () => {
  // [label, text, width, width under ambiguousWide]
  const golden = [
    ['ASCII', 'hello', 5, 5],
    ['empty', '', 0, 0],
    ['CJK ideographs', '漢字', 4, 4],
    ['Hiragana', 'ひらがな', 8, 8],
    ['Hangul syllables', '한국어', 6, 6],
    ['Hangul conjoining jamo (one syllable)', '각', 2, 2],
    ['fullwidth Latin', 'ＡＢＣ', 6, 6],
    ['halfwidth Katakana', 'ｶﾀｶﾅ', 4, 4],
    ['CJK punctuation', '「」、。', 8, 8],
    ['emoji (presentation)', '😀', 2, 2],
    ['emoji ZWJ family', '👨‍👩‍👧‍👦', 2, 2],
    ['emoji ZWJ profession', '🧑‍💻', 2, 2],
    ['rainbow flag (VS16 + ZWJ)', '🏳️‍🌈', 2, 2],
    ['flag (regional indicators)', '🇯🇵', 2, 2],
    ['two flags', '🇯🇵🇺🇸', 4, 4],
    ['skin-tone modifier', '👍🏽', 2, 2],
    ['skin-tone ZWJ sequence', '👩🏽‍🚀', 2, 2],
    ['text-default pictograph', '❤', 1, 1],
    ['text-default pictograph + VS16', '❤️', 2, 2],
    ['emoji-default + VS15 (text)', '⌚︎', 1, 1],
    ['keycap sequence', '1️⃣', 2, 2],
    ['combining acute (NFD é)', 'é', 1, 1],
    ['stacked combining marks', 'à́̂', 1, 1],
    ['Devanagari with virama', 'क्षि', 1, 1],
    ['zero-width space', 'a​b', 2, 2],
    ['soft hyphen', 'a­b', 2, 2],
    ['box drawing (ambiguous)', '─┃', 2, 4],
    ['black up-pointing triangle (ambiguous)', '▲', 1, 2],
    ['ellipsis (ambiguous)', '…', 1, 2],
    ['tone bar glyphs ▰▱ (narrow)', '▰▱', 2, 2],
    ['arrows (ambiguous →, narrow ⇢)', '→⇢', 2, 3],
    ['check and cross (narrow)', '✓✕', 2, 2],
    ['Greek (ambiguous)', 'αβ', 2, 4],
    ['Cyrillic (ambiguous Ё)', 'Ё', 1, 2],
    ['mixed (é is ambiguous)', 'a漢😀é', 6, 7],
  ];
  for (const [label, text, w, ww] of golden) {
    it(label, () => {
      assert.equal(stringWidth(text, narrow), w, `narrow ${JSON.stringify(text)}`);
      assert.equal(stringWidth(text, wide), ww, `ambiguous-wide ${JSON.stringify(text)}`);
    });
  }

  it('reads UAX #11 from the Unicode 17.0.0 table', () => {
    assert.equal(EAST_ASIAN_WIDTH_UNICODE_VERSION, '17.0.0');
    assert.equal(eastAsianWidthClass(0x4e00), 'W');
    assert.equal(eastAsianWidthClass(0xff21), 'W');
    assert.equal(eastAsianWidthClass(0x2500), 'A');
    assert.equal(eastAsianWidthClass(0x0041), 'N');
    assert.equal(codePointWidth(0x0301), 0);
    assert.equal(codePointWidth(0x1b), 0);
    assert.equal(graphemeWidth('́'), 0, 'a lone combining mark has no base');
  });

  it('ignores SGR and OSC 8 sequences when measuring', () => {
    const styled = '\u001b[1;7m F-01 \u001b[22;27m \u001b]8;;https://e.com\u001b\\abc\u001b]8;;\u001b\\';
    assert.equal(stripAnsi(styled), ' F-01  abc');
    assert.equal(stringWidth(styled), 10);
  });
});

describe('width: truncation', () => {
  it('middle-truncates paths keeping the file name, within the limit', () => {
    const r = truncateMiddle('packages/terminal/src/core/capabilities.ts', 24);
    assert.equal(r.truncated, true);
    assert.equal(stringWidth(r.text), 24);
    assert.ok(r.text.endsWith('/capabilities.ts'), r.text);
    assert.ok(r.text.startsWith('pack'), r.text);
    assert.equal(truncateMiddle('short.ts', 24).text, 'short.ts');
    assert.equal(truncateMiddle('abcdefghij', 6, { ellipsis: '...' }).text, 'a...ij');
  });

  it('never splits a grapheme and never exceeds the limit (property, 3,000 cases)', () => {
    const r = rng(11);
    const atoms = ['a', '/', '漢', '👨‍👩‍👧', '🇯🇵', 'é', '👍🏽', '─', 'ｶ', '.ts'];
    for (let i = 0; i < 3000; i++) {
      const text = Array.from({ length: r.int(0, 30) }, () => r.pick(atoms)).join('');
      const opts = { ambiguousWide: r.next() < 0.5, ellipsis: r.next() < 0.5 ? '…' : '...' };
      const max = r.int(1, 40);
      for (const out of [truncateMiddle(text, max, opts).text, truncateEnd(text, max, opts)]) {
        assert.ok(stringWidth(out, opts) <= max, `${JSON.stringify(text)} @${max} → ${JSON.stringify(out)}`);
        const allowed = new Set([...graphemes(text), ...graphemes(opts.ellipsis)]);
        for (const g of graphemes(out)) assert.ok(allowed.has(g), `split grapheme in ${JSON.stringify(out)}`);
      }
    }
  });

  it('measures the ellipsis honestly under ambiguous-wide', () => {
    const out = truncateEnd('abcdefghij', 6, wide);
    assert.equal(out, 'abcd…');
    assert.equal(stringWidth(out, wide), 6);
  });
});

describe('width: wrapping', () => {
  it('never breaks inside a path or URL unless it alone exceeds the line', () => {
    const text = 'Changed src/settlement/payout-runner.ts and https://github.com/acme/payments/commit/a19f02b together';
    const lines = wrap(text, 52);
    assert.ok(lines.some((l) => l.includes('src/settlement/payout-runner.ts')));
    assert.ok(lines.some((l) => l.includes('https://github.com/acme/payments/commit/a19f02b')));
    const long = wrap('see /a/very/long/path/that/cannot/possibly/fit/on/one/line.ts', 20);
    assert.ok(long.every((l) => stringWidth(l) <= 20));
    assert.equal(long.join('').replace(/^see/, 'see '), 'see /a/very/long/path/that/cannot/possibly/fit/on/one/line.ts');
  });

  it('keeps newlines and indents continuation lines only', () => {
    assert.deepEqual(wrap('one two three four', 9, { indent: '  ' }), ['one two', '  three', '  four']);
    assert.deepEqual(wrap('a\nb c', 3, { indent: ' ' }), ['a', 'b c']);
  });

  it('never exceeds the width (property, 3,000 cases, CJK and emoji included)', () => {
    const r = rng(29);
    const atoms = ['word', 'a', ' ', ' ', 'src/a/b/c.ts', 'https://e.com/x/y', '漢字かな', '👨‍👩‍👧', '🇯🇵', 'é', '─', 'x'.repeat(50)];
    for (let i = 0; i < 3000; i++) {
      const text = Array.from({ length: r.int(0, 25) }, () => r.pick(atoms)).join(r.next() < 0.8 ? ' ' : '');
      const width = r.int(2, 80);
      const opts = { ambiguousWide: r.next() < 0.5, indent: r.pick(['', '  ', '     ']) };
      const lines = wrap(text, width, opts);
      for (const l of lines) assert.ok(stringWidth(l, opts) <= width, `${JSON.stringify(text)} @${width}: ${JSON.stringify(l)}`);
      const allowed = new Set([...graphemes(text), ...graphemes(opts.indent)]);
      for (const l of lines) for (const g of graphemes(l)) assert.ok(allowed.has(g), 'wrap split a grapheme');
    }
  });

  it('pads by cells, not code units', () => {
    assert.equal(padEnd('漢', 4), '漢  ');
    assert.equal(stringWidth(padEnd('👨‍👩‍👧', 5)), 5);
    assert.equal(padEnd('toolong', 3), 'toolong');
  });
});
