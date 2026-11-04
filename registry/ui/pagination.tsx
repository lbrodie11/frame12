'use client';

import * as React from 'react';

export type PaginationDensity = 'comfortable' | 'compact';
export type PaginationRangeToken = number | 'ellipsis-start' | 'ellipsis-end';

function toSafeInt(value: number | undefined, fallback: number, min: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return Math.max(min, Math.floor(fallback));
  }
  return Math.max(min, Math.floor(value));
}

function isModifiedLinkClick(
  event: React.MouseEvent<HTMLElement>,
  href: string | undefined,
): boolean {
  if (event.defaultPrevented) return true;
  if (href === undefined) return false;
  return (
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    (typeof event.button === 'number' && event.button !== 0)
  );
}

export function buildPaginationRange(
  page: number,
  totalPages: number,
  siblingCount = 1,
  boundaryCount = 1,
): PaginationRangeToken[] {
  const safeTotal = toSafeInt(totalPages, 1, 1);
  const safeSiblings = toSafeInt(siblingCount, 1, 0);
  const safeBoundaries = toSafeInt(boundaryCount, 1, 1);
  const safePage = Math.min(toSafeInt(page, 1, 1), safeTotal);

  const totalPageNumbers = safeSiblings * 2 + safeBoundaries * 2 + 3;
  if (safeTotal <= totalPageNumbers) {
    return Array.from({ length: safeTotal }, (_, i) => i + 1);
  }

  const leftSiblingIndex = Math.max(safePage - safeSiblings, 1);
  const rightSiblingIndex = Math.min(safePage + safeSiblings, safeTotal);

  const showLeftEllipsis = leftSiblingIndex > safeBoundaries + 1;
  const showRightEllipsis = rightSiblingIndex < safeTotal - safeBoundaries;

  if (!showLeftEllipsis && showRightEllipsis) {
    const leftItemCount = safeBoundaries + 2 + 2 * safeSiblings;
    const leftRange = Array.from({ length: leftItemCount }, (_, i) => i + 1);
    const rightBoundary = Array.from(
      { length: safeBoundaries },
      (_, i) => safeTotal - safeBoundaries + 1 + i,
    );
    return [...leftRange, 'ellipsis-end', ...rightBoundary];
  }

  if (showLeftEllipsis && !showRightEllipsis) {
    const rightItemCount = safeBoundaries + 2 + 2 * safeSiblings;
    const start = safeTotal - rightItemCount + 1;
    const leftBoundary = Array.from({ length: safeBoundaries }, (_, i) => i + 1);
    const rightRange = Array.from({ length: rightItemCount }, (_, i) => start + i);
    return [...leftBoundary, 'ellipsis-start', ...rightRange];
  }

  const leftBoundary = Array.from({ length: safeBoundaries }, (_, i) => i + 1);
  const rightBoundary = Array.from(
    { length: safeBoundaries },
    (_, i) => safeTotal - safeBoundaries + 1 + i,
  );
  const middleLength = rightSiblingIndex - leftSiblingIndex + 1;
  const middleRange = Array.from({ length: middleLength }, (_, i) => leftSiblingIndex + i);
  return [...leftBoundary, 'ellipsis-start', ...middleRange, 'ellipsis-end', ...rightBoundary];
}

const PaginationContext = React.createContext<{
  density: PaginationDensity;
}>({
  density: 'comfortable',
});

export interface PaginationSummaryDetails {
  page: number;
  totalPages: number;
  startItem?: number;
  endItem?: number;
  totalItems?: number;
}

export interface PaginationProps extends Omit<React.HTMLAttributes<HTMLElement>, 'onChange'> {
  page?: number;
  defaultPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  siblingCount?: number;
  boundaryCount?: number;
  density?: PaginationDensity;
  ariaLabel?: string;
  previousLabel?: React.ReactNode;
  nextLabel?: React.ReactNode;
  ellipsisLabel?: string;
  showSummary?: boolean;
  totalItems?: number;
  pageSize?: number;
  formatSummary?: (details: PaginationSummaryDetails) => React.ReactNode;
  getItemAriaLabel?: (
    type: 'page' | 'previous' | 'next',
    page: number,
    isCurrent: boolean,
  ) => string;
  getItemHref?: (page: number) => string | undefined;
}

export const Pagination = React.forwardRef<HTMLElement, PaginationProps>(function Pagination(
  {
    page: controlledPage,
    defaultPage = 1,
    totalPages,
    onPageChange,
    siblingCount = 1,
    boundaryCount = 1,
    density = 'comfortable',
    ariaLabel = 'Pagination',
    'aria-label': userAriaLabel,
    previousLabel = 'Prev',
    nextLabel = 'Next',
    ellipsisLabel = 'More pages',
    showSummary = false,
    totalItems,
    pageSize = 20,
    formatSummary,
    getItemAriaLabel,
    getItemHref,
    className = '',
    children,
    ...rest
  },
  ref,
) {
  const isCompact = density === 'compact';
  const isControlled = controlledPage !== undefined;
  const safeDefaultPage = toSafeInt(defaultPage, 1, 1);
  const [uncontrolledPage, setUncontrolledPage] = React.useState<number>(() => safeDefaultPage);
  const safeTotal = totalPages !== undefined ? toSafeInt(totalPages, 1, 1) : 1;
  const rawPage = isControlled ? controlledPage : uncontrolledPage;
  const currentPage = Math.min(toSafeInt(rawPage, safeDefaultPage, 1), safeTotal);
  const safePageSize = toSafeInt(pageSize, 20, 1);
  const safeTotalItems =
    typeof totalItems === 'number' && Number.isFinite(totalItems) && totalItems >= 0
      ? Math.floor(totalItems)
      : undefined;

  const selectPage = React.useCallback(
    (next: number) => {
      if (typeof next !== 'number' || !Number.isFinite(next)) return;
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
    () =>
      hasDataPagination
        ? buildPaginationRange(currentPage, safeTotal, siblingCount, boundaryCount)
        : [],
    [hasDataPagination, currentPage, safeTotal, siblingCount, boundaryCount],
  );

  let summaryNode: React.ReactNode = null;
  if (showSummary && hasDataPagination) {
    const startItem =
      safeTotalItems === undefined
        ? undefined
        : safeTotalItems === 0
          ? 0
          : (currentPage - 1) * safePageSize + 1;
    const endItem =
      safeTotalItems === undefined
        ? undefined
        : Math.min(currentPage * safePageSize, safeTotalItems);
    if (formatSummary) {
      summaryNode = formatSummary({
        page: currentPage,
        totalPages: safeTotal,
        startItem,
        endItem,
        totalItems: safeTotalItems,
      });
    } else {
      const pad = (n: number) => String(n).padStart(2, '0');
      if (safeTotalItems !== undefined && startItem !== undefined && endItem !== undefined) {
        summaryNode = `PAGE ${pad(currentPage)} OF ${pad(safeTotal)} · ${startItem}–${endItem} OF ${safeTotalItems}`;
      } else {
        summaryNode = `PAGE ${pad(currentPage)} OF ${pad(safeTotal)}`;
      }
    }
  }

  const prevPage = Math.max(1, currentPage - 1);
  const nextPage = Math.min(safeTotal, currentPage + 1);
  const prevHref = getItemHref?.(prevPage);
  const nextHref = getItemHref?.(nextPage);

  return (
    <PaginationContext.Provider value={ctxValue}>
      <nav
        ref={ref}
        aria-label={userAriaLabel ?? ariaLabel}
        data-density={isCompact ? 'compact' : undefined}
        className={`f12-pagination${isCompact ? ' f12-pagination-compact' : ''}${className ? ` ${className}` : ''}`}
        {...rest}
      >
        {showSummary && summaryNode !== null && summaryNode !== '' && (
          <div className="f12-pagination-summary" aria-live="polite">
            {summaryNode}
          </div>
        )}
        {hasDataPagination ? (
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href={prevHref}
                disabled={currentPage <= 1}
                aria-label={
                  getItemAriaLabel
                    ? getItemAriaLabel('previous', prevPage, false)
                    : 'Go to previous page'
                }
                onClick={(e) => {
                  if (!isModifiedLinkClick(e, prevHref)) {
                    selectPage(currentPage - 1);
                  }
                }}
              >
                {previousLabel}
              </PaginationPrevious>
            </PaginationItem>
            {tokens.map((token) => {
              if (token === 'ellipsis-start' || token === 'ellipsis-end') {
                return (
                  <PaginationItem key={token}>
                    <PaginationEllipsis aria-label={ellipsisLabel} />
                  </PaginationItem>
                );
              }
              const isCurrent = token === currentPage;
              const itemHref = getItemHref?.(token);
              return (
                <PaginationItem key={token}>
                  <PaginationLink
                    href={itemHref}
                    isActive={isCurrent}
                    aria-label={
                      getItemAriaLabel
                        ? getItemAriaLabel('page', token, isCurrent)
                        : isCurrent
                          ? `Page ${token}, current page`
                          : `Go to page ${token}`
                    }
                    onClick={(e) => {
                      if (!isModifiedLinkClick(e, itemHref)) {
                        selectPage(token);
                      }
                    }}
                  >
                    {token}
                  </PaginationLink>
                </PaginationItem>
              );
            })}
            <PaginationItem>
              <PaginationNext
                href={nextHref}
                disabled={currentPage >= safeTotal}
                aria-label={
                  getItemAriaLabel
                    ? getItemAriaLabel('next', nextPage, false)
                    : 'Go to next page'
                }
                onClick={(e) => {
                  if (!isModifiedLinkClick(e, nextHref)) {
                    selectPage(currentPage + 1);
                  }
                }}
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
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'type'>,
    Pick<
      React.AnchorHTMLAttributes<HTMLAnchorElement>,
      'href' | 'target' | 'download' | 'rel' | 'hrefLang' | 'ping' | 'referrerPolicy' | 'media'
    > {
  type?: React.ButtonHTMLAttributes<HTMLButtonElement>['type'] | (string & {});
  disabled?: boolean;
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
    type,
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
        type={type}
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
      type={(type as React.ButtonHTMLAttributes<HTMLButtonElement>['type']) ?? 'button'}
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
      {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}
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
