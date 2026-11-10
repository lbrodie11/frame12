import type { Capabilities, Env } from './capabilities.js';
export declare const MOTION_VALUES: readonly ["auto", "twos", "ones", "still"];
export type MotionValue = (typeof MOTION_VALUES)[number];
/** A resolved tempo: `auto` has been replaced by the component's default. */
export type Tempo = Exclude<MotionValue, 'auto'>;
export type MotionSource = 'flag' | 'env' | 'reduced-motion-env' | 'environment' | 'default';
export interface ResolvedMotion {
    tempo: Tempo;
    source: MotionSource;
    /** Why decoration is still: `NO_MOTION`, `CI`, `screen reader`… (only when `tempo` is `still`). */
    reason?: string;
    /** Invalid values that were ignored, as human-readable messages. */
    warnings: string[];
}
/** 83.33 ms: FRAME/12 animates "on twos", 12 poses per second. */
export declare const POSE_MS: number;
/** One display frame at 60 fps, used for `ones`. */
export declare const FRAME_MS: number;
/** Milliseconds between decorative updates at a tempo; `Infinity` for `still`. */
export declare function tempoIntervalMs(tempo: Tempo): number;
export interface ResolveMotionInput {
    argv?: readonly string[];
    env?: Env;
    caps: Pick<Capabilities, 'interactive' | 'ci' | 'screenReader' | 'dumb'>;
    /** The component's own default for `auto`. Default `twos`. */
    defaultTempo?: Tempo;
}
/**
 * Precedence:
 * 1. `--motion <auto|twos|ones|still>`
 * 2. `FRAME12_MOTION`
 * 3. `NO_MOTION` / `REDUCED_MOTION` (non-empty, not `0`) → `still`
 * 4. not interactive, CI, a screen reader, or `TERM=dumb` → `still`
 * 5. `auto` → the component's default (`twos`)
 *
 * A valid `--motion` (including `auto`) settles step 1, so `FRAME12_MOTION` is not read: an
 * explicit `--motion auto` overrides the environment variable and falls through to steps 3–5.
 * `FRAME12_MOTION=auto` likewise falls through to steps 3–5.
 */
export declare function resolveTerminalMotion(input: ResolveMotionInput): ResolvedMotion;
