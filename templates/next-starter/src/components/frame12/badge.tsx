'use client';

import * as React from 'react';

export type BadgeStatus = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const BADGE_STATUS_GLYPHS: Record<BadgeStatus, string | undefined> = {
  neutral: undefined,
  info: '[i]',
  success: '[+]',
  warning: '[!]',
  danger: '[×]',
};

const BADGE_STATUS_SR_LABELS: Record<BadgeStatus, string | undefined> = {
  neutral: undefined,
  info: 'Info',
  success: 'Success',
  warning: 'Warning',
  danger: 'Error',
};

function extractTextContent(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractTextContent).join('');
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return extractTextContent(node.props.children);
  }
  return '';
}

function startsWithStatusLabel(text: string, label: string): boolean {
  const lowerText = text.toLowerCase();
  const lowerLabel = label.toLowerCase();
  if (!lowerText.startsWith(lowerLabel)) return false;
  const rest = lowerText.slice(lowerLabel.length);
  if (rest === '' || !/^[a-z]/i.test(rest)) return true;
  if (lowerLabel === 'error' && /^(ed|s)\b/.test(rest)) return true;
  if ((lowerLabel === 'warn' || lowerLabel === 'warning') && /^s\b/.test(rest)) return true;
  return false;
}

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
          ? BADGE_STATUS_GLYPHS[status]
          : undefined;
  const resolvedSrLabel =
    srLabel === false
      ? undefined
      : srLabel !== undefined
        ? srLabel
        : status
          ? BADGE_STATUS_SR_LABELS[status]
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
