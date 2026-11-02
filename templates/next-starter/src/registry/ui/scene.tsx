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

export function Scene({
  gutter = 'scene',
  layout = 'split',
  className = '',
  children,
  ...rest
}: SceneProps) {
  const safeGutter: SceneGutter =
    gutter === 'pair' || gutter === 'scene' || gutter === 'change' ? gutter : 'scene';
  const safeLayout: SceneLayout =
    layout === 'split' || layout === 'stack' || layout === 'equal' || layout === 'three'
      ? layout
      : 'split';

  const classes = `scene scene-${safeLayout} scene-${safeGutter}${className ? ` ${className}` : ''}`;

  return (
    <div className={classes} data-gutter={GUTTERS[safeGutter]} data-layout={safeLayout} {...rest}>
      {children}
    </div>
  );
}
