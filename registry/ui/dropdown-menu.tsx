'use client';

import * as React from 'react';
import { Button, type ButtonProps } from './button';

interface DropdownMenuContextValue {
  open: boolean;
  setOpen: (next: boolean) => void;
  menuId: string;
}

const DropdownMenuContext = React.createContext<DropdownMenuContextValue | null>(null);

function useDropdownMenuContext() {
  const ctx = React.useContext(DropdownMenuContext);
  if (!ctx) throw new Error('DropdownMenu subcomponents must be used within <DropdownMenu>');
  return ctx;
}

export interface DropdownMenuProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}

export function DropdownMenu({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  children,
}: DropdownMenuProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState<boolean>(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const rawId = React.useId().replace(/:/g, '');
  const menuId = `f12-menu-${rawId}`;

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
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
  }, [open, setOpen]);

  return (
    <DropdownMenuContext.Provider value={{ open, setOpen, menuId }}>
      <div ref={wrapRef} className="f12-menu-wrap">
        {children}
      </div>
    </DropdownMenuContext.Provider>
  );
}

export function DropdownMenuTrigger({ onClick, children, ...rest }: ButtonProps) {
  const { open, setOpen, menuId } = useDropdownMenuContext();
  return (
    <Button
      aria-haspopup="menu"
      aria-expanded={open}
      aria-controls={open ? menuId : undefined}
      onClick={(e) => {
        onClick?.(e);
        setOpen(!open);
      }}
      {...rest}
    >
      {children}
    </Button>
  );
}

export function DropdownMenuContent({
  className = '',
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  const { open, menuId } = useDropdownMenuContext();
  if (!open) return null;
  return (
    <div
      id={menuId}
      role="menu"
      className={`f12-menu${className ? ` ${className}` : ''}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export function DropdownMenuLabel({
  className = '',
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`f12-menu-label${className ? ` ${className}` : ''}`} {...rest}>
      {children}
    </div>
  );
}

export function DropdownMenuSeparator({
  className = '',
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="separator"
      className={`f12-menu-sep${className ? ` ${className}` : ''}`}
      {...rest}
    />
  );
}

export interface DropdownMenuItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  onSelect?: () => void;
}

export function DropdownMenuItem({
  onSelect,
  onClick,
  className = '',
  children,
  ...rest
}: DropdownMenuItemProps) {
  const { setOpen } = useDropdownMenuContext();
  return (
    <button
      type="button"
      role="menuitem"
      className={`f12-menu-item${className ? ` ${className}` : ''}`}
      onClick={(e) => {
        onClick?.(e);
        onSelect?.();
        setOpen(false);
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
