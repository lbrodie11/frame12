'use client';

import * as React from 'react';
import { Panel, usePanelVariantContext, type PanelProps, type PanelVariant } from './panel';

export interface PanelPairProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: PanelVariant;
  top?: Omit<PanelProps, 'shape'>;
  bottom?: Omit<PanelProps, 'shape'>;
  topCut?: string | false;
  bottomCut?: string | false;
  topLabel?: string;
  bottomLabel?: string;
  children?: React.ReactNode;
}

export const PanelPair = React.forwardRef<HTMLDivElement, PanelPairProps>(function PanelPair(
  {
    variant,
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
  const inheritedVariant = usePanelVariantContext();
  const effectivePairVariant: PanelVariant = variant ?? inheritedVariant ?? 'expressive';
  const classes = `f12-pair${className ? ` ${className}` : ''}`;

  if (top && bottom) {
    const topVariant = top.variant ?? effectivePairVariant;
    const bottomVariant = bottom.variant ?? effectivePairVariant;
    return (
      <div ref={ref} className={classes} {...rest}>
        <Panel
          {...top}
          cut={top.cut ?? topCut}
          label={top.label ?? topLabel}
          variant={topVariant}
          shape={topVariant === 'quiet' ? 'rect' : 'slant-bottom'}
        />
        <Panel
          {...bottom}
          cut={bottom.cut ?? bottomCut}
          label={bottom.label ?? bottomLabel}
          variant={bottomVariant}
          shape={bottomVariant === 'quiet' ? 'rect' : 'slant-top'}
        />
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
    slantShape: 'slant-bottom' | 'slant-top',
    fallbackCut?: string | false,
    fallbackLabel?: string,
  ) => {
    if (React.isValidElement<PanelProps>(node) && node.type === Panel) {
      const slotVariant = node.props.variant ?? effectivePairVariant;
      const defaultShape = slotVariant === 'quiet' ? 'rect' : slantShape;
      return React.cloneElement(node, {
        variant: slotVariant,
        shape: node.props.shape && node.props.shape !== 'rect' ? node.props.shape : defaultShape,
        cut: node.props.cut ?? fallbackCut,
        label: node.props.label ?? fallbackLabel,
      });
    }
    const slotVariant = effectivePairVariant;
    return (
      <Panel
        variant={slotVariant}
        shape={slotVariant === 'quiet' ? 'rect' : slantShape}
        cut={fallbackCut}
        label={fallbackLabel}
      >
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
