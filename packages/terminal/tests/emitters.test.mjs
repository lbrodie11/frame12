/**
 * The README's Go, Python and Rust emitters really drive the CLI: each block is extracted, run
 * (compiled first for Go and Rust), and its output rendered with `frame12-term render --strict`.
 * A missing toolchain skips that language locally; F12_REQUIRE_EMITTERS=1 makes it a failure.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const README = fs.readFileSync(path.join(PKG, 'README.md'), 'utf8');
const REQUIRED = process.env.F12_REQUIRE_EMITTERS === '1';

function block(lang) {
  const m = new RegExp(`<!-- emitter: ${lang} -->\\n\`\`\`${lang}\\n([\\s\\S]*?)\`\`\``).exec(README);
  assert.ok(m, `README has the ${lang} emitter`);
  return m[1];
}

const has = (cmd, args = ['--version']) => spawnSync(cmd, args, { encoding: 'utf8' }).status === 0;
const python = ['python3', 'python'].find((c) => has(c));

const LANGS = [
  { lang: 'python', available: Boolean(python), file: 'emit.py', run: (dir, f) => [python, [f]] },
  { lang: 'go', available: has('go', ['version']), file: 'main.go', run: (dir, f) => ['go', ['run', f]] },
  {
    lang: 'rust',
    available: has('rustc'),
    file: 'main.rs',
    run: (dir, f) => {
      const exe = path.join(dir, process.platform === 'win32' ? 'emit.exe' : 'emit');
      const c = spawnSync('rustc', ['--edition', '2021', '-O', '-o', exe, f], { encoding: 'utf8' });
      assert.equal(c.status, 0, c.stderr);
      return [exe, []];
    },
  },
];

describe('README emitters drive frame12-term', () => {
  for (const { lang, available, file, run } of LANGS) {
    it(`${lang}`, { skip: !available && !REQUIRED ? `${lang} toolchain not installed` : false, timeout: 180_000 }, () => {
      assert.ok(available, `F12_REQUIRE_EMITTERS=1 but ${lang} is not installed`);
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), `f12-emit-${lang}-`));
      const f = path.join(dir, file);
      fs.writeFileSync(f, block(lang));
      const [cmd, args] = run(dir, f);
      const emitted = spawnSync(cmd, args, { cwd: dir, encoding: 'utf8', env: { ...process.env, GOFLAGS: '-mod=mod' } });
      assert.equal(emitted.status, 0, emitted.stderr);
      const r = spawnSync(process.execPath, [path.join(PKG, 'dist/cli/bin.js'), 'render', '--json', '--strict'], { input: emitted.stdout, encoding: 'utf8' });
      assert.equal(r.status, 0, `${r.stderr}\n${emitted.stdout}`);
      const snapshot = JSON.parse(r.stdout);
      assert.equal(snapshot.status, 'completed');
      assert.deepEqual(snapshot.cuts.map((c) => c.cut), ['compile']);
    });
  }
});
