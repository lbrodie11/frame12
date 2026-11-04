'use client';

import * as React from 'react';
import {
  type SemanticStatus,
  STATUS_GLYPHS,
  STATUS_SR_LABELS,
  extractTextContent,
  startsWithStatusLabel,
} from './tag';

export type AlertStatus = SemanticStatus;
export type AlertDensity = 'comfortable' | 'compact';
export type AlertLive = 'off' | 'polite' | 'assertive';

export interface AlertProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  status?: AlertStatus;
  title?: React.ReactNode;
  description?: React.ReactNode;
  glyph?: string | false;
  srLabel?: string | false;
  density?: AlertDensity;
  live?: AlertLive;
  onDismiss?: () => void;
  dismissLabel?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

export type NoticeProps = AlertProps;

function hasCompoundAlertSlot(node: React.ReactNode): boolean {
  let found = false;
  const walk = (n: React.ReactNode) => {
    React.Children.forEach(n, (child) => {
      if (found || !React.isValidElement<Record<string, unknown>>(child)) return;
      const fnType = child.type as { f12AlertSlot?: boolean };
      if (fnType?.f12AlertSlot) {
        found = true;
        return;
      }
      if (child.type === React.Fragment && child.props?.children) {
        walk(child.props.children as React.ReactNode);
      }
    });
  };
  walk(node);
  return found;
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(function Alert(
  {
    status = 'info',
    title,
    description,
    glyph,
    srLabel,
    density = 'comfortable',
    live,
    role: userRole,
    onDismiss,
    dismissLabel = 'Dismiss notice',
    actions,
    className = '',
    children,
    ...rest
  },
  ref,
) {
  const isCompact = density === 'compact';
  const resolvedRole =
    userRole ??
    (live === 'assertive'
      ? 'alert'
      : live === 'polite'
        ? 'status'
        : live === 'off'
          ? 'note'
          : status === 'danger'
            ? 'alert'
            : 'note');

  const resolvedGlyph =
    glyph === false
      ? undefined
      : glyph !== undefined
        ? glyph
        : STATUS_GLYPHS[status];

  const resolvedSrLabel =
    srLabel === false
      ? undefined
      : srLabel !== undefined
        ? srLabel
        : STATUS_SR_LABELS[status];

  const combinedText = [
    extractTextContent(title),
    extractTextContent(description),
    extractTextContent(children),
  ]
    .filter(Boolean)
    .join(' ')
    .trim();
  const showSrLabel =
    Boolean(resolvedSrLabel) &&
    !(
      combinedText &&
      resolvedSrLabel &&
      startsWithStatusLabel(combinedText, resolvedSrLabel, status)
    );

  const isCompound = hasCompoundAlertSlot(children);

  return (
    <div
      ref={ref}
      role={resolvedRole}
      data-status={status}
      data-density={isCompact ? 'compact' : undefined}
      className={`f12-alert f12-alert-${status}${isCompact ? ' f12-alert-compact' : ''}${className ? ` ${className}` : ''}`}
      {...rest}
    >
      {resolvedGlyph && (
        <span className="f12-alert-glyph f12-status-glyph" aria-hidden="true">
          {resolvedGlyph}
        </span>
      )}
      <div className="f12-alert-body">
        {showSrLabel && <span className="f12-sr-only">{`${resolvedSrLabel}: `}</span>}
        {title && <div className="f12-alert-title">{title}</div>}
        {description && <div className="f12-alert-description">{description}</div>}
        {children &&
          (isCompound ? (
            children
          ) : (
            <div className="f12-alert-description">{children}</div>
          ))}
        {actions && <div className="f12-alert-actions">{actions}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          className="f12-alert-dismiss"
          aria-label={dismissLabel}
          onClick={onDismiss}
        >
          <span aria-hidden="true">×</span>
        </button>
      )}
    </div>
  );
});

export const Notice = React.forwardRef<HTMLDivElement, NoticeProps>(function Notice(
  { live = 'off', ...rest },
  ref,
) {
  return <Alert ref={ref} live={live} {...rest} />;
});

export type AlertTitleProps = React.HTMLAttributes<HTMLDivElement>;

export const AlertTitle = React.forwardRef<HTMLDivElement, AlertTitleProps>(function AlertTitle(
  { className = '', children, ...rest },
  ref,
) {
  return (
    <div ref={ref} className={`f12-alert-title${className ? ` ${className}` : ''}`} {...rest}>
      {children}
    </div>
  );
});
(AlertTitle as unknown as { f12AlertSlot?: boolean }).f12AlertSlot = true;

export type AlertDescriptionProps = React.HTMLAttributes<HTMLDivElement>;

export const AlertDescription = React.forwardRef<HTMLDivElement, AlertDescriptionProps>(
  function AlertDescription({ className = '', children, ...rest }, ref) {
    return (
      <div
        ref={ref}
        className={`f12-alert-description${className ? ` ${className}` : ''}`}
        {...rest}
      >
        {children}
      </div>
    );
  },
);
(AlertDescription as unknown as { f12AlertSlot?: boolean }).f12AlertSlot = true;

export type AlertActionsProps = React.HTMLAttributes<HTMLDivElement>;

export const AlertActions = React.forwardRef<HTMLDivElement, AlertActionsProps>(
  function AlertActions({ className = '', children, ...rest }, ref) {
    return (
      <div ref={ref} className={`f12-alert-actions${className ? ` ${className}` : ''}`} {...rest}>
        {children}
      </div>
    );
  },
);
(AlertActions as unknown as { f12AlertSlot?: boolean }).f12AlertSlot = true;
