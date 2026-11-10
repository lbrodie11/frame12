/**
 * Every non-ASCII glyph the FRAME/12 terminal grammar prints, in one table.
 *
 * The rule (enforced by tests/glyphs.test.mjs against the UAX #11 table):
 * - East Asian Width `N` / `Na` glyphs are always allowed.
 * - Ambiguous (`A`) glyphs are allowed only because each has an ASCII twin: when ambiguous
 *   characters render 2 cells wide (`ambiguousWide`), the twin is printed so columns stay aligned.
 * - Wide (`W`) glyphs and emoji-capable code points are never used.
 * - When Unicode is off (`--ascii`, `TERM=dumb`, legacy console), every glyph uses its twin.
 */

export interface GlyphSpec {
  /** The Unicode glyph (one code point, text presentation). */
  char: string;
  /** Its East Asian Width class (UAX #11), checked by the tests. */
  eaw: 'N' | 'A';
  /** The printable-ASCII twin. */
  ascii: string;
  /** What it means. Glyphs never carry meaning alone; a word is always printed too. */
  use: string;
}

export const GLYPHS = {
  ok: { char: '✓', eaw: 'N', ascii: '[ok]', use: 'cut finished (with the word "done")' },
  warning: { char: '▲', eaw: 'A', ascii: '[warn]', use: 'warning (with the word "warning")' },
  error: { char: '✕', eaw: 'N', ascii: '[fail]', use: 'cut failed (with the word "failed")' },
  skipped: { char: '○', eaw: 'A', ascii: '[skip]', use: 'cut skipped (with the word "skipped")' },
  canceled: { char: '⊘', eaw: 'N', ascii: '[cancel]', use: 'cut canceled (with the word "canceled")' },
  rule: { char: '─', eaw: 'A', ascii: '-', use: 'the masthead rule' },
  heroRule: { char: '┃', eaw: 'A', ascii: '|', use: 'heavy left rule of the hero finding only' },
  historyLink: { char: '⇢', eaw: 'N', ascii: '~>', use: 'subjects change together with no code link' },
  directLink: { char: '→', eaw: 'A', ascii: '->', use: 'one subject references the other' },
  toneOn: { char: '▰', eaw: 'N', ascii: '#', use: 'filled tone-bar cell' },
  toneOff: { char: '▱', eaw: 'N', ascii: '-', use: 'empty tone-bar cell' },
  dot: { char: '·', eaw: 'A', ascii: '-', use: 'separator between label parts' },
  ellipsis: { char: '…', eaw: 'A', ascii: '...', use: 'truncation' },
  rangeDash: { char: '–', eaw: 'A', ascii: '-', use: 'numeric range (41–79%)' },
} as const satisfies Record<string, GlyphSpec>;

export type GlyphName = keyof typeof GLYPHS;

export interface GlyphCaps {
  unicode: boolean;
  ambiguousWide: boolean;
}

/** The glyph to print: Unicode when allowed, otherwise (or when ambiguous renders wide) its twin. */
export function glyph(name: GlyphName, caps: GlyphCaps): string {
  const g: GlyphSpec = GLYPHS[name];
  if (!caps.unicode) return g.ascii;
  if (g.eaw === 'A' && caps.ambiguousWide) return g.ascii;
  return g.char;
}
