export { EAST_ASIAN_WIDTH_UNICODE_VERSION } from './east-asian-width.generated.js';
export interface WidthOptions {
    /** Render East Asian ambiguous-width characters 2 cells wide. Default false. */
    ambiguousWide?: boolean;
}
/** UAX #11 class of a code point, reduced to what layout needs. */
export declare function eastAsianWidthClass(cp: number): 'W' | 'A' | 'N';
/** Width of a single code point in isolation: 0, 1 or 2. */
export declare function codePointWidth(cp: number, options?: WidthOptions): 0 | 1 | 2;
/** Width of one grapheme cluster: 0, 1 or 2. */
export declare function graphemeWidth(cluster: string, options?: WidthOptions): 0 | 1 | 2;
/** Splits text into grapheme clusters. */
export declare function graphemes(text: string): string[];
/** Removes CSI and OSC sequences (e.g. this package's own SGR styling and OSC 8 links). */
export declare function stripAnsi(text: string): string;
/** Display width of a string in cells. Styling sequences count as 0. */
export declare function stringWidth(text: string, options?: WidthOptions): number;
/** Pads plain text with spaces to `width` cells (never truncates). */
export declare function padEnd(text: string, width: number, options?: WidthOptions): string;
export interface TruncateOptions extends WidthOptions {
    /** Marker for removed text. Default `…`; pass `...` when glyphs must be ASCII. */
    ellipsis?: string;
}
/** Keeps the start of plain text so it fits `max` cells, never splitting a grapheme. */
export declare function truncateEnd(text: string, max: number, options?: TruncateOptions): string;
/**
 * Middle-truncates plain text (typically a path) to fit `max` cells, keeping its head and tail
 * (the file name). Never splits a grapheme; the result is never wider than `max`.
 */
export declare function truncateMiddle(text: string, max: number, options?: TruncateOptions): {
    text: string;
    truncated: boolean;
};
export interface WrapOptions extends WidthOptions {
    /** Prefix for every line after the first (counted against the width). Default ''. */
    indent?: string;
}
/**
 * Wraps plain text to `width` cells. Breaks only at spaces, so a path or URL is never split unless
 * that token alone is wider than the line, in which case it is broken between graphemes.
 * Existing newlines are kept. Every returned line is at most `width` cells (for `width` >= 2).
 */
export declare function wrap(text: string, width: number, options?: WrapOptions): string[];
