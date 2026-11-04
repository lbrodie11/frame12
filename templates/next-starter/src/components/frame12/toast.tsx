'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import {
  type SemanticStatus,
  STATUS_GLYPHS,
  STATUS_SR_LABELS,
  extractTextContent,
  startsWithStatusLabel,
} from './tag';

export type ToastStatus = SemanticStatus;
export type ToastDensity = 'comfortable' | 'compact';

export interface ToastActionDescriptor {
  label: React.ReactNode;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  altText?: string;
}

export interface ToastItem {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  status?: ToastStatus;
  glyph?: string | false;
  srLabel?: string | false;
  duration?: number;
  action?: ToastActionDescriptor | React.ReactNode;
  dismissible?: boolean;
  dismissLabel?: string;
  onDismiss?: (id: string) => void;
  updateCount?: number;
}

export type ToastOptions = Omit<ToastItem, 'id'> & { id?: string };

export interface ToastContextValue {
  toasts: ToastItem[];
  visibleToasts: ToastItem[];
  queuedCount: number;
  maxVisible: number;
  defaultDuration: number;
  density: ToastDensity;
  viewportPaused: boolean;
  documentHidden: boolean;
  politeAnnouncement?: string;
  assertiveAnnouncement?: string;
  setViewportPaused: (paused: boolean) => void;
  registerCustomViewport?: () => () => void;
  getRemainingDuration?: (id: string, fallback: number) => number;
  setRemainingDuration?: (id: string, remaining: number) => void;
  toast: (options: ToastOptions) => string;
  dismiss: (id?: string) => void;
  dismissAll: () => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    throw new Error('[FRAME/12 useToast] must be used within <ToastProvider>.');
  }
  return ctx;
}

export function useOptionalToast(): ToastContextValue | null {
  return React.useContext(ToastContext);
}

const ToastItemContext = React.createContext<{
  id?: string;
  onDismiss?: () => void;
} | null>(null);

const DefaultViewportContext = React.createContext<boolean>(false);

function hasExplicitToastViewport(node: React.ReactNode): boolean {
  let found = false;
  const walk = (n: React.ReactNode) => {
    React.Children.forEach(n, (child) => {
      if (found || !React.isValidElement<Record<string, unknown>>(child)) return;
      const fnType = child.type as {
        f12IsToastViewport?: boolean;
        f12IsToastProvider?: boolean;
      };
      if (fnType?.f12IsToastProvider) {
        return;
      }
      if (fnType?.f12IsToastViewport) {
        found = true;
        return;
      }
      if (child.props?.children) {
        walk(child.props.children as React.ReactNode);
      }
    });
  };
  walk(node);
  return found;
}

function findTopmostModalDialog(): HTMLDialogElement | null {
  if (typeof document === 'undefined') return null;
  const openDialogs = document.querySelectorAll<HTMLDialogElement>('dialog[open]');
  for (let i = openDialogs.length - 1; i >= 0; i--) {
    const d = openDialogs[i];
    if (!d.isConnected || !d.open) continue;
    try {
      if (d.matches(':modal')) return d;
      if (typeof d.showModal === 'function' && document.querySelector('dialog:modal')) {
        continue;
      }
    } catch {
      // Fallback if :modal selector is unsupported
    }
    return d;
  }
  return null;
}

function extractActionAltText(action: ToastItem['action']): string | undefined {
  if (!action || typeof action !== 'object') return undefined;
  if (React.isValidElement<{ altText?: string }>(action)) {
    return typeof action.props?.altText === 'string' ? action.props.altText : undefined;
  }
  if ('altText' in action && typeof (action as ToastActionDescriptor).altText === 'string') {
    return (action as ToastActionDescriptor).altText;
  }
  return undefined;
}

function formatToastAnnouncement(item: ToastItem | undefined): string {
  if (!item) return '';
  const status = item.status ?? 'neutral';
  const resolvedSrLabel =
    item.srLabel === false
      ? undefined
      : item.srLabel !== undefined
        ? item.srLabel
        : STATUS_SR_LABELS[status];
  const combined = `${extractTextContent(item.title)} ${extractTextContent(item.description)}`.trim();
  const altText = extractActionAltText(item.action);
  const withAlt = altText ? `${combined}${combined ? ' ' : ''}(${altText})` : combined;
  if (!withAlt) return resolvedSrLabel ? `${resolvedSrLabel}` : '';
  const needsPrefix =
    Boolean(resolvedSrLabel) &&
    !(resolvedSrLabel && startsWithStatusLabel(withAlt, resolvedSrLabel, status));
  return needsPrefix ? `${resolvedSrLabel}: ${withAlt}` : withAlt;
}

export interface ToastProviderProps {
  maxVisible?: number;
  defaultDuration?: number;
  density?: ToastDensity;
  label?: string;
  renderViewport?: boolean;
  children?: React.ReactNode;
}

export function ToastProvider({
  maxVisible = 3,
  defaultDuration = 5000,
  density = 'comfortable',
  label = 'Notifications',
  renderViewport = true,
  children,
}: ToastProviderProps) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const toastsRef = React.useRef<ToastItem[]>([]);
  const remainingByIdRef = React.useRef<Map<string, number>>(new Map());
  const announcedKeysRef = React.useRef<Set<string>>(new Set());
  const activePoliteRef = React.useRef<{ id: string; key: string; text: string } | null>(null);
  const activeAssertiveRef = React.useRef<{ id: string; key: string; text: string } | null>(null);
  const politePulseTimerRef = React.useRef<number | null>(null);
  const assertivePulseTimerRef = React.useRef<number | null>(null);
  const [politeAnnouncement, setPoliteAnnouncement] = React.useState('');
  const [assertiveAnnouncement, setAssertiveAnnouncement] = React.useState('');
  const [viewportPaused, setViewportPaused] = React.useState(false);
  const [documentHidden, setDocumentHidden] = React.useState(false);
  const [customViewportCount, setCustomViewportCount] = React.useState(0);
  const seqRef = React.useRef(0);
  const safeMaxVisible = Math.max(1, maxVisible);

  React.useEffect(() => {
    return () => {
      if (politePulseTimerRef.current !== null) {
        window.clearTimeout(politePulseTimerRef.current);
      }
      if (assertivePulseTimerRef.current !== null) {
        window.clearTimeout(assertivePulseTimerRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    if (typeof document === 'undefined') return;
    const syncVisibility = () => {
      setDocumentHidden(document.hidden === true);
    };
    syncVisibility();
    document.addEventListener('visibilitychange', syncVisibility);
    return () => {
      document.removeEventListener('visibilitychange', syncVisibility);
    };
  }, []);

  const registerCustomViewport = React.useCallback(() => {
    setCustomViewportCount((c) => c + 1);
    return () => {
      setCustomViewportCount((c) => Math.max(0, c - 1));
    };
  }, []);

  const getRemainingDuration = React.useCallback((id: string, fallback: number) => {
    const saved = remainingByIdRef.current.get(id);
    return saved !== undefined ? saved : fallback;
  }, []);

  const setRemainingDuration = React.useCallback((id: string, remaining: number) => {
    if (toastsRef.current.some((t) => t.id === id)) {
      remainingByIdRef.current.set(id, remaining);
    }
  }, []);

  const dismiss = React.useCallback(
    (id?: string) => {
      const current = toastsRef.current;
      const visible = current.slice(0, safeMaxVisible);
      const target = !id
        ? (visible[visible.length - 1] ?? current[current.length - 1])
        : current.find((t) => t.id === id);
      if (!target) return;
      const targetId = target.id;
      const next = current.filter((t) => t.id !== targetId);
      toastsRef.current = next;
      remainingByIdRef.current.delete(targetId);
      for (const key of announcedKeysRef.current) {
        if (key.startsWith(`${targetId}:`)) {
          announcedKeysRef.current.delete(key);
        }
      }
      setToasts(() => [...toastsRef.current]);
      target.onDismiss?.(targetId);
    },
    [safeMaxVisible],
  );

  const dismissAll = React.useCallback(() => {
    const current = toastsRef.current;
    if (current.length === 0) return;
    toastsRef.current = [];
    remainingByIdRef.current.clear();
    announcedKeysRef.current.clear();
    activePoliteRef.current = null;
    activeAssertiveRef.current = null;
    if (politePulseTimerRef.current !== null) {
      window.clearTimeout(politePulseTimerRef.current);
      politePulseTimerRef.current = null;
    }
    if (assertivePulseTimerRef.current !== null) {
      window.clearTimeout(assertivePulseTimerRef.current);
      assertivePulseTimerRef.current = null;
    }
    setPoliteAnnouncement('');
    setAssertiveAnnouncement('');
    setToasts(() => [...toastsRef.current]);
    for (const item of current) {
      item.onDismiss?.(item.id);
    }
  }, []);

  const toast = React.useCallback(
    (options: ToastOptions): string => {
      seqRef.current += 1;
      const id = options.id ?? `f12-toast-${seqRef.current}`;
      const prev = toastsRef.current;
      const existingIdx = prev.findIndex((t) => t.id === id);
      const resolvedDuration =
        options.duration !== undefined
          ? options.duration
          : options.action !== undefined && defaultDuration > 0
            ? Math.max(defaultDuration, 10000)
            : defaultDuration;
      const nextItem: ToastItem = {
        status: 'neutral',
        dismissible: true,
        ...options,
        duration: resolvedDuration,
        id,
        updateCount: existingIdx !== -1 ? (prev[existingIdx].updateCount ?? 0) + 1 : 0,
      };
      let next: ToastItem[];
      if (existingIdx !== -1) {
        next = [...prev];
        next[existingIdx] = nextItem;
      } else {
        next = [...prev, nextItem];
      }
      remainingByIdRef.current.set(id, resolvedDuration);
      toastsRef.current = next;
      setToasts(() => [...toastsRef.current]);
      return id;
    },
    [defaultDuration],
  );

  const visibleToasts = React.useMemo(
    () => toasts.slice(0, safeMaxVisible),
    [toasts, safeMaxVisible],
  );
  const queuedCount = Math.max(0, toasts.length - safeMaxVisible);

  useIsomorphicLayoutEffect(() => {
    const politeCandidates = visibleToasts.filter((t) => (t.status ?? 'neutral') !== 'danger');
    const assertiveCandidates = visibleToasts.filter((t) => t.status === 'danger');

    const unannouncedPolite = politeCandidates.filter(
      (t) => !announcedKeysRef.current.has(`${t.id}:${t.updateCount ?? 0}`),
    );
    if (unannouncedPolite.length > 0) {
      for (const item of unannouncedPolite) {
        announcedKeysRef.current.add(`${item.id}:${item.updateCount ?? 0}`);
      }
      const newest = unannouncedPolite[unannouncedPolite.length - 1];
      const nextText = formatToastAnnouncement(newest);
      const prevText = activePoliteRef.current?.text ?? '';
      activePoliteRef.current = {
        id: newest.id,
        key: `${newest.id}:${newest.updateCount ?? 0}`,
        text: nextText,
      };
      if (politePulseTimerRef.current !== null) {
        window.clearTimeout(politePulseTimerRef.current);
        politePulseTimerRef.current = null;
      }
      if (prevText && prevText === nextText && typeof window !== 'undefined') {
        setPoliteAnnouncement('');
        politePulseTimerRef.current = window.setTimeout(() => {
          politePulseTimerRef.current = null;
          setPoliteAnnouncement(nextText);
        }, 40);
      } else {
        setPoliteAnnouncement(nextText);
      }
    } else if (
      activePoliteRef.current &&
      !politeCandidates.some(
        (t) => `${t.id}:${t.updateCount ?? 0}` === activePoliteRef.current?.key,
      )
    ) {
      if (politePulseTimerRef.current !== null) {
        window.clearTimeout(politePulseTimerRef.current);
        politePulseTimerRef.current = null;
      }
      activePoliteRef.current = null;
      setPoliteAnnouncement('');
    }

    const unannouncedAssertive = assertiveCandidates.filter(
      (t) => !announcedKeysRef.current.has(`${t.id}:${t.updateCount ?? 0}`),
    );
    if (unannouncedAssertive.length > 0) {
      for (const item of unannouncedAssertive) {
        announcedKeysRef.current.add(`${item.id}:${item.updateCount ?? 0}`);
      }
      const newest = unannouncedAssertive[unannouncedAssertive.length - 1];
      const nextText = formatToastAnnouncement(newest);
      const prevText = activeAssertiveRef.current?.text ?? '';
      activeAssertiveRef.current = {
        id: newest.id,
        key: `${newest.id}:${newest.updateCount ?? 0}`,
        text: nextText,
      };
      if (assertivePulseTimerRef.current !== null) {
        window.clearTimeout(assertivePulseTimerRef.current);
        assertivePulseTimerRef.current = null;
      }
      if (prevText && prevText === nextText && typeof window !== 'undefined') {
        setAssertiveAnnouncement('');
        assertivePulseTimerRef.current = window.setTimeout(() => {
          assertivePulseTimerRef.current = null;
          setAssertiveAnnouncement(nextText);
        }, 40);
      } else {
        setAssertiveAnnouncement(nextText);
      }
    } else if (
      activeAssertiveRef.current &&
      !assertiveCandidates.some(
        (t) => `${t.id}:${t.updateCount ?? 0}` === activeAssertiveRef.current?.key,
      )
    ) {
      if (assertivePulseTimerRef.current !== null) {
        window.clearTimeout(assertivePulseTimerRef.current);
        assertivePulseTimerRef.current = null;
      }
      activeAssertiveRef.current = null;
      setAssertiveAnnouncement('');
    }
  }, [visibleToasts]);

  const ctxValue = React.useMemo<ToastContextValue>(
    () => ({
      toasts,
      visibleToasts,
      queuedCount,
      maxVisible: safeMaxVisible,
      defaultDuration,
      density,
      viewportPaused,
      documentHidden,
      politeAnnouncement,
      assertiveAnnouncement,
      setViewportPaused,
      registerCustomViewport,
      getRemainingDuration,
      setRemainingDuration,
      toast,
      dismiss,
      dismissAll,
    }),
    [
      toasts,
      visibleToasts,
      queuedCount,
      safeMaxVisible,
      defaultDuration,
      density,
      viewportPaused,
      documentHidden,
      politeAnnouncement,
      assertiveAnnouncement,
      registerCustomViewport,
      getRemainingDuration,
      setRemainingDuration,
      toast,
      dismiss,
      dismissAll,
    ],
  );

  const hasChildViewport = hasExplicitToastViewport(children) || customViewportCount > 0;

  return (
    <ToastContext.Provider value={ctxValue}>
      {children}
      {!renderViewport && !hasChildViewport && (
        <>
          <div className="f12-sr-only" aria-live="polite" aria-atomic="true">
            {politeAnnouncement}
          </div>
          <div className="f12-sr-only" aria-live="assertive" aria-atomic="true">
            {assertiveAnnouncement}
          </div>
        </>
      )}
      {renderViewport && !hasChildViewport && (
        <DefaultViewportContext.Provider value={true}>
          <ToastViewport aria-label={label} />
        </DefaultViewportContext.Provider>
      )}
    </ToastContext.Provider>
  );
}

(ToastProvider as unknown as { f12IsToastProvider?: boolean }).f12IsToastProvider = true;

export interface ToastViewportProps extends React.HTMLAttributes<HTMLDivElement> {
  density?: ToastDensity;
  label?: string;
  hotkey?: string;
}

export const ToastViewport = React.forwardRef<HTMLDivElement, ToastViewportProps>(
  function ToastViewport(
    {
      density: propDensity,
      label = 'Notifications',
      hotkey = 'F8',
      'aria-label': userAriaLabel,
      className = '',
      onMouseEnter,
      onMouseLeave,
      onFocusCapture,
      onBlurCapture,
      onKeyDown,
      children,
      ...rest
    },
    forwardedRef,
  ) {
    const ctx = React.useContext(ToastContext);
    const isDefaultViewport = React.useContext(DefaultViewportContext);
    const vpRef = React.useRef<HTMLDivElement | null>(null);
    const anchorRef = React.useRef<HTMLSpanElement | null>(null);
    const preFocusElementRef = React.useRef<HTMLElement | null>(null);
    const hadFocusInsideRef = React.useRef<boolean>(false);
    const prevIdsRef = React.useRef<string[]>([]);
    const lastPointerPosRef = React.useRef<{ x: number; y: number } | null>(null);
    const ignoreStationaryEnterRef = React.useRef<boolean>(false);
    const [hovered, setHovered] = React.useState(false);
    const [focused, setFocused] = React.useState(false);
    const [modalDialogHost, setModalDialogHost] = React.useState<HTMLDialogElement | null>(null);

    const registerCustomViewport = ctx?.registerCustomViewport;
    useIsomorphicLayoutEffect(() => {
      if (isDefaultViewport || !registerCustomViewport) return;
      return registerCustomViewport();
    }, [isDefaultViewport, registerCustomViewport]);

    const setRefs = React.useCallback(
      (node: HTMLDivElement | null) => {
        vpRef.current = node;
        if (typeof forwardedRef === 'function') {
          forwardedRef(node);
        } else if (forwardedRef) {
          (forwardedRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }
      },
      [forwardedRef],
    );

    const effectiveDensity = propDensity ?? ctx?.density ?? 'comfortable';
    const isCompact = effectiveDensity === 'compact';
    const visibleToasts = ctx?.visibleToasts ?? [];
    const visibleIdsKey = visibleToasts.map((t) => t.id).join('\0');
    const queuedCount = ctx?.queuedCount ?? 0;
    const setViewportPaused = ctx?.setViewportPaused;

    const hasVisibleToasts = visibleToasts.length > 0;

    useIsomorphicLayoutEffect(() => {
      if (typeof document === 'undefined') return;
      const syncDialogHost = () => {
        const topmost = findTopmostModalDialog();
        const anchorDialog = anchorRef.current?.closest('dialog[open]') as HTMLDialogElement | null;
        if (topmost && topmost !== anchorDialog) {
          setModalDialogHost((prev) => (prev === topmost ? prev : topmost));
        } else {
          setModalDialogHost((prev) => (prev === null ? prev : null));
        }
      };
      syncDialogHost();
      const observer =
        typeof MutationObserver !== 'undefined'
          ? new MutationObserver(() => syncDialogHost())
          : null;
      if (observer && document.documentElement) {
        observer.observe(document.documentElement, {
          subtree: true,
          childList: hasVisibleToasts,
          attributes: true,
          attributeFilter: ['open'],
        });
      }
      document.addEventListener('close', syncDialogHost, true);
      return () => {
        observer?.disconnect();
        document.removeEventListener('close', syncDialogHost, true);
      };
    }, [hasVisibleToasts, visibleIdsKey]);

    const needsViewportTabStop =
      visibleToasts.length > 0 &&
      visibleToasts.every((t) => t.dismissible === false && !t.action);

    // Reconcile focus and hover whenever visibleToasts changes so unmounting a toast
    // by click or keyboard never leaves the viewport stuck in a paused state.
    useIsomorphicLayoutEffect(() => {
      const currentIds = visibleIdsKey ? visibleIdsKey.split('\0') : [];
      const prevIds = prevIdsRef.current;
      const removedAny = prevIds.some((id) => !currentIds.includes(id));
      prevIdsRef.current = currentIds;

      const vp = vpRef.current;
      const isControlInside = (el: Element | null) =>
        Boolean(
          vp &&
            el &&
            el !== document.body &&
            (needsViewportTabStop ? vp.contains(el) : el !== vp && vp.contains(el)),
        );
      const active = typeof document !== 'undefined' ? document.activeElement : null;
      let activeInside = isControlInside(active);

      if (hadFocusInsideRef.current && !activeInside) {
        hadFocusInsideRef.current = false;
        const restoreEl = preFocusElementRef.current;
        preFocusElementRef.current = null;
        if (
          restoreEl &&
          restoreEl.isConnected &&
          typeof restoreEl.focus === 'function' &&
          !restoreEl.closest('[inert], dialog:not([open])')
        ) {
          try {
            restoreEl.focus({ preventScroll: true });
          } catch {
            // Ignore focus restoration errors
          }
        } else if (vp && active === vp && !needsViewportTabStop) {
          vp.blur();
        }
        const nextActive = typeof document !== 'undefined' ? document.activeElement : null;
        activeInside = isControlInside(nextActive);
      }

      if (currentIds.length === 0) {
        ignoreStationaryEnterRef.current = false;
        hadFocusInsideRef.current = false;
        setFocused(false);
        setHovered(false);
        setViewportPaused?.(false);
        return;
      }

      if (removedAny) {
        ignoreStationaryEnterRef.current = true;
        setFocused(activeInside);
        setHovered(false);
        setViewportPaused?.(activeInside);
      } else if (!activeInside && focused) {
        setFocused(false);
        setViewportPaused?.(hovered);
      }
    }, [visibleIdsKey, focused, hovered, needsViewportTabStop, setViewportPaused]);

    React.useEffect(() => {
      if (!focused || typeof document === 'undefined') return;
      const handleFocusIn = (e: FocusEvent) => {
        const vp = vpRef.current;
        if (vp && e.target instanceof Node && !vp.contains(e.target)) {
          hadFocusInsideRef.current = false;
          setFocused(false);
        }
      };
      document.addEventListener('focusin', handleFocusIn, true);
      return () => {
        document.removeEventListener('focusin', handleFocusIn, true);
      };
    }, [focused]);

    React.useEffect(() => {
      setViewportPaused?.(hovered || focused);
    }, [hovered, focused, setViewportPaused]);

    React.useEffect(() => {
      if (!hotkey || visibleToasts.length === 0 || typeof document === 'undefined') return;
      const handleHotkey = (e: KeyboardEvent) => {
        if (e.key !== hotkey || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
        const vp = vpRef.current;
        if (!vp) return;
        const controls = vp.querySelectorAll<HTMLElement>(
          '.f12-toast-action:not([disabled]), .f12-toast-close:not([disabled])',
        );
        const target = controls.length > 0 ? controls[controls.length - 1] : vp;
        if (target) {
          e.preventDefault();
          if (
            document.activeElement instanceof HTMLElement &&
            !vp.contains(document.activeElement)
          ) {
            preFocusElementRef.current = document.activeElement;
          }
          target.focus();
        }
      };
      document.addEventListener('keydown', handleHotkey);
      return () => {
        document.removeEventListener('keydown', handleHotkey);
      };
    }, [hotkey, visibleToasts.length]);

    const viewportNode = (
      <div
        ref={setRefs}
        role="region"
        aria-label={userAriaLabel ?? label}
        tabIndex={needsViewportTabStop ? 0 : undefined}
        data-density={isCompact ? 'compact' : undefined}
        data-paused={hovered || focused ? 'true' : 'false'}
        data-queued-count={queuedCount}
        className={`f12-toast-viewport${isCompact ? ' f12-toast-viewport-compact' : ''}${className ? ` ${className}` : ''}`}
        onPointerDownCapture={(e) => {
          lastPointerPosRef.current = { x: e.clientX, y: e.clientY };
        }}
        onMouseDownCapture={(e) => {
          lastPointerPosRef.current = { x: e.clientX, y: e.clientY };
        }}
        onMouseEnter={(e) => {
          onMouseEnter?.(e);
          if (e.relatedTarget instanceof Node && !e.relatedTarget.isConnected) {
            return;
          }
          if (ignoreStationaryEnterRef.current) {
            const last = lastPointerPosRef.current;
            if (last && Math.abs(e.clientX - last.x) <= 2 && Math.abs(e.clientY - last.y) <= 2) {
              return;
            }
            ignoreStationaryEnterRef.current = false;
          }
          lastPointerPosRef.current = { x: e.clientX, y: e.clientY };
          if (visibleToasts.length > 0) {
            setHovered(true);
          }
        }}
        onMouseMove={(e) => {
          if (ignoreStationaryEnterRef.current) {
            const last = lastPointerPosRef.current;
            if (last && Math.abs(e.clientX - last.x) <= 2 && Math.abs(e.clientY - last.y) <= 2) {
              return;
            }
            ignoreStationaryEnterRef.current = false;
          }
          lastPointerPosRef.current = { x: e.clientX, y: e.clientY };
          if (!hovered && visibleToasts.length > 0) {
            setHovered(true);
          }
        }}
        onMouseLeave={(e) => {
          onMouseLeave?.(e);
          if (e.relatedTarget instanceof Node && !e.relatedTarget.isConnected) {
            return;
          }
          ignoreStationaryEnterRef.current = false;
          setHovered(false);
        }}
        onFocusCapture={(e) => {
          onFocusCapture?.(e);
          if (!needsViewportTabStop && e.target === vpRef.current) {
            return;
          }
          if (
            e.relatedTarget instanceof HTMLElement &&
            !vpRef.current?.contains(e.relatedTarget)
          ) {
            preFocusElementRef.current = e.relatedTarget;
          }
          hadFocusInsideRef.current = true;
          setFocused(true);
        }}
        onBlurCapture={(e) => {
          onBlurCapture?.(e);
          const nextTarget = e.relatedTarget as Node | null;
          const nextInside = Boolean(
            vpRef.current &&
              nextTarget &&
              (needsViewportTabStop
                ? vpRef.current.contains(nextTarget)
                : nextTarget !== vpRef.current && vpRef.current.contains(nextTarget)),
          );
          if (!nextInside) {
            hadFocusInsideRef.current = false;
            setFocused(false);
          }
        }}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          if (e.key === 'Escape' && !e.defaultPrevented) {
            const dismissibleVisible = [...visibleToasts]
              .reverse()
              .find((t) => t.dismissible !== false);
            if (dismissibleVisible) {
              e.preventDefault();
              e.stopPropagation();
              ctx?.dismiss(dismissibleVisible.id);
            }
          }
        }}
        {...rest}
      >
        {visibleToasts.map((item) => {
          const isDescriptor =
            Boolean(item.action) &&
            typeof item.action === 'object' &&
            !React.isValidElement(item.action) &&
            'label' in (item.action as ToastActionDescriptor) &&
            'onClick' in (item.action as ToastActionDescriptor);
          const actionNode = isDescriptor ? (
            <ToastAction
              altText={(item.action as ToastActionDescriptor).altText}
              onClick={(item.action as ToastActionDescriptor).onClick}
            >
              {(item.action as ToastActionDescriptor).label}
            </ToastAction>
          ) : (
            (item.action as React.ReactNode)
          );

          return (
            <Toast
              key={item.id}
              id={item.id}
              status={item.status}
              glyph={item.glyph}
              srLabel={item.srLabel}
              title={item.title}
              description={item.description}
              action={actionNode}
              duration={item.duration}
              resetKey={item.updateCount}
              dismissible={item.dismissible}
              dismissLabel={item.dismissLabel}
              density={effectiveDensity}
              onDismiss={() => ctx?.dismiss(item.id)}
            />
          );
        })}
        {queuedCount > 0 && (
          <div className="f12-toast-queue-badge" aria-live="off">
            {`+${queuedCount} QUEUED`}
          </div>
        )}
        {children}
      </div>
    );

    const portaledContent = (
      <>
        {ctx && (
          <>
            <div className="f12-sr-only" aria-live="polite" aria-atomic="true">
              {ctx.politeAnnouncement ?? ''}
            </div>
            <div className="f12-sr-only" aria-live="assertive" aria-atomic="true">
              {ctx.assertiveAnnouncement ?? ''}
            </div>
          </>
        )}
        {viewportNode}
      </>
    );

    return (
      <>
        <span ref={anchorRef} style={{ display: 'none' }} aria-hidden="true" />
        {modalDialogHost ? createPortal(portaledContent, modalDialogHost) : portaledContent}
      </>
    );
  },
);

(ToastViewport as unknown as { f12IsToastViewport?: boolean }).f12IsToastViewport = true;

export interface ToastProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  status?: ToastStatus;
  title?: React.ReactNode;
  description?: React.ReactNode;
  glyph?: string | false;
  srLabel?: string | false;
  action?: React.ReactNode;
  duration?: number;
  resetKey?: number;
  paused?: boolean;
  dismissible?: boolean;
  dismissLabel?: string;
  density?: ToastDensity;
  onDismiss?: () => void;
}

export const Toast = React.forwardRef<HTMLDivElement, ToastProps>(function Toast(
  {
    id,
    status = 'neutral',
    title,
    description,
    glyph,
    srLabel,
    action,
    duration,
    resetKey = 0,
    paused: controlledPaused,
    dismissible = true,
    dismissLabel = 'Dismiss notification',
    density,
    onDismiss,
    role: userRole,
    'aria-live': userAriaLive,
    className = '',
    onMouseEnter,
    onMouseLeave,
    onFocusCapture,
    onBlurCapture,
    onKeyDown,
    children,
    ...rest
  },
  forwardedRef,
) {
  const ctx = React.useContext(ToastContext);
  const toastRef = React.useRef<HTMLDivElement | null>(null);
  const [hovered, setHovered] = React.useState(false);
  const [focused, setFocused] = React.useState(false);

  const effectiveDensity = density ?? ctx?.density ?? 'comfortable';
  const isCompact = effectiveDensity === 'compact';
  const fallbackDefault = ctx?.defaultDuration ?? 5000;
  const effectiveDuration =
    duration ??
    (onDismiss
      ? action && fallbackDefault > 0
        ? Math.max(fallbackDefault, 10000)
        : fallbackDefault
      : 0);
  const isPaused = Boolean(
    controlledPaused ??
      (ctx ? ctx.viewportPaused || ctx.documentHidden : hovered || focused),
  );

  const initialRemaining =
    id && ctx?.getRemainingDuration
      ? ctx.getRemainingDuration(id, effectiveDuration)
      : effectiveDuration;
  const remainingRef = React.useRef<number>(initialRemaining);
  const prevResetKeyRef = React.useRef<number>(resetKey);
  const prevDurationRef = React.useRef<number>(effectiveDuration);
  const startedAtRef = React.useRef<number>(Date.now());
  const onDismissRef = React.useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const setRemainingDuration = ctx?.setRemainingDuration;

  React.useEffect(() => {
    if (prevResetKeyRef.current !== resetKey || prevDurationRef.current !== effectiveDuration) {
      prevResetKeyRef.current = resetKey;
      prevDurationRef.current = effectiveDuration;
      remainingRef.current = effectiveDuration;
      if (id && setRemainingDuration) {
        setRemainingDuration(id, effectiveDuration);
      }
    }
    if (
      !onDismissRef.current ||
      !effectiveDuration ||
      effectiveDuration <= 0 ||
      !Number.isFinite(effectiveDuration)
    ) {
      return;
    }
    if (isPaused) {
      return;
    }
    startedAtRef.current = Date.now();
    const waitMs = Math.max(0, remainingRef.current);
    const timer = window.setTimeout(() => {
      remainingRef.current = 0;
      if (id && setRemainingDuration) {
        setRemainingDuration(id, 0);
      }
      onDismissRef.current?.();
    }, waitMs);

    return () => {
      window.clearTimeout(timer);
      const elapsed = Date.now() - startedAtRef.current;
      const nextRemaining = Math.max(0, remainingRef.current - elapsed);
      remainingRef.current = nextRemaining;
      if (id && setRemainingDuration) {
        setRemainingDuration(id, nextRemaining);
      }
    };
  }, [isPaused, effectiveDuration, resetKey, id, setRemainingDuration]);

  const setRefs = React.useCallback(
    (node: HTMLDivElement | null) => {
      toastRef.current = node;
      if (typeof forwardedRef === 'function') {
        forwardedRef(node);
      } else if (forwardedRef) {
        (forwardedRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }
    },
    [forwardedRef],
  );

  const resolvedGlyph =
    glyph === false
      ? undefined
      : glyph !== undefined
        ? glyph
        : STATUS_GLYPHS[status];

  const resolvedSrLabel =
    srLabel === false
      ? undefined
      : srLabel !== undefined
        ? srLabel
        : STATUS_SR_LABELS[status];

  const combinedText = `${extractTextContent(title)} ${extractTextContent(description)} ${extractTextContent(children)}`.trim();
  const showSrLabel =
    Boolean(resolvedSrLabel) &&
    !(
      combinedText &&
      resolvedSrLabel &&
      startsWithStatusLabel(combinedText, resolvedSrLabel, status)
    );

  const itemCtx = React.useMemo(
    () => ({ id, onDismiss }),
    [id, onDismiss],
  );

  return (
    <ToastItemContext.Provider value={itemCtx}>
      <div
        ref={setRefs}
        id={id}
        role={userRole}
        aria-live={userAriaLive}
        aria-atomic={userRole || userAriaLive ? 'true' : undefined}
        data-status={status}
        data-paused={isPaused ? 'true' : 'false'}
        data-density={isCompact ? 'compact' : undefined}
        className={`f12-toast f12-toast-${status} f12-enter${isCompact ? ' f12-toast-compact' : ''}${className ? ` ${className}` : ''}`}
        onMouseEnter={(e) => {
          onMouseEnter?.(e);
          setHovered(true);
        }}
        onMouseLeave={(e) => {
          onMouseLeave?.(e);
          setHovered(false);
        }}
        onFocusCapture={(e) => {
          onFocusCapture?.(e);
          setFocused(true);
        }}
        onBlurCapture={(e) => {
          onBlurCapture?.(e);
          if (!toastRef.current?.contains(e.relatedTarget as Node | null)) {
            setFocused(false);
          }
        }}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          if (e.key === 'Escape' && !e.defaultPrevented && dismissible && onDismiss) {
            e.preventDefault();
            e.stopPropagation();
            onDismiss();
          }
        }}
        {...rest}
      >
        {resolvedGlyph && (
          <span className="f12-toast-glyph f12-status-glyph" aria-hidden="true">
            {resolvedGlyph}
          </span>
        )}
        <div className="f12-toast-body">
          {showSrLabel && <span className="f12-sr-only">{`${resolvedSrLabel}: `}</span>}
          {title && <div className="f12-toast-title">{title}</div>}
          {description && <div className="f12-toast-description">{description}</div>}
          {children}
        </div>
        {(action || (dismissible && onDismiss)) && (
          <div className="f12-toast-controls">
            {action}
            {dismissible && onDismiss && (
              <ToastClose aria-label={dismissLabel} />
            )}
          </div>
        )}
      </div>
    </ToastItemContext.Provider>
  );
});

export type ToastTitleProps = React.HTMLAttributes<HTMLDivElement>;

export const ToastTitle = React.forwardRef<HTMLDivElement, ToastTitleProps>(function ToastTitle(
  { className = '', children, ...rest },
  ref,
) {
  return (
    <div ref={ref} className={`f12-toast-title${className ? ` ${className}` : ''}`} {...rest}>
      {children}
    </div>
  );
});

export type ToastDescriptionProps = React.HTMLAttributes<HTMLDivElement>;

export const ToastDescription = React.forwardRef<HTMLDivElement, ToastDescriptionProps>(
  function ToastDescription({ className = '', children, ...rest }, ref) {
    return (
      <div
        ref={ref}
        className={`f12-toast-description${className ? ` ${className}` : ''}`}
        {...rest}
      >
        {children}
      </div>
    );
  },
);

export interface ToastActionProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  altText?: string;
}

export const ToastAction = React.forwardRef<HTMLButtonElement, ToastActionProps>(
  function ToastAction({ altText, 'aria-label': userAriaLabel, className = '', children, ...rest }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        aria-label={userAriaLabel}
        data-alt-text={altText}
        className={`f12-toast-action${className ? ` ${className}` : ''}`}
        {...rest}
      >
        {children}
      </button>
    );
  },
);

export type ToastCloseProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

export const ToastClose = React.forwardRef<HTMLButtonElement, ToastCloseProps>(function ToastClose(
  { 'aria-label': ariaLabel = 'Dismiss notification', className = '', onClick, children, ...rest },
  ref,
) {
  const itemCtx = React.useContext(ToastItemContext);
  return (
    <button
      ref={ref}
      type="button"
      aria-label={ariaLabel}
      className={`f12-toast-close${className ? ` ${className}` : ''}`}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) {
          itemCtx?.onDismiss?.();
        }
      }}
      {...rest}
    >
      {children ?? <span aria-hidden="true">×</span>}
    </button>
  );
});
