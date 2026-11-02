// Deterministic e-commerce recovery dataset for Fernwood Supply Co.
// Ported identically from lab/src/data.js (mulberry32 seed 1207).

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

export interface InterventionMeta {
  id: string;
  name: string;
  base: number;
  trend: number;
  margin: number;
}

export const INTERVENTIONS: InterventionMeta[] = [
  { id: 'cart', name: 'Abandoned-cart email', base: 1150, trend: 0.15, margin: 0.38 },
  { id: 'exit', name: 'Exit-intent offer', base: 700, trend: 0.25, margin: 0.22 },
  { id: 'stock', name: 'Back-in-stock alert', base: 520, trend: 0.05, margin: 0.41 },
  { id: 'price', name: 'Price-drop notice', base: 430, trend: -0.1, margin: 0.18 },
  { id: 'upsell', name: 'Post-purchase upsell', base: 300, trend: 0.3, margin: 0.46 },
];

export interface DayDatum {
  ms: number;
  label: string;
  long: string;
  total: number;
  byId: Record<string, number>;
  profit: number;
  lift: number;
}

export interface InterventionRow {
  id: string;
  name: string;
  value: number;
  share: number;
}

export interface RangeSummary {
  range: RangeDays;
  days: DayDatum[];
  revenue: number;
  revenueDelta: number;
  profit: number;
  profitDelta: number;
  lift: number;
  liftDelta: number;
  rows: InterventionRow[];
  leader: string;
  peak: DayDatum;
}

const DAYS = 180;
const END = Date.UTC(2026, 9, 31);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function buildDays(): DayDatum[] {
  const rnd = mulberry32(1207);
  const weekly = [1.16, 0.93, 0.95, 0.97, 1.02, 1.12, 1.2]; // Sun..Sat
  const out: DayDatum[] = [];
  for (let t = 0; t < DAYS; t++) {
    const ms = END - (DAYS - 1 - t) * 864e5;
    const d = new Date(ms);
    const wk = weekly[d.getUTCDay()];
    const byId: Record<string, number> = {};
    let total = 0;
    let profit = 0;
    for (const it of INTERVENTIONS) {
      const trend = 1 + it.trend * (t / (DAYS - 1));
      const noise = 1 + (rnd() - 0.5) * 0.36;
      const boost = it.id === 'exit' && t >= DAYS - 9 ? 2.05 : 1;
      const v = Math.round(it.base * trend * wk * noise * boost);
      byId[it.id] = v;
      total += v;
      profit += v * it.margin;
    }
    let lift = 0.48 + 0.1 * (t / (DAYS - 1)) + (rnd() - 0.5) * 0.12;
    if (t >= DAYS - 7) lift -= 0.09;
    out.push({
      ms,
      label: `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`,
      long: `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`,
      total,
      byId,
      profit: Math.round(profit),
      lift,
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
  const rows: InterventionRow[] = INTERVENTIONS.map((it) => ({
    id: it.id,
    name: it.name,
    value: sum(cur, (d) => d.byId[it.id]),
    share: 0,
  }))
    .map((r) => ({ ...r, share: r.value / revenue }))
    .sort((a, b) => b.value - a.value);
  let peak = cur[0];
  for (const d of cur) if (d.total > peak.total) peak = d;
  return {
    range,
    days: cur,
    revenue,
    revenueDelta: (revenue - prevRevenue) / prevRevenue,
    profit,
    profitDelta: (profit - prevProfit) / prevProfit,
    lift,
    liftDelta: lift - prevLift,
    rows,
    leader: rows[0].id,
    peak,
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
export const fmtPP = (v: number): string => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2) + ' pp';
export const fmtPPAbs = (v: number): string => Math.abs(v).toFixed(2) + ' pp';
export const rangeLabel = (r: number): string => `${r} days`;
