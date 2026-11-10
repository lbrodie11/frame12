// Structural parity: for every primitive in PARITY.md, normalized renderToStaticMarkup output of
// the React component equals the static output, except for the rows marked divergent, whose
// differences are asserted explicitly.
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { S, check, finish } from './lib.mjs';
import { loadReactKit } from './react-harness.mjs';

const R = await loadReactKit();
const h = React.createElement;

function decode(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, e) => {
    const k = e.toLowerCase();
    if (k === 'amp') return '&';
    if (k === 'lt') return '<';
    if (k === 'gt') return '>';
    if (k === 'quot') return '"';
    if (k === 'apos') return "'";
    return String.fromCodePoint(k.startsWith('#x') ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10));
  });
}

/** Ids that come from React.useId (React) or from an input hash (static) become "ID". */
function normalizeIds(v) {
  return v
    .replace(/(f12-gw-mask-(?:[A-Za-z0-9_-]+?-)?)(?:_R_[A-Za-z0-9_]*?_|R[A-Za-z0-9]+|s[0-9a-z]+)(?=$|\))/g, '$1ID')
    .replace(/(bp-[A-Za-z0-9_-]+?-)(?:_R_[A-Za-z0-9_]*?_|R[A-Za-z0-9]+|f12s[0-9a-z]+)(?=$|")/g, '$1ID');
}

/**
 * Normalized markup: one token per line, attributes sorted, class lists sorted, entities decoded,
 * whitespace collapsed, style declarations sorted, auto ids replaced by ID.
 */
export function normalize(markup) {
  const out = [];
  const re = /<style>([\s\S]*?)<\/style>|<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[a-zA-Z][a-zA-Z0-9:-]*(?:="[^"]*")?)*)\s*(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(markup))) {
    if (m[1] !== undefined) {
      out.push(`<style>${normalizeIds(m[1]).replace(/\s+/g, ' ').trim()}</style>`);
    } else if (m[3]) {
      if (m[2]) {
        out.push(`</${m[3].toLowerCase()}>`);
        continue;
      }
      const attrs = [];
      for (const a of m[4].matchAll(/([a-zA-Z][a-zA-Z0-9:-]*)(?:="([^"]*)")?/g)) {
        let v = decode(a[2] ?? '');
        const name = a[1].toLowerCase();
        if (name === 'class') v = v.split(/\s+/).filter(Boolean).sort().join(' ');
        else if (name === 'style') v = v.split(';').map((d) => d.trim()).filter(Boolean).sort().join(';');
        else v = normalizeIds(v.replace(/\s+/g, ' ').trim());
        attrs.push(`${name}="${v}"`);
      }
      attrs.sort();
      out.push(`<${m[3].toLowerCase()}${attrs.length ? ' ' + attrs.join(' ') : ''}>`);
    } else if (m[6] !== undefined) {
      // Text is compared exactly (entities decoded, whitespace untouched), so untrimmed values
      // or lost spaces can't hide behind normalization.
      const t = decode(m[6]);
      out.push(`#text ${JSON.stringify(t)}`);
    }
  }
  return out.join('\n');
}

function firstDiff(a, b) {
  const x = a.split('\n');
  const y = b.split('\n');
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if (x[i] !== y[i]) return `line ${i}: react=${JSON.stringify(x[i])} static=${JSON.stringify(y[i])}`;
  }
  return '';
}

function same(label, reactEl, staticHtml) {
  const r = normalize(renderToStaticMarkup(reactEl));
  const s = normalize(staticHtml);
  check(r === s, `parity: ${label}`, r === s ? '' : firstDiff(r, s));
}

const variants = ['expressive', 'quiet'];

// The normalizer must see every tag as a tag (a regex gap would hide differences as text).
check(
  !normalize(S.ghostWire({ from: 'a', to: 'b', label: 'l' }) + S.metric({ label: 'L', value: 1, big: true })).split('\n').some((l) => l.startsWith('#text') && /<|="/.test(l)),
  'normalizer self-check: no markup is misread as text',
);

// ---------------------------------------------------------------- Sheet
// Divergence: Sheet always emits f12-m-cut. Compare against React's motion="cut", then assert it.
for (const props of [{}, { pegs: false }, { autoCut: true }, { autoCut: true, theme: 'dark' }, { theme: 'light', pegs: false }]) {
  same(`Sheet ${JSON.stringify(props)} (React motion="cut")`, h(R.Sheet, { ...props, motion: 'cut' }, 'body'), S.sheet({ ...props, children: 'body' }));
}
{
  const r = renderToStaticMarkup(h(R.Sheet, {}, 'x'));
  const s = S.sheet({ children: 'x' });
  check(r.includes('f12-m-stepped') && s.includes('f12-m-cut') && !s.includes('f12-m-stepped') && normalize(r.replace('f12-m-stepped', 'f12-m-cut')) === normalize(s), 'divergence (Sheet.motion): default React f12-m-stepped ↔ static f12-m-cut, otherwise identical');
}

// ---------------------------------------------------------------- Scene / SceneArea
for (const props of [
  {},
  { gutter: 'pair' },
  { gutter: 'change', layout: 'equal' },
  { layout: 'three' },
  { layout: 'stack' },
  { columns: 6, layout: 'areas' },
  { areas: ['hero hero side', 'a b side'] },
  { areas: ['"main side"', "'main side'"], columns: 2 },
  { areas: ['main . side'], breakpoint: 960 },
  { areas: ['main side'], breakpoint: '60rem', gutter: 'pair' },
  { areas: ['main side'], breakpoint: '860px' },
]) {
  same(`Scene ${JSON.stringify(props)}`, h(R.Scene, props, 'kids'), S.scene({ ...props, children: 'kids' }));
}
same('SceneArea', h(R.SceneArea, { area: 'main' }, 'x'), S.sceneArea({ area: 'main', children: 'x' }));

// ---------------------------------------------------------------- Panel (all shapes × variants × cuts)
for (const variant of variants) {
  for (const shape of ['rect', 'slant-bottom', 'slant-top']) {
    for (const cut of [undefined, 'C-07', false, '']) {
      const props = { variant, shape, ...(cut === undefined ? {} : { cut }) };
      same(`Panel ${JSON.stringify(props)}`, h(R.Panel, props, 'x'), S.panel({ ...props, children: 'x' }));
    }
    same(`Panel ${variant} ${shape} label+area`, h(R.Panel, { variant, shape, label: 'Evidence & "proof"', area: 'main' }, 'x'), S.panel({ variant, shape, label: 'Evidence & "proof"', area: 'main', children: 'x' }));
  }
}
same('Panel default variant', h(R.Panel, null, 'x'), S.panel({ children: 'x' }));

// ---------------------------------------------------------------- PanelPair (top/bottom slots)
for (const variant of [undefined, ...variants]) {
  const base = variant ? { variant } : {};
  same(`PanelPair ${variant ?? 'default'} top/bottom`, h(R.PanelPair, { ...base, top: { children: 'T' }, bottom: { children: 'B' } }), S.panelPair({ ...base, top: { children: 'T' }, bottom: { children: 'B' } }));
  same(
    `PanelPair ${variant ?? 'default'} cuts/labels/area`,
    h(R.PanelPair, { ...base, area: 'pair', topCut: 'C-02', bottomCut: false, topLabel: 'Top', bottomLabel: 'Bottom', top: {}, bottom: {} }),
    S.panelPair({ ...base, area: 'pair', topCut: 'C-02', bottomCut: false, topLabel: 'Top', bottomLabel: 'Bottom', top: {}, bottom: {} }),
  );
  same(
    `PanelPair ${variant ?? 'default'} slot overrides`,
    h(R.PanelPair, { ...base, topCut: 'C-09', top: { cut: 'C-03', label: 'own', variant: 'quiet' }, bottom: { variant: 'expressive' } }),
    S.panelPair({ ...base, topCut: 'C-09', top: { cut: 'C-03', label: 'own', variant: 'quiet' }, bottom: { variant: 'expressive' } }),
  );
}
{
  // Divergence (PanelPair.children): Html children are inserted verbatim (no slotting).
  const kids = S.fragment(S.panel({ shape: 'slant-bottom', children: 'a' }), S.panel({ shape: 'slant-top', children: 'b' }));
  const s = S.panelPair({ children: kids });
  const r = renderToStaticMarkup(h(R.PanelPair, null, h(R.Panel, { shape: 'slant-bottom' }, 'a'), h(R.Panel, { shape: 'slant-top' }, 'b')));
  check(String(s) === `<div class="f12-pair">${kids}</div>` && normalize(r) === normalize(s), 'divergence (PanelPair.children): Html children are inserted verbatim; with explicit shapes the result equals React');
}

// ---------------------------------------------------------------- Balloon
for (const props of [{}, { tailOffset: 36 }, { tailOffset: -36, showDot: false }, { tailOffset: 12.5 }]) {
  same(`Balloon ${JSON.stringify(props)}`, h(R.Balloon, props, 'Note'), S.balloon({ ...props, children: 'Note' }));
}

// ---------------------------------------------------------------- Tag / Stamp / Badge
const statuses = [undefined, 'neutral', 'info', 'success', 'warning', 'danger'];
for (const status of statuses) {
  for (const variant of ['default', 'stamp']) {
    const p = { variant, ...(status ? { status } : {}) };
    same(`Tag ${JSON.stringify(p)}`, h(R.Tag, p, 'Label'), S.tag({ ...p, children: 'Label' }));
  }
  const b = status ? { status } : {};
  same(`Badge ${JSON.stringify(b)}`, h(R.Badge, b, 'Label'), S.badge({ ...b, children: 'Label' }));
}
same('Stamp = tag({variant:"stamp"})', h(R.Stamp, { status: 'danger' }, 'Void'), S.tag({ variant: 'stamp', status: 'danger', children: 'Void' }));
same('Tag status label already in text', h(R.Tag, { status: 'danger' }, 'Failed: 3 checks'), S.tag({ status: 'danger', children: 'Failed: 3 checks' }));
same('Tag glyph/srLabel overrides', h(R.Tag, { status: 'info', glyph: '>>', srLabel: 'Note' }, 'x'), S.tag({ status: 'info', glyph: '>>', srLabel: 'Note', children: 'x' }));
same('Tag glyph/srLabel false', h(R.Tag, { status: 'warning', glyph: false, srLabel: false }, 'x'), S.tag({ status: 'warning', glyph: false, srLabel: false, children: 'x' }));
same(
  'Tag with Html child (text extracted like React, aria-hidden skipped)',
  h(R.Tag, { status: 'success' }, h('span', { 'aria-hidden': 'true' }, '✓'), h('b', null, 'Success'), ' now'),
  S.tag({ status: 'success', children: S.unsafeRaw('<span aria-hidden="true">✓</span><b>Success</b> now') }),
);
same('Badge glyph override', h(R.Badge, { status: 'success', glyph: '[ok]' }, 'Shipped'), S.badge({ status: 'success', glyph: '[ok]', children: 'Shipped' }));
{
  const r = renderToStaticMarkup(h(R.Badge, { pop: true, burst: true }, 'x'));
  const s = S.badge({ children: 'x' });
  check(r.includes('f12-pop pop') && !s.includes('f12-pop') && normalize(r.replace(' f12-pop pop', '')) === normalize(s), 'divergence (Badge.pop/burst): motion classes dropped, burst SVG kept at rest');
}

// ---------------------------------------------------------------- Metric
const fmtPlain = (v) => Math.round(v).toLocaleString('en-US');
for (const variant of variants) {
  for (const props of [
    { label: 'Recovered', value: 128450 },
    { label: 'Recovered', value: 128450, big: true, note: 'All regions', headingLevel: 'h3' },
    { label: 'Rate', value: 0.874, format: 'pct', delta: 0.012, comparisonLabel: 'vs main' },
    { label: 'Rate', value: 0.874, format: 'pct', delta: -0.03, range: 30 },
    { label: 'Lift', value: 2.5, format: 'pp', delta: 0.001, deltaKind: 'pp', headingLevel: 'p' },
    { label: 'Lines', value: 98765432101, format: 'plain', delta: 0, headingLevel: 'div', big: true },
  ]) {
    const format = props.format === 'pct' ? R.fmtPct : props.format === 'pp' ? R.fmtPPAbs : props.format === 'plain' ? fmtPlain : undefined;
    const sformat = props.format === 'pct' ? S.fmtPct : props.format === 'pp' ? S.fmtPPAbs : props.format === 'plain' ? fmtPlain : undefined;
    const { format: _f, ...rest } = props;
    same(
      `Metric ${variant} ${JSON.stringify(rest)}`,
      h(R.Metric, { ...rest, variant, ...(format ? { format } : {}), motion: 'cut' }),
      S.metric({ ...rest, variant, ...(sformat ? { format: sformat } : {}) }),
    );
  }
}
same('Metric with spark Html', h(R.Metric, { label: 'L', value: 1, spark: h('div', { className: 'f12-spark' }, 'spark') }), S.metric({ label: 'L', value: 1, spark: S.unsafeRaw('<div class="f12-spark">spark</div>') }));
{
  const nums = [0, 0.0004, -0.5, 1, 12.345, 1e9, -123456.78];
  check(nums.every((n) => S.fmtPct(n) === R.fmtPct(n) && S.fmtPPAbs(n) === R.fmtPPAbs(n) && S.fmtMoney(n) === R.fmtMoney(n)), 'fmtPct/fmtPPAbs/fmtMoney: identical output to React');
}

// ---------------------------------------------------------------- ToneBarList
// Divergence: rows are <div data-static> (no inert button) and selection is aria-current.
function toStaticRows(reactMarkup) {
  return reactMarkup
    .replace(/<button type="button" (id="[^"]*") class="f12-int-row" aria-pressed="(true|false)">/g, (_m, id, on) => `<div ${id} class="f12-int-row" data-static=""${on === 'true' ? ' aria-current="true"' : ''}>`)
    .replace(/<\/button>/g, '</div>')
    // Static-only data-fill: the inline width rounded to whole percent (strict-CSP fallback).
    .replace(/<span class="(f12-int-fill[^"]*)" data-pattern="([^"]*)" style="width:([^"%]*)%"/g, (_m, cls, pat, w) => `<span class="${cls}" data-pattern="${pat}" data-fill="${Math.round(Number(w))}" style="width:${w}%"`);
}
const items = [
  { id: 'invoice', name: 'invoice.ts', value: 412, share: 0.32 },
  { id: 'tax', name: 'tax-rules.ts', value: 268, formattedValue: '268 lines', share: 0.21, pattern: 'hatch', badge: 'hot' },
  { id: 'cache', name: 'cache.ts', value: 0, pattern: 'dense' },
  { id: 'dots', name: 'dots & "q"', value: 99.5, pattern: 'dots' },
];
for (const density of ['comfortable', 'compact']) {
  for (const props of [
    { items, idPrefix: 'hot' },
    { items, idPrefix: 'hot', title: 'Hotspots', subtitle: 'Lines changed', selectedId: 'tax' },
    { items: [], idPrefix: 'empty', title: 'Nothing yet' },
  ]) {
    const r = renderToStaticMarkup(h(R.ToneBarList, { ...props, density }));
    const s = S.toneBarList({ ...props, density });
    const ok = normalize(toStaticRows(r)) === normalize(s);
    check(ok && (props.items.length === 0 || (r.includes('<button') && !s.includes('<button'))), `parity (divergent rows asserted): ToneBarList ${density} ${JSON.stringify({ ...props, items: props.items.length })}`, ok ? '' : firstDiff(normalize(toStaticRows(r)), normalize(s)));
  }
}
{
  const s = S.toneBarList({ items, selectedId: 'tax', idPrefix: 'p' });
  check((s.match(/aria-current="true"/g) || []).length === 1 && !s.includes('aria-pressed') && !/<button|tabindex/.test(s), 'divergence (ToneBarList.selectedId): exactly one aria-current="true", no buttons, no tabindex');
  const fills = [...String(s).matchAll(/data-fill="(\d+)" style="width:([^"%]*)%"/g)];
  check(fills.length === items.length && fills.every(([, f, w]) => Number(f) === Math.round(Number(w))), 'divergence (ToneBarList data-fill): static adds the inline width rounded to whole percent, for strict-CSP hosts');
  const auto = S.toneBarList({ items });
  check(/id="int-f12-s[0-9a-z]+-invoice"/.test(auto), 'divergence (ToneBarList.idPrefix): default prefix is a deterministic f12-s<hash>');
}

// ---------------------------------------------------------------- GhostWire
for (const props of [
  { from: 'a.ts', to: 'b.ts' },
  { from: 'src/billing/invoice.ts', to: 'src/billing/tax-rules.ts', label: 'Changed together 9/11', strength: 0.8, orientation: 'vertical' },
  { from: 'x', to: 'y', strength: 0, orientation: 'horizontal' },
  { from: '', to: '', strength: 1 },
]) {
  same(`GhostWire ${JSON.stringify(props)} (mask id normalized)`, h(R.GhostWire, { ...props, motion: 'cut' }, null), S.ghostWire(props));
}
{
  const s = S.ghostWire({ from: 'a', to: 'b', orientation: 'auto' });
  check(s.includes('f12-ghost-wire-auto') && s.includes('data-orientation="horizontal"'), 'divergence (GhostWire.orientation auto): resolves to horizontal like React SSR / first paint');
  check(/id="f12-gw-mask-a-b-s[0-9a-z]+"/.test(s) && s.includes('stroke-dashoffset="0"'), 'divergence (GhostWire mask id): deterministic hash suffix; reveal at rest');
}

// ---------------------------------------------------------------- Receipt / ReceiptList
const receipts = [
  { kind: 'commit', value: '9f3c2a1b7e4d5c6f8a9b', href: 'https://github.com/o/r/commit/9f3c2a1', origin: 'human', date: '2026-11-08' },
  { kind: 'commit', value: '9f3c2a1' },
  { kind: 'commit', value: '  abcdef0123  ', title: 'Fix tax' },
  { kind: 'file', value: 'src/a/very/long/path/that/keeps/going/and/going/file-name.ts', origin: 'agent' },
  { kind: 'file', value: '', title: 'untitled' },
  { kind: 'link', value: 'CI run', href: 'https://ci.example.com/1', title: 'passed', origin: 'bot' },
  { kind: 'link', value: '', href: 'https://example.com/x' },
  { kind: 'link', value: '', href: 'https://example.com/x', title: 'Example' },
  { kind: 'link', value: 'unsafe', href: 'javascript:alert(1)' },
  { kind: 'link', value: 'Anchor', href: '#evidence' },
];
for (const r of receipts) same(`Receipt ${JSON.stringify(r)}`, h(R.Receipt, r), S.receipt(r));
same('ReceiptList (one Receipt per item)', h(R.ReceiptList, null, ...receipts.map((r, i) => h(R.Receipt, { key: i, ...r }))), S.receiptList({ items: receipts }));
same('ReceiptList ariaLabel', h(R.ReceiptList, { ariaLabel: 'Evidence for PR' }, h(R.Receipt, { kind: 'file', value: 'a' })), S.receiptList({ items: [{ kind: 'file', value: 'a' }], ariaLabel: 'Evidence for PR' }));
same('ReceiptList empty', h(R.ReceiptList, null), S.receiptList({ items: [] }));
{
  const rel = { kind: 'link', value: 'Docs', href: '/docs' };
  const mail = { kind: 'link', value: 'Mail', href: 'mailto:team@example.com' };
  const r1 = renderToStaticMarkup(h(R.Receipt, rel));
  const r2 = renderToStaticMarkup(h(R.Receipt, mail));
  check(r1.includes('href="/docs"') && !S.receipt(rel).includes('href='), 'divergence (Receipt.href): root-relative /path rejected by static (React allows it)');
  check(!r2.includes('href=') && S.receipt(mail).includes('href="mailto:team@example.com"'), 'divergence (Receipt.href): mailto: allowed by static (React rejects it)');
}

finish('parity');
