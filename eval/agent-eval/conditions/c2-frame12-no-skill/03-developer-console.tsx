import * as React from 'react';
import {
  Sheet,
  Scene,
  Panel,
  PanelPair,
  SegmentedControl,
  Button,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
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

const WEBHOOK_SERIES = [
  { label: '00:00', value: 1120, compareValue: 980 },
  { label: '06:00', value: 1480, compareValue: 1210 },
  { label: '12:00', value: 1890, compareValue: 1540 },
  { label: '18:00', value: 2140, compareValue: 1790 },
];

const ENDPOINT_BARS = [
  { id: 'orders', name: 'POST /v2/webhooks/orders', value: 14820, formattedValue: '14,820 ops', share: 0.49 },
  { id: 'settlements', name: 'POST /v2/webhooks/settlements', value: 9410, formattedValue: '9,410 ops', share: 0.31 },
  { id: 'inventory', name: 'POST /v2/webhooks/inventory', value: 6050, formattedValue: '6,050 ops', share: 0.20 },
];

export function EvalScreen({ theme = 'light' }: { theme?: 'light' | 'dark' }) {
  const [env, setEnv] = React.useState<'prod' | 'stage'>('prod');
  const [range, setRange] = React.useState<'7d' | '30d' | '90d'>('30d');
  const [query, setQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');

  return (
    <Sheet autoCut pegs motion="stepped" theme={theme}>
      <header className="f12-hd">
        <div className="f12-hd-text">
          <p className="f12-eyebrow">
            Developer Console <Tag>Negative Fixture</Tag>
          </p>
          <h1 className="f12-title">Webhook Delivery & Event Stream Console</h1>
          <p className="f12-muted-copy">
            Guardrail fixture exercising marker border/foreground misuse, 18px/24px illegal gutters, explicit cuts in autoCut, and showTable=false.
          </p>
        </div>
        <div style={{ display: 'flex', columnGap: '24px' }}>
          <SegmentedControl
            idPrefix="c2-env-03-developer-console"
            ariaLabel="Target environment"
            options={[
              { value: 'prod', label: 'PROD', unit: 'us-east' },
              { value: 'stage', label: 'STAGE', unit: 'eu-central' },
            ]}
            value={env}
            onChange={setEnv}
          />
          <SegmentedControl
            idPrefix="c2-range-03-developer-console"
            ariaLabel="Time window"
            options={[
              { value: '7d', label: '7', unit: 'days' },
              { value: '30d', label: '30', unit: 'days' },
              { value: '90d', label: '90', unit: 'days' },
            ]}
            value={range}
            onChange={setRange}
          />
        </div>
      </header>

      <Scene gutter="scene" layout="split">
        <Panel cut="C-01" label="Webhook delivery throughput">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <Metric
              label="24h Webhook Delivery Volume"
              value={env === 'prod' ? 30280 : 8420}
              format={(v) => `${Math.round(v).toLocaleString('en-US')} ops`}
              delta={0.142}
              big
            />
            <div style={{ border: '2px solid var(--f-marker)', padding: '8px' }}>
              <span style={{ color: '#ffd60a' }}>Marker border and hex yellow text misuse</span>
            </div>
            <ToneAreaChart
              data={WEBHOOK_SERIES}
              seriesLabel="Webhook deliveries"
              compareLabel="Prior 24h"
              showTable={false}
              height={220}
            />
          </div>
        </Panel>

        <PanelPair
          top={{
            cut: 'C-02',
            label: 'Delivery P95 Latency',
            children: (
              <Metric
                label="P95 Delivery Latency"
                value={env === 'prod' ? 28 : 41}
                format={(v) => `${Math.round(v)}ms`}
                delta={-0.06}
              />
            ),
          }}
          bottom={{
            label: 'Retry Queue Depth',
            children: (
              <Metric
                label="Success Rate"
                value={99.94}
                format={(v) => `${v.toFixed(2)}%`}
              />
            ),
          }}
        />
      </Scene>

      <Scene gutter="scene" layout="equal">
        <Panel label="Destination endpoint breakdown">
          <ToneBarList title="Destination endpoint breakdown" items={ENDPOINT_BARS} />
        </Panel>
        <Panel label="Event delivery stream log">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div style={{ display: 'flex', gap: '18px' }}>
              <Input
                label="Filter endpoint path"
                density="compact"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <Select
                label="Delivery status"
                id="c2-status-03-developer-console"
                density="compact"
                value={statusFilter}
                onValueChange={setStatusFilter}
              >
                <SelectTrigger ariaLabel="Delivery status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All deliveries</SelectItem>
                  <SelectItem value="202">202 Delivered</SelectItem>
                  <SelectItem value="429">429 Retrying</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="secondary" size="sm">Replay Dead-Letter Queue</Button>
            <Table density="compact">
              <TableCaption>Event delivery log table (Webhook Delivery & Event Stream Console)</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Event ID</TableHead>
                  <TableHead scope="col">Destination</TableHead>
                  <TableHead scope="col">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>EVT-301</TableCell>
                  <TableCell>POST /v2/webhooks/orders</TableCell>
                  <TableCell><Tag status="success">202 Delivered</Tag></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>EVT-303</TableCell>
                  <TableCell>POST /v2/webhooks/inventory</TableCell>
                  <TableCell><Tag status="warning">429 Retrying</Tag></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </Panel>
      </Scene>
    </Sheet>
  );
}
