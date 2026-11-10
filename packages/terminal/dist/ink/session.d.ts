/**
 * The run session behind `startLive()`, without React or Ink: it picks the view, owns the
 * terminal's lifecycle and runs the linear view itself. The live view is mounted by an adapter
 * (`./index.tsx`), so the linear formats (and the `frame12-term` CLI) work without the optional
 * `ink`/`react` peers installed.
 *
 * - Live (Ink) only when stdin and stdout are TTYs, not CI, no screen reader, and 10+ rows.
 *   Otherwise the same run is narrated by the append-only linear writer, with a line saying why.
 * - The alternate screen is opt-in (`fullscreen`): it loses scrollback.
 * - First Ctrl-C (or SIGINT) cancels gracefully: running cuts become `canceled`, results print,
 *   exit code 130. A second within 2 s forces exit. SIGTERM and SIGHUP cancel a running job like a
 *   single SIGINT; a second one, or one when nothing is running, finishes and exits.
 * - `q` never forces: it cancels a running job, and a second `q` finishes with what is there.
 * - On every exit path (normal, signal, uncaught exception, unhandled rejection) the cursor, raw
 *   mode and the alternate screen are restored.
 * - EPIPE on stdout or stderr (`| head`) exits quietly with code 0.
 * - Results are always printed linearly after the live view closes: nothing important exists only
 *   in a live redraw.
 */
import type { Capabilities } from '../core/capabilities.js';
import { type Director } from '../core/director.js';
import type { RecordSink } from '../core/recording.js';
import type { Tempo } from '../core/motion.js';
import type { SafetyOptions } from '../core/safety.js';
import type { NextStep, RenderOptions } from '../render/index.js';
import { type LinearFormat } from '../render/index.js';
export type Out = NodeJS.WriteStream;
export type In = NodeJS.ReadStream;
export interface LiveOptions {
    caps: Capabilities;
    motion: Tempo;
    stdin?: In;
    stdout?: Out;
    stderr?: Out;
    /** Use the alternate screen (loses scrollback). Default false. */
    fullscreen?: boolean;
    product?: string;
    nextSteps?: NextStep[];
    safety?: SafetyOptions;
    /**
     * `live` (default): the live view when the terminal allows it, otherwise the linear fallback.
     * `rich`, `plain` or `json`: always the linear view, in that format.
     */
    format?: 'live' | LinearFormat;
    /** The linear view also narrates `info` and `debug` log lines. */
    verbose?: boolean;
    /** Label the run `REPLAY` (masthead and results): it was recorded earlier. */
    replay?: boolean;
    /** Record the run to this `.f12rec` file, or into this sink (only for a Director startLive creates). */
    record?: string | RecordSink;
    /** Supply your own Director (e.g. one shared with `spawnLogged`); one is created otherwise. */
    director?: Director;
    /** Called once when the run is canceled (first Ctrl-C, SIGINT, SIGTERM, SIGHUP, or `q` while running), also for a supplied Director. */
    onCancel?: (reason: string) => void;
    /** Install SIGINT/SIGTERM/SIGHUP, exit and crash handlers. Default true. */
    handleSignals?: boolean;
    /** How to exit on a forced quit or a crash. Default `process.exit`. */
    exit?: (code: number) => void;
    /** Warn once about direct stdout writes during the live view. Default: when NODE_ENV is not production. */
    devWarnings?: boolean;
}
export interface LiveRun {
    director: Director;
    /** Which view is running. */
    mode: 'live' | 'linear';
    /** Why the linear view was chosen, when it was. */
    reason?: string;
    /** Feeds one event (parsed JSON). Never throws. `where` names it in a warning (`line 12`). */
    push(event: unknown, where?: string): void;
    /** The producer is done: closes the view, prints results and resolves the exit code. */
    end(): Promise<number>;
    /** Resolves with the exit code when the run ends (by `end()` or `q`). */
    readonly done: Promise<number>;
}
/** Exit codes: completed 0, failed 1, canceled 130 (128 + SIGINT), anything unfinished 1. */
export declare function exitCodeFor(status: string): number;
/** Why a run cannot use the live view, or undefined when it can. */
export declare function linearReason(caps: Capabilities): string | undefined;
/** What the live adapter gets from the session (see `./index.tsx`). */
export interface LiveContext {
    director: Director;
    caps: Capabilities;
    options: LiveOptions;
    stdin: In;
    stdout: Out;
    stderr: Out;
    renderOpts: RenderOptions;
    ownsDirector: boolean;
    done: Promise<number>;
    cleanups: Array<() => void>;
    restore(): void;
    writeOwn(text: string): void;
    isOwnWrite(): boolean;
    /** True once the view has started finishing; `markFinished()` claims it (false if already). */
    isFinished(): boolean;
    markFinished(): boolean;
    interrupt(why: string): void;
    finish(): Promise<number>;
    settle(code: number): Promise<number>;
}
/** Mounts the live view; returns how to finish it (unmount, print results, settle). */
export type MountLive = (ctx: LiveContext) => () => Promise<number>;
/**
 * Starts a run. With `mountLive` (what `startLive` passes) the live view can run; without it,
 * `format: 'live'` falls back to the linear view, saying the live view is not loaded.
 */
export declare function startSession(options: LiveOptions, mountLive?: MountLive): LiveRun;
