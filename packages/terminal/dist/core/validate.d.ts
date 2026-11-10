/**
 * Validation for event contract v1. Every function here takes `unknown` input and never throws:
 * failures come back as typed issues. Unknown event types are reported as ignorable warnings
 * (forward compatibility), and unknown fields are preserved on the returned value.
 */
import { type Snapshot, type TerminalEvent } from './contract.js';
export declare const VALIDATION_CODES: readonly ["not-object", "unsupported-schema-version", "unknown-event-type", "missing-field", "wrong-type", "invalid-value", "presentation-label-id", "too-large", "not-serializable", "duplicate-id", "run-id-mismatch", "seq-not-increasing", "progress-regressed", "after-run-end", "missing-run-start", "cut-not-started", "cut-already-started", "cut-not-ended", "unknown-finding", "missing-run-end", "forbidden-key"];
export type ValidationCode = (typeof VALIDATION_CODES)[number];
export interface ValidationIssue {
    code: ValidationCode;
    /** JSON-pointer-like path to the offending field, e.g. `finding.subject[0].label`. */
    path: string;
    message: string;
    /** `warning` issues are ignorable: the event is dropped, the stream continues. */
    severity: 'error' | 'warning';
}
export type ValidationResult<T> = {
    ok: true;
    value: T;
} | {
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
/** Validates one event. Never throws. The returned value is the input object (unknown fields kept). */
export declare function validateEvent(raw: unknown, options?: ValidateOptions): ValidationResult<TerminalEvent>;
/** Validates a result snapshot. Never throws. */
export declare function validateSnapshot(raw: unknown, options?: ValidateOptions): ValidationResult<Snapshot>;
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
export declare function createStreamValidator(options?: StreamValidatorOptions): StreamValidator;
/** One-line, human-readable summary of a failed validation (for `warning` lines). */
export declare function describeIssues(issues: readonly ValidationIssue[]): string;
