#!/usr/bin/env node
/**
 * Deterministically builds @frame12/lint artifacts from src/:
 *   - dist/index.js
 *   - dist/index.d.ts
 *   - dist/cli.mjs
 *
 * Options:
 *   --check            Verify that all generated dist/ outputs match src/
 *                      without modifying files on disk.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(PKG_ROOT, '../..');
const SRC_DIR = path.join(PKG_ROOT, 'src');
const DIST_DIR = path.join(PKG_ROOT, 'dist');

const CLI_CONTENT = `#!/usr/bin/env node
import { runCli } from './index.js';

process.exit(runCli());
`;

export function buildLintArtifacts() {
  const indexJs = fs.readFileSync(path.join(SRC_DIR, 'index.js'), 'utf8');
  const indexDts = fs.readFileSync(path.join(SRC_DIR, 'index.d.ts'), 'utf8');
  return {
    indexJs,
    indexDts,
    cliMjs: CLI_CONTENT,
  };
}

export function checkLintSync() {
  const { indexJs, indexDts, cliMjs } = buildLintArtifacts();
  const drifts = [];
  const expected = [
    [path.join(DIST_DIR, 'index.js'), indexJs],
    [path.join(DIST_DIR, 'index.d.ts'), indexDts],
    [path.join(DIST_DIR, 'cli.mjs'), cliMjs],
  ];
  for (const [filePath, expectedContent] of expected) {
    const rel = path.relative(REPO_ROOT, filePath);
    if (!fs.existsSync(filePath)) {
      drifts.push(`${rel} (missing)`);
      continue;
    }
    const actual = fs.readFileSync(filePath, 'utf8');
    if (actual !== expectedContent) {
      drifts.push(`${rel} (drift from packages/lint/src)`);
    }
  }
  return drifts;
}

export function writeLintArtifacts(outDir = DIST_DIR) {
  const { indexJs, indexDts, cliMjs } = buildLintArtifacts();
  fs.mkdirSync(outDir, { recursive: true });
  const indexJsPath = path.join(outDir, 'index.js');
  const indexDtsPath = path.join(outDir, 'index.d.ts');
  const cliMjsPath = path.join(outDir, 'cli.mjs');
  fs.writeFileSync(indexJsPath, indexJs, 'utf8');
  fs.writeFileSync(indexDtsPath, indexDts, 'utf8');
  fs.writeFileSync(cliMjsPath, cliMjs, 'utf8');
  fs.chmodSync(indexJsPath, 0o755);
  fs.chmodSync(cliMjsPath, 0o755);
}

const isMain =
  process.argv[1] && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);

if (isMain) {
  const checkOnly = process.argv.includes('--check');
  if (checkOnly) {
    const drifts = checkLintSync();
    if (drifts.length > 0) {
      console.error('DRIFT DETECTED in @frame12/lint artifacts:');
      for (const d of drifts) console.error(`  - ${d}`);
      console.error('Run: npm run build --workspace=@frame12/lint');
      process.exit(1);
    }
    console.log('OK: @frame12/lint artifacts are in sync.');
  } else {
    writeLintArtifacts();
    console.log('Built @frame12/lint dist/{index.js,index.d.ts,cli.mjs}.');
  }
}
