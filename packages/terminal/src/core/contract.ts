/**
 * Event contract v1 for @frame12/terminal.
 *
 * One event stream narrates a run; one snapshot is the authoritative result. Renderers draw results
 * from the snapshot only. Cut (`C-01`), frame (`F-01`) and receipt (`E-01`) labels are presentation:
 * the data carries stable domain ids (`read-history`) and renderers number them.
 *
 * The TypeScript types below and `EVENT_SPEC` (which drives `validateEvent` and generates
 * `schema/events.schema.json`) describe the same contract; `tests/contract.test.mjs` keeps them in sync.
 */

export const SCHEMA_VERSION = 1 as const;
export type SchemaVersion = typeof SCHEMA_VERSION;

/** Default cap on one serialized event (UTF-8 bytes). */
export const DEFAULT_MAX_EVENT_BYTES = 8 * 1024;
/** Default cap on one serialized snapshot (UTF-8 bytes); applies to `snapshot` events too. */
export const DEFAULT_MAX_SNAPSHOT_BYTES = 1024 * 1024;

export const EVENT_TYPES = [
  'run-start',
  'scene-start',
  'cut-start',
  'cut-progress',
  'metric',
  'finding',
  'receipt',
  'log',
  'warning',
  'cut-end',
  'scene-end',
  'run-end',
  'snapshot',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const CUT_STATUSES = ['ok', 'warning', 'error', 'skipped', 'canceled'] as const;
export type CutStatus = (typeof CUT_STATUSES)[number];

export const RUN_STATUSES = ['completed', 'failed', 'canceled'] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export const PROMINENCES = ['hero', 'primary', 'secondary'] as const;
export type Prominence = (typeof PROMINENCES)[number];

export const FINDING_STATUSES = ['review', 'info', 'ok', 'warning', 'danger'] as const;
export type FindingStatus = (typeof FINDING_STATUSES)[number];

export const RECEIPT_KINDS = ['commit', 'file', 'link', 'log', 'test', 'tool-call'] as const;
export type ReceiptKind = (typeof RECEIPT_KINDS)[number];

/**
 * How the first two subjects of a finding are connected. `history-only`: they change together
 * with no code link (a ghost wire). `direct`: one references the other. `indirect`: connected
 * through other modules.
 */
export const RELATIONS = ['history-only', 'direct', 'indirect'] as const;
export type Relation = (typeof RELATIONS)[number];

export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export const LOG_STREAMS = ['stdout', 'stderr'] as const;
export type LogStream = (typeof LOG_STREAMS)[number];

/** A thing a finding is about: a file, a service, a test, a tool call. */
export interface Subject {
  kind: string;
  label: string;
  href?: string;
}

/** Bounded strength in [0, 1] with an optional uncertainty range and a required human label. */
export interface Strength {
  value: number;
  low?: number;
  high?: number;
  label: string;
}

/** A piece of evidence. `value` is the short id (a SHA, a path, a test name). */
export interface ReceiptRef {
  kind: ReceiptKind;
  value: string;
  href?: string;
  /** ISO 8601 timestamp. */
  at?: string;
  note?: string;
}

export interface Finding {
  /** Stable domain id (never a presentation label like `F-01`). */
  id: string;
  title: string;
  summary?: string;
  subject: Subject[];
  strength?: Strength;
  prominence: Prominence;
  status: FindingStatus;
  /** How `subject[0]` and `subject[1]` are connected; renderers draw a typed connector. */
  relation?: Relation;
  receipts?: ReceiptRef[];
}

export interface Metric {
  name: string;
  label?: string;
  value: number | string;
  unit?: string;
}

export interface CutSummary {
  /** Stable domain id (never a presentation label like `C-01`). */
  cut: string;
  title: string;
  status: CutStatus;
  scene?: string;
  summary?: string;
  durationMs?: number;
}

/** The authoritative final result. Renderers draw results from this, never from narration. */
export interface Snapshot {
  schemaVersion: SchemaVersion;
  runId: string;
  title: string;
  status: RunStatus;
  startedAt: string;
  finishedAt: string;
  cuts: CutSummary[];
  metrics: Metric[];
  findings: Finding[];
  warnings: string[];
  error?: string;
  /** Set by replay tools; renderers label the output `REPLAY`. */
  replay?: boolean;
}

/** Fields every event carries. */
export interface EventBase<T extends EventType> {
  schemaVersion: SchemaVersion;
  type: T;
  runId: string;
  /** Strictly increasing within a run, starting anywhere >= 1. */
  seq: number;
  /** ISO 8601 timestamp. */
  ts: string;
  /** Unique within a run. */
  id: string;
}

export interface RunStartEvent extends EventBase<'run-start'> {
  title: string;
  product?: string;
  command?: string;
}
export interface SceneStartEvent extends EventBase<'scene-start'> {
  scene: string;
  title: string;
}
export interface CutStartEvent extends EventBase<'cut-start'> {
  cut: string;
  title: string;
  scene?: string;
}
export interface CutProgressEvent extends EventBase<'cut-progress'> {
  cut: string;
  done?: number;
  total?: number;
  unit?: string;
  note?: string;
}
export interface MetricEvent extends EventBase<'metric'> {
  cut?: string;
  metric: Metric;
}
export interface FindingEvent extends EventBase<'finding'> {
  cut?: string;
  finding: Finding;
}
export interface ReceiptEvent extends EventBase<'receipt'> {
  /** The finding id this receipt supports. */
  finding: string;
  receipt: ReceiptRef;
}
export interface LogEvent extends EventBase<'log'> {
  cut?: string;
  level: LogLevel;
  text: string;
  stream?: LogStream;
}
export interface WarningEvent extends EventBase<'warning'> {
  cut?: string;
  message: string;
  code?: string;
}
export interface CutEndEvent extends EventBase<'cut-end'> {
  cut: string;
  status: CutStatus;
  summary?: string;
  durationMs?: number;
}
export interface SceneEndEvent extends EventBase<'scene-end'> {
  scene: string;
}
export interface RunEndEvent extends EventBase<'run-end'> {
  status: RunStatus;
  error?: string;
}
export interface SnapshotEvent extends EventBase<'snapshot'> {
  snapshot: Snapshot;
}

export type TerminalEvent =
  | RunStartEvent
  | SceneStartEvent
  | CutStartEvent
  | CutProgressEvent
  | MetricEvent
  | FindingEvent
  | ReceiptEvent
  | LogEvent
  | WarningEvent
  | CutEndEvent
  | SceneEndEvent
  | RunEndEvent
  | SnapshotEvent;

export type EventOf<T extends EventType> = Extract<TerminalEvent, { type: T }>;

// ---------------------------------------------------------------------------------------------
// Declarative field spec. `validate.ts` interprets it; `scripts/build.mjs` turns it into JSON Schema.
// ---------------------------------------------------------------------------------------------

export type FieldSpec =
  | { kind: 'string'; nonEmpty?: boolean; maxLength?: number }
  | { kind: 'id' }
  | { kind: 'timestamp' }
  | { kind: 'integer'; min?: number }
  | { kind: 'number'; min?: number; max?: number }
  | { kind: 'string-or-number' }
  | { kind: 'boolean' }
  | { kind: 'const'; value: string | number }
  | { kind: 'enum'; values: readonly string[] }
  | { kind: 'href' }
  | { kind: 'object'; ref: ObjectName }
  | { kind: 'array'; items: FieldSpec; maxItems?: number };

export interface ObjectSpec {
  required: Record<string, FieldSpec>;
  optional: Record<string, FieldSpec>;
  description: string;
}

/** Ids are stable domain identifiers: 1–128 chars, no whitespace or control characters. */
export const ID_PATTERN = '^[^\\s\\u0000-\\u001f\\u007f-\\u009f]{1,128}$';
/** Presentation labels (`C-01`, `F-01`, `E-01`) are assigned by renderers and never valid ids. */
export const PRESENTATION_LABEL_PATTERN = '^[CFEcfe]-\\d+$';
/**
 * ISO 8601 date-time with an explicit zone (`Z` or `±hh:mm`). The validator and the generated
 * JSON Schema both use this pattern, so a schema-valid timestamp is always renderer-valid.
 */
export const TIMESTAMP_PATTERN = '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}(?::\\d{2}(?:\\.\\d{1,9})?)?(?:Z|[+-]\\d{2}:\\d{2})$';
/**
 * Keys rejected anywhere in an event or snapshot. `JSON.parse` creates `__proto__` as an own
 * property, and copying it with assignment would swap the copy's prototype and smuggle in
 * values validation never saw.
 */
export const FORBIDDEN_KEYS = ['__proto__', 'constructor', 'prototype'] as const;

const nonEmpty = { kind: 'string', nonEmpty: true } as const satisfies FieldSpec;
const text = { kind: 'string' } as const satisfies FieldSpec;
const id = { kind: 'id' } as const satisfies FieldSpec;
const ts = { kind: 'timestamp' } as const satisfies FieldSpec;
const unit = { kind: 'number', min: 0, max: 1 } as const satisfies FieldSpec;
const nonNegative = { kind: 'number', min: 0 } as const satisfies FieldSpec;
const enumOf = (values: readonly string[]) => ({ kind: 'enum', values }) as const;

export type ObjectName = 'Subject' | 'Strength' | 'ReceiptRef' | 'Finding' | 'Metric' | 'CutSummary' | 'Snapshot';

export const OBJECT_SPEC: Record<ObjectName, ObjectSpec> = {
  Subject: {
    description: 'A thing a finding is about.',
    required: { kind: nonEmpty, label: nonEmpty },
    optional: { href: { kind: 'href' } },
  },
  Strength: {
    description: 'Bounded strength in [0, 1], an optional uncertainty range, and a human label.',
    required: { value: unit, label: nonEmpty },
    optional: { low: unit, high: unit },
  },
  ReceiptRef: {
    description: 'A piece of evidence.',
    required: { kind: enumOf(RECEIPT_KINDS), value: nonEmpty },
    optional: { href: { kind: 'href' }, at: ts, note: text },
  },
  Finding: {
    description: 'A result worth reading. Prominence orders it; status says what it means.',
    required: {
      id,
      title: nonEmpty,
      subject: { kind: 'array', items: { kind: 'object', ref: 'Subject' }, maxItems: 64 },
      prominence: enumOf(PROMINENCES),
      status: enumOf(FINDING_STATUSES),
    },
    optional: {
      summary: text,
      strength: { kind: 'object', ref: 'Strength' },
      relation: enumOf(RELATIONS),
      receipts: { kind: 'array', items: { kind: 'object', ref: 'ReceiptRef' } },
    },
  },
  Metric: {
    description: 'A named measurement.',
    required: { name: id, value: { kind: 'string-or-number' } },
    optional: { label: nonEmpty, unit: text },
  },
  CutSummary: {
    description: 'How one cut ended.',
    required: { cut: id, title: nonEmpty, status: enumOf(CUT_STATUSES) },
    optional: { scene: id, summary: text, durationMs: nonNegative },
  },
  Snapshot: {
    description: 'The authoritative final result of a run.',
    required: {
      schemaVersion: { kind: 'const', value: SCHEMA_VERSION },
      runId: id,
      title: nonEmpty,
      status: enumOf(RUN_STATUSES),
      startedAt: ts,
      finishedAt: ts,
      cuts: { kind: 'array', items: { kind: 'object', ref: 'CutSummary' } },
      metrics: { kind: 'array', items: { kind: 'object', ref: 'Metric' } },
      findings: { kind: 'array', items: { kind: 'object', ref: 'Finding' } },
      warnings: { kind: 'array', items: nonEmpty },
    },
    optional: { error: text, replay: { kind: 'boolean' } },
  },
};

/** Fields on every event, in addition to `type`. */
export const EVENT_BASE_SPEC: Record<string, FieldSpec> = {
  schemaVersion: { kind: 'const', value: SCHEMA_VERSION },
  runId: id,
  seq: { kind: 'integer', min: 1 },
  ts,
  id,
};

export const EVENT_SPEC: Record<EventType, ObjectSpec> = {
  'run-start': {
    description: 'A run begins.',
    required: { title: nonEmpty },
    optional: { product: nonEmpty, command: text },
  },
  'scene-start': {
    description: 'A group of cuts begins.',
    required: { scene: id, title: nonEmpty },
    optional: {},
  },
  'cut-start': {
    description: 'A step begins.',
    required: { cut: id, title: nonEmpty },
    optional: { scene: id },
  },
  'cut-progress': {
    description: 'Progress within a cut. `done` never decreases within a cut.',
    required: { cut: id },
    optional: { done: nonNegative, total: nonNegative, unit: nonEmpty, note: text },
  },
  metric: {
    description: 'A measurement (narration; results come from the snapshot).',
    required: { metric: { kind: 'object', ref: 'Metric' } },
    optional: { cut: id },
  },
  finding: {
    description: 'A finding (narration; results come from the snapshot).',
    required: { finding: { kind: 'object', ref: 'Finding' } },
    optional: { cut: id },
  },
  receipt: {
    description: 'A receipt for a finding already announced.',
    required: { finding: id, receipt: { kind: 'object', ref: 'ReceiptRef' } },
    optional: {},
  },
  log: {
    description: 'A log line (from the tool or a child process).',
    required: { level: enumOf(LOG_LEVELS), text },
    optional: { cut: id, stream: enumOf(LOG_STREAMS) },
  },
  warning: {
    description: 'Something the reader should know that did not stop the run.',
    required: { message: nonEmpty },
    optional: { cut: id, code: id },
  },
  'cut-end': {
    description: 'A step ends.',
    required: { cut: id, status: enumOf(CUT_STATUSES) },
    optional: { summary: text, durationMs: nonNegative },
  },
  'scene-end': {
    description: 'A group of cuts ends.',
    required: { scene: id },
    optional: {},
  },
  'run-end': {
    description: 'The run ends.',
    required: { status: enumOf(RUN_STATUSES) },
    optional: { error: text },
  },
  snapshot: {
    description: 'The authoritative final result.',
    required: { snapshot: { kind: 'object', ref: 'Snapshot' } },
    optional: {},
  },
};
