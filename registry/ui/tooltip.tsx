'use client';

import * as React from 'react';

interface TooltipContextValue {
  open: boolean;
  setOpen: (next: boolean) => void;
  tooltipId: string;
}

const TooltipContext = React.createContext<TooltipContextValue | null>(null);

function useTooltipContext() {
  const ctx = React.useContext(TooltipContext);
  if (!ctx) throw new Error('Tooltip subcomponents must be used within <Tooltip>');
  return ctx;
}

export function TooltipProvider({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}

export interface TooltipProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}

export function Tooltip({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  children,
}: TooltipProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState<boolean>(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const rawId = React.useId().replace(/:/g, '');
  const tooltipId = `f12-tip-${rawId}`;

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  return (
    <TooltipContext.Provider value={{ open, setOpen, tooltipId }}>
      <span
        className="f12-tooltip-wrap"
        onPointerEnter={() => setOpen(true)}
        onPointerLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
        }}
      >
        {children}
      </span>
    </TooltipContext.Provider>
  );
}

export interface TooltipTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

export function TooltipTrigger({
  asChild = false,
  className = '',
  children,
  ...rest
}: TooltipTriggerProps) {
  const { open, tooltipId } = useTooltipContext();
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
      'aria-describedby': open ? tooltipId : undefined,
    });
  }
  return (
    <button
      type="button"
      className={`f12-btn f12-btn-secondary f12-btn-sm${className ? ` ${className}` : ''}`}
      aria-describedby={open ? tooltipId : undefined}
      {...rest}
    >
      {children}
    </button>
  );
}

export function TooltipContent({
  className = '',
  children,
  ...rest
}: React.HTMLAttributes<HTMLSpanElement>) {
  const { open, tooltipId } = useTooltipContext();
  if (!open) return null;
  return (
    <span
      id={tooltipId}
      role="tooltip"
      className={`f12-tooltip${className ? ` ${className}` : ''}`}
      {...rest}
    >
      {children}
    </span>
  );
}
