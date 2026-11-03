export const SCHEMA_VERSION = '0-experimental' as const;
export type SchemaVersion = typeof SCHEMA_VERSION;

export const MAX_PAYLOAD_BYTES = 8192;

export const EVENT_TYPES = [
  'run-start',
  'step-start',
  'step-progress',
  'metric',
  'finding',
  'warning',
  'step-end',
  'run-end',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export const CANONICAL_STEP_IDS = [
  'validate-repo',
  'read-history',
  'pair-cochanges',
  'rank-findings',
] as const;

export type CanonicalStepId = (typeof CANONICAL_STEP_IDS)[number];
export type StepId = CanonicalStepId | (string & {});

export const STEP_END_STATUSES = ['ok', 'warning', 'error', 'skipped'] as const;
export type StepEndStatus = (typeof STEP_END_STATUSES)[number];

export const RUN_END_STATUSES = ['completed', 'failed', 'canceled'] as const;
export type RunEndStatus = (typeof RUN_END_STATUSES)[number];

export interface StoryboardEvent {
  schemaVersion: SchemaVersion;
  eventId: string;
  runId: string;
  seq: number;
  ts: string;
  type: EventType;
  stepId: string | null;
  payload: Record<string, unknown>;
}

export interface CochangeEvidence {
  commitShas: string[];
  sampleSubjects: string[];
  count: number;
}

export interface CochangeFinding {
  id: string;
  files: [string, string];
  cochangeCount: number;
  fileACommits: number;
  fileBCommits: number;
  /** Overlap ratio: cochangeCount / Math.min(fileACommits, fileBCommits) */
  couplingRatio: number;
  /** Jaccard similarity: cochangeCount / (fileACommits + fileBCommits - cochangeCount) */
  jaccardRatio: number;
  evidence: CochangeEvidence;
  reason: string;
}

export interface HotFileSummary {
  file: string;
  commits: number;
  share: number;
}

export interface ReconstructedMetadata {
  source: string;
  originalSchemaVersion: number | string;
  note: string;
}

export interface ResultSnapshot {
  schemaVersion: SchemaVersion;
  runId: string;
  status: RunEndStatus;
  repoLabel: string;
  startedAt: string;
  finishedAt: string;
  maxCommits: number;
  commitsExamined: number;
  uniqueFilesObserved: number;
  totalPairsObserved: number;
  findings: CochangeFinding[];
  hotFiles: HotFileSummary[];
  warnings: string[];
  error?: string;
  reconstructed?: ReconstructedMetadata;
}

export type ValidationResult<T> =
  | { ok: true; value: T; event?: T }
  | { ok: false; error: string };
