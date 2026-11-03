import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
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
import { runGitHistoryWorkload, unquoteGitPath } from '../dist/workload/git-history.js';
import { convertRepoArchaeologySnapshot } from '../dist/workload/repo-archaeology-adapter.js';
import {
  PlainStreamPrinter,
  getDisplayWidth,
  renderBaseline,
  renderPlainStoryboard,
  sanitizeTerminalText,
  shouldUseColor,
} from '../dist/render-plain/index.js';
import { renderWebReportHtml } from '../dist/render-web/index.js';
import { runCli } from '../dist/cli.js';
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
  });

  // ===========================================================================
  // 3. Renderer Equivalence, Snapshot-Only HTML & Direct Imports
  // ===========================================================================
  describe('3. Renderer Equivalence, Snapshot-Only HTML & Bundle Hygiene', () => {
    it('renders identical findings, file pairs, counts, overlap/Jaccard ratios, and commit SHAs across all 3 views', () => {
      const { snapshot, events } = fixtureResult;
      const plainText = renderPlainStoryboard(snapshot, events, { columns: 100 });
      const baselineText = renderBaseline(snapshot, { columns: 100 });
      const htmlText = renderWebReportHtml(snapshot, events, { theme: 'light' });

      assert.match(plainText, /C-01 Validate target repository/);
      assert.match(plainText, /C-04 Rank coupled file pairs/);
      assert.equal(/\bC-01\b/.test(baselineText), false);

      // Both Plain, Baseline, and HTML explicitly label overlap and Jaccard
      assert.match(plainText, /overlap \[shared ÷ commits of less-changed file\]/);
      assert.match(plainText, /Jaccard/);
      assert.match(baselineText, /overlap \[shared ÷ commits of less-changed file\]/);
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
        const plainOut = renderPlainStoryboard(advRun.snapshot, advRun.events, { columns: 100 });
        const baseOut = renderBaseline(advRun.snapshot, { columns: 100 });
        const htmlOut = renderWebReportHtml(advRun.snapshot, advRun.events);

        for (const termOut of [plainOut, baseOut]) {
          assert.equal(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/.test(termOut), false);
          assert.equal(/[\u200E\u200F\u202A-\u202E\u2066-\u2069\u061C]/.test(termOut), false);
          assert.equal(termOut.includes('https://evil.example'), false);
        }

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
          assert.ok(
            getDisplayWidth(line) <= colWidth,
            `COLUMNS=${colWidth} line exceeded display width (${getDisplayWidth(line)}): "${line}"`,
          );
        }
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

    it('emits a single run-end (canceled) event with zero trailing events on AbortSignal / SIGINT', async () => {
      const ac = new AbortController();
      const captured = [];
      const res = await runGitHistoryWorkload({
        repoPath: fixture.repoDir,
        maxCommits: 50,
        signal: ac.signal,
        onEvent: (ev) => {
          captured.push(ev);
          if (ev.type === 'step-start' && ev.stepId === 'read-history') {
            ac.abort();
          }
        },
      });

      assert.equal(res.snapshot.status, 'canceled');
      const streamCheck = validateEventStream(captured);
      assert.equal(streamCheck.ok, true);
      assert.equal(streamCheck.runStatus, 'canceled');
      assert.equal(captured[captured.length - 1].type, 'run-end');

      const cliAc = new AbortController();
      cliAc.abort();
      const exitCode = await runCli(['run', fixture.repoDir], {
        stdout: () => {},
        stderr: () => {},
        signal: cliAc.signal,
      });
      assert.equal(exitCode, 130);
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
      assert.ok(files.length >= 8);
      assert.deepEqual(violations, []);
    });
  });
});
