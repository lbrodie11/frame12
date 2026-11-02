'use client';

import * as React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
  fieldClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { id, label, hint, error, className = '', fieldClassName = '', ...rest },
  ref,
) {
  const autoId = React.useId();
  const inputId = id || `f12-input-${autoId.replace(/:/g, '')}`;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`f12-field${fieldClassName ? ` ${fieldClassName}` : ''}`}>
      <label htmlFor={inputId} className="f12-label">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        className={`f12-input${className ? ` ${className}` : ''}`}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
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
