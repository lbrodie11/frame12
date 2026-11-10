/**
 * The README documents every environment variable the package reads (F12-13 requirement 25):
 * the names are collected from the source, so a new variable fails here until it is documented.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function sources(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return sources(p);
    return /\.tsx?$/.test(e.name) && !e.name.endsWith('.generated.ts') ? [p] : [];
  });
}

/** Every environment variable name read anywhere in src/. */
export function envNamesInSource() {
  const names = new Set();
  for (const file of sources(path.join(PKG, 'src'))) {
    const text = fs.readFileSync(file, 'utf8');
    for (const m of text.matchAll(/\benv\.([A-Za-z_][A-Za-z0-9_]*)|\benv\[['"]([A-Za-z_][A-Za-z0-9_]*)['"]\]/g)) names.add(m[1] ?? m[2]);
    for (const m of text.matchAll(/envFlag\([^,]+,\s*'([A-Za-z_][A-Za-z0-9_]*)'\)/g)) names.add(m[1]);
    // Names read through a table: the CI providers and the reduced-motion pair.
    const table = /CI_PROVIDERS[^=]*=\s*\[([\s\S]*?)\];/.exec(text);
    if (table) for (const m of table[1].matchAll(/\['([A-Z_0-9]+)',/g)) names.add(m[1]);
    for (const m of text.matchAll(/for \(const name of \[([^\]]*)\]\)/g)) for (const n of m[1].matchAll(/'([A-Z_0-9]+)'/g)) names.add(n[1]);
  }
  return names;
}

/** The README's environment table, between its markers. */
export function readmeEnvTable() {
  const readme = fs.readFileSync(path.join(PKG, 'README.md'), 'utf8');
  const m = /<!-- env-table:start -->([\s\S]*?)<!-- env-table:end -->/.exec(readme);
  assert.ok(m, 'README has an env table between <!-- env-table:start/end --> markers');
  return m[1];
}

describe('docs: environment variables', () => {
  it('finds the variables the source reads (sanity)', () => {
    const names = envNamesInSource();
    for (const n of ['NO_COLOR', 'FORCE_COLOR', 'FRAME12_MOTION', 'NO_MOTION', 'GITHUB_ACTIONS', 'CI', 'FRAME12_REFLOW', 'TMUX']) assert.ok(names.has(n), n);
  });

  it('the README table names every one of them', () => {
    const table = readmeEnvTable();
    const missing = [...envNamesInSource()].filter((n) => !new RegExp('`' + n + '[`= ]').test(table));
    assert.deepEqual(missing, [], `undocumented environment variables: ${missing.join(', ')}`);
  });
});
