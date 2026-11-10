/**
 * The escaping core of `@frame12/static`.
 *
 * `Html` is a branded string type. The brand is a compile-time aid only: TypeScript lets anyone
 * write `'<script>' as Html`. At runtime the kit recognises trusted markup through an internal
 * registry of strings that its own renderers, `fragment()` and `unsafeRaw()` produced. A string
 * that only claims to be `Html` through a cast is not in the registry, so it is escaped as text.
 */
// Bounded registry of trusted markup. Strings are values, so they can't live in a WeakSet;
// the registry keeps the most recent entries and drops the oldest half when it grows past
// MAX_TRUSTED. Fragments are normally consumed right after they are rendered, so eviction only
// affects markup held for a very long time: it is then escaped (fails safe), never trusted.
const MAX_TRUSTED = 200_000;
let trusted = new Set();
function trust(s) {
    if (!trusted.has(s)) {
        if (trusted.size >= MAX_TRUSTED) {
            trusted = new Set([...trusted].slice(MAX_TRUSTED / 2));
        }
        trusted.add(s);
    }
    return s;
}
/** True when `value` is markup this package produced (not merely typed as `Html`). */
export function isHtml(value) {
    return typeof value === 'string' && trusted.has(value);
}
const ESCAPES = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
};
// Lone UTF-16 surrogates can't be encoded as UTF-8; replace them so every output is well-formed.
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;
// C0 controls other than tab/newline/carriage return, DEL and C1 controls are not allowed in
// HTML text; replace them with U+FFFD so they can't confuse downstream parsers or terminals.
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;
/**
 * Escapes `& < > " '` and replaces control characters and lone surrogates with U+FFFD.
 * Safe for text content and for quoted attribute values.
 */
export function escapeHtml(s) {
    return String(s)
        .replace(LONE_SURROGATE, '�')
        .replace(CONTROL, '�')
        .replace(/[&<>"']/g, (c) => ESCAPES[c]);
}
/**
 * Marks `trustedHtml` as `Html` without escaping it. This is the ONLY way to bypass escaping.
 * Never pass commit subjects, file names, PR text or any other user or repository input.
 */
export function unsafeRaw(trustedHtml) {
    if (typeof trustedHtml !== 'string') {
        throw new TypeError('unsafeRaw() expects a string');
    }
    return trust(trustedHtml);
}
/** Converts a child to markup: `Html` passes through, anything else is escaped once as text. */
export function child(value) {
    if (value === null || value === undefined || value === false)
        return '';
    if (typeof value !== 'string') {
        throw new TypeError(`Expected Html or string, received ${typeof value}`);
    }
    return isHtml(value) ? value : escapeHtml(value);
}
/**
 * Concatenates parts into one `Html` value. `Html` parts are inserted as is and strings are
 * escaped. Use it instead of `+`: joining two `Html` values with `+` produces a plain string,
 * which a renderer would then escape.
 */
export function fragment(...parts) {
    let out = '';
    for (const p of parts)
        out += child(p);
    return trust(out);
}
/** Internal: wraps renderer output. Only call with markup built from escaped parts. */
export function html(markup) {
    return trust(markup);
}
/**
 * Serializes attributes in the given (stable) order. `false`, `null` and `undefined` omit the
 * attribute; `true` and `''` render `name=""`. Values are always double-quoted and escaped.
 */
export function attrs(list) {
    let out = '';
    for (const [name, value] of list) {
        if (value === false || value === null || value === undefined)
            continue;
        if (!/^[a-z][a-z0-9:-]*$/.test(name)) {
            throw new TypeError(`Invalid attribute name "${name}"`);
        }
        const v = value === true ? '' : String(value);
        out += ` ${name}="${escapeHtml(v)}"`;
    }
    return out;
}
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
function decodeEntities(s) {
    return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp|#39);/gi, (m, e) => {
        const k = e.toLowerCase();
        if (k === 'amp')
            return '&';
        if (k === 'lt')
            return '<';
        if (k === 'gt')
            return '>';
        if (k === 'quot')
            return '"';
        if (k === 'apos' || k === '#39')
            return "'";
        if (k === 'nbsp')
            return ' ';
        const code = k.startsWith('#x') ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
        return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
    });
}
/**
 * Visible text of a child, mirroring React's `extractTextContent`: plain strings are returned
 * as is, `Html` has its tags stripped and entities decoded, and subtrees marked
 * `aria-hidden="true"` or `hidden` are skipped.
 */
export function textContent(value) {
    if (value === null || value === undefined || value === false)
        return '';
    if (!isHtml(value))
        return String(value);
    let out = '';
    let hiddenDepth = 0;
    const stack = [];
    const re = /<!--[\s\S]*?-->|<\/?([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|([^<]+)|</g;
    let m;
    while ((m = re.exec(value))) {
        const [token, tagName, rest, text] = m;
        if (text !== undefined) {
            if (hiddenDepth === 0)
                out += decodeEntities(text);
            continue;
        }
        if (!tagName) {
            if (token === '<' && hiddenDepth === 0)
                out += '<';
            continue;
        }
        const name = tagName.toLowerCase();
        if (token.startsWith('</')) {
            const wasHidden = stack.pop();
            if (wasHidden)
                hiddenDepth--;
            continue;
        }
        const selfClosing = /\/\s*$/.test(rest ?? '') || VOID.has(name);
        if (selfClosing)
            continue;
        const isHidden = /\saria-hidden\s*=\s*("true"|'true'|true\b)/i.test(rest ?? '') || /\shidden(\s|=|$)/i.test(rest ?? '');
        stack.push(isHidden);
        if (isHidden)
            hiddenDepth++;
    }
    return out;
}
