/**
 * The Director: the one place a live view gets its state from. No React, no timers it cannot be
 * told about, no I/O. It validates and sanitizes every event, folds the stream into a typed
 * `RunState`, and publishes that state to subscribers.
 *
 * Information is never paced; presentation sometimes is:
 * - Immediate (published before `push()` returns): errors and warnings, `cut-end`, `run-end`,
 *   the snapshot, cancellation, and anything the caller marks immediate (key echo, focus).
 * - Coalesced: everything else is published at most once per frame (60 fps), newest state wins,
 *   so a 10,000 events/s burst never queues work without bound.
 * - Paced: decorative state (the animation `pose` that drives progress glyphs and transitions)
 *   advances only on the tempo grid: every 83.33 ms at `twos`, every frame at `ones`, never at
 *   `still`. Data never waits for the pose.
 *
 * Memory is bounded: logs are a ring buffer (default 500 lines), warnings are capped, and at most
 * `maxItems` (default 5,000) cuts, findings, receipts and metrics are stored. Past that, updates to
 * stored items still apply and new items are only counted (`dropped.items`): the snapshot, not
 * narration, carries the full result. Every event is still validated and folded; `maxEvents` only
 * sets when `dropped.events` starts counting.
 */
import type { Capabilities } from './capabilities.js';
import type { CutStatus, Finding, LogLevel, Metric, RunStatus, Snapshot, TerminalEvent } from './contract.js';
import { type Tempo } from './motion.js';
import { type SafetyOptions } from './safety.js';
import { type StreamValidatorOptions } from './validate.js';
export interface CutState {
    cut: string;
    /** Presentation label, numbered in the order cuts started (`C-01`). */
    label: string;
    title: string;
    scene?: string;
    status: 'running' | CutStatus;
    progress?: {
        done?: number;
        total?: number;
        unit?: string;
        note?: string;
    };
    summary?: string;
    startedAt: string;
    durationMs?: number;
}
export interface LogLine {
    level: LogLevel;
    text: string;
    /** `event`: from a `log` event; `host`: from `Director.log()` (the host, or a child via spawnLogged). */
    origin: 'event' | 'host';
    cut?: string;
    stream?: 'stdout' | 'stderr';
}
export interface RunState {
    /** Increments on every publish. */
    version: number;
    runId?: string;
    title?: string;
    product?: string;
    status: 'idle' | 'running' | RunStatus;
    cuts: CutState[];
    /** Findings in arrival order, with receipts from `receipt` events merged in. */
    findings: Finding[];
    /** Latest value per metric name, in first-seen order. */
    metrics: Metric[];
    warnings: string[];
    /** The newest log lines (ring buffer). */
    logs: LogLine[];
    /** The authoritative result, once it arrives. Live views render results from this only. */
    snapshot?: Snapshot;
    /** Set when `cancel()` was called. */
    canceled?: {
        reason: string;
    };
    /** Decorative animation pose: advances only on the tempo grid. */
    pose: number;
    /** What was dropped or summarized to keep memory bounded. */
    dropped: {
        invalid: number;
        ignored: number;
        logs: number;
        warnings: number;
        events: number;
        items: number;
    };
}
/** Timers the Director uses; inject fakes in tests. */
export interface Scheduler {
    now(): number;
    setTimeout(fn: () => void, ms: number): unknown;
    clearTimeout(handle: unknown): void;
}
export interface DirectorOptions {
    caps: Pick<Capabilities, 'interactive'>;
    /** The resolved tempo (see `resolveTerminalMotion`). */
    motion: Tempo;
    /** Called with every accepted, sanitized event, synchronously. */
    onEvent?: (event: TerminalEvent) => void;
    /** Called once when `cancel()` is first called; the producer should stop its work. */
    onCancel?: (reason: string) => void;
    /** Log ring-buffer size. Default 500. */
    maxLogs?: number;
    /** Events after this many are counted in `dropped.events` (still validated and folded). Default 5,000. */
    maxEvents?: number;
    /**
     * Cuts, findings, receipts and metrics stored, together. Past it, updates to stored items still
     * apply and new ones are counted in `dropped.items`. Default 5,000.
     */
    maxItems?: number;
    /** Warnings kept; later ones are counted in `dropped.warnings`. Default 200. */
    maxWarnings?: number;
    safety?: SafetyOptions;
    validation?: StreamValidatorOptions;
    scheduler?: Scheduler;
}
export type Listener = (state: Readonly<RunState>) => void;
/**
 * The part of `AbortSignal` the Director exposes, declared structurally so consumers compile
 * without DOM or Node type libraries. At runtime it is a real `AbortSignal`.
 */
export interface AbortSignalLike {
    readonly aborted: boolean;
    readonly reason: unknown;
}
export interface Director {
    /** Accepts one event (parsed JSON). Never throws. */
    push(raw: unknown): void;
    /**
     * Sees every pushed event, raw and before validation, ahead of the fold and any publish; returns
     * an unsubscribe function. For renderers that validate on their own (the linear view), so events
     * pushed to a shared Director directly reach them too.
     */
    tap(listener: (raw: unknown) => void): () => void;
    /** Subscribes to published states; returns an unsubscribe function. */
    subscribe(listener: Listener): () => void;
    /** The current state (also between publishes). */
    snapshot(): Readonly<RunState>;
    /**
     * Cancels the run: running cuts become `canceled`, the run becomes `canceled`, `onCancel` runs
     * once, and the state is published immediately. Later calls are no-ops.
     */
    cancel(reason: string): void;
    /**
     * Adds a log line from the host (sanitized and redacted like any other). Multi-line text becomes
     * one log line per line. `meta` records which stream and cut it came from.
     */
    log(level: LogLevel, text: string, meta?: {
        cut?: string;
        stream?: 'stdout' | 'stderr';
    }): void;
    /** Publishes now, bypassing coalescing (for key echo and focus moves). */
    flush(): void;
    /** An AbortSignal that aborts on `cancel()`, for producers that take one (fetch, child processes). */
    readonly signal: AbortSignalLike;
    /** Stops timers; the Director publishes nothing after this. */
    dispose(): void;
}
/** Creates a Director. */
export declare function createDirector(options: DirectorOptions): Director;
