#!/usr/bin/env node
/**
 * Unit, CLI parity, HTML linter, regression, and optional-peer tests for @frame12/lint.
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  RULES,
  FORBIDDEN_SHADCN_MODULES,
  FORBIDDEN_EXTERNAL_PACKAGES,
  lintSource,
  collectFiles,
  lintFiles,
  lintDirectory,
  lintHtml,
} from '../dist/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(__dirname, '..');
const REPO_ROOT = resolve(PKG_ROOT, '../..');

let passed = 0;
let failed = 0;

function check(condition, label, detail = '') {
  if (condition) {
    console.log(`  PASS  ${label}`);
    passed++;
  } else {
    console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

console.log('\n=== @frame12/lint Test Suite ===\n');

// ---------------------------------------------------------------------------
// 1. Exports & RULES contract
// ---------------------------------------------------------------------------
{
  const expectedRuleIds = [
    'color-literal',
    'illegal-gutter',
    'marker-misuse',
    'cut-order',
    'explicit-cut-in-autocut',
    'raw-shadcn-import',
    'unsafe-html',
    'ink-autoplay',
  ];
  check(
    expectedRuleIds.every((id) => typeof RULES[id] === 'string' && RULES[id].length > 10),
    'exports: RULES defines all 8 rule IDs with descriptions',
  );
  check(
    FORBIDDEN_SHADCN_MODULES instanceof Set && FORBIDDEN_SHADCN_MODULES.has('button'),
    'exports: FORBIDDEN_SHADCN_MODULES is exported',
  );
  check(
    FORBIDDEN_EXTERNAL_PACKAGES instanceof Set && FORBIDDEN_EXTERNAL_PACKAGES.has('recharts'),
    'exports: FORBIDDEN_EXTERNAL_PACKAGES is exported',
  );
  check(
    typeof lintSource === 'function' &&
      typeof lintFiles === 'function' &&
      typeof lintDirectory === 'function' &&
      lintDirectory === lintFiles &&
      typeof collectFiles === 'function' &&
      typeof lintHtml === 'function',
    'exports: lintSource, lintFiles, lintDirectory, collectFiles, and lintHtml are functions',
  );

  // Check README has an anchor section for every rule ID
  const readme = readFileSync(join(PKG_ROOT, 'README.md'), 'utf8');
  for (const id of expectedRuleIds) {
    check(
      readme.includes(`### \`${id}\``) && readme.includes(`(#${id})`),
      `docs: README.md documents rule "${id}" with linkable anchor`,
    );
  }
}

// ---------------------------------------------------------------------------
// 2. CLI output parity (repo + 6-violation fixture snapshot + .html + 0-files)
// ---------------------------------------------------------------------------
{
  const repoWrapperOut = execFileSync(
    process.execPath,
    [join(REPO_ROOT, 'scripts/check-frame12.mjs')],
    { cwd: REPO_ROOT, encoding: 'utf8' },
  );
  const repoBinOut = execFileSync(
    process.execPath,
    [join(PKG_ROOT, 'dist/cli.mjs')],
    { cwd: REPO_ROOT, encoding: 'utf8' },
  );
  check(
    repoWrapperOut === 'PASS  check-frame12: 106 file(s) checked, 0 violations.\n' &&
      repoBinOut === repoWrapperOut,
    'CLI parity: repo default check output is byte-identical to baseline',
    `Got: ${JSON.stringify(repoWrapperOut)}`,
  );

  // 6-violation fixture (one violation per source rule)
  const tmpDir = mkdtempSync(join(tmpdir(), 'f12-lint-parity-'));
  try {
    // 0-files check in empty tmpDir
    let zeroFilesStatus = 0;
    let zeroFilesStderr = '';
    try {
      execFileSync(process.execPath, [join(PKG_ROOT, 'dist/cli.mjs')], {
        cwd: tmpDir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err) {
      zeroFilesStatus = err.status;
      zeroFilesStderr = err.stderr;
    }
    check(
      zeroFilesStatus === 1 && zeroFilesStderr.includes('FAIL  check-frame12: No lintable files'),
      'CLI: exits with code 1 and clear error when 0 lintable files are found',
      zeroFilesStderr,
    );

    const fixtureRel = 'six-violations.tsx';
    const fixturePath = join(tmpDir, fixtureRel);
    const sixViolationsSource = [
      "import { Button } from '@/components/ui/button';",
      "import { Panel, Sheet } from '@/components/frame12';",
      '',
      "const accent = '#ff0055';",
      '',
      'export function BadFixture() {',
      '  return (',
      '    <div className="grid gap-4">',
      '      <Panel cut="C-02">',
      '        <span className="text-f-marker">{accent}</span>',
      '        <Button />',
      '      </Panel>',
      '      <Sheet autoCut>',
      '        <Panel cut="C-01">Auto</Panel>',
      '      </Sheet>',
      '    </div>',
      '  );',
      '}',
      '',
    ].join('\n');
    writeFileSync(fixturePath, sixViolationsSource, 'utf8');

    const expectedSnapshot = [
      `FAIL  [color-literal] ${fixtureRel}:4 — Hard-coded hex color "#ff0055" is forbidden outside token files. Use a var(--f-*) token.`,
      '      > #ff0055',
      `FAIL  [illegal-gutter] ${fixtureRel}:8 — Illegal Tailwind gutter class "gap-4". Use Scene gutter="pair|scene|change" or 12px/20px/32px tokens.`,
      '      > gap-4',
      `FAIL  [marker-misuse] ${fixtureRel}:10 — Marker yellow utility "text-f-marker" is forbidden. Marker yellow may only be used as a background paired with --f-marker-ink text.`,
      '      > text-f-marker',
      `FAIL  [explicit-cut-in-autocut] ${fixtureRel}:14 — Cut numbers are automatic inside <Sheet autoCut>; remove the cut prop.`,
      '      > cut="C-01"',
      `FAIL  [cut-order] ${fixtureRel}:9 — First cut in file is "C-02", but cuts must start at "C-01".`,
      '      > cut="C-02"',
      `FAIL  [raw-shadcn-import] ${fixtureRel}:1 — Raw shadcn import "@/components/ui/button" is forbidden where a FRAME/12 component or adapter exists. Import from "@/components/frame12".`,
      "      > import { Button } from '@/components/ui/button'",
      '',
      '6 FRAME/12 violation(s) found across 1 file(s).',
      '',
    ].join('\n');

    let wrapperStderr = '';
    let wrapperStatus = 0;
    try {
      execFileSync(
        process.execPath,
        [join(REPO_ROOT, 'scripts/check-frame12.mjs'), fixtureRel],
        { cwd: tmpDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
      );
    } catch (err) {
      wrapperStatus = err.status;
      wrapperStderr = err.stderr;
    }

    let binStderr = '';
    let binStatus = 0;
    try {
      execFileSync(
        process.execPath,
        [join(PKG_ROOT, 'dist/cli.mjs'), fixtureRel],
        { cwd: tmpDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
      );
    } catch (err) {
      binStatus = err.status;
      binStderr = err.stderr;
    }

    check(
      wrapperStatus === 1 &&
        binStatus === 1 &&
        wrapperStderr === expectedSnapshot &&
        binStderr === expectedSnapshot,
      'CLI parity: 6-violation fixture stderr and exit code 1 are byte-identical to baseline snapshot',
      wrapperStderr !== expectedSnapshot
        ? `Expected:\n${expectedSnapshot}\nActual:\n${wrapperStderr}`
        : '',
    );

    // CLI .html linting
    const htmlFixtureRel = 'bad-page.html';
    writeFileSync(
      join(tmpDir, htmlFixtureRel),
      '<style>.g { gap: 14px; }</style><section data-cut="1">Bad</section>\n',
      'utf8',
    );
    let htmlCliStatus = 0;
    let htmlCliStderr = '';
    try {
      execFileSync(
        process.execPath,
        [join(PKG_ROOT, 'dist/cli.mjs'), htmlFixtureRel],
        { cwd: tmpDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
      );
    } catch (err) {
      htmlCliStatus = err.status;
      htmlCliStderr = err.stderr;
    }
    check(
      htmlCliStatus === 1 &&
        htmlCliStderr.includes('[illegal-gutter] bad-page.html:1') &&
        htmlCliStderr.includes('[cut-order] bad-page.html:1'),
      'CLI: routes .html files to lintHtml() and reports violations',
      htmlCliStderr,
    );
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// 3. lintHtml() — one fixture per rule + line/column verification
// ---------------------------------------------------------------------------
{
  // Objects with a string form (e.g. @frame12/static Html values) are linted as their string,
  // not indexed character by character (which used to lint nothing or never finish).
  const htmlLike = { toString: () => '<a href="javascript:alert(1)">x</a>' };
  const fromObject = lintHtml(htmlLike).map((v) => v.rule);
  check(
    fromObject.length === 1 && fromObject[0] === 'unsafe-html' && lintHtml(null).length === 0,
    'lintHtml: accepts an object with a string form (and null) and lints its string',
    JSON.stringify(fromObject),
  );
}
{
  // 3a. color-literal in <style> and style="..."
  const htmlColor = [
    '<!doctype html>',
    '<html>',
    '<head>',
    '  <style>',
    '    .bad { color: #ff0055; background: rgb(10, 20, 30); }',
    '  </style>',
    '</head>',
    '<body>',
    '  <div style="border-color: #123456">Text</div>',
    '</body>',
    '</html>',
  ].join('\n');
  const vColor = lintHtml(htmlColor, { file: 'color.html' });
  check(
    vColor.length === 3 &&
      vColor.every((v) => v.rule === 'color-literal') &&
      vColor[0].line === 5 &&
      vColor[0].column === 19 &&
      vColor[0].snippet === '#ff0055' &&
      vColor[1].line === 5 &&
      vColor[1].column === 40 &&
      vColor[1].snippet === 'rgb(10, 20, 30)' &&
      vColor[2].line === 9 &&
      vColor[2].column === 29 &&
      vColor[2].snippet === '#123456',
    'lintHtml [color-literal]: flags hex and rgb() in <style> and style="..." with exact line and column',
    JSON.stringify(vColor),
  );

  // 3b. illegal-gutter in <style>, style="...", and Tailwind class="..."
  const htmlGutter = [
    '<style>',
    '  .grid { display: grid; gap: 14px; }',
    '</style>',
    '<div style="display: flex; gap: 14px"></div>',
    '<div class="grid gap-4"></div>',
  ].join('\n');
  const vGutter = lintHtml(htmlGutter, { file: 'gutter.html' });
  check(
    vGutter.length === 3 &&
      vGutter.every((v) => v.rule === 'illegal-gutter') &&
      vGutter[0].line === 2 &&
      vGutter[0].column === 26 &&
      vGutter[1].line === 4 &&
      vGutter[1].column === 28 &&
      vGutter[2].line === 5 &&
      vGutter[2].column === 18,
    'lintHtml [illegal-gutter]: flags gap: 14px in <style> and style="..." and gap-4 in class="..." with exact line/column',
    JSON.stringify(vGutter),
  );

  // 3c. marker-misuse in <style>, style="...", and SVG stroke
  const htmlMarker = [
    '<style>',
    '  .unpaired { background: var(--f-marker); }',
    '  .ring:focus { outline: var(--f-stroke) solid var(--f-marker); }',
    '</style>',
    '<div style="background: var(--f-marker)">Unpaired inline</div>',
    '<svg><line stroke="var(--f-marker)" x1="0" y1="0" x2="10" y2="10" /></svg>',
  ].join('\n');
  const vMarker = lintHtml(htmlMarker, { file: 'marker.html' });
  check(
    vMarker.length === 4 &&
      vMarker.every((v) => v.rule === 'marker-misuse') &&
      vMarker[0].line === 3 &&
      vMarker[0].column === 17 &&
      vMarker[1].line === 2 &&
      vMarker[1].column === 15 &&
      vMarker[2].line === 5 &&
      vMarker[2].column === 13 &&
      vMarker[3].line === 6 &&
      vMarker[3].column === 12,
    'lintHtml [marker-misuse]: flags unpaired marker background, outline, and SVG stroke with exact line/column',
    JSON.stringify(vMarker),
  );

  // 3d. cut-order on data-cut and .f12-cut in DOM reading order
  const htmlCuts = [
    '<main>',
    '  <section data-cut="C-01"><span class="f12-cut">C-01</span></section>',
    '  <section data-cut="C-03">Skipped C-02</section>',
    '  <section data-cut="C-03">Duplicate C-03</section>',
    '  <section data-cut="1">Malformed</section>',
    '  <section data-cut="auto">Ignored auto</section>',
    '  <section data-cut="">Ignored empty</section>',
    '</main>',
  ].join('\n');
  const vCuts = lintHtml(htmlCuts, { file: 'cuts.html' });
  check(
    vCuts.length === 3 &&
      vCuts.every((v) => v.rule === 'cut-order') &&
      vCuts[0].line === 5 &&
      vCuts[0].column === 12 &&
      vCuts[0].message.includes('Malformed cut label "1"') &&
      vCuts[1].line === 3 &&
      vCuts[1].column === 12 &&
      vCuts[1].message.includes('Out-of-order or skipped cut "C-03" after "C-01"') &&
      vCuts[2].line === 4 &&
      vCuts[2].column === 12 &&
      vCuts[2].message.includes('Duplicate cut number "C-03"'),
    'lintHtml [cut-order]: flags malformed, skipped, and duplicate cuts while ignoring data-cut="auto" and matching child .f12-cut badge',
    JSON.stringify(vCuts),
  );

  // .f12-cut text content without parent data-cut
  const htmlBadgeCuts = [
    '<main>',
    '  <section><span class="f12-cut">C-02</span></section>',
    '</main>',
  ].join('\n');
  const vBadgeCuts = lintHtml(htmlBadgeCuts, { file: 'badge-cuts.html' });
  check(
    vBadgeCuts.length === 1 &&
      vBadgeCuts[0].rule === 'cut-order' &&
      vBadgeCuts[0].line === 2 &&
      vBadgeCuts[0].column === 12 &&
      vBadgeCuts[0].message.includes('First cut in file is "C-02"'),
    'lintHtml [cut-order]: checks .f12-cut text content when parent has no data-cut',
    JSON.stringify(vBadgeCuts),
  );

  // 3e. unsafe-html: external <script src>, onclick=, javascript: URLs, external resources, embeds, meta refresh, base, CSS @import/url()
  const htmlUnsafe = [
    '<div>',
    '  <script src="https://evil.example/payload.js"></script>',
    '  <button type="button" onclick="steal()">Click</button>',
    '  <a href="javascript:alert(1)">Bad link</a>',
    '  <a href="&#106;avascript:alert(2)">Encoded bad link</a>',
    '  <link rel="stylesheet" href="https://evil.example/a.css">',
    '  <img src="https://evil.example/a.png" alt="ext">',
    '  <iframe src="/local.html"></iframe>',
    '  <object data="/local.swf"></object>',
    '  <embed src="/local.swf">',
    '  <div srcdoc="<p>inline</p>"></div>',
    '  <meta http-equiv="refresh" content="0;url=https://evil.example">',
    '  <base href="https://evil.example/">',
    '  <style>@import "https://evil.example/b.css"; .bg { background-image: url(https://evil.example/bg.png); }</style>',
    '</div>',
  ].join('\n');
  const vUnsafe = lintHtml(htmlUnsafe, { file: 'unsafe.html' });
  check(
    vUnsafe.length === 14 &&
      vUnsafe.every((v) => v.rule === 'unsafe-html') &&
      vUnsafe[0].line === 2 &&
      vUnsafe[0].column === 11 &&
      vUnsafe[1].line === 3 &&
      vUnsafe[1].column === 25 &&
      vUnsafe[2].line === 4 &&
      vUnsafe[2].column === 6 &&
      vUnsafe[3].line === 5 &&
      vUnsafe[3].column === 6,
    'lintHtml [unsafe-html]: flags external <script src>, onclick=, javascript: URLs, external <link>/<img>, <iframe>/<object>/<embed>, srcdoc, <meta http-equiv="refresh">, <base href>, and CSS @import/url()',
    JSON.stringify(vUnsafe),
  );
}

// ---------------------------------------------------------------------------
// 4. Clean HTML page with <style data-f12-tokens> and inline <script> passes
// ---------------------------------------------------------------------------
{
  const cleanHtml = [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="utf-8">',
    '  <style data-f12-tokens>',
    '    :root {',
    '      --f-sheet: #ffffff;',
    '      --f-panel: #ffffff;',
    '      --f-ink: #121212;',
    '      --f-rule: #121212;',
    '      --f-marker: #ffd60a;',
    '      --f-marker-ink: #121212;',
    '      --f-gutter-pair: 12px;',
    '      --f-gutter-scene: 20px;',
    '      --f-gutter-change: 32px;',
    '      --f-stroke: 2.5px;',
    '      --f-pose: 83.33ms;',
    '    }',
    '  </style>',
    '  <style>',
    '    body { background: var(--f-sheet); color: var(--f-ink); }',
    '    .grid { display: grid; gap: var(--f-gutter-scene); }',
    '    .cap.marker { background: var(--f-marker); color: var(--f-marker-ink); }',
    '  </style>',
    '</head>',
    '<body>',
    '  <main class="grid">',
    '    <section class="panel" data-cut="C-01"><h2 class="cap marker"><span class="f12-cut">C-01</span> Intent</h2></section>',
    '    <section class="panel" data-cut="C-02"><h2>Changed</h2></section>',
    '  </main>',
    '  <script>',
    '    // Self-contained 12fps on-twos motion script',
    '    const poseMs = 1000 / 12;',
    '  </script>',
    '</body>',
    '</html>',
  ].join('\n');

  const vClean = lintHtml(cleanHtml, { file: 'clean.html' });
  check(
    vClean.length === 0,
    'lintHtml: clean HTML page with <style data-f12-tokens> and inline <script> passes with 0 violations',
    JSON.stringify(vClean),
  );
}

// ---------------------------------------------------------------------------
// 5. Regression test: known-bad Gutter page (fixtures/gutter-legacy.html)
// ---------------------------------------------------------------------------
{
  const gutterFixturePath = join(__dirname, 'fixtures/gutter-legacy.html');
  const gutterHtml = readFileSync(gutterFixturePath, 'utf8');
  const violations = lintHtml(gutterHtml, {
    file: 'gutter-legacy.html',
    tokenStyleIds: ['f12-tokens'],
  });

  const gutterViolations = violations.filter((v) => v.rule === 'illegal-gutter');
  const cutViolations = violations.filter((v) => v.rule === 'cut-order');
  const markerViolations = violations.filter((v) => v.rule === 'marker-misuse');
  const colorViolations = violations.filter((v) => v.rule === 'color-literal');
  const unsafeViolations = violations.filter((v) => v.rule === 'unsafe-html');

  check(
    colorViolations.length === 0,
    'regression (gutter-legacy.html): <style id="f12-tokens"> is skipped when tokenStyleIds: ["f12-tokens"]',
    JSON.stringify(colorViolations),
  );
  check(
    unsafeViolations.length === 0,
    'regression (gutter-legacy.html): inline on-twos <script> is allowed (0 unsafe-html violations)',
    JSON.stringify(unsafeViolations),
  );
  check(
    gutterViolations.length === 10 &&
      gutterViolations.some((v) => v.snippet.includes('gap:8px')) &&
      gutterViolations.some((v) => v.snippet.includes('gap:10px')) &&
      gutterViolations.some((v) => v.snippet.includes('gap:6px')) &&
      gutterViolations.some((v) => v.snippet.includes('gap:4px')) &&
      gutterViolations.some((v) => v.snippet.includes('gap:18px')) &&
      gutterViolations.some((v) => v.snippet.includes('gap:14px')),
    'regression (gutter-legacy.html): catches all 10 illegal-gutter violations (4/6/8/10/14/18px)',
    JSON.stringify(gutterViolations),
  );
  check(
    markerViolations.length === 1 && markerViolations[0].snippet.includes('outline:var(--f-stroke) solid var(--f-marker)'),
    'regression (gutter-legacy.html): catches marker-misuse on focus outline',
    JSON.stringify(markerViolations),
  );
  check(
    cutViolations.length === 6 &&
      cutViolations.map((v) => v.snippet).join(',') ===
        'data-cut="0",data-cut="1",data-cut="2",data-cut="3",data-cut="4",data-cut="5"',
    'regression (gutter-legacy.html): catches all 6 non-C-NN cut-order violations (data-cut="0".."5")',
    JSON.stringify(cutViolations),
  );
}

// ---------------------------------------------------------------------------
// 6. Optional peer test: works when `typescript` is not resolvable + emits warning
// ---------------------------------------------------------------------------
{
  const indexUrl = pathToFileURL(join(PKG_ROOT, 'dist/index.js')).href;
  const loaderScript = `
    import { register } from 'node:module';
    const hookCode = \`
      export async function resolve(specifier, context, nextResolve) {
        if (specifier === 'typescript') {
          const err = new Error('Cannot find package "typescript"');
          err.code = 'ERR_MODULE_NOT_FOUND';
          throw err;
        }
        return nextResolve(specifier, context);
      }
    \`;
    register('data:text/javascript,' + encodeURIComponent(hookCode));
    const warnings = [];
    const origWarn = console.warn;
    console.warn = (...args) => warnings.push(args.join(' '));
    const { lintHtml, lintSource } = await import(${JSON.stringify(indexUrl)});
    const htmlRes = lintHtml('<style>.a { gap: 14px; }</style><section data-cut="1"></section>');
    const tsxRes = lintSource(
      'export const X = () => <Sheet autoCut><Panel cut="C-01" /></Sheet>;',
      'test.tsx',
      { disableTypeScript: true },
    );
    // Second call should not duplicate the one-time fallback warning
    lintSource('export const Y = () => <div />;', 'test2.tsx', { disableTypeScript: true });
    console.warn = origWarn;
    console.log(JSON.stringify({
      htmlCount: htmlRes.length,
      tsxRules: tsxRes.map((v) => v.rule),
      warnings,
    }));
  `;

  const out = execFileSync(
    process.execPath,
    ['--input-type=module', '-e', loaderScript],
    { cwd: tmpdir(), encoding: 'utf8' },
  ).trim();
  const parsed = JSON.parse(out);
  check(
    parsed.htmlCount === 2 &&
      Array.isArray(parsed.tsxRules) &&
      parsed.tsxRules.includes('explicit-cut-in-autocut') &&
      Array.isArray(parsed.warnings) &&
      parsed.warnings.length === 1 &&
      parsed.warnings[0].includes('WARN  [@frame12/lint] Optional peer dependency "typescript" is not installed'),
    'optional peer: lintHtml and lintSource fallback work when typescript is absent and emit a one-time WARN notice',
    out,
  );
}

// ---------------------------------------------------------------------------
// 7. Standalone templates/next-starter/scripts/check-frame12.mjs outside monorepo
// ---------------------------------------------------------------------------
{
  const starterCheckerSrc = readFileSync(
    join(REPO_ROOT, 'templates/next-starter/scripts/check-frame12.mjs'),
    'utf8',
  );
  const tmpDir = mkdtempSync(join(tmpdir(), 'f12-starter-standalone-'));
  try {
    const checkerCopy = join(tmpDir, 'check-frame12.mjs');
    const samplePage = join(tmpDir, 'page.tsx');
    writeFileSync(checkerCopy, starterCheckerSrc, 'utf8');
    writeFileSync(
      samplePage,
      "export function Page() { return <div style={{ gap: 'var(--f-gutter-scene)' }}>OK</div>; }\n",
      'utf8',
    );
    const out = execFileSync(process.execPath, [checkerCopy, 'page.tsx'], {
      cwd: tmpDir,
      encoding: 'utf8',
    });
    check(
      out === 'PASS  check-frame12: 1 file(s) checked, 0 violations.\n',
      'starter template: templates/next-starter/scripts/check-frame12.mjs runs standalone outside monorepo without @frame12/lint installed',
      out,
    );
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// 8. Package tarball hygiene (npm pack --dry-run)
// ---------------------------------------------------------------------------
{
  const packJsonRaw = execFileSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: PKG_ROOT,
    encoding: 'utf8',
  });
  const packInfo = JSON.parse(packJsonRaw)[0];
  const packedPaths = packInfo.files.map((f) => f.path).sort();
  check(
    packedPaths.includes('dist/index.js') &&
      packedPaths.includes('dist/index.d.ts') &&
      packedPaths.includes('dist/cli.mjs') &&
      packedPaths.includes('LICENSE') &&
      packedPaths.includes('README.md') &&
      packedPaths.includes('package.json') &&
      !packedPaths.some(
        (p) => p.startsWith('src/') || p.startsWith('scripts/') || p.startsWith('tests/'),
      ),
    'npm pack --dry-run: ships only dist/, LICENSE, README.md, package.json (no src/scripts/tests)',
    `Files: ${packedPaths.join(', ')}`,
  );
}

// ---------------------------------------------------------------------------
// 9. ink-autoplay: ink never draws on load (rule 5)
// ---------------------------------------------------------------------------
{
  const fx = (name) => readFileSync(join(__dirname, 'fixtures', name), 'utf8');
  const lit = lintSource(fx('ink-autoplay-literal.tsx'), 'ink-autoplay-literal.tsx').filter(
    (v) => v.rule === 'ink-autoplay',
  );
  check(
    lit.length === 4 && lit.map((v) => v.line).join(',') === '8,9,11,14',
    'ink-autoplay: literal `play`, `play={true}`, `play={!0}` on InkStroke, InkReveal and InkSequence are flagged with line numbers',
    JSON.stringify(lit.map((v) => [v.line, v.column])),
  );
  const mount = lintSource(fx('ink-autoplay-mount.tsx'), 'ink-autoplay-mount.tsx').filter(
    (v) => v.rule === 'ink-autoplay',
  );
  check(
    mount.length === 3 &&
      /constant `true`/.test(mount[0].message) &&
      /useState\(true\)/.test(mount[1].message) &&
      /mount effect/.test(mount[2].message),
    'ink-autoplay: values constant at mount (a `true` const, an unchanging useState(true), state set to true in a mount effect) are flagged',
    JSON.stringify(mount.map((v) => v.message)),
  );
  const clean = lintSource(fx('ink-autoplay-clean.tsx'), 'ink-autoplay-clean.tsx');
  check(clean.length === 0, 'ink-autoplay: play driven by a user action, `false` or a prop passes', JSON.stringify(clean));
  const scopes = lintSource(fx('ink-autoplay-scopes.tsx'), 'ink-autoplay-scopes.tsx').filter(
    (v) => v.rule === 'ink-autoplay',
  );
  check(
    scopes.length === 3 &&
      scopes[0].line === 27 && /mount effect/.test(scopes[0].message) &&
      scopes[1].line === 64 && /constant `true`/.test(scopes[1].message) &&
      scopes[2].line === 89 && /mount effect/.test(scopes[2].message),
    'ink-autoplay: setters and constants resolve by lexical binding (same-named setters in sibling components, a shadowed setter in a nested function, a parameter shadowing a module constant) and only mount-time calls count (a listener registered in a mount effect passes, a timer scheduled there is flagged)',
    JSON.stringify(scopes.map((v) => [v.line, v.message.slice(0, 50)])),
  );
  for (const disableTypeScript of [false, true]) {
    const forms = lintSource(fx('ink-autoplay-forms.tsx'), 'ink-autoplay-forms.tsx', {
      disableTypeScript,
      quietFallbackWarning: true,
    }).filter((v) => v.rule === 'ink-autoplay');
    check(
      forms.length === 2 && forms[0].line === 9 && /InkSequence/.test(forms[0].message) &&
        forms[1].line === 11 && /InkStroke/.test(forms[1].message),
      `ink-autoplay (${disableTypeScript ? 'regex-free fallback scanner' : 'TypeScript AST'}): \`play\` after an attribute containing => and > is flagged, aliased imports (\`InkSequence as Story\`) are checked under their real name, and "play" inside a string value is ignored`,
      JSON.stringify(forms.map((v) => [v.line, v.message.slice(0, 40)])),
    );
  }
  const fb = lintSource(fx('ink-autoplay-literal.tsx'), 'ink-autoplay-literal.tsx', {
    disableTypeScript: true,
    quietFallbackWarning: true,
  }).filter((v) => v.rule === 'ink-autoplay');
  check(
    fb.length === 3 && fb.map((v) => v.line).join(',') === '8,9,14',
    'ink-autoplay (regex fallback without typescript): shorthand and `play={true}` are flagged',
    JSON.stringify(fb.map((v) => v.line)),
  );
}

console.log(`\n=== Summary: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) {
  process.exit(1);
}
