'use client';

import * as React from 'react';
import { type MotionMode, useOnTwos, useSize } from '@/hooks/use-on-twos';

export interface ToneAreaDatum {
  label: string;
  longLabel?: string;
  value: number;
  compareValue?: number;
}

export interface ToneAreaAnnotation {
  index: number;
  text: string;
}

export interface ToneAreaChartProps {
  data: ToneAreaDatum[];
  seriesLabel?: string;
  compareLabel?: string;
  formatValue?: (v: number) => string;
  formatShort?: (v: number) => string;
  annotation?: ToneAreaAnnotation | null;
  motion?: MotionMode;
  height?: number;
  tableSummary?: string;
  showTable?: boolean;
  ariaLabel?: string;
  className?: string;
}

function defaultFormatValue(v: number): string {
  return '$' + Math.round(v).toLocaleString('en-US');
}

function defaultFormatShort(v: number): string {
  if (Math.abs(v) >= 1000) {
    const k = v / 1000;
    return '$' + (Number.isInteger(k) ? k.toFixed(0) : k.toFixed(1)) + 'k';
  }
  return '$' + Math.round(v);
}

function niceStep(max: number, count: number): number {
  if (max <= 0) return 1;
  const raw = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * mag;
}

const useIsoLayoutEffect = typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;

export function ToneAreaChart({
  data,
  seriesLabel = 'Recovered revenue',
  compareLabel,
  formatValue = defaultFormatValue,
  formatShort = defaultFormatShort,
  annotation,
  motion = 'stepped',
  height = 260,
  tableSummary = 'Show data table',
  showTable = true,
  ariaLabel,
  className = '',
}: ToneAreaChartProps) {
  const wrap = React.useRef<HTMLDivElement | null>(null);
  const { w } = useSize(wrap);
  const rawId = React.useId();
  const uid = React.useMemo(() => 'c-' + rawId.replace(/:/g, ''), [rawId]);

  const n = data.length;
  const hasCompare = Boolean(compareLabel) && data.some((d) => d.compareValue != null);
  const tweenKey = `${n}|${data[0]?.label ?? ''}|${data[n - 1]?.value ?? ''}|${compareLabel ?? ''}`;
  const p = useOnTwos(tweenKey, 750, motion);
  const [hover, setHover] = React.useState<number | null>(null);
  const balloon = React.useRef<HTMLDivElement | null>(null);
  const [bw, setBw] = React.useState<number>(0);

  const pad = { l: 46, r: 14, t: 46, b: 28 };
  const W = Math.max(0, w);
  const H = height;
  const iw = Math.max(1, W - pad.l - pad.r);
  const ih = Math.max(1, H - pad.t - pad.b);
  const maxV = Math.max(1, ...data.map((d) => d.value));
  const step = niceStep(maxV, 4);
  const top = Math.ceil(maxV / step) * step;
  const x = (i: number) => pad.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => pad.t + ih - (v / top) * ih;

  const line = (get: (d: ToneAreaDatum) => number) =>
    data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(get(d)).toFixed(1)}`).join('');

  const totalPath = n > 0 ? line((d) => d.value) : '';
  const areaPath =
    n > 0 ? `${totalPath}L${x(n - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z` : '';
  const focusPath = hasCompare && n > 0 ? line((d) => d.compareValue ?? 0) : null;

  const ticks: number[] = [];
  for (let v = 0; v <= top + 1e-6; v += step) ticks.push(v);

  const pxPerDay = n > 1 ? iw / (n - 1) : iw;
  const baseEvery = n <= 7 ? 1 : n <= 30 ? 7 : 14;
  const labelEvery = Math.max(baseEvery, Math.ceil(84 / pxPerDay / baseEvery) * baseEvery);
  const xLabels: number[] = [];
  for (let i = n - 1; i >= 0; i -= labelEvery) xLabels.push(i);

  const resolvedAnnotation = React.useMemo<ToneAreaAnnotation | null>(() => {
    if (annotation === null || n === 0) return null;
    if (annotation !== undefined) {
      const idx = Math.max(0, Math.min(n - 1, annotation.index));
      return { index: idx, text: annotation.text };
    }
    let peakI = 0;
    for (let i = 1; i < n; i++) {
      if (data[i].value > data[peakI].value) peakI = i;
    }
    const pk = data[peakI];
    return {
      index: peakI,
      text: `Peak ${pk.label} · ${formatValue(pk.value)}`,
    };
  }, [annotation, data, formatValue, n]);

  const peakI = resolvedAnnotation ? resolvedAnnotation.index : 0;
  const peakPoint = data[peakI];
  const px = peakPoint ? x(peakI) : 0;
  const py = peakPoint ? y(peakPoint.value) : 0;

  useIsoLayoutEffect(() => {
    if (balloon.current) setBw(balloon.current.offsetWidth);
  });

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!wrap.current || n === 0) return;
    const r = wrap.current.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const i = Math.round(((mx - pad.l) / iw) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  const onKey = (e: React.KeyboardEvent<SVGSVGElement>) => {
    if (n === 0) return;
    if (e.key === 'ArrowRight') {
      setHover((h) => Math.min(n - 1, h == null ? n - 1 : h + 1));
      e.preventDefault();
    } else if (e.key === 'ArrowLeft') {
      setHover((h) => Math.max(0, h == null ? n - 1 : h - 1));
      e.preventDefault();
    } else if (e.key === 'Escape') {
      setHover(null);
    }
  };

  const clipW = pad.l + iw * p + 2;
  const hd = hover != null && data[hover] ? data[hover] : null;
  const bLeft = W ? Math.min(Math.max(px - bw / 2, pad.l), W - pad.r - bw) : 0;
  const tailX = Math.min(Math.max(px, bLeft + 14), bLeft + bw - 14);
  const bTop = 6;
  const bH = 28;
  const showPeak = p >= 0.999 && hover == null && resolvedAnnotation != null;

  const computedAriaLabel =
    ariaLabel ??
    `${seriesLabel}, ${n} points.${
      peakPoint
        ? ` Peak ${peakPoint.longLabel ?? peakPoint.label}, ${formatValue(peakPoint.value)}.`
        : ''
    }`;

  return (
    <div className={`tone-area-chart${className ? ` ${className}` : ''}`}>
      <div className="chart" ref={wrap} style={{ height: H }}>
        {W > 0 && n > 0 && (
          <svg
            width={W}
            height={H}
            className="chart-svg"
            role="img"
            aria-label={computedAriaLabel}
            tabIndex={0}
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
            onKeyDown={onKey}
            onBlur={() => setHover(null)}
          >
            <defs>
              <clipPath id={`${uid}-clip`}>
                <rect x="0" y="0" width={clipW} height={H} />
              </clipPath>
              <pattern
                id={`${uid}-tone`}
                width="5"
                height="5"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <circle cx="2.5" cy="2.5" r="1.15" className="tone-dot" />
              </pattern>
              <linearGradient id={`${uid}-fade`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#fff" stopOpacity="1" />
                <stop offset="1" stopColor="#fff" stopOpacity="0.25" />
              </linearGradient>
              <mask
                id={`${uid}-mask`}
                maskUnits="userSpaceOnUse"
                x="0"
                y={pad.t}
                width={W}
                height={ih}
              >
                <rect x="0" y={pad.t} width={W} height={ih} fill={`url(#${uid}-fade)`} />
              </mask>
            </defs>

            {ticks.map((v) => (
              <g key={v} className="ytick">
                <line
                  x1={pad.l}
                  x2={W - pad.r}
                  y1={y(v)}
                  y2={y(v)}
                  className={v === 0 ? 'baseline' : 'grid'}
                />
                <text x={pad.l - 8} y={y(v)} dy="0.35em" textAnchor="end">
                  {formatShort(v)}
                </text>
              </g>
            ))}

            <g className="sheet-ticks" aria-hidden="true">
              {data.map(
                (_, i) =>
                  (n <= 30 || i % 3 === 0) && (
                    <line
                      key={i}
                      x1={x(i)}
                      x2={x(i)}
                      y1={y(0)}
                      y2={y(0) + (xLabels.includes(i) ? 7 : 3.5)}
                    />
                  ),
              )}
            </g>

            {xLabels.map((i) => (
              <text
                key={i}
                className="xlab"
                x={x(i)}
                y={H - 8}
                textAnchor={i === n - 1 ? 'end' : i === 0 ? 'start' : 'middle'}
              >
                {data[i].label}
              </text>
            ))}

            <g clipPath={`url(#${uid}-clip)`}>
              <path d={areaPath} fill={`url(#${uid}-tone)`} mask={`url(#${uid}-mask)`} />
              <path d={totalPath} className="l-total" fill="none" />
              {focusPath && <path d={focusPath} className="l-focus" fill="none" />}
            </g>

            {showPeak && resolvedAnnotation && (
              <>
                <path
                  className="tail"
                  d={`M${tailX - 6},${bTop + bH - 1} L${px - (px - tailX) * 0.15},${py - 7} L${tailX + 6},${bTop + bH - 1}`}
                />
                <circle className="peak-dot" cx={px} cy={py} r="4" />
              </>
            )}

            {hd && hover != null && (
              <g className="cross" aria-hidden="true">
                <line x1={x(hover)} x2={x(hover)} y1={pad.t - 4} y2={y(0)} />
                <circle cx={x(hover)} cy={y(hd.value)} r="4.5" className="cross-dot" />
                {hasCompare && hd.compareValue != null && (
                  <circle cx={x(hover)} cy={y(hd.compareValue)} r="4" className="cross-dot2" />
                )}
              </g>
            )}
          </svg>
        )}

        {W > 0 && showPeak && resolvedAnnotation && (
          <div
            ref={balloon}
            className="balloon"
            style={{ left: bLeft, top: bTop, height: bH }}
            aria-hidden="true"
          >
            <span className="balloon-gap" style={{ left: tailX - bLeft - 5 }} />
            {resolvedAnnotation.text}
          </div>
        )}

        {hd && hover != null && (
          <div
            className="tip"
            role="status"
            style={{ left: Math.min(Math.max(x(hover) - 80, 4), W - 164), top: 4 }}
          >
            <strong>{hd.longLabel ?? hd.label}</strong>
            <span>
              <i className="sw sw-total" aria-hidden="true" />
              {seriesLabel} {formatValue(hd.value)}
            </span>
            {hasCompare && hd.compareValue != null && (
              <span>
                <i className="sw sw-focus" aria-hidden="true" />
                {compareLabel} {formatValue(hd.compareValue)}
              </span>
            )}
          </div>
        )}
      </div>

      {showTable && (
        <details className="tbl">
          <summary>{tableSummary}</summary>
          <div className="tbl-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">{seriesLabel}</th>
                  {hasCompare && <th scope="col">{compareLabel}</th>}
                </tr>
              </thead>
              <tbody>
                {data
                  .slice()
                  .reverse()
                  .map((d, idx) => (
                    <tr key={`${d.label}-${idx}`}>
                      <td>{d.longLabel ?? d.label}</td>
                      <td>{formatValue(d.value)}</td>
                      {hasCompare && <td>{formatValue(d.compareValue ?? 0)}</td>}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
