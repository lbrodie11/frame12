// A Gutter-style pull-request report, rendered twice from the same data: once with the React
// kit (site/src/components/pr-report-react.tsx) and once with @frame12/static (below). Used by
// the /static page and by packages/static's cross-browser parity tests.
import {
  fmtPct,
  fragment,
  ghostWire,
  metric,
  panel,
  panelPair,
  receiptList,
  scene,
  sheet,
  toneBarList,
  balloon,
  type Html,
  type ReceiptOpts,
  type ToneBarItem,
} from '@frame12/static';

export interface PrReportData {
  title: string;
  summary: string;
  note: string;
  linesChanged: number;
  coverage: number;
  coverageDelta: number;
  coChange: { from: string; to: string; label: string; strength: number };
  hotspots: ToneBarItem[];
  receipts: ReceiptOpts[];
}

export const PR_REPORT: PrReportData = {
  title: 'PR 142: Split invoice totals from tax rules',
  summary:
    'Moves tax-rule lookup out of the invoice renderer and caches the per-region table. Behaviour is unchanged for existing regions.',
  note: 'Touches the billing path',
  linesChanged: 1284,
  coverage: 0.874,
  coverageDelta: 0.012,
  coChange: {
    from: 'src/billing/invoice.ts',
    to: 'src/billing/tax-rules.ts',
    label: 'Changed together in 9 of the last 11 commits',
    strength: 0.8,
  },
  hotspots: [
    { id: 'invoice', name: 'invoice.ts', value: 412, formattedValue: '412 lines', share: 0.32 },
    { id: 'tax-rules', name: 'tax-rules.ts', value: 268, formattedValue: '268 lines', share: 0.21, pattern: 'hatch' },
    { id: 'region-cache', name: 'region-cache.ts', value: 190, formattedValue: '190 lines', share: 0.15, badge: 'new', pattern: 'dense' },
  ],
  receipts: [
    { kind: 'commit', value: '9f3c2a1b7e4d5c6f8a9b0c1d2e3f4a5b6c7d8e9f', href: 'https://github.com/example/billing/commit/9f3c2a1', origin: 'human', date: '2026-11-08' },
    { kind: 'file', value: 'src/billing/regions/european-union/value-added-tax/reverse-charge-rules.ts', origin: 'agent' },
    { kind: 'link', value: 'CI run 5121', href: 'https://ci.example.com/runs/5121', title: 'passed', origin: 'bot' },
  ],
};

export const PR_REPORT_AREAS = ['summary metrics', 'risk evidence'];

/** The report rendered with @frame12/static. Returns the sheet (use document() for a full page). */
export function renderStaticPrReport(data: PrReportData = PR_REPORT, theme?: 'light' | 'dark'): Html {
  return sheet({
    autoCut: true,
    ...(theme ? { theme } : {}),
    children: scene({
      areas: PR_REPORT_AREAS,
      children: fragment(
        panel({
          area: 'summary',
          label: 'Change summary',
          children: fragment(data.summary, balloon({ children: data.note })),
        }),
        panelPair({
          area: 'metrics',
          topLabel: 'Size',
          bottomLabel: 'Coverage',
          top: { children: metric({ label: 'Lines changed', value: data.linesChanged, format: (v) => Math.round(v).toLocaleString('en-US') }) },
          bottom: {
            children: metric({
              label: 'Test coverage',
              value: data.coverage,
              format: fmtPct,
              delta: data.coverageDelta,
              comparisonLabel: 'vs main',
            }),
          },
        }),
        panel({
          area: 'risk',
          label: 'Co-change risk',
          children: fragment(
            ghostWire({ ...data.coChange, orientation: 'vertical' }),
            toneBarList({ title: 'Hotspots', subtitle: 'Lines changed per file', items: data.hotspots, selectedId: 'invoice', idPrefix: 'static-hot', density: 'compact' }),
          ),
        }),
        panel({ area: 'evidence', label: 'Evidence', children: receiptList({ items: data.receipts, ariaLabel: 'Evidence for this report' }) }),
      ),
    }),
  });
}

/** Edge cases for the cross-browser parity tests: long paths, huge numbers, an empty list, RTL text. */
export const PR_REPORT_EDGE: PrReportData = {
  title: 'PR 9999: Edge cases',
  summary: 'שינוי במסלול החיוב: מעביר את חישוב המס למודול נפרד (RTL summary).',
  note: 'Long names wrap instead of overflowing',
  linesChanged: 98765432109876,
  coverage: 0,
  coverageDelta: -0.0004,
  coChange: {
    from: 'packages/billing/src/regions/european-union/value-added-tax/reverse-charge/rules/intra-community-supply.ts',
    to: 'packages/billing/src/regions/european-union/value-added-tax/reverse-charge/rules/intra-community-supply.test.ts',
    label: 'Changed together in 48 of the last 50 commits',
    strength: 1,
  },
  hotspots: [],
  receipts: [
    { kind: 'file', value: 'packages/billing/src/regions/european-union/value-added-tax/reverse-charge/rules/intra-community-supply-with-a-very-long-file-name.ts' },
    { kind: 'commit', value: '0000000000000000000000000000000000000000', date: '1970-01-01' },
    { kind: 'link', value: '', href: 'https://ci.example.com/runs/123456789012345678901234567890', origin: 'bot' },
  ],
};
