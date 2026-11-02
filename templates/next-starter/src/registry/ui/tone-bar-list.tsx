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
  idPrefix = 'f12',
  className = '',
}: ToneBarListProps) {
  const max = Math.max(1, ...items.map((r) => r.value));
  const listKey = items.map((r) => `${r.id}:${r.value}`).join('|');

  return (
    <div className={`ints${className ? ` ${className}` : ''}`}>
      {(title || subtitle) && (
        <div className="ints-hd">
          {title && <h3 className="m-label">{title}</h3>}
          {subtitle && <p className="ints-sub">{subtitle}</p>}
        </div>
      )}
      <ul className={`ints-list${changed ? ' enter' : ''}`} key={listKey}>
        {items.map((r) => {
          const on = selectedId === r.id;
          const formatted = r.formattedValue ?? '$' + Math.round(r.value).toLocaleString('en-US');
          return (
            <li key={r.id}>
              <button
                type="button"
                id={idPrefix ? `int-${idPrefix}-${r.id}` : `int-${r.id}`}
                className="int-row"
                aria-pressed={on}
                onClick={() => onSelect?.(on ? null : r.id)}
              >
                <span className="int-name">
                  {r.name}
                  {r.badge && (
                    <Badge pop={changed} burst>
                      {r.badge}
                    </Badge>
                  )}
                </span>
                <span className="int-bar" aria-hidden="true">
                  <span className="int-fill" style={{ width: `${(r.value / max) * 100}%` }} />
                </span>
                <span className="int-val">
                  {formatted}
                  {r.share != null && (
                    <span className="int-share">{(r.share * 100).toFixed(0)}%</span>
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
