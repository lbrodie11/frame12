// Regression tests for the PR #29 review findings. One block per finding; each failed before the fix.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PKG_ROOT, S, SHIPPED_HTML_METHODS, check, finish, throws } from './lib.mjs';
import { loadReactKit } from './react-harness.mjs';
import { buildStaticCss } from '../scripts/build-static-css.mjs';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const str = (x) => String(x);

// ------------------------------------------- 1. trust is identity, not string content
{
  const first = str(S.panel({ children: 'Tom &amp; Jerry' }));
  S.fragment('Tom & Jerry'); // renders the text "Tom &amp; Jerry" somewhere else
  const second = str(S.panel({ children: 'Tom &amp; Jerry' }));
  check(first === second && first.includes('Tom &amp;amp; Jerry'), '1: a plain string is escaped the same way whatever was rendered before (no history dependence)');

  const realTag = S.tag({ status: 'success', children: 'CI passed' });
  const replay = str(S.panel({ children: str(realTag) }));
  check(replay.includes('&lt;span class=&quot;f12-tag') && !replay.includes('<span class="f12-tag'), '1: replaying the exact markup of an earlier render as a string is escaped (no UI spoofing)');

  const proto = Object.getPrototypeOf(realTag);
  const forged = Object.create(proto);
  check(
    S.isHtml(realTag) && !S.isHtml(str(realTag)) && !S.isHtml(forged) && !S.isHtml({ toString: () => '<b>x</b>' }),
    '1: isHtml() is true only for objects the package created (not equal strings, forged prototypes or look-alikes)',
  );
  check(throws(() => new proto.constructor(Symbol('x'), '<b>x</b>')) && throws(() => new proto.constructor()), '1: the Html constructor is not usable outside the package');
  check(Object.isFrozen(realTag) && typeof realTag === 'object', '1: Html values are frozen objects');
  check(JSON.stringify(SHIPPED_HTML_METHODS) === JSON.stringify(['constructor', 'toJSON', 'toString', 'valueOf']), '1: the shipped Html has no string methods (only toString/valueOf/toJSON)', SHIPPED_HTML_METHODS.join(','));
  check(`${realTag}` === str(realTag) && JSON.stringify({ a: realTag }) === JSON.stringify({ a: str(realTag) }), '1: template literals and JSON give the markup');
  check(throws(() => S.panel({ children: forged }), /Expected Html or string/) && throws(() => S.panel({ children: { toString: () => '<b>x</b>' } })), '1: a forged or look-alike Html object is rejected with a TypeError, never trusted');
}

// ------------------------------------------- 2. no registry: no memory growth, no eviction
{
  const cached = S.tag({ children: 'Header' });
  for (let i = 0; i < 250_000; i++) S.fragment(`x${i}`);
  check(str(S.panel({ children: cached })).includes('<span class="f12-tag">Header</span>'), '2: a fragment cached before 250,000 other renders is still inserted as Html (no eviction)');

  const probe = `
    const S = await import(${JSON.stringify(pathToFileURL(path.join(PKG_ROOT, 'dist/index.js')).href)});
    const page = (i) => S.document({ title: 't' + i, body: S.sheet({ children: S.panel({ children: 'unique ' + i }) }) });
    for (let i = 0; i < 200; i++) page(i);
    gc(); const before = process.memoryUsage().heapUsed;
    for (let i = 0; i < 5000; i++) page(1000 + i);
    gc(); const after = process.memoryUsage().heapUsed;
    process.stdout.write(String(after - before));`;
  const grown = Number(execFileSync(process.execPath, ['--expose-gc', '--input-type=module', '-e', probe], { encoding: 'utf8' }));
  check(grown < 20 * 1024 * 1024, `2: rendering 5,000 unique ~50 KB documents retains no memory after GC (heap grew ${(grown / 1048576).toFixed(1)} MB)`);
}

// ------------------------------------------- 3. strict CSP: static-only fallbacks (browser checks in browser.test.mjs)
{
  const list = str(S.toneBarList({ items: [{ id: 'a', name: 'A', value: 100 }, { id: 'b', name: 'B', value: 10 }, { id: 'c', name: 'C', value: 33.333 }] }));
  const fills = [...list.matchAll(/data-fill="(\d+)"/g)].map((m) => m[1]);
  check(fills.join() === '100,10,33', '3: tone-bar fills carry data-fill (rounded %) for hosts that block inline styles');
  const css = fs.readFileSync(path.join(PKG_ROOT, 'dist/static.css'), 'utf8');
  check(css.includes('.f12-int-fill[data-fill="33"] {\n  width: 33%;\n}') && css.includes('.f12-int-fill[data-fill="0"]') && css.includes('.f12-int-fill[data-fill="100"]'), '3: static.css styles data-fill 0–100');
  check(/\.f12-sheet\[data-autocut\] \{\n\s+--f12-autocut-display: block;/.test(css), '3: auto-cut labels display via the data-autocut attribute, not only the inline custom property');
  check(/\.f12-balloon-gap \{[^}]*left: calc\(50% - 5px\)/.test(css), '3: the balloon seam has a centred default without the inline style');
}

// ------------------------------------------- 4. dedupeIds touches only id/mask attributes
{
  const gw = S.ghostWire({ from: 'a', to: 'b' });
  const id = str(gw).match(/mask id="([^"]+)"/)[1];
  const page = str(
    S.document({
      title: 't',
      inlineCss: false,
      body: S.fragment(
        S.receipt({ kind: 'link', value: 'first wire', href: `#${id}` }),
        gw,
        gw,
        S.panel({ label: `see url(#${id})`, children: `debug: url(#${id}) id="${id}"` }),
        S.toneBarList({ items: [{ id: 'x', name: 'X', value: 1 }], idPrefix: 'mine' }),
        S.toneBarList({ items: [{ id: 'x', name: 'X', value: 1 }], idPrefix: 'mine' }),
      ),
    }),
  );
  check(page.includes(`debug: url(#${id}) id=&quot;${id}&quot;`) && page.includes(`aria-label="see url(#${id})"`), '4: text and other attribute values mentioning an id are not rewritten');
  check(page.includes(`href="#${id}"`) && !page.includes(`href="#${id}-2"`), '4: a caller href to the first copy is left alone');
  const masks = [...page.matchAll(/<mask id="([^"]+)"[\s\S]*?mask="url\(#([^)]+)\)"/g)];
  check(masks.length === 2 && masks[0][1] === id && masks[1][1] === `${id}-2` && masks.every((m) => m[1] === m[2]), '4: duplicate masks are renamed and each wire references its own');
  check((page.match(/id="int-mine-x"/g) || []).length === 2, '4: caller-chosen ids (idPrefix) are never renamed');
  const manual = S.dedupeIds(S.fragment(gw, gw));
  check(str(manual).includes(`id="${id}-2"`) && throws(() => S.dedupeIds(str(gw))), '4: dedupeIds() is exported for pages built without document() and requires Html');
}

// ------------------------------------------- 5. textContent tokenises attributes like React
{
  const R = await loadReactKit();
  const h = React.createElement;
  const cases = [
    ['title containing "hidden"', h('abbr', { title: 'was hidden before' }, 'Error'), '<abbr title="was hidden before">Error</abbr>'],
    ['data-x="aria-hidden=true"', h('span', { 'data-x': 'aria-hidden="true"' }, 'Error'), '<span data-x="aria-hidden=&quot;true&quot;">Error</span>'],
    ['aria-hidden="TRUE" is visible (React compares === "true")', h('span', { 'aria-hidden': 'TRUE' }, 'Error'), '<span aria-hidden="TRUE">Error</span>'],
    ['aria-hidden="true" is skipped', h('span', { 'aria-hidden': 'true' }, 'Error'), '<span aria-hidden="true">Error</span>'],
    ['hidden attribute is skipped', h('span', { hidden: true }, 'Error'), '<span hidden>Error</span>'],
  ];
  for (const [label, el, raw] of cases) {
    const r = renderToStaticMarkup(h(R.Tag, { status: 'danger' }, el, ' in build'));
    const s = str(S.tag({ status: 'danger', children: S.fragment(S.unsafeRaw(raw), ' in build') }));
    check(r.includes('Error: ') === s.includes('Error: '), `5: screen-reader prefix matches React: ${label}`, `react=${r.includes('Error: ')} static=${s.includes('Error: ')}`);
  }
  const unbalanced = S.fragment(S.unsafeRaw('<h1>'), 'Error', S.unsafeRaw('</h1></div></span>'), S.unsafeRaw('<span aria-hidden="true">x</span>'), ' budget');
  check(!str(S.tag({ status: 'danger', children: unbalanced })).includes('Error: '), '5: stray closing tags do not unbalance the hidden-subtree stack');
}

// ------------------------------------------- 6. data-derived ids and null options
{
  const paths = ['src/Foo.ts', 'src/foo.ts', 'README.md', '123-start', 'ünïcödé/Ünïcode', '', '-'.repeat(200), 'x'.repeat(300)];
  const ids = paths.map(S.toIdent);
  check(ids.every((i) => /^[a-z][a-z0-9-]{0,63}$/.test(i)) && new Set(ids).size === ids.length, '6: toIdent() turns any string into a valid, collision-resistant identifier', ids.join(' '));
  check(S.toIdent('invoice') === 'invoice' && S.toIdent('src/Foo.ts') === S.toIdent('src/Foo.ts'), '6: toIdent() keeps valid identifiers and is deterministic');
  check(str(S.toneBarList({ items: paths.map((p, i) => ({ id: S.toIdent(p), name: p, value: i })) })).includes(`id="int-f12-s`), '6: a tone-bar list keyed by file paths renders via toIdent()');
  const nulls = [
    () => S.receipt(null),
    () => S.receiptList({ items: [null] }),
    () => S.tag(),
    () => S.panel(null),
    () => S.document(undefined),
    () => S.panelPair({ top: null, bottom: {} }),
    () => S.toneBarList({ items: [null] }),
    () => S.sceneArea('main'),
  ];
  check(nulls.every((fn) => throws(fn, /^\[@frame12\/static [a-zA-Z]+\(\)\]/)), '6: null/undefined/non-object options throw the package TypeError with the function name');
}

// ------------------------------------------- 7 + low: consistent validation
{
  check(throws(() => S.scene({ areas: ['a'], breakpoint: 5, children: '' })) && throws(() => S.scene({ areas: ['a'], breakpoint: '5rem', children: '' })) && !throws(() => S.scene({ areas: ['a'], breakpoint: 10, children: '' })), '7: numeric breakpoints follow the same 2–4 digit rule as strings');
  check(throws(() => S.scene({ areas: ['a b a'], children: '' }), /rectangle/) && throws(() => S.scene({ areas: ['a b', 'b a'], children: '' })) && !throws(() => S.scene({ areas: ['a a b', 'a a c', '. . c'], children: '' })), 'low: non-rectangular named areas throw; rectangles and . cells pass');
  check(throws(() => S.panelPair({ top: {} }), /together/) && throws(() => S.panelPair({ bottom: {} })), 'low: panelPair with only top or only bottom throws');
  const big = Array.from({ length: 200_000 }, (_, i) => ({ id: `i${i}`, name: 'n', value: i }));
  check(!throws(() => S.toneBarList({ items: big })) && str(S.toneBarList({ items: big })).length > 0, 'low: toneBarList renders 200,000 items without a call-stack overflow');
}

// ------------------------------------------- low: CSS build gates instead of silent drops
{
  const manifest = await import(pathToFileURL(path.join(PKG_ROOT, 'dist/manifest.js')).href);
  const canonical = fs.readFileSync(path.join(PKG_ROOT, '../../registry/styles/frame12.css'), 'utf8');
  const fails = (extra, re) => {
    try {
      buildStaticCss({ css: canonical + extra, manifest });
      return false;
    } catch (err) {
      return re.test(err.message);
    }
  };
  check(fails('\n@layer base, components;\n', /Statement at-rule "@layer base, components;"/), 'low: a statement at-rule fails the CSS build instead of being dropped');
  check(fails('\n@media print { @keyframes f12X { from { opacity: 0 } to { opacity: 1 } } }\n', /nested inside an at-rule/), 'low: @keyframes inside @media fails the build instead of being hoisted');
  check(fails('\n@page { margin: 0 }\n', /has no static.css handling/), 'low: an unknown block at-rule fails the build instead of being dropped');
}

finish('regressions');
