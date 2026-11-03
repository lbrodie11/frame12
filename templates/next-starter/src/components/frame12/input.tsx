'use client';

import * as React from 'react';

export type InputDensity = 'comfortable' | 'compact';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
  density?: InputDensity;
  fieldClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    id,
    label,
    hint,
    error,
    density = 'comfortable',
    className = '',
    fieldClassName = '',
    'aria-describedby': userDescribedBy,
    'aria-invalid': userAriaInvalid,
    ...rest
  },
  ref,
) {
  const autoId = React.useId();
  const inputId = id || `f12-input-${autoId.replace(/:/g, '')}`;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy =
    [userDescribedBy, hintId, errorId].filter(Boolean).join(' ') || undefined;
  const isCompact = density === 'compact';

  return (
    <div
      className={`f12-field${isCompact ? ' f12-field-compact' : ''}${fieldClassName ? ` ${fieldClassName}` : ''}`}
      data-density={isCompact ? 'compact' : undefined}
    >
      <label htmlFor={inputId} className="f12-label">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        className={`f12-input${isCompact ? ' f12-input-compact' : ''}${className ? ` ${className}` : ''}`}
        aria-describedby={describedBy}
        aria-invalid={error ? true : userAriaInvalid}
        {...rest}
      />
      {hint && (
        <p id={hintId} className="f12-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="f12-error" role="alert">
          <span className="f12-error-flag" aria-hidden="true">
            !
          </span>
          <span>{error}</span>
        </p>
      )}
    </div>
  );
});
