'use client';

import * as React from 'react';

const useIsoLayoutEffect = typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;

interface TooltipContextValue {
  open: boolean;
  setOpen: (next: boolean) => void;
  tooltipId: string;
  setCustomId: (id: string | undefined) => void;
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
  const [customId, setCustomId] = React.useState<string | undefined>(undefined);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const rawId = React.useId().replace(/:/g, '');
  const tooltipId = customId ?? `f12-tip-${rawId}`;

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  return (
    <TooltipContext.Provider value={{ open, setOpen, tooltipId, setCustomId }}>
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

function mergeRefs<T>(
  ...refs: Array<React.Ref<T> | undefined>
): React.RefCallback<T> {
  let activeCleanups: Array<() => void> = [];
  const runCleanups = () => {
    const toRun = activeCleanups;
    activeCleanups = [];
    for (const cleanup of toRun) {
      cleanup();
    }
  };
  return (value: T | null) => {
    runCleanups();
    if (value === null) {
      return;
    }
    const cleanups: Array<() => void> = [];
    for (const ref of refs) {
      if (typeof ref === 'function') {
        const cleanup = ref(value);
        if (typeof cleanup === 'function') {
          cleanups.push(cleanup);
        } else {
          cleanups.push(() => {
            ref(null);
          });
        }
      } else if (ref != null) {
        (ref as React.MutableRefObject<T | null>).current = value;
        cleanups.push(() => {
          (ref as React.MutableRefObject<T | null>).current = null;
        });
      }
    }
    activeCleanups = cleanups;
    return runCleanups;
  };
}

function getElementRef(element: React.ReactElement): React.Ref<unknown> | undefined {
  const propsObj = (element.props || {}) as Record<string, unknown>;
  let getter = Object.getOwnPropertyDescriptor(propsObj, 'ref')?.get;
  let mayWarn =
    getter && 'isReactWarning' in getter && (getter as { isReactWarning?: boolean }).isReactWarning;
  if (mayWarn) {
    return (element as unknown as { ref?: React.Ref<unknown> }).ref;
  }
  getter = Object.getOwnPropertyDescriptor(element, 'ref')?.get;
  mayWarn =
    getter && 'isReactWarning' in getter && (getter as { isReactWarning?: boolean }).isReactWarning;
  if (mayWarn) {
    return (propsObj as { ref?: React.Ref<unknown> }).ref;
  }
  return (
    (propsObj as { ref?: React.Ref<unknown> }).ref ||
    (element as unknown as { ref?: React.Ref<unknown> }).ref
  );
}

export const TooltipTrigger = React.forwardRef<HTMLButtonElement, TooltipTriggerProps>(
  function TooltipTrigger(
    {
      asChild = false,
      className = '',
      'aria-describedby': triggerDescribedBy,
      children,
      ...rest
    },
    forwardedRef,
  ) {
    const { open, tooltipId } = useTooltipContext();
    const childRef = React.isValidElement(children) ? getElementRef(children) : undefined;
    const composedRef = React.useMemo(
      () => mergeRefs(forwardedRef, childRef),
      [forwardedRef, childRef],
    );
    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<Record<string, unknown>>;
      const childProps = child.props || {};
      const mergedClassName = [childProps.className, className].filter(Boolean).join(' ') || undefined;
      const mergedDescribedBy =
        [
          triggerDescribedBy,
          childProps['aria-describedby'] as string | undefined,
          open ? tooltipId : undefined,
        ]
          .filter(Boolean)
          .join(' ') || undefined;

      const mergedProps: Record<string, unknown> = {
        ...rest,
        ...childProps,
        className: mergedClassName,
        'aria-describedby': mergedDescribedBy,
        ref: composedRef,
      };

      for (const evt of new Set([...Object.keys(rest), ...Object.keys(childProps)])) {
        if (!/^on[A-Z]/.test(evt)) continue;
        const parentHandler = (rest as Record<string, unknown>)[evt];
        const childHandler = childProps[evt];
        if (typeof parentHandler === 'function' && typeof childHandler === 'function') {
          mergedProps[evt] = (...args: unknown[]) => {
            (parentHandler as (...a: unknown[]) => void)(...args);
            (childHandler as (...a: unknown[]) => void)(...args);
          };
        } else if (typeof parentHandler === 'function') {
          mergedProps[evt] = parentHandler;
        } else if (typeof childHandler === 'function') {
          mergedProps[evt] = childHandler;
        }
      }

      return React.cloneElement(child, mergedProps);
    }
    const buttonDescribedBy =
      [triggerDescribedBy, open ? tooltipId : undefined].filter(Boolean).join(' ') || undefined;
    return (
      <button
        ref={forwardedRef}
        type="button"
        className={`f12-btn f12-btn-secondary f12-btn-sm${className ? ` ${className}` : ''}`}
        aria-describedby={buttonDescribedBy}
        {...rest}
      >
        {children}
      </button>
    );
  },
);

export function TooltipContent({
  id: userProvidedId,
  className = '',
  children,
  ...rest
}: React.HTMLAttributes<HTMLSpanElement>) {
  const { open, tooltipId, setCustomId } = useTooltipContext();
  useIsoLayoutEffect(() => {
    setCustomId(userProvidedId);
    return () => setCustomId(undefined);
  }, [userProvidedId, setCustomId]);
  if (!open) return null;
  return (
    <span
      id={userProvidedId ?? tooltipId}
      role="tooltip"
      className={`f12-tooltip${className ? ` ${className}` : ''}`}
      {...rest}
    >
      {children}
    </span>
  );
}
