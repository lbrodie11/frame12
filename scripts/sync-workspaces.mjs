#!/usr/bin/env node
/**
 * Synchronizes (or checks synchronization of) canonical registry files and
 * linter scripts into `templates/next-starter` and `site/public/r`.
 *
 * Usage:
 *   node scripts/sync-workspaces.mjs           # copy files + rebuild site/public/r
 *   node scripts/sync-workspaces.mjs --check   # verify zero drift across workspaces
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checkOnly = process.argv.includes('--check');

const FILE_MAPPINGS = [];

// 1. registry/ui/* -> templates/next-starter/src/components/frame12/*
const uiDir = path.join(ROOT, 'registry/ui');
for (const entry of fs.readdirSync(uiDir)) {
  if (entry.endsWith('.tsx') || entry.endsWith('.ts')) {
    FILE_MAPPINGS.push({
      src: path.join(uiDir, entry),
      dest: path.join(ROOT, 'templates/next-starter/src/components/frame12', entry),
    });
  }
}

// 2. registry/hooks/use-on-twos.ts -> templates/next-starter/src/hooks/use-on-twos.ts
FILE_MAPPINGS.push({
  src: path.join(ROOT, 'registry/hooks/use-on-twos.ts'),
  dest: path.join(ROOT, 'templates/next-starter/src/hooks/use-on-twos.ts'),
});

// 3. registry/styles/* -> templates/next-starter/src/styles/*
for (const styleFile of ['frame12.css', 'frame12-tailwind.css']) {
  FILE_MAPPINGS.push({
    src: path.join(ROOT, 'registry/styles', styleFile),
    dest: path.join(ROOT, 'templates/next-starter/src/styles', styleFile),
  });
}

// 4. scripts/check-frame12.mjs -> templates/next-starter/scripts/check-frame12.mjs
FILE_MAPPINGS.push({
  src: path.join(ROOT, 'scripts/check-frame12.mjs'),
  dest: path.join(ROOT, 'templates/next-starter/scripts/check-frame12.mjs'),
});

// 5. skills/frame12/{SKILL.md,eslint.frame12.mjs,references/*} -> templates/next-starter/.claude/skills/frame12/*
for (const relSkill of [
  'SKILL.md',
  'eslint.frame12.mjs',
  'references/components-and-adapters.md',
  'references/examples-and-mistakes.md',
]) {
  FILE_MAPPINGS.push({
    src: path.join(ROOT, 'skills/frame12', relSkill),
    dest: path.join(ROOT, 'templates/next-starter/.claude/skills/frame12', relSkill),
  });
}

// 6. site/src/fonts/{*.woff2,OFL.txt} -> templates/next-starter/src/fonts/{*.woff2,OFL.txt}
const fontsDir = path.join(ROOT, 'site/src/fonts');
if (fs.existsSync(fontsDir)) {
  for (const fontFile of fs.readdirSync(fontsDir)) {
    if (fontFile.endsWith('.woff2') || fontFile === 'OFL.txt') {
      FILE_MAPPINGS.push({
        src: path.join(fontsDir, fontFile),
        dest: path.join(ROOT, 'templates/next-starter/src/fonts', fontFile),
      });
    }
  }
}

// 7. registry/registry.json -> site/public/r/registry.json
FILE_MAPPINGS.push({
  src: path.join(ROOT, 'registry/registry.json'),
  dest: path.join(ROOT, 'site/public/r/registry.json'),
});

const legacyDir = path.join(ROOT, 'templates/next-starter/src/registry');

if (checkOnly) {
  const drifts = [];

  if (fs.existsSync(legacyDir)) {
    drifts.push('Legacy directory templates/next-starter/src/registry still exists.');
  }

  for (const { src, dest } of FILE_MAPPINGS) {
    if (!fs.existsSync(dest)) {
      drifts.push(`Missing synced file: ${path.relative(ROOT, dest)}`);
      continue;
    }
    const srcBuf = fs.readFileSync(src);
    const destBuf = fs.readFileSync(dest);
    if (!srcBuf.equals(destBuf)) {
      drifts.push(
        `Drift between ${path.relative(ROOT, src)} and ${path.relative(ROOT, dest)}`,
      );
    }
  }

  // Verify site/public/r/*.json contain current source contents from registry/
  const registryJson = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'registry/registry.json'), 'utf8'),
  );
  for (const item of registryJson.items) {
    const builtPath = path.join(ROOT, 'site/public/r', `${item.name}.json`);
    if (!fs.existsSync(builtPath)) {
      drifts.push(`Missing built registry item: site/public/r/${item.name}.json`);
      continue;
    }
    const builtItem = JSON.parse(fs.readFileSync(builtPath, 'utf8'));
    if (builtItem.type !== item.type) {
      drifts.push(
        `Registry item type mismatch in site/public/r/${item.name}.json: expected ${item.type}, got ${builtItem.type}`,
      );
    }
    const expectedDeps = JSON.stringify(item.dependencies || []);
    const actualDeps = JSON.stringify(builtItem.dependencies || []);
    if (expectedDeps !== actualDeps) {
      drifts.push(
        `Dependencies mismatch in site/public/r/${item.name}.json: expected ${expectedDeps}, got ${actualDeps}`,
      );
    }
    const expectedRegDeps = JSON.stringify(item.registryDependencies || []);
    const actualRegDeps = JSON.stringify(builtItem.registryDependencies || []);
    if (expectedRegDeps !== actualRegDeps) {
      drifts.push(
        `registryDependencies mismatch in site/public/r/${item.name}.json: expected ${expectedRegDeps}, got ${actualRegDeps}`,
      );
    }
    const expectedSpecs = JSON.stringify(
      (item.files || []).map((f) => ({ path: f.path, type: f.type, target: f.target })),
    );
    const actualSpecs = JSON.stringify(
      (builtItem.files || []).map((f) => ({ path: f.path, type: f.type, target: f.target })),
    );
    if (expectedSpecs !== actualSpecs) {
      drifts.push(
        `File specifications mismatch in site/public/r/${item.name}.json: expected ${expectedSpecs}, got ${actualSpecs}`,
      );
    }
    for (const fileSpec of item.files) {
      const srcFileContent = fs.readFileSync(
        path.join(ROOT, 'registry', fileSpec.path),
        'utf8',
      );
      const builtFile = (builtItem.files || []).find((f) => f.path === fileSpec.path);
      if (!builtFile) {
        drifts.push(`Missing file ${fileSpec.path} in site/public/r/${item.name}.json`);
      } else {
        if (builtFile.type !== fileSpec.type) {
          drifts.push(
            `Type mismatch for ${fileSpec.path} in site/public/r/${item.name}.json: expected ${fileSpec.type}, got ${builtFile.type}`,
          );
        }
        if (builtFile.target !== fileSpec.target) {
          drifts.push(
            `Target mismatch for ${fileSpec.path} in site/public/r/${item.name}.json: expected ${fileSpec.target}, got ${builtFile.target}`,
          );
        }
        if (builtFile.content !== srcFileContent) {
          drifts.push(
            `Content drift for ${fileSpec.path} in site/public/r/${item.name}.json`,
          );
        }
      }
    }
  }

  if (drifts.length > 0) {
    console.error('FRAME/12 workspace sync check failed:');
    for (const d of drifts) {
      console.error(`  - ${d}`);
    }
    console.error('Run `npm run sync:workspaces` to synchronize all workspace copies.');
    process.exit(1);
  }

  console.log(
    `FRAME/12 workspace sync check passed (${FILE_MAPPINGS.length} files + ${registryJson.items.length} registry payloads verified).`,
  );
  process.exit(0);
}

// Perform sync
if (fs.existsSync(legacyDir)) {
  fs.rmSync(legacyDir, { recursive: true, force: true });
}

for (const { src, dest } of FILE_MAPPINGS) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

execFileSync('npx', ['--yes', 'shadcn', 'build', 'registry.json', '-o', '../site/public/r'], {
  cwd: path.join(ROOT, 'registry'),
  stdio: 'inherit',
});
fs.copyFileSync(
  path.join(ROOT, 'registry/registry.json'),
  path.join(ROOT, 'site/public/r/registry.json'),
);

console.log(`Synchronized ${FILE_MAPPINGS.length} files and rebuilt site/public/r/*.json.`);
