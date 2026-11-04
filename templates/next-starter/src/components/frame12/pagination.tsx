'use client';

import * as React from 'react';

export type PaginationDensity = 'comfortable' | 'compact';
export type PaginationRangeToken = number | 'ellipsis-start' | 'ellipsis-end';

export function buildPaginationRange(
  page: number,
  totalPages: number,
  siblingCount = 1,
): PaginationRangeToken[] {
  const safeTotal = Math.max(1, Math.floor(totalPages));
  const safeSiblings = Math.max(0, Math.floor(siblingCount));
  const safePage = Math.min(Math.max(1, Math.floor(page)), safeTotal);

  const totalPageNumbers = safeSiblings * 2 + 5;
  if (safeTotal <= totalPageNumbers) {
    return Array.from({ length: safeTotal }, (_, i) => i + 1);
  }

  const leftSiblingIndex = Math.max(safePage - safeSiblings, 1);
  const rightSiblingIndex = Math.min(safePage + safeSiblings, safeTotal);

  const showLeftEllipsis = leftSiblingIndex > 2;
  const showRightEllipsis = rightSiblingIndex < safeTotal - 1;

  if (!showLeftEllipsis && showRightEllipsis) {
    const leftItemCount = 3 + 2 * safeSiblings;
    const leftRange = Array.from({ length: leftItemCount }, (_, i) => i + 1);
    return [...leftRange, 'ellipsis-end', safeTotal];
  }

  if (showLeftEllipsis && !showRightEllipsis) {
    const rightItemCount = 3 + 2 * safeSiblings;
    const start = safeTotal - rightItemCount + 1;
    const rightRange = Array.from({ length: rightItemCount }, (_, i) => start + i);
    return [1, 'ellipsis-start', ...rightRange];
  }

  const middleLength = rightSiblingIndex - leftSiblingIndex + 1;
  const middleRange = Array.from({ length: middleLength }, (_, i) => leftSiblingIndex + i);
  return [1, 'ellipsis-start', ...middleRange, 'ellipsis-end', safeTotal];
}

const PaginationContext = React.createContext<{
  density: PaginationDensity;
}>({
  density: 'comfortable',
});

export interface PaginationProps extends Omit<React.HTMLAttributes<HTMLElement>, 'onChange'> {
  page?: number;
  defaultPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  siblingCount?: number;
  density?: PaginationDensity;
  ariaLabel?: string;
  previousLabel?: React.ReactNode;
  nextLabel?: React.ReactNode;
  showSummary?: boolean;
  totalItems?: number;
  pageSize?: number;
  getItemHref?: (page: number) => string | undefined;
}

export const Pagination = React.forwardRef<HTMLElement, PaginationProps>(function Pagination(
  {
    page: controlledPage,
    defaultPage = 1,
    totalPages,
    onPageChange,
    siblingCount = 1,
    density = 'comfortable',
    ariaLabel = 'Pagination',
    'aria-label': userAriaLabel,
    previousLabel = 'Prev',
    nextLabel = 'Next',
    showSummary = false,
    totalItems,
    pageSize = 20,
    getItemHref,
    className = '',
    children,
    ...rest
  },
  ref,
) {
  const isCompact = density === 'compact';
  const isControlled = controlledPage !== undefined;
  const [uncontrolledPage, setUncontrolledPage] = React.useState<number>(defaultPage);
  const safeTotal = totalPages !== undefined ? Math.max(1, Math.floor(totalPages)) : 1;
  const rawPage = isControlled ? controlledPage : uncontrolledPage;
  const currentPage = Math.min(Math.max(1, Math.floor(rawPage)), safeTotal);

  const selectPage = React.useCallback(
    (next: number) => {
      const clamped = Math.min(Math.max(1, Math.floor(next)), safeTotal);
      if (clamped === currentPage) return;
      if (!isControlled) {
        setUncontrolledPage(clamped);
      }
      onPageChange?.(clamped);
    },
    [currentPage, isControlled, onPageChange, safeTotal],
  );

  const ctxValue = React.useMemo(() => ({ density }), [density]);
  const hasDataPagination = totalPages !== undefined && !children;
  const tokens = React.useMemo(
    () => (hasDataPagination ? buildPaginationRange(currentPage, safeTotal, siblingCount) : []),
    [hasDataPagination, currentPage, safeTotal, siblingCount],
  );

  let summaryText = '';
  if (showSummary && hasDataPagination) {
    const pad = (n: number) => String(n).padStart(2, '0');
    if (totalItems !== undefined && totalItems >= 0) {
      const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
      const endItem = Math.min(currentPage * pageSize, totalItems);
      summaryText = `PAGE ${pad(currentPage)} OF ${pad(safeTotal)} · ${startItem}–${endItem} OF ${totalItems}`;
    } else {
      summaryText = `PAGE ${pad(currentPage)} OF ${pad(safeTotal)}`;
    }
  }

  return (
    <PaginationContext.Provider value={ctxValue}>
      <nav
        ref={ref}
        aria-label={userAriaLabel ?? ariaLabel}
        data-density={isCompact ? 'compact' : undefined}
        className={`f12-pagination${isCompact ? ' f12-pagination-compact' : ''}${className ? ` ${className}` : ''}`}
        {...rest}
      >
        {showSummary && summaryText && (
          <div className="f12-pagination-summary" aria-live="polite">
            {summaryText}
          </div>
        )}
        {hasDataPagination ? (
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href={currentPage > 1 ? getItemHref?.(currentPage - 1) : undefined}
                disabled={currentPage <= 1}
                onClick={() => selectPage(currentPage - 1)}
              >
                {previousLabel}
              </PaginationPrevious>
            </PaginationItem>
            {tokens.map((token) => {
              if (token === 'ellipsis-start' || token === 'ellipsis-end') {
                return (
                  <PaginationItem key={token}>
                    <PaginationEllipsis />
                  </PaginationItem>
                );
              }
              const isCurrent = token === currentPage;
              return (
                <PaginationItem key={token}>
                  <PaginationLink
                    href={getItemHref?.(token)}
                    isActive={isCurrent}
                    aria-label={isCurrent ? `Page ${token}, current page` : `Go to page ${token}`}
                    onClick={() => selectPage(token)}
                  >
                    {token}
                  </PaginationLink>
                </PaginationItem>
              );
            })}
            <PaginationItem>
              <PaginationNext
                href={currentPage < safeTotal ? getItemHref?.(currentPage + 1) : undefined}
                disabled={currentPage >= safeTotal}
                onClick={() => selectPage(currentPage + 1)}
              >
                {nextLabel}
              </PaginationNext>
            </PaginationItem>
          </PaginationContent>
        ) : (
          children
        )}
      </nav>
    </PaginationContext.Provider>
  );
});

export type PaginationContentProps = React.HTMLAttributes<HTMLUListElement>;

export const PaginationContent = React.forwardRef<HTMLUListElement, PaginationContentProps>(
  function PaginationContent({ className = '', children, ...rest }, ref) {
    return (
      <ul
        ref={ref}
        className={`f12-pagination-list${className ? ` ${className}` : ''}`}
        {...rest}
      >
        {children}
      </ul>
    );
  },
);

export type PaginationItemProps = React.LiHTMLAttributes<HTMLLIElement>;

export const PaginationItem = React.forwardRef<HTMLLIElement, PaginationItemProps>(
  function PaginationItem({ className = '', children, ...rest }, ref) {
    return (
      <li
        ref={ref}
        className={`f12-pagination-item${className ? ` ${className}` : ''}`}
        {...rest}
      >
        {children}
      </li>
    );
  },
);

export interface PaginationLinkProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  href?: string;
  isActive?: boolean;
  density?: PaginationDensity;
  onClick?: React.MouseEventHandler<HTMLElement>;
}

export const PaginationLink = React.forwardRef<
  HTMLButtonElement | HTMLAnchorElement,
  PaginationLinkProps
>(function PaginationLink(
  {
    href,
    isActive = false,
    disabled = false,
    density: propDensity,
    'aria-current': userAriaCurrent,
    className = '',
    onClick,
    children,
    ...rest
  },
  ref,
) {
  const ctx = React.useContext(PaginationContext);
  const effectiveDensity = propDensity ?? ctx.density;
  const isCompact = effectiveDensity === 'compact';
  const ariaCurrent = userAriaCurrent ?? (isActive ? 'page' : undefined);
  const mergedClass = `f12-pagination-link${isActive ? ' f12-pagination-link-active' : ''}${isCompact ? ' f12-pagination-link-compact' : ''}${disabled ? ' f12-pagination-link-disabled' : ''}${className ? ` ${className}` : ''}`;

  if (href !== undefined) {
    return (
      <a
        ref={ref as React.Ref<HTMLAnchorElement>}
        href={disabled ? undefined : href}
        aria-current={ariaCurrent}
        aria-disabled={disabled ? 'true' : undefined}
        tabIndex={disabled ? -1 : undefined}
        data-active={isActive ? 'true' : undefined}
        className={mergedClass}
        onClick={(e) => {
          if (disabled) {
            e.preventDefault();
            return;
          }
          onClick?.(e);
        }}
        {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
      >
        {children}
      </a>
    );
  }

  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      type="button"
      disabled={disabled}
      aria-current={ariaCurrent}
      data-active={isActive ? 'true' : undefined}
      className={mergedClass}
      onClick={(e) => {
        if (disabled) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }}
      {...rest}
    >
      {children}
    </button>
  );
});

export type PaginationPreviousProps = PaginationLinkProps;

export const PaginationPrevious = React.forwardRef<
  HTMLButtonElement | HTMLAnchorElement,
  PaginationPreviousProps
>(function PaginationPrevious(
  { 'aria-label': ariaLabel = 'Go to previous page', className = '', children, ...rest },
  ref,
) {
  return (
    <PaginationLink
      ref={ref}
      aria-label={ariaLabel}
      className={`f12-pagination-prev${className ? ` ${className}` : ''}`}
      {...rest}
    >
      <span className="f12-pagination-arrow" aria-hidden="true">
        ‹
      </span>
      <span>{children ?? 'Prev'}</span>
    </PaginationLink>
  );
});

export type PaginationNextProps = PaginationLinkProps;

export const PaginationNext = React.forwardRef<
  HTMLButtonElement | HTMLAnchorElement,
  PaginationNextProps
>(function PaginationNext(
  { 'aria-label': ariaLabel = 'Go to next page', className = '', children, ...rest },
  ref,
) {
  return (
    <PaginationLink
      ref={ref}
      aria-label={ariaLabel}
      className={`f12-pagination-next${className ? ` ${className}` : ''}`}
      {...rest}
    >
      <span>{children ?? 'Next'}</span>
      <span className="f12-pagination-arrow" aria-hidden="true">
        ›
      </span>
    </PaginationLink>
  );
});

export type PaginationEllipsisProps = React.HTMLAttributes<HTMLSpanElement>;

export const PaginationEllipsis = React.forwardRef<HTMLSpanElement, PaginationEllipsisProps>(
  function PaginationEllipsis(
    { 'aria-label': ariaLabel = 'More pages', className = '', children, ...rest },
    ref,
  ) {
    return (
      <span
        ref={ref}
        className={`f12-pagination-ellipsis${className ? ` ${className}` : ''}`}
        {...rest}
      >
        <span aria-hidden="true">{children ?? '…'}</span>
        <span className="f12-sr-only">{ariaLabel}</span>
      </span>
    );
  },
);
