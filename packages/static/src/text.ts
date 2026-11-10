import { attrs, child, escapeHtml, html, textContent, type Child, type Html } from './html.js';
import { bool, num, oneOf, fail } from './validate.js';

export type SemanticStatus = 'neutral' | 'info' | 'success' | 'warning' | 'danger';
export type TagVariant = 'default' | 'stamp';

const STATUSES = ['neutral', 'info', 'success', 'warning', 'danger'] as const;

/** Same glyphs as React's `STATUS_GLYPHS`. */
export const STATUS_GLYPHS: Readonly<Record<SemanticStatus, string | undefined>> = Object.freeze({
  neutral: undefined,
  info: '[i]',
  success: '[+]',
  warning: '[!]',
  danger: '[×]',
});

/** Same labels as React's `STATUS_SR_LABELS`. */
export const STATUS_SR_LABELS: Readonly<Record<SemanticStatus, string | undefined>> = Object.freeze({
  neutral: undefined,
  info: 'Info',
  success: 'Success',
  warning: 'Warning',
  danger: 'Error',
});

const STATUS_SYNONYMS: Record<SemanticStatus, readonly string[]> = {
  neutral: [],
  info: ['info', 'information'],
  success: ['success', 'succeeded'],
  warning: ['warning', 'warn', 'caution'],
  danger: ['error', 'danger', 'critical', 'failed'],
};

/** Port of React's `startsWithStatusLabel`. */
function startsWithStatusLabel(text: string, label: string, status?: SemanticStatus): boolean {
  const lowerText = text.trimStart().toLowerCase();
  const candidates = status && label === STATUS_SR_LABELS[status] ? STATUS_SYNONYMS[status] : [label.toLowerCase()];
  for (const candidate of candidates) {
    if (!lowerText.startsWith(candidate)) continue;
    const rest = lowerText.slice(candidate.length);
    if (rest === '' || !/^\p{L}/u.test(rest)) return true;
    if (candidate === 'error' && /^(ed|s)(?!\p{L})/u.test(rest)) return true;
    if ((candidate === 'warn' || candidate === 'warning') && /^s(?!\p{L})/u.test(rest)) return true;
  }
  return false;
}

function statusParts(
  where: string,
  o: { status?: SemanticStatus; glyph?: string | false; srLabel?: string | false; children?: Child },
): { status: SemanticStatus | undefined; prefix: string } {
  const status = o.status === undefined ? undefined : oneOf(where, 'status', o.status, STATUSES, 'neutral');
  if (o.glyph !== undefined && o.glyph !== false && typeof o.glyph !== 'string') fail(where, 'glyph must be a string or false');
  if (o.srLabel !== undefined && o.srLabel !== false && typeof o.srLabel !== 'string') fail(where, 'srLabel must be a string or false');
  const glyph = o.glyph === false ? undefined : o.glyph !== undefined ? o.glyph : status ? STATUS_GLYPHS[status] : undefined;
  const srLabel = o.srLabel === false ? undefined : o.srLabel !== undefined ? o.srLabel : status ? STATUS_SR_LABELS[status] : undefined;
  const childText = textContent(o.children).trim();
  const showSr = Boolean(srLabel) && !(childText && srLabel && startsWithStatusLabel(childText, srLabel, status));
  let prefix = '';
  if (glyph) prefix += `<span class="f12-status-glyph" aria-hidden="true">${escapeHtml(glyph)}</span>`;
  if (showSr) prefix += `<span class="f12-sr-only">${escapeHtml(`${srLabel}: `)}</span>`;
  return { status, prefix };
}

// --------------------------------------------------------------------------------------- tag

export interface TagOpts {
  variant?: TagVariant;
  status?: SemanticStatus;
  glyph?: string | false;
  srLabel?: string | false;
  children: Child;
}

/** Mirrors `<Tag>`. Stamps are `tag({ variant: 'stamp' })`, as `<Stamp>` is `<Tag variant="stamp">`. */
export function tag(o: TagOpts): Html {
  const where = 'tag()';
  const variant = oneOf(where, 'variant', o.variant, ['default', 'stamp'] as const, 'default');
  const { status, prefix } = statusParts(where, o);
  const isStamp = variant === 'stamp';
  return html(
    `<span${attrs([
      ['class', `f12-tag${isStamp ? ' f12-tag-stamp' : ''}${status ? ` f12-status-${status}` : ''}`],
      ['data-variant', isStamp ? 'stamp' : undefined],
      ['data-status', status],
    ])}>${prefix}${child(o.children)}</span>`,
  );
}

// ------------------------------------------------------------------------------------- badge

export interface BadgeOpts {
  status?: SemanticStatus;
  glyph?: string | false;
  srLabel?: string | false;
  children: Child;
}

function burst(): string {
  let lines = '';
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const r1 = 15 + (i % 2) * 3;
    const r2 = 25 + (i % 3) * 3;
    lines += `<line x1="${30 + Math.cos(a) * r1 * 1.9}" y1="${14 + Math.sin(a) * r1 * 0.75}" x2="${30 + Math.cos(a) * r2 * 1.9}" y2="${14 + Math.sin(a) * r2 * 0.75}"></line>`;
  }
  return `<svg class="f12-burst" viewBox="-20 -12 100 52" aria-hidden="true">${lines}</svg>`;
}

/** Mirrors `<Badge>` at rest (no `pop` motion; the burst SVG appears when `status` is unset). */
export function badge(o: BadgeOpts): Html {
  const { status, prefix } = statusParts('badge()', o);
  return html(
    `<span${attrs([
      ['class', `f12-badge${status ? ` f12-status-${status}` : ''}`],
      ['data-status', status],
    ])}>${status === undefined ? burst() : ''}<span class="f12-badge-t">${prefix}${child(o.children)}</span></span>`,
  );
}

// ----------------------------------------------------------------------------------- balloon

export interface BalloonOpts {
  /** Tail offset in px from the balloon centre, within [-36, 36]. */
  tailOffset?: number;
  showDot?: boolean;
  children: Child;
}

/** Mirrors `<Balloon>`: a speech balloon with a mitered tail and optional marker dot. */
export function balloon(o: BalloonOpts): Html {
  const where = 'balloon()';
  const offset = o.tailOffset === undefined ? 0 : num(where, 'tailOffset', o.tailOffset, -36, 36);
  const showDot = bool(where, 'showDot', o.showDot, true);
  const svgW = 120;
  const svgH = 26;
  const tailX = svgW / 2 + offset * 0.4;
  const px = svgW / 2 + offset;
  const py = svgH - 5;
  const d = `M${tailX - 6},0 L${px - (px - tailX) * 0.15},${py - 7} L${tailX + 6},0`;
  return html(
    `<div class="f12-balloon-standalone"><div class="f12-balloon"><span${attrs([
      ['class', 'f12-balloon-gap'],
      ['aria-hidden', 'true'],
      ['style', `left:calc(50% + ${offset * 0.4 - 5}px)`],
    ])}></span>${child(o.children)}</div><svg width="${svgW}" height="${svgH}" class="f12-balloon-standalone-svg" aria-hidden="true"><path class="f12-tail" d="${d}"></path>${
      showDot ? `<circle class="f12-peak-dot" cx="${px}" cy="${py}" r="4"></circle>` : ''
    }</svg></div>`,
  );
}
