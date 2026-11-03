import {
  EVENT_TYPES,
  FINDING_CLASSIFICATIONS,
  MAX_PAYLOAD_BYTES,
  RUN_END_STATUSES,
  SCHEMA_VERSION,
  STEP_END_STATUSES,
  type CochangeFinding,
  type EventType,
  type FindingClassification,
  type HotFileSummary,
  type ReconstructedMetadata,
  type ResultSnapshot,
  type RunEndStatus,
  type StepEndStatus,
  type StoryboardEvent,
} from './types.js';

const EVENT_TYPE_SET = new Set<string>(EVENT_TYPES);
const STEP_STATUS_SET = new Set<string>(STEP_END_STATUSES);
const RUN_STATUS_SET = new Set<string>(RUN_END_STATUSES);
const FINDING_CLASSIFICATION_SET = new Set<string>(FINDING_CLASSIFICATIONS);
const NON_NEGATIVE_METRIC_NAMES = new Set<string>([
  'commitsExamined',
  'uniqueFilesObserved',
  'totalPairsObserved',
]);

// Cut numbers (C-01, C-02, etc.) are strictly presentation labels assigned by renderers.
// Domain stepId values must never use cut-number syntax.
const PRESENTATION_CUT_REGEX = /^C-\d+$/i;

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function isNonEmptyString(val: unknown): val is string {
  return typeof val === 'string' && val.trim().length > 0;
}

function isFiniteNumber(val: unknown): val is number {
  return typeof val === 'number' && Number.isFinite(val);
}

function isValidIsoTimestamp(val: unknown): val is string {
  if (typeof val !== 'string' || val.length < 10) return false;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) return false;
  const parsed = Date.parse(val);
  return Number.isFinite(parsed);
}

function utf8ByteLength(str: string): number {
  return new TextEncoder().encode(str).byteLength;
}

export function validateHotFiles(
  raw: unknown,
  label = 'hotFiles',
): { ok: true; value: HotFileSummary[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) {
    return { ok: false, error: `${label} must be an array.` };
  }
  const out: HotFileSummary[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!isPlainObject(item)) {
      return { ok: false, error: `${label}[${i}] must be an object.` };
    }
    if (!isNonEmptyString(item.file)) {
      return { ok: false, error: `${label}[${i}].file must be a non-empty string.` };
    }
    if (!isFiniteNumber(item.commits) || !Number.isInteger(item.commits) || item.commits < 1) {
      return { ok: false, error: `${label}[${i}].commits must be a positive integer.` };
    }
    const share = item.share !== undefined ? item.share : 0;
    if (!isFiniteNumber(share) || share < 0 || share > 1) {
      return { ok: false, error: `${label}[${i}].share must be a finite number between 0 and 1.` };
    }
    out.push({
      file: item.file,
      commits: item.commits,
      share,
    });
  }
  return { ok: true, value: out };
}

export function validateReconstructedMetadata(
  raw: unknown,
  label = 'reconstructed',
): { ok: true; value: ReconstructedMetadata } | { ok: false; error: string } {
  if (!isPlainObject(raw)) {
    return { ok: false, error: `${label} must be an object.` };
  }
  if (!isNonEmptyString(raw.source)) {
    return { ok: false, error: `${label}.source must be a non-empty string.` };
  }
  const ver = raw.originalSchemaVersion;
  const validVer =
    isNonEmptyString(ver) || (isFiniteNumber(ver) && Number.isInteger(ver) && ver >= 1);
  if (!validVer) {
    return {
      ok: false,
      error: `${label}.originalSchemaVersion must be a positive integer or non-empty string.`,
    };
  }
  if (!isNonEmptyString(raw.note)) {
    return { ok: false, error: `${label}.note must be a non-empty string.` };
  }
  return {
    ok: true,
    value: {
      source: raw.source,
      originalSchemaVersion: ver as number | string,
      note: raw.note,
    },
  };
}

export function validateEvent(
  raw: unknown,
): { ok: true; event: StoryboardEvent; value: StoryboardEvent } | { ok: false; error: string } {
  if (!isPlainObject(raw)) {
    return { ok: false, error: 'Event must be a JSON object.' };
  }

  if (raw.schemaVersion !== SCHEMA_VERSION) {
    return {
      ok: false,
      error: `Unsupported schemaVersion "${String(raw.schemaVersion)}". Expected "${SCHEMA_VERSION}".`,
    };
  }

  if (!isNonEmptyString(raw.eventId)) {
    return { ok: false, error: 'Event must have a non-empty string "eventId".' };
  }

  if (!isNonEmptyString(raw.runId)) {
    return { ok: false, error: 'Event must have a non-empty string "runId".' };
  }

  if (typeof raw.seq !== 'number' || !Number.isInteger(raw.seq) || raw.seq < 1) {
    return { ok: false, error: `Invalid "seq" (${String(raw.seq)}). Must be a positive integer >= 1.` };
  }

  if (!isValidIsoTimestamp(raw.ts)) {
    return { ok: false, error: `Invalid ISO-8601 timestamp "ts": "${String(raw.ts)}".` };
  }

  if (typeof raw.type !== 'string' || !EVENT_TYPE_SET.has(raw.type)) {
    return { ok: false, error: `Unknown event type "${String(raw.type)}".` };
  }
  const eventType = raw.type as EventType;

  if (raw.stepId !== null && typeof raw.stepId !== 'string') {
    return { ok: false, error: '"stepId" must be a string or null.' };
  }

  if (typeof raw.stepId === 'string') {
    if (raw.stepId.trim().length === 0) {
      return { ok: false, error: '"stepId" cannot be an empty string; use null for run-level events.' };
    }
    if (PRESENTATION_CUT_REGEX.test(raw.stepId.trim())) {
      return {
        ok: false,
        error: `Invalid stepId "${raw.stepId}": cut labels (C-01, C-02) are presentation-only and must not be used as domain stepId.`,
      };
    }
  }

  if (!isPlainObject(raw.payload)) {
    return { ok: false, error: '"payload" must be a plain object.' };
  }

  let serializedPayload: string;
  try {
    serializedPayload = JSON.stringify(raw.payload);
  } catch {
    return { ok: false, error: '"payload" is not JSON-serializable.' };
  }

  const payloadBytes = utf8ByteLength(serializedPayload);
  if (payloadBytes > MAX_PAYLOAD_BYTES) {
    return {
      ok: false,
      error: `Event payload size (${payloadBytes} bytes) exceeds maximum allowed (${MAX_PAYLOAD_BYTES} bytes).`,
    };
  }

  // Event-specific structural rules
  if (eventType === 'run-start' || eventType === 'run-end') {
    if (raw.stepId !== null) {
      return { ok: false, error: `Event "${eventType}" must have stepId: null.` };
    }
  }

  if (eventType === 'step-start' || eventType === 'step-progress' || eventType === 'step-end') {
    if (!isNonEmptyString(raw.stepId)) {
      return { ok: false, error: `Event "${eventType}" requires a non-null semantic "stepId".` };
    }
  }

  if (eventType === 'step-start') {
    if (!isNonEmptyString(raw.payload.title)) {
      return { ok: false, error: 'Event "step-start" requires a non-empty string payload.title.' };
    }
  }

  if (eventType === 'step-end') {
    const status = raw.payload.status;
    if (typeof status !== 'string' || !STEP_STATUS_SET.has(status)) {
      return {
        ok: false,
        error: `Event "step-end" requires payload.status in [${STEP_END_STATUSES.join(', ')}], got "${String(status)}".`,
      };
    }
  }

  if (eventType === 'run-end') {
    const status = raw.payload.status;
    if (typeof status !== 'string' || !RUN_STATUS_SET.has(status)) {
      return {
        ok: false,
        error: `Event "run-end" requires payload.status in [${RUN_END_STATUSES.join(', ')}], got "${String(status)}".`,
      };
    }
    if (raw.payload.hotFiles !== undefined) {
      const hfRes = validateHotFiles(raw.payload.hotFiles, 'run-end.payload.hotFiles');
      if (!hfRes.ok) return hfRes;
    }
    if (
      raw.payload.reconstructed !== undefined &&
      typeof raw.payload.reconstructed !== 'boolean'
    ) {
      const rcRes = validateReconstructedMetadata(
        raw.payload.reconstructed,
        'run-end.payload.reconstructed',
      );
      if (!rcRes.ok) return rcRes;
    }
  }

  if (eventType === 'finding') {
    const fRes = validateFinding(raw.payload.finding, 0);
    if (!fRes.ok) {
      return {
        ok: false,
        error: `Invalid "finding" event payload: ${fRes.error}`,
      };
    }
  }

  if (eventType === 'metric') {
    if (!isNonEmptyString(raw.payload.name)) {
      return { ok: false, error: 'Event "metric" requires a non-empty string payload.name.' };
    }
    const val = raw.payload.value;
    if (!isFiniteNumber(val) && typeof val !== 'string') {
      return {
        ok: false,
        error: 'Event "metric" requires payload.value to be a finite number or string.',
      };
    }
    if (NON_NEGATIVE_METRIC_NAMES.has(raw.payload.name)) {
      if (!isFiniteNumber(val) || !Number.isInteger(val) || val < 0) {
        return {
          ok: false,
          error: `Event "metric" (${raw.payload.name}) requires a non-negative integer value, got "${String(val)}".`,
        };
      }
    }
  }

  if (eventType === 'warning') {
    if (!isNonEmptyString(raw.payload.message)) {
      return { ok: false, error: 'Event "warning" requires a non-empty string payload.message.' };
    }
  }

  const validated: StoryboardEvent = {
    schemaVersion: SCHEMA_VERSION,
    eventId: raw.eventId,
    runId: raw.runId,
    seq: raw.seq,
    ts: raw.ts,
    type: eventType,
    stepId: raw.stepId as string | null,
    payload: raw.payload,
  };

  return { ok: true, event: validated, value: validated };
}

export interface StepExecutionRecord {
  stepId: string;
  title: string;
  startedAt: string;
  finishedAt?: string;
  status: StepEndStatus | 'running';
  summary?: string;
  metrics: Record<string, number | string>;
}

/**
 * Stateful validator for a stream of StoryboardEvents belonging to a single run.
 * Enforces sequence monotonicity, runId consistency, step lifecycle transitions,
 * and ensures no events occur after run-end.
 */
export class StoryboardStreamValidator {
  private expectedSeq = 1;
  private runId: string | null = null;
  private seenEventIds = new Set<string>();
  private openSteps = new Set<string>();
  private seenSteps = new Map<string, StepExecutionRecord>();
  private stepOrder: string[] = [];
  private runStarted = false;
  private runEnded = false;
  private runStatus: RunEndStatus | null = null;
  private events: StoryboardEvent[] = [];

  public push(
    raw: unknown,
  ): { ok: true; event: StoryboardEvent } | { ok: false; error: string } {
    const single = validateEvent(raw);
    if (!single.ok) {
      return single;
    }
    const ev = single.event;

    if (this.runEnded) {
      return {
        ok: false,
        error: `Event "${ev.eventId}" (${ev.type}) received after "run-end". No events may be emitted after run-end.`,
      };
    }

    if (this.seenEventIds.has(ev.eventId)) {
      return {
        ok: false,
        error: `Duplicate eventId "${ev.eventId}" in stream.`,
      };
    }

    if (ev.seq !== this.expectedSeq) {
      return {
        ok: false,
        error: `Out-of-order or gapped seq: expected ${this.expectedSeq}, got ${ev.seq}.`,
      };
    }

    if (this.expectedSeq === 1) {
      if (ev.type !== 'run-start') {
        return {
          ok: false,
          error: `First event in stream (seq=1) must be "run-start", got "${ev.type}".`,
        };
      }
      this.runId = ev.runId;
      this.runStarted = true;
    } else {
      if (ev.type === 'run-start') {
        return {
          ok: false,
          error: `Duplicate "run-start" at seq=${ev.seq}.`,
        };
      }
      if (ev.runId !== this.runId) {
        return {
          ok: false,
          error: `Mismatched runId at seq=${ev.seq}: expected "${this.runId}", got "${ev.runId}".`,
        };
      }
    }

    if (ev.type === 'step-start') {
      const stepId = ev.stepId!;
      if (this.openSteps.has(stepId)) {
        return {
          ok: false,
          error: `Step "${stepId}" is already open at seq=${ev.seq}.`,
        };
      }
      this.openSteps.add(stepId);
      if (!this.seenSteps.has(stepId)) {
        this.stepOrder.push(stepId);
      }
      this.seenSteps.set(stepId, {
        stepId,
        title: String(ev.payload.title),
        startedAt: ev.ts,
        status: 'running',
        metrics: {},
      });
    } else if (ev.type === 'step-progress') {
      const stepId = ev.stepId!;
      if (!this.openSteps.has(stepId)) {
        return {
          ok: false,
          error: `Event "step-progress" for step "${stepId}" at seq=${ev.seq} requires an active open step.`,
        };
      }
    } else if (ev.type === 'metric') {
      if (ev.stepId !== null && !this.openSteps.has(ev.stepId)) {
        return {
          ok: false,
          error: `Event "metric" for step "${ev.stepId}" at seq=${ev.seq} references a step that is not open.`,
        };
      }
      if (ev.stepId !== null && isNonEmptyString(ev.payload.name)) {
        const rec = this.seenSteps.get(ev.stepId);
        const val = ev.payload.value;
        if (rec && (typeof val === 'number' || typeof val === 'string')) {
          rec.metrics[ev.payload.name] = val;
        }
      }
    } else if (ev.type === 'finding' || ev.type === 'warning') {
      if (ev.stepId !== null && !this.openSteps.has(ev.stepId)) {
        return {
          ok: false,
          error: `Event "${ev.type}" for step "${ev.stepId}" at seq=${ev.seq} references a step that is not open.`,
        };
      }
    } else if (ev.type === 'step-end') {
      const stepId = ev.stepId!;
      if (!this.openSteps.has(stepId)) {
        return {
          ok: false,
          error: `Event "step-end" for step "${stepId}" at seq=${ev.seq} cannot close a step that was not started or is already closed.`,
        };
      }
      this.openSteps.delete(stepId);
      const rec = this.seenSteps.get(stepId);
      if (rec) {
        rec.finishedAt = ev.ts;
        rec.status = ev.payload.status as StepEndStatus;
        if (typeof ev.payload.summary === 'string') {
          rec.summary = ev.payload.summary;
        }
      }
    } else if (ev.type === 'run-end') {
      if (this.openSteps.size > 0) {
        return {
          ok: false,
          error: `Event "run-end" at seq=${ev.seq} cannot be emitted while steps are still open: ${Array.from(this.openSteps).join(', ')}.`,
        };
      }
      this.runEnded = true;
      this.runStatus = ev.payload.status as RunEndStatus;
    }

    this.seenEventIds.add(ev.eventId);
    this.expectedSeq += 1;
    this.events.push(ev);

    return { ok: true, event: ev };
  }

  public getOpenSteps(): string[] {
    return Array.from(this.openSteps);
  }

  public isEnded(): boolean {
    return this.runEnded;
  }

  public finalize():
    | {
        ok: true;
        events: StoryboardEvent[];
        steps: StepExecutionRecord[];
        runStatus: RunEndStatus;
      }
    | { ok: false; error: string } {
    if (!this.runStarted) {
      return { ok: false, error: 'Stream is empty or missing "run-start".' };
    }
    if (!this.runEnded || !this.runStatus) {
      return { ok: false, error: 'Incomplete event stream: missing terminal "run-end" event.' };
    }
    const steps = this.stepOrder.map((id) => this.seenSteps.get(id)!);
    return {
      ok: true,
      events: [...this.events],
      steps,
      runStatus: this.runStatus,
    };
  }
}

export function validateEventStream(
  rawEvents: unknown[],
):
  | {
      ok: true;
      events: StoryboardEvent[];
      steps: StepExecutionRecord[];
      runStatus: RunEndStatus;
    }
  | { ok: false; error: string } {
  if (!Array.isArray(rawEvents) || rawEvents.length === 0) {
    return { ok: false, error: 'Event stream must be a non-empty array of events.' };
  }
  const validator = new StoryboardStreamValidator();
  for (const raw of rawEvents) {
    const res = validator.push(raw);
    if (!res.ok) {
      return res;
    }
  }
  return validator.finalize();
}

function validateFinding(
  raw: unknown,
  index: number,
): { ok: true; value: CochangeFinding } | { ok: false; error: string } {
  if (!isPlainObject(raw)) {
    return { ok: false, error: `findings[${index}] must be an object.` };
  }
  if (!isNonEmptyString(raw.id)) {
    return { ok: false, error: `findings[${index}].id must be a non-empty string.` };
  }
  if (
    !Array.isArray(raw.files) ||
    raw.files.length !== 2 ||
    !isNonEmptyString(raw.files[0]) ||
    !isNonEmptyString(raw.files[1])
  ) {
    return { ok: false, error: `findings[${index}].files must be a 2-tuple of non-empty file path strings.` };
  }
  if (!isFiniteNumber(raw.cochangeCount) || raw.cochangeCount < 1) {
    return { ok: false, error: `findings[${index}].cochangeCount must be a positive finite number.` };
  }
  if (!isFiniteNumber(raw.fileACommits) || raw.fileACommits < 1) {
    return { ok: false, error: `findings[${index}].fileACommits must be a positive finite number.` };
  }
  if (!isFiniteNumber(raw.fileBCommits) || raw.fileBCommits < 1) {
    return { ok: false, error: `findings[${index}].fileBCommits must be a positive finite number.` };
  }
  if (!isFiniteNumber(raw.couplingRatio) || raw.couplingRatio < 0 || raw.couplingRatio > 1) {
    return { ok: false, error: `findings[${index}].couplingRatio must be a finite number between 0 and 1.` };
  }
  const unionCommits = Math.max(1, raw.fileACommits + raw.fileBCommits - raw.cochangeCount);
  const computedJaccard = Math.min(1, Math.max(0, Math.round((raw.cochangeCount / unionCommits) * 100) / 100));
  const jaccardRatio = raw.jaccardRatio !== undefined ? raw.jaccardRatio : computedJaccard;
  if (!isFiniteNumber(jaccardRatio) || jaccardRatio < 0 || jaccardRatio > 1) {
    return { ok: false, error: `findings[${index}].jaccardRatio must be a finite number between 0 and 1.` };
  }
  if (!isPlainObject(raw.evidence)) {
    return { ok: false, error: `findings[${index}].evidence must be an object.` };
  }
  if (
    !Array.isArray(raw.evidence.commitShas) ||
    raw.evidence.commitShas.length === 0 ||
    !raw.evidence.commitShas.every((s) => isNonEmptyString(s))
  ) {
    return { ok: false, error: `findings[${index}].evidence.commitShas must be a non-empty string[].` };
  }
  if (
    !Array.isArray(raw.evidence.sampleSubjects) ||
    !raw.evidence.sampleSubjects.every((s) => typeof s === 'string')
  ) {
    return { ok: false, error: `findings[${index}].evidence.sampleSubjects must be a string[].` };
  }
  if (!isFiniteNumber(raw.evidence.count) || raw.evidence.count < 1) {
    return { ok: false, error: `findings[${index}].evidence.count must be a positive finite number.` };
  }
  if (!isNonEmptyString(raw.reason)) {
    return { ok: false, error: `findings[${index}].reason must be a non-empty string.` };
  }
  if (
    raw.classification !== undefined &&
    (typeof raw.classification !== 'string' || !FINDING_CLASSIFICATION_SET.has(raw.classification))
  ) {
    return {
      ok: false,
      error: `findings[${index}].classification must be one of [${FINDING_CLASSIFICATIONS.join(', ')}].`,
    };
  }

  return {
    ok: true,
    value: {
      id: raw.id,
      files: [raw.files[0], raw.files[1]],
      cochangeCount: raw.cochangeCount,
      fileACommits: raw.fileACommits,
      fileBCommits: raw.fileBCommits,
      couplingRatio: raw.couplingRatio,
      jaccardRatio,
      ...(raw.classification !== undefined
        ? { classification: raw.classification as FindingClassification }
        : {}),
      evidence: {
        commitShas: raw.evidence.commitShas as string[],
        sampleSubjects: raw.evidence.sampleSubjects as string[],
        count: raw.evidence.count,
      },
      reason: raw.reason,
    },
  };
}

export function validateResultSnapshot(
  raw: unknown,
): { ok: true; snapshot: ResultSnapshot; value: ResultSnapshot } | { ok: false; error: string } {
  if (!isPlainObject(raw)) {
    return { ok: false, error: 'ResultSnapshot must be a JSON object.' };
  }
  if (raw.schemaVersion !== SCHEMA_VERSION) {
    return {
      ok: false,
      error: `Unsupported ResultSnapshot schemaVersion "${String(raw.schemaVersion)}". Expected "${SCHEMA_VERSION}".`,
    };
  }
  if (!isNonEmptyString(raw.runId)) {
    return { ok: false, error: 'ResultSnapshot requires a non-empty "runId".' };
  }
  if (typeof raw.status !== 'string' || !RUN_STATUS_SET.has(raw.status)) {
    return {
      ok: false,
      error: `Invalid ResultSnapshot status "${String(raw.status)}".`,
    };
  }
  if (!isNonEmptyString(raw.repoLabel)) {
    return { ok: false, error: 'ResultSnapshot requires a non-empty "repoLabel".' };
  }
  if (!isValidIsoTimestamp(raw.startedAt) || !isValidIsoTimestamp(raw.finishedAt)) {
    return { ok: false, error: 'ResultSnapshot requires valid ISO-8601 startedAt and finishedAt timestamps.' };
  }
  if (!isFiniteNumber(raw.maxCommits) || !Number.isInteger(raw.maxCommits) || raw.maxCommits < 1) {
    return { ok: false, error: 'ResultSnapshot requires finite integer maxCommits >= 1.' };
  }
  if (!isFiniteNumber(raw.commitsExamined) || !Number.isInteger(raw.commitsExamined) || raw.commitsExamined < 0) {
    return { ok: false, error: 'ResultSnapshot requires finite integer commitsExamined >= 0.' };
  }
  if (!isFiniteNumber(raw.uniqueFilesObserved) || !Number.isInteger(raw.uniqueFilesObserved) || raw.uniqueFilesObserved < 0) {
    return { ok: false, error: 'ResultSnapshot requires finite integer uniqueFilesObserved >= 0.' };
  }
  if (!isFiniteNumber(raw.totalPairsObserved) || !Number.isInteger(raw.totalPairsObserved) || raw.totalPairsObserved < 0) {
    return { ok: false, error: 'ResultSnapshot requires finite integer totalPairsObserved >= 0.' };
  }
  if (!Array.isArray(raw.findings)) {
    return { ok: false, error: 'ResultSnapshot.findings must be an array.' };
  }

  const findings: CochangeFinding[] = [];
  for (let i = 0; i < raw.findings.length; i++) {
    const fRes = validateFinding(raw.findings[i], i);
    if (!fRes.ok) return fRes;
    findings.push(fRes.value);
  }

  const hfRes = validateHotFiles(raw.hotFiles, 'ResultSnapshot.hotFiles');
  if (!hfRes.ok) return hfRes;

  if (!Array.isArray(raw.warnings) || !raw.warnings.every((w) => typeof w === 'string')) {
    return { ok: false, error: 'ResultSnapshot.warnings must be a string[].' };
  }

  let reconstructed: ReconstructedMetadata | undefined;
  if (raw.reconstructed !== undefined) {
    const rcRes = validateReconstructedMetadata(raw.reconstructed, 'ResultSnapshot.reconstructed');
    if (!rcRes.ok) return rcRes;
    reconstructed = rcRes.value;
  }

  const snapshot: ResultSnapshot = {
    ...(raw as unknown as ResultSnapshot),
    findings,
    hotFiles: hfRes.value,
    ...(reconstructed ? { reconstructed } : {}),
  };
  return { ok: true, snapshot, value: snapshot };
}
