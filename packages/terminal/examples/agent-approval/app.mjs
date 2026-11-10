#!/usr/bin/env node
/**
 * Reference app: a tool call an agent wants to make, presented for an explicit y/N decision.
 *
 *   node app.mjs [--scenario apr-misleading-2500|apr-ordinary-25|apr-expired-stale]
 *                [--clock clock-default|clock-early|clock-late] [--timeout <seconds>] [--format …]
 *
 * The scenarios are FRAME/12's own agent-approval fixtures (site/app/experiments/agent-approval/
 * fixtures.ts), read as they are; their comparison logic (`evaluateApprovalRequest`) decides what
 * matches. This app adds no judgement of its own: it shows the tool call's real arguments, every
 * place where the agent's claims differ from them or from the trusted records, and then asks.
 *
 * - It never approves by itself. Only `y` approves, once; anything else denies.
 * - A timeout (default 30 s) denies. Without a terminal to ask (stdin is not a TTY, CI, a pipe) it
 *   denies, and says why. An expired or superseded request is denied without asking.
 * - Arguments are sanitized and redacted: free text from an untrusted source (the audit memo) is
 *   never printed, only its length; tokens are masked everywhere else.
 *
 * Exit code: 0 approved, 1 denied (for any reason), 2 usage error.
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { option, startApp } from '../lib/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const FIXTURES = path.resolve(HERE, '../../../../site/app/experiments/agent-approval/fixtures.ts');

/** Argument keys whose values are free text from an untrusted source: never printed. */
export const UNTRUSTED_TEXT_KEYS = new Set(['auditMemo']);

/** The tool call's arguments as `key = value` lines, untrusted free text withheld. */
export function argumentLines(input) {
  return Object.entries(input).map(([key, value]) =>
    UNTRUSTED_TEXT_KEYS.has(key) ? `${key} = [withheld: untrusted free text, ${String(value).length} characters]` : `${key} = ${typeof value === 'string' ? value : JSON.stringify(value)}`,
  );
}

/** "EXPIRES IN 13M (14:33 UTC)" → "expires in 13 min (14:33 UTC)". */
export function windowLabel(label) {
  return label.toLowerCase().replace(/\butc\b/g, 'UTC').replace(/(\d+)m\b/g, '$1 min').replace(/(\d+)h\b/g, '$1 h');
}

/** Findings for one evaluated request: the call itself, then one per mismatch. */
export function findingsFor(evaluated) {
  const r = evaluated.request;
  const mismatches = evaluated.mismatches;
  const call = {
    id: r.toolCallId,
    title: `${r.toolName} wants to run: ${r.postApprovalEffect.operationSummary.replace(/^WARNING: /, '')}`,
    summary: [
      mismatches.length > 0 ? `${mismatches.length} of ${evaluated.comparisons.length} fields differ from what the agent claims or from the trusted records.` : `All ${evaluated.comparisons.length} fields match the agent's claims and the trusted records.`,
      `Reversibility: ${r.postApprovalEffect.reversibility}`,
      `Target: ${r.postApprovalEffect.targetSystem}.`,
      evaluated.disableApproveReason ? `Cannot be approved: ${evaluated.disableApproveReason}` : `Window: ${windowLabel(evaluated.remainingLabel)}.`,
    ].join(' '),
    subject: [
      { kind: 'tool', label: r.toolName },
      { kind: 'conversation', label: `${r.conversation.conversationId} (${r.conversation.channel})` },
    ],
    prominence: 'hero',
    status: mismatches.length > 0 ? 'danger' : evaluated.canApproveOrReject ? 'review' : 'warning',
    receipts: argumentLines(r.input).map((line) => ({ kind: 'tool-call', value: line, note: 'actual tool input' })),
  };
  const fields = mismatches.map((m) => ({
    id: `${r.toolCallId}-${m.key}`,
    title: `${m.label}: the call says ${m.actualInputDisplay}, the agent says ${m.claimedDisplay}`,
    // The fixture's mismatch summary already quotes the constraint; add only what it lacks.
    summary: [m.mismatchSummary ?? m.trustedConstraintNote, `Trusted record: ${m.trustedExpectedDisplay}.`].join(' '),
    subject: [{ kind: 'field', label: m.key }],
    prominence: 'primary',
    status: 'danger',
    receipts: [{ kind: 'log', value: m.trustedSourceId, note: 'trusted record' }],
  }));
  const records = {
    id: `${r.toolCallId}-records`,
    title: 'What the comparison is based on',
    summary: `Trusted records, read from local fixtures. The agent's own explanation is a claim, not evidence: "${r.agentExplanation}"`,
    subject: r.trustedRecords.map((t) => ({ kind: 'record', label: t.title })),
    prominence: 'secondary',
    status: 'info',
    receipts: r.trustedRecords.map((t) => ({ kind: 'log', value: t.sourceFile, note: `snapshot ${t.snapshotAt}` })),
  };
  return [call, ...fields, records];
}

/**
 * Asks y/N on the terminal. Resolves with how it was decided; never approves except on `y`.
 * Exactly one answer is taken: after it, the keyboard is released.
 */
export function ask(question, { stdin = process.stdin, stderr = process.stderr, timeoutMs }) {
  return new Promise((resolve) => {
    stderr.write(question);
    let done = false;
    const finish = (approved, how) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      stdin.off('data', onData);
      try {
        stdin.setRawMode?.(false);
      } catch {
        // already closed
      }
      stdin.pause();
      stderr.write(`${approved ? 'y' : 'N'}\n`);
      resolve({ approved, how });
    };
    const onData = (chunk) => {
      const key = String(chunk)[0];
      if (key === 'y' || key === 'Y') finish(true, 'approved with y');
      else if (key === '\u0003') finish(false, 'Ctrl-C');
      else finish(false, key === '\r' || key === '\n' ? 'Enter (the default is No)' : `"${key === '\u001b' ? 'Esc' : key}"`);
    };
    const timer = setTimeout(() => finish(false, `no answer within ${Math.round(timeoutMs / 1000)} s`), timeoutMs);
    try {
      stdin.setRawMode?.(true);
    } catch {
      // not a terminal: the caller checked
    }
    stdin.resume();
    stdin.on('data', onData);
  });
}

/** Imports the site's fixtures (TypeScript, which this Node strips) without its module-type notice. */
async function loadFixtures() {
  const emit = process.emitWarning;
  process.emitWarning = function quiet(warning, ...rest) {
    const code = typeof rest[0] === 'object' ? rest[0]?.code : rest[1];
    if (code === 'MODULE_TYPELESS_PACKAGE_JSON') return;
    return emit.call(process, warning, ...rest);
  };
  try {
    return await import(pathToFileURL(FIXTURES).href);
  } finally {
    process.emitWarning = emit;
  }
}

async function main(argv) {
  const fx = await loadFixtures();
  const scenario = option(argv, '--scenario') ?? 'apr-misleading-2500';
  const clock = fx.SIMULATED_CLOCK_PRESETS.find((c) => c.id === (option(argv, '--clock') ?? 'clock-default'));
  const request = fx.INITIAL_APPROVAL_REQUESTS.find((r) => r.scenarioId === scenario);
  const timeoutS = Number(option(argv, '--timeout') ?? 30);
  if (!request || !clock || !(timeoutS > 0)) {
    process.stderr.write(`Usage: --scenario ${fx.INITIAL_APPROVAL_REQUESTS.map((r) => r.scenarioId).join('|')} --clock ${fx.SIMULATED_CLOCK_PRESETS.map((c) => c.id).join('|')} --timeout <seconds>\n`);
    return 2;
  }
  const evaluated = fx.evaluateApprovalRequest(request, clock.epochMs);

  const runId = `approval-${request.approvalId}`.replace(/[^\w-]/g, '-');
  const startedAt = new Date().toISOString();
  const { run, emit, cut, cuts, caps } = startApp(argv, { runId, product: 'Agent approval' });
  const title = `Approve ${request.toolName} for ${request.conversation.customerHandle}?`;
  emit('run-start', { title, product: 'Agent approval', command: `${request.toolName}(${request.toolCallId})` });
  const findings = findingsFor(evaluated);
  await cut('read-call', 'Read the tool call', async () => {
    emit('finding', { cut: 'read-call', finding: findings[0] });
    return { summary: `${Object.keys(request.input).length} arguments, as the tool would receive them.` };
  });
  await cut('compare', 'Compare with the claims and the trusted records', async () => {
    for (const f of findings.slice(1)) emit('finding', { cut: 'compare', finding: f });
    return evaluated.mismatches.length > 0
      ? { status: 'warning', summary: `${evaluated.mismatches.length} fields do not match what the agent says.` }
      : { summary: 'Every field matches.' };
  });
  emit('run-end', { status: 'completed' });
  emit('snapshot', {
    snapshot: {
      schemaVersion: 1,
      runId,
      title,
      status: 'completed',
      startedAt,
      finishedAt: new Date().toISOString(),
      cuts,
      metrics: [
        { name: 'mismatches', label: 'Mismatched fields', value: evaluated.mismatches.length },
        { name: 'fields', label: 'Fields compared', value: evaluated.comparisons.length },
      ],
      findings,
      warnings: evaluated.mismatches.length > 0 ? ['The agent’s description of this call does not match the call itself. Read the arguments, not the prose.'] : [],
    },
  });
  await run.end();

  // The decision: only a person at a terminal can approve, and only with `y`.
  let decision;
  if (!evaluated.canApproveOrReject) decision = { approved: false, how: `the request cannot be approved: ${(evaluated.disableApproveReason ?? evaluated.effectiveStatus).replace(/^Approve disabled: /, '')}` };
  else if (!caps.interactive) decision = { approved: false, how: 'no one can answer here (stdin is not a terminal), and approval is never automatic' };
  else {
    const mism = evaluated.mismatches.length;
    decision = await ask(
      `\n${mism > 0 ? `${mism} fields differ from what the agent says. ` : ''}Approve ${request.toolName} as called above? ${request.postApprovalEffect.reversibility.split('.')[0]}. [y/N] (No in ${timeoutS} s) `,
      { timeoutMs: timeoutS * 1000 },
    );
  }
  process.stderr.write(`${decision.approved ? 'Approved' : 'Denied'}: ${decision.how.replace(/\.+$/, '')}.\n`);
  if (decision.approved) process.stdout.write(`${JSON.stringify({ approvalId: request.approvalId, approved: true })}\n`);
  return decision.approved ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
