import { glyph } from '../core/glyphs.js';
import { formatLink } from '../core/safety.js';
import { paint, styleLevel } from '../core/tokens.js';
import { graphemes, padEnd, stringWidth, truncateEnd, truncateMiddle, wrap } from '../core/width.js';
/** Render capabilities for stdout (results) or stderr (narration). */
export function renderCapsFor(caps, stream = 'stdout', options = {}) {
    const out = stream === 'stdout';
    return {
        style: styleLevel(out ? caps.colorLevel : caps.stderrColorLevel, out ? caps.attributes : caps.stderrAttributes),
        unicode: caps.unicode,
        ambiguousWide: caps.ambiguousWide,
        links: caps.links && (out ? caps.isTTY : caps.stderrIsTTY),
        columns: caps.columns,
        ...(options.verbose ? { verbose: true } : {}),
    };
}
export function widthTier(columns) {
    if (columns < 40)
        return 'narrow';
    if (columns < 80)
        return 'standard';
    if (columns < 120)
        return 'wide';
    return 'xwide';
}
const g = (name, rc) => glyph(name, rc);
const p = (text, role, rc) => paint(text, role, rc.style);
const w = (text, rc) => stringWidth(text, rc);
const ellipsis = (rc) => g('ellipsis', rc);
/** Fits plain text to `max` cells by truncating its end. */
function fit(text, max, rc) {
    return truncateEnd(text, Math.max(1, max), { ...rc, ellipsis: ellipsis(rc) });
}
/** A path (or any identifier) fitted to `max` cells by middle truncation; never wrapped. */
export function pathText(path, max, rc) {
    return truncateMiddle(path, Math.max(4, max), { ...rc, ellipsis: ellipsis(rc) });
}
/**
 * Removes trailing spaces from every line, including spaces inside a trailing styled span
 * (`x  \u001b[22m` → `x\u001b[22m`), so copied output and goldens carry no invisible padding.
 */
export function tidy(text) {
    return text.replace(/ +((?:\u001b\[[0-9;]*m)*)(?=\n|$)/g, '$1');
}
// ------------------------------------------------------------------------------- words
export const CUT_STATUS_WORDS = {
    ok: 'done',
    warning: 'warning',
    error: 'failed',
    skipped: 'skipped',
    canceled: 'canceled',
};
const CUT_STATUS_GLYPH = { ok: 'ok', warning: 'warning', error: 'error', skipped: 'skipped', canceled: 'canceled' };
const CUT_STATUS_ROLE = { ok: 'status-ok', warning: 'status-warning', error: 'status-danger', skipped: 'ink2', canceled: 'status-warning' };
export const FINDING_STATUS_WORDS = {
    review: 'needs review',
    info: 'info',
    ok: 'ok',
    warning: 'warning',
    danger: 'danger',
};
export const RELATION_WORDS = {
    'history-only': 'changes with it, no code link',
    direct: 'references it directly',
    indirect: 'connected through other modules',
};
/** Full sentences for plain output: "<subject 1> <phrase> <subject 2>". */
export const RELATION_SENTENCES = {
    'history-only': 'changes together with subject 2, with no code link between them',
    direct: 'references subject 2 directly',
    indirect: 'is connected to subject 2 through other modules',
};
export const RUN_STATUS_WORDS = { completed: 'completed', failed: 'failed', canceled: 'canceled' };
/** A status glyph and its word; in ASCII the bracketed twin is itself a word (`[fail]`). */
export function cutStatus(status, rc, word = CUT_STATUS_WORDS[status]) {
    const mark = g(CUT_STATUS_GLYPH[status], rc);
    return p(`${mark} ${word}`, CUT_STATUS_ROLE[status], rc);
}
export function formatDuration(ms) {
    if (ms === undefined || !Number.isFinite(ms))
        return '';
    if (ms < 1000)
        return `${(ms / 1000).toFixed(2)}s`;
    if (ms < 60_000)
        return `${(ms / 1000).toFixed(1)}s`;
    const m = Math.floor(ms / 60_000);
    const s = Math.round((ms % 60_000) / 1000);
    return `${m}m ${String(s).padStart(2, '0')}s`;
}
export function pct(value) {
    return `${Math.round(value * 100)}%`;
}
/** `C-01`, `F-01`, `E-01`: presentation labels, numbered by reading order. */
export function label(prefix, n) {
    return `${prefix}-${String(n).padStart(2, '0')}`;
}
/** Product and run title, then one rule. At the narrow tier there is no rule. */
export function masthead(input, rc) {
    const product = input.product ?? 'FRAME/12';
    const sep = ` ${g('dot', rc)} `;
    const replay = input.replay ? `REPLAY${sep}` : '';
    const lines = [];
    if (widthTier(rc.columns) === 'narrow') {
        lines.push(p(fit(`${replay}${product}`, rc.columns, rc), 'ink2', rc));
        for (const l of wrap(input.title, rc.columns, rc))
            lines.push(p(l, 'strong', rc));
        return lines.join('\n');
    }
    const head = fit(`${replay}${product}`, Math.floor(rc.columns / 2), rc) + sep;
    const headW = w(head, rc);
    const [firstTitle = '', ...restTitle] = wrap(input.title, rc.columns - headW, rc);
    const titleLines = [firstTitle, ...restTitle.map((l) => ' '.repeat(headW) + l)];
    lines.push(`${p(head, 'ink2', rc)}${p(titleLines[0] ?? '', 'strong', rc)}`);
    for (const l of titleLines.slice(1))
        lines.push(p(l, 'strong', rc));
    lines.push(rule(rc));
    return lines.join('\n');
}
/** A full-width rule (`─`, ASCII `-`). */
export function rule(rc) {
    const ch = g('rule', rc);
    return p(ch.repeat(Math.max(1, Math.floor(rc.columns / w(ch, rc)))), 'rule', rc);
}
/** `C-01 · READ HISTORY   ✓ done   2.4s`, with an optional summary line beneath. */
export function cut(input, rc) {
    const status = cutStatus(input.status, rc, input.word);
    const statusW = w(status, rc);
    const duration = formatDuration(input.durationMs);
    const head = `${input.label} ${g('dot', rc)} `;
    const lines = [];
    if (widthTier(rc.columns) === 'narrow') {
        lines.push(`${p(input.label, 'strong', rc)} ${p(fit(input.title.toUpperCase(), rc.columns - input.label.length - 1, rc), 'strong', rc)}`);
        const fitsTogether = duration && 2 + statusW + 2 + duration.length <= rc.columns;
        lines.push(`  ${status}${fitsTogether ? `  ${p(duration, 'ink2', rc)}` : ''}`);
        if (duration && !fitsTogether)
            lines.push(`  ${p(duration, 'ink2', rc)}`);
    }
    else {
        // A fixed status column (cell 36, or as far right as fits) keeps every cut line aligned.
        const right = `${status}${duration ? `  ${p(duration, 'ink2', rc)}` : ''}`;
        const rightW = statusW + (duration ? 2 + duration.length : 0);
        const statusCol = Math.min(36, rc.columns - rightW);
        const title = fit(input.title.toUpperCase(), statusCol - w(head, rc) - 2, rc);
        const gap = Math.max(2, statusCol - w(head, rc) - w(title, rc));
        lines.push(`${p(head, 'ink2', rc)}${p(title, 'strong', rc)}${' '.repeat(gap)}${right}`);
    }
    if (input.summary)
        for (const l of wrap(input.summary, rc.columns - 2, rc))
            lines.push(`  ${p(l, 'ink2', rc)}`);
    return lines.join('\n');
}
/** A label line and an indented body. No box; the hero alone gets a heavy left rule (`┃`). */
export function panel(input, rc) {
    const gutter = input.prominence === 'hero' ? `${p(g('heroRule', rc), 'strong', rc)} ` : '  ';
    return [input.label, ...input.body.map((l) => `${gutter}${l}`)].join('\n');
}
/** Inner width available to a panel body. */
export function panelInner(rc) {
    return Math.max(10, rc.columns - 2);
}
/** Two subjects stacked with a typed connector line between them. */
export function panelPair(top, bottom, relation, rc, width = panelInner(rc)) {
    const lines = [];
    const subjectLine = (s) => {
        const fitted = pathText(s.label, width, rc);
        lines.push(formatLink(fitted.text, s.href, rc.links));
        if (fitted.truncated && rc.verbose)
            lines.push(p(s.label, 'ink2', rc));
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
export function toneBar(strength, rc, width = panelInner(rc), cells = 8) {
    const v = Math.min(1, Math.max(0, strength.value));
    const number = pct(v);
    const range = strength.low !== undefined && strength.high !== undefined ? `(range ${Math.round(strength.low * 100)}${g('rangeDash', rc)}${pct(strength.high)})` : '';
    const n = Math.max(0, Math.min(cells, width - number.length - 1));
    const on = Math.round(v * n);
    const bar = n >= 3 ? `${p(g('toneOn', rc).repeat(on), 'strong', rc)}${p(g('toneOff', rc).repeat(n - on), 'ink2', rc)} ` : '';
    const first = `${bar}${p(number, 'strong', rc)}`;
    if (!range)
        return first;
    if (w(first, rc) + 1 + range.length <= width)
        return `${first} ${p(range, 'ink2', rc)}`;
    return [first, ...wrap(range, width, rc).map((l) => p(l, 'ink2', rc))].join('\n');
}
/** Short id: a commit SHA becomes 7 characters; other values are kept. */
export function shortValue(r) {
    return r.kind === 'commit' && /^[0-9a-f]{8,64}$/i.test(r.value) ? r.value.slice(0, 7) : r.value;
}
/**
 * `E-01  1a2b3c4  2026-10-28  note`, one line each, links when the terminal supports them. Every
 * line fits `width`: the date and note are dropped before the value, and a long value (a path, a
 * tool call) is middle-truncated, with the full value on its own line under `verbose`.
 */
export function receiptList(items, rc, width = panelInner(rc), more = 0) {
    const lines = [];
    for (const { label: l, receipt: r } of items) {
        const short = shortValue(r);
        const avail = width - l.length - 2;
        const date = r.at && avail - w(short, rc) >= 12 ? r.at.slice(0, 10) : '';
        const value = pathText(short, avail - (date ? 12 : 0), rc);
        const head = `${l}  ${value.text}${date ? `  ${date}` : ''}`;
        const room = width - w(head, rc) - 2;
        const note = r.note && room >= 8 ? `  ${fit(r.note, room, rc)}` : '';
        lines.push(`${p(l, 'ink2', rc)}  ${formatLink(value.text, r.href, rc.links)}${date ? `  ${p(date, 'ink2', rc)}` : ''}${note}`);
        if (value.truncated && rc.verbose)
            lines.push(p(short, 'ink2', rc));
    }
    if (more > 0)
        lines.push(p(fit(`+${more} more receipt${more === 1 ? '' : 's'}`, width, rc), 'ink2', rc));
    return lines;
}
/** Up to 3 receipts per card; the rest are counted. */
export const MAX_CARD_RECEIPTS = 3;
/** A finding: label line (frame, title, status word), subjects, strength and receipts. */
export function evidenceCard(finding, labels, rc) {
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
    const body = wrap(meta, inner, rc).map((l) => p(l, `status-${finding.status}`, rc));
    if (finding.summary)
        for (const l of wrap(finding.summary, inner, rc))
            body.push(l);
    const [a, b, ...rest] = finding.subject;
    if (a && b)
        body.push(...panelPair(a, b, finding.relation, rc, inner));
    else if (a)
        body.push(formatLink(pathText(a.label, inner, rc).text, a.href, rc.links));
    for (const s of rest)
        body.push(formatLink(pathText(s.label, inner, rc).text, s.href, rc.links));
    if (finding.strength) {
        body.push(...toneBar(finding.strength, rc, inner).split('\n'));
        for (const l of wrap(finding.strength.label, inner, rc))
            body.push(p(l, 'ink2', rc));
    }
    const receipts = finding.receipts ?? [];
    const shown = receipts.slice(0, MAX_CARD_RECEIPTS).map((receipt, i) => ({ label: label('E', labels.firstReceipt + i), receipt }));
    body.push(...receiptList(shown, rc, inner, receipts.length - shown.length));
    return panel({ label: header.join('\n'), body, prominence: finding.prominence }, rc);
}
/** A secondary finding in three short lines: label and title, then status facts, then subjects. */
export function compactFinding(finding, frame, rc) {
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
        }
        else {
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
export function metricRows(metrics, rc) {
    if (metrics.length === 0)
        return [];
    const inner = panelInner(rc);
    const cells = metrics.map((m) => [m.label ?? m.name, `${m.value}${m.unit ? ` ${m.unit}` : ''}`]);
    const labelW = Math.max(...cells.map(([l]) => w(l, rc)));
    const valueW = Math.max(...cells.map(([, v]) => w(v, rc)));
    const colW = labelW + 2 + valueW;
    const tier = widthTier(rc.columns);
    const lines = [];
    if (tier === 'narrow' || colW > inner) {
        for (const [l, v] of cells) {
            for (const x of wrap(l, inner, rc))
                lines.push(`  ${p(x, 'ink2', rc)}`);
            for (const x of wrap(v, inner - 2, rc))
                lines.push(`    ${p(x, 'strong', rc)}`);
        }
        return lines;
    }
    const pair = ([l, v]) => `${p(padEnd(l, labelW), 'ink2', rc)}  ${p(padEnd(v, valueW), 'strong', rc)}`;
    const two = tier !== 'standard' && 2 + colW * 2 + 4 <= rc.columns;
    for (let i = 0; i < cells.length; i += two ? 2 : 1) {
        const right = two && cells[i + 1] ? `    ${pair(cells[i + 1])}` : '';
        lines.push(`  ${pair(cells[i])}${right}`);
    }
    return lines;
}
/**
 * Splits a shell command into lines of at most `width` cells joined by ` \` continuations, so the
 * copied text still runs. Breaks between words; a word longer than a line is split with a trailing
 * `\` (backslash-newline joins the word back together in POSIX shells). Never truncates.
 */
export function wrapCommand(command, width, rc) {
    const max = Math.max(4, width);
    const lines = [];
    let line = '';
    const push = (text) => lines.push(text);
    for (const word of command.split(' ')) {
        const candidate = line === '' ? word : `${line} ${word}`;
        if (w(candidate, rc) + 2 <= max || (line === '' && w(word, rc) <= max)) {
            line = candidate;
            continue;
        }
        if (line !== '')
            push(`${line} \\`);
        line = '';
        let rest = word;
        while (w(rest, rc) > max) {
            let head = '';
            for (const ch of graphemes(rest)) {
                if (w(head + ch, rc) + 1 > max)
                    break;
                head += ch;
            }
            push(`${head}\\`);
            rest = rest.slice(head.length);
        }
        line = rest;
    }
    if (line !== '')
        push(line);
    return lines;
}
/** In linear output the hint bar is printed once at the end as "Next steps" commands. */
export function hintBar(steps, rc) {
    if (steps.length === 0)
        return [];
    const lines = [sectionLabel('NEXT STEPS', rc)];
    for (const s of steps) {
        for (const l of wrapCommand(s.command, rc.columns - 2, rc))
            lines.push(`  ${p(l, 'strong', rc)}`);
        for (const l of wrap(s.description, rc.columns - 4, rc))
            lines.push(`    ${p(l, 'ink2', rc)}`);
    }
    return lines;
}
export function sectionLabel(text, rc) {
    return p(text, 'strong', rc);
}
