// The agent-run demo for the ExposureScrubber docs. SERVER-SIDE ONLY: it imports the
// agent-approval fixtures, whose tool input carries an untrusted memo (an injection test
// payload). The docs page builds this in its server component (app/components/[slug]/page.tsx)
// and passes only the result (redacted frames and raw log) to client components, so the
// unredacted fixture never reaches the browser. Never import this from a 'use client' module.
//
// Derived only from the /experiments/agent-approval fixtures (scenario `apr-misleading-2500`
// plus the simulated decision history). Every frame is one fixture record or one evaluator
// result; every `causes` link is a link the fixture data states (a request belongs to its
// conversation turn; a field comparison names its tool-input field, its claim field and its
// trusted record source). Nothing is inferred from order. Pure and deterministic.
import type { ExposureFrame } from '@/components/frame12';
import type { ExposureDemo } from './exposure-demo-data';
import {
  INITIAL_APPROVAL_REQUESTS,
  INITIAL_DECISION_HISTORY,
  SIMULATED_CLOCK_PRESETS,
  evaluateApprovalRequest,
  formatCentsUsd,
} from '../../app/experiments/agent-approval/fixtures';

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

