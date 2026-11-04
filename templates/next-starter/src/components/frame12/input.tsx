'use client';

import * as React from 'react';
import { useFieldContext } from './field';

export type InputDensity = 'comfortable' | 'compact';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  density?: InputDensity;
  fieldClassName?: string;
}

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    id,
    label,
    hint,
    error,
    density,
    disabled,
    required,
    className = '',
    fieldClassName = '',
    'aria-describedby': userDescribedBy,
    'aria-invalid': userAriaInvalid,
    ...rest
  },
  ref,
) {
  const fieldCtx = useFieldContext();
  const autoId = React.useId().replace(/:/g, '');
  const effectiveDensity: InputDensity = density ?? fieldCtx?.density ?? 'comfortable';
  const isCompact = effectiveDensity === 'compact';
  const inputId =
    id || (!fieldCtx?.isControlGroup ? fieldCtx?.id : undefined) || `f12-input-${autoId}`;
  const showOwnLabel = Boolean(label && (!fieldCtx?.labelId || fieldCtx?.isControlGroup));
  const showOwnHint = Boolean(hint && !fieldCtx?.hintId);
  const showOwnError = Boolean(error && !fieldCtx?.errorId);
  const hintId = showOwnHint ? `${inputId}-hint` : undefined;
  const errorId = showOwnError ? `${inputId}-error` : undefined;
  const describedBy =
    [userDescribedBy, fieldCtx?.describedBy, hintId, errorId].filter(Boolean).join(' ') ||
    undefined;
  const effectiveInvalid = error || fieldCtx?.invalid ? true : userAriaInvalid;
  const effectiveDisabled = disabled ?? fieldCtx?.disabled;
  const effectiveRequired = required ?? fieldCtx?.required;

  const registerControlId = fieldCtx?.registerControlId;
  useIsomorphicLayoutEffect(() => {
    return registerControlId?.(autoId, id);
  }, [registerControlId, autoId, id]);

  const inputElement = (
    <input
      ref={ref}
      id={inputId}
      disabled={effectiveDisabled}
      required={effectiveRequired}
      className={`f12-input${isCompact ? ' f12-input-compact' : ''}${className ? ` ${className}` : ''}`}
      aria-describedby={describedBy}
      aria-invalid={effectiveInvalid}
      {...rest}
    />
  );

  if (fieldCtx && !showOwnLabel && !showOwnHint && !showOwnError) {
    return inputElement;
  }

  return (
    <div
      className={`f12-field${isCompact ? ' f12-field-compact' : ''}${fieldClassName ? ` ${fieldClassName}` : ''}`}
      data-density={isCompact ? 'compact' : undefined}
      data-disabled={effectiveDisabled ? '' : undefined}
    >
      {showOwnLabel && (
        <label htmlFor={inputId} className="f12-label">
          {label}
          {effectiveRequired && (
            <span className="f12-field-req" aria-hidden="true">
              {' '}
              *
            </span>
          )}
        </label>
      )}
      {inputElement}
      {showOwnHint && (
        <p id={hintId} className="f12-hint">
          {hint}
        </p>
      )}
      {showOwnError && (
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

(Input as unknown as { f12IsControl?: boolean }).f12IsControl = true;
