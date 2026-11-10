// Lint: no debugging output left in src/. BREAK=lint plants one.
import fs from 'node:fs';

const dir = new URL('../src/', import.meta.url);
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.mjs'));
const problems = [];
for (const f of files) {
  let text = fs.readFileSync(new URL(f, dir), 'utf8');
  if (process.env.BREAK === 'lint') text += '\nconsole.log("debug")\n';
  text.split('\n').forEach((line, i) => {
    if (/console\.log\(/.test(line)) problems.push(`src/${f}:${i + 1}  no-console  Unexpected console.log`);
  });
}
for (const p of problems) console.error(p);
const n = (k, word) => `${k} ${word}${k === 1 ? '' : 's'}`;
console.log(`lint: ${n(files.length, 'file')}, ${n(problems.length, 'problem')}`);
process.exit(problems.length ? 1 : 0);
