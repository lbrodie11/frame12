import * as React from 'react';
import { SUMMARIES, STORE, END_LABEL, fmtMoney, fmtMoneyShort, fmtPP } from '../../lab/src/data.js';
import { type MotionMode, useChanged, useOnTwos, useCountUp } from '@/hooks/use-on-twos';
import {
  Sheet,
  Scene,
  SceneArea,
  Panel,
  PanelPair,
  SegmentedControl,
  Button,
  Field,
  Input,
  Textarea,
  Checkbox,
  RadioGroup,
  RadioGroupItem,
  Switch,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Badge,
  Tag,
  Stamp,
  Alert,
  Notice,
  AlertTitle,
  AlertDescription,
  AlertActions,
  ToastProvider,
  useToast,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastAction,
  ToastClose,
  Skeleton,
  SkeletonText,
  EmptyState,
  EmptyStateIcon,
  EmptyStateTitle,
  EmptyStateDescription,
  EmptyStateActions,
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
  buildPaginationRange,
  Metric,
  Balloon,
  GhostWire,
  Receipt,
  ReceiptList,
  ToneAreaChart,
  ToneBarList,
  ToneSpark,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from '@/components/frame12';

const RANGE_OPTIONS = [
  { value: 7, label: '7', unit: 'days' },
  { value: 30, label: '30', unit: 'days' },
  { value: 90, label: '90', unit: 'days' },
];

const MOTION_OPTIONS: Array<{ value: MotionMode; label: string; unit: string }> = [
  { value: 'stepped', label: '12', unit: 'fps' },
  { value: 'smooth', label: '60', unit: 'fps' },
  { value: 'cut', label: 'Cut', unit: '0ms' },
];

function AdapterScenePanels({
  range,
  channel,
  setChannel,
  setLastAction,
  summary,
}: {
  range: number;
  channel: string;
  setChannel: (v: string) => void;
  setLastAction: (v: string) => void;
  summary: {
    revenue: number;
    rows: Array<{ id: string; name: string; share: number; value: number }>;
  };
}) {
  return (
    <>
      <Panel label="Interactive primitive adapters">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h2 className="f12-m-label">Primitive Adapters</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
            <form
              id="gal-select-form"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                setLastAction(`Form channel: ${String(fd.get('recoveryChannel') ?? '')}`);
              }}
            >
              <Select
                id="gal-select"
                name="recoveryChannel"
                label="Recovery channel"
                value={channel}
                onValueChange={(v) => {
                  setChannel(v);
                  setLastAction(`Channel: ${v}`);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Abandoned-cart email</SelectItem>
                  <SelectItem value="exit">Exit-intent offer</SelectItem>
                  <SelectItem value="stock">Back-in-stock alert</SelectItem>
                </SelectContent>
              </Select>
            </form>

            <Dialog>
              <DialogTrigger id="gal-dialog-open" variant="secondary">
                Inspect cut sheet
              </DialogTrigger>
              <DialogContent cut="C-08">
                <DialogHeader>
                  <DialogTitle>Cut Sheet Inspection</DialogTitle>
                  <DialogDescription>
                    Every panel in FRAME/12 is numbered in reading order and framed with 2.5px
                    ink rules.
                  </DialogDescription>
                </DialogHeader>
                <p style={{ margin: 0, fontSize: '14px' }}>
                  Active range: {range} days · Channel: {channel}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <DropdownMenu>
                    <DropdownMenuTrigger id="gal-dialog-menu-trigger" variant="secondary" size="sm">
                      Nested menu ▼
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuLabel>Cut actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        id="gal-dialog-menu-item"
                        onSelect={() => setLastAction('Nested menu action')}
                      >
                        Verify cut order
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <DialogFooter>
                  <DialogClose id="gal-dialog-close" variant="primary">
                    Confirm cut
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger id="gal-tooltip-trigger">Spacing note</TooltipTrigger>
                <TooltipContent>Held for 2 frames at 24fps (83.33ms)</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <DropdownMenu>
              <DropdownMenuTrigger id="gal-menu-trigger" variant="secondary">
                Export sheet
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Format</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  id="gal-menu-csv"
                  onSelect={() => setLastAction('Exported CSV')}
                >
                  Download CSV ledger
                </DropdownMenuItem>
                <DropdownMenuItem
                  id="gal-menu-json"
                  onSelect={() => setLastAction('Exported JSON')}
                >
                  Copy JSON snapshot
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </Panel>

      <Panel label="Tabular ledger adapter">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h2 className="f12-m-label">Intervention Ledger</h2>
          <Table>
            <TableCaption>Summary for the last {range} days</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Intervention</TableHead>
                <TableHead>Share</TableHead>
                <TableHead>Recovered</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.rows
                .slice(0, 3)
                .map((r: { id: string; name: string; share: number; value: number }) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.name}</TableCell>
                    <TableCell>{(r.share * 100).toFixed(0)}%</TableCell>
                    <TableCell>{fmtMoney(r.value)}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>Total</TableCell>
                <TableCell>100%</TableCell>
                <TableCell>{fmtMoney(summary.revenue)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </Panel>
    </>
  );
}

export function GalleryApp() {
  const [range, setRange] = React.useState<number>(30);
  const [motion, setMotion] = React.useState<MotionMode>('stepped');
  const [theme, setTheme] = React.useState<'light' | 'dark' | undefined>(undefined);
  const [focusId, setFocusId] = React.useState<string | null>(null);
  const [channel, setChannel] = React.useState<string>('email');
  const [storeName, setStoreName] = React.useState<string>(STORE);
  const [threshold, setThreshold] = React.useState<string>('15');
  const [lastAction, setLastAction] = React.useState<string>('Ready');

  const summary = SUMMARIES[range as 7 | 30 | 90];
  const changed = useChanged(range);

  const focusedRow = focusId ? summary.rows.find((r: { id: string }) => r.id === focusId) : null;

  const chartData = React.useMemo(
    () =>
      summary.days.map(
        (d: {
          label: string;
          long: string;
          total: number;
          byId: Record<string, number>;
        }) => ({
          label: d.label,
          longLabel: d.long,
          value: d.total,
          compareValue: focusId ? d.byId[focusId] : undefined,
        }),
      ),
    [summary, focusId],
  );

  const barItems = React.useMemo(
    () =>
      summary.rows.map(
        (
          r: { id: string; name: string; value: number; share: number },
          idx: number,
        ) => ({
          id: r.id,
          name: r.name,
          value: r.value,
          formattedValue: fmtMoney(r.value),
          share: r.share,
          badge: idx === 0 ? 'Top performer' : undefined,
        }),
      ),
    [summary],
  );

  const profitValues = React.useMemo(
    () => summary.days.map((d: { profit: number }) => d.profit),
    [summary],
  );
  const liftValues = React.useMemo(
    () => summary.days.map((d: { lift: number }) => d.lift),
    [summary],
  );

  return (
    <main className="gallery-root">
      <Sheet autoCut motion={motion} theme={theme} id="gallery-sheet">
        <header className="f12-hd">
          <div className="f12-hd-text">
            <p className="f12-eyebrow">
              {storeName}
              <Tag>Example data</Tag>
              <Badge burst={false}>FRAME/12 Registry</Badge>
            </p>
            <h1 className="f12-title" style={{ margin: '10px 0 0' }}>
              Component Gallery
            </h1>
            <p className="f12-sub">Through {END_LABEL} · Status: {lastAction}</p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
            <SegmentedControl
              options={MOTION_OPTIONS}
              value={motion}
              onChange={setMotion}
              ariaLabel="Motion mode"
              idPrefix="mo"
            />
            <SegmentedControl
              options={RANGE_OPTIONS}
              value={range}
              onChange={setRange}
              ariaLabel="Date range"
              idPrefix="gal-rng"
            />
            <div role="group" aria-label="Theme override" style={{ display: 'flex', gap: '6px' }}>
              <Button
                id="theme-light"
                size="sm"
                variant={theme === 'light' ? 'primary' : 'secondary'}
                onClick={() => setTheme('light')}
              >
                Light
              </Button>
              <Button
                id="theme-dark"
                size="sm"
                variant={theme === 'dark' ? 'primary' : 'secondary'}
                onClick={() => setTheme('dark')}
              >
                Dark
              </Button>
            </div>
          </div>
        </header>

        <Scene gutter="scene" layout="split" id="scene-primary">
          <Panel className="c01" label="Recovered revenue over time">
            <div className="f12-c01-hd">
              <Metric
                label="Recovered revenue"
                value={summary.revenue}
                format={fmtMoney}
                delta={summary.revenueDelta}
                deltaKind="pct"
                range={range}
                motion={motion}
                big
              />
              {focusedRow ? (
                <ul className="f12-legend" aria-label="Chart legend">
                  <li>
                    <i className="f12-sw f12-sw-total" aria-hidden="true" />
                    All interventions
                  </li>
                  <li>
                    <i className="f12-sw f12-sw-focus" aria-hidden="true" />
                    {focusedRow.name}
                  </li>
                </ul>
              ) : (
                <p className="f12-legend f12-legend-hint">
                  Select an intervention to compare it with the total.
                </p>
              )}
            </div>
            <ToneAreaChart
              data={chartData}
              seriesLabel="Recovered revenue"
              labelColumnHeader="Date"
              compareLabel={focusedRow?.name}
              formatValue={fmtMoney}
              formatShort={fmtMoneyShort}
              motion={motion}
              height={310}
            />
          </Panel>

          <PanelPair
            id="panel-pair-kpis"
            top={{
              label: 'Incremental profit',
              children: (
                <Metric
                  label="Incremental profit"
                  value={summary.profit}
                  format={fmtMoney}
                  delta={summary.profitDelta}
                  deltaKind="pct"
                  range={range}
                  note="Margin on recovered orders, after offer costs"
                  motion={motion}
                  spark={
                    <ToneSpark
                      values={profitValues}
                      label="Daily profit"
                      rangeKey={range}
                      motion={motion}
                    />
                  }
                />
              ),
            }}
            bottom={{
              label: 'Conversion lift',
              children: (
                <Metric
                  label="Conversion lift"
                  value={summary.lift}
                  format={fmtPP}
                  delta={summary.liftDelta}
                  deltaKind="pp"
                  range={range}
                  note="Checkout conversion vs. holdout group"
                  motion={motion}
                  spark={
                    <ToneSpark
                      values={liftValues}
                      label="Daily lift"
                      rangeKey={range}
                      motion={motion}
                    />
                  }
                />
              ),
            }}
          />
        </Scene>

        <Scene gutter="change" layout="equal" id="scene-secondary">
          <Panel label="Revenue by intervention">
            <ToneBarList
              title="Revenue by intervention"
              subtitle={`Last ${range} days · share of recovered revenue`}
              items={barItems}
              selectedId={focusId}
              onSelect={setFocusId}
              motion={motion}
              changed={changed}
              idPrefix="gal"
            />
          </Panel>

          <Panel label="Controls and annotations">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h2 className="f12-m-label">Controls &amp; Annotations</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
                <Button
                  id="btn-primary"
                  variant="primary"
                  onClick={() => setLastAction('Primary clicked')}
                >
                  Primary action
                </Button>
                <Button
                  id="btn-secondary"
                  variant="secondary"
                  onClick={() => setLastAction('Secondary clicked')}
                >
                  Secondary
                </Button>
                <Button
                  id="btn-marker"
                  variant="marker"
                  onClick={() => setLastAction('Marker clicked')}
                >
                  Flag review
                </Button>
                <Button id="btn-disabled" variant="secondary" disabled>
                  Locked
                </Button>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '12px',
                }}
              >
                <Input
                  id="input-store"
                  label="Store label"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  hint="Appears in the sheet eyebrow"
                />
                <Input
                  id="input-threshold"
                  label="Alert threshold (%)"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  error={
                    Number(threshold) < 10 ? 'Threshold must be at least 10%' : undefined
                  }
                  hint="Minimum lift before flagging"
                />
              </div>

              <Tabs idPrefix="gal-tabs" defaultValue="policy" density="compact">
                <TabsList ariaLabel="Dispatch policy and notes">
                  <TabsTrigger value="policy">Policy</TabsTrigger>
                  <TabsTrigger value="notes">Notes</TabsTrigger>
                </TabsList>
                <TabsContent value="policy">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <RadioGroup
                      id="gal-radiogroup"
                      name="galCadence"
                      density="compact"
                      orientation="horizontal"
                      label="Digest cadence"
                      defaultValue="daily"
                      options={[
                        { value: 'realtime', label: 'Real-time' },
                        { value: 'daily', label: 'Daily cut' },
                        { value: 'weekly', label: 'Weekly' },
                      ]}
                    />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                      <Switch
                        id="gal-switch"
                        density="compact"
                        label="Auto-replay failed deliveries"
                        defaultChecked
                      />
                      <Checkbox
                        id="gal-checkbox"
                        density="compact"
                        label="Dual-key signoff"
                        defaultChecked
                      />
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="notes">
                  <Field
                    id="gal-notes"
                    density="compact"
                    label="Incident runbook notes"
                    hint="Attached to pager webhooks"
                  >
                    <Textarea defaultValue="Escalate if 5xx exceeds 1.5% across 3 cuts." />
                  </Field>
                </TabsContent>
              </Tabs>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                <Balloon tailOffset={-12}>Peak Oct 24 · $6,410</Balloon>
                <Badge pop={changed} burst>
                  On twos · 12fps
                </Badge>
                <Tag>Marker accent</Tag>
                <Tag status="info">Info</Tag>
                <Tag status="success">Verified</Tag>
                <Tag status="warning">Standby</Tag>
                <Tag status="danger">Halted</Tag>
              </div>

              <Panel
                variant="quiet"
                id="gallery-quiet-panel"
                label="Exposure-sheet operational ledger"
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <Breadcrumb
                    density="compact"
                    items={[
                      { label: 'Atelier', href: '#atelier' },
                      { label: 'Dispatches', href: '#dispatches' },
                      { label: 'Queue Ledger' },
                    ]}
                  />
                  <Metric
                    variant="quiet"
                    headingLevel="h3"
                    label="Dispatch queue depth"
                    value={14}
                    format={(v) => `${v} jobs`}
                    delta={-0.05}
                    deltaKind="pct"
                    comparisonLabel="vs 1h avg"
                  />
                  <Notice status="info" density="compact" title="Ledger synced">
                    All 14 dispatches verified on twos.
                  </Notice>
                  <Pagination
                    density="compact"
                    defaultPage={1}
                    totalPages={4}
                    showSummary
                    totalItems={14}
                    pageSize={4}
                  />
                </div>
              </Panel>
            </div>
          </Panel>
        </Scene>

        <Scene gutter="pair" layout="equal" id="scene-adapters">
          <AdapterScenePanels
            range={range}
            channel={channel}
            setChannel={setChannel}
            setLastAction={setLastAction}
            summary={summary}
          />
        </Scene>
      </Sheet>

      <Sheet autoCut pegs motion={motion} theme={theme} id="gallery-f12-03-sheet">
        <Scene
          id="gallery-areas-scene"
          gutter="scene"
          areas={[
            'hero hero hero hero hero hero hero hero sideTop sideTop sideTop sideTop',
            'hero hero hero hero hero hero hero hero sideBot sideBot sideBot sideBot',
          ]}
        >
          <Panel
            id="gallery-area-hero"
            area="hero"
            label="Co-change GhostWire and evidence receipts"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <GhostWire
                id="gallery-ghost-wire"
                from="src/checkout/webhook.ts"
                to="db/schema.sql"
                label="src/checkout/webhook.ts usually changes with db/schema.sql, which was not changed"
                strength={range === 7 ? 0.85 : range === 30 ? 0.55 : 0.25}
                motion={motion}
              />
              <GhostWire
                id="gallery-ghost-wire-low"
                from="registry/ui/tag.tsx"
                to="registry/styles/frame12.css"
                strength={0.2}
                orientation="horizontal"
                motion={motion}
              />
              <GhostWire
                id="gallery-ghost-wire-vertical"
                from="scripts/check-frame12.mjs"
                to="skills/frame12/SKILL.md"
                label="scripts/check-frame12.mjs co-changes with skills/frame12/SKILL.md"
                strength={0.9}
                orientation="vertical"
                motion={motion}
              />
              <ReceiptList id="gallery-receipt-list" ariaLabel="Verification receipts">
                <Receipt
                  id="gallery-receipt-commit"
                  kind="commit"
                  value="ab107e29f4c18820"
                  href="https://github.com/lbrodie11/frame12/commit/ab107e2"
                  title="feat: add page primitives"
                  date="2026-11-08"
                  origin="human"
                />
                <Receipt
                  id="gallery-receipt-file"
                  kind="file"
                  value="registry/ui/ghost-wire.tsx"
                  origin="agent"
                />
                <Receipt
                  id="gallery-receipt-long-file"
                  kind="file"
                  value={
                    'packages/ledger/src/reconciliation/adapters/production/' +
                    'a'.repeat(150) +
                    '.ts'
                  }
                  origin="bot"
                />
                <Receipt
                  id="gallery-receipt-link"
                  kind="link"
                  value="Audit Report R-412"
                  href="https://github.com/lbrodie11/frame12/actions"
                  origin="bot"
                />
                <Receipt
                  id="gallery-receipt-unsafe"
                  kind="link"
                  value="Blocked Unsafe Script"
                  href="javascript:alert(1)"
                  title="Plain text fallback"
                />
              </ReceiptList>
            </div>
          </Panel>
          <Panel id="gallery-area-side-top" area="sideTop" label="Ink stamps showcase">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
              <Tag id="gallery-stamp-removed" variant="stamp">
                removed
              </Tag>
              <Tag id="gallery-stamp-bot" variant="stamp" status="info">
                bot
              </Tag>
              <Tag id="gallery-stamp-danger" variant="stamp" status="danger">
                rejected
              </Tag>
              <Stamp id="gallery-stamp-verified" status="success">
                verified
              </Stamp>
            </div>
          </Panel>
          <SceneArea id="gallery-scene-area-wrap" area="sideBot">
            <Panel id="gallery-area-side-bot" label="Named-area companion panel">
              <p style={{ margin: 0 }}>
                Tall hero panel spans two rows beside two stacked panels at &gt;= 860px and
                collapses to single-column DOM order below 860px.
              </p>
            </Panel>
          </SceneArea>
        </Scene>
      </Sheet>
    </main>
  );
}

/**
 * A SegmentedControl whose value is restored right after mount, the way a saved theme, filter or
 * tab is applied after hydration. Counts `transitionrun` events on its indicator so tests can
 * assert that the restore snaps into place while a real click still animates.
 */
function RestoredSegmentedFixture() {
  const [value, setValue] = React.useState<'a' | 'b' | 'c'>('a');
  const [transitionRuns, setTransitionRuns] = React.useState(0);
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  React.useLayoutEffect(() => {
    const el = wrapRef.current;
    const onRun = (e: TransitionEvent) => {
      if ((e.target as HTMLElement).classList.contains('f12-rng-ind')) {
        setTransitionRuns((n) => n + 1);
      }
    };
    el?.addEventListener('transitionrun', onRun);
    setValue('c');
    return () => el?.removeEventListener('transitionrun', onRun);
  }, []);
  return (
    <div id="fixture-restored-seg" ref={wrapRef} data-transition-runs={transitionRuns}>
      <SegmentedControl
        idPrefix="fixture-restored-seg"
        ariaLabel="Restored value"
        options={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
          { value: 'c', label: 'C' },
        ]}
        value={value}
        onChange={setValue}
      />
    </div>
  );
}

function UnitTestFixtures() {
  const [dlgOpen, setDlgOpen] = React.useState(false);
  const [rejectTrigger, setRejectTrigger] = React.useState(false);
  const [condOpen, setCondOpen] = React.useState(false);
  const [closeCount, setCloseCount] = React.useState(0);
  const [vetoCount, setVetoCount] = React.useState(0);
  const [underOpen, setUnderOpen] = React.useState(false);
  const [topOpen, setTopOpen] = React.useState(false);
  const [tipClicks, setTipClicks] = React.useState(0);
  const [tipFocused, setTipFocused] = React.useState(0);
  const [tipRefSet, setTipRefSet] = React.useState(false);
  const [tweenKey, setTweenKey] = React.useState(1);
  const [tweenDuration, setTweenDuration] = React.useState(600);
  const [tweenMotion, setTweenMotion] = React.useState<MotionMode>('stepped');
  const [countTarget, setCountTarget] = React.useState(100);

  const progress = useOnTwos(tweenKey, tweenDuration, tweenMotion);
  const counted = useCountUp(countTarget, 'stepped', 500);

  const handleDlgOpenChange = React.useCallback(
    (next: boolean) => {
      if (next && rejectTrigger) return;
      setDlgOpen(next);
      if (!next) {
        setCloseCount((c) => c + 1);
      }
    },
    [rejectTrigger],
  );

  const tipBtnRef = React.useCallback((node: HTMLButtonElement | null) => {
    if (node) setTipRefSet(true);
  }, []);

  return (
    <div id="unit-test-fixtures">
      {/* External elements outside .f12-frame for CSS isolation verification */}
      <div id="external-host-zone">
        <button id="test-ext-btn" type="button">
          Host Button Outside Frame12
        </button>
        <a id="test-ext-link" href="#ext">
          Host Link Outside Frame12
        </a>
      </div>

      <Sheet motion="stepped" theme="light" id="fixture-sheet">
        <RestoredSegmentedFixture />
        {/* Controlled Dialog for single onOpenChange(false) & asChild trigger */}
        <Dialog open={dlgOpen} onOpenChange={handleDlgOpenChange}>
          <DialogTrigger asChild>
            <button id="test-dlg-aschild-btn" type="button" className="custom-trigger">
              Open Controlled Dialog
            </button>
          </DialogTrigger>
          <DialogContent id="test-controlled-dlg">
            <DialogHeader>
              <DialogTitle>Controlled Dialog</DialogTitle>
              <DialogDescription>Tests single close callback</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose id="test-controlled-dlg-close">Close</DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <output id="test-dlg-close-count">{closeCount}</output>
        <button
          id="test-dlg-reject-toggle"
          type="button"
          onClick={() => setRejectTrigger((r) => !r)}
        >
          Toggle Reject Trigger ({rejectTrigger ? 'on' : 'off'})
        </button>
        <button id="test-dlg-prog-open" type="button" onClick={() => setDlgOpen(true)}>
          Programmatic Open Controlled Dialog
        </button>

        {/* Controlled Dialog that conditionally mounts DialogContent only while open */}
        <Dialog open={condOpen} onOpenChange={setCondOpen}>
          <DialogTrigger id="test-dlg-cond-open">Open Conditional DialogContent</DialogTrigger>
          {condOpen && (
            <DialogContent id="test-cond-dlg">
              <DialogHeader>
                <DialogTitle>Conditionally Mounted Dialog</DialogTitle>
              </DialogHeader>
              <DialogFooter>
                <DialogClose id="test-dlg-cond-close">Close Conditional</DialogClose>
              </DialogFooter>
            </DialogContent>
          )}
        </Dialog>

        {/* Dialog without DialogDescription */}
        <Dialog>
          <DialogTrigger id="test-dlg-nodesc-open">Open No-Desc Dialog</DialogTrigger>
          <DialogContent id="test-nodesc-dlg">
            <DialogHeader>
              <DialogTitle>Dialog Without Description</DialogTitle>
            </DialogHeader>
            <DialogFooter>
              <DialogClose id="test-dlg-nodesc-close">Close</DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog with onCancel preventDefault veto */}
        <Dialog>
          <DialogTrigger id="test-dlg-veto-open">Open Veto Dialog</DialogTrigger>
          <DialogContent
            id="test-veto-dlg"
            onCancel={(e) => {
              e.preventDefault();
              setVetoCount((c) => c + 1);
            }}
          >
            <DialogHeader>
              <DialogTitle>Unsaved Form Dialog</DialogTitle>
            </DialogHeader>
            <DialogFooter>
              <DialogClose id="test-dlg-veto-close">Force Close</DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <output id="test-dlg-veto-count">{vetoCount}</output>

        {/* Two sibling stacked Dialogs for topmost Escape dismissal */}
        <Dialog open={underOpen} onOpenChange={(next) => setUnderOpen(next)}>
          <DialogTrigger id="test-dlg-under-open">Open Under Dialog</DialogTrigger>
          <DialogContent id="test-dlg-under">
            <DialogHeader>
              <DialogTitle>Underlying Dialog</DialogTitle>
            </DialogHeader>
            <button id="test-dlg-top-open" type="button" onClick={() => setTopOpen(true)}>
              Open Top Dialog
            </button>
            <button
              id="test-dlg-under-rerender"
              type="button"
              onClick={() => setTweenDuration((d) => (d === 600 ? 601 : 600))}
            >
              Rerender Parent
            </button>
            <DialogFooter>
              <DialogClose id="test-dlg-under-close">Close Under</DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={topOpen} onOpenChange={(next) => setTopOpen(next)}>
          <DialogTrigger id="test-dlg-top-trigger">Open Top Trigger</DialogTrigger>
          <DialogContent id="test-dlg-top">
            <DialogHeader>
              <DialogTitle>Topmost Dialog</DialogTitle>
            </DialogHeader>
            <button id="test-dlg-under-from-top" type="button" onClick={() => setUnderOpen(true)}>
              Open Under From Top
            </button>
            <DialogFooter>
              <DialogClose id="test-dlg-top-close">Close Top</DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* DropdownMenuTrigger asChild forwarding className */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild className="trigger-forwarded-class">
            <button id="test-menu-aschild-btn" type="button" className="child-own-class">
              Custom Menu Trigger
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Action</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* TooltipTrigger asChild preserving both trigger and child props */}
        <span id="ext-desc">External description</span>
        <span id="trigger-desc">Trigger-level description</span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild aria-describedby="trigger-desc">
              <button
                id="test-tip-aschild-btn"
                type="button"
                aria-describedby="ext-desc"
                ref={tipBtnRef}
                onClick={() => setTipClicks((c) => c + 1)}
                onFocus={() => setTipFocused((f) => f + 1)}
              >
                Child Trigger
              </button>
            </TooltipTrigger>
            <TooltipContent id="test-tip-content">Tooltip body</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <output
          id="test-tip-state"
          data-clicks={tipClicks}
          data-focused={tipFocused}
          data-ref={tipRefSet}
        />

        {/* Input merging caller aria-describedby */}
        <span id="caller-input-desc">Caller input note</span>
        <Input
          id="test-input-merged"
          label="Merged input"
          aria-describedby="caller-input-desc"
          hint="Built-in hint"
          error="Built-in error"
        />

        {/* Motion hooks test harness */}
        <div
          id="test-hooks-box"
          data-progress={progress.toFixed(4)}
          data-counted={Math.round(counted)}
        >
          <button id="test-tween-key" type="button" onClick={() => setTweenKey((k) => k + 1)}>
            Step Key
          </button>
          <button id="test-tween-dur" type="button" onClick={() => setTweenDuration((d) => d + 100)}>
            Change Duration Only
          </button>
          <button
            id="test-tween-motion"
            type="button"
            onClick={() => setTweenMotion((m) => (m === 'stepped' ? 'smooth' : 'stepped'))}
          >
            Change Motion Only
          </button>
          <button id="test-count-1000" type="button" onClick={() => setCountTarget(1000)}>
            Count to 1000
          </button>
          <button id="test-count-500" type="button" onClick={() => setCountTarget(500)}>
            Count to 500
          </button>
        </div>

        {/* ToneAreaChart edge cases */}
        <div id="chart-empty">
          <ToneAreaChart data={[]} />
        </div>
        <div id="chart-single">
          <ToneAreaChart data={[{ label: 'Only', value: 42 }]} />
        </div>
        <div id="chart-zeros">
          <ToneAreaChart
            data={[
              { label: 'D1', value: 0 },
              { label: 'D2', value: 0 },
            ]}
          />
        </div>
        <div id="chart-negative">
          <ToneAreaChart
            data={[
              { label: 'D1', value: -50 },
              { label: 'D2', value: 25 },
              { label: 'D3', value: 100 },
            ]}
          />
        </div>
        <div id="chart-compare-higher">
          <ToneAreaChart
            data={[
              { label: 'D1', value: 100, compareValue: 250 },
              { label: 'D2', value: 120, compareValue: 300 },
            ]}
            compareLabel="Higher Benchmark"
          />
        </div>
        <div id="chart-nan">
          <ToneAreaChart
            data={[
              { label: 'D1', value: Number.NaN },
              { label: 'D2', value: Number.POSITIVE_INFINITY },
              { label: 'D3', value: 80 },
            ]}
          />
        </div>

        {/* Zero-width hidden Panel for SSR fallback polygon test */}
        <div id="test-panel-ssr" style={{ display: 'none' }}>
          <Panel label="SSR fallback panel">
            SSR Content
          </Panel>
        </div>

        {/* Balloon long unbroken string wrapping */}
        <div id="test-balloon-wrap" style={{ width: '220px' }}>
          <Balloon id="test-balloon-long">
            whsec_99887766554433221100aabbccddeeff99887766554433221100aabbccddeeff
          </Balloon>
        </div>
      </Sheet>

      {/* Automatic cut numbering (<Sheet autoCut>) fixture matrix */}
      <div id="fixture-autocut-matrix">
        {/* 1. Composition: nested wrappers, PanelPair (slant-top), .map(), hidden panel, cut={false} */}
        <Sheet autoCut pegs={false} id="fixture-autocut-composition">
          <Scene gutter="pair" layout="stack">
            <NestedAutoPanelWrapper />
            <PanelPair
              id="fixture-autocut-pair"
              top={{ label: 'Auto Pair Top', children: 'Top body' }}
              bottom={{ label: 'Auto Pair Bottom (slant-top)', children: 'Bottom body' }}
            />
            {['Mapped First', 'Mapped Second'].map((item) => (
              <Panel key={item} label={item}>
                {item}
              </Panel>
            ))}
            <Panel style={{ display: 'none' }} label="Hidden via display none">
              Skipped by CSS counter
            </Panel>
            {false && <Panel label="Conditionally unrendered">Skipped</Panel>}
            <Panel id="fixture-autocut-false" cut={false} label="Unnumbered panel">
              Explicit cut false
            </Panel>
            <Panel
              id="fixture-autocut-quiet"
              variant="quiet"
              label="Quiet panel inside autoCut Sheet"
            >
              Subordinate exposure-sheet panel skipped by autoCut
            </Panel>
            <Panel id="fixture-autocut-final" label="Final panel after skips">
              Continues numbering at C-07
            </Panel>
          </Scene>
        </Sheet>

        {/* 4. WP3 Expressive/Quiet, Semantic Status, Pattern & Density Fixtures */}
        <Sheet autoCut pegs={false} id="fixture-wp3-grammar">
          <Scene gutter="pair" layout="equal">
            <Panel id="fixture-wp3-expressive" label="Expressive storyboard cut">
              Expressive C-01
            </Panel>
            <PanelPair
              id="fixture-wp3-quiet-pair"
              variant="quiet"
              top={{
                label: 'Quiet Pair Top',
                children: (
                  <Metric
                    variant="quiet"
                    headingLevel="h3"
                    label="Quiet Metric"
                    value={420}
                    format={(v) => `${v} req/s`}
                  />
                ),
              }}
              bottom={{
                label: 'Quiet Pair Bottom',
                children: (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                    <Tag id="fixture-tag-neutral" status="neutral">
                      ORD-01
                    </Tag>
                    <Tag id="fixture-tag-info" status="info">
                      ORD-02
                    </Tag>
                    <Tag id="fixture-tag-success" status="success">
                      ORD-03
                    </Tag>
                    <Tag id="fixture-tag-warning" status="warning">
                      ORD-04
                    </Tag>
                    <Tag id="fixture-tag-danger" status="danger">
                      ORD-05
                    </Tag>
                    <Tag id="fixture-tag-no-glyph" status="info" glyph={false}>
                      No Glyph
                    </Tag>
                    <Tag id="fixture-tag-custom-sr" status="warning" srLabel="警告">
                      ディスク 91%
                    </Tag>
                    <Tag id="fixture-tag-no-sr" status="warning" srLabel={false}>
                      No SR
                    </Tag>
                    <Tag id="fixture-tag-successor" status="success">
                      Successor key rotated
                    </Tag>
                    <Tag id="fixture-tag-errored" status="danger">
                      Errored
                    </Tag>
                    <Tag id="fixture-tag-hidden-prefix" status="danger">
                      <span aria-hidden="true">Error</span> Offline
                    </Tag>
                    <Tag id="fixture-tag-dom-hidden-prefix" status="danger">
                      <span hidden>Error</span> Offline
                    </Tag>
                    <style>{`svg { display: block; }`}</style>
                    <Tag id="fixture-tag-icon">
                      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                        <rect width="10" height="10" />
                      </svg>
                      LIVE
                    </Tag>
                    <Badge id="fixture-badge-icon" burst={false}>
                      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                        <rect width="10" height="10" />
                      </svg>
                      LIVE
                    </Badge>
                    <Badge id="fixture-badge-neutral" status="neutral">
                      ORD-01
                    </Badge>
                    <Badge id="fixture-badge-info" status="info">
                      ORD-02
                    </Badge>
                    <Badge id="fixture-badge-status" status="success">
                      ORD-03
                    </Badge>
                    <Badge id="fixture-badge-burst" status="warning" burst>
                      ORD-04
                    </Badge>
                    <Badge id="fixture-badge-danger" status="danger">
                      ORD-05
                    </Badge>
                  </div>
                ),
              }}
            />
          </Scene>
          <Scene gutter="pair" layout="equal">
            <Panel variant="quiet" id="fixture-wp3-compact-controls" label="Compact controls">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <Input
                  id="fixture-input-compact"
                  density="compact"
                  label="Compact input"
                  defaultValue="f12_live_key"
                />
                <Select id="fixture-select-compact" density="compact" label="Compact select" defaultValue="prod">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prod">Production</SelectItem>
                  </SelectContent>
                </Select>
                <Table id="fixture-table-compact" density="compact">
                  <TableCaption>Compact ledger table</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Key</TableHead>
                      <TableHead>State</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>k1</TableCell>
                      <TableCell>
                        <Tag id="fixture-table-tag" status="success">
                          Recovered
                        </Tag>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
                <div style={{ width: '90px' }}>
                  <Tag id="fixture-narrow-tag" status="warning">
                    OVERFLOW_TOKEN_ALPHA_BETA_GAMMA_9921
                  </Tag>
                  <Badge id="fixture-narrow-badge" status="danger">
                    PROCESSOR UNREACHABLE
                  </Badge>
                </div>
                <Panel
                  variant="expressive"
                  cut={false}
                  id="fixture-nested-expressive-in-quiet"
                  label="Nested expressive panel inside quiet panel"
                >
                  Nested expressive frame keeps 2.5px stroke
                </Panel>
                <Panel
                  variant="quiet"
                  shape="slant-top"
                  id="fixture-quiet-slant-top"
                  label="Quiet slanted top panel"
                >
                  Quiet slant-top retains 32px clearance
                </Panel>
              </div>
            </Panel>
            <Panel variant="quiet" id="fixture-wp3-patterns" label="Pattern bar list">
              <ToneBarList
                idPrefix="wp3-pat"
                density="compact"
                title="Pattern differentiation"
                items={[
                  { id: 'dots', name: 'Halftone dots', value: 100, pattern: 'dots' },
                  { id: 'hatch', name: 'Diagonal hatch', value: 80, pattern: 'hatch' },
                  { id: 'dense', name: 'Dense halftone', value: 60, pattern: 'dense' },
                ]}
              />
            </Panel>
          </Scene>
        </Sheet>

        {/* 2. Nested non-auto Sheet inside auto Sheet */}
        <Sheet autoCut pegs={false} id="fixture-nested-outer-auto">
          <Scene gutter="pair" layout="stack">
            <Panel label="Outer auto before">Outer 1</Panel>
            <Sheet pegs={false} id="fixture-nested-inner-nonauto">
              <Scene gutter="pair" layout="stack">
                <Panel label="Inner non-auto default panel">Unnumbered inside non-auto Sheet</Panel>
                <Panel
                  {...({ ['c' + 'ut']: 'C-01' } as { cut?: string })}
                  label="Inner non-auto explicit panel"
                >
                  Explicit C-01 inside non-auto Sheet
                </Panel>
              </Scene>
            </Sheet>
            <Panel label="Outer auto after">Outer 2 continues at C-02</Panel>
          </Scene>
        </Sheet>

        {/* 3. Nested auto Sheet inside non-auto Sheet */}
        <Sheet pegs={false} id="fixture-nested-outer-nonauto">
          <Scene gutter="pair" layout="stack">
            <Panel label="Outer non-auto before">Unnumbered outer 1</Panel>
            <Sheet autoCut pegs={false} id="fixture-nested-inner-auto">
              <Scene gutter="pair" layout="stack">
                <Panel label="Inner auto 1">Inner C-01</Panel>
                <Panel label="Inner auto 2">Inner C-02</Panel>
              </Scene>
            </Sheet>
            <Panel label="Outer non-auto after">Unnumbered outer 2</Panel>
          </Scene>
        </Sheet>

        {/* 5. WP4 Essential Form Kit & Tabs Fixtures */}
        <Wp4UnitFixtures />

        {/* 6. WP5 Feedback, Loading & Navigation Fixtures */}
        <Wp5UnitFixtures />
      </div>
    </div>
  );
}

function WrappedTabTrigger({
  value,
  count,
  disabled,
}: {
  value: string;
  count: number;
  disabled?: boolean;
}) {
  return (
    <TabsTrigger value={value} disabled={disabled}>
      {value} ({count})
    </TabsTrigger>
  );
}

function Wp4UnitFixtures() {
  const [formResult, setFormResult] = React.useState<string>('');
  const [rhfState, setRhfState] = React.useState<{
    check: boolean;
    sw: boolean;
    notes: string;
    plan: string;
    checkTag: string;
    swTag: string;
    notesTag: string;
  }>({
    check: false,
    sw: false,
    notes: '',
    plan: 'pro',
    checkTag: '',
    swTag: '',
    notesTag: '',
  });
  const [indeterminateState, setIndeterminateState] = React.useState(true);

  const checkRef = React.useCallback((el: HTMLInputElement | null) => {
    if (el) {
      setRhfState((s) => (s.checkTag === el.tagName ? s : { ...s, checkTag: el.tagName }));
    }
  }, []);
  const swRef = React.useCallback((el: HTMLInputElement | null) => {
    if (el) {
      setRhfState((s) => (s.swTag === el.tagName ? s : { ...s, swTag: el.tagName }));
    }
  }, []);
  const notesRef = React.useCallback((el: HTMLTextAreaElement | null) => {
    if (el) {
      setRhfState((s) => (s.notesTag === el.tagName ? s : { ...s, notesTag: el.tagName }));
    }
  }, []);

  return (
    <Sheet autoCut pegs={false} id="fixture-wp4-sheet" motion="stepped">
      <Scene gutter="pair" layout="equal">
        <Panel id="fixture-wp4-before-tabs" label="Panel before tabs">
          Expressive panel before tabs (C-01)
        </Panel>
        <Panel variant="quiet" id="fixture-wp4-tabs-host" label="Tabs host panel">
          <Tabs idPrefix="wp4-tabs" defaultValue="one">
            <TabsList ariaLabel="WP4 test tabs">
              <TabsTrigger value="one">Tab One</TabsTrigger>
              <TabsTrigger value="disabled" disabled>
                Disabled
              </TabsTrigger>
              <TabsTrigger value="two">Tab Two</TabsTrigger>
              <TabsTrigger value="three">Tab Three</TabsTrigger>
            </TabsList>
            <TabsContent value="one" forceMount>
              <Panel id="wp4-tab-one-panel" label="Tab one default quiet panel">
                Tab one body
              </Panel>
            </TabsContent>
            <TabsContent value="disabled">
              <Panel id="wp4-tab-disabled-panel" label="Disabled tab panel">
                Disabled body
              </Panel>
            </TabsContent>
            <TabsContent value="two">
              <Panel id="wp4-tab-two-panel" label="Tab two default quiet panel">
                Tab two body
              </Panel>
            </TabsContent>
            <TabsContent value="three">
              <Panel
                id="wp4-tab-three-expressive"
                variant="expressive"
                label="Tab three explicit expressive panel"
              >
                Tab three body
              </Panel>
            </TabsContent>
          </Tabs>

          <Tabs idPrefix="wp4-tabs-manual" defaultValue="m1" activationMode="manual" density="compact">
            <TabsList ariaLabel="Manual activation tabs">
              <TabsTrigger value="m1">Manual 1</TabsTrigger>
              <TabsTrigger value="m2">Manual 2</TabsTrigger>
            </TabsList>
            <TabsContent value="m1">Manual panel 1</TabsContent>
            <TabsContent value="m2">Manual panel 2</TabsContent>
          </Tabs>

          <Tabs idPrefix="wp4-tabs-vert" defaultValue="v1" orientation="vertical">
            <TabsList ariaLabel="Vertical tabs">
              <TabsTrigger value="v1">Vert 1</TabsTrigger>
              <TabsTrigger value="v2">Vert 2</TabsTrigger>
            </TabsList>
            <TabsContent value="v1">Vert panel 1</TabsContent>
            <TabsContent value="v2">Vert panel 2</TabsContent>
          </Tabs>

          {/* Wrapped triggers without defaultValue, wrapped trigger + direct trigger with defaultValue, value encoding ("a b" vs "a-b"), and custom trigger/panel IDs */}
          <Tabs idPrefix="wp4-tabs-wrapped-nodefault">
            <TabsList ariaLabel="Wrapped triggers no default">
              <WrappedTabTrigger value="w1" count={3} />
              <WrappedTabTrigger value="w2" count={7} />
            </TabsList>
            <TabsContent value="w1">Wrapped panel 1</TabsContent>
            <TabsContent value="w2">Wrapped panel 2</TabsContent>
          </Tabs>

          <Tabs idPrefix="wp4-tabs-wrapped-default" defaultValue="wsel">
            <TabsList ariaLabel="Wrapped trigger with defaultValue">
              <WrappedTabTrigger value="wsel" count={5} />
              <TabsTrigger value="wother">Direct Other</TabsTrigger>
            </TabsList>
            <TabsContent value="wsel">Selected wrapped panel</TabsContent>
            <TabsContent value="wother">Other panel</TabsContent>
          </Tabs>

          <Tabs idPrefix="wp4-tabs-collision" defaultValue="a b">
            <TabsList ariaLabel="Collision test tabs">
              <TabsTrigger value="a b">Space A B</TabsTrigger>
              <TabsTrigger value="a-b">Hyphen A-B</TabsTrigger>
            </TabsList>
            <TabsContent value="a b">Space panel</TabsContent>
            <TabsContent value="a-b">Hyphen panel</TabsContent>
          </Tabs>

          <Tabs idPrefix="wp4-tabs-custom-ids" defaultValue="cid">
            <TabsList ariaLabel="Custom ID tabs">
              <TabsTrigger value="cid" id="wp4-custom-tab-id">
                Custom ID Tab
              </TabsTrigger>
              <TabsTrigger value="cid2" id="wp4-custom-tab-id-2">
                Custom ID Tab 2
              </TabsTrigger>
            </TabsList>
            <TabsContent value="cid" id="wp4-custom-panel-id">
              Custom ID panel 1
            </TabsContent>
            <TabsContent value="cid2">Custom ID panel 2</TabsContent>
          </Tabs>
        </Panel>
      </Scene>

      <Scene gutter="pair" layout="equal">
        <Panel id="fixture-wp4-after-tabs" label="Panel after tabs">
          Expressive panel after tabs (must stay C-02 across tab switches)
        </Panel>

        <Panel variant="quiet" id="fixture-wp4-forms" label="Form kit fixtures">
          {/* 1. Real <form>: FormData, reset, required, form= */}
          <form
            id="wp4-real-form"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const obj: Record<string, string> = {};
              fd.forEach((val, key) => {
                obj[key] = String(val);
              });
              setFormResult(JSON.stringify(obj));
            }}
          >
            <Field label="Service handle" hint="Lowercase slug" required>
              <Input id="wp4-form-input" name="handle" defaultValue="atelier-prod" />
            </Field>
            <Textarea
              id="wp4-form-textarea"
              name="notes"
              label="Runbook notes"
              defaultValue="Initial note"
              required
            />
            <Checkbox
              id="wp4-form-checkbox"
              name="audit"
              value="enabled"
              label="Enable audit log"
              defaultChecked
              required
            />
            <RadioGroup
              id="wp4-form-radiogroup"
              name="cadence"
              label="Cadence"
              defaultValue="daily"
              required
            >
              <RadioGroupItem id="wp4-form-radio-rt" value="realtime" label="Real-time" />
              <RadioGroupItem id="wp4-form-radio-daily" value="daily" label="Daily" />
              <RadioGroupItem id="wp4-form-radio-wk" value="weekly" label="Weekly" />
            </RadioGroup>
            <Switch
              id="wp4-form-switch"
              name="replay"
              value="on"
              label="Auto-replay"
              defaultChecked
              required
            />
            <button id="wp4-form-submit" type="submit">
              Submit Form
            </button>
            <button id="wp4-form-reset" type="reset">
              Reset Form
            </button>
          </form>
          {/* External control associated via form="wp4-real-form" */}
          <Switch
            id="wp4-form-external-switch"
            form="wp4-real-form"
            name="externalFlag"
            value="ext-yes"
            label="External form switch"
            defaultChecked
          />
          <output id="wp4-form-output">{formResult}</output>

          {/* 2. react-hook-form register() simulation */}
          <div id="wp4-rhf-zone">
            <Checkbox
              id="wp4-rhf-checkbox"
              label="RHF Checkbox"
              name="rhfCheck"
              ref={checkRef}
              onChange={(e) => setRhfState((s) => ({ ...s, check: e.target.checked }))}
            />
            <Switch
              id="wp4-rhf-switch"
              label="RHF Switch"
              name="rhfSwitch"
              ref={swRef}
              onChange={(e) => setRhfState((s) => ({ ...s, sw: e.target.checked }))}
            />
            <Textarea
              id="wp4-rhf-textarea"
              label="RHF Textarea"
              name="rhfNotes"
              ref={notesRef}
              onChange={(e) => setRhfState((s) => ({ ...s, notes: e.target.value }))}
            />
            <RadioGroup label="RHF Plan" defaultValue="pro">
              <RadioGroupItem
                id="wp4-rhf-radio-free"
                value="free"
                label="Free"
                name="rhfPlan"
                onChange={(e) => {
                  if (e.target.checked) setRhfState((s) => ({ ...s, plan: e.target.value }));
                }}
              />
              <RadioGroupItem
                id="wp4-rhf-radio-pro"
                value="pro"
                label="Pro"
                name="rhfPlan"
                onChange={(e) => {
                  if (e.target.checked) setRhfState((s) => ({ ...s, plan: e.target.value }));
                }}
              />
            </RadioGroup>
            <output
              id="wp4-rhf-output"
              data-check={String(rhfState.check)}
              data-sw={String(rhfState.sw)}
              data-notes={rhfState.notes}
              data-plan={rhfState.plan}
              data-check-tag={rhfState.checkTag}
              data-sw-tag={rhfState.swTag}
              data-notes-tag={rhfState.notesTag}
            />
          </div>

          {/* 3. Field + Control no-duplicate-label & error announcement matrix */}
          <div id="wp4-field-dedup-zone">
            <Field label="Field Input Label" hint="Field input hint" error="Field input error">
              <Input
                id="wp4-dedup-input"
                label="Duplicate Input Label"
                hint="Duplicate hint"
                error="Duplicate error"
              />
            </Field>
            <Field
              label="Field Textarea Label"
              hint="Field textarea hint"
              error="Field textarea error"
            >
              <Textarea
                id="wp4-dedup-textarea"
                label="Duplicate Textarea Label"
                hint="Duplicate hint"
                error="Duplicate error"
              />
            </Field>
            <Field
              label="Field Checkbox Label"
              hint="Field checkbox hint"
              error="Field checkbox error"
            >
              <Checkbox
                id="wp4-dedup-checkbox"
                hint="Duplicate hint"
                error="Duplicate error"
              />
            </Field>
            <Field label="Field Switch Label" hint="Field switch hint" error="Field switch error">
              <Switch
                id="wp4-dedup-switch"
                hint="Duplicate hint"
                error="Duplicate error"
              />
            </Field>
            <Field label="Field Radio Label" hint="Field radio hint" error="Field radio error">
              <RadioGroup
                id="wp4-dedup-radiogroup"
                name="dedupRadio"
                label="Duplicate Radio Label"
                hint="Duplicate hint"
                error="Duplicate error"
                options={[
                  { value: 'a', label: 'Option A' },
                  { value: 'b', label: 'Option B' },
                ]}
              />
            </Field>
          </div>

          {/* 3b. Field composition: labeled Checkbox/Switch inside Field, multi-control Field, Field id vs child id, native <input>, and render-prop / wrapped RadioGroup */}
          <div id="wp4-field-composition-zone">
            <Field id="wp4-notif-field" label="Notifications">
              <Checkbox id="wp4-notif-checkbox" label="Email me weekly" />
            </Field>
            <Field id="wp4-legal-consent-field" label="Legal" required>
              <Checkbox id="wp4-legal-consent-checkbox" label="I accept the terms" />
            </Field>
            <Field id="wp4-channels-field" label="Channels" required>
              <Checkbox label="Email channel" />
              <Checkbox label="SMS channel" />
            </Field>
            <Field id="wp4-rp-channels-field" label="Render-prop channels" required>
              {(ctx) => (
                <div>
                  <Checkbox id="wp4-rp-ch-1" label="Webhook" required={ctx.required} />
                  <Checkbox id="wp4-rp-ch-2" label="Email" required={ctx.required} />
                </div>
              )}
            </Field>
            <Sheet id="wp4-nested-cut-sheet" motion="cut" pegs={false}>
              <Switch id="wp4-nested-cut-switch" label="Nested cut switch" />
            </Sheet>
            <Field id="wp4-wrapper-id-field" label="Explicit child ID">
              <Input id="wp4-child-explicit-id" defaultValue="linked" />
            </Field>
            <Field id="wp4-native-field" label="Native input in Field">
              <input id="wp4-native-input" defaultValue="localhost" />
            </Field>
            <Field label="Render-prop cadence">
              {() => (
                <RadioGroup
                  id="wp4-rp-radiogroup"
                  options={[
                    { value: 'd', label: 'Daily' },
                    { value: 'w', label: 'Weekly' },
                  ]}
                />
              )}
            </Field>
            <Field label="Wrapped theme">
              <div>
                <RadioGroup
                  id="wp4-wrapped-radiogroup"
                  options={[
                    { value: 'l', label: 'Light' },
                    { value: 'k', label: 'Dark' },
                  ]}
                />
              </div>
            </Field>
          </div>

          {/* 4. Standalone errors on each control */}
          <div id="wp4-standalone-errors">
            <Textarea
              id="wp4-err-textarea"
              label="Error textarea"
              hint="Textarea hint"
              error="Textarea is invalid"
            />
            <Checkbox
              id="wp4-err-checkbox"
              label="Error checkbox"
              hint="Checkbox hint"
              error="Checkbox must be checked"
            />
            <RadioGroup
              id="wp4-err-radiogroup"
              name="errRadio"
              label="Error radio group"
              hint="Radio hint"
              error="Select a radio option"
              options={[{ value: 'x', label: 'Choice X' }]}
            />
            <Switch
              id="wp4-err-switch"
              label="Error switch"
              hint="Switch hint"
              error="Switch must be enabled"
            />
          </div>

          {/* 5. Indeterminate Checkbox, localized Switch labels, RTL Switch & Tabs, and Compact targets */}
          <div id="wp4-special-cases">
            <Checkbox
              id="wp4-indeterminate-checkbox"
              label="Mixed state checkbox"
              indeterminate={indeterminateState}
              onCheckedChange={() => setIndeterminateState(false)}
            />
            <form id="wp4-uncontrolled-mixed-form">
              <Checkbox
                id="wp4-uncontrolled-mixed"
                label="Uncontrolled mixed checkbox"
                indeterminate
              />
              <button id="wp4-uncontrolled-mixed-reset" type="reset">
                Reset mixed
              </button>
            </form>
            <Checkbox
              id="wp4-readonly-checkbox"
              label="Read-only checkbox"
              defaultChecked
              readOnly
            />
            <Switch
              id="wp4-readonly-switch"
              label="Read-only switch"
              defaultChecked
              readOnly
            />
            <Switch
              id="wp4-custom-label-switch"
              label="Localized switch"
              onLabel="入"
              offLabel="切"
              defaultChecked
            />
            <Switch
              id="wp4-german-switch"
              label="German switch"
              onLabel="AKTIVIERT"
              offLabel="DEAKTIVIERT"
            />
            <div id="wp4-ltr-zone" dir="ltr">
              <Switch id="wp4-ltr-switch" label="LTR switch" />
            </div>
            <div id="wp4-rtl-zone" dir="rtl">
              <Switch id="wp4-rtl-switch" label="RTL switch" />
              <Tabs idPrefix="wp4-rtl-tabs" defaultValue="r1">
                <TabsList ariaLabel="RTL tabs">
                  <TabsTrigger value="r1">RTL 1</TabsTrigger>
                  <TabsTrigger value="r2">RTL 2</TabsTrigger>
                </TabsList>
                <TabsContent value="r1">RTL body 1</TabsContent>
                <TabsContent value="r2">RTL body 2</TabsContent>
              </Tabs>
            </div>
            <div id="wp4-compact-targets">
              <Checkbox id="wp4-compact-checkbox" density="compact" label="Compact checkbox" />
              <RadioGroup
                id="wp4-compact-radiogroup"
                name="compactRadio"
                density="compact"
                label="Compact radio"
                defaultValue="c1"
                options={[
                  { value: 'c1', label: 'Compact 1' },
                  { value: 'c2', label: 'Compact 2' },
                ]}
              />
              <Switch id="wp4-compact-switch" density="compact" label="Compact switch" />
            </div>
          </div>
        </Panel>
      </Scene>
    </Sheet>
  );
}

function WrappedViewportShell({ id }: { id: string }) {
  return (
    <div className="wrapped-viewport-shell">
      <ToastViewport id={id} label="Wrapped notifications" />
    </div>
  );
}

function Wp5ToastControls({
  onDismissTrack,
  onActionTrack,
  onSyncBump,
}: {
  onDismissTrack: (id: string) => void;
  onActionTrack: (id: string) => void;
  onSyncBump: () => void;
}) {
  const { toast, dismiss, dismissAll } = useToast();
  return (
    <div id="wp5-toast-triggers" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
      <Button
        id="wp5-toast-push-four"
        size="sm"
        onClick={() => {
          toast({
            id: 't-1',
            status: 'info',
            title: 'Cut 01 queued',
            description: 'First toast in bounded stack.',
            duration: 60000,
            onDismiss: onDismissTrack,
            action: {
              label: 'Inspect',
              altText: 'Inspect Cut 01',
              onClick: () => onActionTrack('t-1'),
            },
          });
          toast({
            id: 't-2',
            status: 'warning',
            title: 'Warning: Cut 02 drift',
            description: 'Second toast with deduplicated prefix.',
            duration: 60000,
            onDismiss: onDismissTrack,
          });
          toast({
            id: 't-3',
            status: 'danger',
            title: 'Processor halted',
            description: 'Third toast queued behind maxVisible=2.',
            duration: 60000,
            onDismiss: onDismissTrack,
          });
          toast({
            id: 't-4',
            status: 'success',
            title: 'Recovered',
            description: 'Fourth toast queued behind maxVisible=2.',
            duration: 60000,
            onDismiss: onDismissTrack,
          });
        }}
      >
        Push 4 Toasts
      </Button>
      <Button
        id="wp5-toast-push-timed"
        size="sm"
        onClick={() => {
          toast({
            id: 't-timed',
            status: 'info',
            title: 'Timed toast',
            description: 'Auto-dismisses after 220ms unless paused.',
            duration: 220,
            onDismiss: onDismissTrack,
          });
        }}
      >
        Push Timed Toast
      </Button>
      <Button
        id="wp5-toast-push-repeated"
        size="sm"
        onClick={() => {
          toast({
            status: 'success',
            title: 'Saved',
            duration: 60000,
          });
        }}
      >
        Push Saved Toast
      </Button>
      <Button
        id="wp5-toast-push-focus-pair"
        size="sm"
        onClick={() => {
          toast({
            id: 't-focus-1',
            status: 'info',
            title: 'Focus target toast',
            description: 'Dismiss this via keyboard or click.',
            duration: 60000,
            onDismiss: onDismissTrack,
          });
          toast({
            id: 't-focus-2',
            status: 'success',
            title: 'Remaining timed toast',
            description: 'Must auto-dismiss after t-focus-1 is closed.',
            duration: 260,
            onDismiss: onDismissTrack,
          });
        }}
      >
        Push Focus Pair
      </Button>
      <Button
        id="wp5-toast-push-transition"
        size="sm"
        onClick={() => {
          const RD = (
            window as unknown as {
              ReactDOM?: { flushSync?: (fn: () => void) => void };
            }
          ).ReactDOM;
          React.startTransition(() => {
            toast({
              id: 't-transition',
              status: 'info',
              title: 'Transition toast',
              duration: 60000,
              onDismiss: onDismissTrack,
            });
          });
          if (RD?.flushSync) {
            RD.flushSync(() => {
              onSyncBump();
            });
          } else {
            onSyncBump();
          }
          toast({
            id: 't-urgent',
            status: 'danger',
            title: 'Urgent toast',
            duration: 60000,
            onDismiss: onDismissTrack,
          });
        }}
      >
        Push Transition + Urgent
      </Button>
      <Button id="wp5-toast-dismiss-first" size="sm" onClick={() => dismiss()}>
        Dismiss Newest
      </Button>
      <Button
        id="wp5-toast-push-custom-action"
        size="sm"
        onClick={() => {
          toast({
            id: 't-custom-btn',
            status: 'info',
            title: 'Custom button toast',
            dismissible: false,
            duration: 60000,
            action: (
              <Button id="t-custom-btn-action" size="sm">
                Custom Act
              </Button>
            ),
          });
        }}
      >
        Push Custom Action
      </Button>
      <Button id="wp5-toast-dismiss-all" size="sm" onClick={() => dismissAll()}>
        Dismiss All
      </Button>
      <input
        id="wp5-search-input"
        type="search"
        aria-label="Search notifications"
        defaultValue="filter"
      />
      <Dialog>
        <DialogTrigger id="wp5-dialog-toast-trigger" size="sm">
          Open Toast Dialog
        </DialogTrigger>
        <DialogContent id="wp5-toast-dialog">
          <DialogHeader>
            <DialogTitle>Modal Toast Verification</DialogTitle>
            <DialogDescription>
              Toasts triggered while a modal dialog is open must render in the top layer.
            </DialogDescription>
          </DialogHeader>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button
              id="wp5-dialog-fire-toast"
              size="sm"
              variant="primary"
              onClick={() => {
                toast({
                  id: 't-in-dialog',
                  status: 'success',
                  title: 'Saved inside dialog',
                  description: 'Portaled into open modal dialog.',
                  duration: 60000,
                  onDismiss: onDismissTrack,
                });
              }}
            >
              Fire Dialog Toast
            </Button>
            <Button
              id="wp5-dialog-fire-nondismissible"
              size="sm"
              onClick={() => {
                toast({
                  id: 't-in-dialog-nondismissible',
                  status: 'info',
                  title: 'Locked inside dialog',
                  dismissible: false,
                  duration: 60000,
                  action: {
                    label: 'Acknowledge',
                    onClick: () => {},
                  },
                });
              }}
            >
              Fire Locked Toast
            </Button>
          </div>
          <DialogFooter>
            <DialogClose id="wp5-dialog-toast-close" size="sm">
              Close Dialog
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Wp5NestedToastProbe() {
  const outer = useToast();
  return (
    <div id="wp5-nested-toast-zone" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      <Button
        id="wp5-push-outer-toast"
        size="sm"
        onClick={() =>
          outer.toast({
            id: 't-outer-provider',
            status: 'info',
            title: 'Outer provider notification',
            duration: 60000,
          })
        }
      >
        Push Outer
      </Button>
      <Button
        id="wp5-clear-outer-toast"
        size="sm"
        onClick={() => outer.dismissAll()}
      >
        Clear Outer
      </Button>
      <ToastProvider maxVisible={2} defaultDuration={60000}>
        <Wp5InnerToastTrigger />
        <WrappedViewportShell id="wp5-inner-toast-viewport" label="Inner notifications" />
      </ToastProvider>
    </div>
  );
}

function Wp5InnerToastTrigger() {
  const inner = useToast();
  return (
    <>
      <Button
        id="wp5-push-inner-toast"
        size="sm"
        onClick={() =>
          inner.toast({
            id: 't-inner-provider',
            status: 'warning',
            title: 'Inner provider notification',
            duration: 60000,
          })
        }
      >
        Push Inner
      </Button>
      <Button
        id="wp5-clear-inner-toast"
        size="sm"
        onClick={() => inner.dismissAll()}
      >
        Clear Inner
      </Button>
    </>
  );
}

function Wp5UnitFixtures() {
  const [alertDismissed, setAlertDismissed] = React.useState(false);
  const [dismissedToastIds, setDismissedToastIds] = React.useState<string[]>([]);
  const [actionToastIds, setActionToastIds] = React.useState<string[]>([]);
  const [, setSyncCounter] = React.useState(0);
  const [customCloseOpen, setCustomCloseOpen] = React.useState(true);
  const [customCloseTracks, setCustomCloseTracks] = React.useState(0);
  const [customCloseDismisses, setCustomCloseDismisses] = React.useState(0);
  const [preventedCloseOpen, setPreventedCloseOpen] = React.useState(true);
  const [preventedCloseTracks, setPreventedCloseTracks] = React.useState(0);
  const [crumbClicks, setCrumbClicks] = React.useState<string[]>([]);
  const [crumbActions, setCrumbActions] = React.useState<string[]>([]);
  const [crumbRefTag, setCrumbRefTag] = React.useState<string>('');
  const [showCleanupCrumb, setShowCleanupCrumb] = React.useState(true);
  const [crumbRefCleaned, setCrumbRefCleaned] = React.useState(false);
  const [page, setPage] = React.useState<number>(2);
  const [linkPage, setLinkPage] = React.useState<number>(1);
  const [linkPageCalls, setLinkPageCalls] = React.useState<number>(0);

  const crumbAsChildRef = React.useCallback((el: HTMLAnchorElement | null) => {
    if (el) {
      setCrumbRefTag((prev) => (prev === el.tagName ? prev : el.tagName));
    }
    return () => {
      setCrumbRefCleaned(true);
    };
  }, []);

  const rangeSmall = React.useMemo(() => buildPaginationRange(2, 5, 1), []);
  const rangeStart = React.useMemo(() => buildPaginationRange(2, 10, 1), []);
  const rangeMiddle = React.useMemo(() => buildPaginationRange(5, 10, 1), []);
  const rangeEnd = React.useMemo(() => buildPaginationRange(9, 10, 1), []);
  const rangeBoundary2 = React.useMemo(() => buildPaginationRange(6, 12, 1, 2), []);

  return (
    <Sheet autoCut pegs={false} id="fixture-wp5-sheet" motion="stepped">
      <Scene gutter="pair" layout="equal">
        <Panel variant="quiet" id="fixture-wp5-feedback" label="WP5 Feedback & Loading">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* 1. Alert & Notice status matrix, ARIA live roles, SR deduplication, compound children, dismiss */}
            <Notice id="wp5-notice-neutral" status="neutral" title="Neutral ledger note">
              Static observation recorded on sheet.
            </Notice>
            <Notice id="wp5-notice-danger-static" status="danger" title="Historical error cut">
              Notice defaults to role=note even for danger status.
            </Notice>
            <Alert id="wp5-alert-info" status="info" title="Info notice">
              Default info alert uses role=note.
            </Alert>
            <Alert id="wp5-alert-success" status="success" title="Successor key rotated">
              Word boundary keeps Success prefix before Successor.
            </Alert>
            <Alert id="wp5-alert-warning-dedup" status="warning" title="Warning: Quota at 92%">
              Deduplicates leading Warning prefix.
            </Alert>
            <Alert id="wp5-alert-danger" status="danger" title="Processor unreachable">
              Danger alert defaults to role=alert.
            </Alert>
            <Alert id="wp5-alert-polite" status="info" live="polite" title="Live sync">
              Polite live alert uses role=status.
            </Alert>
            <Alert id="wp5-alert-hidden-prefix" status="danger">
              <AlertTitle>
                <span aria-hidden="true">Error</span> Stream offline
              </AlertTitle>
              <AlertDescription>
                Hidden span inside title does not suppress Error SR prefix.
              </AlertDescription>
              <AlertActions>
                <Button size="sm">Retry stream</Button>
              </AlertActions>
            </Alert>
            {!alertDismissed && (
              <Alert
                id="wp5-alert-dismissible"
                status="warning"
                density="compact"
                title="Compact dismissible alert"
                onDismiss={() => setAlertDismissed(true)}
              >
                Click dismiss button to close.
              </Alert>
            )}
            <output id="wp5-alert-dismissed" data-dismissed={String(alertDismissed)} />
            <Alert
              id="wp5-alert-long-token"
              status="danger"
              title={`ERR_${'X'.repeat(110)}`}
            >
              {`https://example.com/webhooks/${'a'.repeat(110)}`}
            </Alert>

            {/* 2. ToastProvider with maxVisible=2 and wrapped ToastViewport */}
            <ToastProvider maxVisible={2} defaultDuration={60000}>
              <Wp5ToastControls
                onDismissTrack={(id) => setDismissedToastIds((prev) => [...prev, id])}
                onActionTrack={(id) => setActionToastIds((prev) => [...prev, id])}
                onSyncBump={() => setSyncCounter((c) => c + 1)}
              />
              <Toast
                id="wp5-standalone-in-provider"
                status="info"
                density="compact"
                duration={60000}
                onDismiss={() => {}}
              >
                <ToastTitle>Standalone Inside Provider</ToastTitle>
                <ToastDescription>Must pause on local hover outside ToastViewport.</ToastDescription>
              </Toast>
              <WrappedViewportShell id="wp5-toast-viewport" />
            </ToastProvider>
            <output
              id="wp5-toast-output"
              data-dismissed={dismissedToastIds.join(',')}
              data-actions={actionToastIds.join(',')}
            />

            {/* Nested ToastProvider isolation (outer default viewport + inner explicit viewport) */}
            <ToastProvider maxVisible={2} defaultDuration={60000} label="Outer notifications">
              <Wp5NestedToastProbe />
            </ToastProvider>

            {/* Standalone Toast & custom ToastClose onClick composition */}
            <Toast
              id="wp5-standalone-toast"
              status="success"
              density="compact"
              duration={0}
              onDismiss={() => {}}
            >
              <ToastTitle>Standalone Cut Saved</ToastTitle>
              <ToastDescription>Compact standalone toast fixture.</ToastDescription>
            </Toast>
            {customCloseOpen && (
              <Toast
                id="wp5-toast-custom-close"
                status="info"
                duration={0}
                dismissible={false}
                onDismiss={() => {
                  setCustomCloseDismisses((c) => c + 1);
                  setCustomCloseOpen(false);
                }}
              >
                <ToastTitle>Telemetry close toast</ToastTitle>
                <ToastClose
                  id="wp5-toast-custom-close-btn"
                  onClick={() => setCustomCloseTracks((c) => c + 1)}
                />
              </Toast>
            )}
            {preventedCloseOpen && (
              <Toast
                id="wp5-toast-prevented-close"
                status="warning"
                duration={0}
                dismissible={false}
                onDismiss={() => setPreventedCloseOpen(false)}
              >
                <ToastTitle>Prevented close toast</ToastTitle>
                <ToastClose
                  id="wp5-toast-prevented-close-btn"
                  onClick={(e) => {
                    setPreventedCloseTracks((c) => c + 1);
                    e.preventDefault();
                  }}
                />
              </Toast>
            )}
            <output
              id="wp5-toast-close-output"
              data-custom-open={String(customCloseOpen)}
              data-custom-tracks={String(customCloseTracks)}
              data-custom-dismisses={String(customCloseDismisses)}
              data-prevented-open={String(preventedCloseOpen)}
              data-prevented-tracks={String(preventedCloseTracks)}
            />

            {/* 3. Skeleton & SkeletonText */}
            <div id="wp5-skeleton-zone" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Skeleton id="wp5-skeleton-decorative" variant="block" width={180} height={24} />
              <Skeleton
                id="wp5-skeleton-labeled"
                variant="metric"
                label="Loading revenue metric"
              />
              <Skeleton id="wp5-skeleton-circle" variant="circle" density="compact" />
              <SkeletonText id="wp5-skeleton-text" lines={3} lastLineWidth="60%" />
            </div>
          </div>
        </Panel>

        <Panel variant="quiet" id="fixture-wp5-navigation" label="WP5 EmptyState & Navigation">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* 4. EmptyState */}
            <EmptyState
              id="wp5-empty-default"
              code="EMPTY · 0 ROWS"
              title="No matching interventions"
              description="Clear the active filter or widen the date window."
              action={<Button size="sm" variant="primary">Reset filters</Button>}
              secondaryAction={<Button size="sm" variant="secondary">Export log</Button>}
            />
            <EmptyState id="wp5-empty-compound" variant="quiet" density="compact">
              <EmptyStateIcon>[ 0 ]</EmptyStateIcon>
              <EmptyStateTitle>Compound Empty State</EmptyStateTitle>
              <EmptyStateDescription>Uses explicit EmptyStateIcon without duplicate.</EmptyStateDescription>
              <EmptyStateActions>
                <Button size="sm">Create cut</Button>
              </EmptyStateActions>
            </EmptyState>

            {/* 5. Breadcrumb */}
            <Breadcrumb
              id="wp5-breadcrumb-items"
              items={[
                { label: 'Atelier', href: '#atelier' },
                { label: 'Production', href: '#prod' },
                { label: 'Cut C-04' },
              ]}
            />
            <Breadcrumb
              id="wp5-breadcrumb-noncurrent"
              items={[
                { label: 'Home', href: '#home' },
                { label: 'Settings', current: false },
                { label: 'Profile', current: true },
              ]}
            />
            <Breadcrumb
              id="wp5-breadcrumb-last-noncurrent"
              items={[
                { label: 'Root', href: '#root' },
                { label: 'Preview', current: false },
              ]}
            />
            <Breadcrumb
              id="wp5-breadcrumb-mid-current"
              items={[
                { label: 'Workspace', href: '#ws' },
                { label: 'Cut 04', href: '#c04', current: true },
                { label: 'Next Cut', href: '#c05' },
              ]}
            />
            <Breadcrumb
              id="wp5-breadcrumb-actions"
              items={[
                {
                  label: 'Atelier',
                  href: '#atelier-route',
                  onClick: (e) => {
                    e.preventDefault();
                    setCrumbActions((prev) => [...prev, 'link']);
                  },
                },
                { label: 'Storyboards', onSelect: () => setCrumbActions((prev) => [...prev, 'select']) },
                {
                  label: 'Cut C-04',
                  current: true,
                  onSelect: () => setCrumbActions((prev) => [...prev, 'current-select']),
                },
              ]}
            />
            <output id="wp5-breadcrumb-actions-output" data-actions={crumbActions.join(',')} />
            <Breadcrumb id="wp5-breadcrumb-compound" separator="▸" density="compact">
              <BreadcrumbList>
                {showCleanupCrumb && (
                  <BreadcrumbItem>
                    <BreadcrumbLink
                      asChild
                      ref={crumbAsChildRef}
                      onFocus={() => setCrumbClicks((prev) => [...prev, 'focus-outer'])}
                      onClick={(e) => {
                        e.preventDefault();
                        setCrumbClicks((prev) => [...prev, 'outer']);
                      }}
                    >
                      <a
                        id="wp5-breadcrumb-aschild"
                        href="#root"
                        className="custom-crumb-link"
                        onFocus={() => setCrumbClicks((prev) => [...prev, 'focus-inner'])}
                        onClick={(e) => {
                          e.preventDefault();
                          setCrumbClicks((prev) => [...prev, 'inner']);
                        }}
                      >
                        Root
                      </a>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                )}
                <BreadcrumbSeparator id="wp5-breadcrumb-sep-li" />
                <BreadcrumbItem>
                  <BreadcrumbEllipsis id="wp5-breadcrumb-ellipsis" />
                  <BreadcrumbSeparator id="wp5-breadcrumb-sep-span" />
                </BreadcrumbItem>
                <BreadcrumbItem>
                  <BreadcrumbPage id="wp5-breadcrumb-current">Active Sheet</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <Button
              id="wp5-breadcrumb-unmount-btn"
              size="sm"
              onClick={() => setShowCleanupCrumb(false)}
            >
              Unmount Crumb Link
            </Button>
            <output
              id="wp5-breadcrumb-output"
              data-clicks={crumbClicks.join(',')}
              data-ref-tag={crumbRefTag}
              data-ref-cleaned={String(crumbRefCleaned)}
            />

            {/* 6. Pagination */}
            <Pagination
              id="wp5-pagination-controlled"
              page={page}
              totalPages={10}
              onPageChange={setPage}
              showSummary
              totalItems={194}
              pageSize={20}
            />
            <Pagination
              id="wp5-pagination-compact"
              density="compact"
              defaultPage={1}
              totalPages={3}
              getItemHref={(p) => `#p-${p}`}
            />
            <Pagination
              id="wp5-pagination-links"
              page={linkPage}
              totalPages={5}
              onPageChange={(p) => {
                setLinkPage(p);
                setLinkPageCalls((c) => c + 1);
              }}
              getItemHref={(p) => `#link-page-${p}`}
            />
            <Pagination
              id="wp5-pagination-nan"
              defaultPage={Number.NaN}
              totalPages={20}
              siblingCount={Number.NaN}
              boundaryCount={2}
              showSummary
            />
            <Pagination id="wp5-pagination-anchor-attrs" ariaLabel="Anchor pagination">
              <PaginationContent>
                <PaginationItem>
                  <PaginationLink
                    id="wp5-pagination-anchor-link"
                    href="#dl-1"
                    target="_self"
                    rel="noreferrer"
                    download="sheet-1.json"
                    isActive
                  >
                    1
                  </PaginationLink>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
            <output
              id="wp5-pagination-ranges"
              data-small={JSON.stringify(rangeSmall)}
              data-start={JSON.stringify(rangeStart)}
              data-middle={JSON.stringify(rangeMiddle)}
              data-end={JSON.stringify(rangeEnd)}
              data-boundary2={JSON.stringify(rangeBoundary2)}
              data-page={String(page)}
              data-link-page={String(linkPage)}
              data-link-calls={String(linkPageCalls)}
            />
          </div>
        </Panel>
      </Scene>
    </Sheet>
  );
}

function NestedAutoPanelWrapper() {
  return (
    <div className="nested-wrapper-outer">
      <div className="nested-wrapper-inner">
        <Panel label="Nested wrapper panel A">Nested A</Panel>
        <Panel label="Nested wrapper panel B">Nested B</Panel>
      </div>
    </div>
  );
}

const rootEl = typeof document !== 'undefined' ? document.getElementById('root') : null;
if (rootEl) {
  const RD = (window as unknown as {
    ReactDOM: {
      createRoot: (el: HTMLElement) => {
        render: (node: React.ReactNode) => void;
        unmount?: () => void;
      };
    };
  }).ReactDOM;
  RD.createRoot(rootEl).render(<GalleryApp />);
  (window as unknown as { __mountUnitFixtures?: () => void }).__mountUnitFixtures = () => {
    let host = document.getElementById('unit-fixtures-root');
    if (!host) {
      host = document.createElement('div');
      host.id = 'unit-fixtures-root';
      document.body.appendChild(host);
    }
    RD.createRoot(host).render(<UnitTestFixtures />);
  };
  (
    window as unknown as {
      __testAutoCutWarning?: (envMode: 'development' | 'production') => Promise<string[]>;
    }
  ).__testAutoCutWarning = async (envMode: 'development' | 'production') => {
    const win = window as unknown as { __F12_NODE_ENV__?: string };
    const prevEnv = win.__F12_NODE_ENV__;
    win.__F12_NODE_ENV__ = envMode;
    const warnings: string[] = [];
    const origWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      warnings.push(args.map(String).join(' '));
    };
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = RD.createRoot(host);
    try {
      const explicitProp = { ['c' + 'ut']: 'C-09' } as { cut?: string };
      function WarnFixture({ tick }: { tick: number }) {
        return (
          <Sheet autoCut pegs={false}>
            <Panel {...explicitProp} label={`Warn panel ${tick}`}>
              Mixed cut {tick}
            </Panel>
          </Sheet>
        );
      }
      root.render(<WarnFixture tick={1} />);
      await new Promise((r) => setTimeout(r, 40));
      root.render(<WarnFixture tick={2} />);
      await new Promise((r) => setTimeout(r, 40));
      return warnings;
    } finally {
      root.unmount?.();
      host.remove();
      console.warn = origWarn;
      win.__F12_NODE_ENV__ = prevEnv;
    }
  };
}
