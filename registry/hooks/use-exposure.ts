'use client';

import * as React from 'react';
import { FRAME_MS } from '@/hooks/use-on-twos';
import { useTempo } from '@/hooks/use-tempo';

// Bundlers statically replace `process.env.NODE_ENV`. Declared locally so consumers without
// @types/node still type-check this file.
declare const process: { env: { NODE_ENV?: string } };

/**
 * useExposure: the headless navigation and playback engine behind `ExposureScrubber` (and, later,
 * `TraceTimeline`). It owns selection (by id), the playback clock, the data-change rules, the
 * keyboard map, settle detection and announcements. It renders nothing.
 *
 * See docs/architecture/exposure-engine.md.
 */

export type ExposureStatus = 'ok' | 'warn' | 'error' | 'pending';
export type ExposureTiming = 'even' | 'elapsed' | 'flipbook';
export type ExposureRate = 0.5 | 1 | 2 | 4;
export type ExposureValueReason =
  | 'keyboard'
  | 'pointer'
  | 'row'
  | 'marker'
  | 'cause'
  | 'playback'
  | 'data';
export type ExposurePlayingReason =
  | 'user'
  | 'end'
  | 'scrub'
  | 'hidden'
  | 'data'
  | 'tempo'
  | 'rejected';

export interface ExposureFrame {
  /** Unique and stable; identity survives reorders and data changes. */
  id: string;
  /** Short action, e.g. "tool call · write_file". */
  label: string;
  /** ISO 8601. Unparseable → treated as missing. */
  at?: string;
  /** How long the step took, if known (≥ 0, finite). */
  durationMs?: number;
  /** Short tag, e.g. "tool", "approval", "test". */
  kind?: string;
  status?: ExposureStatus;
  /** A moment that matters. */
  marker?: boolean;
  /** Ids of EARLIER frames that the data says led here. Never inferred. */
  causes?: string[];
  /** Exposure weight 1–12 (integer), default 1. */
  hold?: number;
  /** Plain-text summary, used in the table and without JS. */
  detail?: string;
}

/** One frame after the input contract is applied. */
export interface ExposureEntry {
  /** Internal unique key: the id, `id#2`/`id#3` for later duplicates, `#index` for a bad id. */
  key: string;
  index: number;
  /** The frame object exactly as passed in (handed to `renderFrame`). */
  source: ExposureFrame;
  label: string;
  detail?: string;
  kind?: string;
  status?: ExposureStatus;
  marker: boolean;
  /** 1–12. */
  hold: number;
  /** Valid `durationMs`, if any. */
  durationMs?: number;
  /** Parsed `at` (epoch ms), if valid. */
  atMs?: number;
  /** `atMs` relative to the first frame with a valid `at`. */
  elapsedMs?: number;
  /** The held time used by `elapsed` timing: `durationMs`, else the `at` gap to the next frame. */
  gapMs?: number;
  /** Indices of earlier frames this one names in `causes` (only valid, backward links). */
  causes: number[];
}

export interface ExposureNormalized {
  entries: ExposureEntry[];
  /** key → index */
  keyIndex: Map<string, number>;
  /** Distinct, human-readable problems with the input (dev errors). */
  issues: string[];
  /** True when at least one frame has a usable gap for the timing column. */
  hasTiming: boolean;
  /** Largest gap, for the log-scaled timing column (0 without timing data). */
  maxGapMs: number;
}

export const EXPOSURE_RATES: readonly ExposureRate[] = [0.5, 1, 2, 4];
export const EXPOSURE_TIMINGS: readonly ExposureTiming[] = ['even', 'elapsed', 'flipbook'];
/** Supported maximum. Above it a dev error is logged; rendering is unchanged. */
export const EXPOSURE_MAX_FRAMES = 5000;
export const EXPOSURE_DEFAULT_STEP_MS = 1000;
export const EXPOSURE_MIN_STEP_MS = 250;
export const EXPOSURE_ELAPSED_MIN_MS = 250;
export const EXPOSURE_ELAPSED_MAX_MS = 3000;
/** A keyboard scrub settles this long after the last key. */
export const EXPOSURE_SETTLE_MS = 500;
/** At most one announcement per this interval. */
export const EXPOSURE_ANNOUNCE_GAP_MS = 1000;

const STATUSES: readonly ExposureStatus[] = ['ok', 'warn', 'error', 'pending'];
export const EXPOSURE_STATUS_WORDS: Record<ExposureStatus, string> = {
  ok: 'ok',
  warn: 'warning',
  error: 'error',
  pending: 'pending',
};

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Applies the input contract. Pure and deterministic: array order is the truth. */
export function normalizeExposureFrames(frames: readonly ExposureFrame[]): ExposureNormalized {
  const issues: string[] = [];
  const list: readonly ExposureFrame[] = Array.isArray(frames) ? frames : [];
  if (!Array.isArray(frames)) issues.push('`frames` must be an array; rendering an empty sheet.');
  if (list.length > EXPOSURE_MAX_FRAMES) {
    issues.push(
      `${list.length} frames exceeds the supported maximum of ${EXPOSURE_MAX_FRAMES}; rendering is unchanged but performance is not guaranteed.`,
    );
  }
  const keyIndex = new Map<string, number>();
  const firstById = new Map<string, number>();
  // Every real id is reserved up front, so a generated key ("a#2") never takes an id that a
  // later frame really has.
  const realIds = new Set<string>();
  for (const f of list) if (typeof f?.id === 'string' && f.id.length > 0) realIds.add(f.id);
  const dupCount = new Map<string, number>();
  const entries: ExposureEntry[] = [];

  for (let i = 0; i < list.length; i++) {
    const f = (list[i] ?? {}) as ExposureFrame;
    let key: string;
    if (typeof f.id !== 'string' || f.id.length === 0) {
      key = `#${i}`;
      issues.push(`Frame at index ${i} has an empty or non-string id; keyed "${key}".`);
    } else if (firstById.has(f.id)) {
      let n = dupCount.get(f.id) ?? 1;
      do n++;
      while (realIds.has(`${f.id}#${n}`) || keyIndex.has(`${f.id}#${n}`));
      dupCount.set(f.id, n);
      key = `${f.id}#${n}`;
      issues.push(`Duplicate frame id "${f.id}" at index ${i}; keyed "${key}". \`value\` "${f.id}" targets the first.`);
    } else {
      key = f.id;
      firstById.set(f.id, i);
    }
    // A generated key could collide with a real id further on ("a#2" passed explicitly).
    while (keyIndex.has(key)) key = `${key}#${i}`;
    keyIndex.set(key, i);

    let hold = 1;
    if (f.hold !== undefined) {
      const raw = f.hold as unknown;
      const n = typeof raw === 'number' ? Math.round(raw) : NaN;
      hold = Number.isFinite(n) ? Math.min(12, Math.max(1, n)) : 1;
      if (raw !== hold) issues.push(`Frame "${key}" hold ${String(raw)} is outside 1–12 integers; using ${hold}.`);
    }

    let durationMs: number | undefined;
    if (f.durationMs !== undefined) {
      if (isFiniteNumber(f.durationMs) && f.durationMs >= 0) durationMs = f.durationMs;
      else issues.push(`Frame "${key}" durationMs ${String(f.durationMs)} is negative or not finite; ignored.`);
    }

    let atMs: number | undefined;
    if (f.at !== undefined) {
      const parsed = typeof f.at === 'string' ? Date.parse(f.at) : NaN;
      if (Number.isFinite(parsed)) atMs = parsed;
      else issues.push(`Frame "${key}" at "${String(f.at)}" is not a parseable ISO 8601 time; treated as missing.`);
    }

    let status: ExposureStatus | undefined;
    if (f.status !== undefined) {
      if (STATUSES.includes(f.status)) status = f.status;
      else issues.push(`Frame "${key}" status "${String(f.status)}" is not ok | warn | error | pending; ignored.`);
    }

    entries.push({
      key,
      index: i,
      source: f,
      label: typeof f.label === 'string' ? f.label : String(f.label ?? ''),
      detail: typeof f.detail === 'string' && f.detail.length > 0 ? f.detail : undefined,
      kind: typeof f.kind === 'string' && f.kind.length > 0 ? f.kind : undefined,
      status,
      marker: f.marker === true,
      hold,
      durationMs,
      atMs,
      causes: [],
    });
  }

  // Causes: only links to EARLIER frames survive (by id → its first occurrence).
  for (const e of entries) {
    const causes = e.source.causes;
    if (causes === undefined) continue;
    if (!Array.isArray(causes)) {
      issues.push(`Frame "${e.key}" causes must be an array of ids; ignored.`);
      continue;
    }
    const seen = new Set<number>();
    for (const c of causes) {
      // Real ids only (first occurrence): a generated key ("#3", "a#2") is never a cause.
      const target = typeof c === 'string' ? firstById.get(c) : undefined;
      if (target === undefined) {
        issues.push(`Frame "${e.key}" names unknown cause "${String(c)}"; link dropped.`);
      } else if (target === e.index) {
        issues.push(`Frame "${e.key}" names itself as a cause; link dropped.`);
      } else if (target > e.index) {
        issues.push(`Frame "${e.key}" names a later frame "${String(c)}" as a cause; causes only point backwards, link dropped.`);
      } else if (!seen.has(target)) {
        seen.add(target);
        e.causes.push(target);
      }
    }
  }

  // Elapsed time relative to the first frame with a valid `at`, and the gap each step held.
  const firstAt = entries.find((e) => e.atMs !== undefined)?.atMs;
  let maxGapMs = 0;
  let hasTiming = false;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e.atMs !== undefined && firstAt !== undefined) e.elapsedMs = e.atMs - firstAt;
    let gap = e.durationMs;
    if (gap === undefined && e.atMs !== undefined) {
      const next = entries[i + 1];
      if (next?.atMs !== undefined && next.atMs - e.atMs >= 0) gap = next.atMs - e.atMs;
    }
    if (gap !== undefined) {
      e.gapMs = gap;
      hasTiming = true;
      if (gap > maxGapMs) maxGapMs = gap;
    }
  }

  return { entries, keyIndex, issues, hasTiming, maxGapMs };
}

/** `stepMs` < 250 → 250; non-finite → the default. */
export function normalizeStepMs(stepMs: unknown): number {
  if (!isFiniteNumber(stepMs)) return EXPOSURE_DEFAULT_STEP_MS;
  return Math.max(EXPOSURE_MIN_STEP_MS, stepMs);
}

export function isExposureRate(v: unknown): v is ExposureRate {
  return v === 0.5 || v === 1 || v === 2 || v === 4;
}

/**
 * How long `entry` is shown during playback.
 * - even:     stepMs × hold ÷ rate
 * - elapsed:  clamp(gap, 250, 3000) ÷ rate; a missing gap falls back to `even`
 * - flipbook: FRAME_MS × hold ÷ rate (12 poses per second at 1×)
 */
export function exposureStepDuration(
  entry: Pick<ExposureEntry, 'hold' | 'gapMs'>,
  timing: ExposureTiming,
  rate: ExposureRate,
  stepMs: number,
): number {
  if (timing === 'flipbook') return (FRAME_MS * entry.hold) / rate;
  const even = (stepMs * entry.hold) / rate;
  if (timing === 'elapsed') {
    const g = entry.gapMs;
    if (g === undefined || !(g >= 0)) return even;
    return Math.min(EXPOSURE_ELAPSED_MAX_MS, Math.max(EXPOSURE_ELAPSED_MIN_MS, g)) / rate;
  }
  return even;
}

/** `F-01` … zero-padded to the digits of the total (minimum 2). */
export function formatFrameNumber(index: number, total: number): string {
  const width = Math.max(2, String(Math.max(1, total)).length);
  return `F-${String(index + 1).padStart(width, '0')}`;
}

/** `+mm:ss.s` (deterministic, locale-free). */
export function formatElapsed(ms: number): string {
  const sign = ms < 0 ? '-' : '+';
  const tenths = Math.floor(Math.abs(ms) / 100);
  const minutes = Math.floor(tenths / 600);
  const seconds = Math.floor((tenths % 600) / 10);
  const t = tenths % 10;
  return `${sign}${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${t}`;
}

/** `1.2s` / `340ms` (deterministic, locale-free). */
export function formatGap(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}s`;
}

/** "Frame 7 of 42: tool call write_file, error" */
export function describeExposureFrame(entry: ExposureEntry, total: number): string {
  const status = entry.status ? `, ${EXPOSURE_STATUS_WORDS[entry.status]}` : '';
  const marker = entry.marker ? ', marked' : '';
  return `Frame ${entry.index + 1} of ${total}: ${entry.label}${status}${marker}`;
}

/** True for targets where single-key shortcuts must never fire. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as Element).closest !== 'function') return false;
  const el = target as HTMLElement;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    // A range input is a playhead, not a text field: j/k/p still apply there.
    const type = (el as HTMLInputElement).type;
    return type !== 'range' && type !== 'radio' && type !== 'checkbox' && type !== 'button';
  }
  return el.closest('[contenteditable=""],[contenteditable="true"],[contenteditable="plaintext-only"]') !== null;
}

export interface UseExposureOptions {
  frames: readonly ExposureFrame[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (
    id: string,
    info: { index: number; reason: ExposureValueReason },
  ) => void;
  playing?: boolean;
  onPlayingChange?: (playing: boolean, reason: ExposurePlayingReason) => void;
  timing?: ExposureTiming;
  rate?: ExposureRate;
  defaultRate?: ExposureRate;
  onRateChange?: (rate: ExposureRate) => void;
  stepMs?: number;
  loop?: boolean;
  primaryMarker?: string;
  /** Prefix for dev errors. */
  name?: string;
}

export interface ExposureState {
  entries: readonly ExposureEntry[];
  count: number;
  /** Current index (-1 when there are no frames). */
  index: number;
  current: ExposureEntry | null;
  playing: boolean;
  /** The timing actually used (flipbook falls back to even when motion is unavailable). */
  timing: ExposureTiming;
  /** The timing the viewer (or the `timing` prop) asked for. */
  requestedTiming: ExposureTiming;
  setTiming: (timing: ExposureTiming) => void;
  /** False when the effective tempo is `still` (OS reduced motion, still tempo or ancestor). */
  flipbookAvailable: boolean;
  /** Playing in flipbook timing: the panel shows a slate instead of updating. */
  flipping: boolean;
  /** The index the panel shows: frozen at the flip's start while flipping. */
  panelIndex: number;
  rate: ExposureRate;
  setRate: (rate: ExposureRate) => void;
  /** Pointer drag in progress, or a keyboard scrub that has not settled yet. */
  scrubbing: boolean;
  /** Not scrubbing and not flipping. */
  settled: boolean;
  hasTiming: boolean;
  maxGapMs: number;
  /** Indices of marker frames, in order. */
  markers: readonly number[];
  /** Index of the marker that gets marker yellow (-1 without markers). */
  primaryMarkerIndex: number;
  /** One-level history: where "Back" returns to after following a cause. */
  back: ExposureEntry | null;
  /** Polite live-region text. */
  announcement: string;
  select: (index: number, reason: ExposureValueReason) => void;
  step: (delta: number, reason: ExposureValueReason) => void;
  /** `via: 'pointer'` (a click) announces at once instead of starting a keyboard scrub. */
  stepMarker: (direction: 1 | -1, via?: 'keyboard' | 'pointer') => void;
  followCause: (index: number) => void;
  goBack: () => void;
  play: () => void;
  pause: (reason: ExposurePlayingReason) => void;
  toggle: () => void;
  /** Call on pointer drag start / end. */
  beginPointerScrub: () => void;
  endPointerScrub: () => void;
  /** Call after a keyboard navigation (starts / restarts the 500 ms settle timer). */
  noteKeyScrub: () => void;
  /** Announce the (new) current frame once it has rendered: a click is already settled. */
  announceSettled: () => void;
  /** The single-key shortcuts (`j`/`k`/`[`/`]`/`p`). Returns true when the key was handled. */
  handleShortcut: (event: {
    key: string;
    target: EventTarget | null;
    ctrlKey?: boolean;
    metaKey?: boolean;
    altKey?: boolean;
  }) => boolean;
  /** Roving-row keys (`↑/↓/Home/End`): the index to move to, or null. */
  rowKeyTarget: (key: string, fromIndex: number) => number | null;
}

const useIsoLayoutEffect = typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;

const isDev = (): boolean => {
  try {
    return process.env.NODE_ENV !== 'production';
  } catch {
    return false;
  }
};

/** One dev-only console.error per distinct message per instance. */
function useDevErrors(name: string): (msg: string) => void {
  const seen = React.useRef<Set<string>>(new Set());
  return React.useCallback(
    (msg: string) => {
      if (!isDev() || seen.current.has(msg)) return;
      seen.current.add(msg);
      console.error(`[FRAME/12 ${name}] ${msg}`);
    },
    [name],
  );
}

function resolveIndex(
  requested: string | undefined,
  keyIndex: Map<string, number>,
  count: number,
  prev: { key: string; index: number } | null,
): number {
  if (count === 0) return -1;
  if (requested !== undefined) {
    const i = keyIndex.get(requested);
    if (i !== undefined) return i;
  }
  // The frame that was showing was removed: stay at its position (clamped).
  if (prev && requested === prev.key) return Math.min(prev.index, count - 1);
  return 0;
}

export function useExposure(options: UseExposureOptions): ExposureState {
  const {
    frames,
    value,
    defaultValue,
    onValueChange,
    playing: playingProp,
    onPlayingChange,
    timing: timingProp = 'even',
    rate: rateProp,
    defaultRate,
    onRateChange,
    stepMs: stepMsProp,
    loop = false,
    primaryMarker,
    name = 'useExposure',
  } = options;
  const devError = useDevErrors(name);

  // ------------------------------------------------------------------ input contract
  const normalized = React.useMemo(() => normalizeExposureFrames(frames), [frames]);
  const { entries, keyIndex } = normalized;
  const count = entries.length;
  const stepMs = normalizeStepMs(stepMsProp);

  React.useEffect(() => {
    for (const issue of normalized.issues) devError(issue);
  }, [normalized, devError]);
  React.useEffect(() => {
    if (stepMsProp === undefined) return;
    if (!isFiniteNumber(stepMsProp)) devError(`stepMs ${String(stepMsProp)} is not finite; using ${EXPOSURE_DEFAULT_STEP_MS}.`);
    else if (stepMsProp < EXPOSURE_MIN_STEP_MS) devError(`stepMs ${stepMsProp} is below ${EXPOSURE_MIN_STEP_MS}; clamped to ${EXPOSURE_MIN_STEP_MS}.`);
  }, [stepMsProp, devError]);

  // ------------------------------------------------------------------ controlled modes
  const valueControlled = React.useRef(value !== undefined).current;
  const playingControlled = React.useRef(playingProp !== undefined).current;
  const rateControlled = React.useRef(rateProp !== undefined).current;
  React.useEffect(() => {
    if ((value !== undefined) !== valueControlled) {
      devError(
        `\`value\` switched from ${valueControlled ? 'controlled to uncontrolled' : 'uncontrolled to controlled'}; the first mode wins. Keep \`value\` defined (controlled) or undefined (uncontrolled) for the lifetime of the component.`,
      );
    }
    if ((playingProp !== undefined) !== playingControlled) {
      devError(`\`playing\` switched between controlled and uncontrolled; the first mode wins.`);
    }
    if ((rateProp !== undefined) !== rateControlled) {
      devError(`\`rate\` switched between controlled and uncontrolled; the first mode wins.`);
    }
  }, [value, playingProp, rateProp, valueControlled, playingControlled, rateControlled, devError]);

  // ------------------------------------------------------------------ selection
  const [innerKey, setInnerKey] = React.useState<string | undefined>(defaultValue);
  const requested = valueControlled ? value : innerKey;
  const prevRef = React.useRef<{ key: string; index: number } | null>(null);
  const index = resolveIndex(requested, keyIndex, count, prevRef.current);
  const current = index >= 0 ? entries[index] : null;

  // ------------------------------------------------------------------ playing
  const [innerPlaying, setInnerPlaying] = React.useState(false);
  const rawPlaying = playingControlled ? playingProp === true : innerPlaying;
  const playing = rawPlaying && count > 1;

  // ------------------------------------------------------------------ rate & timing
  const [innerRate, setInnerRate] = React.useState<ExposureRate>(
    isExposureRate(defaultRate) ? defaultRate : 1,
  );
  const rawRate = rateControlled ? rateProp : innerRate;
  const rate: ExposureRate = isExposureRate(rawRate) ? rawRate : 1;
  React.useEffect(() => {
    if (rawRate !== undefined && !isExposureRate(rawRate)) devError(`rate ${String(rawRate)} is not 0.5 | 1 | 2 | 4; using 1.`);
    if (defaultRate !== undefined && !isExposureRate(defaultRate)) devError(`defaultRate ${String(defaultRate)} is not 0.5 | 1 | 2 | 4; using 1.`);
  }, [rawRate, defaultRate, devError]);

  const validTimingProp: ExposureTiming = EXPOSURE_TIMINGS.includes(timingProp) ? timingProp : 'even';
  const [timingState, setTimingState] = React.useState<{ prop: ExposureTiming; value: ExposureTiming }>(
    () => ({ prop: validTimingProp, value: validTimingProp }),
  );
  // A new `timing` prop value resets the viewer's choice (derived state, no effect round-trip).
  let requestedTiming = timingState.value;
  if (timingState.prop !== validTimingProp) {
    requestedTiming = validTimingProp;
    setTimingState({ prop: validTimingProp, value: validTimingProp });
  }
  React.useEffect(() => {
    if (!EXPOSURE_TIMINGS.includes(timingProp)) devError(`timing "${String(timingProp)}" is not even | elapsed | flipbook; using even.`);
  }, [timingProp, devError]);

  const { effectiveTempo } = useTempo();
  const flipbookAvailable = effectiveTempo !== 'still';
  const timing: ExposureTiming =
    requestedTiming === 'flipbook' && !flipbookAvailable ? 'even' : requestedTiming;
  const flipping = playing && timing === 'flipbook';

  // ------------------------------------------------------------------ markers
  const markers = React.useMemo(() => entries.filter((e) => e.marker).map((e) => e.index), [entries]);
  const primaryMarkerIndex = React.useMemo(() => {
    if (markers.length === 0) return -1;
    if (primaryMarker !== undefined) {
      const i = keyIndex.get(primaryMarker);
      if (i !== undefined && entries[i].marker) return i;
    }
    return markers[0];
  }, [markers, primaryMarker, keyIndex, entries]);
  React.useEffect(() => {
    if (!valueControlled && defaultValue !== undefined && count > 0 && !keyIndex.has(defaultValue)) {
      devError(`defaultValue "${defaultValue}" is not a frame id; showing the first frame.`);
    }
    // Initial value only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  React.useEffect(() => {
    if (primaryMarker === undefined) return;
    const i = keyIndex.get(primaryMarker);
    if (i === undefined || !entries[i].marker) {
      devError(`primaryMarker "${primaryMarker}" is not a marked frame; the first marker gets marker yellow.`);
    }
  }, [primaryMarker, keyIndex, entries, devError]);

  // ------------------------------------------------------------------ latest-value refs
  const latest = React.useRef({
    entries,
    index,
    count,
    playing,
    rawPlaying,
    loop,
    valueControlled,
    playingControlled,
    onValueChange,
    onPlayingChange,
    timing,
  });
  latest.current = {
    entries,
    index,
    count,
    playing,
    rawPlaying,
    loop,
    valueControlled,
    playingControlled,
    onValueChange,
    onPlayingChange,
    timing,
  };

  // ------------------------------------------------------------------ announcements
  const [announcement, setAnnouncement] = React.useState('');
  const announcer = React.useRef<{ lastAt: number; timer: ReturnType<typeof setTimeout> | null; pending: string | null; last: string }>(
    { lastAt: -Infinity, timer: null, pending: null, last: '' },
  );
  // Nothing announces after unmount (a queued microtask or timer may still fire once).
  const mounted = React.useRef(false);
  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const announce = React.useCallback((text: string) => {
    if (!mounted.current) return;
    const a = announcer.current;
    const emit = (t: string) => {
      // Identical consecutive text would not be re-read; alternate a trailing no-break space.
      const next = t === a.last.replace(/\u00a0$/, '') && !a.last.endsWith('\u00a0') ? `${t}\u00a0` : t;
      if (!mounted.current) return;
      a.last = next;
      a.lastAt = performance.now();
      setAnnouncement(next);
    };
    const now = performance.now();
    if (now - a.lastAt >= EXPOSURE_ANNOUNCE_GAP_MS && a.timer === null) {
      emit(text);
      return;
    }
    a.pending = text;
    if (a.timer === null) {
      a.timer = setTimeout(() => {
        a.timer = null;
        const p = a.pending;
        a.pending = null;
        if (p !== null) emit(p);
      }, Math.max(0, a.lastAt + EXPOSURE_ANNOUNCE_GAP_MS - now));
    }
  }, []);

  // ------------------------------------------------------------------ playing transitions
  const setPlaying = React.useCallback(
    (next: boolean, reason: ExposurePlayingReason, atIndex?: number) => {
      const l = latest.current;
      // Compare with the raw state: with fewer than 2 frames `playing` reads false while the
      // underlying state may still be on, and that must be switched off (never resume later).
      if (next === l.rawPlaying) return;
      // Reflect the request at once so a second call in the same tick is a no-op.
      l.rawPlaying = next;
      l.playing = next && l.count > 1;
      if (!l.playingControlled) setInnerPlaying(next);
      l.onPlayingChange?.(next, reason);
      if (next) {
        announce('Playing');
      } else {
        const i = atIndex ?? l.index;
        const where = `Paused at frame ${i + 1} of ${l.count}`;
        announce(
          reason === 'tempo'
            ? `${where}. Flipbook needs motion; reduced motion or a still tempo is on.`
            : where,
        );
      }
    },
    [announce],
  );
  const pause = React.useCallback((reason: ExposurePlayingReason) => setPlaying(false, reason), [setPlaying]);

  // ------------------------------------------------------------------ selection transitions
  const commit = React.useCallback((target: number, reason: ExposureValueReason) => {
    const l = latest.current;
    const entry = l.entries[target];
    if (!entry || target === l.index) return;
    if (!l.valueControlled) setInnerKey(entry.key);
    l.onValueChange?.(entry.key, { index: target, reason });
  }, []);

  const [pointerScrub, setPointerScrub] = React.useState(false);
  const [keyScrub, setKeyScrub] = React.useState(false);
  const settleTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const announceCurrent = React.useCallback(() => {
    const l = latest.current;
    const e = l.entries[l.index];
    if (e) announce(describeExposureFrame(e, l.count));
  }, [announce]);

  const select = React.useCallback(
    (target: number, reason: ExposureValueReason) => {
      const l = latest.current;
      if (l.count === 0) return;
      const t = Math.min(l.count - 1, Math.max(0, Math.round(target)));
      if (reason !== 'playback' && reason !== 'data' && l.playing) setPlaying(false, 'scrub');
      commit(t, reason);
    },
    [commit, setPlaying],
  );

  const noteKeyScrub = React.useCallback(() => {
    setKeyScrub(true);
    if (settleTimer.current !== null) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      settleTimer.current = null;
      setKeyScrub(false);
      announceCurrent();
    }, EXPOSURE_SETTLE_MS);
  }, [announceCurrent]);

  const settleAnnounceTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const announceSettled = React.useCallback(() => {
    // After React applies the selection (it commits before the next task). Tracked, so unmount
    // cancels it.
    if (settleAnnounceTimer.current !== null) clearTimeout(settleAnnounceTimer.current);
    settleAnnounceTimer.current = setTimeout(() => {
      settleAnnounceTimer.current = null;
      announceCurrent();
    }, 0);
  }, [announceCurrent]);

  const pointerScrubRef = React.useRef(false);
  const beginPointerScrub = React.useCallback(() => {
    if (pointerScrubRef.current) return;
    pointerScrubRef.current = true;
    setPointerScrub(true);
    if (latest.current.playing) setPlaying(false, 'scrub');
  }, [setPlaying]);
  const endPointerScrub = React.useCallback(() => {
    if (!pointerScrubRef.current) return;
    pointerScrubRef.current = false;
    setPointerScrub(false);
    // Read the frame after React has applied the last move.
    queueMicrotask(announceCurrent);
  }, [announceCurrent]);

  const step = React.useCallback(
    (delta: number, reason: ExposureValueReason) => {
      const l = latest.current;
      if (l.count === 0) return;
      select(Math.min(l.count - 1, Math.max(0, l.index + delta)), reason);
    },
    [select],
  );

  const stepMarker = React.useCallback(
    (direction: 1 | -1, via: 'keyboard' | 'pointer' = 'keyboard') => {
      const l = latest.current;
      let target = -1;
      for (const e of direction > 0 ? l.entries : [...l.entries].reverse()) {
        if (e.marker && (direction > 0 ? e.index > l.index : e.index < l.index)) {
          target = e.index;
          break;
        }
      }
      if (target >= 0) {
        select(target, 'marker');
        // A click is already settled; only key presses count as a scrub.
        if (via === 'keyboard') noteKeyScrub();
        else announceSettled();
      }
    },
    [select, noteKeyScrub, announceSettled],
  );

  const [back, setBack] = React.useState<{ key: string; index: number } | null>(null);
  const followCause = React.useCallback(
    (target: number) => {
      const l = latest.current;
      const from = l.entries[l.index];
      if (!from || !l.entries[target]) return;
      setBack({ key: from.key, index: from.index });
      select(target, 'cause');
      announce(describeExposureFrame(l.entries[target], l.count));
    },
    [select, announce],
  );
  const goBack = React.useCallback(() => {
    const l = latest.current;
    if (!back) return;
    const i = keyIndex.get(back.key);
    setBack(null);
    if (i === undefined) return;
    select(i, 'cause');
    const e = l.entries[i];
    if (e) announce(describeExposureFrame(e, l.count));
  }, [back, keyIndex, select, announce]);
  // "Back" exists only while its frame still exists and is not the frame being shown (a reader
  // who returns there another way no longer needs it). One rule for the button and goBack.
  const backIndex = back ? keyIndex.get(back.key) : undefined;
  const backEntry = backIndex !== undefined && backIndex !== index ? entries[backIndex] : null;
  React.useEffect(() => {
    if (back && (backIndex === undefined || backIndex === index)) setBack(null);
  }, [back, backIndex, index]);

  // ------------------------------------------------------------------ play / pause
  const clock = React.useRef<{ deadline: number; pending: string | null }>({ deadline: 0, pending: null });
  const [flipAnchor, setFlipAnchor] = React.useState(-1);
  const play = React.useCallback(() => {
    const l = latest.current;
    if (l.count < 2 || l.playing) return;
    // Play at the end restarts from the first frame.
    if (l.index >= l.count - 1) commit(0, 'playback');
    setPlaying(true, 'user');
  }, [commit, setPlaying]);
  const toggle = React.useCallback(() => {
    if (latest.current.playing) pause('user');
    else play();
  }, [play, pause]);

  // ------------------------------------------------------------------ data changes
  const lastDataFire = React.useRef<string | null>(null);
  useIsoLayoutEffect(() => {
    const l = latest.current;
    // Too few frames to play (shrunk by data): stop, so growing back never resumes on its own.
    if (l.rawPlaying && count < 2) setPlaying(false, 'data', Math.max(0, index));
    if (!current) return;
    const prev = prevRef.current;
    if (requested !== current.key) {
      const removed = prev !== null && requested === prev.key && !keyIndex.has(prev.key);
      if (!valueControlled) setInnerKey(current.key);
      const sig = `${String(requested)}→${current.key}`;
      const fire = valueControlled ? lastDataFire.current !== sig : removed;
      if (fire) {
        lastDataFire.current = sig;
        onValueChange?.(current.key, { index, reason: 'data' });
      }
      if (removed && l.playing) setPlaying(false, 'data', index);
      // Controlled: until the parent applies the survivor, keep resolving the removed id to the
      // same position (instead of falling back to the first frame and firing again).
      if (valueControlled && requested !== undefined && prev !== null && requested === prev.key) {
        prevRef.current = { key: requested, index };
        return;
      }
    } else {
      lastDataFire.current = null;
    }
    prevRef.current = { key: current.key, index };
  });

  // ------------------------------------------------------------------ the clock
  // Whenever playback starts (play(), or a controlled `playing` the parent turned on), the first
  // deadline is measured from now.
  React.useEffect(() => {
    if (!playing) return;
    clock.current = { deadline: performance.now(), pending: null };
    setFlipAnchor(latest.current.index);
  }, [playing]);
  const currentKey = current?.key;
  const stepDuration = current ? exposureStepDuration(current, timing, rate, stepMs) : 0;
  React.useEffect(() => {
    if (!playing || currentKey === undefined) return;
    const c = clock.current;
    if (c.pending !== null && c.pending === currentKey) c.pending = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = (dur: number) => {
      const now = performance.now();
      let deadline = c.deadline + dur;
      // After a stall (a long task, a throttled tab), rebase instead of catching up.
      if (deadline < now) deadline = now;
      timer = setTimeout(() => tick(deadline), Math.max(0, deadline - now));
    };
    const tick = (deadline: number) => {
      timer = null;
      const l = latest.current;
      c.deadline = deadline;
      if (c.pending !== null && l.entries[l.index]?.key === c.pending) c.pending = null; // applied; effect not re-run yet
      if (c.pending !== null) {
        // The controlled parent did not apply the previous advance by this deadline.
        c.pending = null;
        setPlaying(false, 'rejected');
        return;
      }
      let target = l.index + 1;
      if (target >= l.count) {
        if (!l.loop) {
          setPlaying(false, 'end');
          return;
        }
        target = 0;
      }
      const t = l.entries[target];
      if (!t) return;
      c.pending = t.key;
      commit(target, 'playback');
      // Never more than one frame per tick: the next tick is the check (or the next advance if
      // this component re-renders first, which cancels this timer).
      schedule(exposureStepDuration(t, l.timing, rate, stepMs));
    };
    schedule(stepDuration);
    return () => {
      if (timer !== null) clearTimeout(timer);
    };
  }, [playing, currentKey, stepDuration, rate, stepMs, commit, setPlaying]);

  // Hidden tab pauses; no auto-resume. Listener only exists while playing.
  React.useEffect(() => {
    if (!playing || typeof document === 'undefined') return;
    const onVis = () => {
      if (document.hidden) setPlaying(false, 'hidden');
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [playing, setPlaying]);

  // A flipbook in progress pauses when motion becomes unavailable.
  // Only on the transition (available → unavailable): with flipbook selected under a still tempo,
  // Play still plays (in even timing) instead of pausing at once.
  const wasAvailable = React.useRef(flipbookAvailable);
  React.useEffect(() => {
    const was = wasAvailable.current;
    wasAvailable.current = flipbookAvailable;
    if (was && !flipbookAvailable && latest.current.playing && requestedTiming === 'flipbook') setPlaying(false, 'tempo');
  }, [flipbookAvailable, requestedTiming, setPlaying]);

  // Unmount: cancel every timer.
  React.useEffect(
    () => () => {
      if (settleTimer.current !== null) clearTimeout(settleTimer.current);
      if (settleAnnounceTimer.current !== null) clearTimeout(settleAnnounceTimer.current);
      if (announcer.current.timer !== null) clearTimeout(announcer.current.timer);
      settleTimer.current = null;
      settleAnnounceTimer.current = null;
      announcer.current.timer = null;
    },
    [],
  );

  const setRate = React.useCallback(
    (r: ExposureRate) => {
      if (!isExposureRate(r)) return;
      if (!rateControlled) setInnerRate(r);
      onRateChange?.(r);
    },
    [rateControlled, onRateChange],
  );
  const setTiming = React.useCallback(
    (t: ExposureTiming) => {
      if (!EXPOSURE_TIMINGS.includes(t)) return;
      if (t === 'flipbook' && !flipbookAvailable) return;
      if (t === 'flipbook' && latest.current.playing) setFlipAnchor(latest.current.index);
      setTimingState((s) => ({ ...s, value: t }));
    },
    [flipbookAvailable],
  );

  const handleShortcut = React.useCallback<ExposureState['handleShortcut']>(
    (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return false;
      if (isEditableTarget(e.target)) return false;
      switch (e.key) {
        case 'j':
          step(1, 'keyboard');
          noteKeyScrub();
          return true;
        case 'k':
          step(-1, 'keyboard');
          noteKeyScrub();
          return true;
        case ']':
          stepMarker(1);
          return true;
        case '[':
          stepMarker(-1);
          return true;
        case 'p':
          toggle();
          return true;
        default:
          return false;
      }
    },
    [step, stepMarker, toggle, noteKeyScrub],
  );

  const rowKeyTarget = React.useCallback((key: string, from: number): number | null => {
    const n = latest.current.count;
    if (n === 0) return null;
    if (key === 'ArrowDown') return Math.min(n - 1, from + 1);
    if (key === 'ArrowUp') return Math.max(0, from - 1);
    if (key === 'Home') return 0;
    if (key === 'End') return n - 1;
    return null;
  }, []);

  const scrubbing = pointerScrub || keyScrub;
  const panelIndex = flipping ? (flipAnchor >= 0 && flipAnchor < count ? flipAnchor : index) : index;

  return {
    entries,
    count,
    index,
    current,
    playing,
    timing,
    requestedTiming,
    setTiming,
    flipbookAvailable,
    flipping,
    panelIndex,
    rate,
    setRate,
    scrubbing,
    settled: !scrubbing && !flipping,
    hasTiming: normalized.hasTiming,
    maxGapMs: normalized.maxGapMs,
    markers,
    primaryMarkerIndex,
    back: backEntry,
    announcement,
    select,
    step,
    stepMarker,
    followCause,
    goBack,
    play,
    pause,
    toggle,
    beginPointerScrub,
    endPointerScrub,
    noteKeyScrub,
    announceSettled,
    handleShortcut,
    rowKeyTarget,
  };
}
