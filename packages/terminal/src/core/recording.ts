/**
 * Recordings (`.f12rec`): a run's events, as the Director accepted them, so it can be replayed
 * (`frame12-term render --replay`) or played on the docs site. No screen bytes: only data.
 *
 * Format: NDJSON. The first line is the header `{"f12rec":1,"schemaVersion":1}` (written as soon as
 * the recording starts, so even an empty one is recognizable); every other line is
 * `{"t":<ms>,"event":<event>}`, ending with the snapshot. `t` comes from the events' own `ts`
 * (ms since the first event's, never decreasing), so a recording keeps the run's real rhythm
 * however fast the events were read, and re-recording a replay keeps it too. Events are
 * recorded after validation and sanitization, so a recording never holds what renderers would not
 * print; links (remotes) also go through the redaction hook (paths already do, as identifiers).
 *
 * Deterministic: the same events give the same bytes; no clock is read. Core has no file system: the Director writes lines to a `RecordSink`; Node hosts
 * pass a file sink (`startLive({ record: path })` and `frame12-term --record` do).
 */
import type { TerminalEvent } from './contract.js';
import { SCHEMA_VERSION } from './contract.js';
import { safeLink, type LinkPolicy, type Redactor } from './safety.js';

export const RECORDING_VERSION = 1;

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

/**
 * Where a recording goes. Lines end with `\n`. `end()` is called once: after the snapshot, when the
 * Director is disposed, or after a failed write. `name` (a file name) appears in warnings.
 */
export interface RecordSink {
  write(line: string): void;
  end?(): void;
  name?: string;
}

/** The header line, newline included. */
export function recordingHeader(): string {
  const header: RecordingHeader = { f12rec: RECORDING_VERSION, schemaVersion: SCHEMA_VERSION };
  return `${JSON.stringify(header)}\n`;
}

/** One entry line, newline included. `t` is rounded to whole milliseconds. */
export function recordingLine(t: number, event: TerminalEvent): string {
  return `${JSON.stringify({ t: Math.max(0, Math.round(t)), event })}\n`;
}

/** True when a parsed line is a recording header this version understands. */
export function isRecordingHeader(value: unknown): value is RecordingHeader {
  return recordingHeaderIssue(value) === undefined;
}

/**
 * For a parsed first line: `undefined` when it is a header this version reads, a message when it is
 * a recording header of another version (or schema), and `'not a recording'` otherwise.
 */
export function recordingHeaderIssue(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null || !('f12rec' in value)) return 'not a recording';
  const { f12rec, schemaVersion } = value as { f12rec?: unknown; schemaVersion?: unknown };
  if (f12rec !== RECORDING_VERSION) return `unsupported recording version ${JSON.stringify(f12rec)} (this version reads ${RECORDING_VERSION})`;
  if (schemaVersion !== SCHEMA_VERSION) return `unsupported event schema ${JSON.stringify(schemaVersion)} in the recording (this version reads ${SCHEMA_VERSION})`;
  return undefined;
}

/**
 * Reads one parsed entry line: `{ t, event }` with a finite, non-negative `t`. The event itself is
 * not validated here; feed it to a validator or a Director like any other.
 */
export function parseRecordingEntry(value: unknown): { t: number; event: unknown } | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const { t, event } = value as { t?: unknown; event?: unknown };
  if (typeof t !== 'number' || !Number.isFinite(t) || t < 0 || typeof event !== 'object' || event === null) return undefined;
  return { t, event };
}

/**
 * Runs every `href` (a remote) through the redaction hook, keeping only results that are still safe
 * links. Everything else was sanitized and redacted when the event was accepted.
 */
export function redactLinks<T>(value: T, redact: Redactor | undefined, source: string, policy?: LinkPolicy, depth = 0): T {
  if (!redact || depth > 16) return value;
  if (Array.isArray(value)) return value.map((v) => redactLinks(v, redact, source, policy, depth + 1)) as T;
  if (value === null || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (k === 'href' && typeof v === 'string') {
      // A hook that throws (say, an exhaustive switch written before `link` existed) drops the
      // link, as the sanitizer turns a throwing hook into [redacted]; the recording goes on.
      let redacted: string | undefined;
      try {
        redacted = redact(v, { field: 'link', source });
      } catch {
        redacted = undefined;
      }
      const safe = safeLink(redacted, policy);
      if (safe !== undefined) out[k] = safe;
      continue;
    }
    out[k] = redactLinks(v, redact, source, policy, depth + 1);
  }
  return out as T;
}
