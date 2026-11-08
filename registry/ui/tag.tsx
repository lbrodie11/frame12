'use client';

import * as React from 'react';

export type SemanticStatus = 'neutral' | 'info' | 'success' | 'warning' | 'danger';
export type TagStatus = SemanticStatus;
export type TagVariant = 'default' | 'stamp';

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

export const STATUS_SYNONYMS: Record<SemanticStatus, readonly string[]> = {
  neutral: [],
  info: ['info', 'information'],
  success: ['success', 'succeeded'],
  warning: ['warning', 'warn', 'caution'],
  danger: ['error', 'danger', 'critical', 'failed'],
};

export function startsWithStatusLabel(
  text: string,
  label: string,
  status?: SemanticStatus,
): boolean {
  const lowerText = text.trimStart().toLowerCase();
  const candidates =
    status && label === STATUS_SR_LABELS[status]
      ? STATUS_SYNONYMS[status]
      : [label.toLowerCase()];

  for (const candidate of candidates) {
    if (!lowerText.startsWith(candidate)) continue;
    const rest = lowerText.slice(candidate.length);
    if (rest === '' || !/^\p{L}/u.test(rest)) return true;
    if (candidate === 'error' && /^(ed|s)(?!\p{L})/u.test(rest)) return true;
    if ((candidate === 'warn' || candidate === 'warning') && /^s(?!\p{L})/u.test(rest)) {
      return true;
    }
  }
  return false;
}

export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: TagVariant;
  status?: SemanticStatus;
  glyph?: string | false;
  srLabel?: string | false;
  children?: React.ReactNode;
}

export interface StampProps extends Omit<TagProps, 'variant'> {
  children?: React.ReactNode;
}

export const Tag = React.forwardRef<HTMLSpanElement, TagProps>(function Tag(
  { variant = 'default', status, glyph, srLabel, className = '', children, ...rest },
  ref,
) {
  const isStamp = variant === 'stamp';
  const variantClass = isStamp ? ' f12-tag-stamp' : '';
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
    !(childText && resolvedSrLabel && startsWithStatusLabel(childText, resolvedSrLabel, status));

  return (
    <span
      ref={ref}
      className={`f12-tag${variantClass}${statusClass}${className ? ` ${className}` : ''}`}
      data-variant={isStamp ? 'stamp' : undefined}
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

export const Stamp = React.forwardRef<HTMLSpanElement, StampProps>(function Stamp(props, ref) {
  return <Tag ref={ref} variant="stamp" {...props} />;
});
