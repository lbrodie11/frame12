'use client';

import * as React from 'react';
import { Button, type ButtonProps } from './button';

const useIsoLayoutEffect = typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;

const openDialogStack: HTMLDialogElement[] = [];
let dialogObserver: MutationObserver | null = null;

function pushOpenDialog(el: HTMLDialogElement) {
  const idx = openDialogStack.indexOf(el);
  if (idx !== -1) openDialogStack.splice(idx, 1);
  openDialogStack.push(el);
}

function removeOpenDialog(el: HTMLDialogElement) {
  const idx = openDialogStack.indexOf(el);
  if (idx !== -1) openDialogStack.splice(idx, 1);
}

function processDialogMutations(records: MutationRecord[]) {
  for (const rec of records) {
    if (rec.type === 'attributes' && rec.attributeName === 'open') {
      const target = rec.target;
      if (typeof HTMLDialogElement !== 'undefined' && target instanceof HTMLDialogElement) {
        if (target.open && target.isConnected) {
          pushOpenDialog(target);
        } else {
          removeOpenDialog(target);
        }
      }
    }
  }
}

function ensureDialogObserver() {
  if (dialogObserver || typeof document === 'undefined' || typeof MutationObserver === 'undefined') {
    return;
  }
  for (const d of document.querySelectorAll<HTMLDialogElement>('dialog[open]')) {
    pushOpenDialog(d);
  }
  dialogObserver = new MutationObserver(processDialogMutations);
  if (document.documentElement) {
    dialogObserver.observe(document.documentElement, {
      subtree: true,
      attributes: true,
      attributeFilter: ['open'],
    });
  }
}

function isModalDialog(d: HTMLDialogElement): boolean {
  if (!d.isConnected || !d.open) return false;
  try {
    if (d.matches(':modal')) return true;
    // In environments where showModal() is supported, non-modal .show() dialogs do not match :modal
    if (typeof d.showModal === 'function' && document.querySelector('dialog:modal')) {
      return false;
    }
  } catch {
    // Fallback if :modal selector is unsupported
  }
  return true;
}

function getTopmostOpenDialog(): HTMLDialogElement | undefined {
  ensureDialogObserver();
  if (dialogObserver) {
    processDialogMutations(dialogObserver.takeRecords());
  }
  for (let i = openDialogStack.length - 1; i >= 0; i--) {
    const d = openDialogStack[i];
    if (isModalDialog(d)) return d;
    if (!d.isConnected || !d.open) {
      openDialogStack.splice(i, 1);
    }
  }
  const fallback = document.querySelectorAll<HTMLDialogElement>('dialog[open]');
  for (let i = fallback.length - 1; i >= 0; i--) {
    if (isModalDialog(fallback[i])) return fallback[i];
  }
  return undefined;
}

function mergeRefs<T>(
  ...refs: Array<React.Ref<T> | undefined>
): React.RefCallback<T> {
  return (value: T) => {
    for (const ref of refs) {
      if (typeof ref === 'function') {
        ref(value);
      } else if (ref != null) {
        (ref as React.MutableRefObject<T | null>).current = value;
      }
    }
  };
}

interface DialogContextValue {
  open: boolean;
  setOpen: (next: boolean) => void;
  titleId: string;
  descId: string;
  hasDescription: boolean;
  setHasDescription: (present: boolean) => void;
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  returnFocusRef: React.MutableRefObject<HTMLElement | null>;
  restoreFocus: () => void;
}

const DialogContext = React.createContext<DialogContextValue | null>(null);

function useDialogContext() {
  const ctx = React.useContext(DialogContext);
  if (!ctx) throw new Error('Dialog subcomponents must be used within <Dialog>');
  return ctx;
}

export interface DialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}

export function Dialog({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  children,
}: DialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState<boolean>(defaultOpen);
  const [hasDescription, setHasDescription] = React.useState<boolean>(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const openRef = React.useRef<boolean>(open);
  openRef.current = open;
  const onOpenChangeRef = React.useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  const dialogRef = React.useRef<HTMLDialogElement | null>(null);
  const returnFocusRef = React.useRef<HTMLElement | null>(null);
  const rawId = React.useId().replace(/:/g, '');
  const titleId = `f12-dlg-title-${rawId}`;
  const descId = `f12-dlg-desc-${rawId}`;

  const restoreFocus = React.useCallback(() => {
    const opener = returnFocusRef.current;
    returnFocusRef.current = null;
    if (!opener || !opener.isConnected || typeof opener.focus !== 'function') return;
    const active = typeof document !== 'undefined' ? document.activeElement : null;
    const el = dialogRef.current;
    if (
      !active ||
      active === document.body ||
      active === document.documentElement ||
      (el && el.contains(active))
    ) {
      opener.focus({ preventScroll: true });
    }
  }, []);

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (openRef.current === next) return;
      if (
        next &&
        !returnFocusRef.current &&
        typeof document !== 'undefined' &&
        document.activeElement instanceof HTMLElement &&
        document.activeElement !== document.body &&
        document.activeElement !== document.documentElement &&
        (!dialogRef.current || !dialogRef.current.contains(document.activeElement))
      ) {
        returnFocusRef.current = document.activeElement;
      }
      openRef.current = next;
      if (!isControlled) setUncontrolledOpen(next);
      onOpenChangeRef.current?.(next);
    },
    [isControlled],
  );

  React.useEffect(() => {
    ensureDialogObserver();
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) {
      if (
        !returnFocusRef.current &&
        typeof document !== 'undefined' &&
        document.activeElement instanceof HTMLElement &&
        document.activeElement !== document.body &&
        document.activeElement !== document.documentElement &&
        !el.contains(document.activeElement)
      ) {
        returnFocusRef.current = document.activeElement;
      }
      if (typeof el.showModal === 'function') el.showModal();
      else el.setAttribute('open', '');
      pushOpenDialog(el);
    } else if (open && el.open) {
      pushOpenDialog(el);
    } else if (!open && el.open) {
      removeOpenDialog(el);
      if (typeof el.close === 'function') el.close();
      else el.removeAttribute('open');
      restoreFocus();
    } else {
      removeOpenDialog(el);
    }
  }, [open, restoreFocus]);

  return (
    <DialogContext.Provider
      value={{
        open,
        setOpen,
        titleId,
        descId,
        hasDescription,
        setHasDescription,
        dialogRef,
        returnFocusRef,
        restoreFocus,
      }}
    >
      {children}
    </DialogContext.Provider>
  );
}

export interface DialogTriggerProps extends ButtonProps {
  asChild?: boolean;
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

export const DialogTrigger = React.forwardRef<HTMLButtonElement, DialogTriggerProps>(
  function DialogTrigger(
    { asChild = false, onClick, className = '', children, ...rest },
    forwardedRef,
  ) {
    const { setOpen, returnFocusRef } = useDialogContext();
    const childRef = React.isValidElement(children) ? getElementRef(children) : undefined;
    const composedRef = React.useMemo(
      () => mergeRefs(forwardedRef, childRef),
      [forwardedRef, childRef],
    );
    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<Record<string, unknown>>;
      const childProps = child.props || {};
      const mergedClassName =
        [childProps.className, className].filter(Boolean).join(' ') || undefined;
      return React.cloneElement(child, {
        ...rest,
        ...childProps,
        className: mergedClassName,
        ref: composedRef,
        onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
          onClick?.(e);
          if (typeof childProps.onClick === 'function') {
            (childProps.onClick as (ev: React.MouseEvent<HTMLButtonElement>) => void)(e);
          }
          if (!e.defaultPrevented) {
            if (e.currentTarget instanceof HTMLElement) {
              returnFocusRef.current = e.currentTarget;
            }
            setOpen(true);
          }
        },
      });
    }
    return (
      <Button
        ref={forwardedRef}
        className={className}
        onClick={(e) => {
          onClick?.(e);
          if (!e.defaultPrevented) {
            if (e.currentTarget instanceof HTMLElement) {
              returnFocusRef.current = e.currentTarget;
            }
            setOpen(true);
          }
        }}
        {...rest}
      >
        {children}
      </Button>
    );
  },
);

export interface DialogContentProps extends React.DialogHTMLAttributes<HTMLDialogElement> {
  cut?: string;
}

export const DialogContent = React.forwardRef<HTMLDialogElement, DialogContentProps>(
  function DialogContent(
    {
      cut,
      className = '',
      onPointerDown,
      onPointerUp,
      onCancel,
      onKeyDown,
      'aria-describedby': userDescribedBy,
      children,
      ...rest
    },
    forwardedRef,
  ) {
    const { setOpen, titleId, descId, hasDescription, dialogRef, restoreFocus } =
      useDialogContext();
    const pressedOutside = React.useRef<boolean>(false);
    const childPopupOpenOnEscapeRef = React.useRef<boolean>(false);

    React.useEffect(() => {
      const el = dialogRef.current;
      if (!el) return;
      const onClose = () => {
        removeOpenDialog(el);
        setOpen(false);
        restoreFocus();
      };
      // Capture Escape keydown at document capture phase BEFORE Radix DismissableLayer
      // unmounts the open listbox/menu, so we know whether Escape was consumed by a child popup.
      const onDocKeyDownCapture = (e: KeyboardEvent) => {
        if (e.key !== 'Escape') return;
        if (el.querySelector('[role="listbox"], [role="menu"]')) {
          childPopupOpenOnEscapeRef.current = true;
          setTimeout(() => {
            childPopupOpenOnEscapeRef.current = false;
          }, 0);
        }
      };
      const onDocKeyDown = (e: KeyboardEvent) => {
        if (e.key !== 'Escape' || !el.open) return;
        if (getTopmostOpenDialog() !== el) {
          return;
        }
        if (
          e.defaultPrevented ||
          childPopupOpenOnEscapeRef.current ||
          el.querySelector('[role="listbox"], [role="menu"]')
        ) {
          return;
        }
        e.preventDefault();
        const cancelEvent = new Event('cancel', { bubbles: false, cancelable: true });
        const shouldClose = el.dispatchEvent(cancelEvent);
        if (!shouldClose || cancelEvent.defaultPrevented) {
          return;
        }
        removeOpenDialog(el);
        el.close();
        setOpen(false);
        restoreFocus();
      };
      el.addEventListener('close', onClose);
      document.addEventListener('keydown', onDocKeyDownCapture, true);
      document.addEventListener('keydown', onDocKeyDown);
      return () => {
        if (!el.open || !el.isConnected) {
          removeOpenDialog(el);
        }
        el.removeEventListener('close', onClose);
        document.removeEventListener('keydown', onDocKeyDownCapture, true);
        document.removeEventListener('keydown', onDocKeyDown);
      };
    }, [dialogRef, setOpen, restoreFocus]);

    // Fallback for browsers where <dialog closedby="any"> is not yet supported:
    // test pointer coordinates against the dialog bounding box on pointerdown + pointerup.
    const isOutside = (e: React.PointerEvent<HTMLDialogElement>, dialog: HTMLDialogElement) => {
      const r = dialog.getBoundingClientRect();
      return (
        e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom
      );
    };

    const resolvedDescribedBy = userDescribedBy ?? (hasDescription ? descId : undefined);
    const composedDialogRef = React.useMemo(
      () => mergeRefs(dialogRef, forwardedRef),
      [dialogRef, forwardedRef],
    );

    return (
      <dialog
        ref={composedDialogRef}
        className={`f12-dialog${className ? ` ${className}` : ''}`}
        aria-labelledby={titleId}
        aria-describedby={resolvedDescribedBy}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          if (e.key === 'Escape' && childPopupOpenOnEscapeRef.current) {
            e.preventDefault();
          }
        }}
        onCancel={(e) => {
          onCancel?.(e);
          if (
            childPopupOpenOnEscapeRef.current ||
            dialogRef.current?.querySelector('[role="listbox"], [role="menu"]')
          ) {
            e.preventDefault();
            childPopupOpenOnEscapeRef.current = false;
          }
        }}
        onPointerDown={(e) => {
          onPointerDown?.(e);
          if (e.defaultPrevented) return;
          const el = dialogRef.current;
          if (!el || el.querySelector('[role="listbox"], [role="menu"]')) {
            pressedOutside.current = false;
            return;
          }
          pressedOutside.current = e.target === el && isOutside(e, el);
        }}
        onPointerUp={(e) => {
          onPointerUp?.(e);
          if (e.defaultPrevented) {
            pressedOutside.current = false;
            return;
          }
          const el = dialogRef.current;
          if (el && pressedOutside.current && e.target === el && isOutside(e, el)) {
            el.close();
            setOpen(false);
            restoreFocus();
          }
          pressedOutside.current = false;
        }}
        {...rest}
      >
        {cut && (
          <span className="f12-cut" aria-hidden="true">
            {cut}
          </span>
        )}
        {children}
      </dialog>
    );
  },
);

export function DialogHeader({
  className = '',
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`f12-dialog-header${className ? ` ${className}` : ''}`} {...rest}>
      {children}
    </div>
  );
}

export function DialogTitle({
  className = '',
  children,
  ...rest
}: React.HTMLAttributes<HTMLHeadingElement>) {
  const { titleId } = useDialogContext();
  return (
    <h2 id={titleId} className={`f12-dialog-title${className ? ` ${className}` : ''}`} {...rest}>
      {children}
    </h2>
  );
}

export function DialogDescription({
  className = '',
  children,
  ...rest
}: React.HTMLAttributes<HTMLParagraphElement>) {
  const { descId, setHasDescription } = useDialogContext();
  useIsoLayoutEffect(() => {
    setHasDescription(true);
    return () => setHasDescription(false);
  }, [setHasDescription]);

  return (
    <p
      id={descId}
      className={`f12-dialog-description${className ? ` ${className}` : ''}`}
      {...rest}
    >
      {children}
    </p>
  );
}

export function DialogFooter({
  className = '',
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`f12-dialog-footer${className ? ` ${className}` : ''}`} {...rest}>
      {children}
    </div>
  );
}

export function DialogClose({ onClick, children, ...rest }: ButtonProps) {
  const { setOpen } = useDialogContext();
  return (
    <Button
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) {
          setOpen(false);
        }
      }}
      {...rest}
    >
      {children}
    </Button>
  );
}
