'use client';

import * as React from 'react';
import { useFieldContext } from './field';

export type RadioGroupDensity = 'comfortable' | 'compact';
export type RadioGroupOrientation = 'vertical' | 'horizontal';

export interface RadioOption {
  value: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  disabled?: boolean;
}

interface RadioGroupContextValue {
  name?: string;
  fallbackName: string;
  value?: string;
  isControlled: boolean;
  defaultValue?: string;
  disabled?: boolean;
  required?: boolean;
  form?: string;
  density: RadioGroupDensity;
  invalid?: boolean;
  onSelect: (nextValue: string) => void;
}

const RadioGroupContext = React.createContext<RadioGroupContextValue | null>(null);

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;

function encodeRadioValueForId(value: string): string {
  if (value.length === 0) return '_empty_';
  let out = '';
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (/[a-zA-Z0-9-]/.test(ch)) {
      out += ch;
    } else if (ch === '_') {
      out += '__';
    } else {
      const cp = value.codePointAt(i)!;
      out += `_${cp.toString(16)}_`;
      if (cp > 0xffff) i++;
    }
  }
  return out;
}

export interface RadioGroupProps extends Omit<React.FieldsetHTMLAttributes<HTMLFieldSetElement>, 'onChange'> {
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  options?: RadioOption[];
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  density?: RadioGroupDensity;
  orientation?: RadioGroupOrientation;
  disabled?: boolean;
  required?: boolean;
}

export const RadioGroup = React.forwardRef<HTMLFieldSetElement, RadioGroupProps>(
  function RadioGroup(
    {
      id,
      name,
      value: controlledValue,
      defaultValue,
      onValueChange,
      options,
      label,
      hint,
      error,
      density,
      orientation = 'vertical',
      disabled,
      required,
      form,
      className = '',
      children,
      'aria-describedby': userDescribedBy,
      ...rest
    },
    ref,
  ) {
    const fieldCtx = useFieldContext();
    const autoId = React.useId().replace(/:/g, '');
    const groupId = id || fieldCtx?.id || `f12-radiogroup-${autoId}`;
    const fallbackName = `${groupId}-name`;
    const isControlled = controlledValue !== undefined;

    const registerRadioGroup = fieldCtx?.registerRadioGroup;
    const registerControlId = fieldCtx?.registerControlId;
    useIsomorphicLayoutEffect(() => {
      registerRadioGroup?.();
      return registerControlId?.(autoId, id);
    }, [registerRadioGroup, registerControlId, autoId, id]);

    const effectiveDensity: RadioGroupDensity = density ?? fieldCtx?.density ?? 'comfortable';
    const isCompact = effectiveDensity === 'compact';
    const effectiveDisabled = disabled ?? fieldCtx?.disabled;
    const effectiveRequired = required ?? fieldCtx?.required;
    const effectiveLabel = label ?? (fieldCtx?.isRadioGroup ? fieldCtx.label : undefined);
    const legendId = label && !fieldCtx?.isRadioGroup ? undefined : fieldCtx?.labelId;
    const showOwnHint = Boolean(hint && !fieldCtx?.hintId);
    const showOwnError = Boolean(error && !fieldCtx?.errorId);
    const hintId = showOwnHint ? `${groupId}-hint` : undefined;
    const errorId = showOwnError ? `${groupId}-error` : undefined;
    const describedBy =
      [userDescribedBy, fieldCtx?.describedBy, hintId, errorId].filter(Boolean).join(' ') ||
      undefined;
    const effectiveInvalid = Boolean(error || fieldCtx?.invalid);

    const handleSelect = React.useCallback(
      (nextValue: string) => {
        onValueChange?.(nextValue);
      },
      [onValueChange],
    );

    const ctxValue = React.useMemo<RadioGroupContextValue>(
      () => ({
        name,
        fallbackName,
        value: controlledValue,
        isControlled,
        defaultValue,
        disabled: effectiveDisabled,
        required: effectiveRequired,
        form,
        density: effectiveDensity,
        invalid: effectiveInvalid,
        onSelect: handleSelect,
      }),
      [
        name,
        fallbackName,
        controlledValue,
        isControlled,
        defaultValue,
        effectiveDisabled,
        effectiveRequired,
        form,
        effectiveDensity,
        effectiveInvalid,
        handleSelect,
      ],
    );

    return (
      <RadioGroupContext.Provider value={ctxValue}>
        <fieldset
          ref={ref}
          id={groupId}
          role="radiogroup"
          disabled={effectiveDisabled}
          form={form}
          aria-required={effectiveRequired || undefined}
          aria-invalid={effectiveInvalid || undefined}
          aria-describedby={describedBy}
          className={`f12-radio-group${isCompact ? ' f12-radio-group-compact' : ''}${orientation === 'horizontal' ? ' f12-radio-group-horizontal' : ''}${className ? ` ${className}` : ''}`}
          data-density={isCompact ? 'compact' : undefined}
          data-orientation={orientation}
          {...rest}
        >
          {effectiveLabel && (
            <legend id={legendId} className="f12-label f12-radio-legend">
              {effectiveLabel}
              {effectiveRequired && (
                <span className="f12-field-req" aria-hidden="true">
                  {' '}
                  *
                </span>
              )}
            </legend>
          )}
          <div className="f12-radio-items">
            {options
              ? options.map((opt) => (
                  <RadioGroupItem
                    key={opt.value}
                    id={`${groupId}-${encodeRadioValueForId(opt.value)}`}
                    value={opt.value}
                    label={opt.label}
                    hint={opt.hint}
                    disabled={opt.disabled}
                  />
                ))
              : children}
          </div>
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
        </fieldset>
      </RadioGroupContext.Provider>
    );
  },
);

(RadioGroup as unknown as { f12IsGroup?: boolean }).f12IsGroup = true;

export interface RadioGroupItemProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value'> {
  value: string;
  label?: React.ReactNode;
  hint?: React.ReactNode;
  density?: RadioGroupDensity;
}

export const RadioGroupItem = React.forwardRef<HTMLInputElement, RadioGroupItemProps>(
  function RadioGroupItem(
    {
      id,
      value,
      label,
      hint,
      density,
      disabled,
      checked: itemChecked,
      defaultChecked: itemDefaultChecked,
      name: itemName,
      required: itemRequired,
      form: itemForm,
      className = '',
      onChange,
      children,
      'aria-describedby': userDescribedBy,
      'aria-invalid': userAriaInvalid,
      ...rest
    },
    ref,
  ) {
    const groupCtx = React.useContext(RadioGroupContext);
    const autoId = React.useId().replace(/:/g, '');
    const itemId = id || `f12-radio-${autoId}`;
    const hintId = hint ? `${itemId}-hint` : undefined;
    const effectiveDensity: RadioGroupDensity =
      density ?? groupCtx?.density ?? 'comfortable';
    const isCompact = effectiveDensity === 'compact';
    const isDisabled = Boolean(disabled ?? groupCtx?.disabled);
    const resolvedChecked = groupCtx
      ? groupCtx.isControlled
        ? groupCtx.value === value
        : undefined
      : itemChecked;
    const resolvedDefaultChecked = groupCtx
      ? !groupCtx.isControlled
        ? groupCtx.defaultValue !== undefined
          ? groupCtx.defaultValue === value
          : itemDefaultChecked
        : undefined
      : itemDefaultChecked;
    const describedBy =
      [userDescribedBy, hintId].filter(Boolean).join(' ') || undefined;
    const displayLabel = label ?? children;

    return (
      <div
        className={`f12-radio-item${isCompact ? ' f12-radio-item-compact' : ''}`}
        data-disabled={isDisabled ? '' : undefined}
      >
        <div className="f12-check-row">
          <span className="f12-radio-control">
            <input
              ref={ref}
              id={itemId}
              type="radio"
              name={groupCtx?.name ?? itemName ?? groupCtx?.fallbackName}
              value={value}
              checked={resolvedChecked}
              defaultChecked={resolvedDefaultChecked}
              disabled={isDisabled}
              required={groupCtx?.required ?? itemRequired}
              form={groupCtx?.form ?? itemForm}
              aria-describedby={describedBy}
              aria-invalid={groupCtx?.invalid ? true : userAriaInvalid}
              className={`f12-radio-input${isCompact ? ' f12-radio-compact' : ''}${className ? ` ${className}` : ''}`}
              onChange={(e) => {
                onChange?.(e);
                if (e.target.checked) {
                  groupCtx?.onSelect(value);
                }
              }}
              {...rest}
            />
            <svg
              className="f12-radio-mark"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <circle cx="8" cy="8" r="4" fill="currentColor" />
            </svg>
          </span>
          {displayLabel && (
            <label htmlFor={itemId} className="f12-check-label">
              {displayLabel}
            </label>
          )}
        </div>
        {hint && (
          <p id={hintId} className="f12-hint f12-check-meta">
            {hint}
          </p>
        )}
      </div>
    );
  },
);
