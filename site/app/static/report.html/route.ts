import { createHash } from 'node:crypto';
import { document } from '@frame12/static';
import { PR_REPORT, renderStaticPrReport } from '@/lib/pr-report';

export const dynamic = 'force-static';

/** CSP source expressions allowing exactly the inline <style> elements in `page`. */
function styleHashes(page: string): string[] {
  return [...page.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(
    (m) => `'sha256-${createHash('sha256').update(m[1] ?? '', 'utf8').digest('base64')}'`,
  );
}

/**
 * The static report as a self-contained page: no scripts, no external requests. Its CSP allows
 * only the two inline <style> elements document() emits (by hash) and inline style attributes
 * (style-src-attr), which carry per-instance values such as tone-bar widths and named areas.
 * Browsers without style-src-attr fall back to style-src, block the attributes, and use
 * static.css's strict-CSP fallbacks instead.
 */
export function GET() {
  const page = String(document({ title: PR_REPORT.title, body: renderStaticPrReport() }));
  const csp = [
    "default-src 'none'",
    `style-src ${styleHashes(page).join(' ')}`,
    "style-src-attr 'unsafe-inline'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
  return new Response(page, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'content-security-policy': csp,
    },
  });
}
