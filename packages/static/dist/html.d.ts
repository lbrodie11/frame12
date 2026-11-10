/**
 * The escaping core of `@frame12/static`.
 *
 * `Html` is a branded string type. The brand is a compile-time aid only: TypeScript lets anyone
 * write `'<script>' as Html`. At runtime the kit recognises trusted markup through an internal
 * registry of strings that its own renderers, `fragment()` and `unsafeRaw()` produced. A string
 * that only claims to be `Html` through a cast is not in the registry, so it is escaped as text.
 */
declare const HtmlBrand: unique symbol;
/** Markup produced by an `@frame12/static` renderer, `fragment()` or `unsafeRaw()`. */
export type Html = string & {
    readonly [HtmlBrand]: true;
};
/** Anything a renderer accepts where React accepts `children`. */
export type Child = Html | string;
/** True when `value` is markup this package produced (not merely typed as `Html`). */
export declare function isHtml(value: unknown): value is Html;
/**
 * Escapes `& < > " '` and replaces control characters and lone surrogates with U+FFFD.
 * Safe for text content and for quoted attribute values.
 */
export declare function escapeHtml(s: string): string;
/**
 * Marks `trustedHtml` as `Html` without escaping it. This is the ONLY way to bypass escaping.
 * Never pass commit subjects, file names, PR text or any other user or repository input.
 */
export declare function unsafeRaw(trustedHtml: string): Html;
/** Converts a child to markup: `Html` passes through, anything else is escaped once as text. */
export declare function child(value: Child | null | undefined | false): string;
/**
 * Concatenates parts into one `Html` value. `Html` parts are inserted as is and strings are
 * escaped. Use it instead of `+`: joining two `Html` values with `+` produces a plain string,
 * which a renderer would then escape.
 */
export declare function fragment(...parts: Array<Child | null | undefined | false>): Html;
/** Internal: wraps renderer output. Only call with markup built from escaped parts. */
export declare function html(markup: string): Html;
export type AttrValue = string | number | boolean | null | undefined;
/**
 * Serializes attributes in the given (stable) order. `false`, `null` and `undefined` omit the
 * attribute; `true` and `''` render `name=""`. Values are always double-quoted and escaped.
 */
export declare function attrs(list: ReadonlyArray<readonly [string, AttrValue]>): string;
/**
 * Visible text of a child, mirroring React's `extractTextContent`: plain strings are returned
 * as is, `Html` has its tags stripped and entities decoded, and subtrees marked
 * `aria-hidden="true"` or `hidden` are skipped.
 */
export declare function textContent(value: Child | null | undefined | false): string;
export {};
