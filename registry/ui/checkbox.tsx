'use client';

import * as React from 'react';
import { useFieldContext } from './field';

export type CheckboxDensity = 'comfortable' | 'compact';

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  indeterminate?: boolean;
  density?: CheckboxDensity;
  onCheckedChange?: (checked: boolean) => void;
  fieldClassName?: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  {
    id,
    label,
    hint,
    error,
    indeterminate = false,
    density,
    disabled,
    required,
    className = '',
    fieldClassName = '',
    onChange,
    onCheckedChange,
    'aria-describedby': userDescribedBy,
    'aria-invalid': userAriaInvalid,
    ...rest
  },
  forwardedRef,
) {
  const fieldCtx = useFieldContext();
  const innerRef = React.useRef<HTMLInputElement | null>(null);
  const autoId = React.useId().replace(/:/g, '');
  const effectiveDensity: CheckboxDensity = density ?? fieldCtx?.density ?? 'comfortable';
  const isCompact = effectiveDensity === 'compact';
  const inputId = id || fieldCtx?.id || `f12-checkbox-${autoId}`;
  const showOwnLabel = Boolean(label && !fieldCtx?.labelId);
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

  const setRefs = React.useCallback(
    (node: HTMLInputElement | null) => {
      innerRef.current = node;
      if (node) {
        node.indeterminate = Boolean(indeterminate);
      }
      if (typeof forwardedRef === 'function') {
        forwardedRef(node);
      } else if (forwardedRef) {
        (forwardedRef as React.MutableRefObject<HTMLInputElement | null>).current = node;
      }
    },
    [forwardedRef, indeterminate],
  );

  React.useEffect(() => {
    if (innerRef.current) {
      innerRef.current.indeterminate = Boolean(indeterminate);
    }
  }, [indeterminate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange?.(e);
    onCheckedChange?.(e.target.checked);
  };

  const controlRow = (
    <div className="f12-check-row" data-disabled={effectiveDisabled ? '' : undefined}>
      <span className="f12-checkbox-control">
        <input
          ref={setRefs}
          id={inputId}
          type="checkbox"
          disabled={effectiveDisabled}
          required={effectiveRequired}
          className={`f12-checkbox-input${isCompact ? ' f12-checkbox-compact' : ''}${indeterminate ? ' f12-checkbox-indeterminate' : ''}${className ? ` ${className}` : ''}`}
          data-indeterminate={indeterminate ? 'true' : undefined}
          aria-checked={indeterminate ? 'mixed' : undefined}
          aria-describedby={describedBy}
          aria-invalid={effectiveInvalid}
          onChange={handleChange}
          {...rest}
        />
        <svg
          className="f12-checkbox-mark"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          {indeterminate ? (
            <line
              className="f12-checkbox-mark-mixed"
              x1="3.5"
              y1="8"
              x2="12.5"
              y2="8"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="square"
            />
          ) : (
            <polyline
              className="f12-checkbox-mark-check"
              points="3.5,8.5 6.8,11.8 12.8,4.5"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="square"
              strokeLinejoin="miter"
            />
          )}
        </svg>
      </span>
      {showOwnLabel && (
        <label htmlFor={inputId} className="f12-check-label">
          {label}
          {effectiveRequired && (
            <span className="f12-field-req" aria-hidden="true">
              {' '}
              *
            </span>
          )}
        </label>
      )}
    </div>
  );

  if (fieldCtx && !showOwnHint && !showOwnError) {
    return controlRow;
  }

  return (
    <div
      className={`f12-check-field${isCompact ? ' f12-check-field-compact' : ''}${fieldClassName ? ` ${fieldClassName}` : ''}`}
      data-density={isCompact ? 'compact' : undefined}
      data-disabled={effectiveDisabled ? '' : undefined}
    >
      {controlRow}
      {showOwnHint && (
        <p id={hintId} className="f12-hint f12-check-meta">
          {hint}
        </p>
      )}
      {showOwnError && (
        <p id={errorId} className="f12-error f12-check-meta" role="alert">
          <span className="f12-error-flag" aria-hidden="true">
            !
          </span>
          <span>{error}</span>
        </p>
      )}
    </div>
  );
});
