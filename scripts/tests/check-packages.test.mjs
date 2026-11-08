#!/usr/bin/env node
/**
 * Unit and integration tests for `scripts/check-packages.mjs` and `scripts/release-packages.mjs`:
 *   1. Good and bad fixture `package.json` validation (`validateSinglePackage` / `validatePackages`).
 *   2. Internal dependency-rewrite logic (`rewriteInternalDependencies`).
 *   3. Dynamic discovery of new `packages/<name>` entries in topological order without workflow edits.
 *   4. Dry-run release (`runDryRunRelease`) and standalone tarball install smoke test (`runStandalonePackageSmokeTest`)
 *      across `@frame12/tokens`, `@frame12/lint` (`lintHtml`), and `@frame12/static` (`document`, `renderCard`).
 *   5. Release tag validation, npm/Node version guard (`>= 11.5.1` / `>= 22.14.0`), and npm dependency order checks.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_REPO_ROOT,
  discoverPublishablePackages,
  extractPackageChangelog,
  rewriteInternalDependencies,
  runStandalonePackageSmokeTest,
  validatePackages,
  validateSinglePackage,
} from '../check-packages.mjs';
import {
  checkPublishEnvironment,
  parseReleaseTag,
  runDryRunRelease,
  verifyNpmInternalDependencies,
  verifyTagCommit,
  verifyTagMatchesPackage,
  verifyVerifiedArtifact,
} from '../release-packages.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');

let failures = 0;
function check(ok, label, detail = '') {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`);
}

function makeValidTokensPkgJson(overrides = {}) {
  return {
    name: '@frame12/tokens',
    version: '0.2.0',
    description: 'FRAME/12 design tokens',
    license: 'MIT',
    type: 'module',
    main: './dist/index.js',
    types: './dist/index.d.ts',
    exports: {
      '.': {
        types: './dist/index.d.ts',
        default: './dist/index.js',
      },
      './tokens.css': './dist/tokens.css',
      './package.json': './package.json',
    },
    files: ['dist'],
    repository: {
      type: 'git',
      url: 'https://github.com/lbrodie11/frame12.git',
      directory: 'packages/tokens',
    },
    ...overrides,
  };
}

// 1. Validate real repository packages/
{
  const { packages, errors } = validatePackages(DEFAULT_REPO_ROOT);
  check(
    errors.length === 0 &&
      packages.length >= 1 &&
      packages[0].name === '@frame12/tokens' &&
      packages[0].version === '0.2.0',
    'real repository packages/ passes validatePackages() with @frame12/tokens@0.2.0',
    errors.length > 0 ? errors.join('; ') : packages.map((p) => `${p.name}@${p.version}`).join(', '),
  );
}

// 2. Fixture package.json validation (good and bad fixtures)
{
  const wsMap = new Map([
    ['@frame12/tokens', { shortName: 'tokens', name: '@frame12/tokens', version: '0.2.0' }],
    ['@frame12/lint', { shortName: 'lint', name: '@frame12/lint', version: '0.2.0' }],
    ['@frame12/static', { shortName: 'static', name: '@frame12/static', version: '0.2.0' }],
  ]);

  // 2a. Good fixtures: tokens, lint (with optional typescript peer), and static (with exact @frame12/tokens dep)
  const goodTokensErrors = validateSinglePackage(
    {
      shortName: 'tokens',
      dir: null,
      relDir: 'packages/tokens',
      pkgJson: makeValidTokensPkgJson(),
    },
    wsMap,
    { runNpmPackCheck: false },
  );

  const goodLintErrors = validateSinglePackage(
    {
      shortName: 'lint',
      dir: null,
      relDir: 'packages/lint',
      pkgJson: makeValidTokensPkgJson({
        name: '@frame12/lint',
        repository: {
          type: 'git',
          url: 'https://github.com/lbrodie11/frame12.git',
          directory: 'packages/lint',
        },
        peerDependencies: {
          typescript: '>=5.0.0',
        },
        peerDependenciesMeta: {
          typescript: { optional: true },
        },
      }),
    },
    wsMap,
    { runNpmPackCheck: false },
  );

  const goodStaticErrors = validateSinglePackage(
    {
      shortName: 'static',
      dir: null,
      relDir: 'packages/static',
      pkgJson: makeValidTokensPkgJson({
        name: '@frame12/static',
        repository: {
          type: 'git',
          url: 'https://github.com/lbrodie11/frame12.git',
          directory: 'packages/static',
        },
        dependencies: {
          '@frame12/tokens': '0.2.0',
        },
      }),
    },
    wsMap,
    { runNpmPackCheck: false },
  );

  check(
    goodTokensErrors.length === 0 && goodLintErrors.length === 0 && goodStaticErrors.length === 0,
    'check-packages good fixtures: @frame12/tokens, @frame12/lint (optional typescript peer), and @frame12/static (exact internal dep) pass with 0 errors',
    [...goodTokensErrors, ...goodLintErrors, ...goodStaticErrors].join('; '),
  );

  // 2b. Bad fixtures matrix
  const badCases = [
    {
      name: 'non-@frame12 scope',
      pkgInfo: {
        shortName: 'tokens',
        dir: null,
        relDir: 'packages/tokens',
        pkgJson: makeValidTokensPkgJson({ name: 'frame12-tokens' }),
      },
      expectedSubstring: '"name" must be under "@frame12/"',
    },
    {
      name: 'package name mismatches directory',
      pkgInfo: {
        shortName: 'tokens',
        dir: null,
        relDir: 'packages/tokens',
        pkgJson: makeValidTokensPkgJson({ name: '@frame12/other' }),
      },
      expectedSubstring: 'must match directory "packages/tokens"',
    },
    {
      name: 'workspace:* protocol in internal dependency',
      pkgInfo: {
        shortName: 'static',
        dir: null,
        relDir: 'packages/static',
        pkgJson: makeValidTokensPkgJson({
          name: '@frame12/static',
          repository: {
            type: 'git',
            url: 'https://github.com/lbrodie11/frame12.git',
            directory: 'packages/static',
          },
          dependencies: { '@frame12/tokens': 'workspace:*' },
        }),
      },
      expectedSubstring: 'uses forbidden "workspace:" protocol',
    },
    {
      name: 'caret range in internal dependency',
      pkgInfo: {
        shortName: 'static',
        dir: null,
        relDir: 'packages/static',
        pkgJson: makeValidTokensPkgJson({
          name: '@frame12/static',
          repository: {
            type: 'git',
            url: 'https://github.com/lbrodie11/frame12.git',
            directory: 'packages/static',
          },
          dependencies: { '@frame12/tokens': '^0.2.0' },
        }),
      },
      expectedSubstring: 'must equal exact workspace version "0.2.0"',
    },
    {
      name: 'stale version in internal dependency',
      pkgInfo: {
        shortName: 'static',
        dir: null,
        relDir: 'packages/static',
        pkgJson: makeValidTokensPkgJson({
          name: '@frame12/static',
          repository: {
            type: 'git',
            url: 'https://github.com/lbrodie11/frame12.git',
            directory: 'packages/static',
          },
          dependencies: { '@frame12/tokens': '0.1.0' },
        }),
      },
      expectedSubstring: 'must equal exact workspace version "0.2.0" (got "0.1.0")',
    },
    {
      name: 'external runtime dependency',
      pkgInfo: {
        shortName: 'tokens',
        dir: null,
        relDir: 'packages/tokens',
        pkgJson: makeValidTokensPkgJson({
          dependencies: { lodash: '4.17.21' },
        }),
      },
      expectedSubstring: 'external runtime dependency "lodash"',
    },
    {
      name: 'non-optional typescript peerDependency on @frame12/lint',
      pkgInfo: {
        shortName: 'lint',
        dir: null,
        relDir: 'packages/lint',
        pkgJson: makeValidTokensPkgJson({
          name: '@frame12/lint',
          repository: {
            type: 'git',
            url: 'https://github.com/lbrodie11/frame12.git',
            directory: 'packages/lint',
          },
          peerDependencies: { typescript: '>=5.0.0' },
        }),
      },
      expectedSubstring: 'peerDependenciesMeta.typescript.optional = true',
    },
    {
      name: 'peerDependency on non-lint package',
      pkgInfo: {
        shortName: 'tokens',
        dir: null,
        relDir: 'packages/tokens',
        pkgJson: makeValidTokensPkgJson({
          peerDependencies: { typescript: '>=5.0.0' },
          peerDependenciesMeta: { typescript: { optional: true } },
        }),
      },
      expectedSubstring: 'disallowed peerDependency "typescript"',
    },
    {
      name: 'files array includes src/',
      pkgInfo: {
        shortName: 'tokens',
        dir: null,
        relDir: 'packages/tokens',
        pkgJson: makeValidTokensPkgJson({
          files: ['dist', 'src'],
        }),
      },
      expectedSubstring: 'disallowed "files" entry "src"',
    },
    {
      name: 'exports target points outside dist/',
      pkgInfo: {
        shortName: 'tokens',
        dir: null,
        relDir: 'packages/tokens',
        pkgJson: makeValidTokensPkgJson({
          exports: { '.': './src/index.ts' },
        }),
      },
      expectedSubstring: 'must point inside "./dist/"',
    },
    {
      name: 'exports condition puts default before types',
      pkgInfo: {
        shortName: 'tokens',
        dir: null,
        relDir: 'packages/tokens',
        pkgJson: makeValidTokensPkgJson({
          exports: {
            '.': {
              default: './dist/index.js',
              types: './dist/index.d.ts',
            },
          },
        }),
      },
      expectedSubstring: '"types" condition must be the first key',
    },
    {
      name: 'non-MIT license',
      pkgInfo: {
        shortName: 'tokens',
        dir: null,
        relDir: 'packages/tokens',
        pkgJson: makeValidTokensPkgJson({ license: 'Apache-2.0' }),
      },
      expectedSubstring: '"license" must be "MIT"',
    },
    {
      name: 'missing repository.directory',
      pkgInfo: {
        shortName: 'tokens',
        dir: null,
        relDir: 'packages/tokens',
        pkgJson: makeValidTokensPkgJson({
          repository: { type: 'git', url: 'https://github.com/lbrodie11/frame12.git' },
        }),
      },
      expectedSubstring: '"repository.directory" must be "packages/tokens"',
    },
  ];

  const failedBadCases = [];
  for (const tc of badCases) {
    const errs = validateSinglePackage(tc.pkgInfo, wsMap, { runNpmPackCheck: false });
    if (!errs.some((e) => e.includes(tc.expectedSubstring))) {
      failedBadCases.push(`${tc.name} (got: ${JSON.stringify(errs)})`);
    }
  }

  check(
    failedBadCases.length === 0,
    `check-packages bad fixtures: all ${badCases.length} invalid package.json shapes are rejected with specific errors`,
    failedBadCases.join('; '),
  );
}

// 3. Dependency-rewrite logic (unit)
{
  const versions = new Map([
    ['@frame12/tokens', '0.2.0'],
    ['@frame12/lint', '0.3.1'],
  ]);

  const inputPkg = {
    name: '@frame12/static',
    version: '0.2.0',
    dependencies: {
      '@frame12/tokens': 'workspace:*',
    },
    peerDependencies: {
      '@frame12/lint': '^0.1.0',
      typescript: '>=5.0.0',
    },
    devDependencies: {
      esbuild: '^0.28.2',
    },
  };

  const rewritten = rewriteInternalDependencies(inputPkg, versions);
  const secondPass = rewriteInternalDependencies(rewritten.pkgJson, versions);

  let unknownThrew = false;
  try {
    rewriteInternalDependencies(
      {
        name: '@frame12/static',
        dependencies: { '@frame12/unknown': 'workspace:*' },
      },
      versions,
    );
  } catch (err) {
    unknownThrew = err.message.includes('unknown internal workspace package "@frame12/unknown"');
  }

  check(
    rewritten.changed === true &&
      rewritten.changes.length === 2 &&
      rewritten.pkgJson.dependencies['@frame12/tokens'] === '0.2.0' &&
      rewritten.pkgJson.peerDependencies['@frame12/lint'] === '0.3.1' &&
      rewritten.pkgJson.peerDependencies.typescript === '>=5.0.0' &&
      rewritten.pkgJson.devDependencies.esbuild === '^0.28.2' &&
      inputPkg.dependencies['@frame12/tokens'] === 'workspace:*' &&
      secondPass.changed === false &&
      secondPass.changes.length === 0 &&
      unknownThrew,
    'rewriteInternalDependencies unit: rewrites workspace:* and stale ranges to exact workspace versions, is idempotent, preserves non-@frame12 deps, and rejects unknown @frame12/* packages',
    JSON.stringify(rewritten.changes),
  );
}

// 4. Multi-package fixture workspace: proves new packages/ entries (lint, static) are picked up
// automatically in dependency order without workflow edits, pass validatePackages + runDryRunRelease,
// and pass the standalone zero-dependency tarball install smoke test (cssText, lintHtml, document, renderCard).
{
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'frame12-multi-pkg-fixture-'));
  try {
    // Deliberately list `packages/static` BEFORE `packages/tokens` in `workspaces` to prove topological ordering!
    fs.writeFileSync(
      path.join(fixtureRoot, 'package.json'),
      JSON.stringify(
        {
          name: 'frame12-fixture-monorepo',
          private: true,
          version: '0.2.0',
          type: 'module',
          workspaces: ['packages/static', 'packages/lint', 'packages/tokens', 'registry'],
        },
        null,
        2,
      ) + '\n',
    );
    fs.mkdirSync(path.join(fixtureRoot, 'registry'), { recursive: true });
    fs.writeFileSync(
      path.join(fixtureRoot, 'registry/package.json'),
      JSON.stringify({ name: '@frame12/registry', private: true, version: '0.2.0' }, null, 2) + '\n',
    );

    const licenseText = fs.readFileSync(path.join(REPO_ROOT, 'LICENSE'), 'utf8');

    // 4a. Copy real packages/tokens into fixtureRoot/packages/tokens
    const tokensDir = path.join(fixtureRoot, 'packages/tokens');
    fs.mkdirSync(path.join(tokensDir, 'dist'), { recursive: true });
    for (const f of ['package.json', 'README.md', 'LICENSE', 'CHANGELOG.md']) {
      fs.copyFileSync(path.join(REPO_ROOT, 'packages/tokens', f), path.join(tokensDir, f));
    }
    for (const f of ['index.js', 'index.d.ts', 'tokens.css', 'tokens.json']) {
      fs.copyFileSync(path.join(REPO_ROOT, 'packages/tokens/dist', f), path.join(tokensDir, 'dist', f));
    }

    // 4b. Create fixture packages/lint (`@frame12/lint` exporting `lintHtml`)
    const lintDir = path.join(fixtureRoot, 'packages/lint');
    fs.mkdirSync(path.join(lintDir, 'dist'), { recursive: true });
    fs.writeFileSync(
      path.join(lintDir, 'package.json'),
      JSON.stringify(
        {
          name: '@frame12/lint',
          version: '0.2.0',
          description: 'FRAME/12 design grammar linter.',
          license: 'MIT',
          type: 'module',
          main: './dist/index.js',
          types: './dist/index.d.ts',
          exports: {
            '.': {
              types: './dist/index.d.ts',
              default: './dist/index.js',
            },
            './package.json': './package.json',
          },
          files: ['dist'],
          peerDependencies: {
            typescript: '>=5.0.0',
          },
          peerDependenciesMeta: {
            typescript: { optional: true },
          },
          repository: {
            type: 'git',
            url: 'https://github.com/lbrodie11/frame12.git',
            directory: 'packages/lint',
          },
        },
        null,
        2,
      ) + '\n',
    );
    fs.writeFileSync(path.join(lintDir, 'README.md'), '# @frame12/lint\n');
    fs.writeFileSync(path.join(lintDir, 'LICENSE'), licenseText);
    fs.writeFileSync(
      path.join(lintDir, 'CHANGELOG.md'),
      '# Changelog\n\n## [0.2.0] - 2026-11-08\n\n- Initial release of `@frame12/lint` with `lintHtml`.\n',
    );
    fs.writeFileSync(
      path.join(lintDir, 'dist/index.js'),
      `export function lintHtml(html) {\n  const violations = [];\n  if (/#[0-9a-fA-F]{3,6}/.test(String(html))) {\n    violations.push({ rule: 'color-literal', message: 'Hard-coded hex color' });\n  }\n  return violations;\n}\n`,
    );
    fs.writeFileSync(
      path.join(lintDir, 'dist/index.d.ts'),
      `export interface Violation { rule: string; message: string; }\nexport declare function lintHtml(html: string): Violation[];\n`,
    );

    // 4c. Create fixture packages/static (`@frame12/static` depending on `@frame12/tokens` and exporting `document` + `renderCard`)
    const staticDir = path.join(fixtureRoot, 'packages/static');
    fs.mkdirSync(path.join(staticDir, 'dist'), { recursive: true });
    fs.writeFileSync(
      path.join(staticDir, 'package.json'),
      JSON.stringify(
        {
          name: '@frame12/static',
          version: '0.2.0',
          description: 'FRAME/12 static HTML and SVG card renderer.',
          license: 'MIT',
          type: 'module',
          main: './dist/index.js',
          types: './dist/index.d.ts',
          exports: {
            '.': {
              types: './dist/index.d.ts',
              default: './dist/index.js',
            },
            './package.json': './package.json',
          },
          files: ['dist'],
          dependencies: {
            '@frame12/tokens': '0.2.0',
          },
          repository: {
            type: 'git',
            url: 'https://github.com/lbrodie11/frame12.git',
            directory: 'packages/static',
          },
        },
        null,
        2,
      ) + '\n',
    );
    fs.writeFileSync(path.join(staticDir, 'README.md'), '# @frame12/static\n');
    fs.writeFileSync(path.join(staticDir, 'LICENSE'), licenseText);
    fs.writeFileSync(
      path.join(staticDir, 'CHANGELOG.md'),
      '# Changelog\n\n## [0.2.0] - 2026-11-08\n\n- Initial release of `@frame12/static` with `document()` and `renderCard()`.\n',
    );
    fs.writeFileSync(
      path.join(staticDir, 'dist/index.js'),
      `import { cssText, tokens } from '@frame12/tokens';\nexport function document({ title = 'FRAME/12', body = '' } = {}) {\n  return \`<!doctype html><html data-theme="light"><head><meta charset="utf-8"><title>\${title}</title><style>\${cssText}</style></head><body class="f12-sheet">\${body}</body></html>\`;\n}\nexport function renderCard({ title = 'Card', subtitle = '', value = '' } = {}) {\n  return \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200" stroke="\${tokens.light.rule}"><text x="20" y="40">\${title}</text><text x="20" y="80">\${subtitle}</text><text x="20" y="140">\${value}</text></svg>\`;\n}\n`,
    );
    fs.writeFileSync(
      path.join(staticDir, 'dist/index.d.ts'),
      `export declare function document(opts?: { title?: string; body?: string }): string;\nexport declare function renderCard(opts?: { title?: string; subtitle?: string; value?: string }): string;\n`,
    );

    const discovered = discoverPublishablePackages(fixtureRoot);
    const namesOrder = discovered.map((p) => p.shortName);
    const tokensIdx = namesOrder.indexOf('tokens');
    const staticIdx = namesOrder.indexOf('static');

    const validation = validatePackages(fixtureRoot);
    const dryRunOutDir = path.join(fixtureRoot, 'dry-run-artifacts');
    const dryRunRes = runDryRunRelease({
      rootDir: fixtureRoot,
      outDir: dryRunOutDir,
      queryNpmVersion: () => false,
    });

    const smokeRes = runStandalonePackageSmokeTest(fixtureRoot, { silent: true });

    // Verify SHA-256 tarball manifest verification (`verifyVerifiedArtifact`)
    const verifiedTokensArtifact = verifyVerifiedArtifact(discovered[0], dryRunOutDir);
    let tamperedTarballThrew = false;
    const tamperedDir = path.join(fixtureRoot, 'tampered-artifacts');
    fs.cpSync(dryRunOutDir, tamperedDir, { recursive: true });
    fs.appendFileSync(path.join(tamperedDir, 'frame12-tokens-0.2.0.tgz'), 'tampered');
    try {
      verifyVerifiedArtifact(discovered[0], tamperedDir);
    } catch (err) {
      tamperedTarballThrew = err.message.includes('SHA-256 mismatch');
    }

    // Also test missing export file detection on disk
    fs.rmSync(path.join(staticDir, 'dist/index.js'));
    const missingExportValidation = validatePackages(fixtureRoot, { runNpmPackCheck: false });

    check(
      discovered.length === 3 &&
        tokensIdx !== -1 &&
        staticIdx !== -1 &&
        tokensIdx < staticIdx &&
        validation.errors.length === 0 &&
        dryRunRes.manifest.packages.length === 3 &&
        fs.existsSync(path.join(dryRunOutDir, 'frame12-tokens-0.2.0.tgz')) &&
        fs.existsSync(path.join(dryRunOutDir, 'frame12-lint-0.2.0.tgz')) &&
        fs.existsSync(path.join(dryRunOutDir, 'frame12-static-0.2.0.tgz')) &&
        verifiedTokensArtifact.tarball === 'frame12-tokens-0.2.0.tgz' &&
        tamperedTarballThrew &&
        smokeRes.verified.length === 3 &&
        Boolean(smokeRes.results.tokens && smokeRes.results.lint && smokeRes.results.static) &&
        smokeRes.results.lint.cleanViolations === 0 &&
        Array.isArray(smokeRes.results.lint.dirtyRules) &&
        smokeRes.results.lint.dirtyRules.includes('color-literal') &&
        missingExportValidation.errors.some((e) =>
          e.includes('export target "./dist/index.js" at exports["."]["default"] does not exist on disk after build'),
        ),
      'multi-package fixture (tokens, lint, static): discovered automatically in topological order (tokens before static), passes dry-run release + SHA-256 artifact verification, and passes standalone tarball smoke test (cssText, lintHtml clean+color-literal, document, renderCard)',
      JSON.stringify({
        order: namesOrder,
        tarballs: dryRunRes.manifest.packages.map((p) => p.tarball),
        smokeResults: smokeRes.results,
      }),
    );
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

// 5. Release tag validation, git tag commit check, npm/Node version guard, and internal npm dependency check
{
  const parsedTag = parseReleaseTag('refs/tags/tokens@0.2.0');
  const parsedPre = parseReleaseTag('static@0.3.0-rc.1');
  let badTagThrew = false;
  try {
    parseReleaseTag('v0.2.0');
  } catch {
    badTagThrew = true;
  }

  const commitMatchOk = verifyTagCommit('tokens@0.2.0', 'abc1234def5678', {
    resolveGitTagCommit: (tag) => (tag === 'tokens@0.2.0' ? 'abc1234def5678' : null),
  });
  let missingTagCommitThrew = false;
  try {
    verifyTagCommit('tokens@0.2.0', 'abc1234def5678', {
      resolveGitTagCommit: () => null,
    });
  } catch (err) {
    missingTagCommitThrew = err.message.includes('does not exist');
  }
  let mismatchedTagCommitThrew = false;
  try {
    verifyTagCommit('tokens@0.2.0', 'abc1234def5678', {
      resolveGitTagCommit: () => '99999999999999',
    });
  } catch (err) {
    mismatchedTagCommitThrew = err.message.includes('points to commit 99999999999999');
  }

  const envFailOldNpm = checkPublishEnvironment({ nodeVersion: '24.0.0', npmVersion: '10.8.2' });
  const envFailMidNpm = checkPublishEnvironment({ nodeVersion: '24.0.0', npmVersion: '11.5.0' });
  const envFailOldNode = checkPublishEnvironment({ nodeVersion: '20.12.0', npmVersion: '11.6.0' });
  const envPassMin = checkPublishEnvironment({ nodeVersion: '22.14.0', npmVersion: '11.5.1' });
  const envPassNode24 = checkPublishEnvironment({ nodeVersion: '24.8.0', npmVersion: '11.6.2' });

  const mockPackages = [
    {
      shortName: 'tokens',
      name: '@frame12/tokens',
      version: '0.2.0',
      relDir: 'packages/tokens',
      pkgJson: { name: '@frame12/tokens', version: '0.2.0' },
    },
    {
      shortName: 'static',
      name: '@frame12/static',
      version: '0.2.0',
      relDir: 'packages/static',
      pkgJson: {
        name: '@frame12/static',
        version: '0.2.0',
        dependencies: { '@frame12/tokens': '0.2.0' },
      },
    },
  ];

  const matchedTag = verifyTagMatchesPackage('tokens@0.2.0', mockPackages);
  let mismatchVerThrew = false;
  try {
    verifyTagMatchesPackage('tokens@0.9.9', mockPackages);
  } catch (err) {
    mismatchVerThrew = err.message.includes('does not match packages/tokens/package.json version "0.2.0"');
  }

  let unpublishedDepThrew = false;
  try {
    verifyNpmInternalDependencies(mockPackages[1], {
      dryRun: false,
      queryNpmVersion: () => false,
    });
  } catch (err) {
    unpublishedDepThrew = err.message.includes('tag "tokens@0.2.0" before "static@0.2.0"');
  }

  const publishedDepOk = verifyNpmInternalDependencies(mockPackages[1], {
    dryRun: false,
    queryNpmVersion: (name, ver) => name === '@frame12/tokens' && ver === '0.2.0',
  });

  const sampleChangelog = [
    '# Changelog',
    '',
    '## [Unreleased]',
    '',
    '## [0.2.0] - 2026-11-08',
    '',
    '- Initial tokens release.',
    '',
    '## [0.1.0] - 2026-10-01',
    '',
    '- Older release.',
  ].join('\n');
  const extracted020 = extractPackageChangelog(sampleChangelog, '0.2.0');
  const extractedMissing = extractPackageChangelog(sampleChangelog, '0.9.0');

  check(
    parsedTag.shortName === 'tokens' &&
      parsedTag.version === '0.2.0' &&
      parsedTag.prerelease === false &&
      parsedPre.shortName === 'static' &&
      parsedPre.prerelease === true &&
      badTagThrew &&
      commitMatchOk.commit === 'abc1234def5678' &&
      missingTagCommitThrew &&
      mismatchedTagCommitThrew &&
      !envFailOldNpm.ok &&
      envFailOldNpm.errors[0].includes('requires npm >= 11.5.1') &&
      !envFailMidNpm.ok &&
      !envFailOldNode.ok &&
      envFailOldNode.errors[0].includes('requires Node.js >= 22.14.0') &&
      envPassMin.ok &&
      envPassNode24.ok &&
      matchedTag.pkg.name === '@frame12/tokens' &&
      mismatchVerThrew &&
      unpublishedDepThrew &&
      publishedDepOk.length === 1 &&
      publishedDepOk[0].publishedOnNpm === true &&
      extracted020 === '- Initial tokens release.' &&
      extractedMissing === null,
    'release-packages unit: tag parser, git tag commit SHA verification, Node >= 22.14.0 & npm >= 11.5.1 guard, tag-to-package.json version match, npm internal dependency gate, and changelog section extractor pass',
  );
}

if (failures > 0) {
  console.error(`\n${failures} package release test(s) failed`);
  process.exit(1);
}
console.log('\nAll check-packages & release-packages tests passed');
