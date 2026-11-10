import type { Director } from '../core/director.js';
export interface SpawnLoggedOptions {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    /** The cut these lines belong to (shown with the log line). */
    cut?: string;
    /** Kills the child when aborted. Defaults to the Director's own signal (aborted by `cancel()`). */
    signal?: AbortSignal;
    /** Log level for stderr lines. Default `warn` (stderr is often progress, not failure). */
    stderrLevel?: 'info' | 'warn' | 'error';
}
export interface SpawnResult {
    /** The exit code, or null when the process was killed or never started. */
    code: number | null;
    /** The signal that ended it, if any. */
    signal: NodeJS.Signals | null;
    /** Set when the process could not be started (ENOENT, EACCES). */
    error?: string;
}
/**
 * Runs `cmd args` without a shell (arguments are never interpreted), logging every line of its
 * stdout (`info`) and stderr (`warn`) to the Director. Resolves when the process exits; never rejects.
 */
export declare function spawnLogged(director: Director, cmd: string, args?: readonly string[], options?: SpawnLoggedOptions): Promise<SpawnResult>;
/**
 * Opens a URL in the default browser, without a shell. Only links that pass `safeLink` (https, or
 * http to localhost when allowed) are opened; returns false otherwise.
 */
export declare function openUrl(url: string, platform?: NodeJS.Platform): boolean;
