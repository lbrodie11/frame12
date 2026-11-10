/**
 * The FRAME/12 terminal grammar as pure functions: data and render capabilities in, text out.
 * Every function takes already-sanitized data (the renderers sanitize first) and never writes.
 *
 * Rules the grammar keeps (tests/grammar.test.mjs checks them on every gallery render):
 * - One marker chip per render, on the top (hero) finding's label, and nowhere else.
 * - Marker yellow is only ever a background; ink is the terminal's own foreground.
 * - No boxes: panels are a label line and an indented body; only the hero gets a heavy left rule.
 * - Every status is a word, not only a glyph or a color.
 * - No line is wider than the terminal, and no path is wrapped (paths are middle-truncated).
 */
import type { Capabilities } from '../core/capabilities.js';
import type { CutStatus, Finding, FindingStatus, Metric, ReceiptRef, Relation, RunStatus, Strength, Subject } from '../core/contract.js';
import { glyph, type GlyphName } from '../core/glyphs.js';
import { formatLink } from '../core/safety.js';
import { paint, styleLevel, type Role, type StyleLevel } from '../core/tokens.js';
import { graphemes, padEnd, stringWidth, truncateEnd, truncateMiddle, wrap } from '../core/width.js';

/** What a linear renderer needs to know about its stream. */
export interface RenderCaps {
  style: StyleLevel;
  unicode: boolean;
  ambiguousWide: boolean;
  links: boolean;
  columns: number;
  /** Print full paths on their own line when they had to be truncated. */
  verbose?: boolean;
}

/** Render capabilities for stdout (results) or stderr (narration). */
export function renderCapsFor(caps: Capabilities, stream: 'stdout' | 'stderr' = 'stdout', options: { verbose?: boolean } = {}): RenderCaps {
  const out = stream === 'stdout';
  return {
    style: styleLevel(out ? caps.colorLevel : caps.stderrColorLevel, out ? caps.attributes : caps.stderrAttributes),
    unicode: caps.unicode,
    ambiguousWide: caps.ambiguousWide,
    // detectCapabilities already turns links off for pipes unless --links / FRAME12_LINKS=1 asked
    // for them; an explicit request is honored on either stream.
    links: caps.links,
    columns: caps.columns,
    ...(options.verbose ? { verbose: true } : {}),
  };
}

/** Width tiers: <40 one fact per line; 40–79 standard; 80–119 two-column metrics; ≥120 wider truncation. */
export type WidthTier = 'narrow' | 'standard' | 'wide' | 'xwide';
export function widthTier(columns: number): WidthTier {
  if (columns < 40) return 'narrow';
  if (columns < 80) return 'standard';
  if (columns < 120) return 'wide';
  return 'xwide';
}

const g = (name: GlyphName, rc: RenderCaps) => glyph(name, rc);
const p = (text: string, role: Role, rc: RenderCaps) => paint(text, role, rc.style);
const w = (text: string, rc: RenderCaps) => stringWidth(text, rc);
const ellipsis = (rc: RenderCaps) => g('ellipsis', rc);

/** Fits plain text to `max` cells by truncating its end. */
function fit(text: string, max: number, rc: RenderCaps): string {
  return truncateEnd(text, Math.max(1, max), { ...rc, ellipsis: ellipsis(rc) });
}

/** A path (or any identifier) fitted to `max` cells by middle truncation; never wrapped. */
export function pathText(path: string, max: number, rc: RenderCaps): { text: string; truncated: boolean } {
  return truncateMiddle(path, Math.max(4, max), { ...rc, ellipsis: ellipsis(rc) });
}

/**
 * Removes trailing spaces from every line, including spaces inside a trailing styled span
 * (`x  \u001b[22m` → `x\u001b[22m`), so copied output and goldens carry no invisible padding.
 */
export function tidy(text: string): string {
  return text.replace(/ +((?:\u001b\[[0-9;]*m)*)(?=\n|$)/g, '$1');
}

// ------------------------------------------------------------------------------- words

export const CUT_STATUS_WORDS: Record<CutStatus, string> = {
  ok: 'done',
  warning: 'warning',
  error: 'failed',
  skipped: 'skipped',
  canceled: 'canceled',
};
const CUT_STATUS_GLYPH: Record<CutStatus, GlyphName> = { ok: 'ok', warning: 'warning', error: 'error', skipped: 'skipped', canceled: 'canceled' };
const CUT_STATUS_ROLE: Record<CutStatus, Role> = { ok: 'status-ok', warning: 'status-warning', error: 'status-danger', skipped: 'ink2', canceled: 'status-warning' };

export const FINDING_STATUS_WORDS: Record<FindingStatus, string> = {
  review: 'needs review',
  info: 'info',
  ok: 'ok',
  warning: 'warning',
  danger: 'danger',
};

export const RELATION_WORDS: Record<Relation, string> = {
  'history-only': 'changes with it, no code link',
  direct: 'references it directly',
  indirect: 'connected through other modules',
};

/** Full sentences for plain output: "<subject 1> <phrase> <subject 2>". */
export const RELATION_SENTENCES: Record<Relation, string> = {
  'history-only': 'changes together with subject 2, with no code link between them',
  direct: 'references subject 2 directly',
  indirect: 'is connected to subject 2 through other modules',
};

export const RUN_STATUS_WORDS: Record<RunStatus, string> = { completed: 'completed', failed: 'failed', canceled: 'canceled' };

/** A status glyph and its word; in ASCII the bracketed twin is itself a word (`[fail]`). */
export function cutStatus(status: CutStatus, rc: RenderCaps, word = CUT_STATUS_WORDS[status]): string {
  const mark = g(CUT_STATUS_GLYPH[status], rc);
  return p(`${mark} ${word}`, CUT_STATUS_ROLE[status], rc);
}

export function formatDuration(ms: number | undefined): string {
  if (ms === undefined || !Number.isFinite(ms)) return '';
  if (ms < 1000) return `${(ms / 1000).toFixed(2)}s`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

export function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/** `C-01`, `F-01`, `E-01`: presentation labels, numbered by reading order. */
export function label(prefix: 'C' | 'F' | 'E', n: number): string {
  return `${prefix}-${String(n).padStart(2, '0')}`;
}

// ------------------------------------------------------------------------------- grammar

export interface MastheadInput {
  product?: string;
  title: string;
  replay?: boolean;
}

/** Product and run title, then one rule. At the narrow tier there is no rule. */
export function masthead(input: MastheadInput, rc: RenderCaps): string {
  const product = input.product ?? 'FRAME/12';
  const sep = ` ${g('dot', rc)} `;
  const replay = input.replay ? `REPLAY${sep}` : '';
  const lines: string[] = [];
  if (widthTier(rc.columns) === 'narrow') {
    lines.push(p(fit(`${replay}${product}`, rc.columns, rc), 'ink2', rc));
    for (const l of wrap(input.title, rc.columns, rc)) lines.push(p(l, 'strong', rc));
    return lines.join('\n');
  }
  const head = fit(`${replay}${product}`, Math.floor(rc.columns / 2), rc) + sep;
  const headW = w(head, rc);
  const [firstTitle = '', ...restTitle] = wrap(input.title, rc.columns - headW, rc);
  const titleLines = [firstTitle, ...restTitle.map((l) => ' '.repeat(headW) + l)];
  lines.push(`${p(head, 'ink2', rc)}${p(titleLines[0] ?? '', 'strong', rc)}`);
  for (const l of titleLines.slice(1)) lines.push(p(l, 'strong', rc));
  lines.push(rule(rc));
  return lines.join('\n');
}

/** A full-width rule (`─`, ASCII `-`). */
export function rule(rc: RenderCaps): string {
  const ch = g('rule', rc);
  return p(ch.repeat(Math.max(1, Math.floor(rc.columns / w(ch, rc)))), 'rule', rc);
}

export interface CutInput {
  label: string;
  title: string;
  status: CutStatus;
  durationMs?: number;
  summary?: string;
  /** Overrides the status word (the run line says `completed`, not `done`). */
  word?: string;
}

/** `C-01 · READ HISTORY   ✓ done   2.4s`, with an optional summary line beneath. */
export function cut(input: CutInput, rc: RenderCaps): string {
  const status = cutStatus(input.status, rc, input.word);
  const statusW = w(status, rc);
  const duration = formatDuration(input.durationMs);
  const head = `${input.label} ${g('dot', rc)} `;
  const lines: string[] = [];
  if (widthTier(rc.columns) === 'narrow') {
    lines.push(`${p(input.label, 'strong', rc)} ${p(fit(input.title.toUpperCase(), rc.columns - input.label.length - 1, rc), 'strong', rc)}`);
    const fitsTogether = duration && 2 + statusW + 2 + duration.length <= rc.columns;
    lines.push(`  ${status}${fitsTogether ? `  ${p(duration, 'ink2', rc)}` : ''}`);
    if (duration && !fitsTogether) lines.push(`  ${p(duration, 'ink2', rc)}`);
  } else {
    // A fixed status column (cell 36, or as far right as fits) keeps every cut line aligned.
    const right = `${status}${duration ? `  ${p(duration, 'ink2', rc)}` : ''}`;
    const rightW = statusW + (duration ? 2 + duration.length : 0);
    const statusCol = Math.min(36, rc.columns - rightW);
    const title = fit(input.title.toUpperCase(), statusCol - w(head, rc) - 2, rc);
    const gap = Math.max(2, statusCol - w(head, rc) - w(title, rc));
    lines.push(tidy(`${p(head, 'ink2', rc)}${p(title, 'strong', rc)}${' '.repeat(gap)}${right}`));
  }
  if (input.summary) for (const l of wrap(input.summary, rc.columns - 2, rc)) lines.push(`  ${p(l, 'ink2', rc)}`);
  return lines.join('\n');
}

export interface PanelInput {
  /** The label line (already styled). */
  label: string;
  /** Body lines (already styled, already fitted to `columns - 2`). */
  body: string[];
  prominence: Finding['prominence'];
}

/** A label line and an indented body. No box; the hero alone gets a heavy left rule (`┃`). */
export function panel(input: PanelInput, rc: RenderCaps): string {
  const gutter = input.prominence === 'hero' ? `${p(g('heroRule', rc), 'strong', rc)} ` : '  ';
  return [input.label, ...input.body.map((l) => `${gutter}${l}`)].join('\n');
}

/** Inner width available to a panel body. */
export function panelInner(rc: RenderCaps): number {
  return Math.max(10, rc.columns - 2);
}

/** Two subjects stacked with a typed connector line between them. */
export function panelPair(top: Subject, bottom: Subject, relation: Relation | undefined, rc: RenderCaps, width = panelInner(rc)): string[] {
  const lines: string[] = [];
  const subjectLine = (s: Subject) => {
    const fitted = pathText(s.label, width, rc);
    lines.push(formatLink(fitted.text, s.href, rc.links));
    if (fitted.truncated && rc.verbose) lines.push(p(s.label, 'ink2', rc));
  };
  subjectLine(top);
  // Only draw a typed connector when the producer said how the subjects relate; never invent one.
  if (relation) {
    const arrow = g(relation === 'direct' ? 'directLink' : 'historyLink', rc);
    lines.push(p(`  ${arrow} ${fit(RELATION_WORDS[relation], width - 3 - w(arrow, rc), rc)}`, 'ink2', rc));
  }
  subjectLine(bottom);
  return lines;
}

/**
 * `▰▰▰▰▰▱▱▱ 62% (range 41–79%)`: bounded strength in glyphs, with the number always printed.
 * Fits `width`: the bar shrinks (to no bar at all), and the range moves to its own line, before
 * any number is dropped. Returns one or two lines joined by `\n`.
 */
export function toneBar(strength: Pick<Strength, 'value' | 'low' | 'high'>, rc: RenderCaps, width = panelInner(rc), cells = 8): string {
  const v = Math.min(1, Math.max(0, strength.value));
  const number = pct(v);
  const range =
    strength.low !== undefined && strength.high !== undefined ? `(range ${Math.round(strength.low * 100)}${g('rangeDash', rc)}${pct(strength.high)})` : '';
  const n = Math.max(0, Math.min(cells, width - number.length - 1));
  const on = Math.round(v * n);
  const bar = n >= 3 ? `${p(g('toneOn', rc).repeat(on), 'strong', rc)}${p(g('toneOff', rc).repeat(n - on), 'ink2', rc)} ` : '';
  const first = `${bar}${p(number, 'strong', rc)}`;
  if (!range) return first;
  if (w(first, rc) + 1 + range.length <= width) return `${first} ${p(range, 'ink2', rc)}`;
  return [first, ...wrap(range, width, rc).map((l) => p(l, 'ink2', rc))].join('\n');
}

export interface LabeledReceipt {
  label: string;
  receipt: ReceiptRef;
}

/** Short id: a commit SHA becomes 7 characters; other values are kept. */
export function shortValue(r: ReceiptRef): string {
  return r.kind === 'commit' && /^[0-9a-f]{8,64}$/i.test(r.value) ? r.value.slice(0, 7) : r.value;
}

/**
 * `E-01  1a2b3c4  2026-10-28  note`, one line each, links when the terminal supports them. Every
 * line fits `width`: the date and note are dropped before the value, and a long value (a path, a
 * tool call) is middle-truncated, with the full value on its own line under `verbose`.
 */
export function receiptList(items: LabeledReceipt[], rc: RenderCaps, width = panelInner(rc), more = 0): string[] {
  const lines: string[] = [];
  for (const { label: l, receipt: r } of items) {
    const short = shortValue(r);
    const avail = width - l.length - 2;
    const date = r.at && avail - w(short, rc) >= 12 ? r.at.slice(0, 10) : '';
    const value = pathText(short, avail - (date ? 12 : 0), rc);
    const head = `${l}  ${value.text}${date ? `  ${date}` : ''}`;
    const room = width - w(head, rc) - 2;
    const note = r.note && room >= 8 ? `  ${fit(r.note, room, rc)}` : '';
    lines.push(`${p(l, 'ink2', rc)}  ${formatLink(value.text, r.href, rc.links)}${date ? `  ${p(date, 'ink2', rc)}` : ''}${note}`);
    if (value.truncated && rc.verbose) lines.push(p(short, 'ink2', rc));
  }
  if (more > 0) lines.push(p(fit(`+${more} more receipt${more === 1 ? '' : 's'}`, width, rc), 'ink2', rc));
  return lines;
}

export interface CardLabels {
  frame: string;
  /** Number of the finding's first receipt (receipts are numbered across the render). */
  firstReceipt: number;
  /** Paint the frame label as the one marker chip. */
  marker: boolean;
}

/** Up to 3 receipts per card; the rest are counted. */
export const MAX_CARD_RECEIPTS = 3;

/** A finding: label line (frame, title, status word), subjects, strength and receipts. */
export function evidenceCard(finding: Finding, labels: CardLabels, rc: RenderCaps): string {
  const inner = panelInner(rc);
  // The chip is padded only where it is painted; without styling the words carry the meaning.
  const chipped = labels.marker && rc.style !== 'none';
  const chip = chipped ? p(` ${labels.frame} `, 'marker', rc) : p(labels.frame, 'strong', rc);
  const chipW = chipped ? labels.frame.length + 2 : labels.frame.length;
  const statusWord = FINDING_STATUS_WORDS[finding.status];
  const top = finding.prominence === 'hero' ? 'top finding' : finding.prominence;
  const meta = `${statusWord} ${g('dot', rc)} ${top} ${g('dot', rc)} ${finding.id}`;
  const [firstTitle = '', ...restTitle] = wrap(finding.title, rc.columns - chipW - 2, rc);
  const titleLines = [firstTitle, ...restTitle.map((l) => ' '.repeat(chipW + 2) + l)];
  const header = [`${chip}  ${p(titleLines[0] ?? '', 'strong', rc)}`, ...titleLines.slice(1).map((l) => p(l, 'strong', rc))];

  // Wrapped, never truncated: the id is data the reader may need to quote.
  const body: string[] = wrap(meta, inner, rc).map((l) => p(l, `status-${finding.status}`, rc));
  if (finding.summary) for (const l of wrap(finding.summary, inner, rc)) body.push(l);
  const [a, b, ...rest] = finding.subject;
  if (a && b) body.push(...panelPair(a, b, finding.relation, rc, inner));
  else if (a) body.push(formatLink(pathText(a.label, inner, rc).text, a.href, rc.links));
  for (const s of rest) body.push(formatLink(pathText(s.label, inner, rc).text, s.href, rc.links));
  if (finding.strength) {
    body.push(...toneBar(finding.strength, rc, inner).split('\n'));
    for (const l of wrap(finding.strength.label, inner, rc)) body.push(p(l, 'ink2', rc));
  }
  const receipts = finding.receipts ?? [];
  const shown = receipts.slice(0, MAX_CARD_RECEIPTS).map((receipt, i) => ({ label: label('E', labels.firstReceipt + i), receipt }));
  body.push(...receiptList(shown, rc, inner, receipts.length - shown.length));
  return panel({ label: header.join('\n'), body, prominence: finding.prominence }, rc);
}

/** A secondary finding in three short lines: label and title, then status facts, then subjects. */
export function compactFinding(finding: Finding, frame: string, rc: RenderCaps): string {
  const inner = panelInner(rc);
  const dot = ` ${g('dot', rc)} `;
  const count = (finding.receipts ?? []).length;
  const st = finding.strength;
  const strength = st ? `${pct(st.value)}${st.low !== undefined && st.high !== undefined ? ` (${Math.round(st.low * 100)}${g('rangeDash', rc)}${pct(st.high)})` : ''}` : '';
  const facts = [strength, `${count} receipt${count === 1 ? '' : 's'}`, FINDING_STATUS_WORDS[finding.status], finding.id]
    .filter(Boolean)
    .join(dot);
  const lines = [`${p(frame, 'strong', rc)}  ${fit(finding.title, rc.columns - frame.length - 2, rc)}`, ...wrap(facts, inner, rc).map((l) => `  ${p(l, 'ink2', rc)}`)];
  const [a, b] = finding.subject;
  if (a) {
    const link = finding.relation ? g(finding.relation === 'direct' ? 'directLink' : 'historyLink', rc) : g('dot', rc);
    const arrow = b ? ` ${link} ` : '';
    const together = w(a.label, rc) + w(arrow, rc) + (b ? w(b.label, rc) : 0);
    if (!b || together <= inner) {
      lines.push(`  ${p(`${a.label}${arrow}${b ? b.label : ''}`, 'ink2', rc)}`);
    } else {
      // Two paths that do not fit side by side are stacked rather than both mangled.
      lines.push(`  ${p(pathText(a.label, inner, rc).text, 'ink2', rc)}`);
      lines.push(`  ${p(`${arrow.trimStart()}${pathText(b.label, inner - w(arrow.trimStart(), rc), rc).text}`, 'ink2', rc)}`);
    }
  }
  return lines.join('\n');
}

/**
 * Metrics, aligned in label/value columns; two pairs per row when they fit (80+ columns). When a
 * label and its value do not fit side by side, they stack: label line, then the value wrapped
 * beneath it. Values are never truncated.
 */
export function metricRows(metrics: Metric[], rc: RenderCaps): string[] {
  if (metrics.length === 0) return [];
  const inner = panelInner(rc);
  const cells = metrics.map((m) => [m.label ?? m.name, `${m.value}${m.unit ? ` ${m.unit}` : ''}`] as const);
  const labelW = Math.max(...cells.map(([l]) => w(l, rc)));
  const valueW = Math.max(...cells.map(([, v]) => w(v, rc)));
  const colW = labelW + 2 + valueW;
  const tier = widthTier(rc.columns);
  const lines: string[] = [];
  if (tier === 'narrow' || colW > inner) {
    for (const [l, v] of cells) {
      for (const x of wrap(l, inner, rc)) lines.push(`  ${p(x, 'ink2', rc)}`);
      for (const x of wrap(v, inner - 2, rc)) lines.push(`    ${p(x, 'strong', rc)}`);
    }
    return lines;
  }
  const pair = ([l, v]: readonly [string, string]) => `${p(padEnd(l, labelW), 'ink2', rc)}  ${p(padEnd(v, valueW), 'strong', rc)}`;
  const two = tier !== 'standard' && 2 + colW * 2 + 4 <= rc.columns;
  for (let i = 0; i < cells.length; i += two ? 2 : 1) {
    const right = two && cells[i + 1] ? `    ${pair(cells[i + 1]!)}` : '';
    lines.push(tidy(`  ${pair(cells[i]!)}${right}`));
  }
  return lines;
}

export interface NextStep {
  /** A command to run, printed as-is (sanitized). */
  command: string;
  /** What it does. */
  description: string;
  /** The key that does it in the live view (live only). */
  key?: string;
}

/**
 * Splits a shell command into lines of at most `width` cells joined by ` \` continuations, so the
 * copied text still runs. Breaks between words; a word longer than a line is split with a trailing
 * `\` (backslash-newline joins the word back together in POSIX shells). Never truncates.
 */
export function wrapCommand(command: string, width: number, rc: RenderCaps): string[] {
  const max = Math.max(4, width);
  const lines: string[] = [];
  let line = '';
  const push = (text: string) => lines.push(text);
  for (const word of command.split(' ')) {
    // Every line but the last ends in ` \\`, so a line may hold at most `max - 2` cells of text.
    const candidate = line === '' ? word : `${line} ${word}`;
    if (w(candidate, rc) + 2 <= max) {
      line = candidate;
      continue;
    }
    if (line !== '') push(`${line} \\`);
    line = '';
    let rest = word;
    while (w(rest, rc) + 2 > max) {
      // Split off a piece that leaves at least one grapheme behind, so the word's end stays on
      // the line that may still take ` \\` and the space before the next word is never lost.
      const gs = graphemes(rest);
      let head = '';
      for (const ch of gs.slice(0, -1)) {
        if (w(head + ch, rc) + 1 > max) break;
        head += ch;
      }
      push(`${head}\\`);
      rest = rest.slice(head.length);
    }
    line = rest;
  }
  if (line !== '') push(line);
  return lines;
}

/** In linear output the hint bar is printed once at the end as "Next steps" commands. */
export function hintBar(steps: NextStep[], rc: RenderCaps): string[] {
  if (steps.length === 0) return [];
  const lines = [sectionLabel('NEXT STEPS', rc)];
  for (const s of steps) {
    for (const l of wrapCommand(s.command, rc.columns - 2, rc)) lines.push(`  ${p(l, 'strong', rc)}`);
    for (const l of wrap(s.description, rc.columns - 4, rc)) lines.push(`    ${p(l, 'ink2', rc)}`);
  }
  return lines;
}

export function sectionLabel(text: string, rc: RenderCaps): string {
  return p(text, 'strong', rc);
}
