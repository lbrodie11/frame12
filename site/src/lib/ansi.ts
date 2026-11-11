// ANSI → styled text for /terminal's "Watch". Pure and deterministic: the same bytes give the
// same segments on the server and in the browser, and every character stays selectable text.
//
// It reads only SGR (`ESC [ … m`). Everything else that starts with ESC (other CSI, OSC such as
// links or clipboard writes, DCS, two-byte escapes) is removed, never interpreted, so a recording
// cannot reach the page as markup or move anything around. Text becomes React text nodes; no
// HTML string is built.
//
// Supported SGR: 0 reset, 1 bold, 2 dim, 3 italic, 4 underline, 7 inverse, 22/23/24/27 their
// resets, 30–37/90–97 and 40–47/100–107 colors, 39/49 default colors. 256-color and truecolor
// parameters are consumed and reported in `unsupported` (the page's data uses 16 colors).

export interface AnsiStyle {
  bold?: true;
  dim?: true;
  italic?: true;
  underline?: true;
  inverse?: true;
  fg?: number;
  bg?: number;
}

export interface AnsiSegment extends AnsiStyle {
  text: string;
}

export interface AnsiResult {
  /** One array of segments per line (no trailing empty line for a final newline). */
  lines: AnsiSegment[][];
  /** SGR parameters that were consumed but not styled (e.g. `38;5;220`). */
  unsupported: string[];
}

// One escape sequence: CSI (params, intermediates, final), OSC/DCS/APC/PM/SOS up to BEL or ST
// (or the end of the line when unterminated), or a two-byte escape.
// eslint-disable-next-line no-control-regex
const ESCAPE = /\u001b(?:\[([0-?]*)([ -/]*)([@-~])|[\]P^_X][^\u0007\u001b\n]*(?:\u0007|\u001b\\)?|[ -/]*[0-~]?)/g;

function sameStyle(a: AnsiStyle, b: AnsiStyle): boolean {
  return a.bold === b.bold && a.dim === b.dim && a.italic === b.italic && a.underline === b.underline && a.inverse === b.inverse && a.fg === b.fg && a.bg === b.bg;
}

function applySgr(style: AnsiStyle, params: string, unsupported: Set<string>): AnsiStyle {
  const next: AnsiStyle = { ...style };
  const codes = params === '' ? [0] : params.split(';').map((p) => (p === '' ? 0 : Number(p)));
  for (let i = 0; i < codes.length; i++) {
    const c = codes[i]!;
    if (c === 0) for (const k of Object.keys(next) as (keyof AnsiStyle)[]) delete next[k];
    else if (c === 1) next.bold = true;
    else if (c === 2) next.dim = true;
    else if (c === 3) next.italic = true;
    else if (c === 4) next.underline = true;
    else if (c === 7) next.inverse = true;
    else if (c === 22) {
      delete next.bold;
      delete next.dim;
    } else if (c === 23) delete next.italic;
    else if (c === 24) delete next.underline;
    else if (c === 27) delete next.inverse;
    else if ((c >= 30 && c <= 37) || (c >= 90 && c <= 97)) next.fg = c;
    else if (c === 39) delete next.fg;
    else if ((c >= 40 && c <= 47) || (c >= 100 && c <= 107)) next.bg = c;
    else if (c === 49) delete next.bg;
    else if (c === 38 || c === 48) {
      // 38;5;n or 38;2;r;g;b: consume the arguments so they are not read as codes.
      const n = codes[i + 1] === 5 ? 2 : codes[i + 1] === 2 ? 4 : 0;
      unsupported.add(codes.slice(i, i + 1 + n).join(';'));
      i += n;
    } else unsupported.add(String(c));
  }
  return next;
}

export function ansiToLines(input: string): AnsiResult {
  const unsupported = new Set<string>();
  const lines: AnsiSegment[][] = [[]];
  let style: AnsiStyle = {};
  const push = (raw: string) => {
    // Other control characters (C0 except \n and \t, DEL, C1) are dropped too.
    // eslint-disable-next-line no-control-regex
    const parts = raw.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g, '').split('\n');
    parts.forEach((part, i) => {
      if (i > 0) lines.push([]);
      if (part === '') return;
      const line = lines[lines.length - 1]!;
      const last = line[line.length - 1];
      if (last && sameStyle(last, style)) last.text += part;
      else line.push({ ...style, text: part });
    });
  };
  let at = 0;
  for (const m of input.matchAll(ESCAPE)) {
    push(input.slice(at, m.index));
    at = m.index! + m[0].length;
    if (m[3] === 'm' && m[2] === '') style = applySgr(style, m[1]!, unsupported);
  }
  push(input.slice(at));
  if (lines.length > 1 && lines[lines.length - 1]!.length === 0) lines.pop();
  return { lines, unsupported: [...unsupported] };
}

/** Class names for a segment, for the stylesheet in site.css (`.f12-term-*`). */
export function segmentClass(s: AnsiStyle): string | undefined {
  const c: string[] = [];
  if (s.bold) c.push('f12-term-b');
  if (s.dim) c.push('f12-term-d');
  if (s.italic) c.push('f12-term-i');
  if (s.underline) c.push('f12-term-u');
  if (s.inverse) c.push('f12-term-inv');
  if (s.fg !== undefined) c.push(`f12-term-fg${s.fg}`);
  if (s.bg !== undefined) c.push(`f12-term-bg${s.bg}`);
  return c.length ? c.join(' ') : undefined;
}
