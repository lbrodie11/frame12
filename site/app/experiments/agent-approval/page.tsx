'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Sheet,
  Scene,
  Panel,
  SegmentedControl,
  Button,
  Checkbox,
  Input,
  Badge,
  Tag,
  type TagStatus,
  Alert,
  Notice,
  ToastProvider,
  useOptionalToast,
  Breadcrumb,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from '@/components/frame12';
import { useChanged } from '@/hooks/use-on-twos';
import { useResolvedMotion } from '@/hooks/use-tempo';
import {
  type ApprovalScenarioId,
  type ClockPresetId,
  type ExperimentalToolApprovalRequest,
  type SimulatedDecisionHistoryEntry,
  type ApprovalLifecycleState,
  SIMULATED_CLOCK_PRESETS,
  INITIAL_APPROVAL_REQUESTS,
  INITIAL_DECISION_HISTORY,
  evaluateApprovalRequest,
  formatCentsUsdNumber,
} from './fixtures';

const LONG_ARG_COLLAPSE_THRESHOLD = 220;

function cloneInitialRequests(): ExperimentalToolApprovalRequest[] {
  return structuredClone(INITIAL_APPROVAL_REQUESTS);
}

function statusTagMeta(
  effectiveStatus: ApprovalLifecycleState,
  mismatchCount: number,
): { status: TagStatus; label: string } {
  if (effectiveStatus === 'approved') {
    return { status: 'success', label: 'APPROVED (LOCAL DEMO)' };
  }
  if (effectiveStatus === 'rejected') {
    return { status: 'danger', label: 'REJECTED (LOCAL DEMO)' };
  }
  if (effectiveStatus === 'correction-requested') {
    return { status: 'info', label: 'CORRECTION REQUESTED' };
  }
  if (effectiveStatus === 'expired') {
    return { status: 'warning', label: 'EXPIRED · STALE' };
  }
  if (effectiveStatus === 'superseded') {
    return { status: 'warning', label: 'CHANGED · SUPERSEDED' };
  }
  if (mismatchCount > 0) {
    return {
      status: 'danger',
      label: `${mismatchCount} MISMATCH${mismatchCount === 1 ? '' : 'ES'} DETECTED`,
    };
  }
  return { status: 'info', label: 'PENDING · 0 MISMATCHES' };
}

function decisionTagStatus(
  decision: SimulatedDecisionHistoryEntry['decision'],
): TagStatus {
  if (decision === 'APPROVED') return 'success';
  if (decision === 'REJECTED') return 'danger';
  if (decision === 'CORRECTION_REQUESTED') return 'info';
  return 'warning';
}

function renderSoftBreakUnderscores(text: string): React.ReactNode {
  if (!text.includes('_')) return text;
  const parts = text.split('_');
  return parts.map((part, idx) => (
    <React.Fragment key={idx}>
      {part}
      {idx < parts.length - 1 ? (
        <>
          _<wbr />
        </>
      ) : null}
    </React.Fragment>
  ));
}

function AgentApprovalInboxContent() {
  // Programmatic scrolls follow the viewer's tempo and the OS (smooth unless cut).
  const motion = useResolvedMotion('stepped');
  const toast = useOptionalToast();

  const [requests, setRequests] = React.useState<ExperimentalToolApprovalRequest[]>(
    cloneInitialRequests,
  );
  const [selectedId, setSelectedId] = React.useState<ApprovalScenarioId>('apr-misleading-2500');
  const [clockPresetId, setClockPresetId] = React.useState<ClockPresetId>('clock-default');
  const [ackByScenario, setAckByScenario] = React.useState<Record<string, boolean>>({});
  const [noteByScenario, setNoteByScenario] = React.useState<Record<string, string>>({});
  const [longArgExpandedByScenario, setLongArgExpandedByScenario] = React.useState<
    Record<string, boolean>
  >({});
  const [overrideOpenByScenario, setOverrideOpenByScenario] = React.useState<
    Record<string, boolean>
  >({});
  const [history, setHistory] = React.useState<SimulatedDecisionHistoryEntry[]>(
    INITIAL_DECISION_HISTORY,
  );

  const activeClock = React.useMemo(
    () =>
      SIMULATED_CLOCK_PRESETS.find((c) => c.id === clockPresetId) ??
      SIMULATED_CLOCK_PRESETS[0],
    [clockPresetId],
  );

  const evaluatedList = React.useMemo(
    () => requests.map((req) => evaluateApprovalRequest(req, activeClock.epochMs)),
    [requests, activeClock.epochMs],
  );

  const selectedEvaluated = React.useMemo(
    () =>
      evaluatedList.find((item) => item.request.scenarioId === selectedId) ??
      evaluatedList[0],
    [evaluatedList, selectedId],
  );

  const selectedReq = selectedEvaluated.request;
  const changedSelection = useChanged(selectedReq.scenarioId);

  const ackChecked = Boolean(ackByScenario[selectedReq.scenarioId]);
  const operatorNote = noteByScenario[selectedReq.scenarioId] ?? '';
  const isLongArgExpanded = Boolean(longArgExpandedByScenario[selectedReq.scenarioId]);

  const queueCounts = React.useMemo(() => {
    let pending = 0;
    let mismatched = 0;
    let stale = 0;
    let decided = 0;
    for (const ev of evaluatedList) {
      if (ev.effectiveStatus === 'approval-requested') {
        pending++;
        if (ev.mismatches.length > 0) mismatched++;
      } else if (ev.effectiveStatus === 'expired' || ev.effectiveStatus === 'superseded') {
        stale++;
      } else {
        decided++;
      }
    }
    return { pending, mismatched, stale, decided };
  }, [evaluatedList]);

  const focusPersistentQueueItem = React.useCallback((scenarioId: ApprovalScenarioId) => {
    const btn = document.getElementById(`exp-approval-select-${scenarioId}`);
    if (btn instanceof HTMLElement) {
      btn.focus();
    }
  }, []);

  const handleDecision = (
    decision: 'APPROVED' | 'REJECTED' | 'CORRECTION_REQUESTED',
  ) => {
    if (!selectedEvaluated.canApproveOrReject) return;
    if (
      decision === 'APPROVED' &&
      selectedEvaluated.mismatches.length > 0 &&
      !ackChecked
    ) {
      return;
    }

    const nextStatus: ApprovalLifecycleState =
      decision === 'APPROVED'
        ? 'approved'
        : decision === 'REJECTED'
          ? 'rejected'
          : 'correction-requested';

    // Move focus to the persistent queue item before this button disables itself
    focusPersistentQueueItem(selectedReq.scenarioId);

    setRequests((prev) =>
      prev.map((r) =>
        r.scenarioId === selectedReq.scenarioId ? { ...r, status: nextStatus } : r,
      ),
    );

    const trimmedNote = operatorNote.trim() || null;
    const recordedAck =
      decision === 'APPROVED' && selectedEvaluated.mismatches.length > 0
        ? selectedEvaluated.requiredAcknowledgmentText
        : null;

    const summaryText =
      decision === 'APPROVED'
        ? `Approved ${selectedReq.toolName} (${selectedReq.input.orderId}, $${formatCentsUsdNumber(selectedReq.input.amountCents)} ${selectedReq.input.currency} to ${selectedReq.input.destination}) with ${selectedEvaluated.mismatches.length} mismatch(es).`
        : decision === 'REJECTED'
          ? `Rejected ${selectedReq.toolName} (${selectedReq.input.orderId}, proposed $${formatCentsUsdNumber(selectedReq.input.amountCents)} ${selectedReq.input.currency} to ${selectedReq.input.destination}).`
          : `Requested correction on ${selectedReq.toolName} (${selectedReq.input.orderId}): returned to agent to reconcile $${formatCentsUsdNumber(selectedReq.input.amountCents)} ${selectedReq.input.currency} tool input against supporting records.`;

    const newEntry: SimulatedDecisionHistoryEntry = {
      id: `hist-${Date.now()}-${selectedReq.scenarioId}`,
      timestampIso: activeClock.iso,
      approvalId: selectedReq.approvalId,
      toolCallId: selectedReq.toolCallId,
      toolName: selectedReq.toolName,
      scenarioCode: selectedReq.scenarioCode,
      conversationId: selectedReq.conversation.conversationId,
      decision,
      actor: 'operator:demo-reviewer (local state)',
      summary: summaryText,
      acknowledgmentRecorded: recordedAck,
      operatorNote: trimmedNote,
    };

    setHistory((prev) => [newEntry, ...prev]);

    toast?.toast({
      status:
        decision === 'APPROVED'
          ? 'success'
          : decision === 'REJECTED'
            ? 'danger'
            : 'info',
      title: `Local Demo State: ${decision} (${selectedReq.scenarioCode})`,
      description:
        decision === 'APPROVED'
          ? `Simulated addToolApprovalResponse({ id: "${selectedReq.approvalId}", approved: true }). Zero external side effects.`
          : decision === 'REJECTED'
            ? `Simulated addToolApprovalResponse({ id: "${selectedReq.approvalId}", approved: false }). Execution denied.`
            : `Simulated addToolApprovalResponse({ id: "${selectedReq.approvalId}", approved: false, reason: "Requested parameter correction" }).`,
    });
  };

  const handleTryMisleadingScenario = () => {
    setSelectedId('apr-misleading-2500');
    focusPersistentQueueItem('apr-misleading-2500');
    const reviewPanel = document.getElementById('exp-approval-review-panel');
    if (reviewPanel instanceof HTMLElement) {
      reviewPanel.scrollIntoView({
        behavior: motion === 'cut' ? 'auto' : 'smooth',
        block: 'nearest',
      });
    }
  };

  const handleSimulateMidReviewChange = () => {
    if (!selectedEvaluated.canApproveOrReject) return;

    focusPersistentQueueItem(selectedReq.scenarioId);

    const nextTurn = selectedReq.conversation.latestTurnNumber + 1;
    const changeSummary = `Conversation ${selectedReq.conversation.conversationId} advanced to turn #${nextTurn} while operator was reviewing; customer updated order preferences, invalidating turn #${selectedReq.conversation.turnNumber} parameters.`;

    setRequests((prev) =>
      prev.map((r) =>
        r.scenarioId === selectedReq.scenarioId
          ? {
              ...r,
              status: 'superseded',
              conversation: {
                ...r.conversation,
                latestTurnNumber: nextTurn,
                changeSummary,
              },
            }
          : r,
      ),
    );

    const newEntry: SimulatedDecisionHistoryEntry = {
      id: `hist-change-${Date.now()}-${selectedReq.scenarioId}`,
      timestampIso: activeClock.iso,
      approvalId: selectedReq.approvalId,
      toolCallId: selectedReq.toolCallId,
      toolName: selectedReq.toolName,
      scenarioCode: selectedReq.scenarioCode,
      conversationId: selectedReq.conversation.conversationId,
      decision: 'SUPERSEDED_BLOCKED',
      actor: 'state-model:turn-guard (simulated)',
      summary: changeSummary,
      acknowledgmentRecorded: null,
      operatorNote: null,
    };

    setHistory((prev) => [newEntry, ...prev]);

    toast?.toast({
      status: 'warning',
      title: `Request ${selectedReq.approvalId} Marked Superseded`,
      description:
        'Upstream conversation state changed before a decision was made. Approve is now disabled.',
    });
  };

  const handleResetDemo = () => {
    setRequests(cloneInitialRequests());
    setSelectedId('apr-misleading-2500');
    setClockPresetId('clock-default');
    setAckByScenario({});
    setNoteByScenario({});
    setLongArgExpandedByScenario({});
    setOverrideOpenByScenario({});
    setHistory(INITIAL_DECISION_HISTORY);
    toast?.toast({
      status: 'info',
      title: 'Demonstration State Reset',
      description: 'Restored all 3 scenarios, clock (14:20 UTC), and simulated history.',
    });
  };

  const selectedBadgeMeta = statusTagMeta(
    selectedEvaluated.effectiveStatus,
    selectedEvaluated.mismatches.length,
  );

  const auditMemoText = selectedReq.input.auditMemo;
  const isAuditMemoLong = auditMemoText.length > LONG_ARG_COLLAPSE_THRESHOLD;
  const displayedAuditMemo =
    isAuditMemoLong && !isLongArgExpanded
      ? `${auditMemoText.slice(0, LONG_ARG_COLLAPSE_THRESHOLD)}…`
      : auditMemoText;

  const approveDisabled =
    !selectedEvaluated.canApproveOrReject ||
    (selectedEvaluated.mismatches.length > 0 && !ackChecked);

  return (
    <Sheet autoCut pegs id="exp-agent-approval-sheet">
      <header className="f12-hd">
        <div className="f12-stack-pair">
          <Breadcrumb
            id="exp-approval-breadcrumb"
            density="compact"
            items={[
              { label: 'Home', href: '/' },
              { label: 'Agents', href: '/agents' },
              { label: 'Agent Approval Inbox (Experimental Prototype)', current: true },
            ]}
          />
          <div className="f12-eyebrow">
            <Badge id="exp-approval-experimental-badge" burst={false}>
              EXPERIMENTAL PROTOTYPE · NOT A REGISTRY BLOCK
            </Badge>
            <Tag status="warning">EVIDENCE-FIRST HUMAN REVIEW</Tag>
            <Tag status="neutral">SIMULATED LOCAL DATA ONLY</Tag>
          </div>
          <h1 className="f12-title">Agent Approval Inbox</h1>
          <p className="f12-sub">
            An AI says it&apos;s refunding <strong>$25</strong>. Its actual instructions request{' '}
            <strong>$2,500</strong>. Would you catch the difference before approving it? Inspect
            the <strong>actual proposed tool name and arguments first</strong>, cross-check{' '}
            <strong>independent local fixture records second</strong>, and read the{' '}
            <strong>agent&apos;s own unverified explanation last</strong>.
          </p>
        </div>

        <div className="f12-stack-pair">
          <div
            className="f12-row-pair"
            role="group"
            aria-label="Scenario jump, injectable evaluation clock, and demonstration reset"
          >
            <Button
              id="exp-approval-try-misleading-btn"
              variant="primary"
              size="sm"
              onClick={handleTryMisleadingScenario}
            >
              Try the Misleading $2,500 Refund
            </Button>
            <SegmentedControl
              idPrefix="exp-approval-clock"
              ariaLabel="Injectable evaluation clock"
              options={SIMULATED_CLOCK_PRESETS.map((c) => ({
                value: c.id,
                label: c.label,
                unit: c.unit,
              }))}
              value={clockPresetId}
              onChange={(val) => setClockPresetId(val as ClockPresetId)}
            />
            <Button
              id="exp-approval-reset-btn"
              variant="secondary"
              size="sm"
              onClick={handleResetDemo}
            >
              Reset Demo State
            </Button>
          </div>
          <p className="f12-mono-note" id="exp-approval-clock-caption">
            CLOCK: <strong>{activeClock.iso}</strong> · {activeClock.caption}
          </p>
        </div>
      </header>

      <Notice
        id="exp-approval-prototype-notice"
        status="info"
        density="compact"
        title="Experimental Product-Validation Showcase — Not a Production Authorization System"
        description="All conversations, order records, policy thresholds, and decision history entries on this page come from deterministic in-memory fixtures. Clicking Approve or Reject mutates only local browser state with zero external API calls, payments, or durable persistence."
      />

      {/* Scene 1: C-01 (Compact Approval Queue) + C-02 (Evidence-Based Review Panel) */}
      <Scene
        gutter="scene"
        layout="split"
        className="f12-exp-approval-main-scene"
      >
        {/* C-01: Compact list of pending approval requests */}
        <Panel
          label="Pending approval requests from simulated AI conversations"
          id="exp-approval-queue-panel"
        >
          <div className="f12-stack-pair">
            <div className="f12-row-between">
              <h2 className="f12-section-title">Approval Queue</h2>
              <Tag status="neutral">
                {queueCounts.pending} PENDING · {queueCounts.mismatched} MISMATCH ·{' '}
                {queueCounts.stale} STALE
              </Tag>
            </div>
            <p className="f12-mono-note">
              Select a simulated tool-approval request to inspect its structured arguments,
              trusted fixture records, and field-level mismatch checks.
            </p>

            <ul
              className="f12-exp-queue-list"
              role="list"
              aria-label="Simulated tool approval requests"
            >
              {evaluatedList.map((ev) => {
                const req = ev.request;
                const isSelected = req.scenarioId === selectedReq.scenarioId;
                const meta = statusTagMeta(ev.effectiveStatus, ev.mismatches.length);

                return (
                  <li key={req.scenarioId}>
                    <button
                      type="button"
                      id={`exp-approval-select-${req.scenarioId}`}
                      className="f12-exp-queue-btn"
                      aria-pressed={isSelected}
                      onClick={() => setSelectedId(req.scenarioId)}
                    >
                      <div className="f12-row-between">
                        <Badge burst={false}>{req.scenarioCode}</Badge>
                        <Tag status={meta.status}>{meta.label}</Tag>
                      </div>
                      <p className="f12-exp-queue-title">{req.scenarioTitle}</p>
                      <p className="f12-exp-queue-meta">
                        TOOL: <strong>{req.toolName}</strong> · INPUT AMOUNT:{' '}
                        <strong>
                          ${formatCentsUsdNumber(req.input.amountCents)} {req.input.currency}
                        </strong>{' '}
                        (CLAIMED: $
                        {req.claims.amountUsd.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                        })}
                        )
                      </p>
                      <p className="f12-exp-queue-meta">
                        {req.conversation.conversationId} · Turn #{req.conversation.turnNumber} ·{' '}
                        {ev.remainingLabel}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>

            <Panel variant="quiet" label="Queue legend and reading-order rule">
              <div className="f12-stack-pair">
                <span className="f12-cmd-label">WHY READING ORDER MATTERS (EVIDENCE BEFORE PROSE)</span>
                <p className="f12-mono-note">
                  When an approval card leads with the model&apos;s polite explanation, operators
                  anchor on the prose and rubber-stamp destructive parameters. Cut C-02 enforces
                  strict DOM and visual priority: (1) Actual Tool Arguments → (2) Trusted Fixture
                  Context → (3) Unverified Agent Explanation.
                </p>
              </div>
            </Panel>
          </div>
        </Panel>

        {/* C-02: Focused review panel for the selected action */}
        <Panel
          label="Focused evidence-based review for selected AI tool action"
          id="exp-approval-review-panel"
        >
          <div className="f12-stack-scene">
            {/* Top Header & Pinned Mismatch Summary */}
            <div className="f12-stack-pair" id="exp-approval-pinned-summary">
              <div className="f12-row-between">
                <div className="f12-row-pair">
                  <Badge pop={changedSelection} burst={false}>
                    {selectedReq.scenarioCode} · {selectedReq.approvalId}
                  </Badge>
                  <Tag status={selectedBadgeMeta.status} id="exp-approval-active-status-tag">
                    {selectedBadgeMeta.label}
                  </Tag>
                </div>
                <span className="f12-mono-note" id="exp-approval-ttl-readout">
                  {selectedEvaluated.remainingLabel}
                </span>
              </div>

              <div className="f12-row-between">
                <h2 className="f12-section-title" id="exp-approval-selected-title">
                  {selectedReq.scenarioTitle}
                </h2>
                <span className="f12-mono-note">
                  Conversation: <strong>{selectedReq.conversation.conversationId}</strong> (
                  {selectedReq.conversation.customerHandle})
                </span>
              </div>

              {/* PINNED MISMATCH SUMMARY: Always at the top of C-02, never collapsible */}
              {selectedEvaluated.mismatches.length > 0 ? (
                <div
                  id="exp-approval-mismatch-banner"
                  className="f12-exp-mismatch-pin"
                  role="region"
                  aria-label="Pinned field mismatches between tool input, agent claims, and fixture records"
                >
                  <div className="f12-row-between">
                    <div className="f12-row-pair">
                      <Tag status="danger">
                        {selectedEvaluated.mismatches.length} STRUCTURED FIELD MISMATCH
                        {selectedEvaluated.mismatches.length === 1 ? '' : 'ES'} PINNED
                      </Tag>
                      <span className="f12-cmd-label">
                        CANNOT BE HIDDEN OR COLLAPSED BY LONG ARGUMENTS
                      </span>
                    </div>
                    <span className="f12-mono-note">
                      Compared deterministically (`claims` vs. `input` vs. `trustedRecords`)
                    </span>
                  </div>
                  <ul className="f12-exp-mismatch-list" role="list">
                    {selectedEvaluated.mismatches.map((m) => (
                      <li
                        key={m.key}
                        id={`exp-approval-pinned-mismatch-${m.key}`}
                        className="f12-exp-mismatch-item"
                      >
                        <div className="f12-row-between">
                          <strong>
                            [×] MISMATCH · {m.label} (<code>{m.key}</code>)
                          </strong>
                          <span className="f12-mono-note">{m.trustedSourceId}</span>
                        </div>
                        <p className="f12-body-copy">
                          Actual tool input executes{' '}
                          <span className="f12-exp-mismatch-val">{m.actualInputDisplay}</span> ·
                          Agent claimed <code>{m.claimedDisplay}</code> · Trusted fixture expects{' '}
                          <code>{m.trustedExpectedDisplay}</code>.
                        </p>
                        <p className="f12-mono-note">{m.trustedConstraintNote}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <Alert
                  id="exp-approval-aligned-banner"
                  status="success"
                  density="compact"
                  live="off"
                  title="0 Structured Mismatches Detected"
                  description={`All ${selectedEvaluated.comparisons.length} structured fields in ${selectedReq.toolName} match both the agent's structured claims and the labeled local fixture records.`}
                />
              )}
            </div>

            {/* STEP 01 (First in DOM & Visual Order): Actual Proposed Tool Name & Structured Arguments */}
            <div
              id="exp-approval-step-1-tool-args"
              className="f12-exp-step-block"
              role="region"
              aria-labelledby="exp-approval-step-1-heading"
            >
              <div className="f12-exp-step-head">
                <h3 className="f12-exp-step-title" id="exp-approval-step-1-heading">
                  01 · Inspect: Actual Proposed Tool Call &amp; Structured Arguments (Authoritative)
                </h3>
                <Tag status="info">INSPECT · STEP 1 OF 3</Tag>
              </div>

              <div className="f12-exp-kv-grid">
                <div className="f12-exp-kv-card">
                  <span className="f12-exp-kv-label">Proposed Tool Name</span>
                  <span className="f12-exp-kv-val" id="exp-approval-tool-name">
                    {selectedReq.toolName}
                  </span>
                </div>
                <div className="f12-exp-kv-card">
                  <span className="f12-exp-kv-label">Tool Call ID / Approval ID</span>
                  <span className="f12-exp-kv-val">
                    {selectedReq.toolCallId} · {selectedReq.approvalId}
                  </span>
                </div>
                <div className="f12-exp-kv-card">
                  <span className="f12-exp-kv-label">Raw Amount Cents (Executes)</span>
                  <span className="f12-exp-kv-val" id="exp-approval-raw-cents">
                    {selectedReq.input.amountCents.toLocaleString('en-US')} cents ($
                    {formatCentsUsdNumber(selectedReq.input.amountCents)}{' '}
                    {selectedReq.input.currency})
                  </span>
                </div>
                <div className="f12-exp-kv-card">
                  <span className="f12-exp-kv-label">Idempotency Key</span>
                  <span className="f12-exp-kv-val">{selectedReq.input.idempotencyKey}</span>
                </div>
              </div>

              <Table density="compact" id="exp-approval-comparison-table">
                <TableCaption>
                  Deterministic field-by-field comparison of actual proposed tool arguments against
                  trusted local fixture records and structured agent claims (mismatched fields
                  pinned first). Limitation: compares structured <code>claims</code>—does not
                  verify free-form prose on its own.
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Field</TableHead>
                    <TableHead scope="col">Actual Tool Input</TableHead>
                    <TableHead scope="col">Trusted Record</TableHead>
                    <TableHead scope="col">Agent Claim</TableHead>
                    <TableHead scope="col">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedEvaluated.comparisons.map((row) => (
                    <TableRow
                      key={row.key}
                      id={`exp-approval-field-row-${row.key}`}
                    >
                      <TableCell>
                        <strong>{row.label}</strong>
                        <div className="f12-mono-note">
                          <code>input.{row.key}</code>
                        </div>
                      </TableCell>
                      <TableCell>
                        {row.isMismatch ? (
                          <span className="f12-exp-mismatch-val">
                            [×] {row.actualInputDisplay}
                          </span>
                        ) : (
                          <code>{row.actualInputDisplay}</code>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>{renderSoftBreakUnderscores(row.trustedExpectedDisplay)}</div>
                      </TableCell>
                      <TableCell>
                        <code>{renderSoftBreakUnderscores(row.claimedDisplay)}</code>
                      </TableCell>
                      <TableCell className="f12-nowrap">
                        {row.isMismatch ? (
                          <Tag status="danger">MISMATCH</Tag>
                        ) : (
                          <Tag status="success">MATCH</Tag>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Long / Escaped / Adversarial String Argument Inspector */}
              <div className="f12-cmd-box" id="exp-approval-long-arg-box">
                <div className="f12-cmd-head">
                  <div className="f12-row-pair">
                    <span className="f12-cmd-label">
                      AUXILIARY STRING ARGUMENT: <code>input.auditMemo</code> (
                      {auditMemoText.length} CHARS)
                    </span>
                    <Tag status="neutral">INERT TEXT · NO HTML/SCRIPT EXECUTION</Tag>
                  </div>
                  {isAuditMemoLong ? (
                    <Button
                      id="exp-approval-toggle-long-arg"
                      variant="secondary"
                      size="sm"
                      aria-expanded={isLongArgExpanded}
                      aria-controls="exp-approval-audit-memo-pre"
                      onClick={() =>
                        setLongArgExpandedByScenario((prev) => ({
                          ...prev,
                          [selectedReq.scenarioId]: !isLongArgExpanded,
                        }))
                      }
                    >
                      {isLongArgExpanded
                        ? 'Collapse Long String'
                        : `Expand Full String (${auditMemoText.length} chars)`}
                    </Button>
                  ) : null}
                </div>
                <pre
                  id="exp-approval-audit-memo-pre"
                  className="f12-cmd-pre"
                >
                  {displayedAuditMemo}
                </pre>
              </div>

              <details className="f12-tbl" id="exp-approval-raw-json-details">
                <summary>
                  Inspect complete raw JSON tool payload (<code>part.input</code>)
                </summary>
                <pre className="f12-cmd-pre" id="exp-approval-raw-json-pre">
                  {JSON.stringify(selectedReq.input, null, 2)}
                </pre>
              </details>
            </div>

            {/* STEP 02 (Second in DOM & Visual Order): Independent Supporting Context from Labeled Local Fixtures */}
            <div
              id="exp-approval-step-2-trusted-context"
              className="f12-exp-step-block"
              role="region"
              aria-labelledby="exp-approval-step-2-heading"
            >
              <div className="f12-exp-step-head">
                <h3 className="f12-exp-step-title" id="exp-approval-step-2-heading">
                  02 · Inspect: Independent Supporting Context (Labeled Local Fixture Records)
                </h3>
                <Tag status="neutral">INSPECT · STEP 2 OF 3</Tag>
              </div>
              <p className="f12-mono-note">
                Fetched directly from labeled local fixture records by <code>orderId</code> and
                policy tier—never summarized by the language model.
              </p>

              <div className="f12-stack-pair">
                {selectedEvaluated.evaluatedTrustedRecords.length === 0 ? (
                  <Alert
                    status="danger"
                    density="compact"
                    live="off"
                    title="Missing Independent Supporting Evidence"
                    description="No trusted fixture records were supplied for this request. All fields are marked as unverified mismatches."
                  />
                ) : (
                  selectedEvaluated.evaluatedTrustedRecords.map((rec) => (
                    <Panel
                      key={rec.recordId}
                      variant="quiet"
                      label={`${rec.title} (${rec.sourceFile})`}
                    >
                      <div className="f12-stack-pair">
                        <div className="f12-row-between">
                          <strong>{rec.title}</strong>
                          <Tag status="neutral">{rec.sourceFile}</Tag>
                        </div>
                        <span className="f12-mono-note">
                          Fixture snapshot timestamp: {rec.snapshotAt}
                        </span>
                        <div
                          className={
                            rec.facts.length === 3 ? 'f12-exp-kv-grid-3' : 'f12-exp-kv-grid'
                          }
                        >
                          {rec.facts.map((fact) => (
                            <div key={fact.label} className="f12-exp-kv-card">
                              <div className="f12-row-between">
                                <span className="f12-exp-kv-label">{fact.label}</span>
                                <Tag status={fact.matchesProposedInput ? 'success' : 'danger'}>
                                  {fact.matchesProposedInput ? 'OK' : 'CONFLICT'}
                                </Tag>
                              </div>
                              <span className="f12-exp-kv-val">{fact.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </Panel>
                  ))
                )}
              </div>
            </div>

            {/* STEP 03 (Third in DOM & Visual Order): Agent's description (unverified) */}
            <div
              id="exp-approval-step-3-agent-description"
              className="f12-exp-step-block"
              role="region"
              aria-labelledby="exp-approval-step-3-heading"
            >
              <div className="f12-exp-step-head">
                <h3 className="f12-exp-step-title" id="exp-approval-step-3-heading">
                  03 · Inspect: Agent&apos;s description (unverified)
                </h3>
                <Tag status="warning">INSPECT · STEP 3 OF 3 · UNTRUSTED PROSE</Tag>
              </div>

              <div className="f12-exp-unverified-box">
                <div className="f12-row-between">
                  <span className="f12-cmd-label">
                    AGENT PROSE RATIONALE ({selectedReq.conversation.agentModel} · TURN #
                    {selectedReq.conversation.turnNumber})
                  </span>
                  <Tag status="warning">DO NOT USE AS AUTHORIZATION EVIDENCE</Tag>
                </div>
                <blockquote
                  className="f12-exp-prose-quote"
                  id="exp-approval-agent-prose"
                >
                  &ldquo;{selectedReq.agentExplanation}&rdquo;
                </blockquote>
                <p className="f12-mono-note" id="exp-approval-prose-limitation-note">
                  <strong>Verification Scope Limitation:</strong> Deterministic comparison checks
                  the structured <code>claims</code> object against tool <code>input</code> and{' '}
                  <code>trustedRecords</code>. It does <strong>not</strong> verify whether free-form
                  AI prose is truthful on its own—always authorize based on Step 01 and Step 02.
                </p>
                <div className="f12-cmd-box">
                  <div className="f12-cmd-head">
                    <span className="f12-cmd-label">
                      AGENT STRUCTURED <code>claims</code> OBJECT (COMPARED FIELD-BY-FIELD IN STEP
                      01; FREE-FORM PROSE IS NOT VERIFIED)
                    </span>
                  </div>
                  <pre className="f12-cmd-pre" id="exp-approval-agent-claims-pre">
                    {JSON.stringify(selectedReq.claims, null, 2)}
                  </pre>
                </div>
              </div>
            </div>

            {/* STEP 04: Post-Approval Explanation & Decision Controls */}
            <div
              id="exp-approval-step-4-decision-gate"
              className="f12-exp-step-block"
              role="region"
              aria-labelledby="exp-approval-step-4-heading"
            >
              <div className="f12-exp-step-head">
                <h3 className="f12-exp-step-title" id="exp-approval-step-4-heading">
                  Decide · Operator Action Gate &amp; Post-Approval Impact
                </h3>
                <Tag status="neutral">DECIDE · STEP 4 (AFTER INSPECTING STEPS 1–3)</Tag>
              </div>

              {selectedEvaluated.mismatches.length > 0 ? (
                <Alert
                  id="exp-approval-recommended-safer-path"
                  status="danger"
                  density="compact"
                  live="off"
                  title="Recommended Safer Decision: Reject Tool Call or Request Correction"
                  description={`The AI claims $${selectedReq.claims.amountUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}, while the actual tool call executes $${formatCentsUsdNumber(selectedReq.input.amountCents)} ${selectedReq.input.currency} with ${selectedEvaluated.mismatches.length} policy/record mismatch(es). In real operations, reject this tool call or return it for parameter correction rather than overriding.`}
                />
              ) : null}

              <div className="f12-exp-kv-grid">
                <div className="f12-exp-kv-card">
                  <span className="f12-exp-kv-label">Target System (Simulated)</span>
                  <span className="f12-exp-kv-val">
                    {selectedReq.postApprovalEffect.targetSystem}
                  </span>
                </div>
                <div className="f12-exp-kv-card">
                  <span className="f12-exp-kv-label">AI SDK 7 Client Callback</span>
                  <span className="f12-exp-kv-val">
                    <code>{selectedReq.postApprovalEffect.sdkCallbackPreview}</code>
                  </span>
                </div>
              </div>

              <p className="f12-body-copy" id="exp-approval-consequence-text">
                <strong>What would happen after approval:</strong>{' '}
                {selectedReq.postApprovalEffect.operationSummary}{' '}
                <span className="f12-mono-note">
                  ({selectedReq.postApprovalEffect.reversibility})
                </span>
              </p>

              {/* Plain-language reason when Approve is disabled due to expiry, change, or prior decision */}
              {!selectedEvaluated.canApproveOrReject &&
              selectedEvaluated.disableApproveReason ? (
                <Alert
                  id="exp-approval-disabled-reason"
                  status={
                    selectedEvaluated.effectiveStatus === 'approved' ? 'success' : 'warning'
                  }
                  density="compact"
                  live="polite"
                  title={
                    selectedEvaluated.effectiveStatus === 'expired' ||
                    selectedEvaluated.effectiveStatus === 'superseded'
                      ? 'Stale Request Blocked by State Model'
                      : 'Decision Recorded in Local Demo State'
                  }
                  description={selectedEvaluated.disableApproveReason}
                />
              ) : null}

              <Input
                id="exp-approval-operator-note"
                density="compact"
                label="Operator decision note (optional, saved to simulated local history)"
                value={operatorNote}
                disabled={!selectedEvaluated.canApproveOrReject}
                onChange={(e) =>
                  setNoteByScenario((prev) => ({
                    ...prev,
                    [selectedReq.scenarioId]: e.target.value,
                  }))
                }
              />

              <div className="f12-row-between">
                <div className="f12-row-pair">
                  {selectedEvaluated.mismatches.length === 0 ? (
                    <Button
                      id="exp-approval-approve-btn"
                      variant="primary"
                      disabled={approveDisabled}
                      onClick={() => handleDecision('APPROVED')}
                    >
                      Approve {selectedReq.toolName} ($
                      {formatCentsUsdNumber(selectedReq.input.amountCents)})
                    </Button>
                  ) : null}
                  <Button
                    id="exp-approval-reject-btn"
                    variant={selectedEvaluated.mismatches.length > 0 ? 'primary' : 'secondary'}
                    disabled={!selectedEvaluated.canApproveOrReject}
                    onClick={() => handleDecision('REJECTED')}
                  >
                    Reject Tool Call
                  </Button>
                  <Button
                    id="exp-approval-request-correction-btn"
                    variant="secondary"
                    disabled={!selectedEvaluated.canApproveOrReject}
                    onClick={() => handleDecision('CORRECTION_REQUESTED')}
                  >
                    Request Correction
                  </Button>
                </div>

                <div className="f12-row-pair">
                  <Button
                    id="exp-approval-simulate-change-btn"
                    variant="secondary"
                    size="sm"
                    disabled={!selectedEvaluated.canApproveOrReject}
                    onClick={handleSimulateMidReviewChange}
                  >
                    Simulate Upstream Turn Change
                  </Button>
                </div>
              </div>

              {/* Collapsed Unsafe Override Disclosure (only when mismatches exist, placed below recommended actions) */}
              {selectedEvaluated.mismatches.length > 0 ? (
                <details
                  className="f12-tbl"
                  id="exp-approval-unsafe-override-details"
                  open={Boolean(overrideOpenByScenario[selectedReq.scenarioId])}
                  onToggle={(e) => {
                    const isOpen = (e.currentTarget as HTMLDetailsElement).open;
                    setOverrideOpenByScenario((prev) =>
                      prev[selectedReq.scenarioId] === isOpen
                        ? prev
                        : { ...prev, [selectedReq.scenarioId]: isOpen },
                    );
                  }}
                >
                  <summary id="exp-approval-unsafe-override-summary">
                    Test an unsafe override (audit-trail demonstration only — not recommended)
                  </summary>
                  <div className="f12-stack-pair">
                    <div className="f12-row-pair">
                      <Tag status="danger">
                        UNSAFE OVERRIDE DEMONSTRATION · AUDIT-TRAIL TEST ONLY
                      </Tag>
                      <span className="f12-mono-note">
                        Not recommended: acknowledging a mismatch does not make a policy-violating
                        tool call safe. Exists only to test how an audit log records an explicit
                        operator override.
                      </span>
                    </div>
                    {selectedEvaluated.requiredAcknowledgmentText ? (
                      <Checkbox
                        id="exp-approval-mismatch-ack"
                        checked={ackChecked}
                        disabled={!selectedEvaluated.canApproveOrReject}
                        onCheckedChange={(checked) =>
                          setAckByScenario((prev) => ({
                            ...prev,
                            [selectedReq.scenarioId]: checked,
                          }))
                        }
                        label={selectedEvaluated.requiredAcknowledgmentText}
                        hint="If overridden and approved, this exact acknowledgment statement is recorded in the simulated decision history."
                      />
                    ) : null}
                    <div className="f12-row-pair">
                      <Button
                        id="exp-approval-approve-btn"
                        variant="secondary"
                        disabled={approveDisabled}
                        onClick={() => handleDecision('APPROVED')}
                      >
                        Override &amp; Approve {selectedReq.toolName} ($
                        {formatCentsUsdNumber(selectedReq.input.amountCents)})
                      </Button>
                    </div>
                  </div>
                </details>
              ) : null}
            </div>
          </div>
        </Panel>
      </Scene>

      {/* Scene 2: C-03 (Simulated Decision-History Timeline) + Quiet SDK Mapping & Boundary Notes */}
      <Scene gutter="change" layout="stack">
        <Panel
          label="Simulated local decision-history timeline"
          id="exp-approval-history-panel"
        >
          <div className="f12-stack-pair">
            <div className="f12-row-between">
              <div className="f12-row-pair">
                <h2 className="f12-section-title">Simulated Decision-History Timeline</h2>
                <Tag status="neutral">
                  IN-MEMORY DEMO TIMELINE · NOT A DURABLE AUDIT LOG
                </Tag>
              </div>
              <span className="f12-mono-note">
                {history.length} EVENT{history.length === 1 ? '' : 'S'} RECORDED
              </span>
            </div>

            <Table density="compact" id="exp-approval-history-table">
              <TableCaption>
                Simulated local decision log showing operator approvals, rejections, correction
                requests, recorded mismatch acknowledgments, and automatic TTL/turn-change blocks.
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Timestamp (UTC)</TableHead>
                  <TableHead scope="col">Scenario &amp; Approval ID</TableHead>
                  <TableHead scope="col">Decision</TableHead>
                  <TableHead scope="col">Summary &amp; Recorded Mismatch Acknowledgment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((entry) => (
                  <TableRow key={entry.id} id={`exp-approval-history-row-${entry.id}`}>
                    <TableCell className="f12-nowrap">
                      <code>{entry.timestampIso}</code>
                    </TableCell>
                    <TableCell>
                      <strong>{entry.scenarioCode}</strong>
                      <div className="f12-mono-note">
                        <code>{entry.approvalId}</code> · {entry.conversationId}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Tag status={decisionTagStatus(entry.decision)}>{entry.decision}</Tag>
                    </TableCell>
                    <TableCell>
                      <div>{entry.summary}</div>
                      {entry.acknowledgmentRecorded ? (
                        <div className="f12-mono-note">
                          <strong>Recorded Acknowledgment:</strong> {entry.acknowledgmentRecorded}
                        </div>
                      ) : null}
                      {entry.operatorNote ? (
                        <div className="f12-mono-note">
                          <strong>Operator Note:</strong> {entry.operatorNote}
                        </div>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Panel>

        <Panel
          variant="quiet"
          label="Vercel AI SDK 7 toolApproval mapping and production security boundaries"
          id="exp-approval-architecture-panel"
        >
          <div className="f12-stack-pair">
            <div className="f12-row-between">
              <span className="f12-cmd-label">
                TECHNICAL DETAILS · VERCEL AI SDK 7, OWASP ASI09 &amp; PRODUCTION BOUNDARIES
              </span>
              <div className="f12-row-pair">
                <Link href="/agents" className="f12-link-btn" id="exp-approval-to-agents">
                  AI Agent Skill →
                </Link>
                <Link
                  href="/blocks/developer-console"
                  className="f12-link-btn"
                  id="exp-approval-to-console"
                >
                  Developer Console Block →
                </Link>
              </div>
            </div>

            <details className="f12-tbl" id="exp-approval-technical-details">
              <summary>
                Show implementation notes (Vercel AI SDK 7 <code>toolApproval</code> mapping, OWASP
                ASI09 trust-exploitation background, and production authorization requirements)
              </summary>
              <div className="f12-exp-kv-grid-3">
                <div className="f12-exp-kv-card">
                  <span className="f12-exp-kv-label">1. AI SDK 7 `toolApproval` Mapping</span>
                  <span className="f12-mono-note">
                    Maps <code>approvalId</code> → <code>part.approval.id</code>,{' '}
                    <code>toolCallId</code> → <code>part.toolCallId</code>, <code>toolName</code> →{' '}
                    <code>part.toolName</code>, and <code>input</code> → <code>part.input</code>{' '}
                    when <code>streamText</code> is configured with{' '}
                    <code>toolApproval: {'{'} [toolName]: &apos;user-approval&apos; {'}'}</code> and
                    resumed via{' '}
                    <code>addToolApprovalResponse({'{'} id, approved, reason {'}'})</code>.
                  </span>
                </div>
                <div className="f12-exp-kv-card">
                  <span className="f12-exp-kv-label">
                    2. Why Inline Chat Confirmation Is Insufficient (OWASP ASI09)
                  </span>
                  <span className="f12-mono-note">
                    Standard chat confirmation cards place the Approve button directly below the
                    model&apos;s persuasive prose. Under OWASP ASI09 (Human-Agent Trust
                    Exploitation), an injected or hallucinating agent can state &ldquo;$25
                    refund&rdquo; while passing <code>amountCents: 250000</code> ($2,500.00).
                  </span>
                </div>
                <div className="f12-exp-kv-card">
                  <span className="f12-exp-kv-label">
                    3. What Production Requires Beyond This UI
                  </span>
                  <span className="f12-mono-note">
                    A production system must enforce server-side authentication/RBAC, cryptographic
                    binding of approvals to canonicalized tool arguments, server-enforced TTL and
                    single-use idempotency tokens, and an append-only server audit log.
                  </span>
                </div>
              </div>
            </details>
          </div>
        </Panel>
      </Scene>
    </Sheet>
  );
}

export default function AgentApprovalExperimentPage() {
  return (
    <ToastProvider>
      <AgentApprovalInboxContent />
    </ToastProvider>
  );
}
