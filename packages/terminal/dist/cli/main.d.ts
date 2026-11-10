import { type RecordSink } from '../core/recording.js';
import { type LiveOptions, type LiveRun } from '../ink/session.js';
/** Lines longer than this (in bytes, without the newline) are skipped. */
export declare const MAX_LINE_BYTES: number;
/**
 * A recording entry wraps an event in `{"t":…,"event":…}`; its line may exceed the event's limit by
 * this much, so every event the CLI accepted can be read back from its own recording.
 */
export declare const RECORDING_ENVELOPE_BYTES = 64;
/** Default replay speed, and the longest wait between two replayed events. */
export declare const DEFAULT_SPEED = 4;
export declare const MAX_REPLAY_GAP_MS = 1000;
/** Problems with the input reported one by one; the rest are counted in one summary line. */
export declare const MAX_REPORTED_PROBLEMS = 20;
/** Everything the CLI touches, injectable for tests. */
export interface CliIO {
    stdin: NodeJS.ReadStream;
    stdout: NodeJS.WriteStream;
    stderr: NodeJS.WriteStream;
    env: Record<string, string | undefined>;
    /** Opens `--from`. Default: `fs.createReadStream`. */
    open?: (path: string) => AsyncIterable<Buffer | string> & {
        destroy?(): void;
    };
    /** Waits between replayed events. Default: a timer. */
    sleep?: (ms: number) => Promise<void>;
    /** Opens `--record`. Default: a file sink that renames into place when the recording ends. */
    openRecord?: (path: string) => RecordSink & {
        discard?(): void;
    };
    /** Loads the live adapter. Default: `import('../ink/index.js')`. */
    loadLive?: () => Promise<{
        startLive(options: LiveOptions): LiveRun;
    }>;
    /** Passed to the session (tests turn signals off). */
    handleSignals?: boolean;
    exit?: (code: number) => void;
}
/** Runs `frame12-term` with `argv` (without node and the script); resolves with the exit code. */
export declare function main(argv: readonly string[], io: CliIO): Promise<number>;
