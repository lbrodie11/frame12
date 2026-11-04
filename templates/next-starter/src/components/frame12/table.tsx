'use client';

import * as React from 'react';

export type TableDensity = 'comfortable' | 'compact';

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
  const {
    className: wrapClassName = '',
    tabIndex: wrapTabIndex = 0,
    ...restWrap
  } = wrapperProps ?? {};
  return (
    <div
      className={`f12-table-wrap${wrapClassName ? ` ${wrapClassName}` : ''}`}
      tabIndex={wrapTabIndex}
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
  className = '',
  children,
  ...rest
}: React.HTMLAttributes<HTMLTableCaptionElement>) {
  return (
    <caption className={className} {...rest}>
      {children}
    </caption>
  );
}
