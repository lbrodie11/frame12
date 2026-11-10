'use client';

import * as React from 'react';

// Same union as `MotionMode` in use-on-twos.ts. Declared locally (not imported) so this module has
// no dependencies: use-on-twos.ts imports from here, never the other way round.
type MotionMode = 'stepped' | 'smooth' | 'cut';

/**
 * The viewer's animation tempo.
 *
 * | Tempo   | Label | Meaning                                                              |
 * |---------|-------|----------------------------------------------------------------------|
 * | `auto`  | AUTO  | each component's own intended motion (default)                        |
 * | `twos`  | 12    | on twos: held poses, 12 per second                                    |
 * | `ones`  | 60    | smooth, continuous motion (follows the display's refresh rate)        |
 * | `still` | 0     | no non-essential motion                                               |
 */
export type Tempo = 'auto' | 'twos' | 'ones' | 'still';

export const TEMPOS: readonly Tempo[] = ['auto', 'twos', 'ones', 'still'];

export function isTempo(value: unknown): value is Tempo {
  return value === 'auto' || value === 'twos' || value === 'ones' || value === 'still';
}

/** Any invalid runtime value (a stored `"fast"`, `null`, a number) is treated as `auto`. */
export function normalizeTempo(value: unknown): Tempo {
  return isTempo(value) ? value : 'auto';
}

export interface ResolveMotionInput {
  /** The component's `motion` prop, otherwise its own default (`Metric` quiet → `'cut'`). Undefined means `'stepped'`. */
  base?: MotionMode;
  /** The nearest provider's tempo. Invalid values are treated as `auto`. */
  tempo?: Tempo;
  /** True when any provider above the nearest one is `still`. */
  ancestorStill?: boolean;
  /** The OS `prefers-reduced-motion: reduce` preference. */
  reduced?: boolean;
}

/**
 * Resolves the motion a component actually plays. Rules, in order:
 *   1. OS reduced motion → `'cut'`.
 *   2. `still` here or in any ancestor → `'cut'`.
 *   3. `base === 'cut'` → `'cut'`: tempo never turns motion on where a component, a variant or an
 *      explicit prop says none.
 *   4. `twos` → `'stepped'`; `ones` → `'smooth'`.
 *   5. `auto` → `base`.
 * Direct manipulation (pointer tracking, drag, scroll, typing, focus movement) never goes through
 * this: it is never stepped or delayed, at any tempo.
 */
export function resolveMotion({
  base,
  tempo,
  ancestorStill = false,
  reduced = false,
}: ResolveMotionInput): MotionMode {
  if (reduced) return 'cut';
  const t = normalizeTempo(tempo);
  if (t === 'still' || ancestorStill) return 'cut';
  const b: MotionMode = base === undefined ? 'stepped' : base;
  if (b === 'cut') return 'cut';
  if (t === 'twos') return 'stepped';
  if (t === 'ones') return 'smooth';
  return b;
}

export interface TempoContextValue {
  /** The nearest provider's tempo (`auto` without a provider). */
  tempo: Tempo;
  /** Sets the nearest provider's tempo. A no-op without a provider. */
  setTempo: (tempo: Tempo) => void;
  /** True when a provider above the nearest one is `still` (it cannot be undone below). */
  ancestorStill: boolean;
  /** False when no TempoProvider is above this point. */
  inProvider: boolean;
}

const NO_PROVIDER: TempoContextValue = {
  tempo: 'auto',
  setTempo: () => {},
  ancestorStill: false,
  inProvider: false,
};

export const TempoContext = React.createContext<TempoContextValue>(NO_PROVIDER);
TempoContext.displayName = 'TempoContext';

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

/** The OS `prefers-reduced-motion: reduce` preference. Without `matchMedia`, false. */
export function useReducedMotion(): boolean {
  return React.useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );
}

export interface TempoState extends TempoContextValue {
  /** The OS reduced-motion preference. */
  reduced: boolean;
  /** What actually applies here: `still` when reduced motion or an ancestor forces it. */
  effectiveTempo: Tempo;
}

/** The tempo at this point in the tree, plus what actually applies after the OS and ancestors. */
export function useTempo(): TempoState {
  const ctx = React.useContext(TempoContext);
  const reduced = useReducedMotion();
  const effectiveTempo: Tempo = reduced || ctx.ancestorStill ? 'still' : ctx.tempo;
  return { ...ctx, reduced, effectiveTempo };
}

/** The motion a component with this `base` should play here (see `resolveMotion`). */
export function useResolvedMotion(base?: MotionMode): MotionMode {
  const { tempo, ancestorStill } = React.useContext(TempoContext);
  const reduced = useReducedMotion();
  return resolveMotion({ base, tempo, ancestorStill, reduced });
}
