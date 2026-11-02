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

export function PanelPair({
  top,
  bottom,
  topCut,
  bottomCut,
  topLabel,
  bottomLabel,
  className = '',
  children,
  ...rest
}: PanelPairProps) {
  const classes = `pair${className ? ` ${className}` : ''}`;

  if (top && bottom) {
    return (
      <div className={classes} {...rest}>
        <Panel {...top} shape="slant-bottom" />
        <Panel {...bottom} shape="slant-top" />
      </div>
    );
  }

  const items = React.Children.toArray(children);
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
    <div className={classes} {...rest}>
      {first !== undefined && renderSlot(first, 'slant-bottom', topCut, topLabel)}
      {second !== undefined && renderSlot(second, 'slant-top', bottomCut, bottomLabel)}
    </div>
  );
}
