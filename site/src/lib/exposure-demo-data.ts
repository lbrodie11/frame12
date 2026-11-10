// Data for the ExposureScrubber docs demos. Pure and deterministic (no Date.now, no locale
// beyond the fixtures' fixed en-US money format), so the server render and the first client
// render match.
//
// 1. AGENT RUN: derived only from the /experiments/agent-approval fixtures (scenario
//    `apr-misleading-2500` plus the simulated decision history). Every frame is one fixture
//    record or one evaluator result; every `causes` link is a link the fixture data states
//    (a request belongs to its conversation turn; a field comparison names its tool-input field,
//    its claim field and its trusted record `sourceFile`). Nothing is inferred from order.
// 2. CI RUN: ILLUSTRATIVE. @frame12/terminal defines the event contract (and validates it) but
//    cannot record a run yet, and none of this repository's scripts emit terminal events, so
//    there is no real captured log to commit. The events below follow the contract exactly
//    (registry/tests/exposure.mjs validates them with @frame12/terminal's validateEvent) and
//    are labelled "illustrative" wherever they appear.
import type { ExposureFrame } from '@/components/frame12';
import {
  INITIAL_APPROVAL_REQUESTS,
  INITIAL_DECISION_HISTORY,
  SIMULATED_CLOCK_PRESETS,
  evaluateApprovalRequest,
  formatCentsUsd,
} from '../../app/experiments/agent-approval/fixtures';

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

// ------------------------------------------------------------------------------- agent run
const SCENARIO = 'apr-misleading-2500';

/** Redaction before anything reaches a client component: the tool input's free-text memo is
 * untrusted carrier text (it carries an injection test payload), so it is never shown. */
function redactInput<T extends { auditMemo: string }>(input: T): Omit<T, 'auditMemo'> & { auditMemo: string } {
  return { ...input, auditMemo: `[redacted: ${input.auditMemo.length} characters of untrusted carrier text]` };
}

export function buildAgentRunDemo(): ExposureDemo {
  const request = INITIAL_APPROVAL_REQUESTS.find((r) => r.scenarioId === SCENARIO);
  if (!request) throw new Error(`fixture ${SCENARIO} is missing`);
  const clock = SIMULATED_CLOCK_PRESETS.find((c) => c.id === 'clock-default') ?? SIMULATED_CLOCK_PRESETS[0];
  const evaluated = evaluateApprovalRequest(request, clock.epochMs);
  const conv = request.conversation;

  const frames: ExposureFrame[] = [];
  const raw: unknown[] = [];

  // Simulated decision history before this request (other conversations: no links to it).
  for (const h of INITIAL_DECISION_HISTORY) {
    frames.push({
      id: h.id,
      label: `decision · ${h.decision} · ${h.toolName}`,
      at: h.timestampIso,
      kind: 'history',
      status: h.decision === 'APPROVED' ? 'ok' : 'warn',
      detail: `${h.conversationId} · ${h.actor}. ${h.summary}`,
    });
    raw.push({ type: 'decision-history', ...h });
  }

  // Trusted records the evaluator reads. Record ids and the evaluator's `trustedSourceId`s are
  // normalized the same way ("FIXTURE: data/orders.fixture.json#ORD-9104" → the same key as
  // "FIXTURE: orders.fixture.json#ORD-9104@turn-5"); a source naming two records ("A & B")
  // links to both.
  const recordKey = (source: string) =>
    source.replace(/^FIXTURE:\s*/, '').replace(/^data\//, '').replace(/@turn-\d+$/, '').trim();
  const recordFrameId = (source: string) => `record:${recordKey(source)}`;
  for (const rec of request.trustedRecords) {
    const warn = rec.orderFacts?.untrustedContextWarning;
    // The policy snapshot predates the run by days; keep its date in the label, not in `at`,
    // so elapsed time stays on the run's own clock (no timing is invented or dropped silently).
    const inRun = Date.parse(rec.snapshotAt) >= Date.parse(INITIAL_DECISION_HISTORY[0].timestampIso);
    frames.push({
      id: recordFrameId(rec.sourceFile),
      label: `trusted record · ${rec.recordId}${inRun ? '' : ` (snapshot ${rec.snapshotAt.slice(0, 10)})`}`,
      at: inRun ? rec.snapshotAt : undefined,
      kind: 'record',
      status: warn ? 'warn' : 'ok',
      detail: `${rec.title}. ${warn ? `${warn}.` : ''}`.trim(),
    });
    raw.push({ type: 'trusted-record', recordId: rec.recordId, sourceFile: rec.sourceFile, snapshotAt: rec.snapshotAt, orderFacts: rec.orderFacts, policyFacts: rec.policyFacts });
  }

  // The conversation turn the request belongs to (no timestamp in the fixture: none invented).
  const turnId = `turn:${conv.conversationId}#${conv.turnNumber}`;
  frames.push({
    id: turnId,
    label: `conversation · ${conv.conversationId} turn ${conv.turnNumber}`,
    kind: 'conversation',
    detail: `${conv.channel} · ${conv.subject} · model ${conv.agentModel}.`,
  });
  raw.push({ type: 'conversation-turn', ...conv });

  // The tool call (actual input) and the agent's structured claims: both made in that turn.
  const callId = `call:${request.toolCallId}`;
  const input = request.input;
  frames.push({
    id: callId,
    label: `tool call · ${request.toolName} · ${formatCentsUsd(input.amountCents, input.currency)} → ${input.destination}`,
    at: request.requestedAt,
    kind: 'tool',
    causes: [turnId],
    detail: `${request.toolCallId} · reason ${input.reasonCode} · order ${input.orderId}. Free-text memo redacted (untrusted).`,
  });
  raw.push({ type: 'tool-call', toolCallId: request.toolCallId, toolName: request.toolName, requestedAt: request.requestedAt, input: redactInput(input) });

  const claimId = `claim:${request.toolCallId}`;
  const claims = request.claims;
  frames.push({
    id: claimId,
    label: `agent claim · ${formatCentsUsd(claims.amountUsd * 100, claims.currency)} → ${claims.destination}`,
    at: request.requestedAt,
    kind: 'model',
    causes: [turnId],
    detail: `Structured claims (reason ${claims.reasonCode}). Prose: “${request.agentExplanation}”`,
  });
  raw.push({ type: 'agent-claims', toolCallId: request.toolCallId, claims, agentExplanation: request.agentExplanation });

  // Evaluator: one frame per field comparison. A mismatch is what the fixture marks as needing
  // attention; each links to the tool call, the claim and the trusted record it names.
  let firstMismatch: string | undefined;
  for (const c of evaluated.comparisons) {
    const id = `check:${c.key}`;
    const records = c.trustedSourceId
      .split('&')
      .map((part) => recordFrameId(part))
      .filter((id) => frames.some((f) => f.id === id));
    if (c.isMismatch && !firstMismatch) firstMismatch = id;
    frames.push({
      id,
      label: c.isMismatch ? `check · ${c.label} mismatch` : `check · ${c.label} ok`,
      kind: 'check',
      status: c.isMismatch ? 'error' : 'ok',
      marker: c.isMismatch,
      causes: [callId, claimId, ...records],
      detail: c.mismatchSummary ?? `Input ${c.actualInputDisplay} matches the claim and ${c.trustedSourceId}.`,
    });
    raw.push({ type: 'field-comparison', key: c.key, input: c.actualInputDisplay, claim: c.claimedDisplay, trusted: c.trustedExpectedDisplay, trustedSourceId: c.trustedSourceId, isMismatch: c.isMismatch });
  }

  // Lifecycle: the approval request, waiting on an operator.
  frames.push({
    id: `approval:${request.approvalId}`,
    label: `approval requested · ${evaluated.mismatches.length} mismatches`,
    at: request.requestedAt,
    kind: 'approval',
    status: 'pending',
    causes: [callId],
    detail: `${request.approvalId} expires ${request.expiresAt.slice(11, 16)} UTC. ${evaluated.disableApproveReason ?? ''}`.trim(),
  });
  raw.push({ type: 'approval-requested', approvalId: request.approvalId, toolCallId: request.toolCallId, status: evaluated.effectiveStatus, expiresAt: request.expiresAt, mismatches: evaluated.mismatches.length });

  return {
    id: 'agent-run',
    title: 'Agent run · refund approval (scenario B)',
    label: 'Agent run apr_f12_02_9104 replay',
    illustrative: false,
    source: 'site/app/experiments/agent-approval/fixtures.ts · apr-misleading-2500 + simulated decision history',
    frames,
    rawLog: raw.map((r) => JSON.stringify(r)).join('\n'),
    question: 'Which earlier step led to the failure?',
    answer:
      'The tool call made in conversation turn 5: its actual input sends $2,500.00 to acct_ext_9901_wire, while the agent claims $25.00 to orig_card_8830. Each mismatch check links back to that tool call, the claim and the trusted record; the decision history above it is unrelated (other conversations).',
    primaryMarker: firstMismatch,
    defaultValue: firstMismatch,
  };
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
