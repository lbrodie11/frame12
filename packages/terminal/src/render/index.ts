/**
 * @frame12/terminal/render: zero-dependency linear renderers.
 *
 * - `renderJson`: the snapshot verbatim, for automation.
 * - `renderPlain`: no styling, ASCII template text, one self-describing fact per line (CI logs,
 *   pipes, screen readers, diffs). Independent of terminal width.
 * - `renderRich`: the FRAME/12 grammar with styling, glyphs and links as the terminal allows.
 * - `createLinearWriter`: drives the renderers from an event stream: narration (cuts, warnings)
 *   to stderr as append-only lines, results (from the snapshot) to stdout.
 *
 * Every renderer sanitizes its input first, so untrusted strings never reach the grammar raw.
 */
import type { Capabilities } from '../core/capabilities.js';
import type { CutStatus, Finding, LogLevel, RunStatus, Snapshot, TerminalEvent } from '../core/contract.js';
import { glyph } from '../core/glyphs.js';
import { createSanitizer, type SafetyOptions } from '../core/safety.js';
import { paint } from '../core/tokens.js';
import { createStreamValidator, describeIssues, type StreamValidatorOptions } from '../core/validate.js';
import { wrap } from '../core/width.js';
import {
  CUT_STATUS_WORDS,
  FINDING_STATUS_WORDS,
  RELATION_SENTENCES,
  RUN_STATUS_WORDS,
  compactFinding,
  cut,
  evidenceCard,
  formatDuration,
  hintBar,
  label,
  masthead,
  metricRows,
  pct,
  renderCapsFor,
  sectionLabel,
  tidy,
  widthTier,
  type NextStep,
  type RenderCaps,
} from './grammar.js';

export * from './grammar.js';
export { GLYPHS, glyph, type GlyphName, type GlyphSpec } from '../core/glyphs.js';

export interface RenderOptions {
  /** Product name for the masthead. Default `FRAME/12`. */
  product?: string;
  /** Commands printed once at the end as "Next steps". */
  nextSteps?: NextStep[];
  /** Sanitizer options (redaction hook, link policy). */
  safety?: SafetyOptions;
  /**
   * Cut labels already shown in narration (cut id → `C-02`), so results use the same numbers when
   * cuts ran in parallel or the snapshot lists them in another order. Unlisted cuts are numbered
   * after the listed ones.
   */
  cutLabels?: ReadonlyMap<string, string>;
}

/** Cut labels for a snapshot: narration's labels first, then the rest in snapshot order. */
export function labelCuts(cuts: Snapshot['cuts'], known?: ReadonlyMap<string, string>): string[] {
  let next = (known?.size ?? 0) + 1;
  return cuts.map((c) => known?.get(c.cut) ?? label('C', next++));
}

// Characters JSON.stringify leaves raw that a terminal could act on or reorder: DEL, C1 controls,
// line/paragraph separators and bidi controls. Escaping them keeps the JSON identical in meaning.
const JSON_UNSAFE = /[\u007f-\u009f\u2028\u2029\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;

/** The snapshot verbatim (2-space JSON, trailing newline). Re-rendering parsed output is byte-identical. */
export function renderJson(snapshot: Snapshot): string {
  return `${JSON.stringify(snapshot, null, 2).replace(JSON_UNSAFE, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`)}\n`;
}

const PROMINENCE_ORDER = { hero: 0, primary: 1, secondary: 2 } as const;

/** Findings in reading order (hero, primary, secondary; stable), with frame and receipt numbers. */
export function orderFindings(findings: readonly Finding[]): Array<{ finding: Finding; frame: string; firstReceipt: number }> {
  const sorted = findings.map((f, i) => ({ f, i })).sort((a, b) => PROMINENCE_ORDER[a.f.prominence] - PROMINENCE_ORDER[b.f.prominence] || a.i - b.i);
  let receipt = 1;
  return sorted.map(({ f }, n) => {
    const out = { finding: f, frame: label('F', n + 1), firstReceipt: receipt };
    receipt += (f.receipts ?? []).length;
    return out;
  });
}

function countBy(findings: readonly Finding[]): string {
  const c = { hero: 0, primary: 0, secondary: 0 };
  for (const f of findings) c[f.prominence]++;
  const parts = [c.hero ? `${c.hero} top` : '', c.primary ? `${c.primary} primary` : '', c.secondary ? `${c.secondary} secondary` : ''].filter(Boolean);
  return parts.join(', ');
}

const RUN_TO_CUT: Record<RunStatus, CutStatus> = { completed: 'ok', failed: 'error', canceled: 'canceled' };

// ------------------------------------------------------------------------------------ plain

/**
 * Plain text: no escape sequences, no glyphs, ASCII template text, one self-describing fact per
 * line, every receipt and full path printed. Stable for diffing (independent of terminal width).
 */
export function renderPlain(snapshot: Snapshot, options: RenderOptions = {}): string {
  const san = createSanitizer({ ...options.safety, ascii: true });
  const s = san.snapshot(snapshot);
  const out: string[] = [];
  const product = san.text(options.product ?? 'FRAME/12');
  const cutLabel = labelCuts(s.cuts, options.cutLabels);
  if (s.replay) out.push('Replay: this output was recorded earlier; it is not a live run.');
  out.push(`${product} run "${s.title}" (${s.runId}): ${RUN_STATUS_WORDS[s.status]}`);
  out.push(`Run started ${s.startedAt}, finished ${s.finishedAt}.`);
  s.cuts.forEach((c, i) => {
    const d = formatDuration(c.durationMs);
    out.push(`Cut ${cutLabel[i]} ${c.cut} "${c.title}": ${CUT_STATUS_WORDS[c.status]}${d ? ` in ${d}` : ''}`);
    if (c.summary) out.push(`Cut ${cutLabel[i]} note: ${c.summary}`);
  });
  if (s.error) out.push(`Error: ${s.error}`);
  out.push(s.findings.length === 0 ? 'Findings: none' : `Findings: ${s.findings.length} (${countBy(s.findings)})`);
  for (const { finding: f, frame, firstReceipt } of orderFindings(s.findings)) {
    const top = f.prominence === 'hero' ? 'top finding' : f.prominence;
    out.push(`Finding ${frame} ${f.id} (${top}, ${FINDING_STATUS_WORDS[f.status]}): ${f.title}`);
    if (f.summary) out.push(`Finding ${frame} summary: ${f.summary}`);
    f.subject.forEach((sub, i) => out.push(`Finding ${frame} subject ${i + 1} (${sub.kind}): ${sub.label}${sub.href ? ` <${sub.href}>` : ''}`));
    // A relation is stated only when the producer gave one; plain never invents it.
    if (f.subject.length >= 2 && f.relation) out.push(`Finding ${frame} relation (${f.relation}): subject 1 ${RELATION_SENTENCES[f.relation]}`);
    if (f.strength) {
      const range = f.strength.low !== undefined && f.strength.high !== undefined ? ` (range ${Math.round(f.strength.low * 100)}-${pct(f.strength.high)})` : '';
      out.push(`Finding ${frame} strength: ${pct(f.strength.value)}${range}, ${f.strength.label}`);
    }
    (f.receipts ?? []).forEach((r, i) => {
      const at = r.at ? ` ${r.at.slice(0, 10)}` : '';
      out.push(`Receipt ${label('E', firstReceipt + i)} for ${frame} (${r.kind}): ${r.value}${at}${r.note ? `: ${r.note}` : ''}${r.href ? ` <${r.href}>` : ''}`);
    });
  }
  for (const m of s.metrics) out.push(`Metric ${m.name}${m.label ? ` "${m.label}"` : ''}: ${m.value}${m.unit ? ` ${m.unit}` : ''}`);
  for (const wn of s.warnings) out.push(`Warning: ${wn}`);
  for (const step of options.nextSteps ?? []) out.push(`Next step: ${san.text(step.command)} (${san.text(step.description)})`);
  out.push(`End of results: ${s.findings.length} finding${s.findings.length === 1 ? '' : 's'}, ${s.warnings.length} warning${s.warnings.length === 1 ? '' : 's'}, run ${RUN_STATUS_WORDS[s.status]}.`);
  return `${out.join('\n')}\n`;
}

// ------------------------------------------------------------------------------------- rich

/** The FRAME/12 grammar: masthead, run line, findings by prominence, metrics, warnings, next steps. */
export function renderRich(snapshot: Snapshot, rc: RenderCaps, options: RenderOptions = {}): string {
  const san = createSanitizer({ ...options.safety, ascii: !rc.unicode, ambiguousWide: rc.ambiguousWide });
  const s = san.snapshot(snapshot);
  const p = (t: string, role: Parameters<typeof paint>[1]) => paint(t, role, rc.style);
  const blank = (n: number) => Array<string>(n).fill('');
  const out: string[] = [];
  const narrow = widthTier(rc.columns) === 'narrow';

  out.push(masthead({ product: san.text(options.product ?? 'FRAME/12'), title: s.title, ...(s.replay ? { replay: true } : {}) }, rc));
  const cutLabel = labelCuts(s.cuts, options.cutLabels);

  // Run line: status word, cut count, total time. Cuts are listed only when something went wrong.
  const total = s.cuts.reduce((acc, c) => acc + (c.durationMs ?? 0), 0);
  const runCut = cut(
    { label: 'RUN', title: `${s.cuts.length} cut${s.cuts.length === 1 ? '' : 's'}`, status: RUN_TO_CUT[s.status], word: RUN_STATUS_WORDS[s.status], ...(total ? { durationMs: total } : {}) },
    rc,
  );
  out.push(...blank(1), runCut);
  s.cuts.forEach((c, i) => {
    if (c.status !== 'ok') out.push(cut({ label: cutLabel[i]!, title: c.title, status: c.status, ...(c.durationMs !== undefined ? { durationMs: c.durationMs } : {}), ...(c.summary ? { summary: c.summary } : {}) }, rc));
  });
  if (s.error) {
    out.push(...blank(1), sectionLabel('ERROR', rc));
    for (const l of wrap(s.error, rc.columns - 2, rc)) out.push(`  ${p(l, 'status-danger')}`);
  }

  // Findings, by prominence. The marker chip goes on the first hero's label and nowhere else.
  out.push(...blank(2));
  const tally = s.findings.length === 0 ? 'none' : `${s.findings.length} (${countBy(s.findings)})`;
  const tallyLines = wrap(tally, rc.columns - 10, { ...rc, indent: '' });
  out.push(`${sectionLabel('FINDINGS', rc)}  ${p(tallyLines[0] ?? '', 'ink2')}`);
  for (const l of tallyLines.slice(1)) out.push(`          ${p(l, 'ink2')}`);
  if (s.findings.length === 0) {
    const why = s.status === 'completed' ? 'The run completed and found nothing to report.' : `The run ${RUN_STATUS_WORDS[s.status]} before producing findings.`;
    for (const l of wrap(why, rc.columns - 2, rc)) out.push(`  ${p(l, 'ink2')}`);
  }
  let markerUsed = false;
  let inSecondary = false;
  for (const { finding, frame, firstReceipt } of orderFindings(s.findings)) {
    if (finding.prominence === 'secondary' && !narrow) {
      if (!inSecondary) out.push(...blank(1));
      inSecondary = true;
      out.push(compactFinding(finding, frame, rc));
      continue;
    }
    const marker: boolean = finding.prominence === 'hero' && !markerUsed;
    markerUsed ||= marker;
    out.push(...blank(1), evidenceCard(finding, { frame, firstReceipt, marker }, rc));
  }

  if (s.metrics.length > 0) out.push(...blank(2), sectionLabel('METRICS', rc), ...metricRows(s.metrics, rc));
  if (s.warnings.length > 0) {
    out.push(...blank(2), sectionLabel('WARNINGS', rc));
    const mark = glyph('warning', rc);
    for (const wn of s.warnings) {
      const lines = wrap(`${mark} warning: ${wn}`, rc.columns - 2, { ...rc, indent: '  ' });
      for (const l of lines) out.push(`  ${p(l, 'status-warning')}`);
    }
  }
  const steps = (options.nextSteps ?? []).map((st) => ({ ...st, command: san.text(st.command), description: san.text(st.description) }));
  if (steps.length > 0) out.push(...blank(2), ...hintBar(steps, rc));
  return `${tidy(out.join('\n'))}\n`;
}

// ------------------------------------------------------------------------------- streaming

export interface WritableLike {
  write(chunk: string): unknown;
}

export type LinearFormat = 'rich' | 'plain' | 'json';

export interface LinearWriterOptions extends RenderOptions {
  format: LinearFormat;
  caps: Capabilities;
  stdout: WritableLike;
  stderr: WritableLike;
  /** Also narrate `info` and `debug` log lines. */
  verbose?: boolean;
  /** Stream validation options (`lifecycle: false` for partial streams). */
  validation?: StreamValidatorOptions;
}

export interface LinearResult {
  /** The run status from `run-end`, if one arrived. */
  status: RunStatus | undefined;
  /** The authoritative snapshot, if one arrived. */
  snapshot: Snapshot | undefined;
  /** Events dropped as invalid. */
  invalid: number;
  /** Events ignored as unknown types (forward compatibility). */
  ignored: number;
}

export interface LinearWriter {
  /** Accepts one event (parsed JSON). Never throws. */
  write(raw: unknown): void;
  /**
   * Narrates a log line that did not arrive as an event (the host's own, or a child process's
   * through `spawnLogged`), exactly like a `log` event: errors and warnings always, the rest only
   * when verbose. Sanitized and redacted like everything else.
   */
  log(level: LogLevel, text: string): void;
  /** Ends the stream; reports what was missing. */
  end(): LinearResult;
}

/**
 * Drives a linear renderer from an event stream. Narration (cut endings, warnings, errors, dropped
 * events) goes to stderr as append-only lines: no cursor movement and no spinner, ever. Results go
 * to stdout once, from the snapshot, so `cmd > out.txt` captures only results and `--json` writes
 * only JSON to stdout. Nothing is delayed: every line is written as soon as its event arrives.
 */
export function createLinearWriter(options: LinearWriterOptions): LinearWriter {
  const err = renderCapsFor(options.caps, 'stderr', options.verbose ? { verbose: true } : {});
  const out = renderCapsFor(options.caps, 'stdout', options.verbose ? { verbose: true } : {});
  const plainErr: RenderCaps = { ...err, style: 'none', unicode: false, links: false };
  const narr = options.format === 'rich' ? err : plainErr;
  const san = createSanitizer({ ...options.safety, ascii: !narr.unicode, ambiguousWide: narr.ambiguousWide });
  const stream = createStreamValidator(options.validation);
  const cutLabels = new Map<string, string>();
  const cutTitles = new Map<string, string>();
  let status: RunStatus | undefined;
  let snapshot: Snapshot | undefined;
  let invalid = 0;
  let ignored = 0;
  let seen = 0;

  let narrated = false;
  const say = (line: string) => {
    narrated = true;
    options.stderr.write(`${tidy(line)}\n`);
  };
  const warn = (text: string) => {
    if (options.format === 'plain') return say(`Warning: ${san.text(text)}`);
    const mark = glyph('warning', narr);
    for (const l of wrap(`${mark} warning: ${san.text(text)}`, narr.columns, { ...narr, indent: '  ' })) say(paint(l, 'status-warning', narr.style));
  };

  const narrateLog = (level: LogLevel, text: string) => {
    if (level !== 'error' && level !== 'warn' && !options.verbose) return;
    for (const line of text.split('\n')) {
      if (options.format === 'plain') say(`Log ${level}: ${line}`);
      else for (const l of wrap(`${level}: ${line}`, narr.columns, { ...narr, indent: '  ' })) say(paint(l, level === 'error' ? 'status-danger' : 'ink2', narr.style));
    }
  };

  return {
    log(level, text) {
      narrateLog(level, san.text(text, 'log', 'log'));
    },
    write(raw) {
      seen++;
      const r = stream.push(raw);
      if (!r.ok) {
        if (r.ignorable) ignored++;
        else invalid++;
        warn(`${r.ignorable ? 'ignored' : 'dropped'} event ${seen}: ${describeIssues(r.issues)}`);
        return;
      }
      const ev: TerminalEvent = san.event(r.value);
      switch (ev.type) {
        case 'cut-start': {
          cutLabels.set(ev.cut, label('C', cutLabels.size + 1));
          cutTitles.set(ev.cut, ev.title);
          return;
        }
        case 'cut-end': {
          if (options.format === 'json') return;
          // A cut whose start was never seen (a partial stream) still gets the next C-xx label.
          if (!cutLabels.has(ev.cut)) cutLabels.set(ev.cut, label('C', cutLabels.size + 1));
          const l = cutLabels.get(ev.cut)!;
          const title = cutTitles.get(ev.cut) ?? ev.cut;
          if (options.format === 'plain') {
            const d = formatDuration(ev.durationMs);
            say(`Cut ${l} ${ev.cut} "${title}": ${CUT_STATUS_WORDS[ev.status]}${d ? ` in ${d}` : ''}`);
            if (ev.summary) say(`Cut ${l} note: ${ev.summary}`);
            return;
          }
          say(cut({ label: l, title, status: ev.status, ...(ev.durationMs !== undefined ? { durationMs: ev.durationMs } : {}), ...(ev.summary ? { summary: ev.summary } : {}) }, narr));
          return;
        }
        case 'warning':
          return warn(ev.message);
        case 'log':
          return narrateLog(ev.level, ev.text);
        case 'run-end':
          status = ev.status;
          return;
        case 'snapshot': {
          // Results come from the snapshot, never from narration. JSON is written verbatim.
          snapshot = r.value.type === 'snapshot' ? r.value.snapshot : undefined;
          if (!snapshot) return;
          // On a terminal, separate narration from results with one blank line (pair gutter).
          if (narrated && options.format !== 'json' && options.caps.stderrIsTTY && options.caps.isTTY) say('');
          const withLabels = { ...options, cutLabels: cutLabels };
          if (options.format === 'json') options.stdout.write(renderJson(snapshot));
          else if (options.format === 'plain') options.stdout.write(renderPlain(snapshot, withLabels));
          else options.stdout.write(renderRich(snapshot, out, withLabels));
          return;
        }
        default:
          return;
      }
    },
    end() {
      for (const i of stream.finish()) warn(i.message);
      if (!snapshot) warn('No result snapshot arrived, so no results are shown. Narration is not a substitute for results.');
      return { status, snapshot, invalid, ignored };
    },
  };
}
