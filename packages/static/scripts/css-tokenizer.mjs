/**
 * A small CSS parser for the canonical FRAME/12 stylesheet. No dependencies.
 *
 * `parseCss(text)` returns a tree of nodes:
 *   { type: 'rule', selector: string, body: string }               // body = declarations, verbatim
 *   { type: 'at', name, prelude, children: Node[] }                 // @media, @container, @supports, @layer, @scope
 *   { type: 'at', name, prelude, body: string }                     // @font-face, @keyframes, @page, @property, @counter-style …
 *   { type: 'at', name, prelude, body: null }                       // statement at-rules (@import, @charset, @layer a, b;)
 * Comments are dropped. Strings, escapes, parentheses and brackets are respected while looking
 * for `{`, `}`, `;` and `,`, so `content: "}"`, `url(a;b)` and `[data-x="a,b"]` are safe.
 */

const NESTED_AT_RULES = new Set(['media', 'container', 'supports', 'layer', 'scope', 'document', 'starting-style']);

/** Removes comments that are outside strings. */
export function stripComments(text) {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '"' || ch === "'") {
      const end = scanString(text, i);
      out += text.slice(i, end);
      i = end;
    } else if (ch === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      if (end === -1) throw new SyntaxError(`Unterminated comment at offset ${i}`);
      out += ' ';
      i = end + 2;
    } else {
      out += ch;
      i++;
    }
  }
  return out;
}

/** Returns the index just past the string starting at `start` (which holds the quote). */
function scanString(text, start) {
  const quote = text[start];
  let i = start + 1;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === quote) return i + 1;
    if (ch === '\n') throw new SyntaxError(`Unterminated string at offset ${start}`);
    i++;
  }
  throw new SyntaxError(`Unterminated string at offset ${start}`);
}

/**
 * Scans from `i` to the first top-level character in `stops` (outside strings, parens and
 * brackets). Returns its index, or `text.length` when none is found.
 */
function scanTo(text, i, stops) {
  let paren = 0;
  let bracket = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === '"' || ch === "'") {
      i = scanString(text, i);
      continue;
    }
    if (ch === '(') paren++;
    else if (ch === ')') paren = Math.max(0, paren - 1);
    else if (ch === '[') bracket++;
    else if (ch === ']') bracket = Math.max(0, bracket - 1);
    else if (paren === 0 && bracket === 0 && stops.includes(ch)) return i;
    i++;
  }
  return i;
}

/** Index of the `}` matching the `{` at `open`. */
function matchBrace(text, open) {
  let depth = 0;
  let i = open;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === '"' || ch === "'") {
      i = scanString(text, i);
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
    i++;
  }
  throw new SyntaxError(`Unbalanced "{" at offset ${open}`);
}

function parseBlock(text) {
  const nodes = [];
  let i = 0;
  while (i < text.length) {
    while (i < text.length && /\s/.test(text[i])) i++;
    if (i >= text.length) break;
    if (text[i] === '}') throw new SyntaxError(`Unexpected "}" at offset ${i}`);
    const stop = scanTo(text, i, '{;}');
    const prelude = text.slice(i, stop).trim();
    if (stop >= text.length || text[stop] === '}') {
      if (prelude) throw new SyntaxError(`Unterminated statement "${prelude.slice(0, 60)}"`);
      break;
    }
    if (text[stop] === ';') {
      if (!prelude.startsWith('@')) throw new SyntaxError(`Stray declaration "${prelude.slice(0, 60)}" outside a rule`);
      const m = /^@([\w-]+)\s*([\s\S]*)$/.exec(prelude);
      nodes.push({ type: 'at', name: m[1].toLowerCase(), prelude: m[2].trim(), body: null });
      i = stop + 1;
      continue;
    }
    const close = matchBrace(text, stop);
    const inner = text.slice(stop + 1, close);
    if (prelude.startsWith('@')) {
      const m = /^@([\w-]+)\s*([\s\S]*)$/.exec(prelude);
      const name = m[1].toLowerCase();
      if (NESTED_AT_RULES.has(name)) {
        nodes.push({ type: 'at', name, prelude: m[2].trim(), children: parseBlock(inner) });
      } else {
        nodes.push({ type: 'at', name, prelude: m[2].trim(), body: inner.trim() });
      }
    } else {
      if (!prelude) throw new SyntaxError(`Empty selector at offset ${i}`);
      nodes.push({ type: 'rule', selector: prelude.replace(/\s+/g, ' '), body: inner.trim() });
    }
    i = close + 1;
  }
  return nodes;
}

export function parseCss(text) {
  return parseBlock(stripComments(text));
}

/** Splits a selector list on top-level commas. */
export function splitSelectors(selector) {
  const parts = [];
  let i = 0;
  while (i <= selector.length) {
    const stop = scanTo(selector, i, ',');
    const part = selector.slice(i, stop).trim();
    if (part) parts.push(part);
    i = stop + 1;
  }
  return parts;
}

/**
 * Classes and attribute names referenced by a single selector. Strings and attribute values are
 * ignored. Classes inside `:not(...)` are reported separately as `negated`.
 */
export function selectorRefs(selector) {
  const classes = new Set();
  const negated = new Set();
  const attributes = new Set();
  // Blank out strings so their contents can't look like classes.
  let s = '';
  for (let i = 0; i < selector.length; ) {
    const ch = selector[i];
    if (ch === '"' || ch === "'") {
      const end = scanString(selector, i);
      s += ' '.repeat(end - i);
      i = end;
    } else {
      s += ch;
      i++;
    }
  }
  for (const m of s.matchAll(/\[\s*([A-Za-z_][\w:-]*)/g)) attributes.add(m[1].toLowerCase());
  const noAttrs = s.replace(/\[[^\]]*\]/g, (x) => ' '.repeat(x.length));
  // Mark ranges inside :not(...) (nesting-aware).
  const negRanges = [];
  for (const m of noAttrs.matchAll(/:not\(/g)) {
    let depth = 1;
    let j = m.index + m[0].length;
    for (; j < noAttrs.length && depth > 0; j++) {
      if (noAttrs[j] === '(') depth++;
      else if (noAttrs[j] === ')') depth--;
    }
    negRanges.push([m.index, j]);
  }
  for (const m of noAttrs.matchAll(/\.(-?[_a-zA-Z][_a-zA-Z0-9-]*)/g)) {
    const inNot = negRanges.some(([a, b]) => m.index >= a && m.index < b);
    (inNot ? negated : classes).add(m[1]);
  }
  return { classes, negated, attributes };
}

/** Custom property names referenced through `var(--x)` without a fallback, and with one. */
export function varRefs(body) {
  const required = new Set();
  const all = new Set();
  for (const m of body.matchAll(/var\(\s*(--[\w-]+)\s*(,)?/g)) {
    all.add(m[1]);
    if (!m[2]) required.add(m[1]);
  }
  return { required, all };
}

/** Custom properties defined in a declaration block. */
export function definedVars(body) {
  const out = new Set();
  for (const m of body.matchAll(/(?:^|[;{\s])(--[\w-]+)\s*:/g)) out.add(m[1]);
  return out;
}

/** Serializes a node tree back to CSS. */
export function serialize(nodes, indent = '') {
  let out = '';
  for (const n of nodes) {
    if (n.type === 'rule') {
      const decls = n.body
        .split(/\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => `${indent}  ${l}`)
        .join('\n');
      out += `${indent}${splitSelectors(n.selector).join(`,\n${indent}`)} {\n${decls}\n${indent}}\n`;
    } else if (n.children) {
      out += `${indent}@${n.name}${n.prelude ? ` ${n.prelude}` : ''} {\n${serialize(n.children, `${indent}  `)}${indent}}\n`;
    } else if (n.body === null) {
      out += `${indent}@${n.name}${n.prelude ? ` ${n.prelude}` : ''};\n`;
    } else {
      const inner = n.body
        .split(/\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => `${indent}  ${l}`)
        .join('\n');
      out += `${indent}@${n.name}${n.prelude ? ` ${n.prelude}` : ''} {\n${inner}\n${indent}}\n`;
    }
  }
  return out;
}
