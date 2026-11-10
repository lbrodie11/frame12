'use client';

import * as React from 'react';
import { useResolvedMotion } from '@/hooks/use-tempo';

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
  /** Called when the stroke finishes drawing (`animationend`). */
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
  const playing = !driven && play && cycle > 0 && resolved !== 'cut';

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
        if (!driven && e.target === e.currentTarget && e.animationName.startsWith('f12InkDraw')) {
          onEnd?.();
        }
      }}
    />
  );
});

// ------------------------------------------------------------------------- deterministic pencil
/** mulberry32: a small, fast, seeded PRNG. Same seed → same sequence on server, client and CI. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a over the rounded geometry, so the wobble is a pure function of geometry + seed. */
function hashGeometry(values: readonly number[]): number {
  let h = 0x811c9dc5;
  for (const v of values) {
    const s = String(Math.round(v * 100));
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    h ^= 0x2c;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

const r2 = (n: number): string => String(Math.round(n * 100) / 100);

/** A straight segment `[x1, y1, x2, y2]` in user units. */
export type InkSegment = readonly [number, number, number, number];

/**
 * Pencil construction lines: each segment becomes one slightly bowed, slightly overshot subpath.
 * The wobble is a pure function of the geometry and `seed` (no `Math.random`), so server, client
 * and every screenshot produce the identical `d` string.
 */
export function inkPencil(segments: readonly InkSegment[], seed = 12, wobble = 0.8): string {
  const rnd = mulberry32(hashGeometry(segments.flat()) ^ Math.imul(seed | 0, 0x9e3779b1));
  const j = () => (rnd() * 2 - 1) * wobble;
  return segments
    .map(([x1, y1, x2, y2]) => {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      // Pencil strokes overshoot their ends a little and bow at the middle.
      const o1 = 1 + rnd() * 2;
      const o2 = 1 + rnd() * 2;
      const bow = j();
      const sx = x1 - ux * o1 + -uy * j() * 0.5;
      const sy = y1 - uy * o1 + ux * j() * 0.5;
      const ex = x2 + ux * o2 + -uy * j() * 0.5;
      const ey = y2 + uy * o2 + ux * j() * 0.5;
      const cx = (x1 + x2) / 2 + -uy * bow;
      const cy = (y1 + y2) / 2 + ux * bow;
      return `M${r2(sx)} ${r2(sy)}Q${r2(cx)} ${r2(cy)} ${r2(ex)} ${r2(ey)}`;
    })
    .join('');
}
