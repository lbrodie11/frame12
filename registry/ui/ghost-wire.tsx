'use client';

import * as React from 'react';
import { useOnTwos, type MotionMode } from '@/hooks/use-on-twos';
import { useResolvedMotion } from '@/hooks/use-tempo';
import { extractTextContent } from './tag';

const useIsoLayoutEffect = typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;
let ghostWireMaskCounter = 0;

export type GhostWireOrientation = 'auto' | 'horizontal' | 'vertical';

export interface GhostWireProps extends React.HTMLAttributes<HTMLDivElement> {
  from: React.ReactNode;
  to: React.ReactNode;
  label?: string;
  strength?: number;
  orientation?: GhostWireOrientation;
  motion?: MotionMode;
}

export const GhostWire = React.forwardRef<HTMLDivElement, GhostWireProps>(function GhostWire(
  {
    from,
    to,
    label,
    strength = 0.5,
    orientation = 'auto',
    motion = 'stepped',
    className = '',
    ...rest
  },
  ref,
) {
  const innerRef = React.useRef<HTMLDivElement | null>(null);
  const setRefs = React.useCallback(
    (node: HTMLDivElement | null) => {
      innerRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }
    },
    [ref],
  );

  const clampedStrength =
    typeof strength === 'number' && Number.isFinite(strength)
      ? Math.max(0, Math.min(1, strength))
      : 0.5;
  const safeOrientation: GhostWireOrientation =
    orientation === 'horizontal' || orientation === 'vertical' || orientation === 'auto'
      ? orientation
      : 'auto';

  const fromText = extractTextContent(from).trim() || 'source';
  const toText = extractTextContent(to).trim() || 'target';
  const reactId = React.useId();
  const baseSlug = (rest.id || `${fromText}-${toText}`)
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);
  const baseMaskId = `f12-gw-mask-${baseSlug ? `${baseSlug}-` : ''}${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [maskSuffix, setMaskSuffix] = React.useState<string>('');
  const maskId = `${baseMaskId}${maskSuffix}`;
  const [autoVertical, setAutoVertical] = React.useState<boolean>(false);

  useIsoLayoutEffect(() => {
    const el = innerRef.current;
    if (!el || typeof document === 'undefined') return;
    const ownMask = el.querySelector('mask');
    const matching = document.querySelectorAll(`mask[id="${baseMaskId}"]`);
    if (matching.length > 1 && matching[0] !== ownMask) {
      ghostWireMaskCounter += 1;
      setMaskSuffix(`-r${ghostWireMaskCounter}`);
    }
  }, [baseMaskId]);

  useIsoLayoutEffect(() => {
    if (safeOrientation !== 'auto' || typeof window === 'undefined') {
      setAutoVertical(false);
      return;
    }
    const el = innerRef.current;
    const mql = window.matchMedia ? window.matchMedia('(max-width: 519.98px)') : null;
    const evaluate = (inlineWidth?: number) => {
      const measured =
        typeof inlineWidth === 'number' && inlineWidth > 0
          ? inlineWidth
          : el && el.clientWidth > 0
            ? el.clientWidth
            : 0;
      if (measured > 0) {
        setAutoVertical(measured < 520);
      } else if (mql) {
        setAutoVertical(mql.matches);
      }
    };
    evaluate();

    let ro: ResizeObserver | null = null;
    if (el && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver((entries) => {
        const w = entries[0]?.contentRect?.width;
        evaluate(w);
      });
      ro.observe(el);
    }

    const onMqlChange = () => evaluate();
    if (mql) {
      if (mql.addEventListener) {
        mql.addEventListener('change', onMqlChange);
      } else {
        mql.addListener(onMqlChange);
      }
    }

    return () => {
      if (ro) ro.disconnect();
      if (mql) {
        if (mql.removeEventListener) {
          mql.removeEventListener('change', onMqlChange);
        } else {
          mql.removeListener(onMqlChange);
        }
      }
    };
  }, [safeOrientation]);

  const resolvedOrientation: 'horizontal' | 'vertical' =
    safeOrientation === 'auto' ? (autoVertical ? 'vertical' : 'horizontal') : safeOrientation;

  const defaultAccessibleLabel = `${fromText} usually changes with ${toText}, which was not changed`;
  const groupAriaLabel =
    rest['aria-label'] ?? (label && label.trim() ? label.trim() : defaultAccessibleLabel);

  const resolvedMotion = useResolvedMotion(motion);
  const targetKey = `${fromText}|${toText}|${label ?? ''}|${clampedStrength.toFixed(3)}`;
  const [hydratedKey, setHydratedKey] = React.useState<string>('ssr');

  // The draw-on replays only when the key changes while animated. The key tracks the target even
  // while cut (reduced motion, a `still` tempo, `motion="cut"`), so a later switch to an animated
  // mode keeps the resting state instead of replaying an old draw-on.
  useIsoLayoutEffect(() => {
    setHydratedKey(targetKey);
  }, [targetKey]);

  const progress = useOnTwos(hydratedKey, 500, resolvedMotion);
  const dash = Math.round(3 + clampedStrength * 9);
  const gap = Math.round(10 - clampedStrength * 7);
  const dashArray = `${dash} ${gap}`;
  const dashOffset = progress >= 1 ? 0 : Number(((1 - progress) * 100).toFixed(2));
  const isVertical = resolvedOrientation === 'vertical';

  return (
    <div
      {...rest}
      ref={setRefs}
      role="group"
      aria-label={groupAriaLabel}
      className={`f12-ghost-wire f12-ghost-wire-${safeOrientation}${className ? ` ${className}` : ''}`}
      data-orientation={resolvedOrientation}
      data-strength={clampedStrength.toFixed(2)}
    >
      <span className="f12-ghost-wire-endpoint f12-ghost-wire-from" data-endpoint="from">
        {from}
      </span>
      <span className="f12-ghost-wire-connector">
        <svg
          className="f12-ghost-wire-svg"
          viewBox={isVertical ? '0 0 12 100' : '0 0 100 12'}
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <mask
              id={maskId}
              maskUnits="userSpaceOnUse"
              x="0"
              y="0"
              width={isVertical ? 12 : 100}
              height={isVertical ? 100 : 12}
            >
              <line
                className="f12-ghost-wire-reveal"
                x1={isVertical ? 6 : 0}
                y1={isVertical ? 0 : 6}
                x2={isVertical ? 6 : 100}
                y2={isVertical ? 100 : 6}
                strokeDasharray="100 100"
                strokeDashoffset={dashOffset}
              />
            </mask>
          </defs>
          <line
            className="f12-ghost-wire-line"
            x1={isVertical ? 6 : 0}
            y1={isVertical ? 0 : 6}
            x2={isVertical ? 6 : 100}
            y2={isVertical ? 100 : 6}
            vectorEffect="non-scaling-stroke"
            strokeDasharray={dashArray}
            mask={`url(#${maskId})`}
          />
        </svg>
        {label ? <span className="f12-ghost-wire-label">{label}</span> : null}
      </span>
      <span className="f12-ghost-wire-endpoint f12-ghost-wire-to" data-endpoint="to">
        {to}
      </span>
    </div>
  );
});
