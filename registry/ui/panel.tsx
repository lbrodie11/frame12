'use client';

import * as React from 'react';
import { useSize } from '@/hooks/use-on-twos';
import { resolveAreaProps } from './scene';

// Bundlers (Next.js, webpack, Vite) statically replace `process.env.NODE_ENV`. Declared locally so
// consumers without @types/node (e.g. Vite's react-ts template) still type-check this file.
declare const process: { env: { NODE_ENV?: string } };

export type PanelShape = 'rect' | 'slant-bottom' | 'slant-top';
export type PanelVariant = 'expressive' | 'quiet';

export interface PanelProps extends React.HTMLAttributes<HTMLElement> {
  cut?: string | false;
  shape?: PanelShape;
  variant?: PanelVariant;
  label?: string;
  area?: string;
  children?: React.ReactNode;
}

const INACTIVE_SIZE_REF: { readonly current: HTMLElement | null } = { current: null };

const PANEL_VARIANT_CTX_KEY = Symbol.for('frame12.PanelVariantContext');
const globalRegistry = globalThis as unknown as Record<
  symbol,
  React.Context<PanelVariant | undefined> | undefined
>;
const PanelVariantContext = (globalRegistry[PANEL_VARIANT_CTX_KEY] ??= React.createContext<
  PanelVariant | undefined
>(undefined));

export function usePanelVariantContext(): PanelVariant | undefined {
  return React.useContext(PanelVariantContext);
}

export const Panel = React.forwardRef<HTMLElement, PanelProps>(function Panel(
  { cut, shape = 'rect', variant, className = '', label, area, style, children, ...rest },
  forwardedRef,
) {
  const inheritedVariant = React.useContext(PanelVariantContext);
  const resolvedVariant: PanelVariant = variant ?? inheritedVariant ?? 'expressive';
  const innerRef = React.useRef<HTMLElement | null>(null);
  const warnedCutRef = React.useRef<string | null>(null);
  const isQuiet = resolvedVariant === 'quiet';
  const showSvgFrame = !isQuiet || shape !== 'rect';
  const setRefs = React.useCallback(
    (node: HTMLElement | null) => {
      innerRef.current = node;
      if (typeof forwardedRef === 'function') {
        forwardedRef(node);
      } else if (forwardedRef) {
        (forwardedRef as React.MutableRefObject<HTMLElement | null>).current = node;
      }
    },
    [forwardedRef],
  );

  React.useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      if (typeof cut === 'string' && cut.length > 0 && warnedCutRef.current !== cut) {
        const sheet = innerRef.current?.closest('.f12-sheet');
        if (sheet && sheet.hasAttribute('data-autocut')) {
          warnedCutRef.current = cut;
          console.warn(
            `[FRAME/12 Panel] Explicit cut "${cut}" used inside <Sheet autoCut>. Cut numbers are automatic inside <Sheet autoCut>; remove the cut prop or use cut={false}.`,
          );
        }
      }
    }
  }, [cut]);

  const { w, h } = useSize(showSvgFrame ? innerRef : INACTIVE_SIZE_REF);
  const s = 1.25; // half of 2.5px stroke
  const d = 16; // slant rise in px
  let pts: string;
  if (shape === 'slant-bottom') {
    pts = `${s},${s} ${w - s},${s} ${w - s},${h - s - d} ${s},${h - s}`;
  } else if (shape === 'slant-top') {
    pts = `${s},${s + d} ${w - s},${s} ${w - s},${h - s} ${s},${h - s}`;
  } else {
    pts = `${s},${s} ${w - s},${s} ${w - s},${h - s} ${s},${h - s}`;
  }

  const ssrPts =
    shape === 'slant-bottom'
      ? '0.35,0.35 99.65,0.35 99.65,93.2 0.35,99.65'
      : shape === 'slant-top'
        ? '0.35,6.8 99.65,0.35 99.65,99.65 0.35,99.65'
        : '0.35,0.35 99.65,0.35 99.65,99.65 0.35,99.65';

  const variantClass = isQuiet ? ' f12-panel-quiet' : '';
  const areaProps = resolveAreaProps(area, style);

  return (
    <section
      ref={setRefs}
      className={`f12-panel f12-${shape}${variantClass}${className ? ` ${className}` : ''}`}
      data-variant={isQuiet ? 'quiet' : undefined}
      data-area={areaProps['data-area']}
      aria-label={label}
      style={areaProps.style}
      {...rest}
    >
      {showSvgFrame &&
        (w > 0 ? (
          <svg className="f12-panel-frame" width={w} height={h} aria-hidden="true">
            <polygon points={pts} pathLength={1} />
          </svg>
        ) : (
          <svg
            className="f12-panel-frame"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <polygon vectorEffect="non-scaling-stroke" points={ssrPts} />
          </svg>
        ))}
      {typeof cut === 'string' && cut.length > 0 ? (
        <span className="f12-cut" aria-hidden="true">
          {cut}
        </span>
      ) : cut === undefined && !isQuiet ? (
        <span className="f12-cut" data-autocut="" aria-hidden="true" />
      ) : null}
      <div className="f12-panel-body">{children}</div>
    </section>
  );
});
