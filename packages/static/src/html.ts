/**
 * The escaping core of `@frame12/static`.
 *
 * `Html` is a frozen wrapper object, not a string. Trust is decided by object identity: only
 * instances created inside this module (by a renderer, `fragment()` or `unsafeRaw()`) carry the
 * private `#markup` field, so a plain string is always escaped, whatever text it contains, and
 * whatever was rendered earlier in the process. Instances are ordinary garbage-collected objects:
 * there is no registry, no eviction and no memory held after the caller drops them.
 *
 * Use `String(html)` (or `${html}`) to get the markup. The resulting string is plain text again:
 * passing it back to a renderer escapes it.
 */

const CONSTRUCT = Symbol('frame12.static.Html');

/** Markup produced by an `@frame12/static` renderer, `fragment()` or `unsafeRaw()`. */
export class Html {
  readonly #markup: string;

  /** @internal Not constructible outside this package: use a renderer, `fragment()` or `unsafeRaw()`. */
  constructor(token: symbol, markup: string) {
    if (token !== CONSTRUCT || typeof markup !== 'string') {
      throw new TypeError('Html values are created by @frame12/static renderers, fragment() or unsafeRaw()');
    }
    this.#markup = markup;
    Object.freeze(this);
  }

  /** The markup as a string (plain text from here on: a renderer escapes it). */
  toString(): string {
    return this.#markup;
  }

  valueOf(): string {
    return this.#markup;
  }

  toJSON(): string {
    return this.#markup;
  }

  /** @internal Brand check that a forged prototype or a copied object can't pass. */
  static is(value: unknown): value is Html {
    return typeof value === 'object' && value !== null && #markup in value;
  }
}

/** Anything a renderer accepts where React accepts `children`: `Html` as is, a string as text. */
export type Child = Html | string;

/**
 * True only for `Html` objects created by this package. Equal text is not enough: a string, or an
 * object that merely looks like `Html`, is not trusted.
 */
export function isHtml(value: unknown): value is Html {
  return Html.is(value);
}

const ESCAPES: Record<string, string> = {
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
export function escapeHtml(s: string): string {
  return String(s)
    .replace(LONE_SURROGATE, '�')
    .replace(CONTROL, '�')
    .replace(/[&<>"']/g, (c) => ESCAPES[c] as string);
}

/**
 * Marks `trustedHtml` as `Html` without escaping it. This is the ONLY way to bypass escaping.
 * Never pass commit subjects, file names, PR text or any other user or repository input.
 */
export function unsafeRaw(trustedHtml: string): Html {
  if (typeof trustedHtml !== 'string') {
    throw new TypeError('unsafeRaw() expects a string');
  }
  return new Html(CONSTRUCT, trustedHtml);
}

/** Converts a child to markup: `Html` passes through, a string is escaped once as text. */
export function child(value: Child | null | undefined | false): string {
  if (value === null || value === undefined || value === false) return '';
  if (Html.is(value)) return value.toString();
  if (typeof value !== 'string') {
    throw new TypeError(`Expected Html or string, received ${typeof value}`);
  }
  return escapeHtml(value);
}

/**
 * Concatenates parts into one `Html` value. `Html` parts are inserted as is and strings are
 * escaped. Use it to compose: `${a}${b}` or `String(a) + String(b)` produce plain text, which a
 * renderer would then escape.
 */
export function fragment(...parts: Array<Child | null | undefined | false>): Html {
  let out = '';
  for (const p of parts) out += child(p);
  return new Html(CONSTRUCT, out);
}

/** Internal: wraps renderer output. Only call with markup built from escaped parts. */
export function html(markup: string): Html {
  return new Html(CONSTRUCT, markup);
}

export type AttrValue = string | number | boolean | null | undefined;

/**
 * Serializes attributes in the given (stable) order. `false`, `null` and `undefined` omit the
 * attribute; `true` and `''` render `name=""`. Values are always double-quoted and escaped.
 */
export function attrs(list: ReadonlyArray<readonly [string, AttrValue]>): string {
  let out = '';
  for (const [name, value] of list) {
    if (value === false || value === null || value === undefined) continue;
    if (!/^[a-z][a-z0-9:-]*$/.test(name)) {
      throw new TypeError(`Invalid attribute name "${name}"`);
    }
    const v = value === true ? '' : String(value);
    out += ` ${name}="${escapeHtml(v)}"`;
  }
  return out;
}

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp|#39);/gi, (m, e: string) => {
    const k = e.toLowerCase();
    if (k === 'amp') return '&';
    if (k === 'lt') return '<';
    if (k === 'gt') return '>';
    if (k === 'quot') return '"';
    if (k === 'apos' || k === '#39') return "'";
    if (k === 'nbsp') return ' ';
    const code = k.startsWith('#x') ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
    return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
  });
}

/** Parses a start tag's attribute list into lower-cased names and decoded values. */
export function parseAttributes(source: string): Map<string, string> {
  const out = new Map<string, string>();
  const re = /([^\s"'>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    const name = (m[1] as string).toLowerCase();
    if (!out.has(name)) out.set(name, decodeEntities(m[2] ?? m[3] ?? m[4] ?? ''));
  }
  return out;
}

/**
 * Visible text of a child, mirroring React's `extractTextContent`: plain strings are returned
 * as is; `Html` has its tags stripped and entities decoded, and subtrees whose element has
 * `aria-hidden="true"` (exact, like React's `=== 'true'`) or a `hidden` attribute are skipped.
 * Attributes are tokenised, so `title="was hidden"` is not mistaken for `hidden`; unbalanced
 * closing tags close the nearest matching open element and are otherwise ignored.
 */
export function textContent(value: Child | null | undefined | false): string {
  if (value === null || value === undefined || value === false) return '';
  if (!Html.is(value)) return String(value);
  const markup = value.toString();
  let out = '';
  const stack: Array<{ name: string; hidden: boolean }> = [];
  const hiddenDepth = () => stack.some((e) => e.hidden);
  const re = /<!--[\s\S]*?-->|<\/([a-zA-Z][a-zA-Z0-9-]*)\s*>|<([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|([^<]+)|</g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markup))) {
    const [token, closeName, openName, rest, text] = m;
    if (text !== undefined) {
      if (!hiddenDepth()) out += decodeEntities(text);
    } else if (closeName) {
      const name = closeName.toLowerCase();
      const idx = stack.map((e) => e.name).lastIndexOf(name);
      if (idx !== -1) stack.length = idx;
    } else if (openName) {
      const name = openName.toLowerCase();
      const raw = rest ?? '';
      if (VOID.has(name) || /\/\s*$/.test(raw)) continue;
      const a = parseAttributes(raw);
      stack.push({ name, hidden: a.get('aria-hidden') === 'true' || a.has('hidden') });
    } else if (token === '<' && !hiddenDepth()) {
      out += '<';
    }
  }
  return out;
}
