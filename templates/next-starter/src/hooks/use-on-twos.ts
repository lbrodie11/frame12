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

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function subscribeReducedMotion(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }
  const q = window.matchMedia(REDUCED_MOTION_QUERY);
  if (q.addEventListener) {
    q.addEventListener('change', onStoreChange);
    return () => q.removeEventListener('change', onStoreChange);
  }
  q.addListener(onStoreChange);
  return () => q.removeListener(onStoreChange);
}

function getReducedMotionSnapshot(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function getReducedMotionServerSnapshot(): boolean {
  return false;
}

export function useReducedMotion(): boolean {
  return React.useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );
}

/**
 * Progress 0..1 that replays whenever `key` changes.
 *
 * Stepped mode samples the cubic-out easing curve at 12 poses per second
 * (`FRAME_MS = 1000 / 12 = 83.33ms` per pose), like an animation exposure sheet
 * ("on twos"). Pose 1 (`k = 1`, `t = 1 / frames`) is displayed immediately at
 * `elapsed = 0` (`Math.floor(el / FRAME_MS) + 1`) so the element visibly steps
 * on the exact interaction frame rather than sitting at 0 for 83.33ms, and each
 * subsequent pose is held for a full 83.33ms interval until `frames` poses complete.
 *
 * Only changes to `key` trigger a new tween; changing `duration` or `motion`
 * alone keeps the current resting state. Honors `prefers-reduced-motion: reduce`.
 */
export function useOnTwos(
  key: unknown,
  duration = 600,
  motion: MotionMode = 'stepped',
): number {
  const reduced = useReducedMotion();
  const effectiveMotion: MotionMode = reduced ? 'cut' : motion;
  const [p, setP] = React.useState<number>(1);
  const prevKeyRef = React.useRef<unknown>(key);
  const frames = Math.max(2, Math.round(duration / FRAME_MS));
  const initialP =
    effectiveMotion === 'cut' ? 1 : effectiveMotion === 'stepped' ? easeOut(1 / frames) : 0;

  useIsoLayoutEffect(() => {
    if (effectiveMotion === 'cut') {
      prevKeyRef.current = key;
      setP(1);
      return;
    }
    if (Object.is(prevKeyRef.current, key)) {
      return;
    }
    prevKeyRef.current = key;
    const start = performance.now();
    const totalFrames = Math.max(2, Math.round(duration / FRAME_MS));
    let raf = 0;
    let last = -1;
    const tick = (now: number) => {
      const el = now - start;
      let t: number;
      if (effectiveMotion === 'stepped') {
        const k = Math.min(totalFrames, Math.floor(el / FRAME_MS) + 1);
        t = k / totalFrames;
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
    setP(effectiveMotion === 'stepped' ? easeOut(1 / totalFrames) : 0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [key, duration, effectiveMotion]);

  const isNewKey = !Object.is(prevKeyRef.current, key);
  return isNewKey ? initialP : p;
}

export const useTween = useOnTwos;

export function useCountUp(
  value: number,
  motion: MotionMode = 'stepped',
  duration = 600,
): number {
  const prev = React.useRef<number>(value);
  const from = React.useRef<number>(value);
  const displayedRef = React.useRef<number>(value);
  if (!Object.is(prev.current, value)) {
    from.current = displayedRef.current;
    prev.current = value;
  }
  const p = useOnTwos(value, duration, motion);
  const current = from.current + (value - from.current) * p;
  displayedRef.current = current;
  return current;
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
