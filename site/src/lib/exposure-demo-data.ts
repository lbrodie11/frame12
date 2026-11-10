// Data for the ExposureScrubber docs demos: the shared `ExposureDemo` shape and the CI demo.
// Pure and deterministic (no Date.now, no locale), so server and first client render match.
// The agent-run demo lives in exposure-agent-demo.ts and is built on the server only.
//
// CI RUN: ILLUSTRATIVE. @frame12/terminal defines the event contract (and validates it) but
//    cannot record a run yet, and none of this repository's scripts emit terminal events, so
//    there is no real captured log to commit. The events below follow the contract exactly
//    (registry/tests/exposure.mjs validates them with @frame12/terminal's validateEvent) and
//    are labelled "illustrative" wherever they appear.
import type { ExposureFrame } from '@/components/frame12';

export interface ExposureDemo {
  id: string;
  title: string;
  label: string;
  illustrative: boolean;
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

// ------------------------------------------------------------------------------- CI run (illustrative)
type CiEvent = Record<string, unknown> & { type: string; seq: number; ts: string; id: string };

const RUN = 'ci-illustrative-001';
const base = (type: string, seq: number, ts: string, id: string) => ({ schemaVersion: 1, type, runId: RUN, seq, ts, id });

/** ILLUSTRATIVE terminal events in the @frame12/terminal v1 contract (not a captured run). */
export const CI_ILLUSTRATIVE_EVENTS: CiEvent[] = [
  { ...base('run-start', 1, '2026-11-10T09:00:00.000Z', 'run'), title: 'npm test (illustrative)', command: 'npm test' },
  { ...base('scene-start', 2, '2026-11-10T09:00:00.050Z', 'scene-checks'), scene: 'checks', title: 'Repository checks' },
  { ...base('cut-start', 3, '2026-11-10T09:00:00.100Z', 'cs-sync'), cut: 'sync', title: 'sync:check', scene: 'checks' },
  { ...base('cut-end', 4, '2026-11-10T09:00:01.900Z', 'ce-sync'), cut: 'sync', status: 'ok', summary: '64 files + 49 registry payloads verified', durationMs: 1800 },
  { ...base('cut-start', 5, '2026-11-10T09:00:02.000Z', 'cs-doc'), cut: 'doc', title: 'doc:check', scene: 'checks' },
  { ...base('warning', 6, '2026-11-10T09:00:03.200Z', 'w-doc'), cut: 'doc', message: 'catalog entry has no preview screenshot yet', code: 'doc-preview' },
  { ...base('cut-end', 7, '2026-11-10T09:00:04.100Z', 'ce-doc'), cut: 'doc', status: 'warning', summary: '37 catalog entries, 1 warning', durationMs: 2100 },
  { ...base('cut-start', 8, '2026-11-10T09:00:04.200Z', 'cs-lint'), cut: 'lint', title: 'lint:frame12', scene: 'checks' },
  {
    ...base('finding', 9, '2026-11-10T09:00:05.400Z', 'f-marker'),
    cut: 'lint',
    finding: {
      id: 'marker-misuse-1',
      title: 'Marker yellow used as a text color',
      status: 'danger',
      prominence: 'hero',
      subject: [{ kind: 'file', label: 'registry/ui/example-badge.tsx' }],
      summary: 'rule marker-misuse: --f-marker may only be a background under --f-marker-ink',
    },
  },
  { ...base('cut-end', 10, '2026-11-10T09:00:05.900Z', 'ce-lint'), cut: 'lint', status: 'error', summary: '1 violation', durationMs: 1700 },
  { ...base('cut-start', 11, '2026-11-10T09:00:06.000Z', 'cs-unit'), cut: 'unit', title: 'registry unit tests', scene: 'checks' },
  { ...base('cut-end', 12, '2026-11-10T09:00:06.000Z', 'ce-unit'), cut: 'unit', status: 'skipped', summary: 'skipped after a failed check' },
  { ...base('scene-end', 13, '2026-11-10T09:00:06.050Z', 'se-checks'), scene: 'checks' },
  { ...base('run-end', 14, '2026-11-10T09:00:06.100Z', 'run-end'), status: 'failed', error: 'lint:frame12 failed' },
];

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
  const frames = ciEventsToFrames(CI_ILLUSTRATIVE_EVENTS);
  const hero = CI_ILLUSTRATIVE_EVENTS.find(
    (e) => e.type === 'finding' && (e.finding as { prominence?: string }).prominence === 'hero',
  );
  return {
    id: 'ci-run',
    title: 'CI / terminal run (illustrative)',
    label: 'CI run ci-illustrative-001 replay (illustrative)',
    illustrative: true,
    source: 'ILLUSTRATIVE: @frame12/terminal v1 events written by hand (the package cannot record a run yet)',
    frames,
    rawLog: CI_ILLUSTRATIVE_EVENTS.map((e) => JSON.stringify(e)).join('\n'),
    question: 'Which earlier step led to the failure?',
    answer:
      'The lint:frame12 cut (C-03): its finding “Marker yellow used as a text color” ends the cut with an error, and run end names that failure. The doc:check warning before it is unrelated to the failure.',
    primaryMarker: hero?.id,
    defaultValue: frames[frames.length - 1]?.id,
  };
}
