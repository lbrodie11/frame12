import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { basename, extname, posix, resolve } from 'node:path';
import {
  SCHEMA_VERSION,
  StoryboardStreamValidator,
  type CochangeFinding,
  type EventType,
  type FindingClassification,
  type HotFileSummary,
  type ResultSnapshot,
  type RunEndStatus,
  type StepEndStatus,
  type StoryboardEvent,
} from '../model/index.js';
import { sanitizeTerminalText } from '../render-plain/index.js';

export interface GitHistoryWorkloadOptions {
  repoPath: string;
  maxCommits?: number;
  topN?: number;
  includeNoise?: boolean;
  excludePatterns?: string[];
  timeoutMs?: number;
  signal?: AbortSignal;
  runId?: string;
  onEvent?: (event: StoryboardEvent) => void;
}

interface ParsedCommit {
  sha: string;
  date: string;
  subject: string;
  files: string[];
}

const COMMIT_MARKER = '__F12_COMMIT__\x00';
const MAX_FILES_PER_COMMIT = 50;
const MAX_SUBJECT_CHARS = 200;
export const MAX_FILEPATH_BYTES = 2048;
const MAX_STDERR_BYTES = 65536;

const DEFAULT_NOISE_BASENAMES = new Set<string>([
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lockb',
  'npm-shrinkwrap.json',
  '.gitignore',
  '.DS_Store',
  'tsconfig.tsbuildinfo',
]);

const DEFAULT_NOISE_EXTENSIONS = new Set<string>([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.pdf',
  '.zip',
  '.tar',
  '.gz',
  '.map',
  '.lock',
  '.tsbuildinfo',
]);

const DEFAULT_GENERATED_PREFIXES = [
  'dist/',
  'build/',
  '.next/',
  'node_modules/',
  'coverage/',
  'site/public/r/',
];

const DOC_OR_RELEASE_META_BASENAMES = new Set<string>([
  'readme.md',
  'changelog.md',
  'package.json',
  'license',
  'license.md',
  'contributing.md',
]);

const GENERIC_BARREL_BASENAMES = new Set<string>([
  'index.ts',
  'index.tsx',
  'index.js',
  'index.mjs',
  'route.ts',
  'page.tsx',
  'layout.tsx',
]);

export function truncateText(input: string, maxChars: number): string {
  const normalized = input.normalize('NFC');
  const codePoints = Array.from(normalized);
  if (codePoints.length <= maxChars) return normalized;
  return `${codePoints.slice(0, Math.max(1, maxChars - 1)).join('')}…`;
}

export function validateFilePathLength(filePath: string): string {
  const normalized = filePath.normalize('NFC');
  if (Buffer.byteLength(normalized, 'utf8') > MAX_FILEPATH_BYTES) {
    throw new Error(
      `File path exceeds maximum allowed length of ${MAX_FILEPATH_BYTES} UTF-8 bytes.`,
    );
  }
  return normalized;
}

export function fitFindingToPayloadBudget(finding: CochangeFinding): CochangeFinding {
  let reason = truncateText(finding.reason, 320);
  let sampleSubjects = finding.evidence.sampleSubjects
    .slice(0, 3)
    .map((s) => truncateText(s, MAX_SUBJECT_CHARS));

  let candidate: CochangeFinding = {
    ...finding,
    reason,
    evidence: {
      ...finding.evidence,
      sampleSubjects,
    },
  };

  if (Buffer.byteLength(JSON.stringify({ finding: candidate }), 'utf8') > 7400) {
    sampleSubjects = sampleSubjects.slice(0, 1).map((s) => truncateText(s, 80));
    reason = truncateText(reason, 180);
    candidate = {
      ...finding,
      reason,
      evidence: {
        ...finding.evidence,
        sampleSubjects,
      },
    };
  }
  if (Buffer.byteLength(JSON.stringify({ finding: candidate }), 'utf8') > 7800) {
    sampleSubjects = [];
    reason = truncateText(reason, 120);
    candidate = {
      ...finding,
      reason,
      evidence: {
        ...finding.evidence,
        sampleSubjects,
      },
    };
  }
  return candidate;
}

/**
 * Unquotes a Git C-escaped path (when Git wraps paths containing quotes, tabs,
 * backslashes, or control characters in double quotes) while preserving astral
 * Unicode code points (emoji/CJK), normalizing to NFC, and preserving full path identity.
 */
export function unquoteGitPath(line: string): string {
  const cleaned = line.replace(/\r$/, '');
  if (cleaned.length >= 2 && cleaned.startsWith('"') && cleaned.endsWith('"')) {
    const inner = cleaned.slice(1, -1);
    const bytes: number[] = [];
    for (let i = 0; i < inner.length; ) {
      const ch = inner[i]!;
      if (ch === '\\' && i + 1 < inner.length) {
        const next = inner[i + 1]!;
        if (next >= '0' && next <= '7') {
          let oct = next;
          i += 2;
          if (i < inner.length && inner[i]! >= '0' && inner[i]! <= '7') {
            oct += inner[i]!;
            i += 1;
            if (i < inner.length && inner[i]! >= '0' && inner[i]! <= '7') {
              oct += inner[i]!;
              i += 1;
            }
          }
          bytes.push(parseInt(oct, 8) & 0xff);
          continue;
        }
        const escMap: Record<string, number> = {
          a: 0x07,
          b: 0x08,
          t: 0x09,
          n: 0x0a,
          v: 0x0b,
          f: 0x0c,
          r: 0x0d,
          '"': 0x22,
          '\\': 0x5c,
        };
        if (escMap[next] !== undefined) {
          bytes.push(escMap[next]!);
          i += 2;
          continue;
        }
        const cp = inner.codePointAt(i + 1)!;
        const fullChar = String.fromCodePoint(cp);
        bytes.push(...Buffer.from(fullChar, 'utf8'));
        i += 1 + fullChar.length;
      } else {
        const cp = inner.codePointAt(i)!;
        const fullChar = String.fromCodePoint(cp);
        bytes.push(...Buffer.from(fullChar, 'utf8'));
        i += fullChar.length;
      }
    }
    return validateFilePathLength(Buffer.from(bytes).toString('utf8'));
  }
  return validateFilePathLength(cleaned);
}

export function globToRegExp(pattern: string): RegExp {
  const norm = pattern.trim().replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
  const regexStr = norm
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\/\*\*\//g, '__GLOBSTAR_MID__')
    .replace(/\/\*\*$/g, '__GLOBSTAR_END__')
    .replace(/^\*\*\//g, '__GLOBSTAR_START__')
    .replace(/\*\*/g, '__GLOBSTAR_ANY__')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/__GLOBSTAR_MID__/g, '(?:/.*)?/')
    .replace(/__GLOBSTAR_END__/g, '(?:/.*)?')
    .replace(/__GLOBSTAR_START__/g, '(?:.*/)?')
    .replace(/__GLOBSTAR_ANY__/g, '.*');
  return new RegExp(`^${regexStr}$`);
}

export function matchesPattern(filePath: string, pattern: string): boolean {
  const normPath = filePath.trim().replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
  const normPattern = pattern.trim().replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
  if (!normPattern) return false;
  if (
    normPath === normPattern ||
    normPath.startsWith(normPattern.endsWith('/') ? normPattern : `${normPattern}/`)
  ) {
    return true;
  }
  if (normPattern.includes('*') || normPattern.includes('?')) {
    return globToRegExp(normPattern).test(normPath);
  }
  return posix.basename(normPath) === normPattern || normPath.includes(normPattern);
}

export function isTestOrVerificationPath(filePath: string): boolean {
  const norm = filePath.replace(/\\/g, '/');
  const base = posix.basename(norm);
  if (/(?:^|\/)(?:tests?|__tests__|e2e|spec)\//i.test(norm)) return true;
  if (/\.(?:test|spec|e2e)\.[^.]+$/i.test(base)) return true;
  if (/(?:-|_)(?:test|spec|verify)\.[^.]+$/i.test(base)) return true;
  return false;
}

export function classifyCochangePair(fileA: string, fileB: string): FindingClassification {
  const normA = fileA.replace(/\\/g, '/');
  const normB = fileB.replace(/\\/g, '/');
  const baseA = posix.basename(normA);
  const baseB = posix.basename(normB);
  const lowerA = baseA.toLowerCase();
  const lowerB = baseB.toLowerCase();

  if (isTestOrVerificationPath(normA) || isTestOrVerificationPath(normB)) {
    return 'test-companion';
  }
  if (
    DOC_OR_RELEASE_META_BASENAMES.has(lowerA) ||
    DOC_OR_RELEASE_META_BASENAMES.has(lowerB) ||
    extname(lowerA) === '.md' ||
    extname(lowerB) === '.md'
  ) {
    return 'docs-release';
  }
  if (baseA === baseB && !GENERIC_BARREL_BASENAMES.has(lowerA)) {
    return 'workspace-mirror';
  }
  if (posix.dirname(normA) === posix.dirname(normB)) {
    return 'same-module';
  }
  return 'cross-module';
}

/**
 * Identifies whether a pair is a non-production companion pair (test, docs/release,
 * or exact-basename workspace mirror). Note: full evidence is preserved by default
 * during ranking; use --exclude to filter specific paths.
 */
export function shouldFilterLowSignalPair(
  fileA: string,
  fileB: string,
  includeNoise = false,
): boolean {
  if (includeNoise) return false;
  const kind = classifyCochangePair(fileA, fileB);
  return kind === 'test-companion' || kind === 'docs-release' || kind === 'workspace-mirror';
}

export interface CochangeRelationshipSummary {
  patternLabel: 'Mutual lockstep' | 'One-way dependency' | 'Shared feature surface';
  summary: string;
  actionHint: string;
}

export function describeCochangeRelationship(params: {
  files: [string, string];
  cochangeCount: number;
  fileACommits: number;
  fileBCommits: number;
  jaccardRatio?: number;
  sampleSubjects?: string[];
}): CochangeRelationshipSummary {
  const fileA = sanitizeTerminalText(params.files[0]);
  const fileB = sanitizeTerminalText(params.files[1]);
  const baseA = posix.basename(fileA);
  const baseB = posix.basename(fileB);
  const shared = params.cochangeCount;
  const countA = Math.max(shared, params.fileACommits);
  const countB = Math.max(shared, params.fileBCommits);
  const unionCommits = Math.max(1, countA + countB - shared);
  const jaccard =
    typeof params.jaccardRatio === 'number' && Number.isFinite(params.jaccardRatio)
      ? params.jaccardRatio
      : Math.min(1, Math.round((shared / unionCommits) * 100) / 100);
  const jaccardPct = Math.round(jaccard * 100);

  if (countA === shared && countB === shared) {
    return {
      patternLabel: 'Mutual lockstep',
      summary: `Always modified together across all ${shared} commits (${jaccardPct}% Jaccard); verify shared exports and state before editing either file.`,
      actionHint: `Inspect ${fileB} whenever modifying ${fileA} (both files changed together in ${shared} of ${shared} commits).`,
    };
  }

  if (Math.min(countA, countB) === shared) {
    const isADependent = countA <= countB;
    const depBase = isADependent ? baseA : baseB;
    const depPath = isADependent ? fileA : fileB;
    const hubBase = isADependent ? baseB : baseA;
    const hubPath = isADependent ? fileB : fileA;
    const hubTotal = Math.max(countA, countB);
    const soloCommits = hubTotal - shared;
    return {
      patternLabel: 'One-way dependency',
      summary: `${depBase} never changed without ${hubBase} (${shared}/${shared} commits), while ${hubBase} had ${soloCommits} independent commit${soloCommits === 1 ? '' : 's'} (${shared}/${hubTotal}, ${jaccardPct}% Jaccard).`,
      actionHint: `When editing ${depPath}, always check ${hubPath} for matching schema or contract updates (${shared} of ${hubTotal} combined commits).`,
    };
  }

  return {
    patternLabel: 'Shared feature surface',
    summary: `Modified together in ${shared} of ${unionCommits} combined commits (${jaccardPct}% Jaccard; ${baseA} ${shared}/${countA}, ${baseB} ${shared}/${countB}); check shared interfaces when editing either file.`,
    actionHint: `Review ${fileA} and ${fileB} together when touching shared types, styles, or handlers (${shared} of ${unionCommits} commits).`,
  };
}

export function shouldFilterNoiseFile(
  filePath: string,
  includeNoise = false,
  excludePatterns: string[] = [],
): boolean {
  const norm = filePath.replace(/\\/g, '/');
  for (const pat of excludePatterns) {
    if (matchesPattern(norm, pat)) return true;
  }
  if (includeNoise) return false;

  const base = posix.basename(norm);
  if (DEFAULT_NOISE_BASENAMES.has(base)) return true;

  const ext = extname(base).toLowerCase();
  if (DEFAULT_NOISE_EXTENSIONS.has(ext)) return true;

  for (const prefix of DEFAULT_GENERATED_PREFIXES) {
    if (norm.startsWith(prefix) || norm.includes(`/${prefix}`)) {
      return true;
    }
  }
  return false;
}

function parseCommitRecord(raw: string): ParsedCommit | null {
  const lines = raw.split(/\r?\n/);
  const header = lines.shift();
  if (!header) return null;
  const [sha = '', date = '', subject = ''] = header.split('\x00');
  if (!sha.trim()) return null;
  const files = Array.from(
    new Set(lines.map((l) => unquoteGitPath(l)).filter((l) => l.length > 0)),
  ).sort();
  return {
    sha: truncateText(sha.trim(), 40),
    date: truncateText(date.trim(), 40),
    subject: truncateText(subject.trim(), MAX_SUBJECT_CHARS),
    files,
  };
}

export async function runGitHistoryWorkload(
  options: GitHistoryWorkloadOptions,
): Promise<{ snapshot: ResultSnapshot; events: StoryboardEvent[] }> {
  const resolvedPath = resolve(options.repoPath);
  const repoLabel = truncateText(basename(resolvedPath) || resolvedPath, 80);
  const maxCommits = Math.min(10000, Math.max(1, Math.floor(options.maxCommits ?? 60)));
  const topN = Math.min(100, Math.max(1, Math.floor(options.topN ?? 5)));
  const includeNoise = Boolean(options.includeNoise);
  const excludePatterns = options.excludePatterns ?? [];
  const envTimeout = Number(process.env.F12_GIT_TIMEOUT_MS);
  const timeoutMs =
    options.timeoutMs ?? (Number.isFinite(envTimeout) && envTimeout > 0 ? envTimeout : 30_000);
  const runId = options.runId ?? `run-${Date.now().toString(36)}`;
  const startedAt = new Date().toISOString();
  const validator = new StoryboardStreamValidator();
  const events: StoryboardEvent[] = [];
  const warnings: string[] = [];
  const findings: CochangeFinding[] = [];
  let emittedCommitsExamined = 0;
  let emittedUniqueFilesObserved = 0;
  let emittedTotalPairsObserved = 0;
  let emittedHotFiles: HotFileSummary[] = [];
  let seq = 0;
  let ended = false;
  let activeStep: string | null = null;

  const emit = (type: EventType, stepId: string | null, payload: Record<string, unknown>) => {
    if (ended) return;
    seq += 1;
    const ev: StoryboardEvent = {
      schemaVersion: SCHEMA_VERSION,
      eventId: `evt-${String(seq).padStart(4, '0')}`,
      runId,
      seq,
      ts: new Date().toISOString(),
      type,
      stepId,
      payload,
    };
    const res = validator.push(ev);
    if (!res.ok) throw new Error(`Internal event validation error: ${res.error}`);
    events.push(res.event);
    if (type === 'step-start') activeStep = stepId;
    if (type === 'step-end') activeStep = null;
    if (type === 'run-end') ended = true;
    options.onEvent?.(res.event);
  };

  const finishEarly = (status: RunEndStatus, stepStatus: StepEndStatus, reason: string): ResultSnapshot => {
    const safeReason = truncateText(reason, 300);
    if (activeStep) emit('step-end', activeStep, { status: stepStatus, summary: safeReason });
    emit('run-end', null, {
      status,
      summary: safeReason,
      ...(emittedHotFiles.length > 0 ? { hotFiles: emittedHotFiles } : {}),
      ...(status === 'failed' ? { error: safeReason } : {}),
    });
    return {
      schemaVersion: SCHEMA_VERSION,
      runId,
      status,
      repoLabel,
      startedAt: events[0]?.ts ?? startedAt,
      finishedAt: events[events.length - 1]?.ts ?? new Date().toISOString(),
      maxCommits,
      commitsExamined: emittedCommitsExamined,
      uniqueFilesObserved: emittedUniqueFilesObserved,
      totalPairsObserved: emittedTotalPairsObserved,
      findings,
      hotFiles: emittedHotFiles,
      warnings,
      ...(status === 'failed' ? { error: safeReason } : {}),
    };
  };

  const runGit = (args: string[], onChunk?: (chunk: string) => void) =>
    new Promise<{ code: number; stdout: string; stderr: string; aborted: boolean; timedOut: boolean }>((res) => {
      if (options.signal?.aborted) {
        return res({ code: 130, stdout: '', stderr: 'Aborted', aborted: true, timedOut: false });
      }
      const child = spawn(
        'git',
        [
          '-c',
          'core.quotePath=false',
          '-c',
          'core.precomposeUnicode=true',
          '-C',
          resolvedPath,
          ...args,
        ],
        {
          shell: false,
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      let stdout = '';
      let stderr = '';
      let aborted = false;
      let timedOut = false;
      let killTimer: ReturnType<typeof setTimeout> | null = null;

      const terminateChild = () => {
        try {
          child.kill('SIGTERM');
        } catch {
          // ignore
        }
        if (!killTimer) {
          killTimer = setTimeout(() => {
            try {
              child.kill('SIGKILL');
            } catch {
              // ignore
            }
          }, 200);
          killTimer.unref?.();
        }
      };

      const timeoutTimer = setTimeout(() => {
        timedOut = true;
        terminateChild();
      }, timeoutMs);
      timeoutTimer.unref?.();

      const onAbort = () => {
        aborted = true;
        terminateChild();
      };
      options.signal?.addEventListener('abort', onAbort, { once: true });

      const cleanupTimers = () => {
        clearTimeout(timeoutTimer);
        if (killTimer) clearTimeout(killTimer);
        options.signal?.removeEventListener('abort', onAbort);
      };

      child.stdout.on('data', (str: string) => {
        if (!onChunk && stdout.length < MAX_STDERR_BYTES) stdout += str;
        onChunk?.(str);
      });
      child.stderr.on('data', (str: string) => {
        if (stderr.length < MAX_STDERR_BYTES) {
          stderr += str.slice(0, MAX_STDERR_BYTES - stderr.length);
        }
      });
      child.on('error', (err) => {
        cleanupTimers();
        res({ code: 1, stdout, stderr: err.message, aborted, timedOut });
      });
      child.on('close', (code) => {
        cleanupTimers();
        res({
          code: code ?? 1,
          stdout,
          stderr,
          aborted: aborted || Boolean(options.signal?.aborted),
          timedOut,
        });
      });
    });

  try {
    emit('run-start', null, { repoLabel, repoPath: resolvedPath, maxCommits, topN });
    if (options.signal?.aborted) {
      return { snapshot: finishEarly('canceled', 'skipped', 'Canceled before repo validation'), events };
    }

    // Step 1: validate-repo
    emit('step-start', 'validate-repo', { title: 'Validate target repository', repoLabel });
    if (options.signal?.aborted) {
      return { snapshot: finishEarly('canceled', 'skipped', 'Canceled during repo validation'), events };
    }
    if (!existsSync(resolvedPath)) {
      const msg = `Repository path does not exist: ${resolvedPath}`;
      return { snapshot: finishEarly('failed', 'error', msg), events };
    }
    const revParse = await runGit(['rev-parse', '--is-inside-work-tree']);
    if (revParse.aborted || options.signal?.aborted) {
      return { snapshot: finishEarly('canceled', 'skipped', 'Canceled during repo validation'), events };
    }
    if (revParse.timedOut) {
      return {
        snapshot: finishEarly('failed', 'error', `Git repository validation timed out after ${timeoutMs}ms`),
        events,
      };
    }
    if (revParse.code !== 0 || revParse.stdout.trim() !== 'true') {
      const msg = `Not a valid git repository (${resolvedPath}): ${revParse.stderr.trim() || 'git rev-parse failed'}`;
      return { snapshot: finishEarly('failed', 'error', msg), events };
    }
    emit('step-end', 'validate-repo', { status: 'ok', summary: `repo: ${repoLabel}` });
    if (options.signal?.aborted) {
      return { snapshot: finishEarly('canceled', 'skipped', 'Canceled before reading git history'), events };
    }

    // Step 2: read-history
    emit('step-start', 'read-history', { title: 'Read commit history', maxCommits });
    if (options.signal?.aborted) {
      return { snapshot: finishEarly('canceled', 'skipped', 'Canceled while reading git history'), events };
    }
    const commits: ParsedCommit[] = [];
    let carry = '';
    let lastProgressCommits = 0;
    let lastProgressTime = Date.now();
    let emittedInitialProgress = false;

    const logRes = await runGit(
      ['log', '--no-color', `-n`, String(maxCommits), '--pretty=format:__F12_COMMIT__%x00%h%x00%aI%x00%s', '--name-only'],
      (chunk) => {
        carry += chunk;
        const parts = carry.split(COMMIT_MARKER);
        carry = parts.pop() ?? '';
        for (const part of parts) {
          const parsed = parseCommitRecord(part);
          if (parsed) commits.push(parsed);
        }
        const now = Date.now();
        if (
          parts.length > 0 &&
          !options.signal?.aborted &&
          (!emittedInitialProgress ||
            commits.length - lastProgressCommits >= 250 ||
            now - lastProgressTime >= 1000)
        ) {
          emittedInitialProgress = true;
          lastProgressCommits = commits.length;
          lastProgressTime = now;
          emit('step-progress', 'read-history', { commitsParsed: commits.length });
        }
      },
    );
    if (logRes.aborted || options.signal?.aborted) {
      return { snapshot: finishEarly('canceled', 'skipped', 'Canceled while reading git history'), events };
    }
    if (logRes.timedOut) {
      return {
        snapshot: finishEarly('failed', 'error', `Reading git history timed out after ${timeoutMs}ms`),
        events,
      };
    }
    if (carry.trim()) {
      for (const part of carry.split(COMMIT_MARKER)) {
        const parsed = parseCommitRecord(part);
        if (parsed) commits.push(parsed);
      }
    }
    const isUnbornEmptyRepo =
      logRes.code !== 0 &&
      commits.length === 0 &&
      /does not have any commits yet/i.test(logRes.stderr);
    if (logRes.code !== 0 && !isUnbornEmptyRepo) {
      const msg = `Failed to read git history (${resolvedPath}): ${logRes.stderr.trim() || `git log exited with code ${logRes.code}`}`;
      return { snapshot: finishEarly('failed', 'error', msg), events };
    }
    if (commits.length === 0) {
      const warn = 'Repository has no commits in the inspected history window.';
      warnings.push(warn);
      emit('warning', 'read-history', { message: warn });
    }

    const fileCommits = new Map<string, number>();
    const nonBulkFileCommits = new Map<string, number>();
    const filteredCommits: Array<{ sha: string; subject: string; rawCount: number; files: string[] }> = [];

    for (const c of commits) {
      if (options.signal?.aborted) {
        return { snapshot: finishEarly('canceled', 'skipped', 'Canceled while reading git history'), events };
      }
      const keptFiles = c.files.filter((f) => !shouldFilterNoiseFile(f, includeNoise, excludePatterns));
      const isBulk = c.files.length > MAX_FILES_PER_COMMIT;
      for (const f of keptFiles) {
        fileCommits.set(f, (fileCommits.get(f) ?? 0) + 1);
        if (!isBulk) {
          nonBulkFileCommits.set(f, (nonBulkFileCommits.get(f) ?? 0) + 1);
        }
      }
      filteredCommits.push({
        sha: c.sha,
        subject: c.subject,
        rawCount: c.files.length,
        files: keptFiles,
      });
    }

    emittedCommitsExamined = commits.length;
    emittedHotFiles = Array.from(fileCommits.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 6)
      .map(([file, count]) => ({
        file,
        commits: count,
        share: commits.length > 0 ? Math.min(1, Math.round((count / commits.length) * 100) / 100) : 0,
      }));
    emit('metric', 'read-history', { name: 'commitsExamined', value: commits.length });
    if (options.signal?.aborted) {
      return { snapshot: finishEarly('canceled', 'skipped', 'Canceled while reading git history'), events };
    }
    emittedUniqueFilesObserved = fileCommits.size;
    emit('metric', 'read-history', { name: 'uniqueFilesObserved', value: fileCommits.size });
    if (options.signal?.aborted) {
      return { snapshot: finishEarly('canceled', 'skipped', 'Canceled while reading git history'), events };
    }
    emit('step-end', 'read-history', { status: 'ok', summary: `${commits.length} commits · ${fileCommits.size} files` });
    if (options.signal?.aborted) {
      return { snapshot: finishEarly('canceled', 'skipped', 'Canceled before pairing co-changing files'), events };
    }

    // Step 3: pair-cochanges
    emit('step-start', 'pair-cochanges', { title: 'Pair co-changing files' });
    await new Promise<void>((r) => setImmediate(r));
    if (options.signal?.aborted) {
      return { snapshot: finishEarly('canceled', 'skipped', 'Canceled while pairing co-changing files'), events };
    }
    const pairMap = new Map<string, { files: [string, string]; count: number; shas: string[]; subjects: string[] }>();
    let lastPairProgressTime = Date.now();
    for (let idx = 0; idx < filteredCommits.length; idx++) {
      if (idx > 0 && idx % 5 === 0) {
        await new Promise<void>((r) => setImmediate(r));
      }
      if (options.signal?.aborted) {
        return { snapshot: finishEarly('canceled', 'skipped', 'Canceled while pairing co-changing files'), events };
      }
      const c = filteredCommits[idx]!;
      if (c.rawCount > MAX_FILES_PER_COMMIT) {
        const w = `Skipped bulk commit ${c.sha} touching ${c.rawCount} files.`;
        warnings.push(w);
        emit('warning', 'pair-cochanges', { message: w, sha: c.sha });
        if (options.signal?.aborted) {
          return { snapshot: finishEarly('canceled', 'skipped', 'Canceled while pairing co-changing files'), events };
        }
        continue;
      }
      for (let i = 0; i < c.files.length; i++) {
        for (let j = i + 1; j < c.files.length; j++) {
          const fA = c.files[i]!;
          const fB = c.files[j]!;
          const key = `${fA}\x00${fB}`;
          const cur = pairMap.get(key) ?? { files: [fA, fB], count: 0, shas: [], subjects: [] };
          cur.count += 1;
          if (cur.shas.length < 8) cur.shas.push(c.sha);
          if (cur.subjects.length < 3 && c.subject) cur.subjects.push(c.subject);
          pairMap.set(key, cur);
        }
      }
      const now = Date.now();
      if ((idx + 1) % 500 === 0 || now - lastPairProgressTime >= 1000) {
        lastPairProgressTime = now;
        emit('step-progress', 'pair-cochanges', {
          commitsProcessed: idx + 1,
          pairsObserved: pairMap.size,
        });
        if (options.signal?.aborted) {
          return { snapshot: finishEarly('canceled', 'skipped', 'Canceled while pairing co-changing files'), events };
        }
      }
    }
    emittedTotalPairsObserved = pairMap.size;
    emit('metric', 'pair-cochanges', { name: 'totalPairsObserved', value: pairMap.size });
    if (options.signal?.aborted) {
      return { snapshot: finishEarly('canceled', 'skipped', 'Canceled while pairing co-changing files'), events };
    }
    emit('step-end', 'pair-cochanges', { status: 'ok', summary: `${pairMap.size} co-change pairs observed` });
    if (options.signal?.aborted) {
      return { snapshot: finishEarly('canceled', 'skipped', 'Canceled before ranking findings'), events };
    }

    // Step 4: rank-findings
    emit('step-start', 'rank-findings', { title: 'Rank coupled file pairs and evidence' });
    await new Promise<void>((r) => setImmediate(r));
    if (options.signal?.aborted) {
      return { snapshot: finishEarly('canceled', 'skipped', 'Canceled while ranking findings'), events };
    }
    const minThreshold = commits.length >= 3 ? 2 : 1;
    const candidates = Array.from(pairMap.values())
      .filter((p) => p.count >= minThreshold)
      .map((p) => {
        const fileACommits = Math.max(p.count, nonBulkFileCommits.get(p.files[0]) ?? p.count);
        const fileBCommits = Math.max(p.count, nonBulkFileCommits.get(p.files[1]) ?? p.count);
        const minCommits = Math.max(1, Math.min(fileACommits, fileBCommits));
        const unionCommits = Math.max(1, fileACommits + fileBCommits - p.count);
        const couplingRatio = Math.min(1, Math.round((p.count / minCommits) * 100) / 100);
        const jaccardRatio = Math.min(1, Math.round((p.count / unionCommits) * 100) / 100);
        return { ...p, fileACommits, fileBCommits, unionCommits, couplingRatio, jaccardRatio };
      })
      .sort((a, b) =>
        b.count !== a.count
          ? b.count - a.count
          : b.jaccardRatio !== a.jaccardRatio
            ? b.jaccardRatio - a.jaccardRatio
            : b.couplingRatio !== a.couplingRatio
              ? b.couplingRatio - a.couplingRatio
              : a.files[0].localeCompare(b.files[0]) || a.files[1].localeCompare(b.files[1]),
      )
      .slice(0, topN);

    for (let idx = 0; idx < candidates.length; idx++) {
      if (idx > 0) {
        await new Promise<void>((r) => setImmediate(r));
      }
      if (options.signal?.aborted) {
        return { snapshot: finishEarly('canceled', 'skipped', 'Canceled while ranking findings'), events };
      }
      const c = candidates[idx]!;
      const id = `F-${String(idx + 1).padStart(2, '0')}`;
      const classification = classifyCochangePair(c.files[0], c.files[1]);
      const rel = describeCochangeRelationship({
        files: c.files,
        cochangeCount: c.count,
        fileACommits: c.fileACommits,
        fileBCommits: c.fileBCommits,
        jaccardRatio: c.jaccardRatio,
        sampleSubjects: c.subjects,
      });
      const finding = fitFindingToPayloadBudget({
        id,
        files: c.files,
        cochangeCount: c.count,
        fileACommits: c.fileACommits,
        fileBCommits: c.fileBCommits,
        couplingRatio: c.couplingRatio,
        jaccardRatio: c.jaccardRatio,
        classification,
        evidence: { commitShas: c.shas, sampleSubjects: c.subjects, count: c.count },
        reason: `${rel.patternLabel}: ${rel.summary}`,
      });
      findings.push(finding);
      emit('finding', 'rank-findings', { finding });
      if (options.signal?.aborted) {
        return { snapshot: finishEarly('canceled', 'skipped', 'Canceled while ranking findings'), events };
      }
    }

    const hotFiles = emittedHotFiles;

    if (options.signal?.aborted) {
      return { snapshot: finishEarly('canceled', 'skipped', 'Canceled while ranking findings'), events };
    }
    emit('step-end', 'rank-findings', { status: 'ok', summary: `${findings.length} findings ranked` });
    if (options.signal?.aborted) {
      return { snapshot: finishEarly('canceled', 'skipped', 'Canceled before run completion'), events };
    }
    emit('run-end', null, {
      status: 'completed',
      summary: `${findings.length} findings from ${commits.length} commits`,
      hotFiles,
    });

    const snapshot: ResultSnapshot = {
      schemaVersion: SCHEMA_VERSION,
      runId,
      status: 'completed',
      repoLabel,
      startedAt: events[0]?.ts ?? startedAt,
      finishedAt: events[events.length - 1]?.ts ?? new Date().toISOString(),
      maxCommits,
      commitsExamined: commits.length,
      uniqueFilesObserved: fileCommits.size,
      totalPairsObserved: pairMap.size,
      findings,
      hotFiles,
      warnings,
    };
    return { snapshot, events };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { snapshot: finishEarly('failed', 'error', msg), events };
  }
}
