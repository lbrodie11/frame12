#!/usr/bin/env node
/**
 * Release orchestration for publishable FRAME/12 packages under `packages/*`.
 *
 * Supports:
 *   - Tag parsing and validation (`<pkg>@<version>`, e.g. `tokens@0.2.0`)
 *   - Git tag-to-commit verification (`refs/tags/<tag>^{commit} == $GITHUB_SHA`)
 *   - Trusted-publishing environment guard (Node >= 22.14.0, npm >= 11.5.1)
 *   - Internal dependency publication verification on npm (`npm view <dep>@<ver> version`)
 *   - Dry-run release (`npm publish --dry-run` + `npm pack` tarball, SHA-256 digest & changelog artifact generation)
 *   - Pre-publish verification of the downloaded verified tarball and changelog extraction for GitHub Releases
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_REPO_ROOT,
  discoverPublishablePackages,
  extractPackageChangelog,
  validatePackages,
} from './check-packages.mjs';

const TAG_RE = /^([a-z0-9-]+)@(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/;

export function parseSemverTuple(ver) {
  const clean = String(ver || '')
    .trim()
    .replace(/^v/, '');
  const m = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(clean);
  if (!m) return null;
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    prerelease: m[4] || '',
    raw: clean,
  };
}

export function isVersionAtLeast(actual, minimum) {
  const a = parseSemverTuple(actual);
  const b = parseSemverTuple(minimum);
  if (!a || !b) return false;
  if (a.major !== b.major) return a.major > b.major;
  if (a.minor !== b.minor) return a.minor > b.minor;
  return a.patch >= b.patch;
}

/**
 * Parses a package release tag `<pkg>@<version>` (e.g. `tokens@0.2.0`).
 */
export function parseReleaseTag(rawTag) {
  const tag = String(rawTag || '')
    .trim()
    .replace(/^refs\/tags\//, '');
  const m = TAG_RE.exec(tag);
  if (!m) {
    throw new Error(
      `Invalid package release tag "${rawTag}". Expected "<pkg>@<version>" (for example "tokens@0.2.0").`,
    );
  }
  const shortName = m[1];
  const version = m[2];
  const parsedVer = parseSemverTuple(version);
  return {
    tag,
    shortName,
    pkgName: `@frame12/${shortName}`,
    version,
    prerelease: Boolean(parsedVer?.prerelease),
  };
}

/**
 * Verifies that the runner meets npm OIDC trusted-publishing requirements:
 * Node.js >= 22.14.0 and npm >= 11.5.1.
 */
export function checkPublishEnvironment(options = {}) {
  const nodeVersion = (options.nodeVersion || process.versions.node || '').replace(/^v/, '');
  let npmVersion = options.npmVersion;
  if (!npmVersion) {
    npmVersion = execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim();
  }

  const errors = [];
  if (!isVersionAtLeast(nodeVersion, '22.14.0')) {
    errors.push(
      `npm trusted publishing requires Node.js >= 22.14.0 (detected Node.js ${nodeVersion}). Configure the publish job with node-version: 24.`,
    );
  }
  if (!isVersionAtLeast(npmVersion, '11.5.1')) {
    errors.push(
      `npm trusted publishing with OIDC provenance requires npm >= 11.5.1 (detected npm ${npmVersion}). Upgrade npm in the publish job or use a Node 24 runner with npm >= 11.5.1.`,
    );
  }

  return {
    ok: errors.length === 0,
    nodeVersion,
    npmVersion,
    errors,
  };
}

/**
 * Verifies that a parsed `<pkg>@<version>` tag matches a discovered package under `packages/`
 * and that the tag's `<version>` equals `package.json` `version`.
 */
export function verifyTagMatchesPackage(rawTag, packages) {
  const parsed = parseReleaseTag(rawTag);
  const pkg = packages.find((p) => p.shortName === parsed.shortName);
  if (!pkg) {
    throw new Error(
      `Tag "${parsed.tag}" targets unknown package "${parsed.shortName}". Discovered publishable packages: ${packages.map((p) => p.shortName).join(', ')}`,
    );
  }
  if (pkg.version !== parsed.version) {
    throw new Error(
      `Tag "${parsed.tag}" version "${parsed.version}" does not match ${pkg.relDir}/package.json version "${pkg.version}".`,
    );
  }
  return { parsed, pkg };
}

function defaultResolveGitTagCommit(tag, rootDir = DEFAULT_REPO_ROOT) {
  try {
    return execFileSync('git', ['rev-parse', '--verify', `refs/tags/${tag}^{commit}`], {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Verifies that `refs/tags/<tag>` exists in git and resolves to `expectedSha`.
 * Prevents a manual workflow_dispatch (with dry_run: false) from publishing an arbitrary
 * untagged branch commit or failing halfway through at `gh release create --verify-tag`.
 */
export function verifyTagCommit(rawTag, expectedSha, options = {}) {
  const { parsed } = { parsed: parseReleaseTag(rawTag) };
  const rootDir = options.rootDir || DEFAULT_REPO_ROOT;
  const resolveTagCommit = options.resolveGitTagCommit || defaultResolveGitTagCommit;
  const cleanExpected = String(expectedSha || '').trim();
  if (!cleanExpected) {
    throw new Error(
      `Cannot verify git tag "${parsed.tag}" without an expected commit SHA (--sha or GITHUB_SHA).`,
    );
  }
  const tagCommit = resolveTagCommit(parsed.tag, rootDir);
  if (!tagCommit) {
    throw new Error(
      `Git tag "refs/tags/${parsed.tag}" does not exist. Non-dry-run releases must be triggered from an existing git tag pointing to the target commit.`,
    );
  }
  if (tagCommit !== cleanExpected) {
    throw new Error(
      `Git tag "${parsed.tag}" points to commit ${tagCommit}, which does not match expected commit ${cleanExpected}.`,
    );
  }
  return { tag: parsed.tag, commit: tagCommit };
}

function defaultQueryNpmVersion(pkgName, version) {
  try {
    const out = execFileSync('npm', ['view', `${pkgName}@${version}`, 'version', '--json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
    if (!out) return false;
    const parsed = JSON.parse(out);
    return parsed === version || (Array.isArray(parsed) && parsed.includes(version));
  } catch {
    return false;
  }
}

/**
 * Verifies that every internal `@frame12/*` dependency of `pkgInfo` already exists at that exact
 * version on the npm registry.
 */
export function verifyNpmInternalDependencies(pkgInfo, options = {}) {
  const { dryRun = false, queryNpmVersion = defaultQueryNpmVersion } = options;
  const statuses = [];
  const deps = pkgInfo.pkgJson.dependencies || {};
  for (const [depName, depVersion] of Object.entries(deps)) {
    if (!depName.startsWith('@frame12/')) continue;
    const publishedOnNpm = Boolean(queryNpmVersion(depName, depVersion));
    if (!publishedOnNpm && !dryRun) {
      const depShort = depName.slice('@frame12/'.length);
      throw new Error(
        `Internal dependency ${depName}@${depVersion} is not published on npm yet. Release packages in topological dependency order (tag "${depShort}@${depVersion}" before "${pkgInfo.shortName}@${pkgInfo.version}").`,
      );
    }
    statuses.push({
      dependency: depName,
      version: depVersion,
      publishedOnNpm,
      mode: dryRun ? 'dry-run' : 'publish',
    });
  }
  return statuses;
}

export function computeFileSha256(filePath) {
  const buf = fs.readFileSync(filePath);
  return createHash('sha256').update(buf).digest('hex');
}

/**
 * Verifies that a downloaded tarball in `artifactDir` matches the `release-manifest.json`
 * generated by the `verify` job (including SHA-256 integrity check).
 */
export function verifyVerifiedArtifact(pkgInfo, artifactDir) {
  const resolvedDir = path.resolve(artifactDir);
  const manifestPath = path.join(resolvedDir, 'release-manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Missing release-manifest.json in verified artifact directory ${resolvedDir}`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const entry = (manifest.packages || []).find(
    (item) => item.name === pkgInfo.name && item.version === pkgInfo.version,
  );
  if (!entry) {
    throw new Error(
      `Verified release-manifest.json in ${resolvedDir} does not contain an entry for ${pkgInfo.name}@${pkgInfo.version}`,
    );
  }
  const expectedTarball = `frame12-${pkgInfo.shortName}-${pkgInfo.version}.tgz`;
  if (entry.tarball !== expectedTarball) {
    throw new Error(
      `Manifest tarball name "${entry.tarball}" does not match expected "${expectedTarball}"`,
    );
  }
  const tarballPath = path.join(resolvedDir, entry.tarball);
  if (!fs.existsSync(tarballPath)) {
    throw new Error(`Verified tarball missing at ${tarballPath}`);
  }
  if (typeof entry.sha256 !== 'string' || !/^[0-9a-f]{64}$/i.test(entry.sha256)) {
    throw new Error(
      `Verified release-manifest.json entry for ${entry.tarball} is missing a valid 64-character hex sha256 digest`,
    );
  }
  const actualSha256 = computeFileSha256(tarballPath);
  if (actualSha256 !== entry.sha256.toLowerCase()) {
    throw new Error(
      `Verified tarball SHA-256 mismatch for ${entry.tarball}: expected ${entry.sha256}, got ${actualSha256}`,
    );
  }
  return { tarballPath, tarball: entry.tarball, sha256: actualSha256, entry };
}

/**
 * Runs a dry-run release (`npm publish --dry-run` + `npm pack`) for target package(s) and writes
 * `.tgz` tarballs, SHA-256 digests, extracted changelog notes, and `release-manifest.json` to `outDir`.
 */
export function runDryRunRelease(options = {}) {
  const rootDir = options.rootDir || DEFAULT_REPO_ROOT;
  const outDir = path.resolve(options.outDir || path.join(rootDir, '.release-dry-run'));
  const targetPackage = options.package || 'all';
  const targetTag = options.tag || '';
  const queryNpmVersion = options.queryNpmVersion;

  const { packages, errors } = validatePackages(rootDir);
  if (errors.length > 0) {
    throw new Error(`Package validation failed:\n  - ${errors.join('\n  - ')}`);
  }

  let selected = packages;
  if (targetTag) {
    const { pkg } = verifyTagMatchesPackage(targetTag, packages);
    selected = [pkg];
  } else if (targetPackage && targetPackage !== 'all') {
    const cleanShort = targetPackage.replace(/^@frame12\//, '');
    const pkg = packages.find((p) => p.shortName === cleanShort);
    if (!pkg) {
      throw new Error(
        `Unknown package "${targetPackage}". Discovered publishable packages: ${packages.map((p) => p.shortName).join(', ')}`,
      );
    }
    selected = [pkg];
  }

  fs.mkdirSync(outDir, { recursive: true });
  const manifestItems = [];

  for (const pkg of selected) {
    const tag = `${pkg.shortName}@${pkg.version}`;
    const internalDepStatuses = verifyNpmInternalDependencies(pkg, {
      dryRun: true,
      queryNpmVersion,
    });

    // 1. Verify `npm publish --dry-run` succeeds
    execFileSync('npm', ['publish', '--dry-run'], {
      cwd: pkg.dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // 2. Pack the exact tarball into outDir
    const packRaw = execFileSync('npm', ['pack', '--pack-destination', outDir, '--json'], {
      cwd: pkg.dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const packInfo = JSON.parse(packRaw)[0];
    const tarballName = packInfo.filename;
    const tarballPath = path.join(outDir, tarballName);
    if (!fs.existsSync(tarballPath)) {
      throw new Error(`Expected packed tarball missing at ${tarballPath}`);
    }
    const sha256 = computeFileSha256(tarballPath);

    // 3. Extract changelog section for the version
    const changelogMd = fs.readFileSync(path.join(pkg.dir, 'CHANGELOG.md'), 'utf8');
    const releaseNotes = extractPackageChangelog(changelogMd, pkg.version);
    const notesFilename = `${pkg.shortName}-${pkg.version}-notes.md`;
    fs.writeFileSync(path.join(outDir, notesFilename), `${releaseNotes}\n`);

    manifestItems.push({
      shortName: pkg.shortName,
      name: pkg.name,
      version: pkg.version,
      tag,
      directory: pkg.relDir,
      tarball: tarballName,
      sha256,
      tarballSize: packInfo.size,
      unpackedSize: packInfo.unpackedSize,
      fileCount: (packInfo.files || []).length,
      files: (packInfo.files || []).map((f) => f.path).sort(),
      notesFile: notesFilename,
      internalDependencies: internalDepStatuses,
    });
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    releaseOrder: packages.map((p) => `${p.shortName}@${p.version}`),
    packages: manifestItems,
  };
  const manifestPath = path.join(outDir, 'release-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

  return { outDir, manifestPath, manifest };
}

function getArgValue(args, flag, fallback = '') {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return fallback;
  const val = args[idx + 1];
  if (val === '' || val.startsWith('--')) return fallback;
  return val;
}

function writeGithubOutputs(kv) {
  const outPath = process.env.GITHUB_OUTPUT;
  if (!outPath) return;
  const lines = Object.entries(kv).map(([k, v]) => `${k}=${String(v ?? '')}`);
  fs.appendFileSync(outPath, lines.join('\n') + '\n');
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const args = process.argv.slice(2);
  const rootDir = getArgValue(args, '--root-dir', DEFAULT_REPO_ROOT);

  try {
    if (args.includes('--check-env')) {
      const envRes = checkPublishEnvironment();
      if (!envRes.ok) {
        for (const err of envRes.errors) {
          console.error(`Error: ${err}`);
        }
        process.exit(1);
      }
      console.log(
        `PASS  Trusted-publishing environment verified (Node.js ${envRes.nodeVersion} >= 22.14.0, npm ${envRes.npmVersion} >= 11.5.1).`,
      );
      process.exit(0);
    }

    if (args.includes('--resolve')) {
      const eventName = getArgValue(args, '--event', process.env.GITHUB_EVENT_NAME || 'workflow_dispatch');
      const refName = getArgValue(args, '--ref-name', process.env.GITHUB_REF_NAME || '');
      const expectedSha = getArgValue(args, '--sha', process.env.GITHUB_SHA || '');
      const inputPkg = getArgValue(args, '--input-package', 'all');
      const inputTag = getArgValue(args, '--input-tag', '');
      const inputDryRun = getArgValue(args, '--input-dry-run', 'true');

      const packages = discoverPublishablePackages(rootDir);
      const isTagPush = eventName === 'push';
      const dryRun = isTagPush ? false : inputDryRun !== 'false';

      if (!dryRun) {
        const effectiveTag = isTagPush ? refName : inputTag;
        if (!effectiveTag) {
          throw new Error('A package tag (<pkg>@<version>) is required when dry_run is false.');
        }
        const { parsed, pkg } = verifyTagMatchesPackage(effectiveTag, packages);
        verifyTagCommit(parsed.tag, expectedSha, { rootDir });
        const outputs = {
          dry_run: 'false',
          tag: parsed.tag,
          package: pkg.shortName,
          pkg_name: pkg.name,
          pkg_dir: pkg.relDir,
          version: pkg.version,
          tarball: `frame12-${pkg.shortName}-${pkg.version}.tgz`,
          notes_file: `${pkg.shortName}-${pkg.version}-notes.md`,
          prerelease: parsed.prerelease ? 'true' : 'false',
          release_title: `${pkg.name} v${pkg.version}`,
        };
        writeGithubOutputs(outputs);
        console.log(
          `Resolved release target: ${pkg.name}@${pkg.version} (tag=${parsed.tag}, dir=${pkg.relDir}, tarball=${outputs.tarball}, dry_run=false)`,
        );
        process.exit(0);
      }

      // dry_run === true
      if (inputTag) {
        const { parsed, pkg } = verifyTagMatchesPackage(inputTag, packages);
        writeGithubOutputs({
          dry_run: 'true',
          tag: parsed.tag,
          package: pkg.shortName,
          pkg_name: pkg.name,
          pkg_dir: pkg.relDir,
          version: pkg.version,
          tarball: `frame12-${pkg.shortName}-${pkg.version}.tgz`,
          notes_file: `${pkg.shortName}-${pkg.version}-notes.md`,
          prerelease: parsed.prerelease ? 'true' : 'false',
          release_title: `${pkg.name} v${pkg.version}`,
        });
        console.log(`Resolved dry-run target from tag: ${parsed.tag} (${pkg.relDir})`);
      } else {
        const targetPkg = inputPkg || 'all';
        if (targetPkg !== 'all') {
          const clean = targetPkg.replace(/^@frame12\//, '');
          const found = packages.find((p) => p.shortName === clean);
          if (!found) {
            throw new Error(
              `Unknown package "${targetPkg}". Available packages: ${packages.map((p) => p.shortName).join(', ')}`,
            );
          }
        }
        writeGithubOutputs({
          dry_run: 'true',
          tag: '',
          package: targetPkg,
          pkg_name: '',
          pkg_dir: '',
          version: '',
          tarball: '',
          notes_file: '',
          prerelease: 'false',
          release_title: '',
        });
        console.log(
          `Resolved dry-run target package(s): ${targetPkg === 'all' ? packages.map((p) => `${p.shortName}@${p.version}`).join(' -> ') : targetPkg}`,
        );
      }
      process.exit(0);
    }

    if (args.includes('--verify-publish')) {
      const rawTag = getArgValue(args, '--tag', '');
      const expectedSha = getArgValue(args, '--sha', process.env.GITHUB_SHA || '');
      const artifactDir = getArgValue(args, '--artifact-dir', '');
      const notesOut = getArgValue(args, '--notes-out', '');
      const { packages, errors } = validatePackages(rootDir, {
        runNpmPackCheck: !artifactDir,
        requireBuiltFiles: !artifactDir,
      });
      if (errors.length > 0) {
        throw new Error(`Package validation failed:\n  - ${errors.join('\n  - ')}`);
      }
      const { parsed, pkg } = verifyTagMatchesPackage(rawTag, packages);
      verifyTagCommit(parsed.tag, expectedSha, { rootDir });
      verifyNpmInternalDependencies(pkg, { dryRun: false });
      if (!artifactDir) {
        throw new Error(
          '--verify-publish requires --artifact-dir <dir> pointing to the verified release artifacts.',
        );
      }
      verifyVerifiedArtifact(pkg, artifactDir);
      const changelogMd = fs.readFileSync(path.join(pkg.dir, 'CHANGELOG.md'), 'utf8');
      const notes = extractPackageChangelog(changelogMd, pkg.version);
      if (!notes) {
        throw new Error(`Missing changelog section for ${pkg.version} in ${pkg.relDir}/CHANGELOG.md`);
      }
      if (notesOut) {
        fs.mkdirSync(path.dirname(path.resolve(notesOut)), { recursive: true });
        fs.writeFileSync(path.resolve(notesOut), `${notes}\n`);
      }
      console.log(
        `PASS  Pre-publish checks passed for ${pkg.name}@${pkg.version} (tag ${parsed.tag} matches package.json${expectedSha ? ' and git commit SHA' : ''}${artifactDir ? ', verified tarball SHA-256 matches manifest' : ''}, internal dependencies verified on npm, changelog extracted).`,
      );
      process.exit(0);
    }

    if (args.includes('--dry-run')) {
      const outDir = getArgValue(args, '--out-dir', path.join(rootDir, '.release-dry-run'));
      const targetPackage = getArgValue(args, '--package', 'all');
      const targetTag = getArgValue(args, '--tag', '');
      const { manifestPath, manifest } = runDryRunRelease({
        rootDir,
        outDir,
        package: targetPackage,
        tag: targetTag,
      });
      console.log(
        `PASS  Dry-run release succeeded for ${manifest.packages.length} package(s) -> ${outDir}`,
      );
      for (const item of manifest.packages) {
        console.log(
          `  - ${item.name}@${item.version} (tag: ${item.tag}) -> ${item.tarball} (${item.tarballSize} bytes, sha256:${item.sha256.slice(0, 12)}…, ${item.fileCount} files: ${item.files.join(', ')}) + ${item.notesFile}`,
        );
      }
      console.log(`  - Manifest: ${manifestPath}`);
      process.exit(0);
    }

    console.error(
      'Usage: node scripts/release-packages.mjs [--resolve | --check-env | --dry-run --out-dir <dir> | --verify-publish --tag <pkg>@<ver> [--sha <sha>] [--artifact-dir <dir>]]',
    );
    process.exit(1);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}
