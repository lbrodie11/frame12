import type { ResultSnapshot, StoryboardEvent } from '../model/index.js';

export interface PlainRenderOptions {
  columns?: number;
  isTTY?: boolean;
  noColor?: boolean;
  isReplay?: boolean;
  env?: Record<string, string | undefined>;
}

/**
 * Strips terminal escape sequences (OSC including OSC 8 hyperlinks while preserving
 * visible link text, DCS/APC/PM, CSI, 2-byte ESC), C0/C1 control characters,
 * and Unicode bidirectional override characters from untrusted git output.
 */
export function sanitizeTerminalText(input: unknown): string {
  if (input === null || input === undefined) return '';
  const raw = String(input).normalize('NFC');

  return (
    raw
      // 1. Strip OSC sequences (\x1b] ... BEL or ST). For OSC 8 hyperlinks, the opening
      //    and closing tags are separate OSC sequences, so the visible label remains.
      .replace(/\x1b\][\s\S]*?(?:\x07|\x1b\\)/g, '')
      // 2. Strip DCS, SOS, PM, APC sequences (\x1bP, \x1bX, \x1b^, \x1b_ ... ST)
      .replace(/\x1b[PX^_][\s\S]*?(?:\x07|\x1b\\)/g, '')
      // 3. Strip ANSI CSI sequences (\x1b[ ... final byte)
      .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '')
      // 4. Strip 2-byte ESC sequences and any lone ESC
      .replace(/\x1b[@-Z\\-_]/g, '')
      .replace(/\x1b/g, '')
      // 5. Normalize tabs and newlines to single spaces
      .replace(/[\t\n\v\f]+/g, ' ')
      // 6. Strip carriage returns, backspaces, and all remaining C0 / C1 control characters
      .replace(/[\x00-\x1f\x7f-\x9f]/g, '')
      // 7. Strip Unicode bidirectional control and isolate/override characters
      .replace(/[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

export function shouldUseColor(options: PlainRenderOptions = {}): boolean {
  const env = options.env ?? (typeof process !== 'undefined' ? process.env : {});
  if (options.noColor === true) return false;
  if (env.NO_COLOR !== undefined && env.NO_COLOR !== '') return false;
  if (env.TERM === 'dumb') return false;
  if (env.FORCE_COLOR !== undefined && env.FORCE_COLOR !== '' && env.FORCE_COLOR !== '0') {
    return true;
  }
  if (env.CI === 'true' || env.CI === '1') return false;
  if (!options.isTTY) return false;
  return true;
}

export function resolveColumns(options: PlainRenderOptions = {}): number {
  const env = options.env ?? (typeof process !== 'undefined' ? process.env : {});
  const envCols = env.COLUMNS !== undefined ? Number(env.COLUMNS) : Number.NaN;
  const raw =
    options.columns ?? (Number.isFinite(envCols) && envCols > 0 ? envCols : 80);
  if (!Number.isFinite(raw) || raw <= 0) return 80;
  return Math.max(40, Math.floor(raw));
}

function isZeroWidthCodePoint(cp: number): boolean {
  if (cp <= 0x1f || (cp >= 0x7f && cp <= 0x9f)) return true;
  if (cp >= 0x0300 && cp <= 0x036f) return true; // Combining Diacritical Marks
  if (cp >= 0x1ab0 && cp <= 0x1aff) return true;
  if (cp >= 0x1dc0 && cp <= 0x1dff) return true;
  if (cp >= 0x20d0 && cp <= 0x20ff) return true;
  if (cp >= 0xfe20 && cp <= 0xfe2f) return true;
  if (cp >= 0xfe00 && cp <= 0xfe0f) return true; // Variation Selectors
  if (cp >= 0x200b && cp <= 0x200f) return true; // ZWSP, ZWNJ, ZWJ, LRM, RLM
  if (cp === 0xfeff) return true;
  return false;
}

function isDoubleWidthCodePoint(cp: number): boolean {
  return (
    cp >= 0x1100 &&
    (cp <= 0x115f ||
      cp === 0x2329 ||
      cp === 0x232a ||
      (cp >= 0x2e80 && cp <= 0xa4cf && cp !== 0x303f) ||
      (cp >= 0xac00 && cp <= 0xd7a3) ||
      (cp >= 0xf900 && cp <= 0xfaff) ||
      (cp >= 0xfe10 && cp <= 0xfe19) ||
      (cp >= 0xfe30 && cp <= 0xfe6f) ||
      (cp >= 0xff00 && cp <= 0xff60) ||
      (cp >= 0xffe0 && cp <= 0xffe6) ||
      (cp >= 0x1f000 && cp <= 0x1faff) ||
      (cp >= 0x20000 && cp <= 0x3fffd))
  );
}

export function getCodePointDisplayWidth(cp: number): number {
  if (isZeroWidthCodePoint(cp)) return 0;
  if (isDoubleWidthCodePoint(cp)) return 2;
  return 1;
}

const graphemeSegmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });

function getGraphemeClusterDisplayWidth(cluster: string): number {
  let maxCpWidth = 0;
  for (const ch of cluster) {
    const cp = ch.codePointAt(0)!;
    // Emoji skin-tone modifiers (U+1F3FB..U+1F3FF) and regional indicators (U+1F1E6..U+1F1FF)
    // form a 2-column emoji cluster without adding extra columns beyond 2.
    if (cp >= 0x1f1e6 && cp <= 0x1f1ff) {
      maxCpWidth = Math.max(maxCpWidth, 2);
      continue;
    }
    const w = getCodePointDisplayWidth(cp);
    if (w > maxCpWidth) maxCpWidth = w;
  }
  return maxCpWidth;
}

/**
 * Computes the terminal column display width of a string, ignoring any SGR
 * escape sequences and accounting for grapheme clusters, zero-width combining
 * marks, and 2-column East Asian / emoji clusters.
 */
export function getDisplayWidth(str: string): number {
  const withoutAnsi = str.replace(/\x1b\[[0-9;]*m/g, '');
  let width = 0;
  for (const { segment } of graphemeSegmenter.segment(withoutAnsi)) {
    width += getGraphemeClusterDisplayWidth(segment);
  }
  return width;
}

function sliceTokenByDisplayWidth(token: string, maxCols: number): string[] {
  const chunks: string[] = [];
  let current = '';
  let currentWidth = 0;
  for (const { segment } of graphemeSegmenter.segment(token)) {
    const w = getGraphemeClusterDisplayWidth(segment);
    if (currentWidth + w > maxCols && current.length > 0) {
      chunks.push(current);
      current = segment;
      currentWidth = w;
    } else {
      current += segment;
      currentWidth += w;
    }
  }
  if (current.length > 0) chunks.push(current);
  return chunks.length > 0 ? chunks : [''];
}

/**
 * Wraps a single logical line so that every physical line has display width <= maxCols
 * without splitting surrogate pairs or multi-codepoint grapheme clusters.
 */
export function wrapLineToWidth(line: string, maxCols: number, continuationIndent = '     '): string[] {
  const width = Math.max(40, maxCols);
  if (getDisplayWidth(line) <= width) return [line];

  const indent = getDisplayWidth(continuationIndent) < width - 10 ? continuationIndent : '  ';
  const indentWidth = getDisplayWidth(indent);
  const words = line.split(' ');
  const lines: string[] = [];
  let current = '';

  const pushHardWrappedToken = (token: string, firstPrefix: string) => {
    let remaining = token;
    while (remaining.length > 0) {
      const pfx = lines.length === 0 ? firstPrefix : indent;
      const avail = Math.max(10, width - getDisplayWidth(pfx));
      const [head, ...rest] = sliceTokenByDisplayWidth(remaining, avail);
      lines.push(pfx + (head ?? ''));
      remaining = rest.join('');
    }
  };

  for (const word of words) {
    const prefix = lines.length === 0 && current.length === 0 ? '' : current.length === 0 ? indent : '';
    const candidate = current.length === 0 ? prefix + word : `${current} ${word}`;

    if (getDisplayWidth(candidate) <= width) {
      current = candidate;
    } else {
      if (current.length > 0) {
        lines.push(current);
        current = '';
      }
      const nextPrefix = lines.length === 0 ? '' : indent;
      const nextPrefixWidth = lines.length === 0 ? 0 : indentWidth;
      if (nextPrefixWidth + getDisplayWidth(word) <= width) {
        current = nextPrefix + word;
      } else {
        pushHardWrappedToken(word, nextPrefix);
      }
    }
  }

  if (current.length > 0) {
    lines.push(current);
  }

  return lines.length > 0 ? lines : [''];
}

export function formatBlockToWidth(lines: string[], maxCols: number): string {
  const out: string[] = [];
  for (const line of lines) {
    const leadingMatch = line.match(/^(\s*)/);
    const indent = leadingMatch ? leadingMatch[1] : '';
    const nextIndent = indent.length > 0 && indent.length <= 8 ? indent : '     ';
    out.push(...wrapLineToWidth(line, maxCols, nextIndent));
  }
  return out.join('\n');
}

function formatCutNumber(index1Based: number): string {
  const prefix = 'C';
  return `${prefix}-${String(index1Based).padStart(2, '0')}`;
}

/**
 * Stateful append-only plain terminal narrator for live or replayed StoryboardEvents.
 * Emits cut headers immediately on step-start, throttled progress lines on step-progress,
 * and completion lines on step-end without cursor redraws or spinners.
 */
export class PlainStreamPrinter {
  private readonly maxCols: number;
  private readonly isReplay: boolean;
  private readonly useColor: boolean;
  private readonly writeLine: (line: string) => void;
  private stepCutNumber = new Map<string, string>();
  private stepTitle = new Map<string, string>();
  private stepLastProgressCount = new Map<string, number>();
  private stepLastProgressTs = new Map<string, number>();
  private nextCutIndex = 1;

  constructor(
    writeLine: (line: string) => void,
    options: PlainRenderOptions = {},
  ) {
    this.maxCols = resolveColumns(options);
    this.isReplay = Boolean(options.isReplay);
    this.useColor = shouldUseColor(options);
    this.writeLine = writeLine;
  }

  private styleBold(text: string): string {
    return this.useColor ? `\x1b[1m${text}\x1b[22m` : text;
  }

  private emitLines(lines: string[]): void {
    const formatted = formatBlockToWidth(lines, this.maxCols);
    for (const line of formatted.split('\n')) {
      this.writeLine(line);
    }
  }

  public onEvent(event: StoryboardEvent): void {
    if (event.type === 'run-start') {
      const repoLabel = sanitizeTerminalText(event.payload.repoLabel ?? 'repo');
      const maxCommits = sanitizeTerminalText(event.payload.maxCommits ?? '');
      const replayTag = this.isReplay ? '[REPLAY] ' : '';
      const reconTag = event.payload.reconstructed ? '[RECONSTRUCTED] ' : '';
      const header = `${replayTag}${reconTag}FRAME/12 STORYBOARD · ${repoLabel}${maxCommits ? ` (window: ${maxCommits} commits)` : ''}`;
      this.emitLines([this.styleBold(header), '-'.repeat(Math.min(this.maxCols, 64))]);
      return;
    }

    if (event.type === 'step-start' && event.stepId) {
      const stepId = sanitizeTerminalText(event.stepId);
      if (!this.stepCutNumber.has(stepId)) {
        this.stepCutNumber.set(stepId, formatCutNumber(this.nextCutIndex));
        this.nextCutIndex += 1;
      }
      const cutLabel = this.stepCutNumber.get(stepId)!;
      const title = sanitizeTerminalText(event.payload.title ?? stepId);
      this.stepTitle.set(stepId, title);
      this.stepLastProgressCount.set(stepId, 0);
      this.stepLastProgressTs.set(stepId, Date.parse(event.ts) || Date.now());
      this.emitLines([`${this.styleBold(cutLabel)} ${title} [${stepId}]`]);
      return;
    }

    if (event.type === 'step-progress' && event.stepId) {
      const stepId = sanitizeTerminalText(event.stepId);
      const count =
        typeof event.payload.commitsParsed === 'number'
          ? event.payload.commitsParsed
          : typeof event.payload.commitsProcessed === 'number'
            ? event.payload.commitsProcessed
            : 0;
      const prevCount = this.stepLastProgressCount.get(stepId) ?? 0;
      const nowTs = Date.parse(event.ts) || Date.now();
      const prevTs = this.stepLastProgressTs.get(stepId) ?? 0;
      if (count - prevCount >= 500 || nowTs - prevTs >= 1000) {
        this.stepLastProgressCount.set(stepId, count);
        this.stepLastProgressTs.set(stepId, nowTs);
        const detail =
          typeof event.payload.commitsParsed === 'number'
            ? `${event.payload.commitsParsed} commits read...`
            : `${count} commits processed...`;
        this.emitLines([`     Progress: ${sanitizeTerminalText(detail)}`]);
      }
      return;
    }

    if (event.type === 'warning') {
      const msg = sanitizeTerminalText(event.payload.message ?? 'Warning');
      this.emitLines([`     Warning: ${msg}`]);
      return;
    }

    if (event.type === 'step-end' && event.stepId) {
      const stepId = sanitizeTerminalText(event.stepId);
      const cutLabel = this.stepCutNumber.get(stepId) ?? formatCutNumber(this.nextCutIndex++);
      const status = sanitizeTerminalText(String(event.payload.status ?? 'ok').toUpperCase());
      const summary = event.payload.summary ? ` · ${sanitizeTerminalText(event.payload.summary)}` : '';
      this.emitLines([`     Status: ${status}${summary} (${cutLabel} complete)`]);
    }
  }
}

/**
 * Renders the final FINDINGS and RESULT blocks for plain storyboard output.
 */
export function renderPlainSummary(
  snapshot: ResultSnapshot,
  options: PlainRenderOptions = {},
): string {
  const maxCols = resolveColumns(options);
  const useColor = shouldUseColor(options);
  const lines: string[] = [];
  const prefix = options.isReplay ? '[REPLAY] ' : '';

  if (snapshot.reconstructed) {
    lines.push(
      `[RECONSTRUCTED] ${sanitizeTerminalText(snapshot.reconstructed.note)} (source: ${sanitizeTerminalText(snapshot.reconstructed.source)})`,
    );
  }

  lines.push('');
  lines.push(`${prefix}FINDINGS (${snapshot.findings.length})`);

  if (snapshot.findings.length === 0) {
    if (snapshot.status === 'failed') {
      lines.push(`  No findings available (run failed: ${sanitizeTerminalText(snapshot.error ?? 'unknown error')}).`);
    } else if (snapshot.status === 'canceled') {
      lines.push('  No findings available (run canceled before completion).');
    } else {
      lines.push('  No coupled file pairs met the co-change threshold in this commit window.');
    }
  } else {
    for (let idx = 0; idx < snapshot.findings.length; idx++) {
      const f = snapshot.findings[idx]!;
      const id = sanitizeTerminalText(f.id);
      const fileA = sanitizeTerminalText(f.files[0]);
      const fileB = sanitizeTerminalText(f.files[1]);
      const overlapPct = Math.round(f.couplingRatio * 100);
      const unionCommits = Math.max(1, f.fileACommits + f.fileBCommits - f.cochangeCount);
      const jaccardRatio =
        typeof f.jaccardRatio === 'number' && Number.isFinite(f.jaccardRatio)
          ? f.jaccardRatio
          : Math.min(1, Math.round((f.cochangeCount / unionCommits) * 100) / 100);
      const jaccardPct = Math.round(jaccardRatio * 100);
      const shas = f.evidence.commitShas.map((s) => sanitizeTerminalText(s)).join(', ');
      const reason = sanitizeTerminalText(f.reason);
      const primaryBadge =
        idx === 0
          ? useColor
            ? ' \x1b[1;33m[★ PRIMARY]\x1b[0m'
            : ' [★ PRIMARY]'
          : '';
      lines.push(`  ${id}  ${fileA} <-> ${fileB}${primaryBadge}`);
      lines.push(
        `        Co-changes: ${f.cochangeCount} commits (${overlapPct}% overlap [shared ÷ commits of less-changed file] · ${jaccardPct}% Jaccard [${f.cochangeCount}/${unionCommits} union])`,
      );
      lines.push(
        `        Directional: ${fileA} (${f.cochangeCount}/${f.fileACommits}) · ${fileB} (${f.cochangeCount}/${f.fileBCommits})`,
      );
      lines.push(`        Commits: ${shas}`);
      lines.push(`        Why: ${reason}`);
    }
  }

  if (snapshot.warnings.length > 0) {
    lines.push('');
    lines.push('WARNINGS');
    for (const w of snapshot.warnings) {
      lines.push(`  ! ${sanitizeTerminalText(w)}`);
    }
  }

  lines.push('');
  lines.push('RESULT');
  lines.push(`  Status: ${sanitizeTerminalText(snapshot.status.toUpperCase())}`);
  lines.push(
    `  Evidence: ${snapshot.commitsExamined} commits, ${snapshot.uniqueFilesObserved} files, ${snapshot.totalPairsObserved} pairs`,
  );
  if (snapshot.error) {
    lines.push(`  Error: ${sanitizeTerminalText(snapshot.error)}`);
  }

  return formatBlockToWidth(lines, maxCols);
}

/**
 * Renders the complete plain storyboard narration + summary from an event stream and snapshot.
 */
export function renderPlainStoryboard(
  snapshot: ResultSnapshot,
  events: StoryboardEvent[],
  options: PlainRenderOptions = {},
): string {
  const narratedLines: string[] = [];
  const printer = new PlainStreamPrinter((l) => narratedLines.push(l), options);
  for (const ev of events) {
    printer.onEvent(ev);
  }
  const summary = renderPlainSummary(snapshot, options);
  return [...narratedLines, summary].join('\n');
}

/**
 * Renders the non-storyboard baseline output (--baseline) containing the exact same
 * findings, commit SHAs, and counts, without any C-01 cuts or step narration.
 */
export function renderBaseline(
  snapshot: ResultSnapshot,
  options: PlainRenderOptions = {},
): string {
  const maxCols = resolveColumns(options);
  const lines: string[] = [];
  const repoLabel = sanitizeTerminalText(snapshot.repoLabel);

  lines.push(`CO-CHANGE ANALYSIS BASELINE: ${repoLabel}`);
  if (snapshot.reconstructed) {
    lines.push(`NOTE: ${sanitizeTerminalText(snapshot.reconstructed.note)}`);
  }
  lines.push(
    `Status: ${sanitizeTerminalText(snapshot.status.toUpperCase())} | Commits: ${snapshot.commitsExamined} | Files: ${snapshot.uniqueFilesObserved} | Pairs: ${snapshot.totalPairsObserved}`,
  );
  lines.push('');

  if (snapshot.findings.length === 0) {
    if (snapshot.error) {
      lines.push(`Error: ${sanitizeTerminalText(snapshot.error)}`);
    } else {
      lines.push('No co-changing file pairs found.');
    }
  } else {
    for (const f of snapshot.findings) {
      const id = sanitizeTerminalText(f.id);
      const fileA = sanitizeTerminalText(f.files[0]);
      const fileB = sanitizeTerminalText(f.files[1]);
      const overlapPct = Math.round(f.couplingRatio * 100);
      const unionCommits = Math.max(1, f.fileACommits + f.fileBCommits - f.cochangeCount);
      const jaccardRatio =
        typeof f.jaccardRatio === 'number' && Number.isFinite(f.jaccardRatio)
          ? f.jaccardRatio
          : Math.min(1, Math.round((f.cochangeCount / unionCommits) * 100) / 100);
      const jaccardPct = Math.round(jaccardRatio * 100);
      const shas = f.evidence.commitShas.map((s) => sanitizeTerminalText(s)).join(', ');
      const reason = sanitizeTerminalText(f.reason);
      lines.push(
        `${id}: ${fileA} + ${fileB} (${f.cochangeCount} shared commits, ${overlapPct}% overlap [shared ÷ commits of less-changed file], ${jaccardPct}% Jaccard [${f.cochangeCount}/${unionCommits} union])`,
      );
      lines.push(
        `  Directional: ${fileA} (${f.cochangeCount}/${f.fileACommits}) | ${fileB} (${f.cochangeCount}/${f.fileBCommits})`,
      );
      lines.push(`  Commits: ${shas}`);
      lines.push(`  Reason: ${reason}`);
    }
  }

  if (snapshot.warnings.length > 0) {
    lines.push('');
    for (const w of snapshot.warnings) {
      lines.push(`Warning: ${sanitizeTerminalText(w)}`);
    }
  }

  return formatBlockToWidth(lines, maxCols);
}
