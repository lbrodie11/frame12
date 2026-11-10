import { attrs, child, escapeHtml, html, textContent } from './html.js';
import { hash } from './hash.js';
import { badge } from './text.js';
import { safeUrl } from './url.js';
import { fail, ident, num, obj, oneOf, optIdent, optString, bool } from './validate.js';
// ------------------------------------------------------------------------------- formatters
/** Same as React's `fmtPct`: absolute ratio as a one-decimal percentage. */
export const fmtPct = (v) => (Math.abs(v) * 100).toFixed(1) + '%';
/** Same as React's `fmtPPAbs`: absolute percentage points with two decimals. */
export const fmtPPAbs = (v) => Math.abs(v).toFixed(2) + ' pp';
/** Same as React's `fmtMoney`: whole dollars, `en-US` grouping. */
export const fmtMoney = (v) => '$' + Math.round(v).toLocaleString('en-US');
function delta(value, kind, comparisonLabel, range) {
    const flat = kind === 'pp' ? Math.abs(value) < 0.005 : Math.abs(value) < 0.0005;
    const up = value > 0;
    const text = flat ? (kind === 'pp' ? '0.00 pp change' : '0.0% change') : kind === 'pp' ? fmtPPAbs(value) : fmtPct(value);
    const dir = flat ? 'flat' : up ? 'up' : 'down';
    const sym = flat ? '=' : up ? '▲' : '▼';
    const refLabel = comparisonLabel ?? (range != null ? `vs prior ${range} days` : undefined);
    return `<p class="f12-delta ${dir}"><span class="f12-delta-sym" aria-hidden="true">${sym}</span><span class="f12-sr-only">${flat ? '' : up ? 'Up ' : 'Down '}</span>${escapeHtml(text)}${refLabel ? `<span class="f12-delta-ref">${escapeHtml(` ${refLabel}`)}</span>` : ''}</p>`;
}
/** Mirrors `<Metric>` at rest: the settled value, delta, note and optional spark. */
export function metric(o) {
    const where = 'metric()';
    obj(where, o);
    if (typeof o.label !== 'string')
        fail(where, 'label must be a string');
    const value = num(where, 'value', o.value, -Number.MAX_VALUE, Number.MAX_VALUE);
    const format = o.format ?? fmtMoney;
    if (typeof format !== 'function')
        fail(where, 'format must be a function');
    const deltaValue = o.delta === undefined || o.delta === null ? undefined : num(where, 'delta', o.delta, -Number.MAX_VALUE, Number.MAX_VALUE);
    const deltaKind = oneOf(where, 'deltaKind', o.deltaKind, ['pct', 'pp'], 'pct');
    const comparisonLabel = optString(where, 'comparisonLabel', o.comparisonLabel);
    if (o.range !== undefined && typeof o.range !== 'string')
        num(where, 'range', o.range, 0, 100000);
    const note = optString(where, 'note', o.note);
    const big = bool(where, 'big', o.big, false);
    const variant = oneOf(where, 'variant', o.variant, ['expressive', 'quiet'], 'expressive');
    const level = oneOf(where, 'headingLevel', o.headingLevel, ['h2', 'h3', 'h4', 'div', 'p'], 'h2');
    const finalText = String(format(value));
    const isQuiet = variant === 'quiet';
    return html(`<div${attrs([
        ['class', `f12-metric${big ? ' big' : ''}${isQuiet ? ' f12-metric-quiet' : ''}`],
        ['data-variant', isQuiet ? 'quiet' : undefined],
        ['style', big ? `--f12-m-chars:${Math.max(finalText.length, 4)}` : undefined],
    ])}><${level} class="f12-m-label">${escapeHtml(o.label)}</${level}><p class="f12-m-value" aria-live="polite"><span class="f12-sr-only">${escapeHtml(finalText)}</span><span aria-hidden="true">${escapeHtml(finalText)}</span></p>${deltaValue !== undefined ? delta(deltaValue, deltaKind, comparisonLabel, o.range) : ''}${note ? `<p class="f12-m-note">${escapeHtml(note)}</p>` : ''}${o.spark === undefined ? '' : child(o.spark)}</div>`);
}
/**
 * Mirrors `<ToneBarList>` without interaction: rows are `<div data-static>` (not inert buttons)
 * and the selected row carries `aria-current="true"`.
 */
export function toneBarList(o) {
    const where = 'toneBarList()';
    obj(where, o);
    const title = optString(where, 'title', o.title);
    const subtitle = optString(where, 'subtitle', o.subtitle);
    if (!Array.isArray(o.items))
        fail(where, 'items must be an array');
    const selectedId = o.selectedId === null || o.selectedId === undefined ? null : ident(where, 'selectedId', o.selectedId);
    const density = oneOf(where, 'density', o.density, ['comfortable', 'compact'], 'comfortable');
    const items = o.items.map((r, i) => {
        if (!r || typeof r !== 'object')
            fail(where, `items[${i}] must be an object`);
        return {
            id: ident(where, `items[${i}].id`, r.id),
            name: (() => {
                if (typeof r.name !== 'string')
                    fail(where, `items[${i}].name must be a string`);
                return r.name;
            })(),
            value: num(where, `items[${i}].value`, r.value, 0, Number.MAX_VALUE),
            formattedValue: optString(where, `items[${i}].formattedValue`, r.formattedValue),
            share: r.share === undefined || r.share === null ? undefined : num(where, `items[${i}].share`, r.share, 0, 1),
            badge: optString(where, `items[${i}].badge`, r.badge),
            pattern: r.pattern === undefined ? undefined : oneOf(where, `items[${i}].pattern`, r.pattern, ['dots', 'hatch', 'dense'], 'dots'),
        };
    });
    const seen = new Set();
    for (const r of items) {
        if (seen.has(r.id))
            fail(where, `duplicate item id "${r.id}"`);
        seen.add(r.id);
    }
    const prefix = optIdent(where, 'idPrefix', o.idPrefix) ?? `f12-s${hash(JSON.stringify([title, subtitle, items, selectedId, density]))}`;
    const max = items.reduce((m, r) => (r.value > m ? r.value : m), 1);
    const isCompact = density === 'compact';
    const head = title || subtitle
        ? `<div class="f12-ints-hd">${title ? `<h3 class="f12-m-label">${escapeHtml(title)}</h3>` : ''}${subtitle ? `<p class="f12-ints-sub">${escapeHtml(subtitle)}</p>` : ''}</div>`
        : '';
    let rows = '';
    for (const r of items) {
        const on = selectedId === r.id;
        const formatted = r.formattedValue ?? '$' + Math.round(r.value).toLocaleString('en-US');
        const patternClass = r.pattern && r.pattern !== 'dots' ? ` f12-int-fill-${r.pattern}` : '';
        rows += `<li><div${attrs([
            ['id', `int-${prefix}-${r.id}`],
            ['class', 'f12-int-row'],
            ['data-static', ''],
            ['aria-current', on ? 'true' : undefined],
        ])}><span class="f12-int-name">${escapeHtml(r.name)}${r.badge ? badge({ children: r.badge }) : ''}</span><span class="f12-int-bar" aria-hidden="true"><span${attrs([
            ['class', `f12-int-fill${patternClass}`],
            ['data-pattern', r.pattern ?? 'dots'],
            // Static-only: the width rounded to whole percent, styled by static.css so bars keep their
            // length when a strict CSP blocks the exact inline style (see PARITY.md).
            ['data-fill', Math.round(Math.max(0, (r.value / max) * 100))],
            ['style', `width:${Math.max(0, (r.value / max) * 100)}%`],
        ])}></span></span><span class="f12-int-val">${escapeHtml(formatted)}${r.share != null ? `<span class="f12-int-share">${(r.share * 100).toFixed(0)}%</span>` : ''}</span></div></li>`;
    }
    return html(`<div${attrs([
        ['class', `f12-ints${isCompact ? ' f12-ints-compact' : ''}`],
        ['data-density', isCompact ? 'compact' : undefined],
    ])}>${head}<ul class="f12-ints-list">${rows}</ul></div>`);
}
/** Mirrors `<GhostWire>` at rest: the co-change wire fully revealed, `auto` drawn horizontal. */
export function ghostWire(o) {
    const where = 'ghostWire()';
    obj(where, o);
    const label = optString(where, 'label', o.label);
    const strength = o.strength === undefined ? 0.5 : num(where, 'strength', o.strength, 0, 1);
    const orientation = oneOf(where, 'orientation', o.orientation, ['auto', 'horizontal', 'vertical'], 'auto');
    const fromMarkup = child(o.from);
    const toMarkup = child(o.to);
    const fromText = textContent(o.from).trim() || 'source';
    const toText = textContent(o.to).trim() || 'target';
    const slug = `${fromText}-${toText}`
        .replace(/[^a-zA-Z0-9_-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 32);
    const maskId = `f12-gw-mask-${slug ? `${slug}-` : ''}s${hash(JSON.stringify([fromMarkup, toMarkup, label, strength, orientation]))}`;
    const resolved = orientation === 'vertical' ? 'vertical' : 'horizontal';
    const isVertical = resolved === 'vertical';
    const groupLabel = label && label.trim() ? label.trim() : `${fromText} usually changes with ${toText}, which was not changed`;
    const dash = Math.round(3 + strength * 9);
    const gap = Math.round(10 - strength * 7);
    const x1 = isVertical ? 6 : 0;
    const y1 = isVertical ? 0 : 6;
    const x2 = isVertical ? 6 : 100;
    const y2 = isVertical ? 100 : 6;
    return html(`<div${attrs([
        ['role', 'group'],
        ['aria-label', groupLabel],
        ['class', `f12-ghost-wire f12-ghost-wire-${orientation}`],
        ['data-orientation', resolved],
        ['data-strength', strength.toFixed(2)],
    ])}><span class="f12-ghost-wire-endpoint f12-ghost-wire-from" data-endpoint="from">${fromMarkup}</span><span class="f12-ghost-wire-connector"><svg class="f12-ghost-wire-svg" viewBox="${isVertical ? '0 0 12 100' : '0 0 100 12'}" preserveAspectRatio="none" aria-hidden="true" focusable="false"><defs><mask id="${maskId}" maskUnits="userSpaceOnUse" x="0" y="0" width="${isVertical ? 12 : 100}" height="${isVertical ? 100 : 12}"><line class="f12-ghost-wire-reveal" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke-dasharray="100 100" stroke-dashoffset="0"></line></mask></defs><line class="f12-ghost-wire-line" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" vector-effect="non-scaling-stroke" stroke-dasharray="${dash} ${gap}" mask="url(#${maskId})"></line></svg>${label ? `<span class="f12-ghost-wire-label">${escapeHtml(label)}</span>` : ''}</span><span class="f12-ghost-wire-endpoint f12-ghost-wire-to" data-endpoint="to">${toMarkup}</span></div>`);
}
/** Same as React's `RECEIPT_ORIGIN_META`. */
export const RECEIPT_ORIGIN_META = Object.freeze({
    human: Object.freeze({ glyph: '[H]', srLabel: 'Origin: human' }),
    agent: Object.freeze({ glyph: '[A]', srLabel: 'Origin: agent' }),
    bot: Object.freeze({ glyph: '[B]', srLabel: 'Origin: bot' }),
});
/** Mirrors `<Receipt>`: an evidence chip (commit, file or link). Unsafe hrefs render as text. */
export function receipt(o) {
    const where = 'receipt()';
    obj(where, o);
    const kind = oneOf(where, 'kind', o.kind, ['commit', 'file', 'link'], 'file');
    if (o.kind === undefined)
        fail(where, 'kind is required');
    if (typeof o.value !== 'string')
        fail(where, 'value must be a string');
    const origin = o.origin === undefined ? undefined : oneOf(where, 'origin', o.origin, ['human', 'agent', 'bot'], 'human');
    const href = o.href === undefined ? undefined : optString(where, 'href', o.href);
    const title = optString(where, 'title', o.title);
    const date = optString(where, 'date', o.date);
    const rawValue = o.value;
    const trimmedRaw = rawValue.trim();
    const isCommit = kind === 'commit';
    const rawDisplayValue = isCommit ? trimmedRaw.slice(0, 7) : trimmedRaw ? rawValue : '';
    const fullCommitTitle = isCommit && trimmedRaw ? trimmedRaw : undefined;
    const hasTruncatedCommit = isCommit && trimmedRaw.length > rawDisplayValue.length;
    const safeHref = href === undefined ? null : safeUrl(href);
    const trimmedTitle = title && title.trim() ? title.trim() : undefined;
    const displayValue = rawDisplayValue || (safeHref ? (trimmedTitle ?? safeHref) : (trimmedTitle ?? ''));
    const showTitleChip = Boolean(title && (rawDisplayValue || displayValue !== trimmedTitle));
    const meta = origin ? RECEIPT_ORIGIN_META[origin] : undefined;
    let body = '';
    if (meta) {
        body += `<span class="f12-receipt-origin f12-receipt-origin-${origin}"><span class="f12-status-glyph" aria-hidden="true">${escapeHtml(meta.glyph)}</span><span class="f12-sr-only">${escapeHtml(`${meta.srLabel}: `)}</span></span>`;
    }
    if (safeHref && displayValue) {
        const inner = isCommit
            ? `<code${attrs([
                ['class', 'f12-receipt-code'],
                ['title', fullCommitTitle],
            ])}>${escapeHtml(displayValue)}</code>`
            : escapeHtml(displayValue);
        body += `<a${attrs([
            ['class', 'f12-receipt-value f12-receipt-link'],
            ['href', safeHref],
            ['title', fullCommitTitle],
        ])}>${inner}</a>`;
    }
    else if (isCommit) {
        body += `<code${attrs([
            ['class', 'f12-receipt-value f12-receipt-code'],
            ['title', fullCommitTitle],
        ])}>${escapeHtml(displayValue)}</code>`;
    }
    else {
        body += `<span class="f12-receipt-value">${escapeHtml(displayValue)}</span>`;
    }
    if (hasTruncatedCommit)
        body += `<span class="f12-sr-only f12-receipt-sha-sr">${escapeHtml(` (${trimmedRaw})`)}</span>`;
    if (showTitleChip)
        body += `<span class="f12-receipt-title">${escapeHtml(title)}</span>`;
    if (date)
        body += `<span class="f12-receipt-date">${escapeHtml(date)}</span>`;
    return html(`<span${attrs([
        ['class', `f12-receipt f12-receipt-${kind}`],
        ['data-kind', kind],
        ['data-origin', origin],
    ])}>${body}</span>`);
}
/** Mirrors `<ReceiptList>` with one `<Receipt>` per item. */
export function receiptList(o) {
    const where = 'receiptList()';
    obj(where, o);
    if (!Array.isArray(o.items))
        fail(where, 'items must be an array');
    const ariaLabel = optString(where, 'ariaLabel', o.ariaLabel) ?? 'Evidence receipts';
    const items = o.items.map((it, i) => `<li class="f12-receipt-item">${receipt(obj(where, it, `items[${i}]`))}</li>`).join('');
    return html(`<ul${attrs([
        ['role', 'list'],
        ['class', 'f12-receipt-list'],
        ['aria-label', ariaLabel],
    ])}>${items}</ul>`);
}
