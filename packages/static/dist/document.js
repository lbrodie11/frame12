import { cssText as tokensCss } from '@frame12/tokens';
import { child, escapeHtml, html, isHtml } from './html.js';
import { staticCss } from './static-css.js';
import { fail, oneOf } from './validate.js';
const BCP47_RE = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{1,8})*$/;
// Auto ids the renderers derive from a hash of their inputs (ghostWire masks, toneBarList rows).
// Identical components produce identical ids, so document() renames the second and later copies.
const AUTO_ID_RE = /^(?:f12-gw-mask-(?:[A-Za-z0-9_-]+-)?s[0-9a-z]+|int-f12-s[0-9a-z]+-[a-z][a-z0-9-]*)$/;
/**
 * Makes auto ids unique within one document using a counter scoped to this call. A renamed id's
 * `url(#…)` and `href="#…"` references that follow it (inside the same component) are rewritten.
 */
export function dedupeIds(markup) {
    const counts = new Map();
    const current = new Map();
    return markup.replace(/ id="([^"]*)"|url\(#([^)"]*)\)|href="#([^"]*)"/g, (m, id, urlRef, hrefRef) => {
        if (id !== undefined) {
            if (!AUTO_ID_RE.test(id))
                return m;
            const n = (counts.get(id) ?? 0) + 1;
            counts.set(id, n);
            const next = n === 1 ? id : `${id}-${n}`;
            current.set(id, next);
            return ` id="${next}"`;
        }
        const ref = (urlRef ?? hrefRef);
        const mapped = current.get(ref);
        if (mapped === undefined || mapped === ref)
            return m;
        return urlRef !== undefined ? `url(#${mapped})` : `href="#${mapped}"`;
    });
}
/**
 * A complete, self-contained HTML page: doctype, charset, viewport, the token CSS
 * (`<style data-f12-tokens>`), the static kit CSS (`<style data-f12-static>`) and the body.
 * No scripts, fonts or other external requests.
 */
export function document(o) {
    const where = 'document()';
    if (typeof o.title !== 'string')
        fail(where, 'title must be a string');
    if (!isHtml(o.body))
        fail(where, 'body must be Html returned by a renderer, fragment() or unsafeRaw()');
    const lang = typeof o.lang === 'string' && BCP47_RE.test(o.lang) ? o.lang : 'en';
    const theme = oneOf(where, 'theme', o.theme, ['auto', 'light', 'dark'], 'auto');
    const variant = oneOf(where, 'variant', o.variant, ['expressive', 'quiet'], 'expressive');
    const inline = o.inlineCss === undefined ? true : o.inlineCss;
    if (typeof inline !== 'boolean')
        fail(where, 'inlineCss must be a boolean');
    const htmlAttrs = ` lang="${escapeHtml(lang)}"` +
        (theme === 'auto' ? '' : ` data-theme="${theme}"`) +
        (variant === 'quiet' ? ' data-f12-variant="quiet"' : '');
    const styles = inline
        ? `<style data-f12-tokens>${tokensCss}</style><style data-f12-static>${staticCss}</style>`
        : '';
    return html(`<!doctype html>\n<html${htmlAttrs}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(o.title)}</title>${styles}</head><body>${dedupeIds(child(o.body))}</body></html>\n`);
}
