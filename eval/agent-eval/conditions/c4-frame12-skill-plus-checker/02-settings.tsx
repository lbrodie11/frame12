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
    "id": "AUD-201",
    "target": "WebAuthn Passkey Policy",
    "region": "us-east-1",
    "latency": "12ms",
    "attainment": "100.0%",
    "status": "success",
    "statusLabel": "Enforced"
  },
  {
    "id": "AUD-202",
    "target": "EU VAT Invoice Routing",
    "region": "eu-central-1",
    "latency": "18ms",
    "attainment": "99.99%",
    "status": "info",
    "statusLabel": "Active"
  },
  {
    "id": "AUD-203",
    "target": "APAC Spend Cap Alerting",
    "region": "ap-northeast-1",
    "latency": "24ms",
    "attainment": "99.95%",
    "status": "warning",
    "statusLabel": "85% Cap"
  },
  {
    "id": "AUD-204",
    "target": "SAML 2.0 JIT Role Mapping",
    "region": "us-east-1",
    "latency": "15ms",
    "attainment": "100.0%",
    "status": "success",
    "statusLabel": "Enforced"
  },
  {
    "id": "AUD-205",
    "target": "Immutable 90d Audit Vault",
    "region": "eu-central-1",
    "latency": "21ms",
    "attainment": "99.99%",
    "status": "success",
    "statusLabel": "Verified"
  },
  {
    "id": "AUD-206",
    "target": "Break-Glass Key Rotation",
    "region": "ap-northeast-1",
    "latency": "19ms",
    "attainment": "99.97%",
    "status": "info",
    "statusLabel": "Scheduled"
  }
];

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
  const headlineValue = series.reduce((acc, p) => acc + p.value, 0);

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
              { label: 'Settings', href: '#category' },
              { label: 'Organization Security & Billing Preferences', current: true },
            ]}
          />
          <p className="f12-eyebrow">
            02-SETTINGS <Tag status="info">Settings</Tag>
            <Badge pop={changed} burst={false}>On Twos · 12fps</Badge>
          </p>
          <h1 className="f12-title">Organization Security & Billing Preferences</h1>
          <p className="f12-muted-copy">
            Storyboard-grade composition pairing Expressive establishing cuts with Quiet 1px operational ledgers.
          </p>
        </div>

        <SegmentedControl
          idPrefix="eval-range-02-settings"
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
          <div className="f12-stack-scene">
            <div className="f12-row-between">
              <Metric
                label="Enforced Security Controls"
                value={headlineValue}
                format={(v) => `${Math.round(v).toLocaleString('en-US')} ops`}
                delta={0.142}
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
              seriesLabel="Verified signing events"
              compareLabel="Prior window"
              labelColumnHeader="Window"
              height={220}
              showTable
            />
          </div>
        </Panel>

        <PanelPair
          variant="quiet"
          top={{
            label: 'P95 Execution Latency',
            children: (
              <Metric
                variant="quiet"
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
                variant="quiet"
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
        <Panel variant="quiet" label="Ranked regional breakdown">
          <ToneBarList
            title="Control compliance by domain"
            subtitle={`${range}D window`}
            items={BAR_ITEMS}
            selectedId={selectedBar}
            onSelect={setSelectedBar}
            changed={changed}
            density="compact"
            idPrefix="eval-bar-02-settings"
          />
        </Panel>

        <Panel variant="quiet" label="Organization security and billing configuration">
          <Tabs defaultValue="sso" density="compact" idPrefix="eval-tabs-02-settings">
            <TabsList ariaLabel="Security and billing preference sections">
              <TabsTrigger value="sso">01 · SSO &amp; Passkeys</TabsTrigger>
              <TabsTrigger value="billing">02 · Invoice &amp; Spend Caps</TabsTrigger>
              <TabsTrigger value="retention">03 · Audit Retention</TabsTrigger>
            </TabsList>
            <TabsContent value="sso">
              <div className="f12-stack-pair">
                <Notice status="info" title="Hardware WebAuthn passkeys enforced">
                  All privileged operators must authenticate with FIDO2 passkeys before modifying billing or retention rules.
                </Notice>
                <Switch
                  label="Enforce WebAuthn hardware passkeys for all organization admins"
                  density="compact"
                  checked={strictMode}
                  onCheckedChange={setStrictMode}
                />
                <Checkbox
                  label="Require SAML 2.0 JIT role assertion on every session renewal"
                  density="compact"
                  defaultChecked
                />
              </div>
            </TabsContent>
            <TabsContent value="billing">
              <div className="f12-stack-pair">
                <Input
                  label="Invoice routing email"
                  density="compact"
                  defaultValue="billing-ops@atelier-koma.io"
                />
                <Field label="Monthly spend cap action" density="compact">
                  <RadioGroup
                    name="cadence-02-settings"
                    value={cadence}
                    onValueChange={setCadence}
                    density="compact"
                    orientation="horizontal"
                    options={[
                      { value: 'realtime', label: '80% Alert webhook' },
                      { value: 'staged', label: '95% Soft throttle' },
                      { value: 'manual', label: '100% Hard cap' },
                    ]}
                  />
                </Field>
              </div>
            </TabsContent>
            <TabsContent value="retention">
              <div className="f12-stack-pair">
                <Textarea
                  label="Compliance custodian handoff note"
                  density="compact"
                  defaultValue="Immutable 90-day SOC2 audit log stream replicated to us-east-1 and eu-central-1."
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
                  id="eval-region-02-settings"
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
              <Table density="compact" id="eval-ledger-table-02-settings">
                <TableCaption>Security & billing audit trail (Organization Security & Billing Preferences)</TableCaption>
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
