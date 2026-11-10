#!/usr/bin/env node
// Runs every @frame12/static test file in order and fails if any fails.
// Browser tests run in Chromium, Firefox and WebKit, like registry/tests/cross-browser.mjs;
// set BROWSERS=chromium for a quick local run.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const only = process.argv.slice(2);
const files = ['escaping', 'parity', 'render', 'css', 'manifest', 'browser'].filter((f) => only.length === 0 || only.includes(f));
const env = { ...process.env, BROWSERS: process.env.BROWSERS || 'chromium,firefox,webkit' };
const failed = [];
for (const f of files) {
  console.log(`\n=== @frame12/static: ${f} ===`);
  const res = spawnSync(process.execPath, [path.join(dir, `${f}.test.mjs`)], { stdio: 'inherit', env });
  if (res.status !== 0) failed.push(f);
}
console.log(failed.length ? `\n@frame12/static: FAILED suites: ${failed.join(', ')}` : `\n@frame12/static: all ${files.length} suites passed`);
process.exit(failed.length ? 1 : 0);
