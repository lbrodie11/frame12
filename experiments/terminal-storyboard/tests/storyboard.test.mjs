import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { describe, it, before, after } from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

import {
  MAX_PAYLOAD_BYTES,
  SCHEMA_VERSION,
  StoryboardStreamValidator,
  validateEvent,
  validateEventStream,
  validateResultSnapshot,
} from '../dist/model/index.js';
import {
  classifyCochangePair,
  globToRegExp,
  matchesPattern,
  runGitHistoryWorkload,
  shouldFilterLowSignalPair,
  unquoteGitPath,
} from '../dist/workload/git-history.js';
import { convertRepoArchaeologySnapshot } from '../dist/workload/repo-archaeology-adapter.js';
import {
  PlainStreamPrinter,
  getDisplayWidth,
  renderBaseline,
  renderPlainStoryboard,
  renderPlainSummary,
  sanitizeTerminalText,
  shouldUseColor,
  wrapLineToWidth,
} from '../dist/render-plain/index.js';
import * as React from 'react';
import { render as renderInkTest } from 'ink-testing-library';
import {
  FilePair,
  FindingPanel,
  InkStreamController,
  MarkerLabel,
  ON_TWOS_FRAME_MS,
  RunSummary,
  StepLine,
  StoryboardApp,
  ToneBar,
  abbreviatePathMiddle,
  extractStoryboardSteps,
  renderInkStaticSummary,
} from '../dist/render-ink/index.js';
import { renderWebReportHtml } from '../dist/render-web/index.js';
import { reconstructSnapshotFromEvents, runCli } from '../dist/cli.js';
import { createFixtureRepo } from '../dist/fixtures/create-fixture-repo.js';
import { lintFiles } from '../../../scripts/check-frame12.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const expRoot = resolve(__dirname, '..');
const distDir = resolve(expRoot, 'dist');

describe('FRAME/12 Terminal Storyboard PoC Suite', () => {
  let fixture;
  let fixtureResult;

  before(async () => {
    fixture = createFixtureRepo('A');
    fixtureResult = await runGitHistoryWorkload({
      repoPath: fixture.repoDir,
      maxCommits: 50,
      topN: 5,
    });
  });

  after(() => {
    fixture?.cleanup();
  });

  // ===========================================================================
  // 1. Event & Snapshot Validator Tests
  // ===========================================================================
  describe('1. Event Model & Stream Validator', () => {
    it('keeps src/model 100% pure with zero React, fs, child_process, or registry imports and removes duplicate shim dirs', () => {
      const filesToCheck = [
        resolve(expRoot, 'src/model/types.ts'),
        resolve(expRoot, 'src/model/validate.ts'),
        resolve(expRoot, 'src/model/index.ts'),
      ];
      for (const f of filesToCheck) {
        const src = readFileSync(f, 'utf8');
        assert.equal(
          /\bfrom\s+['"](?:react|react-dom|node:fs|fs|node:child_process|child_process|@\/components\/frame12)/.test(src),
          false,
          `Forbidden import in ${f}`,
        );
      }
      assert.equal(existsSync(resolve(expRoot, 'src/core')), false);
      assert.equal(existsSync(resolve(expRoot, 'src/workflows')), false);
      assert.equal(existsSync(resolve(expRoot, 'src/renderers')), false);
    });

    it('accepts a valid live event stream and ResultSnapshot', () => {
      const streamCheck = validateEventStream(fixtureResult.events);
      assert.equal(streamCheck.ok, true);
      assert.equal(streamCheck.runStatus, 'completed');
      assert.equal(streamCheck.steps.length, 4);

      const snapCheck = validateResultSnapshot(fixtureResult.snapshot);
      assert.equal(snapCheck.ok, true);
    });

    it('rejects unknown event types and unsupported schemaVersion', () => {
      const badType = validateEvent({
        schemaVersion: SCHEMA_VERSION,
        eventId: 'evt-1',
        runId: 'run-1',
        seq: 1,
        ts: '2026-11-02T00:00:00.000Z',
        type: 'unknown-type',
        stepId: null,
        payload: {},
      });
      assert.equal(badType.ok, false);
      assert.match(badType.error, /Unknown event type/);

      const badSchema = validateEvent({
        schemaVersion: '99-future',
        eventId: 'evt-1',
        runId: 'run-1',
        seq: 1,
        ts: '2026-11-02T00:00:00.000Z',
        type: 'run-start',
        stepId: null,
        payload: {},
      });
      assert.equal(badSchema.ok, false);
      assert.match(badSchema.error, /Unsupported schemaVersion/);
    });

    it('rejects presentation cut numbers (e.g. C-01) used as domain stepId', () => {
      const cutAsStepId = validateEvent({
        schemaVersion: SCHEMA_VERSION,
        eventId: 'evt-2',
        runId: 'run-1',
        seq: 2,
        ts: '2026-11-02T00:00:00.000Z',
        type: 'step-start',
        stepId: 'C-01',
        payload: { title: 'Bad step ID' },
      });
      assert.equal(cutAsStepId.ok, false);
      assert.match(cutAsStepId.error, /presentation-only/);
    });

    it('rejects duplicate eventId, out-of-order seq, missing run-start, and unstarted step-end', () => {
      const baseStart = {
        schemaVersion: SCHEMA_VERSION,
        eventId: 'evt-1',
        runId: 'run-1',
        seq: 1,
        ts: '2026-11-02T00:00:00.000Z',
        type: 'run-start',
        stepId: null,
        payload: { repoLabel: 'test' },
      };

      const noStart = validateEventStream([
        { ...baseStart, type: 'step-start', stepId: 'validate-repo', payload: { title: 'Validate' } },
      ]);
      assert.equal(noStart.ok, false);
      assert.match(noStart.error, /First event in stream \(seq=1\) must be "run-start"/);

      const dupId = validateEventStream([
        baseStart,
        {
          schemaVersion: SCHEMA_VERSION,
          eventId: 'evt-1',
          runId: 'run-1',
          seq: 2,
          ts: '2026-11-02T00:00:01.000Z',
          type: 'run-end',
          stepId: null,
          payload: { status: 'completed' },
        },
      ]);
      assert.equal(dupId.ok, false);
      assert.match(dupId.error, /Duplicate eventId/);

      const badSeq = validateEventStream([
        baseStart,
        {
          schemaVersion: SCHEMA_VERSION,
          eventId: 'evt-2',
          runId: 'run-1',
          seq: 3,
          ts: '2026-11-02T00:00:01.000Z',
          type: 'run-end',
          stepId: null,
          payload: { status: 'completed' },
        },
      ]);
      assert.equal(badSeq.ok, false);
      assert.match(badSeq.error, /Out-of-order or gapped seq/);

      const unstartedStep = validateEventStream([
        baseStart,
        {
          schemaVersion: SCHEMA_VERSION,
          eventId: 'evt-2',
          runId: 'run-1',
          seq: 2,
          ts: '2026-11-02T00:00:01.000Z',
          type: 'step-end',
          stepId: 'validate-repo',
          payload: { status: 'ok' },
        },
      ]);
      assert.equal(unstartedStep.ok, false);
      assert.match(unstartedStep.error, /cannot close a step that was not started/);
    });

    it('rejects events after run-end, incomplete streams missing run-end, and oversized payloads', () => {
      const startEv = {
        schemaVersion: SCHEMA_VERSION,
        eventId: 'evt-1',
        runId: 'run-1',
        seq: 1,
        ts: '2026-11-02T00:00:00.000Z',
        type: 'run-start',
        stepId: null,
        payload: { repoLabel: 'test' },
      };
      const endEv = {
        schemaVersion: SCHEMA_VERSION,
        eventId: 'evt-2',
        runId: 'run-1',
        seq: 2,
        ts: '2026-11-02T00:00:01.000Z',
        type: 'run-end',
        stepId: null,
        payload: { status: 'completed' },
      };
      const afterEndEv = {
        schemaVersion: SCHEMA_VERSION,
        eventId: 'evt-3',
        runId: 'run-1',
        seq: 3,
        ts: '2026-11-02T00:00:02.000Z',
        type: 'warning',
        stepId: null,
        payload: { message: 'late warning' },
      };

      const afterEndRes = validateEventStream([startEv, endEv, afterEndEv]);
      assert.equal(afterEndRes.ok, false);
      assert.match(afterEndRes.error, /received after "run-end"/);

      const incompleteValidator = new StoryboardStreamValidator();
      assert.equal(incompleteValidator.push(startEv).ok, true);
      const fin = incompleteValidator.finalize();
      assert.equal(fin.ok, false);
      assert.match(fin.error, /missing terminal "run-end"/);

      const hugePayload = validateEvent({
        ...startEv,
        payload: { blob: 'x'.repeat(MAX_PAYLOAD_BYTES + 256) },
      });
      assert.equal(hugePayload.ok, false);
      assert.match(hugePayload.error, /exceeds maximum allowed/);
    });

    it('rejects malformed finding/metric/warning payloads, negative counts, unclosed steps, NaN/Infinity, and malformed hotFiles/reconstructed metadata', () => {
      const badFindingEv = validateEvent({
        schemaVersion: SCHEMA_VERSION,
        eventId: 'evt-2',
        runId: 'run-1',
        seq: 2,
        ts: '2026-11-02T00:00:00.000Z',
        type: 'finding',
        stepId: 'rank-findings',
        payload: { finding: { id: 'F-01', files: ['only-one.ts'] } },
      });
      assert.equal(badFindingEv.ok, false);
      assert.match(badFindingEv.error, /Invalid "finding" event payload/);

      const badMetricEv = validateEvent({
        schemaVersion: SCHEMA_VERSION,
        eventId: 'evt-2',
        runId: 'run-1',
        seq: 2,
        ts: '2026-11-02T00:00:00.000Z',
        type: 'metric',
        stepId: 'read-history',
        payload: { name: 'commitsExamined', value: Number.NaN },
      });
      assert.equal(badMetricEv.ok, false);
      assert.match(badMetricEv.error, /finite number or string/);

      const negMetricEv = validateEvent({
        schemaVersion: SCHEMA_VERSION,
        eventId: 'evt-2',
        runId: 'run-1',
        seq: 2,
        ts: '2026-11-02T00:00:00.000Z',
        type: 'metric',
        stepId: 'read-history',
        payload: { name: 'commitsExamined', value: -1 },
      });
      assert.equal(negMetricEv.ok, false);
      assert.match(negMetricEv.error, /non-negative integer/);

      const badWarnEv = validateEvent({
        schemaVersion: SCHEMA_VERSION,
        eventId: 'evt-2',
        runId: 'run-1',
        seq: 2,
        ts: '2026-11-02T00:00:00.000Z',
        type: 'warning',
        stepId: null,
        payload: { message: '   ' },
      });
      assert.equal(badWarnEv.ok, false);
      assert.match(badWarnEv.error, /non-empty string payload\.message/);

      const badRunEndHotFiles = validateEvent({
        schemaVersion: SCHEMA_VERSION,
        eventId: 'evt-2',
        runId: 'run-1',
        seq: 2,
        ts: '2026-11-02T00:00:00.000Z',
        type: 'run-end',
        stepId: null,
        payload: { status: 'completed', hotFiles: [{ file: '', commits: -3 }] },
      });
      assert.equal(badRunEndHotFiles.ok, false);
      assert.match(badRunEndHotFiles.error, /hotFiles\[0\]\.file/);

      const badSnapRecon = validateResultSnapshot({
        ...fixtureResult.snapshot,
        reconstructed: { source: '', originalSchemaVersion: -1, note: '' },
      });
      assert.equal(badSnapRecon.ok, false);
      assert.match(badSnapRecon.error, /reconstructed\.source/);

      const nanSnap = validateResultSnapshot({
        ...fixtureResult.snapshot,
        commitsExamined: Number.NaN,
      });
      assert.equal(nanSnap.ok, false);
      assert.match(nanSnap.error, /finite integer commitsExamined/);

      // Reject fractional counts (cochangeCount, fileACommits, fileBCommits, evidence.count)
      const baseFinding = fixtureResult.snapshot.findings[0];
      for (const override of [
        { cochangeCount: 1.5 },
        { fileACommits: 2.5 },
        { fileBCommits: 3.5 },
        { evidence: { ...baseFinding.evidence, count: 1.5 } },
      ]) {
        const fracSnap = validateResultSnapshot({
          ...fixtureResult.snapshot,
          findings: [{ ...baseFinding, ...override }],
        });
        assert.equal(fracSnap.ok, false);
        assert.match(fracSnap.error, /positive integer/);
      }

      // Reject cochangeCount > fileACommits or cochangeCount > fileBCommits
      const impossibleCountSnap = validateResultSnapshot({
        ...fixtureResult.snapshot,
        findings: [
          {
            ...baseFinding,
            cochangeCount: 5,
            fileACommits: 1,
            fileBCommits: 5,
          },
        ],
      });
      assert.equal(impossibleCountSnap.ok, false);
      assert.match(impossibleCountSnap.error, /cochangeCount \(5\) cannot exceed fileACommits \(1\) or fileBCommits \(5\)/);
    });
  });

  // ===========================================================================
  // 2. Deterministic Fixture Workloads (A & B), Astral Unicode, >10KB Subjects & Noise Filter
  // ===========================================================================
  describe('2. Deterministic Fixture Workloads (A & B), Unicode & Noise Filtering', () => {
    it('produces exact top co-changing pairs for both Fixture A and Fixture B (including mixed overlap/Jaccard ratios and hub-and-spoke ranking)', async () => {
      const { snapshot } = fixtureResult;
      assert.equal(snapshot.status, 'completed');
      assert.equal(snapshot.commitsExamined, 13);
      assert.equal(snapshot.uniqueFilesObserved, 6);
      assert.equal(snapshot.findings.length, 3);

      for (let i = 0; i < fixture.expectedTopPairs.length; i++) {
        const [expA, expB, expCount] = fixture.expectedTopPairs[i];
        const actual = snapshot.findings[i];
        assert.equal(actual.id, `F-0${i + 1}`);
        assert.deepEqual(actual.files, [expA, expB]);
        assert.equal(actual.cochangeCount, expCount);
        assert.equal(actual.couplingRatio, 1);
        assert.equal(actual.jaccardRatio, 1);
        assert.equal(actual.evidence.commitShas.length, expCount);
      }

      // Verify Fixture B with mixed coupling/Jaccard ratios and hub-and-spoke
      const fixtureB = createFixtureRepo({ variant: 'B', includeBulkAndHub: true });
      try {
        const resB = await runGitHistoryWorkload({
          repoPath: fixtureB.repoDir,
          maxCommits: 50,
          topN: 5,
        });
        assert.equal(resB.snapshot.status, 'completed');
        assert.equal(resB.snapshot.findings[0].files[0], 'src/auth/middleware.ts');
        assert.equal(resB.snapshot.findings[0].cochangeCount, 5);
        assert.equal(resB.snapshot.findings[0].couplingRatio, 1);
        assert.equal(resB.snapshot.findings[0].jaccardRatio, 1);

        // F-02 in Fixture B has 4 shared commits, fileACommits=4, fileBCommits=5 -> overlap 1.0, Jaccard 4/5 = 0.8
        assert.equal(resB.snapshot.findings[1].cochangeCount, 4);
        assert.equal(resB.snapshot.findings[1].couplingRatio, 1);
        assert.equal(resB.snapshot.findings[1].jaccardRatio, 0.8);

        // F-03 in Fixture B has 3 shared commits, fileACommits=4, fileBCommits=4 -> overlap 0.75, Jaccard 3/5 = 0.6
        assert.equal(resB.snapshot.findings[2].cochangeCount, 3);
        assert.equal(resB.snapshot.findings[2].couplingRatio, 0.75);
        assert.equal(resB.snapshot.findings[2].jaccardRatio, 0.6);

        // F-04 is hub-and-spoke: hub.ts (8 commits) + spoke.ts (2 commits) -> overlap 1.0 (2/2), Jaccard 2/8 = 0.25
        assert.equal(resB.snapshot.findings[3].cochangeCount, 2);
        assert.equal(resB.snapshot.findings[3].couplingRatio, 1);
        assert.equal(resB.snapshot.findings[3].jaccardRatio, 0.25);
      } finally {
        fixtureB.cleanup();
      }
    });

    it('preserves astral Unicode emoji/surrogate pairs in C-quoted git paths, normalizes NFD to NFC, and truncates >10KB commit subjects safely', async () => {
      // Direct test of unquoteGitPath with astral emoji + escaped quotes + NFD combining accent
      const rawQuotedEmoji = '"src/emoji😀\\"file.ts"';
      assert.equal(unquoteGitPath(rawQuotedEmoji), 'src/emoji😀"file.ts');
      assert.equal(unquoteGitPath(rawQuotedEmoji).includes('\uFFFD'), false);

      const nfdPath = 'src/cafe\u0301-東京.ts';
      const nfcPath = 'src/caf\u00e9-東京.ts';
      assert.equal(unquoteGitPath(nfdPath), nfcPath);

      const tmpRepo = mkdtempSync(join(tmpdir(), 'f12-unicode-huge-'));
      const runGitSync = (args) =>
        new Promise((res, rej) => {
          const p = spawn('git', args, { cwd: tmpRepo, stdio: 'ignore' });
          p.on('close', (c) => (c === 0 ? res() : rej(new Error(`git ${args.join(' ')} failed`))));
        });
      try {
        await runGitSync(['init']);
        await runGitSync(['config', 'user.name', 'Test']);
        await runGitSync(['config', 'user.email', 'test@example.com']);
        await runGitSync(['config', 'commit.gpgsign', 'false']);

        const fileA = 'src/emoji😀"file.ts';
        const fileB = 'src/café-東京.ts';
        mkdirSync(join(tmpRepo, 'src'), { recursive: true });

        // Commit 1: bulk commit touching 52 files + noise files (package-lock.json, image.png)
        writeFileSync(join(tmpRepo, fileA), 'bulk\n');
        writeFileSync(join(tmpRepo, fileB), 'bulk\n');
        writeFileSync(join(tmpRepo, 'package-lock.json'), '{}\n');
        writeFileSync(join(tmpRepo, 'docs-image.png'), 'png\n');
        for (let k = 1; k <= 50; k++) {
          writeFileSync(join(tmpRepo, `src/bulk-${k}.ts`), `export const b = ${k};\n`);
        }
        await runGitSync(['add', '.']);
        await runGitSync(['commit', '-m', 'chore: initial bulk commit']);

        // Commits 2 & 3: non-bulk lockstep edits with a >10 KB (12,000 byte) commit subject
        const hugeSubject = `feat(unicode): ${'A'.repeat(12000)}`;
        for (let c = 2; c <= 3; c++) {
          writeFileSync(join(tmpRepo, fileA), `v${c}\n`);
          writeFileSync(join(tmpRepo, fileB), `v${c}\n`);
          writeFileSync(join(tmpRepo, 'package-lock.json'), `{"v":${c}}\n`);
          await runGitSync(['add', '.']);
          await runGitSync(['commit', '-m', c === 2 ? hugeSubject : `feat: lockstep ${c}`]);
        }

        const res = await runGitHistoryWorkload({ repoPath: tmpRepo, maxCommits: 20, topN: 5 });
        assert.equal(res.snapshot.status, 'completed');
        assert.equal(res.snapshot.findings.length, 1);
        const top = res.snapshot.findings[0];
        assert.deepEqual(top.files, [fileB, fileA].sort());
        assert.equal(top.files.some((f) => f.includes('\uFFFD')), false);
        assert.equal(top.cochangeCount, 2);
        assert.equal(top.couplingRatio, 1);
        assert.equal(top.jaccardRatio, 1);
        assert.ok(top.evidence.sampleSubjects[0].length <= 200);
      } finally {
        rmSync(tmpRepo, { recursive: true, force: true });
      }
    });

    it('matches multi-segment ** globs (including ./ prefixes) in --exclude and classifies co-change pairs while preserving full evidence by default', () => {
      // Multi-segment ** glob matching (start, middle, end, and ./ prefix normalization)
      assert.equal(
        matchesPattern(
          'templates/next-starter/src/components/frame12/dialog.tsx',
          'templates/next-starter/src/**',
        ),
        true,
      );
      assert.equal(
        matchesPattern(
          './templates/next-starter/src/components/frame12/dialog.tsx',
          './templates/**',
        ),
        true,
      );
      assert.equal(
        matchesPattern('a/b/c/d.ts', 'a/**/d.ts'),
        true,
      );
      assert.equal(
        matchesPattern('a/d.ts', 'a/**/d.ts'),
        true,
      );
      assert.equal(
        globToRegExp('./templates/next-starter/src/**').test(
          'templates/next-starter/src/components/frame12/dialog.tsx',
        ),
        true,
      );
      assert.equal(matchesPattern('src/deep/nested/foo.test.ts', '**/*.test.*'), true);
      assert.equal(matchesPattern('src/deep/nested/foo.ts', '**/*.test.*'), false);

      // Pair classification (cross-module, same-module, test-companion, docs-release, workspace-mirror)
      assert.equal(
        classifyCochangePair('src/commands/map.ts', 'src/map/template.ts'),
        'cross-module',
      );
      assert.equal(
        classifyCochangePair('registry/ui/dialog.tsx', 'registry/ui/tooltip.tsx'),
        'same-module',
      );
      assert.equal(
        classifyCochangePair(
          'experiments/terminal-storyboard/src/workload/git-history.ts',
          'experiments/terminal-storyboard/tests/storyboard.test.mjs',
        ),
        'test-companion',
      );
      assert.equal(
        classifyCochangePair('site/app/site.css', 'site/scripts/site-verify.mjs'),
        'test-companion',
      );
      assert.equal(classifyCochangePair('README.md', 'package.json'), 'docs-release');
      assert.equal(classifyCochangePair('CHANGELOG.md', 'package.json'), 'docs-release');
      assert.equal(
        classifyCochangePair(
          'registry/ui/dialog.tsx',
          'templates/next-starter/src/components/frame12/dialog.tsx',
        ),
        'workspace-mirror',
      );

      // shouldFilterLowSignalPair identifies non-production companion pairs while runGitHistoryWorkload preserves all pairs by default
      assert.equal(shouldFilterLowSignalPair('README.md', 'package.json'), true);
      assert.equal(shouldFilterLowSignalPair('README.md', 'package.json', true), false);
      assert.equal(
        shouldFilterLowSignalPair('src/commands/map.ts', 'src/map/template.ts'),
        false,
      );
    });

    it('preserves full file path identities (>320 chars) without merging distinct files sharing a long prefix, and rejects paths >2048 bytes', async () => {
      const longPrefix = 'packages/' + 'deep-segment/'.repeat(26); // >340 chars
      const longFileA = `${longPrefix}alpha-service.ts`;
      const longFileB = `${longPrefix}beta-handler.ts`;
      assert.ok(longFileA.length > 350);
      assert.ok(longFileB.length > 350);
      assert.equal(unquoteGitPath(longFileA), longFileA);
      assert.equal(unquoteGitPath(longFileB), longFileB);
      assert.notEqual(unquoteGitPath(longFileA), unquoteGitPath(longFileB));

      assert.throws(
        () => unquoteGitPath('a'.repeat(2049)),
        /exceeds maximum allowed length of 2048 UTF-8 bytes/,
      );

      const tmpRepo = mkdtempSync(join(tmpdir(), 'f12-long-paths-'));
      const runGitSync = (args) =>
        new Promise((res, rej) => {
          const p = spawn('git', args, { cwd: tmpRepo, stdio: 'ignore' });
          p.on('close', (c) => (c === 0 ? res() : rej(new Error(`git ${args.join(' ')} failed`))));
        });
      try {
        await runGitSync(['init']);
        await runGitSync(['config', 'user.name', 'Test']);
        await runGitSync(['config', 'user.email', 'test@example.com']);
        await runGitSync(['config', 'commit.gpgsign', 'false']);

        mkdirSync(join(tmpRepo, longPrefix), { recursive: true });
        for (let c = 1; c <= 3; c++) {
          writeFileSync(join(tmpRepo, longFileA), `export const a = ${c};\n`);
          writeFileSync(join(tmpRepo, longFileB), `export const b = ${c};\n`);
          await runGitSync(['add', '.']);
          await runGitSync(['commit', '-m', `feat: long path commit ${c}`]);
        }

        const res = await runGitHistoryWorkload({ repoPath: tmpRepo, maxCommits: 10, topN: 5 });
        assert.equal(res.snapshot.status, 'completed');
        assert.equal(res.snapshot.uniqueFilesObserved, 2);
        assert.equal(res.snapshot.findings.length, 1);
        assert.deepEqual(res.snapshot.findings[0].files, [longFileA, longFileB]);
        assert.equal(validateEventStream(res.events).ok, true);
      } finally {
        rmSync(tmpRepo, { recursive: true, force: true });
      }
    });
  });

  // ===========================================================================
  // 3. Renderer Equivalence, Snapshot-Only HTML & Direct Imports
  // ===========================================================================
  describe('3. Renderer Equivalence, Snapshot-Only HTML & Bundle Hygiene', () => {
    it('renders identical findings, file pairs, counts, overlap/Jaccard ratios, and commit SHAs across all 3 views', () => {
      const { snapshot, events } = fixtureResult;
      const plainText = renderPlainStoryboard(snapshot, events, { columns: 100, isTTY: false, env: {} });
      const baselineText = renderBaseline(snapshot, { columns: 100, isTTY: false, env: {} });
      const htmlText = renderWebReportHtml(snapshot, events, { theme: 'light' });

      assert.match(plainText, /C-01 Validate target repository/);
      assert.match(plainText, /C-04 Rank coupled file pairs/);
      assert.equal(/\bC-01\b/.test(baselineText), false);

      // Both Plain, Baseline, and HTML explicitly label overlap and Jaccard
      assert.match(plainText, /overlap \[shared ÷\s+commits of less-changed file\]/);
      assert.match(plainText, /Jaccard/);
      assert.match(baselineText, /overlap \[shared ÷\s+commits of less-changed file\]/);
      assert.match(htmlText, /shared ÷ commits of less-changed file/);

      for (const finding of snapshot.findings) {
        for (const target of [plainText, baselineText, htmlText]) {
          assert.ok(target.includes(finding.id), `Missing ${finding.id}`);
          assert.ok(target.includes(finding.files[0]), `Missing ${finding.files[0]}`);
          assert.ok(target.includes(finding.files[1]), `Missing ${finding.files[1]}`);
          for (const sha of finding.evidence.commitShas) {
            assert.ok(target.includes(sha), `Missing commit SHA ${sha} for ${finding.id}`);
          }
        }
      }
    });

    it('renders SNAPSHOT ONLY notice when events=[] and throws when given an invalid non-empty event stream, without bundling Radix', () => {
      const snapshotOnlyHtml = renderWebReportHtml(fixtureResult.snapshot, []);
      assert.match(snapshotOnlyHtml, /SNAPSHOT ONLY · NO LIVE EVENT STREAM/);

      assert.throws(
        () =>
          renderWebReportHtml(fixtureResult.snapshot, [
            {
              schemaVersion: SCHEMA_VERSION,
              eventId: 'bad-1',
              runId: 'run-1',
              seq: 1,
              ts: '2026-11-02T00:00:00.000Z',
              type: 'step-start',
              stepId: 'validate-repo',
              payload: { title: 'Missing run-start' },
            },
          ]),
        /Invalid event stream passed to renderWebReportHtml/,
      );

      const webBundle = readFileSync(resolve(distDir, 'render-web/index.js'), 'utf8');
      assert.equal(webBundle.includes('@radix-ui'), false);
    });
  });

  // ===========================================================================
  // 4. Terminal & HTML Security / Escape Safety
  // ===========================================================================
  describe('4. Adversarial Escape & XSS Sanitization', () => {
    it('strips CSI, OSC 8 URLs (keeping visible label), CR/BS, and bidi overrides while HTML-escaping tags', async () => {
      const rawMalicious =
        '\x1b[31mRED\x1b[0m \x1b]8;;https://evil.example/steal\x07click-label\x1b]8;;\x07 spoof\rover\bwrite \u202Egnp.exe <script>alert(1)</script>';
      const cleaned = sanitizeTerminalText(rawMalicious);

      assert.equal(cleaned.includes('\x1b'), false);
      assert.equal(cleaned.includes('\r'), false);
      assert.equal(cleaned.includes('\b'), false);
      assert.equal(cleaned.includes('\u202E'), false);
      assert.equal(cleaned.includes('https://evil.example'), false);
      assert.equal(cleaned.includes('click-label'), true);

      const advFixture = createFixtureRepo({ includeAdversarial: true });
      try {
        const advRun = await runGitHistoryWorkload({
          repoPath: advFixture.repoDir,
          maxCommits: 50,
          topN: 5,
        });
        const plainOut = renderPlainStoryboard(advRun.snapshot, advRun.events, {
          columns: 100,
          isTTY: false,
          env: {},
        });
        const baseOut = renderBaseline(advRun.snapshot, { columns: 100, isTTY: false, env: {} });
        const htmlOut = renderWebReportHtml(advRun.snapshot, advRun.events);

        for (const termOut of [plainOut, baseOut]) {
          assert.equal(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/.test(termOut), false);
          assert.equal(/[\u200E\u200F\u202A-\u202E\u2066-\u2069\u061C]/.test(termOut), false);
          assert.equal(termOut.includes('https://evil.example'), false);
        }

        // Verify HTML report also strips all bidi overrides and control chars from summary/actionHint prose
        assert.equal(/[\u200E\u200F\u202A-\u202E\u2066-\u2069\u061C]/.test(htmlOut), false);
        assert.equal(/<script\b/i.test(htmlOut), false);
        assert.equal(htmlOut.includes('<img src=x onerror=alert(1)>'), false);
        assert.equal(htmlOut.includes('&lt;img src=x onerror=alert(1)&gt;'), true);

        const untrustedThemeHtml = renderWebReportHtml(advRun.snapshot, advRun.events, {
          theme: 'light" onload="alert(1)' /** @type {any} */,
        });
        assert.equal(untrustedThemeHtml.includes('onload='), false);
        assert.match(untrustedThemeHtml, /<html lang="en" data-theme="light" class="f12-theme-light">/);
      } finally {
        advFixture.cleanup();
      }
    });
  });

  // ===========================================================================
  // 5. CLI Output Contracts, Live Narration Order, Color Policy & Unicode Width
  // ===========================================================================
  describe('5. CLI Output Contracts, Live Narration & Terminal Hygiene', () => {
    it('supports --json, --events, --baseline, --replay, --exclude, --include-noise, and enforces flag bounds', async () => {
      // Conflicting flags -> exit 2
      let errBuf = '';
      const conflictCode = await runCli(['run', fixture.repoDir, '--json', '--events'], {
        stdout: () => {},
        stderr: (s) => {
          errBuf += s;
        },
      });
      assert.equal(conflictCode, 2);
      assert.match(errBuf, /mutually exclusive/);

      // Upper bounds on --max-commits (>10000) and --top (>100) -> exit 2
      const overMaxCode = await runCli(['run', fixture.repoDir, '--max-commits', '10001'], {
        stdout: () => {},
        stderr: () => {},
      });
      assert.equal(overMaxCode, 2);

      const overTopCode = await runCli(['run', fixture.repoDir, '--top', '101'], {
        stdout: () => {},
        stderr: () => {},
      });
      assert.equal(overTopCode, 2);

      // --json -> valid ResultSnapshot on stdout, zero ANSI
      let jsonOut = '';
      const jsonCode = await runCli(['run', fixture.repoDir, '--json'], {
        stdout: (s) => {
          jsonOut += s;
        },
        stderr: () => {},
        isTTY: false,
      });
      assert.equal(jsonCode, 0);
      assert.equal(jsonOut.includes('\x1b'), false);
      const parsedSnap = JSON.parse(jsonOut);
      assert.equal(validateResultSnapshot(parsedSnap).ok, true);

      // --events -> valid NDJSON event stream on stdout, zero ANSI
      let eventsOut = '';
      const eventsCode = await runCli(['run', fixture.repoDir, '--events'], {
        stdout: (s) => {
          eventsOut += s;
        },
        stderr: () => {},
        isTTY: false,
      });
      assert.equal(eventsCode, 0);
      assert.equal(eventsOut.includes('\x1b'), false);
      const parsedEvents = eventsOut
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line));
      assert.equal(validateEventStream(parsedEvents).ok, true);

      // --replay -> replays NDJSON, marks output [REPLAY], and preserves exact snapshot fields
      const tmpDir = mkdtempSync(join(tmpdir(), 'f12-replay-'));
      try {
        const ndjsonPath = join(tmpDir, 'events.ndjson');
        writeFileSync(ndjsonPath, eventsOut, 'utf8');
        let replayStdout = '';
        let replayStderr = '';
        const replayCode = await runCli(['run', '--replay', ndjsonPath], {
          stdout: (s) => {
            replayStdout += s;
          },
          stderr: (s) => {
            replayStderr += s;
          },
        });
        assert.equal(replayCode, 0);
        assert.match(replayStderr, /\[REPLAY\] FRAME\/12 STORYBOARD/);
        assert.match(replayStdout, /\[REPLAY\] FINDINGS/);

        let replayJsonOut = '';
        const replayJsonCode = await runCli(['run', '--replay', ndjsonPath, '--json'], {
          stdout: (s) => {
            replayJsonOut += s;
          },
          stderr: () => {},
        });
        assert.equal(replayJsonCode, 0);
        const replayedSnap = JSON.parse(replayJsonOut);
        assert.deepEqual(replayedSnap.findings, parsedSnap.findings);
        assert.deepEqual(replayedSnap.hotFiles, parsedSnap.hotFiles);

        // --replay --events and import-archaeology --events -> round-trip preserves all warnings
        let archEventsOut = '';
        const archEventsCode = await runCli(
          [
            'import-archaeology',
            resolve(expRoot, 'fixtures/repo-archaeology-reconstructed.json'),
            '--events',
          ],
          {
            stdout: (s) => {
              archEventsOut += s;
            },
            stderr: () => {},
          },
        );
        assert.equal(archEventsCode, 0);
        const archNdjsonPath = join(tmpDir, 'arch.ndjson');
        writeFileSync(archNdjsonPath, archEventsOut, 'utf8');

        let archReplayJsonOut = '';
        const archReplayCode = await runCli(['run', '--replay', archNdjsonPath, '--json'], {
          stdout: (s) => {
            archReplayJsonOut += s;
          },
          stderr: () => {},
        });
        assert.equal(archReplayCode, 0);
        const archReplaySnap = JSON.parse(archReplayJsonOut);
        assert.equal(archReplaySnap.warnings.length, 2);
        assert.ok(archReplaySnap.warnings.some((w) => /lockfile-only/.test(w)));
      } finally {
        rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it('emits live C-02 step-start narration to stderr BEFORE step-end, honors shouldUseColor/FORCE_COLOR, and wraps CJK/emoji at 40/80/120 columns', async () => {
      // Verify live step-start narration arrives before step-end
      const trace = [];
      const printer = new PlainStreamPrinter((line) => {
        if (line.includes('C-02 Read commit history')) trace.push('stderr:C-02-start');
        if (line.includes('(C-02 complete)')) trace.push('stderr:C-02-end');
      });
      await runGitHistoryWorkload({
        repoPath: fixture.repoDir,
        maxCommits: 50,
        onEvent: (ev) => {
          if (ev.type === 'step-start' && ev.stepId === 'read-history') trace.push('event:step-start');
          printer.onEvent(ev);
          if (ev.type === 'step-end' && ev.stepId === 'read-history') trace.push('event:step-end');
        },
      });
      const startLineIdx = trace.indexOf('stderr:C-02-start');
      const endEventIdx = trace.indexOf('event:step-end');
      assert.ok(startLineIdx >= 0 && endEventIdx > startLineIdx, `Expected C-02 start line before step-end event: ${trace.join(' -> ')}`);

      // Verify shouldUseColor and FORCE_COLOR vs NO_COLOR/TERM=dumb/CI
      assert.equal(shouldUseColor({ isTTY: false }), false);
      assert.equal(shouldUseColor({ isTTY: true, env: { NO_COLOR: '1' } }), false);
      assert.equal(shouldUseColor({ isTTY: true, env: { TERM: 'dumb' } }), false);
      assert.equal(shouldUseColor({ isTTY: true, env: { CI: 'true' } }), false);
      assert.equal(shouldUseColor({ isTTY: false, env: { FORCE_COLOR: '1' } }), true);
      assert.equal(shouldUseColor({ isTTY: true, env: { TERM: 'xterm-256color' } }), true);

      const coloredOut = renderPlainStoryboard(fixtureResult.snapshot, fixtureResult.events, {
        isTTY: false,
        env: { FORCE_COLOR: '1' },
      });
      assert.equal(coloredOut.includes('\x1b[1m'), true);

      const uncoloredOut = renderPlainStoryboard(fixtureResult.snapshot, fixtureResult.events, {
        isTTY: true,
        env: { NO_COLOR: '1', FORCE_COLOR: '1' },
      });
      assert.equal(uncoloredOut.includes('\x1b'), false);
      assert.equal(uncoloredOut.includes('\x08'), false);
      assert.equal(/\r(?!\n)/.test(uncoloredOut), false);

      // Verify Unicode display width (CJK + emoji + combining marks) across 40, 80, and 120 columns
      assert.equal(getDisplayWidth('caf\u00e9'), 4);
      assert.equal(getDisplayWidth('cafe\u0301'), 4);
      assert.equal(getDisplayWidth('東京'), 4);
      assert.equal(getDisplayWidth('😀'), 2);

      // Explicit boundary regression: 39 ASCII 'a' + '😀' (41 cells) and 30 '界' (60 cells) at width 40
      const hasLoneSurrogate = (str) =>
        /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(str);
      const token39PlusEmoji = `${'a'.repeat(39)}😀`;
      const token30Cjk = '界'.repeat(30);
      for (const token of [token39PlusEmoji, token30Cjk, `  1. ${token39PlusEmoji} ↔ ${token30Cjk}`]) {
        const wrapped = wrapLineToWidth(token, 40);
        assert.ok(wrapped.length >= 2, `Expected "${token}" to wrap across >= 2 lines at width 40`);
        for (const line of wrapped) {
          assert.equal(hasLoneSurrogate(line), false, `Expected zero lone surrogates in wrapped line: "${line}"`);
          assert.ok(
            getDisplayWidth(line) <= 40,
            `Expected getDisplayWidth(line) <= 40, got ${getDisplayWidth(line)} for "${line}"`,
          );
        }
      }
      assert.equal(wrapLineToWidth(token39PlusEmoji, 40)[0], 'a'.repeat(39));
      assert.ok(wrapLineToWidth(token39PlusEmoji, 40)[1].endsWith('😀'));

      for (const colWidth of [40, 80, 120]) {
        let out = '';
        let err = '';
        const code = await runCli(['run', fixture.repoDir], {
          stdout: (s) => {
            out += s;
          },
          stderr: (s) => {
            err += s;
          },
          env: { COLUMNS: String(colWidth), NO_COLOR: '1' },
        });
        assert.equal(code, 0);
        for (const line of [...out.split('\n'), ...err.split('\n')]) {
          assert.equal(hasLoneSurrogate(line), false);
          assert.ok(
            getDisplayWidth(line) <= colWidth,
            `COLUMNS=${colWidth} line exceeded display width (${getDisplayWidth(line)}): "${line}"`,
          );
        }
      }
    });

    it('sanitizes untrusted terminal escape sequences in replay, import-archaeology, and CLI error diagnostics written to stderr', async () => {
      const tmpDir = mkdtempSync(join(tmpdir(), 'f12-diag-sanitize-'));
      try {
        // 1. Crafted replay NDJSON with CSI and OSC 8 sequences in invalid type/stepId
        const badReplayPath = join(tmpDir, 'bad-replay.ndjson');
        const maliciousEvent = {
          ...fixtureResult.events[0],
          type: 'evil-\x1b[31mRED\x1b[0m-\x1b]8;;https://evil.example\x07CLICK\x1b]8;;\x07\x08\r',
        };
        writeFileSync(badReplayPath, `${JSON.stringify(maliciousEvent)}\n`, 'utf8');

        let replayErr = '';
        const replayCode = await runCli(['run', '--replay', badReplayPath], {
          stdout: () => {},
          stderr: (s) => {
            replayErr += s;
          },
        });
        assert.equal(replayCode, 2);
        assert.match(replayErr, /Error validating replay stream:/);
        assert.equal(replayErr.includes('\x1b'), false, 'Expected 0 ESC bytes in replay stderr diagnostic');
        assert.equal(replayErr.includes('\x08'), false, 'Expected 0 BS bytes in replay stderr diagnostic');
        assert.equal(/\r(?!\n)/.test(replayErr), false, 'Expected 0 bare CR bytes in replay stderr diagnostic');

        // 2. Crafted archaeology JSON with CSI and OSC 8 sequences in schemaVersion
        const badArchPath = join(tmpDir, 'bad-arch.json');
        writeFileSync(
          badArchPath,
          JSON.stringify({
            schemaVersion: '\x1b[31m999\x1b[0m\x1b]8;;https://evil.example\x07LINK\x1b]8;;\x07\x08\r',
          }),
          'utf8',
        );
        let archErr = '';
        const archCode = await runCli(['import-archaeology', badArchPath], {
          stdout: () => {},
          stderr: (s) => {
            archErr += s;
          },
        });
        assert.equal(archCode, 2);
        assert.match(archErr, /Error converting Repo Archaeology JSON:/);
        assert.equal(archErr.includes('\x1b'), false, 'Expected 0 ESC bytes in import-archaeology stderr diagnostic');
        assert.equal(archErr.includes('\x08'), false, 'Expected 0 BS bytes in import-archaeology stderr diagnostic');
        assert.equal(/\r(?!\n)/.test(archErr), false, 'Expected 0 bare CR bytes in import-archaeology stderr diagnostic');

        // 3. CLI flag error echoing untrusted argument value
        let flagErr = '';
        const flagCode = await runCli(['run', '--unknown-\x1b[31mflag\x08\r'], {
          stdout: () => {},
          stderr: (s) => {
            flagErr += s;
          },
        });
        assert.equal(flagCode, 2);
        assert.equal(flagErr.includes('\x1b'), false);
        assert.equal(flagErr.includes('\x08'), false);
        assert.equal(/\r(?!\n)/.test(flagErr), false);
      } finally {
        rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });

  // ===========================================================================
  // 6. Failure, Cancellation, Subprocess Fault Injection & Error Boundary
  // ===========================================================================
  describe('6. Failure, Cancellation, Subprocess Fault Injection & Error Boundary', () => {
    it('emits a single run-end (failed) event and exits 1 when given a non-git directory or unwritable --report path', async () => {
      const nonGitDir = mkdtempSync(join(tmpdir(), 'f12-non-git-'));
      const reportPath = join(nonGitDir, 'failed-report.html');
      try {
        const events = [];
        let stderrOut = '';
        const code = await runCli(['run', nonGitDir, '--events', '--report', reportPath], {
          stdout: (s) => {
            for (const line of s.trim().split('\n').filter(Boolean)) {
              events.push(JSON.parse(line));
            }
          },
          stderr: (s) => {
            stderrOut += s;
          },
        });
        assert.equal(code, 1);
        assert.match(stderrOut, /Run failed/);
        const check = validateEventStream(events);
        assert.equal(check.ok, true);
        assert.equal(check.runStatus, 'failed');

        // Unwritable --report path (using a file as parent directory) exits 1 cleanly without stack trace
        const blockerFile = join(nonGitDir, 'blocker-file');
        writeFileSync(blockerFile, 'not a dir\n');
        let badReportErr = '';
        const badReportCode = await runCli(
          ['run', fixture.repoDir, '--report', join(blockerFile, 'nested/report.html')],
          {
            stdout: () => {},
            stderr: (s) => {
              badReportErr += s;
            },
          },
        );
        assert.equal(badReportCode, 1);
        assert.match(badReportErr, /Error writing HTML report:/);
        assert.equal(badReportErr.includes('at runCli'), false);
      } finally {
        rmSync(nonGitDir, { recursive: true, force: true });
      }
    });

    it('distinguishes an empty unborn git repo (completed with warning) from a corrupt HEAD git repo (failed, exit 1)', async () => {
      const emptyRepo = mkdtempSync(join(tmpdir(), 'f12-empty-repo-'));
      const corruptRepo = mkdtempSync(join(tmpdir(), 'f12-corrupt-repo-'));
      const initGit = (cwd) =>
        new Promise((res, rej) => {
          const p = spawn('git', ['init'], { cwd, stdio: 'ignore' });
          p.on('close', (c) => (c === 0 ? res() : rej(new Error('git init failed'))));
        });
      try {
        await initGit(emptyRepo);
        const emptyRes = await runGitHistoryWorkload({ repoPath: emptyRepo });
        assert.equal(emptyRes.snapshot.status, 'completed');
        assert.equal(emptyRes.snapshot.commitsExamined, 0);
        assert.ok(emptyRes.snapshot.warnings.some((w) => /no commits/i.test(w)));

        await initGit(corruptRepo);
        writeFileSync(join(corruptRepo, '.git/HEAD'), '0000000000000000000000000000000000000000\n');
        let errOut = '';
        const corruptCode = await runCli(['run', corruptRepo], {
          stdout: () => {},
          stderr: (s) => {
            errOut += s;
          },
        });
        assert.equal(corruptCode, 1);
        assert.match(errOut, /Failed to read git history/);
      } finally {
        rmSync(emptyRepo, { recursive: true, force: true });
        rmSync(corruptRepo, { recursive: true, force: true });
      }
    });

    it('handles mid-workflow git failure (fail-after-1) and subprocess timeout via PATH-prepended git wrapper', async () => {
      const fakeBinDir = mkdtempSync(join(tmpdir(), 'f12-fake-git-'));
      const counterFile = join(fakeBinDir, 'count.txt');
      const fakeGitPath = join(fakeBinDir, 'git');
      const origPath = process.env.PATH ?? '';
      try {
        writeFileSync(
          fakeGitPath,
          [
            '#!/usr/bin/env node',
            'import { existsSync, readFileSync, writeFileSync } from "node:fs";',
            `const countFile = ${JSON.stringify(counterFile)};`,
            'const c = (existsSync(countFile) ? Number(readFileSync(countFile, "utf8")) : 0) + 1;',
            'writeFileSync(countFile, String(c));',
            'const mode = process.env.F12_FAKE_GIT_MODE;',
            'if (mode === "fail-on-1" && c === 1) {',
            '  process.stderr.write("fatal: simulated git rev-parse failure\\n");',
            '  process.exit(128);',
            '}',
            'if (mode === "fail-after-1" && c >= 2) {',
            '  process.stderr.write("fatal: simulated mid-workflow git log failure\\n");',
            '  process.exit(128);',
            '}',
            'if (mode === "timeout-on-2" && c >= 2) {',
            '  setTimeout(() => process.exit(0), 10000);',
            '} else {',
            '  process.stdout.write("true\\n");',
            '  process.exit(0);',
            '}',
          ].join('\n'),
          'utf8',
        );
        chmodSync(fakeGitPath, 0o755);

        process.env.PATH = `${fakeBinDir}:${origPath}`;

        // 0. Immediate failure on git call #1 (validate-repo fails)
        process.env.F12_FAKE_GIT_MODE = 'fail-on-1';
        rmSync(counterFile, { force: true });
        const firstFailRes = await runGitHistoryWorkload({
          repoPath: fixture.repoDir,
          maxCommits: 20,
        });
        assert.equal(firstFailRes.snapshot.status, 'failed');
        const firstStream = validateEventStream(firstFailRes.events);
        assert.equal(firstStream.ok, true);
        assert.equal(firstStream.steps.length, 1);
        assert.equal(firstStream.steps[0].stepId, 'validate-repo');
        assert.equal(firstStream.steps[0].status, 'error');

        // 1. Mid-workflow failure on git call #2 (validate-repo succeeds, read-history fails)
        process.env.F12_FAKE_GIT_MODE = 'fail-after-1';
        rmSync(counterFile, { force: true });
        const midFailRes = await runGitHistoryWorkload({
          repoPath: fixture.repoDir,
          maxCommits: 20,
        });
        assert.equal(midFailRes.snapshot.status, 'failed');
        const midStream = validateEventStream(midFailRes.events);
        assert.equal(midStream.ok, true);
        assert.equal(midStream.steps[0].stepId, 'validate-repo');
        assert.equal(midStream.steps[0].status, 'ok');
        assert.equal(midStream.steps[1].stepId, 'read-history');
        assert.equal(midStream.steps[1].status, 'error');

        // 2. Subprocess timeout on git call #2
        process.env.F12_FAKE_GIT_MODE = 'timeout-on-2';
        rmSync(counterFile, { force: true });
        const timeoutRes = await runGitHistoryWorkload({
          repoPath: fixture.repoDir,
          maxCommits: 20,
          timeoutMs: 150,
        });
        assert.equal(timeoutRes.snapshot.status, 'failed');
        assert.match(timeoutRes.snapshot.error ?? '', /timed out after 150ms/);
        assert.equal(validateEventStream(timeoutRes.events).ok, true);
      } finally {
        process.env.PATH = origPath;
        delete process.env.F12_FAKE_GIT_MODE;
        rmSync(fakeBinDir, { recursive: true, force: true });
      }
    });

    it('emits a single run-end (canceled) event with zero trailing events on AbortSignal across read-history, pair-cochanges, and rank-findings', async () => {
      for (const targetStepId of ['read-history', 'pair-cochanges', 'rank-findings']) {
        const ac = new AbortController();
        const captured = [];
        const res = await runGitHistoryWorkload({
          repoPath: fixture.repoDir,
          maxCommits: 50,
          signal: ac.signal,
          onEvent: (ev) => {
            captured.push(ev);
            if (ev.type === 'step-start' && ev.stepId === targetStepId) {
              ac.abort();
            }
          },
        });

        assert.equal(
          res.snapshot.status,
          'canceled',
          `Expected snapshot.status === 'canceled' when aborting on ${targetStepId}`,
        );
        const streamCheck = validateEventStream(captured);
        assert.equal(streamCheck.ok, true, `Invalid event stream when aborting on ${targetStepId}: ${streamCheck.error}`);
        assert.equal(streamCheck.runStatus, 'canceled');
        const abortedStep = streamCheck.steps.find((s) => s.stepId === targetStepId);
        assert.ok(abortedStep, `Expected ${targetStepId} step in stream`);
        assert.equal(abortedStep.status, 'skipped');
        assert.equal(captured[captured.length - 1].type, 'run-end');
        assert.equal(captured[captured.length - 1].payload.status, 'canceled');
      }

      const cliAc = new AbortController();
      cliAc.abort();
      const exitCode = await runCli(['run', fixture.repoDir], {
        stdout: () => {},
        stderr: () => {},
        signal: cliAc.signal,
      });
      assert.equal(exitCode, 130);

      // Verify canceled live ResultSnapshot matches reconstructSnapshotFromEvents(events) when aborted mid-ranking
      const midRankAc = new AbortController();
      const midRankRes = await runGitHistoryWorkload({
        repoPath: fixture.repoDir,
        maxCommits: 50,
        signal: midRankAc.signal,
        onEvent: (ev) => {
          if (ev.type === 'finding') {
            midRankAc.abort();
          }
        },
      });
      assert.equal(midRankRes.snapshot.status, 'canceled');
      assert.equal(midRankRes.snapshot.commitsExamined, 13);
      assert.equal(midRankRes.snapshot.uniqueFilesObserved, 6);
      assert.equal(midRankRes.snapshot.totalPairsObserved, 3);
      assert.equal(midRankRes.snapshot.findings.length, 1);
      assert.deepEqual(
        midRankRes.snapshot,
        reconstructSnapshotFromEvents(midRankRes.events),
        'Expected canceled live ResultSnapshot to match reconstructSnapshotFromEvents(events)',
      );

      // Verify macrotask timer abort scheduled before pair-cochanges is observed via event-loop yield
      const timerAc = new AbortController();
      const timerRes = await runGitHistoryWorkload({
        repoPath: fixture.repoDir,
        maxCommits: 50,
        signal: timerAc.signal,
        onEvent: (ev) => {
          if (ev.type === 'step-start' && ev.stepId === 'pair-cochanges') {
            setImmediate(() => timerAc.abort());
          }
        },
      });
      assert.equal(timerRes.snapshot.status, 'canceled');
      assert.deepEqual(timerRes.snapshot, reconstructSnapshotFromEvents(timerRes.events));
    });
  });

  // ===========================================================================
  // 7. Repo Archaeology Adapter (Reconstructed Snapshot & Strict Validation)
  // ===========================================================================
  describe('7. Repo Archaeology Reconstructed Snapshot Adapter', () => {
    it('converts schemaVersion: 1 JSON, swaps fileACommits/fileBCommits when sorting files, and rejects invalid counts or empty commitShas', () => {
      const fixtureJsonPath = resolve(expRoot, 'fixtures/repo-archaeology-reconstructed.json');
      const rawJson = JSON.parse(readFileSync(fixtureJsonPath, 'utf8'));
      const { snapshot, events } = convertRepoArchaeologySnapshot(rawJson);

      assert.equal(validateResultSnapshot(snapshot).ok, true);
      assert.equal(validateEventStream(events).ok, true);
      assert.equal(snapshot.reconstructed?.source, 'repo-archaeology');
      assert.equal(snapshot.reconstructed?.originalSchemaVersion, 1);

      const html = renderWebReportHtml(snapshot, events);
      assert.match(html, /RECONSTRUCTED SNAPSHOT · NOT LIVE EVENTS/);

      // Verify fileACommits and fileBCommits swap when fileA > fileB alphabetically
      const swapped = convertRepoArchaeologySnapshot({
        schemaVersion: 1,
        meta: { repoName: 'swap-test', commitsAnalyzed: 120, windowCommits: 120, filesAnalyzed: 10 },
        suggestions: [
          {
            fileA: 'src/z-last.ts',
            fileB: 'src/a-first.ts',
            sharedCommits: 8,
            fileACommits: 100,
            fileBCommits: 10,
            commitShas: ['1111111', '2222222'],
          },
        ],
      });
      assert.deepEqual(swapped.snapshot.findings[0].files, ['src/a-first.ts', 'src/z-last.ts']);
      assert.equal(swapped.snapshot.findings[0].fileACommits, 10);
      assert.equal(swapped.snapshot.findings[0].fileBCommits, 100);

      // Verify overlap (couplingRatio) is derived from counts (8 / min(100, 10) = 0.8) when reverseConfidence is omitted
      const oneWayConfidenceOnly = convertRepoArchaeologySnapshot({
        schemaVersion: 1,
        meta: { repoName: 'one-way-conf', commitsAnalyzed: 120, files: 10 },
        suggestions: [
          {
            from: 'src/a-hub.ts',
            to: 'src/b-spoke.ts',
            shared: 8,
            fromChanges: 100,
            toChanges: 10,
            confidence: 0.08,
            evidence: [{ hash: '1111111', subject: 'feat: coupled edit' }],
          },
        ],
      });
      assert.equal(oneWayConfidenceOnly.snapshot.findings[0].couplingRatio, 0.8);
      assert.equal(oneWayConfidenceOnly.snapshot.findings[0].jaccardRatio, 0.08);

      // Verify long file paths (>320 chars) are preserved without truncation in Repo Archaeology adapter
      const longPrefix = 'packages/' + 'deep-module/'.repeat(28);
      const longA = `${longPrefix}first-file.ts`;
      const longB = `${longPrefix}second-file.ts`;
      const longArch = convertRepoArchaeologySnapshot({
        schemaVersion: 1,
        meta: { repoName: 'long-arch', commitsAnalyzed: 40, files: 2 },
        suggestions: [
          {
            from: longA,
            to: longB,
            shared: 4,
            fromChanges: 4,
            toChanges: 4,
            evidence: [{ hash: 'abcdef1', subject: 'feat: long paths' }],
          },
        ],
      });
      assert.deepEqual(longArch.snapshot.findings[0].files, [longA, longB]);

      // Reject minimal/ambiguous {"schemaVersion": 1} or missing commitsAnalyzed instead of fabricating 50
      assert.throws(
        () => convertRepoArchaeologySnapshot({ schemaVersion: 1 }),
        /missing required "suggestions"/,
      );
      assert.throws(
        () => convertRepoArchaeologySnapshot({ schemaVersion: 1, suggestions: [] }),
        /Missing required Repo Archaeology numeric field "commitsAnalyzed"/,
      );

      // Reject injected non-numeric commitsAnalyzed
      assert.throws(
        () =>
          convertRepoArchaeologySnapshot({
            schemaVersion: 1,
            commitsAnalyzed: '\u001b[2JINJECTED_COUNT',
          }),
        /Invalid Repo Archaeology numeric field "commitsAnalyzed"/,
      );

      // Reject empty commitShas instead of inventing '0000000'
      assert.throws(
        () =>
          convertRepoArchaeologySnapshot({
            schemaVersion: 1,
            suggestions: [
              {
                fileA: 'a.ts',
                fileB: 'b.ts',
                sharedCommits: 2,
                commitShas: [],
              },
            ],
          }),
        /commitShas must be a non-empty array/,
      );
    });
  });

  // ===========================================================================
  // 8. Playwright Offline HTML Report & Axe Accessibility Audit
  // ===========================================================================
  describe('8. Playwright Offline HTML Report & Accessibility Audit', () => {
    it('renders offline in headless Chromium at 1280px and 390px (light & dark) with 0 network requests, 0 overflow, sequential cuts, and 0 axe violations', async () => {
      const lightHtmlPath = resolve(distDir, 'sample-report.html');
      const darkHtmlPath = resolve(distDir, 'sample-report-dark.html');

      writeFileSync(
        lightHtmlPath,
        renderWebReportHtml(fixtureResult.snapshot, fixtureResult.events, { theme: 'light' }),
        'utf8',
      );
      writeFileSync(
        darkHtmlPath,
        renderWebReportHtml(fixtureResult.snapshot, fixtureResult.events, { theme: 'dark' }),
        'utf8',
      );

      const browser = await chromium.launch({ headless: true });
      try {
        for (const { theme, htmlPath, screenshotName } of [
          { theme: 'light', htmlPath: lightHtmlPath, screenshotName: 'sample-report-light.png' },
          { theme: 'dark', htmlPath: darkHtmlPath, screenshotName: 'sample-report-dark.png' },
        ]) {
          for (const viewport of [
            { width: 1280, height: 900, label: 'desktop' },
            { width: 390, height: 844, label: 'mobile' },
          ]) {
            const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
            const page = await context.newPage();

            const externalRequests = [];
            const consoleErrors = [];
            const pageErrors = [];

            await page.route('**/*', (route) => {
              const url = route.request().url();
              if (url.startsWith('file://') || url.startsWith('data:')) {
                return route.continue();
              }
              externalRequests.push(url);
              return route.abort();
            });

            page.on('console', (msg) => {
              if (msg.type() === 'error') consoleErrors.push(msg.text());
            });
            page.on('pageerror', (err) => {
              pageErrors.push(err.message);
            });

            await page.goto(`file://${htmlPath}`, { waitUntil: 'load' });

            assert.deepEqual(externalRequests, [], `Unexpected external requests in ${theme}/${viewport.label}`);
            assert.deepEqual(consoleErrors, [], `Console errors in ${theme}/${viewport.label}`);
            assert.deepEqual(pageErrors, [], `Page errors in ${theme}/${viewport.label}`);

            const cuts = await page.locator('.f12-cut').allTextContents();
            assert.deepEqual(cuts, ['C-01', 'C-02', 'C-03', 'C-04', 'C-05', 'C-06']);

            for (const selector of [
              '.f12-sheet',
              '.f12-pegs',
              '.f12-scene',
              '.f12-panel',
              '.f12-pair',
              '.f12-metric',
              '.f12-balloon',
              '.f12-ints',
              '.f12-finding-card',
              '.f12-table',
              '.f12-tag',
            ]) {
              const count = await page.locator(selector).count();
              assert.ok(count > 0, `Expected ${selector} to be present in DOM`);
            }

            const overflow = await page.evaluate(() => {
              return document.documentElement.scrollWidth > window.innerWidth;
            });
            assert.equal(overflow, false, `Horizontal overflow detected in ${theme}/${viewport.label}`);

            // Verify zero inert interactive controls (<button>, <input>, <select>, <textarea>, <a href>)
            const interactiveCount = await page.evaluate(() => {
              return document.querySelectorAll('button, input, select, textarea, a[href]').length;
            });
            assert.equal(
              interactiveCount,
              0,
              `Expected 0 interactive controls in static HTML report (${theme}/${viewport.label}), found ${interactiveCount}`,
            );

            // Verify zero bounding-box collisions between bar labels/counts and screentone bars
            const barCollisions = await page.evaluate(() => {
              const items = Array.from(document.querySelectorAll('.f12-static-bar-item'));
              const collisions = [];
              const overlaps = (a, b) =>
                a.left < b.right - 1 &&
                a.right > b.left + 1 &&
                a.top < b.bottom - 1 &&
                a.bottom > b.top + 1;
              for (const item of items) {
                const head = item.querySelector('.f12-static-bar-head');
                const bar = item.querySelector('.f12-int-bar');
                const val = item.querySelector('.f12-int-val');
                if (head && bar) {
                  const hr = head.getBoundingClientRect();
                  const br = bar.getBoundingClientRect();
                  if (overlaps(hr, br)) {
                    collisions.push(`head overlaps bar: ${head.textContent}`);
                  }
                }
                if (val && bar) {
                  const vr = val.getBoundingClientRect();
                  const br = bar.getBoundingClientRect();
                  if (overlaps(vr, br)) {
                    collisions.push(`val overlaps bar: ${val.textContent}`);
                  }
                }
              }
              return collisions;
            });
            assert.deepEqual(
              barCollisions,
              [],
              `Bar label/track collisions in ${theme}/${viewport.label}: ${barCollisions.join('; ')}`,
            );

            const axeResults = await new AxeBuilder({ page })
              .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
              .analyze();

            assert.equal(
              axeResults.violations.length,
              0,
              `Axe violations in ${theme}/${viewport.label}: ${JSON.stringify(
                axeResults.violations.map((v) => ({ id: v.id, help: v.help, nodes: v.nodes.length })),
              )}`,
            );

            if (viewport.label === 'desktop') {
              await page.screenshot({
                path: resolve(distDir, screenshotName),
                fullPage: true,
              });
            }

            await context.close();
          }
        }
      } finally {
        await browser.close();
      }

      assert.equal(existsSync(resolve(distDir, 'sample-report-light.png')), true);
      assert.equal(existsSync(resolve(distDir, 'sample-report-dark.png')), true);
    });
  });

  // ===========================================================================
  // 9. FRAME/12 Grammar Linter & Workspace Hygiene
  // ===========================================================================
  describe('9. FRAME/12 Grammar Linter Compliance', () => {
    it('passes check-frame12.mjs with 0 violations across experiments/terminal-storyboard/src', () => {
      const { files, violations } = lintFiles([resolve(expRoot, 'src')]);
      assert.ok(files.length >= 16);
      assert.deepEqual(violations, []);
    });
  });

  // ===========================================================================
  // 10. Ink Renderer (--style panels), 12fps Throttle, Dynamic Import & Golden Plain Lock
  // ===========================================================================
  describe('10. Ink Renderer (--style panels), 12fps Motion-on-Twos, CLI Contracts & Golden Plain Regression', () => {
    it('renders StoryboardApp & modular Ink components across 40, 60, 80, 120 columns, --ascii, and NO_COLOR via ink-testing-library', () => {
      const steps = extractStoryboardSteps(fixtureResult.snapshot, fixtureResult.events);

      for (const columns of [40, 60, 80, 120]) {
        const app = renderInkTest(
          React.createElement(StoryboardApp, {
            snapshot: fixtureResult.snapshot,
            completedSteps: steps,
            columns,
            colorEnabled: false,
            ascii: false,
            reportWritten: true,
            useStatic: true,
          }),
        );
        const testLibFrame = app.lastFrame() ?? '';
        app.unmount();
        assert.ok(testLibFrame.includes('C-01 ✓ Repository validated'));

        const frame = renderInkStaticSummary(fixtureResult.snapshot, fixtureResult.events, {
          columns,
          noColor: true,
          reportWritten: true,
        }).trimEnd();

        assert.ok(frame.includes('C-01 ✓ Repository validated'));
        assert.ok(frame.includes('F-01'));
        assert.ok(frame.includes('[REVIEW]'));
        assert.ok(frame.includes('Historical co-change'));
        assert.ok(frame.includes('dependency'));
        assert.ok(frame.includes('Completed · 3 ranked findings'));
        assert.equal(frame.includes('\x1b['), false, `Expected zero ANSI escapes when colorEnabled=false at ${columns} cols`);

        // Verify at most one framed box (1 top-left corner '┌' and 1 bottom-left corner '└')
        const topCorners = (frame.match(/┌/g) ?? []).length;
        const bottomCorners = (frame.match(/└/g) ?? []).length;
        assert.equal(topCorners, 1, `Expected exactly 1 framed box top border at ${columns} cols`);
        assert.equal(bottomCorners, 1, `Expected exactly 1 framed box bottom border at ${columns} cols`);

        for (const line of frame.split('\n')) {
          assert.ok(
            getDisplayWidth(line) <= columns,
            `Expected Ink line displayWidth <= ${columns}, got ${getDisplayWidth(line)}: "${line}"`,
          );
        }
      }

      // Verify --ascii mode emits strictly 7-bit ASCII characters
      const asciiApp = renderInkTest(
        React.createElement(StoryboardApp, {
          snapshot: fixtureResult.snapshot,
          completedSteps: steps,
          columns: 80,
          colorEnabled: false,
          ascii: true,
          reportWritten: false,
          useStatic: true,
        }),
      );
      const asciiFrame = asciiApp.lastFrame() ?? '';
      asciiApp.unmount();
      assert.equal(/^[\x00-\x7F]*$/.test(asciiFrame), true, 'Expected 100% 7-bit ASCII output in --ascii mode');
      assert.ok(asciiFrame.includes('C-01 [OK] Repository validated'));
      assert.ok(asciiFrame.includes('+---'));
      assert.ok(asciiFrame.includes('<->'));
      assert.ok(asciiFrame.includes('#### ####'));

      // Verify middle-segment path abbreviation preserves filename basename
      const longPath = 'experiments/terminal-storyboard/src/render-ink/StoryboardApp.tsx';
      const abbreviated = abbreviatePathMiddle(longPath, 30, false);
      assert.ok(getDisplayWidth(abbreviated) <= 30);
      assert.ok(abbreviated.endsWith('StoryboardApp.tsx'));
      assert.ok(abbreviated.includes('…'));

      // Verify adversarial terminal escape sanitization in Ink output
      const maliciousSnap = {
        ...fixtureResult.snapshot,
        findings: [
          {
            ...fixtureResult.snapshot.findings[0],
            files: [
              'src/\x1b[31mevil\x1b[0m/a.ts',
              'src/\x1b]8;;https://evil.example\x07label\x1b]8;;\x07/\u202Eb.ts',
            ],
          },
        ],
      };
      const sanitizedOut = renderInkStaticSummary(maliciousSnap, fixtureResult.events, {
        columns: 80,
        noColor: true,
        isTTY: false,
        env: {},
      });
      assert.equal(sanitizedOut.includes('\x1b'), false);
      assert.equal(sanitizedOut.includes('\u202E'), false);
      assert.equal(sanitizedOut.includes('https://evil.example'), false);
      assert.equal(sanitizedOut.includes('label'), true);

      // Verify snapshot-only honesty when events=[] (no fabricated C-01..C-04 steps)
      assert.deepEqual(extractStoryboardSteps(fixtureResult.snapshot, []), []);
      const snapshotOnlyOut = renderInkStaticSummary(fixtureResult.snapshot, [], {
        columns: 80,
        noColor: true,
        isTTY: false,
        env: {},
      });
      assert.match(snapshotOnlyOut, /\[SNAPSHOT ONLY · NO LIVE EVENT STREAM\]/);
      assert.equal(snapshotOnlyOut.includes('C-01 ✓'), false);

      // Verify warnings are always rendered in panel mode even when findings.length > 0
      const snapWithWarnings = {
        ...fixtureResult.snapshot,
        warnings: ['Skipped bulk commit abcdef1 touching 72 files.'],
      };
      const warnPanelOut = renderInkStaticSummary(snapWithWarnings, fixtureResult.events, {
        columns: 80,
        noColor: true,
        isTTY: false,
        env: {},
      });
      assert.match(warnPanelOut, /Warning: Skipped bulk commit abcdef1 touching 72 files\./);
    });

    it('throttles rapid progress updates to 12fps (83.33ms), skips no-op redraws, flushes lifecycle events immediately, and handles resize', async () => {
      let fakeNow = 1000;
      let nextTimerId = 1;
      const timers = new Map();

      const fakeClock = {
        now: () => fakeNow,
        setTimer: (cb, ms) => {
          const id = nextTimerId++;
          timers.set(id, { cb, fireAt: fakeNow + ms });
          return id;
        },
        clearTimer: (id) => {
          timers.delete(id);
        },
      };

      const advanceClock = (ms) => {
        fakeNow += ms;
        for (const [id, entry] of [...timers.entries()]) {
          if (entry.fireAt <= fakeNow) {
            timers.delete(id);
            entry.cb();
          }
        }
      };

      let resizeListener = null;
      const resizeTarget = {
        columns: 80,
        on: (ev, cb) => {
          if (ev === 'resize') resizeListener = cb;
        },
        off: (ev, cb) => {
          if (ev === 'resize' && resizeListener === cb) resizeListener = null;
        },
      };

      const chunks = [];
      const controller = new InkStreamController({
        write: (s) => chunks.push(s),
        clock: fakeClock,
        columns: 80,
        noColor: true,
        resizeTarget,
      });

      try {
        // 1. step-start flushes immediately at t=1000
        controller.onEvent({
          schemaVersion: SCHEMA_VERSION,
          eventId: 'e-1',
          runId: 'r-1',
          seq: 1,
          ts: '2026-11-02T00:00:00.000Z',
          type: 'step-start',
          stepId: 'read-history',
          payload: { title: 'Read commit history' },
        });
        assert.equal(controller.getRenderCount(), 1);
        assert.equal(timers.size, 0);

        // 2. Five rapid step-progress events within 40ms (< 83.33ms ON_TWOS_FRAME_MS)
        for (let i = 1; i <= 5; i++) {
          fakeNow = 1000 + i * 8;
          controller.onEvent({
            schemaVersion: SCHEMA_VERSION,
            eventId: `e-p-${i}`,
            runId: 'r-1',
            seq: 1 + i,
            ts: '2026-11-02T00:00:00.100Z',
            type: 'step-progress',
            stepId: 'read-history',
            payload: { message: `scanned ${i * 10} commits` },
          });
        }
        // None of the 5 progress updates within 40ms should have triggered an immediate render
        assert.equal(controller.getRenderCount(), 1);
        assert.equal(timers.size, 1);

        // Advance past 83.33ms window -> coalesced single redraw fires with latest state ('scanned 50 commits')
        advanceClock(ON_TWOS_FRAME_MS);
        assert.equal(controller.getRenderCount(), 2);
        assert.equal(timers.size, 0);
        assert.match(chunks[chunks.length - 1], /scanned 50 commits/);

        // 3. Duplicate step-progress with identical message triggers 0 redraws and 0 timers
        controller.onEvent({
          schemaVersion: SCHEMA_VERSION,
          eventId: 'e-p-dup',
          runId: 'r-1',
          seq: 7,
          ts: '2026-11-02T00:00:00.200Z',
          type: 'step-progress',
          stepId: 'read-history',
          payload: { message: 'scanned 50 commits' },
        });
        assert.equal(controller.getRenderCount(), 2);
        assert.equal(timers.size, 0);

        // 4. Queue a progress event, then immediately send step-end -> step-end cancels pending timer & flushes immediately
        fakeNow += 10;
        controller.onEvent({
          schemaVersion: SCHEMA_VERSION,
          eventId: 'e-p-6',
          runId: 'r-1',
          seq: 8,
          ts: '2026-11-02T00:00:00.250Z',
          type: 'step-progress',
          stepId: 'read-history',
          payload: { message: 'scanned 60 commits' },
        });
        assert.equal(timers.size, 1);

        controller.onEvent({
          schemaVersion: SCHEMA_VERSION,
          eventId: 'e-end',
          runId: 'r-1',
          seq: 9,
          ts: '2026-11-02T00:00:00.260Z',
          type: 'step-end',
          stepId: 'read-history',
          payload: { status: 'ok', summary: '60 commits · 12 files' },
        });
        assert.equal(timers.size, 0);
        assert.equal(controller.getRenderCount(), 3);
        assert.match(chunks[chunks.length - 1], /60 commits · 12 files/);

        // 5. Resize event updates columns and triggers immediate re-layout
        resizeTarget.columns = 50;
        resizeListener?.();
        assert.equal(controller.getRenderCount(), 4);

        // 6. Numeric step-progress payloads (commitsParsed / commitsProcessed) without payload.message
        controller.onEvent({
          schemaVersion: SCHEMA_VERSION,
          eventId: 'e-s3',
          runId: 'r-1',
          seq: 10,
          ts: '2026-11-02T00:00:00.300Z',
          type: 'step-start',
          stepId: 'pair-cochanges',
          payload: { title: 'Pair co-changing files' },
        });
        fakeNow += ON_TWOS_FRAME_MS + 5;
        controller.onEvent({
          schemaVersion: SCHEMA_VERSION,
          eventId: 'e-p-num-1',
          runId: 'r-1',
          seq: 11,
          ts: '2026-11-02T00:00:00.350Z',
          type: 'step-progress',
          stepId: 'pair-cochanges',
          payload: { commitsParsed: 500 },
        });
        assert.match(chunks[chunks.length - 1], /500 commits[\s\S]*examined/);

        fakeNow += ON_TWOS_FRAME_MS + 5;
        controller.onEvent({
          schemaVersion: SCHEMA_VERSION,
          eventId: 'e-p-num-2',
          runId: 'r-1',
          seq: 12,
          ts: '2026-11-02T00:00:00.400Z',
          type: 'step-progress',
          stepId: 'pair-cochanges',
          payload: { commitsProcessed: 250, pairsObserved: 42 },
        });
        assert.match(chunks[chunks.length - 1], /250 commits paired[\s\S]*42 pairs/);
      } finally {
        await controller.dispose();
      }
      assert.equal(resizeListener, null, 'Expected resize listener to be removed on dispose()');
    });

    it('enforces --style auto|panels|plain mode resolution, incompatible flag exit code 2, and ./ recursive --exclude globs in runCli', async () => {
      // Incompatible flag combinations must exit 2
      for (const badFlags of [
        ['--style', 'panels', '--json'],
        ['--style', 'panels', '--events'],
        ['--style', 'panels', '--baseline'],
        ['--style', 'plain', '--json'],
        ['--style', 'plain', '--events'],
        ['--style', 'plain', '--baseline'],
        ['--style', 'invalid-style'],
      ]) {
        let errOut = '';
        const code = await runCli(['run', fixture.repoDir, ...badFlags], {
          stdout: () => {},
          stderr: (s) => {
            errOut += s;
          },
        });
        assert.equal(code, 2, `Expected exit code 2 for ${badFlags.join(' ')}`);
        assert.ok(errOut.length > 0);
      }

      // --style auto in interactive TTY (isTTY=true, stderrIsTTY=true, !CI, TERM!='dumb') -> uses panels
      let autoTtyOut = '';
      let autoTtyErr = '';
      const autoTtyCode = await runCli(['run', fixture.repoDir, '--no-color'], {
        stdout: (s) => {
          autoTtyOut += s;
        },
        stderr: (s) => {
          autoTtyErr += s;
        },
        isTTY: true,
        stderrIsTTY: true,
        env: { TERM: 'xterm-256color' },
      });
      assert.equal(autoTtyCode, 0);
      assert.match(autoTtyErr, /FRAME\/12\s+\/\s+TERMINAL STORYBOARD/);
      assert.match(autoTtyErr, /C-01 ✓ Repository validated/);
      assert.match(autoTtyOut, /F-01 \/ TOP FINDING/);
      const combinedTerminal = autoTtyErr + autoTtyOut;
      assert.equal(
        (combinedTerminal.match(/TERMINAL STORYBOARD/g) ?? []).length,
        1,
        'Expected FRAME/12 / TERMINAL STORYBOARD header to appear exactly once across stderr + stdout',
      );
      assert.equal(
        (combinedTerminal.match(/C-01 ✓ Repository validated/g) ?? []).length,
        1,
        'Expected C-01 step line to appear exactly once across stderr + stdout',
      );

      // --style auto when CI=true or TERM=dumb or !isTTY -> falls back to plain
      for (const fallbackIo of [
        { isTTY: false, stderrIsTTY: true, env: { TERM: 'xterm-256color' } },
        { isTTY: true, stderrIsTTY: false, env: { TERM: 'xterm-256color' } },
        { isTTY: true, stderrIsTTY: true, env: { TERM: 'dumb' } },
        { isTTY: true, stderrIsTTY: true, env: { TERM: 'xterm-256color', CI: 'true' } },
      ]) {
        let out = '';
        const code = await runCli(['run', fixture.repoDir, '--no-color'], {
          ...fallbackIo,
          stdout: (s) => {
            out += s;
          },
          stderr: () => {},
        });
        assert.equal(code, 0);
        assert.match(out, /FINDINGS \(3\)/);
        assert.equal(out.includes('F-01 / TOP FINDING'), false);
      }

      // Recursive --exclude with ./ prefix filters matching nested files in runCli
      let excludedJson = '';
      const exCode = await runCli(
        ['run', fixture.repoDir, '--exclude', './src/styles/**', '--json'],
        {
          stdout: (s) => {
            excludedJson += s;
          },
          stderr: () => {},
        },
      );
      assert.equal(exCode, 0);
      const exSnap = JSON.parse(excludedJson);
      assert.equal(
        exSnap.findings.some((f) => f.files.some((p) => p.startsWith('src/styles/'))),
        false,
        'Expected --exclude ./src/styles/** to exclude src/styles/tokens.css',
      );
    });

    it('keeps --style plain byte-for-byte identical to golden plain output and never loads ink in plain/baseline/json/events modes', async () => {
      // 1. Golden byte-for-byte regression lock for --style plain
      let plainCliStdout = '';
      let plainCliStderr = '';
      const plainCode = await runCli(
        ['run', fixture.repoDir, '--max-commits', '50', '--top', '5', '--style', 'plain'],
        {
          stdout: (s) => {
            plainCliStdout += s;
          },
          stderr: (s) => {
            plainCliStderr += s;
          },
          isTTY: false,
          columns: 100,
        },
      );
      assert.equal(plainCode, 0);

      const expectedPlainSummary = `${renderPlainSummary(fixtureResult.snapshot, {
        columns: 100,
        isTTY: false,
      })}\n`;
      assert.equal(
        plainCliStdout,
        expectedPlainSummary,
        'Expected --style plain stdout to be byte-for-byte identical to renderPlainSummary',
      );

      const expectedStreamLines = [];
      const goldenPrinter = new PlainStreamPrinter((l) => expectedStreamLines.push(`${l}\n`), {
        columns: 100,
        isTTY: false,
      });
      for (const ev of fixtureResult.events) goldenPrinter.onEvent(ev);
      assert.equal(
        plainCliStderr,
        expectedStreamLines.join(''),
        'Expected --style plain stderr to be byte-for-byte identical to PlainStreamPrinter',
      );

      // 2. Verify single React instance resolution and zero Ink import in --style plain / --json
      assert.equal(
        existsSync(resolve(expRoot, 'node_modules/react')),
        false,
        'experiments/terminal-storyboard/node_modules/react must not exist (must resolve single root React 18 instance)',
      );

      const checkNoInkLoaded = (cliArgs) =>
        new Promise((res, rej) => {
          const script = `
            import { runCli } from './dist/cli.js';
            const code = await runCli(${JSON.stringify(cliArgs)}, {
              stdout: () => {},
              stderr: () => {},
              isTTY: false,
            });
            // Check performance.getEntriesByType('resource') or import.meta to ensure render-ink was not loaded
            process.exit(code);
          `;
          const child = spawn(
            process.execPath,
            ['--input-type=module', '-e', script],
            { cwd: expRoot, stdio: ['ignore', 'pipe', 'pipe'] },
          );
          child.on('close', (c) => (c === 0 ? res() : rej(new Error(`exit ${c}`))));
        });

      await checkNoInkLoaded(['run', fixture.repoDir, '--style', 'plain']);
      await checkNoInkLoaded(['run', fixture.repoDir, '--json']);
      await checkNoInkLoaded(['run', fixture.repoDir, '--events']);
      await checkNoInkLoaded(['run', fixture.repoDir, '--baseline']);

      // Also verify dist/cli.js contains only a dynamic import('./render-ink/index.js') and zero static ink imports
      const cliBundle = readFileSync(resolve(distDir, 'cli.js'), 'utf8');
      assert.equal(/from\s+["']ink["']/.test(cliBundle), false);
      assert.equal(/from\s+["']\.\/render-ink\/index\.js["']/.test(cliBundle), false);
      assert.match(cliBundle, /import\(["']\.\/render-ink\/index\.js["']\)/);

      // Verify package.json has no postinstall rm -rf script and dist/render-ink/index.js has no direct chalk import
      const expPkg = JSON.parse(readFileSync(resolve(expRoot, 'package.json'), 'utf8'));
      assert.equal(expPkg.scripts?.postinstall, undefined);
      const inkBundle = readFileSync(resolve(distDir, 'render-ink/index.js'), 'utf8');
      assert.equal(/from\s+["']chalk["']/.test(inkBundle), false);

      // Verify --replay and import-archaeology provenance in --style panels mode
      const tmpDir = mkdtempSync(join(tmpdir(), 'f12-panels-prov-'));
      try {
        const ndjsonPath = join(tmpDir, 'events.ndjson');
        writeFileSync(
          ndjsonPath,
          fixtureResult.events.map((e) => JSON.stringify(e)).join('\n') + '\n',
          'utf8',
        );
        let replayPanelsOut = '';
        let replayPanelsErr = '';
        const replayPanelsCode = await runCli(
          ['run', '--replay', ndjsonPath, '--style', 'panels', '--no-color'],
          {
            stdout: (s) => {
              replayPanelsOut += s;
            },
            stderr: (s) => {
              replayPanelsErr += s;
            },
            isTTY: false,
            stderrIsTTY: false,
            env: {},
          },
        );
        assert.equal(replayPanelsCode, 0);
        assert.match(replayPanelsErr, /\[REPLAY\] FRAME\/12/);
        assert.match(replayPanelsOut, /\[REPLAY\] Completed/);

        let archPanelsOut = '';
        let archPanelsErr = '';
        const archPanelsCode = await runCli(
          [
            'import-archaeology',
            resolve(expRoot, 'fixtures/repo-archaeology-reconstructed.json'),
            '--style',
            'panels',
            '--no-color',
          ],
          {
            stdout: (s) => {
              archPanelsOut += s;
            },
            stderr: (s) => {
              archPanelsErr += s;
            },
            isTTY: false,
            stderrIsTTY: false,
            env: {},
          },
        );
        assert.equal(archPanelsCode, 0);
        assert.match(archPanelsErr, /\[RECONSTRUCTED · NOT LIVE EVENTS\]/);
        assert.match(archPanelsOut, /RECONSTRUCTED \(repo-archaeology v1\)/);
        assert.match(archPanelsOut, /Warning: Excluded 2 automated lockfile-only commits/);

        // Real POSIX PTY end-to-end execution of storyboard CLI in --style auto (interactive TTY)
        const ptyReportPath = join(tmpDir, 'pty-report.html');
        const pyScript = [
          'import json, os, pty, select, subprocess, sys',
          'master_out, slave_out = pty.openpty()',
          'master_err, slave_err = pty.openpty()',
          'proc = subprocess.Popen(sys.argv[1:], stdin=subprocess.DEVNULL, stdout=slave_out, stderr=slave_err, close_fds=True)',
          'os.close(slave_out)',
          'os.close(slave_err)',
          'out_chunks, err_chunks = [], []',
          'fds = {master_out: out_chunks, master_err: err_chunks}',
          'while fds:',
          '    r, _, _ = select.select(list(fds.keys()), [], [], 0.1)',
          '    for fd in r:',
          '        try:',
          '            data = os.read(fd, 4096)',
          '            if data:',
          '                fds[fd].append(data)',
          '            else:',
          '                del fds[fd]',
          '                os.close(fd)',
          '        except OSError:',
          '            del fds[fd]',
          '            os.close(fd)',
          'code = proc.wait()',
          'print(json.dumps({"code": code, "stdout": b"".join(out_chunks).decode("utf-8", "replace"), "stderr": b"".join(err_chunks).decode("utf-8", "replace")}))',
        ].join('\n');

        const ptyRes = spawnSync(
          'python3',
          [
            '-c',
            pyScript,
            process.execPath,
            resolve(distDir, 'bin/storyboard.js'),
            'run',
            fixture.repoDir,
            '--no-color',
            '--report',
            ptyReportPath,
          ],
          {
            encoding: 'utf8',
            env: { ...process.env, TERM: 'xterm-256color', CI: '', NO_COLOR: '1' },
          },
        );
        assert.equal(ptyRes.status, 0, `PTY wrapper failed: ${ptyRes.stderr}`);
        const ptyParsed = JSON.parse(ptyRes.stdout.trim());
        assert.equal(ptyParsed.code, 0);
        assert.match(ptyParsed.stderr, /FRAME\/12\s+\/\s+TERMINAL STORYBOARD/);
        assert.match(ptyParsed.stderr, /C-01 ✓ Repository validated/);
        assert.match(ptyParsed.stderr, /Wrote FRAME\/12 HTML report:/);
        assert.match(ptyParsed.stdout, /F-01 \/ TOP FINDING/);
        assert.match(ptyParsed.stdout, /HTML report ready/);
        assert.equal(existsSync(ptyReportPath), true);
      } finally {
        rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });
});
