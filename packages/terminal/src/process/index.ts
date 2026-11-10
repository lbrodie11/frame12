/**
 * @frame12/terminal/process: the only module that starts child processes.
 *
 * A child process that writes straight to the terminal corrupts a live view (Ink redraws over it).
 * `spawnLogged` pipes the child's stdout and stderr into the Director's log instead, line by line,
 * sanitized and redacted like every other string, and reports the exit code.
 */
import { spawn } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
import type { Director } from '../core/director.js';
import { safeLink } from '../core/safety.js';

export interface SpawnLoggedOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  /** The cut these lines belong to (shown with the log line). */
  cut?: string;
  /** Kills the child when aborted. Defaults to the Director's own signal (aborted by `cancel()`). */
  signal?: AbortSignal;
  /** Log level for stderr lines. Default `warn` (stderr is often progress, not failure). */
  stderrLevel?: 'info' | 'warn' | 'error';
  /** After a cancel, how long a child gets to exit on SIGTERM before it is sent SIGKILL. Default 5000 ms. */
  killAfterMs?: number;
}

export interface SpawnResult {
  /** The exit code, or null when the process was killed or never started. */
  code: number | null;
  /** The signal that ended it, if any. */
  signal: NodeJS.Signals | null;
  /** Set when the process could not be started (ENOENT, EACCES). */
  error?: string;
}

/** Splits a stream into complete lines, keeping a partial last line until more arrives. */
function lineSplitter(onLine: (line: string) => void): { push(chunk: Buffer): void; end(): void } {
  let rest = '';
  // A streaming decoder keeps a multi-byte character split across two chunks intact.
  const decoder = new StringDecoder('utf8');
  return {
    push(chunk) {
      const text = rest + decoder.write(chunk);
      const parts = text.split(/\r?\n/);
      rest = parts.pop() ?? '';
      for (const p of parts) onLine(p);
    },
    end() {
      rest += decoder.end();
      if (rest !== '') onLine(rest);
      rest = '';
    },
  };
}

/**
 * Runs `cmd args` without a shell (arguments are never interpreted), logging every line of its
 * stdout (`info`) and stderr (`warn`) to the Director. Resolves when the process exits; never rejects.
 */
export function spawnLogged(director: Director, cmd: string, args: readonly string[] = [], options: SpawnLoggedOptions = {}): Promise<SpawnResult> {
  const signal = options.signal ?? (director.signal as unknown as AbortSignal);
  const meta = (stream: 'stdout' | 'stderr') => ({ stream, ...(options.cut !== undefined ? { cut: options.cut } : {}) });
  return new Promise((resolve) => {
    if (signal.aborted) return resolve({ code: null, signal: null, error: 'canceled before start' });
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(cmd, [...args], { cwd: options.cwd, env: options.env, shell: false, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      director.log('error', `${cmd} could not start: ${message}`, meta('stderr'));
      return resolve({ code: null, signal: null, error: message });
    }
    const out = lineSplitter((line) => director.log('info', line, meta('stdout')));
    const err = lineSplitter((line) => director.log(options.stderrLevel ?? 'warn', line, meta('stderr')));
    child.stdout?.on('data', (c: Buffer) => out.push(c));
    child.stderr?.on('data', (c: Buffer) => err.push(c));
    // SIGTERM first; a child that ignores it (or is stuck) gets SIGKILL, so a cancel always ends it.
    let killTimer: ReturnType<typeof setTimeout> | undefined;
    const onAbort = () => {
      child.kill('SIGTERM');
      killTimer = setTimeout(() => child.kill('SIGKILL'), Math.max(0, options.killAfterMs ?? 5000));
      killTimer.unref?.();
    };
    signal.addEventListener('abort', onAbort, { once: true });
    let settled = false;
    const finish = (result: SpawnResult) => {
      if (settled) return;
      settled = true;
      if (killTimer !== undefined) clearTimeout(killTimer);
      signal.removeEventListener('abort', onAbort);
      out.end();
      err.end();
      resolve(result);
    };
    child.on('error', (e) => {
      director.log('error', `${cmd} could not start: ${e.message}`, meta('stderr'));
      finish({ code: null, signal: null, error: e.message });
    });
    child.on('close', (code, sig) => {
      // A child that never started emits 'close' after 'error'; it already logged why.
      if (settled) return;
      // Flush any partial last lines first, so the exit line is the last thing logged.
      out.end();
      err.end();
      const how = sig ? `was stopped by ${sig}` : `exited with code ${code}`;
      director.log(code === 0 ? 'info' : 'error', `${cmd} ${how}`, meta(code === 0 ? 'stdout' : 'stderr'));
      finish({ code, signal: sig });
    });
  });
}

/**
 * Opens a URL in the default browser, without a shell. Only links that pass `safeLink` (https, or
 * http to localhost when allowed) are opened; returns false otherwise.
 */
export function openUrl(url: string, platform: NodeJS.Platform = process.platform): boolean {
  const safe = safeLink(url);
  if (!safe) return false;
  const [cmd, args] =
    platform === 'darwin'
      ? ['open', [safe]]
      : platform === 'win32'
        ? // rundll32 hands the URL to the protocol handler with no shell, so `&` and `^` stay literal.
          ['rundll32', ['url.dll,FileProtocolHandler', safe]]
        : ['xdg-open', [safe]];
  try {
    const child = spawn(cmd, args as string[], { stdio: 'ignore', detached: true, windowsHide: true });
    child.on('error', () => undefined);
    child.unref();
    return true;
  } catch {
    return false;
  }
}
