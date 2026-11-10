import { SCHEMA_VERSION } from './contract.js';
import { safeLink } from './safety.js';
export const RECORDING_VERSION = 1;
/** The header line, newline included. */
export function recordingHeader() {
    const header = { f12rec: RECORDING_VERSION, schemaVersion: SCHEMA_VERSION };
    return `${JSON.stringify(header)}\n`;
}
/** One entry line, newline included. `t` is rounded to whole milliseconds. */
export function recordingLine(t, event) {
    return `${JSON.stringify({ t: Math.max(0, Math.round(t)), event })}\n`;
}
/** True when a parsed line is a recording header this version understands. */
export function isRecordingHeader(value) {
    return recordingHeaderIssue(value) === undefined;
}
/**
 * For a parsed first line: `undefined` when it is a header this version reads, a message when it is
 * a recording header of another version (or schema), and `'not a recording'` otherwise.
 */
export function recordingHeaderIssue(value) {
    if (typeof value !== 'object' || value === null || !('f12rec' in value))
        return 'not a recording';
    const { f12rec, schemaVersion } = value;
    if (f12rec !== RECORDING_VERSION)
        return `unsupported recording version ${JSON.stringify(f12rec)} (this version reads ${RECORDING_VERSION})`;
    if (schemaVersion !== SCHEMA_VERSION)
        return `unsupported event schema ${JSON.stringify(schemaVersion)} in the recording (this version reads ${SCHEMA_VERSION})`;
    return undefined;
}
/**
 * Reads one parsed entry line: `{ t, event }` with a finite, non-negative `t`. The event itself is
 * not validated here; feed it to a validator or a Director like any other.
 */
export function parseRecordingEntry(value) {
    if (typeof value !== 'object' || value === null)
        return undefined;
    const { t, event } = value;
    if (typeof t !== 'number' || !Number.isFinite(t) || t < 0 || typeof event !== 'object' || event === null)
        return undefined;
    return { t, event };
}
/**
 * Runs every `href` (a remote) through the redaction hook, keeping only results that are still safe
 * links. Everything else was sanitized and redacted when the event was accepted.
 */
export function redactLinks(value, redact, source, policy, depth = 0) {
    if (!redact || depth > 16)
        return value;
    if (Array.isArray(value))
        return value.map((v) => redactLinks(v, redact, source, policy, depth + 1));
    if (value === null || typeof value !== 'object')
        return value;
    const out = {};
    for (const [k, v] of Object.entries(value)) {
        if (k === 'href' && typeof v === 'string') {
            // A hook that throws (say, an exhaustive switch written before `link` existed) drops the
            // link, as the sanitizer turns a throwing hook into [redacted]; the recording goes on.
            let redacted;
            try {
                redacted = redact(v, { field: 'link', source });
            }
            catch {
                redacted = undefined;
            }
            const safe = safeLink(redacted, policy);
            if (safe !== undefined)
                out[k] = safe;
            continue;
        }
        out[k] = redactLinks(v, redact, source, policy, depth + 1);
    }
    return out;
}
