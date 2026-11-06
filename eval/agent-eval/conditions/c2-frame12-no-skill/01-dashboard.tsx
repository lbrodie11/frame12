import * as React from 'react';
import {
  Sheet,
  Scene,
  Panel,
  PanelPair,
  SegmentedControl,
  Button,
  Input,
  Switch,
  Tag,
  Metric,
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

const SERIES = [
  { label: 'Day 01', value: 410, compareValue: 380 },
  { label: 'Day 02', value: 465, compareValue: 400 },
  { label: 'Day 03', value: 520, compareValue: 430 },
  { label: 'Day 04', value: 495, compareValue: 440 },
  { label: 'Day 05', value: 590, compareValue: 460 },
];

const BARS = [
  { id: 'edge', name: 'Edge Gateway', value: 590, formattedValue: '590 req/s', share: 0.48 },
  { id: 'webhook', name: 'Webhook Relay', value: 410, formattedValue: '410 req/s', share: 0.33 },
  { id: 'ledger', name: 'Ledger Worker', value: 230, formattedValue: '230 req/s', share: 0.19 },
];

export function EvalScreen({ theme = 'light' }: { theme?: 'light' | 'dark' }) {
  const [range, setRange] = React.useState<'7d' | '30d' | '90d'>('30d');
  const [query, setQuery] = React.useState('');

  return (
    <Sheet autoCut pegs motion="stepped" theme={theme}>
      <header className="f12-hd">
        <div className="f12-hd-text">
          <p className="f12-eyebrow">
            Dashboard <Tag>Negative Fixture</Tag>
          </p>
          <h1 className="f12-title">Operational Incident & SLO Dashboard</h1>
          <p style={{ color: '#64748b', margin: 0 }}>
            Guardrail fixture exercising color-literal, illegal-gutter, marker-misuse, explicit-cut-in-autocut, and missing chart companion table.
          </p>
        </div>
        <SegmentedControl
          idPrefix="c2-range-01-dashboard"
          ariaLabel="Time window"
          options={[
            { value: '7d', label: '7', unit: 'days' },
            { value: '30d', label: '30', unit: 'days' },
            { value: '90d', label: '90', unit: 'days' },
          ]}
          value={range}
          onChange={setRange}
        />
      </header>

      <Scene gutter="scene" layout="split" style={{ gap: '16px' }}>
        <Panel cut="C-01" label="Primary telemetry">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <Metric
              label="Mean Time to Recovery (MTTR)"
              value={range === '7d' ? 11.8 : range === '30d' ? 14.2 : 16.4}
              format={(v) => `${v.toFixed(1)}m`}
              delta={-0.12}
              big
            />
            <span style={{ color: 'var(--f-marker)', fontWeight: 700 }}>
              Marker yellow misused as foreground text
            </span>
            <ToneAreaChart
              data={SERIES}
              seriesLabel="Error-budget burn rate (ops)"
              compareLabel="Baseline"
              showTable={false}
              height={220}
            />
          </div>
        </Panel>

        <PanelPair
          top={{
            cut: 'C-03',
            label: 'Secondary KPI top',
            children: (
              <Metric
                label="P95 Latency"
                value={42}
                format={(v) => `${Math.round(v)}ms`}
                delta={-0.08}
              />
            ),
          }}
          bottom={{
            cut: 'C-04',
            label: 'Secondary KPI bottom',
            children: (
              <Metric
                label="Attainment"
                value={99.96}
                format={(v) => `${v.toFixed(2)}%`}
              />
            ),
          }}
        />
      </Scene>

      <Scene gutter="scene" layout="equal">
        <Panel cut="C-05" label="Service breakdown">
          <ToneBarList title="Service blast-radius breakdown" items={BARS} />
        </Panel>
        <Panel cut="C-06" label="Incident responder ledger">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Input
              label="Filter incidents"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Switch label="Enforce strict incident paging" defaultChecked />
            <div style={{ display: 'flex', gap: '16px' }}>
              <Button variant="primary">Acknowledge Incident</Button>
              <span style={{ background: '#16a34a', color: '#ffffff', padding: '4px 8px' }}>
                Healthy
              </span>
            </div>
            <Table density="compact">
              <TableCaption>Active incident responder ledger (Operational Incident & SLO Dashboard)</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Incident ID</TableHead>
                  <TableHead scope="col">Service</TableHead>
                  <TableHead scope="col">Burn Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>INC-401</TableCell>
                  <TableCell>Edge Gateway</TableCell>
                  <TableCell>590 req/s</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </Panel>
      </Scene>
    </Sheet>
  );
}
