'use client';

import * as React from 'react';
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
  useOnTwos,
  useCountUp,
  useChanged,
  type MotionMode,
} from '@frame12/registry';
import { SUMMARIES, fmtMoney, fmtMoneyShort, fmtPP, type RangeDays } from '@/lib/data';

export interface ComponentPreviewProps {
  slug: string;
  previewTheme: 'light' | 'dark';
  motion: MotionMode;
}

export function ComponentPreview({ slug, previewTheme, motion }: ComponentPreviewProps) {
  const [range, setRange] = React.useState<RangeDays>(7);
  const [selectedRow, setSelectedRow] = React.useState<string | null>('cart');
  const [channel, setChannel] = React.useState('cart');
  const [inputValue, setInputValue] = React.useState('whsec_f12_live_904a');
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
              <Panel label="Inside sheet panel">
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
              <Panel label="Left scene cell">
                <div className="f12-stack-pair">
                  <Tag>20px · scene</Tag>
                  <p className="f12-body-copy">Left cell in a same-scene grid.</p>
                </div>
              </Panel>
              <Panel label="Right scene cell">
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
            <Panel label="Mitered SVG ink panel">
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
                label: 'Incremental profit',
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
                label: 'Conversion lift',
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
              <Tag>12fps · On Twos</Tag>
            </div>
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
    <div className={`f12-preview-frame theme-${previewTheme} m-${motion}`}>
      {renderInner()}
    </div>
  );
}
