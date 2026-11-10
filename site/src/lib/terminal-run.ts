// Data for /terminal, all derived from one real recording (terminal-run.generated.json). Pure and
// deterministic, so the server render and the first client render match.
import type { ExposureFrame } from '@/components/frame12';
import { ansiToLines, type AnsiSegment } from './ansi';
import { ciEventsToFrames, type CiEvent } from './exposure-demo-data';
import generated from './terminal-run.generated.json';

/** Written by site/scripts/build-terminal-run.mjs (checked for drift in the site's tests). */
interface Generated {
  recordingFile: string;
  watchCommand: string;
  /** The recording, byte for byte (header line, then one {t, event} per line). */
  recordingNdjson: string;
  /** packages/terminal/examples/hello.ndjson: a complete run in twelve lines. */
  helloNdjson: string;
  /** Wait (ms, as the CLI waited), then the ANSI it wrote to stdout or stderr. */
  watchSteps: ReadonlyArray<{ waitMs: number; stream: 'stdout' | 'stderr'; ansi: string }>;
  /** packages/terminal/README.md tables, as raw markdown cells. */
  envTable: ReadmeTable;
  compatTable: ReadmeTable;
  /** The README's emitters (its tests run them through `frame12-term render --strict`). */
  emitters: { python: string; go: string };
}

export interface ReadmeTable {
  header: string[];
  rows: string[][];
}
const G = generated as Generated;
const WATCH_STEPS = G.watchSteps;
const RECORDING_NDJSON = G.recordingNdjson;
export const HELLO_NDJSON = G.helloNdjson;
export const RECORDING_FILE = G.recordingFile;
export const WATCH_COMMAND = G.watchCommand;
export const ENV_TABLE = G.envTable;
export const COMPAT_TABLE = G.compatTable;
export const EMITTERS = G.emitters;

export interface WatchStep {
  /** How long the CLI waited before writing this step (ms, replay speed ×1, at most 1 s per gap). */
  waitMs: number;
  stream: 'stdout' | 'stderr';
  lines: AnsiSegment[][];
}

/** The CLI's output, step by step, as styled lines. */
export function watchSteps(): WatchStep[] {
  return WATCH_STEPS.map((s) => ({ waitMs: s.waitMs, stream: s.stream, lines: ansiToLines(s.ansi).lines }));
}

/** Every SGR parameter the Watch data uses that the page does not style (expected: none). */
export function watchUnsupportedSgr(): string[] {
  return [...new Set(WATCH_STEPS.flatMap((s) => ansiToLines(s.ansi).unsupported))];
}

interface RecordedFinding {
  id: string;
  title: string;
  summary?: string;
  status: string;
  prominence: string;
  strength?: { value: number; low?: number; high?: number; label: string };
  receipts?: { kind: string; value: string; note?: string; at?: string }[];
}

/** The recording's events, in order (the header line dropped). */
export function recordingEvents(): CiEvent[] {
  return RECORDING_NDJSON.trim()
    .split('\n')
    .slice(1)
    .map((line) => (JSON.parse(line) as { event: CiEvent }).event);
}

export interface ExploreDemo {
  label: string;
  frames: ExposureFrame[];
  primaryMarker?: string;
  defaultValue?: string;
  topFinding: { title: string; summary?: string; evidence: number; strength?: RecordedFinding['strength'] };
}

/** The same events as an exposure sheet (one frame per event), marked at the top finding. */
export function exploreDemo(): ExploreDemo {
  const events = recordingEvents();
  const frames = ciEventsToFrames(events);
  const snapshot = events.at(-1)?.snapshot as { runId: string; findings: RecordedFinding[] } | undefined;
  const top = snapshot?.findings.find((f) => f.prominence === 'hero') ?? snapshot?.findings[0];
  const hero = events.find((e) => e.type === 'finding' && (e.finding as RecordedFinding).id === top?.id);
  return {
    label: `Repo Archaeology run ${snapshot?.runId ?? ''} on honojs/hono, replay`.replace('  ', ' '),
    frames,
    primaryMarker: hero?.id,
    defaultValue: hero?.id,
    topFinding: { title: top?.title ?? '', ...(top?.summary ? { summary: top.summary } : {}), evidence: top?.receipts?.length ?? 0, ...(top?.strength ? { strength: top.strength } : {}) },
  };
}
