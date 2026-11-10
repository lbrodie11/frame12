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
 * Makes the kit's auto ids unique within `markup`, using a counter scoped to this call. Only two
 * attributes inside start tags are touched: `id="…"` when it is an auto id, and the
 * `mask="url(#…)"` that the same ghostWire uses right after defining its mask. Text, `href`s,
 * caller-chosen ids (`idPrefix`) and every other attribute are left exactly as they are.
 * document() calls this; call it yourself when you assemble a page without document().
 */
export declare function dedupeIds(markup: Html): Html;
/**
 * A complete, self-contained HTML page: doctype, charset, viewport, the token CSS
 * (`<style data-f12-tokens>`), the static kit CSS (`<style data-f12-static>`) and the body.
 * No scripts, fonts or other external requests.
 */
export declare function document(o: DocumentOpts): Html;
