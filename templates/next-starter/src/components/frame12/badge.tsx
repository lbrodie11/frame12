'use client';

import * as React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  pop?: boolean;
  burst?: boolean;
  children?: React.ReactNode;
}

export function Burst() {
  const lines: React.ReactElement[] = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const r1 = 15 + (i % 2) * 3;
    const r2 = 25 + (i % 3) * 3;
    lines.push(
      <line
        key={i}
        x1={30 + Math.cos(a) * r1 * 1.9}
        y1={14 + Math.sin(a) * r1 * 0.75}
        x2={30 + Math.cos(a) * r2 * 1.9}
        y2={14 + Math.sin(a) * r2 * 0.75}
      />,
    );
  }
  return (
    <svg className="f12-burst" viewBox="-20 -12 100 52" aria-hidden="true">
      {lines}
    </svg>
  );
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { pop = false, burst = true, className = '', children, ...rest },
  ref,
) {
  return (
    <span
      ref={ref}
      className={`f12-badge${pop ? ' f12-pop pop' : ''}${className ? ` ${className}` : ''}`}
      {...rest}
    >
      {burst && <Burst />}
      <span className="f12-badge-t">{children}</span>
    </span>
  );
});
