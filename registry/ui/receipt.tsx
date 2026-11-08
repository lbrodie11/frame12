'use client';

import * as React from 'react';

export type ReceiptKind = 'commit' | 'file' | 'link';
export type ReceiptOrigin = 'human' | 'agent' | 'bot';

export const RECEIPT_ORIGIN_META: Record<ReceiptOrigin, { glyph: string; srLabel: string }> = {
  human: { glyph: '[H]', srLabel: 'Origin: human' },
  agent: { glyph: '[A]', srLabel: 'Origin: agent' },
  bot: { glyph: '[B]', srLabel: 'Origin: bot' },
};

function getSafeHttpHref(href: string | undefined): string | null {
  if (typeof href !== 'string') return null;
  const trimmed = href.trim();
  if (!trimmed || /[\u0000-\u001F\u007F]/.test(trimmed)) return null;
  if (trimmed.startsWith('#')) {
    return trimmed;
  }
  if (trimmed.startsWith('/')) {
    if (trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
      return null;
    }
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return trimmed;
    }
    return null;
  } catch {
    return null;
  }
}

export interface ReceiptProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'title'> {
  kind: ReceiptKind;
  value: string;
  href?: string;
  title?: string;
  date?: string;
  origin?: ReceiptOrigin;
}

export interface ReceiptListProps extends React.HTMLAttributes<HTMLUListElement> {
  ariaLabel?: string;
  children?: React.ReactNode;
}

export const Receipt = React.forwardRef<HTMLSpanElement, ReceiptProps>(function Receipt(
  { kind, value, href, title, date, origin, className = '', ...rest },
  ref,
) {
  const safeKind: ReceiptKind =
    kind === 'commit' || kind === 'file' || kind === 'link' ? kind : 'file';
  const safeOrigin: ReceiptOrigin | undefined =
    origin === 'human' || origin === 'agent' || origin === 'bot' ? origin : undefined;
  const rawValue = typeof value === 'string' ? value : '';
  const trimmedRaw = rawValue.trim();
  const isCommit = safeKind === 'commit';
  const displayValue = isCommit ? trimmedRaw.slice(0, 7) : rawValue;
  const fullCommitTitle = isCommit && trimmedRaw ? trimmedRaw : undefined;
  const hasTruncatedCommit = isCommit && trimmedRaw.length > displayValue.length;
  const safeHref = getSafeHttpHref(href);
  const originMeta = safeOrigin ? RECEIPT_ORIGIN_META[safeOrigin] : undefined;

  return (
    <span
      ref={ref}
      className={`f12-receipt f12-receipt-${safeKind}${className ? ` ${className}` : ''}`}
      data-kind={safeKind}
      data-origin={safeOrigin}
      {...rest}
    >
      {originMeta ? (
        <span className={`f12-receipt-origin f12-receipt-origin-${safeOrigin}`}>
          <span className="f12-status-glyph" aria-hidden="true">
            {originMeta.glyph}
          </span>
          <span className="f12-sr-only">{`${originMeta.srLabel}: `}</span>
        </span>
      ) : null}
      {safeHref ? (
        <a
          className="f12-receipt-value f12-receipt-link"
          href={safeHref}
          title={fullCommitTitle}
        >
          {isCommit ? (
            <code className="f12-receipt-code" title={fullCommitTitle}>
              {displayValue}
            </code>
          ) : (
            displayValue
          )}
        </a>
      ) : isCommit ? (
        <code className="f12-receipt-value f12-receipt-code" title={fullCommitTitle}>
          {displayValue}
        </code>
      ) : (
        <span className="f12-receipt-value">{displayValue}</span>
      )}
      {hasTruncatedCommit ? (
        <span className="f12-sr-only f12-receipt-sha-sr">{` (${trimmedRaw})`}</span>
      ) : null}
      {title ? <span className="f12-receipt-title">{title}</span> : null}
      {date ? <span className="f12-receipt-date">{date}</span> : null}
    </span>
  );
});

export const ReceiptList = React.forwardRef<HTMLUListElement, ReceiptListProps>(
  function ReceiptList({ ariaLabel, className = '', children, ...rest }, ref) {
    const items = React.Children.toArray(children);

    return (
      <ul
        {...rest}
        ref={ref}
        className={`f12-receipt-list${className ? ` ${className}` : ''}`}
        aria-label={ariaLabel ?? rest['aria-label'] ?? 'Evidence receipts'}
      >
        {items.map((child, idx) => {
          if (React.isValidElement(child) && child.type === 'li') {
            return child;
          }
          const key = React.isValidElement(child) && child.key != null ? child.key : idx;
          return (
            <li key={key} className="f12-receipt-item">
              {child}
            </li>
          );
        })}
      </ul>
    );
  },
);
