import { attrs, child, escapeHtml, html } from './html.js';
import { hash } from './hash.js';
import { bool, fail, ident, IDENT_RE, num, obj, oneOf, optIdent, optString } from './validate.js';
/** Gutter widths in px, identical to React's `GUTTERS`. */
export const GUTTERS = Object.freeze({
    pair: 12,
    scene: 20,
    change: 32,
});
const PEGS = '<div class="f12-pegs" aria-hidden="true"><span class="f12-peg slot"></span><span class="f12-peg round"></span><span class="f12-peg slot"></span></div>';
/** Mirrors `<Sheet>`: the desk frame, the sheet, optional peg holes, and auto-cut numbering. */
export function sheet(o) {
    const where = 'sheet()';
    obj(where, o);
    const pegs = bool(where, 'pegs', o.pegs, true);
    const autoCut = bool(where, 'autoCut', o.autoCut, false);
    const theme = o.theme === undefined ? undefined : oneOf(where, 'theme', o.theme, ['light', 'dark'], 'light');
    const outerClass = `f12-dash f12-frame f12-m-cut${theme ? ` f12-theme-${theme}` : ''}`;
    return html(`<div${attrs([
        ['class', outerClass],
        ['data-theme', theme],
    ])}><div${attrs([
        ['class', 'f12-sheet'],
        ['data-autocut', autoCut ? '' : undefined],
        ['style', `--f12-autocut-display:${autoCut ? 'block' : 'none'}`],
    ])}>${pegs ? PEGS : ''}${child(o.children)}</div></div>`);
}
const DEFAULT_BREAKPOINT = '860px';
function normalizeBreakpoint(where, bp) {
    if (bp === undefined)
        return DEFAULT_BREAKPOINT;
    if (typeof bp === 'number') {
        return `${num(where, 'breakpoint', bp, 10, 9999, { integer: true })}px`;
    }
    if (typeof bp === 'string' && /^\d{2,4}(px|rem|em)$/.test(bp))
        return bp;
    return fail(where, `breakpoint must be an integer or match /^\\d{2,4}(px|rem|em)$/ (got ${JSON.stringify(String(bp)).slice(0, 80)})`);
}
function parseAreas(where, areas) {
    if (!Array.isArray(areas))
        fail(where, 'areas must be an array of strings');
    if (areas.length > 64)
        fail(where, 'areas may have at most 64 rows');
    const rows = areas.map((row, i) => {
        if (typeof row !== 'string')
            fail(where, `areas[${i}] must be a string`);
        const cleaned = row.trim().replace(/^["']+|["']+$/g, '').trim();
        const tokens = cleaned ? cleaned.split(/\s+/) : [];
        if (tokens.length === 0 || tokens.length > 24)
            fail(where, `areas[${i}] must have 1–24 cell tokens`);
        for (const t of tokens) {
            if (!IDENT_RE.test(t) && !/^\.{1,8}$/.test(t)) {
                fail(where, `areas[${i}] token ${JSON.stringify(t).slice(0, 80)} must match ${IDENT_RE} or be "."`);
            }
        }
        return tokens;
    });
    const first = rows[0]?.length ?? 0;
    if (rows.some((r) => r.length !== first)) {
        fail(where, `every areas row must have ${first} column token(s) (got ${rows.map((r) => r.length).join(', ')})`);
    }
    // Each named area must be one filled rectangle; browsers ignore the whole grid-template-areas
    // value otherwise (e.g. "a b a"), silently dropping the layout.
    const boxes = new Map();
    rows.forEach((row, r) => row.forEach((name, c) => {
        if (name.startsWith('.'))
            return;
        const b = boxes.get(name);
        if (!b)
            boxes.set(name, { r0: r, r1: r, c0: c, c1: c, cells: 1 });
        else {
            b.r0 = Math.min(b.r0, r);
            b.r1 = Math.max(b.r1, r);
            b.c0 = Math.min(b.c0, c);
            b.c1 = Math.max(b.c1, c);
            b.cells++;
        }
    }));
    for (const [name, b] of boxes) {
        if (b.cells !== (b.r1 - b.r0 + 1) * (b.c1 - b.c0 + 1)) {
            fail(where, `area "${name}" must form a single rectangle in areas`);
        }
    }
    return rows;
}
/** Mirrors `<Scene>`: a grid scene with gutter grammar (12/20/32px) and optional named areas. */
export function scene(o) {
    const where = 'scene()';
    obj(where, o);
    const gutter = oneOf(where, 'gutter', o.gutter, ['pair', 'scene', 'change'], 'scene');
    const requestedLayout = oneOf(where, 'layout', o.layout, ['split', 'stack', 'equal', 'three', 'areas'], 'split');
    const rows = o.areas === undefined ? [] : parseAreas(where, o.areas);
    const hasAreas = rows.length > 0;
    const layout = hasAreas ? 'areas' : requestedLayout;
    const explicitCols = o.columns === undefined ? undefined : num(where, 'columns', o.columns, 1, 24, { integer: true });
    const firstRowCount = rows[0]?.length ?? 0;
    if (hasAreas && explicitCols !== undefined && explicitCols !== firstRowCount) {
        fail(where, `columns (${explicitCols}) must equal the areas row token count (${firstRowCount})`);
    }
    const columns = firstRowCount > 0 ? firstRowCount : (explicitCols ?? 12);
    const breakpoint = normalizeBreakpoint(where, o.breakpoint);
    const isCustom = breakpoint !== DEFAULT_BREAKPOINT;
    const scope = `bp-${breakpoint.replace(/[^a-zA-Z0-9_-]/g, '-')}-f12s${hash(breakpoint)}`;
    const formattedAreas = rows.map((r) => `"${r.join(' ')}"`).join(' ');
    const style = hasAreas ? `--f12-scene-cols:${columns};--f12-scene-areas:${formattedAreas}` : undefined;
    // Only validated, re-serialized values (a length like "960px" and the scope derived from it)
    // are written into this style block; caller strings never reach CSS.
    const scoped = hasAreas && isCustom
        ? `<style>@media (min-width: ${breakpoint}) { .f12-scene.f12-scene-areas[data-scene-bp="${scope}"] { grid-template-columns: repeat(var(--f12-scene-cols, 12), minmax(0, 1fr)); grid-template-areas: var(--f12-scene-areas); } .f12-scene.f12-scene-areas[data-scene-bp="${scope}"] > [data-area] { grid-area: var(--f12-area); } } @container (max-width: 760px) { .f12-scene.f12-scene-areas[data-scene-bp="${scope}"] { grid-template-columns: minmax(0, 1fr); grid-template-areas: none; } .f12-scene.f12-scene-areas[data-scene-bp="${scope}"] > [data-area] { grid-area: auto; } }</style>`
        : '';
    return html(`<div${attrs([
        ['class', `f12-scene f12-scene-${layout} f12-scene-${gutter}`],
        ['data-gutter', GUTTERS[gutter]],
        ['data-layout', layout],
        ['data-columns', hasAreas ? columns : undefined],
        ['data-breakpoint', hasAreas ? breakpoint : undefined],
        ['data-scene-bp', hasAreas && isCustom ? scope : undefined],
        ['style', style],
    ])}>${scoped}${child(o.children)}</div>`);
}
/** Mirrors `<SceneArea>`: places its children in a named `Scene` area. */
export function sceneArea(o) {
    obj('sceneArea()', o);
    const area = ident('sceneArea()', 'area', o.area);
    return html(`<div${attrs([
        ['class', 'f12-scene-area'],
        ['data-area', area],
        ['style', `--f12-area:${area}`],
    ])}>${child(o.children)}</div>`);
}
const STROKE_INSET = 1.25; // half of the 2.5px ink stroke
const SLANT_RISE = 16; // slant rise in px
/** The SSR polygon points React's `Panel` draws in a 0 0 100 100 viewBox. */
export function ssrPoints(shape) {
    return shape === 'slant-bottom'
        ? '0.35,0.35 99.65,0.35 99.65,93.2 0.35,99.65'
        : shape === 'slant-top'
            ? '0.35,6.8 99.65,0.35 99.65,99.65 0.35,99.65'
            : '0.35,0.35 99.65,0.35 99.65,99.65 0.35,99.65';
}
/** The pixel polygon points React's `Panel` draws once it has measured `w`×`h`. */
export function exactPoints(shape, w, h) {
    const s = STROKE_INSET;
    const d = SLANT_RISE;
    if (shape === 'slant-bottom')
        return `${s},${s} ${w - s},${s} ${w - s},${h - s - d} ${s},${h - s}`;
    if (shape === 'slant-top')
        return `${s},${s + d} ${w - s},${s} ${w - s},${h - s} ${s},${h - s}`;
    return `${s},${s} ${w - s},${s} ${w - s},${h - s} ${s},${h - s}`;
}
/** Mirrors `<Panel>`: an ink-framed panel with a cut label. */
export function panel(o) {
    const where = 'panel()';
    obj(where, o);
    const shape = oneOf(where, 'shape', o.shape, ['rect', 'slant-bottom', 'slant-top'], 'rect');
    const variant = oneOf(where, 'variant', o.variant, ['expressive', 'quiet'], 'expressive');
    const label = optString(where, 'label', o.label);
    const area = optIdent(where, 'area', o.area);
    if (o.cut !== undefined && o.cut !== false && typeof o.cut !== 'string') {
        fail(where, 'cut must be a string, false, or undefined');
    }
    if ((o.width === undefined) !== (o.height === undefined)) {
        fail(where, 'width and height must be passed together');
    }
    const w = o.width === undefined ? undefined : num(where, 'width', o.width, 20, 100000);
    const h = o.height === undefined ? undefined : num(where, 'height', o.height, 20, 100000);
    const isQuiet = variant === 'quiet';
    const showFrame = !isQuiet || shape !== 'rect';
    let frame = '';
    if (showFrame) {
        frame =
            w !== undefined && h !== undefined
                ? `<svg class="f12-panel-frame" width="${w}" height="${h}" aria-hidden="true"><polygon points="${exactPoints(shape, w, h)}"></polygon></svg>`
                : `<svg class="f12-panel-frame" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polygon vector-effect="non-scaling-stroke" points="${ssrPoints(shape)}"></polygon></svg>`;
    }
    let cut = '';
    if (typeof o.cut === 'string' && o.cut.length > 0) {
        cut = `<span class="f12-cut" aria-hidden="true">${escapeHtml(o.cut)}</span>`;
    }
    else if (o.cut === undefined && !isQuiet) {
        cut = '<span class="f12-cut" data-autocut="" aria-hidden="true"></span>';
    }
    return html(`<section${attrs([
        ['class', `f12-panel f12-${shape}${isQuiet ? ' f12-panel-quiet' : ''}`],
        ['data-variant', isQuiet ? 'quiet' : undefined],
        ['data-area', area],
        ['aria-label', label],
        ['style', area ? `--f12-area:${area}` : undefined],
    ])}>${frame}${cut}<div class="f12-panel-body">${child(o.children)}</div></section>`);
}
/** Mirrors `<PanelPair>`: two panels on a 12px pair gutter with complementary slants. */
export function panelPair(o) {
    const where = 'panelPair()';
    obj(where, o);
    const variant = oneOf(where, 'variant', o.variant, ['expressive', 'quiet'], 'expressive');
    const area = optIdent(where, 'area', o.area);
    if ((o.top === undefined) !== (o.bottom === undefined)) {
        fail(where, 'top and bottom must be passed together (or use children)');
    }
    if (o.top !== undefined)
        obj(where, o.top, 'top');
    if (o.bottom !== undefined)
        obj(where, o.bottom, 'bottom');
    let inner;
    if (o.top && o.bottom) {
        const slot = (p, slant, cut, label) => {
            if ('shape' in p && p.shape !== undefined)
                fail(where, 'top/bottom must not set shape');
            const v = p.variant ?? variant;
            return panel({
                ...p,
                cut: p.cut ?? cut,
                label: p.label ?? label,
                variant: v,
                shape: v === 'quiet' ? 'rect' : slant,
            }).toString();
        };
        inner =
            slot(o.top, 'slant-bottom', o.topCut, o.topLabel) +
                slot(o.bottom, 'slant-top', o.bottomCut, o.bottomLabel);
    }
    else {
        inner = child(o.children);
    }
    return html(`<div${attrs([
        ['class', 'f12-pair'],
        ['data-area', area],
        ['style', area ? `--f12-area:${area}` : undefined],
    ])}>${inner}</div>`);
}
