import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  Scene,
  Panel,
  PanelPair,
  SegmentedControl,
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

const BACKORDER_SERIES = [
  { label: 'W1', value: 1840, compareValue: 2100 },
  { label: 'W2', value: 1620, compareValue: 1950 },
  { label: 'W3', value: 1410, compareValue: 1820 },
  { label: 'W4', value: 1190, compareValue: 1710 },
];

const WAREHOUSE_BARS = [
  { id: 'ewr', name: 'EWR-01 · Newark Hub', value: 9420, formattedValue: '9,420 units', share: 0.45 },
  { id: 'fra', name: 'FRA-02 · Frankfurt Hub', value: 6810, formattedValue: '6,810 units', share: 0.33 },
  { id: 'nrt', name: 'NRT-01 · Narita Hub', value: 4610, formattedValue: '4,610 units', share: 0.22 },
];

export function EvalScreen({ theme = 'light' }: { theme?: 'light' | 'dark' }) {
  const [range, setRange] = React.useState<'7d' | '30d' | '90d'>('30d');
  const [skuSearch, setSkuSearch] = React.useState('');
  const [region, setRegion] = React.useState('all');

  return (
    <Sheet autoCut pegs motion="stepped" theme={theme}>
      <header className="f12-hd">
        <div className="f12-hd-text">
          <p className="f12-eyebrow">
            Data-Heavy View <Tag>Negative Fixture</Tag>
          </p>
          <h1 className="f12-title">Multi-Region Inventory & Fulfillment Ledger</h1>
          <p style={{ color: '#94a3b8', fontFamily: 'Inter, sans-serif', margin: 0 }}>
            Guardrail fixture exercising raw-shadcn-import (@/components/ui/*), CSS linear-gradient, custom font-family, 8px/16px illegal gutters, and explicit cut in autoCut.
          </p>
        </div>
        <SegmentedControl
          idPrefix="c2-range-04-data-heavy"
          ariaLabel="Fulfillment window"
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
        <Panel cut="C-02" label="Regional fill rate and backorder volume">
          <div style={{ display: 'flex', flexDirection: 'column', rowGap: '16px' }}>
            <Metric
              label="Regional Units Fulfilled"
              value={range === '7d' ? 5120 : range === '30d' ? 20840 : 61900}
              format={(v) => `${Math.round(v).toLocaleString('en-US')} units`}
              delta={0.094}
              big
            />
            <div
              style={{
                background: 'linear-gradient(90deg, #0f172a, #334155)',
                color: '#ffffff',
                padding: '6px 10px',
              }}
            >
              Gradient banner literal prohibited by ink-and-paper token rules
            </div>
            <ToneAreaChart
              data={BACKORDER_SERIES}
              seriesLabel="Fulfilled SKU units"
              compareLabel="Prior window"
              showTable={false}
              height={220}
            />
          </div>
        </Panel>

        <PanelPair
          top={{
            label: 'Regional Fill Rate',
            children: (
              <Metric
                label="Fill Rate"
                value={98.4}
                format={(v) => `${v.toFixed(1)}%`}
                delta={0.02}
              />
            ),
          }}
          bottom={{
            label: 'Backorder Queue',
            children: (
              <Metric
                label="Open Backorders"
                value={19}
                format={(v) => `${Math.round(v)} SKUs`}
              />
            ),
          }}
        />
      </Scene>

      <Scene gutter="scene" layout="equal">
        <Panel label="Fulfillment center performance">
          <ToneBarList title="Fulfillment center performance" items={WAREHOUSE_BARS} />
        </Panel>
        <Panel label="High-density SKU allocation table">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Input
                label="Search SKU or warehouse"
                density="compact"
                value={skuSearch}
                onChange={(e) => setSkuSearch(e.target.value)}
              />
              <Select
                label="Warehouse region"
                id="c2-region-04-data-heavy"
                density="compact"
                value={region}
                onValueChange={setRegion}
              >
                <SelectTrigger ariaLabel="Warehouse region">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All hubs</SelectItem>
                  <SelectItem value="us-east-1">us-east-1</SelectItem>
                  <SelectItem value="eu-central-1">eu-central-1</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setSkuSearch('')}>
              Reset SKU Filter
            </Button>
            <Table density="compact">
              <TableCaption>High-density SKU allocation table (Multi-Region Inventory & Fulfillment Ledger)</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">SKU</TableHead>
                  <TableHead scope="col">Item</TableHead>
                  <TableHead scope="col">Hub</TableHead>
                  <TableHead scope="col">Stock</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>SKU-8801</TableCell>
                  <TableCell>Heavy Press Frame</TableCell>
                  <TableCell>us-east-1</TableCell>
                  <TableCell>In Stock (420)</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>SKU-8802</TableCell>
                  <TableCell>Registration Peg Bar</TableCell>
                  <TableCell>eu-central-1</TableCell>
                  <TableCell>Allocated (185)</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </Panel>
      </Scene>
    </Sheet>
  );
}
