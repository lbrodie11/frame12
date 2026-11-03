'use client';

import * as React from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import type { ButtonProps } from './button';

interface DropdownMenuFieldContextValue {
  containerEl: HTMLDivElement | null;
}

const DropdownMenuFieldContext = React.createContext<DropdownMenuFieldContextValue | null>(null);

export type DropdownMenuProps = React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Root>;

export function DropdownMenu({
  open,
  defaultOpen,
  onOpenChange,
  modal = false,
  dir,
  children,
}: DropdownMenuProps) {
  const [containerEl, setContainerEl] = React.useState<HTMLDivElement | null>(null);
  const ctxValue = React.useMemo(() => ({ containerEl }), [containerEl]);

  return (
    <DropdownMenuFieldContext.Provider value={ctxValue}>
      <div ref={setContainerEl} className="f12-menu-wrap">
        <DropdownMenuPrimitive.Root
          open={open}
          defaultOpen={defaultOpen}
          onOpenChange={onOpenChange}
          modal={modal}
          dir={dir}
        >
          {children}
        </DropdownMenuPrimitive.Root>
      </div>
    </DropdownMenuFieldContext.Provider>
  );
}

export interface DropdownMenuTriggerProps extends ButtonProps {
  asChild?: boolean;
}

export const DropdownMenuTrigger = React.forwardRef<HTMLButtonElement, DropdownMenuTriggerProps>(
  function DropdownMenuTrigger(
    { asChild = false, variant = 'secondary', size = 'md', className = '', children, ...rest },
    forwardedRef,
  ) {
    if (asChild && React.isValidElement(children)) {
      return (
        <DropdownMenuPrimitive.Trigger
          ref={forwardedRef}
          asChild
          className={className || undefined}
          {...rest}
        >
          {children}
        </DropdownMenuPrimitive.Trigger>
      );
    }
    const classes = `f12-btn f12-btn-${variant} f12-btn-${size}${className ? ` ${className}` : ''}`;
    return (
      <DropdownMenuPrimitive.Trigger
        ref={forwardedRef}
        type="button"
        className={classes}
        {...rest}
      >
        {children}
      </DropdownMenuPrimitive.Trigger>
    );
  },
);

export type DropdownMenuContentProps = React.ComponentPropsWithoutRef<
  typeof DropdownMenuPrimitive.Content
>;

export const DropdownMenuContent = React.forwardRef<HTMLDivElement, DropdownMenuContentProps>(
  function DropdownMenuContent(
    { className = '', sideOffset = 4, align = 'start', children, ...rest },
    forwardedRef,
  ) {
    const field = React.useContext(DropdownMenuFieldContext);
    const portalContainer =
      (field?.containerEl?.closest(
        'dialog, .f12-frame, .f12-sheet, .f12-theme-dark, .f12-theme-light, [data-theme]',
      ) as HTMLElement | null) ?? undefined;

    return (
      <DropdownMenuPrimitive.Portal container={portalContainer}>
        <DropdownMenuPrimitive.Content
          ref={forwardedRef}
          sideOffset={sideOffset}
          align={align}
          className={`f12-menu${className ? ` ${className}` : ''}`}
          {...rest}
        >
          {children}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    );
  },
);

export type DropdownMenuLabelProps = React.ComponentPropsWithoutRef<
  typeof DropdownMenuPrimitive.Label
>;

export const DropdownMenuLabel = React.forwardRef<HTMLDivElement, DropdownMenuLabelProps>(
  function DropdownMenuLabel({ className = '', children, ...rest }, forwardedRef) {
    return (
      <DropdownMenuPrimitive.Label
        ref={forwardedRef}
        className={`f12-menu-label${className ? ` ${className}` : ''}`}
        {...rest}
      >
        {children}
      </DropdownMenuPrimitive.Label>
    );
  },
);

export type DropdownMenuSeparatorProps = React.ComponentPropsWithoutRef<
  typeof DropdownMenuPrimitive.Separator
>;

export const DropdownMenuSeparator = React.forwardRef<HTMLDivElement, DropdownMenuSeparatorProps>(
  function DropdownMenuSeparator({ className = '', ...rest }, forwardedRef) {
    return (
      <DropdownMenuPrimitive.Separator
        ref={forwardedRef}
        className={`f12-menu-sep${className ? ` ${className}` : ''}`}
        {...rest}
      />
    );
  },
);

export type DropdownMenuItemProps = React.ComponentPropsWithoutRef<
  typeof DropdownMenuPrimitive.Item
>;

export const DropdownMenuItem = React.forwardRef<HTMLDivElement, DropdownMenuItemProps>(
  function DropdownMenuItem({ className = '', children, ...rest }, forwardedRef) {
    return (
      <DropdownMenuPrimitive.Item
        ref={forwardedRef}
        className={`f12-menu-item${className ? ` ${className}` : ''}`}
        {...rest}
      >
        {children}
      </DropdownMenuPrimitive.Item>
    );
  },
);

export type DropdownMenuGroupProps = React.ComponentPropsWithoutRef<
  typeof DropdownMenuPrimitive.Group
>;

export const DropdownMenuGroup = React.forwardRef<HTMLDivElement, DropdownMenuGroupProps>(
  function DropdownMenuGroup({ className = '', children, ...rest }, forwardedRef) {
    return (
      <DropdownMenuPrimitive.Group
        ref={forwardedRef}
        className={`f12-menu-group${className ? ` ${className}` : ''}`}
        {...rest}
      >
        {children}
      </DropdownMenuPrimitive.Group>
    );
  },
);
