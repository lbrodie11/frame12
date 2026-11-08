'use client';

import * as React from 'react';
import { useOnTwos, useReducedMotion, type MotionMode } from '@/hooks/use-on-twos';
import { extractTextContent } from './tag';

export type GhostWireOrientation = 'auto' | 'horizontal' | 'vertical';

export interface GhostWireProps extends React.HTMLAttributes<HTMLDivElement> {
  from: React.ReactNode;
  to: React.ReactNode;
  label?: string;
  strength?: number;
  orientation?: GhostWireOrientation;
  motion?: MotionMode;
}

export const GhostWire = React.forwardRef<HTMLDivElement, GhostWireProps>(function GhostWire(
  {
    from,
    to,
    label,
    strength = 0.5,
    orientation = 'auto',
    motion = 'stepped',
    className = '',
    ...rest
  },
  ref,
) {
  const clampedStrength =
    typeof strength === 'number' && Number.isFinite(strength)
      ? Math.max(0, Math.min(1, strength))
      : 0.5;
  const safeOrientation: GhostWireOrientation =
    orientation === 'horizontal' || orientation === 'vertical' || orientation === 'auto'
      ? orientation
      : 'auto';

  const [autoVertical, setAutoVertical] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (safeOrientation !== 'auto' || typeof window === 'undefined' || !window.matchMedia) {
      setAutoVertical(false);
      return;
    }
    const mql = window.matchMedia('(max-width: 519.98px)');
    const update = () => setAutoVertical(mql.matches);
    update();
    if (mql.addEventListener) {
      mql.addEventListener('change', update);
      return () => mql.removeEventListener('change', update);
    }
    mql.addListener(update);
    return () => mql.removeListener(update);
  }, [safeOrientation]);

  const resolvedOrientation: 'horizontal' | 'vertical' =
    safeOrientation === 'auto' ? (autoVertical ? 'vertical' : 'horizontal') : safeOrientation;

  const fromText = extractTextContent(from).trim() || 'source';
  const toText = extractTextContent(to).trim() || 'target';
  const defaultAccessibleLabel = `${fromText} usually changes with ${toText}, which was not changed`;
  const groupAriaLabel =
    rest['aria-label'] ?? (label && label.trim() ? label.trim() : defaultAccessibleLabel);

  const reduced = useReducedMotion();
  const targetKey = `${fromText}|${toText}|${label ?? ''}|${clampedStrength.toFixed(3)}`;
  const [hydratedKey, setHydratedKey] = React.useState<string>('ssr');

  React.useEffect(() => {
    if (!reduced && motion !== 'cut') {
      setHydratedKey(targetKey);
    }
  }, [reduced, motion, targetKey]);

  const progress = useOnTwos(reduced || motion === 'cut' ? 'ssr' : hydratedKey, 500, motion);
  const dash = Math.round(3 + clampedStrength * 9);
  const gap = Math.round(10 - clampedStrength * 7);
  const dashArray = `${dash} ${gap}`;
  const dashOffset = progress >= 1 ? 0 : Number(((1 - progress) * 48).toFixed(2));

  return (
    <div
      {...rest}
      ref={ref}
      role="group"
      aria-label={groupAriaLabel}
      className={`f12-ghost-wire f12-ghost-wire-${safeOrientation}${className ? ` ${className}` : ''}`}
      data-orientation={resolvedOrientation}
      data-strength={clampedStrength.toFixed(2)}
    >
      <span className="f12-ghost-wire-endpoint f12-ghost-wire-from" data-endpoint="from">
        {from}
      </span>
      <span className="f12-ghost-wire-connector">
        <svg
          className="f12-ghost-wire-svg"
          viewBox={resolvedOrientation === 'vertical' ? '0 0 12 100' : '0 0 100 12'}
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          <line
            className="f12-ghost-wire-line"
            x1={resolvedOrientation === 'vertical' ? 6 : 0}
            y1={resolvedOrientation === 'vertical' ? 0 : 6}
            x2={resolvedOrientation === 'vertical' ? 6 : 100}
            y2={resolvedOrientation === 'vertical' ? 100 : 6}
            vectorEffect="non-scaling-stroke"
            strokeDasharray={dashArray}
            strokeDashoffset={dashOffset}
          />
        </svg>
        {label ? <span className="f12-ghost-wire-label">{label}</span> : null}
      </span>
      <span className="f12-ghost-wire-endpoint f12-ghost-wire-to" data-endpoint="to">
        {to}
      </span>
    </div>
  );
});
