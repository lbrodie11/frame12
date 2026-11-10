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
import { type StyleLevel } from '../core/tokens.js';
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
export declare function renderCapsFor(caps: Capabilities, stream?: 'stdout' | 'stderr', options?: {
    verbose?: boolean;
}): RenderCaps;
/** Width tiers: <40 one fact per line; 40–79 standard; 80–119 two-column metrics; ≥120 wider truncation. */
export type WidthTier = 'narrow' | 'standard' | 'wide' | 'xwide';
export declare function widthTier(columns: number): WidthTier;
/** A path (or any identifier) fitted to `max` cells by middle truncation; never wrapped. */
export declare function pathText(path: string, max: number, rc: RenderCaps): {
    text: string;
    truncated: boolean;
};
/**
 * Removes trailing spaces from every line, including spaces inside a trailing styled span
 * (`x  \u001b[22m` → `x\u001b[22m`), so copied output and goldens carry no invisible padding.
 */
export declare function tidy(text: string): string;
export declare const CUT_STATUS_WORDS: Record<CutStatus, string>;
export declare const FINDING_STATUS_WORDS: Record<FindingStatus, string>;
export declare const RELATION_WORDS: Record<Relation, string>;
/** Full sentences for plain output: "<subject 1> <phrase> <subject 2>". */
export declare const RELATION_SENTENCES: Record<Relation, string>;
export declare const RUN_STATUS_WORDS: Record<RunStatus, string>;
/** A status glyph and its word; in ASCII the bracketed twin is itself a word (`[fail]`). */
export declare function cutStatus(status: CutStatus, rc: RenderCaps, word?: string): string;
export declare function formatDuration(ms: number | undefined): string;
export declare function pct(value: number): string;
/** `C-01`, `F-01`, `E-01`: presentation labels, numbered by reading order. */
export declare function label(prefix: 'C' | 'F' | 'E', n: number): string;
export interface MastheadInput {
    product?: string;
    title: string;
    replay?: boolean;
}
/** Product and run title, then one rule. At the narrow tier there is no rule. */
export declare function masthead(input: MastheadInput, rc: RenderCaps): string;
/** A full-width rule (`─`, ASCII `-`). */
export declare function rule(rc: RenderCaps): string;
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
export declare function cut(input: CutInput, rc: RenderCaps): string;
export interface PanelInput {
    /** The label line (already styled). */
    label: string;
    /** Body lines (already styled, already fitted to `columns - 2`). */
    body: string[];
    prominence: Finding['prominence'];
}
/** A label line and an indented body. No box; the hero alone gets a heavy left rule (`┃`). */
export declare function panel(input: PanelInput, rc: RenderCaps): string;
/** Inner width available to a panel body. */
export declare function panelInner(rc: RenderCaps): number;
/** Two subjects stacked with a typed connector line between them. */
export declare function panelPair(top: Subject, bottom: Subject, relation: Relation | undefined, rc: RenderCaps, width?: number): string[];
/**
 * `▰▰▰▰▰▱▱▱ 62% (range 41–79%)`: bounded strength in glyphs, with the number always printed.
 * Fits `width`: the bar shrinks (to no bar at all), and the range moves to its own line, before
 * any number is dropped. Returns one or two lines joined by `\n`.
 */
export declare function toneBar(strength: Pick<Strength, 'value' | 'low' | 'high'>, rc: RenderCaps, width?: number, cells?: number): string;
export interface LabeledReceipt {
    label: string;
    receipt: ReceiptRef;
}
/** Short id: a commit SHA becomes 7 characters; other values are kept. */
export declare function shortValue(r: ReceiptRef): string;
/**
 * `E-01  1a2b3c4  2026-10-28  note`, one line each, links when the terminal supports them. Every
 * line fits `width`: the date and note are dropped before the value, and a long value (a path, a
 * tool call) is middle-truncated, with the full value on its own line under `verbose`.
 */
export declare function receiptList(items: LabeledReceipt[], rc: RenderCaps, width?: number, more?: number): string[];
export interface CardLabels {
    frame: string;
    /** Number of the finding's first receipt (receipts are numbered across the render). */
    firstReceipt: number;
    /** Paint the frame label as the one marker chip. */
    marker: boolean;
    /** Receipts listed before "+N more". Default 3; the live Inspector passes Infinity. */
    maxReceipts?: number;
}
/** Up to 3 receipts per card; the rest are counted. */
export declare const MAX_CARD_RECEIPTS = 3;
/** A finding: label line (frame, title, status word), subjects, strength and receipts. */
export declare function evidenceCard(finding: Finding, labels: CardLabels, rc: RenderCaps): string;
/** A secondary finding in three short lines: label and title, then status facts, then subjects. */
export declare function compactFinding(finding: Finding, frame: string, rc: RenderCaps): string;
/**
 * Metrics, aligned in label/value columns; two pairs per row when they fit (80+ columns). When a
 * label and its value do not fit side by side, they stack: label line, then the value wrapped
 * beneath it. Values are never truncated.
 */
export declare function metricRows(metrics: Metric[], rc: RenderCaps): string[];
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
export declare function wrapCommand(command: string, width: number, rc: RenderCaps): string[];
/** In linear output the hint bar is printed once at the end as "Next steps" commands. */
export declare function hintBar(steps: NextStep[], rc: RenderCaps): string[];
export declare function sectionLabel(text: string, rc: RenderCaps): string;
