'use client';

import * as React from 'react';
import { useResolvedMotion } from '@/hooks/use-tempo';
import { InkDrivenContext, clampPoses, isInkCycleEvent, useInkCycle } from './ink';

// Same union as `MotionMode` in use-on-twos.ts. Declared locally so this file only needs use-tempo.
type MotionMode = 'stepped' | 'smooth' | 'cut';

/**
 * `rest`      finished drawing (the default, the SSR state and the no-JS state).
 * `playing`   time-driven: every beat draws in order, chained by CSS `animation-delay` sums.
 * `scrubbing` scroll-driven: poses follow the scroll position (`animation-timeline: view()`).
 * `still`     resolved motion is `cut` (still tempo, OS reduced motion): finished, never animates.
 */
export type InkSequenceState = 'rest' | 'playing' | 'scrubbing' | 'still';

export interface InkSequenceProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Pose count of each beat, in order (integers 1–24). Beat `i` starts when beat `i - 1` ends. */
  beats: readonly number[];
  /**
   * Plays every beat in time order when this changes to `true` after mount; changing it to
   * `false` stops and returns to `rest` (finished), never to a half-drawn pose. A value that is
   * `true` at mount never plays (rule 5; the `ink-autoplay` lint rule enforces it).
   */
  play?: boolean;
  /**
   * Lets the scroll position drive the poses where `animation-timeline: view()` is supported and
   * resolved motion is not `cut`. Attaches after mount, once the drawing has been out of view (so
   * hydration never swaps a finished drawing on screen for a scroll pose); the first `play` detaches it.
   */
  scroll?: boolean;
  /** The sequence's own motion, resolved against the viewer's tempo and OS reduced motion. */
  motion?: MotionMode;
  /** Called when the last beat finishes drawing (`animationend`). */
  onEnd?: () => void;
  /** Called whenever the state machine changes state. */
  onStateChange?: (state: InkSequenceState) => void;
}

export interface InkBeatProps extends React.SVGProps<SVGGElement> {
  /** Index into the parent sequence's `beats`. */
  beat: number;
}

export interface InkLandProps extends React.SVGProps<SVGGElement> {
  /** `cut`: the group appears in one pose. `wipe`: it is uncovered in reading order over its poses. */
  reveal?: 'cut' | 'wipe';
  /** Pose offset inside the beat at which the group lands (or starts its wipe). */
  at?: number;
  /** Poses a `wipe` takes (integer 1–24). Defaults to the beat's poses. */
  poses?: number;
}

interface SequenceInfo {
  starts: readonly number[];
  beats: readonly number[];
}

const SequenceContext = React.createContext<SequenceInfo | null>(null);
SequenceContext.displayName = 'InkSequenceContext';

const SCROLL_TIMELINE_QUERY = 'animation-timeline: view()';

function supportsScrollTimeline(): boolean {
  return typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports(SCROLL_TIMELINE_QUERY);
}

/**
 * One state machine for a multi-beat ink drawing. It renders a wrapper `<div>` (put one or more
 * `<svg>` drawings inside) and drives every `InkStroke`, `InkBeat` and `InkLand` it contains
 * through CSS only: no `requestAnimationFrame`, no timers.
 */
export const InkSequence = React.forwardRef<HTMLDivElement, InkSequenceProps>(function InkSequence(
  {
    beats,
    play = false,
    scroll = false,
    motion = 'stepped',
    onEnd,
    onStateChange,
    className = '',
    style,
    children,
    onAnimationEnd,
    ...rest
  },
  ref,
) {
  const resolved = useResolvedMotion(motion);
  const cycle = useInkCycle(play);
  const [ended, setEnded] = React.useState<number>(0);
  const endedRef = React.useRef<number>(0);
  const [canScroll, setCanScroll] = React.useState<boolean>(false);

  // The scroll driver attaches only while the drawing is out of view, so hydration never swaps a
  // finished drawing the visitor is looking at (a reload restoring the scroll position, a tall
  // viewport) for a scroll pose. One IntersectionObserver callback, no scroll listener.
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (!scroll || !supportsScrollTimeline()) return;
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setCanScroll(true);
      return;
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => !e.isIntersecting)) {
        setCanScroll(true);
        io.disconnect();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [scroll]);
  const setRefs = React.useCallback(
    (node: HTMLDivElement | null) => {
      rootRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
    },
    [ref],
  );

  // Tempo or reduced motion turning `cut` mid-play finishes the play; it never resumes later.
  if (resolved === 'cut' && play && cycle > 0 && ended !== cycle) setEnded(cycle);
  const playing = play && cycle > 0 && ended !== cycle && resolved !== 'cut';
  // Any play detaches the scroll timeline for good: Stop and the end both land on `rest`.
  const detached = cycle > 0;
  const state: InkSequenceState =
    resolved === 'cut'
      ? 'still'
      : playing
        ? 'playing'
        : scroll && canScroll && !detached
          ? 'scrubbing'
          : 'rest';

  // Keyed on the pose values, not the array's identity: an inline `beats={[12, 12]}` must not
  // rebuild the context (and re-render every InkBeat) on each parent render.
  const beatsKey = beats.join(',');
  const info = React.useMemo<SequenceInfo>(() => {
    const clean = beatsKey === '' ? [] : beatsKey.split(',').map((v) => clampPoses(Number(v)));
    const starts: number[] = [];
    let sum = 0;
    for (const p of clean) {
      starts.push(sum);
      sum += p;
    }
    return { starts, beats: clean };
  }, [beatsKey]);
  const total = info.beats.reduce((a, b) => a + b, 0) || 1;

  const lastState = React.useRef<InkSequenceState>(state);
  React.useEffect(() => {
    if (lastState.current !== state) {
      lastState.current = state;
      onStateChange?.(state);
    }
  }, [state, onStateChange]);

  return (
    <div
      {...rest}
      ref={setRefs}
      className={`f12-ink-seq f12-m-${resolved}${className ? ` ${className}` : ''}`}
      data-ink={playing ? (cycle % 2 ? 'a' : 'b') : undefined}
      data-ink-state={state}
      data-ink-scroll={state === 'scrubbing' ? '' : undefined}
      style={{ ...({ '--f12-ink-total': total } as React.CSSProperties), ...style }}
      onAnimationEnd={(e) => {
        onAnimationEnd?.(e);
        // The root's own clock animation lasts exactly `total` poses: its end is the last beat's end.
        // It counts only for the play it belongs to: a late end of a superseded play never ends
        // the newer one, and a play stopped as it finished still reports its completion.
        if (
          e.target === e.currentTarget &&
          isInkCycleEvent(e.animationName, 'f12InkClock', cycle) &&
          ended !== cycle &&
          endedRef.current !== cycle
        ) {
          endedRef.current = cycle;
          setEnded(cycle);
          onEnd?.();
        }
      }}
    >
      <SequenceContext.Provider value={info}>
        <InkDrivenContext.Provider value={true}>{children}</InkDrivenContext.Provider>
      </SequenceContext.Provider>
    </div>
  );
});

function beatVars(info: SequenceInfo | null, beat: number): Record<string, number> {
  const i = Math.max(0, Math.round(beat));
  return {
    '--f12-ink-beat': info?.starts[i] ?? 0,
    '--f12-ink-poses': info?.beats[i] ?? 6,
  };
}

/** A group of strokes that draw during one beat of the parent `InkSequence`. */
export const InkBeat = React.forwardRef<SVGGElement, InkBeatProps>(function InkBeat(
  { beat, className = '', style, ...rest },
  ref,
) {
  const info = React.useContext(SequenceContext);
  return (
    <g
      {...rest}
      ref={ref}
      className={`f12-ink-beat${className ? ` ${className}` : ''}`}
      data-beat={beat}
      style={{ ...(beatVars(info, beat) as React.CSSProperties), ...style }}
    />
  );
});

/** Non-stroke art inside a beat (screentone, labels): lands in one pose or wipes in reading order. */
export const InkLand = React.forwardRef<SVGGElement, InkLandProps>(function InkLand(
  { reveal = 'cut', at, poses, className = '', style, ...rest },
  ref,
) {
  const vars: Record<string, number> = {};
  if (at !== undefined) vars['--f12-ink-at'] = Math.max(0, Math.round(at));
  if (poses !== undefined) vars['--f12-ink-poses'] = clampPoses(poses);
  return (
    <g
      {...rest}
      ref={ref}
      className={`${reveal === 'wipe' ? 'f12-ink-wipe' : 'f12-ink-land'}${className ? ` ${className}` : ''}`}
      style={{ ...(vars as React.CSSProperties), ...style }}
    />
  );
});
