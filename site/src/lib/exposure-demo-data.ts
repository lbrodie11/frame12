// Data for the ExposureScrubber docs demos: the shared `ExposureDemo` shape and the CI demo.
// Pure and deterministic (no Date.now, no locale), so server and first client render match.
// The agent-run demo lives in exposure-agent-demo.ts and is built on the server only.
//
// CI RUN: RECORDED. A real failing run of @frame12/terminal's build-pipeline reference app with
//    `--break test`, recorded with `--record` (packages/terminal/examples/build-pipeline/fixtures/
//    break-test.f12rec, copied into ci-run.generated.json by site/scripts/build-terminal-run.mjs).
//    Lint and typecheck pass, the test step fails, and the build is skipped. Nothing is edited.
import type { ExposureFrame } from '@/components/frame12';
import ciRun from './ci-run.generated.json';

export interface ExposureDemo {
  id: string;
  title: string;
  label: string;
  illustrative: boolean;
  /** True when the data is a recorded run (a `.f12rec`), not fixtures. */
  recorded?: boolean;
  source: string;
  frames: ExposureFrame[];
  /** The raw log, one record per line, exactly what the sheet was built from (redacted). */
  rawLog: string;
  question: string;
  /** The answer, stated from the data (shown after the reader commits). */
  answer: string;
  primaryMarker?: string;
  defaultValue?: string;
}

// ------------------------------------------------------------------------------- CI run (recorded)
/** A @frame12/terminal v1 event, as far as the frames need it. */
export type CiEvent = Record<string, unknown> & { type: string; seq: number; ts: string; id: string };

/** The recorded run's events, in order (the `.f12rec` header line dropped). */
export const CI_RECORDED_EVENTS: CiEvent[] = (ciRun as { recordingNdjson: string }).recordingNdjson
  .trim()
  .split('\n')
  .slice(1)
  .map((line) => (JSON.parse(line) as { event: CiEvent }).event);
export const CI_RECORDING_FILE: string = (ciRun as { recordingPath: string }).recordingPath;

/** Maps terminal events to frames: ts → at; findings and warnings → status; cuts → labels.
 * Causes only from the contract's own links (an event's `cut` → that cut's start; a cut's end
 * → the findings and warnings inside it; run-end → the failing cut's end). */
export function ciEventsToFrames(events: readonly CiEvent[]): ExposureFrame[] {
  const cutNo = new Map<string, number>();
  const cutStartId = new Map<string, string>();
  const insideCut = new Map<string, string[]>();
  const frames: ExposureFrame[] = [];
  let failingCutEnd: string | undefined;
  for (const e of events) {
    const cut = typeof e.cut === 'string' ? e.cut : undefined;
    if (e.type === 'cut-start' && cut && !cutNo.has(cut)) {
      cutNo.set(cut, cutNo.size + 1);
      cutStartId.set(cut, e.id);
    }
    const cutLabel = cut ? `C-${String(cutNo.get(cut) ?? 0).padStart(2, '0')}` : '';
    const f: ExposureFrame = { id: e.id, label: '', at: e.ts, kind: e.type };
    switch (e.type) {
      case 'run-start':
        f.label = `run · ${String(e.title)}`;
        break;
      case 'scene-start':
        f.label = `scene · ${String(e.title)}`;
        break;
      case 'scene-end':
        f.label = `scene end · ${String(e.scene)}`;
        break;
      case 'cut-start':
        f.label = `${cutLabel} · ${String(e.title)}`;
        break;
      case 'cut-end': {
        const s = String(e.status);
        f.label = `${cutLabel} · ${s === 'ok' ? 'done' : s}`;
        f.status = s === 'ok' ? 'ok' : s === 'warning' ? 'warn' : s === 'error' ? 'error' : undefined;
        if (typeof e.durationMs === 'number') f.durationMs = e.durationMs;
        f.detail = typeof e.summary === 'string' ? e.summary : undefined;
        const inner = insideCut.get(cut!) ?? [];
        f.causes = inner.length ? inner : cutStartId.has(cut!) ? [cutStartId.get(cut!)!] : undefined;
        if (s === 'error') failingCutEnd = e.id;
        break;
      }
      case 'warning':
        f.label = `${cutLabel} · warning · ${String(e.code ?? '')}`.replace(/ · $/, '');
        f.status = 'warn';
        f.detail = String(e.message);
        break;
      case 'finding': {
        const fd = e.finding as { title: string; status: string; prominence?: string; summary?: string };
        f.label = `${cutLabel} · finding · ${fd.title}`;
        f.status = fd.status === 'danger' ? 'error' : fd.status === 'warning' ? 'warn' : 'ok';
        f.marker = fd.status === 'danger' || fd.status === 'warning' || fd.prominence === 'hero';
        f.detail = fd.summary;
        break;
      }
      case 'metric': {
        const m = e.metric as { name: string; label?: string; value: number | string; unit?: string };
        f.label = `${cut ? `${cutLabel} · ` : ''}metric · ${m.label ?? m.name}`;
        f.detail = `${m.label ?? m.name}: ${String(m.value)}${m.unit ? ` ${m.unit}` : ''}`;
        break;
      }
      case 'snapshot': {
        const snap = e.snapshot as { findings?: unknown[]; status?: string };
        f.label = `snapshot · ${snap.findings?.length ?? 0} findings`;
        f.detail = `The result every renderer draws from (run ${String(snap.status)}).`;
        break;
      }
      case 'run-end':
        f.label = `run end · ${String(e.status)}`;
        f.status = e.status === 'completed' ? 'ok' : 'error';
        f.detail = typeof e.error === 'string' ? e.error : undefined;
        if (failingCutEnd) f.causes = [failingCutEnd];
        break;
      default:
        f.label = e.type;
    }
    if ((e.type === 'warning' || e.type === 'finding') && cut) {
      insideCut.set(cut, [...(insideCut.get(cut) ?? []), e.id]);
      if (cutStartId.has(cut)) f.causes = [cutStartId.get(cut)!];
    }
    frames.push(f);
  }
  return frames;
}

export function buildCiRunDemo(): ExposureDemo {
  const events = CI_RECORDED_EVENTS;
  const frames = ciEventsToFrames(events);
  const runId = String(events[0]?.runId ?? '');
  const hero = events.find((e) => e.type === 'finding' && (e.finding as { prominence?: string }).prominence === 'hero');
  const failedCut = events.find((e) => e.type === 'cut-end' && e.status === 'error');
  const failedNo = frames.findIndex((f) => f.id === failedCut?.id);
  const cutLabel = failedNo >= 0 ? frames[failedNo]!.label.split(' · ')[0] : '';
  const finding = hero?.finding as { title: string; receipts?: { value: string }[] } | undefined;
  return {
    id: 'ci-run',
    title: 'CI / terminal run (recorded)',
    label: `CI run ${runId} replay (recorded)`,
    illustrative: false,
    recorded: true,
    source: `RECORDED: the build-pipeline reference app with --break test (${CI_RECORDING_FILE.split('/').pop()})`,
    frames,
    rawLog: events.map((e) => JSON.stringify(e)).join('\n'),
    question: 'Which earlier step led to the failure?',
    answer: `The test step (${cutLabel}): it ends with an error, and its finding “${finding?.title ?? ''}” names the failing test and its evidence (${(finding?.receipts ?? []).map((r) => r.value).join('; ')}). Lint and typecheck passed before it; the build was skipped because of it, and run end reports the failure.`,
    primaryMarker: hero?.id,
    defaultValue: frames[frames.length - 1]?.id,
  };
}
