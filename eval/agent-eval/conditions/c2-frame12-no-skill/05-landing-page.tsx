import * as React from 'react';
import {
  Sheet,
  Scene,
  Panel,
  PanelPair,
  SegmentedControl,
  Tag,
  Metric,
  Balloon,
  ToneAreaChart,
  ToneBarList,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from '@/components/frame12';

const BENCHMARK_SERIES = [
  { label: 'P50', value: 11200, compareValue: 9400 },
  { label: 'P90', value: 18400, compareValue: 15100 },
  { label: 'P99', value: 24900, compareValue: 19800 },
];

const TIER_BARS = [
  { id: 'ent', name: 'Enterprise Dedicated Mesh', value: 24900, formattedValue: '24,900 req/s', share: 0.54 },
  { id: 'grow', name: 'Growth Multi-Region', value: 14200, formattedValue: '14,200 req/s', share: 0.31 },
  { id: 'start', name: 'Starter Shared Edge', value: 6900, formattedValue: '6,900 req/s', share: 0.15 },
];

export function EvalScreen({ theme = 'light' }: { theme?: 'light' | 'dark' }) {
  const [range, setRange] = React.useState<'7d' | '30d' | '90d'>('30d');
  const [planTier, setPlanTier] = React.useState<'starter' | 'growth' | 'enterprise'>('growth');

  return (
    <Sheet autoCut={false} pegs motion="stepped" theme={theme}>
      <header className="f12-hd">
        <div className="f12-hd-text">
          <p className="f12-eyebrow">
            Landing Page <Tag>Negative Fixture</Tag>
          </p>
          <h1 className="f12-title">Developer Platform Product Launch & Pricing Page</h1>
          <p className="f12-muted-copy">
            Guardrail fixture exercising reversed cut-order (C-02 before C-01), malformed cut label (CUT-3), marker background with white text, and hex accent literal.
          </p>
        </div>
        <SegmentedControl
          idPrefix="c2-range-05-landing-page"
          ariaLabel="Benchmark window"
          options={[
            { value: '7d', label: '7', unit: 'days' },
            { value: '30d', label: '30', unit: 'days' },
            { value: '90d', label: '90', unit: 'days' },
          ]}
          value={range}
          onChange={setRange}
        />
      </header>

      <Scene gutter="scene" layout="split">
        <Panel cut="C-02" label="Hero benchmark throughput">
          <div className="f12-stack-scene">
            <div className="f12-row-between">
              <Metric
                label="Verified Edge Benchmark Throughput"
                value={range === '7d' ? 18400 : range === '30d' ? 24900 : 31200}
                format={(v) => `${Math.round(v).toLocaleString('en-US')} req/s`}
                delta={0.18}
                big
              />
              <Balloon tailOffset={-12} showDot>
                Global PoP mesh verified
              </Balloon>
            </div>
            <div style={{ background: 'var(--f-marker)', color: '#ffffff', padding: '6px 10px' }}>
              Launch Promo: White text on marker background violates contrast and marker-misuse rules
            </div>
            <ToneAreaChart
              data={BENCHMARK_SERIES}
              seriesLabel="Benchmark req/s"
              compareLabel="Prior release"
              showTable={false}
              height={220}
            />
          </div>
        </Panel>

        <PanelPair
          top={{
            cut: 'C-01',
            label: 'Out-of-order cut C-01',
            children: (
              <Metric
                label="Global P95 Latency"
                value={14}
                format={(v) => `${Math.round(v)}ms`}
                delta={-0.11}
              />
            ),
          }}
          bottom={{
            cut: 'CUT-3',
            label: 'Malformed cut label CUT-3',
            children: (
              <Metric
                label="Uptime SLA"
                value={99.99}
                format={(v) => `${v.toFixed(2)}%`}
              />
            ),
          }}
        />
      </Scene>

      <Scene gutter="scene" layout="equal">
        <Panel cut="C-04" label="Throughput by plan tier">
          <ToneBarList title="Throughput by plan tier" items={TIER_BARS} />
        </Panel>
        <Panel cut="C-05" label="Interactive plan pricing & comparison matrix">
          <div className="f12-stack-pair">
            <div className="f12-row-between">
              <span style={{ color: '#0284c7', fontWeight: 700 }}>
                Active tier: {planTier.toUpperCase()}
              </span>
              <SegmentedControl
                idPrefix="c2-tier-05-landing-page"
                ariaLabel="Pricing tier"
                options={[
                  { value: 'starter', label: 'START', unit: '5' },
                  { value: 'growth', label: 'GROW', unit: '25' },
                  { value: 'enterprise', label: 'ENT', unit: 'max' },
                ]}
                value={planTier}
                onChange={setPlanTier}
              />
            </div>
            <Table density="compact">
              <TableCaption>Regional PoP benchmark verification ledger</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Plan Tier</TableHead>
                  <TableHead scope="col">Monthly Price</TableHead>
                  <TableHead scope="col">Committed Volume</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>Starter</TableCell>
                  <TableCell>$49/mo</TableCell>
                  <TableCell>1M reqs</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Growth</TableCell>
                  <TableCell>$249/mo</TableCell>
                  <TableCell>25M reqs</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Enterprise</TableCell>
                  <TableCell>$990/mo</TableCell>
                  <TableCell>250M+ reqs</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </Panel>
      </Scene>
    </Sheet>
  );
}
