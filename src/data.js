// Fictional e-commerce recovery data for Fernwood Supply Co.
// Deterministic (seeded) so every participant and every task sees identical numbers.

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const STORE = 'Fernwood Supply Co.';
export const END_LABEL = 'Oct 31, 2026';
export const RANGES = [7, 30, 90];
export const DEFAULT_RANGE = 30;

export const INTERVENTIONS = [
  { id: 'cart', name: 'Abandoned-cart email', base: 1150, trend: 0.15, margin: 0.38 },
  { id: 'exit', name: 'Exit-intent offer', base: 700, trend: 0.25, margin: 0.22 },
  { id: 'stock', name: 'Back-in-stock alert', base: 520, trend: 0.05, margin: 0.41 },
  { id: 'price', name: 'Price-drop notice', base: 430, trend: -0.1, margin: 0.18 },
  { id: 'upsell', name: 'Post-purchase upsell', base: 300, trend: 0.3, margin: 0.46 },
];

const DAYS = 180;
const END = Date.UTC(2026, 9, 31);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function buildDays() {
  const rnd = mulberry32(1207);
  const weekly = [1.16, 0.93, 0.95, 0.97, 1.02, 1.12, 1.2]; // Sun..Sat
  const out = [];
  for (let t = 0; t < DAYS; t++) {
    const ms = END - (DAYS - 1 - t) * 864e5;
    const d = new Date(ms);
    const wk = weekly[d.getUTCDay()];
    const byId = {};
    let total = 0;
    let profit = 0;
    for (const it of INTERVENTIONS) {
      const trend = 1 + it.trend * (t / (DAYS - 1));
      const noise = 1 + (rnd() - 0.5) * 0.36;
      // A short exit-intent campaign in the final nine days.
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

export const DAYS_DATA = buildDays();

function sum(a, f) { let s = 0; for (const x of a) s += f(x); return s; }

export function summarize(range) {
  const cur = DAYS_DATA.slice(DAYS - range);
  const prev = DAYS_DATA.slice(DAYS - 2 * range, DAYS - range);
  const revenue = sum(cur, (d) => d.total);
  const prevRevenue = sum(prev, (d) => d.total);
  const profit = sum(cur, (d) => d.profit);
  const prevProfit = sum(prev, (d) => d.profit);
  const lift = sum(cur, (d) => d.lift) / cur.length;
  const prevLift = sum(prev, (d) => d.lift) / prev.length;
  const rows = INTERVENTIONS.map((it) => ({
    id: it.id,
    name: it.name,
    value: sum(cur, (d) => d.byId[it.id]),
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

export const SUMMARIES = Object.fromEntries(RANGES.map((r) => [r, summarize(r)]));

// ---------- formatting ----------
export const fmtMoney = (v) => '$' + Math.round(v).toLocaleString('en-US');
export const fmtMoneyShort = (v) => {
  if (Math.abs(v) >= 1000) {
    const k = v / 1000;
    return '$' + (Number.isInteger(k) ? k.toFixed(0) : k.toFixed(1)) + 'k';
  }
  return '$' + Math.round(v);
};
export const fmtPct = (v) => (Math.abs(v) * 100).toFixed(1) + '%';
export const fmtPP = (v) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2) + ' pp';
export const fmtPPAbs = (v) => Math.abs(v).toFixed(2) + ' pp';
export const rangeLabel = (r) => `${r} days`;

// ---------- study tasks (answers computed from the same data) ----------
export function buildTaskSets() {
  const s7 = SUMMARIES[7];
  const s30 = SUMMARIES[30];
  const s90 = SUMMARIES[90];
  const names = INTERVENTIONS.map((i) => i.name);
  const dir = (v, tol) => (Math.abs(v) < tol ? 'About the same' : v > 0 ? 'Up' : 'Down');
  const A = [
    {
      id: 'A1',
      kind: 'rank',
      prompt: 'In the last 7 days, which intervention recovered the most revenue?',
      options: names,
      answer: s7.rows[0].name,
    },
    {
      id: 'A2',
      kind: 'value',
      prompt: 'What was incremental profit over the last 90 days?',
      options: [s90.profit, s30.profit, s90.profit * 1.17, s90.profit * 0.84].map(fmtMoney),
      answer: fmtMoney(s90.profit),
    },
    {
      id: 'A3',
      kind: 'trend',
      prompt: 'Over the last 7 days, did conversion lift go up or down compared with the 7 days before?',
      options: ['Up', 'Down', 'About the same'],
      answer: dir(s7.liftDelta, 0.01),
    },
  ];
  const B = [
    {
      id: 'B1',
      kind: 'rank',
      prompt: 'In the last 90 days, which intervention recovered the least revenue?',
      options: names,
      answer: s90.rows[s90.rows.length - 1].name,
    },
    {
      id: 'B2',
      kind: 'value',
      prompt: 'What was total recovered revenue over the last 7 days?',
      options: [s7.revenue, s30.revenue, s7.revenue * 1.19, s7.revenue * 0.83].map(fmtMoney),
      answer: fmtMoney(s7.revenue),
    },
    {
      id: 'B3',
      kind: 'trend',
      prompt: 'Over the last 90 days, did incremental profit go up or down compared with the 90 days before?',
      options: ['Up', 'Down', 'About the same'],
      answer: dir(s90.profitDelta, 0.01),
    },
  ];
  return { A, B };
}
