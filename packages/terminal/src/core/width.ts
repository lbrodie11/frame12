/**
 * Display width in terminal cells.
 *
 * - Text is measured per grapheme cluster (UAX #29, via `Intl.Segmenter`), never per code unit.
 * - East Asian Wide and Fullwidth (UAX #11 W/F) are 2 cells. Ambiguous (A) is 1 cell, or 2 when
 *   `ambiguousWide` is set (`FRAME12_AMBIGUOUS_WIDE=1` or a CJK locale; see `detectCapabilities`).
 * - Emoji presentation (W emoji, or a pictograph followed by VS16), ZWJ sequences, flags and
 *   skin-tone sequences are 2 cells. Combining marks and default-ignorable code points are 0.
 *
 * Layout functions (`truncateMiddle`, `wrap`, `padEnd`) take plain, sanitized text. Apply styling
 * after layout; `stringWidth` ignores SGR and OSC sequences so styled text can still be measured.
 */
import { AMBIGUOUS_RANGES, WIDE_RANGES } from './east-asian-width.generated.js';

export { EAST_ASIAN_WIDTH_UNICODE_VERSION } from './east-asian-width.generated.js';

export interface WidthOptions {
  /** Render East Asian ambiguous-width characters 2 cells wide. Default false. */
  ambiguousWide?: boolean;
}

const SEGMENTER = new Intl.Segmenter('en', { granularity: 'grapheme' });
const ZERO_WIDTH_RE = /^[\p{Mn}\p{Me}\p{Default_Ignorable_Code_Point}]$/u;
const PICTOGRAPHIC_RE = /^\p{Extended_Pictographic}$/u;
const KEYCAP_BASE_RE = /^[0-9#*]$/;

function inRanges(cp: number, ranges: readonly number[]): boolean {
  let lo = 0;
  let hi = ranges.length / 2 - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const start = ranges[mid * 2]!;
    const end = ranges[mid * 2 + 1]!;
    if (cp < start) hi = mid - 1;
    else if (cp > end) lo = mid + 1;
    else return true;
  }
  return false;
}

/** UAX #11 class of a code point, reduced to what layout needs. */
export function eastAsianWidthClass(cp: number): 'W' | 'A' | 'N' {
  if (inRanges(cp, WIDE_RANGES)) return 'W';
  if (inRanges(cp, AMBIGUOUS_RANGES)) return 'A';
  return 'N';
}

/** Width of a single code point in isolation: 0, 1 or 2. */
export function codePointWidth(cp: number, options: WidthOptions = {}): 0 | 1 | 2 {
  if (cp < 0x20 || (cp >= 0x7f && cp < 0xa0)) return 0;
  if (cp >= 0x1160 && cp <= 0x11ff) return 0; // Hangul medial vowels and final consonants join the syllable.
  if (ZERO_WIDTH_RE.test(String.fromCodePoint(cp))) return 0;
  const cls = eastAsianWidthClass(cp);
  if (cls === 'W') return 2;
  if (cls === 'A') return options.ambiguousWide ? 2 : 1;
  return 1;
}

function isRegionalIndicator(cp: number): boolean {
  return cp >= 0x1f1e6 && cp <= 0x1f1ff;
}

/** Width of one grapheme cluster: 0, 1 or 2. */
export function graphemeWidth(cluster: string, options: WidthOptions = {}): 0 | 1 | 2 {
  let base: number | undefined;
  let regional = 0;
  let vs16 = false;
  let vs15 = false;
  let zwj = false;
  for (const ch of cluster) {
    const cp = ch.codePointAt(0)!;
    if (cp === 0xfe0f) vs16 = true;
    else if (cp === 0xfe0e) vs15 = true;
    else if (cp === 0x200d) zwj = true;
    if (isRegionalIndicator(cp)) regional++;
    if (base === undefined && codePointWidth(cp, options) > 0) base = cp;
  }
  if (regional >= 2) return 2; // A flag.
  if (base === undefined) return 0;
  const baseChar = String.fromCodePoint(base);
  const pictographic = PICTOGRAPHIC_RE.test(baseChar);
  if (pictographic && vs15) return 1; // Text presentation requested.
  if (vs16 && (pictographic || KEYCAP_BASE_RE.test(baseChar))) return 2; // Emoji presentation.
  if (zwj && pictographic) return 2;
  return codePointWidth(base, options);
}

/** Splits text into grapheme clusters. */
export function graphemes(text: string): string[] {
  return Array.from(SEGMENTER.segment(text), (s) => s.segment);
}

// CSI (incl. SGR) and OSC (incl. OSC 8 links) sequences emitted by this package.
const ANSI_RE = /\u001b\[[0-?]*[ -/]*[@-~]|\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)/g;

/** Removes CSI and OSC sequences (e.g. this package's own SGR styling and OSC 8 links). */
export function stripAnsi(text: string): string {
  return text.replace(ANSI_RE, '');
}

/** Display width of a string in cells. Styling sequences count as 0. */
export function stringWidth(text: string, options: WidthOptions = {}): number {
  const plain = stripAnsi(text);
  // Fast path: printable ASCII is one cell per character.
  if (/^[\x20-\x7e]*$/.test(plain)) return plain.length;
  let width = 0;
  for (const { segment } of SEGMENTER.segment(plain)) width += graphemeWidth(segment, options);
  return width;
}

/** Pads plain text with spaces to `width` cells (never truncates). */
export function padEnd(text: string, width: number, options: WidthOptions = {}): string {
  const w = stringWidth(text, options);
  return w >= width ? text : text + ' '.repeat(width - w);
}

export interface TruncateOptions extends WidthOptions {
  /** Marker for removed text. Default `…`; pass `...` when glyphs must be ASCII. */
  ellipsis?: string;
}

/** Keeps the start of plain text so it fits `max` cells, never splitting a grapheme. */
export function truncateEnd(text: string, max: number, options: TruncateOptions = {}): string {
  if (stringWidth(text, options) <= max) return text;
  const ellipsis = options.ellipsis ?? '…';
  const budget = max - stringWidth(ellipsis, options);
  if (budget < 1) return fitWithoutEllipsis(text, max, options);
  let out = '';
  let w = 0;
  for (const g of graphemes(text)) {
    const gw = graphemeWidth(g, options);
    if (w + gw > budget) break;
    out += g;
    w += gw;
  }
  return out + ellipsis;
}

function fitWithoutEllipsis(text: string, max: number, options: WidthOptions): string {
  let out = '';
  let w = 0;
  for (const g of graphemes(text)) {
    const gw = graphemeWidth(g, options);
    if (w + gw > max) break;
    out += g;
    w += gw;
  }
  return out;
}

/**
 * Middle-truncates plain text (typically a path) to fit `max` cells, keeping its head and tail
 * (the file name). Never splits a grapheme; the result is never wider than `max`.
 */
export function truncateMiddle(text: string, max: number, options: TruncateOptions = {}): { text: string; truncated: boolean } {
  if (stringWidth(text, options) <= max) return { text, truncated: false };
  const ellipsis = options.ellipsis ?? '…';
  const budget = max - stringWidth(ellipsis, options);
  if (budget < 2) return { text: fitWithoutEllipsis(text, max, options), truncated: true };
  const gs = graphemes(text);
  // Favor the tail: the end of a path (the file name) carries the most meaning. Keep the whole
  // file name when it fits beside a few cells of head; otherwise split the budget evenly.
  const slash = Math.max(text.lastIndexOf('/'), text.lastIndexOf('\\'));
  const baseW = slash >= 0 ? stringWidth(text.slice(slash), options) : 0;
  const minHead = Math.min(4, Math.floor(budget / 3));
  const tailBudget = baseW > 0 && baseW <= budget - minHead ? Math.max(Math.ceil(budget / 2), baseW) : Math.ceil(budget / 2);
  const headBudget = budget - tailBudget;
  let tail = '';
  let tailW = 0;
  let tailStart = gs.length;
  for (let i = gs.length - 1; i >= 0; i--) {
    const gw = graphemeWidth(gs[i]!, options);
    if (tailW + gw > tailBudget) break;
    tail = gs[i] + tail;
    tailW += gw;
    tailStart = i;
  }
  let head = '';
  let headW = 0;
  const headLimit = headBudget + (tailBudget - tailW); // Give unused tail cells to the head.
  for (let i = 0; i < tailStart; i++) {
    const gw = graphemeWidth(gs[i]!, options);
    if (headW + gw > headLimit) break;
    head += gs[i];
    headW += gw;
  }
  return { text: `${head}${ellipsis}${tail}`, truncated: true };
}

export interface WrapOptions extends WidthOptions {
  /** Prefix for every line after the first (counted against the width). Default ''. */
  indent?: string;
}

/**
 * Wraps plain text to `width` cells. Breaks only at spaces, so a path or URL is never split unless
 * that token alone is wider than the line, in which case it is broken between graphemes.
 * Existing newlines are kept. Every returned line is at most `width` cells (for `width` >= 2).
 */
export function wrap(text: string, width: number, options: WrapOptions = {}): string[] {
  const max = Math.max(2, Math.floor(width));
  let indent = options.indent ?? '';
  if (stringWidth(indent, options) > max - 2) indent = '';
  const indentW = stringWidth(indent, options);
  const lines: string[] = [];

  for (const paragraph of text.split('\n')) {
    let line = '';
    let lineW = 0;
    let count = 0; // Lines emitted for this paragraph: only continuation lines are indented.
    const prefix = () => (count === 0 ? '' : indent);
    const prefixW = () => (count === 0 ? 0 : indentW);
    const flush = () => {
      lines.push(prefix() + line);
      count++;
      line = '';
      lineW = 0;
    };
    const words = paragraph.split(' ');
    words.forEach((word, i) => {
      const wordW = stringWidth(word, options);
      const sep = i === 0 || line === '' ? '' : ' ';
      const avail = max - prefixW();
      if (lineW + sep.length + wordW <= avail) {
        line += sep + word;
        lineW += sep.length + wordW;
        return;
      }
      if (line !== '') flush();
      const freshAvail = max - prefixW();
      if (wordW <= freshAvail) {
        line = word;
        lineW = wordW;
        return;
      }
      // The token alone is wider than a line: break it between graphemes.
      for (const g of graphemes(word)) {
        const gw = graphemeWidth(g, options);
        if (lineW + gw > max - prefixW() && line !== '') flush();
        line += g;
        lineW += gw;
      }
    });
    lines.push(prefix() + line);
  }
  return lines;
}
