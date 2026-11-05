'use client';

import * as React from 'react';
import { useFieldContext } from './field';

export type SwitchDensity = 'comfortable' | 'compact';

export interface SwitchProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'role'> {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  density?: SwitchDensity;
  onLabel?: React.ReactNode;
  offLabel?: React.ReactNode;
  onCheckedChange?: (checked: boolean) => void;
  fieldClassName?: string;
}

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;

export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  {
    id,
    label,
    hint,
    error,
    density,
    onLabel = 'ON',
    offLabel = 'OFF',
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
  ref,
) {
  const fieldCtx = useFieldContext();
  const autoId = React.useId().replace(/:/g, '');
  const effectiveDensity: SwitchDensity = density ?? fieldCtx?.density ?? 'comfortable';
  const isCompact = effectiveDensity === 'compact';

  const hasOwnLabel = Boolean(label);
  const showOwnLabel = hasOwnLabel;
  const switchId =
    id ||
    (!hasOwnLabel && !fieldCtx?.isControlGroup ? fieldCtx?.id : undefined) ||
    `f12-switch-${autoId}`;

  const showOwnHint = Boolean(hint && !fieldCtx?.hintId);
  const showOwnError = Boolean(error && !fieldCtx?.errorId);
  const hintId = showOwnHint ? `${switchId}-hint` : undefined;
  const errorId = showOwnError ? `${switchId}-error` : undefined;
  const describedBy =
    [userDescribedBy, fieldCtx?.describedBy, hintId, errorId].filter(Boolean).join(' ') ||
    undefined;
  const effectiveInvalid = error || fieldCtx?.invalid ? true : userAriaInvalid;
  const effectiveDisabled = disabled ?? fieldCtx?.disabled;
  const isGroupOption = Boolean(fieldCtx?.isControlGroup || (hasOwnLabel && fieldCtx?.label));
  const effectiveRequired = required ?? (isGroupOption ? undefined : fieldCtx?.required);

  const registerControlGroup = fieldCtx?.registerControlGroup;
  const registerControlId = fieldCtx?.registerControlId;
  useIsomorphicLayoutEffect(() => {
    if (hasOwnLabel) {
      registerControlGroup?.();
    }
    return registerControlId?.(autoId, id);
  }, [hasOwnLabel, registerControlGroup, registerControlId, autoId, id]);

  const handleClick = (e: React.MouseEvent<HTMLInputElement>) => {
    onClick?.(e);
    if (readOnly) {
      e.preventDefault();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) {
      e.preventDefault();
      return;
    }
    onChange?.(e);
    onCheckedChange?.(e.target.checked);
  };

  const controlRow = (
    <div className="f12-check-row" data-disabled={effectiveDisabled ? '' : undefined}>
      <span
        className={`f12-switch${isCompact ? ' f12-switch-compact' : ''}`}
        data-density={isCompact ? 'compact' : undefined}
      >
        <input
          ref={ref}
          id={switchId}
          type="checkbox"
          role="switch"
          disabled={effectiveDisabled}
          required={effectiveRequired}
          readOnly={readOnly}
          aria-readonly={readOnly ? 'true' : undefined}
          className={`f12-switch-input${isCompact ? ' f12-switch-input-compact' : ''}${className ? ` ${className}` : ''}`}
          aria-describedby={describedBy}
          aria-invalid={effectiveInvalid}
          onClick={handleClick}
          onChange={handleChange}
          {...rest}
        />
        <span className="f12-switch-track" aria-hidden="true">
          <span className="f12-switch-glyph f12-switch-glyph-on">{onLabel}</span>
          <span className="f12-switch-glyph f12-switch-glyph-off">{offLabel}</span>
          <span className="f12-switch-thumb" />
        </span>
      </span>
      {showOwnLabel && (
        <label htmlFor={switchId} className="f12-check-label">
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

(Switch as unknown as { f12IsCheckOrSwitch?: boolean }).f12IsCheckOrSwitch = true;
