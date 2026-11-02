'use client';

import * as React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'marker';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', type = 'button', className = '', children, ...rest },
  ref,
) {
  const classes = `f12-btn f12-btn-${variant} f12-btn-${size}${className ? ` ${className}` : ''}`;
  return (
    <button ref={ref} type={type} className={classes} {...rest}>
      {children}
    </button>
  );
});
