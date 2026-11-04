'use client';

import * as React from 'react';
import { type MotionMode, useCountUp } from '@/hooks/use-on-twos';

export const fmtPct = (v: number): string => (Math.abs(v) * 100).toFixed(1) + '%';
export const fmtPPAbs = (v: number): string => Math.abs(v).toFixed(2) + ' pp';
export const fmtMoney = (v: number): string => '$' + Math.round(v).toLocaleString('en-US');

export interface DeltaProps {
  value: number;
  kind?: 'pct' | 'pp';
  comparisonLabel?: string;
  range?: number | string;
}

export function Delta({ value, kind = 'pct', comparisonLabel, range }: DeltaProps) {
  const flat = kind === 'pp' ? Math.abs(value) < 0.005 : Math.abs(value) < 0.0005;
  const up = value > 0;
  const text = flat
    ? kind === 'pp'
      ? '0.00 pp change'
      : '0.0% change'
    : kind === 'pp'
      ? fmtPPAbs(value)
      : fmtPct(value);
  const dir = flat ? 'flat' : up ? 'up' : 'down';
  const sym = flat ? '=' : up ? '▲' : '▼';
  const refLabel = comparisonLabel ?? (range != null ? `vs prior ${range} days` : undefined);

  return (
    <p className={`f12-delta ${dir}`}>
      <span className="f12-delta-sym" aria-hidden="true">
        {sym}
      </span>
      <span className="f12-sr-only">{flat ? '' : up ? 'Up ' : 'Down '}</span>
      {text}
      {refLabel && <span className="f12-delta-ref"> {refLabel}</span>}
    </p>
  );
}

export type MetricHeadingLevel = 'h2' | 'h3' | 'h4' | 'div' | 'p';
export type MetricVariant = 'expressive' | 'quiet';

export interface MetricProps {
  label: string;
  value: number;
  format?: (value: number) => string;
  delta?: number;
  deltaKind?: 'pct' | 'pp';
  comparisonLabel?: string;
  range?: number | string;
  note?: string;
  big?: boolean;
  variant?: MetricVariant;
  motion?: MotionMode;
  spark?: React.ReactNode;
  headingLevel?: MetricHeadingLevel;
  className?: string;
}

export function Metric({
  label,
  value,
  format = fmtMoney,
  delta,
  deltaKind = 'pct',
  comparisonLabel,
  range,
  note,
  big = false,
  variant = 'expressive',
  motion,
  spark,
  headingLevel: HeadingTag = 'h2',
  className = '',
}: MetricProps) {
  const effectiveMotion: MotionMode = motion ?? (variant === 'quiet' ? 'cut' : 'stepped');
  const shown = useCountUp(value, effectiveMotion);
  const variantClass = variant === 'quiet' ? ' f12-metric-quiet' : '';

  return (
    <div
      className={`f12-metric${big ? ' big' : ''}${variantClass}${className ? ` ${className}` : ''}`}
      data-variant={variant === 'quiet' ? 'quiet' : undefined}
    >
      <HeadingTag className="f12-m-label">{label}</HeadingTag>
      <p className="f12-m-value" aria-live="polite">
        <span className="f12-sr-only">{format(value)}</span>
        <span aria-hidden="true">{format(shown)}</span>
      </p>
      {delta != null && (
        <Delta value={delta} kind={deltaKind} comparisonLabel={comparisonLabel} range={range} />
      )}
      {note && <p className="f12-m-note">{note}</p>}
      {spark}
    </div>
  );
}
