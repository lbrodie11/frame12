'use client';

import * as React from 'react';
import { type MotionMode } from '@/hooks/use-on-twos';
import { useResolvedMotion } from '@/hooks/use-tempo';

export interface SheetProps extends React.HTMLAttributes<HTMLDivElement> {
  pegs?: boolean;
  autoCut?: boolean;
  motion?: MotionMode;
  theme?: 'light' | 'dark';
  sheetClassName?: string;
  children?: React.ReactNode;
}

export function Pegs() {
  return (
    <div className="f12-pegs" aria-hidden="true">
      <span className="f12-peg slot" />
      <span className="f12-peg round" />
      <span className="f12-peg slot" />
    </div>
  );
}

export const Sheet = React.forwardRef<HTMLDivElement, SheetProps>(function Sheet(
  {
    pegs = true,
    autoCut = false,
    motion = 'stepped',
    theme,
    className = '',
    sheetClassName = '',
    children,
    ...rest
  },
  ref,
) {
  // Emits the resolved mode (OS reduced motion, the nearest TempoProvider, then `motion`), so
  // CSS-only consumers inside follow it through the f12-m-* variable cascade.
  const effectiveMotion: MotionMode = useResolvedMotion(motion);
  const themeClass = theme ? ` f12-theme-${theme}` : '';
  const outerClass = `f12-dash f12-frame f12-m-${effectiveMotion}${themeClass}${className ? ` ${className}` : ''}`;
  const innerClass = `f12-sheet${sheetClassName ? ` ${sheetClassName}` : ''}`;
  const innerStyle = {
    '--f12-autocut-display': autoCut ? 'block' : 'none',
  } as React.CSSProperties;

  return (
    <div ref={ref} className={outerClass} data-theme={theme} {...rest}>
      <div
        className={innerClass}
        data-autocut={autoCut ? '' : undefined}
        style={innerStyle}
      >
        {pegs && <Pegs />}
        {children}
      </div>
    </div>
  );
});
