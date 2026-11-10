'use client';

import * as React from 'react';
import { useResolvedMotion } from '@/hooks/use-tempo';
import { useInkCycle } from './ink';

// Same union as `MotionMode` in use-on-twos.ts. Declared locally so this file only needs use-tempo.
type MotionMode = 'stepped' | 'smooth' | 'cut';

export interface InkRevealProps {
  /**
   * Inks the wrapped panel when this changes to `true` after mount: the frame draws (6 poses),
   * the cut number lands (1 pose), then the content appears in one cut. A value that is `true` at
   * mount never plays (rule 5; the `ink-autoplay` lint rule enforces it).
   */
  play?: boolean;
  /** The reveal's own motion, resolved against the viewer's tempo and OS reduced motion. */
  motion?: MotionMode;
  /** Called when the content has appeared (`animationend`). */
  onEnd?: () => void;
  /** One `Panel` or `PanelPair`. */
  children?: React.ReactNode;
}

/** Reads the measured frame polygon and returns the top-right corner's position along it (0..1). */
function topRightFraction(polygon: SVGPolygonElement | null): number {
  const raw = polygon?.getAttribute('points')?.trim();
  if (!raw) return 0;
  const nums = raw.split(/[\s,]+/).map(Number);
  const pts: [number, number][] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
  if (pts.length < 3) return 0;
  let total = 0;
  const lens = pts.map((p, i) => {
    const q = pts[(i + 1) % pts.length];
    const l = Math.hypot(q[0] - p[0], q[1] - p[1]);
    total += l;
    return l;
  });
  return total > 0 ? lens[0] / total : 0;
}

/**
 * Inks a `Panel` (or `PanelPair`) frame before its content appears, by CSS alone. The stroke
 * starts at the top-left corner (top-right under `dir="rtl"`) and follows reading order. Only the
 * measured frame polygon (`pathLength="1"`) is animated, never the SSR `viewBox` polygon.
 */
export function InkReveal({ play = false, motion = 'stepped', onEnd, children }: InkRevealProps) {
  const resolved = useResolvedMotion(motion);
  const cycle = useInkCycle(play);
  const playing = play && cycle > 0 && resolved !== 'cut';
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [start, setStart] = React.useState<{ cycle: number; rtl: boolean; at: number }>({
    cycle: 0,
    rtl: false,
    at: 0,
  });
  // The animation only starts once this play's start corner is known (same commit, before paint).
  const ready = start.cycle === cycle;

  // Read once per play, on the user's action (never per frame): direction and the top-right
  // corner's position along the frame, so an RTL stroke starts there.
  const useIso = typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;
  useIso(() => {
    if (!playing || ready || !ref.current) return;
    const rtl = getComputedStyle(ref.current).direction === 'rtl';
    const polygon = ref.current.querySelector<SVGPolygonElement>(
      '.f12-panel-frame polygon:not([vector-effect])',
    );
    setStart({ cycle, rtl, at: rtl ? topRightFraction(polygon) : 0 });
  }, [playing, ready, cycle]);

  return (
    <div
      ref={ref}
      className={`f12-ink-reveal f12-m-${resolved}`}
      data-ink={playing && ready ? (cycle % 2 ? 'a' : 'b') : undefined}
      data-ink-dir={start.rtl ? 'rtl' : 'ltr'}
      style={{ '--f12-ink-from': -start.at, '--f12-ink-to': 1 - start.at } as React.CSSProperties}
      onAnimationEnd={(e) => {
        if (
          e.animationName.startsWith('f12InkLand') &&
          (e.target as Element).classList?.contains('f12-panel-body')
        ) {
          onEnd?.();
        }
      }}
    >
      {children}
    </div>
  );
}
