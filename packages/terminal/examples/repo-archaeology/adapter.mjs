/**
 * Repo Archaeology v1 JSON (`repo-archaeology diff --json`, `explain --json`) → @frame12/terminal
 * findings, metrics and a snapshot. Pure: no I/O, no analysis of its own. Every number shown comes
 * from Repo Archaeology's output, unchanged.
 *
 * - One finding per diff suggestion: "<to> usually changes with <from>". Its strength is Repo
 *   Archaeology's co-change confidence with the 95% Wilson interval it reports.
 * - The track record (did <to> follow within the window when it was left out?) is quoted as
 *   historical activity, never as correctness: it counts follow-up changes, not fixes.
 * - Evidence commits become receipts; `explain` adds the counterexample counts for the top pair.
 */

export const RA_SCHEMA_VERSION = 1;

/** Repo Archaeology relationship → contract relation (only the ones the contract has words for). */
const RELATIONS = { ghost: 'history-only', direct: 'direct', indirect: 'indirect' };

/** A stable domain id for a pair (FNV-1a of both paths): never a presentation label. */
export function pairId(from, to) {
  let h = 0x811c9dc5;
  for (const ch of `${from}\u0000${to}`) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `pair-${h.toString(16).padStart(8, '0')}`;
}

const pct = (x) => `${Math.round(x * 100)}%`;
const changes = (n) => `${n} change${n === 1 ? '' : 's'}`;
/** Repo Archaeology dates are days; the contract wants timestamps (midnight UTC, as in its fixtures). */
const day = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d ?? '') ? `${d}T00:00:00.000Z` : undefined);

/** Checks the inputs are what this adapter maps (schema v1 from repo-archaeology). */
export function assertRaJson(json, command) {
  if (json?.schemaVersion !== RA_SCHEMA_VERSION) throw new Error(`repo-archaeology ${command} --json: expected schemaVersion ${RA_SCHEMA_VERSION}, got ${JSON.stringify(json?.schemaVersion)}`);
  if (json?.tool?.name !== 'repo-archaeology') throw new Error(`repo-archaeology ${command} --json: not repo-archaeology output`);
}

/**
 * The track record, in words that never claim correctness, and scoped to the window Repo
 * Archaeology evaluated: it counts whether <to> changed soon after a change to <from> that left it
 * out, which is activity, not proof of a fix.
 */
export function trackRecordSentence(s) {
  const tr = s.trackRecord;
  if (!tr) return undefined;
  if (tr.reason === 'limited_history') return 'Track record: not enough history to replay (no claim either way).';
  const when = tr.evaluated?.from && tr.evaluated?.to ? ` between ${tr.evaluated.from} and ${tr.evaluated.to}` : '';
  if (typeof tr.fired !== 'number') return undefined;
  if (tr.fired === 0) return `Track record: no change to ${s.from}${when} left ${s.to} out, so there is nothing to replay (historical activity, not correctness).`;
  if (typeof tr.confirmed !== 'number') return `Track record: ${changes(tr.fired)} to ${s.from}${when} left ${s.to} out (historical activity, not correctness).`;
  return `Track record: ${changes(tr.fired)} to ${s.from}${when} left ${s.to} out; it changed within ${tr.windowHours} h after ${tr.confirmed} of them (historical activity, not correctness).`;
}

/** One finding per suggestion, in Repo Archaeology's order (its score). */
export function findingsFromDiff(diff, explain) {
  assertRaJson(diff, 'diff');
  const top = diff.suggestions[0];
  return diff.suggestions.map((s, i) => {
    const summary = [`${s.shared} of ${s.fromChanges} changes to ${s.from} also changed ${s.to} (${pct(s.confidence)}; the other way ${s.shared} of ${s.toChanges}, ${pct(s.reverseConfidence)}).`, `Why: ${s.why}.`, trackRecordSentence(s)];
    const isTop = explain && s === top && explain.from === s.from && explain.to === s.to;
    const ce = isTop ? explain.counterexamples : undefined;
    if (ce && typeof ce.fromWithoutToTotal === 'number' && typeof ce.toWithoutFromTotal === 'number') {
      summary.push(`Counterexamples: ${s.from} changed without ${s.to} ${ce.fromWithoutToTotal} times, and ${s.to} without ${s.from} ${ce.toWithoutFromTotal} times.`);
    }
    const relation = RELATIONS[s.relationship];
    return {
      id: pairId(s.from, s.to),
      title: `${s.to} usually changes with ${s.from}`,
      summary: summary.filter(Boolean).join(' '),
      subject: [
        { kind: 'file', label: s.from },
        { kind: 'file', label: s.to },
      ],
      strength: {
        value: s.confidence,
        ...(s.interval && typeof s.interval.low === 'number' ? { low: s.interval.low, high: s.interval.high } : {}),
        label: 'co-change confidence (95% interval)',
      },
      prominence: i === 0 ? 'hero' : i < 3 ? 'primary' : 'secondary',
      status: 'review',
      ...(relation ? { relation } : {}),
      receipts: (s.evidence ?? []).map((c) => ({
        kind: 'commit',
        value: c.hash,
        ...(day(c.date) ? { at: day(c.date) } : {}),
        note: c.subject,
      })),
    };
  });
}

/** What Repo Archaeology measured, as metrics. */
export function metricsFromDiff(diff) {
  const m = diff.meta;
  return [
    { name: 'changed-files', label: 'Changed files', value: diff.changed.length },
    { name: 'suggestions', label: 'Suggestions', value: diff.totalSuggestions ?? diff.suggestions.length },
    { name: 'commits-analyzed', label: 'Commits analyzed', value: m.commitsAnalyzed },
    { name: 'files-seen', label: 'Files seen', value: m.files },
  ];
}

/** The snapshot for a finished run. `cuts` are the app's own (with their measured durations). */
export function snapshotFrom({ runId, title, startedAt, finishedAt, cuts, diff, explain }) {
  return {
    schemaVersion: 1,
    runId,
    title,
    status: cuts.some((c) => c.status === 'error') ? 'failed' : 'completed',
    startedAt,
    finishedAt,
    cuts,
    metrics: metricsFromDiff(diff),
    findings: findingsFromDiff(diff, explain),
    warnings: [...(diff.meta.warnings ?? [])],
  };
}
