'use client';

import * as React from 'react';
import { type MotionMode } from '@/hooks/use-on-twos';
import { Badge } from './badge';

export interface ToneBarItem {
  id: string;
  name: string;
  value: number;
  formattedValue?: string;
  share?: number;
  badge?: string;
}

export interface ToneBarListProps {
  title?: string;
  subtitle?: string;
  items: ToneBarItem[];
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  motion?: MotionMode;
  changed?: boolean;
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
  idPrefix,
  className = '',
}: ToneBarListProps) {
  const autoId = React.useId().replace(/:/g, '');
  const resolvedPrefix = idPrefix ?? `f12-${autoId}`;
  const max = Math.max(1, ...items.map((r) => (Number.isFinite(r.value) ? r.value : 0)));
  const listKey = items.map((r) => `${r.id}:${r.value}`).join('|');

  return (
    <div className={`f12-ints${className ? ` ${className}` : ''}`}>
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
                    className="f12-int-fill"
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
