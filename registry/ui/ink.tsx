'use client';

import * as React from 'react';
import { useResolvedMotion } from '@/hooks/use-tempo';

// The pencil helper is pure (no hooks), so it lives in a module without 'use client' that server
// components can call too. Re-exported here so `ink.tsx` stays the one entry point.
export { inkPencil, type InkSegment } from './ink-pencil';

// Same union as `MotionMode` in use-on-twos.ts. Declared locally so this file only needs use-tempo.
type MotionMode = 'stepped' | 'smooth' | 'cut';

/**
 * Stroke weight. Each maps to a width token and an ink token:
 *   - `pencil` → `--f-stroke-pencil` (1px) in `--f-ink-2`. Decorative construction lines.
 *   - `detail` → `--f-stroke-detail` (1.5px) in `--f-ink`. Lines inside a frame.
 *   - `frame`  → `--f-stroke` (2.5px) in `--f-rule`, mitered. Panel frames.
 */
export type InkWeight = 'pencil' | 'detail' | 'frame';

export interface InkStrokeProps
  extends Omit<React.SVGProps<SVGPathElement>, 'ref' | 'pathLength' | 'stroke' | 'fill' | 'd'> {
  /** Path data. Paths only: convert basic shapes to `d` at author time. */
  d: string;
  /** Stroke weight (width and ink token). */
  weight?: InkWeight;
  /** Poses the stroke takes to draw (integer 1–24). Each pose is held for `--f-pose` (83.33ms). */
  poses?: number;
  /** Pose offset at which this stroke starts drawing inside an `InkBeat` (or on its own). */
  at?: number;
  /**
   * Draws the stroke when this changes to `true` after mount. A value that is `true` at mount
   * never draws (rule 5: nothing plays on load; the `ink-autoplay` lint rule enforces it).
   * Ignored inside an `InkSequence`, which drives every stroke it contains.
   */
  play?: boolean;
  /** The stroke's own motion, resolved against the viewer's tempo and OS reduced motion. */
  motion?: MotionMode;
  /** Called once when the stroke finishes drawing (`animationend`); not when motion cancels it. */
  onEnd?: () => void;
}

/** True inside an `InkSequence`: the sequence drives play state and motion for every stroke. */
export const InkDrivenContext = React.createContext<boolean>(false);
InkDrivenContext.displayName = 'InkDrivenContext';

/** Clamps a pose count to the legal 1–24 range (integers). */
export function clampPoses(poses: number): number {
  if (!Number.isFinite(poses)) return 6;
  return Math.min(24, Math.max(1, Math.round(poses)));
}

/**
 * Tracks a `play` flag the way every ink primitive needs it: `cycle` counts the times `play`
 * turned true after mount (0 means it never did, so the primitive stays at rest), and its parity
 * selects one of two identical keyframe names so a replay always restarts the animation.
 */
export function useInkCycle(play: boolean): number {
  const [prev, setPrev] = React.useState<boolean>(play);
  const [cycle, setCycle] = React.useState<number>(0);
  if (play !== prev) {
    setPrev(play);
    if (play) setCycle((c) => c + 1);
  }
  return cycle;
}

/** One inked line drawn on twos by CSS alone (`stroke-dashoffset` 1 → 0 over `poses` poses). */
export const InkStroke = React.forwardRef<SVGPathElement, InkStrokeProps>(function InkStroke(
  {
    d,
    weight = 'detail',
    poses,
    at,
    play = false,
    motion = 'stepped',
    onEnd,
    className = '',
    style,
    onAnimationEnd,
    ...rest
  },
  ref,
) {
  const driven = React.useContext(InkDrivenContext);
  const resolved = useResolvedMotion(motion);
  const cycle = useInkCycle(play);
  // A cycle is consumed when it finishes drawing or when motion resolves to cut mid-draw. Only a
  // new false → true change of `play` draws again; re-enabling motion never replays it.
  const [ended, setEnded] = React.useState<number>(0);
  if (!driven && resolved === 'cut' && play && cycle > 0 && ended !== cycle) setEnded(cycle);
  const playing = !driven && play && cycle > 0 && ended !== cycle && resolved !== 'cut';

  const vars: Record<string, string | number> = {};
  if (poses !== undefined) vars['--f12-ink-poses'] = clampPoses(poses);
  if (at !== undefined) vars['--f12-ink-at'] = Math.max(0, Math.round(at));

  return (
    <path
      {...rest}
      ref={ref}
      d={d}
      pathLength={1}
      fill="none"
      stroke="currentColor"
      className={`f12-ink f12-ink-${weight}${driven ? '' : ` f12-m-${resolved}`}${className ? ` ${className}` : ''}`}
      data-ink={playing ? (cycle % 2 ? 'a' : 'b') : undefined}
      aria-hidden={weight === 'pencil' ? true : rest['aria-hidden']}
      style={{ ...(vars as React.CSSProperties), ...style }}
      onAnimationEnd={(e) => {
        onAnimationEnd?.(e);
        if (
          playing &&
          e.target === e.currentTarget &&
          e.animationName.startsWith('f12InkDraw')
        ) {
          setEnded(cycle);
          onEnd?.();
        }
      }}
    />
  );
});
