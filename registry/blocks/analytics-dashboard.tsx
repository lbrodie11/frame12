'use client';

import * as React from 'react';
import { useChanged, type MotionMode } from '@/hooks/use-on-twos';
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
  Badge,
  Tag,
  type TagStatus,
  Alert,
  Notice,
  ToastProvider,
  useToast,
  useOptionalToast,
  Skeleton,
  SkeletonText,
  EmptyState,
  Breadcrumb,
  Pagination,
  Metric,
  ToneAreaChart,
  ToneBarList,
  ToneSpark,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from '@/components/frame12';

// ============================================================================
// AUTHORITATIVE DETERMINISTIC FIXTURE MODEL (Fernwood Supply Co. · mulberry32(1207))
// Shared by the public homepage (`/`) and the installable Analytics Block.
// ============================================================================

function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const STORE = 'Fernwood Supply Co.';
export const END_LABEL = 'Oct 31, 2026';
export type RangeDays = 7 | 30 | 90;
export const RANGES: RangeDays[] = [7, 30, 90];
export const DEFAULT_RANGE: RangeDays = 30;

export type CheckoutSegmentId = 'returning-vip' | 'first-time-mobile' | 'high-aov-desktop';

export interface CheckoutSegmentMeta {
  id: CheckoutSegmentId;
  name: string;
  shortName: string;
  description: string;
}

export const CHECKOUT_SEGMENTS: CheckoutSegmentMeta[] = [
  {
    id: 'returning-vip',
    name: 'Returning VIP & Loyalty',
    shortName: 'Returning VIP',
    description: 'Repeat buyers with 2+ prior orders and saved payment credentials.',
  },
  {
    id: 'first-time-mobile',
    name: 'First-Time Mobile Checkout',
    shortName: 'First-Time Mobile',
    description: 'New mobile sessions re-engaged via SMS, push, or exit-intent prompts.',
  },
  {
    id: 'high-aov-desktop',
    name: 'High-AOV Desktop Carts',
    shortName: 'High-AOV Desktop',
    description: 'Desktop baskets over $150 completing checkout after restock or cart reminders.',
  },
];

export interface InterventionMeta {
  id: string;
  name: string;
  channel: string;
  triggerWindow: string;
  base: number;
  trend: number;
  margin: number;
  segmentWeights: Record<CheckoutSegmentId, number>;
}

export const INTERVENTIONS: InterventionMeta[] = [
  {
    id: 'cart',
    name: 'Abandoned-cart email',
    channel: 'Email',
    triggerWindow: '1h post-abandon',
    base: 1150,
    trend: 0.15,
    margin: 0.38,
    segmentWeights: {
      'returning-vip': 0.44,
      'first-time-mobile': 0.31,
      'high-aov-desktop': 0.25,
    },
  },
  {
    id: 'exit',
    name: 'Exit-intent offer',
    channel: 'On-site Modal',
    triggerWindow: 'Session exit',
    base: 700,
    trend: 0.25,
    margin: 0.22,
    segmentWeights: {
      'returning-vip': 0.24,
      'first-time-mobile': 0.52,
      'high-aov-desktop': 0.24,
    },
  },
  {
    id: 'stock',
    name: 'Back-in-stock alert',
    channel: 'SMS & Push',
    triggerWindow: 'Inventory restock',
    base: 520,
    trend: 0.05,
    margin: 0.41,
    segmentWeights: {
      'returning-vip': 0.48,
      'first-time-mobile': 0.28,
      'high-aov-desktop': 0.24,
    },
  },
  {
    id: 'price',
    name: 'Price-drop notice',
    channel: 'Email & SMS',
    triggerWindow: 'Catalog markdown',
    base: 430,
    trend: -0.1,
    margin: 0.18,
    segmentWeights: {
      'returning-vip': 0.34,
      'first-time-mobile': 0.42,
      'high-aov-desktop': 0.24,
    },
  },
  {
    id: 'upsell',
    name: 'Post-purchase upsell',
    channel: 'Checkout Receipt',
    triggerWindow: 'Immediate post-pay',
    base: 300,
    trend: 0.3,
    margin: 0.46,
    segmentWeights: {
      'returning-vip': 0.51,
      'first-time-mobile': 0.22,
      'high-aov-desktop': 0.27,
    },
  },
];

export interface DayDatum {
  ms: number;
  dayKey: string;
  label: string;
  long: string;
  total: number;
  byId: Record<string, number>;
  profitById: Record<string, number>;
  bySegment: Record<CheckoutSegmentId, number>;
  profitBySegment: Record<CheckoutSegmentId, number>;
  byIdAndSegment: Record<string, Record<CheckoutSegmentId, number>>;
  profitByIdAndSegment: Record<string, Record<CheckoutSegmentId, number>>;
  profit: number;
  lift: number;
  topInterventionId: string;
  topSegmentId: CheckoutSegmentId;
  evidenceNote: string;
}

export interface InterventionRow {
  id: string;
  name: string;
  channel: string;
  triggerWindow: string;
  margin: number;
  value: number;
  prevValue: number;
  deltaPct: number;
  profit: number;
  share: number;
}

export interface SegmentRow {
  id: CheckoutSegmentId;
  name: string;
  shortName: string;
  description: string;
  revenue: number;
  prevRevenue: number;
  deltaPct: number;
  profit: number;
  share: number;
}

export interface RangeSummary {
  range: RangeDays;
  days: DayDatum[];
  prevDays: DayDatum[];
  revenue: number;
  prevRevenue: number;
  revenueDelta: number;
  profit: number;
  prevProfit: number;
  profitDelta: number;
  netMarginPct: number;
  prevNetMarginPct: number;
  lift: number;
  prevLift: number;
  liftDelta: number;
  rows: InterventionRow[];
  segments: SegmentRow[];
  leader: string;
  peak: DayDatum;
  prevPeak: DayDatum;
}

const DAYS = 180;
const END = Date.UTC(2026, 9, 31);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function partitionBySegment(
  amount: number,
  weights: Record<CheckoutSegmentId, number>,
): Record<CheckoutSegmentId, number> {
  const vip = Math.round(amount * weights['returning-vip']);
  const mobile = Math.round(amount * weights['first-time-mobile']);
  const desktop = amount - vip - mobile;
  return {
    'returning-vip': vip,
    'first-time-mobile': mobile,
    'high-aov-desktop': desktop,
  };
}

function buildDays(): DayDatum[] {
  const rnd = mulberry32(1207);
  const weekly = [1.16, 0.93, 0.95, 0.97, 1.02, 1.12, 1.2]; // Sun..Sat
  const out: DayDatum[] = [];

  for (let t = 0; t < DAYS; t++) {
    const ms = END - (DAYS - 1 - t) * 864e5;
    const d = new Date(ms);
    const wk = weekly[d.getUTCDay()];
    const byId: Record<string, number> = {};
    const profitById: Record<string, number> = {};
    const bySegment: Record<CheckoutSegmentId, number> = {
      'returning-vip': 0,
      'first-time-mobile': 0,
      'high-aov-desktop': 0,
    };
    const profitBySegment: Record<CheckoutSegmentId, number> = {
      'returning-vip': 0,
      'first-time-mobile': 0,
      'high-aov-desktop': 0,
    };
    const byIdAndSegment: Record<string, Record<CheckoutSegmentId, number>> = {};
    const profitByIdAndSegment: Record<string, Record<CheckoutSegmentId, number>> = {};

    let total = 0;
    let rawProfit = 0;

    for (const it of INTERVENTIONS) {
      const trend = 1 + it.trend * (t / (DAYS - 1));
      const noise = 1 + (rnd() - 0.5) * 0.36;
      const boost = it.id === 'exit' && t >= DAYS - 9 ? 2.05 : 1;
      const v = Math.round(it.base * trend * wk * noise * boost);
      byId[it.id] = v;
      total += v;
      rawProfit += v * it.margin;
    }

    const totalProfit = Math.round(rawProfit);
    // Reconcile per-intervention integer profit so sum(profitById) === totalProfit
    let allocatedProfit = 0;
    for (let i = 0; i < INTERVENTIONS.length; i++) {
      const it = INTERVENTIONS[i];
      const p =
        i === INTERVENTIONS.length - 1
          ? totalProfit - allocatedProfit
          : Math.round(byId[it.id] * it.margin);
      profitById[it.id] = p;
      allocatedProfit += p;

      const segRev = partitionBySegment(byId[it.id], it.segmentWeights);
      const segProf = partitionBySegment(p, it.segmentWeights);
      byIdAndSegment[it.id] = segRev;
      profitByIdAndSegment[it.id] = segProf;

      bySegment['returning-vip'] += segRev['returning-vip'];
      bySegment['first-time-mobile'] += segRev['first-time-mobile'];
      bySegment['high-aov-desktop'] += segRev['high-aov-desktop'];

      profitBySegment['returning-vip'] += segProf['returning-vip'];
      profitBySegment['first-time-mobile'] += segProf['first-time-mobile'];
      profitBySegment['high-aov-desktop'] += segProf['high-aov-desktop'];
    }

    let lift = 0.48 + 0.1 * (t / (DAYS - 1)) + (rnd() - 0.5) * 0.12;
    if (t >= DAYS - 7) lift -= 0.09;

    let topInterventionId = INTERVENTIONS[0].id;
    for (const it of INTERVENTIONS) {
      if (byId[it.id] > byId[topInterventionId]) {
        topInterventionId = it.id;
      }
    }

    let topSegmentId: CheckoutSegmentId = 'returning-vip';
    for (const seg of CHECKOUT_SEGMENTS) {
      if (bySegment[seg.id] > bySegment[topSegmentId]) {
        topSegmentId = seg.id;
      }
    }

    const monthName = MONTHS[d.getUTCMonth()];
    const dayNum = d.getUTCDate();
    const yearNum = d.getUTCFullYear();
    const dayKey = `${yearNum}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    const evidenceNote =
      t >= DAYS - 9
        ? 'Exit-intent shipping-threshold prompt active (2.05x session recovery multiplier; holdout lift softened -0.09 pp in final 7d).'
        : d.getUTCDay() === 0 || d.getUTCDay() === 6
          ? 'Weekend checkout cadence peak; abandoned-cart and back-in-stock dispatches led recovery volume.'
          : 'Standard weekday dispatch cadence across 10% randomized holdout control.';

    out.push({
      ms,
      dayKey,
      label: `${monthName} ${dayNum}`,
      long: `${monthName} ${dayNum}, ${yearNum}`,
      total,
      byId,
      profitById,
      bySegment,
      profitBySegment,
      byIdAndSegment,
      profitByIdAndSegment,
      profit: totalProfit,
      lift,
      topInterventionId,
      topSegmentId,
      evidenceNote,
    });
  }
  return out;
}

export const DAYS_DATA: DayDatum[] = buildDays();

function sum<T>(a: T[], f: (x: T) => number): number {
  let s = 0;
  for (const x of a) s += f(x);
  return s;
}

export function summarize(range: RangeDays): RangeSummary {
  const cur = DAYS_DATA.slice(DAYS - range);
  const prev = DAYS_DATA.slice(DAYS - 2 * range, DAYS - range);
  const revenue = sum(cur, (d) => d.total);
  const prevRevenue = sum(prev, (d) => d.total);
  const profit = sum(cur, (d) => d.profit);
  const prevProfit = sum(prev, (d) => d.profit);
  const lift = sum(cur, (d) => d.lift) / cur.length;
  const prevLift = sum(prev, (d) => d.lift) / prev.length;

  const rows: InterventionRow[] = INTERVENTIONS.map((it) => {
    const val = sum(cur, (d) => d.byId[it.id]);
    const prevVal = sum(prev, (d) => d.byId[it.id]);
    const prof = sum(cur, (d) => d.profitById[it.id]);
    return {
      id: it.id,
      name: it.name,
      channel: it.channel,
      triggerWindow: it.triggerWindow,
      margin: it.margin,
      value: val,
      prevValue: prevVal,
      deltaPct: prevVal > 0 ? (val - prevVal) / prevVal : 0,
      profit: prof,
      share: revenue > 0 ? val / revenue : 0,
    };
  }).sort((a, b) => b.value - a.value);

  const segments: SegmentRow[] = CHECKOUT_SEGMENTS.map((seg) => {
    const rev = sum(cur, (d) => d.bySegment[seg.id]);
    const prevRev = sum(prev, (d) => d.bySegment[seg.id]);
    const prof = sum(cur, (d) => d.profitBySegment[seg.id]);
    return {
      id: seg.id,
      name: seg.name,
      shortName: seg.shortName,
      description: seg.description,
      revenue: rev,
      prevRevenue: prevRev,
      deltaPct: prevRev > 0 ? (rev - prevRev) / prevRev : 0,
      profit: prof,
      share: revenue > 0 ? rev / revenue : 0,
    };
  });

  let peak = cur[0];
  for (const d of cur) if (d.total > peak.total) peak = d;

  let prevPeak = prev[0];
  for (const d of prev) if (d.total > prevPeak.total) prevPeak = d;

  return {
    range,
    days: cur,
    prevDays: prev,
    revenue,
    prevRevenue,
    revenueDelta: (revenue - prevRevenue) / prevRevenue,
    profit,
    prevProfit,
    profitDelta: (profit - prevProfit) / prevProfit,
    netMarginPct: revenue > 0 ? (profit / revenue) * 100 : 0,
    prevNetMarginPct: prevRevenue > 0 ? (prevProfit / prevRevenue) * 100 : 0,
    lift,
    prevLift,
    liftDelta: lift - prevLift,
    rows,
    segments,
    leader: rows[0].id,
    peak,
    prevPeak,
  };
}

export const SUMMARIES: Record<RangeDays, RangeSummary> = {
  7: summarize(7),
  30: summarize(30),
  90: summarize(90),
};

export const fmtMoney = (v: number): string => '$' + Math.round(v).toLocaleString('en-US');
export const fmtMoneyShort = (v: number): string => {
  if (Math.abs(v) >= 1000) {
    const k = v / 1000;
    return '$' + (Number.isInteger(k) ? k.toFixed(0) : k.toFixed(1)) + 'k';
  }
  return '$' + Math.round(v);
};
export const fmtPct = (v: number): string => (Math.abs(v) * 100).toFixed(1) + '%';
export const fmtSignedPct = (v: number): string =>
  (v >= 0 ? '+' : '−') + (Math.abs(v) * 100).toFixed(1) + '%';
export const fmtPP = (v: number): string => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2) + ' pp';
export const fmtPPAbs = (v: number): string => Math.abs(v).toFixed(2) + ' pp';
export const rangeLabel = (r: number): string => `${r} days`;

export const PROFIT_NOTE = 'Margin on recovered orders, after offer costs';
export const LIFT_NOTE = 'Checkout conversion vs. holdout group';

export const RANGE_OPTIONS: Array<{ value: RangeDays; label: string; unit: string }> = RANGES.map(
  (r) => ({
    value: r,
    label: String(r),
    unit: 'days',
  }),
);

// ============================================================================
// REUSABLE CORE STORYBOARD SCENES (C-01..C-04)
// Shared between the homepage (`/`) and the standalone Analytics Block.
// ============================================================================

export type AnalyticsDatasetState = 'populated' | 'loading' | 'empty' | 'error';
export type AnalyticsComparisonMode = 'intervention' | 'prior-period';

export interface RevenueRecoveryCoreScenesProps {
  range: RangeDays;
  focus: string | null;
  onSelectFocus: (nextId: string | null) => void;
  motion?: MotionMode;
  idPrefix?: string;
  chartHeight?: number;
  datasetState?: AnalyticsDatasetState;
  comparisonMode?: AnalyticsComparisonMode;
  onRestorePopulated?: () => void;
}

export function RevenueRecoveryCoreScenes({
  range,
  focus,
  onSelectFocus,
  motion = 'stepped',
  idPrefix = 'home',
  chartHeight = 320,
  datasetState = 'populated',
  comparisonMode = 'intervention',
  onRestorePopulated,
}: RevenueRecoveryCoreScenesProps) {
  const changed = useChanged(range);
  const s = SUMMARIES[range];
  const focusItem = focus ? INTERVENTIONS.find((i) => i.id === focus) ?? null : null;

  const isLoading = datasetState === 'loading';
  const isEmpty = datasetState === 'empty';

  const chartData = React.useMemo(() => {
    if (isEmpty) return [];
    return s.days.map((d, idx) => {
      let compareValue: number | undefined;
      if (comparisonMode === 'prior-period' && s.prevDays[idx]) {
        compareValue = s.prevDays[idx].total;
      } else if (focusItem) {
        compareValue = d.byId[focusItem.id];
      }
      return {
        label: d.label,
        longLabel: d.long,
        value: d.total,
        compareValue,
      };
    });
  }, [s.days, s.prevDays, focusItem, comparisonMode, isEmpty]);

  const compareLabel =
    comparisonMode === 'prior-period'
      ? `Prior ${range}d window`
      : focusItem
        ? focusItem.name
        : undefined;

  const barItems = React.useMemo(() => {
    if (isEmpty) return [];
    return s.rows.map((r, idx) => ({
      id: r.id,
      name: r.name,
      value: r.value,
      formattedValue: fmtMoney(r.value),
      share: r.share,
      badge: idx === 0 ? 'Top performer' : undefined,
    }));
  }, [s.rows, isEmpty]);

  const displayRevenue = isEmpty ? 0 : s.revenue;
  const displayRevenueDelta = isEmpty ? 0 : s.revenueDelta;
  const displayProfit = isEmpty ? 0 : s.profit;
  const displayProfitDelta = isEmpty ? 0 : s.profitDelta;
  const displayLift = isEmpty ? 0 : s.lift;
  const displayLiftDelta = isEmpty ? 0 : s.liftDelta;

  return (
    <>
      <Scene gutter="scene" layout="split" aria-busy={isLoading || undefined}>
        <Panel className="c01" label="Recovered revenue over time">
          {isLoading ? (
            <div className="f12-stack-pair" id={`${idPrefix}-c01-skeleton`}>
              <Skeleton variant="line" width="42%" label="Loading recovered revenue metric" />
              <Skeleton variant="metric" width="64%" />
              <Skeleton variant="block" height={chartHeight} />
            </div>
          ) : (
            <>
              <div className="f12-c01-hd">
                <Metric
                  label="Recovered revenue"
                  value={displayRevenue}
                  format={fmtMoney}
                  delta={displayRevenueDelta}
                  deltaKind="pct"
                  range={range}
                  motion={motion}
                  big
                />
                {compareLabel ? (
                  <ul className="f12-legend" aria-label="Chart legend" role="list">
                    <li>
                      <i className="f12-sw f12-sw-total" aria-hidden="true" />
                      All interventions
                    </li>
                    <li>
                      <i className="f12-sw f12-sw-focus" aria-hidden="true" />
                      {compareLabel}
                    </li>
                  </ul>
                ) : (
                  <p className="f12-legend f12-legend-hint">
                    Select an intervention in C-04 to compare it with the total.
                  </p>
                )}
              </div>
              {isEmpty ? (
                <EmptyState
                  id={`${idPrefix}-chart-empty`}
                  code="ZERO RECOVERY EVENTS"
                  title="No recovered checkout revenue in this sandbox state"
                  description="The active simulation state is set to ZERO (empty). Switch back to LIVE fixture data to inspect the 180-day Fernwood Supply Co. recovery series."
                  action={
                    onRestorePopulated ? (
                      <Button
                        id={`${idPrefix}-restore-from-empty-chart`}
                        variant="primary"
                        size="sm"
                        onClick={onRestorePopulated}
                      >
                        Load sample recovery dataset
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                <ToneAreaChart
                  data={chartData}
                  seriesLabel="Recovered revenue"
                  labelColumnHeader="Date"
                  compareLabel={compareLabel}
                  formatValue={fmtMoney}
                  formatShort={fmtMoneyShort}
                  motion={motion}
                  height={chartHeight}
                />
              )}
            </>
          )}
        </Panel>

        <PanelPair
          top={{
            label: 'Incremental profit',
            children: isLoading ? (
              <div className="f12-stack-pair" id={`${idPrefix}-c02-skeleton`}>
                <Skeleton variant="line" width="48%" label="Loading incremental profit metric" />
                <Skeleton variant="metric" width="70%" />
                <Skeleton variant="block" height={74} />
              </div>
            ) : (
              <Metric
                label="Incremental profit"
                value={displayProfit}
                format={fmtMoney}
                delta={displayProfitDelta}
                deltaKind="pct"
                range={range}
                note={PROFIT_NOTE}
                motion={motion}
                spark={
                  <ToneSpark
                    values={isEmpty ? [0, 0, 0, 0, 0, 0, 0] : s.days.map((d) => d.profit)}
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
            children: isLoading ? (
              <div className="f12-stack-pair" id={`${idPrefix}-c03-skeleton`}>
                <Skeleton variant="line" width="45%" label="Loading conversion lift metric" />
                <Skeleton variant="metric" width="68%" />
                <Skeleton variant="block" height={74} />
              </div>
            ) : (
              <Metric
                label="Conversion lift"
                value={displayLift}
                format={fmtPP}
                delta={displayLiftDelta}
                deltaKind="pp"
                range={range}
                note={LIFT_NOTE}
                motion={motion}
                spark={
                  <ToneSpark
                    values={isEmpty ? [0, 0, 0, 0, 0, 0, 0] : s.days.map((d) => d.lift)}
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

      <Scene gutter="scene" layout="stack" aria-busy={isLoading || undefined}>
        <Panel className="c04" label="Revenue by intervention">
          {isLoading ? (
            <div className="f12-stack-pair" id={`${idPrefix}-c04-skeleton`}>
              <Skeleton variant="line" width="38%" label="Loading ranked interventions" />
              <Skeleton variant="block" height={180} />
              <SkeletonText lines={2} />
            </div>
          ) : isEmpty ? (
            <EmptyState
              id={`${idPrefix}-interventions-empty`}
              code="NO ATTRIBUTION ROWS"
              title="Zero intervention triggers recorded"
              description="No abandoned-cart, exit-intent, back-in-stock, price-drop, or post-purchase upsell events exist in the empty simulation state."
            />
          ) : (
            <ToneBarList
              title="Revenue by intervention"
              subtitle={`Last ${s.range} days · share of recovered revenue`}
              items={barItems}
              selectedId={focus}
              onSelect={onSelectFocus}
              motion={motion}
              changed={changed}
              idPrefix={idPrefix}
            />
          )}
        </Panel>
      </Scene>
    </>
  );
}

// ============================================================================
// STANDALONE INSTALLABLE ANALYTICS APPLICATION BLOCK (`AnalyticsDashboard`)
// Combines Expressive Storyboard (C-01..C-04) with Quiet Supporting Ledgers.
// ============================================================================

export type LedgerSortMode = 'date-desc' | 'revenue-desc' | 'profit-desc';

const DATASET_STATE_OPTIONS: Array<{ value: AnalyticsDatasetState; label: string; unit: string }> = [
  { value: 'populated', label: 'LIVE', unit: 'fixture' },
  { value: 'loading', label: 'LOAD', unit: 'skel' },
  { value: 'empty', label: 'ZERO', unit: 'empty' },
  { value: 'error', label: 'ERR', unit: '503' },
];

const COMPARISON_MODE_OPTIONS: Array<{
  value: AnalyticsComparisonMode;
  label: string;
  unit: string;
}> = [
  { value: 'intervention', label: 'FOCUS', unit: 'c-04' },
  { value: 'prior-period', label: 'PREV', unit: 'period' },
];

const LEDGER_PAGE_SIZE = 10;

export interface AnalyticsDashboardProps {
  /** Initial observation window in days (`30` by default). */
  initialRange?: RangeDays;
  /** Initial focused intervention ID (`null` by default). */
  initialFocusId?: string | null;
  /** Initial chart comparison mode (`'intervention'` by default). */
  initialComparisonMode?: AnalyticsComparisonMode;
  /** Initial dataset simulation state (`'populated'` by default). */
  initialDatasetState?: AnalyticsDatasetState;
  /** Motion grammar override (`'stepped'` 12fps by default). */
  motion?: MotionMode;
  /** Theme override (`'light'` or `'dark'`). */
  theme?: 'light' | 'dark';
  /** Show interactive sandbox state switcher (`true` by default). */
  showSandboxControls?: boolean;
  /** Deterministic DOM ID prefix (`'analytics'` by default when passed by showcase). */
  idPrefix?: string;
  /** Optional slot rendered below the sheet header. */
  headerSlot?: React.ReactNode;
  /** Optional slot rendered at the bottom of the sheet. */
  footerSlot?: React.ReactNode;
}

function AnalyticsDashboardInner({
  initialRange = DEFAULT_RANGE,
  initialFocusId = null,
  initialComparisonMode = 'intervention',
  initialDatasetState = 'populated',
  motion = 'stepped',
  theme,
  showSandboxControls = true,
  idPrefix,
  headerSlot,
  footerSlot,
}: AnalyticsDashboardProps) {
  const autoId = React.useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const resolvedIdPrefix = idPrefix ?? `f12-analytics-${autoId}`;
  const { toast } = useToast();

  const [range, setRange] = React.useState<RangeDays>(initialRange);
  const [focus, setFocus] = React.useState<string | null>(initialFocusId);
  const [comparisonMode, setComparisonMode] =
    React.useState<AnalyticsComparisonMode>(initialComparisonMode);
  const [datasetState, setDatasetState] =
    React.useState<AnalyticsDatasetState>(initialDatasetState);

  const [segmentFilter, setSegmentFilter] = React.useState<CheckoutSegmentId | 'all'>('all');
  const [ledgerSearch, setLedgerSearch] = React.useState<string>('');
  const [ledgerSort, setLedgerSort] = React.useState<LedgerSortMode>('date-desc');
  const [ledgerPage, setLedgerPage] = React.useState<number>(1);
  const [inspectedDayKey, setInspectedDayKey] = React.useState<string | null>(null);

  const pendingFocusTargetIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    const targetId = pendingFocusTargetIdRef.current;
    if (!targetId) return;
    pendingFocusTargetIdRef.current = null;
    const raf = window.requestAnimationFrame(() => {
      const el = document.getElementById(targetId);
      if (el && typeof el.focus === 'function') {
        el.focus();
      }
    });
    return () => window.cancelAnimationFrame(raf);
  }, [range, focus, comparisonMode, datasetState, segmentFilter, ledgerSearch, ledgerSort, ledgerPage, inspectedDayKey]);

  const s = SUMMARIES[range];
  const focusItem = focus ? INTERVENTIONS.find((i) => i.id === focus) ?? null : null;
  const isLoading = datasetState === 'loading';
  const isEmpty = datasetState === 'empty';
  const isError = datasetState === 'error';

  // Reset pagination to page 1 when range or filters change
  const handleRangeChange = (nextRange: RangeDays) => {
    setRange(nextRange);
    setLedgerPage(1);
  };

  const handleFocusSelect = (nextId: string | null) => {
    setFocus(nextId);
    setLedgerPage(1);
  };

  const handleSegmentSelect = (nextSeg: CheckoutSegmentId | 'all') => {
    setSegmentFilter(nextSeg);
    setLedgerPage(1);
  };

  const handleRestorePopulated = () => {
    pendingFocusTargetIdRef.current = `${resolvedIdPrefix}-rng-${range}`;
    setDatasetState('populated');
    toast({
      status: 'success',
      title: 'Restored Fernwood Supply Co. telemetry',
      description: `Loaded ${range}-day deterministic recovery fixture through ${END_LABEL}.`,
    });
  };

  const handleResetView = () => {
    pendingFocusTargetIdRef.current = `${resolvedIdPrefix}-rng-${DEFAULT_RANGE}`;
    setRange(DEFAULT_RANGE);
    setFocus(null);
    setComparisonMode('intervention');
    setDatasetState('populated');
    setSegmentFilter('all');
    setLedgerSearch('');
    setLedgerSort('date-desc');
    setLedgerPage(1);
    setInspectedDayKey(null);
    toast({
      status: 'info',
      title: 'Reset analytics view',
      description: 'Restored 30-day window, all interventions, all checkout segments, and default date sorting.',
    });
  };

  // Reconciled Segment Breakdown scoped to either all interventions or the focused intervention
  const scopedSegments = React.useMemo<SegmentRow[]>(() => {
    if (isEmpty) {
      return CHECKOUT_SEGMENTS.map((seg) => ({
        id: seg.id,
        name: seg.name,
        shortName: seg.shortName,
        description: seg.description,
        revenue: 0,
        prevRevenue: 0,
        deltaPct: 0,
        profit: 0,
        share: 0,
      }));
    }
    if (!focusItem) {
      return s.segments;
    }
    const scopeRev = sum(s.days, (d) => d.byId[focusItem.id]);
    return CHECKOUT_SEGMENTS.map((seg) => {
      const rev = sum(s.days, (d) => d.byIdAndSegment[focusItem.id][seg.id]);
      const prevRev = sum(s.prevDays, (d) => d.byIdAndSegment[focusItem.id][seg.id]);
      const prof = sum(s.days, (d) => d.profitByIdAndSegment[focusItem.id][seg.id]);
      return {
        id: seg.id,
        name: seg.name,
        shortName: seg.shortName,
        description: seg.description,
        revenue: rev,
        prevRevenue: prevRev,
        deltaPct: prevRev > 0 ? (rev - prevRev) / prevRev : 0,
        profit: prof,
        share: scopeRev > 0 ? rev / scopeRev : 0,
      };
    });
  }, [s, focusItem, isEmpty]);

  const scopedTotalRevenue = React.useMemo(
    () => sum(scopedSegments, (seg) => seg.revenue),
    [scopedSegments],
  );
  const scopedTotalProfit = React.useMemo(
    () => sum(scopedSegments, (seg) => seg.profit),
    [scopedSegments],
  );

  // Reconciled Period Comparison scoped to either all interventions or the focused intervention
  const scopedPeriod = React.useMemo(() => {
    if (!focusItem) {
      return {
        revenue: s.revenue,
        prevRevenue: s.prevRevenue,
        revenueDelta: s.revenueDelta,
        profit: s.profit,
        prevProfit: s.prevProfit,
        profitDelta: s.profitDelta,
        netMarginPct: s.netMarginPct,
        prevNetMarginPct: s.prevNetMarginPct,
        peakLabel: s.peak.label,
        peakValue: s.peak.total,
        prevPeakLabel: s.prevPeak.label,
        prevPeakValue: s.prevPeak.total,
      };
    }
    const rev = sum(s.days, (d) => d.byId[focusItem.id]);
    const prevRev = sum(s.prevDays, (d) => d.byId[focusItem.id]);
    const prof = sum(s.days, (d) => d.profitById[focusItem.id]);
    const prevProf = sum(s.prevDays, (d) => d.profitById[focusItem.id]);
    let peakDay = s.days[0];
    for (const d of s.days) {
      if (d.byId[focusItem.id] > peakDay.byId[focusItem.id]) peakDay = d;
    }
    let prevPeakDay = s.prevDays[0];
    for (const d of s.prevDays) {
      if (d.byId[focusItem.id] > prevPeakDay.byId[focusItem.id]) prevPeakDay = d;
    }
    return {
      revenue: rev,
      prevRevenue: prevRev,
      revenueDelta: prevRev > 0 ? (rev - prevRev) / prevRev : 0,
      profit: prof,
      prevProfit: prevProf,
      profitDelta: prevProf > 0 ? (prof - prevProf) / prevProf : 0,
      netMarginPct: rev > 0 ? (prof / rev) * 100 : 0,
      prevNetMarginPct: prevRev > 0 ? (prevProf / prevRev) * 100 : 0,
      peakLabel: peakDay.label,
      peakValue: peakDay.byId[focusItem.id],
      prevPeakLabel: prevPeakDay.label,
      prevPeakValue: prevPeakDay.byId[focusItem.id],
    };
  }, [s, focusItem]);

  // Reconciled Daily Recovery Ledger rows (filtered by intervention, segment, and search query)
  const ledgerRows = React.useMemo(() => {
    if (isEmpty) return [];
    const q = ledgerSearch.trim().toLowerCase();

    const mapped = s.days.map((d) => {
      let rowRevenue: number;
      let rowProfit: number;

      if (focusItem && segmentFilter !== 'all') {
        rowRevenue = d.byIdAndSegment[focusItem.id][segmentFilter];
        rowProfit = d.profitByIdAndSegment[focusItem.id][segmentFilter];
      } else if (focusItem) {
        rowRevenue = d.byId[focusItem.id];
        rowProfit = d.profitById[focusItem.id];
      } else if (segmentFilter !== 'all') {
        rowRevenue = d.bySegment[segmentFilter];
        rowProfit = d.profitBySegment[segmentFilter];
      } else {
        rowRevenue = d.total;
        rowProfit = d.profit;
      }

      const activeInterventionMeta =
        focusItem ??
        INTERVENTIONS.find((it) => it.id === d.topInterventionId) ??
        INTERVENTIONS[0];
      const activeSegmentMeta =
        segmentFilter !== 'all'
          ? CHECKOUT_SEGMENTS.find((seg) => seg.id === segmentFilter)!
          : CHECKOUT_SEGMENTS.find((seg) => seg.id === d.topSegmentId) ?? CHECKOUT_SEGMENTS[0];

      const marginPct = rowRevenue > 0 ? (rowProfit / rowRevenue) * 100 : 0;

      return {
        day: d,
        dayKey: d.dayKey,
        label: d.label,
        longLabel: d.long,
        revenue: rowRevenue,
        profit: rowProfit,
        marginPct,
        lift: d.lift,
        interventionName: activeInterventionMeta.name,
        channel: activeInterventionMeta.channel,
        segmentName: activeSegmentMeta.shortName,
        evidenceNote: d.evidenceNote,
      };
    });

    const filtered = q
      ? mapped.filter(
          (r) =>
            r.label.toLowerCase().includes(q) ||
            r.longLabel.toLowerCase().includes(q) ||
            r.dayKey.toLowerCase().includes(q) ||
            r.interventionName.toLowerCase().includes(q) ||
            r.channel.toLowerCase().includes(q) ||
            r.segmentName.toLowerCase().includes(q) ||
            r.evidenceNote.toLowerCase().includes(q),
        )
      : mapped;

    const sorted = [...filtered];
    if (ledgerSort === 'date-desc') {
      sorted.sort((a, b) => b.day.ms - a.day.ms);
    } else if (ledgerSort === 'revenue-desc') {
      sorted.sort((a, b) => b.revenue - a.revenue || b.day.ms - a.day.ms);
    } else if (ledgerSort === 'profit-desc') {
      sorted.sort((a, b) => b.profit - a.profit || b.day.ms - a.day.ms);
    }
    return sorted;
  }, [s.days, focusItem, segmentFilter, ledgerSearch, ledgerSort, isEmpty]);

  const totalLedgerRevenue = React.useMemo(
    () => sum(ledgerRows, (r) => r.revenue),
    [ledgerRows],
  );
  const totalLedgerProfit = React.useMemo(
    () => sum(ledgerRows, (r) => r.profit),
    [ledgerRows],
  );
  const totalLedgerMarginPct =
    totalLedgerRevenue > 0 ? (totalLedgerProfit / totalLedgerRevenue) * 100 : 0;
  const avgLedgerLift =
    ledgerRows.length > 0 ? sum(ledgerRows, (r) => r.lift) / ledgerRows.length : 0;

  const totalPages = Math.max(1, Math.ceil(ledgerRows.length / LEDGER_PAGE_SIZE));
  const safePage = Math.min(ledgerPage, totalPages);
  const pagedLedgerRows = React.useMemo(
    () =>
      ledgerRows.slice(
        (safePage - 1) * LEDGER_PAGE_SIZE,
        safePage * LEDGER_PAGE_SIZE,
      ),
    [ledgerRows, safePage],
  );

  const inspectedDay = React.useMemo(
    () => (inspectedDayKey ? s.days.find((d) => d.dayKey === inspectedDayKey) ?? null : null),
    [inspectedDayKey, s.days],
  );

  const hasActiveFilters =
    focus !== null ||
    segmentFilter !== 'all' ||
    ledgerSearch.trim().length > 0 ||
    ledgerSort !== 'date-desc';

  const postureTag: { status: TagStatus; label: string } = isError
    ? { status: 'danger', label: 'WAREHOUSE FAULT' }
    : isEmpty
      ? { status: 'neutral', label: 'EMPTY SANDBOX' }
      : isLoading
        ? { status: 'info', label: 'LOADING TELEMETRY' }
        : { status: 'success', label: 'RECONCILED LEDGER' };

  const activeScopeBreadcrumbLabel = focusItem
    ? `${range}d · ${focusItem.name}`
    : segmentFilter !== 'all'
      ? `${range}d · ${CHECKOUT_SEGMENTS.find((seg) => seg.id === segmentFilter)?.shortName}`
      : `${range}d Window (${s.days[0].label} – ${s.days[s.days.length - 1].label})`;

  return (
    <Sheet
      id={`${resolvedIdPrefix}-sheet`}
      autoCut
      pegs
      motion={motion}
      theme={theme}
      className="f12-console f12-analytics"
    >
      {/* ===================================================================== SHEET HEADER */}
      <header className="f12-hd">
        <div className="f12-hd-text">
          <Breadcrumb
            aria-label="Analytics hierarchy"
            density="compact"
            items={[
              {
                label: STORE,
                href: `#${resolvedIdPrefix}-sheet`,
                onClick: (e) => {
                  e.preventDefault();
                  handleResetView();
                },
              },
              {
                label: 'Revenue Recovery',
                href: `#${resolvedIdPrefix}-rng-${range}`,
                onClick: (e) => {
                  e.preventDefault();
                  document.getElementById(`${resolvedIdPrefix}-rng-${range}`)?.focus();
                },
              },
              {
                label: activeScopeBreadcrumbLabel,
                current: true,
              },
            ]}
          />
          <p className="f12-eyebrow">
            <span>{STORE} · Revenue Recovery Analytics</span>
            <Tag status={postureTag.status} id={`${resolvedIdPrefix}-posture-tag`}>
              {postureTag.label}
            </Tag>
            <Badge burst={false}>{`Through ${END_LABEL}`}</Badge>
          </p>
          <h1 className="f12-title">Revenue recovery</h1>
          <p className="f12-muted-copy" id={`${resolvedIdPrefix}-subtitle`}>
            Expressive storyboard establishing shot (<code className="f12-code-inline">C-01</code>
            –<code className="f12-code-inline">C-04</code>) paired with Quiet period-comparison,
            checkout-segment, and daily attribution ledgers reconciled from a single{' '}
            <code className="f12-code-inline">mulberry32(1207)</code> fixture.
          </p>
        </div>

        <div className="f12-stack-pair">
          <div
            className="f12-row-pair"
            role="group"
            aria-label="Observation window and comparison controls"
          >
            <SegmentedControl
              idPrefix={`${resolvedIdPrefix}-rng`}
              ariaLabel="Date range"
              options={RANGE_OPTIONS}
              value={range}
              onChange={handleRangeChange}
            />
            <SegmentedControl
              idPrefix={`${resolvedIdPrefix}-compare`}
              ariaLabel="Time-series comparison overlay"
              options={COMPARISON_MODE_OPTIONS}
              value={comparisonMode}
              onChange={setComparisonMode}
            />
          </div>

          {showSandboxControls ? (
            <div
              className="f12-row-pair"
              role="group"
              aria-label="Sandbox dataset state and view reset"
            >
              <SegmentedControl
                idPrefix={`${resolvedIdPrefix}-dataset`}
                ariaLabel="Dataset simulation state"
                options={DATASET_STATE_OPTIONS}
                value={datasetState}
                onChange={setDatasetState}
              />
              <Button
                id={`${resolvedIdPrefix}-reset-btn`}
                variant="secondary"
                size="sm"
                onClick={handleResetView}
              >
                Reset view
              </Button>
            </div>
          ) : null}
        </div>
      </header>

      {headerSlot}

      {/* ===================================================================== FAULT BANNER */}
      {isError ? (
        <Alert
          id={`${resolvedIdPrefix}-error-banner`}
          status="danger"
          title="Warehouse attribution feed interrupted — HTTP 503"
          actions={
            <Button
              id={`${resolvedIdPrefix}-retry-btn`}
              variant="primary"
              size="sm"
              onClick={handleRestorePopulated}
            >
              Retry attribution sync
            </Button>
          }
        >
          Upstream holdout reconciliation worker timed out while refreshing checkout attribution.
          Cached local figures remain visible below; click Retry attribution sync to restore live
          sandbox state.
        </Alert>
      ) : null}

      {/* ===================================================================== EXPRESSIVE STORYBOARD (C-01..C-04) */}
      <RevenueRecoveryCoreScenes
        range={range}
        focus={focus}
        onSelectFocus={(nextId) => {
          handleFocusSelect(nextId);
          if (nextId !== null && comparisonMode === 'prior-period') {
            setComparisonMode('intervention');
          }
        }}
        motion={motion}
        idPrefix={resolvedIdPrefix}
        chartHeight={320}
        datasetState={datasetState}
        comparisonMode={comparisonMode}
        onRestorePopulated={handleRestorePopulated}
      />

      {/* ===================================================================== QUIET OPERATIONAL ANALYTICS: PERIOD COMPARISON & SEGMENT BREAKDOWN */}
      <Scene gutter="scene" layout="equal" aria-busy={isLoading || undefined}>
        <Panel
          variant="quiet"
          id={`${resolvedIdPrefix}-period-comparison-panel`}
          label="Period-over-period comparison and holdout methodology"
        >
          {isLoading ? (
            <div className="f12-stack-pair" id={`${resolvedIdPrefix}-period-skeleton`}>
              <Skeleton variant="line" width="52%" />
              <Skeleton variant="block" height={190} />
              <SkeletonText lines={2} />
            </div>
          ) : (
            <div className="f12-stack-pair">
              <div className="f12-row-between">
                <div className="f12-row-pair">
                  <h2 className="f12-console-quiet-title">
                    PERIOD COMPARISON · CURRENT {range}D VS. PRIOR {range}D
                  </h2>
                  <Tag status={focusItem ? 'info' : 'neutral'}>
                    {focusItem ? `SCOPED: ${focusItem.name.toUpperCase()}` : 'ALL INTERVENTIONS'}
                  </Tag>
                  <Tag status={comparisonMode === 'prior-period' ? 'info' : 'neutral'}>
                    {comparisonMode === 'prior-period' ? 'CHART OVERLAY ACTIVE' : 'QUIET LEDGER'}
                  </Tag>
                </div>
                <Button
                  id={`${resolvedIdPrefix}-toggle-prev-overlay`}
                  variant={comparisonMode === 'prior-period' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => {
                    setComparisonMode(
                      comparisonMode === 'prior-period' ? 'intervention' : 'prior-period',
                    );
                  }}
                >
                  {comparisonMode === 'prior-period'
                    ? 'Hide prior-period overlay'
                    : `Overlay prior ${range}d on C-01`}
                </Button>
              </div>
              <p className="f12-console-quiet-sub">
                Direct window-over-window reconciliation comparing the active {range}-day window
                ({s.days[0].label} – {s.days[s.days.length - 1].label}) against the immediately
                preceding {range}-day baseline ({s.prevDays[0].label} –{' '}
                {s.prevDays[s.prevDays.length - 1].label})
                {focusItem ? ` for ${focusItem.name}` : ''}.
              </p>

              <Table density="compact" id={`${resolvedIdPrefix}-period-table`}>
                <TableCaption>
                  Reconciled {range}-day period comparison through {END_LABEL}
                  {focusItem ? ` (${focusItem.name})` : ''}.
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Metric</TableHead>
                    <TableHead>{`Current (${range}d)`}</TableHead>
                    <TableHead>{`Prior (${range}d)`}</TableHead>
                    <TableHead>Delta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>Recovered revenue</TableCell>
                    <TableCell id={`${resolvedIdPrefix}-period-cur-revenue`}>
                      {fmtMoney(isEmpty ? 0 : scopedPeriod.revenue)}
                    </TableCell>
                    <TableCell id={`${resolvedIdPrefix}-period-prev-revenue`}>
                      {fmtMoney(isEmpty ? 0 : scopedPeriod.prevRevenue)}
                    </TableCell>
                    <TableCell>
                      <Tag
                        status={
                          isEmpty ? 'neutral' : scopedPeriod.revenueDelta >= 0 ? 'success' : 'warning'
                        }
                      >
                        {isEmpty ? '+0.0%' : fmtSignedPct(scopedPeriod.revenueDelta)}
                      </Tag>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Incremental profit</TableCell>
                    <TableCell id={`${resolvedIdPrefix}-period-cur-profit`}>
                      {fmtMoney(isEmpty ? 0 : scopedPeriod.profit)}
                    </TableCell>
                    <TableCell id={`${resolvedIdPrefix}-period-prev-profit`}>
                      {fmtMoney(isEmpty ? 0 : scopedPeriod.prevProfit)}
                    </TableCell>
                    <TableCell>
                      <Tag
                        status={
                          isEmpty ? 'neutral' : scopedPeriod.profitDelta >= 0 ? 'success' : 'warning'
                        }
                      >
                        {isEmpty ? '+0.0%' : fmtSignedPct(scopedPeriod.profitDelta)}
                      </Tag>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Net profit margin</TableCell>
                    <TableCell>{`${(isEmpty ? 0 : scopedPeriod.netMarginPct).toFixed(1)}%`}</TableCell>
                    <TableCell>{`${(isEmpty ? 0 : scopedPeriod.prevNetMarginPct).toFixed(1)}%`}</TableCell>
                    <TableCell>
                      {isEmpty
                        ? '+0.00 pp'
                        : fmtPP(scopedPeriod.netMarginPct - scopedPeriod.prevNetMarginPct)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Conversion lift vs. holdout</TableCell>
                    <TableCell>{isEmpty ? '+0.00 pp' : fmtPP(s.lift)}</TableCell>
                    <TableCell>{isEmpty ? '+0.00 pp' : fmtPP(s.prevLift)}</TableCell>
                    <TableCell>
                      <Tag
                        status={
                          isEmpty || Math.abs(s.liftDelta) < 0.005
                            ? 'neutral'
                            : s.liftDelta > 0
                              ? 'success'
                              : 'warning'
                        }
                      >
                        {isEmpty || Math.abs(s.liftDelta) < 0.005
                          ? '0.00 pp'
                          : fmtPP(s.liftDelta)}
                      </Tag>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Peak daily recovery</TableCell>
                    <TableCell>
                      {isEmpty
                        ? '$0'
                        : `${scopedPeriod.peakLabel} · ${fmtMoney(scopedPeriod.peakValue)}`}
                    </TableCell>
                    <TableCell>
                      {isEmpty
                        ? '$0'
                        : `${scopedPeriod.prevPeakLabel} · ${fmtMoney(scopedPeriod.prevPeakValue)}`}
                    </TableCell>
                    <TableCell>
                      {isEmpty
                        ? '+0.0%'
                        : fmtSignedPct(
                            (scopedPeriod.peakValue - scopedPeriod.prevPeakValue) /
                              scopedPeriod.prevPeakValue,
                          )}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>

              <Notice status="info" title="Deterministic holdout & margin accounting">
                Every trigger withholds a 10% randomized holdout cohort. Incremental profit deducts
                channel delivery and discount costs per intervention (Abandoned-cart 38% margin,
                Exit-intent 22%, Back-in-stock 41%, Price-drop 18%, Post-purchase upsell 46%).
              </Notice>
            </div>
          )}
        </Panel>

        <Panel
          variant="quiet"
          id={`${resolvedIdPrefix}-segment-breakdown-panel`}
          label="Checkout segment breakdown"
        >
          {isLoading ? (
            <div className="f12-stack-pair" id={`${resolvedIdPrefix}-segment-skeleton`}>
              <Skeleton variant="line" width="48%" />
              <Skeleton variant="block" height={190} />
              <SkeletonText lines={2} />
            </div>
          ) : (
            <div className="f12-stack-pair">
              <div className="f12-row-between">
                <div className="f12-stack-pair">
                  <div className="f12-row-pair">
                    <h2 className="f12-console-quiet-title">
                      CHECKOUT SEGMENT BREAKDOWN
                    </h2>
                    <Tag status={focusItem ? 'info' : 'neutral'}>
                      {focusItem ? `SCOPED: ${focusItem.name.toUpperCase()}` : 'ALL INTERVENTIONS'}
                    </Tag>
                  </div>
                  <p className="f12-console-quiet-sub">
                    Cohort and device attribution reconciled to 100% of{' '}
                    {focusItem ? `${focusItem.name} revenue` : `total ${range}-day recovered revenue`}{' '}
                    ({fmtMoney(scopedTotalRevenue)}). Select a segment to filter the daily ledger.
                  </p>
                </div>
              </div>

              <div
                className="f12-row-pair"
                role="group"
                aria-label="Filter daily ledger by checkout segment"
              >
                <Button
                  id={`${resolvedIdPrefix}-seg-filter-all`}
                  variant={segmentFilter === 'all' ? 'primary' : 'secondary'}
                  size="sm"
                  aria-pressed={segmentFilter === 'all'}
                  onClick={() => handleSegmentSelect('all')}
                >
                  All segments (100%)
                </Button>
                {scopedSegments.map((seg) => (
                  <Button
                    key={seg.id}
                    id={`${resolvedIdPrefix}-seg-filter-${seg.id}`}
                    variant={segmentFilter === seg.id ? 'primary' : 'secondary'}
                    size="sm"
                    aria-pressed={segmentFilter === seg.id}
                    onClick={() =>
                      handleSegmentSelect(segmentFilter === seg.id ? 'all' : seg.id)
                    }
                  >
                    {`${seg.shortName} (${Math.round(seg.share * 100)}%)`}
                  </Button>
                ))}
              </div>

              <Table density="compact" id={`${resolvedIdPrefix}-segment-table`}>
                <TableCaption>
                  Checkout segment breakdown for {focusItem ? focusItem.name : `all interventions`} (
                  {range} days).
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Segment</TableHead>
                    <TableHead>Recovered Revenue</TableHead>
                    <TableHead>Incremental Profit</TableHead>
                    <TableHead>Share</TableHead>
                    <TableHead>vs. Prior</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scopedSegments.map((seg) => (
                    <TableRow key={seg.id}>
                      <TableCell>
                        <strong>{seg.name}</strong>
                        <div className="f12-mono-note">{seg.description}</div>
                      </TableCell>
                      <TableCell>{fmtMoney(seg.revenue)}</TableCell>
                      <TableCell>{fmtMoney(seg.profit)}</TableCell>
                      <TableCell>{`${(seg.share * 100).toFixed(1)}%`}</TableCell>
                      <TableCell>
                        <Tag status={isEmpty ? 'neutral' : seg.deltaPct >= 0 ? 'success' : 'warning'}>
                          {isEmpty ? '+0.0%' : fmtSignedPct(seg.deltaPct)}
                        </Tag>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell>
                      {focusItem ? `Total (${focusItem.name})` : `Total (${range} days)`}
                    </TableCell>
                    <TableCell id={`${resolvedIdPrefix}-segment-total-revenue`}>
                      {fmtMoney(scopedTotalRevenue)}
                    </TableCell>
                    <TableCell id={`${resolvedIdPrefix}-segment-total-profit`}>
                      {fmtMoney(scopedTotalProfit)}
                    </TableCell>
                    <TableCell>{isEmpty ? '0.0%' : '100.0%'}</TableCell>
                    <TableCell>
                      {isEmpty
                        ? '+0.0%'
                        : fmtSignedPct(
                            focusItem
                              ? s.rows.find((r) => r.id === focusItem.id)?.deltaPct ?? 0
                              : s.revenueDelta,
                          )}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}
        </Panel>
      </Scene>

      {/* ===================================================================== QUIET OPERATIONAL ANALYTICS: FILTERABLE DAILY RECOVERY LEDGER */}
      <Scene gutter="scene" layout="stack" aria-busy={isLoading || undefined}>
        <Panel
          variant="quiet"
          id={`${resolvedIdPrefix}-daily-ledger-panel`}
          label="Filterable daily recovery ledger and supporting evidence"
        >
          {isLoading ? (
            <div className="f12-stack-pair" id={`${resolvedIdPrefix}-ledger-skeleton`}>
              <Skeleton variant="line" width="44%" />
              <Skeleton variant="block" height={260} />
            </div>
          ) : (
            <div className="f12-stack-scene">
              <div className="f12-stack-pair">
                <div className="f12-row-between">
                  <div className="f12-row-pair">
                    <h2 className="f12-console-quiet-title">
                      DAILY RECOVERY &amp; ATTRIBUTION EVIDENCE LEDGER
                    </h2>
                    <Tag status="neutral" id={`${resolvedIdPrefix}-ledger-count-tag`}>
                      {`${ledgerRows.length} OF ${isEmpty ? 0 : s.days.length} DAYS`}
                    </Tag>
                    {focusItem ? (
                      <Tag status="info">{`INTERVENTION: ${focusItem.name.toUpperCase()}`}</Tag>
                    ) : null}
                    {segmentFilter !== 'all' ? (
                      <Tag status="info">
                        {`SEGMENT: ${CHECKOUT_SEGMENTS.find((seg) => seg.id === segmentFilter)?.shortName.toUpperCase()}`}
                      </Tag>
                    ) : null}
                  </div>

                  {hasActiveFilters ? (
                    <Button
                      id={`${resolvedIdPrefix}-clear-ledger-filters`}
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        pendingFocusTargetIdRef.current = `${resolvedIdPrefix}-ledger-search`;
                        setFocus(null);
                        setSegmentFilter('all');
                        setLedgerSearch('');
                        setLedgerSort('date-desc');
                        setLedgerPage(1);
                      }}
                    >
                      Clear active filters
                    </Button>
                  ) : null}
                </div>
                <p className="f12-console-quiet-sub">
                  Filter daily recovery records by date, intervention, or checkout segment. Unfiltered
                  column totals reconcile exactly with C-01 ({fmtMoney(isEmpty ? 0 : s.revenue)}) and
                  C-02 ({fmtMoney(isEmpty ? 0 : s.profit)}).
                </p>
              </div>

              <div className="f12-console-filters" role="group" aria-label="Daily ledger filters">
                <Input
                  id={`${resolvedIdPrefix}-ledger-search`}
                  density="compact"
                  label="Search date, intervention, or note"
                  placeholder="e.g. Oct 31, Exit-intent, weekend..."
                  value={ledgerSearch}
                  onChange={(e) => {
                    setLedgerSearch(e.target.value);
                    setLedgerPage(1);
                  }}
                />

                <Select
                  id={`${resolvedIdPrefix}-ledger-intervention`}
                  density="compact"
                  label="Intervention filter"
                  value={focus ?? 'all'}
                  onValueChange={(val) => handleFocusSelect(val === 'all' ? null : val)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All interventions (5)</SelectItem>
                    {INTERVENTIONS.map((it) => (
                      <SelectItem key={it.id} value={it.id}>
                        {`${it.name} (${it.channel})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  id={`${resolvedIdPrefix}-ledger-segment`}
                  density="compact"
                  label="Checkout segment"
                  value={segmentFilter}
                  onValueChange={(val) =>
                    handleSegmentSelect(val as CheckoutSegmentId | 'all')
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All checkout segments (3)</SelectItem>
                    {CHECKOUT_SEGMENTS.map((seg) => (
                      <SelectItem key={seg.id} value={seg.id}>
                        {seg.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  id={`${resolvedIdPrefix}-ledger-sort`}
                  density="compact"
                  label="Sort order"
                  value={ledgerSort}
                  onValueChange={(val) => {
                    setLedgerSort(val as LedgerSortMode);
                    setLedgerPage(1);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date-desc">Date (newest first)</SelectItem>
                    <SelectItem value="revenue-desc">Recovered revenue (high → low)</SelectItem>
                    <SelectItem value="profit-desc">Incremental profit (high → low)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {ledgerRows.length === 0 ? (
                <EmptyState
                  id={`${resolvedIdPrefix}-ledger-empty`}
                  code={isEmpty ? 'EMPTY DATASET' : 'NO MATCHING DAYS'}
                  title={
                    isEmpty
                      ? 'No daily recovery records in ZERO state'
                      : 'No daily ledger rows match the current filter query'
                  }
                  description={
                    isEmpty
                      ? 'Switch the dataset simulation state back to LIVE to populate the daily attribution ledger.'
                      : `No days in the ${range}-day window matched "${ledgerSearch}". Reset the search and scope filters to restore all ${s.days.length} daily rows.`
                  }
                  action={
                    isEmpty ? (
                      <Button
                        id={`${resolvedIdPrefix}-ledger-restore-dataset`}
                        variant="primary"
                        size="sm"
                        onClick={handleRestorePopulated}
                      >
                        Load sample recovery dataset
                      </Button>
                    ) : (
                      <Button
                        id={`${resolvedIdPrefix}-ledger-reset-empty`}
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          pendingFocusTargetIdRef.current = `${resolvedIdPrefix}-ledger-search`;
                          setFocus(null);
                          setSegmentFilter('all');
                          setLedgerSearch('');
                          setLedgerSort('date-desc');
                          setLedgerPage(1);
                        }}
                      >
                        Reset ledger filters
                      </Button>
                    )
                  }
                />
              ) : (
                <>
                  <Table density="compact" id={`${resolvedIdPrefix}-ledger-table`}>
                    <TableCaption>
                      Daily recovery attribution ledger ({ledgerRows.length} matching day(s) in{' '}
                      {range}-day window; totals reconcile with C-01..C-04).
                    </TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>{focusItem ? 'Scoped Intervention' : 'Top Intervention'}</TableHead>
                        <TableHead>{segmentFilter !== 'all' ? 'Scoped Segment' : 'Lead Segment'}</TableHead>
                        <TableHead>Recovered Revenue</TableHead>
                        <TableHead>Incremental Profit</TableHead>
                        <TableHead>Net Margin</TableHead>
                        <TableHead>Lift vs. Holdout</TableHead>
                        <TableHead>Evidence</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedLedgerRows.map((row) => (
                        <TableRow key={row.dayKey}>
                          <TableCell>
                            <code className="f12-code-inline">{row.label}</code>
                          </TableCell>
                          <TableCell>
                            <strong>{row.interventionName}</strong>
                            <span className="f12-mono-note">{` · ${row.channel}`}</span>
                          </TableCell>
                          <TableCell>{row.segmentName}</TableCell>
                          <TableCell>{fmtMoney(row.revenue)}</TableCell>
                          <TableCell>{fmtMoney(row.profit)}</TableCell>
                          <TableCell>{`${row.marginPct.toFixed(1)}%`}</TableCell>
                          <TableCell>{fmtPP(row.lift)}</TableCell>
                          <TableCell>
                            <Button
                              id={`${resolvedIdPrefix}-inspect-day-${row.dayKey}`}
                              variant="secondary"
                              size="sm"
                              onClick={(e) => {
                                e.currentTarget.focus();
                                setInspectedDayKey(row.dayKey);
                              }}
                            >
                              Inspect day
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell colSpan={3}>
                          {`Reconciled total (${ledgerRows.length} day${ledgerRows.length === 1 ? '' : 's'})`}
                        </TableCell>
                        <TableCell id={`${resolvedIdPrefix}-ledger-total-revenue`}>
                          {fmtMoney(totalLedgerRevenue)}
                        </TableCell>
                        <TableCell id={`${resolvedIdPrefix}-ledger-total-profit`}>
                          {fmtMoney(totalLedgerProfit)}
                        </TableCell>
                        <TableCell>{`${totalLedgerMarginPct.toFixed(1)}%`}</TableCell>
                        <TableCell>{fmtPP(avgLedgerLift)}</TableCell>
                        <TableCell>100% reconciled</TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>

                  <Pagination
                    id={`${resolvedIdPrefix}-ledger-pagination`}
                    density="compact"
                    page={safePage}
                    totalPages={totalPages}
                    totalItems={ledgerRows.length}
                    pageSize={LEDGER_PAGE_SIZE}
                    onPageChange={setLedgerPage}
                  />
                </>
              )}
            </div>
          )}
        </Panel>
      </Scene>

      {/* ===================================================================== C-05: DAILY ATTRIBUTION & EVIDENCE DIALOG */}
      <Dialog
        open={inspectedDay !== null}
        onOpenChange={(open) => {
          if (!open) setInspectedDayKey(null);
        }}
      >
        <DialogContent
          cut="C-05"
          id={`${resolvedIdPrefix}-day-dialog`}
        >
          <DialogHeader>
            <DialogTitle>
              {inspectedDay
                ? `Daily Recovery Attribution · ${inspectedDay.long}`
                : 'Daily Recovery Attribution'}
            </DialogTitle>
            <DialogDescription>
              {inspectedDay
                ? `Reconciled intervention and checkout-segment breakdown for ${inspectedDay.long} (${fmtMoney(inspectedDay.total)} recovered revenue · ${fmtMoney(inspectedDay.profit)} incremental profit · ${fmtPP(inspectedDay.lift)} conversion lift).`
                : 'Daily breakdown.'}
            </DialogDescription>
          </DialogHeader>

          {inspectedDay ? (
            <div className="f12-stack-pair">
              <Notice status="info" title="Operational attribution note">
                {inspectedDay.evidenceNote}
              </Notice>

              <Table density="compact" id={`${resolvedIdPrefix}-day-dialog-table`}>
                <TableCaption>
                  Intervention breakdown for {inspectedDay.long}.
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Intervention</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Recovered</TableHead>
                    <TableHead>Profit</TableHead>
                    <TableHead>Share</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {INTERVENTIONS.map((it) => {
                    const val = inspectedDay.byId[it.id];
                    const prof = inspectedDay.profitById[it.id];
                    const sharePct =
                      inspectedDay.total > 0 ? (val / inspectedDay.total) * 100 : 0;
                    return (
                      <TableRow key={it.id}>
                        <TableCell>
                          <strong>{it.name}</strong>
                        </TableCell>
                        <TableCell>{it.channel}</TableCell>
                        <TableCell>{fmtMoney(val)}</TableCell>
                        <TableCell>{fmtMoney(prof)}</TableCell>
                        <TableCell>{`${sharePct.toFixed(1)}%`}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={2}>{`Day total (${inspectedDay.label})`}</TableCell>
                    <TableCell id={`${resolvedIdPrefix}-day-dialog-total-rev`}>
                      {fmtMoney(inspectedDay.total)}
                    </TableCell>
                    <TableCell id={`${resolvedIdPrefix}-day-dialog-total-profit`}>
                      {fmtMoney(inspectedDay.profit)}
                    </TableCell>
                    <TableCell>100.0%</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>

              <Table density="compact" id={`${resolvedIdPrefix}-day-dialog-segment-table`}>
                <TableCaption>
                  Checkout segment breakdown for {inspectedDay.long}.
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Checkout Segment</TableHead>
                    <TableHead>Recovered</TableHead>
                    <TableHead>Profit</TableHead>
                    <TableHead>Share</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {CHECKOUT_SEGMENTS.map((seg) => {
                    const segRev = inspectedDay.bySegment[seg.id];
                    const segProf = inspectedDay.profitBySegment[seg.id];
                    const segShare =
                      inspectedDay.total > 0 ? (segRev / inspectedDay.total) * 100 : 0;
                    return (
                      <TableRow key={seg.id}>
                        <TableCell>
                          <strong>{seg.shortName}</strong>
                        </TableCell>
                        <TableCell>{fmtMoney(segRev)}</TableCell>
                        <TableCell>{fmtMoney(segProf)}</TableCell>
                        <TableCell>{`${segShare.toFixed(1)}%`}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : null}

          <DialogFooter>
            {inspectedDay ? (
              <Button
                id={`${resolvedIdPrefix}-day-dialog-filter-top`}
                variant="secondary"
                size="sm"
                onClick={() => {
                  const topId = inspectedDay.topInterventionId;
                  const topMeta = INTERVENTIONS.find((it) => it.id === topId);
                  pendingFocusTargetIdRef.current = `${resolvedIdPrefix}-ledger-search`;
                  setFocus(topId);
                  setComparisonMode('intervention');
                  setLedgerPage(1);
                  setInspectedDayKey(null);
                  toast({
                    status: 'info',
                    title: `Scoped to ${topMeta?.name ?? topId}`,
                    description: `Filtered C-01 chart overlay, segment breakdown, and daily ledger to ${topMeta?.name ?? topId}.`,
                  });
                }}
              >
                Filter by top intervention
              </Button>
            ) : null}
            <DialogClose
              id={`${resolvedIdPrefix}-day-dialog-close`}
              variant="primary"
              size="sm"
            >
              Close breakdown
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {footerSlot}
    </Sheet>
  );
}

export function AnalyticsDashboard(props: AnalyticsDashboardProps) {
  const existingToast = useOptionalToast();
  if (existingToast) {
    return <AnalyticsDashboardInner {...props} />;
  }
  return (
    <ToastProvider>
      <AnalyticsDashboardInner {...props} />
    </ToastProvider>
  );
}
export { AnalyticsDashboard as RevenueRecoveryAnalytics };
