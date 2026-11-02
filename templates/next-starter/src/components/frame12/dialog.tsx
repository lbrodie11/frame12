'use client';

import * as React from 'react';
import { Button, type ButtonProps } from './button';

const useIsoLayoutEffect = typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;

const openDialogStack: HTMLDialogElement[] = [];

function pushOpenDialog(el: HTMLDialogElement) {
  const idx = openDialogStack.indexOf(el);
  if (idx !== -1) openDialogStack.splice(idx, 1);
  openDialogStack.push(el);
}

function removeOpenDialog(el: HTMLDialogElement) {
  const idx = openDialogStack.indexOf(el);
  if (idx !== -1) openDialogStack.splice(idx, 1);
}

function getTopmostOpenDialog(): HTMLDialogElement | undefined {
  for (let i = openDialogStack.length - 1; i >= 0; i--) {
    const d = openDialogStack[i];
    if (d.isConnected && d.open) return d;
    openDialogStack.splice(i, 1);
  }
  const fallback = document.querySelectorAll<HTMLDialogElement>('dialog[open]');
  return fallback[fallback.length - 1];
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

  const dialogRef = React.useRef<HTMLDialogElement | null>(null);
  const rawId = React.useId().replace(/:/g, '');
  const titleId = `f12-dlg-title-${rawId}`;
  const descId = `f12-dlg-desc-${rawId}`;

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (openRef.current === next) return;
      openRef.current = next;
      if (!isControlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  React.useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) {
      if (typeof el.showModal === 'function') el.showModal();
      else el.setAttribute('open', '');
      pushOpenDialog(el);
    } else if (open && el.open) {
      pushOpenDialog(el);
    } else if (!open && el.open) {
      removeOpenDialog(el);
      if (typeof el.close === 'function') el.close();
      else el.removeAttribute('open');
    } else {
      removeOpenDialog(el);
    }
  }, [open]);

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
      }}
    >
      {children}
    </DialogContext.Provider>
  );
}

export interface DialogTriggerProps extends ButtonProps {
  asChild?: boolean;
}

export const DialogTrigger = React.forwardRef<HTMLButtonElement, DialogTriggerProps>(
  function DialogTrigger(
    { asChild = false, onClick, className = '', children, ...rest },
    forwardedRef,
  ) {
    const { setOpen } = useDialogContext();
    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<Record<string, unknown>> & {
        ref?: React.Ref<unknown>;
      };
      const childProps = child.props || {};
      const mergedClassName =
        [childProps.className, className].filter(Boolean).join(' ') || undefined;
      return React.cloneElement(child, {
        ...rest,
        ...childProps,
        className: mergedClassName,
        ref: mergeRefs(forwardedRef, child.ref),
        onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
          onClick?.(e);
          if (typeof childProps.onClick === 'function') {
            (childProps.onClick as (ev: React.MouseEvent<HTMLButtonElement>) => void)(e);
          }
          if (!e.defaultPrevented) {
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
    const { setOpen, titleId, descId, hasDescription, dialogRef } = useDialogContext();
    const pressedOutside = React.useRef<boolean>(false);
    const childPopupOpenOnEscapeRef = React.useRef<boolean>(false);

    React.useEffect(() => {
      const el = dialogRef.current;
      if (!el) return;
      const onClose = () => {
        removeOpenDialog(el);
        setOpen(false);
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
      };
      el.addEventListener('close', onClose);
      document.addEventListener('keydown', onDocKeyDownCapture, true);
      document.addEventListener('keydown', onDocKeyDown);
      return () => {
        removeOpenDialog(el);
        el.removeEventListener('close', onClose);
        document.removeEventListener('keydown', onDocKeyDownCapture, true);
        document.removeEventListener('keydown', onDocKeyDown);
      };
    }, [dialogRef, setOpen]);

    // Fallback for browsers where <dialog closedby="any"> is not yet supported:
    // test pointer coordinates against the dialog bounding box on pointerdown + pointerup.
    const isOutside = (e: React.PointerEvent<HTMLDialogElement>, dialog: HTMLDialogElement) => {
      const r = dialog.getBoundingClientRect();
      return (
        e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom
      );
    };

    const resolvedDescribedBy = userDescribedBy ?? (hasDescription ? descId : undefined);

    return (
      <dialog
        ref={mergeRefs(dialogRef, forwardedRef)}
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
