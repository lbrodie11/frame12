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

export const Panel = React.forwardRef<HTMLElement, PanelProps>(function Panel(
  { cut, shape = 'rect', className = '', label, children, ...rest },
  forwardedRef,
) {
  const innerRef = React.useRef<HTMLElement | null>(null);
  const setRefs = React.useCallback(
    (node: HTMLElement | null) => {
      innerRef.current = node;
      if (typeof forwardedRef === 'function') {
        forwardedRef(node);
      } else if (forwardedRef) {
        (forwardedRef as React.MutableRefObject<HTMLElement | null>).current = node;
      }
    },
    [forwardedRef],
  );

  const { w, h } = useSize(innerRef);
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

  const ssrPts =
    shape === 'slant-bottom'
      ? '0,0 100,0 100,90 0,100'
      : shape === 'slant-top'
        ? '0,10 100,0 100,100 0,100'
        : '0,0 100,0 100,100 0,100';

  return (
    <section
      ref={setRefs}
      className={`f12-panel f12-${shape} ${shape}${className ? ` ${className}` : ''}`}
      aria-label={label}
      {...rest}
    >
      {w > 0 ? (
        <svg className="f12-panel-frame" width={w} height={h} aria-hidden="true">
          <polygon points={pts} />
        </svg>
      ) : (
        <svg
          className="f12-panel-frame"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <polygon vectorEffect="non-scaling-stroke" points={ssrPts} />
        </svg>
      )}
      {cut && (
        <span className="f12-cut" aria-hidden="true">
          {cut}
        </span>
      )}
      <div className="f12-panel-body">{children}</div>
    </section>
  );
});
