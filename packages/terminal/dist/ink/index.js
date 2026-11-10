import { jsx as _jsx } from "react/jsx-runtime";
import { render } from 'ink';
import { renderCapsFor } from '../render/grammar.js';
import { renderRich } from '../render/index.js';
import { openUrl } from '../process/index.js';
import { Storyboard } from './components.js';
import { createFrameTracker, reflowCleanup } from './reflow.js';
import { exitCodeFor, startSession } from './session.js';
export { Cut, HintBar, Inspector, Storyboard, useRunState } from './components.js';
export { exitCodeFor, linearReason } from './session.js';
/** Starts a run with the live view when the terminal allows it (see `./session.ts`). */
export function startLive(options) {
    return startSession(options, mountLive);
}
/** Mounts the Ink view; returns how to finish it. */
function mountLive(ctx) {
    const { director, caps, options, stdin, stdout, stderr, renderOpts, cleanups, restore, writeOwn } = ctx;
    let instance;
    const rc = () => ({ ...renderCapsFor({ ...caps, columns: stdout.columns || caps.columns }, 'stdout'), columns: Math.max(20, stdout.columns || caps.columns) });
    const rows = () => Math.max(5, stdout.rows || caps.rows);
    const finishLive = async () => {
        if (!ctx.markFinished())
            return ctx.done;
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
        // At the terminal's current width: it may have been resized since the run started.
        if (state.snapshot)
            stdout.write(renderRich(options.replay ? { ...state.snapshot, replay: true } : state.snapshot, rc(), { ...renderOpts, cutLabels }));
        else
            stderr.write('No result snapshot arrived, so no results are shown.\n');
        if (ctx.ownsDirector)
            director.dispose();
        return ctx.settle(exitCodeFor(state.status));
    };
    const view = () => (_jsx(Storyboard, { director: director, rc: rc(), rows: rows(), ...(options.product ? { product: options.product } : {}), ...(options.nextSteps ? { nextSteps: options.nextSteps } : {}), ...(options.replay ? { replay: true } : {}), onQuit: () => {
            // q never forces: the first cancels a running job (status becomes canceled), so the next
            // one takes the finish path and prints what is there.
            const status = director.snapshot().status;
            if (status === 'running' || status === 'idle')
                ctx.interrupt('quit (q)');
            else
                void ctx.finish();
        }, onInterrupt: () => ctx.interrupt('SIGINT'), onOpen: (url) => void openUrl(url) }));
    // Development warning: direct writes to stdout corrupt the live view (Ink redraws over them).
    const devWarnings = options.devWarnings ?? process.env.NODE_ENV !== 'production';
    if (devWarnings && stdout === process.stdout) {
        const original = stdout.write;
        let warned = false;
        stdout.write = function patchedWrite(...args) {
            if (!warned && !ctx.isFinished() && !ctx.isOwnWrite() && !/[\\/]ink[\\/]build[\\/]/.test(new Error().stack ?? '')) {
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
        if (columns < lastColumns && !options.fullscreen && caps.reflow) {
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
    return finishLive;
}
