'use client';

import * as React from 'react';

export type SkeletonVariant = 'block' | 'line' | 'circle' | 'metric' | 'panel';
export type SkeletonDensity = 'comfortable' | 'compact';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: SkeletonVariant;
  width?: number | string;
  height?: number | string;
  animated?: boolean;
  density?: SkeletonDensity;
  label?: string;
}

export const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(function Skeleton(
  {
    variant = 'block',
    width,
    height,
    animated = true,
    density = 'comfortable',
    label,
    role: userRole,
    'aria-hidden': userAriaHidden,
    'aria-label': userAriaLabel,
    'aria-busy': userAriaBusy,
    style,
    className = '',
    children,
    ...rest
  },
  ref,
) {
  const isCompact = density === 'compact';
  const hasLabel = Boolean(label || userAriaLabel);
  const resolvedRole = userRole ?? (hasLabel ? 'status' : undefined);
  const resolvedAriaBusy = userAriaBusy ?? (hasLabel ? 'true' : undefined);
  const resolvedAriaHidden =
    userAriaHidden !== undefined ? userAriaHidden : hasLabel ? undefined : 'true';

  const resolvedStyle: React.CSSProperties = {
    ...(width !== undefined
      ? { width: typeof width === 'number' ? `${width}px` : width }
      : undefined),
    ...(height !== undefined
      ? { height: typeof height === 'number' ? `${height}px` : height }
      : undefined),
    ...style,
  };

  return (
    <div
      ref={ref}
      role={resolvedRole}
      aria-busy={resolvedAriaBusy}
      aria-label={userAriaLabel ?? label}
      aria-hidden={resolvedAriaHidden}
      data-variant={variant}
      data-animated={animated ? 'true' : 'false'}
      data-density={isCompact ? 'compact' : undefined}
      style={resolvedStyle}
      className={`f12-skeleton f12-skeleton-${variant}${animated ? ' f12-skeleton-animated' : ''}${isCompact ? ' f12-skeleton-compact' : ''}${className ? ` ${className}` : ''}`}
      {...rest}
    >
      {children}
    </div>
  );
});

export interface SkeletonTextProps extends React.HTMLAttributes<HTMLDivElement> {
  lines?: number;
  lastLineWidth?: number | string;
  animated?: boolean;
  density?: SkeletonDensity;
  label?: string;
}

export const SkeletonText = React.forwardRef<HTMLDivElement, SkeletonTextProps>(
  function SkeletonText(
    {
      lines = 3,
      lastLineWidth = '65%',
      animated = true,
      density = 'comfortable',
      label,
      role: userRole,
      'aria-hidden': userAriaHidden,
      'aria-label': userAriaLabel,
      'aria-busy': userAriaBusy,
      className = '',
      ...rest
    },
    ref,
  ) {
    const isCompact = density === 'compact';
    const safeLines = Math.max(1, lines);
    const hasLabel = Boolean(label || userAriaLabel);
    const resolvedRole = userRole ?? (hasLabel ? 'status' : undefined);
    const resolvedAriaBusy = userAriaBusy ?? (hasLabel ? 'true' : undefined);
    const resolvedAriaHidden =
      userAriaHidden !== undefined ? userAriaHidden : hasLabel ? undefined : 'true';

    return (
      <div
        ref={ref}
        role={resolvedRole}
        aria-busy={resolvedAriaBusy}
        aria-label={userAriaLabel ?? label}
        aria-hidden={resolvedAriaHidden}
        data-density={isCompact ? 'compact' : undefined}
        className={`f12-skeleton-text${isCompact ? ' f12-skeleton-text-compact' : ''}${className ? ` ${className}` : ''}`}
        {...rest}
      >
        {Array.from({ length: safeLines }, (_, idx) => {
          const isLast = safeLines > 1 && idx === safeLines - 1;
          return (
            <Skeleton
              key={idx}
              variant="line"
              width={isLast ? lastLineWidth : '100%'}
              animated={animated}
              density={density}
              aria-hidden="true"
            />
          );
        })}
      </div>
    );
  },
);
