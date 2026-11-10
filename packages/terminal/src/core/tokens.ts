/**
 * Terminal tokens, derived at build time from `@frame12/tokens` (see `tokens.generated.ts`).
 *
 * A terminal's background cannot be detected reliably, so FRAME/12 never paints ink as a fixed
 * foreground color: ink is the terminal's own foreground, secondary ink and rules are `dim`, and
 * statuses use weight and inversion, as they do on the web (`.f12-status-*` is monochrome there too).
 * Exact colors appear only where FRAME/12 sets both foreground and background: the marker chip.
 *
 * Style levels:
 * - `truecolor`: exact token hex values.
 * - `ansi256`: the nearest xterm-256 index, computed (never the 16 theme-defined entries).
 * - `ansi16`: a hand-tuned table.
 * - `mono`: bold, dim, inverse and underline only (e.g. `NO_COLOR` on a TTY).
 * - `none`: no escape sequences at all (pipes, files, `TERM=dumb`).
 */
import { tokenGutterPx, tokenMotion, tokenPalette, TOKENS_PACKAGE_VERSION } from './tokens.generated.js';
import type { ColorLevel } from './capabilities.js';

export { tokenGutterPx, tokenMotion, tokenPalette, TOKENS_PACKAGE_VERSION };

export type StyleLevel = 'none' | 'mono' | 'ansi16' | 'ansi256' | 'truecolor';
export type ThemeName = 'light' | 'dark';
export type TokenName = keyof (typeof tokenPalette)['light'];
export type Rgb = readonly [number, number, number];

export function styleLevel(colorLevel: ColorLevel, attributes: boolean): StyleLevel {
  if (colorLevel === 3) return 'truecolor';
  if (colorLevel === 2) return 'ansi256';
  if (colorLevel === 1) return 'ansi16';
  return attributes ? 'mono' : 'none';
}

export function hexToRgb(hex: string): Rgb {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`Expected a #rrggbb color, got ${hex}`);
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const CUBE = [0, 95, 135, 175, 215, 255] as const;

/** The RGB value of an xterm-256 palette index in 16–255 (0–15 are theme-defined). */
export function xterm256Rgb(index: number): Rgb {
  if (!Number.isInteger(index) || index < 16 || index > 255) throw new RangeError(`xterm-256 index must be 16–255, got ${index}`);
  if (index >= 232) {
    const v = 8 + (index - 232) * 10;
    return [v, v, v];
  }
  const i = index - 16;
  return [CUBE[Math.floor(i / 36)]!, CUBE[Math.floor(i / 6) % 6]!, CUBE[i % 6]!];
}

/** Squared distance with "redmean" weighting, a cheap perceptual approximation. */
function distance(a: Rgb, b: Rgb): number {
  const rMean = (a[0] + b[0]) / 2;
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return (2 + rMean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rMean) / 256) * db * db;
}

/** Nearest xterm-256 index (16–255) to a `#rrggbb` color. Ties go to the lower index. */
export function nearestAnsi256(hex: string): number {
  const rgb = hexToRgb(hex);
  let best = 16;
  let bestD = Number.POSITIVE_INFINITY;
  for (let i = 16; i <= 255; i++) {
    const d = distance(rgb, xterm256Rgb(i));
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/**
 * Hand-tuned 16-color table: SGR foreground / background codes per token and theme. Bright yellow
 * (93/103) is used for marker because standard yellow (33/43) is olive or brown in many themes.
 */
export const ANSI16: Record<ThemeName, Record<TokenName, { fg: number; bg: number }>> = {
  light: {
    desk: { fg: 37, bg: 47 },
    sheet: { fg: 97, bg: 107 },
    panel: { fg: 97, bg: 107 },
    paper: { fg: 97, bg: 107 },
    ink: { fg: 30, bg: 40 },
    'ink-2': { fg: 90, bg: 100 },
    rule: { fg: 30, bg: 40 },
    grid: { fg: 37, bg: 47 },
    marker: { fg: 93, bg: 103 },
    'marker-ink': { fg: 30, bg: 40 },
  },
  dark: {
    desk: { fg: 30, bg: 40 },
    sheet: { fg: 30, bg: 40 },
    panel: { fg: 90, bg: 100 },
    paper: { fg: 30, bg: 40 },
    ink: { fg: 97, bg: 107 },
    'ink-2': { fg: 37, bg: 47 },
    rule: { fg: 97, bg: 107 },
    grid: { fg: 90, bg: 100 },
    marker: { fg: 93, bg: 103 },
    'marker-ink': { fg: 30, bg: 40 },
  },
};

/** SGR parameters that set a token as foreground or background at a style level ('' at mono/none). */
export function tokenSgr(name: TokenName, theme: ThemeName, level: StyleLevel, plane: 'fg' | 'bg'): string {
  const hex = tokenPalette[theme][name];
  if (level === 'truecolor') {
    const [r, g, b] = hexToRgb(hex);
    return `${plane === 'fg' ? 38 : 48};2;${r};${g};${b}`;
  }
  if (level === 'ansi256') return `${plane === 'fg' ? 38 : 48};5;${nearestAnsi256(hex)}`;
  if (level === 'ansi16') return String(ANSI16[theme][name][plane]);
  return '';
}

/** Semantic roles the grammar paints with. */
export const ROLES = [
  'ink',
  'ink2',
  'rule',
  'strong',
  'link',
  'marker',
  'status-review',
  'status-info',
  'status-ok',
  'status-warning',
  'status-danger',
] as const;
export type Role = (typeof ROLES)[number];

export interface Sgr {
  open: string;
  close: string;
}

const NONE: Sgr = { open: '', close: '' };
const sgr = (open: string, close: string): Sgr => ({ open: `\u001b[${open}m`, close: `\u001b[${close}m` });

const ATTRIBUTE_ROLES: Record<Exclude<Role, 'marker'>, Sgr> = {
  ink: NONE,
  ink2: sgr('2', '22'),
  rule: sgr('2', '22'),
  strong: sgr('1', '22'),
  link: sgr('4', '24'),
  'status-review': sgr('1', '22'),
  'status-info': NONE,
  'status-ok': sgr('1', '22'),
  'status-warning': sgr('1', '22'),
  // Danger is an ink-filled stamp on the web; in a terminal that is inverse video. At `mono`,
  // inverse is reserved for the single marker chip, so danger is bold + underline there.
  'status-danger': sgr('1;7', '22;27'),
};

/** The marker chip: marker background with marker-ink text, bold. Theme-independent. */
function markerSgr(level: StyleLevel): Sgr {
  if (level === 'none') return NONE;
  if (level === 'mono') return sgr('1;7', '22;27');
  const bg = tokenSgr('marker', 'light', level, 'bg');
  const fg = tokenSgr('marker-ink', 'light', level, 'fg');
  return sgr(`1;${bg};${fg}`, '22;39;49');
}

/** Escape sequences for a role at a style level. `none` returns empty strings. */
export function roleSgr(role: Role, level: StyleLevel): Sgr {
  if (level === 'none') return NONE;
  if (role === 'marker') return markerSgr(level);
  if (level === 'mono' && role === 'status-danger') return sgr('1;4', '22;24');
  return ATTRIBUTE_ROLES[role];
}

const SGR_RE = /\u001b\[([0-9;]*)m/g;

/**
 * Wraps already-sanitized text in a role's escape sequences. Nesting is safe: SGR closes are
 * shared (`22` ends both bold and dim, `0` ends everything), so wherever the text contains a
 * sequence that would end this role's attributes, the role is opened again right after it.
 * `paint(\`dim \${paint('bold', 'strong', l)} dim\`, 'ink2', l)` stays dim after the bold part.
 */
export function paint(text: string, role: Role, level: StyleLevel): string {
  const { open, close } = roleSgr(role, level);
  if (open === '' || text === '') return text;
  const ours = new Set(close.slice(2, -1).split(';'));
  const inner = text.replace(SGR_RE, (seq, params: string) => {
    const resets = params === '' ? ['0'] : params.split(';');
    return resets.some((p) => p === '0' || ours.has(p)) ? `${seq}${open}` : seq;
  });
  return `${open}${inner}${close}`;
}

/**
 * FRAME/12's gutter scale translated to terminal cells: a pair (12px) is 1 cell or line, a scene
 * (20px) is 2, a change of subject (32px) is 3. These are the only legal spacings.
 */
export const GUTTER_CELLS = { pair: 1, scene: 2, change: 3 } as const;
export type Gutter = keyof typeof GUTTER_CELLS;
