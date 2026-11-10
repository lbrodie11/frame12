/**
 * @frame12/terminal/ink: the live, interactive view (Ink 8 + React 19.3, optional peers).
 *
 * `startLive()` picks the view, runs it, and owns the terminal's lifecycle:
 * - Live (Ink) only when stdin and stdout are TTYs, not CI, no screen reader, and 10+ rows.
 *   Otherwise the same run is narrated by the append-only linear writer, with a line saying why.
 * - The alternate screen is opt-in (`fullscreen`): it loses scrollback.
 * - First Ctrl-C (or SIGINT) cancels gracefully: running cuts become `canceled`, results print,
 *   exit code 130. A second within 2 s forces exit. SIGTERM and SIGHUP cancel like a single SIGINT.
 * - On every exit path (normal, signal, uncaught exception, unhandled rejection) the cursor, raw
 *   mode and the alternate screen are restored.
 * - EPIPE on stdout (`| head`) exits quietly with code 0.
 * - Results are always printed linearly after the live view closes: nothing important exists only
 *   in a live redraw.
 */
import * as React from 'react';
import { render, type Instance } from 'ink';
import type { Capabilities } from '../core/capabilities.js';
import { createDirector, type Director } from '../core/director.js';
import type { Tempo } from '../core/motion.js';
import type { SafetyOptions } from '../core/safety.js';
import { renderCapsFor, type NextStep } from '../render/grammar.js';
import { createLinearWriter, renderRich } from '../render/index.js';
import { openUrl } from '../process/index.js';
import { Storyboard } from './components.js';
import { createFrameTracker, reflowCleanup } from './reflow.js';

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
  /** Called when the run is canceled (first Ctrl-C, SIGINT, SIGTERM, SIGHUP, or `q` while running). */
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

const SHOW_CURSOR = '\u001b[?25h';
const LEAVE_ALT_SCREEN = '\u001b[?1049l';

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

export function startLive(options: LiveOptions): LiveRun {
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
      ...(options.onCancel ? { onCancel: options.onCancel } : {}),
    });
  const reason = linearReason(caps);
  const mode: LiveRun['mode'] = reason ? 'linear' : 'live';
  const renderOpts = { ...(options.product ? { product: options.product } : {}), ...(options.nextSteps ? { nextSteps: options.nextSteps } : {}), ...(options.safety ? { safety: options.safety } : {}) };

  let resolveDone!: (code: number) => void;
  const done = new Promise<number>((r) => (resolveDone = r));
  let finished = false;
  const cleanups: Array<() => void> = [];

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
      if (stdout.isTTY) stdout.write(options.fullscreen ? `${LEAVE_ALT_SCREEN}${SHOW_CURSOR}` : SHOW_CURSOR);
    } catch {
      // stdout may already be closed.
    }
  };

  // EPIPE on stdout (`| head`): results already written are enough; exit quietly.
  const onStdoutError = (err: NodeJS.ErrnoException) => {
    if (err.code === 'EPIPE') exit(0);
  };
  stdout.on('error', onStdoutError);
  cleanups.push(() => stdout.off('error', onStdoutError));

  // ------------------------------------------------------------------ linear fallback
  if (mode === 'linear') {
    const writer = createLinearWriter({ format: caps.screenReader ? 'plain' : 'rich', caps, stdout, stderr, ...renderOpts });
    if (caps.isTTY || caps.stderrIsTTY) stderr.write(`${caps.screenReader ? 'Note' : 'Live view off'}: ${reason}.\n`);
    const finish = async () => {
      if (finished) return done;
      finished = true;
      writer.end();
      for (const c of cleanups) c();
      const code = exitCodeFor(director.snapshot().status);
      resolveDone(code);
      return code;
    };
    let lastLinearInterrupt = Number.NEGATIVE_INFINITY;
    installSignals(
      () => {
        // Same rule as the live view: the first SIGINT cancels, a second within 2 s forces exit.
        const now = Date.now();
        if (now - lastLinearInterrupt < 2000) {
          restore();
          exit(130);
          return;
        }
        lastLinearInterrupt = now;
        director.cancel('SIGINT');
      },
      (sig) => director.cancel(sig),
    );
    return {
      director,
      mode,
      reason: reason!,
      push(event) {
        director.push(event);
        writer.write(event);
      },
      end: finish,
      done,
    };
  }

  // ------------------------------------------------------------------ live view
  let instance: Instance | undefined;
  let lastInterrupt = Number.NEGATIVE_INFINITY;
  const rc = () => ({ ...renderCapsFor({ ...caps, columns: stdout.columns || caps.columns }, 'stdout'), columns: Math.max(20, stdout.columns || caps.columns) });
  const rows = () => Math.max(5, stdout.rows || caps.rows);

  const finishLive = async (): Promise<number> => {
    if (finished) return done;
    finished = true;
    director.flush();
    instance?.unmount();
    try {
      await instance?.waitUntilExit();
    } catch {
      // Ink rejects waitUntilExit when unmounted with an error; we still print results.
    }
    restore();
    for (const c of cleanups) c();
    const state = director.snapshot();
    // Results are printed linearly: nothing important lives only in a live redraw.
    if (state.snapshot) stdout.write(renderRich(state.snapshot, renderCapsFor(caps, 'stdout'), renderOpts));
    else stderr.write('No result snapshot arrived, so no results are shown.\n');
    director.dispose();
    const code = exitCodeFor(state.status);
    resolveDone(code);
    return code;
  };

  /** First interrupt cancels (immediately acknowledged); a second within 2 s forces exit. */
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
    else void finishLive();
  };

  const view = () => (
    <Storyboard
      director={director}
      rc={rc()}
      rows={rows()}
      {...(options.product ? { product: options.product } : {})}
      {...(options.nextSteps ? { nextSteps: options.nextSteps } : {})}
      onQuit={() => {
        const status = director.snapshot().status;
        if (status === 'running' || status === 'idle') interrupt('quit (q)');
        else void finishLive();
      }}
      onInterrupt={() => interrupt('SIGINT')}
      onOpen={(url) => void openUrl(url)}
    />
  );

  // Development warning: direct writes to stdout corrupt the live view (Ink redraws over them).
  const devWarnings = options.devWarnings ?? process.env.NODE_ENV !== 'production';
  if (devWarnings && stdout === process.stdout) {
    const original = stdout.write;
    let warned = false;
    stdout.write = function patchedWrite(this: Out, ...args: unknown[]) {
      if (!warned && !finished && !/[\\/]ink[\\/]build[\\/]/.test(new Error().stack ?? '')) {
        warned = true;
        director.log('warn', 'Something wrote to stdout directly during the live view, which corrupts it. Use console.* or spawnLogged, or run with --plain.');
      }
      return (original as (...a: unknown[]) => boolean).apply(this, args);
    } as typeof stdout.write;
    cleanups.push(() => {
      stdout.write = original;
    });
  }

  // Ink draws through a tracker that remembers its last frame, so a narrower terminal's re-wrapped
  // rows can be erased before Ink clears (see reflow.ts). Full frames, not incremental diffs, keep
  // the recorded frame exact.
  const tracker = createFrameTracker(stdout);
  instance = render(view(), {
    stdin,
    stdout: tracker.stream,
    stderr,
    exitOnCtrlC: false, // Ctrl-C is ours: cancel first, force on the second.
    patchConsole: true, // console.* lands above the live region instead of corrupting it.
    maxFps: 60, // Ink's throttle applies to every render; pacing happens in the Director instead.
    incrementalRendering: false,
    alternateScreen: options.fullscreen === true,
  });

  // Runs before Ink's own resize handler (prepended): erase the re-wrapped frame when narrower.
  let lastColumns = stdout.columns || caps.columns;
  const beforeInkResize = () => {
    const columns = stdout.columns || lastColumns;
    if (columns < lastColumns && !options.fullscreen) {
      const cleanup = reflowCleanup(tracker.lastFrameLines(), columns);
      if (cleanup) stdout.write(cleanup);
    }
    lastColumns = columns;
  };
  stdout.prependListener('resize', beforeInkResize);
  const onResize = () => instance?.rerender(view());
  stdout.on('resize', onResize);
  cleanups.push(() => {
    stdout.off('resize', beforeInkResize);
    stdout.off('resize', onResize);
  });
  installSignals(
    () => interrupt('SIGINT'),
    (sig) => {
      const status = director.snapshot().status;
      if (status === 'running' || status === 'idle') director.cancel(sig);
    },
  );

  // When the run ends with its snapshot, close the live view by itself.
  const unsubscribe = director.subscribe((s) => {
    if (s.snapshot && s.status !== 'running' && s.status !== 'idle') void finishLive();
  });
  cleanups.push(unsubscribe);

  return {
    director,
    mode,
    push: (event) => director.push(event),
    end: finishLive,
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
