/**
 * Resize without leftovers.
 *
 * When a terminal gets narrower, most terminals (iTerm2, kitty, WezTerm, GNOME Terminal, Windows
 * Terminal) re-wrap what is on screen, so the live frame Ink drew now covers more rows than the
 * line count Ink erases on its next render. The top rows of the old frame are left behind as a
 * stale copy. This module records the last frame Ink wrote and, when the width shrinks, erases the
 * rows the re-wrapped frame really occupies before Ink's own clear runs.
 */
import { stringWidth, stripAnsi } from '../core/width.js';

const ERASE_LINE = '\u001b[2K';
const CURSOR_UP = '\u001b[1A';
const CURSOR_LEFT = '\u001b[G';

/** Erases `count` rows upward from the cursor, ending at the top one (like ansi-escapes eraseLines). */
export function eraseLines(count: number): string {
  let out = '';
  for (let i = 0; i < count; i++) out += ERASE_LINE + (i < count - 1 ? CURSOR_UP : '');
  return count > 0 ? out + CURSOR_LEFT : '';
}

/** Rows a line of text occupies at `columns` once the terminal wraps it (at least 1). */
export function wrappedRows(line: string, columns: number): number {
  const w = stringWidth(stripAnsi(line));
  return Math.max(1, Math.ceil(w / Math.max(1, columns)));
}

/**
 * The cleanup to write before Ink clears its frame after the width shrank: erase every row the
 * re-wrapped frame covers, then move the cursor down so Ink's erase of its `lines.length` rows ends
 * exactly at the top of the old frame. Empty when nothing re-wrapped.
 */
export function reflowCleanup(frameLines: readonly string[], columns: number): string {
  const n = frameLines.length;
  const rows = frameLines.reduce((sum, line) => sum + wrappedRows(line, columns), 0);
  if (rows <= n) return '';
  return eraseLines(rows) + (n > 1 ? `\u001b[${n - 1}B` : '');
}

/** The frame text in one of Ink's writes: what follows its erase sequence, without cursor controls. */
export function frameFromWrite(chunk: string): string | undefined {
  // Ignore writes that are only control sequences (cursor show/hide, cursor-only moves).
  if (stripAnsi(chunk).replace(/\u001b\[[0-9;?]*[A-Za-z]/g, '').length === 0 && !chunk.includes(CURSOR_LEFT)) return undefined;
  const at = chunk.lastIndexOf(CURSOR_LEFT);
  const body = at === -1 ? chunk : chunk.slice(at + CURSOR_LEFT.length);
  // Drop trailing cursor-only sequences (Ink may hide the cursor or move it after the frame).
  return body.replace(/(?:\u001b\[[0-9;?]*[ABCDGHJKlh])+$/, '');
}

type Out = NodeJS.WriteStream;

/**
 * A stdout for Ink that remembers the last frame it wrote. It inherits everything else (columns,
 * rows, isTTY, events) from the real stream.
 */
export function createFrameTracker(stdout: Out): { stream: Out; lastFrameLines(): string[] } {
  let last = '';
  const stream = Object.create(stdout) as Out;
  stream.write = function write(this: Out, chunk: unknown, ...rest: unknown[]) {
    const text = typeof chunk === 'string' ? chunk : Buffer.isBuffer(chunk) ? chunk.toString('utf8') : '';
    const frame = frameFromWrite(text);
    if (frame !== undefined) last = frame;
    return (stdout.write as (...a: unknown[]) => boolean).call(stdout, chunk, ...rest);
  } as Out['write'];
  return { stream, lastFrameLines: () => last.split('\n') };
}
