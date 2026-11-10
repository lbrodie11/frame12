/**
 * Terminal motion. Values match FRAME/12 Tempo (F12-08): `auto | twos | ones | still`.
 *
 * Terminals have no operating-system reduced-motion signal (there is no `prefers-reduced-motion`
 * for a TTY), so FRAME/12 reads `NO_MOTION` / `REDUCED_MOTION` and turns motion off wherever it
 * cannot help: pipes, CI, screen readers and `TERM=dumb`.
 *
 * Motion only ever paces decoration. Input echo, errors, cut and run endings, and cancellation
 * are always shown immediately, whatever the tempo.
 */
import { flagValue } from './argv.js';
import { tokenMotion } from './tokens.generated.js';
export const MOTION_VALUES = ['auto', 'twos', 'ones', 'still'];
/** 83.33 ms: FRAME/12 animates "on twos", 12 poses per second. */
export const POSE_MS = 1000 / tokenMotion.fps;
/** One display frame at 60 fps, used for `ones`. */
export const FRAME_MS = 1000 / 60;
/** Milliseconds between decorative updates at a tempo; `Infinity` for `still`. */
export function tempoIntervalMs(tempo) {
    if (tempo === 'twos')
        return POSE_MS;
    if (tempo === 'ones')
        return FRAME_MS;
    return Number.POSITIVE_INFINITY;
}
function isMotionValue(v) {
    return MOTION_VALUES.includes(v);
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
export function resolveTerminalMotion(input) {
    const env = input.env ?? {};
    const fallback = input.defaultTempo ?? 'twos';
    const warnings = [];
    /** A valid value (including `auto`), or undefined with a warning for an invalid one. */
    const parse = (raw, label) => {
        if (raw === undefined || raw.trim() === '')
            return undefined;
        const v = raw.trim().toLowerCase();
        if (isMotionValue(v))
            return v;
        warnings.push(`Ignored ${label}=${JSON.stringify(raw)}; expected one of ${MOTION_VALUES.join(', ')}.`);
        return undefined;
    };
    const settle = (v, source, label) => v === 'still' ? { tempo: v, source, reason: label, warnings } : { tempo: v, source, warnings };
    const flag = parse(flagValue(input.argv ?? [], '--motion'), '--motion');
    if (flag !== undefined && flag !== 'auto')
        return settle(flag, 'flag', '--motion');
    // An explicit `--motion auto` skips FRAME12_MOTION; only an absent or invalid flag reads it.
    if (flag === undefined) {
        const fromEnv = parse(env.FRAME12_MOTION, 'FRAME12_MOTION');
        if (fromEnv !== undefined && fromEnv !== 'auto')
            return settle(fromEnv, 'env', 'FRAME12_MOTION');
    }
    for (const name of ['NO_MOTION', 'REDUCED_MOTION']) {
        // Ported from Repo Archaeology: any non-empty value other than `0` asks for stillness.
        const v = env[name];
        if (v !== undefined && v.trim() !== '' && v.trim() !== '0') {
            return { tempo: 'still', source: 'reduced-motion-env', reason: name, warnings };
        }
    }
    const { caps } = input;
    const envReason = caps.dumb ? 'TERM=dumb' : caps.screenReader ? 'screen reader' : caps.ci ? 'CI' : !caps.interactive ? 'not interactive' : undefined;
    if (envReason)
        return { tempo: 'still', source: 'environment', reason: envReason, warnings };
    return { tempo: fallback, source: 'default', warnings };
}
