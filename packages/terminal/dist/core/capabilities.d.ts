/**
 * Terminal capability detection. `detectCapabilities` is pure: everything it reads is passed in,
 * so tests inject environments instead of depending on the machine running them.
 */
export type ColorLevel = 0 | 1 | 2 | 3;
export type Env = Readonly<Record<string, string | undefined>>;
export interface StreamLike {
    isTTY?: boolean;
    columns?: number;
    rows?: number;
}
export interface InputStreamLike {
    isTTY?: boolean;
    setRawMode?: unknown;
}
export interface Streams {
    stdin?: InputStreamLike;
    stdout?: StreamLike;
    stderr?: StreamLike;
}
export interface DetectOptions {
    /** Defaults to `process.platform` when available, else `linux`. */
    platform?: string;
}
export interface Capabilities {
    /** Color depth for stdout (results). 0 none, 1 = 16 colors, 2 = 256, 3 = truecolor. */
    colorLevel: ColorLevel;
    /** Color depth for stderr (narration). */
    stderrColorLevel: ColorLevel;
    /**
     * stdout may carry bold / dim / inverse / underline. True whenever color is on, and on a TTY
     * where color is off (`NO_COLOR` asks for no color, not for no emphasis). False on pipes and
     * `TERM=dumb`, so files and logs never receive escape sequences.
     */
    attributes: boolean;
    /** stderr may carry bold / dim / inverse / underline. */
    stderrAttributes: boolean;
    /** Non-ASCII glyphs may be printed. False means every glyph uses its ASCII twin. */
    unicode: boolean;
    /** East Asian ambiguous-width characters render 2 cells wide (CJK locales). */
    ambiguousWide: boolean;
    /** OSC 8 hyperlinks may be emitted. */
    links: boolean;
    /** Layout width in cells, clamped to 20–400. */
    columns: number;
    /** Layout height in rows, clamped to 5–200. */
    rows: number;
    /** stdout is a TTY. */
    isTTY: boolean;
    /** stderr is a TTY. */
    stderrIsTTY: boolean;
    /** stdin and stdout are TTYs, not CI, and stdin supports raw mode. */
    interactive: boolean;
    /** A screen reader is in use: append-only plain lines, no cursor movement. */
    screenReader: boolean;
    /** Running under continuous integration. */
    ci: boolean;
    /** The detected CI provider, if any. */
    ciProvider: string | undefined;
    /** `TERM=dumb`. */
    dumb: boolean;
    /** Running inside a terminal multiplexer. */
    multiplexer: 'tmux' | 'screen' | undefined;
}
/** `true` when the variable is set, non-empty and not `0` / `false`. */
export declare function envFlag(env: Env, name: string): boolean;
export declare function detectCi(env: Env): {
    ci: boolean;
    provider: string | undefined;
};
/** Locales whose terminals traditionally render East Asian ambiguous-width characters wide. */
export declare function isCjkLocale(env: Env): boolean;
/**
 * Color level for one stream. Precedence (ported from Repo Archaeology RA-13, then CLI overrides):
 * 1. `--no-color` / `--color` (the last one on the command line wins)
 * 2. non-empty `NO_COLOR` → 0 (https://no-color.org/)
 * 3. `NODE_DISABLE_COLORS` (non-empty, not `0`) → 0
 * 4. `FORCE_COLOR` (`0`/`false` → 0, `1`/`true` → 1, `2` → 2, `3`+ → 3), honored even on pipes
 * 5. `TERM=dumb` or not a TTY → 0
 * 6. depth from `COLORTERM`, `WT_SESSION`, `TERM_PROGRAM`, `TERM=*256color`
 */
export declare function resolveColorLevel(env: Env, argv: readonly string[], isTTY: boolean): ColorLevel;
/**
 * Detects what the terminal can do. Pure: pass `process.env`, `{ stdin, stdout, stderr }` and
 * `process.argv` (or test doubles). Every flag has a CLI override: `--color`/`--no-color`,
 * `--ascii`/`--unicode`, `--links`/`--no-links`, `--screen-reader`, `--columns N`, `--rows N`.
 */
export declare function detectCapabilities(env?: Env, streams?: Streams, argv?: readonly string[], options?: DetectOptions): Capabilities;
