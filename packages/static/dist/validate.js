/** Validation helpers. Every failure throws a `TypeError` naming the function and field. */
export const IDENT_RE = /^[a-z][a-z0-9-]{0,63}$/;
export function fail(where, message) {
    throw new TypeError(`[@frame12/static ${where}] ${message}`);
}
/** Identifiers that end up in ids, `data-area` and CSS custom properties. */
export function ident(where, field, value) {
    if (typeof value !== 'string' || !IDENT_RE.test(value)) {
        fail(where, `${field} must match ${IDENT_RE} (got ${JSON.stringify(String(value)).slice(0, 80)})`);
    }
    return value;
}
export function optIdent(where, field, value) {
    return value === undefined ? undefined : ident(where, field, value);
}
export function num(where, field, value, min, max, opts = {}) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        fail(where, `${field} must be a finite number (got ${String(value)})`);
    }
    if (value < min || value > max) {
        fail(where, `${field} must be between ${min} and ${max} (got ${value})`);
    }
    if (opts.integer && !Number.isInteger(value)) {
        fail(where, `${field} must be an integer (got ${value})`);
    }
    return value;
}
export function oneOf(where, field, value, allowed, fallback) {
    if (value === undefined)
        return fallback;
    if (typeof value !== 'string' || !allowed.includes(value)) {
        fail(where, `${field} must be one of ${allowed.join(', ')} (got ${JSON.stringify(String(value)).slice(0, 80)})`);
    }
    return value;
}
export function optString(where, field, value) {
    if (value === undefined)
        return undefined;
    if (typeof value !== 'string')
        fail(where, `${field} must be a string`);
    return value;
}
export function bool(where, field, value, fallback) {
    if (value === undefined)
        return fallback;
    if (typeof value !== 'boolean')
        fail(where, `${field} must be a boolean`);
    return value;
}
