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
  labelColumnHeader?: string;
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

export function defaultFormatValue(v: number): string {
  const safe = Number.isFinite(v) ? v : 0;
  return Math.round(safe).toLocaleString('en-US');
}

export function defaultFormatShort(v: number): string {
  const safe = Number.isFinite(v) ? v : 0;
  if (Math.abs(safe) >= 1000) {
    const k = safe / 1000;
    return (Number.isInteger(k) ? k.toFixed(0) : k.toFixed(1)) + 'k';
  }
  return String(Math.round(safe));
}

export function fmtCurrency(v: number): string {
  const safe = Number.isFinite(v) ? v : 0;
  const sign = safe < 0 ? '-' : '';
  return sign + '$' + Math.round(Math.abs(safe)).toLocaleString('en-US');
}

export function fmtCurrencyShort(v: number): string {
  const safe = Number.isFinite(v) ? v : 0;
  const sign = safe < 0 ? '-' : '';
  const abs = Math.abs(safe);
  if (abs >= 1000) {
    const k = abs / 1000;
    return sign + '$' + (Number.isInteger(k) ? k.toFixed(0) : k.toFixed(1)) + 'k';
  }
  return sign + '$' + Math.round(abs);
}

function niceStep(span: number, count: number): number {
  if (!Number.isFinite(span) || span <= 0) return 1;
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * mag;
}

const TONE_BAND_RADII = [1.25, 1.05, 0.85, 0.62] as const;

const useIsoLayoutEffect = typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;

export function ToneAreaChart({
  data,
  seriesLabel = 'Value',
  compareLabel,
  labelColumnHeader = 'Label',
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

  const safeData = React.useMemo<ToneAreaDatum[]>(
    () =>
      data.map((d) => ({
        ...d,
        value: Number.isFinite(d.value) ? d.value : 0,
        compareValue:
          d.compareValue != null && Number.isFinite(d.compareValue) ? d.compareValue : undefined,
      })),
    [data],
  );

  const n = safeData.length;
  const hasCompare = Boolean(compareLabel) && safeData.some((d) => d.compareValue != null);
  const tweenKey = `${n}|${safeData[0]?.label ?? ''}|${safeData[n - 1]?.value ?? ''}|${compareLabel ?? ''}`;
  const p = useOnTwos(tweenKey, 750, motion);
  const [hover, setHover] = React.useState<number | null>(null);
  const balloon = React.useRef<HTMLDivElement | null>(null);
  const [bw, setBw] = React.useState<number>(0);

  const pad = { l: 46, r: 14, t: 46, b: 28 };
  const W = Math.max(0, w);
  const H = height;
  const iw = Math.max(1, W - pad.l - pad.r);
  const ih = Math.max(1, H - pad.t - pad.b);

  const allValues: number[] = [];
  for (const d of safeData) {
    allValues.push(d.value);
    if (hasCompare && d.compareValue != null) {
      allValues.push(d.compareValue);
    }
  }
  const rawMax = allValues.length > 0 ? Math.max(...allValues) : 0;
  const rawMin = allValues.length > 0 ? Math.min(...allValues) : 0;
  const domainMax = Math.max(0, rawMax);
  const domainMin = Math.min(0, rawMin);
  const span = Math.max(1, domainMax - domainMin);
  const step = niceStep(span, 4);
  const top = domainMax > 0 ? Math.ceil(domainMax / step) * step : domainMin === 0 ? step : 0;
  const bottom = domainMin < 0 ? -Math.ceil(Math.abs(domainMin) / step) * step : 0;
  const totalSpan = Math.max(step, top - bottom);

  const x = (i: number) => pad.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => pad.t + ih - ((v - bottom) / totalSpan) * ih;
  const zeroY = y(0);

  const line = (get: (d: ToneAreaDatum) => number) =>
    safeData.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(get(d)).toFixed(1)}`).join('');

  const totalPath = n > 0 ? line((d) => d.value) : '';
  const areaPath =
    n > 0
      ? `${totalPath}L${x(n - 1).toFixed(1)},${zeroY.toFixed(1)}L${x(0).toFixed(1)},${zeroY.toFixed(1)}Z`
      : '';
  const focusPath = hasCompare && n > 0 ? line((d) => d.compareValue ?? 0) : null;

  const ticks: number[] = [];
  for (let v = bottom; v <= top + 1e-6; v += step) {
    ticks.push(Math.abs(v) < 1e-9 ? 0 : v);
  }

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
      if (safeData[i].value > safeData[peakI].value) peakI = i;
    }
    const pk = safeData[peakI];
    return {
      index: peakI,
      text: `Peak ${pk.label} · ${formatValue(pk.value)}`,
    };
  }, [annotation, safeData, formatValue, n]);

  const peakI = resolvedAnnotation ? resolvedAnnotation.index : 0;
  const peakPoint = safeData[peakI];
  const px = peakPoint ? x(peakI) : 0;
  const py = peakPoint ? y(peakPoint.value) : 0;

  useIsoLayoutEffect(() => {
    if (balloon.current) setBw(balloon.current.offsetWidth);
  });

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!wrap.current || n === 0) return;
    const r = wrap.current.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const i = n <= 1 ? 0 : Math.round(((mx - pad.l) / iw) * (n - 1));
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
  const hd = hover != null && safeData[hover] ? safeData[hover] : null;
  const bLeft = W ? Math.max(pad.l, Math.min(px - bw / 2, W - pad.r - bw)) : 0;
  const tailX = Math.min(Math.max(px, bLeft + 14), Math.max(bLeft + 14, bLeft + bw - 14));
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
    <div className={`f12-tone-area-chart${className ? ` ${className}` : ''}`}>
      <div className="f12-chart" ref={wrap} style={{ height: H }}>
        {W > 0 && n > 0 && (
          <svg
            width={W}
            height={H}
            className="f12-chart-svg"
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
              {TONE_BAND_RADII.map((radius, b) => (
                <React.Fragment key={b}>
                  <pattern
                    id={`${uid}-tone-${b}`}
                    width="5"
                    height="5"
                    patternUnits="userSpaceOnUse"
                    patternTransform="rotate(45)"
                  >
                    <circle cx="2.5" cy="2.5" r={radius} className="f12-tone-dot" />
                  </pattern>
                  <clipPath id={`${uid}-band-${b}`}>
                    <rect
                      x="0"
                      y={pad.t + (ih * b) / TONE_BAND_RADII.length}
                      width={W}
                      height={ih / TONE_BAND_RADII.length + 0.5}
                    />
                  </clipPath>
                </React.Fragment>
              ))}
            </defs>

            {ticks.map((v) => (
              <g key={v} className="f12-ytick">
                <line
                  x1={pad.l}
                  x2={W - pad.r}
                  y1={y(v)}
                  y2={y(v)}
                  className={v === 0 ? 'f12-baseline' : 'f12-grid'}
                />
                <text x={pad.l - 8} y={y(v)} dy="0.35em" textAnchor="end">
                  {formatShort(v)}
                </text>
              </g>
            ))}

            <g className="f12-sheet-ticks" aria-hidden="true">
              {safeData.map(
                (_, i) =>
                  (n <= 30 || i % 3 === 0) && (
                    <line
                      key={i}
                      x1={x(i)}
                      x2={x(i)}
                      y1={y(bottom)}
                      y2={y(bottom) + (xLabels.includes(i) ? 7 : 3.5)}
                    />
                  ),
              )}
            </g>

            {xLabels.map((i) => (
              <text
                key={i}
                className="f12-xlab"
                x={x(i)}
                y={H - 8}
                textAnchor={i === n - 1 ? 'end' : i === 0 ? 'start' : 'middle'}
              >
                {safeData[i].label}
              </text>
            ))}

            <g clipPath={`url(#${uid}-clip)`}>
              {TONE_BAND_RADII.map((_, b) => (
                <path
                  key={b}
                  d={areaPath}
                  fill={`url(#${uid}-tone-${b})`}
                  clipPath={`url(#${uid}-band-${b})`}
                />
              ))}
              <path d={totalPath} className="f12-l-total" fill="none" />
              {focusPath && <path d={focusPath} className="f12-l-focus" fill="none" />}
            </g>

            {showPeak && resolvedAnnotation && (
              <>
                <path
                  className="f12-tail"
                  d={`M${tailX - 6},${bTop + bH - 1} L${px - (px - tailX) * 0.15},${py - 7} L${tailX + 6},${bTop + bH - 1}`}
                />
                <circle className="f12-peak-dot" cx={px} cy={py} r="4" />
              </>
            )}

            {hd && hover != null && (
              <g className="f12-cross" aria-hidden="true">
                <line x1={x(hover)} x2={x(hover)} y1={pad.t - 4} y2={y(bottom)} />
                <circle cx={x(hover)} cy={y(hd.value)} r="4.5" className="f12-cross-dot" />
                {hasCompare && hd.compareValue != null && (
                  <circle cx={x(hover)} cy={y(hd.compareValue)} r="4" className="f12-cross-dot2" />
                )}
              </g>
            )}
          </svg>
        )}

        {W > 0 && showPeak && resolvedAnnotation && (
          <div
            ref={balloon}
            className="f12-balloon"
            style={{ left: bLeft, top: bTop, minHeight: bH }}
            aria-hidden="true"
          >
            <span className="f12-balloon-gap" style={{ left: tailX - bLeft - 5 }} />
            {resolvedAnnotation.text}
          </div>
        )}

        {hd && hover != null && (
          <div
            className="f12-tip"
            role="status"
            style={{ left: Math.min(Math.max(x(hover) - 80, 4), Math.max(4, W - 164)), top: 4 }}
          >
            <strong>{hd.longLabel ?? hd.label}</strong>
            <span>
              <i className="f12-sw f12-sw-total" aria-hidden="true" />
              {seriesLabel} {formatValue(hd.value)}
            </span>
            {hasCompare && hd.compareValue != null && (
              <span>
                <i className="f12-sw f12-sw-focus" aria-hidden="true" />
                {compareLabel} {formatValue(hd.compareValue)}
              </span>
            )}
          </div>
        )}
      </div>

      {showTable && (
        <details className="f12-tbl">
          <summary>{tableSummary}</summary>
          <div className="f12-tbl-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">{labelColumnHeader}</th>
                  <th scope="col">{seriesLabel}</th>
                  {hasCompare && <th scope="col">{compareLabel}</th>}
                </tr>
              </thead>
              <tbody>
                {safeData
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
