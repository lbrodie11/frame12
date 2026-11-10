import { document } from '@frame12/static';
import { PR_REPORT, renderStaticPrReport } from '@/lib/pr-report';

export const dynamic = 'force-static';

/** The static report as a self-contained page: no scripts, no external requests. */
export function GET() {
  const page = document({ title: PR_REPORT.title, body: renderStaticPrReport() });
  return new Response(page, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:",
    },
  });
}
