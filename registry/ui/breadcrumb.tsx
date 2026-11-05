'use client';

import * as React from 'react';

export type BreadcrumbDensity = 'comfortable' | 'compact';

export interface BreadcrumbEntry {
  label: React.ReactNode;
  /**
   * Real destination URL. The crumb renders as an `<a>`, so open-in-new-tab, copy-link and
   * history all work. Only use it for an address that loads the right view on its own.
   */
  href?: string;
  current?: boolean;
  /**
   * Runs on a plain primary click of an `href` crumb (e.g. client-side routing). Modified
   * clicks (Ctrl/⌘/Shift/Alt) skip it so the browser can open the link natively.
   */
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
  /**
   * In-page action for a crumb without a URL (switching a tab, clearing a drill-down filter).
   * The crumb renders as a `<button type="button">` styled like a link. Ignored when `href`
   * is set or the crumb is current.
   */
  onSelect?: React.MouseEventHandler<HTMLButtonElement>;
}

function isModifiedClick(event: React.MouseEvent<HTMLElement>): boolean {
  return (
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    (typeof event.button === 'number' && event.button !== 0)
  );
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
  let activeCleanups: Array<() => void> = [];
  const runCleanups = () => {
    const toRun = activeCleanups;
    activeCleanups = [];
    for (const cleanup of toRun) {
      cleanup();
    }
  };
  return (value: T | null) => {
    runCleanups();
    if (value === null) {
      return;
    }
    const cleanups: Array<() => void> = [];
    for (const ref of refs) {
      if (typeof ref === 'function') {
        const cleanup = ref(value);
        if (typeof cleanup === 'function') {
          cleanups.push(cleanup);
        } else {
          cleanups.push(() => {
            ref(null);
          });
        }
      } else if (ref != null) {
        (ref as React.MutableRefObject<T | null>).current = value;
        cleanups.push(() => {
          (ref as React.MutableRefObject<T | null>).current = null;
        });
      }
    }
    activeCleanups = cleanups;
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
            {(() => {
              const hasExplicitCurrent = items.some((entry) => entry.current === true);
              return items.map((item, idx) => {
                const isLast = idx === items.length - 1;
                const isCurrent = item.current ?? (!hasExplicitCurrent && isLast);
                return (
                  <React.Fragment key={idx}>
                    <BreadcrumbItem>
                      {isCurrent || (!item.href && !item.onSelect) ? (
                        <BreadcrumbPage aria-current={isCurrent ? 'page' : false}>
                          {item.label}
                        </BreadcrumbPage>
                      ) : item.href ? (
                        <BreadcrumbLink
                          href={item.href}
                          onClick={
                            item.onClick
                              ? (event) => {
                                  if (!isModifiedClick(event)) item.onClick?.(event);
                                }
                              : undefined
                          }
                        >
                          {item.label}
                        </BreadcrumbLink>
                      ) : (
                        <BreadcrumbButton onClick={item.onSelect}>{item.label}</BreadcrumbButton>
                      )}
                    </BreadcrumbItem>
                    {!isLast && <BreadcrumbSeparator>{separator}</BreadcrumbSeparator>}
                  </React.Fragment>
                );
              });
            })()}
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
    const childRef =
      asChild && React.isValidElement(children)
        ? (getElementRef(children) as React.Ref<HTMLAnchorElement> | undefined)
        : undefined;
    const composedRef = React.useMemo(
      () => mergeRefs(forwardedRef, childRef),
      [forwardedRef, childRef],
    );

    if (asChild && React.isValidElement<Record<string, unknown>>(children)) {
      const childProps = children.props || {};
      const childClass =
        typeof childProps.className === 'string' ? childProps.className : '';
      const mergedProps: Record<string, unknown> = {
        ...rest,
        ...childProps,
        ref: composedRef,
        className: [mergedClass, childClass].filter(Boolean).join(' '),
      };
      const parentProps: Record<string, unknown> = { ...rest, onClick };
      for (const evt of new Set([...Object.keys(parentProps), ...Object.keys(childProps)])) {
        if (!/^on[A-Z]/.test(evt)) continue;
        const parentHandler = parentProps[evt];
        const childHandler = childProps[evt];
        if (typeof parentHandler === 'function' && typeof childHandler === 'function') {
          mergedProps[evt] = (...args: unknown[]) => {
            (parentHandler as (...a: unknown[]) => void)(...args);
            (childHandler as (...a: unknown[]) => void)(...args);
          };
        } else if (typeof parentHandler === 'function') {
          mergedProps[evt] = parentHandler;
        } else if (typeof childHandler === 'function') {
          mergedProps[evt] = childHandler;
        }
      }
      return React.cloneElement(children, mergedProps);
    }

    return (
      <a ref={forwardedRef} className={mergedClass} onClick={onClick} {...rest}>
        {children}
      </a>
    );
  },
);

export type BreadcrumbButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

/**
 * A crumb that performs an in-page action instead of navigating to a URL. Prefer this over an
 * `<a href="#…">` whose click handler calls `preventDefault()`: a fake hash link offers
 * open-in-new-tab and copy-link affordances that lead nowhere.
 */
export const BreadcrumbButton = React.forwardRef<HTMLButtonElement, BreadcrumbButtonProps>(
  function BreadcrumbButton({ className = '', type = 'button', children, ...rest }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        className={`f12-breadcrumb-link f12-breadcrumb-button${className ? ` ${className}` : ''}`}
        {...rest}
      >
        {children}
      </button>
    );
  },
);

export interface BreadcrumbPageProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'aria-current'> {
  'aria-current'?: React.AriaAttributes['aria-current'] | false;
}

export const BreadcrumbPage = React.forwardRef<HTMLSpanElement, BreadcrumbPageProps>(
  function BreadcrumbPage(
    { 'aria-current': ariaCurrent = 'page', className = '', children, ...rest },
    ref,
  ) {
    const resolvedAriaCurrent =
      ariaCurrent === false || ariaCurrent === 'false' ? undefined : ariaCurrent;
    return (
      <span
        ref={ref}
        aria-current={resolvedAriaCurrent}
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
