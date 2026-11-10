/**
 * The Director: the one place a live view gets its state from. No React, no timers it cannot be
 * told about, no I/O. It validates and sanitizes every event, folds the stream into a typed
 * `RunState`, and publishes that state to subscribers.
 *
 * Information is never paced; presentation sometimes is:
 * - Immediate (published before `push()` returns): errors and warnings, `cut-end`, `run-end`,
 *   the snapshot, cancellation, and anything the caller marks immediate (key echo, focus).
 * - Coalesced: everything else is published at most once per frame (60 fps), newest state wins,
 *   so a 10,000 events/s burst never queues work without bound.
 * - Paced: decorative state (the animation `pose` that drives progress glyphs and transitions)
 *   advances only on the tempo grid: every 83.33 ms at `twos`, every frame at `ones`, never at
 *   `still`. Data never waits for the pose.
 *
 * Memory is bounded: logs are a ring buffer (default 500 lines), at most `maxEvents` events are
 * counted in detail (default 5,000; the rest are summarized as a count), and warnings are capped.
 */
import type { Capabilities } from './capabilities.js';
import type { CutStatus, Finding, LogLevel, Metric, ReceiptRef, RunStatus, Snapshot, TerminalEvent } from './contract.js';
import { FRAME_MS, tempoIntervalMs, type Tempo } from './motion.js';
import { createSanitizer, type SafetyOptions } from './safety.js';
import { createStreamValidator, describeIssues, type StreamValidatorOptions } from './validate.js';

export interface CutState {
  cut: string;
  /** Presentation label, numbered in the order cuts started (`C-01`). */
  label: string;
  title: string;
  scene?: string;
  status: 'running' | CutStatus;
  progress?: { done?: number; total?: number; unit?: string; note?: string };
  summary?: string;
  startedAt: string;
  durationMs?: number;
}

export interface LogLine {
  level: LogLevel;
  text: string;
  cut?: string;
  stream?: 'stdout' | 'stderr';
}

export interface RunState {
  /** Increments on every publish. */
  version: number;
  runId?: string;
  title?: string;
  product?: string;
  status: 'idle' | 'running' | RunStatus;
  cuts: CutState[];
  /** Findings in arrival order, with receipts from `receipt` events merged in. */
  findings: Finding[];
  /** Latest value per metric name, in first-seen order. */
  metrics: Metric[];
  warnings: string[];
  /** The newest log lines (ring buffer). */
  logs: LogLine[];
  /** The authoritative result, once it arrives. Live views render results from this only. */
  snapshot?: Snapshot;
  /** Set when `cancel()` was called. */
  canceled?: { reason: string };
  /** Decorative animation pose: advances only on the tempo grid. */
  pose: number;
  /** What was dropped or summarized to keep memory bounded. */
  dropped: { invalid: number; ignored: number; logs: number; warnings: number; events: number };
}

/** Timers the Director uses; inject fakes in tests. */
export interface Scheduler {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface DirectorOptions {
  caps: Pick<Capabilities, 'interactive'>;
  /** The resolved tempo (see `resolveTerminalMotion`). */
  motion: Tempo;
  /** Called with every accepted, sanitized event, synchronously. */
  onEvent?: (event: TerminalEvent) => void;
  /** Called once when `cancel()` is first called; the producer should stop its work. */
  onCancel?: (reason: string) => void;
  /** Log ring-buffer size. Default 500. */
  maxLogs?: number;
  /** Events counted in detail before older ones are only summarized. Default 5,000. */
  maxEvents?: number;
  /** Warnings kept; later ones are counted in `dropped.warnings`. Default 200. */
  maxWarnings?: number;
  safety?: SafetyOptions;
  validation?: StreamValidatorOptions;
  scheduler?: Scheduler;
}

export type Listener = (state: Readonly<RunState>) => void;

/**
 * The part of `AbortSignal` the Director exposes, declared structurally so consumers compile
 * without DOM or Node type libraries. At runtime it is a real `AbortSignal`.
 */
export interface AbortSignalLike {
  readonly aborted: boolean;
  readonly reason: unknown;
}

export interface Director {
  /** Accepts one event (parsed JSON). Never throws. */
  push(raw: unknown): void;
  /** Subscribes to published states; returns an unsubscribe function. */
  subscribe(listener: Listener): () => void;
  /** The current state (also between publishes). */
  snapshot(): Readonly<RunState>;
  /**
   * Cancels the run: running cuts become `canceled`, the run becomes `canceled`, `onCancel` runs
   * once, and the state is published immediately. Later calls are no-ops.
   */
  cancel(reason: string): void;
  /** Adds a log line from the host (sanitized and redacted like any other). */
  log(level: LogLevel, text: string): void;
  /** Publishes now, bypassing coalescing (for key echo and focus moves). */
  flush(): void;
  /** An AbortSignal that aborts on `cancel()`, for producers that take one (fetch, child processes). */
  readonly signal: AbortSignalLike;
  /** Stops timers; the Director publishes nothing after this. */
  dispose(): void;
}

const defaultScheduler: Scheduler = {
  now: () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
  setTimeout: (fn, ms) => {
    const t = setTimeout(fn, ms) as { unref?: () => void };
    t.unref?.(); // Never hold the process open for a redraw.
    return t;
  },
  clearTimeout: (h) => clearTimeout(h),
};

/** Creates a Director. */
export function createDirector(options: DirectorOptions): Director {
  const sched = options.scheduler ?? defaultScheduler;
  const maxLogs = Math.max(1, options.maxLogs ?? 500);
  const maxEvents = Math.max(1, options.maxEvents ?? 5000);
  const maxWarnings = Math.max(1, options.maxWarnings ?? 200);
  const san = createSanitizer(options.safety);
  const stream = createStreamValidator(options.validation);
  const abort = new AbortController();
  const listeners = new Set<Listener>();
  const poseMs = tempoIntervalMs(options.motion);

  const state: RunState = {
    version: 0,
    status: 'idle',
    cuts: [],
    findings: [],
    metrics: [],
    warnings: [],
    logs: [],
    pose: 0,
    dropped: { invalid: 0, ignored: 0, logs: 0, warnings: 0, events: 0 },
  };
  const cutIndex = new Map<string, number>();
  const findingIndex = new Map<string, number>();
  const metricIndex = new Map<string, number>();
  let seen = 0;
  let disposed = false;
  let dirty = false;
  let frameTimer: unknown;
  let poseTimer: unknown;
  let lastPublish = Number.NEGATIVE_INFINITY;

  const publish = () => {
    if (disposed) return;
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
      } catch {
        // A failing subscriber must not stop the run or other subscribers.
      }
    }
  };

  /** Coalesced publish: at most one per frame; the newest state wins. */
  const schedule = () => {
    if (disposed) return;
    dirty = true;
    if (frameTimer !== undefined) return;
    const wait = Math.max(0, lastPublish + FRAME_MS - sched.now());
    frameTimer = sched.setTimeout(() => {
      frameTimer = undefined;
      if (dirty) publish();
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
    if (disposed || !Number.isFinite(poseMs) || state.status !== 'running') return;
    // Catch up to the grid if the process stalled, without publishing every missed pose.
    state.pose = Math.max(state.pose + 1, Math.floor((sched.now() - poseOrigin) / poseMs));
    schedule();
    armPose();
  };
  const startPose = () => {
    if (poseTimer !== undefined || !Number.isFinite(poseMs) || disposed) return;
    poseOrigin = sched.now() - state.pose * poseMs;
    armPose();
  };
  const stopPose = () => {
    if (poseTimer !== undefined) sched.clearTimeout(poseTimer);
    poseTimer = undefined;
  };

  const addWarning = (text: string) => {
    if (state.warnings.length >= maxWarnings) {
      state.dropped.warnings++;
      return;
    }
    state.warnings.push(text);
  };

  const addLog = (line: LogLine) => {
    state.logs.push(line);
    if (state.logs.length > maxLogs) {
      state.logs.splice(0, state.logs.length - maxLogs);
      state.dropped.logs++;
    }
  };

  const mergeReceipt = (findingId: string, receipt: ReceiptRef) => {
    const i = findingIndex.get(findingId);
    if (i === undefined) return;
    const f = state.findings[i]!;
    state.findings[i] = { ...f, receipts: [...(f.receipts ?? []), receipt] };
  };

  /** Folds one accepted event into state; returns true when it must be published immediately. */
  const fold = (ev: TerminalEvent): boolean => {
    switch (ev.type) {
      case 'run-start':
        state.runId = ev.runId;
        state.title = ev.title;
        if (ev.product !== undefined) state.product = ev.product;
        state.status = 'running';
        startPose();
        return true;
      case 'scene-start':
      case 'scene-end':
        return false;
      case 'cut-start': {
        cutIndex.set(ev.cut, state.cuts.length);
        state.cuts.push({
          cut: ev.cut,
          label: `C-${String(state.cuts.length + 1).padStart(2, '0')}`,
          title: ev.title,
          ...(ev.scene !== undefined ? { scene: ev.scene } : {}),
          status: 'running',
          startedAt: ev.ts,
        });
        if (state.status === 'idle') state.status = 'running';
        startPose();
        return false;
      }
      case 'cut-progress': {
        const i = cutIndex.get(ev.cut);
        if (i === undefined) return false;
        const c = state.cuts[i]!;
        const progress = { ...c.progress };
        if (ev.done !== undefined) progress.done = ev.done;
        if (ev.total !== undefined) progress.total = ev.total;
        if (ev.unit !== undefined) progress.unit = ev.unit;
        if (ev.note !== undefined) progress.note = ev.note;
        state.cuts[i] = { ...c, progress };
        return false;
      }
      case 'cut-end': {
        let i = cutIndex.get(ev.cut);
        if (i === undefined) {
          // A partial stream: the cut's start was never seen. Show it anyway.
          i = state.cuts.length;
          cutIndex.set(ev.cut, i);
          state.cuts.push({ cut: ev.cut, label: `C-${String(i + 1).padStart(2, '0')}`, title: ev.cut, status: 'running', startedAt: ev.ts });
        }
        const c = state.cuts[i]!;
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
          metricIndex.set(ev.metric.name, state.metrics.length);
          state.metrics.push(ev.metric);
        } else state.metrics[i] = ev.metric;
        return false;
      }
      case 'finding': {
        const i = findingIndex.get(ev.finding.id);
        if (i === undefined) {
          findingIndex.set(ev.finding.id, state.findings.length);
          state.findings.push(ev.finding);
        } else state.findings[i] = { ...ev.finding, receipts: [...(state.findings[i]!.receipts ?? []), ...(ev.finding.receipts ?? [])] };
        return false;
      }
      case 'receipt':
        mergeReceipt(ev.finding, ev.receipt);
        return false;
      case 'log':
        addLog({ level: ev.level, text: ev.text, ...(ev.cut !== undefined ? { cut: ev.cut } : {}), ...(ev.stream !== undefined ? { stream: ev.stream } : {}) });
        return ev.level === 'error' || ev.level === 'warn';
      case 'warning':
        addWarning(ev.message);
        return true;
      case 'run-end':
        state.status = ev.status;
        for (const [i, c] of state.cuts.entries()) if (c.status === 'running') state.cuts[i] = { ...c, status: ev.status === 'canceled' ? 'canceled' : 'skipped' };
        stopPose();
        return true;
      case 'snapshot':
        state.snapshot = ev.snapshot;
        return true;
    }
  };

  const push = (raw: unknown) => {
    if (disposed) return;
    seen++;
    if (seen > maxEvents) state.dropped.events++;
    const r = stream.push(raw);
    if (!r.ok) {
      if (r.ignorable) state.dropped.ignored++;
      else state.dropped.invalid++;
      // A dropped event is visible: it becomes a warning, published immediately.
      addWarning(san.text(`${r.ignorable ? 'Ignored' : 'Dropped'} event ${seen}: ${describeIssues(r.issues)}`));
      publish();
      return;
    }
    const ev = san.event(r.value);
    const immediate = fold(ev);
    try {
      options.onEvent?.(ev);
    } catch {
      // The host's callback failing must not lose the event.
    }
    if (immediate) publish();
    else schedule();
  };

  return {
    push,
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    snapshot: () => state,
    cancel(reason) {
      if (disposed || state.canceled) return;
      const why = san.text(reason) || 'canceled';
      state.canceled = { reason: why };
      if (state.status === 'idle' || state.status === 'running') state.status = 'canceled';
      for (const [i, c] of state.cuts.entries()) if (c.status === 'running') state.cuts[i] = { ...c, status: 'canceled', summary: why };
      stopPose();
      abort.abort(why);
      publish(); // Cancellation is acknowledged at once, before the producer even reacts.
      try {
        options.onCancel?.(why);
      } catch {
        // Ignore host errors; the run is canceled either way.
      }
    },
    log(level, text) {
      if (disposed) return;
      addLog({ level, text: san.text(text, 'log', 'log') });
      if (level === 'error' || level === 'warn') publish();
      else schedule();
    },
    flush: publish,
    get signal() {
      return abort.signal;
    },
    dispose() {
      disposed = true;
      stopPose();
      if (frameTimer !== undefined) sched.clearTimeout(frameTimer);
      frameTimer = undefined;
      listeners.clear();
    },
  };
}
