'use client';

import * as React from 'react';

interface SelectContextValue {
  value: string;
  onValueChange: (val: string) => void;
  open: boolean;
  setOpen: (next: boolean) => void;
  labels: Record<string, string>;
  listboxId: string;
  triggerId: string;
}

const SelectContext = React.createContext<SelectContextValue | null>(null);

function useSelectContext() {
  const ctx = React.useContext(SelectContext);
  if (!ctx) throw new Error('Select subcomponents must be used within <Select>');
  return ctx;
}

export interface SelectProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  label?: string;
  id?: string;
  className?: string;
  children?: React.ReactNode;
}

function collectSelectLabels(node: React.ReactNode, map: Record<string, string>) {
  React.Children.forEach(node, (child) => {
    if (!React.isValidElement(child)) return;
    const props = child.props as { value?: string; children?: React.ReactNode };
    if (typeof props.value === 'string' && props.children != null) {
      const text =
        typeof props.children === 'string' || typeof props.children === 'number'
          ? String(props.children)
          : '';
      if (text) map[props.value] = text;
    }
    if (props.children) collectSelectLabels(props.children, map);
  });
}

export function Select({
  value: controlledValue,
  defaultValue = '',
  onValueChange,
  label,
  id,
  className = '',
  children,
}: SelectProps) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState<string>(defaultValue);
  const [open, setOpen] = React.useState<boolean>(false);
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const rawId = React.useId().replace(/:/g, '');
  const triggerId = id || `f12-select-${rawId}`;
  const listboxId = `${triggerId}-listbox`;

  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : uncontrolledValue;

  const labels = React.useMemo(() => {
    const map: Record<string, string> = {};
    collectSelectLabels(children, map);
    return map;
  }, [children]);

  const handleSelect = React.useCallback(
    (next: string) => {
      if (!isControlled) setUncontrolledValue(next);
      onValueChange?.(next);
      setOpen(false);
    },
    [isControlled, onValueChange],
  );

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <SelectContext.Provider
      value={{
        value,
        onValueChange: handleSelect,
        open,
        setOpen,
        labels,
        listboxId,
        triggerId,
      }}
    >
      <div ref={wrapRef} className={`f12-select${className ? ` ${className}` : ''}`}>
        {label && (
          <label htmlFor={triggerId} className="f12-label">
            {label}
          </label>
        )}
        {children}
      </div>
    </SelectContext.Provider>
  );
}

export interface SelectTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  ariaLabel?: string;
}

export function SelectTrigger({
  ariaLabel,
  className = '',
  children,
  ...rest
}: SelectTriggerProps) {
  const { open, setOpen, listboxId, triggerId } = useSelectContext();
  return (
    <button
      id={triggerId}
      type="button"
      className={`f12-select-trigger${className ? ` ${className}` : ''}`}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={open ? listboxId : undefined}
      aria-label={ariaLabel}
      onClick={() => setOpen(!open)}
      {...rest}
    >
      {children}
      <span className="f12-select-caret" aria-hidden="true">
        ▼
      </span>
    </button>
  );
}

export interface SelectValueProps {
  placeholder?: string;
}

export function SelectValue({ placeholder = 'Select…' }: SelectValueProps) {
  const { value, labels } = useSelectContext();
  return <span>{labels[value] ?? (value || placeholder)}</span>;
}

export function SelectContent({
  className = '',
  children,
  ...rest
}: React.HTMLAttributes<HTMLUListElement>) {
  const { open, listboxId } = useSelectContext();
  if (!open) return null;
  return (
    <ul
      id={listboxId}
      role="listbox"
      aria-label="Options"
      className={`f12-select-content${className ? ` ${className}` : ''}`}
      {...rest}
    >
      {children}
    </ul>
  );
}

export interface SelectItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

export function SelectItem({
  value: itemValue,
  className = '',
  children,
  ...rest
}: SelectItemProps) {
  const { value, onValueChange } = useSelectContext();
  const selected = value === itemValue;
  return (
    <li role="presentation">
      <button
        type="button"
        role="option"
        aria-selected={selected}
        className={`f12-select-item${className ? ` ${className}` : ''}`}
        onClick={() => onValueChange(itemValue)}
        {...rest}
      >
        <span>{children}</span>
        {selected && (
          <span className="f12-select-check" aria-hidden="true">
            ✓
          </span>
        )}
      </button>
    </li>
  );
}
