/**
 * The escaping core of `@frame12/static`.
 *
 * `Html` is a frozen wrapper object, not a string. Trust is decided by object identity: only
 * instances created inside this module (by a renderer, `fragment()` or `unsafeRaw()`) carry the
 * private `#markup` field, so a plain string is always escaped, whatever text it contains, and
 * whatever was rendered earlier in the process. Instances are ordinary garbage-collected objects:
 * there is no registry, no eviction and no memory held after the caller drops them.
 *
 * Use `String(html)` (or `${html}`) to get the markup. The resulting string is plain text again:
 * passing it back to a renderer escapes it.
 */
/** Markup produced by an `@frame12/static` renderer, `fragment()` or `unsafeRaw()`. */
export declare class Html {
    #private;
    /** @internal Not constructible outside this package: use a renderer, `fragment()` or `unsafeRaw()`. */
    constructor(token: symbol, markup: string);
    /** The markup as a string (plain text from here on: a renderer escapes it). */
    toString(): string;
    valueOf(): string;
    toJSON(): string;
    /** @internal Brand check that a forged prototype or a copied object can't pass. */
    static is(value: unknown): value is Html;
}
/** Anything a renderer accepts where React accepts `children`: `Html` as is, a string as text. */
export type Child = Html | string;
/**
 * True only for `Html` objects created by this package. Equal text is not enough: a string, or an
 * object that merely looks like `Html`, is not trusted.
 */
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
/** Converts a child to markup: `Html` passes through, a string is escaped once as text. */
export declare function child(value: Child | null | undefined | false): string;
/**
 * Concatenates parts into one `Html` value. `Html` parts are inserted as is and strings are
 * escaped. Use it to compose: `${a}${b}` or `String(a) + String(b)` produce plain text, which a
 * renderer would then escape.
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
export declare function decodeEntities(s: string): string;
/** Parses a start tag's attribute list into lower-cased names and decoded values. */
export declare function parseAttributes(source: string): Map<string, string>;
/**
 * Visible text of a child, mirroring React's `extractTextContent`: plain strings are returned
 * as is; `Html` has its tags stripped and entities decoded, and subtrees whose element has
 * `aria-hidden="true"` (exact, like React's `=== 'true'`) or a `hidden` attribute are skipped.
 * Attributes are tokenised, so `title="was hidden"` is not mistaken for `hidden`; unbalanced
 * closing tags close the nearest matching open element and are otherwise ignored.
 */
export declare function textContent(value: Child | null | undefined | false): string;
