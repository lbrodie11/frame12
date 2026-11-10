#!/usr/bin/env node
/**
 * The F12-13 PR 2 design-review gallery.
 *
 *   npm run gallery                 # write gallery/<fixture>/*.{txt,ansi,json} (committed goldens)
 *   npm run gallery -- --check      # fail if the committed goldens differ (used by the tests)
 *   npm run gallery -- --png        # also render light and dark PNGs and gallery/review/index.html
 *
 * Matrix: 6 fixtures × rich at 40/80/120 columns × mono/16/256/truecolor, plus plain, JSON, and the
 * full terminal view (stderr narration followed by stdout results) at each width in truecolor.
 * PNGs go through @xterm/headless, a real terminal parser, so they show what a terminal draws.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderJson, renderPlain, renderRich, createLinearWriter } from '../dist/render/index.js';
import { fixture } from '../dist/testing/index.js';
import { stripAnsi, xterm256Rgb } from '../dist/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.resolve(__dirname, '..');
const OUT = path.join(PKG, 'gallery');

export const GALLERY_FIXTURES = ['success', 'failed', 'canceled', 'empty', 'one-finding', 'forty-findings'];
export const WIDTHS = [40, 80, 120];
export const LEVELS = ['mono', 'ansi16', 'ansi256', 'truecolor'];
const COLOR_LEVEL = { mono: 0, ansi16: 1, ansi256: 2, truecolor: 3 };

const EXPLAIN = { command: 'repo-archaeology explain src/module-1/runner.ts', description: 'Show the commits behind the top finding.' };
const REPLAY = { command: 'frame12-term render --from run.f12rec --replay', description: 'Replay this run.' };
/** Next steps that make sense for the fixture: no "explain the top finding" when there is none. */
export const nextStepsFor = (name) => (fixture(name).snapshot.findings.length > 0 ? [EXPLAIN, REPLAY] : [REPLAY]);

const renderCaps = (columns, style) => ({ style, unicode: true, ambiguousWide: false, links: false, columns });

/** What a TTY user sees: narration on stderr, then the results on stdout. */
export function terminalView(name, columns) {
  const caps = {
    colorLevel: 3, stderrColorLevel: 3, attributes: true, stderrAttributes: true, unicode: true, ambiguousWide: false,
    links: false, columns, rows: 40, isTTY: true, stderrIsTTY: true, interactive: false, screenReader: false, ci: false,
    ciProvider: undefined, dumb: false, multiplexer: undefined,
  };
  let text = '';
  const sink = { write: (s) => void (text += s) };
  const writer = createLinearWriter({ format: 'rich', caps, stdout: sink, stderr: sink, nextSteps: nextStepsFor(name) });
  for (const ev of fixture(name).events) writer.write(ev);
  writer.end();
  return text;
}

/** Every golden file: relative path → contents. */
export function galleryFiles() {
  const files = new Map();
  for (const name of GALLERY_FIXTURES) {
    const snap = fixture(name).snapshot;
    files.set(`${name}/snapshot.json`, renderJson(snap));
    files.set(`${name}/plain.txt`, renderPlain(snap, { nextSteps: nextStepsFor(name) }));
    for (const width of WIDTHS) {
      for (const level of LEVELS) files.set(`${name}/rich-${width}-${level}.ansi`, renderRich(snap, renderCaps(width, level), { nextSteps: nextStepsFor(name) }));
      files.set(`${name}/rich-${width}.txt`, stripAnsi(files.get(`${name}/rich-${width}-truecolor.ansi`)));
      files.set(`${name}/terminal-${width}.ansi`, terminalView(name, width));
    }
  }
  return files;
}

// ----------------------------------------------------------------------------- ANSI → HTML

const THEMES = {
  light: { fg: '#1d1d1f', bg: '#ffffff', palette: ['#000000', '#c91b00', '#00a600', '#c7c400', '#0225c7', '#ca30c7', '#00c5c7', '#c7c7c7', '#686868', '#ff6e67', '#5ffa68', '#fffc67', '#6871ff', '#ff77ff', '#60fdff', '#ffffff'] },
  dark: { fg: '#e6e6e6', bg: '#16161a', palette: ['#000000', '#ff5555', '#50fa7b', '#f1fa8c', '#6272a4', '#ff79c6', '#8be9fd', '#bbbbbb', '#555555', '#ff6e6e', '#69ff94', '#ffffa5', '#d6acff', '#ff92df', '#a4ffff', '#ffffff'] },
};

const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function color(cell, plane) {
  const isRGB = plane === 'fg' ? cell.isFgRGB() : cell.isBgRGB();
  const isPal = plane === 'fg' ? cell.isFgPalette() : cell.isBgPalette();
  const v = plane === 'fg' ? cell.getFgColor() : cell.getBgColor();
  if (isRGB) return hex(v);
  if (isPal) return v < 16 ? `var(--c${v})` : `rgb(${xterm256Rgb(v).join(',')})`;
  return null;
}

/** Parses ANSI through @xterm/headless and returns theme-independent HTML (CSS variables). */
export async function ansiToHtml(ansi, columns) {
  const { Terminal } = (await import('@xterm/headless')).default;
  const lines = ansi.split('\n');
  const term = new Terminal({ cols: columns, rows: Math.max(2, lines.length + 1), allowProposedApi: true, convertEol: true, scrollback: 0 });
  await new Promise((resolve) => term.write(ansi, resolve));
  const buf = term.buffer.active;
  const rows = [];
  for (let y = 0; y < buf.length; y++) {
    const line = buf.getLine(y);
    if (!line) continue;
    let html = '';
    let run = '';
    let style = '';
    const flush = () => {
      if (run) html += style ? `<span style="${style}">${esc(run)}</span>` : esc(run);
      run = '';
    };
    for (let x = 0; x < columns; x++) {
      const cell = line.getCell(x);
      if (!cell || cell.getWidth() === 0) continue;
      let fg = color(cell, 'fg');
      let bg = color(cell, 'bg');
      if (cell.isInverse()) [fg, bg] = [bg ?? 'var(--bg)', fg ?? 'var(--fg)'];
      const st = [fg ? `color:${fg}` : '', bg ? `background:${bg}` : '', cell.isBold() ? 'font-weight:700' : '', cell.isDim() ? 'opacity:.6' : '', cell.isUnderline() ? 'text-decoration:underline' : '']
        .filter(Boolean)
        .join(';');
      if (st !== style) {
        flush();
        style = st;
      }
      run += cell.getChars() || ' ';
    }
    flush();
    rows.push(html.replace(/\s+$/, ''));
  }
  while (rows.length && rows[rows.length - 1] === '') rows.pop();
  term.dispose();
  return rows.join('\n');
}

export function themeCss() {
  const vars = (t) => [`--fg:${t.fg}`, `--bg:${t.bg}`, ...t.palette.map((c, i) => `--c${i}:${c}`)].join(';');
  return `.t-light{${vars(THEMES.light)}}.t-dark{${vars(THEMES.dark)}}
.term{background:var(--bg);color:var(--fg);font:13px/1.35 ui-monospace,"JetBrains Mono","DejaVu Sans Mono",Menlo,monospace;padding:14px 16px;margin:0;white-space:pre;display:inline-block;border-radius:6px}`;
}

async function renderPngs(files) {
  const { chromium } = await import('playwright');
  const reviewDir = path.join(OUT, 'review');
  fs.rmSync(reviewDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(reviewDir, 'png'), { recursive: true });
  // CHROMIUM_PATH lets a machine whose preinstalled browser differs from the locked Playwright build run it.
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 1400, height: 900 } });
  const sections = [];
  for (const name of GALLERY_FIXTURES) {
    const variants = [];
    for (const width of WIDTHS) {
      variants.push({ key: `terminal-${width}`, title: `Terminal view, ${width} columns (truecolor)`, width, ansi: files.get(`${name}/terminal-${width}.ansi`) });
      for (const level of LEVELS) variants.push({ key: `rich-${width}-${level}`, title: `Rich, ${width} columns, ${level}`, width, ansi: files.get(`${name}/rich-${width}-${level}.ansi`) });
    }
    variants.push({ key: 'plain', title: 'Plain (width-independent)', width: 120, ansi: files.get(`${name}/plain.txt`) });
    const items = [];
    for (const v of variants) {
      const html = await ansiToHtml(v.ansi, v.width);
      items.push({ ...v, html });
      for (const theme of ['light', 'dark']) {
        await page.setContent(`<!doctype html><meta charset="utf-8"><style>${themeCss()} body{margin:0;background:#888}</style><pre class="term t-${theme}">${html}</pre>`);
        await page.locator('pre').screenshot({ path: path.join(reviewDir, 'png', `${name}--${v.key}--${theme}.png`) });
      }
    }
    sections.push({ name, description: fixture(name).description, items });
  }
  await browser.close();
  fs.writeFileSync(path.join(reviewDir, 'gallery.json'), JSON.stringify(sections));
  return sections.length;
}

async function main() {
  const check = process.argv.includes('--check');
  const files = galleryFiles();
  if (check) {
    const drift = [];
    for (const [rel, body] of files) {
      const p = path.join(OUT, rel);
      if (!fs.existsSync(p) || fs.readFileSync(p, 'utf8') !== body) drift.push(rel);
    }
    // Goldens left behind by a removed fixture, width or level are drift too.
    for (const dir of fs.readdirSync(OUT, { withFileTypes: true })) {
      if (!dir.isDirectory() || dir.name === 'review') continue;
      for (const f of fs.readdirSync(path.join(OUT, dir.name))) {
        const rel = `${dir.name}/${f}`;
        if (!files.has(rel)) drift.push(`${rel} (stale)`);
      }
    }
    if (drift.length) {
      console.error(`Gallery goldens differ (${drift.length}): ${drift.slice(0, 8).join(', ')}${drift.length > 8 ? ', …' : ''}\nReview the change, then run: npm run gallery --workspace=@frame12/terminal`);
      process.exit(1);
    }
    console.log(`Gallery goldens match (${files.size} files).`);
    return;
  }
  for (const dir of fs.existsSync(OUT) ? fs.readdirSync(OUT) : []) if (dir !== 'review') fs.rmSync(path.join(OUT, dir), { recursive: true, force: true });
  for (const [rel, body] of files) {
    fs.mkdirSync(path.dirname(path.join(OUT, rel)), { recursive: true });
    fs.writeFileSync(path.join(OUT, rel), body);
  }
  console.log(`Wrote ${files.size} gallery files to gallery/.`);
  if (process.argv.includes('--png')) {
    const n = await renderPngs(files);
    console.log(`Rendered light and dark PNGs for ${n} fixtures to gallery/review/png/.`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) await main();
