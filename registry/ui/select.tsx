'use client';

import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';

interface SelectFieldContextValue {
  instanceId: string;
  triggerId: string;
  containerEl: HTMLDivElement | null;
  describedBy?: string;
  invalid?: boolean;
}

const SelectFieldContext = React.createContext<SelectFieldContextValue | null>(null);

interface OuterFieldContextShape {
  id: string;
  labelId?: string;
  describedBy?: string;
  invalid?: boolean;
  disabled?: boolean;
  required?: boolean;
  density: 'comfortable' | 'compact';
  isControlGroup?: boolean;
  registerControlId?: (instanceId: string, explicitId?: string) => (() => void) | void;
}

const FIELD_CTX_KEY = Symbol.for('frame12.FieldContext');
const globalFieldRegistry = globalThis as unknown as Record<
  symbol,
  React.Context<OuterFieldContextShape | null> | undefined
>;
const OuterFieldContext = (globalFieldRegistry[FIELD_CTX_KEY] ??=
  React.createContext<OuterFieldContextShape | null>(null));

export type SelectDensity = 'comfortable' | 'compact';

export interface SelectProps
  extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Root> {
  label?: string;
  id?: string;
  density?: SelectDensity;
  className?: string;
}

export function Select({
  value,
  defaultValue,
  onValueChange,
  open,
  defaultOpen,
  onOpenChange,
  dir,
  name,
  autoComplete,
  disabled,
  required,
  form,
  label,
  id,
  density,
  className = '',
  children,
}: SelectProps) {
  const outerField = React.useContext(OuterFieldContext);
  const [containerEl, setContainerEl] = React.useState<HTMLDivElement | null>(null);
  const rawId = React.useId().replace(/:/g, '');
  const triggerId =
    id || (!outerField?.isControlGroup ? outerField?.id : undefined) || `f12-select-${rawId}`;
  const effectiveDensity: SelectDensity = density ?? outerField?.density ?? 'comfortable';
  const isCompact = effectiveDensity === 'compact';
  const effectiveDisabled = disabled ?? outerField?.disabled;
  const effectiveRequired = required ?? outerField?.required;
  const showOwnLabel = Boolean(label && (!outerField?.labelId || outerField?.isControlGroup));

  const registerControlId = outerField?.registerControlId;
  React.useEffect(() => {
    const cleanup = registerControlId?.(rawId, id);
    return typeof cleanup === 'function' ? cleanup : undefined;
  }, [registerControlId, rawId, id]);

  const ctxValue = React.useMemo(
    () => ({
      instanceId: rawId,
      triggerId,
      containerEl,
      describedBy: outerField?.describedBy,
      invalid: outerField?.invalid,
    }),
    [rawId, triggerId, containerEl, outerField?.describedBy, outerField?.invalid],
  );

  return (
    <SelectFieldContext.Provider value={ctxValue}>
      <div
        ref={setContainerEl}
        className={`f12-select${isCompact ? ' f12-select-compact' : ''}${className ? ` ${className}` : ''}`}
        data-density={isCompact ? 'compact' : undefined}
      >
        {showOwnLabel && (
          <label htmlFor={triggerId} className="f12-label">
            {label}
          </label>
        )}
        <SelectPrimitive.Root
          value={value}
          defaultValue={defaultValue}
          onValueChange={onValueChange}
          open={open}
          defaultOpen={defaultOpen}
          onOpenChange={onOpenChange}
          dir={dir}
          name={name}
          autoComplete={autoComplete}
          disabled={effectiveDisabled}
          required={effectiveRequired}
          form={form}
        >
          {children}
        </SelectPrimitive.Root>
      </div>
    </SelectFieldContext.Provider>
  );
}

(Select as unknown as { f12IsControl?: boolean }).f12IsControl = true;

export interface SelectTriggerProps
  extends Omit<React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>, 'asChild'> {
  ariaLabel?: string;
}

export const SelectTrigger = React.forwardRef<HTMLButtonElement, SelectTriggerProps>(
  function SelectTrigger(
    {
      ariaLabel,
      id,
      className = '',
      'aria-describedby': userDescribedBy,
      'aria-invalid': userAriaInvalid,
      children,
      ...rest
    },
    forwardedRef,
  ) {
    const field = React.useContext(SelectFieldContext);
    const outerField = React.useContext(OuterFieldContext);
    const fallbackInstanceId = React.useId().replace(/:/g, '');
    const instanceId = field?.instanceId ?? fallbackInstanceId;
    const resolvedId = id ?? field?.triggerId;
    const registerControlId = outerField?.registerControlId;
    React.useEffect(() => {
      if (id) {
        registerControlId?.(instanceId, id);
      }
    }, [id, instanceId, registerControlId]);
    const describedBy =
      [userDescribedBy, field?.describedBy].filter(Boolean).join(' ') || undefined;
    const ariaInvalid = field?.invalid ? true : userAriaInvalid;
    const { asChild: _asChild, ...triggerProps } =
      rest as React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>;
    return (
      <SelectPrimitive.Trigger
        ref={forwardedRef}
        id={resolvedId}
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        aria-invalid={ariaInvalid}
        className={`f12-select-trigger${className ? ` ${className}` : ''}`}
        {...triggerProps}
      >
        {children}
        <SelectPrimitive.Icon className="f12-select-caret" aria-hidden="true">
          ▼
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
    );
  },
);

(SelectTrigger as unknown as { f12IsSelectTrigger?: boolean }).f12IsSelectTrigger = true;

export type SelectValueProps = React.ComponentPropsWithoutRef<typeof SelectPrimitive.Value>;

export const SelectValue = React.forwardRef<HTMLSpanElement, SelectValueProps>(
  function SelectValue({ placeholder = 'Select…', ...rest }, forwardedRef) {
    return (
      <SelectPrimitive.Value
        ref={forwardedRef}
        placeholder={placeholder}
        {...rest}
      />
    );
  },
);

export type SelectContentProps = React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>;

export const SelectContent = React.forwardRef<HTMLDivElement, SelectContentProps>(
  function SelectContent(
    { className = '', position = 'popper', sideOffset = 4, children, ...rest },
    forwardedRef,
  ) {
    const field = React.useContext(SelectFieldContext);
    const portalContainer =
      (field?.containerEl?.closest(
        'dialog, .f12-frame, .f12-sheet, .f12-theme-dark, .f12-theme-light, [data-theme]',
      ) as HTMLElement | null) ?? undefined;

    return (
      <SelectPrimitive.Portal container={portalContainer}>
        <SelectPrimitive.Content
          ref={forwardedRef}
          position={position}
          sideOffset={sideOffset}
          className={`f12-select-content${className ? ` ${className}` : ''}`}
          {...rest}
        >
          <SelectPrimitive.Viewport className="f12-select-viewport">
            {children}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    );
  },
);

export type SelectItemProps = Omit<
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>,
  'asChild'
>;

export const SelectItem = React.forwardRef<HTMLDivElement, SelectItemProps>(
  function SelectItem({ className = '', children, ...rest }, forwardedRef) {
    const { asChild: _asChild, ...itemProps } =
      rest as React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>;
    return (
      <SelectPrimitive.Item
        ref={forwardedRef}
        className={`f12-select-item${className ? ` ${className}` : ''}`}
        {...itemProps}
      >
        <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
        <SelectPrimitive.ItemIndicator className="f12-select-check" aria-hidden="true">
          ✓
        </SelectPrimitive.ItemIndicator>
      </SelectPrimitive.Item>
    );
  },
);

export type SelectGroupProps = React.ComponentPropsWithoutRef<typeof SelectPrimitive.Group>;

export const SelectGroup = React.forwardRef<HTMLDivElement, SelectGroupProps>(
  function SelectGroup({ className = '', children, ...rest }, forwardedRef) {
    return (
      <SelectPrimitive.Group
        ref={forwardedRef}
        className={`f12-select-group${className ? ` ${className}` : ''}`}
        {...rest}
      >
        {children}
      </SelectPrimitive.Group>
    );
  },
);

export type SelectLabelProps = React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>;

export const SelectLabel = React.forwardRef<HTMLDivElement, SelectLabelProps>(
  function SelectLabel({ className = '', children, ...rest }, forwardedRef) {
    return (
      <SelectPrimitive.Label
        ref={forwardedRef}
        className={`f12-select-label${className ? ` ${className}` : ''}`}
        {...rest}
      >
        {children}
      </SelectPrimitive.Label>
    );
  },
);

export type SelectSeparatorProps = React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>;

export const SelectSeparator = React.forwardRef<HTMLDivElement, SelectSeparatorProps>(
  function SelectSeparator({ className = '', ...rest }, forwardedRef) {
    return (
      <SelectPrimitive.Separator
        ref={forwardedRef}
        className={`f12-select-sep${className ? ` ${className}` : ''}`}
        {...rest}
      />
    );
  },
);
