'use client';

import * as React from 'react';
import { useResolvedMotion } from '@/hooks/use-tempo';
import dynamic from 'next/dynamic';

// Loaded only by the exposure-scrubber preview (its own chunk, not in every component page).
const ExposurePreview = dynamic(() => import('@/components/exposure-demos').then((m) => m.ExposurePreview));
import {
  Sheet,
  TempoProvider,
  TempoControl,
  Scene,
  Panel,
  PanelPair,
  SegmentedControl,
  Button,
  Field,
  Input,
  Textarea,
  Checkbox,
  RadioGroup,
  Switch,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Badge,
  Tag,
  Alert,
  Notice,
  Toast,
  ToastAction,
  Skeleton,
  SkeletonText,
  EmptyState,
  Breadcrumb,
  Pagination,
  Metric,
  ToneAreaChart,
  ToneBarList,
  ToneSpark,
  Balloon,
  GhostWire,
  Receipt,
  ReceiptList,
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
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from '@/components/frame12';
import {
  useOnTwos,
  useCountUp,
  useChanged,
  type MotionMode,
} from '@/hooks/use-on-twos';
import { SUMMARIES, fmtMoney, fmtMoneyShort, fmtPP, type RangeDays } from '@/lib/data';

export interface ComponentPreviewProps {
  slug: string;
  previewTheme: 'light' | 'dark';
  /** The demo's own motion. The site's tempo (and the OS) resolve it; defaults to on twos. */
  motion?: MotionMode;
}

const BREADCRUMB_DEMO_PATH = ['Workspace', 'Storyboards', 'Cut C-04 Ledger'] as const;

export function ComponentPreview({
  slug,
  previewTheme,
  motion: baseMotion = 'stepped',
}: ComponentPreviewProps) {
  const motion = useResolvedMotion(baseMotion);
  const [range, setRange] = React.useState<RangeDays>(7);
  const [selectedRow, setSelectedRow] = React.useState<string | null>('cart');
  const [channel, setChannel] = React.useState('cart');
  const [inputValue, setInputValue] = React.useState('whsec_f12_live_904a');
  const [textareaValue, setTextareaValue] = React.useState(
    'Escalate to on-call if 5xx exceeds 1.5% over 3 consecutive cuts.',
  );
  const [checkboxChecked, setCheckboxChecked] = React.useState(true);
  const [radioValue, setRadioValue] = React.useState('daily');
  const [switchChecked, setSwitchChecked] = React.useState(true);
  const [tabValue, setTabValue] = React.useState('routing');
  const [pageNum, setPageNum] = React.useState(2);
  const [crumbDepth, setCrumbDepth] = React.useState(3);
  const [actionNote, setActionNote] = React.useState('Ready');
  const changed = useChanged(range);
  const tweenProgress = useOnTwos(range, 600, motion);
  const counted = useCountUp(SUMMARIES[range].revenue, motion, 600);

  const s = SUMMARIES[range];
  const pfx = `${slug}-${previewTheme}`;

  const renderInner = () => {
    switch (slug) {
      case 'sheet':
        return (
          <Sheet pegs motion={motion} theme={previewTheme}>
            <div className="f12-row-between">
              <div className="f12-row-pair">
                <Tag>Sheet Preview</Tag>
                <span className="f12-mono-note">Registration pegs + 32px scene flow</span>
              </div>
            </div>
            <Scene gutter="scene" layout="stack">
              <Panel label={`Inside sheet panel (${previewTheme})`}>
                <p className="f12-body-copy">
                  A Sheet wraps scenes with top registration pegs and paper/flashback surfaces.
                </p>
              </Panel>
            </Scene>
          </Sheet>
        );

      case 'scene':
        return (
          <div className="f12-preview-sheet">
            <Scene gutter="scene" layout="equal">
              <Panel cut={false} label={`Left scene cell (${previewTheme})`}>
                <div className="f12-stack-pair">
                  <Tag>20px · scene</Tag>
                  <p className="f12-body-copy">Left cell in a same-scene grid.</p>
                </div>
              </Panel>
              <Panel cut={false} label={`Right scene cell (${previewTheme})`}>
                <div className="f12-stack-pair">
                  <Tag>20px · scene</Tag>
                  <p className="f12-body-copy">Right cell in a same-scene grid.</p>
                </div>
              </Panel>
            </Scene>
          </div>
        );

      case 'panel':
        return (
          <div className="f12-preview-sheet">
            <Panel cut={false} label={`Mitered SVG ink panel (${previewTheme})`}>
              <div className="f12-stack-pair">
                <div className="f12-row-pair">
                  <Tag>2.5px Ink Polygon</Tag>
                  <span className="f12-mono-note">Measured via ResizeObserver</span>
                </div>
                <Metric
                  label="Recovered revenue"
                  value={s.revenue}
                  format={fmtMoney}
                  delta={s.revenueDelta}
                  deltaKind="pct"
                  range={range}
                  motion={motion}
                />
              </div>
            </Panel>
          </div>
        );

      case 'panel-pair':
        return (
          <div className="f12-preview-sheet">
            <PanelPair
              top={{
                cut: false,
                label: `Incremental profit (${previewTheme})`,
                children: (
                  <Metric
                    label="Incremental profit"
                    value={s.profit}
                    format={fmtMoney}
                    delta={s.profitDelta}
                    deltaKind="pct"
                    range={range}
                    motion={motion}
                  />
                ),
              }}
              bottom={{
                cut: false,
                label: `Conversion lift (${previewTheme})`,
                children: (
                  <Metric
                    label="Conversion lift"
                    value={s.lift}
                    format={fmtPP}
                    delta={s.liftDelta}
                    deltaKind="pp"
                    range={range}
                    motion={motion}
                  />
                ),
              }}
            />
          </div>
        );

      case 'segmented-control':
        return (
          <div className="f12-preview-sheet">
            <div className="f12-row-between">
              <SegmentedControl
                idPrefix={`${pfx}-rng`}
                ariaLabel={`Date range (${previewTheme})`}
                options={[
                  { value: 7 as RangeDays, label: '7', unit: 'days' },
                  { value: 30 as RangeDays, label: '30', unit: 'days' },
                  { value: 90 as RangeDays, label: '90', unit: 'days' },
                ]}
                value={range}
                onChange={setRange}
              />
              <span className="f12-mono-note">Selected: {range} days</span>
            </div>
          </div>
        );

      case 'button':
        return (
          <div className="f12-preview-sheet">
            <div className="f12-row-pair">
              <Button
                id={`${pfx}-btn-primary`}
                variant="primary"
                onClick={() => setActionNote('Primary clicked')}
              >
                Primary Ink
              </Button>
              <Button
                id={`${pfx}-btn-marker`}
                variant="marker"
                onClick={() => setActionNote('Marker clicked')}
              >
                Marker Action
              </Button>
              <Button
                id={`${pfx}-btn-secondary`}
                variant="secondary"
                onClick={() => setActionNote('Secondary clicked')}
              >
                Secondary Paper
              </Button>
              <Button id={`${pfx}-btn-disabled`} variant="secondary" disabled>
                Disabled
              </Button>
            </div>
            <p className="f12-mono-note">Status: {actionNote}</p>
          </div>
        );

      case 'input':
        return (
          <div className="f12-preview-sheet">
            <Input
              id={`${pfx}-input`}
              label="Webhook signing secret"
              hint="Prefix whsec_ required for production endpoints"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              error={
                !inputValue.startsWith('whsec_')
                  ? 'Secret must begin with whsec_'
                  : undefined
              }
            />
          </div>
        );

      case 'field':
        return (
          <div className="f12-preview-sheet">
            <Field
              id={`${pfx}-field-input`}
              label="Webhook endpoint URL"
              hint="Must accept TLS 1.3 POST requests"
              required
            >
              <Input defaultValue="https://api.acme.dev/webhooks/f12" />
            </Field>
          </div>
        );

      case 'textarea':
        return (
          <div className="f12-preview-sheet">
            <Textarea
              id={`${pfx}-textarea`}
              label="Incident runbook notes"
              hint="Included in webhook alert payloads"
              value={textareaValue}
              onChange={(e) => setTextareaValue(e.target.value)}
            />
          </div>
        );

      case 'checkbox':
        return (
          <div className="f12-preview-sheet">
            <div className="f12-stack-pair">
              <Checkbox
                id={`${pfx}-checkbox`}
                label="Require dual-key signoff on production cuts"
                hint="Enforced for all expressive storyboard sheets"
                checked={checkboxChecked}
                onCheckedChange={setCheckboxChecked}
              />
              <Checkbox
                id={`${pfx}-checkbox-mixed`}
                label="Partial cohort selection (mixed state)"
                indeterminate
                readOnly
              />
            </div>
          </div>
        );

      case 'radio-group':
        return (
          <div className="f12-preview-sheet">
            <RadioGroup
              id={`${pfx}-radiogroup`}
              name={`${pfx}-cadence`}
              label="Digest cadence"
              value={radioValue}
              onValueChange={setRadioValue}
              options={[
                { value: 'realtime', label: 'Real-time', hint: 'Immediate webhook dispatch' },
                { value: 'daily', label: 'Daily cut', hint: '09:00 UTC exposure sheet summary' },
                { value: 'weekly', label: 'Weekly rollup', hint: 'Monday 09:00 UTC digest' },
              ]}
            />
          </div>
        );

      case 'switch':
        return (
          <div className="f12-preview-sheet">
            <Switch
              id={`${pfx}-switch`}
              label="Auto-replay failed webhook deliveries"
              hint="Retries up to 3 times with exponential backoff"
              checked={switchChecked}
              onCheckedChange={setSwitchChecked}
            />
          </div>
        );

      case 'tabs':
        return (
          <div className="f12-preview-sheet">
            <Tabs idPrefix={`${pfx}-tabs`} value={tabValue} onValueChange={setTabValue}>
              <TabsList ariaLabel={`Pipeline configuration (${previewTheme})`}>
                <TabsTrigger value="routing">Routing</TabsTrigger>
                <TabsTrigger value="retries">Retries</TabsTrigger>
                <TabsTrigger value="audit">Audit Log</TabsTrigger>
              </TabsList>
              <TabsContent value="routing">
                <Panel label={`Routing configuration (${previewTheme})`}>
                  <p className="f12-body-copy">
                    Primary ingress: https://api.acme.dev/webhooks/f12 (TLS 1.3 enforced).
                  </p>
                </Panel>
              </TabsContent>
              <TabsContent value="retries">
                <Panel label={`Retry policy (${previewTheme})`}>
                  <p className="f12-body-copy">
                    Exponential backoff across 5 attempts before dead-letter queue isolation.
                  </p>
                </Panel>
              </TabsContent>
              <TabsContent value="audit">
                <Panel label={`Audit retention (${previewTheme})`}>
                  <p className="f12-body-copy">
                    Immutable 90-day ledger stored in us-east-1 with dual-key rotation.
                  </p>
                </Panel>
              </TabsContent>
            </Tabs>
          </div>
        );

      case 'badge':
        return (
          <div className="f12-preview-sheet">
            <div className="f12-row-between">
              <div className="f12-row-pair">
                <Badge pop={changed} burst key={`${range}-${previewTheme}`}>
                  Top performer
                </Badge>
                <Badge pop={false} burst={false}>
                  Static badge
                </Badge>
              </div>
              <Button
                id={`${pfx}-replay-burst`}
                variant="secondary"
                size="sm"
                onClick={() => setRange((r) => (r === 7 ? 30 : r === 30 ? 90 : 7))}
              >
                Replay 2-frame burst
              </Button>
            </div>
          </div>
        );

      case 'tag':
        return (
          <div className="f12-preview-sheet">
            <div className="f12-row-pair">
              <Tag>Example data</Tag>
              <Tag>Production · US-East</Tag>
              <Tag variant="stamp">removed</Tag>
              <Tag variant="stamp" status="info">
                bot
              </Tag>
            </div>
          </div>
        );

      case 'alert':
        return (
          <div className="f12-preview-sheet">
            <div className="f12-stack-pair">
              <Notice status="info" title={`Dual-key rotation window (${previewTheme})`}>
                Both webhook signing keys remain valid for 24 hours during cut migration.
              </Notice>
              <Alert
                status="warning"
                live="off"
                title="Elevated retry latency"
                onDismiss={() => setActionNote('Alert dismissed')}
              >
                Secondary eu-central-1 ingress is averaging 420ms across the last 3 cuts.
              </Alert>
            </div>
          </div>
        );

      case 'toast':
        return (
          <div className="f12-preview-sheet">
            <div className="f12-stack-pair">
              <Toast
                id={`${pfx}-toast`}
                status="success"
                duration={0}
                title={`Webhook replayed (${previewTheme})`}
                description="Dispatched cut C-04 to primary endpoint in 38ms."
                action={
                  <ToastAction
                    id={`${pfx}-toast-undo`}
                    onClick={() => setActionNote('Toast action clicked')}
                  >
                    Inspect
                  </ToastAction>
                }
                onDismiss={() => setActionNote('Toast dismissed')}
              />
            </div>
          </div>
        );

      case 'skeleton':
        return (
          <div className="f12-preview-sheet">
            <div className="f12-stack-pair">
              <Skeleton variant="metric" label={`Loading metric (${previewTheme})`} />
              <SkeletonText lines={3} />
            </div>
          </div>
        );

      case 'empty-state':
        return (
          <div className="f12-preview-sheet">
            <EmptyState
              code="0 MATCHING ROWS"
              title={`No matching interventions (${previewTheme})`}
              description="Clear the search filter or broaden the exposure window to inspect historical cuts."
              action={
                <Button
                  id={`${pfx}-empty-reset`}
                  variant="secondary"
                  size="sm"
                  onClick={() => setActionNote('Filters reset')}
                >
                  Reset filters
                </Button>
              }
            />
          </div>
        );

      case 'breadcrumb':
        return (
          <div className="f12-preview-sheet">
            {/* In-page levels use onSelect (a real <button>), so the demo never rewrites the docs
                page URL with a dead #hash. Real routes would pass href instead. */}
            <Breadcrumb
              ariaLabel={`Breadcrumb (${previewTheme})`}
              items={BREADCRUMB_DEMO_PATH.slice(0, crumbDepth).map((label, idx, path) =>
                idx === path.length - 1
                  ? { label, current: true }
                  : { label, onSelect: () => setCrumbDepth(idx + 1) },
              )}
            />
            <div className="f12-row-pair">
              <span className="f12-mono-note" aria-live="polite">
                {`Level ${crumbDepth} of ${BREADCRUMB_DEMO_PATH.length} · ${BREADCRUMB_DEMO_PATH[crumbDepth - 1]}`}
              </span>
              {crumbDepth < BREADCRUMB_DEMO_PATH.length ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setCrumbDepth((d) => Math.min(d + 1, BREADCRUMB_DEMO_PATH.length))}
                >
                  {`Open ${BREADCRUMB_DEMO_PATH[crumbDepth]}`}
                </Button>
              ) : null}
            </div>
          </div>
        );

      case 'pagination':
        return (
          <div className="f12-preview-sheet">
            <Pagination
              ariaLabel={`Pagination (${previewTheme})`}
              page={pageNum}
              totalPages={8}
              onPageChange={setPageNum}
              showSummary
            />
          </div>
        );

      case 'metric':
        return (
          <div className="f12-preview-sheet">
            <div className="f12-row-between">
              <Metric
                label="Recovered revenue"
                value={s.revenue}
                format={fmtMoney}
                delta={s.revenueDelta}
                deltaKind="pct"
                range={range}
                note="Margin on recovered orders"
                motion={motion}
                big
              />
              <SegmentedControl
                idPrefix={`${pfx}-metric-rng`}
                ariaLabel={`Metric range (${previewTheme})`}
                options={[
                  { value: 7 as RangeDays, label: '7', unit: 'd' },
                  { value: 30 as RangeDays, label: '30', unit: 'd' },
                  { value: 90 as RangeDays, label: '90', unit: 'd' },
                ]}
                value={range}
                onChange={setRange}
              />
            </div>
          </div>
        );

      case 'tone-area-chart':
        return (
          <div className="f12-preview-sheet">
            <ToneAreaChart
              data={s.days.map((d) => ({
                label: d.label,
                longLabel: d.long,
                value: d.total,
              }))}
              seriesLabel="Recovered revenue"
              labelColumnHeader="Date"
              formatValue={fmtMoney}
              formatShort={fmtMoneyShort}
              motion={motion}
              height={210}
              tableSummary={`Show ${previewTheme} chart data table`}
            />
          </div>
        );

      case 'tone-bar-list':
        return (
          <div className="f12-preview-sheet">
            <ToneBarList
              title="Revenue by intervention"
              subtitle={`Last ${s.range} days · click a row to invert`}
              items={s.rows.slice(0, 4).map((r, i) => ({
                id: r.id,
                name: r.name,
                value: r.value,
                formattedValue: fmtMoney(r.value),
                share: r.share,
                badge: i === 0 ? 'Top performer' : undefined,
              }))}
              selectedId={selectedRow}
              onSelect={setSelectedRow}
              motion={motion}
              changed={changed}
              idPrefix={pfx}
            />
          </div>
        );

      case 'tone-spark':
        return (
          <div className="f12-preview-sheet">
            <ToneSpark
              values={s.days.map((d) => d.profit)}
              label={`Daily profit (${range} days)`}
              rangeKey={range}
              motion={motion}
              height={48}
            />
          </div>
        );

      case 'balloon':
        return (
          <div className="f12-preview-sheet">
            <div className="f12-row-pair">
              <Balloon tailOffset={-10} showDot>
                Peak {s.peak.label} · {fmtMoney(s.peak.total)}
              </Balloon>
              <Balloon tailOffset={12} showDot={false}>
                Holdout cohort +0.51 pp
              </Balloon>
            </div>
          </div>
        );

      case 'ghost-wire':
        return (
          <div className="f12-preview-sheet">
            <div className="f12-stack-pair">
              <GhostWire
                from="src/db/queries/orders.ts"
                to="db/schema.sql"
                label="src/db/queries/orders.ts usually changes with db/schema.sql, which was not changed"
                strength={0.85}
                motion={motion}
              />
              <GhostWire
                from="registry/ui/tag.tsx"
                to="registry/styles/frame12.css"
                label="registry/ui/tag.tsx co-changes with registry/styles/frame12.css"
                strength={0.35}
                motion={motion}
              />
            </div>
          </div>
        );

      case 'receipt':
        return (
          <div className="f12-preview-sheet">
            <ReceiptList ariaLabel={`Evidence receipts (${previewTheme})`}>
              <Receipt
                kind="commit"
                value="ab107e29f4c1"
                href="https://github.com/lbrodie11/frame12/commit/ab107e2"
                title="feat: add page primitives"
                date="2026-11-08"
                origin="human"
              />
              <Receipt
                kind="file"
                value="registry/ui/ghost-wire.tsx"
                origin="agent"
              />
              <Receipt
                kind="link"
                value="CI Audit Run R-412"
                href="https://github.com/lbrodie11/frame12/actions"
                origin="bot"
              />
            </ReceiptList>
          </div>
        );

      case 'use-on-twos':
        return (
          <div className="f12-preview-sheet">
            <div className="f12-row-between">
              <div className="f12-stack-pair">
                <span className="f12-mono-note">
                  useOnTwos progress: {tweenProgress.toFixed(2)} · changed: {String(changed)}
                </span>
                <p className="ty-d">{fmtMoney(counted)}</p>
              </div>
              <Button
                id={`${pfx}-step-trigger`}
                variant="marker"
                size="sm"
                onClick={() => setRange((r) => (r === 7 ? 90 : r === 90 ? 30 : 7))}
              >
                Step value ({range}d)
              </Button>
            </div>
          </div>
        );

      case 'tempo':
      case 'tempo-control':
        // A nested, unpersisted provider: the demo never changes the site's own tempo, and the
        // site's 0 (still) or your OS reduced-motion setting still stops it.
        return (
          <div className="f12-preview-sheet">
            <TempoProvider defaultValue="auto">
              <div className="f12-stack-pair">
                <TempoControl idPrefix={`${pfx}-tempo`} legend="Demo tempo" showLegend />
                <div className="f12-row-between">
                  <Metric label="Recovered revenue" value={s.revenue} format={fmtMoney} range={range} />
                  <Button
                    id={`${pfx}-tempo-step`}
                    variant="marker"
                    size="sm"
                    onClick={() => setRange((r) => (r === 7 ? 90 : r === 90 ? 30 : 7))}
                  >
                    Change value ({range}d)
                  </Button>
                </div>
              </div>
            </TempoProvider>
          </div>
        );

      case 'exposure-scrubber':
        return (
          <div className="f12-preview-sheet">
            <ExposurePreview idPrefix={`${pfx}-xs`} />
          </div>
        );

      case 'dialog':
        return (
          <div className="f12-preview-sheet">
            <div className="f12-row-between">
              <span className="f12-body-copy">
                Native modal &lt;dialog&gt; with screentone backdrop:
              </span>
              <Dialog>
                <DialogTrigger id={`${pfx}-dlg-open`} variant="marker">
                  Open Dialog
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Rotate recovery webhook key?</DialogTitle>
                    <DialogDescription>
                      Both signing keys remain active for 24 hours so no checkout events drop.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <DialogClose id={`${pfx}-dlg-cancel`} variant="secondary">
                      Cancel
                    </DialogClose>
                    <DialogClose id={`${pfx}-dlg-confirm`} variant="primary">
                      Confirm Rotation
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        );

      case 'select':
        return (
          <div className="f12-preview-sheet">
            <Select
              id={`${pfx}-select`}
              label="Recovery channel"
              value={channel}
              onValueChange={setChannel}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose channel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cart">Abandoned-cart email</SelectItem>
                <SelectItem value="exit">Exit-intent offer</SelectItem>
                <SelectItem value="stock">Back-in-stock alert</SelectItem>
              </SelectContent>
            </Select>
          </div>
        );

      case 'tooltip':
        return (
          <div className="f12-preview-sheet">
            <TooltipProvider>
              <div className="f12-row-pair">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button id={`${pfx}-tip-btn`} variant="secondary">
                      Hover or focus for holdout spec
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>10% randomized holdout group · updated hourly</TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          </div>
        );

      case 'dropdown-menu':
        return (
          <div className="f12-preview-sheet">
            <div className="f12-row-between">
              <DropdownMenu>
                <DropdownMenuTrigger id={`${pfx}-menu-btn`} variant="secondary">
                  Intervention Actions ▼
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>Webhook Dispatch</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setActionNote('Replayed event')}>
                    Replay last webhook
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setActionNote('Exported ledger')}>
                    Export ledger CSV
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <span className="f12-mono-note">Last action: {actionNote}</span>
            </div>
          </div>
        );

      case 'table':
      default:
        return (
          <div className="f12-preview-sheet">
            <Table>
              <TableCaption>Top 3 recovery channels ({range}-day window)</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Channel</TableHead>
                  <TableHead scope="col">Status</TableHead>
                  <TableHead scope="col">Share</TableHead>
                  <TableHead scope="col">Recovered</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {s.rows.slice(0, 3).map((r, i) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.name}</TableCell>
                    <TableCell>{i === 0 ? <Tag>Leader</Tag> : 'Active'}</TableCell>
                    <TableCell>{Math.round(r.share * 100)}%</TableCell>
                    <TableCell>{fmtMoney(r.value)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        );
    }
  };

  return (
    <div className={`f12-preview-frame f12-theme-${previewTheme} f12-m-${motion}`}>
      {renderInner()}
    </div>
  );
}
