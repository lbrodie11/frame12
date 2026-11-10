import { cssText as tokensCss } from '@frame12/tokens';
import { child, escapeHtml, html, isHtml, type Html } from './html.js';
import { staticCss } from './static-css.js';
import { fail, obj, oneOf } from './validate.js';

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

const BCP47_RE = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{1,8})*$/;

// Auto ids the renderers derive from a hash of their inputs (ghostWire masks, toneBarList rows).
// Identical components produce identical ids, so dedupeIds() renames the second and later copies.
const AUTO_ID_RE = /^(?:f12-gw-mask-(?:[A-Za-z0-9_-]+-)?s[0-9a-z]+|int-f12-s[0-9a-z]+-[a-z][a-z0-9-]*)$/;

// Start tags only (text nodes never match: a literal "<" in text is always escaped as &lt;).
// The attribute part skips quoted values, so a ">" inside a value can't end the tag early.
const START_TAG_RE = /<[a-zA-Z][a-zA-Z0-9-]*(?:[^>"']|"[^"]*"|'[^']*')*>/g;

/**
 * Makes the kit's auto ids unique within `markup`, using a counter scoped to this call. Only two
 * attributes inside start tags are touched: `id="…"` when it is an auto id, and the
 * `mask="url(#…)"` that the same ghostWire uses right after defining its mask. Text, `href`s,
 * caller-chosen ids (`idPrefix`) and every other attribute are left exactly as they are.
 * document() calls this; call it yourself when you assemble a page without document().
 */
export function dedupeIds(markup: Html): Html {
  if (!isHtml(markup)) fail('dedupeIds()', 'markup must be Html returned by a renderer, fragment() or unsafeRaw()');
  return html(rewriteAutoIds(markup.toString()));
}

function rewriteAutoIds(markup: string): string {
  const counts = new Map<string, number>();
  const current = new Map<string, string>();
  return markup.replace(START_TAG_RE, (tag) =>
    tag.replace(/(\s)(id|mask)="([^"]*)"/g, (m, sp: string, name: string, value: string) => {
      if (name === 'id') {
        if (!AUTO_ID_RE.test(value)) return m;
        const n = (counts.get(value) ?? 0) + 1;
        counts.set(value, n);
        const next = n === 1 ? value : `${value}-${n}`;
        current.set(value, next);
        return `${sp}id="${next}"`;
      }
      const ref = /^url\(#([^)]*)\)$/.exec(value)?.[1];
      const mapped = ref === undefined ? undefined : current.get(ref);
      return mapped === undefined || mapped === ref ? m : `${sp}mask="url(#${mapped})"`;
    }),
  );
}

/**
 * A complete, self-contained HTML page: doctype, charset, viewport, the token CSS
 * (`<style data-f12-tokens>`), the static kit CSS (`<style data-f12-static>`) and the body.
 * No scripts, fonts or other external requests.
 */
export function document(o: DocumentOpts): Html {
  const where = 'document()';
  obj(where, o);
  if (typeof o.title !== 'string') fail(where, 'title must be a string');
  if (!isHtml(o.body)) fail(where, 'body must be Html returned by a renderer, fragment() or unsafeRaw()');
  const lang = typeof o.lang === 'string' && BCP47_RE.test(o.lang) ? o.lang : 'en';
  const theme = oneOf(where, 'theme', o.theme, ['auto', 'light', 'dark'] as const, 'auto');
  const variant = oneOf(where, 'variant', o.variant, ['expressive', 'quiet'] as const, 'expressive');
  const inline = o.inlineCss === undefined ? true : o.inlineCss;
  if (typeof inline !== 'boolean') fail(where, 'inlineCss must be a boolean');

  const htmlAttrs =
    ` lang="${escapeHtml(lang)}"` +
    (theme === 'auto' ? '' : ` data-theme="${theme}"`) +
    (variant === 'quiet' ? ' data-f12-variant="quiet"' : '');
  const styles = inline
    ? `<style data-f12-tokens>${tokensCss}</style><style data-f12-static>${staticCss}</style>`
    : '';
  return html(
    `<!doctype html>\n<html${htmlAttrs}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(
      o.title,
    )}</title>${styles}</head><body>${rewriteAutoIds(child(o.body))}</body></html>\n`,
  );
}
