'use client';

import * as React from 'react';

export type BreadcrumbDensity = 'comfortable' | 'compact';

export interface BreadcrumbEntry {
  label: React.ReactNode;
  href?: string;
  current?: boolean;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
}

const BreadcrumbContext = React.createContext<{
  separator: React.ReactNode;
  density: BreadcrumbDensity;
}>({
  separator: '/',
  density: 'comfortable',
});

const BreadcrumbItemContext = React.createContext<boolean>(false);

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

export interface BreadcrumbProps extends React.HTMLAttributes<HTMLElement> {
  items?: BreadcrumbEntry[];
  separator?: React.ReactNode;
  density?: BreadcrumbDensity;
  ariaLabel?: string;
}

export const Breadcrumb = React.forwardRef<HTMLElement, BreadcrumbProps>(function Breadcrumb(
  {
    items,
    separator = '/',
    density = 'comfortable',
    ariaLabel = 'Breadcrumb',
    'aria-label': userAriaLabel,
    className = '',
    children,
    ...rest
  },
  ref,
) {
  const isCompact = density === 'compact';
  const ctxValue = React.useMemo(
    () => ({ separator, density }),
    [separator, density],
  );

  return (
    <BreadcrumbContext.Provider value={ctxValue}>
      <nav
        ref={ref}
        aria-label={userAriaLabel ?? ariaLabel}
        data-density={isCompact ? 'compact' : undefined}
        className={`f12-breadcrumb${isCompact ? ' f12-breadcrumb-compact' : ''}${className ? ` ${className}` : ''}`}
        {...rest}
      >
        {items ? (
          <BreadcrumbList>
            {items.map((item, idx) => {
              const isLast = idx === items.length - 1;
              const isCurrent = item.current ?? isLast;
              return (
                <React.Fragment key={idx}>
                  <BreadcrumbItem>
                    {isCurrent || !item.href ? (
                      <BreadcrumbPage aria-current={isCurrent ? 'page' : undefined}>
                        {item.label}
                      </BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink href={item.href} onClick={item.onClick}>
                        {item.label}
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                  {!isLast && <BreadcrumbSeparator>{separator}</BreadcrumbSeparator>}
                </React.Fragment>
              );
            })}
          </BreadcrumbList>
        ) : (
          children
        )}
      </nav>
    </BreadcrumbContext.Provider>
  );
});

export type BreadcrumbListProps = React.OlHTMLAttributes<HTMLOListElement>;

export const BreadcrumbList = React.forwardRef<HTMLOListElement, BreadcrumbListProps>(
  function BreadcrumbList({ className = '', children, ...rest }, ref) {
    return (
      <ol
        ref={ref}
        className={`f12-breadcrumb-list${className ? ` ${className}` : ''}`}
        {...rest}
      >
        {children}
      </ol>
    );
  },
);

export type BreadcrumbItemProps = React.LiHTMLAttributes<HTMLLIElement>;

export const BreadcrumbItem = React.forwardRef<HTMLLIElement, BreadcrumbItemProps>(
  function BreadcrumbItem({ className = '', children, ...rest }, ref) {
    return (
      <BreadcrumbItemContext.Provider value={true}>
        <li
          ref={ref}
          className={`f12-breadcrumb-item${className ? ` ${className}` : ''}`}
          {...rest}
        >
          {children}
        </li>
      </BreadcrumbItemContext.Provider>
    );
  },
);

export interface BreadcrumbLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  asChild?: boolean;
}

export const BreadcrumbLink = React.forwardRef<HTMLAnchorElement, BreadcrumbLinkProps>(
  function BreadcrumbLink({ asChild = false, className = '', onClick, children, ...rest }, forwardedRef) {
    const mergedClass = `f12-breadcrumb-link${className ? ` ${className}` : ''}`;

    if (asChild && React.isValidElement<Record<string, unknown>>(children)) {
      const childProps = children.props;
      const childClass =
        typeof childProps.className === 'string' ? childProps.className : '';
      const childOnClick = childProps.onClick as
        | React.MouseEventHandler<HTMLAnchorElement>
        | undefined;
      const childRef = getElementRef(children) as React.Ref<HTMLAnchorElement> | undefined;
      return React.cloneElement(children, {
        ...rest,
        ...childProps,
        onClick:
          onClick || childOnClick
            ? (e: React.MouseEvent<HTMLAnchorElement>) => {
                onClick?.(e);
                childOnClick?.(e);
              }
            : undefined,
        ref: mergeRefs(forwardedRef, childRef),
        className: [mergedClass, childClass].filter(Boolean).join(' '),
      });
    }

    return (
      <a ref={forwardedRef} className={mergedClass} onClick={onClick} {...rest}>
        {children}
      </a>
    );
  },
);

export type BreadcrumbPageProps = React.HTMLAttributes<HTMLSpanElement>;

export const BreadcrumbPage = React.forwardRef<HTMLSpanElement, BreadcrumbPageProps>(
  function BreadcrumbPage(
    { 'aria-current': ariaCurrent = 'page', className = '', children, ...rest },
    ref,
  ) {
    return (
      <span
        ref={ref}
        aria-current={ariaCurrent}
        className={`f12-breadcrumb-page${className ? ` ${className}` : ''}`}
        {...rest}
      >
        {children}
      </span>
    );
  },
);

export type BreadcrumbSeparatorProps = React.HTMLAttributes<HTMLElement>;

export const BreadcrumbSeparator = React.forwardRef<HTMLElement, BreadcrumbSeparatorProps>(
  function BreadcrumbSeparator({ className = '', children, ...rest }, ref) {
    const { separator } = React.useContext(BreadcrumbContext);
    const inItem = React.useContext(BreadcrumbItemContext);
    const Tag = inItem ? 'span' : 'li';

    return (
      <Tag
        ref={ref as React.Ref<HTMLLIElement & HTMLSpanElement>}
        role="presentation"
        aria-hidden="true"
        className={`f12-breadcrumb-separator${className ? ` ${className}` : ''}`}
        {...rest}
      >
        {children ?? separator}
      </Tag>
    );
  },
);

export type BreadcrumbEllipsisProps = React.HTMLAttributes<HTMLSpanElement>;

export const BreadcrumbEllipsis = React.forwardRef<HTMLSpanElement, BreadcrumbEllipsisProps>(
  function BreadcrumbEllipsis(
    { 'aria-label': ariaLabel = 'More breadcrumb levels', className = '', children, ...rest },
    ref,
  ) {
    return (
      <span
        ref={ref}
        className={`f12-breadcrumb-ellipsis${className ? ` ${className}` : ''}`}
        {...rest}
      >
        <span aria-hidden="true">{children ?? '…'}</span>
        <span className="f12-sr-only">{ariaLabel}</span>
      </span>
    );
  },
);
