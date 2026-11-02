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

  const safeValues = React.useMemo(
    () => values.map((v) => (Number.isFinite(v) ? Math.max(0, v) : 0)),
    [values],
  );
  const H = height;
  const max = Math.max(1, ...safeValues);
  const n = safeValues.length;
  const gap = n > 40 ? 1 : 2;
  const isMeasured = w > 0;
  const W = isMeasured ? w : 280;
  const bw = n > 0 ? Math.max(1, (W - gap * (n - 1)) / n) : 0;
  const shownCount = Math.ceil(n * p);
  const computedAriaLabel = ariaLabel ?? `${label}, last ${n} days, one bar per day`;

  return (
    <div className={`f12-spark${className ? ` ${className}` : ''}`} ref={ref}>
      <p className="f12-spark-l">{label}</p>
      {n > 0 && (
        <svg
          width={isMeasured ? W : '100%'}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio={isMeasured ? undefined : 'none'}
          role="img"
          aria-label={computedAriaLabel}
        >
          <defs>
            <pattern
              id={`${uid}-st`}
              width="4"
              height="4"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <circle cx="2" cy="2" r="1.05" className="f12-tone-dot" />
            </pattern>
          </defs>
          {safeValues.map((v, i) =>
            i < shownCount ? (
              <rect
                key={i}
                className="f12-spark-bar"
                vectorEffect="non-scaling-stroke"
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
