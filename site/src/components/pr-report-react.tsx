'use client';

import * as React from 'react';
import {
  Balloon,
  GhostWire,
  Metric,
  Panel,
  PanelPair,
  Receipt,
  ReceiptList,
  Scene,
  Sheet,
  ToneBarList,
  fmtPct,
} from '@/components/frame12';
import { PR_REPORT, PR_REPORT_AREAS, type PrReportData } from '@/lib/pr-report';

/** The PR report rendered with the React kit, from the same data as renderStaticPrReport(). */
export function PrReportReact({ data = PR_REPORT, theme }: { data?: PrReportData; theme?: 'light' | 'dark' }) {
  return (
    <Sheet autoCut theme={theme}>
      <Scene areas={PR_REPORT_AREAS}>
        <Panel area="summary" label="Change summary">
          {data.summary}
          <Balloon>{data.note}</Balloon>
        </Panel>
        <PanelPair
          area="metrics"
          topLabel="Size"
          bottomLabel="Coverage"
          top={{
            children: (
              <Metric
                label="Lines changed"
                value={data.linesChanged}
                format={(v) => Math.round(v).toLocaleString('en-US')}
                motion="cut"
              />
            ),
          }}
          bottom={{
            children: (
              <Metric
                label="Test coverage"
                value={data.coverage}
                format={fmtPct}
                delta={data.coverageDelta}
                comparisonLabel="vs main"
                motion="cut"
              />
            ),
          }}
        />
        <Panel area="risk" label="Co-change risk">
          <GhostWire {...data.coChange} orientation="vertical" />
          <ToneBarList
            title="Hotspots"
            subtitle="Lines changed per file"
            items={data.hotspots}
            selectedId="invoice"
            idPrefix="react-hot"
            density="compact"
          />
        </Panel>
        <Panel area="evidence" label="Evidence">
          <ReceiptList ariaLabel="Evidence for this report">
            {data.receipts.map((r) => (
              <Receipt key={`${r.kind}-${r.value}`} {...r} />
            ))}
          </ReceiptList>
        </Panel>
      </Scene>
    </Sheet>
  );
}
