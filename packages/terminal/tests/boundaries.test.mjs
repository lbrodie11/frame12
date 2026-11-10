import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(PKG, 'package.json'), 'utf8'));
const tokensPkg = JSON.parse(fs.readFileSync(path.join(PKG, '../tokens/package.json'), 'utf8'));

/** Entry points that must never load React or Ink: core, and the renderers once PR 2 adds them. */
const REACT_FREE = Object.keys(pkg.exports).filter((k) => !['./ink', './process', './package.json', './schema.json'].includes(k));

function listSource(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? listSource(p) : /\.(ts|tsx)$/.test(e.name) ? [p] : [];
  });
}

describe('module boundaries', () => {
  it('importing the React-free entry points loads no react, ink or child_process (loader hook)', () => {
    assert.ok(REACT_FREE.includes('.') && REACT_FREE.includes('./testing'));
    for (const entry of REACT_FREE) {
      const specifier = entry === '.' ? '@frame12/terminal' : `@frame12/terminal/${entry.slice(2)}`;
      const r = spawnSync(process.execPath, ['--import', './tests/loader/register.mjs', '--input-type=module', '-e', `await import(${JSON.stringify(specifier)});`], {
        cwd: PKG,
        encoding: 'utf8',
      });
      assert.equal(r.status, 0, `${specifier}: ${r.stderr}`);
      const seen = r.stderr.split('\n').filter((l) => l.startsWith('F12-RESOLVE ')).map((l) => l.slice(12));
      assert.ok(seen.includes(specifier), 'the hook observed the import');
      const foreign = seen.filter((s) => s !== specifier && !s.startsWith('@frame12/') && !s.startsWith('node:'));
      assert.deepEqual(foreign, [], `${specifier} resolved third-party modules`);
      const builtins = seen.filter((s) => s.startsWith('node:'));
      assert.deepEqual(builtins, [], `${specifier} imported Node built-ins: ${builtins.join(', ')}`);
    }
  });

  it('the hook really fails when React or child_process is imported', () => {
    for (const bad of ['react', 'node:child_process']) {
      const r = spawnSync(process.execPath, ['--import', './tests/loader/register.mjs', '--input-type=module', '-e', `await import(${JSON.stringify(bad)});`], { cwd: PKG, encoding: 'utf8' });
      assert.notEqual(r.status, 0, bad);
      assert.match(r.stderr, /Module boundary violated/);
    }
  });

  it('core source imports no Node built-ins, React, Ink or Git; only ./process may use child_process', () => {
    for (const file of listSource(path.join(PKG, 'src'))) {
      const rel = path.relative(PKG, file).split(path.sep).join('/');
      const src = fs.readFileSync(file, 'utf8');
      const imports = [...src.matchAll(/(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1] ?? m[2]);
      for (const spec of imports) {
        if (/child_process/.test(spec)) assert.ok(rel.startsWith('src/process/'), `${rel} imports ${spec}`);
        if (rel.startsWith('src/core/') || rel === 'src/index.ts' || rel.startsWith('src/testing/')) {
          assert.ok(spec.startsWith('./') || spec.startsWith('../'), `${rel} imports ${spec}; core is self-contained`);
        }
        assert.ok(!/^(react|ink)(\/|$)/.test(spec) || rel.startsWith('src/ink/'), `${rel} imports ${spec}`);
      }
      if (rel.startsWith('src/core/')) assert.ok(!/\bgit\b(?![-\w]*\.)/i.test(src.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '').replace(/'[^']*'|"[^"]*"|`[^`]*`/g, '')), `${rel} has Git vocabulary in code`);
    }
  });
});

describe('packaging', () => {
  it('depends at runtime on @frame12/tokens at its exact version, and nothing else', () => {
    assert.deepEqual(pkg.dependencies, { '@frame12/tokens': tokensPkg.version });
    assert.deepEqual(pkg.peerDependencies, { ink: '^8.0.0', react: '^19.3.0' }, 'ink and react are peers of ./ink only');
    assert.deepEqual(pkg.peerDependenciesMeta, { ink: { optional: true }, react: { optional: true } }, 'and optional, so core users never install them');
    assert.equal(pkg.engines.node, '>=22');
    assert.deepEqual(pkg.files, ['dist']);
  });

  it('every export resolves to a built file, with types first and a .d.ts that exists', () => {
    for (const [key, target] of Object.entries(pkg.exports)) {
      if (typeof target === 'string') {
        assert.ok(fs.existsSync(path.join(PKG, target)), `${key} → ${target}`);
        continue;
      }
      assert.deepEqual(Object.keys(target), ['types', 'default'], `${key}: types condition first`);
      assert.ok(fs.existsSync(path.join(PKG, target.types)), `${key} types`);
      assert.ok(fs.existsSync(path.join(PKG, target.default)), `${key} default`);
    }
    const schema = JSON.parse(fs.readFileSync(path.join(PKG, pkg.exports['./schema.json']), 'utf8'));
    assert.equal(schema.$id, 'https://frame12.dev/schema/terminal/events.v1.json');
  });

  it('the published schema is byte-identical to schema/events.schema.json', () => {
    assert.equal(fs.readFileSync(path.join(PKG, 'dist/events.schema.json'), 'utf8'), fs.readFileSync(path.join(PKG, 'schema/events.schema.json'), 'utf8'));
  });

  it('type-checks a consumer against the built .d.ts files', () => {
    const tsc = path.join(PKG, '../../node_modules/typescript/bin/tsc');
    execFileSync(process.execPath, [tsc, '-p', path.join(PKG, 'tests/tsconfig.json')], { cwd: PKG, encoding: 'utf8' });
  });
});
