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

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;

/**
 * Injective (1-to-1) encoding of arbitrary string values into valid HTML ID tokens.
 * Standard [a-zA-Z0-9-] characters stay readable; '_' becomes '__'; all other
 * code points become '_<hex>_', preventing collisions like "a b" vs "a-b".
 */
export function encodeTabValueForId(value: string): string {
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

interface StaticTabsInfo {
  enabledValues: string[];
  triggerIds: Map<string, string>;
  panelIds: Map<string, string>;
}

function scanStaticTabs(children: React.ReactNode): StaticTabsInfo {
  const info: StaticTabsInfo = {
    enabledValues: [],
    triggerIds: new Map(),
    panelIds: new Map(),
  };

  const walk = (node: React.ReactNode) => {
    React.Children.forEach(node, (child) => {
      if (!React.isValidElement<Record<string, unknown>>(child)) return;
      const fnType = child.type as {
        f12IsTabsTrigger?: boolean;
        f12IsTabsContent?: boolean;
      };
      if (fnType?.f12IsTabsTrigger && typeof child.props.value === 'string') {
        const val = child.props.value;
        if (!child.props.disabled) {
          info.enabledValues.push(val);
        }
        if (typeof child.props.id === 'string' && child.props.id.length > 0) {
          info.triggerIds.set(val, child.props.id);
        }
        return;
      }
      if (fnType?.f12IsTabsContent && typeof child.props.value === 'string') {
        const val = child.props.value;
        if (typeof child.props.id === 'string' && child.props.id.length > 0) {
          info.panelIds.set(val, child.props.id);
        }
      }
      if (child.props && child.props.children) {
        walk(child.props.children as React.ReactNode);
      }
    });
  };

  walk(children);
  return info;
}

interface RegisteredTrigger {
  value: string;
  disabled: boolean;
  id: string;
}

interface TabsContextValue {
  baseId: string;
  value: string;
  focusedValue: string;
  setFocusedValue: (val: string) => void;
  onSelect: (val: string) => void;
  orientation: TabsOrientation;
  density: TabsDensity;
  activationMode: TabsActivationMode;
  getTabId: (val: string, explicitId?: string) => string;
  getPanelId: (val: string, explicitId?: string) => string;
  registerTrigger: (
    el: HTMLButtonElement,
    val: string,
    disabled: boolean,
    resolvedId: string,
  ) => void;
  unregisterTrigger: (el: HTMLButtonElement) => void;
  registerPanel: (val: string, resolvedId: string) => void;
  unregisterPanel: (val: string, resolvedId: string) => void;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabsContext(componentName: string): TabsContextValue {
  const ctx = React.useContext(TabsContext);
  if (!ctx) {
    throw new Error(`[FRAME/12 ${componentName}] must be used within <Tabs>.`);
  }
  return ctx;
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
  const staticInfo = scanStaticTabs(children);
  const firstStaticEnabled = staticInfo.enabledValues[0] ?? '';

  const isControlled = controlledValue !== undefined;
  const hasUserSelectedRef = React.useRef(false);
  const [uncontrolledValue, setUncontrolledValue] = React.useState<string>(
    () => defaultValue ?? firstStaticEnabled,
  );
  const activeValue = isControlled ? controlledValue : uncontrolledValue;
  const [focusedValue, setFocusedValue] = React.useState<string>(
    () => activeValue || firstStaticEnabled,
  );

  const triggersMapRef = React.useRef<Map<HTMLButtonElement, RegisteredTrigger>>(new Map());
  const triggersKeyRef = React.useRef<string>('');
  const [registeredTriggers, setRegisteredTriggers] = React.useState<RegisteredTrigger[]>([]);
  const [registeredTriggerIds, setRegisteredTriggerIds] = React.useState<Record<string, string>>(
    {},
  );
  const [registeredPanelIds, setRegisteredPanelIds] = React.useState<Record<string, string>>({});

  const syncRegisteredTriggers = React.useCallback(() => {
    const entries = Array.from(triggersMapRef.current.entries());
    entries.sort(([a], [b]) => {
      if (a === b) return 0;
      const pos = a.compareDocumentPosition(b);
      return pos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });
    const ordered = entries.map(([, info]) => info);
    const nextKey = ordered
      .map((t) => `${t.value}\0${t.disabled ? '1' : '0'}\0${t.id}`)
      .join('\n');
    if (nextKey !== triggersKeyRef.current) {
      triggersKeyRef.current = nextKey;
      setRegisteredTriggers(ordered);
      const idMap: Record<string, string> = {};
      for (const t of ordered) {
        idMap[t.value] = t.id;
      }
      setRegisteredTriggerIds(idMap);
    }
  }, []);

  const registerTrigger = React.useCallback(
    (el: HTMLButtonElement, val: string, disabled: boolean, resolvedId: string) => {
      triggersMapRef.current.set(el, { value: val, disabled, id: resolvedId });
      syncRegisteredTriggers();
    },
    [syncRegisteredTriggers],
  );

  const unregisterTrigger = React.useCallback(
    (el: HTMLButtonElement) => {
      if (triggersMapRef.current.delete(el)) {
        syncRegisteredTriggers();
      }
    },
    [syncRegisteredTriggers],
  );

  const registerPanel = React.useCallback((val: string, resolvedId: string) => {
    setRegisteredPanelIds((prev) =>
      prev[val] === resolvedId ? prev : { ...prev, [val]: resolvedId },
    );
  }, []);

  const unregisterPanel = React.useCallback((val: string, resolvedId: string) => {
    setRegisteredPanelIds((prev) => {
      if (prev[val] !== resolvedId) return prev;
      const next = { ...prev };
      delete next[val];
      return next;
    });
  }, []);

  useIsomorphicLayoutEffect(() => {
    if (registeredTriggers.length === 0) return;
    const enabledList = registeredTriggers.filter((t) => !t.disabled);
    const firstEnabled = enabledList[0]?.value ?? '';
    if (!isControlled && firstEnabled !== '') {
      if (
        uncontrolledValue === '' ||
        (defaultValue === undefined &&
          !hasUserSelectedRef.current &&
          uncontrolledValue !== firstEnabled) ||
        !registeredTriggers.some((t) => t.value === uncontrolledValue && !t.disabled)
      ) {
        setUncontrolledValue(firstEnabled);
        setFocusedValue(firstEnabled);
      }
    }
  }, [registeredTriggers, isControlled, uncontrolledValue, defaultValue]);

  React.useEffect(() => {
    setFocusedValue(activeValue);
  }, [activeValue]);

  const hasMountedTriggers = registeredTriggers.length > 0;
  const enabledMountedValues = React.useMemo(
    () => registeredTriggers.filter((t) => !t.disabled).map((t) => t.value),
    [registeredTriggers],
  );

  const effectiveFocusedValue = hasMountedTriggers
    ? enabledMountedValues.includes(focusedValue)
      ? focusedValue
      : enabledMountedValues.includes(activeValue)
        ? activeValue
        : (enabledMountedValues[0] ?? '')
    : focusedValue || activeValue || firstStaticEnabled;

  const handleSelect = React.useCallback(
    (nextValue: string) => {
      hasUserSelectedRef.current = true;
      if (!isControlled) {
        setUncontrolledValue(nextValue);
      }
      setFocusedValue(nextValue);
      onValueChange?.(nextValue);
    },
    [isControlled, onValueChange],
  );

  const getTabId = React.useCallback(
    (val: string, explicitId?: string) =>
      explicitId ||
      registeredTriggerIds[val] ||
      staticInfo.triggerIds.get(val) ||
      `${baseId}-tab-${encodeTabValueForId(val)}`,
    [baseId, registeredTriggerIds, staticInfo.triggerIds],
  );

  const getPanelId = React.useCallback(
    (val: string, explicitId?: string) =>
      explicitId ||
      registeredPanelIds[val] ||
      staticInfo.panelIds.get(val) ||
      `${baseId}-panel-${encodeTabValueForId(val)}`,
    [baseId, registeredPanelIds, staticInfo.panelIds],
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
      getTabId,
      getPanelId,
      registerTrigger,
      unregisterTrigger,
      registerPanel,
      unregisterPanel,
    }),
    [
      baseId,
      activeValue,
      effectiveFocusedValue,
      handleSelect,
      orientation,
      density,
      activationMode,
      getTabId,
      getPanelId,
      registerTrigger,
      unregisterTrigger,
      registerPanel,
      unregisterPanel,
    ],
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
    forwardedRef,
  ) {
    const {
      baseId,
      value: activeValue,
      focusedValue,
      setFocusedValue,
      onSelect,
      orientation,
      activationMode,
      getTabId,
      getPanelId,
      registerTrigger,
      unregisterTrigger,
    } = useTabsContext('TabsTrigger');
    const btnRef = React.useRef<HTMLButtonElement | null>(null);
    const isSelected = activeValue === value;
    const isFocused = (focusedValue || activeValue) === value;
    const defaultTabId = `${baseId}-tab-${encodeTabValueForId(value)}`;
    const tabId = id || getTabId(value, id) || defaultTabId;
    const panelId = getPanelId(value);

    const setRefs = React.useCallback(
      (node: HTMLButtonElement | null) => {
        btnRef.current = node;
        if (typeof forwardedRef === 'function') {
          forwardedRef(node);
        } else if (forwardedRef) {
          (forwardedRef as React.MutableRefObject<HTMLButtonElement | null>).current = node;
        }
      },
      [forwardedRef],
    );

    const resolvedOwnTabId = id || defaultTabId;
    useIsomorphicLayoutEffect(() => {
      const node = btnRef.current;
      if (!node) return;
      registerTrigger(node, value, Boolean(disabled), resolvedOwnTabId);
      return () => {
        unregisterTrigger(node);
      };
    }, [registerTrigger, unregisterTrigger, value, disabled, resolvedOwnTabId]);

    return (
      <button
        ref={setRefs}
        id={tabId}
        type="button"
        role="tab"
        aria-selected={isSelected}
        aria-controls={panelId}
        data-state={isSelected ? 'active' : 'inactive'}
        data-value={value}
        disabled={disabled}
        tabIndex={disabled ? -1 : isFocused ? 0 : -1}
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
    const {
      baseId,
      value: activeValue,
      getTabId,
      getPanelId,
      registerPanel,
      unregisterPanel,
    } = useTabsContext('TabsContent');
    const isSelected = activeValue === value;
    const defaultPanelId = `${baseId}-panel-${encodeTabValueForId(value)}`;
    const resolvedOwnPanelId = id || defaultPanelId;
    const panelId = id || getPanelId(value, id) || defaultPanelId;
    const tabId = getTabId(value);

    useIsomorphicLayoutEffect(() => {
      registerPanel(value, resolvedOwnPanelId);
      return () => {
        unregisterPanel(value, resolvedOwnPanelId);
      };
    }, [registerPanel, unregisterPanel, value, resolvedOwnPanelId]);

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

(TabsContent as unknown as { f12IsTabsContent?: boolean }).f12IsTabsContent = true;
