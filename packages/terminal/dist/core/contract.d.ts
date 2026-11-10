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
export declare const SCHEMA_VERSION: 1;
export type SchemaVersion = typeof SCHEMA_VERSION;
/** Default cap on one serialized event (UTF-8 bytes). */
export declare const DEFAULT_MAX_EVENT_BYTES: number;
/** Default cap on one serialized snapshot (UTF-8 bytes); applies to `snapshot` events too. */
export declare const DEFAULT_MAX_SNAPSHOT_BYTES: number;
export declare const EVENT_TYPES: readonly ["run-start", "scene-start", "cut-start", "cut-progress", "metric", "finding", "receipt", "log", "warning", "cut-end", "scene-end", "run-end", "snapshot"];
export type EventType = (typeof EVENT_TYPES)[number];
export declare const CUT_STATUSES: readonly ["ok", "warning", "error", "skipped", "canceled"];
export type CutStatus = (typeof CUT_STATUSES)[number];
export declare const RUN_STATUSES: readonly ["completed", "failed", "canceled"];
export type RunStatus = (typeof RUN_STATUSES)[number];
export declare const PROMINENCES: readonly ["hero", "primary", "secondary"];
export type Prominence = (typeof PROMINENCES)[number];
export declare const FINDING_STATUSES: readonly ["review", "info", "ok", "warning", "danger"];
export type FindingStatus = (typeof FINDING_STATUSES)[number];
export declare const RECEIPT_KINDS: readonly ["commit", "file", "link", "log", "test", "tool-call"];
export type ReceiptKind = (typeof RECEIPT_KINDS)[number];
export declare const LOG_LEVELS: readonly ["debug", "info", "warn", "error"];
export type LogLevel = (typeof LOG_LEVELS)[number];
export declare const LOG_STREAMS: readonly ["stdout", "stderr"];
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
export type TerminalEvent = RunStartEvent | SceneStartEvent | CutStartEvent | CutProgressEvent | MetricEvent | FindingEvent | ReceiptEvent | LogEvent | WarningEvent | CutEndEvent | SceneEndEvent | RunEndEvent | SnapshotEvent;
export type EventOf<T extends EventType> = Extract<TerminalEvent, {
    type: T;
}>;
export type FieldSpec = {
    kind: 'string';
    nonEmpty?: boolean;
    maxLength?: number;
} | {
    kind: 'id';
} | {
    kind: 'timestamp';
} | {
    kind: 'integer';
    min?: number;
} | {
    kind: 'number';
    min?: number;
    max?: number;
} | {
    kind: 'string-or-number';
} | {
    kind: 'boolean';
} | {
    kind: 'const';
    value: string | number;
} | {
    kind: 'enum';
    values: readonly string[];
} | {
    kind: 'href';
} | {
    kind: 'object';
    ref: ObjectName;
} | {
    kind: 'array';
    items: FieldSpec;
    maxItems?: number;
};
export interface ObjectSpec {
    required: Record<string, FieldSpec>;
    optional: Record<string, FieldSpec>;
    description: string;
}
/** Ids are stable domain identifiers: 1–128 chars, no whitespace or control characters. */
export declare const ID_PATTERN = "^[^\\s\\u0000-\\u001f\\u007f-\\u009f]{1,128}$";
/** Presentation labels (`C-01`, `F-01`, `E-01`) are assigned by renderers and never valid ids. */
export declare const PRESENTATION_LABEL_PATTERN = "^[CFEcfe]-\\d+$";
export type ObjectName = 'Subject' | 'Strength' | 'ReceiptRef' | 'Finding' | 'Metric' | 'CutSummary' | 'Snapshot';
export declare const OBJECT_SPEC: Record<ObjectName, ObjectSpec>;
/** Fields on every event, in addition to `type`. */
export declare const EVENT_BASE_SPEC: Record<string, FieldSpec>;
export declare const EVENT_SPEC: Record<EventType, ObjectSpec>;
