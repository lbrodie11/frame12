'use client';

import * as React from 'react';
import { type MotionMode, useReducedMotion } from '@/hooks/use-on-twos';

export interface SheetProps extends React.HTMLAttributes<HTMLDivElement> {
  pegs?: boolean;
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
    motion = 'stepped',
    theme,
    className = '',
    sheetClassName = '',
    children,
    ...rest
  },
  ref,
) {
  const reduced = useReducedMotion();
  const effectiveMotion: MotionMode = reduced ? 'cut' : motion;
  const themeClass = theme ? ` f12-theme-${theme}` : '';
  const outerClass = `f12-dash f12-frame f12-m-${effectiveMotion}${themeClass}${className ? ` ${className}` : ''}`;
  const innerClass = `f12-sheet${sheetClassName ? ` ${sheetClassName}` : ''}`;

  return (
    <div ref={ref} className={outerClass} data-theme={theme} {...rest}>
      <div className={innerClass}>
        {pegs && <Pegs />}
        {children}
      </div>
    </div>
  );
});
