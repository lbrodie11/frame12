/**
 * Recordings (`.f12rec`): a run's events, as the Director accepted them, so it can be replayed
 * (`frame12-term render --replay`) or played on the docs site. No screen bytes: only data.
 *
 * Format: NDJSON. The first line is the header `{"f12rec":1,"schemaVersion":1}`; every other line
 * is `{"t":<ms since the first event>,"event":<event>}`, ending with the snapshot. Events are
 * recorded after validation and sanitization, so a recording never holds what renderers would not
 * print; links (remotes) also go through the redaction hook (paths already do, as identifiers).
 *
 * Deterministic: given the same events and the same clock readings (inject a Scheduler), the bytes
 * are identical. Core has no file system: the Director writes lines to a `RecordSink`; Node hosts
 * pass a file sink (`startLive({ record: path })` and `frame12-term --record` do).
 */
import type { TerminalEvent } from './contract.js';
import { SCHEMA_VERSION } from './contract.js';
import { type LinkPolicy, type Redactor } from './safety.js';
export declare const RECORDING_VERSION = 1;
/** The first line of every recording. */
export interface RecordingHeader {
    f12rec: typeof RECORDING_VERSION;
    schemaVersion: typeof SCHEMA_VERSION;
}
/** One recorded event and when it arrived, in ms since the first one. */
export interface RecordingEntry {
    t: number;
    event: TerminalEvent;
}
/** Where a recording goes. Lines end with `\n`. `end()` is called once, after the snapshot. */
export interface RecordSink {
    write(line: string): void;
    end?(): void;
}
/** The header line, newline included. */
export declare function recordingHeader(): string;
/** One entry line, newline included. `t` is rounded to whole milliseconds. */
export declare function recordingLine(t: number, event: TerminalEvent): string;
/** True when a parsed line is a recording header this version understands. */
export declare function isRecordingHeader(value: unknown): value is RecordingHeader;
/**
 * Reads one parsed entry line: `{ t, event }` with a finite, non-negative `t`. The event itself is
 * not validated here; feed it to a validator or a Director like any other.
 */
export declare function parseRecordingEntry(value: unknown): {
    t: number;
    event: unknown;
} | undefined;
/**
 * Runs every `href` (a remote) through the redaction hook, keeping only results that are still safe
 * links. Everything else was sanitized and redacted when the event was accepted.
 */
export declare function redactLinks<T>(value: T, redact: Redactor | undefined, source: string, policy?: LinkPolicy, depth?: number): T;
