/**
 * Validation for event contract v1. Every function here takes `unknown` input and never throws:
 * failures come back as typed issues. Unknown event types are reported as ignorable warnings
 * (forward compatibility), and unknown fields are preserved on the returned value.
 */
import {
  DEFAULT_MAX_EVENT_BYTES,
  DEFAULT_MAX_SNAPSHOT_BYTES,
  EVENT_BASE_SPEC,
  EVENT_SPEC,
  EVENT_TYPES,
  FORBIDDEN_KEYS,
  ID_PATTERN,
  OBJECT_SPEC,
  PRESENTATION_LABEL_PATTERN,
  SCHEMA_VERSION,
  TIMESTAMP_PATTERN,
  type EventType,
  type FieldSpec,
  type ObjectName,
  type ObjectSpec,
  type Snapshot,
  type TerminalEvent,
} from './contract.js';

export const VALIDATION_CODES = [
  'not-object',
  'unsupported-schema-version',
  'unknown-event-type',
  'missing-field',
  'wrong-type',
  'invalid-value',
  'presentation-label-id',
  'too-large',
  'not-serializable',
  'duplicate-id',
  'run-id-mismatch',
  'seq-not-increasing',
  'progress-regressed',
  'after-run-end',
  'missing-run-start',
  'cut-not-started',
  'cut-already-started',
  'cut-not-ended',
  'unknown-finding',
  'missing-run-end',
  'forbidden-key',
] as const;
export type ValidationCode = (typeof VALIDATION_CODES)[number];

export interface ValidationIssue {
  code: ValidationCode;
  /** JSON-pointer-like path to the offending field, e.g. `finding.subject[0].label`. */
  path: string;
  message: string;
  /** `warning` issues are ignorable: the event is dropped, the stream continues. */
  severity: 'error' | 'warning';
}

export type ValidationResult<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      issues: ValidationIssue[];
      /** True when every issue is a warning (an unknown event type from a newer producer). */
      ignorable: boolean;
    };

export interface ValidateOptions {
  /** Maximum serialized UTF-8 size of a non-snapshot event. Default 8 KiB. */
  maxEventBytes?: number;
  /** Maximum serialized UTF-8 size of a snapshot (or `snapshot` event). Default 1 MiB. */
  maxSnapshotBytes?: number;
}

const EVENT_TYPE_SET = new Set<string>(EVENT_TYPES);
const ID_RE = new RegExp(ID_PATTERN);
const LABEL_RE = new RegExp(PRESENTATION_LABEL_PATTERN);
const ISO_RE = new RegExp(TIMESTAMP_PATTERN);
const MAX_ISSUES = 20;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

const encoder = new TextEncoder();
function byteLength(value: unknown): number | undefined {
  try {
    const json = JSON.stringify(value);
    return json === undefined ? undefined : encoder.encode(json).byteLength;
  } catch {
    return undefined;
  }
}

function issue(code: ValidationCode, path: string, message: string, severity: 'error' | 'warning' = 'error'): ValidationIssue {
  return { code, path, message, severity };
}

function join(path: string, key: string | number): string {
  if (typeof key === 'number') return `${path}[${key}]`;
  return path ? `${path}.${key}` : key;
}

function checkField(value: unknown, spec: FieldSpec, path: string, out: ValidationIssue[]): void {
  if (out.length >= MAX_ISSUES) return;
  switch (spec.kind) {
    case 'string':
      if (typeof value !== 'string') return void out.push(issue('wrong-type', path, `${path} must be a string.`));
      if (spec.nonEmpty && value.trim() === '') out.push(issue('invalid-value', path, `${path} must not be empty.`));
      if (spec.maxLength !== undefined && value.length > spec.maxLength) {
        out.push(issue('invalid-value', path, `${path} must be at most ${spec.maxLength} characters.`));
      }
      return;
    case 'id':
      if (typeof value !== 'string') return void out.push(issue('wrong-type', path, `${path} must be a string id.`));
      if (!ID_RE.test(value)) {
        return void out.push(issue('invalid-value', path, `${path} must be 1–128 characters without whitespace or control characters.`));
      }
      if (LABEL_RE.test(value)) {
        out.push(
          issue(
            'presentation-label-id',
            path,
            `${path} "${value}" looks like a presentation label (C-01, F-01, E-01). Labels are assigned by renderers; use a stable domain id such as "read-history".`,
          ),
        );
      }
      return;
    case 'timestamp':
      if (typeof value !== 'string' || !ISO_RE.test(value) || !Number.isFinite(Date.parse(value))) {
        out.push(issue('invalid-value', path, `${path} must be an ISO 8601 timestamp with a time zone (e.g. 2026-11-10T12:00:00Z).`));
      }
      return;
    case 'integer':
      if (typeof value !== 'number' || !Number.isInteger(value)) return void out.push(issue('wrong-type', path, `${path} must be an integer.`));
      if (spec.min !== undefined && value < spec.min) out.push(issue('invalid-value', path, `${path} must be >= ${spec.min}.`));
      return;
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) return void out.push(issue('wrong-type', path, `${path} must be a finite number.`));
      if (spec.min !== undefined && value < spec.min) out.push(issue('invalid-value', path, `${path} must be >= ${spec.min}.`));
      if (spec.max !== undefined && value > spec.max) out.push(issue('invalid-value', path, `${path} must be <= ${spec.max}.`));
      return;
    case 'string-or-number':
      if (typeof value === 'string') return;
      if (typeof value !== 'number' || !Number.isFinite(value)) out.push(issue('wrong-type', path, `${path} must be a string or a finite number.`));
      return;
    case 'boolean':
      if (typeof value !== 'boolean') out.push(issue('wrong-type', path, `${path} must be a boolean.`));
      return;
    case 'const':
      if (value !== spec.value) out.push(issue('invalid-value', path, `${path} must be ${JSON.stringify(spec.value)}.`));
      return;
    case 'enum':
      if (typeof value !== 'string' || !spec.values.includes(value)) {
        out.push(issue('invalid-value', path, `${path} must be one of: ${spec.values.join(', ')}.`));
      }
      return;
    case 'href':
      // Structural check only; `safeLink` decides at render time whether a link may be emitted.
      if (typeof value !== 'string' || value.length === 0 || value.length > 2048) {
        out.push(issue('wrong-type', path, `${path} must be a URL string of at most 2048 characters.`));
      }
      return;
    case 'object':
      checkObject(value, OBJECT_SPEC[spec.ref], path, out, spec.ref);
      return;
    case 'array':
      if (!Array.isArray(value)) return void out.push(issue('wrong-type', path, `${path} must be an array.`));
      if (spec.maxItems !== undefined && value.length > spec.maxItems) {
        out.push(issue('invalid-value', path, `${path} must have at most ${spec.maxItems} items.`));
      }
      for (let i = 0; i < value.length && out.length < MAX_ISSUES; i++) checkField(value[i], spec.items, join(path, i), out);
      return;
  }
}

function checkObject(value: unknown, spec: ObjectSpec, path: string, out: ValidationIssue[], name?: ObjectName): void {
  if (!isPlainObject(value)) {
    out.push(issue('wrong-type', path || '(root)', `${path || 'value'} must be a plain object.`));
    return;
  }
  for (const [key, fieldSpec] of Object.entries(spec.required)) {
    if (!(key in value) || value[key] === undefined) {
      out.push(issue('missing-field', join(path, key), `${join(path, key)} is required.`));
      continue;
    }
    checkField(value[key], fieldSpec, join(path, key), out);
  }
  for (const [key, fieldSpec] of Object.entries(spec.optional)) {
    if (value[key] === undefined) continue;
    checkField(value[key], fieldSpec, join(path, key), out);
  }
  if (name) checkSemantics(name, value, path, out);
}

/** Cross-field rules JSON Schema cannot express cheaply. */
function checkSemantics(name: ObjectName, value: Record<string, unknown>, path: string, out: ValidationIssue[]): void {
  if (name === 'Strength') {
    const { value: v, low, high } = value as { value: unknown; low?: unknown; high?: unknown };
    if (typeof v === 'number' && typeof low === 'number' && low > v) {
      out.push(issue('invalid-value', join(path, 'low'), `${join(path, 'low')} must be <= value.`));
    }
    if (typeof v === 'number' && typeof high === 'number' && high < v) {
      out.push(issue('invalid-value', join(path, 'high'), `${join(path, 'high')} must be >= value.`));
    }
  }
  if (name === 'Snapshot') {
    const seen = new Set<string>();
    const findings = Array.isArray(value.findings) ? value.findings : [];
    findings.forEach((f, i) => {
      const fid = isPlainObject(f) ? f.id : undefined;
      if (typeof fid !== 'string') return;
      if (seen.has(fid)) out.push(issue('duplicate-id', join(join(path, 'findings'), i), `Finding id "${fid}" appears more than once.`));
      seen.add(fid);
    });
    const { startedAt, finishedAt } = value;
    if (typeof startedAt === 'string' && typeof finishedAt === 'string' && Date.parse(finishedAt) < Date.parse(startedAt)) {
      out.push(issue('invalid-value', join(path, 'finishedAt'), `${join(path, 'finishedAt')} must not be before startedAt.`));
    }
  }
}

const FORBIDDEN = new Set<string>(FORBIDDEN_KEYS);

/** Finds a forbidden key (`__proto__`, `constructor`, `prototype`) at any depth. Iterative. */
function forbiddenKeyIssue(root: unknown): ValidationIssue | undefined {
  const stack: Array<[unknown, string]> = [[root, '']];
  while (stack.length > 0) {
    const [value, path] = stack.pop()!;
    if (typeof value !== 'object' || value === null) continue;
    for (const key of Object.keys(value)) {
      const p = Array.isArray(value) ? `${path}[${key}]` : path ? `${path}.${key}` : key;
      if (FORBIDDEN.has(key)) return issue('forbidden-key', p, `${p} uses the reserved key "${key}".`);
      stack.push([(value as Record<string, unknown>)[key], p]);
    }
  }
  return undefined;
}

function sizeIssue(value: unknown, max: number, path: string): ValidationIssue | undefined {
  const bytes = byteLength(value);
  if (bytes === undefined) return issue('not-serializable', path, `${path || 'value'} is not JSON-serializable.`);
  if (bytes > max) return issue('too-large', path, `${path || 'value'} is ${bytes} bytes; the limit is ${max} bytes.`);
  return undefined;
}

function fail<T>(issues: ValidationIssue[]): ValidationResult<T> {
  return { ok: false, issues, ignorable: issues.length > 0 && issues.every((i) => i.severity === 'warning') };
}

/** Validates one event. Never throws. The returned value is the input object (unknown fields kept). */
export function validateEvent(raw: unknown, options: ValidateOptions = {}): ValidationResult<TerminalEvent> {
  try {
    if (!isPlainObject(raw)) return fail([issue('not-object', '(root)', 'An event must be a JSON object.')]);
    if (raw.schemaVersion !== SCHEMA_VERSION) {
      return fail([
        issue(
          'unsupported-schema-version',
          'schemaVersion',
          `Unsupported schemaVersion ${JSON.stringify(raw.schemaVersion)}; this renderer reads schemaVersion ${SCHEMA_VERSION}.`,
        ),
      ]);
    }
    const type = raw.type;
    if (typeof type !== 'string' || !EVENT_TYPE_SET.has(type)) {
      return fail([
        issue('unknown-event-type', 'type', `Unknown event type ${JSON.stringify(type)}; ignored (it may come from a newer producer).`, 'warning'),
      ]);
    }
    const max = type === 'snapshot' ? (options.maxSnapshotBytes ?? DEFAULT_MAX_SNAPSHOT_BYTES) : (options.maxEventBytes ?? DEFAULT_MAX_EVENT_BYTES);
    const tooBig = sizeIssue(raw, max, '');
    if (tooBig) return fail([tooBig]);
    const forbidden = forbiddenKeyIssue(raw);
    if (forbidden) return fail([forbidden]);
    const out: ValidationIssue[] = [];
    checkObject(raw, { description: '', required: EVENT_BASE_SPEC, optional: {} }, '', out);
    checkObject(raw, EVENT_SPEC[type as EventType], '', out);
    if (type === 'snapshot' && out.length === 0) {
      const inner = (raw.snapshot as Record<string, unknown>).runId;
      if (inner !== raw.runId) {
        out.push(issue('run-id-mismatch', 'snapshot.runId', `snapshot.runId "${String(inner)}" does not match the event's runId "${String(raw.runId)}".`));
      }
    }
    if (out.length > 0) return fail(out);
    return { ok: true, value: raw as unknown as TerminalEvent };
  } catch (err) {
    // A hostile object (throwing getters, proxies) must never take the process down.
    return fail([issue('not-serializable', '(root)', `The event could not be read: ${err instanceof Error ? err.message : String(err)}`)]);
  }
}

/** Validates a result snapshot. Never throws. */
export function validateSnapshot(raw: unknown, options: ValidateOptions = {}): ValidationResult<Snapshot> {
  try {
    if (!isPlainObject(raw)) return fail([issue('not-object', '(root)', 'A snapshot must be a JSON object.')]);
    if (raw.schemaVersion !== SCHEMA_VERSION) {
      return fail([
        issue('unsupported-schema-version', 'schemaVersion', `Unsupported schemaVersion ${JSON.stringify(raw.schemaVersion)}; expected ${SCHEMA_VERSION}.`),
      ]);
    }
    const tooBig = sizeIssue(raw, options.maxSnapshotBytes ?? DEFAULT_MAX_SNAPSHOT_BYTES, '');
    if (tooBig) return fail([tooBig]);
    const forbidden = forbiddenKeyIssue(raw);
    if (forbidden) return fail([forbidden]);
    const out: ValidationIssue[] = [];
    checkObject(raw, OBJECT_SPEC.Snapshot, '', out, 'Snapshot');
    if (out.length > 0) return fail(out);
    return { ok: true, value: raw as unknown as Snapshot };
  } catch (err) {
    return fail([issue('not-serializable', '(root)', `The snapshot could not be read: ${err instanceof Error ? err.message : String(err)}`)]);
  }
}

export interface StreamValidatorOptions extends ValidateOptions {
  /**
   * How many recent event ids, finding ids and ended cut ids to remember. Default 10,000. Older
   * entries are forgotten, so memory stays bounded on long runs.
   */
  idMemory?: number;
  /**
   * Enforce the run lifecycle: `run-start` first, cuts started before they progress or end and
   * ended before `run-end`, receipts only for announced findings. Default true; turn it off to
   * read a partial stream (the tail of a log).
   */
  lifecycle?: boolean;
}

export interface StreamValidator {
  /** Validates one event in the context of the stream so far. Never throws. */
  push(raw: unknown): ValidationResult<TerminalEvent>;
  /** Issues for an incomplete stream (no `run-end`, cuts never ended). Empty when complete. */
  finish(): ValidationIssue[];
  readonly runId: string | undefined;
  readonly ended: boolean;
}

/**
 * Stateful checks across a single run's stream: one `runId`, strictly increasing `seq`,
 * unique ids (within a bounded window), monotonic `cut-progress.done`, nothing but a
 * `snapshot` after `run-end`, and (unless `lifecycle: false`) the run lifecycle.
 * Rejected events do not advance the stream state.
 */
export function createStreamValidator(options: StreamValidatorOptions = {}): StreamValidator {
  const idMemory = Math.max(1, options.idMemory ?? 10_000);
  let runId: string | undefined;
  let lastSeq = 0;
  let ended = false;
  const lifecycle = options.lifecycle !== false;
  let started = false;
  const ids = new Set<string>();
  const progress = new Map<string, number>();
  const openCuts = new Set<string>();
  const endedCuts = new Set<string>();
  const findings = new Set<string>();
  /** Adds to a set that forgets its oldest entry beyond `idMemory`, keeping memory bounded. */
  const remember = (set: Set<string>, value: string): void => {
    set.delete(value);
    set.add(value);
    if (set.size > idMemory) set.delete(set.values().next().value as string);
  };

  const lifecycleIssues = (ev: TerminalEvent): ValidationIssue[] => {
    const out: ValidationIssue[] = [];
    if (!started && ev.type !== 'run-start') {
      out.push(issue('missing-run-start', 'type', `"${ev.type}" arrived before run-start.`));
    }
    if (started && ev.type === 'run-start') out.push(issue('missing-run-start', 'type', 'A second run-start arrived; one stream holds one run.'));
    if ((ev.type === 'cut-progress' || ev.type === 'cut-end') && !openCuts.has(ev.cut)) {
      const why = endedCuts.has(ev.cut) ? 'has already ended' : 'was never started';
      out.push(issue('cut-not-started', 'cut', `${ev.type} for cut "${ev.cut}", which ${why}.`));
    }
    if (ev.type === 'cut-start' && (openCuts.has(ev.cut) || endedCuts.has(ev.cut))) {
      out.push(issue('cut-already-started', 'cut', `Cut "${ev.cut}" was already started; cut ids are unique within a run.`));
    }
    if (ev.type === 'run-end' && openCuts.size > 0) {
      out.push(issue('cut-not-ended', 'status', `run-end arrived while ${[...openCuts].map((c) => `"${c}"`).join(', ')} had not ended; end each cut (status "canceled" if needed) first.`));
    }
    if (ev.type === 'receipt' && !findings.has(ev.finding)) {
      out.push(issue('unknown-finding', 'finding', `Receipt for finding "${ev.finding}", which has not been announced.`));
    }
    return out;
  };

  return {
    finish() {
      const out: ValidationIssue[] = [];
      if (!ended) out.push(issue('missing-run-end', 'type', 'The stream ended without run-end; results may be incomplete.'));
      if (lifecycle && openCuts.size > 0) {
        out.push(issue('cut-not-ended', 'cut', `Cuts never ended: ${[...openCuts].map((c) => `"${c}"`).join(', ')}.`));
      }
      return out;
    },
    get runId() {
      return runId;
    },
    get ended() {
      return ended;
    },
    push(raw) {
      const res = validateEvent(raw, options);
      if (!res.ok) return res;
      const ev = res.value;
      const out: ValidationIssue[] = [];
      if (runId !== undefined && ev.runId !== runId) {
        out.push(issue('run-id-mismatch', 'runId', `runId "${ev.runId}" does not match this stream's run "${runId}".`));
      }
      if (ev.seq <= lastSeq) out.push(issue('seq-not-increasing', 'seq', `seq ${ev.seq} must be greater than the previous seq ${lastSeq}.`));
      if (ids.has(ev.id)) out.push(issue('duplicate-id', 'id', `Event id "${ev.id}" was already used in this run.`));
      if (ended && ev.type !== 'snapshot') out.push(issue('after-run-end', 'type', `"${ev.type}" arrived after run-end.`));
      if (ev.type === 'cut-progress' && ev.done !== undefined) {
        const prev = progress.get(ev.cut);
        if (prev !== undefined && ev.done < prev) {
          out.push(issue('progress-regressed', 'done', `cut-progress.done went from ${prev} to ${ev.done} for cut "${ev.cut}"; progress is monotonic.`));
        }
      }
      if (lifecycle) out.push(...lifecycleIssues(ev));
      if (out.length > 0) return fail(out);
      runId ??= ev.runId;
      started ||= ev.type === 'run-start';
      if (ev.type === 'cut-start') openCuts.add(ev.cut);
      if (ev.type === 'cut-end') {
        openCuts.delete(ev.cut);
        progress.delete(ev.cut); // Progress only matters while a cut is open.
        remember(endedCuts, ev.cut);
      }
      if (ev.type === 'finding') remember(findings, ev.finding.id);
      lastSeq = ev.seq;
      remember(ids, ev.id);
      if (ev.type === 'cut-progress' && ev.done !== undefined) progress.set(ev.cut, ev.done);
      if (ev.type === 'run-end') ended = true;
      return res;
    },
  };
}

/** One-line, human-readable summary of a failed validation (for `warning` lines). */
export function describeIssues(issues: readonly ValidationIssue[]): string {
  if (issues.length === 0) return 'no issues';
  const first = issues[0]!;
  const more = issues.length > 1 ? ` (+${issues.length - 1} more)` : '';
  return `${first.message}${more}`;
}
