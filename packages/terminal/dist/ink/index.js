import { jsx as _jsx } from "react/jsx-runtime";
import { render } from 'ink';
import { createDirector } from '../core/director.js';
import { renderCapsFor } from '../render/grammar.js';
import { createLinearWriter, renderRich } from '../render/index.js';
import { openUrl } from '../process/index.js';
import { Storyboard } from './components.js';
import { createFrameTracker, reflowCleanup } from './reflow.js';
export { Cut, HintBar, Inspector, Storyboard, useRunState } from './components.js';
const SHOW_CURSOR = '\u001b[?25h';
const LEAVE_ALT_SCREEN = '\u001b[?1049l';
/** Exit codes: completed 0, failed 1, canceled 130 (128 + SIGINT), anything unfinished 1. */
export function exitCodeFor(status) {
    if (status === 'completed')
        return 0;
    if (status === 'canceled')
        return 130;
    return 1;
}
/** Why a run cannot use the live view, or undefined when it can. */
export function linearReason(caps) {
    if (caps.screenReader)
        return 'screen-reader mode prints append-only lines';
    if (caps.ci)
        return 'CI logs get append-only lines';
    if (!caps.isTTY)
        return 'stdout is not a terminal';
    if (caps.rows < 10)
        return 'the terminal has fewer than 10 rows';
    if (!caps.interactive)
        return 'keys are off because stdin is not a terminal';
    return undefined;
}
export function startLive(options) {
    const stdin = options.stdin ?? process.stdin;
    const stdout = options.stdout ?? process.stdout;
    const stderr = options.stderr ?? process.stderr;
    const exit = options.exit ?? ((code) => process.exit(code));
    const caps = options.caps;
    const director = options.director ??
        createDirector({
            caps,
            motion: options.motion,
            ...(options.safety ? { safety: options.safety } : {}),
        });
    // A Director the host passed in is the host's to dispose; only our own is disposed at the end.
    const ownsDirector = options.director === undefined;
    const reason = linearReason(caps);
    const mode = reason ? 'linear' : 'live';
    const renderOpts = { ...(options.product ? { product: options.product } : {}), ...(options.nextSteps ? { nextSteps: options.nextSteps } : {}), ...(options.safety ? { safety: options.safety } : {}) };
    let resolveDone;
    const done = new Promise((r) => (resolveDone = r));
    let finished = false;
    const cleanups = [];
    /** Set while we write to stdout ourselves, so the dev warning only catches other writers. */
    let ownWrite = false;
    const writeOwn = (text) => {
        ownWrite = true;
        try {
            stdout.write(text);
        }
        finally {
            ownWrite = false;
        }
    };
    /** Puts the terminal back: cursor visible, raw mode off, primary screen. Safe to call twice. */
    let restored = false;
    const restore = () => {
        if (restored)
            return;
        restored = true;
        try {
            if (stdin.isTTY && typeof stdin.setRawMode === 'function')
                stdin.setRawMode(false);
        }
        catch {
            // stdin may already be closed.
        }
        try {
            if (stdout.isTTY)
                writeOwn(options.fullscreen ? `${LEAVE_ALT_SCREEN}${SHOW_CURSOR}` : SHOW_CURSOR);
        }
        catch {
            // stdout may already be closed.
        }
    };
    // EPIPE on stdout (`| head`): results already written are enough; exit quietly. Any other stdout
    // error (EIO when the terminal goes away) is a crash: listening here stops Node from throwing it.
    // The listener stays until the final output has flushed (see `flushed`), because a Writable
    // reports a failed write asynchronously; after the first error, later ones (a destroyed stream
    // failing the next write) are ignored.
    let stdoutFailed = false;
    const onStdoutError = (err) => {
        if (stdoutFailed)
            return;
        stdoutFailed = true;
        restore();
        if (err.code === 'EPIPE')
            return exit(0);
        try {
            stderr.write(`stdout failed: ${err.message}\n`);
        }
        catch {
            // stderr may be gone too.
        }
        exit(1);
    };
    stdout.on('error', onStdoutError);
    /** Resolves once everything written to stdout so far has flushed (or failed, handled above). */
    const flushed = () => new Promise((resolve) => {
        // A Writable calls write callbacks in order; a test sink that is not a Writable has nothing to flush.
        if (typeof stdout.writableLength !== 'number' || stdout.writableEnded || stdout.destroyed)
            return resolve();
        try {
            stdout.write('', () => resolve());
        }
        catch {
            resolve();
        }
    });
    /** The last step of both views: wait for the final output, then stop listening for its errors. */
    const settle = async (code) => {
        await flushed();
        stdout.off('error', onStdoutError);
        resolveDone(code);
        return code;
    };
    // The host's onCancel runs once on the first cancel, whoever created the Director.
    if (options.onCancel) {
        const onCancel = options.onCancel;
        let called = false;
        const unsubscribeCancel = director.subscribe((s) => {
            if (called || !s.canceled)
                return;
            called = true;
            try {
                onCancel(s.canceled.reason);
            }
            catch {
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
    let finish = async () => done;
    const interrupt = (why) => {
        const now = Date.now();
        if (now - lastInterrupt < 2000) {
            restore();
            exit(130);
            return;
        }
        lastInterrupt = now;
        const status = director.snapshot().status;
        if (status === 'running' || status === 'idle')
            director.cancel(why);
        else
            void finish();
    };
    /** SIGTERM and SIGHUP cancel like one interrupt, but never force or finish on their own. */
    const cancelOnSignal = (sig) => {
        const status = director.snapshot().status;
        if (status === 'running' || status === 'idle')
            director.cancel(sig);
    };
    /** Both views finish by themselves once the run has ended and its snapshot has arrived. */
    const unsubscribeFinish = director.subscribe((s) => {
        if (s.snapshot && s.status !== 'running' && s.status !== 'idle')
            void finish();
    });
    cleanups.push(unsubscribeFinish);
    // ------------------------------------------------------------------ linear fallback
    if (mode === 'linear') {
        const writer = createLinearWriter({ format: caps.screenReader ? 'plain' : 'rich', caps, stdout, stderr, ...renderOpts });
        if (caps.isTTY || caps.stderrIsTTY)
            stderr.write(`${caps.screenReader ? 'Note' : 'Live view off'}: ${reason}.\n`);
        // Log lines that did not arrive as events (the host's director.log, spawnLogged's child output)
        // are narrated too; lines that came from events were already printed by the writer. Counted
        // through the ring buffer: total = kept + dropped.
        const logTotal = () => director.snapshot().logs.length + director.snapshot().dropped.logs;
        let logsSeen = logTotal();
        const forwardLogs = () => {
            const logs = director.snapshot().logs;
            const fresh = Math.min(logTotal() - logsSeen, logs.length);
            for (const l of logs.slice(logs.length - fresh))
                writer.log(l.level, l.text);
            logsSeen = logTotal();
        };
        let pushing = false;
        cleanups.push(director.subscribe(() => !finished && !pushing && forwardLogs()));
        finish = async () => {
            if (finished)
                return done;
            forwardLogs(); // info lines may still be coalescing
            finished = true;
            writer.end();
            for (const c of cleanups)
                c();
            const code = exitCodeFor(director.snapshot().status);
            if (ownsDirector)
                director.dispose();
            return settle(code);
        };
        installSignals(() => interrupt('SIGINT'), cancelOnSignal);
        return {
            director,
            mode,
            reason: reason,
            push(event) {
                // The writer first: the Director finishing on a snapshot ends the writer, which must have
                // printed that snapshot by then.
                forwardLogs();
                writer.write(event);
                pushing = true;
                try {
                    director.push(event);
                }
                finally {
                    pushing = false;
                }
                logsSeen = logTotal(); // this event's own log line was printed by the writer
            },
            end: () => finish(),
            done,
        };
    }
    // ------------------------------------------------------------------ live view
    let instance;
    const rc = () => ({ ...renderCapsFor({ ...caps, columns: stdout.columns || caps.columns }, 'stdout'), columns: Math.max(20, stdout.columns || caps.columns) });
    const rows = () => Math.max(5, stdout.rows || caps.rows);
    const finishLive = async () => {
        if (finished)
            return done;
        finished = true;
        director.flush();
        instance?.unmount();
        try {
            await instance?.waitUntilExit();
        }
        catch {
            // Ink rejects waitUntilExit when unmounted with an error; we still print results.
        }
        restore();
        for (const c of cleanups)
            c();
        const state = director.snapshot();
        // Results are printed linearly: nothing important lives only in a live redraw. Cuts keep the
        // labels the live view gave them (in start order), whatever order the snapshot lists them in.
        const cutLabels = new Map(state.cuts.map((c) => [c.cut, c.label]));
        if (state.snapshot)
            stdout.write(renderRich(state.snapshot, renderCapsFor(caps, 'stdout'), { ...renderOpts, cutLabels }));
        else
            stderr.write('No result snapshot arrived, so no results are shown.\n');
        if (ownsDirector)
            director.dispose();
        return settle(exitCodeFor(state.status));
    };
    finish = finishLive;
    const view = () => (_jsx(Storyboard, { director: director, rc: rc(), rows: rows(), ...(options.product ? { product: options.product } : {}), ...(options.nextSteps ? { nextSteps: options.nextSteps } : {}), onQuit: () => {
            // q never forces: the first cancels a running job (status becomes canceled), so the next
            // one takes the finish path and prints what is there.
            const status = director.snapshot().status;
            if (status === 'running' || status === 'idle')
                interrupt('quit (q)');
            else
                void finish();
        }, onInterrupt: () => interrupt('SIGINT'), onOpen: (url) => void openUrl(url) }));
    // Development warning: direct writes to stdout corrupt the live view (Ink redraws over them).
    const devWarnings = options.devWarnings ?? process.env.NODE_ENV !== 'production';
    if (devWarnings && stdout === process.stdout) {
        const original = stdout.write;
        let warned = false;
        stdout.write = function patchedWrite(...args) {
            if (!warned && !finished && !ownWrite && !/[\\/]ink[\\/]build[\\/]/.test(new Error().stack ?? '')) {
                warned = true;
                director.log('warn', 'Something wrote to stdout directly during the live view, which corrupts it. Use console.* or spawnLogged, or run with --plain.');
                // Warned once: put the original back, so no later write pays for a stack trace.
                stdout.write = original;
            }
            return original.apply(this, args);
        };
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
            if (cleanup)
                writeOwn(cleanup);
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
    installSignals(() => interrupt('SIGINT'), cancelOnSignal);
    return {
        director,
        mode,
        push: (event) => director.push(event),
        end: finishLive,
        done,
    };
    function installSignals(onSigint, onCancelSignal) {
        if (options.handleSignals === false)
            return;
        const sigint = () => onSigint();
        const sigterm = () => onCancelSignal('SIGTERM');
        const sighup = () => onCancelSignal('SIGHUP');
        const crash = (err) => {
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
