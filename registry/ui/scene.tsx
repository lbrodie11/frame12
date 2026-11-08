'use client';

import * as React from 'react';

export type SceneGutter = 'pair' | 'scene' | 'change';
export type SceneLayout = 'split' | 'stack' | 'equal' | 'three' | 'areas';

export const GUTTERS: Record<SceneGutter, number> = {
  pair: 12,
  scene: 20,
  change: 32,
};

export interface SceneProps extends React.HTMLAttributes<HTMLDivElement> {
  gutter?: SceneGutter;
  layout?: SceneLayout;
  areas?: string[];
  columns?: number;
  breakpoint?: number | string;
  children?: React.ReactNode;
}

export interface SceneAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  area: string;
  children?: React.ReactNode;
}

export const SceneArea = React.forwardRef<HTMLDivElement, SceneAreaProps>(function SceneArea(
  { area, className = '', style, children, ...rest },
  ref,
) {
  const mergedStyle = {
    '--f12-area': area,
    ...style,
  } as React.CSSProperties;

  return (
    <div
      ref={ref}
      className={`f12-scene-area${className ? ` ${className}` : ''}`}
      data-area={area}
      style={mergedStyle}
      {...rest}
    >
      {children}
    </div>
  );
});

export const Scene = React.forwardRef<HTMLDivElement, SceneProps>(function Scene(
  {
    gutter = 'scene',
    layout = 'split',
    areas,
    columns = 12,
    breakpoint = '860px',
    className = '',
    style,
    children,
    ...rest
  },
  ref,
) {
  const safeGutter: SceneGutter =
    gutter === 'pair' || gutter === 'scene' || gutter === 'change' ? gutter : 'scene';
  const hasAreas = Array.isArray(areas) && areas.length > 0;
  const safeLayout: SceneLayout = hasAreas
    ? 'areas'
    : layout === 'split' ||
        layout === 'stack' ||
        layout === 'equal' ||
        layout === 'three' ||
        layout === 'areas'
      ? layout
      : 'split';

  const safeColumns =
    typeof columns === 'number' && Number.isFinite(columns) && columns > 0
      ? Math.floor(columns)
      : 12;
  const normalizedBreakpoint =
    typeof breakpoint === 'number'
      ? `${breakpoint}px`
      : typeof breakpoint === 'string' && breakpoint.trim()
        ? breakpoint.trim()
        : '860px';
  const isCustomBreakpoint = normalizedBreakpoint !== '860px';

  const [customBpActive, setCustomBpActive] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    if (!hasAreas || !isCustomBreakpoint || typeof window === 'undefined' || !window.matchMedia) {
      setCustomBpActive(null);
      return;
    }
    const mql = window.matchMedia(`(min-width: ${normalizedBreakpoint})`);
    const update = () => setCustomBpActive(mql.matches);
    update();
    if (mql.addEventListener) {
      mql.addEventListener('change', update);
      return () => mql.removeEventListener('change', update);
    }
    mql.addListener(update);
    return () => mql.removeListener(update);
  }, [hasAreas, isCustomBreakpoint, normalizedBreakpoint]);

  const formattedAreas = hasAreas
    ? areas.map((row) => `"${row.trim().replace(/^["']+|["']+$/g, '')}"`).join(' ')
    : undefined;

  const mergedStyle: React.CSSProperties | undefined = hasAreas
    ? ({
        '--f12-scene-cols': String(safeColumns),
        '--f12-scene-areas': formattedAreas,
        ...style,
      } as React.CSSProperties)
    : style;

  const classes = `f12-scene f12-scene-${safeLayout} f12-scene-${safeGutter}${className ? ` ${className}` : ''}`;

  return (
    <div
      ref={ref}
      className={classes}
      data-gutter={GUTTERS[safeGutter]}
      data-layout={safeLayout}
      data-columns={hasAreas ? safeColumns : undefined}
      data-breakpoint={hasAreas ? normalizedBreakpoint : undefined}
      data-areas-active={hasAreas && customBpActive === true ? 'true' : undefined}
      data-areas-collapsed={hasAreas && customBpActive === false ? 'true' : undefined}
      style={mergedStyle}
      {...rest}
    >
      {children}
    </div>
  );
});
