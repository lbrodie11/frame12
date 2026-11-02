'use client';

import * as React from 'react';
import { Panel, type PanelProps } from './panel';

export interface PanelPairProps extends React.HTMLAttributes<HTMLDivElement> {
  top?: Omit<PanelProps, 'shape'>;
  bottom?: Omit<PanelProps, 'shape'>;
  topCut?: string;
  bottomCut?: string;
  topLabel?: string;
  bottomLabel?: string;
  children?: React.ReactNode;
}

export const PanelPair = React.forwardRef<HTMLDivElement, PanelPairProps>(function PanelPair(
  {
    top,
    bottom,
    topCut,
    bottomCut,
    topLabel,
    bottomLabel,
    className = '',
    children,
    ...rest
  },
  ref,
) {
  const classes = `f12-pair${className ? ` ${className}` : ''}`;

  if (top && bottom) {
    return (
      <div ref={ref} className={classes} {...rest}>
        <Panel {...top} shape="slant-bottom" />
        <Panel {...bottom} shape="slant-top" />
      </div>
    );
  }

  const items = React.Children.toArray(children);
  if (process.env.NODE_ENV !== 'production' && items.length > 2) {
    console.warn(
      `[FRAME/12 PanelPair] Expected at most 2 children (top and bottom panels), received ${items.length}. Extra children will not be rendered.`,
    );
  }
  const first = items[0];
  const second = items[1];

  const renderSlot = (
    node: React.ReactNode,
    shape: 'slant-bottom' | 'slant-top',
    fallbackCut?: string,
    fallbackLabel?: string,
  ) => {
    if (React.isValidElement<PanelProps>(node) && node.type === Panel) {
      return React.cloneElement(node, {
        shape: node.props.shape && node.props.shape !== 'rect' ? node.props.shape : shape,
        cut: node.props.cut ?? fallbackCut,
        label: node.props.label ?? fallbackLabel,
      });
    }
    return (
      <Panel shape={shape} cut={fallbackCut} label={fallbackLabel}>
        {node}
      </Panel>
    );
  };

  return (
    <div ref={ref} className={classes} {...rest}>
      {first !== undefined && renderSlot(first, 'slant-bottom', topCut, topLabel)}
      {second !== undefined && renderSlot(second, 'slant-top', bottomCut, bottomLabel)}
    </div>
  );
});
