'use client';

import * as React from 'react';
import { useFieldContext } from './field';

export type TextareaDensity = 'comfortable' | 'compact';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  density?: TextareaDensity;
  fieldClassName?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    id,
    label,
    hint,
    error,
    density,
    rows = 3,
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
  const effectiveDensity: TextareaDensity = density ?? fieldCtx?.density ?? 'comfortable';
  const isCompact = effectiveDensity === 'compact';
  const textareaId = id || fieldCtx?.id || `f12-textarea-${autoId}`;
  const showOwnLabel = Boolean(label && !fieldCtx?.labelId);
  const showOwnHint = Boolean(hint && !fieldCtx?.hintId);
  const showOwnError = Boolean(error && !fieldCtx?.errorId);
  const hintId = showOwnHint ? `${textareaId}-hint` : undefined;
  const errorId = showOwnError ? `${textareaId}-error` : undefined;
  const describedBy =
    [userDescribedBy, fieldCtx?.describedBy, hintId, errorId].filter(Boolean).join(' ') ||
    undefined;
  const effectiveInvalid = error || fieldCtx?.invalid ? true : userAriaInvalid;
  const effectiveDisabled = disabled ?? fieldCtx?.disabled;
  const effectiveRequired = required ?? fieldCtx?.required;

  const textareaElement = (
    <textarea
      ref={ref}
      id={textareaId}
      rows={rows}
      disabled={effectiveDisabled}
      required={effectiveRequired}
      className={`f12-textarea${isCompact ? ' f12-textarea-compact' : ''}${className ? ` ${className}` : ''}`}
      aria-describedby={describedBy}
      aria-invalid={effectiveInvalid}
      {...rest}
    />
  );

  if (fieldCtx && !showOwnLabel && !showOwnHint && !showOwnError) {
    return textareaElement;
  }

  return (
    <div
      className={`f12-field${isCompact ? ' f12-field-compact' : ''}${fieldClassName ? ` ${fieldClassName}` : ''}`}
      data-density={isCompact ? 'compact' : undefined}
      data-disabled={effectiveDisabled ? '' : undefined}
    >
      {showOwnLabel && (
        <label htmlFor={textareaId} className="f12-label">
          {label}
          {effectiveRequired && (
            <span className="f12-field-req" aria-hidden="true">
              {' '}
              *
            </span>
          )}
        </label>
      )}
      {textareaElement}
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
