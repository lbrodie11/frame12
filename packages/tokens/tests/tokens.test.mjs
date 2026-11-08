#!/usr/bin/env node
// Unit, W3C DTCG 2025.10 validation, determinism, registry-coverage, WCAG contrast gate, and packaging tests for @frame12/tokens.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildTokenArtifacts,
  checkTokenSync,
  componentsToHex,
  extractRegistryTokenRegion,
  formatDtcgFontFamilyCss,
  replaceRegistryTokenRegion,
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

/**
 * Validates a W3C DTCG 2025.10 document tree (`https://www.designtokens.org/tr/2025.10/format/`).
 * Returns an array of validation error strings (empty when valid).
 */
export function validateDtcgDocument(doc) {
  const errors = [];

  if (doc && typeof doc === 'object' && '$schema' in doc) {
    if (
      typeof doc.$schema !== 'string' ||
      (!doc.$schema.endsWith('.json') && !doc.$schema.includes('schema'))
    ) {
      errors.push(`Invalid $schema "${doc.$schema}": must be a JSON Schema URI, not a spec web page`);
    }
  }

  function isValidColorValue(val, tokenPath) {
    if (!val || typeof val !== 'object' || Array.isArray(val)) {
      errors.push(`${tokenPath}: color $value must be an object, got ${typeof val}`);
      return;
    }
    if ('light' in val || 'dark' in val) {
      errors.push(`${tokenPath}: color $value must not be a { light, dark } mode map`);
      return;
    }
    if (val.colorSpace !== 'srgb') {
      errors.push(`${tokenPath}: color.colorSpace must be "srgb", got "${val.colorSpace}"`);
    }
    const validComponents =
      Array.isArray(val.components) &&
      val.components.length === 3 &&
      val.components.every((c) => typeof c === 'number' && Number.isFinite(c) && c >= 0 && c <= 1);
    if (!validComponents) {
      errors.push(`${tokenPath}: color.components must be 3 numbers in [0, 1]`);
    }
    if (
      val.alpha !== undefined &&
      (typeof val.alpha !== 'number' || !Number.isFinite(val.alpha) || val.alpha < 0 || val.alpha > 1)
    ) {
      errors.push(`${tokenPath}: color.alpha must be a number in [0, 1]`);
    }
    if (val.hex !== undefined) {
      if (typeof val.hex !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(val.hex)) {
        errors.push(`${tokenPath}: color.hex must be a 6-digit #rrggbb string`);
      } else if (validComponents) {
        const expectedHex = componentsToHex(val.components);
        if (val.hex.toLowerCase() !== expectedHex) {
          errors.push(
            `${tokenPath}: color.hex "${val.hex}" does not match rounded components "${expectedHex}"`,
          );
        }
      }
      if (val.alpha !== undefined && val.alpha !== 1) {
        errors.push(`${tokenPath}: color.hex must be omitted when alpha < 1`);
      }
    }
  }

  function isValidDimensionValue(val, tokenPath) {
    if (!val || typeof val !== 'object' || Array.isArray(val)) {
      errors.push(
        `${tokenPath}: dimension $value must be a { value, unit } object, got ${JSON.stringify(val)}`,
      );
      return;
    }
    if (typeof val.value !== 'number' || !Number.isFinite(val.value)) {
      errors.push(`${tokenPath}: dimension.value must be a finite number`);
    }
    if (val.unit !== 'px' && val.unit !== 'rem') {
      errors.push(`${tokenPath}: dimension.unit must be "px" or "rem", got "${val.unit}"`);
    }
  }

  function isValidDurationValue(val, tokenPath) {
    if (!val || typeof val !== 'object' || Array.isArray(val)) {
      errors.push(
        `${tokenPath}: duration $value must be a { value, unit } object, got ${JSON.stringify(val)}`,
      );
      return;
    }
    if (typeof val.value !== 'number' || !Number.isFinite(val.value)) {
      errors.push(`${tokenPath}: duration.value must be a finite number`);
    }
    if (val.unit !== 'ms' && val.unit !== 's') {
      errors.push(`${tokenPath}: duration.unit must be "ms" or "s", got "${val.unit}"`);
    }
  }

  function isValidFontFamilyValue(val, tokenPath) {
    const ok =
      (typeof val === 'string' && val.length > 0) ||
      (Array.isArray(val) &&
        val.length > 0 &&
        val.every((item) => typeof item === 'string' && item.length > 0));
    if (!ok) {
      errors.push(`${tokenPath}: fontFamily $value must be a non-empty string or string[]`);
    }
  }

  function isValidShadowLayer(layer, tokenPath) {
    if (!layer || typeof layer !== 'object' || Array.isArray(layer)) {
      errors.push(`${tokenPath}: shadow layer must be an object, got ${JSON.stringify(layer)}`);
      return;
    }
    isValidColorValue(layer.color, `${tokenPath}.color`);
    isValidDimensionValue(layer.offsetX, `${tokenPath}.offsetX`);
    isValidDimensionValue(layer.offsetY, `${tokenPath}.offsetY`);
    isValidDimensionValue(layer.blur, `${tokenPath}.blur`);
    isValidDimensionValue(layer.spread, `${tokenPath}.spread`);
    if (layer.inset !== undefined && typeof layer.inset !== 'boolean') {
      errors.push(`${tokenPath}.inset: must be a boolean when present`);
    }
  }

  function isValidShadowValue(val, tokenPath) {
    if (Array.isArray(val)) {
      if (val.length === 0) {
        errors.push(`${tokenPath}: shadow array $value must not be empty`);
      }
      val.forEach((layer, idx) => isValidShadowLayer(layer, `${tokenPath}[${idx}]`));
    } else {
      isValidShadowLayer(val, tokenPath);
    }
  }

  function walkGroup(node, inheritedType, currentPath) {
    if (!node || typeof node !== 'object' || Array.isArray(node)) {
      errors.push(`${currentPath || '<root>'}: group/token must be an object`);
      return;
    }
    const effectiveType = node.$type || inheritedType;

    if ('$value' in node) {
      if (!effectiveType) {
        errors.push(`${currentPath}: token is missing $type (directly or inherited from group)`);
        return;
      }
      switch (effectiveType) {
        case 'color': {
          isValidColorValue(node.$value, currentPath);
          const modes = node.$extensions?.['dev.frame12.modes'];
          if (modes !== undefined) {
            if (!modes || typeof modes !== 'object' || !modes.light || !modes.dark) {
              errors.push(`${currentPath}: $extensions["dev.frame12.modes"] must define light and dark`);
            } else {
              isValidColorValue(modes.light, `${currentPath}.$extensions.modes.light`);
              isValidColorValue(modes.dark, `${currentPath}.$extensions.modes.dark`);
              if (JSON.stringify(node.$value) !== JSON.stringify(modes.light)) {
                errors.push(
                  `${currentPath}: color $value must deep-equal $extensions["dev.frame12.modes"].light`,
                );
              }
            }
          }
          break;
        }
        case 'dimension':
          isValidDimensionValue(node.$value, currentPath);
          break;
        case 'duration':
          isValidDurationValue(node.$value, currentPath);
          break;
        case 'number':
          if (typeof node.$value !== 'number' || !Number.isFinite(node.$value)) {
            errors.push(`${currentPath}: number $value must be a finite number`);
          }
          break;
        case 'fontFamily':
          isValidFontFamilyValue(node.$value, currentPath);
          break;
        case 'shadow':
          isValidShadowValue(node.$value, currentPath);
          break;
        default:
          errors.push(`${currentPath}: unsupported DTCG $type "${effectiveType}"`);
      }
      return;
    }

    for (const [k, v] of Object.entries(node)) {
      if (k.startsWith('$')) continue;
      walkGroup(v, effectiveType, currentPath ? `${currentPath}.${k}` : k);
    }
  }

  walkGroup(doc, undefined, '');
  return errors;
}

// 1. Byte comparison: dist/tokens.css equals registry/styles/frame12.css token region and registry/styles/frame12-tokens.css
{
  const distCssBuf = fs.readFileSync(path.join(PKG_ROOT, 'dist/tokens.css'));
  const regTokensCssBuf = fs.readFileSync(path.join(REPO_ROOT, 'registry/styles/frame12-tokens.css'));
  const regFullCss = fs.readFileSync(path.join(REPO_ROOT, 'registry/styles/frame12.css'), 'utf8');
  const regionText = extractRegistryTokenRegion(regFullCss);
  assert.notEqual(regionText, null, 'registry/styles/frame12.css must contain /* @tokens:start */ and /* @tokens:end */');
  const regionBuf = Buffer.from(regionText, 'utf8');

  const expectedFallbackFaces = [
    'f12DisplayFallback',
    'f12DisplayFallbackDejaVu',
    'f12BodyFallback',
    'f12BodyFallbackDejaVu',
    'f12MonoFallbackConsolas',
    'f12MonoFallback',
  ];
  const hasAllFallbackFaces = expectedFallbackFaces.every((face) =>
    cssText.includes(`font-family: "${face}";`),
  );

  check(
    distCssBuf.equals(regionBuf) &&
      distCssBuf.equals(regTokensCssBuf) &&
      Buffer.from(cssText, 'utf8').equals(distCssBuf) &&
      hasAllFallbackFaces,
    'tokens.css byte-equals registry/styles/frame12.css token region, frame12-tokens.css, and exported cssText (including all 6 metric-matched @font-face fallbacks)',
    `${distCssBuf.length} bytes`,
  );
}

// 2. Build determinism (into temp directories — never rewrites repo files) & CRLF handling
{
  const tmpDirA = fs.mkdtempSync(path.join(os.tmpdir(), 'f12-tokens-det-a-'));
  const tmpDirB = fs.mkdtempSync(path.join(os.tmpdir(), 'f12-tokens-det-b-'));
  try {
    execFileSync(
      process.execPath,
      [path.join(PKG_ROOT, 'scripts/build-tokens.mjs'), '--out-dir', tmpDirA],
      { cwd: PKG_ROOT, stdio: 'pipe' },
    );
    execFileSync(
      process.execPath,
      [path.join(PKG_ROOT, 'scripts/build-tokens.mjs'), '--out-dir', tmpDirB],
      { cwd: PKG_ROOT, stdio: 'pipe' },
    );

    const firstRun = {
      css: fs.readFileSync(path.join(tmpDirA, 'tokens.css')),
      json: fs.readFileSync(path.join(tmpDirA, 'tokens.json')),
      js: fs.readFileSync(path.join(tmpDirA, 'index.js')),
      dts: fs.readFileSync(path.join(tmpDirA, 'index.d.ts')),
    };
    const secondRun = {
      css: fs.readFileSync(path.join(tmpDirB, 'tokens.css')),
      json: fs.readFileSync(path.join(tmpDirB, 'tokens.json')),
      js: fs.readFileSync(path.join(tmpDirB, 'index.js')),
      dts: fs.readFileSync(path.join(tmpDirB, 'index.d.ts')),
    };

    const buildMemA = buildTokenArtifacts();
    const buildMemB = buildTokenArtifacts();

    // Verify CRLF handling in replaceRegistryTokenRegion
    const crlfSample =
      '/* header */\r\n/* @tokens:start */\r\nold\r\n/* @tokens:end */\r\n.f12-panel {}\r\n';
    const crlfUpdated = replaceRegistryTokenRegion(crlfSample, buildMemA.tokensCss);
    const hasBareLf = /(^|[^\r])\n/.test(crlfUpdated);
    const roundTrip = extractRegistryTokenRegion(crlfUpdated);

    check(
      firstRun.css.equals(secondRun.css) &&
        firstRun.json.equals(secondRun.json) &&
        firstRun.js.equals(secondRun.js) &&
        firstRun.dts.equals(secondRun.dts) &&
        buildMemA.tokensCss === buildMemB.tokensCss &&
        buildMemA.tokensJson === buildMemB.tokensJson &&
        buildMemA.indexJs === buildMemB.indexJs &&
        buildMemA.indexDts === buildMemB.indexDts &&
        !hasBareLf &&
        roundTrip === buildMemA.tokensCss,
      'build-tokens.mjs is 100% deterministic across repeated runs and preserves CRLF line endings without mixed EOLs',
    );
  } finally {
    fs.rmSync(tmpDirA, { recursive: true, force: true });
    fs.rmSync(tmpDirB, { recursive: true, force: true });
  }
}

// 3. Exported TS/JS module contract & W3C DTCG 2025.10 schema validation
{
  const sourceDtcg = JSON.parse(fs.readFileSync(path.join(PKG_ROOT, 'src/tokens.source.json'), 'utf8'));
  const distDtcg = JSON.parse(fs.readFileSync(path.join(PKG_ROOT, 'dist/tokens.json'), 'utf8'));
  const dtsText = fs.readFileSync(path.join(PKG_ROOT, 'dist/index.d.ts'), 'utf8');
  const sourceErrors = validateDtcgDocument(sourceDtcg);
  const distErrors = validateDtcgDocument(distDtcg);

  // Verify the validator rejects non-compliant DTCG shapes (mode map in $value, hex/components mismatch, $value != modes.light, string dimension, CSS string shadow, spec page $schema)
  const invalidFixtureErrors = validateDtcgDocument({
    $schema: 'https://www.designtokens.org/tr/2025.10/format/',
    color: {
      $type: 'color',
      ink: { $value: { light: '#121212', dark: '#f1f0ea' } },
      mismatchHex: {
        $value: { colorSpace: 'srgb', components: [0, 0, 0], alpha: 1, hex: '#ffffff' },
      },
      divergedLight: {
        $value: { colorSpace: 'srgb', components: [1, 1, 1], alpha: 1, hex: '#ffffff' },
        $extensions: {
          'dev.frame12.modes': {
            light: { colorSpace: 'srgb', components: [0, 0, 0], alpha: 1, hex: '#000000' },
            dark: { colorSpace: 'srgb', components: [0, 0, 0], alpha: 1, hex: '#000000' },
          },
        },
      },
    },
    gutter: { $type: 'dimension', pair: { $value: '12px' } },
    shadow: { $type: 'shadow', sheet: { $value: '0 1px 0 rgba(0,0,0,0.05)' } },
  });

  const quotedFont = formatDtcgFontFamilyCss([
    'var(--font-body, "Zen Kaku")',
    '-apple-system',
    'BlinkMacSystemFont',
    'Arial',
    'Custom "Quote" Font',
    'ui-monospace',
    'sans-serif',
  ]);

  check(
    sourceErrors.length === 0 &&
      distErrors.length === 0 &&
      invalidFixtureErrors.length === 6 &&
      quotedFont ===
        'var(--font-body, "Zen Kaku"), -apple-system, BlinkMacSystemFont, "Arial", "Custom \\"Quote\\" Font", ui-monospace, sans-serif',
    'src/tokens.source.json and dist/tokens.json pass strict W3C DTCG 2025.10 validation (including hex/components and $value/modes.light equality)',
    sourceErrors.concat(distErrors).join('; '),
  );

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
      tokens.light['marker-ink'] === '#121212' &&
      !('ink2' in tokens.light) &&
      !('markerInk' in tokens.light) &&
      !('ink2' in tokens.dark) &&
      !('markerInk' in tokens.dark) &&
      Object.keys(tokens.light).length === 13 &&
      JSON.stringify(Object.keys(tokens.light)) === JSON.stringify(Object.keys(tokens.dark)) &&
      tokens.dark.ink === '#f1f0ea' &&
      tokens.dark.sheet === '#050505' &&
      tokens.dark.panel === '#19191a' &&
      dtsText.includes('export interface Frame12Palette {') &&
      dtsText.includes('readonly light: Frame12Palette;') &&
      dtsText.includes('readonly dark: Frame12Palette;') &&
      distDtcg.color.ink.$value.hex === '#121212' &&
      distDtcg.color.ink.$extensions['dev.frame12.modes'].light.hex === '#121212' &&
      distDtcg.color.ink.$extensions['dev.frame12.modes'].dark.hex === '#f1f0ea' &&
      distDtcg.gutter.pair.$value.value === 12 &&
      distDtcg.gutter.pair.$value.unit === 'px' &&
      distDtcg.stroke.ink.$value.value === 2.5 &&
      distDtcg.stroke.ink.$value.unit === 'px' &&
      distDtcg.motion.pose.$value.value === 83.33 &&
      distDtcg.motion.pose.$value.unit === 'ms' &&
      distDtcg.motion.fps.$value === 12 &&
      Array.isArray(distDtcg.shadow.sheet.$value) &&
      distDtcg.shadow.sheet.$value.length === 2 &&
      distDtcg.shadow.peg.$value.inset === true &&
      Object.isFrozen(tokens) &&
      Object.isFrozen(tokens.light) &&
      Object.isFrozen(tokens.dark),
    'tokens JS/TS exports (13 canonical kebab-case palette keys, shared Frame12Palette d.ts, deep-frozen at runtime) and resolved DTCG 2025.10 tokens.json match canonical values',
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
  const referenceOnlyVars = [...definedTokenVars].filter((v) => !usedTokenVars.has(v)).sort();
  check(
    usedTokenVars.size > 0 &&
      missingVars.length === 0 &&
      usedTokenVars.has('--f-stroke') &&
      JSON.stringify(referenceOnlyVars) === JSON.stringify(['--f-fps', '--f-pose']),
    `every --f-* and --font-f-* custom property used in registry/ (${usedTokenVars.size} used across ${registryFiles.length} files, ${definedTokenVars.size} defined; reference-only motion tokens: ${referenceOnlyVars.join(', ')}) is defined in @frame12/tokens`,
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

// 7. Drift detection: checkTokenSync() passes when clean and catches drift in a temp copy without modifying repo files
{
  const regCssPath = path.join(REPO_ROOT, 'registry/styles/frame12.css');
  const origCss = fs.readFileSync(regCssPath, 'utf8');
  const cleanDrifts = checkTokenSync();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'f12-tokens-drift-'));
  let drifted = [];
  try {
    const tmpRegCssPath = path.join(tmpDir, 'frame12.css');
    fs.writeFileSync(tmpRegCssPath, origCss.replace('--f-ink: #121212;', '--f-ink: #000000;'));
    drifted = checkTokenSync({ registryCssPath: tmpRegCssPath });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  check(
    cleanDrifts.length === 0 &&
      drifted.length === 1 &&
      drifted[0].includes('Token region drift'),
    'checkTokenSync() catches drift in registry token block without modifying repo files',
    drifted[0] || '',
  );
}

if (failures > 0) {
  console.error(`\n${failures} token test(s) failed`);
  process.exit(1);
}
console.log('\nAll @frame12/tokens tests passed');
