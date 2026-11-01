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
  const text = flat ? 'No change' : kind === 'pp' ? fmtPPAbs(value) : fmtPct(value);
  const dir = flat ? 'flat' : up ? 'up' : 'down';
  const sym = flat ? '=' : up ? '▲' : '▼';
  const refLabel = comparisonLabel ?? (range != null ? `vs prior ${range} days` : undefined);

  return (
    <p className={`delta ${dir}`}>
      <span className="delta-sym" aria-hidden="true">
        {sym}
      </span>
      <span className="sr-only">{flat ? '' : up ? 'Up ' : 'Down '}</span>
      {text}
      {refLabel && <span className="delta-ref"> {refLabel}</span>}
    </p>
  );
}

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
  motion?: MotionMode;
  spark?: React.ReactNode;
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
  motion = 'stepped',
  spark,
  className = '',
}: MetricProps) {
  const shown = useCountUp(value, motion);

  return (
    <div className={`metric${big ? ' big' : ''}${className ? ` ${className}` : ''}`}>
      <h3 className="m-label">{label}</h3>
      <p className="m-value" aria-live="polite">
        <span className="sr-only">{format(value)}</span>
        <span aria-hidden="true">{format(shown)}</span>
      </p>
      {delta != null && (
        <Delta value={delta} kind={deltaKind} comparisonLabel={comparisonLabel} range={range} />
      )}
      {note && <p className="m-note">{note}</p>}
      {spark}
    </div>
  );
}
