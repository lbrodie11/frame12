#!/usr/bin/env node
// Unit, determinism, registry-coverage, WCAG contrast gate, and packaging tests for @frame12/tokens.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildTokenArtifacts,
  checkTokenSync,
  extractRegistryTokenRegion,
} from '../scripts/build-tokens.mjs';
import { tokens, cssText, light, dark, gutters, stroke, motion, fonts, shadow } from '../dist/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(PKG_ROOT, '../..');

let failures = 0;
function check(ok, label, detail = '') {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`);
}

// 1. Byte comparison: dist/tokens.css equals registry/styles/frame12.css token region and registry/styles/frame12-tokens.css
{
  const distCssBuf = fs.readFileSync(path.join(PKG_ROOT, 'dist/tokens.css'));
  const regTokensCssBuf = fs.readFileSync(path.join(REPO_ROOT, 'registry/styles/frame12-tokens.css'));
  const regFullCss = fs.readFileSync(path.join(REPO_ROOT, 'registry/styles/frame12.css'), 'utf8');
  const regionText = extractRegistryTokenRegion(regFullCss);
  assert.notEqual(regionText, null, 'registry/styles/frame12.css must contain /* @tokens:start */ and /* @tokens:end */');
  const regionBuf = Buffer.from(regionText, 'utf8');

  check(
    distCssBuf.equals(regionBuf) &&
      distCssBuf.equals(regTokensCssBuf) &&
      Buffer.from(cssText, 'utf8').equals(distCssBuf),
    'tokens.css byte-equals registry/styles/frame12.css token region, frame12-tokens.css, and exported cssText',
    `${distCssBuf.length} bytes`,
  );
}

// 2. Build determinism: running build twice produces identical bytes across all outputs
{
  const firstRun = {
    css: fs.readFileSync(path.join(PKG_ROOT, 'dist/tokens.css')),
    json: fs.readFileSync(path.join(PKG_ROOT, 'dist/tokens.json')),
    js: fs.readFileSync(path.join(PKG_ROOT, 'dist/index.js')),
    dts: fs.readFileSync(path.join(PKG_ROOT, 'dist/index.d.ts')),
  };

  execFileSync(process.execPath, [path.join(PKG_ROOT, 'scripts/build-tokens.mjs')], {
    cwd: PKG_ROOT,
    stdio: 'pipe',
  });

  const secondRun = {
    css: fs.readFileSync(path.join(PKG_ROOT, 'dist/tokens.css')),
    json: fs.readFileSync(path.join(PKG_ROOT, 'dist/tokens.json')),
    js: fs.readFileSync(path.join(PKG_ROOT, 'dist/index.js')),
    dts: fs.readFileSync(path.join(PKG_ROOT, 'dist/index.d.ts')),
  };

  const buildMemA = buildTokenArtifacts();
  const buildMemB = buildTokenArtifacts();

  check(
    firstRun.css.equals(secondRun.css) &&
      firstRun.json.equals(secondRun.json) &&
      firstRun.js.equals(secondRun.js) &&
      firstRun.dts.equals(secondRun.dts) &&
      buildMemA.tokensCss === buildMemB.tokensCss &&
      buildMemA.tokensJson === buildMemB.tokensJson &&
      buildMemA.indexJs === buildMemB.indexJs &&
      buildMemA.indexDts === buildMemB.indexDts,
    'build-tokens.mjs is 100% deterministic across repeated runs',
  );
}

// 3. Exported TS/JS module contract & DTCG JSON resolution check
{
  const dtcg = JSON.parse(fs.readFileSync(path.join(PKG_ROOT, 'dist/tokens.json'), 'utf8'));
  check(
    tokens.light === light &&
      tokens.dark === dark &&
      tokens.gutters === gutters &&
      tokens.stroke === stroke &&
      tokens.motion === motion &&
      tokens.fonts === fonts &&
      tokens.shadow === shadow &&
      tokens.gutters.pair === '12px' &&
      tokens.gutters.scene === '20px' &&
      tokens.gutters.change === '32px' &&
      tokens.stroke.ink === '2.5px' &&
      tokens.motion.pose === '83.33ms' &&
      tokens.motion.fps === 12 &&
      tokens.light.ink === '#121212' &&
      tokens.light['ink-2'] === '#4b4b4b' &&
      tokens.light.ink2 === '#4b4b4b' &&
      tokens.light['marker-ink'] === '#121212' &&
      tokens.light.markerInk === '#121212' &&
      tokens.dark.ink === '#f1f0ea' &&
      tokens.dark.sheet === '#050505' &&
      tokens.dark.panel === '#19191a' &&
      dtcg.color.ink.$value.light === '#121212' &&
      dtcg.color.ink.$value.dark === '#f1f0ea' &&
      dtcg.gutter.pair.$value === '12px' &&
      dtcg.stroke.ink.$value === '2.5px' &&
      dtcg.motion.pose.$value === '83.33ms' &&
      dtcg.motion.fps.$value === 12 &&
      Boolean(dtcg.shadow.sheet.$value),
    'tokens JS/TS exports and resolved DTCG tokens.json match canonical values',
  );
}

// 4. Every --f-* and --font-f-* custom property used anywhere in registry/ (CSS and TSX/TS) is defined in tokens
{
  const definedTokenVars = new Set(
    [...cssText.matchAll(/(--(?:f|font-f)-[a-zA-Z0-9-]+)\s*:/g)].map((m) => m[1]),
  );

  function walkRegistry(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkRegistry(fullPath, out);
      } else if (/\.(css|tsx|ts)$/.test(entry.name)) {
        out.push(fullPath);
      }
    }
    return out;
  }

  const registryFiles = walkRegistry(path.join(REPO_ROOT, 'registry'));
  const usedTokenVars = new Set();
  for (const file of registryFiles) {
    const content = fs.readFileSync(file, 'utf8');
    for (const match of content.matchAll(/var\(\s*(--(?:f|font-f)-[a-zA-Z0-9-]+)/g)) {
      usedTokenVars.add(match[1]);
    }
  }

  const missingVars = [...usedTokenVars].filter((v) => !definedTokenVars.has(v));
  check(
    usedTokenVars.size > 0 && missingVars.length === 0,
    `every --f-* and --font-f-* custom property used in registry/ (${usedTokenVars.size} used across ${registryFiles.length} files, ${definedTokenVars.size} defined) is defined in @frame12/tokens`,
    missingVars.length > 0 ? `missing: ${missingVars.join(', ')}` : [...usedTokenVars].sort().join(', '),
  );
}

// 5. WCAG contrast gate for light and dark modes
{
  function parseHex(hex) {
    const clean = hex.trim().replace(/^#/, '');
    const full =
      clean.length === 3
        ? clean
            .split('')
            .map((c) => c + c)
            .join('')
        : clean;
    return {
      r: parseInt(full.slice(0, 2), 16),
      g: parseInt(full.slice(2, 4), 16),
      b: parseInt(full.slice(4, 6), 16),
    };
  }

  function relativeLuminance({ r, g, b }) {
    const chan = (v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
  }

  function contrastRatio(fgHex, bgHex) {
    const l1 = relativeLuminance(parseHex(fgHex));
    const l2 = relativeLuminance(parseHex(bgHex));
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }

  const pairs = [
    { name: 'ink/sheet', fg: 'ink', bg: 'sheet', min: 4.5, kind: 'body' },
    { name: 'ink/panel', fg: 'ink', bg: 'panel', min: 4.5, kind: 'body' },
    { name: 'ink-2/panel', fg: 'ink-2', bg: 'panel', min: 4.5, kind: 'body' },
    { name: 'marker-ink/marker', fg: 'marker-ink', bg: 'marker', min: 4.5, kind: 'body' },
    { name: 'rule/panel', fg: 'rule', bg: 'panel', min: 3.0, kind: 'non-text' },
  ];

  const contrastFailures = [];
  const report = {};
  for (const mode of ['light', 'dark']) {
    const palette = tokens[mode];
    report[mode] = {};
    for (const pair of pairs) {
      const ratio = contrastRatio(palette[pair.fg], palette[pair.bg]);
      const rounded = Number(ratio.toFixed(2));
      report[mode][pair.name] = `${rounded.toFixed(2)}:1`;
      if (ratio < pair.min) {
        contrastFailures.push(
          `${mode} ${pair.name} (${palette[pair.fg]} on ${palette[pair.bg]}): ${ratio.toFixed(2)}:1 < ${pair.min}:1`,
        );
      }
    }
  }

  check(
    contrastFailures.length === 0,
    'WCAG contrast gate passes in light & dark modes (>= 4.5:1 body pairs, >= 3:1 rule/panel)',
    JSON.stringify(report),
  );
}

// 6. npm pack --dry-run in packages/tokens lists only dist files, README, LICENSE, and package.json
{
  const packOut = execFileSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: PKG_ROOT,
    encoding: 'utf8',
  });
  const packJson = JSON.parse(packOut);
  const packedPaths = (packJson[0]?.files || []).map((f) => f.path).sort();
  const expectedPaths = [
    'LICENSE',
    'README.md',
    'dist/index.d.ts',
    'dist/index.js',
    'dist/tokens.css',
    'dist/tokens.json',
    'package.json',
  ];
  const unexpectedPaths = packedPaths.filter(
    (p) => !expectedPaths.includes(p),
  );
  const missingPaths = expectedPaths.filter((p) => !packedPaths.includes(p));

  check(
    unexpectedPaths.length === 0 && missingPaths.length === 0,
    'npm pack --dry-run in packages/tokens includes only dist/*, README.md, LICENSE, and package.json',
    packedPaths.join(', '),
  );
}

// 7. Drift detection: checkTokenSync() passes when clean and catches drift in registry/styles/frame12.css
{
  const regCssPath = path.join(REPO_ROOT, 'registry/styles/frame12.css');
  const origCss = fs.readFileSync(regCssPath, 'utf8');
  const cleanDrifts = checkTokenSync();
  let drifted = [];
  try {
    fs.writeFileSync(regCssPath, origCss.replace('--f-ink: #121212;', '--f-ink: #000000;'));
    drifted = checkTokenSync();
  } finally {
    fs.writeFileSync(regCssPath, origCss);
  }
  const restoredDrifts = checkTokenSync();

  check(
    cleanDrifts.length === 0 &&
      drifted.length === 1 &&
      drifted[0].includes('registry/styles/frame12.css') &&
      restoredDrifts.length === 0,
    'checkTokenSync() catches drift in registry/styles/frame12.css token block',
    drifted[0] || '',
  );
}

if (failures > 0) {
  console.error(`\n${failures} token test(s) failed`);
  process.exit(1);
}
console.log('\nAll @frame12/tokens tests passed');
