#!/usr/bin/env node
/**
 * Validates all publishable workspace packages under `packages/*` discovered from root `package.json`.
 *
 * Enforces:
 *   1. Dynamic discovery from root `workspaces` entries under `packages/` (topologically ordered).
 *   2. Package name is `@frame12/<dir>` and `version` is valid semver with a matching `CHANGELOG.md` section.
 *   3. Internal `@frame12/*` dependencies use the exact current workspace version (never `workspace:*` or ranges).
 *   4. `files` contains only built output (`dist`), `README.md`, and `LICENSE` (verified against `npm pack --dry-run`).
 *   5. `exports` (plus `main`, `types`, `bin`) resolve to existing files after build, with `types` condition first.
 *   6. Zero runtime dependencies other than allowed internal `@frame12/*` packages (and optional peers: `typescript` on `@frame12/lint`, `ink`/`react` on `@frame12/terminal`).
 *   7. `license: "MIT"` and `repository.directory: "packages/<dir>"`.
 *
 * Usage:
 *   node scripts/check-packages.mjs               # validate all packages/* in the repo
 *   node scripts/check-packages.mjs --sync-deps   # rewrite internal @frame12/* deps to exact workspace versions
 *   node scripts/check-packages.mjs --smoke       # run standalone tarball install smoke test
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_REPO_ROOT = path.resolve(__dirname, '..');

const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const ALLOWED_FILES_ENTRY_RE = /^(?:dist(?:\/.*)?|README\.md|LICENSE)$/;

/**
 * Extracts the release notes section for `version` from a Keep-a-Changelog formatted `CHANGELOG.md`.
 * Matches headings like `## [0.2.0] - 2026-11-08`, `## [0.2.0]`, or `## 0.2.0`.
 */
export function extractPackageChangelog(changelogMd, version) {
  if (typeof changelogMd !== 'string' || !version) return null;
  const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const headingRe = new RegExp(`^##\\s+(?:\\[${escaped}\\]|${escaped})(?:\\s+-\\s+.*|\\s*)$`, 'm');
  const match = headingRe.exec(changelogMd);
  if (!match) return null;

  const startIdx = match.index + match[0].length;
  const rest = changelogMd.slice(startIdx);
  const nextHeadingMatch = /^##\s+/m.exec(rest);
  const body = (nextHeadingMatch ? rest.slice(0, nextHeadingMatch.index) : rest).trim();
  return body.length > 0 ? body : null;
}

/**
 * Rewrites internal `@frame12/*` dependency ranges (including `workspace:*`, `^...`, `~...`, or
 * stale versions) to the exact version of that workspace package in `workspaceVersions`.
 *
 * @param {Record<string, unknown>} pkgJson
 * @param {Map<string, string> | Record<string, string>} workspaceVersions
 * @returns {{ pkgJson: Record<string, unknown>, changed: boolean, changes: Array<{ field: string, dep: string, from: string, to: string }> }}
 */
export function rewriteInternalDependencies(pkgJson, workspaceVersions) {
  const versionMap =
    workspaceVersions instanceof Map
      ? workspaceVersions
      : new Map(Object.entries(workspaceVersions || {}));
  const clone = JSON.parse(JSON.stringify(pkgJson));
  const changes = [];

  for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
    const depMap = clone[field];
    if (!depMap || typeof depMap !== 'object' || Array.isArray(depMap)) continue;
    for (const [depName, spec] of Object.entries(depMap)) {
      if (!depName.startsWith('@frame12/')) continue;
      if (!versionMap.has(depName)) {
        throw new Error(
          `${clone.name || '<package>'}: ${field}.${depName} ("${spec}") references unknown internal workspace package "${depName}".`,
        );
      }
      const targetVersion = versionMap.get(depName);
      if (spec !== targetVersion) {
        changes.push({ field, dep: depName, from: String(spec), to: targetVersion });
        depMap[depName] = targetVersion;
      }
    }
  }

  return { pkgJson: clone, changed: changes.length > 0, changes };
}

/**
 * Discovers publishable workspace packages under `packages/` from `<rootDir>/package.json`
 * and returns them sorted in topological dependency order (dependencies before dependents).
 */
export function discoverPublishablePackages(rootDir = DEFAULT_REPO_ROOT) {
  const rootPkgPath = path.join(rootDir, 'package.json');
  if (!fs.existsSync(rootPkgPath)) {
    throw new Error(`Missing root package.json at ${rootPkgPath}`);
  }
  const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
  const workspaces = Array.isArray(rootPkg.workspaces)
    ? rootPkg.workspaces
    : Array.isArray(rootPkg.workspaces?.packages)
      ? rootPkg.workspaces.packages
      : [];

  const relDirs = new Set();
  for (const rawEntry of workspaces) {
    if (typeof rawEntry !== 'string') continue;
    const entry = rawEntry.replace(/\\/g, '/').replace(/\/+$/, '');
    if (entry === 'packages/*') {
      const packagesRoot = path.join(rootDir, 'packages');
      if (fs.existsSync(packagesRoot)) {
        for (const dirent of fs.readdirSync(packagesRoot, { withFileTypes: true })) {
          if (dirent.isDirectory() && fs.existsSync(path.join(packagesRoot, dirent.name, 'package.json'))) {
            relDirs.add(`packages/${dirent.name}`);
          }
        }
      }
    } else if (entry.startsWith('packages/')) {
      relDirs.add(entry);
    }
  }

  const rawList = [];
  for (const relDir of relDirs) {
    const dir = path.join(rootDir, relDir);
    const pkgJsonPath = path.join(dir, 'package.json');
    if (!fs.existsSync(pkgJsonPath)) {
      throw new Error(`Workspace entry "${relDir}" in root package.json has no package.json at ${pkgJsonPath}`);
    }
    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    if (pkgJson.private === true) continue;
    const shortName = path.basename(relDir);
    const internalDeps = [];
    for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
      const deps = pkgJson[field];
      if (!deps || typeof deps !== 'object') continue;
      for (const depName of Object.keys(deps)) {
        if (depName.startsWith('@frame12/') && !internalDeps.includes(depName)) {
          internalDeps.push(depName);
        }
      }
    }
    rawList.push({
      shortName,
      name: pkgJson.name,
      version: pkgJson.version,
      dir,
      relDir,
      pkgJson,
      internalDeps,
    });
  }

  // Pre-sort by canonical pipeline order (tokens -> lint -> static, then alphabetical)
  // before running topological DFS so independent packages also follow deterministic release order.
  const CANONICAL_ORDER = ['tokens', 'lint', 'static'];
  rawList.sort((a, b) => {
    const idxA = CANONICAL_ORDER.indexOf(a.shortName);
    const idxB = CANONICAL_ORDER.indexOf(b.shortName);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.shortName.localeCompare(b.shortName);
  });

  // Topological sort so dependencies (e.g. @frame12/tokens) always precede dependents (e.g. @frame12/static)
  const byName = new Map(rawList.map((p) => [p.name, p]));
  const visited = new Set();
  const visiting = new Set();
  const sorted = [];

  function visit(pkg) {
    if (visited.has(pkg.relDir)) return;
    if (visiting.has(pkg.relDir)) {
      throw new Error(`Circular internal dependency detected involving ${pkg.name} (${pkg.relDir})`);
    }
    visiting.add(pkg.relDir);
    for (const depName of pkg.internalDeps) {
      const depPkg = byName.get(depName);
      if (depPkg && depPkg.relDir !== pkg.relDir) {
        visit(depPkg);
      }
    }
    visiting.delete(pkg.relDir);
    visited.add(pkg.relDir);
    sorted.push(pkg);
  }

  for (const pkg of rawList) {
    visit(pkg);
  }

  return sorted;
}

function collectExportsTargets(exportsField, currentPath = 'exports', out = []) {
  if (typeof exportsField === 'string') {
    out.push({ keyPath: currentPath, target: exportsField });
    return out;
  }
  if (!exportsField || typeof exportsField !== 'object' || Array.isArray(exportsField)) {
    out.push({ keyPath: currentPath, target: null, invalid: true });
    return out;
  }
  const keys = Object.keys(exportsField);
  const hasConditionKeys = keys.some((k) => !k.startsWith('.'));
  if (hasConditionKeys && keys.includes('types') && keys[0] !== 'types') {
    out.push({
      keyPath: currentPath,
      target: null,
      typesOrderError: `"types" condition must be the first key in ${currentPath} (found order: ${keys.join(', ')})`,
    });
  }
  for (const [k, v] of Object.entries(exportsField)) {
    collectExportsTargets(v, `${currentPath}["${k}"]`, out);
  }
  return out;
}

/**
 * Validates a single publishable package object against FRAME/12 release pipeline rules.
 */
export function validateSinglePackage(pkgInfo, workspacePackagesByName, options = {}) {
  const { runNpmPackCheck = true, requireBuiltFiles = true } = options;
  const { shortName, dir, relDir, pkgJson } = pkgInfo;
  const errors = [];
  const label = `${relDir}/package.json`;

  // 1. Name under @frame12/ and matching directory name
  const expectedName = `@frame12/${shortName}`;
  if (typeof pkgJson.name !== 'string' || !/^@frame12\/[a-z0-9-]+$/.test(pkgJson.name)) {
    errors.push(`${label}: "name" must be under "@frame12/" (expected "${expectedName}", got ${JSON.stringify(pkgJson.name)})`);
  } else if (pkgJson.name !== expectedName) {
    errors.push(`${label}: "name" ("${pkgJson.name}") must match directory "${relDir}" (expected "${expectedName}")`);
  }

  // 2. Version & CHANGELOG.md section
  if (typeof pkgJson.version !== 'string' || !SEMVER_RE.test(pkgJson.version)) {
    errors.push(`${label}: "version" must be valid semver (got ${JSON.stringify(pkgJson.version)})`);
  } else if (dir && fs.existsSync(dir)) {
    const changelogPath = path.join(dir, 'CHANGELOG.md');
    if (!fs.existsSync(changelogPath)) {
      errors.push(`${relDir}: missing CHANGELOG.md (required for every publishable package)`);
    } else {
      const changelogText = fs.readFileSync(changelogPath, 'utf8');
      const section = extractPackageChangelog(changelogText, pkgJson.version);
      if (!section) {
        errors.push(
          `${relDir}/CHANGELOG.md: missing or empty release section for current version "${pkgJson.version}" (expected "## [${pkgJson.version}]")`,
        );
      }
    }
  }

  // 3. License: MIT & publishConfig.access: "public"
  if (pkgJson.license !== 'MIT') {
    errors.push(`${label}: "license" must be "MIT" (got ${JSON.stringify(pkgJson.license)})`);
  }
  if (pkgJson.publishConfig?.access !== 'public') {
    errors.push(
      `${label}: "publishConfig.access" must be "public" (got ${JSON.stringify(pkgJson.publishConfig?.access)})`,
    );
  }

  // 4. repository.directory is set to packages/<shortName>
  const repo = pkgJson.repository;
  if (!repo || typeof repo !== 'object' || Array.isArray(repo)) {
    errors.push(`${label}: "repository" must be an object with { type, url, directory: "${relDir}" }`);
  } else {
    if (repo.directory !== relDir) {
      errors.push(
        `${label}: "repository.directory" must be "${relDir}" (got ${JSON.stringify(repo.directory)})`,
      );
    }
    if (typeof repo.url !== 'string' || !repo.url.includes('frame12')) {
      errors.push(`${label}: "repository.url" must point to the frame12 git repository`);
    }
  }

  // 5. Dependencies & internal @frame12/* exact version check
  const deps = pkgJson.dependencies || {};
  for (const [depName, spec] of Object.entries(deps)) {
    if (!depName.startsWith('@frame12/')) {
      errors.push(
        `${label}: external runtime dependency "${depName}": "${spec}" is not allowed (only internal @frame12/* packages are permitted in dependencies)`,
      );
      continue;
    }
    if (typeof spec === 'string' && spec.startsWith('workspace:')) {
      errors.push(
        `${label}: internal dependency "${depName}": "${spec}" uses forbidden "workspace:" protocol; use the exact version string`,
      );
      continue;
    }
    const targetPkg = workspacePackagesByName.get(depName);
    if (!targetPkg) {
      errors.push(
        `${label}: internal dependency "${depName}" does not match any publishable package under packages/`,
      );
      continue;
    }
    if (spec !== targetPkg.version) {
      errors.push(
        `${label}: internal dependency "${depName}" must equal exact workspace version "${targetPkg.version}" (got "${spec}")`,
      );
    }
  }

  // 6. peerDependencies: only @frame12/lint may have an optional `typescript` peerDependency
  const peerDeps = pkgJson.peerDependencies || {};
  const peerMeta = pkgJson.peerDependenciesMeta || {};
  for (const [peerName, spec] of Object.entries(peerDeps)) {
    if (peerName.startsWith('@frame12/')) {
      if (typeof spec === 'string' && spec.startsWith('workspace:')) {
        errors.push(
          `${label}: peerDependency "${peerName}": "${spec}" uses forbidden "workspace:" protocol`,
        );
      }
      const targetPkg = workspacePackagesByName.get(peerName);
      if (!targetPkg) {
        errors.push(`${label}: internal peerDependency "${peerName}" not found in packages/`);
      } else if (spec !== targetPkg.version) {
        errors.push(
          `${label}: internal peerDependency "${peerName}" must equal exact workspace version "${targetPkg.version}" (got "${spec}")`,
        );
      }
      continue;
    }
    if (pkgJson.name === '@frame12/lint' && peerName === 'typescript') {
      if (peerMeta?.typescript?.optional !== true) {
        errors.push(
          `${label}: peerDependency "typescript" on @frame12/lint must be marked optional in peerDependenciesMeta.typescript.optional = true`,
        );
      }
    } else if (pkgJson.name === '@frame12/terminal' && (peerName === 'ink' || peerName === 'react')) {
      // Only @frame12/terminal/ink uses them; core, ./render and ./process never load React or Ink.
      if (peerMeta?.[peerName]?.optional !== true) {
        errors.push(
          `${label}: peerDependency "${peerName}" on @frame12/terminal must be marked optional in peerDependenciesMeta.${peerName}.optional = true`,
        );
      }
    } else {
      errors.push(
        `${label}: disallowed peerDependency "${peerName}": "${spec}" (only @frame12/lint's optional typescript peer and @frame12/terminal's optional ink/react peers are allowed)`,
      );
    }
  }

  for (const forbiddenField of ['optionalDependencies', 'bundledDependencies', 'bundleDependencies']) {
    const val = pkgJson[forbiddenField];
    if (val && typeof val === 'object' && Object.keys(val).length > 0) {
      errors.push(`${label}: "${forbiddenField}" must not be used in publishable packages`);
    }
  }

  // 7. `files` whitelist & README/LICENSE presence
  if (!Array.isArray(pkgJson.files) || pkgJson.files.length === 0) {
    errors.push(`${label}: "files" must be a non-empty array containing only built output ("dist"), "README.md", or "LICENSE"`);
  } else {
    for (const rawFileEntry of pkgJson.files) {
      const normalized = String(rawFileEntry).replace(/^\.\//, '').replace(/\/+$/, '');
      if (!ALLOWED_FILES_ENTRY_RE.test(normalized)) {
        errors.push(
          `${label}: disallowed "files" entry ${JSON.stringify(rawFileEntry)} (only "dist", "README.md", and "LICENSE" are permitted)`,
        );
      }
    }
  }

  if (dir && fs.existsSync(dir)) {
    for (const requiredDoc of ['README.md', 'LICENSE']) {
      if (!fs.existsSync(path.join(dir, requiredDoc))) {
        errors.push(`${relDir}: missing ${requiredDoc}`);
      }
    }
  }

  // 8. `exports` (plus `main`, `types`, `bin`) resolve to existing built files
  if (!pkgJson.exports || typeof pkgJson.exports !== 'object' || Array.isArray(pkgJson.exports) || Object.keys(pkgJson.exports).length === 0) {
    errors.push(`${label}: "exports" must be a non-empty object`);
  } else {
    const targets = collectExportsTargets(pkgJson.exports);
    for (const item of targets) {
      if (item.typesOrderError) {
        errors.push(`${label}: ${item.typesOrderError}`);
        continue;
      }
      if (item.invalid || typeof item.target !== 'string') {
        errors.push(`${label}: invalid export target at ${item.keyPath}`);
        continue;
      }
      if (!item.target.startsWith('./')) {
        errors.push(`${label}: export target "${item.target}" at ${item.keyPath} must start with "./"`);
        continue;
      }
      if (item.target !== './package.json' && !item.target.startsWith('./dist/')) {
        errors.push(
          `${label}: export target "${item.target}" at ${item.keyPath} must point inside "./dist/" (or "./package.json")`,
        );
      }
      if (requireBuiltFiles && dir && fs.existsSync(dir)) {
        const resolvedPath = path.join(dir, item.target);
        if (!fs.existsSync(resolvedPath)) {
          errors.push(
            `${label}: export target "${item.target}" at ${item.keyPath} does not exist on disk after build`,
          );
        }
      }
    }
  }

  for (const field of ['main', 'types']) {
    if (pkgJson[field] !== undefined) {
      const target = pkgJson[field];
      if (typeof target !== 'string' || !target.startsWith('./dist/')) {
        errors.push(`${label}: "${field}" ("${target}") must start with "./dist/"`);
      } else if (requireBuiltFiles && dir && fs.existsSync(dir) && !fs.existsSync(path.join(dir, target))) {
        errors.push(`${label}: "${field}" target "${target}" does not exist on disk after build`);
      }
    }
  }

  if (pkgJson.bin !== undefined) {
    const binEntries =
      typeof pkgJson.bin === 'string'
        ? [[shortName, pkgJson.bin]]
        : pkgJson.bin && typeof pkgJson.bin === 'object'
          ? Object.entries(pkgJson.bin)
          : [];
    for (const [binName, binTarget] of binEntries) {
      if (typeof binTarget !== 'string' || !binTarget.startsWith('./dist/')) {
        errors.push(`${label}: bin["${binName}"] ("${binTarget}") must point inside "./dist/"`);
      } else if (requireBuiltFiles && dir && fs.existsSync(dir) && !fs.existsSync(path.join(dir, binTarget))) {
        errors.push(`${label}: bin["${binName}"] target "${binTarget}" does not exist on disk after build`);
      }
    }
  }

  // 9. Verify `npm pack --dry-run --json` includes only dist/**, README.md, LICENSE, and package.json
  if (runNpmPackCheck && dir && fs.existsSync(dir) && errors.length === 0) {
    try {
      const packRaw = execFileSync('npm', ['pack', '--dry-run', '--json'], {
        cwd: dir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const packJson = JSON.parse(packRaw);
      const files = (packJson[0]?.files || []).map((f) => f.path);
      for (const filePath of files) {
        if (
          filePath !== 'package.json' &&
          filePath !== 'README.md' &&
          filePath !== 'LICENSE' &&
          !filePath.startsWith('dist/')
        ) {
          errors.push(
            `${relDir}: npm pack --dry-run would publish unexpected file "${filePath}" (only dist/**, README.md, LICENSE, and package.json are allowed)`,
          );
        }
      }
    } catch (err) {
      errors.push(`${relDir}: npm pack --dry-run failed: ${err.message}`);
    }
  }

  return errors;
}

/**
 * Discovers and validates all publishable workspace packages under `<rootDir>/packages/*`.
 */
export function validatePackages(rootDir = DEFAULT_REPO_ROOT, options = {}) {
  const packages = discoverPublishablePackages(rootDir);
  if (packages.length === 0) {
    return {
      packages: [],
      errors: [`No publishable packages discovered under "packages/" in ${path.join(rootDir, 'package.json')}`],
    };
  }
  const byName = new Map(packages.map((p) => [p.name, p]));
  const errors = [];
  for (const pkg of packages) {
    errors.push(...validateSinglePackage(pkg, byName, options));
  }
  return { packages, errors };
}

/**
 * Packs every discovered package under `<rootDir>/packages/*` with `npm pack`, installs the
 * tarballs into an isolated temporary project with NO other dependencies, and runs standalone
 * verification checks for whichever packages (`@frame12/tokens`, `@frame12/lint`, `@frame12/static`)
 * are present. For `@frame12/static` it imports every export with `node:fs` blocked, renders a
 * `document()`, resolves `./static.css`, and type-checks a consumer against the installed `.d.ts`.
 */
export function runStandalonePackageSmokeTest(rootDir = DEFAULT_REPO_ROOT, options = {}) {
  const packages = discoverPublishablePackages(rootDir);
  if (packages.length === 0) {
    throw new Error(`No publishable packages found under packages/ in ${rootDir}`);
  }

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'frame12-pkg-smoke-'));
  const tarballDir = path.join(tmpRoot, 'tarballs');
  const consumerDir = path.join(tmpRoot, 'consumer');
  fs.mkdirSync(tarballDir, { recursive: true });
  fs.mkdirSync(consumerDir, { recursive: true });

  try {
    const tarballs = [];
    for (const pkg of packages) {
      const packOut = execFileSync(
        'npm',
        ['pack', '--pack-destination', tarballDir, '--json'],
        { cwd: pkg.dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
      );
      const packInfo = JSON.parse(packOut);
      const filename = packInfo[0]?.filename;
      if (!filename) {
        throw new Error(`npm pack did not return a filename for ${pkg.name}`);
      }
      const tgzPath = path.join(tarballDir, filename);
      if (!fs.existsSync(tgzPath)) {
        throw new Error(`Expected packed tarball missing at ${tgzPath}`);
      }
      tarballs.push({ pkg, filename, tgzPath });
    }

    // Create isolated consumer with zero other dependencies
    fs.writeFileSync(
      path.join(consumerDir, 'package.json'),
      JSON.stringify(
        {
          name: 'frame12-standalone-package-consumer',
          private: true,
          version: '0.0.0',
          type: 'module',
        },
        null,
        2,
      ) + '\n',
    );

    execFileSync(
      'npm',
      [
        'install',
        '--no-audit',
        '--no-fund',
        '--ignore-scripts',
        ...tarballs.map((t) => t.tgzPath),
      ],
      { cwd: consumerDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );

    // Verify no external dependencies were installed in consumerDir/node_modules
    const nmDir = path.join(consumerDir, 'node_modules');
    const topEntries = fs
      .readdirSync(nmDir)
      .filter((e) => !e.startsWith('.'));
    if (topEntries.length !== 1 || topEntries[0] !== '@frame12') {
      throw new Error(
        `Standalone package consumer installed unexpected non-@frame12 packages in node_modules: ${topEntries.join(', ')}`,
      );
    }

    const installedNames = new Set(packages.map((p) => p.name));
    const verifyScriptPath = path.join(consumerDir, 'verify-standalone.mjs');
    fs.writeFileSync(
      verifyScriptPath,
      `import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const present = ${JSON.stringify([...installedNames])};
const results = {};

if (present.includes('@frame12/tokens')) {
  const tokensMod = await import('@frame12/tokens');
  assert.equal(typeof tokensMod.cssText, 'string', 'cssText must be a string');
  assert.ok(tokensMod.cssText.includes('--f-ink:'), 'cssText must define --f-ink');
  assert.ok(tokensMod.cssText.includes('--f-stroke: 2.5px;'), 'cssText must define --f-stroke');
  assert.equal(tokensMod.tokens.light.ink, '#121212');
  assert.equal(tokensMod.tokens.dark.sheet, '#050505');
  const cssUrl = import.meta.resolve('@frame12/tokens/tokens.css');
  const jsonUrl = import.meta.resolve('@frame12/tokens/tokens.json');
  assert.ok(fs.existsSync(fileURLToPath(cssUrl)), 'tokens.css subpath export must resolve');
  assert.ok(fs.existsSync(fileURLToPath(jsonUrl)), 'tokens.json subpath export must resolve');
  results.tokens = { cssBytes: tokensMod.cssText.length, lightInk: tokensMod.tokens.light.ink };
}

if (present.includes('@frame12/lint')) {
  const lintMod = await import('@frame12/lint');
  assert.equal(typeof lintMod.lintHtml, 'function', '@frame12/lint must export lintHtml');
  const cleanHtml = '<!doctype html><html data-theme="light"><body><div class="f12-sheet"><div class="f12-panel"><span class="f12-cut">C-01</span></div></div></body></html>';
  const cleanRes = await lintMod.lintHtml(cleanHtml);
  assert.ok(Array.isArray(cleanRes), 'lintHtml must return an array of violations');
  assert.equal(cleanRes.length, 0, 'clean sample HTML must produce 0 violations');
  const dirtyHtml = '<!doctype html><html data-theme="light"><body><div class="f12-sheet"><div class="f12-panel" style="color: #ff0055"><span class="f12-cut">C-01</span></div></div></body></html>';
  const dirtyRes = await lintMod.lintHtml(dirtyHtml);
  assert.ok(
    Array.isArray(dirtyRes) && dirtyRes.some((v) => v && v.rule === 'color-literal'),
    'dirty sample HTML with hardcoded hex color must trigger color-literal',
  );
  results.lint = { ok: true, cleanViolations: cleanRes.length, dirtyRules: dirtyRes.map((v) => v.rule) };
}

if (present.includes('@frame12/terminal')) {
  // Core and ./testing must work with no React or Ink installed (this project has none).
  const term = await import('@frame12/terminal');
  const testing = await import('@frame12/terminal/testing');
  let events = 0;
  for (const f of testing.fixtures()) {
    const stream = term.createStreamValidator();
    for (const ev of f.events) {
      const r = stream.push(ev);
      assert.ok(r.ok, '@frame12/terminal fixture ' + f.name + ' event ' + ev.seq + ' must validate');
      events++;
    }
    assert.ok(term.validateSnapshot(f.snapshot).ok, '@frame12/terminal fixture ' + f.name + ' snapshot must validate');
  }
  const unknown = term.validateEvent({ ...testing.fixture('success').events[0], type: 'from-the-future' });
  assert.ok(!unknown.ok && unknown.ignorable, 'unknown event types must be ignorable');
  const caps = term.detectCapabilities({ NO_COLOR: '1' }, { stdout: { isTTY: false } }, []);
  assert.equal(caps.colorLevel, 0, 'NO_COLOR must disable color');
  const clean = term.sanitizeText('a\u001b]52;c;ZXZpbA==\u0007b\u202e');
  assert.equal(clean, 'ab\\\\u{202e}', 'the sanitizer must remove OSC 52 and show bidi controls');
  const schemaPath = fileURLToPath(import.meta.resolve('@frame12/terminal/schema.json'));
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  assert.equal(schema.oneOf.length, term.EVENT_TYPES.length, 'schema.json must list every event type');
  let renderBytes = 0;
  if (fs.existsSync(fileURLToPath(new URL('./render/index.js', import.meta.resolve('@frame12/terminal'))))) {
    // ./render without React: run the gallery fixture through every linear renderer.
    const render = await import('@frame12/terminal/render');
    const snap = testing.fixture('forty-findings').snapshot;
    const rich = render.renderRich(snap, { style: 'truecolor', unicode: true, ambiguousWide: false, links: false, columns: 80 });
    assert.ok(rich.includes('FINDINGS') && rich.includes('pair-001'), './render must render the gallery fixture');
    assert.deepEqual(JSON.parse(render.renderJson(snap)), snap, 'renderJson must round-trip');
    assert.ok(!render.renderPlain(snap).includes('\\u001b'), 'renderPlain must not emit escape sequences');
    renderBytes = rich.length;
  }
  results.terminal = { fixtures: testing.FIXTURE_NAMES.length, events, schemaEvents: schema.oneOf.length, renderBytes };
}

if (present.includes('@frame12/static')) {
  // document() must not touch the filesystem at runtime. Import the package (module loading reads
  // files), then make every public node:fs entry point throw before rendering anything.
  const staticMod = await import('@frame12/static');
  const fsMod = await import('node:fs');
  const { syncBuiltinESMExports } = await import('node:module');
  const blocked = [];
  for (const key of ['readFileSync', 'readFile', 'openSync', 'open', 'statSync', 'existsSync', 'readdirSync', 'createReadStream']) {
    if (typeof fsMod.default[key] === 'function') {
      fsMod.default[key] = () => { blocked.push(key); throw new Error('fs.' + key + ' is not available'); };
    }
  }
  for (const key of ['readFile', 'open', 'stat', 'readdir']) {
    if (fsMod.default.promises && typeof fsMod.default.promises[key] === 'function') {
      fsMod.default.promises[key] = async () => { blocked.push('promises.' + key); throw new Error('fs.promises.' + key + ' is not available'); };
    }
  }
  syncBuiltinESMExports();
  const expected = ['document', 'sheet', 'scene', 'sceneArea', 'panel', 'panelPair', 'balloon', 'tag', 'badge', 'metric', 'toneBarList', 'ghostWire', 'receipt', 'receiptList', 'fragment', 'unsafeRaw', 'escapeHtml', 'safeUrl', 'isHtml', 'toIdent', 'dedupeIds', 'fmtPct', 'fmtPPAbs', 'fmtMoney'];
  for (const name of expected) assert.equal(typeof staticMod[name], 'function', '@frame12/static must export ' + name + '()');
  assert.equal(typeof staticMod.staticCss, 'string', '@frame12/static must export staticCss');
  const body = staticMod.sheet({
    autoCut: true,
    children: staticMod.fragment(
      staticMod.panel({ label: 'Smoke', children: staticMod.metric({ label: 'Recovered', value: 42000 }) }),
      staticMod.panel({ children: staticMod.receiptList({ items: [{ kind: 'link', value: 'x', href: 'javascript:alert(1)' }] }) }),
    ),
  });
  const docObj = staticMod.document({ title: 'Standalone <Smoke>', body });
  assert.ok(staticMod.isHtml(docObj) && typeof docObj === 'object', 'document() must return an Html object');
  const docHtml = String(docObj);
  assert.ok(!staticMod.isHtml(docHtml), 'a string equal to rendered markup must not be trusted');
  assert.ok(docHtml.startsWith('<!doctype html>'), 'document() must return an HTML document');
  assert.ok(docHtml.includes('<style data-f12-tokens>') && docHtml.includes('<style data-f12-static>'), 'document() must inline tokens + static CSS');
  assert.ok(docHtml.includes('Standalone &lt;Smoke&gt;') && !docHtml.includes('javascript:'), 'document() must escape text and drop unsafe hrefs');
  assert.ok(!/<script/i.test(docHtml), 'document() must not emit scripts');
  assert.equal(blocked.length, 0, 'document() must not read the filesystem (called: ' + blocked.join(', ') + ')');
  const cssUrl = import.meta.resolve('@frame12/static/static.css');
  assert.ok(cssUrl.endsWith('/dist/static.css'), './static.css export must resolve');
  results.static = { docBytes: docHtml.length, exports: expected.length, cssUrl: cssUrl.split('/').slice(-2).join('/') };
}

process.stdout.write(JSON.stringify({ verified: present, results }));
`,
    );

    const verifyOut = execFileSync(process.execPath, [verifyScriptPath], {
      cwd: consumerDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const parsed = JSON.parse(verifyOut);

    // `.d.ts` resolution: compile a consumer against the installed tarballs with the repo's
    // TypeScript (the consumer itself has no dependencies besides the @frame12 packages).
    if (installedNames.has('@frame12/static')) {
      const tscPath = path.join(rootDir, 'node_modules/typescript/bin/tsc');
      const realTsc = fs.existsSync(tscPath) ? tscPath : path.join(DEFAULT_REPO_ROOT, 'node_modules/typescript/bin/tsc');
      fs.writeFileSync(
        path.join(consumerDir, 'types-check.ts'),
        `import { document, sheet, panel, metric, fragment, receiptList, type Html, type PanelOpts, type ReceiptOpts } from '@frame12/static';
import { cssText } from '@frame12/tokens';
const items: ReceiptOpts[] = [{ kind: 'commit', value: 'abc1234' }];
const opts: PanelOpts = { cut: false, shape: 'slant-top', children: 'x' };
const body: Html = sheet({ autoCut: true, children: fragment(panel(opts), metric({ label: 'L', value: 1 }), receiptList({ items })) });
const page: string = String(document({ title: 't', body, theme: 'dark' }));
// @ts-expect-error: Html is an object, not a string (use String(html))
const notAString: string = document({ title: 't', body });
// @ts-expect-error: a plain string is not Html (only renderers, fragment() and unsafeRaw() make Html)
const forged: Html = '<b>x</b>';
// @ts-expect-error: body must be Html, not a plain string
document({ title: 't', body: '<p>x</p>' });
export const out = page.length + cssText.length + String(notAString).length + String(forged).length;
`,
      );
      fs.writeFileSync(
        path.join(consumerDir, 'tsconfig.json'),
        JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, noEmit: true, types: [], lib: ['ES2022'] }, files: ['types-check.ts'] }, null, 2),
      );
      execFileSync(process.execPath, [realTsc, '-p', path.join(consumerDir, 'tsconfig.json')], { cwd: consumerDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      parsed.results.static = { ...parsed.results.static, typesResolve: true };
    }

    if (installedNames.has('@frame12/terminal')) {
      const tscPath = path.join(rootDir, 'node_modules/typescript/bin/tsc');
      const realTsc = fs.existsSync(tscPath) ? tscPath : path.join(DEFAULT_REPO_ROOT, 'node_modules/typescript/bin/tsc');
      fs.writeFileSync(
        path.join(consumerDir, 'terminal-types-check.ts'),
        `import { createStreamValidator, detectCapabilities, type Capabilities, type TerminalEvent } from '@frame12/terminal';
import { fixture } from '@frame12/terminal/testing';
const caps: Capabilities = detectCapabilities({}, { stdout: { isTTY: false } }, []);
const events: TerminalEvent[] = fixture('success').events;
const v = createStreamValidator();
for (const e of events) v.push(e);
// @ts-expect-error: unknown event types are not part of the contract
const bad: TerminalEvent = { ...events[0]!, type: 'from-the-future' };
export const out = [caps.columns, bad];
`,
      );
      fs.writeFileSync(
        path.join(consumerDir, 'tsconfig.terminal.json'),
        JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, noEmit: true, types: [], lib: ['ES2022'] }, files: ['terminal-types-check.ts'] }, null, 2),
      );
      execFileSync(process.execPath, [realTsc, '-p', path.join(consumerDir, 'tsconfig.terminal.json')], { cwd: consumerDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      parsed.results.terminal = { ...parsed.results.terminal, typesResolve: true };
    }

    // ./ink: a second, separate consumer with the peers a live view needs (ink, react) and
    // ink-testing-library, at the exact versions the package is developed against.
    const terminalTarball = tarballs.find((t) => t.pkg.name === '@frame12/terminal');
    if (terminalTarball && options.ink !== false && fs.existsSync(path.join(terminalTarball.pkg.dir, 'dist/ink/index.js'))) {
      parsed.results.terminalInk = runTerminalInkSmoke(tmpRoot, tarballs, terminalTarball.pkg);
    }

    if (!options.silent) {
      console.log(
        `PASS  standalone package smoke test (${parsed.verified.join(', ')}): packed, installed with zero external deps, and verified exports  ${JSON.stringify(parsed.results)}`,
      );
    }

    return {
      tarballs: tarballs.map((t) => ({
        name: t.pkg.name,
        version: t.pkg.version,
        filename: t.filename,
      })),
      verified: parsed.verified,
      results: parsed.results,
    };
  } finally {
    if (!process.env.F12_SMOKE_KEEP) {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  }
}

/**
 * `@frame12/terminal/ink` in a project that installs its optional peers: ink@8 and react@19.3 (the
 * versions in the package's devDependencies), plus ink-testing-library to render one frame of the
 * live view without a terminal. Exactly one copy of React may be installed (`npm ls react`).
 * The registry is needed for the three peers; the @frame12 packages come from the tarballs.
 */
export function runTerminalInkSmoke(tmpRoot, tarballs, terminalPkg) {
  const dev = terminalPkg.pkgJson.devDependencies ?? {};
  const peers = ['ink', 'react', 'ink-testing-library'].map((name) => {
    if (!dev[name]) throw new Error(`@frame12/terminal must pin ${name} in devDependencies for the ./ink smoke test`);
    return `${name}@${dev[name]}`;
  });
  const dir = path.join(tmpRoot, 'consumer-ink');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'frame12-terminal-ink-consumer', private: true, version: '0.0.0', type: 'module' }, null, 2) + '\n',
  );
  execFileSync(
    'npm',
    ['install', '--no-audit', '--no-fund', '--ignore-scripts', ...tarballs.map((t) => t.tgzPath), ...peers],
    { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const ls = JSON.parse(
    execFileSync('npm', ['ls', 'react', '--all', '--json'], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }),
  );
  const reactVersions = new Set();
  (function walk(node) {
    for (const [name, child] of Object.entries(node.dependencies ?? {})) {
      if (name === 'react' && child.version) reactVersions.add(child.version);
      walk(child);
    }
  })(ls);
  if (reactVersions.size !== 1) {
    throw new Error(`./ink consumer must resolve exactly one React, found: ${[...reactVersions].join(', ') || 'none'}`);
  }
  // Physical copies too: deduped entries share one folder, a nested node_modules/react would not.
  const copies = [];
  (function find(nm) {
    if (!fs.existsSync(nm)) return;
    for (const e of fs.readdirSync(nm)) {
      if (e.startsWith('.')) continue;
      const scoped = e.startsWith('@') ? fs.readdirSync(path.join(nm, e)).map((x) => path.join(e, x)) : [e];
      for (const name of scoped) {
        if (name === 'react') copies.push(path.join(nm, name));
        find(path.join(nm, name, 'node_modules'));
      }
    }
  })(path.join(dir, 'node_modules'));
  if (copies.length !== 1) throw new Error(`./ink consumer has ${copies.length} copies of react on disk: ${copies.join(', ')}`);

  const script = path.join(dir, 'verify-ink.mjs');
  fs.writeFileSync(
    script,
    `import assert from 'node:assert/strict';
import * as React from 'react';
import { render } from 'ink-testing-library';
import { createDirector, stripAnsi } from '@frame12/terminal';
import { Storyboard } from '@frame12/terminal/ink';
import { fixture } from '@frame12/terminal/testing';

const director = createDirector({ caps: { interactive: true }, motion: 'still' });
for (const ev of fixture('success').events) director.push(ev);
director.flush();
const rc = { style: 'none', unicode: true, ambiguousWide: false, links: false, columns: 80 };
const app = render(React.createElement(Storyboard, { director, rc, rows: 30, onQuit() {}, onInterrupt() {} }));
await new Promise((r) => setTimeout(r, 50));
const frame = stripAnsi(app.lastFrame() ?? '');
app.unmount();
assert.match(frame, /FINDINGS 3/, 'the live view must list the fixture findings');
assert.match(frame, /C-01 · RESOLVE WORKSPACE/, 'completed cuts must be written');
process.stdout.write(JSON.stringify({ frameLines: frame.split('\\n').length }));
`,
  );
  const out = JSON.parse(execFileSync(process.execPath, [script], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  return { peers, react: [...reactVersions][0], reactCopies: copies.length, ...out };
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const syncDeps = process.argv.includes('--sync-deps');
  const runSmoke = process.argv.includes('--smoke');

  if (syncDeps) {
    const packages = discoverPublishablePackages(DEFAULT_REPO_ROOT);
    const versionMap = new Map(packages.map((p) => [p.name, p.version]));
    let totalChanges = 0;
    for (const pkg of packages) {
      const { pkgJson, changed, changes } = rewriteInternalDependencies(pkg.pkgJson, versionMap);
      if (changed) {
        fs.writeFileSync(path.join(pkg.dir, 'package.json'), JSON.stringify(pkgJson, null, 2) + '\n');
        totalChanges += changes.length;
        for (const c of changes) {
          console.log(`Updated ${pkg.relDir}/package.json: ${c.field}.${c.dep} "${c.from}" -> "${c.to}"`);
        }
      }
    }
    console.log(
      `Synchronized internal @frame12/* dependencies across ${packages.length} package(s) (${totalChanges} change(s)).`,
    );
  }

  const { packages, errors } = validatePackages(DEFAULT_REPO_ROOT);
  if (errors.length > 0) {
    console.error('FRAME/12 publishable package check failed:');
    for (const err of errors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }

  console.log(
    `FRAME/12 publishable package check passed (${packages.length} package(s) in release order: ${packages.map((p) => `${p.name}@${p.version}`).join(' -> ')}).`,
  );

  if (runSmoke) {
    runStandalonePackageSmokeTest(DEFAULT_REPO_ROOT);
  }
}
