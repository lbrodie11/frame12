import {
  SCHEMA_VERSION,
  StoryboardStreamValidator,
  type CochangeFinding,
  type HotFileSummary,
  type ResultSnapshot,
  type StoryboardEvent,
} from '../model/index.js';

export interface RepoArchaeologyRawSnapshot {
  schemaVersion: number;
  tool?: string;
  toolVersion?: string;
  repoName?: string;
  generatedAt?: string;
  windowCommits?: number;
  commitsAnalyzed?: number;
  filesAnalyzed?: number;
  totalCoupledPairs?: number;
  cochangePairs?: Array<{
    rank?: number;
    fileA: string;
    fileB: string;
    sharedCommits: number;
    fileACommits?: number;
    fileBCommits?: number;
    jaccardOrCoupling?: number;
    commitShas: string[];
    sampleMessages?: string[];
    note?: string;
  }>;
  hotspots?: Array<{
    path: string;
    touches: number;
  }>;
  warnings?: string[];
}

/**
 * Converts a completed Repo Archaeology (schemaVersion: 1) JSON snapshot into
 * a ResultSnapshot + synthetic event stream explicitly labeled as reconstructed.
 */
export function convertRepoArchaeologySnapshot(rawInput: unknown): {
  snapshot: ResultSnapshot;
  events: StoryboardEvent[];
} {
  if (typeof rawInput !== 'object' || rawInput === null || Array.isArray(rawInput)) {
    throw new Error('Repo Archaeology input must be a JSON object.');
  }

  const raw = rawInput as RepoArchaeologyRawSnapshot;
  if (raw.schemaVersion !== 1) {
    throw new Error(
      `Unsupported Repo Archaeology schemaVersion "${String(raw.schemaVersion)}". Expected schemaVersion: 1.`,
    );
  }

  const repoLabel = raw.repoName?.trim() || 'archaeology-snapshot';
  const ts = raw.generatedAt && !Number.isNaN(Date.parse(raw.generatedAt))
    ? raw.generatedAt
    : '2026-11-02T00:00:00.000Z';
  const runId = `reconstructed-${repoLabel.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  const commitsExamined = raw.commitsAnalyzed ?? raw.windowCommits ?? 50;
  const maxCommits = raw.windowCommits ?? commitsExamined;
  const uniqueFilesObserved = raw.filesAnalyzed ?? 0;
  const pairsInput = Array.isArray(raw.cochangePairs) ? raw.cochangePairs : [];
  const totalPairsObserved = raw.totalCoupledPairs ?? pairsInput.length;

  const findings: CochangeFinding[] = pairsInput.map((pair, idx) => {
    const id = `F-${String(idx + 1).padStart(2, '0')}`;
    const sortedFiles: [string, string] =
      pair.fileA.localeCompare(pair.fileB) <= 0
        ? [pair.fileA, pair.fileB]
        : [pair.fileB, pair.fileA];
    const fileACommits = pair.fileACommits ?? pair.sharedCommits;
    const fileBCommits = pair.fileBCommits ?? pair.sharedCommits;
    const minCommits = Math.max(1, Math.min(fileACommits, fileBCommits));
    const couplingRatio =
      pair.jaccardOrCoupling !== undefined
        ? Math.min(1, Math.max(0, Math.round(pair.jaccardOrCoupling * 100) / 100))
        : Math.min(1, Math.round((pair.sharedCommits / minCommits) * 100) / 100);
    const shas = Array.isArray(pair.commitShas) && pair.commitShas.length > 0 ? pair.commitShas : ['0000000'];
    const subjects = Array.isArray(pair.sampleMessages) ? pair.sampleMessages : [];
    const reason =
      pair.note?.trim() ||
      `Reconstructed from Repo Archaeology: co-changed in ${pair.sharedCommits} commits (${Math.round(couplingRatio * 100)}% coupling).`;

    return {
      id,
      files: sortedFiles,
      cochangeCount: pair.sharedCommits,
      fileACommits,
      fileBCommits,
      couplingRatio,
      evidence: {
        commitShas: shas,
        sampleSubjects: subjects,
        count: pair.sharedCommits,
      },
      reason,
    };
  });

  const hotFiles: HotFileSummary[] = (Array.isArray(raw.hotspots) ? raw.hotspots : []).map((h) => ({
    file: h.path,
    commits: h.touches,
    share: commitsExamined > 0 ? Math.min(1, Math.round((h.touches / commitsExamined) * 100) / 100) : 0,
  }));

  const reconstructedNote =
    'Reconstructed from a completed Repo Archaeology (schemaVersion: 1) analysis, not live events';

  const warnings = [
    ...(Array.isArray(raw.warnings) ? raw.warnings : []),
    reconstructedNote,
  ];

  const snapshot: ResultSnapshot = {
    schemaVersion: SCHEMA_VERSION,
    runId,
    status: 'completed',
    repoLabel,
    startedAt: ts,
    finishedAt: ts,
    maxCommits,
    commitsExamined,
    uniqueFilesObserved,
    totalPairsObserved,
    findings,
    hotFiles,
    warnings,
    reconstructed: {
      source: 'repo-archaeology',
      originalSchemaVersion: 1,
      note: reconstructedNote,
    },
  };

  // Build synthetic event stream clearly marked as reconstructed
  const validator = new StoryboardStreamValidator();
  const events: StoryboardEvent[] = [];
  let seq = 0;

  const pushEv = (
    type: StoryboardEvent['type'],
    stepId: string | null,
    payload: Record<string, unknown>,
  ) => {
    seq += 1;
    const res = validator.push({
      schemaVersion: SCHEMA_VERSION,
      eventId: `recon-evt-${String(seq).padStart(4, '0')}`,
      runId,
      seq,
      ts,
      type,
      stepId,
      payload,
    });
    if (!res.ok) throw new Error(res.error);
    events.push(res.event);
  };

  pushEv('run-start', null, {
    repoLabel,
    maxCommits,
    reconstructed: true,
    note: reconstructedNote,
  });

  pushEv('step-start', 'validate-repo', { title: 'Validate target repository (reconstructed)' });
  pushEv('step-end', 'validate-repo', { status: 'ok', summary: `reconstructed source: ${repoLabel}` });

  pushEv('step-start', 'read-history', { title: 'Read commit history (reconstructed)' });
  pushEv('metric', 'read-history', { name: 'commitsExamined', value: commitsExamined });
  pushEv('metric', 'read-history', { name: 'uniqueFilesObserved', value: uniqueFilesObserved });
  pushEv('step-end', 'read-history', {
    status: 'ok',
    summary: `${commitsExamined} commits · ${uniqueFilesObserved} files (reconstructed)`,
  });

  pushEv('step-start', 'pair-cochanges', { title: 'Pair co-changing files (reconstructed)' });
  pushEv('metric', 'pair-cochanges', { name: 'totalPairsObserved', value: totalPairsObserved });
  pushEv('step-end', 'pair-cochanges', {
    status: 'ok',
    summary: `${totalPairsObserved} co-change pairs (reconstructed)`,
  });

  pushEv('step-start', 'rank-findings', { title: 'Rank coupled file pairs (reconstructed)' });
  for (const f of findings) {
    pushEv('finding', 'rank-findings', { finding: f });
  }
  pushEv('warning', 'rank-findings', { message: reconstructedNote });
  pushEv('step-end', 'rank-findings', {
    status: 'ok',
    summary: `${findings.length} findings reconstructed`,
  });

  pushEv('run-end', null, {
    status: 'completed',
    reconstructed: true,
    summary: reconstructedNote,
  });

  return { snapshot, events };
}
