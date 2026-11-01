/* Shared dashboard components for both design directions.
   variant: 'conv' (polished conventional) | 'frame' (FRAME/12)
   motion:  'smooth' | 'stepped' | 'cut'                                */
import {
  SUMMARIES, STORE, END_LABEL, RANGES, INTERVENTIONS,
  fmtMoney, fmtMoneyShort, fmtPct, fmtPP, fmtPPAbs, rangeLabel,
} from './data.js';

const { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } = React;

// ---------------------------------------------------------------- hooks
export function useSize(ref) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Layout size (offsetWidth/Height), not the transformed box, so scaled previews draw correctly.
    const measure = () => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      setSize((s) => (s.w === w && s.h === h ? s : { w, h }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return size;
}

export function useReducedMotion() {
  const q = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  const [reduced, setReduced] = useState(q ? q.matches : false);
  useEffect(() => {
    if (!q) return;
    const on = () => setReduced(q.matches);
    q.addEventListener ? q.addEventListener('change', on) : q.addListener(on);
    return () => (q.removeEventListener ? q.removeEventListener('change', on) : q.removeListener(on));
  }, []);
  return reduced;
}

const FRAME_MS = 1000 / 12; // animating "on twos": 12 drawings per second
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

// Progress 0..1 that replays whenever `key` changes. Stepped mode samples the
// same easing curve at 12 poses per second, like a spacing chart.
export function useTween(key, duration, motion) {
  const [p, setP] = useState(1);
  const first = useRef(true);
  useLayoutEffect(() => {
    if (first.current) { first.current = false; return; }
    if (motion === 'cut') { setP(1); return; }
    const start = performance.now();
    const frames = Math.max(2, Math.round(duration / FRAME_MS));
    let raf;
    let last = -1;
    const tick = (now) => {
      const el = now - start;
      let t;
      if (motion === 'stepped') {
        const k = Math.min(frames, Math.floor(el / FRAME_MS) + 1);
        t = k / frames;
      } else {
        t = Math.min(1, el / duration);
      }
      const v = easeOut(t);
      if (v !== last) { last = v; setP(v); }
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    setP(motion === 'stepped' ? easeOut(1 / frames) : 0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [key, motion]);
  return p;
}

function useCountUp(value, motion, duration = 600) {
  const prev = useRef(value);
  const from = useRef(value);
  if (prev.current !== value) { from.current = prev.current; prev.current = value; }
  const p = useTween(value, duration, motion);
  return from.current + (value - from.current) * p;
}

// Becomes true after the first change of `key`, so entrance animations
// never run on first paint (the page is complete at rest).
function useChanged(key) {
  const first = useRef(key);
  const [changed, setChanged] = useState(false);
  useEffect(() => { if (key !== first.current) setChanged(true); }, [key]);
  return changed;
}

// ---------------------------------------------------------------- range control
export function RangeTabs({ value, onChange, variant, idPrefix = 'rng' }) {
  const wrap = useRef(null);
  const [ind, setInd] = useState(null);
  useLayoutEffect(() => {
    const el = wrap.current && wrap.current.querySelector('[aria-pressed="true"]');
    if (!el) return;
    const x = el.offsetLeft + el.clientLeft;
    const w = el.clientWidth;
    setInd((s) => (s && s.x === x && s.w === w ? s : { x, w }));
  });
  // Re-measure when fonts finish loading or the control resizes.
  const [, bump] = useState(0);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => bump((n) => n + 1));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div className="rng" ref={wrap} role="group" aria-label="Date range">
      {ind && <span className="rng-ind" aria-hidden="true" style={{ transform: `translateX(${ind.x}px)`, width: ind.w }} />}
      {RANGES.map((r) => (
        <button
          key={r}
          id={`${idPrefix}-${variant}-${r}`}
          type="button"
          className="rng-btn"
          aria-pressed={value === r}
          onClick={() => onChange(r)}
        >
          {variant === 'frame' ? (
            <><span className="rng-n">{r}</span><span className="rng-u">days</span></>
          ) : (
            `${r} days`
          )}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- delta line
function Delta({ value, kind, range, variant }) {
  // kind: 'pct' | 'pp'
  const flat = kind === 'pp' ? Math.abs(value) < 0.005 : Math.abs(value) < 0.0005;
  const up = value > 0;
  const text = flat ? 'No change' : kind === 'pp' ? fmtPPAbs(value) : fmtPct(value);
  const dir = flat ? 'flat' : up ? 'up' : 'down';
  const sym = flat ? '=' : up ? '▲' : '▼';
  return (
    <p className={`delta ${dir}`}>
      <span className="delta-sym" aria-hidden="true">{sym}</span>
      <span className="sr-only">{flat ? '' : up ? 'Up ' : 'Down '}</span>
      {text}
      <span className="delta-ref"> vs prior {range} days</span>
    </p>
  );
}

// ---------------------------------------------------------------- daily mini chart
function Spark({ days, get, label, range, motion, variant }) {
  const ref = useRef(null);
  const { w } = useSize(ref);
  const p = useTween(range, 600, motion);
  const uid = useMemo(() => 's' + ++chartUid, []);
  const H = 40;
  const vals = days.map(get);
  const max = Math.max(...vals);
  const n = vals.length;
  const gap = n > 40 ? 1 : 2;
  const bw = w ? Math.max(1, (w - gap * (n - 1)) / n) : 0;
  const shownCount = Math.ceil(n * p);
  return (
    <div className="spark" ref={ref}>
      <p className="spark-l">{label}</p>
      {w > 0 && (
        <svg width={w} height={H} role="img" aria-label={`${label}, last ${range} days, one bar per day`}>
          {variant === 'frame' && (
            <defs>
              <pattern id={`${uid}-st`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <circle cx="2" cy="2" r="1.05" className="tone-dot" />
              </pattern>
            </defs>
          )}
          {vals.map((v, i) => (i < shownCount ? (
            <rect key={i} className="spark-bar" fill={variant === 'frame' ? `url(#${uid}-st)` : undefined} x={i * (bw + gap)} y={H - (v / max) * H} width={bw} height={(v / max) * H} />
          ) : null))}
        </svg>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- metric
function Metric({ label, value, format, delta, deltaKind, range, note, variant, motion, big, spark }) {
  const shown = useCountUp(value, motion);
  return (
    <div className={`metric${big ? ' big' : ''}`}>
      <h3 className="m-label">{label}</h3>
      <p className="m-value" aria-live="polite">
        <span className="sr-only">{format(value)}</span>
        <span aria-hidden="true">{format(shown)}</span>
      </p>
      <Delta value={delta} kind={deltaKind} range={range} variant={variant} />
      {note && <p className="m-note">{note}</p>}
      {spark}
    </div>
  );
}

// ---------------------------------------------------------------- chart
function niceStep(max, count) {
  const raw = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * mag;
}

let chartUid = 0;

export function Chart({ summary, focus, variant, motion, height = 260, compact }) {
  const wrap = useRef(null);
  const { w } = useSize(wrap);
  const uid = useMemo(() => 'c' + ++chartUid, []);
  const days = summary.days;
  const n = days.length;
  const focusIt = focus ? INTERVENTIONS.find((i) => i.id === focus) : null;
  const p = useTween(`${summary.range}|${focus || ''}`, 750, motion);
  const [hover, setHover] = useState(null);
  const balloon = useRef(null);
  const [bw, setBw] = useState(0);

  const pad = { l: 46, r: 14, t: variant === 'frame' ? 46 : 34, b: 28 };
  const W = Math.max(0, w);
  const H = height;
  const iw = Math.max(1, W - pad.l - pad.r);
  const ih = H - pad.t - pad.b;
  const maxV = Math.max(...days.map((d) => d.total));
  const step = niceStep(maxV, 4);
  const top = Math.ceil(maxV / step) * step;
  const x = (i) => pad.l + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v) => pad.t + ih - (v / top) * ih;

  const line = (get) => days.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(get(d)).toFixed(1)}`).join('');
  const totalPath = line((d) => d.total);
  const areaPath = `${totalPath}L${x(n - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z`;
  const focusPath = focusIt ? line((d) => d.byId[focusIt.id]) : null;

  const ticks = [];
  for (let v = 0; v <= top + 1e-6; v += step) ticks.push(v);

  const pxPerDay = n > 1 ? iw / (n - 1) : iw;
  const baseEvery = n <= 7 ? 1 : n <= 30 ? 7 : 14;
  const labelEvery = Math.max(baseEvery, Math.ceil(84 / pxPerDay / baseEvery) * baseEvery);
  const xLabels = [];
  for (let i = n - 1; i >= 0; i -= labelEvery) xLabels.push(i);

  const peakI = days.indexOf(summary.peak);
  const px = x(peakI);
  const py = y(summary.peak.total);

  useLayoutEffect(() => {
    if (balloon.current) setBw(balloon.current.offsetWidth);
  });

  const onMove = (e) => {
    const r = wrap.current.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const i = Math.round(((mx - pad.l) / iw) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };
  const onKey = (e) => {
    if (e.key === 'ArrowRight') { setHover((h) => Math.min(n - 1, h == null ? n - 1 : h + 1)); e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { setHover((h) => Math.max(0, h == null ? n - 1 : h - 1)); e.preventDefault(); }
    else if (e.key === 'Escape') setHover(null);
  };

  const clipW = pad.l + iw * p + 2;
  const hd = hover != null ? days[hover] : null;
  const peakText = `Peak ${summary.peak.label} · ${fmtMoney(summary.peak.total)}`;
  const bLeft = W ? Math.min(Math.max(px - bw / 2, pad.l), W - pad.r - bw) : 0;
  const tailX = Math.min(Math.max(px, bLeft + 14), bLeft + bw - 14);
  const bTop = 6;
  const bH = 28;
  const showPeak = p >= 0.999 && hover == null;

  return (
    <div className="chart" ref={wrap} style={{ height: H }}>
      {W > 0 && (
        <svg
          width={W}
          height={H}
          className="chart-svg"
          role="img"
          aria-label={`Daily recovered revenue, last ${summary.range} days. Peak ${summary.peak.long}, ${fmtMoney(summary.peak.total)}.`}
          tabIndex={0}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          onKeyDown={onKey}
          onBlur={() => setHover(null)}
        >
          <defs>
            <clipPath id={`${uid}-clip`}><rect x="0" y="0" width={clipW} height={H} /></clipPath>
            {variant === 'frame' ? (
              <>
                <pattern id={`${uid}-tone`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <circle cx="2.5" cy="2.5" r="1.15" className="tone-dot" />
                </pattern>
                <linearGradient id={`${uid}-fade`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#fff" stopOpacity="1" />
                  <stop offset="1" stopColor="#fff" stopOpacity="0.25" />
                </linearGradient>
                <mask id={`${uid}-mask`} maskUnits="userSpaceOnUse" x="0" y={pad.t} width={W} height={ih}>
                  <rect x="0" y={pad.t} width={W} height={ih} fill={`url(#${uid}-fade)`} />
                </mask>
              </>
            ) : (
              <linearGradient id={`${uid}-grad`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" className="grad-a" />
                <stop offset="1" className="grad-b" />
              </linearGradient>
            )}
          </defs>

          {ticks.map((v) => (
            <g key={v} className="ytick">
              <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className={v === 0 ? 'baseline' : 'grid'} />
              <text x={pad.l - 8} y={y(v)} dy="0.35em" textAnchor="end">{fmtMoneyShort(v)}</text>
            </g>
          ))}

          {variant === 'frame' && (
            <g className="sheet-ticks" aria-hidden="true">
              {days.map((d, i) => (n <= 30 || i % 3 === 0) && (
                <line key={i} x1={x(i)} x2={x(i)} y1={y(0)} y2={y(0) + (xLabels.includes(i) ? 7 : 3.5)} />
              ))}
            </g>
          )}
          {xLabels.map((i) => (
            <text key={i} className="xlab" x={x(i)} y={H - 8} textAnchor={i === n - 1 ? 'end' : i === 0 ? 'start' : 'middle'}>
              {days[i].label}
            </text>
          ))}

          <g clipPath={`url(#${uid}-clip)`}>
            {variant === 'frame' ? (
              <path d={areaPath} fill={`url(#${uid}-tone)`} mask={`url(#${uid}-mask)`} />
            ) : (
              <path d={areaPath} fill={`url(#${uid}-grad)`} />
            )}
            <path d={totalPath} className="l-total" fill="none" />
            {focusPath && <path d={focusPath} className="l-focus" fill="none" />}
          </g>

          {showPeak && (
            variant === 'frame' ? (
              <path
                className="tail"
                d={`M${tailX - 6},${bTop + bH - 1} L${px - (px - tailX) * 0.15},${py - 7} L${tailX + 6},${bTop + bH - 1}`}
              />
            ) : (
              <g className="peak-mark"><circle cx={px} cy={py} r="4.5" /></g>
            )
          )}
          {variant === 'frame' && showPeak && <circle className="peak-dot" cx={px} cy={py} r="4" />}

          {hd && (
            <g className="cross" aria-hidden="true">
              <line x1={x(hover)} x2={x(hover)} y1={pad.t - 4} y2={y(0)} />
              <circle cx={x(hover)} cy={y(hd.total)} r="4.5" className="cross-dot" />
              {focusIt && <circle cx={x(hover)} cy={y(hd.byId[focusIt.id])} r="4" className="cross-dot2" />}
            </g>
          )}
        </svg>
      )}

      {W > 0 && showPeak && (
        <div
          ref={balloon}
          className={variant === 'frame' ? 'balloon' : 'peak-pill'}
          style={variant === 'frame' ? { left: bLeft, top: bTop, height: bH } : { left: bLeft, top: Math.max(2, py - 34) }}
          aria-hidden="true"
        >
          {variant === 'frame' && <span className="balloon-gap" style={{ left: tailX - bLeft - 5 }} />}
          {peakText}
        </div>
      )}

      {hd && (
        <div
          className="tip"
          role="status"
          style={{ left: Math.min(Math.max(x(hover) - 80, 4), W - 164), top: 4 }}
        >
          <strong>{hd.long}</strong>
          <span><i className="sw sw-total" aria-hidden="true" />Total {fmtMoney(hd.total)}</span>
          {focusIt && <span><i className="sw sw-focus" aria-hidden="true" />{focusIt.name} {fmtMoney(hd.byId[focusIt.id])}</span>}
        </div>
      )}
    </div>
  );
}

function ChartTable({ summary, focus }) {
  const focusIt = focus ? INTERVENTIONS.find((i) => i.id === focus) : null;
  return (
    <details className="tbl">
      <summary>Show data table</summary>
      <div className="tbl-scroll">
        <table>
          <thead>
            <tr><th scope="col">Date</th><th scope="col">Recovered revenue</th>{focusIt && <th scope="col">{focusIt.name}</th>}</tr>
          </thead>
          <tbody>
            {summary.days.slice().reverse().map((d) => (
              <tr key={d.ms}><td>{d.long}</td><td>{fmtMoney(d.total)}</td>{focusIt && <td>{fmtMoney(d.byId[focusIt.id])}</td>}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

// ---------------------------------------------------------------- legend
function Legend({ focus }) {
  const it = focus ? INTERVENTIONS.find((i) => i.id === focus) : null;
  if (!it) return <p className="legend legend-hint">Select an intervention to compare it with the total.</p>;
  return (
    <ul className="legend" aria-label="Chart legend">
      <li><i className="sw sw-total" aria-hidden="true" />All interventions</li>
      <li><i className="sw sw-focus" aria-hidden="true" />{it.name}</li>
    </ul>
  );
}

// ---------------------------------------------------------------- intervention rows
function Burst() {
  // Impact lines behind a badge, drawn for two frames (FRAME/12 only).
  const lines = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const r1 = 15 + (i % 2) * 3;
    const r2 = 25 + (i % 3) * 3;
    lines.push(<line key={i} x1={30 + Math.cos(a) * r1 * 1.9} y1={14 + Math.sin(a) * r1 * 0.75} x2={30 + Math.cos(a) * r2 * 1.9} y2={14 + Math.sin(a) * r2 * 0.75} />);
  }
  return <svg className="burst" viewBox="-20 -12 100 52" aria-hidden="true">{lines}</svg>;
}

export function Interventions({ summary, focus, onFocus, variant, motion, changed, idPrefix = '' }) {
  const max = summary.rows[0].value;
  return (
    <div className="ints">
      <div className="ints-hd">
        <h3 className="m-label">Revenue by intervention</h3>
        <p className="ints-sub">Last {summary.range} days · share of recovered revenue</p>
      </div>
      <ul className={`ints-list${changed ? ' enter' : ''}`} key={summary.range}>
        {summary.rows.map((r, i) => {
          const on = focus === r.id;
          return (
            <li key={r.id}>
              <button
                type="button"
                id={idPrefix ? `int-${idPrefix}-${r.id}` : `int-${variant}-${r.id}`}
                className="int-row"
                aria-pressed={on}
                onClick={() => onFocus(on ? null : r.id)}
              >
                <span className="int-name">
                  {r.name}
                  {i === 0 && (
                    <span className={`badge${changed ? ' pop' : ''}`} key={`${summary.range}-${r.id}`}>
                      {variant === 'frame' && <Burst />}
                      <span className="badge-t">Top performer</span>
                    </span>
                  )}
                </span>
                <span className="int-bar" aria-hidden="true">
                  <span className="int-fill" style={{ width: `${(r.value / max) * 100}%` }} />
                </span>
                <span className="int-val">
                  {fmtMoney(r.value)}
                  <span className="int-share">{(r.share * 100).toFixed(0)}%</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------- FRAME/12 panel
export function Panel({ cut, shape = 'rect', className = '', label, children }) {
  const ref = useRef(null);
  const { w, h } = useSize(ref);
  const s = 1.25; // half stroke
  const d = 16; // slant rise in px
  let pts;
  if (shape === 'slant-bottom') pts = `${s},${s} ${w - s},${s} ${w - s},${h - s - d} ${s},${h - s}`;
  else if (shape === 'slant-top') pts = `${s},${s + d} ${w - s},${s} ${w - s},${h - s} ${s},${h - s}`;
  else pts = `${s},${s} ${w - s},${s} ${w - s},${h - s} ${s},${h - s}`;
  return (
    <section ref={ref} className={`panel ${shape} ${className}`} aria-label={label}>
      {w > 0 && (
        <svg className="panel-frame" width={w} height={h} aria-hidden="true"><polygon points={pts} /></svg>
      )}
      {cut && <span className="cut" aria-hidden="true">{cut}</span>}
      <div className="panel-body">{children}</div>
    </section>
  );
}

function Pegs() {
  return (
    <div className="pegs" aria-hidden="true">
      <span className="peg slot" /><span className="peg round" /><span className="peg slot" />
    </div>
  );
}

// ---------------------------------------------------------------- dashboards
const PROFIT_NOTE = 'Margin on recovered orders, after offer costs';
const LIFT_NOTE = 'Checkout conversion vs. holdout group';

export function Dashboard({ variant, motion, range, setRange, focus, setFocus, idPrefix = 'd' }) {
  const s = SUMMARIES[range];
  const changed = useChanged(range);
  const reduced = useReducedMotion();
  const m = reduced ? 'cut' : motion;
  const wrap = useRef(null);
  const { w } = useSize(wrap);
  const narrow = w > 0 && w < 760;
  const chartH = narrow ? 220 : variant === 'frame' ? 330 : 260;

  const header = (
    <header className="hd">
      <div className="hd-text">
        <p className="eyebrow">{STORE}<span className="tag">Example data</span></p>
        <h2 className="title">Revenue recovery</h2>
        <p className="sub">Through {END_LABEL}</p>
      </div>
      <RangeTabs value={range} onChange={setRange} variant={variant} idPrefix={idPrefix} />
    </header>
  );

  const revenue = (
    <Metric label="Recovered revenue" value={s.revenue} format={fmtMoney} delta={s.revenueDelta} deltaKind="pct" range={range} variant={variant} motion={m} big={variant === 'frame'} />
  );
  const profit = (
    <Metric
      label="Incremental profit" value={s.profit} format={fmtMoney} delta={s.profitDelta} deltaKind="pct" range={range} note={PROFIT_NOTE} variant={variant} motion={m}
      spark={<Spark days={s.days} get={(d) => d.profit} label="Daily profit" range={range} motion={m} variant={variant} />}
    />
  );
  const lift = (
    <Metric
      label="Conversion lift" value={s.lift} format={fmtPP} delta={s.liftDelta} deltaKind="pp" range={range} note={LIFT_NOTE} variant={variant} motion={m}
      spark={<Spark days={s.days} get={(d) => d.lift} label="Daily lift" range={range} motion={m} variant={variant} />}
    />
  );
  const chart = <Chart summary={s} focus={focus} variant={variant} motion={m} height={chartH} />;
  const ints = <Interventions summary={s} focus={focus} onFocus={setFocus} variant={variant} motion={m} changed={changed} idPrefix={idPrefix} />;

  if (variant === 'conv') {
    return (
      <div ref={wrap} className={`dash conv m-${m}`}>
        {header}
        <div className="kpis">
          <div className="card">{revenue}</div>
          <div className="card">{profit}</div>
          <div className="card">{lift}</div>
        </div>
        <div className="main">
          <section className="card chart-card" aria-label="Recovered revenue over time">
            <div className="card-hd">
              <h3 className="m-label">Daily recovered revenue</h3>
              <Legend focus={focus} />
            </div>
            {chart}
            <ChartTable summary={s} focus={focus} />
          </section>
          <section className="card" aria-label="Revenue by intervention">{ints}</section>
        </div>
      </div>
    );
  }

  return (
    <div ref={wrap} className={`dash frame m-${m}`}>
      <div className="sheet">
        <Pegs />
        {header}
        <div className="scene">
          <Panel cut="C-01" className="c01" label="Recovered revenue over time">
            <div className="c01-hd">
              {revenue}
              <Legend focus={focus} />
            </div>
            {chart}
            <ChartTable summary={s} focus={focus} />
          </Panel>
          <div className="pair">
            <Panel cut="C-02" shape="slant-bottom" className="c02" label="Incremental profit">{profit}</Panel>
            <Panel cut="C-03" shape="slant-top" className="c03" label="Conversion lift">{lift}</Panel>
          </div>
        </div>
        <Panel cut="C-04" className="c04" label="Revenue by intervention">{ints}</Panel>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- motion stage (study)
// A small FRAME/12 scene that isolates one interaction for the motion comparison.
export function MotionStage({ kind, motion, playKey, idPrefix }) {
  const [range, setRange] = useState(30);
  const seq = useRef([]);
  useEffect(() => {
    if (!playKey) return;
    seq.current.forEach(clearTimeout);
    const order = [7, 90, 30];
    seq.current = order.map((r, i) => setTimeout(() => setRange(r), 150 + i * 1100));
    return () => seq.current.forEach(clearTimeout);
  }, [playKey]);
  const s = SUMMARIES[range];
  const changed = useChanged(range);
  return (
    <div className={`dash frame stage m-${motion}`}>
      <div className="sheet stage-sheet">
        <div className="stage-hd">
          <RangeTabs value={range} onChange={setRange} variant="frame" idPrefix={idPrefix} />
        </div>
        <Panel className="stage-panel">
          {kind === 'tabs' && (
            <Metric label="Recovered revenue" value={s.revenue} format={fmtMoney} delta={s.revenueDelta} deltaKind="pct" range={range} variant="frame" motion={motion} big />
          )}
          {kind === 'chart' && <Chart summary={s} focus={null} variant="frame" motion={motion} height={200} />}
          {kind === 'badge' && (
            <Interventions
              summary={{ ...s, rows: s.rows.slice(0, 3) }}
              focus={null}
              onFocus={() => {}}
              variant="frame"
              motion={motion}
              changed={changed}
              idPrefix={idPrefix}
            />
          )}
        </Panel>
      </div>
    </div>
  );
}
