// Build: bundle src/ into one file in a temporary directory (never into the repository).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

if (process.env.BREAK === 'build') {
  console.error('build: cannot write dist/bundle.mjs: EACCES (simulated)');
  process.exit(1);
}
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'f12-build-'));
const src = new URL('../src/', import.meta.url);
let bytes = 0;
for (const f of fs.readdirSync(src)) {
  const text = fs.readFileSync(new URL(f, src), 'utf8');
  bytes += text.length;
  fs.appendFileSync(path.join(out, 'bundle.mjs'), text);
}
console.log(`build: ${bytes} bytes written to bundle.mjs`);
