'use client';

import * as React from 'react';

export type SemanticStatus = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export const STATUS_GLYPHS: Record<SemanticStatus, string | undefined> = {
  neutral: undefined,
  info: '[i]',
  success: '[+]',
  warning: '[!]',
  danger: '[×]',
};

export const STATUS_SR_LABELS: Record<SemanticStatus, string | undefined> = {
  neutral: undefined,
  info: 'Info',
  success: 'Success',
  warning: 'Warning',
  danger: 'Error',
};

export function extractTextContent(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractTextContent).join('');
  if (
    React.isValidElement<{
      children?: React.ReactNode;
      hidden?: boolean;
      'aria-hidden'?: boolean | 'true' | 'false';
    }>(node)
  ) {
    if (
      node.props.hidden ||
      node.props['aria-hidden'] === true ||
      node.props['aria-hidden'] === 'true'
    ) {
      return '';
    }
    return extractTextContent(node.props.children);
  }
  return '';
}

export function startsWithStatusLabel(text: string, label: string): boolean {
  const lowerText = text.toLowerCase();
  const lowerLabel = label.toLowerCase();
  if (!lowerText.startsWith(lowerLabel)) return false;
  const rest = lowerText.slice(lowerLabel.length);
  if (rest === '' || !/^\p{L}/u.test(rest)) return true;
  if (lowerLabel === 'error' && /^(ed|s)\b/.test(rest)) return true;
  if ((lowerLabel === 'warn' || lowerLabel === 'warning') && /^s\b/.test(rest)) return true;
  return false;
}

export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  status?: SemanticStatus;
  glyph?: string | false;
  srLabel?: string | false;
  children?: React.ReactNode;
}

export const Tag = React.forwardRef<HTMLSpanElement, TagProps>(function Tag(
  { status, glyph, srLabel, className = '', children, ...rest },
  ref,
) {
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
      className={`f12-tag${statusClass}${className ? ` ${className}` : ''}`}
      data-status={status}
      {...rest}
    >
      {resolvedGlyph && (
        <span className="f12-status-glyph" aria-hidden="true">
          {resolvedGlyph}
        </span>
      )}
      {showSrLabel && <span className="f12-sr-only">{`${resolvedSrLabel}: `}</span>}
      {children}
    </span>
  );
});
