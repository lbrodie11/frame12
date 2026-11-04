import * as React from 'react';
import { SUMMARIES, STORE, END_LABEL, fmtMoney, fmtMoneyShort, fmtPP } from '../../lab/src/data.js';
import { type MotionMode, useChanged, useOnTwos, useCountUp } from '@/hooks/use-on-twos';
import {
  Sheet,
  Scene,
  Panel,
  PanelPair,
  SegmentedControl,
  Button,
  Input,
  Badge,
  Tag,
  Metric,
  Balloon,
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
    </main>
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
      </div>
    </div>
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
