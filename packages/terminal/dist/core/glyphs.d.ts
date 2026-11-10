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
export declare const GLYPHS: {
    readonly ok: {
        readonly char: "✓";
        readonly eaw: "N";
        readonly ascii: "[ok]";
        readonly use: "cut finished (with the word \"done\")";
    };
    readonly warning: {
        readonly char: "▲";
        readonly eaw: "A";
        readonly ascii: "[warn]";
        readonly use: "warning (with the word \"warning\")";
    };
    readonly error: {
        readonly char: "✕";
        readonly eaw: "N";
        readonly ascii: "[fail]";
        readonly use: "cut failed (with the word \"failed\")";
    };
    readonly skipped: {
        readonly char: "○";
        readonly eaw: "A";
        readonly ascii: "[skip]";
        readonly use: "cut skipped (with the word \"skipped\")";
    };
    readonly canceled: {
        readonly char: "⊘";
        readonly eaw: "N";
        readonly ascii: "[cancel]";
        readonly use: "cut canceled (with the word \"canceled\")";
    };
    readonly rule: {
        readonly char: "─";
        readonly eaw: "A";
        readonly ascii: "-";
        readonly use: "the masthead rule";
    };
    readonly heroRule: {
        readonly char: "┃";
        readonly eaw: "A";
        readonly ascii: "|";
        readonly use: "heavy left rule of the hero finding only";
    };
    readonly historyLink: {
        readonly char: "⇢";
        readonly eaw: "N";
        readonly ascii: "~>";
        readonly use: "subjects change together with no code link";
    };
    readonly directLink: {
        readonly char: "→";
        readonly eaw: "A";
        readonly ascii: "->";
        readonly use: "one subject references the other";
    };
    readonly toneOn: {
        readonly char: "▰";
        readonly eaw: "N";
        readonly ascii: "#";
        readonly use: "filled tone-bar cell";
    };
    readonly toneOff: {
        readonly char: "▱";
        readonly eaw: "N";
        readonly ascii: "-";
        readonly use: "empty tone-bar cell";
    };
    readonly dot: {
        readonly char: "·";
        readonly eaw: "A";
        readonly ascii: "-";
        readonly use: "separator between label parts";
    };
    readonly ellipsis: {
        readonly char: "…";
        readonly eaw: "A";
        readonly ascii: "...";
        readonly use: "truncation";
    };
    readonly rangeDash: {
        readonly char: "–";
        readonly eaw: "A";
        readonly ascii: "-";
        readonly use: "numeric range (41–79%)";
    };
    readonly focus: {
        readonly char: "›";
        readonly eaw: "N";
        readonly ascii: ">";
        readonly use: "the focused row in the live view (with aria-state selected)";
    };
};
export type GlyphName = keyof typeof GLYPHS;
export interface GlyphCaps {
    unicode: boolean;
    ambiguousWide: boolean;
}
/** The glyph to print: Unicode when allowed, otherwise (or when ambiguous renders wide) its twin. */
export declare function glyph(name: GlyphName, caps: GlyphCaps): string;
