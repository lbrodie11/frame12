'use client';

import * as React from 'react';
import { TEMPOS, useTempo, type Tempo } from '@/hooks/use-tempo';

export interface TempoControlProps {
  /** Group label. Visually hidden unless `showLegend` is set. */
  legend?: string;
  /** Shows the legend visibly above the options. */
  showLegend?: boolean;
  /** Prefix for the radio ids (`${idPrefix}-auto`, `${idPrefix}-twos`, …). */
  idPrefix?: string;
  className?: string;
}

export const TEMPO_OPTIONS: ReadonlyArray<{ value: Tempo; label: string; unit: string; meaning: string }> = [
  { value: 'auto', label: 'AUTO', unit: 'own', meaning: "each component's own motion" },
  { value: 'twos', label: '12', unit: 'twos', meaning: 'on twos' },
  { value: 'ones', label: '60', unit: 'smooth', meaning: 'smooth' },
  { value: 'still', label: '0', unit: 'still', meaning: 'no motion' },
];

const isDev = (): boolean => {
  try {
    return process.env.NODE_ENV !== 'production';
  } catch {
    return false;
  }
};

/**
 * The viewer's animation tempo as one native radio group: a `<fieldset>` + `<legend>` with four
 * radio inputs in the segmented appearance. Arrow keys move and select; Tab enters and leaves
 * the group as one stop. Must sit inside a TempoProvider; without one it renders disabled.
 */
export function TempoControl({
  legend = 'Animation tempo',
  showLegend = false,
  idPrefix,
  className = '',
}: TempoControlProps) {
  const { tempo, setTempo, inProvider, reduced, ancestorStill } = useTempo();
  const autoId = React.useId().replace(/:/g, '');
  const prefix = idPrefix ?? `f12-tempo-${autoId}`;
  const noteId = `${prefix}-note`;

  React.useEffect(() => {
    if (!inProvider && isDev()) {
      console.warn(
        'TempoControl: no TempoProvider above this control, so it is disabled. Wrap your app (or this section) in <TempoProvider>.',
      );
    }
  }, [inProvider]);

  // The OS (or an outer `still`) wins: show the effective state, keep the stored choice editable.
  const note = !inProvider
    ? 'Unavailable: no tempo provider on this page.'
    : reduced
      ? '0 · your system setting. Your choice applies when your system allows motion.'
      : ancestorStill
        ? '0 · set for this whole page. Your choice applies when that allows motion.'
        : null;

  return (
    <fieldset
      className={`f12-tempo${className ? ` ${className}` : ''}`}
      disabled={!inProvider}
      data-tempo={tempo}
      data-effective={!inProvider ? undefined : reduced || ancestorStill ? 'still' : tempo}
    >
      <legend className={showLegend ? 'f12-tempo-legend' : 'f12-sr-only'}>{legend}</legend>
      <div className="f12-rng f12-tempo-rng">
        {TEMPOS.map((value) => {
          const opt = TEMPO_OPTIONS.find((o) => o.value === value)!;
          const id = `${prefix}-${value}`;
          return (
            <label key={value} className="f12-rng-btn f12-tempo-opt" htmlFor={id}>
              <input
                id={id}
                className="f12-tempo-input"
                type="radio"
                name={prefix}
                value={value}
                checked={tempo === value}
                onChange={() => setTempo(value)}
                aria-describedby={note ? noteId : undefined}
              />
              <span className="f12-rng-n" aria-hidden="true">
                {opt.label}
              </span>
              <span className="f12-rng-u" aria-hidden="true">
                {opt.unit}
              </span>
              <span className="f12-sr-only">{`${opt.label}, ${opt.meaning}`}</span>
            </label>
          );
        })}
      </div>
      {note && (
        <p className="f12-tempo-note" id={noteId}>
          {note}
        </p>
      )}
    </fieldset>
  );
}
