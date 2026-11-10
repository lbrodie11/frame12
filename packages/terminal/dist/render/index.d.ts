/**
 * @frame12/terminal/render: zero-dependency linear renderers.
 *
 * - `renderJson`: the snapshot verbatim, for automation.
 * - `renderPlain`: no styling, ASCII template text, one self-describing fact per line (CI logs,
 *   pipes, screen readers, diffs). Independent of terminal width.
 * - `renderRich`: the FRAME/12 grammar with styling, glyphs and links as the terminal allows.
 * - `createLinearWriter`: drives the renderers from an event stream: narration (cuts, warnings)
 *   to stderr as append-only lines, results (from the snapshot) to stdout.
 *
 * Every renderer sanitizes its input first, so untrusted strings never reach the grammar raw.
 */
import type { Capabilities } from '../core/capabilities.js';
import type { Finding, LogLevel, RunStatus, Snapshot } from '../core/contract.js';
import { type SafetyOptions } from '../core/safety.js';
import { type StreamValidatorOptions } from '../core/validate.js';
import { type NextStep, type RenderCaps } from './grammar.js';
export * from './grammar.js';
export { GLYPHS, glyph, type GlyphName, type GlyphSpec } from '../core/glyphs.js';
export interface RenderOptions {
    /** Product name for the masthead. Default `FRAME/12`. */
    product?: string;
    /** Commands printed once at the end as "Next steps". */
    nextSteps?: NextStep[];
    /** Sanitizer options (redaction hook, link policy). */
    safety?: SafetyOptions;
    /**
     * Cut labels already shown in narration (cut id → `C-02`), so results use the same numbers when
     * cuts ran in parallel or the snapshot lists them in another order. Unlisted cuts are numbered
     * after the listed ones.
     */
    cutLabels?: ReadonlyMap<string, string>;
}
/** Cut labels for a snapshot: narration's labels first, then the rest in snapshot order. */
export declare function labelCuts(cuts: Snapshot['cuts'], known?: ReadonlyMap<string, string>): string[];
/** The snapshot verbatim (2-space JSON, trailing newline). Re-rendering parsed output is byte-identical. */
export declare function renderJson(snapshot: Snapshot): string;
/** Findings in reading order (hero, primary, secondary; stable), with frame and receipt numbers. */
export declare function orderFindings(findings: readonly Finding[]): Array<{
    finding: Finding;
    frame: string;
    firstReceipt: number;
}>;
/**
 * Plain text: no escape sequences, no glyphs, ASCII template text, one self-describing fact per
 * line, every receipt and full path printed. Stable for diffing (independent of terminal width).
 */
export declare function renderPlain(snapshot: Snapshot, options?: RenderOptions): string;
/** The FRAME/12 grammar: masthead, run line, findings by prominence, metrics, warnings, next steps. */
export declare function renderRich(snapshot: Snapshot, rc: RenderCaps, options?: RenderOptions): string;
export interface WritableLike {
    write(chunk: string): unknown;
}
export type LinearFormat = 'rich' | 'plain' | 'json';
export interface LinearWriterOptions extends RenderOptions {
    format: LinearFormat;
    caps: Capabilities;
    stdout: WritableLike;
    stderr: WritableLike;
    /** Also narrate `info` and `debug` log lines. */
    verbose?: boolean;
    /** Stream validation options (`lifecycle: false` for partial streams). */
    validation?: StreamValidatorOptions;
}
export interface LinearResult {
    /** The run status from `run-end`, if one arrived. */
    status: RunStatus | undefined;
    /** The authoritative snapshot, if one arrived. */
    snapshot: Snapshot | undefined;
    /** Events dropped as invalid. */
    invalid: number;
    /** Events ignored as unknown types (forward compatibility). */
    ignored: number;
}
export interface LinearWriter {
    /** Accepts one event (parsed JSON). Never throws. */
    write(raw: unknown): void;
    /**
     * Narrates a log line that did not arrive as an event (the host's own, or a child process's
     * through `spawnLogged`), exactly like a `log` event: errors and warnings always, the rest only
     * when verbose. Sanitized and redacted like everything else.
     */
    log(level: LogLevel, text: string): void;
    /** Ends the stream; reports what was missing. */
    end(): LinearResult;
}
/**
 * Drives a linear renderer from an event stream. Narration (cut endings, warnings, errors, dropped
 * events) goes to stderr as append-only lines: no cursor movement and no spinner, ever. Results go
 * to stdout once, from the snapshot, so `cmd > out.txt` captures only results and `--json` writes
 * only JSON to stdout. Nothing is delayed: every line is written as soon as its event arrives.
 */
export declare function createLinearWriter(options: LinearWriterOptions): LinearWriter;
