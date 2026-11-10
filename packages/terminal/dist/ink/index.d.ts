import type { Capabilities } from '../core/capabilities.js';
import { type Director } from '../core/director.js';
import type { Tempo } from '../core/motion.js';
import type { SafetyOptions } from '../core/safety.js';
import { type NextStep } from '../render/grammar.js';
export { Cut, HintBar, Inspector, Storyboard, useRunState, type StoryboardProps } from './components.js';
type Out = NodeJS.WriteStream;
type In = NodeJS.ReadStream;
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
    /** Feeds one event (parsed JSON). Never throws. */
    push(event: unknown): void;
    /** The producer is done: closes the view, prints results and resolves the exit code. */
    end(): Promise<number>;
    /** Resolves with the exit code when the run ends (by `end()` or `q`). */
    readonly done: Promise<number>;
}
/** Exit codes: completed 0, failed 1, canceled 130 (128 + SIGINT), anything unfinished 1. */
export declare function exitCodeFor(status: string): number;
/** Why a run cannot use the live view, or undefined when it can. */
export declare function linearReason(caps: Capabilities): string | undefined;
export declare function startLive(options: LiveOptions): LiveRun;
