// Typecheck stand-in: every module must parse (node --check). BREAK=typecheck adds a broken one.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../src/', import.meta.url));
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.mjs')).map((f) => path.join(dir, f));
if (process.env.BREAK === 'typecheck') {
  const broken = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'f12-tc-')), 'invoice.mjs');
  fs.writeFileSync(broken, 'export function total( {\n');
  files.push(broken);
}
let failed = 0;
for (const f of files) {
  try {
    execFileSync(process.execPath, ['--check', f], { stdio: ['ignore', 'ignore', 'pipe'] });
  } catch (err) {
    failed++;
    // "<file>:<line>" and the error itself, with the file named relative to the project.
    const lines = String(err.stderr).trim().split('\n');
    const where = (lines[0] ?? '').replace(path.dirname(f), 'src');
    const what = lines.find((l) => /Error:/.test(l)) ?? lines.at(-1);
    console.error(`${where}  ${what}`);
  }
}
console.log(`typecheck: ${files.length} module${files.length === 1 ? '' : 's'}, ${failed} failed`);
process.exit(failed ? 1 : 0);
