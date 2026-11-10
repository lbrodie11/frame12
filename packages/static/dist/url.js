/**
 * Returns `u` when it is a safe link target, otherwise `null` (fail closed).
 *
 * Allowed: absolute `http:`, `https:` and `mailto:` URLs, and same-document `#fragment`s.
 * Rejected: every other scheme (`javascript:`, `data:`, `vbscript:`, `file:` …), relative and
 * protocol-relative paths, scheme positions spelled with character references (`&#106;avascript:`
 * has no valid scheme, so it is rejected), and any value containing control characters, whitespace
 * or backslashes, which browsers would strip or normalise into something other than what was
 * validated.
 */
export function safeUrl(u) {
    if (typeof u !== 'string')
        return null;
    const value = u;
    if (value.length === 0 || value.length > 8192)
        return null;
    // Any whitespace (including Unicode spaces and bidi controls), control character or backslash.
    if (/[\s\u0000-\u001F\u007F-\u009F\u00A0\u1680\u2000-\u200F\u2028-\u202F\u205F-\u206F\u3000\uFEFF\\]/.test(value)) {
        return null;
    }
    if (/[\uD800-\uDFFF]/.test(value))
        return null;
    if (value.startsWith('#')) {
        return /^#[A-Za-z0-9\-._~!$&'()*+,;=:@/?%]*$/.test(value) ? value : null;
    }
    const scheme = /^([A-Za-z][A-Za-z0-9+.-]*):/.exec(value);
    if (!scheme)
        return null;
    const s = scheme[1].toLowerCase();
    if (s !== 'http' && s !== 'https' && s !== 'mailto')
        return null;
    let parsed;
    try {
        parsed = new URL(value);
    }
    catch {
        return null;
    }
    if (parsed.protocol !== `${s}:`)
        return null;
    if ((s === 'http' || s === 'https') && !parsed.hostname)
        return null;
    return value;
}
