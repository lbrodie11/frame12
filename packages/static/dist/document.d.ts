import { type Html } from './html.js';
export interface DocumentOpts {
    title: string;
    lang?: string;
    body: Html;
    /** `auto` follows `prefers-color-scheme`; `light`/`dark` set `data-theme` on `<html>`. */
    theme?: 'auto' | 'light' | 'dark';
    /** Recorded as `data-f12-variant` on `<html>`; page-level quiet semantics arrive in F12-06. */
    variant?: 'expressive' | 'quiet';
    /** Inline the token and static CSS (default). Pass `false` for CSP-restricted hosts. */
    inlineCss?: boolean;
}
/**
 * Makes auto ids unique within one document using a counter scoped to this call. A renamed id's
 * `url(#…)` and `href="#…"` references that follow it (inside the same component) are rewritten.
 */
export declare function dedupeIds(markup: string): string;
/**
 * A complete, self-contained HTML page: doctype, charset, viewport, the token CSS
 * (`<style data-f12-tokens>`), the static kit CSS (`<style data-f12-static>`) and the body.
 * No scripts, fonts or other external requests.
 */
export declare function document(o: DocumentOpts): Html;
