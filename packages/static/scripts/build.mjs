#!/usr/bin/env node
/**
 * Builds @frame12/static deterministically:
 *   1. `tsc -p tsconfig.json` compiles src/*.ts to dist/*.js + dist/*.d.ts;
 *   2. scripts/build-static-css.mjs generates dist/static.css and dist/static-css.{js,d.ts}.
 *
 * `--check` compiles into a temporary directory and fails if dist/ differs (dist/ is committed,
 * like @frame12/tokens and @frame12/lint, so `npm test` works without a prior build).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(__dirname, '..');
const require = createRequire(path.join(PKG_ROOT, 'package.json'));
const tsc = require.resolve('typescript/bin/tsc');
const check = process.argv.includes('--check');

function listFiles(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? listFiles(p, base) : [path.relative(base, p)];
  });
}

if (check) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'f12-static-check-'));
  try {
    execFileSync(process.execPath, [tsc, '-p', path.join(PKG_ROOT, 'tsconfig.json'), '--outDir', tmp], { stdio: 'inherit' });
    const tsFiles = listFiles(tmp);
    const drift = [];
    for (const f of tsFiles) {
      const onDisk = path.join(PKG_ROOT, 'dist', f);
      if (!fs.existsSync(onDisk) || fs.readFileSync(onDisk, 'utf8') !== fs.readFileSync(path.join(tmp, f), 'utf8')) drift.push(`dist/${f}`);
    }
    const generated = new Set([...tsFiles, 'static.css', 'static-css.js', 'static-css.d.ts']);
    for (const f of listFiles(path.join(PKG_ROOT, 'dist'))) if (!generated.has(f)) drift.push(`dist/${f} (unexpected)`);
    if (drift.length) {
      console.error(`@frame12/static dist/ is stale: ${drift.join(', ')}. Run: npm run build --workspace=@frame12/static`);
      process.exit(1);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  execFileSync(process.execPath, [path.join(__dirname, 'build-static-css.mjs'), '--check'], { stdio: 'inherit' });
} else {
  fs.rmSync(path.join(PKG_ROOT, 'dist'), { recursive: true, force: true });
  execFileSync(process.execPath, [tsc, '-p', path.join(PKG_ROOT, 'tsconfig.json')], { stdio: 'inherit' });
  execFileSync(process.execPath, [path.join(__dirname, 'build-static-css.mjs')], { stdio: 'inherit' });
  console.log('Built @frame12/static dist/.');
}
