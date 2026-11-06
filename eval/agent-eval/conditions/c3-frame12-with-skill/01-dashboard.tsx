import * as React from 'react';
import { useChanged } from '@/hooks/use-on-twos';
import {
  Sheet,
  Scene,
  Panel,
  PanelPair,
  SegmentedControl,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Button,
  Field,
  Input,
  Textarea,
  Checkbox,
  RadioGroup,
  Switch,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Badge,
  Tag,
  Notice,
  EmptyState,
  Breadcrumb,
  Pagination,
  Metric,
  ToneAreaChart,
  ToneBarList,
  ToneSpark,
  Balloon,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from '@/components/frame12';

const SERIES_BY_RANGE = {
  7: [
    { label: 'Nov 01', longLabel: 'November 1', value: 4120, compareValue: 3810 },
    { label: 'Nov 02', longLabel: 'November 2', value: 4480, compareValue: 3990 },
    { label: 'Nov 03', longLabel: 'November 3', value: 4790, compareValue: 4120 },
    { label: 'Nov 04', longLabel: 'November 4', value: 5180, compareValue: 4350 },
    { label: 'Nov 05', longLabel: 'November 5', value: 5640, compareValue: 4510 },
  ],
  30: [
    { label: 'W1', longLabel: 'Week 1', value: 18420, compareValue: 16200 },
    { label: 'W2', longLabel: 'Week 2', value: 21350, compareValue: 18900 },
    { label: 'W3', longLabel: 'Week 3', value: 24890, compareValue: 20400 },
    { label: 'W4', longLabel: 'Week 4', value: 28110, compareValue: 22750 },
  ],
  90: [
    { label: 'M1', longLabel: 'Month 1', value: 68400, compareValue: 61200 },
    { label: 'M2', longLabel: 'Month 2', value: 79200, compareValue: 68900 },
    { label: 'M3', longLabel: 'Month 3', value: 91450, compareValue: 76300 },
  ],
} as const;

const BAR_ITEMS = [
  {
    id: 'gateway',
    name: 'US-East Primary Gateway',
    value: 14820,
    formattedValue: '14,820 ops',
    share: 0.46,
    badge: 'Leader',
    pattern: 'dots' as const,
  },
  {
    id: 'relay',
    name: 'EU-Central Webhook Relay',
    value: 10310,
    formattedValue: '10,310 ops',
    share: 0.32,
    pattern: 'hatch' as const,
  },
  {
    id: 'ledger',
    name: 'AP-Northeast Fulfillment Sync',
    value: 7090,
    formattedValue: '7,090 ops',
    share: 0.22,
    pattern: 'dense' as const,
  },
];

interface LedgerRow {
  id: string;
  target: string;
  region: string;
  latency: string;
  attainment: string;
  status: 'success' | 'info' | 'warning' | 'danger';
  statusLabel: string;
}

const LEDGER_ROWS: LedgerRow[] = [
  {
    "id": "INC-401",
    "target": "US-East Primary Gateway",
    "region": "us-east-1",
    "latency": "28ms",
    "attainment": "99.98%",
    "status": "success",
    "statusLabel": "Resolved"
  },
  {
    "id": "INC-402",
    "target": "EU-Central Webhook Relay",
    "region": "eu-central-1",
    "latency": "41ms",
    "attainment": "99.95%",
    "status": "info",
    "statusLabel": "Monitoring"
  },
  {
    "id": "INC-403",
    "target": "AP-Northeast Fulfillment Sync",
    "region": "ap-northeast-1",
    "latency": "64ms",
    "attainment": "99.82%",
    "status": "warning",
    "statusLabel": "Mitigating"
  },
  {
    "id": "INC-404",
    "target": "US-West Failover Edge",
    "region": "us-east-1",
    "latency": "31ms",
    "attainment": "99.99%",
    "status": "success",
    "statusLabel": "Resolved"
  },
  {
    "id": "INC-405",
    "target": "EU-West Checkout Signer",
    "region": "eu-central-1",
    "latency": "37ms",
    "attainment": "99.96%",
    "status": "success",
    "statusLabel": "Resolved"
  },
  {
    "id": "INC-406",
    "target": "AP-South Telemetry Collector",
    "region": "ap-northeast-1",
    "latency": "52ms",
    "attainment": "99.91%",
    "status": "info",
    "statusLabel": "Monitoring"
  }
];

const INCIDENT_DURATIONS_MIN_BY_RANGE: Record<7 | 30 | 90, readonly number[]> = {
  7: [10.4, 12.6, 11.2, 13.0],
  30: [13.2, 15.6, 12.8, 15.2],
  90: [15.4, 17.8, 16.0, 16.4],
};

export function EvalScreen({ theme = 'light' }: { theme?: 'light' | 'dark' }) {
  const [range, setRange] = React.useState<7 | 30 | 90>(30);
  const [selectedBar, setSelectedBar] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState('');
  const [regionFilter, setRegionFilter] = React.useState('all');
  const [strictMode, setStrictMode] = React.useState(true);
  const [cadence, setCadence] = React.useState('realtime');
  const [page, setPage] = React.useState(1);

  const changed = useChanged(`${range}-${selectedBar}`);

  const series = SERIES_BY_RANGE[range];
  const recoverySamples = INCIDENT_DURATIONS_MIN_BY_RANGE[range];
  const headlineValue =
    recoverySamples.reduce((acc, d) => acc + d, 0) / recoverySamples.length;

  const filteredRows = LEDGER_ROWS.filter((r) => {
    const matchesSearch =
      !search.trim() ||
      r.target.toLowerCase().includes(search.toLowerCase()) ||
      r.id.toLowerCase().includes(search.toLowerCase());
    const matchesRegion = regionFilter === 'all' || r.region === regionFilter;
    return matchesSearch && matchesRegion;
  });

  const pageSize = 2;
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedRows = filteredRows.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <Sheet autoCut pegs motion="stepped" theme={theme}>
      <header className="f12-hd">
        <div className="f12-hd-text">
          <Breadcrumb
            items={[
              { label: 'FRAME/12 Control Plane', href: '#control-plane' },
              { label: 'Dashboard', href: '#category' },
              { label: 'Operational Incident & SLO Dashboard', current: true },
            ]}
          />
          <p className="f12-eyebrow">
            01-DASHBOARD <Tag status="info">Dashboard</Tag>
            <Badge pop={changed} burst={false}>On Twos · 12fps</Badge>
          </p>
          <h1 className="f12-title">Operational Incident & SLO Dashboard</h1>
          <p className="f12-muted-copy">
            Storyboard-grade composition pairing Expressive establishing cuts with Quiet 1px operational ledgers.
          </p>
        </div>

        <SegmentedControl
          idPrefix="eval-range-01-dashboard"
          ariaLabel="Exposure window"
          options={[
            { value: 7, label: '7', unit: 'days' },
            { value: 30, label: '30', unit: 'days' },
            { value: 90, label: '90', unit: 'days' },
          ]}
          value={range}
          onChange={setRange}
        />
      </header>

      <Scene gutter="scene" layout="split">
        <Panel label="Establishing telemetry and trend">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--f-gutter-scene)' }}>
            <div className="f12-row-between">
              <Metric
                label="Mean Time to Recovery (MTTR)"
                value={headlineValue}
                format={(v) => `${v.toFixed(1)}m`}
                delta={-0.142}
                deltaKind="pct"
                range={range}
                big
              />
              <Balloon tailOffset={-12} showDot>
                Peak window verified · 99.98% SLO
              </Balloon>
            </div>
            <ToneAreaChart
              data={[...series]}
              seriesLabel="Error-budget burn rate (ops)"
              compareLabel="Prior window"
              labelColumnHeader="Window"
              height={220}
              showTable
            />
          </div>
        </Panel>

        <PanelPair
          variant="expressive"
          top={{
            label: 'P95 Execution Latency',
            children: (
              <Metric
                variant="expressive"
                label="P95 Execution Latency"
                value={range === 7 ? 34 : range === 30 ? 38 : 41}
                format={(v) => `${Math.round(v)}ms`}
                delta={-0.094}
                deltaKind="pct"
                spark={
                  <ToneSpark
                    label="7-day latency pulse"
                    values={[44, 42, 39, 41, 38, 36, 34]}
                    rangeKey={range}
                  />
                }
              />
            ),
          }}
          bottom={{
            label: 'SLO Attainment Budget',
            children: (
              <Metric
                variant="expressive"
                label="SLO Attainment Budget"
                value={99.96}
                format={(v) => `${v.toFixed(2)}%`}
                delta={0.18}
                deltaKind="pp"
              />
            ),
          }}
        />
      </Scene>

      <Scene gutter="scene" layout="equal">
        <Panel variant="expressive" label="Ranked regional breakdown">
          <ToneBarList
            title="Service blast-radius breakdown"
            subtitle={`${range}D window`}
            items={BAR_ITEMS}
            selectedId={selectedBar}
            onSelect={setSelectedBar}
            changed={changed}
            density="compact"
            idPrefix="eval-bar-01-dashboard"
          />
        </Panel>

        <Panel variant="quiet" label="Operational configuration and rollout policy">
          <Tabs defaultValue="policy" density="compact" idPrefix="eval-tabs-01-dashboard">
            <TabsList ariaLabel="Configuration sections">
              <TabsTrigger value="policy">01 · Policy &amp; Routing</TabsTrigger>
              <TabsTrigger value="notes">02 · Runbook &amp; Signoff</TabsTrigger>
            </TabsList>
            <TabsContent value="policy">
              <div className="f12-stack-pair">
                <Notice status="info" title="Deterministic guardrails active">
                  All changes validate schema signatures before promotion.
                </Notice>
                <Field label="Rollout dispatch cadence" density="compact">
                  <RadioGroup
                    name="cadence-01-dashboard"
                    value={cadence}
                    onValueChange={setCadence}
                    density="compact"
                    orientation="horizontal"
                    options={[
                      { value: 'realtime', label: 'Real-time cut' },
                      { value: 'staged', label: '10% Canary' },
                      { value: 'manual', label: 'Manual hold' },
                    ]}
                  />
                </Field>
                <Switch
                  label="Enforce cryptographic Ed25519 commit signature"
                  density="compact"
                  checked={strictMode}
                  onCheckedChange={setStrictMode}
                />
                <Checkbox
                  label="Require dual-operator signoff on production promotion"
                  density="compact"
                  defaultChecked
                />
              </div>
            </TabsContent>
            <TabsContent value="notes">
              <div className="f12-stack-pair">
                <Textarea
                  label="Operator handoff note"
                  density="compact"
                  defaultValue="Verified across US-East and EU-Central edges."
                />
              </div>
            </TabsContent>
          </Tabs>
        </Panel>
      </Scene>

      <Scene gutter="scene" layout="stack">
        <Panel variant="quiet" label="Filterable operational ledger">
          <div className="f12-stack-pair">
            <div className="f12-row-between">
              <div className="f12-row-pair">
                <Input
                  label="Search ledger"
                  density="compact"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Filter by ID or target..."
                />
                <Select
                  label="Region scope"
                  id="eval-region-01-dashboard"
                  density="compact"
                  value={regionFilter}
                  onValueChange={(next) => {
                    setRegionFilter(next);
                    setPage(1);
                  }}
                >
                  <SelectTrigger ariaLabel="Region scope">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All regions (6)</SelectItem>
                    <SelectItem value="us-east-1">us-east-1</SelectItem>
                    <SelectItem value="eu-central-1">eu-central-1</SelectItem>
                    <SelectItem value="ap-northeast-1">ap-northeast-1</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="marker" size="sm">Promote Cut</Button>
                </DialogTrigger>
                <DialogContent cut="C-09">
                  <DialogHeader>
                    <DialogTitle>Confirm production cut promotion</DialogTitle>
                    <DialogDescription>
                      This action stamps the active configuration snapshot across all regions.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <DialogClose variant="secondary">Cancel</DialogClose>
                    <DialogClose variant="primary">Confirm Promotion</DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {filteredRows.length === 0 ? (
              <EmptyState
                variant="quiet"
                density="compact"
                code="0 MATCHING RECORDS"
                title="No ledger rows match active filter"
                description="Clear the search query or switch region scope back to All regions."
                action={
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSearch('');
                      setRegionFilter('all');
                      setPage(1);
                    }}
                  >
                    Reset Filters
                  </Button>
                }
              />
            ) : (
              <Table density="compact" id="eval-ledger-table-01-dashboard">
                <TableCaption>Active incident responder ledger (Operational Incident & SLO Dashboard)</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Record ID</TableHead>
                    <TableHead scope="col">Target Resource</TableHead>
                    <TableHead scope="col">Region</TableHead>
                    <TableHead scope="col">P95 Latency</TableHead>
                    <TableHead scope="col">Attainment</TableHead>
                    <TableHead scope="col">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell><code className="f12-code-inline">{row.id}</code></TableCell>
                      <TableCell>{row.target}</TableCell>
                      <TableCell><code className="f12-code-inline">{row.region}</code></TableCell>
                      <TableCell>{row.latency}</TableCell>
                      <TableCell>{row.attainment}</TableCell>
                      <TableCell>
                        <Tag status={row.status}>{row.statusLabel}</Tag>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            <Pagination
              page={safePage}
              totalPages={totalPages}
              onPageChange={setPage}
              density="compact"
              showSummary
            />
          </div>
        </Panel>
      </Scene>
    </Sheet>
  );
}
