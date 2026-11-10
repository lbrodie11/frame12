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
import { createDirector, type Director } from '../core/director.js';
import type { RecordSink } from '../core/recording.js';
import type { Tempo } from '../core/motion.js';
import type { SafetyOptions } from '../core/safety.js';
import type { NextStep, RenderOptions } from '../render/index.js';
import { createLinearWriter, type LinearFormat } from '../render/index.js';
import { fileRecordSink } from '../node/record-file.js';

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

const SHOW_CURSOR = '\u001b[?25h';
const LEAVE_ALT_SCREEN = '\u001b[?1049l';

/**
 * The exit code for a run that ended: a completed run without its snapshot is unfinished (no
 * results were shown), so 1.
 */
export function runExitCode(state: { status: string; snapshot?: unknown }): number {
  return state.status === 'completed' && state.snapshot === undefined ? 1 : exitCodeFor(state.status);
}

/** Exit codes: completed 0, failed 1, canceled 130 (128 + SIGINT), anything unfinished 1. */
export function exitCodeFor(status: string): number {
  if (status === 'completed') return 0;
  if (status === 'canceled') return 130;
  return 1;
}

/** Why a run cannot use the live view, or undefined when it can. */
export function linearReason(caps: Capabilities): string | undefined {
  if (caps.screenReader) return 'screen-reader mode prints append-only lines';
  if (caps.ci) return 'CI logs get append-only lines';
  if (!caps.isTTY) return 'stdout is not a terminal';
  if (caps.rows < 10) return 'the terminal has fewer than 10 rows';
  if (!caps.interactive) return 'keys are off because stdin is not a terminal';
  return undefined;
}

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
export function startSession(options: LiveOptions, mountLive?: MountLive): LiveRun {
  const stdin = options.stdin ?? process.stdin;
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;
  const exit = options.exit ?? ((code: number) => process.exit(code));
  const caps = options.caps;
  const director =
    options.director ??
    createDirector({
      caps,
      motion: options.motion,
      ...(options.safety ? { safety: options.safety } : {}),
      ...(options.record ? { record: typeof options.record === 'string' ? fileRecordSink(options.record) : options.record } : {}),
    });
  // A Director the host passed in is the host's to dispose; only our own is disposed at the end.
  const ownsDirector = options.director === undefined;
  const format = options.format ?? 'live';
  const reason =
    format !== 'live' ? `the ${format} format was requested` : (linearReason(caps) ?? (mountLive ? undefined : 'the live view needs @frame12/terminal/ink'));
  const mode: LiveRun['mode'] = reason ? 'linear' : 'live';
  /** In a replay the snapshot says so, so every renderer labels its results REPLAY. */
  const replayed = (event: unknown): unknown => {
    if (!options.replay || typeof event !== 'object' || event === null) return event;
    const e = event as { type?: unknown; snapshot?: unknown };
    if (e.type !== 'snapshot' || typeof e.snapshot !== 'object' || e.snapshot === null) return event;
    return { ...e, snapshot: { ...(e.snapshot as object), replay: true } };
  };
  const renderOpts = { ...(options.product ? { product: options.product } : {}), ...(options.nextSteps ? { nextSteps: options.nextSteps } : {}), ...(options.safety ? { safety: options.safety } : {}) };

  let resolveDone!: (code: number) => void;
  const done = new Promise<number>((r) => (resolveDone = r));
  let finished = false;
  const cleanups: Array<() => void> = [];
  /** Set while we write to stdout ourselves, so the dev warning only catches other writers. */
  let ownWrite = false;
  const writeOwn = (text: string) => {
    ownWrite = true;
    try {
      stdout.write(text);
    } finally {
      ownWrite = false;
    }
  };

  /** Puts the terminal back: cursor visible, raw mode off, primary screen. Safe to call twice. */
  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    try {
      if (stdin.isTTY && typeof stdin.setRawMode === 'function') stdin.setRawMode(false);
    } catch {
      // stdin may already be closed.
    }
    try {
      if (stdout.isTTY) writeOwn(options.fullscreen ? `${LEAVE_ALT_SCREEN}${SHOW_CURSOR}` : SHOW_CURSOR);
    } catch {
      // stdout may already be closed.
    }
  };

  // EPIPE on stdout (`| head`): results already written are enough; exit quietly. Any other stdout
  // error (EIO when the terminal goes away) is a crash: listening here stops Node from throwing it.
  // The listener stays until the final output has flushed (see `flushed`), because a Writable
  // reports a failed write asynchronously; after the first error, later ones (a destroyed stream
  // failing the next write) are ignored.
  let stdoutFailed = false;
  const onStdoutError = (err: NodeJS.ErrnoException) => {
    if (stdoutFailed) return;
    stdoutFailed = true;
    restore();
    if (err.code === 'EPIPE') return exit(0);
    try {
      stderr.write(`stdout failed: ${err.message}\n`);
    } catch {
      // stderr may be gone too.
    }
    exit(1);
  };
  stdout.on('error', onStdoutError);
  // The same for stderr: narration goes there, and `cmd 2>&1 | head` breaks it first.
  const onStderrError = (err: NodeJS.ErrnoException) => {
    if (stdoutFailed) return;
    stdoutFailed = true;
    restore();
    exit(err.code === 'EPIPE' ? 0 : 1);
  };
  stderr.on('error', onStderrError);
  /** Resolves once everything written to a stream so far has flushed (or failed, handled above). */
  const flushed = (stream: Out) =>
    new Promise<void>((resolve) => {
      // A Writable calls write callbacks in order; a test sink that is not a Writable has nothing to flush.
      if (typeof (stream as { writableLength?: unknown }).writableLength !== 'number' || stream.writableEnded || stream.destroyed) return resolve();
      try {
        stream.write('', () => resolve());
      } catch {
        resolve();
      }
    });
  /** The last step of both views: wait for the final output, then stop listening for its errors. */
  const settle = async (code: number) => {
    await Promise.all([flushed(stdout), flushed(stderr)]);
    stdout.off('error', onStdoutError);
    stderr.off('error', onStderrError);
    resolveDone(code);
    return code;
  };

  // The host's onCancel runs once on the first cancel, whoever created the Director.
  if (options.onCancel) {
    const onCancel = options.onCancel;
    let called = false;
    const unsubscribeCancel = director.subscribe((s) => {
      if (called || !s.canceled) return;
      called = true;
      try {
        onCancel(s.canceled.reason);
      } catch {
        // The host's callback failing must not stop the cancel.
      }
    });
    cleanups.push(unsubscribeCancel);
  }

  /**
   * The one interrupt rule for both views: the first Ctrl-C/SIGINT cancels a running job (the
   * cancel is acknowledged at once); when nothing is running any more it finishes; a second
   * interrupt within 2 s forces exit, whatever the producer is doing.
   */
  let lastInterrupt = Number.NEGATIVE_INFINITY;
  let finish: () => Promise<number> = async () => done;
  const interrupt = (why: string) => {
    const now = Date.now();
    if (now - lastInterrupt < 2000) {
      restore();
      exit(130);
      return;
    }
    lastInterrupt = now;
    const status = director.snapshot().status;
    if (status === 'running' || status === 'idle') director.cancel(why);
    else void finish();
  };
  /**
   * SIGTERM and SIGHUP ask the process to end. The first cancels a running job, like one Ctrl-C;
   * when nothing is running (already canceled, or the run is over) the view finishes with what it
   * has and the process exits with the run's code, so a closed terminal never leaves an orphan.
   */
  const cancelOnSignal = (sig: string) => {
    const s = director.snapshot();
    if ((s.status === 'running' || s.status === 'idle') && !s.canceled) return director.cancel(sig);
    void finish().then((code) => exit(code));
  };
  /** Both views finish by themselves once the run has ended and its snapshot has arrived. */
  const unsubscribeFinish = director.subscribe((s) => {
    if (s.snapshot && s.status !== 'running' && s.status !== 'idle') void finish();
  });
  cleanups.push(unsubscribeFinish);

  // ------------------------------------------------------------------ linear fallback
  if (mode === 'linear') {
    const writerFormat: LinearFormat = format !== 'live' ? format : caps.screenReader ? 'plain' : 'rich';
    const writer = createLinearWriter({ format: writerFormat, caps, stdout, stderr, ...renderOpts, ...(options.verbose ? { verbose: true } : {}) });
    // Say why only when the live view was wanted and could not run.
    if (format === 'live' && (caps.isTTY || caps.stderrIsTTY)) stderr.write(`${caps.screenReader ? 'Note' : 'Live view off'}: ${reason}.\n`);
    // The writer sees every event pushed to the Director (through run.push or directly, when the host
    // shares its Director), before the Director folds it: finishing on the snapshot ends the writer,
    // which must have printed that snapshot by then.
    // Log lines that did not arrive as events (the host's director.log, spawnLogged's child output)
    // are narrated too; event logs were printed by the writer. New lines are found through the ring
    // buffer: total = kept + dropped.
    const logTotal = () => director.snapshot().logs.length + director.snapshot().dropped.logs;
    let logsSeen = logTotal();
    const forwardLogs = () => {
      const logs = director.snapshot().logs;
      const fresh = Math.min(logTotal() - logsSeen, logs.length);
      for (const l of logs.slice(logs.length - fresh)) if (l.origin === 'host') writer.log(l.level, l.text);
      logsSeen = logTotal();
    };
    cleanups.push(
      director.tap((event, where) => {
        if (finished) return;
        forwardLogs();
        writer.write(replayed(event), where);
      }),
    );
    cleanups.push(director.subscribe(() => !finished && forwardLogs()));
    finish = async () => {
      if (finished) return done;
      forwardLogs(); // info lines may still be coalescing
      finished = true;
      writer.end();
      for (const c of cleanups) c();
      const code = runExitCode(director.snapshot());
      if (ownsDirector) director.dispose();
      return settle(code);
    };
    installSignals(() => interrupt('SIGINT'), cancelOnSignal);
    return {
      director,
      mode,
      reason: reason!,
      push: (event, where) => director.push(event, where),
      end: () => finish(),
      done,
    };
  }

  // ------------------------------------------------------------------ live view
  finish = mountLive!({
    director,
    caps,
    options,
    stdin,
    stdout,
    stderr,
    renderOpts,
    ownsDirector,
    done,
    cleanups,
    restore,
    writeOwn,
    isOwnWrite: () => ownWrite,
    isFinished: () => finished,
    markFinished: () => {
      if (finished) return false;
      finished = true;
      return true;
    },
    interrupt,
    finish: () => finish(),
    settle,
  });
  installSignals(() => interrupt('SIGINT'), cancelOnSignal);

  return {
    director,
    mode,
    push: (event, where) => director.push(event, where),
    end: () => finish(),
    done,
  };

  function installSignals(onSigint: () => void, onCancelSignal: (sig: string) => void) {
    if (options.handleSignals === false) return;
    const sigint = () => onSigint();
    const sigterm = () => onCancelSignal('SIGTERM');
    const sighup = () => onCancelSignal('SIGHUP');
    const crash = (err: unknown) => {
      restore();
      stderr.write(`${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
      exit(1);
    };
    process.on('SIGINT', sigint);
    process.on('SIGTERM', sigterm);
    process.on('SIGHUP', sighup);
    process.on('exit', restore);
    process.on('uncaughtException', crash);
    process.on('unhandledRejection', crash);
    cleanups.push(() => {
      process.off('SIGINT', sigint);
      process.off('SIGTERM', sigterm);
      process.off('SIGHUP', sighup);
      process.off('exit', restore);
      process.off('uncaughtException', crash);
      process.off('unhandledRejection', crash);
    });
  }
}
