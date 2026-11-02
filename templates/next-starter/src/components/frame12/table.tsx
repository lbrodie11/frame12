'use client';

import * as React from 'react';

export function Table({
  className = '',
  children,
  ...rest
}: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="f12-table-wrap">
      <table className={`f12-table${className ? ` ${className}` : ''}`} {...rest}>
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
