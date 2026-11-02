'use client';

import * as React from 'react';

export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  children?: React.ReactNode;
}

export function Tag({ className = '', children, ...rest }: TagProps) {
  return (
    <span className={`tag${className ? ` ${className}` : ''}`} {...rest}>
      {children}
    </span>
  );
}
