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

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;

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
    readOnly,
    className = '',
    fieldClassName = '',
    onClick,
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

  const hasOwnLabel = Boolean(label);
  const showOwnLabel = hasOwnLabel;
  const inputId =
    id ||
    (!hasOwnLabel && !fieldCtx?.isControlGroup ? fieldCtx?.id : undefined) ||
    `f12-checkbox-${autoId}`;

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

  const isControlledChecked = rest.checked !== undefined;
  const [internalIndeterminate, setInternalIndeterminate] = React.useState<boolean>(() =>
    Boolean(indeterminate),
  );

  React.useEffect(() => {
    setInternalIndeterminate(Boolean(indeterminate));
  }, [indeterminate]);

  const effectiveIndeterminate = isControlledChecked
    ? Boolean(indeterminate)
    : internalIndeterminate;

  const registerControlGroup = fieldCtx?.registerControlGroup;
  const registerControlId = fieldCtx?.registerControlId;
  useIsomorphicLayoutEffect(() => {
    if (hasOwnLabel) {
      registerControlGroup?.();
    }
    return registerControlId?.(autoId, id);
  }, [hasOwnLabel, registerControlGroup, registerControlId, autoId, id]);

  const setRefs = React.useCallback(
    (node: HTMLInputElement | null) => {
      innerRef.current = node;
      if (node) {
        node.indeterminate = effectiveIndeterminate;
      }
      if (typeof forwardedRef === 'function') {
        forwardedRef(node);
      } else if (forwardedRef) {
        (forwardedRef as React.MutableRefObject<HTMLInputElement | null>).current = node;
      }
    },
    [forwardedRef, effectiveIndeterminate],
  );

  useIsomorphicLayoutEffect(() => {
    if (innerRef.current) {
      innerRef.current.indeterminate = effectiveIndeterminate;
    }
  }, [effectiveIndeterminate, rest.checked]);

  React.useEffect(() => {
    const node = innerRef.current;
    const form = node?.form;
    if (!form) return;
    const handleReset = (e: Event) => {
      const resetMixed = Boolean(indeterminate);
      const syncNode = () => {
        if (e.defaultPrevented) return;
        setInternalIndeterminate(resetMixed);
        if (innerRef.current) {
          innerRef.current.indeterminate = resetMixed;
          innerRef.current.classList.toggle('f12-checkbox-indeterminate', resetMixed);
          if (resetMixed) {
            innerRef.current.setAttribute('data-indeterminate', 'true');
          } else {
            innerRef.current.removeAttribute('data-indeterminate');
          }
        }
      };
      queueMicrotask(syncNode);
      setTimeout(syncNode, 0);
    };
    form.addEventListener('reset', handleReset);
    return () => {
      form.removeEventListener('reset', handleReset);
    };
  }, [indeterminate]);

  const handleClick = (e: React.MouseEvent<HTMLInputElement>) => {
    onClick?.(e);
    if (readOnly) {
      e.preventDefault();
      e.currentTarget.indeterminate = effectiveIndeterminate;
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) {
      e.preventDefault();
      e.target.indeterminate = effectiveIndeterminate;
      return;
    }
    if (!isControlledChecked) {
      setInternalIndeterminate(false);
      e.target.indeterminate = false;
    } else {
      e.target.indeterminate = Boolean(indeterminate);
    }
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
          readOnly={readOnly}
          className={`f12-checkbox-input${isCompact ? ' f12-checkbox-compact' : ''}${effectiveIndeterminate ? ' f12-checkbox-indeterminate' : ''}${className ? ` ${className}` : ''}`}
          data-indeterminate={effectiveIndeterminate ? 'true' : undefined}
          aria-describedby={describedBy}
          aria-invalid={effectiveInvalid}
          onClick={handleClick}
          onChange={handleChange}
          {...rest}
        />
        <svg
          className="f12-checkbox-mark"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          {effectiveIndeterminate ? (
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

(Checkbox as unknown as { f12IsCheckOrSwitch?: boolean }).f12IsCheckOrSwitch = true;
