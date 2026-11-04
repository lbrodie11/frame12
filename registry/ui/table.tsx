'use client';

import * as React from 'react';

export type TableDensity = 'comfortable' | 'compact';

const useIsoLayoutEffect =
  typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;

const TableContext = React.createContext<{
  captionId: string;
  setActiveCaptionId: (id: string | null) => void;
} | null>(null);

export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  density?: TableDensity;
  wrapperProps?: React.HTMLAttributes<HTMLDivElement>;
}

export function Table({
  density = 'comfortable',
  className = '',
  wrapperProps,
  children,
  ...rest
}: TableProps) {
  const isCompact = density === 'compact';
  const rawId = React.useId().replace(/:/g, '');
  const captionId = `f12-tbl-cap-${rawId}`;
  const [activeCaptionId, setActiveCaptionId] = React.useState<string | null>(null);
  const [isOverflowing, setIsOverflowing] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement | null>(null);

  useIsoLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const checkOverflow = () => {
      const next = el.scrollWidth > el.clientWidth + 1;
      setIsOverflowing((prev) => (prev === next ? prev : next));
    };
    checkOverflow();
    const ro =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(checkOverflow) : null;
    if (ro) {
      ro.observe(el);
      if (el.firstElementChild) {
        ro.observe(el.firstElementChild);
      }
    }
    window.addEventListener('resize', checkOverflow);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', checkOverflow);
    };
  }, [children]);

  const {
    className: wrapClassName = '',
    tabIndex: wrapTabIndex,
    role: wrapRole,
    'aria-label': wrapAriaLabel,
    'aria-labelledby': wrapAriaLabelledBy,
    ...restWrap
  } = wrapperProps ?? {};

  const resolvedTabIndex = wrapTabIndex !== undefined ? wrapTabIndex : isOverflowing ? 0 : undefined;
  const resolvedRole = wrapRole !== undefined ? wrapRole : isOverflowing ? 'region' : undefined;
  const resolvedAriaLabelledBy =
    wrapAriaLabelledBy ??
    (isOverflowing && !wrapAriaLabel
      ? (activeCaptionId ?? rest['aria-labelledby'])
      : undefined);
  const resolvedAriaLabel =
    wrapAriaLabel ??
    (isOverflowing && !resolvedAriaLabelledBy
      ? (rest['aria-label'] ?? 'Scrollable data table')
      : undefined);

  const ctxValue = React.useMemo(
    () => ({ captionId, setActiveCaptionId }),
    [captionId],
  );

  return (
    <TableContext.Provider value={ctxValue}>
      <div
        ref={wrapRef}
        className={`f12-table-wrap${wrapClassName ? ` ${wrapClassName}` : ''}`}
        tabIndex={resolvedTabIndex}
        role={resolvedRole}
        aria-label={resolvedAriaLabel}
        aria-labelledby={resolvedAriaLabelledBy}
        {...restWrap}
      >
        <table
          className={`f12-table${isCompact ? ' f12-table-compact' : ''}${className ? ` ${className}` : ''}`}
          data-density={isCompact ? 'compact' : undefined}
          {...rest}
        >
          {children}
        </table>
      </div>
    </TableContext.Provider>
  );
}

export function TableHeader({
  className = '',
  children,
  ...rest
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={className} {...rest}>
      {children}
    </thead>
  );
}

export function TableBody({
  className = '',
  children,
  ...rest
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={className} {...rest}>
      {children}
    </tbody>
  );
}

export function TableFooter({
  className = '',
  children,
  ...rest
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tfoot className={className} {...rest}>
      {children}
    </tfoot>
  );
}

export function TableRow({
  className = '',
  children,
  ...rest
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={className} {...rest}>
      {children}
    </tr>
  );
}

export function TableHead({
  scope = 'col',
  className = '',
  children,
  ...rest
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th scope={scope} className={className} {...rest}>
      {children}
    </th>
  );
}

export function TableCell({
  className = '',
  children,
  ...rest
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={className} {...rest}>
      {children}
    </td>
  );
}

export function TableCaption({
  id: userCaptionId,
  className = '',
  children,
  ...rest
}: React.HTMLAttributes<HTMLTableCaptionElement>) {
  const ctx = React.useContext(TableContext);
  const setActiveCaptionId = ctx?.setActiveCaptionId;
  const resolvedCaptionId = userCaptionId ?? ctx?.captionId;
  useIsoLayoutEffect(() => {
    if (!setActiveCaptionId || !resolvedCaptionId) return;
    setActiveCaptionId(resolvedCaptionId);
    return () => setActiveCaptionId(null);
  }, [setActiveCaptionId, resolvedCaptionId]);
  return (
    <caption id={resolvedCaptionId} className={className} {...rest}>
      {children}
    </caption>
  );
}
