// Shared helpers for @frame12/static tests.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PKG_ROOT = path.resolve(__dirname, '..');
export const REPO_ROOT = path.resolve(PKG_ROOT, '../..');

export const S = await import(pathToFileURL(path.join(PKG_ROOT, 'dist/index.js')).href);

let failures = 0;
let passes = 0;
export function check(ok, label, detail = '') {
  if (!ok) failures++;
  else passes++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`);
}

export function throws(fn, re) {
  try {
    fn();
    return false;
  } catch (err) {
    return err instanceof TypeError && (!re || re.test(err.message));
  }
}

export function finish(name) {
  console.log(failures ? `\n${name}: ${failures} check(s) failed (${passes} passed)` : `\n${name}: all ${passes} checks passed`);
  process.exitCode = failures ? 1 : 0;
}

/** Deterministic PRNG (mulberry32). */
export function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Classes and attribute names found in markup (for manifest checks). */
export function scanMarkup(markup) {
  const classes = new Set();
  const attributes = new Set();
  const tags = new Set();
  const body = markup.replace(/<style>[\s\S]*?<\/style>/g, '');
  for (const m of body.matchAll(/<([a-z][a-z0-9-]*)((?:\s+[a-zA-Z][a-zA-Z0-9:-]*(?:="[^"]*")?)*)\s*\/?>/g)) {
    tags.add(m[1]);
    for (const a of m[2].matchAll(/([a-zA-Z][a-zA-Z0-9:-]*)(?:="([^"]*)")?/g)) {
      attributes.add(a[1].toLowerCase());
      if (a[1] === 'class') for (const c of a[2].split(/\s+/).filter(Boolean)) classes.add(c);
    }
  }
  return { classes, attributes, tags };
}
