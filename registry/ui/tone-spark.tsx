'use client';

import * as React from 'react';
import { type MotionMode, useOnTwos, useSize } from '@/hooks/use-on-twos';

export interface ToneSparkProps {
  values: number[];
  label: string;
  ariaLabel?: string;
  rangeKey?: string | number;
  motion?: MotionMode;
  height?: number;
  className?: string;
}

export function ToneSpark({
  values,
  label,
  ariaLabel,
  rangeKey,
  motion = 'stepped',
  height = 40,
  className = '',
}: ToneSparkProps) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const { w } = useSize(ref);
  const p = useOnTwos(rangeKey ?? values.length, 600, motion);
  const rawId = React.useId();
  const uid = React.useMemo(() => 's-' + rawId.replace(/:/g, ''), [rawId]);

  const H = height;
  const max = Math.max(1, ...values);
  const n = values.length;
  const gap = n > 40 ? 1 : 2;
  const bw = w && n > 0 ? Math.max(1, (w - gap * (n - 1)) / n) : 0;
  const shownCount = Math.ceil(n * p);
  const computedAriaLabel = ariaLabel ?? `${label}, last ${n} days, one bar per day`;

  return (
    <div className={`spark${className ? ` ${className}` : ''}`} ref={ref}>
      <p className="spark-l">{label}</p>
      {w > 0 && n > 0 && (
        <svg width={w} height={H} role="img" aria-label={computedAriaLabel}>
          <defs>
            <pattern
              id={`${uid}-st`}
              width="4"
              height="4"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <circle cx="2" cy="2" r="1.05" className="tone-dot" />
            </pattern>
          </defs>
          {values.map((v, i) =>
            i < shownCount ? (
              <rect
                key={i}
                className="spark-bar"
                fill={`url(#${uid}-st)`}
                x={i * (bw + gap)}
                y={H - (v / max) * H}
                width={bw}
                height={(v / max) * H}
              />
            ) : null,
          )}
        </svg>
      )}
    </div>
  );
}
