import { FRAME_MS, tempoIntervalMs } from './motion.js';
import { createSanitizer } from './safety.js';
import { createStreamValidator, describeIssues } from './validate.js';
const defaultScheduler = {
    now: () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
    setTimeout: (fn, ms) => {
        const t = setTimeout(fn, ms);
        t.unref?.(); // Never hold the process open for a redraw.
        return t;
    },
    clearTimeout: (h) => clearTimeout(h),
};
/** Creates a Director. */
export function createDirector(options) {
    const sched = options.scheduler ?? defaultScheduler;
    const maxLogs = Math.max(1, options.maxLogs ?? 500);
    const maxEvents = Math.max(1, options.maxEvents ?? 5000);
    const maxItems = Math.max(1, options.maxItems ?? 5000);
    let stored = 0;
    /** Takes one storage slot for a new cut, finding, receipt or metric; false (and counted) when full. */
    const take = () => {
        if (stored >= maxItems) {
            state.dropped.items++;
            return false;
        }
        stored++;
        return true;
    };
    const maxWarnings = Math.max(1, options.maxWarnings ?? 200);
    const san = createSanitizer(options.safety);
    const stream = createStreamValidator(options.validation);
    const abort = new AbortController();
    const listeners = new Set();
    const poseMs = tempoIntervalMs(options.motion);
    const state = {
        version: 0,
        status: 'idle',
        cuts: [],
        findings: [],
        metrics: [],
        warnings: [],
        logs: [],
        pose: 0,
        dropped: { invalid: 0, ignored: 0, logs: 0, warnings: 0, events: 0, items: 0 },
    };
    const cutIndex = new Map();
    const findingIndex = new Map();
    const metricIndex = new Map();
    /** Receipt keys per finding, so a re-sent finding or a repeated receipt is not listed twice. */
    const receiptKeys = new Map();
    const receiptKey = (r) => `${r.kind}\u0000${r.value}\u0000${r.href ?? ''}`;
    let seen = 0;
    let disposed = false;
    let dirty = false;
    let frameTimer;
    let poseTimer;
    let lastPublish = Number.NEGATIVE_INFINITY;
    const publish = () => {
        if (disposed)
            return;
        if (frameTimer !== undefined) {
            sched.clearTimeout(frameTimer);
            frameTimer = undefined;
        }
        dirty = false;
        lastPublish = sched.now();
        state.version++;
        for (const l of [...listeners]) {
            try {
                l(state);
            }
            catch {
                // A failing subscriber must not stop the run or other subscribers.
            }
        }
    };
    /** Coalesced publish: at most one per frame; the newest state wins. */
    const schedule = () => {
        if (disposed)
            return;
        dirty = true;
        if (frameTimer !== undefined)
            return;
        const wait = Math.max(0, lastPublish + FRAME_MS - sched.now());
        frameTimer = sched.setTimeout(() => {
            frameTimer = undefined;
            if (dirty)
                publish();
        }, wait);
    };
    /**
     * The pose clock runs only while something is running and the tempo is not `still`. Poses sit
     * on an absolute grid (start + n × interval), so timer lateness never accumulates into drift.
     */
    let poseOrigin = 0;
    const armPose = () => {
        const due = poseOrigin + (state.pose + 1) * poseMs;
        poseTimer = sched.setTimeout(tickPose, Math.max(0, due - sched.now()));
    };
    const tickPose = () => {
        poseTimer = undefined;
        // The pose only animates running cuts: with none running, nothing on screen changes, so the
        // clock stops (no redraw while idle) and restarts at the next cut-start.
        if (disposed || !Number.isFinite(poseMs) || state.status !== 'running' || !state.cuts.some((c) => c.status === 'running'))
            return;
        // Catch up to the grid if the process stalled, without publishing every missed pose.
        state.pose = Math.max(state.pose + 1, Math.floor((sched.now() - poseOrigin) / poseMs));
        schedule();
        armPose();
    };
    const startPose = () => {
        if (poseTimer !== undefined || !Number.isFinite(poseMs) || disposed)
            return;
        poseOrigin = sched.now() - state.pose * poseMs;
        armPose();
    };
    const stopPose = () => {
        if (poseTimer !== undefined)
            sched.clearTimeout(poseTimer);
        poseTimer = undefined;
    };
    const addWarning = (text) => {
        if (state.warnings.length >= maxWarnings) {
            state.dropped.warnings++;
            return;
        }
        state.warnings.push(text);
    };
    const addLog = (line) => {
        state.logs.push(line);
        if (state.logs.length > maxLogs) {
            state.logs.splice(0, state.logs.length - maxLogs);
            state.dropped.logs++;
        }
    };
    /** Appends in place (each finding owns its receipts array): linear in the number of receipts. */
    const mergeReceipts = (findingId, receipts) => {
        const i = findingIndex.get(findingId);
        if (i === undefined)
            return;
        const keys = receiptKeys.get(findingId);
        const list = state.findings[i].receipts;
        for (const r of receipts) {
            const k = receiptKey(r);
            if (keys.has(k) || !take())
                continue;
            keys.add(k);
            list.push(r);
        }
    };
    /** Folds one accepted event into state; returns true when it must be published immediately. */
    const fold = (ev) => {
        switch (ev.type) {
            case 'run-start':
                state.runId = ev.runId;
                state.title = ev.title;
                if (ev.product !== undefined)
                    state.product = ev.product;
                // A cancel can land before the producer's run-start; it stays canceled.
                if (!state.canceled)
                    state.status = 'running';
                return true;
            case 'scene-start':
            case 'scene-end':
                return false;
            case 'cut-start': {
                if (!take())
                    return false;
                cutIndex.set(ev.cut, state.cuts.length);
                state.cuts.push({
                    cut: ev.cut,
                    label: `C-${String(state.cuts.length + 1).padStart(2, '0')}`,
                    title: ev.title,
                    ...(ev.scene !== undefined ? { scene: ev.scene } : {}),
                    ...(state.canceled ? { status: 'canceled', summary: state.canceled.reason } : { status: 'running' }),
                    startedAt: ev.ts,
                });
                if (state.canceled)
                    return true;
                if (state.status === 'idle')
                    state.status = 'running';
                startPose();
                return false;
            }
            case 'cut-progress': {
                const i = cutIndex.get(ev.cut);
                if (i === undefined)
                    return false;
                const c = state.cuts[i];
                const progress = { ...c.progress };
                if (ev.done !== undefined)
                    progress.done = ev.done;
                if (ev.total !== undefined)
                    progress.total = ev.total;
                if (ev.unit !== undefined)
                    progress.unit = ev.unit;
                if (ev.note !== undefined)
                    progress.note = ev.note;
                state.cuts[i] = { ...c, progress };
                return false;
            }
            case 'cut-end': {
                let i = cutIndex.get(ev.cut);
                if (i === undefined) {
                    // A partial stream: the cut's start was never seen. Show it anyway (when there is room).
                    if (stored >= maxItems)
                        return true; // its cut-start was already counted as dropped
                    stored++;
                    i = state.cuts.length;
                    cutIndex.set(ev.cut, i);
                    state.cuts.push({ cut: ev.cut, label: `C-${String(i + 1).padStart(2, '0')}`, title: ev.cut, status: 'running', startedAt: ev.ts });
                }
                const c = state.cuts[i];
                state.cuts[i] = {
                    ...c,
                    status: ev.status,
                    ...(ev.summary !== undefined ? { summary: ev.summary } : {}),
                    ...(ev.durationMs !== undefined ? { durationMs: ev.durationMs } : {}),
                };
                return true;
            }
            case 'metric': {
                const i = metricIndex.get(ev.metric.name);
                if (i === undefined) {
                    if (!take())
                        return false;
                    metricIndex.set(ev.metric.name, state.metrics.length);
                    state.metrics.push(ev.metric);
                }
                else
                    state.metrics[i] = ev.metric;
                return false;
            }
            case 'finding': {
                const i = findingIndex.get(ev.finding.id);
                if (i === undefined) {
                    if (!take())
                        return false; // Counted in dropped.items; the snapshot has it.
                    findingIndex.set(ev.finding.id, state.findings.length);
                    receiptKeys.set(ev.finding.id, new Set());
                    state.findings.push({ ...ev.finding, receipts: [] });
                }
                else
                    state.findings[i] = { ...ev.finding, receipts: state.findings[i].receipts };
                mergeReceipts(ev.finding.id, ev.finding.receipts ?? []);
                return false;
            }
            case 'receipt':
                mergeReceipts(ev.finding, [ev.receipt]);
                return false;
            case 'log':
                addLog({ level: ev.level, text: ev.text, ...(ev.cut !== undefined ? { cut: ev.cut } : {}), ...(ev.stream !== undefined ? { stream: ev.stream } : {}) });
                return ev.level === 'error' || ev.level === 'warn';
            case 'warning':
                addWarning(ev.message);
                return true;
            case 'run-end':
                state.status = ev.status;
                for (const [i, c] of state.cuts.entries())
                    if (c.status === 'running')
                        state.cuts[i] = { ...c, status: ev.status === 'canceled' ? 'canceled' : 'skipped' };
                stopPose();
                return true;
            case 'snapshot':
                state.snapshot = ev.snapshot;
                return true;
        }
    };
    const push = (raw) => {
        if (disposed)
            return;
        seen++;
        if (seen > maxEvents)
            state.dropped.events++;
        const r = stream.push(raw);
        if (!r.ok) {
            if (r.ignorable)
                state.dropped.ignored++;
            else
                state.dropped.invalid++;
            // A dropped event is visible: it becomes a warning, published immediately.
            addWarning(san.text(`${r.ignorable ? 'Ignored' : 'Dropped'} event ${seen}: ${describeIssues(r.issues)}`));
            publish();
            return;
        }
        const ev = san.event(r.value);
        const immediate = fold(ev);
        try {
            options.onEvent?.(ev);
        }
        catch {
            // The host's callback failing must not lose the event.
        }
        if (immediate)
            publish();
        else
            schedule();
    };
    return {
        push,
        subscribe(listener) {
            listeners.add(listener);
            return () => void listeners.delete(listener);
        },
        snapshot: () => state,
        cancel(reason) {
            if (disposed || state.canceled)
                return;
            const why = san.text(reason) || 'canceled';
            state.canceled = { reason: why };
            if (state.status === 'idle' || state.status === 'running')
                state.status = 'canceled';
            for (const [i, c] of state.cuts.entries())
                if (c.status === 'running')
                    state.cuts[i] = { ...c, status: 'canceled', summary: why };
            stopPose();
            abort.abort(why);
            publish(); // Cancellation is acknowledged at once, before the producer even reacts.
            try {
                options.onCancel?.(why);
            }
            catch {
                // Ignore host errors; the run is canceled either way.
            }
        },
        log(level, text, meta) {
            if (disposed)
                return;
            for (const line of san.text(text, 'log', 'log').split('\n')) {
                addLog({ level, text: line, ...(meta?.cut !== undefined ? { cut: san.text(meta.cut, 'identifier') } : {}), ...(meta?.stream ? { stream: meta.stream } : {}) });
            }
            if (level === 'error' || level === 'warn')
                publish();
            else
                schedule();
        },
        flush: publish,
        get signal() {
            return abort.signal;
        },
        dispose() {
            disposed = true;
            stopPose();
            if (frameTimer !== undefined)
                sched.clearTimeout(frameTimer);
            frameTimer = undefined;
            listeners.clear();
        },
    };
}
