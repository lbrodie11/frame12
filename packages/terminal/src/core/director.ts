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
 * Memory is bounded: logs are a ring buffer (default 500 lines), warnings are capped, and at most
 * `maxItems` (default 5,000) cuts, findings, receipts and metrics are stored. Past that, updates to
 * stored items still apply and new items are only counted (`dropped.items`): the snapshot, not
 * narration, carries the full result. Every event is still validated and folded; `maxEvents` only
 * sets when `dropped.events` starts counting.
 */
import type { Capabilities } from './capabilities.js';
import type { CutStatus, Finding, LogLevel, Metric, ReceiptRef, RunStatus, Snapshot, TerminalEvent } from './contract.js';
import { FRAME_MS, tempoIntervalMs, type Tempo } from './motion.js';
import { createSanitizer, type SafetyOptions } from './safety.js';
import { createStreamValidator, describeIssues, type StreamValidatorOptions } from './validate.js';
import { recordingHeader, recordingLine, redactLinks, type RecordSink } from './recording.js';

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
  /** `event`: from a `log` event; `host`: from `Director.log()` (the host, or a child via spawnLogged). */
  origin: 'event' | 'host';
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
  dropped: { invalid: number; ignored: number; logs: number; warnings: number; events: number; items: number };
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
  /** Events after this many are counted in `dropped.events` (still validated and folded). Default 5,000. */
  maxEvents?: number;
  /**
   * Cuts, findings, receipts and metrics stored, together. Past it, updates to stored items still
   * apply and new ones are counted in `dropped.items`. Default 5,000.
   */
  maxItems?: number;
  /** Warnings kept; later ones are counted in `dropped.warnings`. Default 200. */
  maxWarnings?: number;
  safety?: SafetyOptions;
  validation?: StreamValidatorOptions;
  scheduler?: Scheduler;
  /**
   * Records the run as `.f12rec` lines (see `recording.ts`): the header at once, then every accepted
   * event, sanitized and redacted (links too), timed by its own `ts`, ending with the snapshot; then
   * `end()`. A sink that throws stops the recording with a warning (and `end()`). Deterministic.
   */
  record?: RecordSink;
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
  /**
   * Accepts one event (parsed JSON). Never throws. `where` names it in a dropped-event warning
   * (`line 12`); by default it is counted (`event 12`).
   */
  push(raw: unknown, where?: string): void;
  /**
   * Sees every pushed event, raw and before validation, ahead of the fold and any publish; returns
   * an unsubscribe function. For renderers that validate on their own (the linear view), so events
   * pushed to a shared Director directly reach them too.
   */
  tap(listener: (raw: unknown, where?: string) => void): () => void;
  /** Subscribes to published states; returns an unsubscribe function. */
  subscribe(listener: Listener): () => void;
  /** The current state (also between publishes). */
  snapshot(): Readonly<RunState>;
  /**
   * Cancels the run: running cuts become `canceled`, the run becomes `canceled`, `onCancel` runs
   * once, and the state is published immediately. Later calls are no-ops.
   */
  cancel(reason: string): void;
  /**
   * Adds a log line from the host (sanitized and redacted like any other). Multi-line text becomes
   * one log line per line. `meta` records which stream and cut it came from.
   */
  log(level: LogLevel, text: string, meta?: { cut?: string; stream?: 'stdout' | 'stderr' }): void;
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
    const t: { unref?: () => void } = setTimeout(fn, ms);
    t.unref?.(); // Never hold the process open for a redraw.
    return t;
  },
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

/** Creates a Director. */
export function createDirector(options: DirectorOptions): Director {
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
  const listeners = new Set<Listener>();
  const taps = new Set<(raw: unknown, where?: string) => void>();
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
    dropped: { invalid: 0, ignored: 0, logs: 0, warnings: 0, events: 0, items: 0 },
  };
  const cutIndex = new Map<string, number>();
  const findingIndex = new Map<string, number>();
  const metricIndex = new Map<string, number>();
  /** Receipt keys per finding, so a re-sent finding or a repeated receipt is not listed twice. */
  const receiptKeys = new Map<string, Set<string>>();
  const receiptKey = (r: ReceiptRef) => `${r.kind}\u0000${r.value}\u0000${r.href ?? ''}`;
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
    // The pose only animates running cuts: with none running, nothing on screen changes, so the
    // clock stops (no redraw while idle) and restarts at the next cut-start.
    if (disposed || !Number.isFinite(poseMs) || state.status !== 'running' || !state.cuts.some((c) => c.status === 'running')) return;
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

  /** Appends in place (each finding owns its receipts array): linear in the number of receipts. */
  const mergeReceipts = (findingId: string, receipts: readonly ReceiptRef[]) => {
    const i = findingIndex.get(findingId);
    if (i === undefined) return;
    const keys = receiptKeys.get(findingId)!;
    const list = state.findings[i]!.receipts!;
    for (const r of receipts) {
      const k = receiptKey(r);
      if (keys.has(k) || !take()) continue;
      keys.add(k);
      list.push(r);
    }
  };

  /** Folds one accepted event into state; returns true when it must be published immediately. */
  const fold = (ev: TerminalEvent): boolean => {
    switch (ev.type) {
      case 'run-start':
        state.runId = ev.runId;
        state.title = ev.title;
        if (ev.product !== undefined) state.product = ev.product;
        // A cancel can land before the producer's run-start; it stays canceled.
        if (!state.canceled) state.status = 'running';
        return true;
      case 'scene-start':
      case 'scene-end':
        return false;
      case 'cut-start': {
        if (!take()) return false;
        cutIndex.set(ev.cut, state.cuts.length);
        state.cuts.push({
          cut: ev.cut,
          label: `C-${String(state.cuts.length + 1).padStart(2, '0')}`,
          title: ev.title,
          ...(ev.scene !== undefined ? { scene: ev.scene } : {}),
          ...(state.canceled ? { status: 'canceled' as const, summary: state.canceled.reason } : { status: 'running' as const }),
          startedAt: ev.ts,
        });
        if (state.canceled) return true;
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
          // A partial stream: the cut's start was never seen. Show it anyway (when there is room).
          if (stored >= maxItems) return true; // its cut-start was already counted as dropped
          stored++;
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
          if (!take()) return false;
          metricIndex.set(ev.metric.name, state.metrics.length);
          state.metrics.push(ev.metric);
        } else state.metrics[i] = ev.metric;
        return false;
      }
      case 'finding': {
        const i = findingIndex.get(ev.finding.id);
        if (i === undefined) {
          if (!take()) return false; // Counted in dropped.items; the snapshot has it.
          findingIndex.set(ev.finding.id, state.findings.length);
          receiptKeys.set(ev.finding.id, new Set());
          state.findings.push({ ...ev.finding, receipts: [] });
        } else state.findings[i] = { ...ev.finding, receipts: state.findings[i]!.receipts! };
        mergeReceipts(ev.finding.id, ev.finding.receipts ?? []);
        return false;
      }
      case 'receipt':
        mergeReceipts(ev.finding, [ev.receipt]);
        return false;
      case 'log':
        addLog({ level: ev.level, text: ev.text, origin: 'event', ...(ev.cut !== undefined ? { cut: ev.cut } : {}), ...(ev.stream !== undefined ? { stream: ev.stream } : {}) });
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

  // Recording: the header at once, then one line per accepted event, timed by the events' own `ts`,
  // closed after the snapshot (the run's last word) or on dispose. A failing sink stops the
  // recording, never the run, and says so: an incomplete recording must not pass for a whole one.
  let recordOrigin: number | undefined;
  let lastT = 0;
  let recording = options.record !== undefined;
  const endRecording = () => {
    if (!recording) return;
    recording = false;
    try {
      options.record?.end?.();
    } catch {
      // Ignore: the run goes on.
    }
  };
  const recordWrite = (line: string): boolean => {
    try {
      options.record!.write(line);
      return true;
    } catch (err) {
      const name = options.record!.name ? `${options.record!.name} is` : 'it is';
      // A host warning (not only state): the linear view narrates it and the live view shows it.
      addLog({ level: 'warn', text: san.text(`Recording stopped: ${err instanceof Error ? err.message : String(err)}; ${name} incomplete.`, 'log', 'log'), origin: 'host' });
      endRecording();
      return false;
    }
  };
  if (recording) recordWrite(recordingHeader());
  const record = (ev: TerminalEvent): boolean => {
    if (!recording) return false;
    const ts = Date.parse(ev.ts);
    recordOrigin ??= Number.isFinite(ts) ? ts : 0;
    // Never decreasing, never negative: a producer's clock can step back.
    lastT = Math.max(lastT, Number.isFinite(ts) ? ts - recordOrigin : lastT);
    const ok = recordWrite(recordingLine(lastT, redactLinks(ev, options.safety?.redact, ev.type, options.safety?.links)));
    if (ok && ev.type === 'snapshot') endRecording();
    return !ok;
  };

  const push = (raw: unknown, where?: string) => {
    if (disposed) return;
    for (const t of [...taps]) {
      try {
        t(raw, where);
      } catch {
        // A failing tap must not lose the event.
      }
    }
    seen++;
    if (seen > maxEvents) state.dropped.events++;
    const r = stream.push(raw);
    if (!r.ok) {
      if (r.ignorable) state.dropped.ignored++;
      else state.dropped.invalid++;
      // A dropped event is visible: it becomes a warning, published immediately.
      addWarning(san.text(`${r.ignorable ? 'Ignored' : 'Dropped'} ${where ?? `event ${seen}`}: ${describeIssues(r.issues)}`));
      publish();
      return;
    }
    const ev = san.event(r.value);
    const recordFailed = record(ev);
    const immediate = fold(ev) || recordFailed;
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
    tap(listener) {
      taps.add(listener);
      return () => void taps.delete(listener);
    },
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
    log(level, text, meta) {
      if (disposed) return;
      for (const line of san.text(text, 'log', 'log').split('\n')) {
        addLog({ level, text: line, origin: 'host', ...(meta?.cut !== undefined ? { cut: san.text(meta.cut, 'identifier') } : {}), ...(meta?.stream ? { stream: meta.stream } : {}) });
      }
      if (level === 'error' || level === 'warn') publish();
      else schedule();
    },
    flush: publish,
    get signal() {
      return abort.signal;
    },
    dispose() {
      disposed = true;
      endRecording();
      stopPose();
      if (frameTimer !== undefined) sched.clearTimeout(frameTimer);
      frameTimer = undefined;
      listeners.clear();
      taps.clear();
    },
  };
}
