// CSS: the tokenizer, the build gates (coverage, dead weight, custom properties), preserved
// @media/@container rules, light/dark, and lintHtml on static.css.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { lintHtml } from '@frame12/lint';
import { cssText as tokensCss } from '@frame12/tokens';
import { PKG_ROOT, REPO_ROOT, S, check, finish } from './lib.mjs';
import { parseCss, selectorRefs, serialize, splitSelectors, stripComments } from '../scripts/css-tokenizer.mjs';
import { buildStaticCss } from '../scripts/build-static-css.mjs';

const manifest = await import(pathToFileURL(path.join(PKG_ROOT, 'dist/manifest.js')).href);
const canonical = fs.readFileSync(path.join(REPO_ROOT, 'registry/styles/frame12.css'), 'utf8');
const staticCss = fs.readFileSync(path.join(PKG_ROOT, 'dist/static.css'), 'utf8');

// ------------------------------------------------------------------------------- tokenizer
{
  const src = `/* a { b } */
@charset "utf-8";
@font-face { font-family: "X}"; src: local("Y;"); }
:root, :root[data-theme="dark"] { --a: "}" ; --b: url(a;b); }
.a::before, .b:not(.c)::after { content: "{;}"; }
@media (min-width: 860px) {
  @supports (display: grid) {
    @container (max-width: 760px) { .d > [data-x="a,b"] { color: var(--a, red); } }
  }
}
@keyframes spin { from { transform: rotate(0) } to { transform: rotate(1turn) } }
.e { content: '\\'}'; }`;
  const tree = parseCss(src);
  check(tree.length === 7, 'tokenizer: top-level statements (comment skipped, @charset, @font-face, :root, rule, @media, @keyframes, rule)', String(tree.length));
  check(tree[0].type === 'at' && tree[0].name === 'charset' && tree[0].body === null, 'tokenizer: statement at-rule');
  check(tree[1].name === 'font-face' && tree[1].body.includes('local("Y;")'), 'tokenizer: @font-face with ; and } inside strings');
  check(tree[2].selector === ':root, :root[data-theme="dark"]' && tree[2].body.includes('url(a;b)'), 'tokenizer: :root / theme blocks, url() with ;');
  check(splitSelectors(tree[3].selector).length === 2 && tree[3].body === 'content: "{;}";', 'tokenizer: pseudo-elements and braces inside strings');
  const media = tree[4];
  check(media.name === 'media' && media.children[0].name === 'supports' && media.children[0].children[0].name === 'container' && media.children[0].children[0].children[0].selector === '.d > [data-x="a,b"]', 'tokenizer: nested @media > @supports > @container');
  check(tree[5].name === 'keyframes' && tree[5].prelude === 'spin' && tree[5].body.includes('1turn'), 'tokenizer: @keyframes kept as a block');
  check(tree[6].body.includes("'\\'}'"), 'tokenizer: escaped quotes inside strings');
  check(splitSelectors('.a, :is(.b, .c) .d, [x="1,2"]').length === 3, 'tokenizer: selector lists split only on top-level commas');
  const refs = selectorRefs('.f12-panel:not(.f12-rect) > .f12-cut[data-autocut]::before, [title=".nope"]');
  check([...refs.classes].join() === 'f12-panel,f12-cut' && [...refs.negated].join() === 'f12-rect' && refs.attributes.has('data-autocut') && refs.attributes.has('title'), 'tokenizer: classes, :not() classes and attribute names (string contents ignored)');
  check(stripComments('a/* x */b"/* y */"') === 'a b"/* y */"', 'tokenizer: comments stripped outside strings only');
  let threw = 0;
  for (const bad of ['.a { color: red', '.a { content: "x }', '/* open', '}', 'color: red;']) {
    try {
      parseCss(bad);
    } catch {
      threw++;
    }
  }
  check(threw === 5, 'tokenizer: malformed CSS throws');
  check(parseCss(serialize(parseCss(canonical))).length === parseCss(canonical).length, 'tokenizer: frame12.css round-trips through parse → serialize → parse');
}

// ------------------------------------------------------------------------------ build gates
{
  check(buildStaticCss({ css: canonical, manifest, tokensCss }) === staticCss, 'build: dist/static.css is current (pure build reproduces it byte for byte)');
  const fixture = (patch) => ({ ...manifest, ...patch, MANIFEST_CLASSES: { ...manifest.MANIFEST_CLASSES, ...(patch.MANIFEST_CLASSES ?? {}) } });
  const fails = (m, re, css = canonical) => {
    try {
      buildStaticCss({ css, manifest: m, tokensCss });
      return false;
    } catch (err) {
      return re.test(err.message);
    }
  };
  check(fails(fixture({ MANIFEST_CLASSES: { extra: ['f12-not-a-real-class'] } }), /coverage: manifest class "f12-not-a-real-class" matches no rule/), 'coverage gate: a fixture manifest with a class that has no rule fails the build');
  check(fails(fixture({ CLASS_EXCEPTIONS: { ...manifest.CLASS_EXCEPTIONS, 'f12-panel': 'stale' } }), /CLASS_EXCEPTIONS\["f12-panel"\] is stale/), 'coverage gate: a stale exception fails the build');
  check(fails(fixture({ CLASS_EXCEPTIONS: { ...manifest.CLASS_EXCEPTIONS, 'f12-ghost': 'x' } }), /not a manifest class/), 'coverage gate: an exception for a non-manifest class fails the build');
  check(fails(manifest, /custom property: --f12-undefined-var/, canonical + '\n.f12-panel { width: var(--f12-undefined-var); }\n'), 'custom-property gate: a var() with no definition and no fallback fails the build');
  const withoutTokens = canonical.replace('/* @tokens:start */', '');
  check(fails(manifest, /missing the \/\* @tokens:start \*\//, withoutTokens), 'build: the token block markers are required');
  // Dead weight: re-check the real output independently.
  const classSet = new Set(Object.values(manifest.MANIFEST_CLASSES).flat());
  const dead = [];
  const walk = (nodes) => {
    for (const n of nodes) {
      if (n.type === 'rule') for (const s of splitSelectors(n.selector)) for (const c of [...selectorRefs(s).classes, ...selectorRefs(s).negated]) if (!classSet.has(c)) dead.push(c);
      if (n.children) walk(n.children);
    }
  };
  walk(parseCss(staticCss));
  check(dead.length === 0, 'dead-weight gate: static.css references only manifest classes', dead.join(', '));
  const all = new Set();
  const walkAll = (nodes) => {
    for (const n of nodes) {
      if (n.type === 'rule') for (const s of splitSelectors(n.selector)) for (const c of selectorRefs(s).classes) all.add(c);
      if (n.children) walkAll(n.children);
    }
  };
  walkAll(parseCss(staticCss));
  const missing = [...classSet].filter((c) => !all.has(c) && !manifest.CLASS_EXCEPTIONS[c] && !staticCss.includes(`:not(.${c})`));
  check(missing.length === 0, 'coverage: every manifest class is styled by static.css or has a documented exception', missing.join(', '));
  check(Object.values(manifest.CLASS_EXCEPTIONS).every((r) => typeof r === 'string' && r.length > 20), 'coverage: every exception carries a reason');
  check(Buffer.byteLength(staticCss) < Buffer.byteLength(canonical) / 3, `static.css is a strict subset (${Buffer.byteLength(staticCss)} of ${Buffer.byteLength(canonical)} bytes)`);
}

// ---------------------------------------------------------------- preserved rules, light/dark
{
  const tree = parseCss(staticCss);
  const at = tree.filter((n) => n.type === 'at').map((n) => `@${n.name} ${n.prelude}`);
  check(at.includes('@media (min-width: 860px)') && at.includes('@container (max-width: 760px)') && at.includes('@media (prefers-reduced-motion: reduce)') && at.includes('@media (forced-colors: active)') && at.includes('@media print'), '@media/@container (and reduced-motion, forced-colors, print) rules are preserved', at.join(' | '));
  const m860 = tree.find((n) => n.prelude === '(min-width: 860px)');
  check(m860.children.some((r) => r.selector.includes('.f12-scene.f12-scene-areas:not([data-scene-bp])')), '@media (min-width: 860px) keeps the named-area placement rule');
  check(/\.f12-cut\[data-autocut\]::before \{\n\s+content: "C-" counter\(f12-cut, decimal-leading-zero\);/.test(staticCss) && staticCss.includes('counter-reset: f12-cut;') && staticCss.includes('counter-increment: f12-cut;'), 'auto-cut counter rules are kept (counter-reset, counter-increment, ::before content)');
  check(staticCss.includes('[class*="f12-"]:focus-visible') && /\.f12-sr-only \{/.test(staticCss), 'focus-visible and screen-reader-only rules are kept');
  check(!staticCss.includes('@tokens:start') && !/#121212|#ffd60a/i.test(staticCss), 'token definitions are not duplicated (they ship in @frame12/tokens)');
  const doc = S.document({ title: 't', body: S.fragment('') });
  check(doc.includes('@media (prefers-color-scheme: dark)') && doc.includes(':root[data-theme="dark"]') && doc.includes('.f12-theme-light'), 'light and dark: document() inlines the token theme blocks (auto, data-theme and .f12-theme-*)');
  check(!/f12-m-stepped|f12-m-smooth|@keyframes/.test(staticCss), 'motion: no stepped/smooth motion rules or keyframes in static.css');
}

// ------------------------------------------------------------------------------ lintHtml
{
  const page = `<!doctype html><html lang="en"><head><style data-f12-static>${staticCss}</style></head><body></body></html>`;
  const v = lintHtml(page);
  check(v.filter((x) => x.rule === 'unsafe-html').length === 0, 'lintHtml: static.css (in <style data-f12-static>, no tokenStyleIds) has zero unsafe-html findings');
  // The remaining findings come from the canonical stylesheet's component internals (frame12.css
  // is exempt from the linter by file name). They are pinned exactly so a new finding fails here.
  const findings = [...new Set(v.map((x) => `${x.rule}: ${x.message.split('. ')[0].replace(/\.$/, '')}`))].sort();
  const KNOWN = [
    'color-literal: Hard-coded hex color "#fff" is forbidden outside token files',
    'illegal-gutter: Illegal CSS gutter "gap: 10px"',
    'illegal-gutter: Illegal CSS gutter "gap: 16px"',
    'illegal-gutter: Illegal CSS gutter "gap: 24px"',
    'illegal-gutter: Illegal CSS gutter "gap: 26px"',
    'illegal-gutter: Illegal CSS gutter "gap: 4px"',
    'illegal-gutter: Illegal CSS gutter "gap: 6px 16px"',
    'illegal-gutter: Illegal CSS gutter "gap: 6px"',
    'illegal-gutter: Illegal CSS gutter "gap: 8px 12px"',
    'marker-misuse: Marker yellow (--f-marker / #ffd60a) cannot be used on "fill"',
    'marker-misuse: Marker yellow background in CSS rule must be paired with color: var(--f-marker-ink)',
  ];
  check(JSON.stringify(findings) === JSON.stringify(KNOWN), 'lintHtml: static.css has no token exemptions to need; its only grammar findings are the pinned canonical-CSS internals (see README)', findings.join(' | '));
  const tokensOnly = lintHtml(`<!doctype html><html><head><style data-f12-tokens>${tokensCss}</style></head><body></body></html>`);
  check(tokensOnly.length === 0, 'lintHtml: the token block is exempt via <style data-f12-tokens> (no tokenStyleIds option needed)');
  const doc = S.document({ title: 'x', body: S.sheet({ autoCut: true, children: S.panel({ children: 'x' }) }) });
  check(lintHtml(String(doc)).filter((x) => x.rule === 'unsafe-html' || x.rule === 'cut-order').length === 0, 'lintHtml: a full document() has no unsafe-html or cut-order findings');
}

finish('css');
