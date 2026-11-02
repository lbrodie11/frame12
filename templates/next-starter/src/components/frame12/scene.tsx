'use client';

import * as React from 'react';

export type SceneGutter = 'pair' | 'scene' | 'change';
export type SceneLayout = 'split' | 'stack' | 'equal' | 'three';

export const GUTTERS: Record<SceneGutter, number> = {
  pair: 12,
  scene: 20,
  change: 32,
};

export interface SceneProps extends React.HTMLAttributes<HTMLDivElement> {
  gutter?: SceneGutter;
  layout?: SceneLayout;
  children?: React.ReactNode;
}

export const Scene = React.forwardRef<HTMLDivElement, SceneProps>(function Scene(
  { gutter = 'scene', layout = 'split', className = '', children, ...rest },
  ref,
) {
  const safeGutter: SceneGutter =
    gutter === 'pair' || gutter === 'scene' || gutter === 'change' ? gutter : 'scene';
  const safeLayout: SceneLayout =
    layout === 'split' || layout === 'stack' || layout === 'equal' || layout === 'three'
      ? layout
      : 'split';

  const classes = `f12-scene f12-scene-${safeLayout} f12-scene-${safeGutter}${className ? ` ${className}` : ''}`;

  return (
    <div
      ref={ref}
      className={classes}
      data-gutter={GUTTERS[safeGutter]}
      data-layout={safeLayout}
      {...rest}
    >
      {children}
    </div>
  );
});
