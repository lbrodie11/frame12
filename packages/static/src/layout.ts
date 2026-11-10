import { attrs, child, escapeHtml, html, type Child, type Html } from './html.js';
import { hash } from './hash.js';
import { bool, fail, ident, IDENT_RE, num, oneOf, optIdent, optString } from './validate.js';

export type SceneGutter = 'pair' | 'scene' | 'change';
export type SceneLayout = 'split' | 'stack' | 'equal' | 'three' | 'areas';
export type PanelShape = 'rect' | 'slant-bottom' | 'slant-top';
export type PanelVariant = 'expressive' | 'quiet';

/** Gutter widths in px, identical to React's `GUTTERS`. */
export const GUTTERS: Readonly<Record<SceneGutter, number>> = Object.freeze({
  pair: 12,
  scene: 20,
  change: 32,
});

const PEGS =
  '<div class="f12-pegs" aria-hidden="true"><span class="f12-peg slot"></span><span class="f12-peg round"></span><span class="f12-peg slot"></span></div>';

// ------------------------------------------------------------------------------------- sheet

export interface SheetOpts {
  pegs?: boolean;
  autoCut?: boolean;
  theme?: 'light' | 'dark';
  children: Child;
}

/** Mirrors `<Sheet>`: the desk frame, the sheet, optional peg holes, and auto-cut numbering. */
export function sheet(o: SheetOpts): Html {
  const where = 'sheet()';
  const pegs = bool(where, 'pegs', o.pegs, true);
  const autoCut = bool(where, 'autoCut', o.autoCut, false);
  const theme = o.theme === undefined ? undefined : oneOf(where, 'theme', o.theme, ['light', 'dark'] as const, 'light');
  const outerClass = `f12-dash f12-frame f12-m-cut${theme ? ` f12-theme-${theme}` : ''}`;
  return html(
    `<div${attrs([
      ['class', outerClass],
      ['data-theme', theme],
    ])}><div${attrs([
      ['class', 'f12-sheet'],
      ['data-autocut', autoCut ? '' : undefined],
      ['style', `--f12-autocut-display:${autoCut ? 'block' : 'none'}`],
    ])}>${pegs ? PEGS : ''}${child(o.children)}</div></div>`,
  );
}

// ------------------------------------------------------------------------------------- scene

export interface SceneOpts {
  gutter?: SceneGutter;
  layout?: SceneLayout;
  areas?: string[];
  columns?: number;
  breakpoint?: number | string;
  children: Child;
}

const DEFAULT_BREAKPOINT = '860px';

function normalizeBreakpoint(where: string, bp: unknown): string {
  if (bp === undefined) return DEFAULT_BREAKPOINT;
  if (typeof bp === 'number') {
    return `${num(where, 'breakpoint', bp, 1, 9999, { integer: true })}px`;
  }
  if (typeof bp === 'string' && /^\d{2,4}(px|rem|em)$/.test(bp)) return bp;
  return fail(where, `breakpoint must be an integer or match /^\\d{2,4}(px|rem|em)$/ (got ${JSON.stringify(String(bp)).slice(0, 80)})`);
}

function parseAreas(where: string, areas: unknown): string[][] {
  if (!Array.isArray(areas)) fail(where, 'areas must be an array of strings');
  if (areas.length > 64) fail(where, 'areas may have at most 64 rows');
  const rows = areas.map((row, i) => {
    if (typeof row !== 'string') fail(where, `areas[${i}] must be a string`);
    const cleaned = row.trim().replace(/^["']+|["']+$/g, '').trim();
    const tokens = cleaned ? cleaned.split(/\s+/) : [];
    if (tokens.length === 0 || tokens.length > 24) fail(where, `areas[${i}] must have 1–24 cell tokens`);
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
  return rows;
}

/** Mirrors `<Scene>`: a grid scene with gutter grammar (12/20/32px) and optional named areas. */
export function scene(o: SceneOpts): Html {
  const where = 'scene()';
  const gutter = oneOf(where, 'gutter', o.gutter, ['pair', 'scene', 'change'] as const, 'scene');
  const requestedLayout = oneOf(where, 'layout', o.layout, ['split', 'stack', 'equal', 'three', 'areas'] as const, 'split');
  const rows = o.areas === undefined ? [] : parseAreas(where, o.areas);
  const hasAreas = rows.length > 0;
  const layout: SceneLayout = hasAreas ? 'areas' : requestedLayout;
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
  const scoped =
    hasAreas && isCustom
      ? `<style>@media (min-width: ${breakpoint}) { .f12-scene.f12-scene-areas[data-scene-bp="${scope}"] { grid-template-columns: repeat(var(--f12-scene-cols, 12), minmax(0, 1fr)); grid-template-areas: var(--f12-scene-areas); } .f12-scene.f12-scene-areas[data-scene-bp="${scope}"] > [data-area] { grid-area: var(--f12-area); } } @container (max-width: 760px) { .f12-scene.f12-scene-areas[data-scene-bp="${scope}"] { grid-template-columns: minmax(0, 1fr); grid-template-areas: none; } .f12-scene.f12-scene-areas[data-scene-bp="${scope}"] > [data-area] { grid-area: auto; } }</style>`
      : '';

  return html(
    `<div${attrs([
      ['class', `f12-scene f12-scene-${layout} f12-scene-${gutter}`],
      ['data-gutter', GUTTERS[gutter]],
      ['data-layout', layout],
      ['data-columns', hasAreas ? columns : undefined],
      ['data-breakpoint', hasAreas ? breakpoint : undefined],
      ['data-scene-bp', hasAreas && isCustom ? scope : undefined],
      ['style', style],
    ])}>${scoped}${child(o.children)}</div>`,
  );
}

export interface SceneAreaOpts {
  area: string;
  children: Child;
}

/** Mirrors `<SceneArea>`: places its children in a named `Scene` area. */
export function sceneArea(o: SceneAreaOpts): Html {
  const area = ident('sceneArea()', 'area', o.area);
  return html(
    `<div${attrs([
      ['class', 'f12-scene-area'],
      ['data-area', area],
      ['style', `--f12-area:${area}`],
    ])}>${child(o.children)}</div>`,
  );
}

// ------------------------------------------------------------------------------------- panel

export interface PanelOpts {
  cut?: string | false;
  shape?: PanelShape;
  variant?: PanelVariant;
  label?: string;
  area?: string;
  /** Static-only: exact box width in px, for the measured (pixel) polygon. Requires `height`. */
  width?: number;
  /** Static-only: exact box height in px, for the measured (pixel) polygon. Requires `width`. */
  height?: number;
  children?: Child;
}

const STROKE_INSET = 1.25; // half of the 2.5px ink stroke
const SLANT_RISE = 16; // slant rise in px

/** The SSR polygon points React's `Panel` draws in a 0 0 100 100 viewBox. */
export function ssrPoints(shape: PanelShape): string {
  return shape === 'slant-bottom'
    ? '0.35,0.35 99.65,0.35 99.65,93.2 0.35,99.65'
    : shape === 'slant-top'
      ? '0.35,6.8 99.65,0.35 99.65,99.65 0.35,99.65'
      : '0.35,0.35 99.65,0.35 99.65,99.65 0.35,99.65';
}

/** The pixel polygon points React's `Panel` draws once it has measured `w`×`h`. */
export function exactPoints(shape: PanelShape, w: number, h: number): string {
  const s = STROKE_INSET;
  const d = SLANT_RISE;
  if (shape === 'slant-bottom') return `${s},${s} ${w - s},${s} ${w - s},${h - s - d} ${s},${h - s}`;
  if (shape === 'slant-top') return `${s},${s + d} ${w - s},${s} ${w - s},${h - s} ${s},${h - s}`;
  return `${s},${s} ${w - s},${s} ${w - s},${h - s} ${s},${h - s}`;
}

/** Mirrors `<Panel>`: an ink-framed panel with a cut label. */
export function panel(o: PanelOpts): Html {
  const where = 'panel()';
  const shape = oneOf(where, 'shape', o.shape, ['rect', 'slant-bottom', 'slant-top'] as const, 'rect');
  const variant = oneOf(where, 'variant', o.variant, ['expressive', 'quiet'] as const, 'expressive');
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
  } else if (o.cut === undefined && !isQuiet) {
    cut = '<span class="f12-cut" data-autocut="" aria-hidden="true"></span>';
  }
  return html(
    `<section${attrs([
      ['class', `f12-panel f12-${shape}${isQuiet ? ' f12-panel-quiet' : ''}`],
      ['data-variant', isQuiet ? 'quiet' : undefined],
      ['data-area', area],
      ['aria-label', label],
      ['style', area ? `--f12-area:${area}` : undefined],
    ])}>${frame}${cut}<div class="f12-panel-body">${child(o.children)}</div></section>`,
  );
}

// -------------------------------------------------------------------------------- panelPair

export interface PanelPairOpts {
  variant?: PanelVariant;
  area?: string;
  top?: Omit<PanelOpts, 'shape'>;
  bottom?: Omit<PanelOpts, 'shape'>;
  topCut?: string | false;
  bottomCut?: string | false;
  topLabel?: string;
  bottomLabel?: string;
  /** Inserted verbatim when `top`/`bottom` aren't both given (see PARITY.md). */
  children?: Child;
}

/** Mirrors `<PanelPair>`: two panels on a 12px pair gutter with complementary slants. */
export function panelPair(o: PanelPairOpts): Html {
  const where = 'panelPair()';
  const variant = oneOf(where, 'variant', o.variant, ['expressive', 'quiet'] as const, 'expressive');
  const area = optIdent(where, 'area', o.area);
  let inner: string;
  if (o.top && o.bottom) {
    const slot = (
      p: Omit<PanelOpts, 'shape'>,
      slant: PanelShape,
      cut: string | false | undefined,
      label: string | undefined,
    ): string => {
      if ('shape' in p && (p as PanelOpts).shape !== undefined) fail(where, 'top/bottom must not set shape');
      const v = p.variant ?? variant;
      return panel({
        ...p,
        cut: p.cut ?? cut,
        label: p.label ?? label,
        variant: v,
        shape: v === 'quiet' ? 'rect' : slant,
      });
    };
    inner =
      slot(o.top, 'slant-bottom', o.topCut, o.topLabel) +
      slot(o.bottom, 'slant-top', o.bottomCut, o.bottomLabel);
  } else {
    inner = child(o.children);
  }
  return html(
    `<div${attrs([
      ['class', 'f12-pair'],
      ['data-area', area],
      ['style', area ? `--f12-area:${area}` : undefined],
    ])}>${inner}</div>`,
  );
}
