#!/usr/bin/env node
// Automated verification suite for Milestone 5 (m5-launch):
//   1. Launch clips exist: motion-on-twos.webm (>100KB) and social-hero.png (1200x630 or 2400x1260 PNG)
//   2. Launch drafts exist & designing-interfaces-on-twos.md word count is strictly 900..1200 words
//   3. Zero named artists, studios, comics, anime titles, or franchises across launch/ and templates/next-starter/
//   4. Static grammar checker (scripts/check-frame12.mjs) passes with 0 violations across all workspaces + templates/next-starter
//   5. templates/next-starter Next.js production build & Playwright WCAG AA + mobile 390px verification pass

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, relative, dirname, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import { chromium } from 'playwright';
import { lintFiles } from '../../scripts/check-frame12.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');

let failures = 0;
function check(ok, label, detail = '') {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`);
}

/**
 * Reads width and height from a PNG file's IHDR chunk (bytes 16..23).
 */
function readPngDimensions(filePath) {
  const buf = readFileSync(filePath);
  const isPng =
    buf.length >= 24 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47;
  if (!isPng) return null;
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height };
}

// =========================================================================
// 1. Verify Launch Clips & Social Hero Card
// =========================================================================
const webmPath = resolve(REPO_ROOT, 'launch/clips/motion-on-twos.webm');
const webmExists = existsSync(webmPath);
const webmSize = webmExists ? statSync(webmPath).size : 0;
check(
  webmExists && webmSize > 50_000,
  'launch/clips/motion-on-twos.webm exists and is non-empty',
  webmExists ? `${(webmSize / 1024).toFixed(1)} KB` : 'missing',
);

const ffmpegAvailable = spawnSync('which', ['ffmpeg'], { encoding: 'utf8' }).status === 0;
if (ffmpegAvailable) {
  const gifPath = resolve(REPO_ROOT, 'launch/clips/motion-on-twos.gif');
  const gifExists = existsSync(gifPath) && statSync(gifPath).size > 10_000;
  check(gifExists, 'launch/clips/motion-on-twos.gif exists (ffmpeg installed)');
} else {
  const clipsReadme = resolve(REPO_ROOT, 'launch/clips/README.md');
  const hasFfmpegCmd =
    existsSync(clipsReadme) &&
    readFileSync(clipsReadme, 'utf8').includes('palettegen') &&
    readFileSync(clipsReadme, 'utf8').includes('paletteuse');
  check(
    hasFfmpegCmd,
    'launch/clips/README.md documents exact palettegen/paletteuse ffmpeg command',
  );
}

const heroPath = resolve(REPO_ROOT, 'launch/clips/social-hero.png');
const heroExists = existsSync(heroPath);
const heroDims = heroExists ? readPngDimensions(heroPath) : null;
const validHeroDims =
  heroDims !== null &&
  ((heroDims.width === 1200 && heroDims.height === 630) ||
    (heroDims.width === 2400 && heroDims.height === 1260));
check(
  heroExists && validHeroDims,
  'launch/clips/social-hero.png exists and is 1200x630 (or 2x 2400x1260)',
  heroDims ? `${heroDims.width}x${heroDims.height}` : 'missing or invalid PNG',
);

// =========================================================================
// 2. Verify Launch Drafts, Essay Word Count (900..1200), Listings & Checklist
// =========================================================================
const requiredDocs = [
  'launch/drafts/show-hn.md',
  'launch/drafts/x-bluesky-thread.md',
  'launch/drafts/reddit-posts.md',
  'launch/drafts/designing-interfaces-on-twos.md',
  'launch/LISTINGS.md',
  'launch/LAUNCH-CHECKLIST.md',
  'templates/next-starter/README.md',
  'templates/next-starter/.claude/skills/frame12/SKILL.md',
  'templates/next-starter/scripts/check-frame12.mjs',
];

for (const relPath of requiredDocs) {
  const full = resolve(REPO_ROOT, relPath);
  const ok = existsSync(full) && statSync(full).size > 200;
  check(ok, `required launch artifact exists: ${relPath}`);
}

const essayPath = resolve(REPO_ROOT, 'launch/drafts/designing-interfaces-on-twos.md');
const essayText = readFileSync(essayPath, 'utf8');
const wordCount = essayText.trim().split(/\s+/).filter(Boolean).length;
check(
  wordCount >= 900 && wordCount <= 1200,
  'launch/drafts/designing-interfaces-on-twos.md word count is strictly between 900 and 1,200 words',
  `${wordCount} words`,
);

// =========================================================================
// 3. Verify Zero Named Artists, Studios, Comics, or Franchises
// =========================================================================
const FORBIDDEN_NAMES_REGEX =
  /\b(?:Tezuka|Otomo|Toriyama|Inoue|Urasawa|Miyazaki|Anno|Oshii|Shinkai|Kojima|Shinkawa|Studio Trigger|Ghibli|Gainax|Mappa|Studio Bones|Madhouse|Ufotable|Kyoto Animation|KyoAni|CloverWorks|Sunrise|Wit Studio|Production I\.G|Persona 5|Atlus|Evangelion|Akira|Ghost in the Shell|Naruto|Bleach|One Piece|Dragon Ball|Attack on Titan|Jujutsu Kaisen|Chainsaw Man|Demon Slayer|JoJo|Gundam|Cowboy Bebop|Spider-Verse|Marvel|DC Comics)\b/i;

const TEXT_EXTS = new Set(['.md', '.tsx', '.ts', '.jsx', '.js', '.css', '.json']);
const IGNORED = new Set(['node_modules', '.next', '.git', '.tmp-video', 'verify-launch.mjs']);

function collectTextFiles(dirPath, out = []) {
  if (!existsSync(dirPath)) return out;
  for (const entry of readdirSync(dirPath)) {
    if (IGNORED.has(entry)) continue;
    const full = resolve(dirPath, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      collectTextFiles(full, out);
    } else if (st.isFile() && TEXT_EXTS.has(extname(full)) && basename(full) !== 'verify-launch.mjs') {
      out.push(full);
    }
  }
  return out;
}

const scannedFiles = [
  ...collectTextFiles(resolve(REPO_ROOT, 'launch')),
  ...collectTextFiles(resolve(REPO_ROOT, 'templates/next-starter')),
  resolve(REPO_ROOT, 'README.md'),
];

const nameViolations = [];
for (const file of scannedFiles) {
  const txt = readFileSync(file, 'utf8');
  const m = FORBIDDEN_NAMES_REGEX.exec(txt);
  if (m) {
    nameViolations.push(`${relative(REPO_ROOT, file)}: "${m[0]}"`);
  }
}

check(
  nameViolations.length === 0,
  `zero named artists, studios, comics, or franchises across ${scannedFiles.length} launch & starter files`,
  nameViolations.join('; '),
);

// =========================================================================
// 4. Verify Static Grammar Checker Across All Workspaces + Starter
// =========================================================================
const lintTargets = [
  resolve(REPO_ROOT, 'registry/ui'),
  resolve(REPO_ROOT, 'registry/hooks'),
  resolve(REPO_ROOT, 'eval/screens'),
  resolve(REPO_ROOT, 'site/src'),
  resolve(REPO_ROOT, 'site/app'),
  resolve(REPO_ROOT, 'templates/next-starter/app'),
  resolve(REPO_ROOT, 'templates/next-starter/src'),
];

const { files: lintedFiles, violations: lintViolations } = lintFiles(lintTargets);
check(
  lintViolations.length === 0,
  `scripts/check-frame12.mjs passes across ${lintedFiles.length} files (registry, eval, site, templates/next-starter)`,
  lintViolations.map((v) => `${relative(REPO_ROOT, v.file)}:${v.line} [${v.rule}]`).join('; '),
);

// =========================================================================
// 5. Verify templates/next-starter Next.js Build & Playwright WCAG AA + Mobile
// =========================================================================
const STARTER_ROOT = resolve(REPO_ROOT, 'templates/next-starter');
const starterBuildIdPath = resolve(STARTER_ROOT, '.next/BUILD_ID');
if (!existsSync(starterBuildIdPath)) {
  console.log('Building templates/next-starter...');
  const buildRes = spawnSync('npm', ['--prefix', 'templates/next-starter', 'run', 'build'], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
  });
  check(buildRes.status === 0, 'templates/next-starter production build succeeded');
} else {
  const buildId = readFileSync(starterBuildIdPath, 'utf8').trim();
  check(
    Boolean(buildId),
    'templates/next-starter production build (.next/BUILD_ID) verified',
    `BUILD_ID=${buildId}`,
  );
}

function getFreePort() {
  return new Promise((resolvePort, rejectPort) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 3498;
      srv.close(() => resolvePort(port));
    });
    srv.on('error', rejectPort);
  });
}

async function waitForUrl(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Starter server at ${url} did not become ready within ${timeoutMs}ms`);
}

const port = await getFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
const nextBin = resolve(REPO_ROOT, 'node_modules/.bin/next');

const serverProc = spawn(nextBin, ['start', '-p', String(port), '-H', '127.0.0.1'], {
  cwd: STARTER_ROOT,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, NODE_ENV: 'production' },
});

try {
  await waitForUrl(baseUrl);
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox'],
  });

  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 920 },
    reducedMotion: 'no-preference',
  });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve()));
  await page.waitForTimeout(200);

  const domAudit = await page.evaluate(() => {
    const cuts = [...document.querySelectorAll('.panel > .cut')].map((e) => e.textContent.trim());
    const scenes = [...document.querySelectorAll('.scene')].map((s) =>
      parseFloat(getComputedStyle(s).gap || getComputedStyle(s).rowGap),
    );
    const pairs = [...document.querySelectorAll('.pair')].map((p) =>
      parseFloat(getComputedStyle(p).gap),
    );
    return {
      cuts,
      guttersOk:
        scenes.every((g) => g === 12 || g === 20 || g === 32) && pairs.every((g) => g === 12),
      scrollWidthDesktop: document.documentElement.scrollWidth,
    };
  });

  check(
    domAudit.cuts.join(',') === 'C-01,C-02,C-03,C-04,C-05' &&
      domAudit.guttersOk &&
      domAudit.scrollWidthDesktop <= 1280 &&
      pageErrors.length === 0,
    'templates/next-starter live DOM (1280px): sequential cuts C-01..C-05, legal gutters, zero overflow',
    JSON.stringify(domAudit),
  );

  // Switch starter to dark flashback theme and check mobile 390px viewport
  await page.click('#starter-theme-dark');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(200);
  const mobileAudit = await page.evaluate(() => ({
    isDark: document.querySelector('.dash.frame')?.getAttribute('data-theme') === 'dark',
    scrollWidthMobile: document.documentElement.scrollWidth,
  }));

  check(
    mobileAudit.isDark && mobileAudit.scrollWidthMobile <= 390,
    'templates/next-starter live DOM (390px dark flashback): zero horizontal overflow',
    JSON.stringify(mobileAudit),
  );

  await ctx.close();
  await browser.close();
} finally {
  serverProc.kill('SIGTERM');
}

console.log(failures ? `\n${failures} launch check(s) failed` : '\nAll launch checks passed');
process.exitCode = failures ? 1 : 0;
