'use client';

import * as React from 'react';
import { flushSync } from 'react-dom';
import { useResolvedMotion } from '@/hooks/use-tempo';
import { useChanged } from '@/hooks/use-on-twos';
import {
  EXPOSURE_RATES,
  EXPOSURE_STATUS_WORDS,
  describeExposureFrame,
  formatElapsed,
  formatFrameNumber,
  formatGap,
  useExposure,
  type ExposureEntry,
  type ExposureFrame,
  type ExposurePlayingReason,
  type ExposureRate,
  type ExposureStatus,
  type ExposureTiming,
  type ExposureValueReason,
} from '@/hooks/use-exposure';
import { Panel } from './panel';
import { SegmentedControl } from './segmented-control';

export type {
  ExposureFrame,
  ExposureStatus,
  ExposureTiming,
  ExposureRate,
  ExposureValueReason,
  ExposurePlayingReason,
};
export type ExposureScrubberDensity = 'comfortable' | 'compact';
export type ExposureScrubberVariant = 'expressive' | 'quiet';

export interface ExposureScrubberProps {
  frames: readonly ExposureFrame[];
  label: string;
  renderFrame: (frame: ExposureFrame, index: number, ctx: { scrubbing: boolean; settled: boolean }) => React.ReactNode;
  value?: string;
  defaultValue?: string;
  onValueChange?: (id: string, info: { index: number; reason: 'keyboard' | 'pointer' | 'row' | 'marker' | 'cause' | 'playback' | 'data' }) => void;
  playing?: boolean;
  onPlayingChange?: (playing: boolean, reason: 'user' | 'end' | 'scrub' | 'hidden' | 'data' | 'tempo' | 'rejected') => void;
  timing?: 'even' | 'elapsed' | 'flipbook';
  rate?: 0.5 | 1 | 2 | 4;
  defaultRate?: 0.5 | 1 | 2 | 4;
  onRateChange?: (r: 0.5 | 1 | 2 | 4) => void;
  stepMs?: number;
  loop?: boolean;
  primaryMarker?: string;
  emptyState?: React.ReactNode;
  idPrefix?: string;
  density?: 'comfortable' | 'compact';
  variant?: 'expressive' | 'quiet';
  className?: string;
}

const TIMING_OPTIONS: ReadonlyArray<{ value: ExposureTiming; label: string; unit: string; meaning: string }> = [
  { value: 'even', label: 'EVEN', unit: 'read', meaning: 'one readable step per frame' },
  { value: 'elapsed', label: 'REAL', unit: 'rhythm', meaning: "the run's real rhythm" },
  { value: 'flipbook', label: 'FLIP', unit: '12/s', meaning: 'flipbook, 12 poses per second' },
];

const RATE_OPTIONS = EXPOSURE_RATES.map((r) => ({ value: r, label: `${r}×` }));

/** Shows "This frame couldn't be rendered" instead of a consumer `renderFrame` that throws. */
class FrameBoundary extends React.Component<
  { frameId: string; children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) {
      return (
        <p className="f12-xs-error" role="note">
          This frame couldn&apos;t be rendered <span className="f12-xs-mono">({this.props.frameId})</span>
        </p>
      );
    }
    return this.props.children;
  }
}

/** Calls `renderFrame` inside the boundary (so a throw is caught there, not in the scrubber). */
function FrameSlot({
  render,
  frame,
  index,
  scrubbing,
  settled,
}: {
  render: ExposureScrubberProps['renderFrame'];
  frame: ExposureFrame;
  index: number;
  scrubbing: boolean;
  settled: boolean;
}) {
  return <>{render(frame, index, { scrubbing, settled })}</>;
}

/** The TIMING cell: hold ticks (even) or a log-scaled screentone bar (drawn by CSS ::before). */
function timingCell(entry: ExposureEntry, timing: ExposureTiming, maxGapMs: number): { style?: React.CSSProperties; text: string } {
  if (timing === 'even') return { style: { '--xs-h': entry.hold } as React.CSSProperties, text: `×${entry.hold}` };
  if (entry.gapMs === undefined || maxGapMs <= 0) return { text: '' };
  const w = Math.max(4, Math.round((Math.log1p(entry.gapMs) / Math.log1p(maxGapMs)) * 100));
  return { style: { '--xs-w': `${w}%` } as React.CSSProperties, text: formatGap(entry.gapMs) };
}

/** Status as a word; its glyph is CSS generated content with empty alt text (never color alone). */
function StatusWord({ status }: { status: ExposureStatus }) {
  return (
    <span className="f12-xs-st" data-s={status}>
      {EXPOSURE_STATUS_WORDS[status]}
    </span>
  );
}

interface RowProps {
  entry: ExposureEntry;
  total: number;
  current: boolean;
  primary: boolean;
  timing: ExposureTiming;
  maxGapMs: number;
  causeLabel: string | null;
}

/** One X-sheet row. Memoized and keyed by id: a frame change re-renders two rows. */
const ExposureRow = React.memo(function ExposureRow({
  entry,
  total,
  current,
  primary,
  timing,
  maxGapMs,
  causeLabel,
}: RowProps) {
  // Lean markup (≤ 400 bytes per row): cells are styled by position, not class.
  const t = timingCell(entry, timing, maxGapMs);
  return (
    <tr role="row" className="f12-xs-row" aria-current={current ? 'step' : undefined}>
      <td role="cell" className="f12-xs-f">
        <span className="f12-xs-fn">{formatFrameNumber(entry.index, total)}</span>
        {entry.elapsedMs !== undefined && <span>{formatElapsed(entry.elapsedMs)}</span>}
      </td>
      <td role="cell">
        <button
          type="button"
          className="f12-xs-btn"
          tabIndex={current ? 0 : -1}
          aria-current={current ? 'step' : undefined}
          data-i={entry.index}
        >
          {entry.label}
        </button>
        {entry.kind && <span className="f12-xs-k">{entry.kind}</span>}
        {entry.detail && <span className="f12-xs-d">{entry.detail}</span>}
      </td>
      <td role="cell" style={t.style}>
        {t.text}
      </td>
      <td role="cell">
        {entry.status && <StatusWord status={entry.status} />}
        {entry.marker && (
          <span className={primary ? 'f12-xs-mk f12-xs-mk-primary' : 'f12-xs-mk'}>
            <span aria-hidden="true">{primary ? '◆ ' : '◇ '}</span>
            {primary ? 'MARK' : 'mark'}
          </span>
        )}
        {causeLabel && (
          <span className="f12-xs-from">
            <span aria-hidden="true">↖ </span>
            <span className="f12-sr-only">led here from </span>
            {causeLabel}
          </span>
        )}
      </td>
    </tr>
  );
});

/** Rows per memoized chunk: a frame change reconciles at most two chunks, not the whole sheet. */
const CHUNK = 64;

interface ChunkProps {
  rows: readonly ExposureEntry[];
  total: number;
  /** The current index if it falls in this chunk, else -1 (so other chunks skip re-rendering). */
  current: number;
  primary: number;
  timing: ExposureTiming;
  maxGapMs: number;
}

const causeLabelOf = (entry: ExposureEntry, total: number): string | null => {
  if (entry.causes.length === 0) return null;
  const first = formatFrameNumber(entry.causes[0], total);
  return entry.causes.length > 1 ? `${first} +${entry.causes.length - 1}` : first;
};

/** A run of rows rendered as a fragment (no wrapper element: the table DOM is unchanged). */
const ExposureRowChunk = React.memo(function ExposureRowChunk({ rows, total, current, primary, timing, maxGapMs }: ChunkProps) {
  return (
    <>
      {rows.map((entry) => (
        <ExposureRow
          key={entry.key}
          entry={entry}
          total={total}
          current={entry.index === current}
          primary={entry.index === primary}
          timing={timing}
          maxGapMs={maxGapMs}
          causeLabel={causeLabelOf(entry, total)}
        />
      ))}
    </>
  );
});

/**
 * ExposureScrubber: reads a discrete history (an agent run, a CI pipeline, an incident) like an
 * animator's exposure sheet. A semantic X-sheet table (FRAME · ACTION · TIMING · MARK), a detail
 * panel for the current frame, and a native-range transport with three timing modes. Never
 * autoplays. Built on `useExposure`.
 */
export function ExposureScrubber({
  frames,
  label,
  renderFrame,
  value,
  defaultValue,
  onValueChange,
  playing,
  onPlayingChange,
  timing = 'even',
  rate,
  defaultRate,
  onRateChange,
  stepMs = 1000,
  loop = false,
  primaryMarker,
  emptyState,
  idPrefix,
  density = 'comfortable',
  variant = 'expressive',
  className = '',
}: ExposureScrubberProps) {
  const autoId = React.useId().replace(/:/g, '');
  const prefix = idPrefix ?? `f12-xs-${autoId}`;
  const ex = useExposure({
    frames,
    value,
    defaultValue,
    onValueChange,
    playing,
    onPlayingChange,
    timing,
    rate,
    defaultRate,
    onRateChange,
    stepMs,
    loop,
    primaryMarker,
    name: 'ExposureScrubber',
  });
  // Motion governs transitions only (row highlight, panel swap), never reading speed.
  const motion = useResolvedMotion('stepped');

  // Server render and first client render are identical (transport disabled with a note);
  // the transport comes alive after hydration.
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => setHydrated(true), []);

  const tbodyRef = React.useRef<HTMLTableSectionElement | null>(null);
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(true);

  const { count, index, entries } = ex;
  const chunks = React.useMemo(() => {
    const out: ExposureEntry[][] = [];
    for (let i = 0; i < entries.length; i += CHUNK) out.push(entries.slice(i, i + CHUNK));
    return out;
  }, [entries]);
  const n = count;
  const panelEntry = ex.panelIndex >= 0 ? entries[ex.panelIndex] : null;
  // The panel swap animates only after the first change: nothing moves on first paint.
  const swapped = useChanged(panelEntry?.key);
  const ready = hydrated && n > 0;
  const multi = ready && n > 1;
  const frameWord = n === 1 ? 'frame' : 'frames';

  // Keep the current row inside the sheet's own scroll box (never scrolls the page, never moves
  // focus). While flipping, page by whole screens so the sheet does not crawl.
  React.useEffect(() => {
    const box = scrollRef.current;
    if (!box || ex.scrubbing) return;
    const flipping = ex.flipping;
    // Off-screen rows use content-visibility placeholder heights; once rows near the target
    // render, real heights shift it. Re-check for a few frames (then stop: nothing runs idle).
    let raf = 0;
    let tries = 0;
    const fit = () => {
      const row = tbodyRef.current?.rows[index];
      if (!row) return;
      const head = box.querySelector('thead')?.getBoundingClientRect().height ?? 0;
      const r = row.getBoundingClientRect();
      const top = r.top - box.getBoundingClientRect().top + box.scrollTop;
      const bottom = top + r.height;
      let next = box.scrollTop;
      if (top - head < box.scrollTop) next = Math.max(0, top - head);
      else if (bottom > box.scrollTop + box.clientHeight) next = flipping ? top - head : bottom - box.clientHeight;
      if (Math.abs(next - box.scrollTop) >= 1) box.scrollTop = next;
      // rAF runs before the frame renders newly relevant rows, so keep checking a few frames.
      if (++tries < 6) raf = requestAnimationFrame(fit);
    };
    fit();
    return () => cancelAnimationFrame(raf);
  }, [index, ex.flipping, ex.scrubbing]);

  // ------------------------------------------------------------------ pointer drag (FRAME column)
  const dragRef = React.useRef<{ id: number } | null>(null);
  const indexAtY = (y: number): number => {
    const rows = tbodyRef.current?.rows;
    if (!rows || rows.length === 0) return -1;
    if (y < rows[0].getBoundingClientRect().top) return 0;
    let lo = 0;
    let hi = rows.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (rows[mid].getBoundingClientRect().top <= y) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };
  const endDrag = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    ex.endPointerScrub();
  };

  const onBodyPointerDown = (e: React.PointerEvent<HTMLTableSectionElement>) => {
    if (!ready || e.button !== 0) return;
    const cell = (e.target as Element).closest('.f12-xs-f');
    if (!cell) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* capture is best-effort */
    }
    dragRef.current = { id: e.pointerId };
    ex.beginPointerScrub();
    const i = indexAtY(e.clientY);
    if (i >= 0) ex.select(i, 'pointer');
  };
  const onBodyPointerMove = (e: React.PointerEvent<HTMLTableSectionElement>) => {
    if (!dragRef.current || dragRef.current.id !== e.pointerId) return;
    const i = indexAtY(e.clientY);
    // Immediate: the frame changes in the same task as the input event.
    if (i >= 0) flushSync(() => ex.select(i, 'pointer'));
  };

  const onBodyClick = (e: React.MouseEvent<HTMLTableSectionElement>) => {
    const btn = (e.target as Element).closest<HTMLButtonElement>('.f12-xs-btn');
    if (!btn || !ready) return;
    const i = Number(btn.dataset.i);
    // A click that follows a key (Enter/Space) is a keyboard selection.
    ex.select(i, e.detail === 0 ? 'keyboard' : 'row');
    ex.announceSettled();
  };
  const onBodyKeyDown = (e: React.KeyboardEvent<HTMLTableSectionElement>) => {
    if (!ready || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const btn = (e.target as Element).closest<HTMLButtonElement>('.f12-xs-btn');
    if (!btn) return;
    // From the live current frame (j/k or playback may have moved it away from the focused row).
    const target = ex.rowKeyTarget(e.key, index);
    if (target === null) return;
    e.preventDefault();
    ex.select(target, 'keyboard');
    ex.noteKeyScrub();
    tbodyRef.current?.rows[target]?.querySelector<HTMLButtonElement>('.f12-xs-btn')?.focus();
  };

  // ------------------------------------------------------------------ range
  const rangePointer = React.useRef(false);
  const onRangeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.currentTarget.value) - 1;
    if (rangePointer.current) {
      ex.select(v, 'pointer');
      return;
    }
    // Keys move relative to the live playhead (while flipping, the range shows the frozen
    // start frame, so an absolute value would jump back to it).
    ex.select(index + (v - displayIndex), 'keyboard');
    ex.noteKeyScrub();
  };
  // Native ranges page by 10% of the range in some engines; the contract is ±10 frames.
  const onRangeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    // Home/End are absolute (also while flipping, when the range shows the frozen start frame).
    if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      ex.select(e.key === 'Home' ? 0 : n - 1, 'keyboard');
      ex.noteKeyScrub();
      return;
    }
    if (e.key !== 'PageUp' && e.key !== 'PageDown') return;
    e.preventDefault();
    ex.step(e.key === 'PageUp' ? 10 : -10, 'keyboard');
    ex.noteKeyScrub();
  };
  const onRangePointerDown = (e: React.PointerEvent<HTMLInputElement>) => {
    if (e.button !== 0) return;
    rangePointer.current = true;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* capture is best-effort */
    }
    ex.beginPointerScrub();
  };
  const onRangePointerEnd = () => {
    if (!rangePointer.current) return;
    rangePointer.current = false;
    ex.endPointerScrub();
  };

  // ------------------------------------------------------------------ transport steps
  // Step buttons stay focusable at the ends (aria-disabled, not disabled), so focus is never
  // dropped to <body> when a press reaches the first or last frame.
  const stepBy = (delta: number, e: React.MouseEvent<HTMLButtonElement>) => {
    if (e.currentTarget.getAttribute('aria-disabled') === 'true') return;
    const keyboard = e.detail === 0;
    ex.step(delta, keyboard ? 'keyboard' : 'pointer');
    if (keyboard) ex.noteKeyScrub();
    else ex.announceSettled();
  };
  const contentKeys = React.useRef<WeakSet<Event>>(new WeakSet());
  // After following a cause (or going back) the activated button unmounts with the old panel;
  // move focus to the new frame's title instead of losing it.
  const focusTitle = React.useRef(false);
  React.useEffect(() => {
    if (!focusTitle.current) return;
    focusTitle.current = false;
    document.getElementById(`${prefix}-title`)?.focus();
  }, [ex.panelIndex, prefix]);

  // ------------------------------------------------------------------ shortcuts (scoped)
  const onRootKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!ready || e.defaultPrevented) return;
    // Keys from consumer content never reach the shortcuts, including content portalled out of
    // the DOM subtree (React events still bubble through the portal to here).
    if (contentKeys.current.has(e.nativeEvent)) return;
    if (!(e.currentTarget as Node).contains(e.target as Node)) return;
    if ((e.target as Element).closest('[data-exposure-content]')) return;
    if (ex.handleShortcut(e)) e.preventDefault();
  };

  const displayIndex = ex.flipping ? ex.panelIndex : index;
  const displayEntry = displayIndex >= 0 ? entries[displayIndex] : null;
  const frameNo = (i: number) => formatFrameNumber(i, n);
  const timingHeader =
    ex.timing === 'even' ? 'hold ×1–12' : ex.hasTiming ? `log · max ${formatGap(ex.maxGapMs)}` : 'no timing data';

  const transportNote = !hydrated
    ? 'Replay needs JavaScript'
    : n === 0
      ? 'Nothing to replay: there are no frames.'
      : !ex.flipbookAvailable
        ? 'Flipbook needs motion: reduced motion or a still tempo is on.'
        : null;
  const noteId = `${prefix}-note`;

  const rootClass = [
    'f12-xs',
    `f12-m-${motion}`,
    density === 'compact' ? 'f12-xs-compact' : '',
    variant === 'quiet' ? 'f12-xs-quiet' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={rootClass}
      id={prefix}
      data-density={density}
      data-variant={variant}
      data-timing={ex.timing}
      data-playing={ex.playing ? 'true' : undefined}
      data-flipping={ex.flipping ? 'true' : undefined}
      onKeyDown={onRootKeyDown}
    >
      <div className="f12-xs-grid">
        {/* 1 · Transport (first in tab order) */}
        <fieldset className="f12-xs-transport" disabled={!ready} aria-describedby={transportNote ? noteId : undefined}>
          <legend className="f12-sr-only">{`${label}: replay controls`}</legend>
          <div className="f12-xs-tr-row">
            <button
              type="button"
              className="f12-xs-tbtn"
              id={`${prefix}-prev`}
              aria-disabled={!multi || index <= 0}
              onClick={(e) => stepBy(-1, e)}
            >
              <span aria-hidden="true">‹ </span>Prev
            </button>
            <button
              type="button"
              className="f12-xs-tbtn f12-xs-play"
              id={`${prefix}-play`}
              aria-pressed={ex.playing}
              disabled={!multi}
              onClick={ex.toggle}
            >
              <span className="f12-xs-play-glyph" aria-hidden="true">
                {ex.playing ? '❚❚' : '▶'}
              </span>
              Play
            </button>
            <button
              type="button"
              className="f12-xs-tbtn"
              id={`${prefix}-next`}
              aria-disabled={!multi || index >= n - 1}
              onClick={(e) => stepBy(1, e)}
            >
              Next<span aria-hidden="true"> ›</span>
            </button>
            {n > 1 ? (
              <input
                type="range"
                className="f12-xs-range"
                id={`${prefix}-range`}
                min={1}
                max={n}
                step={1}
                value={displayIndex + 1}
                aria-label="Playhead"
                aria-valuetext={displayEntry ? describeExposureFrame(displayEntry, n) : undefined}
                onChange={onRangeChange}
                onKeyDown={onRangeKeyDown}
                onPointerDown={onRangePointerDown}
                onPointerUp={onRangePointerEnd}
                onPointerCancel={onRangePointerEnd}
                onLostPointerCapture={onRangePointerEnd}
              />
            ) : (
              <span className="f12-xs-one">{n === 1 ? '1 frame' : '0 frames'}</span>
            )}
            <span className="f12-xs-count" aria-hidden="true">
              {n > 0 ? `${displayIndex + 1} / ${n}` : '0 / 0'}
            </span>
          </div>
          <div className="f12-xs-tr-row">
            <button
              type="button"
              className="f12-xs-tbtn"
              id={`${prefix}-prev-mark`}
              aria-disabled={!multi || !ex.markers.some((m) => m < index)}
              onClick={() => ex.stepMarker(-1)}
            >
              <span aria-hidden="true">‹◆ </span>Prev mark
            </button>
            <button
              type="button"
              className="f12-xs-tbtn"
              id={`${prefix}-next-mark`}
              aria-disabled={!multi || !ex.markers.some((m) => m > index)}
              onClick={() => ex.stepMarker(1)}
            >
              Next mark<span aria-hidden="true"> ◆›</span>
            </button>
            <SegmentedControl
              options={RATE_OPTIONS}
              value={ex.rate}
              onChange={(r) => ex.setRate(r as ExposureRate)}
              ariaLabel="Playback rate"
              idPrefix={`${prefix}-rate`}
              className="f12-xs-rate"
            />
            <fieldset className="f12-tempo f12-xs-timing" disabled={!multi}>
              <legend className="f12-sr-only">Timing</legend>
              <div className="f12-rng f12-tempo-rng">
                {TIMING_OPTIONS.map((opt) => {
                  const id = `${prefix}-timing-${opt.value}`;
                  const unavailable = opt.value === 'flipbook' && !ex.flipbookAvailable;
                  return (
                    <label key={opt.value} className="f12-rng-btn f12-tempo-opt" htmlFor={id} data-unavailable={unavailable ? 'true' : undefined}>
                      <input
                        id={id}
                        className="f12-tempo-input"
                        type="radio"
                        name={`${prefix}-timing`}
                        value={opt.value}
                        checked={ex.requestedTiming === opt.value}
                        disabled={unavailable}
                        aria-describedby={unavailable ? noteId : undefined}
                        onChange={() => ex.setTiming(opt.value)}
                      />
                      <span className="f12-rng-n" aria-hidden="true">
                        {opt.label}
                      </span>
                      <span className="f12-rng-u" aria-hidden="true">
                        {opt.unit}
                      </span>
                      <span className="f12-sr-only">{`${opt.label} ${opt.unit}, ${opt.meaning}`}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </div>
          {transportNote && (
            <p className="f12-xs-note" id={noteId}>
              {transportNote}
            </p>
          )}
        </fieldset>

        {/* 2 · The exposure sheet (one roving tab stop) */}
        {n > 0 && (
          <details
            className="f12-xs-disc"
            open={sheetOpen}
            onToggle={(e) => setSheetOpen(e.currentTarget.open)}
          >
            <summary className="f12-xs-sum">{`Exposure sheet · ${n} ${frameWord}`}</summary>
            <div className="f12-xs-scroll" ref={scrollRef}>
              <table role="table" className="f12-xs-sheet">
                <caption className="f12-xs-cap">{`${label} · ${n} ${frameWord}`}</caption>
                <thead role="rowgroup">
                  <tr role="row" className="f12-xs-hrow">
                    <th role="columnheader" scope="col">FRAME</th>
                    <th role="columnheader" scope="col">ACTION</th>
                    <th role="columnheader" scope="col">
                      TIMING <span className="f12-xs-sc">{timingHeader}</span>
                    </th>
                    <th role="columnheader" scope="col">MARK</th>
                  </tr>
                </thead>
                <tbody
                  role="rowgroup"
                  ref={tbodyRef}
                  onClick={onBodyClick}
                  onKeyDown={onBodyKeyDown}
                  onPointerDown={onBodyPointerDown}
                  onPointerMove={onBodyPointerMove}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  onLostPointerCapture={endDrag}
                >
                  {chunks.map((rows) => {
                    const start = rows[0].index;
                    const end = start + rows.length;
                    return (
                      <ExposureRowChunk
                        key={start}
                        rows={rows}
                        total={n}
                        current={index >= start && index < end ? index : -1}
                        primary={ex.primaryMarkerIndex >= start && ex.primaryMarkerIndex < end ? ex.primaryMarkerIndex : -1}
                        timing={ex.timing}
                        maxGapMs={ex.maxGapMs}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          </details>
        )}

        {/* 3 · The detail panel */}
        <Panel
          className="f12-xs-panel"
          label={`${label}: current frame`}
          variant={variant}
          cut={false}
        >
          <span className="f12-cut f12-xs-cut" aria-hidden="true">
            {ex.flipping ? 'CURRENT CUT / FLIPPING' : panelEntry ? `CURRENT CUT / ${frameNo(panelEntry.index)}` : 'CURRENT CUT / —'}
          </span>
          {n === 0 ? (
            <div className="f12-xs-empty">
              {emptyState ?? (
                <p className="f12-xs-empty-msg">
                  <span className="f12-xs-mono" aria-hidden="true">[ ∅ ] </span>
                  No frames yet. A run with steps will appear here as an exposure sheet.
                </p>
              )}
            </div>
          ) : ex.flipping ? (
            <div className="f12-xs-slate">
              <p className="f12-xs-slate-t">FLIPPING</p>
              <p className="f12-xs-slate-s">
                12 poses per second{ex.rate !== 1 ? ` × ${ex.rate}` : ''}. Watch the sheet&apos;s rhythm; pause to read a frame.
              </p>
            </div>
          ) : panelEntry ? (
            <div className="f12-xs-body" key={panelEntry.key} data-swap={swapped ? 'true' : undefined}>
              <div className="f12-xs-head">
                <p className="f12-xs-pos">
                  <span className="f12-xs-pnum">{frameNo(panelEntry.index)}</span>
                  {panelEntry.elapsedMs !== undefined && (
                    <span className="f12-xs-pel">{formatElapsed(panelEntry.elapsedMs)}</span>
                  )}
                  {panelEntry.kind && <span className="f12-xs-k">{panelEntry.kind}</span>}
                </p>
                <p className="f12-xs-title" id={`${prefix}-title`} tabIndex={-1}>
                  {panelEntry.label}
                </p>
                {(panelEntry.status || panelEntry.marker) && (
                  <p className="f12-xs-pmeta">
                    {panelEntry.status && <StatusWord status={panelEntry.status} />}
                    {panelEntry.marker && (
                      <span className={panelEntry.index === ex.primaryMarkerIndex ? 'f12-xs-mk f12-xs-mk-primary' : 'f12-xs-mk'}>
                        <span aria-hidden="true">{panelEntry.index === ex.primaryMarkerIndex ? '◆ ' : '◇ '}</span>
                        {panelEntry.index === ex.primaryMarkerIndex ? 'MARK' : 'mark'}
                      </span>
                    )}
                  </p>
                )}
              </div>
              <div
                className="f12-xs-content"
                data-exposure-content=""
                onKeyDown={(e) => {
                  contentKeys.current.add(e.nativeEvent);
                }}
              >
                <FrameBoundary frameId={panelEntry.key}>
                  <FrameSlot
                    render={renderFrame}
                    frame={panelEntry.source}
                    index={panelEntry.index}
                    scrubbing={ex.scrubbing}
                    settled={ex.settled}
                  />
                </FrameBoundary>
              </div>
              {(panelEntry.causes.length > 0 || ex.back) && (
                <div className="f12-xs-links">
                  {panelEntry.causes.length > 0 && (
                    <>
                      <p className="f12-xs-links-h" id={`${prefix}-from`}>
                        Led here from
                      </p>
                      <ul className="f12-xs-links-l" aria-labelledby={`${prefix}-from`}>
                        {panelEntry.causes.map((ci) => (
                          <li key={entries[ci].key}>
                            <button
                              type="button"
                              className="f12-xs-tbtn f12-xs-cause"
                              disabled={!ready}
                              onClick={() => {
                                ex.followCause(ci);
                                focusTitle.current = true;
                              }}
                            >
                              {`${frameNo(ci)} · ${entries[ci].label}`}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  {ex.back && (
                    <button type="button" className="f12-xs-tbtn f12-xs-back" disabled={!ready} onClick={() => {
                        ex.goBack();
                        focusTitle.current = true;
                      }}>
                      <span aria-hidden="true">↩ </span>
                      {`Back to ${frameNo(ex.back.index)}`}
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </Panel>
      </div>
      <div className="f12-sr-only" role="status" aria-live="polite" aria-atomic="true">
        {ex.announcement}
      </div>
    </div>
  );
}
