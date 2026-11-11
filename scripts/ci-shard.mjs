#!/usr/bin/env node
// CI runs the verification suite as parallel shards (.github/workflows/ci.yml, job `verify-shard`).
// This file is the single source of truth for what each shard runs. `--check` proves that the
// shards together run exactly what `npm test` runs locally (plus the release checks), and that the
// workflow's matrix lists every shard, so a suite can never silently drop out of CI.
//
//   node scripts/ci-shard.mjs <shard>    run one shard (stops at the first failing command)
//   node scripts/ci-shard.mjs --check    verify the shard plan (part of `npm run test:checks`)
//   node scripts/ci-shard.mjs --list     print the shard names
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(readFileSync(resolve(ROOT, p), 'utf8'));
const root = readJson('package.json');

// Workspaces whose `test` is split across shards. Each workspace's `test` script must be exactly
// `npm run <a> && npm run <b> …` of these parts, in this order (checked below).
const SPLIT = {
  '@frame12/registry': ['test:core', 'test:flash'],
  '@frame12/site': ['test:pages', 'test:motion'],
};
// The flash-safety suite deals its checks round-robin across this many shards (FLASH_SHARD=k/n).
const FLASH_SHARDS = 2;

const workspaces = root.workspaces.map((dir) => ({ dir, pkg: readJson(`${dir}/package.json`) }));
// Every other workspace with a test script runs whole in the `packages` shard, so a new workspace
// is picked up without touching this file or the workflow.
const whole = workspaces.filter(({ pkg }) => pkg.scripts?.test && !SPLIT[pkg.name]).map(({ pkg }) => pkg.name);

const npm = (...args) => ({ cmd: 'npm', args });
const SHARDS = {
  packages: [npm('run', 'test:checks'), ...whole.map((name) => npm('run', 'test', `--workspace=${name}`))],
  registry: [npm('run', 'test:core', '--workspace=@frame12/registry')],
  ...Object.fromEntries(
    Array.from({ length: FLASH_SHARDS }, (_, i) => [
      `flash-${i + 1}`,
      [{ ...npm('run', 'test:flash', '--workspace=@frame12/registry'), env: { FLASH_SHARD: `${i + 1}/${FLASH_SHARDS}` } }],
    ]),
  ),
  'site-pages': [npm('run', 'test:pages', '--workspace=@frame12/site')],
  'site-motion': [npm('run', 'test:motion', '--workspace=@frame12/site')],
  // Not part of `npm test`: the terminal gallery PNGs, the shadcn smoke install and the package
  // dry-run release (the workflow uploads the gallery and tarballs from this shard).
  release: [
    npm('run', 'gallery', '--workspace=@frame12/terminal', '--', '--png'),
    { cmd: 'node', args: ['scripts/smoke-install.mjs'] },
    { cmd: 'node', args: ['scripts/release-packages.mjs', '--dry-run', '--out-dir', '/tmp/frame12-release-artifacts'] },
  ],
};

function check() {
  const problems = [];
  const rootTest = 'npm run test:checks && npm run test --workspaces --if-present';
  if (root.scripts.test !== rootTest) problems.push(`package.json "test" must stay "${rootTest}" (the shards mirror it)`);
  for (const [name, parts] of Object.entries(SPLIT)) {
    const ws = workspaces.find(({ pkg }) => pkg.name === name);
    if (!ws) {
      problems.push(`${name} is split across shards but is not a workspace`);
      continue;
    }
    const want = parts.map((p) => `npm run ${p}`).join(' && ');
    if (ws.pkg.scripts.test !== want) problems.push(`${ws.dir}/package.json "test" must be "${want}" (one shard runs each part)`);
    for (const p of parts) if (!ws.pkg.scripts[p]) problems.push(`${ws.dir}/package.json has no "${p}" script`);
  }
  // Every split part is run by exactly one shard (flash parts by all FLASH_SHARDS shards, once each).
  const runs = Object.values(SHARDS).flat().map((c) => c.args.join(' '));
  for (const [name, parts] of Object.entries(SPLIT)) {
    for (const p of parts) {
      const n = runs.filter((r) => r === `run ${p} --workspace=${name}`).length;
      const expected = p === 'test:flash' ? FLASH_SHARDS : 1;
      if (n !== expected) problems.push(`${name} "${p}" runs in ${n} shards, expected ${expected}`);
    }
  }
  // The workflow's matrix must list exactly these shards.
  const ci = readFileSync(resolve(ROOT, '.github/workflows/ci.yml'), 'utf8');
  const m = /^\s*shard:\s*\[([^\]]*)\]/m.exec(ci);
  const listed = m ? m[1].split(',').map((s) => s.trim()).filter(Boolean) : [];
  const want = Object.keys(SHARDS);
  if (listed.join(',') !== want.join(',')) {
    problems.push(`.github/workflows/ci.yml matrix "shard: [${listed.join(', ')}]" must be "shard: [${want.join(', ')}]"`);
  }
  if (problems.length) {
    for (const p of problems) console.error(`FAIL  ${p}`);
    process.exit(1);
  }
  console.log(`PASS  CI shard plan: ${want.length} shards cover npm test (${whole.length} whole workspaces, ${Object.keys(SPLIT).length} split) and the release checks; ci.yml lists all of them`);
}

const arg = process.argv[2];
if (arg === '--check') check();
else if (arg === '--list') console.log(Object.keys(SHARDS).join('\n'));
else if (SHARDS[arg]) {
  for (const { cmd, args, env } of SHARDS[arg]) {
    const label = `${env ? `${Object.entries(env).map(([k, v]) => `${k}=${v}`).join(' ')} ` : ''}${cmd} ${args.join(' ')}`;
    console.log(`\n▶ [${arg}] ${label}`);
    const r = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', env: { ...process.env, ...env } });
    if (r.status !== 0) {
      console.error(`\n✖ [${arg}] ${label} exited with ${r.status ?? r.signal}`);
      process.exit(r.status || 1);
    }
  }
  console.log(`\n✔ [${arg}] all commands passed`);
} else {
  console.error(`Usage: node scripts/ci-shard.mjs <${Object.keys(SHARDS).join('|')}> | --check | --list`);
  process.exit(2);
}
