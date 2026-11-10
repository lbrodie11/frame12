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
function motionFlag(argv) {
    let found;
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--')
            break;
        if (a === '--motion' && i + 1 < argv.length)
            found = argv[i + 1];
        else if (a.startsWith('--motion='))
            found = a.slice('--motion='.length);
    }
    return found;
}
/**
 * Precedence:
 * 1. `--motion <auto|twos|ones|still>`
 * 2. `FRAME12_MOTION`
 * 3. `NO_MOTION` / `REDUCED_MOTION` (non-empty, not `0`) → `still`
 * 4. not interactive, CI, a screen reader, or `TERM=dumb` → `still`
 * 5. `auto` → the component's default (`twos`)
 *
 * An explicit `auto` at step 1 or 2 falls through to steps 3–5.
 */
export function resolveTerminalMotion(input) {
    const env = input.env ?? {};
    const fallback = input.defaultTempo ?? 'twos';
    const warnings = [];
    const explicit = (raw, source, label) => {
        if (raw === undefined || raw.trim() === '')
            return undefined;
        const v = raw.trim().toLowerCase();
        if (!isMotionValue(v)) {
            warnings.push(`Ignored ${label}=${JSON.stringify(raw)}; expected one of ${MOTION_VALUES.join(', ')}.`);
            return undefined;
        }
        if (v === 'auto')
            return undefined;
        return v === 'still' ? { tempo: v, source, reason: label, warnings } : { tempo: v, source, warnings };
    };
    const fromFlag = explicit(motionFlag(input.argv ?? []), 'flag', '--motion');
    if (fromFlag)
        return fromFlag;
    const fromEnv = explicit(env.FRAME12_MOTION, 'env', 'FRAME12_MOTION');
    if (fromEnv)
        return fromEnv;
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
