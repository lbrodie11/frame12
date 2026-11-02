import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
import { runGitHistoryWorkload } from '../dist/workload/git-history.js';
import { convertRepoArchaeologySnapshot } from '../dist/workload/repo-archaeology-adapter.js';
import {
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
    fixture = createFixtureRepo({ includeAdversarial: false });
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
    it('keeps src/model and src/core 100% pure with zero React, fs, child_process, or registry imports', () => {
      const filesToCheck = [
        resolve(expRoot, 'src/model/types.ts'),
        resolve(expRoot, 'src/model/validate.ts'),
        resolve(expRoot, 'src/model/index.ts'),
        resolve(expRoot, 'src/core/types.ts'),
        resolve(expRoot, 'src/core/events.ts'),
        resolve(expRoot, 'src/core/validate.ts'),
        resolve(expRoot, 'src/core/state.ts'),
      ];
      for (const f of filesToCheck) {
        const src = readFileSync(f, 'utf8');
        assert.equal(/\bfrom\s+['"](?:react|react-dom|node:fs|fs|node:child_process|child_process|@\/components\/frame12)/.test(src), false, `Forbidden import in ${f}`);
      }
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

      // Missing run-start at seq=1
      const noStart = validateEventStream([
        { ...baseStart, type: 'step-start', stepId: 'validate-repo', payload: { title: 'Validate' } },
      ]);
      assert.equal(noStart.ok, false);
      assert.match(noStart.error, /First event in stream \(seq=1\) must be "run-start"/);

      // Duplicate eventId
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

      // Out-of-order seq
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

      // step-end for unstarted step
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

    it('[P1-02] rejects malformed finding/metric/warning payloads, unclosed steps at run-end, and NaN/Infinity in ResultSnapshot', () => {
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

      const unclosedStepStream = validateEventStream([
        {
          schemaVersion: SCHEMA_VERSION,
          eventId: 'evt-1',
          runId: 'run-1',
          seq: 1,
          ts: '2026-11-02T00:00:00.000Z',
          type: 'run-start',
          stepId: null,
          payload: { repoLabel: 'test' },
        },
        {
          schemaVersion: SCHEMA_VERSION,
          eventId: 'evt-2',
          runId: 'run-1',
          seq: 2,
          ts: '2026-11-02T00:00:01.000Z',
          type: 'step-start',
          stepId: 'validate-repo',
          payload: { title: 'Validate' },
        },
        {
          schemaVersion: SCHEMA_VERSION,
          eventId: 'evt-3',
          runId: 'run-1',
          seq: 3,
          ts: '2026-11-02T00:00:02.000Z',
          type: 'run-end',
          stepId: null,
          payload: { status: 'completed' },
        },
      ]);
      assert.equal(unclosedStepStream.ok, false);
      assert.match(unclosedStepStream.error, /while steps are still open: validate-repo/);

      const nanSnap = validateResultSnapshot({
        ...fixtureResult.snapshot,
        commitsExamined: Number.NaN,
      });
      assert.equal(nanSnap.ok, false);
      assert.match(nanSnap.error, /finite commitsExamined/);
    });
  });

  // ===========================================================================
  // 2. Deterministic Fixture Workload & Expected Top Pairs
  // ===========================================================================
  describe('2. Deterministic Fixture Workload', () => {
    it('produces exact top co-changing pairs F-01, F-02, F-03 from fixture git history', () => {
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
        assert.equal(actual.evidence.commitShas.length, expCount);
      }
    });

    it('[P1-01] unquotes filenames with quotes/spaces/non-ASCII and excludes skipped bulk commits from couplingRatio denominator', async () => {
      const tmpRepo = mkdtempSync(join(tmpdir(), 'f12-quote-bulk-'));
      const runGitSync = (args) => {
        const p = spawn('git', args, { cwd: tmpRepo, stdio: 'ignore' });
        return new Promise((res, rej) => p.on('close', (c) => (c === 0 ? res() : rej(new Error(`git ${args.join(' ')} failed`)))));
      };
      try {
        await runGitSync(['init']);
        await runGitSync(['config', 'user.name', 'Test']);
        await runGitSync(['config', 'user.email', 'test@example.com']);
        await runGitSync(['config', 'commit.gpgsign', 'false']);

        const fileA = 'src/file with spaces & "quotes".ts';
        const fileB = 'src/unicode-émojî-file.ts';
        mkdirSync(join(tmpRepo, 'src'), { recursive: true });

        // Commit 1: bulk commit touching 52 files including fileA and fileB
        writeFileSync(join(tmpRepo, fileA), 'bulk\n');
        writeFileSync(join(tmpRepo, fileB), 'bulk\n');
        for (let k = 1; k <= 50; k++) {
          writeFileSync(join(tmpRepo, `src/bulk-${k}.ts`), `export const b = ${k};\n`);
        }
        await runGitSync(['add', '.']);
        await runGitSync(['commit', '-m', 'chore: initial bulk commit']);

        // Commits 2 & 3: non-bulk lockstep edits to fileA + fileB
        for (let c = 2; c <= 3; c++) {
          writeFileSync(join(tmpRepo, fileA), `v${c}\n`);
          writeFileSync(join(tmpRepo, fileB), `v${c}\n`);
          await runGitSync(['add', '.']);
          await runGitSync(['commit', '-m', `feat: lockstep ${c}`]);
        }

        const res = await runGitHistoryWorkload({ repoPath: tmpRepo, maxCommits: 20, topN: 5 });
        assert.equal(res.snapshot.status, 'completed');
        assert.equal(res.snapshot.findings.length, 1);
        const top = res.snapshot.findings[0];
        assert.deepEqual(top.files, [fileA, fileB]);
        assert.equal(top.cochangeCount, 2);
        assert.equal(top.fileACommits, 2);
        assert.equal(top.fileBCommits, 2);
        assert.equal(top.couplingRatio, 1);
      } finally {
        rmSync(tmpRepo, { recursive: true, force: true });
      }
    });
  });

  // ===========================================================================
  // 3. Equivalence Across Snapshot, Plain Storyboard, Baseline, and HTML
  // ===========================================================================
  describe('3. Renderer Equivalence (Snapshot vs Plain vs Baseline vs HTML)', () => {
    it('renders identical findings, file pairs, counts, and commit SHAs across all 3 views', () => {
      const { snapshot, events } = fixtureResult;
      const plainText = renderPlainStoryboard(snapshot, events, { columns: 100 });
      const baselineText = renderBaseline(snapshot, { columns: 100 });
      const htmlText = renderWebReportHtml(snapshot, events, { theme: 'light' });

      // Plain storyboard has C-01..C-04 cuts; baseline has zero C-01..C-04 cuts
      assert.match(plainText, /C-01 Validate target repository/);
      assert.match(plainText, /C-04 Rank coupled file pairs/);
      assert.equal(/\bC-01\b/.test(baselineText), false);

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

        // HTML report must contain zero <script tags and must escape malicious <img src=x onerror=...>
        assert.equal(/<script\b/i.test(htmlOut), false);
        assert.equal(htmlOut.includes('<img src=x onerror=alert(1)>'), false);
        assert.equal(htmlOut.includes('&lt;img src=x onerror=alert(1)&gt;'), true);

        // [P1-04] Programmatic theme option is strictly clamped to light|dark to prevent attribute injection
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
  // 5. CLI Output Contracts, Width Wrapping, and Color Policy
  // ===========================================================================
  describe('5. CLI Output Contracts & Terminal Hygiene', () => {
    it('supports --json, --events, --baseline, --replay, and rejects conflicting flags with exit code 2', async () => {
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

      // --replay -> replays NDJSON and marks output as [REPLAY]
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

        // [P1-03] --replay --json preserves exact findings, SHAs, couplingRatio, reason, and hotFiles
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
        assert.equal(replayedSnap.commitsExamined, parsedSnap.commitsExamined);
        assert.equal(replayedSnap.uniqueFilesObserved, parsedSnap.uniqueFilesObserved);
        assert.equal(replayedSnap.totalPairsObserved, parsedSnap.totalPairsObserved);

        // [P1-03] --replay --events and import-archaeology --events emit valid NDJSON to stdout
        let replayEventsOut = '';
        const replayEventsCode = await runCli(['run', '--replay', ndjsonPath, '--events'], {
          stdout: (s) => {
            replayEventsOut += s;
          },
          stderr: () => {},
        });
        assert.equal(replayEventsCode, 0);
        assert.equal(
          validateEventStream(replayEventsOut.trim().split('\n').map((l) => JSON.parse(l))).ok,
          true,
        );

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
        const archEvents = archEventsOut.trim().split('\n').map((l) => JSON.parse(l));
        assert.equal(validateEventStream(archEvents).ok, true);

        // [P1-03] Reject combining positional <repo-path> and --replay
        const bothCode = await runCli(['run', fixture.repoDir, '--replay', ndjsonPath], {
          stdout: () => {},
          stderr: () => {},
        });
        assert.equal(bothCode, 2);
      } finally {
        rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it('enforces NO_COLOR, TERM=dumb, non-TTY, and 40-column narrow width wrapping (including COLUMNS=40 env)', async () => {
      assert.equal(shouldUseColor({ isTTY: false }), false);
      assert.equal(shouldUseColor({ isTTY: true, env: { NO_COLOR: '1' } }), false);
      assert.equal(shouldUseColor({ isTTY: true, env: { TERM: 'dumb' } }), false);
      assert.equal(shouldUseColor({ isTTY: true, noColor: true }), false);
      assert.equal(shouldUseColor({ isTTY: true, env: { TERM: 'xterm-256color' } }), true);

      const wrapped40 = renderPlainStoryboard(fixtureResult.snapshot, fixtureResult.events, {
        columns: 40,
      });
      for (const line of wrapped40.split('\n')) {
        assert.ok(
          line.length <= 40,
          `Line exceeded 40 columns (${line.length} chars): "${line}"`,
        );
      }

      // [P1-03] Verify COLUMNS=40 in env wraps CLI stdout and stderr to <= 40 columns
      let envColStdout = '';
      let envColStderr = '';
      const envColCode = await runCli(['run', fixture.repoDir], {
        stdout: (s) => {
          envColStdout += s;
        },
        stderr: (s) => {
          envColStderr += s;
        },
        env: { COLUMNS: '40' },
      });
      assert.equal(envColCode, 0);
      for (const line of [...envColStdout.split('\n'), ...envColStderr.split('\n')]) {
        assert.ok(line.length <= 40, `COLUMNS=40 line exceeded 40 chars (${line.length}): "${line}"`);
      }
    });
  });

  // ===========================================================================
  // 6. Failure & Cancellation Lifecycle
  // ===========================================================================
  describe('6. Failure & Cancellation Lifecycle', () => {
    it('emits a single run-end (failed) event and exits 1 when given a non-git directory', async () => {
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
        const runEndEvents = events.filter((e) => e.type === 'run-end');
        assert.equal(runEndEvents.length, 1);
        assert.equal(events[events.length - 1].type, 'run-end');

        const html = readFileSync(reportPath, 'utf8');
        assert.match(html, /FAILED/);
      } finally {
        rmSync(nonGitDir, { recursive: true, force: true });
      }
    });

    it('[P1-01] distinguishes an empty unborn git repo (completed with warning) from a corrupt HEAD git repo (failed, exit 1)', async () => {
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

      // Also test CLI exit code 130 when signal is aborted
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
  // 7. Repo Archaeology Adapter (Reconstructed Snapshot)
  // ===========================================================================
  describe('7. Repo Archaeology Reconstructed Snapshot Adapter', () => {
    it('converts schemaVersion: 1 JSON into a ResultSnapshot labeled RECONSTRUCTED', async () => {
      const fixtureJsonPath = resolve(expRoot, 'fixtures/repo-archaeology-reconstructed.json');
      const rawJson = JSON.parse(readFileSync(fixtureJsonPath, 'utf8'));
      const { snapshot, events } = convertRepoArchaeologySnapshot(rawJson);

      assert.equal(validateResultSnapshot(snapshot).ok, true);
      assert.equal(validateEventStream(events).ok, true);
      assert.equal(snapshot.reconstructed?.source, 'repo-archaeology');
      assert.equal(snapshot.reconstructed?.originalSchemaVersion, 1);
      assert.match(snapshot.reconstructed?.note ?? '', /Reconstructed from a completed Repo Archaeology/);

      const html = renderWebReportHtml(snapshot, events);
      assert.match(html, /RECONSTRUCTED SNAPSHOT · NOT LIVE EVENTS/);
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

            // Verify sequential cuts C-01..C-06 in DOM order
            const cuts = await page.locator('.f12-cut').allTextContents();
            assert.deepEqual(cuts, ['C-01', 'C-02', 'C-03', 'C-04', 'C-05', 'C-06']);

            // Verify real FRAME/12 component classes exist
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

            // Check horizontal overflow
            const overflow = await page.evaluate(() => {
              return document.documentElement.scrollWidth > window.innerWidth;
            });
            assert.equal(overflow, false, `Horizontal overflow detected in ${theme}/${viewport.label}`);

            // Run Axe accessibility audit
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
      assert.ok(files.length >= 14);
      assert.deepEqual(violations, []);
    });
  });
});
