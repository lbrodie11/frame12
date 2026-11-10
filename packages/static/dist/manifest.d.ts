/**
 * Static class manifest: every class and attribute each renderer can emit.
 *
 * `scripts/build-static-css.mjs` keeps a rule from `registry/styles/frame12.css` only when every
 * class and attribute its selector references is listed here, and fails the build when a
 * manifest class matches no kept rule (unless it is listed in `CLASS_EXCEPTIONS` with a
 * reason) or when the output references a class that isn't listed (dead weight).
 * `tests/manifest.test.mjs` checks this file against the renderers' real output.
 */
export declare const MANIFEST_CLASSES: Readonly<Record<string, readonly string[]>>;
/** Attributes the renderers emit that stylesheet selectors may test. */
export declare const MANIFEST_ATTRIBUTES: readonly string[];
/** Custom properties the renderers set inline (so the stylesheet need not define them). */
export declare const INLINE_CUSTOM_PROPERTIES: readonly string[];
/**
 * Manifest classes allowed to match no rule in the generated CSS, each with the reason.
 * Every entry is re-checked by the build: an exception that no longer needs to be one fails it.
 */
export declare const CLASS_EXCEPTIONS: Readonly<Record<string, string>>;
/** All manifest classes, deduplicated and sorted. */
export declare function manifestClasses(): string[];
