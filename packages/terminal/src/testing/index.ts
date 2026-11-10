/**
 * @frame12/terminal/testing: deterministic event factories, fake streams and v1 fixtures for
 * tests, galleries and examples. Nothing here reads the clock, the environment or the disk.
 */
import {
  SCHEMA_VERSION,
  type CutStatus,
  type CutSummary,
  type EventOf,
  type EventType,
  type Finding,
  type Metric,
  type ReceiptRef,
  type RunStatus,
  type Snapshot,
  type TerminalEvent,
} from '../core/contract.js';
import type { InputStreamLike, StreamLike, Streams } from '../core/capabilities.js';

type Payload<T extends EventType> = Omit<EventOf<T>, 'schemaVersion' | 'type' | 'runId' | 'seq' | 'ts' | 'id'>;

export interface EventFactoryOptions {
  runId?: string;
  /** ISO 8601 start time. Default `2026-11-10T09:00:00.000Z`. */
  start?: string;
  /** Milliseconds the injected clock advances per event. Default 250. */
  stepMs?: number;
}

export interface EventFactory {
  /** Builds the next event: `seq`, `ts` and `id` come from the factory's deterministic clock. */
  next<T extends EventType>(type: T, payload: Payload<T>): EventOf<T>;
  /** Advances the injected clock without emitting an event. */
  advance(ms: number): void;
  /** The current injected time, ISO 8601. */
  now(): string;
  readonly runId: string;
}

/** A deterministic event builder with an injected clock. */
export function createEventFactory(options: EventFactoryOptions = {}): EventFactory {
  const runId = options.runId ?? 'run-0001';
  let t = Date.parse(options.start ?? '2026-11-10T09:00:00.000Z');
  const step = options.stepMs ?? 250;
  let seq = 0;
  return {
    runId,
    now: () => new Date(t).toISOString(),
    advance(ms) {
      t += ms;
    },
    next(type, payload) {
      seq += 1;
      const ev = {
        schemaVersion: SCHEMA_VERSION,
        type,
        runId,
        seq,
        ts: new Date(t).toISOString(),
        id: `${runId}-e${String(seq).padStart(4, '0')}`,
        ...payload,
      };
      t += step;
      return ev as unknown as EventOf<typeof type>;
    },
  };
}

export interface FakeStreamOptions {
  /** stdout and stderr are TTYs. Default false. */
  tty?: boolean;
  /** stdin is a TTY with raw mode. Defaults to `tty`. */
  stdinTty?: boolean;
  columns?: number;
  rows?: number;
}

/** Stream doubles for `detectCapabilities`. */
export function fakeStreams(options: FakeStreamOptions = {}): Required<Streams> {
  const tty = options.tty === true;
  const stdinTty = options.stdinTty ?? tty;
  const out = (): StreamLike => ({
    isTTY: tty,
    ...(tty && options.columns !== undefined ? { columns: options.columns } : {}),
    ...(tty && options.rows !== undefined ? { rows: options.rows } : {}),
  });
  const stdin: InputStreamLike = stdinTty ? { isTTY: true, setRawMode: () => undefined } : { isTTY: false };
  return { stdin, stdout: out(), stderr: out() };
}

// --------------------------------------------------------------------------------- fixtures

export const FIXTURE_NAMES = ['success', 'failed', 'canceled', 'empty', 'one-finding', 'forty-findings', 'repo-archaeology'] as const;
export type FixtureName = (typeof FIXTURE_NAMES)[number];

export interface Fixture {
  name: FixtureName;
  description: string;
  events: TerminalEvent[];
  snapshot: Snapshot;
}

interface CutPlan {
  cut: string;
  title: string;
  status: CutStatus;
  durationMs: number;
  progress?: { total: number; unit: string };
  summary?: string;
}

interface RunPlan {
  name: FixtureName;
  description: string;
  title: string;
  runId: string;
  cuts: CutPlan[];
  metrics: Metric[];
  findings: Finding[];
  warnings: string[];
  status: RunStatus;
  error?: string;
}

const PIPELINE: ReadonlyArray<Omit<CutPlan, 'status' | 'durationMs'>> = [
  { cut: 'resolve-workspace', title: 'Resolve workspace' },
  { cut: 'read-history', title: 'Read history', progress: { total: 400, unit: 'commits' } },
  { cut: 'pair-changes', title: 'Pair changes', progress: { total: 1200, unit: 'pairs' } },
  { cut: 'rank-findings', title: 'Rank findings' },
];

/** A deterministic, realistic-looking 40-hex SHA (FNV-1a chained; not a real commit). */
function fakeSha(seed: string): string {
  let h = 0x811c9dc5;
  let out = '';
  for (let round = 0; out.length < 40; round++) {
    for (const ch of `${seed}:${round}`) {
      h ^= ch.charCodeAt(0);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    out += h.toString(16).padStart(8, '0');
  }
  return out.slice(0, 40);
}

function receipt(i: number, j: number): ReceiptRef {
  return {
    kind: 'commit',
    value: fakeSha(`pair-${i}-change-${j}`),
    at: new Date(Date.UTC(2026, 9, 28 - ((i + j) % 27))).toISOString(),
    note: `change ${j + 1} touching both sides of pair ${i + 1}`,
  };
}

function finding(i: number, total: number, receipts: number): Finding {
  const prominence = i === 0 ? 'hero' : i < Math.min(10, total) ? 'primary' : 'secondary';
  const value = Math.round((0.92 - (i * 0.6) / Math.max(1, total)) * 100) / 100;
  return {
    id: `pair-${String(i + 1).padStart(3, '0')}`,
    title: i === 0 ? 'Settlement runner moves with the ledger reconciler' : `Module ${i + 1} moves with its neighbor`,
    summary: `${Math.round(value * 10)} of 10 changes to one side also changed the other.`,
    subject: [
      { kind: 'file', label: `src/module-${i + 1}/runner.ts` },
      { kind: 'file', label: `src/module-${i + 1}/ledger.ts` },
    ],
    strength: { value, low: Math.max(0, Math.round((value - 0.18) * 100) / 100), high: Math.min(1, Math.round((value + 0.07) * 100) / 100), label: 'follow-up rate (historical activity, not correctness)' },
    prominence,
    status: i % 7 === 3 ? 'warning' : 'review',
    relation: i % 3 === 1 ? 'direct' : 'history-only',
    receipts: Array.from({ length: receipts }, (_, j) => receipt(i, j)),
  };
}

function build(plan: RunPlan): Fixture {
  const f = createEventFactory({ runId: plan.runId });
  const events: TerminalEvent[] = [];
  const startedAt = f.now();
  events.push(f.next('run-start', { title: plan.title, product: 'FRAME/12 terminal fixtures', command: `fixture ${plan.name}` }));
  events.push(f.next('scene-start', { scene: 'analysis', title: 'Analysis' }));
  const summaries: CutSummary[] = [];
  for (const cut of plan.cuts) {
    events.push(f.next('cut-start', { cut: cut.cut, title: cut.title, scene: 'analysis' }));
    if (cut.progress) {
      const reached = cut.status === 'ok' ? cut.progress.total : Math.floor(cut.progress.total / 3);
      for (const done of [Math.floor(reached / 2), reached]) {
        events.push(f.next('cut-progress', { cut: cut.cut, done, total: cut.progress.total, unit: cut.progress.unit }));
      }
    }
    if (cut.status === 'error' && plan.error) {
      events.push(f.next('log', { cut: cut.cut, level: 'error', text: plan.error, stream: 'stderr' }));
    }
    if (cut.cut === 'rank-findings' && cut.status === 'ok') {
      for (const metric of plan.metrics) events.push(f.next('metric', { cut: cut.cut, metric }));
      for (const fd of plan.findings) {
        const { receipts, ...rest } = fd;
        events.push(f.next('finding', { cut: cut.cut, finding: rest }));
        for (const r of receipts ?? []) events.push(f.next('receipt', { finding: fd.id, receipt: r }));
      }
    }
    f.advance(cut.durationMs);
    events.push(f.next('cut-end', { cut: cut.cut, status: cut.status, durationMs: cut.durationMs, ...(cut.summary ? { summary: cut.summary } : {}) }));
    summaries.push({ cut: cut.cut, title: cut.title, status: cut.status, scene: 'analysis', durationMs: cut.durationMs, ...(cut.summary ? { summary: cut.summary } : {}) });
  }
  for (const message of plan.warnings) events.push(f.next('warning', { message }));
  events.push(f.next('scene-end', { scene: 'analysis' }));
  events.push(f.next('run-end', { status: plan.status, ...(plan.error ? { error: plan.error } : {}) }));
  const snapshot: Snapshot = {
    schemaVersion: SCHEMA_VERSION,
    runId: plan.runId,
    title: plan.title,
    status: plan.status,
    startedAt,
    finishedAt: f.now(),
    cuts: summaries,
    metrics: plan.metrics,
    findings: plan.findings,
    warnings: plan.warnings,
    ...(plan.error ? { error: plan.error } : {}),
  };
  events.push(f.next('snapshot', { snapshot }));
  return { name: plan.name, description: plan.description, events, snapshot };
}

const pipeline = (statuses: CutStatus[], summaries: Partial<Record<number, string>> = {}): CutPlan[] =>
  statuses.map((status, i) => ({
    ...PIPELINE[i]!,
    status,
    durationMs: [140, 2380, 1710, 95][i]!,
    ...(summaries[i] ? { summary: summaries[i] } : {}),
  }));

const metrics = (findings: number): Metric[] => [
  { name: 'commits-read', label: 'Commits read', value: 400 },
  { name: 'files-seen', label: 'Files seen', value: 212 },
  { name: 'findings', label: 'Findings', value: findings },
];

function repoArchaeologyPlan(): RunPlan {
  // Converted once from PR #2's fixtures/repo-archaeology-reconstructed.json (Repo Archaeology
  // schemaVersion 1, payments-service example). Follow-up rates are historical activity, not correctness.
  const pairs = [
    {
      from: 'src/settlement/payout-runner.ts',
      to: 'src/settlement/reconcile-ledger.ts',
      relationship: 'direct',
      why: '9 of 10 payout-runner commits also modified reconcile-ledger.',
      confidence: 0.9,
      evidence: [
        ['a19f02b', '2026-10-28', 'fix(settlement): sync payout batch status with ledger reconciliation'],
        ['b48c11e', '2026-10-24', 'feat(settlement): add retry guard across payout runner and ledger'],
        ['c77d30a', '2026-10-19', 'refactor(settlement): unify idempotency token format'],
        ['d02e91f', '2026-10-14', 'fix(settlement): handle partial settlement rollback'],
        ['e83a44c', '2026-10-08', 'feat(settlement): record fee adjustments in ledger'],
        ['f91b72d', '2026-10-02', 'chore(settlement): tighten batch cursor pagination'],
      ],
    },
    {
      from: 'src/api/routes/webhooks.ts',
      to: 'src/domain/events/schema.ts',
      relationship: 'indirect',
      why: '6 of 8 webhooks commits also modified the event schema.',
      confidence: 0.75,
      evidence: [
        ['1a2b3c4', '2026-10-27', 'feat(webhooks): emit payout.settled events'],
        ['2b3c4d5', '2026-10-21', 'fix(events): version the settlement envelope'],
        ['3c4d5e6', '2026-10-16', 'feat(webhooks): sign retry deliveries'],
        ['4d5e6f7', '2026-10-11', 'refactor(events): share the payload validator'],
        ['5e6f7a8', '2026-10-05', 'fix(webhooks): drop duplicate refund events'],
        ['6f7a8b9', '2026-09-30', 'feat(events): add chargeback reason codes'],
      ],
    },
    {
      from: 'src/db/migrations/004_balances.sql',
      to: 'src/db/queries/balances.ts',
      relationship: 'ghost',
      why: 'Every change to the balances migration also changed the balances queries, with no import between them.',
      confidence: 1,
      evidence: [
        ['7a8b9c0', '2026-10-26', 'feat(db): add pending balance column'],
        ['8b9c0d1', '2026-10-18', 'fix(db): backfill settled balances'],
        ['9c0d1e2', '2026-10-09', 'feat(db): index balances by currency'],
        ['0d1e2f3', '2026-09-29', 'feat(db): create balances table'],
      ],
    },
  ] as const;
  const relationshipWords: Record<string, string> = {
    direct: 'imports it directly',
    indirect: 'connected through other modules',
    ghost: 'no import between them',
  };
  const findings: Finding[] = pairs
    .map((p, i): Finding => ({
      id: `pair-${p.relationship}-${i + 1}`,
      title: `${p.from.split('/').pop()} moves with ${p.to.split('/').pop()} (${relationshipWords[p.relationship]})`,
      summary: p.why,
      subject: [
        { kind: 'file', label: p.from },
        { kind: 'file', label: p.to },
      ],
      strength: { value: p.confidence, label: 'follow-up rate (historical activity, not correctness)' },
      prominence: p.relationship === 'ghost' ? 'hero' : 'primary',
      relation: p.relationship === 'ghost' ? 'history-only' : p.relationship,
      status: p.relationship === 'ghost' ? 'review' : 'info',
      receipts: p.evidence.map(([sha, date, subject]) => ({ kind: 'commit', value: sha, at: `${date}T00:00:00.000Z`, note: subject })),
    }))
    .sort((a, b) => (a.prominence === 'hero' ? -1 : b.prominence === 'hero' ? 1 : 0));
  return {
    name: 'repo-archaeology',
    description: "PR #2's Repo Archaeology fixture (payments-service, 74 commits analyzed), converted to contract v1.",
    title: 'Repo Archaeology: payments-service vs origin/main',
    runId: 'ra-payments-a19f02b',
    cuts: [
      { cut: 'validate-repo', title: 'Validate repository', status: 'ok', durationMs: 60 },
      { cut: 'read-history', title: 'Read history', status: 'ok', durationMs: 1840, progress: { total: 80, unit: 'commits' }, summary: '74 of 80 commits analyzed; 2 sweeps skipped.' },
      { cut: 'pair-changes', title: 'Pair co-changes', status: 'ok', durationMs: 920, progress: { total: 28, unit: 'files' } },
      { cut: 'rank-findings', title: 'Rank findings', status: 'ok', durationMs: 40, summary: '19 suggestions; 3 for the changed files.' },
    ],
    metrics: [
      { name: 'commits-read', label: 'Commits read', value: 80 },
      { name: 'commits-analyzed', label: 'Commits analyzed', value: 74 },
      { name: 'files', label: 'Files', value: 28 },
      { name: 'suggestions', label: 'Suggestions', value: 19 },
    ],
    findings,
    warnings: ['Excluded 2 automated lockfile-only commits from co-change counts.'],
    status: 'completed',
  };
}

function plan(name: FixtureName): RunPlan {
  switch (name) {
    case 'success': {
      const findings = [finding(0, 3, 6), finding(1, 3, 3), finding(2, 3, 1)];
      return { name, description: 'A completed run with a top finding and two primary findings.', title: 'Investigate coupling in payments-service', runId: 'run-success', cuts: pipeline(['ok', 'ok', 'ok', 'ok']), metrics: metrics(3), findings, warnings: [], status: 'completed' };
    }
    case 'failed': {
      const error = 'History could not be read: object 3f9a2c1 is missing (shallow clone?).';
      return { name, description: 'A run that failed in its second cut.', title: 'Investigate coupling in payments-service', runId: 'run-failed', cuts: pipeline(['ok', 'error', 'skipped', 'skipped']), metrics: [], findings: [], warnings: ['Results are incomplete: 2 cuts were skipped.'], status: 'failed', error };
    }
    case 'canceled':
      return { name, description: 'A run canceled with Ctrl-C during its third cut.', title: 'Investigate coupling in payments-service', runId: 'run-canceled', cuts: pipeline(['ok', 'ok', 'canceled', 'skipped'], { 2: 'Canceled by the user (SIGINT).' }), metrics: [{ name: 'commits-read', label: 'Commits read', value: 400 }], findings: [], warnings: [], status: 'canceled' };
    case 'empty':
      return { name, description: 'A completed run with no findings.', title: 'Investigate coupling in payments-service', runId: 'run-empty', cuts: pipeline(['ok', 'ok', 'ok', 'ok']), metrics: metrics(0), findings: [], warnings: [], status: 'completed' };
    case 'one-finding':
      return { name, description: 'A completed run with exactly one finding.', title: 'Investigate coupling in payments-service', runId: 'run-one', cuts: pipeline(['ok', 'ok', 'ok', 'ok']), metrics: metrics(1), findings: [finding(0, 1, 4)], warnings: [], status: 'completed' };
    case 'forty-findings': {
      const findings = Array.from({ length: 40 }, (_, i) => finding(i, 40, (i % 6) + 1));
      return { name, description: 'A completed run with 40 findings (1 hero, 9 primary, 30 secondary) and a warning.', title: 'Investigate coupling in payments-service', runId: 'run-forty', cuts: pipeline(['ok', 'ok', 'warning', 'ok'], { 2: '312 pairs below the noise floor were dropped.' }), metrics: metrics(40), findings, warnings: ['312 low-signal pairs were dropped; pass --include-noise to keep them.'], status: 'completed' };
    }
    case 'repo-archaeology':
      return repoArchaeologyPlan();
  }
}

/** One named v1 fixture: its full event stream and the authoritative snapshot. Deterministic. */
export function fixture(name: FixtureName): Fixture {
  return build(plan(name));
}

/** Every v1 fixture. */
export function fixtures(): Fixture[] {
  return FIXTURE_NAMES.map(fixture);
}

/** Serializes events as NDJSON (one JSON object per line, trailing newline). */
export function toNdjson(events: readonly unknown[]): string {
  return events.map((e) => JSON.stringify(e)).join('\n') + '\n';
}
