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
export declare function safeUrl(u: string): string | null;
