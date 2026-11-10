/**
 * Terminal capability detection. `detectCapabilities` is pure: everything it reads is passed in,
 * so tests inject environments instead of depending on the machine running them.
 */
import { flagValue, hasFlag, lastFlag } from './argv.js';

export type ColorLevel = 0 | 1 | 2 | 3;
export type Env = Readonly<Record<string, string | undefined>>;

export interface StreamLike {
  isTTY?: boolean;
  columns?: number;
  rows?: number;
}
export interface InputStreamLike {
  isTTY?: boolean;
  setRawMode?: unknown;
}
export interface Streams {
  stdin?: InputStreamLike;
  stdout?: StreamLike;
  stderr?: StreamLike;
}

export interface DetectOptions {
  /** Defaults to `process.platform` when available, else `linux`. */
  platform?: string;
}

export interface Capabilities {
  /** Color depth for stdout (results). 0 none, 1 = 16 colors, 2 = 256, 3 = truecolor. */
  colorLevel: ColorLevel;
  /** Color depth for stderr (narration). */
  stderrColorLevel: ColorLevel;
  /**
   * stdout may carry bold / dim / inverse / underline. True whenever color is on, and on a TTY
   * where color is off (`NO_COLOR` asks for no color, not for no emphasis). False on pipes and
   * `TERM=dumb`, so files and logs never receive escape sequences.
   */
  attributes: boolean;
  /** stderr may carry bold / dim / inverse / underline. */
  stderrAttributes: boolean;
  /** Non-ASCII glyphs may be printed. False means every glyph uses its ASCII twin. */
  unicode: boolean;
  /** East Asian ambiguous-width characters render 2 cells wide (CJK locales). */
  ambiguousWide: boolean;
  /** OSC 8 hyperlinks may be emitted. */
  links: boolean;
  /** Layout width in cells, clamped to 20–400. */
  columns: number;
  /** Layout height in rows, clamped to 5–200. */
  rows: number;
  /** stdout is a TTY. */
  isTTY: boolean;
  /** stderr is a TTY. */
  stderrIsTTY: boolean;
  /** stdin and stdout are TTYs, not CI, and stdin supports raw mode. */
  interactive: boolean;
  /** A screen reader is in use: append-only plain lines, no cursor movement. */
  screenReader: boolean;
  /** Running under continuous integration. */
  ci: boolean;
  /** The detected CI provider, if any. */
  ciProvider: string | undefined;
  /** `TERM=dumb`. */
  dumb: boolean;
  /** Running inside a terminal multiplexer. */
  multiplexer: 'tmux' | 'screen' | undefined;
  /**
   * The terminal re-wraps what is on screen when it gets narrower (iTerm2, kitty, WezTerm, VTE,
   * Windows Terminal, ...). Only then does a resize need the live view's extra cleanup; on a
   * terminal that does not (xterm, the Linux console, multiplexers) that cleanup would erase lines
   * above the live region. Unknown terminals are assumed not to. `FRAME12_REFLOW=1|0` overrides.
   */
  reflow: boolean;
}

/** Known CI provider variables, checked in order. `CI` itself is checked first. */

const CI_PROVIDERS: ReadonlyArray<readonly [string, string]> = [
  ['GITHUB_ACTIONS', 'github-actions'],
  ['GITLAB_CI', 'gitlab'],
  ['BUILDKITE', 'buildkite'],
  ['CIRCLECI', 'circleci'],
  ['TRAVIS', 'travis'],
  ['JENKINS_URL', 'jenkins'],
  ['TEAMCITY_VERSION', 'teamcity'],
  ['TF_BUILD', 'azure-pipelines'],
  ['BITBUCKET_BUILD_NUMBER', 'bitbucket'],
  ['APPVEYOR', 'appveyor'],
  ['DRONE', 'drone'],
  ['CODEBUILD_BUILD_ID', 'aws-codebuild'],
  ['SEMAPHORE', 'semaphore'],
  ['BUILD_BUILDID', 'azure-pipelines'],
];

const MIN_COLUMNS = 20;
const MAX_COLUMNS = 400;
const MIN_ROWS = 5;
const MAX_ROWS = 200;

/** `true` when the variable is set, non-empty and not `0` / `false`. */
export function envFlag(env: Env, name: string): boolean {
  const v = env[name];
  if (v === undefined) return false;
  const t = v.trim().toLowerCase();
  return t !== '' && t !== '0' && t !== 'false';
}

export function detectCi(env: Env): { ci: boolean; provider: string | undefined } {
  for (const [name, provider] of CI_PROVIDERS) {
    if (env[name] !== undefined && env[name] !== '' && env[name] !== 'false') return { ci: true, provider };
  }
  if (envFlag(env, 'CI') || envFlag(env, 'CONTINUOUS_INTEGRATION')) return { ci: true, provider: undefined };
  return { ci: false, provider: undefined };
}

function locale(env: Env): string {
  return env.LC_ALL || env.LC_CTYPE || env.LANG || '';
}

/** Locales whose terminals traditionally render East Asian ambiguous-width characters wide. */
export function isCjkLocale(env: Env): boolean {
  return /^(ja|zh|ko)(?:[_.@-]|$)/i.test(locale(env));
}

/** True for terminals that implement OSC 8 hyperlinks. Unknown terminals get plain text. */
function terminalSupportsLinks(env: Env): boolean {
  const program = env.TERM_PROGRAM ?? '';
  if (['iTerm.app', 'WezTerm', 'ghostty', 'vscode', 'Hyper', 'Tabby', 'rio', 'Alacritty'].includes(program)) return true;
  if (env.WT_SESSION) return true;
  if (env.KITTY_WINDOW_ID || env.TERM === 'xterm-kitty') return true;
  if (env.KONSOLE_VERSION) return true;
  if (env.TERM === 'foot' || env.TERM?.startsWith('foot-')) return true;
  if (env.TERM === 'xterm-ghostty' || env.TERM === 'wezterm') return true;
  const vte = Number(env.VTE_VERSION);
  if (Number.isFinite(vte) && vte >= 5000) return true;
  return false;
}

/** True for terminals known to re-wrap on resize (see `Capabilities.reflow`). */
function terminalReflows(env: Env, multiplexer: 'tmux' | 'screen' | undefined): boolean {
  if (env.FRAME12_REFLOW === '1') return true;
  if (env.FRAME12_REFLOW === '0') return false;
  if (multiplexer) return false;
  const program = env.TERM_PROGRAM ?? '';
  if (['iTerm.app', 'Apple_Terminal', 'WezTerm', 'ghostty', 'vscode', 'Hyper', 'Tabby', 'rio', 'Alacritty'].includes(program)) return true;
  if (env.WT_SESSION || env.KITTY_WINDOW_ID || env.TERM === 'xterm-kitty') return true;
  if (env.TERM === 'foot' || env.TERM?.startsWith('foot-') || env.TERM === 'xterm-ghostty' || env.TERM === 'wezterm' || env.TERM === 'alacritty') return true;
  const vte = Number(env.VTE_VERSION);
  return Number.isFinite(vte) && vte >= 4000;
}

function detectMultiplexer(env: Env): 'tmux' | 'screen' | undefined {
  if (env.TMUX || env.TERM?.startsWith('tmux')) return 'tmux';
  if (env.STY || env.TERM?.startsWith('screen')) return 'screen';
  return undefined;
}

/** Color depth from the terminal's own variables, ignoring TTY-ness. */
function detectDepth(env: Env): ColorLevel {
  const colorTerm = (env.COLORTERM ?? '').toLowerCase();
  const program = env.TERM_PROGRAM ?? '';
  if (
    colorTerm === 'truecolor' ||
    colorTerm === '24bit' ||
    Boolean(env.WT_SESSION) ||
    program === 'vscode' ||
    program === 'WezTerm' ||
    program === 'iTerm.app' ||
    program === 'ghostty' ||
    program === 'Alacritty'
  ) {
    return 3;
  }
  if (env.TERM && /256color/i.test(env.TERM)) return 2;
  return 1;
}

/**
 * Color level for one stream. Precedence (ported from Repo Archaeology RA-13, then CLI overrides):
 * 1. `--no-color` / `--color` (the last one on the command line wins)
 * 2. non-empty `NO_COLOR` → 0 (https://no-color.org/)
 * 3. `NODE_DISABLE_COLORS` (non-empty, not `0`) → 0
 * 4. `FORCE_COLOR` (`0`/`false` → 0, `1`/`true` → 1, `2` → 2, `3`+ → 3), honored even on pipes
 * 5. `TERM=dumb` or not a TTY → 0
 * 6. depth from `COLORTERM`, `WT_SESSION`, `TERM_PROGRAM`, `TERM=*256color`
 */
export function resolveColorLevel(env: Env, argv: readonly string[], isTTY: boolean): ColorLevel {
  const flag = lastFlag(argv, '--color', '--no-color');
  if (flag === '--no-color') return 0;
  if (flag === '--color') return detectDepth(env);
  if (env.NO_COLOR !== undefined && env.NO_COLOR !== '') return 0;
  if (env.NODE_DISABLE_COLORS !== undefined && env.NODE_DISABLE_COLORS !== '' && env.NODE_DISABLE_COLORS !== '0') return 0;
  if (env.FORCE_COLOR !== undefined && env.FORCE_COLOR !== '') {
    const fc = env.FORCE_COLOR.trim().toLowerCase();
    if (fc === '0' || fc === 'false') return 0;
    if (fc === '1' || fc === 'true') return 1;
    if (fc === '2') return 2;
    if (fc === '3') return 3;
    const num = Number(fc);
    if (Number.isInteger(num) && num >= 3) return 3;
    if (Number.isInteger(num) && num > 0) return num as ColorLevel;
  }
  if (env.TERM === 'dumb') return 0;
  if (!isTTY) return 0;
  return detectDepth(env);
}

function resolveUnicode(env: Env, argv: readonly string[], platform: string): boolean {
  const flag = lastFlag(argv, '--ascii', '--unicode');
  if (flag === '--ascii') return false;
  if (flag === '--unicode') return true;
  if (envFlag(env, 'FRAME12_ASCII')) return false;
  if (env.TERM === 'dumb') return false;
  const program = env.TERM_PROGRAM ?? '';
  const knownModern =
    Boolean(env.WT_SESSION) ||
    program === 'vscode' ||
    program === 'Apple_Terminal' ||
    program === 'iTerm.app' ||
    program === 'WezTerm' ||
    program === 'ghostty' ||
    program === 'Alacritty' ||
    Boolean(env.KITTY_WINDOW_ID);
  if (knownModern) return true;
  if (platform === 'win32') {
    // Legacy conhost has no TERM and no Windows Terminal session; its default code page mangles
    // box drawing and symbols. MSYS/mintty and ConEmu set TERM or their own variables.
    return Boolean(env.TERM) || Boolean(env.ConEmuANSI) || env.TERM_PROGRAM !== undefined;
  }
  const loc = locale(env);
  if (loc === '') return true; // Unset: modern POSIX terminals default to UTF-8.
  return /utf-?8/i.test(loc);
}

function resolveLinks(env: Env, argv: readonly string[], ctx: { isTTY: boolean; ci: boolean; dumb: boolean; multiplexer: string | undefined }): boolean {
  const flag = lastFlag(argv, '--links', '--no-links');
  if (flag === '--no-links') return false;
  if (flag === '--links') return true;
  if (env.FRAME12_LINKS !== undefined && env.FRAME12_LINKS !== '') return envFlag(env, 'FRAME12_LINKS');
  if (env.FORCE_HYPERLINK === '0') return false;
  if (env.FORCE_HYPERLINK === '1') return true;
  if (ctx.dumb || !ctx.isTTY || ctx.ci) return false;
  if (ctx.multiplexer) return false;
  return terminalSupportsLinks(env);
}

function resolveAmbiguousWide(env: Env): boolean {
  const v = env.FRAME12_AMBIGUOUS_WIDE;
  if (v !== undefined && v !== '') return envFlag(env, 'FRAME12_AMBIGUOUS_WIDE');
  return isCjkLocale(env);
}

function clampInt(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, Math.floor(n)));
}

function positive(v: unknown): number | undefined {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : undefined;
}


/**
 * Detects what the terminal can do. Pure: pass `process.env`, `{ stdin, stdout, stderr }` and
 * `process.argv` (or test doubles). Every flag has a CLI override: `--color`/`--no-color`,
 * `--ascii`/`--unicode`, `--links`/`--no-links`, `--screen-reader`, `--columns N`, `--rows N`.
 */
export function detectCapabilities(env: Env = {}, streams: Streams = {}, argv: readonly string[] = [], options: DetectOptions = {}): Capabilities {
  const platform = options.platform ?? (typeof process !== 'undefined' ? process.platform : undefined) ?? 'linux';
  const isTTY = streams.stdout?.isTTY === true;
  const stderrIsTTY = streams.stderr?.isTTY === true;
  const stdinTTY = streams.stdin?.isTTY === true;
  const { ci, provider } = detectCi(env);
  const dumb = env.TERM === 'dumb';
  const multiplexer = detectMultiplexer(env);

  const ttyStream = isTTY ? streams.stdout : stderrIsTTY ? streams.stderr : undefined;
  const columns = clampInt(
    positive(flagValue(argv, '--columns')) ?? positive(ttyStream?.columns) ?? positive(env.COLUMNS) ?? 80,
    MIN_COLUMNS,
    MAX_COLUMNS,
  );
  const rows = clampInt(positive(flagValue(argv, '--rows')) ?? positive(ttyStream?.rows) ?? positive(env.LINES) ?? 24, MIN_ROWS, MAX_ROWS);

  const screenReader = hasFlag(argv, '--screen-reader') || envFlag(env, 'FRAME12_SCREEN_READER') || env.INK_SCREEN_READER === 'true';
  const interactive = stdinTTY && isTTY && !ci && !dumb && typeof streams.stdin?.setRawMode === 'function';

  const colorLevel = resolveColorLevel(env, argv, isTTY);
  const stderrColorLevel = resolveColorLevel(env, argv, stderrIsTTY);

  return {
    colorLevel,
    stderrColorLevel,
    attributes: colorLevel > 0 || (isTTY && !dumb),
    stderrAttributes: stderrColorLevel > 0 || (stderrIsTTY && !dumb),
    unicode: resolveUnicode(env, argv, platform),
    ambiguousWide: resolveAmbiguousWide(env),
    links: resolveLinks(env, argv, { isTTY, ci, dumb, multiplexer }),
    columns,
    rows,
    isTTY,
    stderrIsTTY,
    interactive,
    screenReader,
    ci,
    ciProvider: provider,
    dumb,
    multiplexer,
    reflow: terminalReflows(env, multiplexer),
  };
}
