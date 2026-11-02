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
    <div className="pegs" aria-hidden="true">
      <span className="peg slot" />
      <span className="peg round" />
      <span className="peg slot" />
    </div>
  );
}

export function Sheet({
  pegs = true,
  motion = 'stepped',
  theme,
  className = '',
  sheetClassName = '',
  children,
  ...rest
}: SheetProps) {
  const reduced = useReducedMotion();
  const effectiveMotion: MotionMode = reduced ? 'cut' : motion;
  const themeClass = theme ? ` theme-${theme}` : '';
  const outerClass = `dash frame m-${effectiveMotion}${themeClass}${className ? ` ${className}` : ''}`;
  const innerClass = `sheet${sheetClassName ? ` ${sheetClassName}` : ''}`;

  return (
    <div className={outerClass} data-theme={theme} {...rest}>
      <div className={innerClass}>
        {pegs && <Pegs />}
        {children}
      </div>
    </div>
  );
}
