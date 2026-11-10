/**
 * One sanitizer for every untrusted string, merged from Repo Archaeology (RA-13) and the PR #2
 * storyboard experiment. Renderers only ever see its output.
 *
 * It removes CSI, OSC (including smuggled OSC 8 links and OSC 52 clipboard writes), DCS, SOS,
 * PM, APC and two-byte ESC sequences, in both 7-bit and C1 forms. It turns CR and BS overwrite
 * tricks into visible text, shows bidi controls (Trojan Source) as `\u{202e}` escapes, shows
 * zero-width characters as escapes in identifiers and paths, expands tabs at fixed stops, and
 * caps lines with a visible `…+N chars`.
 *
 * Links are `https:` only (plus `http:` to localhost when allowed) with credentials removed.
 * A redaction hook runs on every field, and so does the default redactor, which masks common
 * token shapes wherever they appear (commands, errors and warnings leak secrets as often as logs).
 */
import { FORBIDDEN_KEYS } from './contract.js';
const FORBIDDEN = new Set(FORBIDDEN_KEYS);
import { graphemes, stringWidth } from './width.js';
export const DEFAULT_MAX_LINE_LENGTH = 2000;
export const DEFAULT_TAB_WIDTH = 4;
// Terminators: BEL, ST (ESC \ or C1 0x9c), the start of the next escape, a line break, or end of
// input. Stopping at a line break means one unterminated sequence can only consume the rest of its
// own line, never hide the lines after it (a real terminal would swallow them; we show them).
const END = '(?:\\u0007|\\u001b\\\\|\\u009c|(?=[\\u001b\\n\\r\\u0085\\u2028\\u2029])|$)';
const BODY = '[^\\u0007\\u001b\\u009c\\n\\r\\u0085\\u2028\\u2029]*';
const OSC_RE = new RegExp(`(?:\\u001b\\]|\\u009d)${BODY}${END}`, 'g');
const STRING_SEQ_RE = new RegExp(`(?:\\u001b[PX^_]|[\\u0090\\u0098\\u009e\\u009f])${BODY}${END}`, 'g');
const CSI_RE = /(?:\u001b\[|\u009b)[0-?]*[ -/]*[@-~]?/g;
// nF / Fp / Fe / Fs escapes (ESC ( B, ESC 7, ESC c …) and any lone ESC.
const ESC_RE = /\u001b[\x20-\x2f]*[\x30-\x7e]?/g;
/** Bidirectional formatting controls (Trojan Source, CVE-2021-42574). Always made visible. */
const BIDI_RE = /[؜‎‏‪-‮⁦-⁩]/g;
/** Invisible characters used for spoofing and smuggling. */
const INVISIBLE = /[​‌‍⁠-⁤﻿᠎͏ᅟᅠㅤﾠ­]/;
const INVISIBLE_G = new RegExp(INVISIBLE.source, 'g');
/** Joiners that shape real scripts (ZWNJ in Persian, ZWJ in emoji and Indic text). */
const SHAPING_JOINERS = /[‌‍]/;
const PICTOGRAPHIC_RE = /\p{Extended_Pictographic}/u;
const CONTROL_RE = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g;
/** `\x07` for code points below 0x100, `\u{202e}` above. */
export function visibleEscape(ch) {
    const cp = ch.codePointAt(0);
    return cp < 0x100 ? `\\x${cp.toString(16).padStart(2, '0')}` : `\\u{${cp.toString(16)}}`;
}
function toText(input) {
    if (typeof input === 'string')
        return input;
    if (typeof input === 'number' || typeof input === 'boolean' || typeof input === 'bigint')
        return String(input);
    return '';
}
function stripEscapes(s) {
    return s.replace(OSC_RE, '').replace(STRING_SEQ_RE, '').replace(CSI_RE, '').replace(ESC_RE, '');
}
function expandTabs(line, tabWidth, options) {
    if (!line.includes('\t'))
        return line;
    let out = '';
    let col = 0;
    for (const part of line.split(/(\t)/)) {
        if (part === '\t') {
            const n = tabWidth - (col % tabWidth);
            out += ' '.repeat(n);
            col += n;
        }
        else {
            out += part;
            col += stringWidth(part, options);
        }
    }
    return out;
}
function handleInvisible(line, mode) {
    if (!INVISIBLE.test(line))
        return line;
    if (mode === 'text') {
        // Keep joiners that shape text; drop invisible spacing and fillers.
        return line.replace(INVISIBLE_G, (ch) => (SHAPING_JOINERS.test(ch) ? ch : ''));
    }
    // Identifiers: keep ZWJ only inside an emoji sequence; everything else becomes visible.
    return graphemes(line)
        .map((g) => {
        if (!INVISIBLE.test(g))
            return g;
        const emoji = PICTOGRAPHIC_RE.test(g);
        return g.replace(INVISIBLE_G, (ch) => (emoji && ch === '‍' ? ch : visibleEscape(ch)));
    })
        .join('');
}
/** A cap marker this function wrote: `…+N chars` or `...+N chars` at the end of a line. */
const CAP_MARKER_RE = /(?:…|\.\.\.)\+(\d+) chars$/;
/**
 * Caps a line at `max` graphemes with a visible `…+N chars`. Idempotent: a line that already ends
 * in a marker is measured without it, and if it must be cut again the counts are added, so the
 * marker always reports every grapheme removed from the original text.
 */
function capLine(line, max, ascii) {
    if (!Number.isFinite(max) || line.length <= max)
        return line;
    const marker = CAP_MARKER_RE.exec(line);
    const body = marker ? line.slice(0, marker.index) : line;
    const earlier = marker ? Number(marker[1]) : 0;
    const gs = graphemes(body);
    if (gs.length <= max)
        return line;
    return `${gs.slice(0, max).join('')}${ascii ? '...' : '…'}+${gs.length - max + earlier} chars`;
}
/**
 * Makes untrusted text safe to print. The result contains no ESC, BEL, C1 control or bidi
 * control, and no line break unless `newlines: 'keep'`. Never throws; non-strings become ''.
 * Idempotent: sanitizing sanitized text changes nothing.
 */
export function sanitizeText(input, options = {}) {
    let s = toText(input);
    if (s === '')
        return '';
    const mode = options.mode ?? 'text';
    const newlines = options.newlines ?? 'space';
    const tabWidth = Math.max(1, Math.floor(options.tabWidth ?? DEFAULT_TAB_WIDTH));
    const maxLine = options.maxLineLength ?? DEFAULT_MAX_LINE_LENGTH;
    s = stripEscapes(s);
    // Every line-ending form, including lone CR (an overwrite trick), becomes a line break, so
    // text hidden by a carriage return is shown rather than painted over.
    s = s.replace(/\r\n?|[\u000b\u000c\u0085\u2028\u2029]/g, '\n');
    s = s.replace(BIDI_RE, visibleEscape);
    // BS (overwrite trick), NUL, BEL, DEL, C1 and other controls become visible escapes.
    s = s.replace(CONTROL_RE, visibleEscape);
    const ascii = options.ascii === true;
    const lines = s.split('\n').map((line) => handleInvisible(expandTabs(line, tabWidth, options), mode));
    if (newlines === 'keep')
        return lines.map((line) => capLine(line, maxLine, ascii)).join('\n');
    // Single-line output: the cap applies to the joined line, not to each source line.
    return capLine(lines.join(newlines === 'escape' ? '\\n' : ' '), maxLine, ascii);
}
const LOCALHOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const UNSAFE_URL_CHARS = /[\u0000- \u007f-\u009f­؜​-‏‪-‮⁠-⁩﻿]/;
/**
 * Returns a normalized URL safe to put in an OSC 8 link, or `undefined`. Only `https:` (and,
 * when allowed, `http:` to localhost). User names and passwords are removed.
 */
export function safeLink(href, policy = {}) {
    if (typeof href !== 'string')
        return undefined;
    const raw = href.trim();
    if (raw === '' || raw.length > 2048 || UNSAFE_URL_CHARS.test(raw))
        return undefined;
    let url;
    try {
        url = new URL(raw);
    }
    catch {
        return undefined;
    }
    const local = LOCALHOSTS.has(url.hostname.toLowerCase());
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && policy.allowLocalhostHttp === true && local))
        return undefined;
    if (url.hostname === '')
        return undefined;
    url.username = '';
    url.password = '';
    const out = url.href;
    return /[\u0000-\u001f\u007f-\u009f]/.test(out) ? undefined : out;
}
/**
 * Wraps already-sanitized `text` in an OSC 8 hyperlink when links are enabled and the URL passes
 * `safeLink`; otherwise returns `text` unchanged. This is the only OSC 8 the package emits.
 */
export function formatLink(text, href, enabled, policy = {}) {
    if (!enabled)
        return text;
    const url = safeLink(href, policy);
    if (!url)
        return text;
    return `\u001b]8;;${url}\u001b\\${text}\u001b]8;;\u001b\\`;
}
export const REDACTED = '[redacted]';
/** Token shapes masked by default in every string an event or snapshot carries. */
export const DEFAULT_REDACTION_PATTERNS = [
    { name: 'github-token', pattern: /\bgh[pousr]_[A-Za-z0-9]{36,255}\b/g },
    { name: 'github-fine-grained-token', pattern: /\bgithub_pat_[A-Za-z0-9_]{22,255}\b/g },
    { name: 'openai-or-anthropic-key', pattern: /\bsk-(?:[A-Za-z0-9]+-)*[A-Za-z0-9_-]{20,}\b/g },
    { name: 'slack-token', pattern: /\bxox[abpr]-[A-Za-z0-9-]{10,}\b/g },
    { name: 'aws-access-key-id', pattern: /\b(?:AKIA|ASIA|ABIA|ACCA)[A-Z0-9]{16}\b/g },
    { name: 'jwt', pattern: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g },
    { name: 'url-credentials', pattern: /(?<=\b[a-z][a-z0-9+.-]*:\/\/)[^\s/@:]+:[^\s/@]+(?=@)/gi },
];
/** Masks every default token shape with `[redacted]`. */
export function redactSecrets(text) {
    let out = text;
    for (const { pattern } of DEFAULT_REDACTION_PATTERNS)
        out = out.replace(pattern, REDACTED);
    return out;
}
/** Keys whose strings are identifiers: zero-width characters stay visible as escapes. */
const IDENTIFIER_KEYS = new Set(['id', 'runId', 'cut', 'scene', 'name', 'code', 'kind', 'value', 'ts', 'at', 'startedAt', 'finishedAt', 'unit']);
/**
 * Builds the sanitizer every renderer and the director use. Each string is sanitized, redacted
 * (defaults on `log`/`receipt` fields, then the hook on all fields), and sanitized again, so a
 * hook can never reintroduce control sequences.
 */
export function createSanitizer(options = {}) {
    const base = {
        ...(options.ambiguousWide !== undefined ? { ambiguousWide: options.ambiguousWide } : {}),
        ...(options.maxLineLength !== undefined ? { maxLineLength: options.maxLineLength } : {}),
        ...(options.tabWidth !== undefined ? { tabWidth: options.tabWidth } : {}),
        ...(options.ascii !== undefined ? { ascii: options.ascii } : {}),
    };
    const defaults = options.defaultRedaction !== false;
    const clean = (value, field, source, mode) => {
        const opts = {
            ...base,
            mode,
            newlines: field === 'log' ? 'keep' : 'space',
            // Cap after redaction so a mask is never cut in half.
            maxLineLength: Number.POSITIVE_INFINITY,
        };
        let s = sanitizeText(value, opts);
        if (defaults)
            s = redactSecrets(s);
        if (options.redact) {
            try {
                s = sanitizeText(options.redact(s, { field, source }), opts);
            }
            catch {
                s = REDACTED; // A failing hook must not leak the unredacted value.
            }
        }
        return sanitizeText(s, { ...opts, maxLineLength: base.maxLineLength ?? DEFAULT_MAX_LINE_LENGTH });
    };
    const text = (value, field = 'text', source = 'text') => clean(value, field, source, field === 'identifier' ? 'identifier' : 'text');
    const href = (value) => safeLink(value, options.links);
    const walk = (value, key, source, inReceipt, inLog, depth) => {
        if (depth > 16)
            return undefined;
        if (typeof value === 'string') {
            if (inLog && key === 'text')
                return clean(value, 'log', source, 'text');
            // Receipts get the default redactor; their values are identifiers (SHAs, paths).
            if (inReceipt && key === 'value')
                return clean(value, 'receipt', source, 'identifier');
            if (inReceipt && key === 'note')
                return clean(value, 'receipt', source, 'text');
            if (IDENTIFIER_KEYS.has(key) || (key === 'label' && source.endsWith(':subject')))
                return clean(value, 'identifier', source, 'identifier');
            return clean(value, 'text', source, 'text');
        }
        if (Array.isArray(value)) {
            const out = [];
            for (const item of value) {
                const v = walk(item, key, source, inReceipt || key === 'receipts', inLog, depth + 1);
                if (v !== undefined)
                    out.push(v);
            }
            return out;
        }
        if (value !== null && typeof value === 'object') {
            const out = {};
            for (const [k, v] of Object.entries(value)) {
                // Never copy `__proto__` & co.: assignment would swap the copy's prototype and smuggle in
                // values validation never saw. validateEvent rejects them; this is defense in depth.
                if (FORBIDDEN.has(k))
                    continue;
                if (k === 'href') {
                    const safe = href(v);
                    if (safe !== undefined)
                        out[k] = safe;
                    continue;
                }
                const childSource = k === 'subject' ? `${source}:subject` : source;
                const w = walk(v, k, childSource, inReceipt || k === 'receipt' || k === 'receipts', inLog, depth + 1);
                if (w !== undefined)
                    out[k] = w;
            }
            return out;
        }
        return value;
    };
    return {
        text,
        href,
        event(event) {
            return walk(event, '', event.type, false, event.type === 'log', 0);
        },
        snapshot(snapshot) {
            return walk(snapshot, '', 'snapshot', false, false, 0);
        },
    };
}
