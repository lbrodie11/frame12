'use client';

import * as React from 'react';

export interface BalloonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Tail horizontal offset in pixels relative to the balloon center (-36 to +36) */
  tailOffset?: number;
  /** Whether to show the marker-yellow target dot at the tip of the tail */
  showDot?: boolean;
  children?: React.ReactNode;
}

/**
 * Standalone speech-balloon annotation with mitered tail and seam cover.
 * Uses the same geometry as ToneAreaChart's peak callout.
 */
export function Balloon({
  tailOffset = 0,
  showDot = true,
  className = '',
  children,
  ...rest
}: BalloonProps) {
  const clamped = Math.max(-36, Math.min(36, tailOffset));
  const svgW = 120;
  const svgH = 26;
  const tailX = svgW / 2 + clamped * 0.4;
  const px = svgW / 2 + clamped;
  const py = svgH - 5;

  return (
    <div className={`f12-balloon-standalone${className ? ` ${className}` : ''}`} {...rest}>
      <div className="f12-balloon">
        <span
          className="f12-balloon-gap"
          aria-hidden="true"
          style={{ left: `calc(50% + ${clamped * 0.4 - 5}px)` }}
        />
        {children}
      </div>
      <svg
        width={svgW}
        height={svgH}
        className="f12-balloon-standalone-svg"
        aria-hidden="true"
      >
        <path
          className="f12-tail"
          d={`M${tailX - 6},0 L${px - (px - tailX) * 0.15},${py - 7} L${tailX + 6},0`}
        />
        {showDot && <circle className="f12-peak-dot" cx={px} cy={py} r="4" />}
      </svg>
    </div>
  );
}
