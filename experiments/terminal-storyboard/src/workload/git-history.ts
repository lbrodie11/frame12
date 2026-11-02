import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import {
  SCHEMA_VERSION,
  StoryboardStreamValidator,
  type CochangeFinding,
  type EventType,
  type HotFileSummary,
  type ResultSnapshot,
  type RunEndStatus,
  type StepEndStatus,
  type StoryboardEvent,
} from '../model/index.js';

export interface GitHistoryWorkloadOptions {
  repoPath: string;
  maxCommits?: number;
  topN?: number;
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

function parseCommitRecord(raw: string): ParsedCommit | null {
  const lines = raw.split(/\r?\n/);
  const header = lines.shift();
  if (!header) return null;
  const [sha = '', date = '', subject = ''] = header.split('\x00');
  if (!sha.trim()) return null;
  const files = Array.from(new Set(lines.map((l) => l.trim()).filter(Boolean))).sort();
  return { sha: sha.trim(), date: date.trim(), subject: subject.trim(), files };
}

export async function runGitHistoryWorkload(
  options: GitHistoryWorkloadOptions,
): Promise<{ snapshot: ResultSnapshot; events: StoryboardEvent[] }> {
  const resolvedPath = resolve(options.repoPath);
  const repoLabel = basename(resolvedPath) || resolvedPath;
  const maxCommits = Math.max(1, options.maxCommits ?? 60);
  const topN = Math.max(1, options.topN ?? 5);
  const runId = options.runId ?? `run-${Date.now().toString(36)}`;
  const startedAt = new Date().toISOString();
  const validator = new StoryboardStreamValidator();
  const events: StoryboardEvent[] = [];
  const warnings: string[] = [];
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
    if (activeStep) emit('step-end', activeStep, { status: stepStatus, summary: reason });
    emit('run-end', null, { status, summary: reason, ...(status === 'failed' ? { error: reason } : {}) });
    return {
      schemaVersion: SCHEMA_VERSION,
      runId,
      status,
      repoLabel,
      startedAt,
      finishedAt: new Date().toISOString(),
      maxCommits,
      commitsExamined: 0,
      uniqueFilesObserved: 0,
      totalPairsObserved: 0,
      findings: [],
      hotFiles: [],
      warnings,
      ...(status === 'failed' ? { error: reason } : {}),
    };
  };

  const runGit = (args: string[], onChunk?: (chunk: string) => void) =>
    new Promise<{ code: number; stdout: string; stderr: string; aborted: boolean }>((res) => {
      if (options.signal?.aborted) return res({ code: 130, stdout: '', stderr: 'Aborted', aborted: true });
      const child = spawn('git', ['-C', resolvedPath, ...args], { shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      let aborted = false;
      const onAbort = () => {
        aborted = true;
        child.kill('SIGTERM');
      };
      options.signal?.addEventListener('abort', onAbort, { once: true });
      child.stdout.on('data', (d: Buffer) => {
        const str = d.toString('utf8');
        stdout += str;
        onChunk?.(str);
      });
      child.stderr.on('data', (d: Buffer) => {
        stderr += d.toString('utf8');
      });
      child.on('error', (err) => {
        options.signal?.removeEventListener('abort', onAbort);
        res({ code: 1, stdout, stderr: err.message, aborted });
      });
      child.on('close', (code) => {
        options.signal?.removeEventListener('abort', onAbort);
        res({ code: code ?? 1, stdout, stderr, aborted: aborted || Boolean(options.signal?.aborted) });
      });
    });

  emit('run-start', null, { repoLabel, repoPath: resolvedPath, maxCommits, topN });

  // Step 1: validate-repo
  emit('step-start', 'validate-repo', { title: 'Validate target repository', repoLabel });
  if (!existsSync(resolvedPath)) {
    const msg = `Repository path does not exist: ${resolvedPath}`;
    return { snapshot: finishEarly('failed', 'error', msg), events };
  }
  const revParse = await runGit(['rev-parse', '--is-inside-work-tree']);
  if (revParse.aborted) return { snapshot: finishEarly('canceled', 'skipped', 'Canceled during repo validation'), events };
  if (revParse.code !== 0 || revParse.stdout.trim() !== 'true') {
    const msg = `Not a valid git repository (${resolvedPath}): ${revParse.stderr.trim() || 'git rev-parse failed'}`;
    return { snapshot: finishEarly('failed', 'error', msg), events };
  }
  emit('step-end', 'validate-repo', { status: 'ok', summary: `repo: ${repoLabel}` });

  // Step 2: read-history
  emit('step-start', 'read-history', { title: 'Read commit history', maxCommits });
  const commits: ParsedCommit[] = [];
  let carry = '';
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
      if (parts.length > 0 && !options.signal?.aborted) {
        emit('step-progress', 'read-history', { commitsParsed: commits.length });
      }
    },
  );
  if (logRes.aborted) return { snapshot: finishEarly('canceled', 'skipped', 'Canceled while reading git history'), events };
  if (carry.trim()) {
    for (const part of carry.split(COMMIT_MARKER)) {
      const parsed = parseCommitRecord(part);
      if (parsed) commits.push(parsed);
    }
  }
  if (commits.length === 0) {
    const warn = 'Repository has no commits in the inspected history window.';
    warnings.push(warn);
    emit('warning', 'read-history', { message: warn });
  }
  const fileCommits = new Map<string, number>();
  for (const c of commits) {
    for (const f of c.files) fileCommits.set(f, (fileCommits.get(f) ?? 0) + 1);
  }
  emit('metric', 'read-history', { name: 'commitsExamined', value: commits.length });
  emit('metric', 'read-history', { name: 'uniqueFilesObserved', value: fileCommits.size });
  emit('step-end', 'read-history', { status: 'ok', summary: `${commits.length} commits · ${fileCommits.size} files` });

  // Step 3: pair-cochanges
  emit('step-start', 'pair-cochanges', { title: 'Pair co-changing files' });
  const pairMap = new Map<string, { files: [string, string]; count: number; shas: string[]; subjects: string[] }>();
  for (const c of commits) {
    if (c.files.length > MAX_FILES_PER_COMMIT) {
      const w = `Skipped bulk commit ${c.sha} touching ${c.files.length} files.`;
      warnings.push(w);
      emit('warning', 'pair-cochanges', { message: w, sha: c.sha });
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
        if (cur.subjects.length < 4 && c.subject) cur.subjects.push(c.subject);
        pairMap.set(key, cur);
      }
    }
  }
  emit('metric', 'pair-cochanges', { name: 'totalPairsObserved', value: pairMap.size });
  emit('step-end', 'pair-cochanges', { status: 'ok', summary: `${pairMap.size} co-change pairs observed` });

  // Step 4: rank-findings
  emit('step-start', 'rank-findings', { title: 'Rank coupled file pairs and evidence' });
  const minThreshold = commits.length >= 3 ? 2 : 1;
  const candidates = Array.from(pairMap.values())
    .filter((p) => p.count >= minThreshold)
    .map((p) => {
      const fileACommits = fileCommits.get(p.files[0]) ?? p.count;
      const fileBCommits = fileCommits.get(p.files[1]) ?? p.count;
      const minCommits = Math.max(1, Math.min(fileACommits, fileBCommits));
      const couplingRatio = Math.min(1, Math.round((p.count / minCommits) * 100) / 100);
      return { ...p, fileACommits, fileBCommits, couplingRatio };
    })
    .sort((a, b) =>
      b.count !== a.count
        ? b.count - a.count
        : b.couplingRatio !== a.couplingRatio
          ? b.couplingRatio - a.couplingRatio
          : a.files[0].localeCompare(b.files[0]) || a.files[1].localeCompare(b.files[1]),
    )
    .slice(0, topN);

  const findings: CochangeFinding[] = candidates.map((c, idx) => {
    const id = `F-${String(idx + 1).padStart(2, '0')}`;
    const pct = Math.round(c.couplingRatio * 100);
    const finding: CochangeFinding = {
      id,
      files: c.files,
      cochangeCount: c.count,
      fileACommits: c.fileACommits,
      fileBCommits: c.fileBCommits,
      couplingRatio: c.couplingRatio,
      evidence: { commitShas: c.shas, sampleSubjects: c.subjects, count: c.count },
      reason: `Co-changed in ${c.count} commits (${pct}% coupling across ${c.shas.slice(0, 3).join(', ')}); inspect together before modifying either file in isolation.`,
    };
    emit('finding', 'rank-findings', { finding });
    return finding;
  });

  const hotFiles: HotFileSummary[] = Array.from(fileCommits.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 6)
    .map(([file, count]) => ({
      file,
      commits: count,
      share: commits.length > 0 ? Math.round((count / commits.length) * 100) / 100 : 0,
    }));

  emit('step-end', 'rank-findings', { status: 'ok', summary: `${findings.length} findings ranked` });
  emit('run-end', null, { status: 'completed', summary: `${findings.length} findings from ${commits.length} commits` });

  const snapshot: ResultSnapshot = {
    schemaVersion: SCHEMA_VERSION,
    runId,
    status: 'completed',
    repoLabel,
    startedAt,
    finishedAt: new Date().toISOString(),
    maxCommits,
    commitsExamined: commits.length,
    uniqueFilesObserved: fileCommits.size,
    totalPairsObserved: pairMap.size,
    findings,
    hotFiles,
    warnings,
  };
  return { snapshot, events };
}
