'use client';

import * as React from 'react';
import {
  type SemanticStatus,
  STATUS_GLYPHS,
  STATUS_SR_LABELS,
  extractTextContent,
  startsWithStatusLabel,
} from './tag';

export type BadgeStatus = SemanticStatus;

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status?: BadgeStatus;
  glyph?: string | false;
  srLabel?: string | false;
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
  { status, glyph, srLabel, pop = false, burst, className = '', children, ...rest },
  ref,
) {
  const showBurst = burst ?? status === undefined;
  const statusClass = status ? ` f12-status-${status}` : '';
  const resolvedGlyph =
    glyph === false
      ? undefined
      : glyph !== undefined
        ? glyph
        : status
          ? STATUS_GLYPHS[status]
          : undefined;
  const resolvedSrLabel =
    srLabel === false
      ? undefined
      : srLabel !== undefined
        ? srLabel
        : status
          ? STATUS_SR_LABELS[status]
          : undefined;
  const childText = extractTextContent(children).trim();
  const showSrLabel =
    Boolean(resolvedSrLabel) &&
    !(childText && resolvedSrLabel && startsWithStatusLabel(childText, resolvedSrLabel));

  return (
    <span
      ref={ref}
      className={`f12-badge${statusClass}${pop ? ' f12-pop pop' : ''}${className ? ` ${className}` : ''}`}
      data-status={status}
      {...rest}
    >
      {showBurst && <Burst />}
      <span className="f12-badge-t">
        {resolvedGlyph && (
          <span className="f12-status-glyph" aria-hidden="true">
            {resolvedGlyph}
          </span>
        )}
        {showSrLabel && <span className="f12-sr-only">{`${resolvedSrLabel}: `}</span>}
        {children}
      </span>
    </span>
  );
});
