'use client';

import * as React from 'react';
import { Button, type ButtonProps } from './button';

interface DialogContextValue {
  open: boolean;
  setOpen: (next: boolean) => void;
  titleId: string;
  descId: string;
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
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const dialogRef = React.useRef<HTMLDialogElement | null>(null);
  const rawId = React.useId().replace(/:/g, '');
  const titleId = `f12-dlg-title-${rawId}`;
  const descId = `f12-dlg-desc-${rawId}`;

  const setOpen = React.useCallback(
    (next: boolean) => {
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
    } else if (!open && el.open) {
      if (typeof el.close === 'function') el.close();
      else el.removeAttribute('open');
    }
  }, [open]);

  return (
    <DialogContext.Provider value={{ open, setOpen, titleId, descId, dialogRef }}>
      {children}
    </DialogContext.Provider>
  );
}

export interface DialogTriggerProps extends ButtonProps {
  asChild?: boolean;
}

export function DialogTrigger({ onClick, children, ...rest }: DialogTriggerProps) {
  const { setOpen } = useDialogContext();
  return (
    <Button
      onClick={(e) => {
        onClick?.(e);
        setOpen(true);
      }}
      {...rest}
    >
      {children}
    </Button>
  );
}

export interface DialogContentProps extends React.HTMLAttributes<HTMLDialogElement> {
  cut?: string;
}

export function DialogContent({
  cut,
  className = '',
  children,
  ...rest
}: DialogContentProps) {
  const { setOpen, titleId, descId, dialogRef } = useDialogContext();
  const pressedOutside = React.useRef<boolean>(false);

  React.useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const onClose = () => setOpen(false);
    el.addEventListener('close', onClose);
    return () => el.removeEventListener('close', onClose);
  }, [dialogRef, setOpen]);

  // Fallback for browsers where <dialog closedby="any"> is not yet supported:
  // test pointer coordinates against the dialog bounding box on pointerdown + pointerup.
  const isOutside = (e: React.PointerEvent<HTMLDialogElement>, dialog: HTMLDialogElement) => {
    const r = dialog.getBoundingClientRect();
    return (
      e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom
    );
  };

  return (
    <dialog
      ref={dialogRef as React.RefObject<HTMLDialogElement>}
      className={`f12-dialog${className ? ` ${className}` : ''}`}
      aria-labelledby={titleId}
      aria-describedby={descId}
      onPointerDown={(e) => {
        if (dialogRef.current) pressedOutside.current = isOutside(e, dialogRef.current);
      }}
      onPointerUp={(e) => {
        if (dialogRef.current && pressedOutside.current && isOutside(e, dialogRef.current)) {
          dialogRef.current.close();
        }
        pressedOutside.current = false;
      }}
      {...({ closedby: 'any' } as Record<string, string>)}
      {...rest}
    >
      {cut && (
        <span className="cut" aria-hidden="true">
          {cut}
        </span>
      )}
      {children}
    </dialog>
  );
}

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
  const { descId } = useDialogContext();
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
        setOpen(false);
      }}
      {...rest}
    >
      {children}
    </Button>
  );
}
