'use client';

import * as React from 'react';

export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  children?: React.ReactNode;
}

export const Tag = React.forwardRef<HTMLSpanElement, TagProps>(function Tag(
  { className = '', children, ...rest },
  ref,
) {
  return (
    <span ref={ref} className={`f12-tag${className ? ` ${className}` : ''}`} {...rest}>
      {children}
    </span>
  );
});
