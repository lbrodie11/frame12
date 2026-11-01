'use client';

import * as React from 'react';
import { useSize } from '@/hooks/use-on-twos';

export type PanelShape = 'rect' | 'slant-bottom' | 'slant-top';

export interface PanelProps extends React.HTMLAttributes<HTMLElement> {
  cut?: string;
  shape?: PanelShape;
  label?: string;
  children?: React.ReactNode;
}

export function Panel({
  cut,
  shape = 'rect',
  className = '',
  label,
  children,
  ...rest
}: PanelProps) {
  const ref = React.useRef<HTMLElement | null>(null);
  const { w, h } = useSize(ref);
  const s = 1.25; // half of 2.5px stroke
  const d = 16; // slant rise in px
  let pts: string;
  if (shape === 'slant-bottom') {
    pts = `${s},${s} ${w - s},${s} ${w - s},${h - s - d} ${s},${h - s}`;
  } else if (shape === 'slant-top') {
    pts = `${s},${s + d} ${w - s},${s} ${w - s},${h - s} ${s},${h - s}`;
  } else {
    pts = `${s},${s} ${w - s},${s} ${w - s},${h - s} ${s},${h - s}`;
  }

  return (
    <section
      ref={ref}
      className={`panel ${shape}${className ? ` ${className}` : ''}`}
      aria-label={label}
      {...rest}
    >
      {w > 0 && (
        <svg className="panel-frame" width={w} height={h} aria-hidden="true">
          <polygon points={pts} />
        </svg>
      )}
      {cut && (
        <span className="cut" aria-hidden="true">
          {cut}
        </span>
      )}
      <div className="panel-body">{children}</div>
    </section>
  );
}
