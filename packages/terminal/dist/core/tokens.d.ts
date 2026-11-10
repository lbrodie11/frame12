/**
 * Terminal tokens, derived at build time from `@frame12/tokens` (see `tokens.generated.ts`).
 *
 * A terminal's background cannot be detected reliably, so FRAME/12 never paints ink as a fixed
 * foreground color: ink is the terminal's own foreground, secondary ink and rules are `dim`, and
 * statuses use weight and inversion, as they do on the web (`.f12-status-*` is monochrome there too).
 * Exact colors appear only where FRAME/12 sets both foreground and background: the marker chip.
 *
 * Style levels:
 * - `truecolor`: exact token hex values.
 * - `ansi256`: the nearest xterm-256 index, computed (never the 16 theme-defined entries).
 * - `ansi16`: a hand-tuned table.
 * - `mono`: bold, dim, inverse and underline only (e.g. `NO_COLOR` on a TTY).
 * - `none`: no escape sequences at all (pipes, files, `TERM=dumb`).
 */
import { tokenGutterPx, tokenMotion, tokenPalette, TOKENS_PACKAGE_VERSION } from './tokens.generated.js';
import type { ColorLevel } from './capabilities.js';
export { tokenGutterPx, tokenMotion, tokenPalette, TOKENS_PACKAGE_VERSION };
export type StyleLevel = 'none' | 'mono' | 'ansi16' | 'ansi256' | 'truecolor';
export type ThemeName = 'light' | 'dark';
export type TokenName = keyof (typeof tokenPalette)['light'];
export type Rgb = readonly [number, number, number];
export declare function styleLevel(colorLevel: ColorLevel, attributes: boolean): StyleLevel;
export declare function hexToRgb(hex: string): Rgb;
/** The RGB value of an xterm-256 palette index in 16–255 (0–15 are theme-defined). */
export declare function xterm256Rgb(index: number): Rgb;
/** Nearest xterm-256 index (16–255) to a `#rrggbb` color. Ties go to the lower index. Memoized. */
export declare function nearestAnsi256(hex: string): number;
/**
 * Hand-tuned 16-color table: SGR foreground / background codes per token and theme. Bright yellow
 * (93/103) is used for marker because standard yellow (33/43) is olive or brown in many themes.
 */
export declare const ANSI16: Record<ThemeName, Record<TokenName, {
    fg: number;
    bg: number;
}>>;
/** SGR parameters that set a token as foreground or background at a style level ('' at mono/none). */
export declare function tokenSgr(name: TokenName, theme: ThemeName, level: StyleLevel, plane: 'fg' | 'bg'): string;
/** Semantic roles the grammar paints with. */
export declare const ROLES: readonly ["ink", "ink2", "rule", "strong", "link", "marker", "status-review", "status-info", "status-ok", "status-warning", "status-danger"];
export type Role = (typeof ROLES)[number];
export interface Sgr {
    open: string;
    close: string;
}
/** Escape sequences for a role at a style level. `none` returns empty strings. */
export declare function roleSgr(role: Role, level: StyleLevel): Sgr;
/**
 * Wraps already-sanitized text in a role's escape sequences. Nesting is safe: SGR closes are
 * shared (`22` ends both bold and dim, `0` ends everything), so wherever the text contains a
 * sequence that would end this role's attributes, the role is opened again right after it.
 * `paint(\`dim \${paint('bold', 'strong', l)} dim\`, 'ink2', l)` stays dim after the bold part.
 */
export declare function paint(text: string, role: Role, level: StyleLevel): string;
/**
 * FRAME/12's gutter scale translated to terminal cells: a pair (12px) is 1 cell or line, a scene
 * (20px) is 2, a change of subject (32px) is 3. These are the only legal spacings.
 */
export declare const GUTTER_CELLS: {
    readonly pair: 1;
    readonly scene: 2;
    readonly change: 3;
};
export type Gutter = keyof typeof GUTTER_CELLS;
