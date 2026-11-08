#!/usr/bin/env node
// CI runs inside the official Playwright image so browsers and their system libraries are
// preinstalled (no `playwright install --with-deps` apt step, which stalled for 60+ minutes on a
// slow Ubuntu mirror). The image's browser builds only match one `playwright` release, so this
// guard fails fast — with the fix spelled out — when the lockfile and the image tag drift apart.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'package.json'));
const locked = require('playwright/package.json').version;
const workflowPaths = ['.github/workflows/ci.yml', '.github/workflows/release-packages.yml'];
const tags = [];
for (const workflowPath of workflowPaths) {
  let workflow = '';
  try {
    workflow = readFileSync(join(root, workflowPath), 'utf8');
  } catch {
    continue;
  }
  for (const m of workflow.matchAll(/mcr\.microsoft\.com\/playwright:v([0-9][^\s"'-]*)/g)) {
    tags.push(m[1]);
  }
}

if (tags.length === 0) {
  console.error(`::error::No mcr.microsoft.com/playwright image found in ${workflowPaths.join(', ')}.`);
  process.exit(1);
}
const stale = tags.filter((tag) => tag !== locked);
if (stale.length > 0) {
  console.error(
    `::error::Workflow files use Playwright image v${stale.join(', v')} but package-lock.json ` +
      `resolves playwright@${locked}. Update every container image tag to ` +
      `mcr.microsoft.com/playwright:v${locked}-noble so the preinstalled browsers match.`,
  );
  process.exit(1);
}
console.log(`PASS  Playwright image v${locked} matches locked playwright@${locked} (${tags.length} job(s)).`);
