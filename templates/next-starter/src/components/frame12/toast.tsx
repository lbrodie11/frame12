'use client';

import * as React from 'react';
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
  setViewportPaused: (paused: boolean) => void;
  registerCustomViewport?: () => () => void;
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
      const fnType = child.type as { f12IsToastViewport?: boolean };
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
  toastsRef.current = toasts;
  const [viewportPaused, setViewportPaused] = React.useState(false);
  const [customViewportCount, setCustomViewportCount] = React.useState(0);
  const seqRef = React.useRef(0);
  const safeMaxVisible = Math.max(1, maxVisible);

  const registerCustomViewport = React.useCallback(() => {
    setCustomViewportCount((c) => c + 1);
    return () => {
      setCustomViewportCount((c) => Math.max(0, c - 1));
    };
  }, []);

  const dismiss = React.useCallback((id?: string) => {
    const current = toastsRef.current;
    const target = !id ? current[0] : current.find((t) => t.id === id);
    if (!target) return;
    const targetId = target.id;
    const next = current.filter((t) => t.id !== targetId);
    toastsRef.current = next;
    setToasts(next);
    target.onDismiss?.(targetId);
  }, []);

  const dismissAll = React.useCallback(() => {
    const current = toastsRef.current;
    if (current.length === 0) return;
    toastsRef.current = [];
    setToasts([]);
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
      const nextItem: ToastItem = {
        status: 'neutral',
        dismissible: true,
        duration: defaultDuration,
        ...options,
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
      toastsRef.current = next;
      setToasts(next);
      return id;
    },
    [defaultDuration],
  );

  const visibleToasts = React.useMemo(
    () => toasts.slice(0, safeMaxVisible),
    [toasts, safeMaxVisible],
  );
  const queuedCount = Math.max(0, toasts.length - safeMaxVisible);

  React.useEffect(() => {
    if (visibleToasts.length === 0) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (
        document.querySelector(
          'dialog[open], [role="listbox"][data-state="open"], [role="menu"][data-state="open"]',
        )
      ) {
        return;
      }
      const dismissibleVisible = [...visibleToasts]
        .reverse()
        .find((t) => t.dismissible !== false);
      if (dismissibleVisible) {
        dismiss(dismissibleVisible.id);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [visibleToasts, dismiss]);

  const ctxValue = React.useMemo<ToastContextValue>(
    () => ({
      toasts,
      visibleToasts,
      queuedCount,
      maxVisible: safeMaxVisible,
      defaultDuration,
      density,
      viewportPaused,
      setViewportPaused,
      registerCustomViewport,
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
      registerCustomViewport,
      toast,
      dismiss,
      dismissAll,
    ],
  );

  const hasChildViewport = hasExplicitToastViewport(children) || customViewportCount > 0;

  return (
    <ToastContext.Provider value={ctxValue}>
      {children}
      {renderViewport && !hasChildViewport && (
        <DefaultViewportContext.Provider value={true}>
          <ToastViewport aria-label={label} />
        </DefaultViewportContext.Provider>
      )}
    </ToastContext.Provider>
  );
}

export interface ToastViewportProps extends React.HTMLAttributes<HTMLDivElement> {
  density?: ToastDensity;
  label?: string;
}

export const ToastViewport = React.forwardRef<HTMLDivElement, ToastViewportProps>(
  function ToastViewport(
    {
      density: propDensity,
      label = 'Notifications',
      'aria-label': userAriaLabel,
      className = '',
      onMouseEnter,
      onMouseLeave,
      onFocusCapture,
      onBlurCapture,
      children,
      ...rest
    },
    forwardedRef,
  ) {
    const ctx = React.useContext(ToastContext);
    const isDefaultViewport = React.useContext(DefaultViewportContext);
    const vpRef = React.useRef<HTMLDivElement | null>(null);
    const [hovered, setHovered] = React.useState(false);
    const [focused, setFocused] = React.useState(false);

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
    const queuedCount = ctx?.queuedCount ?? 0;
    const setViewportPaused = ctx?.setViewportPaused;

    React.useEffect(() => {
      setViewportPaused?.(hovered || focused);
    }, [hovered, focused, setViewportPaused]);

    return (
      <div
        ref={setRefs}
        role="region"
        aria-label={userAriaLabel ?? label}
        data-density={isCompact ? 'compact' : undefined}
        data-paused={hovered || focused ? 'true' : 'false'}
        data-queued-count={queuedCount}
        className={`f12-toast-viewport${isCompact ? ' f12-toast-viewport-compact' : ''}${className ? ` ${className}` : ''}`}
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
          if (!vpRef.current?.contains(e.relatedTarget as Node | null)) {
            setFocused(false);
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
  const effectiveDuration = duration ?? (onDismiss ? (ctx?.defaultDuration ?? 5000) : 0);
  const isPaused = Boolean(
    controlledPaused ?? (hovered || focused || ctx?.viewportPaused),
  );

  const remainingRef = React.useRef<number>(effectiveDuration);
  const startedAtRef = React.useRef<number>(Date.now());
  const onDismissRef = React.useRef(onDismiss);
  onDismissRef.current = onDismiss;

  React.useEffect(() => {
    remainingRef.current = effectiveDuration;
  }, [effectiveDuration, resetKey]);

  React.useEffect(() => {
    if (!onDismissRef.current || !effectiveDuration || effectiveDuration <= 0 || !Number.isFinite(effectiveDuration)) {
      return;
    }
    if (isPaused) {
      return;
    }
    startedAtRef.current = Date.now();
    const waitMs = Math.max(0, remainingRef.current);
    const timer = window.setTimeout(() => {
      remainingRef.current = 0;
      onDismissRef.current?.();
    }, waitMs);

    return () => {
      window.clearTimeout(timer);
      const elapsed = Date.now() - startedAtRef.current;
      remainingRef.current = Math.max(0, remainingRef.current - elapsed);
    };
  }, [isPaused, effectiveDuration, resetKey]);

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

  const resolvedRole = userRole ?? (status === 'danger' ? 'alert' : 'status');
  const resolvedAriaLive =
    userAriaLive ?? (status === 'danger' ? 'assertive' : 'polite');

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
        role={resolvedRole}
        aria-live={resolvedAriaLive}
        aria-atomic="true"
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
              <ToastClose aria-label={dismissLabel} onClick={onDismiss} />
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
  function ToastAction({ altText, className = '', children, ...rest }, ref) {
    return (
      <button
        ref={ref}
        type="button"
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
        if (!e.defaultPrevented && !onClick) {
          itemCtx?.onDismiss?.();
        }
      }}
      {...rest}
    >
      {children ?? <span aria-hidden="true">×</span>}
    </button>
  );
});
