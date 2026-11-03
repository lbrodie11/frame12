'use client';

import * as React from 'react';
import { type MotionMode } from '@/hooks/use-on-twos';
import { Badge } from './badge';

export type ToneBarPattern = 'dots' | 'hatch' | 'dense';
export type ToneBarDensity = 'comfortable' | 'compact';

export interface ToneBarItem {
  id: string;
  name: string;
  value: number;
  formattedValue?: string;
  share?: number;
  badge?: string;
  pattern?: ToneBarPattern;
}

export interface ToneBarListProps {
  title?: string;
  subtitle?: string;
  items: ToneBarItem[];
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  motion?: MotionMode;
  changed?: boolean;
  density?: ToneBarDensity;
  idPrefix?: string;
  className?: string;
}

export function ToneBarList({
  title,
  subtitle,
  items,
  selectedId = null,
  onSelect,
  changed = false,
  density = 'comfortable',
  idPrefix,
  className = '',
}: ToneBarListProps) {
  const autoId = React.useId().replace(/:/g, '');
  const resolvedPrefix = idPrefix ?? `f12-${autoId}`;
  const max = Math.max(1, ...items.map((r) => (Number.isFinite(r.value) ? r.value : 0)));
  const listKey = items.map((r) => `${r.id}:${r.value}`).join('|');
  const isCompact = density === 'compact';

  return (
    <div
      className={`f12-ints${isCompact ? ' f12-ints-compact' : ''}${className ? ` ${className}` : ''}`}
      data-density={isCompact ? 'compact' : undefined}
    >
      {(title || subtitle) && (
        <div className="f12-ints-hd">
          {title && <h3 className="f12-m-label">{title}</h3>}
          {subtitle && <p className="f12-ints-sub">{subtitle}</p>}
        </div>
      )}
      <ul className={`f12-ints-list${changed ? ' f12-enter enter' : ''}`} key={listKey}>
        {items.map((r) => {
          const on = selectedId === r.id;
          const safeVal = Number.isFinite(r.value) ? r.value : 0;
          const formatted = r.formattedValue ?? '$' + Math.round(safeVal).toLocaleString('en-US');
          const patternClass =
            r.pattern && r.pattern !== 'dots' ? ` f12-int-fill-${r.pattern}` : '';
          return (
            <li key={r.id}>
              <button
                type="button"
                id={resolvedPrefix ? `int-${resolvedPrefix}-${r.id}` : `int-${r.id}`}
                className="f12-int-row"
                aria-pressed={on}
                onClick={() => onSelect?.(on ? null : r.id)}
              >
                <span className="f12-int-name">
                  {r.name}
                  {r.badge && (
                    <Badge pop={changed} burst>
                      {r.badge}
                    </Badge>
                  )}
                </span>
                <span className="f12-int-bar" aria-hidden="true">
                  <span
                    className={`f12-int-fill${patternClass}`}
                    data-pattern={r.pattern ?? 'dots'}
                    style={{ width: `${Math.max(0, (safeVal / max) * 100)}%` }}
                  />
                </span>
                <span className="f12-int-val">
                  {formatted}
                  {r.share != null && (
                    <span className="f12-int-share">{(r.share * 100).toFixed(0)}%</span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
