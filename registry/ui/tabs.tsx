'use client';

import * as React from 'react';

export type TabsOrientation = 'horizontal' | 'vertical';
export type TabsDensity = 'comfortable' | 'compact';
export type TabsActivationMode = 'automatic' | 'manual';

const PANEL_VARIANT_CTX_KEY = Symbol.for('frame12.PanelVariantContext');
const globalRegistry = globalThis as unknown as Record<
  symbol,
  React.Context<'expressive' | 'quiet' | undefined> | undefined
>;
const PanelVariantContext = (globalRegistry[PANEL_VARIANT_CTX_KEY] ??= React.createContext<
  'expressive' | 'quiet' | undefined
>(undefined));

interface TabsContextValue {
  baseId: string;
  value: string;
  focusedValue: string;
  setFocusedValue: (val: string) => void;
  onSelect: (val: string) => void;
  orientation: TabsOrientation;
  density: TabsDensity;
  activationMode: TabsActivationMode;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabsContext(componentName: string): TabsContextValue {
  const ctx = React.useContext(TabsContext);
  if (!ctx) {
    throw new Error(`[FRAME/12 ${componentName}] must be used within <Tabs>.`);
  }
  return ctx;
}

function toSafeIdSegment(value: string): string {
  return value.trim().replace(/\s+/g, '-');
}

function collectEnabledTabValues(children: React.ReactNode, out: string[] = []): string[] {
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement<Record<string, unknown>>(child)) return;
    if (
      (child.type as { f12IsTabsTrigger?: boolean })?.f12IsTabsTrigger &&
      typeof child.props.value === 'string' &&
      !child.props.disabled
    ) {
      out.push(child.props.value);
      return;
    }
    if (child.props.children) {
      collectEnabledTabValues(child.props.children as React.ReactNode, out);
    }
  });
  return out;
}

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  orientation?: TabsOrientation;
  density?: TabsDensity;
  activationMode?: TabsActivationMode;
  idPrefix?: string;
}

export const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(function Tabs(
  {
    value: controlledValue,
    defaultValue,
    onValueChange,
    orientation = 'horizontal',
    density = 'comfortable',
    activationMode = 'automatic',
    idPrefix,
    className = '',
    children,
    ...rest
  },
  ref,
) {
  const autoId = React.useId().replace(/:/g, '');
  const baseId = idPrefix ?? `f12-tabs-${autoId}`;
  const enabledTabValues = collectEnabledTabValues(children);
  const firstEnabledValue = enabledTabValues[0] ?? '';
  const isControlled = controlledValue !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = React.useState<string>(
    () => defaultValue ?? firstEnabledValue,
  );
  const activeValue = isControlled ? controlledValue : uncontrolledValue;
  const [focusedValue, setFocusedValue] = React.useState<string>(
    () => activeValue || firstEnabledValue,
  );

  React.useEffect(() => {
    setFocusedValue(activeValue);
  }, [activeValue]);

  const effectiveFocusedValue =
    enabledTabValues.length === 0
      ? focusedValue || activeValue
      : enabledTabValues.includes(focusedValue)
        ? focusedValue
        : enabledTabValues.includes(activeValue)
          ? activeValue
          : firstEnabledValue;

  const handleSelect = React.useCallback(
    (nextValue: string) => {
      if (!isControlled) {
        setUncontrolledValue(nextValue);
      }
      setFocusedValue(nextValue);
      onValueChange?.(nextValue);
    },
    [isControlled, onValueChange],
  );

  const ctxValue = React.useMemo<TabsContextValue>(
    () => ({
      baseId,
      value: activeValue,
      focusedValue: effectiveFocusedValue,
      setFocusedValue,
      onSelect: handleSelect,
      orientation,
      density,
      activationMode,
    }),
    [baseId, activeValue, effectiveFocusedValue, handleSelect, orientation, density, activationMode],
  );

  const isCompact = density === 'compact';

  return (
    <TabsContext.Provider value={ctxValue}>
      <div
        ref={ref}
        className={`f12-tabs${isCompact ? ' f12-tabs-compact' : ''}${orientation === 'vertical' ? ' f12-tabs-vertical' : ''}${className ? ` ${className}` : ''}`}
        data-orientation={orientation}
        data-density={isCompact ? 'compact' : undefined}
        {...rest}
      >
        {children}
      </div>
    </TabsContext.Provider>
  );
});

export interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> {
  ariaLabel?: string;
}

export const TabsList = React.forwardRef<HTMLDivElement, TabsListProps>(function TabsList(
  { ariaLabel, 'aria-label': userAriaLabel, className = '', onBlur, children, ...rest },
  forwardedRef,
) {
  const { value, setFocusedValue, orientation, density } = useTabsContext('TabsList');
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const isCompact = density === 'compact';

  const setRefs = React.useCallback(
    (node: HTMLDivElement | null) => {
      listRef.current = node;
      if (typeof forwardedRef === 'function') {
        forwardedRef(node);
      } else if (forwardedRef) {
        (forwardedRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }
    },
    [forwardedRef],
  );

  return (
    <div
      ref={setRefs}
      role="tablist"
      aria-orientation={orientation}
      aria-label={userAriaLabel ?? ariaLabel}
      className={`f12-tabs-list${isCompact ? ' f12-tabs-list-compact' : ''}${className ? ` ${className}` : ''}`}
      onBlur={(e) => {
        onBlur?.(e);
        if (!listRef.current?.contains(e.relatedTarget as Node | null)) {
          setFocusedValue(value);
        }
      }}
      {...rest}
    >
      {children}
    </div>
  );
});

export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

export const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  function TabsTrigger(
    { id, value, disabled, className = '', onFocus, onClick, onKeyDown, children, ...rest },
    ref,
  ) {
    const {
      baseId,
      value: activeValue,
      focusedValue,
      setFocusedValue,
      onSelect,
      orientation,
      activationMode,
    } = useTabsContext('TabsTrigger');
    const isSelected = activeValue === value;
    const isFocused = (focusedValue || activeValue) === value;
    const safeVal = toSafeIdSegment(value);
    const tabId = id ?? `${baseId}-tab-${safeVal}`;
    const panelId = `${baseId}-panel-${safeVal}`;

    return (
      <button
        ref={ref}
        id={tabId}
        type="button"
        role="tab"
        aria-selected={isSelected}
        aria-controls={panelId}
        data-state={isSelected ? 'active' : 'inactive'}
        data-value={value}
        disabled={disabled}
        tabIndex={disabled ? -1 : isFocused ? 0 : -1}
        aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Home End"
        className={`f12-tabs-trigger${className ? ` ${className}` : ''}`}
        onFocus={(e) => {
          onFocus?.(e);
          setFocusedValue(value);
        }}
        onClick={(e) => {
          onClick?.(e);
          if (!e.defaultPrevented && !disabled) {
            onSelect(value);
          }
        }}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          if (
            e.defaultPrevented ||
            e.altKey ||
            e.ctrlKey ||
            e.metaKey ||
            e.shiftKey
          ) {
            return;
          }
          const listEl = e.currentTarget.closest('[role="tablist"]');
          if (!listEl) return;
          const enabledTabs = Array.from(
            listEl.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)'),
          ).filter((el) => el.closest('[role="tablist"]') === listEl);
          if (enabledTabs.length === 0) return;
          const currentIdx = enabledTabs.indexOf(e.currentTarget);
          if (currentIdx === -1) return;

          const isRtl =
            orientation === 'horizontal' &&
            typeof window !== 'undefined' &&
            window.getComputedStyle(listEl).direction === 'rtl';

          let nextIdx = -1;
          const isForward =
            orientation === 'vertical'
              ? e.key === 'ArrowDown' || e.key === 'ArrowRight'
              : (isRtl ? e.key === 'ArrowLeft' : e.key === 'ArrowRight') || e.key === 'ArrowDown';
          const isBackward =
            orientation === 'vertical'
              ? e.key === 'ArrowUp' || e.key === 'ArrowLeft'
              : (isRtl ? e.key === 'ArrowRight' : e.key === 'ArrowLeft') || e.key === 'ArrowUp';

          if (isForward) {
            nextIdx = (currentIdx + 1) % enabledTabs.length;
          } else if (isBackward) {
            nextIdx = (currentIdx - 1 + enabledTabs.length) % enabledTabs.length;
          } else if (e.key === 'Home') {
            nextIdx = 0;
          } else if (e.key === 'End') {
            nextIdx = enabledTabs.length - 1;
          }

          if (nextIdx !== -1) {
            e.preventDefault();
            const targetBtn = enabledTabs[nextIdx];
            const targetValue = targetBtn.getAttribute('data-value');
            if (targetValue !== null) {
              setFocusedValue(targetValue);
              if (activationMode === 'automatic') {
                onSelect(targetValue);
              }
            }
            targetBtn.focus();
          }
        }}
        {...rest}
      >
        {children}
      </button>
    );
  },
);

(TabsTrigger as unknown as { f12IsTabsTrigger?: boolean }).f12IsTabsTrigger = true;

export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  forceMount?: boolean;
}

export const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  function TabsContent({ id, value, forceMount = false, className = '', children, ...rest }, ref) {
    const { baseId, value: activeValue } = useTabsContext('TabsContent');
    const isSelected = activeValue === value;
    const safeVal = toSafeIdSegment(value);
    const tabId = `${baseId}-tab-${safeVal}`;
    const panelId = id ?? `${baseId}-panel-${safeVal}`;

    return (
      <PanelVariantContext.Provider value="quiet">
        <div
          ref={ref}
          id={panelId}
          role="tabpanel"
          aria-labelledby={tabId}
          hidden={!isSelected}
          tabIndex={isSelected ? 0 : undefined}
          data-state={isSelected ? 'active' : 'inactive'}
          className={`f12-tabs-content${className ? ` ${className}` : ''}`}
          {...rest}
        >
          {isSelected || forceMount ? children : null}
        </div>
      </PanelVariantContext.Provider>
    );
  },
);
