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

const STATUS_SR_LABELS: Record<SemanticStatus, string | undefined> = {
  neutral: undefined,
  info: 'Info',
  success: 'Success',
  warning: 'Warning',
  danger: 'Error',
};

export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  status?: SemanticStatus;
  glyph?: string | false;
  children?: React.ReactNode;
}

export const Tag = React.forwardRef<HTMLSpanElement, TagProps>(function Tag(
  { status, glyph, className = '', children, ...rest },
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
  const srLabel = status ? STATUS_SR_LABELS[status] : undefined;
  const showSrLabel =
    srLabel &&
    !(
      typeof children === 'string' &&
      children.trim().toLowerCase().startsWith(srLabel.toLowerCase())
    );

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
      {showSrLabel && <span className="f12-sr-only">{`${srLabel}: `}</span>}
      {children}
    </span>
  );
});
