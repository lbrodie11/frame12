#!/usr/bin/env node
/**
 * Generates `dist/static.css` and `dist/static-css.js` (+ `.d.ts`) for @frame12/static from the
 * canonical stylesheet `registry/styles/frame12.css`. No dependencies.
 *
 *   1. Parse frame12.css with ./css-tokenizer.mjs and drop the `@tokens:start … @tokens:end`
 *      block: tokens and themes ship in @frame12/tokens (`cssText` / `tokens.css`), and
 *      document() inlines them in `<style data-f12-tokens>`.
 *   2. Keep each selector whose classes and attributes are all in the static manifest
 *      (`dist/manifest.js`, compiled from `src/manifest.ts`), plus global selectors (`:root`,
 *      `html`, `body`, `[class*="f12-"]`). Rules with no kept selector are dropped; enclosing
 *      @media / @container / @supports blocks are kept when anything inside them is.
 *   3. Keep `@keyframes` referenced by a kept rule.
 *   4. Gates (each failure aborts the build):
 *        - coverage: every manifest class matches at least one kept selector, unless it is in
 *          CLASS_EXCEPTIONS (and every exception must still be needed);
 *        - dead weight: the output references no class outside the manifest;
 *        - custom properties: every `var(--x)` without a fallback is defined by the output,
 *          by @frame12/tokens, or set inline by a renderer.
 *
 * Usage:
 *   node scripts/build-static-css.mjs           # write dist/static.css, dist/static-css.{js,d.ts}
 *   node scripts/build-static-css.mjs --check   # verify the files on disk are current
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { definedVars, parseCss, selectorRefs, serialize, splitSelectors, varRefs } from './css-tokenizer.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PKG_ROOT = path.resolve(__dirname, '..');
export const REPO_ROOT = path.resolve(PKG_ROOT, '../..');
export const CANONICAL_CSS = path.join(REPO_ROOT, 'registry/styles/frame12.css');
const DIST = path.join(PKG_ROOT, 'dist');

const HEADER = `/* @frame12/static: generated from registry/styles/frame12.css by scripts/build-static-css.mjs.
   Do not edit by hand. Load after @frame12/tokens/tokens.css. */\n`;

// Document base for pages made by document(): zero-specificity, token-only. Not in frame12.css
// because the React kit leaves the host page alone.
const DOCUMENT_BASE = `/* Document base (static pages only). */
:where(html) {
  background: var(--f-desk);
  color: var(--f-ink);
}
:where(body) {
  margin: 0;
  font-family: var(--font-f-body);
}
`;

// Strict-CSP fallback (static pages only): tone-bar fills carry their rounded width in
// data-fill, so bars keep their length when a host CSP blocks the exact inline style. Not in
// frame12.css because React never emits data-fill.
// Named-area scenes: frame12.css falls back to 12 auto-placed columns when --f12-scene-cols is
// missing (React's layout="areas" without areas). A static scene with areas always has
// data-columns, and when a CSP blocks its inline custom properties the readable fallback is one
// column in DOM order. With the variable present this rule computes exactly what frame12.css does.
const CSP_FALLBACK =
  `/* Strict-CSP fallback (static pages only): layout and data without inline styles. */\n` +
  `@media (min-width: 860px) {\n  .f12-scene.f12-scene-areas[data-columns]:not([data-scene-bp]) {\n    grid-template-columns: repeat(var(--f12-scene-cols, 1), minmax(0, 1fr));\n  }\n}\n` +
  Array.from({ length: 101 }, (_, n) => `.f12-int-fill[data-fill="${n}"] {\n  width: ${n}%;\n}\n`).join('');

const GLOBAL_SELECTOR_RE = /(^|[\s>+~(,])(:root|html|body)\b|\[class\*=["']?f12-/;

function stripTokenBlock(css) {
  const start = css.indexOf('/* @tokens:start */');
  const end = css.indexOf('/* @tokens:end */');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('frame12.css is missing the /* @tokens:start */ … /* @tokens:end */ block');
  }
  return css.slice(0, start) + css.slice(end + '/* @tokens:end */'.length);
}

function keepSelector(sel, classSet, attrSet) {
  // Static pages never start a View Transition, and `::view-transition-*(*.f12-cut)` names a
  // view-transition-class (CutMorph), not the `.f12-cut` element class.
  if (sel.includes('::view-transition')) return false;
  const { classes, negated, attributes } = selectorRefs(sel);
  for (const a of attributes) if (!attrSet.has(a)) return false;
  for (const c of classes) if (!classSet.has(c)) return false;
  // `:not(.x)` with x outside the manifest is always true for static output, but keeping it
  // would reference a non-manifest class; such selectors are dropped (reported as dead weight).
  for (const c of negated) if (!classSet.has(c)) return false;
  if (classes.size > 0 || negated.size > 0) return true;
  if ([...attributes].some((a) => a.startsWith('data-') || a.startsWith('aria-'))) return true;
  return GLOBAL_SELECTOR_RE.test(sel);
}

function filterNodes(nodes, ctx) {
  const out = [];
  for (const n of nodes) {
    if (n.type === 'rule') {
      const kept = splitSelectors(n.selector).filter((s) => keepSelector(s, ctx.classSet, ctx.attrSet));
      if (kept.length) {
        for (const s of kept) {
          const refs = selectorRefs(s);
          for (const c of [...refs.classes, ...refs.negated]) ctx.covered.add(c);
        }
        out.push({ ...n, selector: kept.join(', ') });
      }
    } else if (n.children) {
      const children = filterNodes(n.children, { ...ctx, depth: (ctx.depth ?? 0) + 1 });
      if (children.length) out.push({ ...n, children });
    } else if (n.name === 'keyframes' || n.name === '-webkit-keyframes') {
      if (ctx.depth > 0) {
        throw new Error(`@${n.name} ${n.prelude} is nested inside an at-rule; static.css would hoist it out of its condition. Move it to the top level of frame12.css.`);
      }
      ctx.keyframes.push(n);
    } else if (n.body === null) {
      throw new Error(`Statement at-rule "@${n.name} ${n.prelude};" in frame12.css has no static.css handling (it would be dropped). Teach scripts/build-static-css.mjs about it first.`);
    } else if (n.name === 'font-face') {
      out.push(n);
    } else {
      throw new Error(`At-rule "@${n.name}" in frame12.css has no static.css handling (it would be dropped). Teach scripts/build-static-css.mjs about it first.`);
    }
  }
  return out;
}

function walkRules(nodes, fn) {
  for (const n of nodes) {
    if (n.type === 'rule') fn(n);
    else if (n.children) walkRules(n.children, fn);
  }
}

/**
 * Pure build step: canonical CSS text + manifest → static CSS text. Throws an Error listing every
 * gate failure.
 */
export function buildStaticCss({ css, manifest, tokensCss = '' }) {
  const classSet = new Set(Object.values(manifest.MANIFEST_CLASSES).flat());
  const attrSet = new Set(manifest.MANIFEST_ATTRIBUTES);
  const exceptions = manifest.CLASS_EXCEPTIONS ?? {};
  const ctx = { classSet, attrSet, covered: new Set(), keyframes: [] };
  const tree = filterNodes(parseCss(stripTokenBlock(css)), ctx);

  // Keyframes referenced by kept rules.
  const used = new Set();
  walkRules(tree, (r) => {
    for (const m of r.body.matchAll(/animation(?:-name)?\s*:\s*([^;]+)/g)) {
      for (const tok of m[1].split(/[\s,]+/)) used.add(tok);
    }
  });
  const keyframes = ctx.keyframes.filter((k) => used.has(k.prelude));

  const errors = [];
  for (const c of [...classSet].sort()) {
    const isException = Object.prototype.hasOwnProperty.call(exceptions, c);
    if (!ctx.covered.has(c) && !isException) {
      errors.push(`coverage: manifest class "${c}" matches no rule in frame12.css (add a rule, or a CLASS_EXCEPTIONS entry with a reason)`);
    }
    if (ctx.covered.has(c) && isException) {
      errors.push(`coverage: CLASS_EXCEPTIONS["${c}"] is stale: the class now matches a rule; remove the exception`);
    }
  }
  for (const c of Object.keys(exceptions)) {
    if (!classSet.has(c)) errors.push(`coverage: CLASS_EXCEPTIONS["${c}"] is not a manifest class`);
  }

  const output = HEADER + DOCUMENT_BASE + serialize([...tree, ...keyframes]) + CSP_FALLBACK;

  // Dead weight: re-parse the output and check every referenced class.
  const reparsed = parseCss(output);
  walkRules(reparsed, (r) => {
    for (const s of splitSelectors(r.selector)) {
      const { classes, negated } = selectorRefs(s);
      for (const c of [...classes, ...negated]) {
        if (!classSet.has(c)) errors.push(`dead weight: output selector "${s}" references non-manifest class "${c}"`);
      }
    }
  });

  // Custom properties.
  const defined = new Set([...(manifest.INLINE_CUSTOM_PROPERTIES ?? []), ...definedVars(tokensCss)]);
  walkRules(reparsed, (r) => {
    for (const v of definedVars(r.body)) defined.add(v);
  });
  walkRules(reparsed, (r) => {
    for (const v of varRefs(r.body).required) {
      if (!defined.has(v)) errors.push(`custom property: ${v} is used without a fallback in "${r.selector}" but never defined`);
    }
  });

  if (errors.length) {
    const err = new Error(`@frame12/static CSS build failed:\n  - ${[...new Set(errors)].join('\n  - ')}`);
    err.errors = [...new Set(errors)];
    throw err;
  }
  return output;
}

export function moduleSource(cssOut) {
  return `/* Generated by scripts/build-static-css.mjs. Do not edit by hand. */\nexport const staticCss = ${JSON.stringify(cssOut)};\n`;
}

export const DTS_SOURCE = `/** The generated static kit CSS (\`dist/static.css\`) as a string. */\nexport declare const staticCss: string;\n`;

export async function buildFiles() {
  const manifest = await import(pathToFileURL(path.join(DIST, 'manifest.js')).href);
  const { cssText } = await import('@frame12/tokens');
  const cssOut = buildStaticCss({ css: fs.readFileSync(CANONICAL_CSS, 'utf8'), manifest, tokensCss: cssText });
  return {
    [path.join(DIST, 'static.css')]: cssOut,
    [path.join(DIST, 'static-css.js')]: moduleSource(cssOut),
    [path.join(DIST, 'static-css.d.ts')]: DTS_SOURCE,
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const check = process.argv.includes('--check');
  try {
    const files = await buildFiles();
    const drift = [];
    for (const [file, content] of Object.entries(files)) {
      if (check) {
        if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== content) drift.push(path.relative(REPO_ROOT, file));
      } else {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, content);
      }
    }
    if (drift.length) {
      console.error(`@frame12/static: generated CSS is stale (${drift.join(', ')}). Run: npm run build --workspace=@frame12/static`);
      process.exit(1);
    }
    const bytes = Buffer.byteLength(files[path.join(DIST, 'static.css')]);
    console.log(`${check ? 'Verified' : 'Built'} @frame12/static dist/static.css (${bytes} bytes) and dist/static-css.js.`);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
