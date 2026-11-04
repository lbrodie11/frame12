'use client';

import * as React from 'react';

export type EmptyStateDensity = 'comfortable' | 'compact';
export type EmptyStateVariant = 'dashed' | 'quiet';
export type EmptyStateHeadingLevel = 'h2' | 'h3' | 'h4' | 'div';

export interface EmptyStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode | false;
  code?: React.ReactNode;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  density?: EmptyStateDensity;
  variant?: EmptyStateVariant;
  headingLevel?: EmptyStateHeadingLevel;
  children?: React.ReactNode;
}

function hasExplicitEmptyIcon(node: React.ReactNode): boolean {
  let found = false;
  const walk = (n: React.ReactNode) => {
    React.Children.forEach(n, (child) => {
      if (found || !React.isValidElement<Record<string, unknown>>(child)) return;
      const fnType = child.type as { f12EmptyIcon?: boolean };
      if (fnType?.f12EmptyIcon) {
        found = true;
        return;
      }
      if (child.type === React.Fragment && child.props?.children) {
        walk(child.props.children as React.ReactNode);
      }
    });
  };
  walk(node);
  return found;
}

export const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(function EmptyState(
  {
    title,
    description,
    icon,
    code,
    action,
    secondaryAction,
    density = 'comfortable',
    variant = 'dashed',
    headingLevel = 'h3',
    className = '',
    children,
    ...rest
  },
  ref,
) {
  const isCompact = density === 'compact';
  const showDefaultIcon =
    icon === undefined &&
    Boolean(title || description || code || children) &&
    !hasExplicitEmptyIcon(children);
  const TitleTag = headingLevel;

  return (
    <div
      ref={ref}
      data-variant={variant}
      data-density={isCompact ? 'compact' : undefined}
      className={`f12-empty f12-empty-${variant}${isCompact ? ' f12-empty-compact' : ''}${className ? ` ${className}` : ''}`}
      {...rest}
    >
      {(showDefaultIcon || (icon !== undefined && icon !== false)) && (
        <div className="f12-empty-icon" aria-hidden="true">
          {icon !== undefined ? icon : '[ ∅ ]'}
        </div>
      )}
      {code && <div className="f12-empty-code">{code}</div>}
      {title && <TitleTag className="f12-empty-title">{title}</TitleTag>}
      {description && <p className="f12-empty-description">{description}</p>}
      {children}
      {(action || secondaryAction) && (
        <div className="f12-empty-actions">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
});

export type EmptyStateIconProps = React.HTMLAttributes<HTMLDivElement>;

export const EmptyStateIcon = React.forwardRef<HTMLDivElement, EmptyStateIconProps>(
  function EmptyStateIcon({ 'aria-hidden': ariaHidden = 'true', className = '', children, ...rest }, ref) {
    return (
      <div
        ref={ref}
        aria-hidden={ariaHidden}
        className={`f12-empty-icon${className ? ` ${className}` : ''}`}
        {...rest}
      >
        {children}
      </div>
    );
  },
);
(EmptyStateIcon as unknown as { f12EmptyIcon?: boolean }).f12EmptyIcon = true;

export interface EmptyStateTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: EmptyStateHeadingLevel;
}

export const EmptyStateTitle = React.forwardRef<HTMLHeadingElement, EmptyStateTitleProps>(
  function EmptyStateTitle({ as: Tag = 'h3', className = '', children, ...rest }, ref) {
    return (
      <Tag
        ref={ref as React.Ref<HTMLHeadingElement & HTMLDivElement>}
        className={`f12-empty-title${className ? ` ${className}` : ''}`}
        {...rest}
      >
        {children}
      </Tag>
    );
  },
);

export type EmptyStateDescriptionProps = React.HTMLAttributes<HTMLParagraphElement>;

export const EmptyStateDescription = React.forwardRef<
  HTMLParagraphElement,
  EmptyStateDescriptionProps
>(function EmptyStateDescription({ className = '', children, ...rest }, ref) {
  return (
    <p ref={ref} className={`f12-empty-description${className ? ` ${className}` : ''}`} {...rest}>
      {children}
    </p>
  );
});

export type EmptyStateActionsProps = React.HTMLAttributes<HTMLDivElement>;

export const EmptyStateActions = React.forwardRef<HTMLDivElement, EmptyStateActionsProps>(
  function EmptyStateActions({ className = '', children, ...rest }, ref) {
    return (
      <div ref={ref} className={`f12-empty-actions${className ? ` ${className}` : ''}`} {...rest}>
        {children}
      </div>
    );
  },
);
