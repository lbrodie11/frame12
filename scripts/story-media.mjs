#!/usr/bin/env node
/**
 * "How a frame gets made" social media, generated from the same server-rendered SVG the home page
 * ships (never hand-drawn, no third-party art):
 *   - docs/images/story.webm and docs/images/story.gif: the four beats drawn on twos (48 poses,
 *     4.0 s) then held finished (3.0 s) = 7.0 s, 12 frames per second, one frame per pose.
 *   - docs/images/story-og.png: 1200×630 Open Graph variant of the finished beat 4 (C-04 · Cut).
 *   - docs/images/story-media.json: sidecar with the SHA-256 of the story's source files.
 *
 * Frames are deterministic: Playwright's fake clock is installed (no timer can advance the page)
 * and every CSS animation is paused and seeked to each pose time before its screenshot.
 *
 *   node scripts/story-media.mjs            # regenerate (needs `npm --workspace=@frame12/site run build` and ffmpeg)
 *   node scripts/story-media.mjs --check    # CI: fail when the media is older than the SVG source
 */
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const IMAGES = join(ROOT, 'docs/images');
const SIDECAR = join(IMAGES, 'story-media.json');
const OUTPUTS = ['story.webm', 'story.gif', 'story-og.png'];
/**
 * Everything that decides what the recorded frames show. Whole files where the file is the
 * story's own; marked regions of shared stylesheets; the token values the geometry reads; and the
 * component count quoted in a caption. Page chrome around the drawing (Panel, Tag and type
 * styles) is deliberately out of scope: it changes with any unrelated CSS edit.
 */
const SOURCES = [
  { file: 'site/src/lib/story-geometry.ts' },
  { file: 'site/src/components/how-a-frame-gets-made.tsx' },
  { file: 'site/src/components/story-shell.tsx' },
  { file: 'registry/ui/ink-pencil.ts' },
  { file: 'registry/ui/ink.tsx' },
  { file: 'registry/ui/ink-sequence.tsx' },
  {
    file: 'registry/styles/frame12.css',
    from: '/* ===================================================================== Ink (line art on twos)',
    to: '/* ===================================================================== Forced Colors (High Contrast) */',
  },
  { file: 'site/app/site.css', from: '/* Home: "How a frame gets made"', to: '/* end: How a frame gets made */' },
];

/** The text of one source, or of its marked region (a missing marker is an error, never a silent pass). */
function sourceText({ file, from, to }) {
  const text = readFileSync(join(ROOT, file), 'utf8');
  if (!from) return text;
  const i = text.indexOf(from);
  const j = text.indexOf(to, i + 1);
  if (i < 0 || j < 0) throw new Error(`story-media: region markers not found in ${file} (${from} … ${to})`);
  return text.slice(i, j);
}

/** Token values the geometry and the stroke widths read. */
function tokenText() {
  const t = JSON.parse(readFileSync(join(ROOT, 'packages/tokens/src/tokens.source.json'), 'utf8'));
  return JSON.stringify({ gutter: t.gutter, stroke: t.stroke, pose: t.motion?.pose });
}

/** COMPONENT_COUNT, quoted in the C-03 caption ("Browse N Components"). */
function componentCount() {
  const require = createRequire(join(ROOT, 'package.json'));
  const ts = require('typescript');
  const src = readFileSync(join(ROOT, 'site/src/lib/catalog.ts'), 'utf8');
  const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const mod = { exports: {} };
  new Function('exports', 'require', 'module', out)(mod.exports, () => ({ REGISTRY_BASE_URL: '' }), mod);
  return String(mod.exports.COMPONENT_COUNT);
}

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
export function sourceHash() {
  const h = createHash('sha256');
  const parts = [
    ...SOURCES.map((src) => [src.from ? `${src.file}#region` : src.file, sourceText(src)]),
    ['packages/tokens/src/tokens.source.json#gutter,stroke,pose', tokenText()],
    ['site/src/lib/catalog.ts#COMPONENT_COUNT', componentCount()],
  ];
  for (const [name, text] of parts) {
    h.update(name);
    h.update('\0');
    h.update(text);
    h.update('\0');
  }
  return h.digest('hex');
}

if (process.argv.includes('--check')) {
  let sidecar;
  try {
    sidecar = JSON.parse(readFileSync(SIDECAR, 'utf8'));
  } catch {
    console.error(`FAIL  story media: ${SIDECAR} is missing. Run node scripts/story-media.mjs.`);
    process.exit(1);
  }
  const problems = [];
  if (sidecar.sourceHash !== sourceHash()) problems.push('the story SVG source changed since the media was generated');
  for (const f of OUTPUTS) {
    try {
      if (sha256(readFileSync(join(IMAGES, f))) !== sidecar.files?.[f]) problems.push(`${f} does not match its recorded hash`);
    } catch {
      problems.push(`${f} is missing`);
    }
  }
  if (problems.length) {
    console.error(`FAIL  story media is stale: ${problems.join('; ')}. Run npm --workspace=@frame12/site run build && node scripts/story-media.mjs.`);
    process.exit(1);
  }
  console.log(`PASS  story media (${OUTPUTS.join(', ')}) matches the story SVG source (${sidecar.sourceHash.slice(0, 12)})`);
  process.exit(0);
}

const { chromium } = await import('playwright');
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
execFileSync(FFMPEG, ['-version'], { stdio: 'ignore' });

const port = await new Promise((ok) => {
  const s = net.createServer().listen(0, '127.0.0.1', () => {
    const p = s.address().port;
    s.close(() => ok(p));
  });
});
const nextBin = createRequire(join(ROOT, 'site/package.json')).resolve('next/dist/bin/next');
const server = spawn(process.execPath, [nextBin, 'start', '-p', String(port), '-H', '127.0.0.1'], {
  cwd: join(ROOT, 'site'),
  stdio: 'ignore',
  env: { ...process.env, NODE_ENV: 'production' },
});
const tmp = mkdtempSync(join(tmpdir(), 'f12-story-'));
const POSE = 1000 / 12;
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/`)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, colorScheme: 'light' });
  const page = await ctx.newPage();
  await page.clock.install({ time: 0 });
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.clock.pauseAt(10_000);
  // Only the strip of four panels, without the page around it.
  await page.addStyleTag({ content: '.home-story-track::after{display:none!important}.home-story-stage{position:static!important}' });
  await page.evaluate(() => document.getElementById('home-story').scrollIntoView({ block: 'start' }));
  await page.click('#home-story-play');
  await page.waitForTimeout(100);
  const strip = page.locator('#home-story .home-story-strip');
  const total = 48 + 36; // 48 drawing poses + 3.0 s held finished, at 12 frames per second
  for (let k = 0; k < total; k++) {
    const t = Math.min(k, 48) * POSE + 1;
    await page.evaluate((t) => {
      for (const a of document.getAnimations()) {
        if (a.timeline !== document.timeline) continue;
        a.pause();
        a.currentTime = t;
      }
    }, t);
    await strip.screenshot({ path: join(tmp, `f${String(k).padStart(3, '0')}.png`) });
  }
  // OG: the finished C-04 drawing on the sheet, 1200×630.
  const svg = await page.evaluate(() => document.querySelector('#home-story svg[data-story-beat="3"]').outerHTML);
  const og = await ctx.newPage();
  await og.setViewportSize({ width: 1200, height: 630 });
  await og.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
  await og.evaluate((svg) => {
    document.body.innerHTML = `<main style="box-sizing:border-box;width:1200px;height:630px;padding:48px 64px;background:var(--f-sheet);display:flex;flex-direction:column;gap:20px"><p style="margin:0;font:500 16px/1 var(--font-f-mono);letter-spacing:.12em;color:var(--f-ink-2)">FRAME/12 · HOW A FRAME GETS MADE · C-04 CUT</p><div style="flex:1;min-height:0;display:flex;align-items:center;justify-content:center;border:var(--f-stroke) solid var(--f-rule);background:var(--f-panel)">${svg.replace('class="home-story-art"', 'class="home-story-art" style="width:auto;height:440px"')}</div></main>`;
  }, svg);
  await og.screenshot({ path: join(IMAGES, 'story-og.png') });
  await browser.close();

  const frames = join(tmp, 'f%03d.png');
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-framerate', '12', '-i', frames, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '36', '-pix_fmt', 'yuv420p', '-an', join(IMAGES, 'story.webm')]);
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-framerate', '12', '-i', frames, '-vf', 'scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=16[p];[b][p]paletteuse=dither=none', '-loop', '0', join(IMAGES, 'story.gif')]);

  const files = Object.fromEntries(OUTPUTS.map((f) => [f, sha256(readFileSync(join(IMAGES, f)))]));
  writeFileSync(SIDECAR, `${JSON.stringify({ sources: [...SOURCES.map((x) => (x.from ? `${x.file} (ink/story region)` : x.file)), 'packages/tokens/src/tokens.source.json (gutter, stroke, pose)', 'site/src/lib/catalog.ts (COMPONENT_COUNT)'], sourceHash: sourceHash(), frames: total, fps: 12, files }, null, 2)}\n`);
  console.log(`Wrote ${OUTPUTS.map((f) => `docs/images/${f}`).join(', ')} (${total} frames at 12 fps = ${(total / 12).toFixed(1)} s) and docs/images/story-media.json`);
} finally {
  server.kill();
  rmSync(tmp, { recursive: true, force: true });
}
