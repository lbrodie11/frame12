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
export const SCHEMA_VERSION = 1;
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
];
export const CUT_STATUSES = ['ok', 'warning', 'error', 'skipped', 'canceled'];
export const RUN_STATUSES = ['completed', 'failed', 'canceled'];
export const PROMINENCES = ['hero', 'primary', 'secondary'];
export const FINDING_STATUSES = ['review', 'info', 'ok', 'warning', 'danger'];
export const RECEIPT_KINDS = ['commit', 'file', 'link', 'log', 'test', 'tool-call'];
export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'];
export const LOG_STREAMS = ['stdout', 'stderr'];
/** Ids are stable domain identifiers: 1–128 chars, no whitespace or control characters. */
export const ID_PATTERN = '^[^\\s\\u0000-\\u001f\\u007f-\\u009f]{1,128}$';
/** Presentation labels (`C-01`, `F-01`, `E-01`) are assigned by renderers and never valid ids. */
export const PRESENTATION_LABEL_PATTERN = '^[CFEcfe]-\\d+$';
const nonEmpty = { kind: 'string', nonEmpty: true };
const text = { kind: 'string' };
const id = { kind: 'id' };
const ts = { kind: 'timestamp' };
const unit = { kind: 'number', min: 0, max: 1 };
const nonNegative = { kind: 'number', min: 0 };
const enumOf = (values) => ({ kind: 'enum', values });
export const OBJECT_SPEC = {
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
export const EVENT_BASE_SPEC = {
    schemaVersion: { kind: 'const', value: SCHEMA_VERSION },
    runId: id,
    seq: { kind: 'integer', min: 1 },
    ts,
    id,
};
export const EVENT_SPEC = {
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
