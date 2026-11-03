import {
  SCHEMA_VERSION,
  StoryboardStreamValidator,
  validateResultSnapshot,
  type CochangeFinding,
  type HotFileSummary,
  type ResultSnapshot,
  type StoryboardEvent,
} from '../model/index.js';
import { truncateText } from './git-history.js';

export interface RepoArchaeologySuggestion {
  id?: string;
  rank?: number;
  fileA: string;
  fileB: string;
  sharedCommits?: number;
  cochangeCount?: number;
  fileACommits?: number;
  fileBCommits?: number;
  jaccardOrCoupling?: number;
  jaccard?: number;
  confidence?: number;
  commitShas: string[];
  sampleMessages?: string[];
  note?: string;
  reason?: string;
}

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
  changed?: boolean;
  totalSuggestions?: number;
  meta?: {
    repoName?: string;
    generatedAt?: string;
    windowCommits?: number;
    commitsAnalyzed?: number;
    filesAnalyzed?: number;
    totalCoupledPairs?: number;
  };
  evaluation?: Record<string, unknown>;
  families?: Array<Record<string, unknown>>;
  suggestions?: RepoArchaeologySuggestion[];
  cochangePairs?: RepoArchaeologySuggestion[];
  hotspots?: Array<{
    path: string;
    touches: number;
  }>;
  warnings?: string[];
}

function requireNonNegativeInt(val: unknown, fieldName: string, defaultVal?: number): number {
  if (val === undefined) {
    if (defaultVal !== undefined) return defaultVal;
    throw new Error(`Missing required Repo Archaeology numeric field "${fieldName}".`);
  }
  if (typeof val !== 'number' || !Number.isFinite(val) || !Number.isInteger(val) || val < 0) {
    throw new Error(
      `Invalid Repo Archaeology numeric field "${fieldName}": expected non-negative integer, got ${JSON.stringify(val)}.`,
    );
  }
  return val;
}

function requirePositiveInt(val: unknown, fieldName: string, defaultVal?: number): number {
  const n = requireNonNegativeInt(val, fieldName, defaultVal);
  if (n < 1) {
    throw new Error(`Invalid Repo Archaeology numeric field "${fieldName}": must be >= 1, got ${n}.`);
  }
  return n;
}

/**
 * Converts a completed Repo Archaeology (schemaVersion: 1) JSON snapshot into
 * a ResultSnapshot + synthetic event stream explicitly labeled as reconstructed.
 * Supports both the published `meta`/`suggestions`/`changed`/`families`/`evaluation`
 * contract and `cochangePairs`.
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

  const meta =
    typeof raw.meta === 'object' && raw.meta !== null && !Array.isArray(raw.meta)
      ? raw.meta
      : {};

  const rawRepoName = meta.repoName ?? raw.repoName;
  if (rawRepoName !== undefined && typeof rawRepoName !== 'string') {
    throw new Error('Invalid Repo Archaeology "repoName": must be a string.');
  }
  const repoLabel = truncateText(rawRepoName?.trim() || 'archaeology-snapshot', 80);

  const rawGeneratedAt = meta.generatedAt ?? raw.generatedAt;
  const ts =
    typeof rawGeneratedAt === 'string' && !Number.isNaN(Date.parse(rawGeneratedAt))
      ? rawGeneratedAt
      : '2026-11-02T00:00:00.000Z';

  const runId = `reconstructed-${repoLabel.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

  const rawCommitsAnalyzed = meta.commitsAnalyzed ?? raw.commitsAnalyzed;
  const rawWindowCommits = meta.windowCommits ?? raw.windowCommits;
  const commitsExamined = requireNonNegativeInt(
    rawCommitsAnalyzed ?? rawWindowCommits,
    'commitsAnalyzed',
    50,
  );
  const maxCommits = requirePositiveInt(
    rawWindowCommits ?? (commitsExamined > 0 ? commitsExamined : 50),
    'windowCommits',
    50,
  );

  const pairsInput = Array.isArray(raw.suggestions)
    ? raw.suggestions
    : Array.isArray(raw.cochangePairs)
      ? raw.cochangePairs
      : [];

  if (raw.totalSuggestions !== undefined) {
    requireNonNegativeInt(raw.totalSuggestions, 'totalSuggestions');
  }

  const uniqueFilesObserved = requireNonNegativeInt(
    meta.filesAnalyzed ?? raw.filesAnalyzed,
    'filesAnalyzed',
    0,
  );
  const totalPairsObserved = requireNonNegativeInt(
    meta.totalCoupledPairs ?? raw.totalCoupledPairs ?? raw.totalSuggestions,
    'totalCoupledPairs',
    pairsInput.length,
  );

  const findings: CochangeFinding[] = pairsInput.map((pair, idx) => {
    if (typeof pair !== 'object' || pair === null || Array.isArray(pair)) {
      throw new Error(`Invalid Repo Archaeology suggestion at index ${idx}: must be an object.`);
    }
    if (typeof pair.fileA !== 'string' || !pair.fileA.trim() || typeof pair.fileB !== 'string' || !pair.fileB.trim()) {
      throw new Error(`Invalid Repo Archaeology suggestion at index ${idx}: fileA and fileB must be non-empty strings.`);
    }

    const sharedCommits = requirePositiveInt(
      pair.sharedCommits ?? pair.cochangeCount,
      `suggestions[${idx}].sharedCommits`,
    );
    const rawFileACommits = requirePositiveInt(
      pair.fileACommits,
      `suggestions[${idx}].fileACommits`,
      sharedCommits,
    );
    const rawFileBCommits = requirePositiveInt(
      pair.fileBCommits,
      `suggestions[${idx}].fileBCommits`,
      sharedCommits,
    );

    if (
      !Array.isArray(pair.commitShas) ||
      pair.commitShas.length === 0 ||
      !pair.commitShas.every((s) => typeof s === 'string' && s.trim().length > 0)
    ) {
      throw new Error(
        `Invalid Repo Archaeology suggestion at index ${idx}: commitShas must be a non-empty array of commit SHA strings.`,
      );
    }

    const cleanFileA = truncateText(pair.fileA.trim(), 320);
    const cleanFileB = truncateText(pair.fileB.trim(), 320);
    const isOrdered = cleanFileA.localeCompare(cleanFileB) <= 0;
    const sortedFiles: [string, string] = isOrdered
      ? [cleanFileA, cleanFileB]
      : [cleanFileB, cleanFileA];
    const fileACommits = Math.max(sharedCommits, isOrdered ? rawFileACommits : rawFileBCommits);
    const fileBCommits = Math.max(sharedCommits, isOrdered ? rawFileBCommits : rawFileACommits);

    const minCommits = Math.max(1, Math.min(fileACommits, fileBCommits));
    const unionCommits = Math.max(1, fileACommits + fileBCommits - sharedCommits);

    const computedOverlap = Math.min(1, Math.round((sharedCommits / minCommits) * 100) / 100);
    const computedJaccard = Math.min(1, Math.round((sharedCommits / unionCommits) * 100) / 100);

    const rawRatio = pair.confidence ?? pair.jaccardOrCoupling;
    if (rawRatio !== undefined && (typeof rawRatio !== 'number' || !Number.isFinite(rawRatio) || rawRatio < 0 || rawRatio > 1)) {
      throw new Error(`Invalid Repo Archaeology ratio at suggestions[${idx}]: must be a number in 0..1.`);
    }
    const rawJaccard = pair.jaccard;
    if (rawJaccard !== undefined && (typeof rawJaccard !== 'number' || !Number.isFinite(rawJaccard) || rawJaccard < 0 || rawJaccard > 1)) {
      throw new Error(`Invalid Repo Archaeology jaccard at suggestions[${idx}]: must be a number in 0..1.`);
    }

    const couplingRatio =
      rawRatio !== undefined
        ? Math.min(1, Math.max(0, Math.round(rawRatio * 100) / 100))
        : computedOverlap;
    const jaccardRatio =
      rawJaccard !== undefined
        ? Math.min(1, Math.max(0, Math.round(rawJaccard * 100) / 100))
        : computedJaccard;

    const id = `F-${String(idx + 1).padStart(2, '0')}`;
    const shas = pair.commitShas.slice(0, 8).map((s) => truncateText(s.trim(), 40));
    const subjects = Array.isArray(pair.sampleMessages)
      ? pair.sampleMessages.slice(0, 3).map((m) => truncateText(String(m), 200))
      : [];
    const reasonText = (pair.note ?? pair.reason)?.trim();
    const reason = truncateText(
      reasonText ||
        `Reconstructed from Repo Archaeology: co-changed in ${sharedCommits} commits (${Math.round(couplingRatio * 100)}% overlap, ${Math.round(jaccardRatio * 100)}% Jaccard).`,
      320,
    );

    return {
      id,
      files: sortedFiles,
      cochangeCount: sharedCommits,
      fileACommits,
      fileBCommits,
      couplingRatio,
      jaccardRatio,
      evidence: {
        commitShas: shas,
        sampleSubjects: subjects,
        count: sharedCommits,
      },
      reason,
    };
  });

  const hotFiles: HotFileSummary[] = (Array.isArray(raw.hotspots) ? raw.hotspots : []).map((h, idx) => {
    if (typeof h !== 'object' || h === null || typeof h.path !== 'string' || !h.path.trim()) {
      throw new Error(`Invalid hotspot at hotspots[${idx}]: path must be a non-empty string.`);
    }
    const touches = requirePositiveInt(h.touches, `hotspots[${idx}].touches`);
    return {
      file: truncateText(h.path.trim(), 320),
      commits: touches,
      share: commitsExamined > 0 ? Math.min(1, Math.round((touches / commitsExamined) * 100) / 100) : 0,
    };
  });

  const reconstructedNote =
    'Reconstructed from a completed Repo Archaeology (schemaVersion: 1) analysis, not live events';

  const inputWarnings: string[] = [];
  if (raw.warnings !== undefined) {
    if (!Array.isArray(raw.warnings) || !raw.warnings.every((w) => typeof w === 'string' && w.trim().length > 0)) {
      throw new Error('Invalid Repo Archaeology "warnings": must be an array of non-empty strings.');
    }
    for (const w of raw.warnings) {
      inputWarnings.push(truncateText(w.trim(), 300));
    }
  }

  const warnings = [...inputWarnings, reconstructedNote];

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

  const snapValidation = validateResultSnapshot(snapshot);
  if (!snapValidation.ok) {
    throw new Error(`Reconstructed ResultSnapshot failed validation: ${snapValidation.error}`);
  }

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
  for (const w of inputWarnings) {
    pushEv('warning', 'pair-cochanges', { message: w });
  }
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
    reconstructed: snapshot.reconstructed,
    hotFiles,
    summary: reconstructedNote,
  });

  return { snapshot: snapValidation.snapshot, events };
}
