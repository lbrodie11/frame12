import { posix } from 'node:path';
import {
  SCHEMA_VERSION,
  StoryboardStreamValidator,
  validateResultSnapshot,
  type CochangeFinding,
  type HotFileSummary,
  type ResultSnapshot,
  type StoryboardEvent,
} from '../model/index.js';
import {
  classifyCochangePair,
  describeCochangeRelationship,
  fitFindingToPayloadBudget,
  pluralize,
  truncateText,
  validateFilePathLength,
} from './git-history.js';

export interface RepoArchaeologyEvidenceView {
  hash: string;
  date?: string;
  author?: string;
  subject?: string;
}

export interface RepoArchaeologySuggestion {
  id?: string;
  rank?: number;
  // Authentic diff.schema.json / common.schema.json fields:
  from?: string;
  to?: string;
  relationship?: string;
  why?: string;
  shared?: number;
  fromChanges?: number;
  toChanges?: number;
  confidence?: number;
  reverseConfidence?: number;
  score?: number;
  weighted?: boolean;
  lastTogether?: string;
  crossesDirectories?: boolean;
  evidence?: RepoArchaeologyEvidenceView[];
  alsoLinkedFrom?: string[];
  // Compatibility aliases:
  target?: string;
  companion?: string;
  fileA?: string;
  fileB?: string;
  sharedCommits?: number;
  cochangeCount?: number;
  targetCommits?: number;
  companionCommits?: number;
  fileACommits?: number;
  fileBCommits?: number;
  jaccardOrCoupling?: number;
  jaccard?: number;
  commitShas?: string[];
  sampleMessages?: string[];
  note?: string;
  reason?: string;
}

export interface RepoArchaeologyRawSnapshot {
  schemaVersion: number;
  tool?: string | { name?: string; version?: string };
  toolVersion?: string;
  repoName?: string;
  generatedAt?: string;
  windowCommits?: number;
  commitsAnalyzed?: number;
  filesAnalyzed?: number;
  totalCoupledPairs?: number;
  base?: string;
  changed?: boolean | Array<Record<string, unknown>>;
  totalSuggestions?: number;
  meta?: {
    tool?: string;
    root?: string;
    repoName?: string;
    generatedAt?: string;
    commitsRead?: number;
    commitsAnalyzed?: number;
    sweepsSkipped?: number;
    subjectSkipped?: number;
    renamesFollowed?: number;
    files?: number;
    filesAnalyzed?: number;
    oldestCommit?: string;
    newestCommit?: string;
    windowCommits?: number;
    totalCoupledPairs?: number;
    settings?: {
      maxCommits?: number;
      maxFilesPerCommit?: number;
      minShared?: number;
      minConfidence?: number;
      ignore?: string[];
      useDefaultIgnores?: boolean;
    };
    warnings?: string[];
  };
  evaluation?: {
    targetBranchRef?: string;
    headSha?: string;
    mergeBaseSha?: string;
    baselineSha?: string;
    commitsAnalyzed?: number;
    effectiveOptions?: {
      minShared?: number;
      minConfidence?: number;
      maxCommits?: number;
      maxFilesPerCommit?: number;
    };
    [key: string]: unknown;
  };
  families?: Array<{
    id?: string;
    members?: Array<string | { path?: string; changes?: number }>;
    [key: string]: unknown;
  }>;
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
 * Supports the published Repo Archaeology v1 `diff --json` contract (`diff.schema.json`
 * + `common.schema.json`) as well as legacy `fileA`/`fileB`/`cochangePairs` aliases.
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
  const settings =
    typeof meta.settings === 'object' && meta.settings !== null && !Array.isArray(meta.settings)
      ? meta.settings
      : {};
  const evaluation =
    typeof raw.evaluation === 'object' && raw.evaluation !== null && !Array.isArray(raw.evaluation)
      ? raw.evaluation
      : {};
  const evalOpts =
    typeof evaluation.effectiveOptions === 'object' &&
    evaluation.effectiveOptions !== null &&
    !Array.isArray(evaluation.effectiveOptions)
      ? evaluation.effectiveOptions
      : {};

  const rawRepoName = meta.repoName ?? raw.repoName;
  if (rawRepoName !== undefined && typeof rawRepoName !== 'string') {
    throw new Error('Invalid Repo Archaeology "repoName": must be a string.');
  }
  if (meta.root !== undefined && typeof meta.root !== 'string') {
    throw new Error('Invalid Repo Archaeology "meta.root": must be a string.');
  }
  const rootBasename =
    typeof meta.root === 'string' && meta.root.trim().length > 0
      ? posix.basename(meta.root.trim().replace(/\\/g, '/').replace(/\/+$/, ''))
      : '';
  const repoLabel = truncateText(
    rawRepoName?.trim() || rootBasename || 'archaeology-snapshot',
    80,
  );

  const rawGeneratedAt =
    meta.generatedAt ??
    raw.generatedAt ??
    (typeof meta.newestCommit === 'string' ? `${meta.newestCommit}T00:00:00.000Z` : undefined);
  const ts =
    typeof rawGeneratedAt === 'string' && !Number.isNaN(Date.parse(rawGeneratedAt))
      ? new Date(Date.parse(rawGeneratedAt)).toISOString()
      : '2026-11-02T00:00:00.000Z';

  const runId = `reconstructed-${repoLabel.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

  const rawCommitsAnalyzed =
    meta.commitsAnalyzed ?? evaluation.commitsAnalyzed ?? raw.commitsAnalyzed;
  const rawWindowCommits =
    settings.maxCommits ?? evalOpts.maxCommits ?? meta.commitsRead ?? meta.windowCommits ?? raw.windowCommits;

  if (rawCommitsAnalyzed !== undefined) {
    requireNonNegativeInt(rawCommitsAnalyzed, 'commitsAnalyzed');
  }
  if (rawWindowCommits !== undefined) {
    requirePositiveInt(rawWindowCommits, 'maxCommits');
  }

  if (!Array.isArray(raw.suggestions) && !Array.isArray(raw.cochangePairs)) {
    throw new Error(
      'Invalid Repo Archaeology snapshot: missing required "suggestions" (or "cochangePairs") array.',
    );
  }

  const pairsInput = Array.isArray(raw.suggestions)
    ? raw.suggestions
    : (raw.cochangePairs as RepoArchaeologySuggestion[]);

  if (raw.totalSuggestions !== undefined) {
    requireNonNegativeInt(raw.totalSuggestions, 'totalSuggestions');
  }

  const derivedFileTouches = new Map<string, number>();

  const findings: CochangeFinding[] = pairsInput.map((pair, idx) => {
    if (typeof pair !== 'object' || pair === null || Array.isArray(pair)) {
      throw new Error(`Invalid Repo Archaeology suggestion at index ${idx}: must be an object.`);
    }
    const rawFileA = pair.from ?? pair.target ?? pair.fileA;
    const rawFileB = pair.to ?? pair.companion ?? pair.fileB;
    if (
      typeof rawFileA !== 'string' ||
      !rawFileA.trim() ||
      typeof rawFileB !== 'string' ||
      !rawFileB.trim()
    ) {
      throw new Error(
        `Invalid Repo Archaeology suggestion at index ${idx}: from/fileA and to/fileB must be non-empty strings.`,
      );
    }

    const sharedCommits = requirePositiveInt(
      pair.shared ?? pair.sharedCommits ?? pair.cochangeCount,
      `suggestions[${idx}].shared`,
    );
    const rawFileACommits = requirePositiveInt(
      pair.fromChanges ?? pair.targetCommits ?? pair.fileACommits,
      `suggestions[${idx}].fromChanges`,
      sharedCommits,
    );
    const rawFileBCommits = requirePositiveInt(
      pair.toChanges ?? pair.companionCommits ?? pair.fileBCommits,
      `suggestions[${idx}].toChanges`,
      sharedCommits,
    );

    // Extract commit hashes and sample subjects from either `evidence: EvidenceView[]` or `commitShas: string[]`
    let shas: string[] = [];
    let subjects: string[] = [];
    if (Array.isArray(pair.evidence) && pair.evidence.length > 0) {
      for (const ev of pair.evidence) {
        if (typeof ev !== 'object' || ev === null || typeof ev.hash !== 'string' || !ev.hash.trim()) {
          throw new Error(
            `Invalid Repo Archaeology suggestion at index ${idx}: evidence items must contain a non-empty hash string.`,
          );
        }
        if (shas.length < 8) shas.push(truncateText(ev.hash.trim(), 40));
        if (subjects.length < 3 && typeof ev.subject === 'string' && ev.subject.trim()) {
          subjects.push(truncateText(ev.subject.trim(), 200));
        }
      }
    } else if (
      Array.isArray(pair.commitShas) &&
      pair.commitShas.length > 0 &&
      pair.commitShas.every((s) => typeof s === 'string' && s.trim().length > 0)
    ) {
      shas = pair.commitShas.slice(0, 8).map((s) => truncateText(s.trim(), 40));
      if (Array.isArray(pair.sampleMessages)) {
        subjects = pair.sampleMessages.slice(0, 3).map((m) => truncateText(String(m), 200));
      }
    } else {
      throw new Error(
        `Invalid Repo Archaeology suggestion at index ${idx}: commitShas must be a non-empty array of commit SHA strings (or non-empty evidence array).`,
      );
    }

    const cleanFileA = validateFilePathLength(rawFileA.trim());
    const cleanFileB = validateFilePathLength(rawFileB.trim());
    if (cleanFileA === cleanFileB) {
      throw new Error(
        `Invalid Repo Archaeology suggestion at index ${idx}: from/fileA and to/fileB must be distinct file paths.`,
      );
    }
    const isOrdered = cleanFileA.localeCompare(cleanFileB) <= 0;
    const sortedFiles: [string, string] = isOrdered
      ? [cleanFileA, cleanFileB]
      : [cleanFileB, cleanFileA];
    const fileACommits = Math.max(sharedCommits, isOrdered ? rawFileACommits : rawFileBCommits);
    const fileBCommits = Math.max(sharedCommits, isOrdered ? rawFileBCommits : rawFileACommits);

    derivedFileTouches.set(
      sortedFiles[0],
      Math.max(derivedFileTouches.get(sortedFiles[0]) ?? 0, fileACommits),
    );
    derivedFileTouches.set(
      sortedFiles[1],
      Math.max(derivedFileTouches.get(sortedFiles[1]) ?? 0, fileBCommits),
    );

    const minCommits = Math.max(1, Math.min(fileACommits, fileBCommits));
    const unionCommits = Math.max(1, fileACommits + fileBCommits - sharedCommits);

    const computedOverlap = Math.min(1, Math.round((sharedCommits / minCommits) * 100) / 100);
    const computedJaccard = Math.min(1, Math.round((sharedCommits / unionCommits) * 100) / 100);

    const rawRatio = pair.confidence ?? pair.jaccardOrCoupling;
    if (
      rawRatio !== undefined &&
      (typeof rawRatio !== 'number' || !Number.isFinite(rawRatio) || rawRatio < 0 || rawRatio > 1)
    ) {
      throw new Error(`Invalid Repo Archaeology ratio at suggestions[${idx}]: must be a number in 0..1.`);
    }
    const rawRevRatio = pair.reverseConfidence;
    if (
      rawRevRatio !== undefined &&
      (typeof rawRevRatio !== 'number' ||
        !Number.isFinite(rawRevRatio) ||
        rawRevRatio < 0 ||
        rawRevRatio > 1)
    ) {
      throw new Error(
        `Invalid Repo Archaeology reverseConfidence at suggestions[${idx}]: must be a number in 0..1.`,
      );
    }
    const rawJaccard = pair.jaccard;
    if (
      rawJaccard !== undefined &&
      (typeof rawJaccard !== 'number' || !Number.isFinite(rawJaccard) || rawJaccard < 0 || rawJaccard > 1)
    ) {
      throw new Error(`Invalid Repo Archaeology jaccard at suggestions[${idx}]: must be a number in 0..1.`);
    }

    // Overlap is shared / min(fileACommits, fileBCommits), which equals max(confidence, reverseConfidence)
    // Only use directional confidence directly when BOTH confidence and reverseConfidence are present
    // (or legacy jaccardOrCoupling when explicit per-file commit counts were not provided).
    const hasBothDirectionalConfidences =
      pair.confidence !== undefined && rawRevRatio !== undefined;
    const hasExplicitPerFileCounts =
      (pair.fromChanges !== undefined ||
        pair.targetCommits !== undefined ||
        pair.fileACommits !== undefined) &&
      (pair.toChanges !== undefined ||
        pair.companionCommits !== undefined ||
        pair.fileBCommits !== undefined);
    const explicitCoupling = hasBothDirectionalConfidences
      ? Math.max(pair.confidence!, rawRevRatio!)
      : !hasExplicitPerFileCounts && pair.jaccardOrCoupling !== undefined
        ? pair.jaccardOrCoupling
        : undefined;

    const couplingRatio =
      explicitCoupling !== undefined
        ? Math.min(1, Math.max(0, Math.round(explicitCoupling * 100) / 100))
        : computedOverlap;
    const jaccardRatio =
      rawJaccard !== undefined
        ? Math.min(1, Math.max(0, Math.round(rawJaccard * 100) / 100))
        : computedJaccard;

    const id = `F-${String(idx + 1).padStart(2, '0')}`;
    const classification = classifyCochangePair(sortedFiles[0], sortedFiles[1]);
    const rel = describeCochangeRelationship({
      files: sortedFiles,
      cochangeCount: sharedCommits,
      fileACommits,
      fileBCommits,
      jaccardRatio,
      sampleSubjects: subjects,
      classification,
    });
    const customReason = (pair.why ?? pair.note ?? pair.reason)?.trim();
    const reason = truncateText(
      customReason ? `${rel.patternLabel}: ${customReason}` : `${rel.patternLabel}: ${rel.summary}`,
      320,
    );

    return fitFindingToPayloadBudget({
      id,
      files: sortedFiles,
      cochangeCount: sharedCommits,
      fileACommits,
      fileBCommits,
      couplingRatio,
      jaccardRatio,
      classification,
      evidence: {
        commitShas: shas,
        sampleSubjects: subjects,
        count: sharedCommits,
      },
      reason,
    });
  });

  if (Array.isArray(raw.families)) {
    for (const fam of raw.families) {
      if (fam && typeof fam === 'object' && Array.isArray(fam.members)) {
        for (const m of fam.members) {
          if (
            typeof m === 'object' &&
            m !== null &&
            typeof m.path === 'string' &&
            m.path.trim() &&
            typeof m.changes === 'number' &&
            Number.isInteger(m.changes) &&
            m.changes >= 1
          ) {
            const p = validateFilePathLength(m.path.trim());
            derivedFileTouches.set(p, Math.max(derivedFileTouches.get(p) ?? 0, m.changes));
          }
        }
      }
    }
  }

  const commitsExamined = requireNonNegativeInt(
    rawCommitsAnalyzed ?? rawWindowCommits,
    'commitsAnalyzed',
  );
  const maxCommits = requirePositiveInt(
    rawWindowCommits ?? (commitsExamined > 0 ? commitsExamined : 1),
    'maxCommits',
  );

  const uniqueFilesObserved = requireNonNegativeInt(
    meta.files ?? meta.filesAnalyzed ?? raw.filesAnalyzed,
    'files',
    derivedFileTouches.size,
  );
  const totalPairsObserved = requireNonNegativeInt(
    meta.totalCoupledPairs ?? raw.totalCoupledPairs ?? raw.totalSuggestions,
    'totalSuggestions',
    pairsInput.length,
  );

  const hotFiles: HotFileSummary[] = Array.isArray(raw.hotspots)
    ? raw.hotspots.map((h, idx) => {
        if (typeof h !== 'object' || h === null || typeof h.path !== 'string' || !h.path.trim()) {
          throw new Error(`Invalid hotspot at hotspots[${idx}]: path must be a non-empty string.`);
        }
        const touches = requirePositiveInt(h.touches, `hotspots[${idx}].touches`);
        return {
          file: validateFilePathLength(h.path.trim()),
          commits: touches,
          share:
            commitsExamined > 0
              ? Math.min(1, Math.round((touches / commitsExamined) * 100) / 100)
              : 0,
        };
      })
    : Array.from(derivedFileTouches.entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 6)
        .map(([file, touches]) => ({
          file,
          commits: touches,
          share:
            commitsExamined > 0
              ? Math.min(1, Math.round((touches / commitsExamined) * 100) / 100)
              : 0,
        }));

  const reconstructedNote =
    'Reconstructed from a completed Repo Archaeology (schemaVersion: 1) analysis, not live events';

  const inputWarnings: string[] = [];
  for (const warnList of [meta.warnings, raw.warnings]) {
    if (warnList !== undefined) {
      if (
        !Array.isArray(warnList) ||
        !warnList.every((w) => typeof w === 'string' && w.trim().length > 0)
      ) {
        throw new Error(
          'Invalid Repo Archaeology "warnings": must be an array of non-empty strings.',
        );
      }
      for (const w of warnList) {
        const cleanW = truncateText(w.trim(), 300);
        if (!inputWarnings.includes(cleanW)) inputWarnings.push(cleanW);
      }
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
    summary: `${commitsExamined} ${pluralize(commitsExamined, 'commit', 'commits')} · ${uniqueFilesObserved} ${pluralize(uniqueFilesObserved, 'file', 'files')} (reconstructed)`,
  });

  pushEv('step-start', 'pair-cochanges', { title: 'Pair co-changing files (reconstructed)' });
  pushEv('metric', 'pair-cochanges', { name: 'totalPairsObserved', value: totalPairsObserved });
  for (const w of inputWarnings) {
    pushEv('warning', 'pair-cochanges', { message: w });
  }
  pushEv('step-end', 'pair-cochanges', {
    status: 'ok',
    summary: `${totalPairsObserved} co-change ${pluralize(totalPairsObserved, 'pair', 'pairs')} (reconstructed)`,
  });

  pushEv('step-start', 'rank-findings', { title: 'Rank coupled file pairs (reconstructed)' });
  for (const f of findings) {
    pushEv('finding', 'rank-findings', { finding: f });
  }
  pushEv('warning', 'rank-findings', { message: reconstructedNote });
  pushEv('step-end', 'rank-findings', {
    status: 'ok',
    summary: `${findings.length} ${pluralize(findings.length, 'finding', 'findings')} reconstructed`,
  });

  pushEv('run-end', null, {
    status: 'completed',
    reconstructed: snapshot.reconstructed,
    hotFiles,
    summary: reconstructedNote,
  });

  return { snapshot: snapValidation.snapshot, events };
}
