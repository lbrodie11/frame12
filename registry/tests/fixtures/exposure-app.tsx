// The ExposureScrubber test harness, shared by the browser fixture (exposure-fixture.tsx) and the
// server render in registry/tests/exposure.mjs. Window-safe: globals are touched only in a browser.
import * as React from 'react';
import { createPortal } from 'react-dom';
import { ExposureScrubber, TempoProvider, type ExposureFrame } from '@/components/frame12';
import { useTempo, type Tempo } from '@/hooks/use-tempo';

export interface GenOptions {
  /** Indices that get `marker: true`. */
  markers?: number[];
  /** Base ISO time and gap between frames (ms). Omit `gapMs` for no times. */
  gapMs?: number | number[];
  durations?: boolean;
  holds?: number[];
  statuses?: boolean;
  causes?: Record<number, string[]>;
  detail?: boolean;
  prefix?: string;
}

/** Deterministic synthetic frames. */
export function gen(n: number, o: GenOptions = {}): ExposureFrame[] {
  const out: ExposureFrame[] = [];
  let t = Date.parse('2026-11-06T14:00:00Z');
  const p = o.prefix ?? 'f';
  for (let i = 0; i < n; i++) {
    const f: ExposureFrame = { id: `${p}${i + 1}`, label: `step ${i + 1} · ${i % 3 === 0 ? 'tool call · write_file' : i % 3 === 1 ? 'read config' : 'run tests'}` };
    if (o.gapMs !== undefined) {
      f.at = new Date(t).toISOString();
      t += Array.isArray(o.gapMs) ? o.gapMs[i % o.gapMs.length] : o.gapMs;
    }
    if (o.durations) f.durationMs = 100 * ((i % 5) + 1);
    if (o.holds) f.hold = o.holds[i % o.holds.length];
    if (o.statuses) f.status = i % 13 === 12 ? 'error' : i % 7 === 6 ? 'warn' : 'ok';
    if (o.markers?.includes(i)) f.marker = true;
    if (o.causes?.[i]) f.causes = o.causes[i];
    if (o.detail) f.detail = `Detail for step ${i + 1}: plain text summary that may wrap onto a second line.`;
    f.kind = i % 2 ? 'tool' : 'test';
    out.push(f);
  }
  return out;
}

type Render = 'light' | 'input' | 'throw' | 'heavy' | 'ctx' | 'portal';

export interface FixtureProps {
  frames?: ExposureFrame[];
  n?: number;
  genOpts?: GenOptions;
  controlled?: boolean;
  controlledPlaying?: boolean;
  initialValue?: string;
  props?: Record<string, unknown>;
  render?: Render;
  tempo?: Tempo;
  two?: boolean;
  /** Width of the box the scrubber sits in (container queries). */
  width?: number;
}

declare global {
  interface Window {
    __xs: (p: FixtureProps) => void;
    __xsLog: Array<[string, ...unknown[]]>;
    __xsAccept: boolean;
    __xsAcceptPlaying: boolean;
    __xsSetFrames: (f: (prev: ExposureFrame[]) => ExposureFrame[]) => void;
    __xsSetValue: (v: string | undefined) => void;
    __xsSetPlaying: (v: boolean | undefined) => void;
    __xsSetProps: (p: Record<string, unknown>) => void;
    __xsSetTempo: (t: Tempo) => void;
    __xsUnmount: () => void;
    __gen: typeof gen;
    __xsCtx: Array<{ id: string; scrubbing: boolean; settled: boolean }>;
  }
}
const W: Window | null = typeof window !== 'undefined' ? window : null;

function busy(ms: number) {
  // Synthetic expensive render. Time-bounded on a real clock; iteration-bounded too, because a
  // paused fake clock (Playwright's page.clock) never advances performance.now().
  const end = performance.now() + ms;
  let i = 0;
  while (performance.now() < end && i < 2e7) i++;
}

function makeRender(kind: Render) {
  return (frame: ExposureFrame, index: number, ctx: { scrubbing: boolean; settled: boolean }) => {
    W?.__xsCtx?.push({ id: frame.id, ...ctx });
    if (kind === 'throw' && frame.id === 'boom') throw new Error('renderFrame failed on purpose');
    if (kind === 'heavy' && !ctx.scrubbing) busy(20);
    if (kind === 'portal' && typeof document !== 'undefined') {
      return createPortal(
        <button type="button" id={`portal-btn-${index}`}>
          Portalled consumer button
        </button>,
        document.body,
      );
    }
    if (kind === 'input') {
      return (
        <div>
          <label>
            Note <input id={`note-${index}`} defaultValue="" />
          </label>
          <div id={`ce-${index}`} contentEditable suppressContentEditableWarning tabIndex={0}>
            editable
          </div>
          <button type="button" id={`consumer-btn-${index}`}>
            Consumer action
          </button>
        </div>
      );
    }
    return (
      <p className="fx-detail" data-frame={frame.id}>
        {ctx.scrubbing ? 'light' : `Full detail for ${frame.label}`}
      </p>
    );
  };
}

function TempoHandle() {
  const { setTempo } = useTempo();
  if (W) W.__xsSetTempo = setTempo;
  return null;
}

export function Harness(p: FixtureProps) {
  const initialFrames = React.useMemo(() => p.frames ?? gen(p.n ?? 6, p.genOpts), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [frames, setFrames] = React.useState<ExposureFrame[]>(initialFrames);
  const [value, setValue] = React.useState<string | undefined>(p.initialValue);
  const [playing, setPlaying] = React.useState<boolean | undefined>(p.controlledPlaying ? false : undefined);
  const [extra, setExtra] = React.useState<Record<string, unknown>>({});
  if (W) {
    W.__xsSetFrames = (f) => setFrames(f);
    W.__xsSetValue = setValue;
    W.__xsSetPlaying = setPlaying;
    W.__xsSetProps = (x) => setExtra((s) => ({ ...s, ...x }));
  }
  const render = React.useMemo(() => makeRender(p.render ?? 'light'), [p.render]);
  const one = (key: string, idPrefix: string) => (
    <ExposureScrubber
      key={key}
      label={`Run ${key}`}
      frames={frames}
      renderFrame={render}
      idPrefix={idPrefix}
      {...(p.controlled ? { value } : {})}
      {...(p.controlledPlaying ? { playing } : {})}
      onValueChange={(id, info) => {
        W?.__xsLog.push(['value', key, id, info.index, info.reason]);
        if (p.controlled && W?.__xsAccept !== false) setValue(id);
      }}
      onPlayingChange={(next, reason) => {
        W?.__xsLog.push(['playing', key, next, reason]);
        if (p.controlledPlaying && W?.__xsAcceptPlaying !== false) setPlaying(next);
      }}
      onRateChange={(r) => W?.__xsLog.push(['rate', key, r])}
      {...(p.props ?? {})}
      {...extra}
    />
  );
  const body = (
    <div id="xs-box" style={{ width: p.width ? `${p.width}px` : undefined }}>
      {one('a', 'xa')}
      {p.two && <div style={{ marginTop: 32 }}>{one('b', 'xb')}</div>}
    </div>
  );
  if (p.tempo) {
    return (
      <TempoProvider defaultValue={p.tempo}>
        <TempoHandle />
        {body}
      </TempoProvider>
    );
  }
  return body;
}

