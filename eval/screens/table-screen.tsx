'use client';

import * as React from 'react';
import { type MotionMode, useChanged } from '@/hooks/use-on-twos';
import {
  fmtMoney,
  Sheet,
  Scene,
  Panel,
  PanelPair,
  SegmentedControl,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
  Button,
  Badge,
  Tag,
  Notice,
  ToastProvider,
  useToast,
  EmptyState,
  Breadcrumb,
  Pagination,
  Metric,
  ToneBarList,
  ToneSpark,
  Balloon,
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/frame12';

type DispatchStatus = 'all' | 'recovered' | 'pending' | 'holdout';

interface LedgerRow {
  id: string;
  orderId: string;
  customer: string;
  channelId: 'email' | 'exit' | 'retry' | 'stock';
  channelLabel: string;
  status: 'recovered' | 'pending' | 'holdout';
  statusTag: string;
  liftPP: number;
  amount: number;
  dispatchedAt: string;
  payloadHash: string;
}

const LEDGER_ROWS: LedgerRow[] = [
  {
    id: 'r1',
    orderId: 'ORD-9041',
    customer: 'M. Takahashi',
    channelId: 'email',
    channelLabel: 'Abandoned-cart email',
    status: 'recovered',
    statusTag: 'RECOVERED',
    liftPP: 3.4,
    amount: 1420,
    dispatchedAt: 'Oct 31 · 14:22 UTC',
    payloadHash: 'sha256:8f41c2…b90e',
  },
  {
    id: 'r2',
    orderId: 'ORD-9042',
    customer: 'S. Lindqvist',
    channelId: 'exit',
    channelLabel: 'Exit-intent offer',
    status: 'recovered',
    statusTag: 'RECOVERED',
    liftPP: 2.9,
    amount: 980,
    dispatchedAt: 'Oct 31 · 13:50 UTC',
    payloadHash: 'sha256:3a92d1…41c7',
  },
  {
    id: 'r3',
    orderId: 'ORD-9043',
    customer: 'A. Vance',
    channelId: 'retry',
    channelLabel: 'Payment retry',
    status: 'pending',
    statusTag: 'PENDING',
    liftPP: 1.8,
    amount: 640,
    dispatchedAt: 'Oct 31 · 13:18 UTC',
    payloadHash: 'sha256:7c04e8…19f3',
  },
  {
    id: 'r4',
    orderId: 'ORD-9044',
    customer: 'H. Kobayashi',
    channelId: 'email',
    channelLabel: 'Abandoned-cart email',
    status: 'recovered',
    statusTag: 'RECOVERED',
    liftPP: 3.6,
    amount: 2150,
    dispatchedAt: 'Oct 31 · 12:41 UTC',
    payloadHash: 'sha256:1d77a9…62a0',
  },
  {
    id: 'r5',
    orderId: 'ORD-9045',
    customer: 'E. Navarro',
    channelId: 'stock',
    channelLabel: 'Back-in-stock alert',
    status: 'recovered',
    statusTag: 'RECOVERED',
    liftPP: 2.4,
    amount: 790,
    dispatchedAt: 'Oct 31 · 11:55 UTC',
    payloadHash: 'sha256:9b53f0…08d4',
  },
  {
    id: 'r6',
    orderId: 'ORD-9046',
    customer: 'J. Okafor',
    channelId: 'exit',
    channelLabel: 'Exit-intent offer',
    status: 'holdout',
    statusTag: 'HOLDOUT',
    liftPP: 0.0,
    amount: 510,
    dispatchedAt: 'Oct 31 · 11:12 UTC',
    payloadHash: 'sha256:5e18b4…73e1',
  },
  {
    id: 'r7',
    orderId: 'ORD-9047',
    customer: 'K. Mercier',
    channelId: 'retry',
    channelLabel: 'Payment retry',
    status: 'recovered',
    statusTag: 'RECOVERED',
    liftPP: 2.7,
    amount: 1190,
    dispatchedAt: 'Oct 31 · 10:34 UTC',
    payloadHash: 'sha256:4f29a6…84b2',
  },
];

const STATUS_OPTIONS: Array<{ value: DispatchStatus; label: string; unit: string }> = [
  { value: 'all', label: 'ALL', unit: 'rows' },
  { value: 'recovered', label: 'WON', unit: 'orders' },
  { value: 'pending', label: 'OPEN', unit: 'retry' },
  { value: 'holdout', label: 'CTRL', unit: 'hold' },
];

const MOTION_OPTIONS: Array<{ value: MotionMode; label: string; unit: string }> = [
  { value: 'stepped', label: '12', unit: 'fps' },
  { value: 'smooth', label: '60', unit: 'fps' },
  { value: 'cut', label: 'Cut', unit: '0ms' },
];

const CHANNEL_META: Array<{ id: LedgerRow['channelId']; name: string }> = [
  { id: 'email', name: 'Abandoned-cart email' },
  { id: 'exit', name: 'Exit-intent offer' },
  { id: 'retry', name: 'Payment retry' },
  { id: 'stock', name: 'Back-in-stock alert' },
];

function ReplayPayloadButton({
  orderId,
  onReplayed,
}: {
  orderId: string;
  onReplayed: () => void;
}) {
  const { toast } = useToast();
  return (
    <DialogClose
      id="table-payload-replay"
      variant="primary"
      onClick={() => {
        onReplayed();
        toast({
          id: 'replay-toast',
          status: 'success',
          title: 'Webhook replayed',
          description: `Re-dispatched envelope for ${orderId}`,
        });
      }}
    >
      Replay webhook
    </DialogClose>
  );
}

export function TableScreen({ initialTheme }: { initialTheme?: 'light' | 'dark' }) {
  const [motion, setMotion] = React.useState<MotionMode>('stepped');
  const [theme] = React.useState<'light' | 'dark' | undefined>(initialTheme);
  const [statusFilter, setStatusFilter] = React.useState<DispatchStatus>('all');
  const [channelFilter, setChannelFilter] = React.useState<string>('all');
  const [searchQuery, setSearchQuery] = React.useState<string>('');
  const [selectedOrderId, setSelectedOrderId] = React.useState<string>('ORD-9041');
  const [actionNote, setActionNote] = React.useState<string>('Showing live dispatch ledger');

  const filterKey = `${statusFilter}|${channelFilter}|${searchQuery}`;
  const changed = useChanged(filterKey);

  const filteredRows = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return LEDGER_ROWS.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (channelFilter !== 'all' && r.channelId !== channelFilter) return false;
      if (
        q &&
        !r.orderId.toLowerCase().includes(q) &&
        !r.customer.toLowerCase().includes(q) &&
        !r.channelLabel.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [statusFilter, channelFilter, searchQuery]);

  const totalAmount = React.useMemo(
    () => filteredRows.reduce((sum, r) => sum + r.amount, 0),
    [filteredRows],
  );

  const recoveredRate = React.useMemo(() => {
    if (filteredRows.length === 0) return 0;
    const won = filteredRows.filter((r) => r.status === 'recovered').length;
    return (won / filteredRows.length) * 100;
  }, [filteredRows]);

  const channelBars = React.useMemo(() => {
    const statusRows = LEDGER_ROWS.filter(
      (r) => statusFilter === 'all' || r.status === statusFilter,
    );
    const grandTotal = Math.max(
      1,
      statusRows.reduce((sum, r) => sum + r.amount, 0),
    );
    return CHANNEL_META.map((ch, idx) => {
      const val = statusRows
        .filter((r) => r.channelId === ch.id)
        .reduce((sum, r) => sum + r.amount, 0);
      return {
        id: ch.id,
        name: ch.name,
        value: val,
        formattedValue: fmtMoney(val),
        share: val / grandTotal,
        badge: idx === 0 ? 'Top channel' : undefined,
      };
    });
  }, [statusFilter]);

  const inspectedRow =
    LEDGER_ROWS.find((r) => r.orderId === selectedOrderId) ?? LEDGER_ROWS[0];

  return (
    <main className="eval-screen-root">
      <Sheet autoCut motion={motion} theme={theme} id="table-sheet">
        <ToastProvider maxVisible={3} density="compact">
      <header className="f12-hd">
        <div className="f12-hd-text">
          <Breadcrumb
            id="table-breadcrumb"
            density="compact"
            items={[
              { label: 'Atelier', href: '#atelier' },
              { label: 'Recovery', href: '#recovery' },
              { label: 'Dispatch Ledger' },
            ]}
          />
          <p className="f12-eyebrow">
            Ledger Sheet · Live Dispatch Log
            <Tag status="info">{filteredRows.length} rows</Tag>
            <Badge pop={changed} burst>
              {fmtMoney(totalAmount)}
            </Badge>
          </p>
          <h1 className="f12-title">Order Recovery Ledger</h1>
          <p className="f12-sub" id="table-status">
            {filteredRows.length} matching dispatches · {actionNote}
          </p>
        </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 'var(--f-gutter-pair)',
              alignItems: 'center',
            }}
          >
            <SegmentedControl
              options={STATUS_OPTIONS}
              value={statusFilter}
              onChange={(s) => {
                setStatusFilter(s);
                setActionNote(`Filtered status: ${s}`);
              }}
              ariaLabel="Filter by dispatch status"
              idPrefix="tbl-status"
            />
            <SegmentedControl
              options={MOTION_OPTIONS}
              value={motion}
              onChange={setMotion}
              ariaLabel="Motion mode"
              idPrefix="tbl-mo"
            />
          </div>
        </header>

        <Scene gutter="scene" layout="split" id="table-scene-primary">
          <Panel label="Filter controls and intervention ledger table">
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--f-gutter-scene)',
              }}
            >
              <Panel
                variant="quiet"
                id="table-filter-quiet-panel"
                label="Filter bar ledger"
              >
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 'var(--f-gutter-pair)',
                    alignItems: 'flex-end',
                    justifyContent: 'space-between',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 'var(--f-gutter-pair)',
                      alignItems: 'flex-end',
                      flex: 1,
                    }}
                  >
                    <Input
                      id="ledger-search"
                      density="compact"
                      label="Search order or customer"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="ORD-9041 or Takahashi"
                    />
                    <Select
                      id="ledger-channel-select"
                      density="compact"
                      label="Filter by channel"
                      value={channelFilter}
                      onValueChange={(val) => {
                        setChannelFilter(val);
                        setActionNote(`Channel filter: ${val}`);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All channels</SelectItem>
                        <SelectItem value="email">Abandoned-cart email</SelectItem>
                        <SelectItem value="exit">Exit-intent offer</SelectItem>
                        <SelectItem value="retry">Payment retry</SelectItem>
                        <SelectItem value="stock">Back-in-stock alert</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 'var(--f-gutter-pair)',
                      alignItems: 'center',
                    }}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger id="ledger-export-menu" variant="secondary">
                        Export ledger
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuLabel>Export format</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          id="ledger-export-csv"
                          onSelect={() =>
                            setActionNote(`Exported ${filteredRows.length} rows as CSV`)
                          }
                        >
                          Download CSV ({filteredRows.length} rows)
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          id="ledger-export-json"
                          onSelect={() =>
                            setActionNote(`Copied ${filteredRows.length} rows as JSON`)
                          }
                        >
                          Copy JSON snapshot
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <Button
                      id="ledger-reset-btn"
                      variant="secondary"
                      onClick={() => {
                        setStatusFilter('all');
                        setChannelFilter('all');
                        setSearchQuery('');
                        setActionNote('Cleared all ledger filters');
                      }}
                    >
                      Reset filters
                    </Button>
                  </div>
                </div>
              </Panel>

              <Notice
                id="table-ledger-notice"
                status={statusFilter === 'pending' ? 'warning' : 'info'}
                density="compact"
                title={statusFilter === 'pending' ? 'Retry queue active' : 'Ledger synchronized'}
              >
                {actionNote}
              </Notice>

              {filteredRows.length === 0 ? (
                <EmptyState
                  id="table-empty-state"
                  density="compact"
                  code="0 MATCHING DISPATCHES"
                  title="No dispatches match active filters"
                  description="Clear the search query or reset channel and status filters to restore the ledger."
                  action={
                    <Button
                      id="table-empty-reset"
                      size="sm"
                      variant="primary"
                      onClick={() => {
                        setStatusFilter('all');
                        setChannelFilter('all');
                        setSearchQuery('');
                        setActionNote('Cleared all ledger filters');
                      }}
                    >
                      Reset filters
                    </Button>
                  }
                />
              ) : (
                <Table density="compact" id="table-ledger-compact">
                  <TableCaption>
                    Showing {filteredRows.length} of {LEDGER_ROWS.length} recorded dispatches
                  </TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <strong>{row.orderId}</strong>
                        </TableCell>
                        <TableCell>{row.customer}</TableCell>
                        <TableCell>{row.channelLabel}</TableCell>
                        <TableCell>
                          <Tag
                            status={
                              row.status === 'recovered'
                                ? 'success'
                                : row.status === 'pending'
                                  ? 'warning'
                                  : 'neutral'
                            }
                          >
                            {row.statusTag}
                          </Tag>
                        </TableCell>
                        <TableCell>{fmtMoney(row.amount)}</TableCell>
                        <TableCell>
                          <Button
                            id={`inspect-${row.id}`}
                            size="sm"
                            variant={selectedOrderId === row.orderId ? 'primary' : 'secondary'}
                            onClick={() => {
                              setSelectedOrderId(row.orderId);
                              setActionNote(`Inspecting ${row.orderId}`);
                            }}
                          >
                            Inspect
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={4}>
                        Filtered Total ({filteredRows.length} dispatches)
                      </TableCell>
                      <TableCell>{fmtMoney(totalAmount)}</TableCell>
                      <TableCell>100%</TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              )}

              <Pagination
                id="table-pagination"
                density="compact"
                page={1}
                totalPages={1}
                showSummary
                totalItems={filteredRows.length}
                pageSize={10}
              />
            </div>
          </Panel>

          <PanelPair
            id="table-kpis"
            top={{
              label: 'Filtered recovery total',
              children: (
                <Metric
                  label="Filtered recovery total"
                  value={totalAmount}
                  format={fmtMoney}
                  delta={0.146}
                  deltaKind="pct"
                  comparisonLabel="vs prior window"
                  note="Updates on twos as status, channel, or search filters change"
                  motion={motion}
                  big
                  spark={
                    <ToneSpark
                      values={
                        filteredRows.length > 0
                          ? filteredRows.map((r) => r.amount)
                          : [0]
                      }
                      label="Filtered order values"
                      rangeKey={filterKey}
                      motion={motion}
                    />
                  }
                />
              ),
            }}
            bottom={{
              label: 'Filtered recovery rate',
              children: (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--f-gutter-pair)',
                  }}
                >
                  <Metric
                    label="Filtered recovery rate"
                    value={recoveredRate}
                    format={(v) => `${v.toFixed(1)}%`}
                    delta={2.4}
                    deltaKind="pp"
                    comparisonLabel="vs holdout baseline"
                    motion={motion}
                  />
                  <div>
                    <Balloon tailOffset={-14}>
                      Top order · ORD-9044 ($2,150)
                    </Balloon>
                  </div>
                </div>
              ),
            }}
          />
        </Scene>

        <Scene gutter="change" layout="equal" id="table-scene-secondary">
          <Panel label="Recovered volume by channel">
            <ToneBarList
              title="Volume by dispatch channel"
              subtitle="Click a channel bar to filter C-01 ledger rows"
              items={channelBars}
              selectedId={channelFilter === 'all' ? null : channelFilter}
              onSelect={(id) => {
                const next = id ?? 'all';
                setChannelFilter(next);
                setActionNote(id ? `Filtered channel: ${id}` : 'Showing all channels');
              }}
              motion={motion}
              changed={changed}
              idPrefix="tbl-ch"
            />
          </Panel>

          <Panel label="Selected order audit inspector">
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--f-gutter-scene)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 'var(--f-gutter-pair)',
                }}
              >
                <h2 className="f12-m-label">Dispatch Inspector · {inspectedRow.orderId}</h2>
                <Tag
                  status={
                    inspectedRow.status === 'recovered'
                      ? 'success'
                      : inspectedRow.status === 'pending'
                        ? 'warning'
                        : 'neutral'
                  }
                >
                  {inspectedRow.statusTag}
                </Tag>
              </div>

              <Panel
                variant="quiet"
                id="table-inspector-quiet-panel"
                label="Selected order audit metadata"
              >
                <Table density="compact">
                  <TableCaption>Audit metadata for {inspectedRow.orderId}</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Field</TableHead>
                      <TableHead>Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>Customer</TableCell>
                      <TableCell>{inspectedRow.customer}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Channel</TableCell>
                      <TableCell>{inspectedRow.channelLabel}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Dispatched at</TableCell>
                      <TableCell>{inspectedRow.dispatchedAt}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Signature digest</TableCell>
                      <TableCell>{inspectedRow.payloadHash}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Panel>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 'var(--f-gutter-pair)',
                  alignItems: 'center',
                }}
              >
                <Dialog>
                  <DialogTrigger id="table-payload-open" variant="marker">
                    Inspect webhook payload
                  </DialogTrigger>
                  <DialogContent cut="C-06">
                    <DialogHeader>
                      <DialogTitle>Webhook Payload · {inspectedRow.orderId}</DialogTitle>
                      <DialogDescription>
                        Signed dispatch envelope delivered for {inspectedRow.customer} (
                        {fmtMoney(inspectedRow.amount)}).
                      </DialogDescription>
                    </DialogHeader>
                    <p
                      style={{
                        margin: 0,
                        fontFamily: 'var(--font-f-mono)',
                        fontSize: '12px',
                        color: 'var(--f-ink)',
                      }}
                    >
                      event=&quot;checkout.intervention.{inspectedRow.status}&quot; · order=&quot;
                      {inspectedRow.orderId}&quot; · digest=&quot;{inspectedRow.payloadHash}&quot;
                    </p>
                    <DialogFooter>
                      <DialogClose id="table-payload-close" variant="secondary">
                        Close
                      </DialogClose>
                      <ReplayPayloadButton
                        orderId={inspectedRow.orderId}
                        onReplayed={() =>
                          setActionNote(`Replayed webhook for ${inspectedRow.orderId}`)
                        }
                      />
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </Panel>
        </Scene>
        </ToastProvider>
      </Sheet>
    </main>
  );
}
