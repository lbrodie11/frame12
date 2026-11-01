import * as React from 'react';
import { SUMMARIES, STORE, END_LABEL, fmtMoney, fmtMoneyShort, fmtPP } from '../../lab/src/data.js';
import {
  type MotionMode,
  useChanged,
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
} from '../index';

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
      <Sheet motion={motion} theme={theme} id="gallery-sheet">
        <header className="hd">
          <div className="hd-text">
            <p className="eyebrow">
              {storeName}
              <Tag>Example data</Tag>
              <Badge burst={false}>FRAME/12 Registry</Badge>
            </p>
            <h1 className="title" style={{ margin: '10px 0 0' }}>
              Component Gallery
            </h1>
            <p className="sub">Through {END_LABEL} · Status: {lastAction}</p>
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
          <Panel cut="C-01" className="c01" label="Recovered revenue over time">
            <div className="c01-hd">
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
                <ul className="legend" aria-label="Chart legend">
                  <li>
                    <i className="sw sw-total" aria-hidden="true" />
                    All interventions
                  </li>
                  <li>
                    <i className="sw sw-focus" aria-hidden="true" />
                    {focusedRow.name}
                  </li>
                </ul>
              ) : (
                <p className="legend legend-hint">
                  Select an intervention to compare it with the total.
                </p>
              )}
            </div>
            <ToneAreaChart
              data={chartData}
              seriesLabel="Recovered revenue"
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
              cut: 'C-02',
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
              cut: 'C-03',
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
          <Panel cut="C-04" label="Revenue by intervention">
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

          <Panel cut="C-05" label="Controls and annotations">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 className="m-label">Controls &amp; Annotations</h3>
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

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
                <Balloon tailOffset={-12}>Peak Oct 24 · $6,410</Balloon>
                <Badge pop={changed} burst>
                  On twos · 12fps
                </Badge>
                <Tag>Marker accent</Tag>
              </div>
            </div>
          </Panel>
        </Scene>

        <Scene gutter="pair" layout="equal" id="scene-adapters">
          <Panel cut="C-06" label="Interactive primitive adapters">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 className="m-label">Primitive Adapters</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
                <Select
                  id="gal-select"
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

          <Panel cut="C-07" label="Tabular ledger adapter">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h3 className="m-label">Intervention Ledger</h3>
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
        </Scene>
      </Sheet>
    </main>
  );
}

const rootEl = document.getElementById('root');
if (rootEl) {
  const RD = (window as unknown as { ReactDOM: { createRoot: (el: HTMLElement) => { render: (node: React.ReactNode) => void } } }).ReactDOM;
  RD.createRoot(rootEl).render(<GalleryApp />);
}
