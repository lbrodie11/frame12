'use client';

import * as React from 'react';

export type MotionMode = 'stepped' | 'smooth' | 'cut';

export const FRAME_MS = 1000 / 12; // animating "on twos": 12 drawings per second (83.33ms per pose)

const easeOut = (t: number): number => 1 - Math.pow(1 - t, 3);

const useIsoLayoutEffect = typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;

export function useSize(ref: { readonly current: HTMLElement | null }): { w: number; h: number } {
  const [size, setSize] = React.useState<{ w: number; h: number }>({ w: 0, h: 0 });

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Layout size (offsetWidth/Height), not the transformed box, so scaled previews draw correctly.
    const measure = () => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      setSize((s) => (s.w === w && s.h === h ? s : { w, h }));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  return size;
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  React.useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const q = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(q.matches);
    const on = () => setReduced(q.matches);
    if (q.addEventListener) {
      q.addEventListener('change', on);
      return () => q.removeEventListener('change', on);
    }
    q.addListener(on);
    return () => q.removeListener(on);
  }, []);

  return reduced;
}

/**
 * Progress 0..1 that replays whenever `key` changes.
 * Stepped mode samples the easing curve at 12 poses per second (83.33ms per pose),
 * like an animation spacing chart. Honors `prefers-reduced-motion: reduce`.
 */
export function useOnTwos(
  key: unknown,
  duration = 600,
  motion: MotionMode = 'stepped',
): number {
  const reduced = useReducedMotion();
  const effectiveMotion: MotionMode = reduced ? 'cut' : motion;
  const [p, setP] = React.useState<number>(1);
  const first = React.useRef<boolean>(true);

  useIsoLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (effectiveMotion === 'cut') {
      setP(1);
      return;
    }
    const start = performance.now();
    const frames = Math.max(2, Math.round(duration / FRAME_MS));
    let raf = 0;
    let last = -1;
    const tick = (now: number) => {
      const el = now - start;
      let t: number;
      if (effectiveMotion === 'stepped') {
        const k = Math.min(frames, Math.floor(el / FRAME_MS) + 1);
        t = k / frames;
      } else {
        t = Math.min(1, el / duration);
      }
      const v = easeOut(t);
      if (v !== last) {
        last = v;
        setP(v);
      }
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    setP(effectiveMotion === 'stepped' ? easeOut(1 / frames) : 0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [key, duration, effectiveMotion]);

  return p;
}

export const useTween = useOnTwos;

export function useCountUp(
  value: number,
  motion: MotionMode = 'stepped',
  duration = 600,
): number {
  const prev = React.useRef<number>(value);
  const from = React.useRef<number>(value);
  if (prev.current !== value) {
    from.current = prev.current;
    prev.current = value;
  }
  const p = useOnTwos(value, duration, motion);
  return from.current + (value - from.current) * p;
}

/**
 * Becomes true after the first change of `key`, so entrance animations
 * never run on first paint (the page is complete at rest).
 */
export function useChanged(key: unknown): boolean {
  const first = React.useRef<unknown>(key);
  const [changed, setChanged] = React.useState<boolean>(false);
  React.useEffect(() => {
    if (key !== first.current) setChanged(true);
  }, [key]);
  return changed;
}
