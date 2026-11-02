#!/usr/bin/env node
// Playwright recording script for Milestone 5 (m5-launch).
// Produces:
//   1. launch/clips/motion-on-twos.webm — 15–25s 1280x720 comparison video (Phase A Smooth 60fps, Phase B Stepped 12fps, Phase C Side-by-Side Light & Dark)
//   2. launch/clips/motion-on-twos.gif  — Palette-optimized GIF (if ffmpeg is installed)
//   3. launch/clips/social-hero.png     — 1200x630 (2400x1260 @ 2x DPI) static social hero card

import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, copyFileSync, rmSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');
const SITE_ROOT = resolve(REPO_ROOT, 'site');
const CLIPS_DIR = resolve(REPO_ROOT, 'launch/clips');
const TMP_VIDEO_DIR = resolve(REPO_ROOT, 'launch/clips/.tmp-video');

mkdirSync(CLIPS_DIR, { recursive: true });
mkdirSync(TMP_VIDEO_DIR, { recursive: true });

function getFreePort() {
  return new Promise((resolvePort, rejectPort) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 3499;
      srv.close(() => resolvePort(port));
    });
    srv.on('error', rejectPort);
  });
}

async function waitForServer(baseUrl, timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${baseUrl}/r/registry.json`);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Next.js server at ${baseUrl} did not become ready within ${timeoutMs}ms`);
}

const port = await getFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
const nextBin = resolve(REPO_ROOT, 'node_modules/.bin/next');

const serverProc = spawn(nextBin, ['start', '-p', String(port), '-H', '127.0.0.1'], {
  cwd: SITE_ROOT,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, NODE_ENV: 'production' },
});

try {
  await waitForServer(baseUrl);

  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox'],
  });

  const heroOnly = process.argv.includes('--hero-only');

  // =========================================================================
  // 1. Record 15–25s Motion Comparison Video (launch/clips/motion-on-twos.webm)
  // =========================================================================
  if (!heroOnly) {
    console.log('Recording launch/clips/motion-on-twos.webm (1280x720)...');
    const videoCtx = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 1,
      colorScheme: 'light',
      reducedMotion: 'no-preference',
      recordVideo: {
        dir: TMP_VIDEO_DIR,
        size: { width: 1280, height: 720 },
      },
    });

    const videoPage = await videoCtx.newPage();
    await videoPage.goto(`${baseUrl}/motion`, { waitUntil: 'networkidle' });
    await videoPage.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve()));

    // Inject director's HUD banner and stage focus helpers so each phase reads cleanly on video
    await videoPage.evaluate(() => {
      const style = document.createElement('style');
      style.id = 'f12-clip-hud-style';
      style.textContent = `
        .f12-clip-banner {
          position: fixed;
          bottom: 16px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 9999;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 18px;
          background: var(--f-marker);
          color: var(--f-marker-ink);
          border: 2.5px solid var(--f-rule);
          box-shadow: 4px 4px 0 var(--f-rule);
          font-family: var(--font-f-mono), monospace;
          white-space: nowrap;
        }
        .f12-clip-phase {
          padding: 2px 8px;
          background: var(--f-marker-ink);
          color: var(--f-marker);
          font-weight: 700;
          font-size: 12px;
          letter-spacing: 0.08em;
        }
        .f12-clip-title {
          font-family: var(--font-f-display), sans-serif;
          font-size: 15px;
          letter-spacing: 0.03em;
        }
        .f12-clip-sub {
          font-size: 12px;
          font-weight: 700;
        }
        .f12-panel-dim {
          opacity: 0.28 !important;
          filter: grayscale(1);
        }
        .f12-panel-spotlight {
          outline: 3px solid var(--f-rule);
          outline-offset: 3px;
        }
      `;
      document.head.appendChild(style);

      const banner = document.createElement('div');
      banner.id = 'f12-clip-banner';
      banner.className = 'f12-clip-banner';
      banner.setAttribute('aria-hidden', 'true');
      banner.innerHTML = `
        <span class="f12-clip-phase" id="f12-clip-phase">PHASE A</span>
        <span class="f12-clip-title" id="f12-clip-title">SMOOTH (60 FPS CONTINUOUS EASING)</span>
        <span class="f12-clip-sub" id="f12-clip-sub">7 → 90 → 30 DAYS · CONTINUOUS GLIDE & WIPE</span>
      `;
      document.body.appendChild(banner);

      // Scroll straight to the two comparison panels (C-01 and C-02)
      const firstScene = document.querySelector('.f12-scene');
      if (firstScene) {
        const rect = firstScene.getBoundingClientRect();
        window.scrollTo({ top: Math.max(0, window.scrollY + rect.top - 72), behavior: 'instant' });
      }
    });

    // Helper to update banner text & panel spotlight
    const setClipPhase = async (phase, title, sub, spotlightCut) => {
      await videoPage.evaluate(
        ({ p, t, s, cut }) => {
          const pEl = document.getElementById('f12-clip-phase');
          const tEl = document.getElementById('f12-clip-title');
          const sEl = document.getElementById('f12-clip-sub');
          if (pEl) pEl.textContent = p;
          if (tEl) tEl.textContent = t;
          if (sEl) sEl.textContent = s;

          const panels = document.querySelectorAll('.f12-scene:first-of-type > .f12-panel');
          panels.forEach((panel) => {
            const cutText = panel.querySelector('.f12-cut')?.textContent?.trim();
            panel.classList.remove('f12-panel-dim', 'f12-panel-spotlight');
            if (cut === 'BOTH') return;
            if (cutText === cut) {
              panel.classList.add('f12-panel-spotlight');
            } else {
              panel.classList.add('f12-panel-dim');
            }
          });
        },
        { p: phase, t: title, s: sub, cut: spotlightCut },
      );
    };

    // Phase A (0.0s – 5.8s): SMOOTH (60 FPS CONTINUOUS EASING) — C-02 spotlight
    await setClipPhase(
      'PHASE A · C-02',
      'SMOOTH (60 FPS CONTINUOUS EASING)',
      '7 → 90 → 30 DAYS · CUBIC-BEZIER GLIDE · 45-FRAME WIPE',
      'C-02',
    );
    await videoPage.waitForTimeout(900);
    await videoPage.click('#stage-compare-rng-7');
    await videoPage.waitForTimeout(1550);
    await videoPage.click('#stage-compare-rng-90');
    await videoPage.waitForTimeout(1550);
    await videoPage.click('#stage-compare-rng-30');
    await videoPage.waitForTimeout(1600);

    // Phase B (5.8s – 11.8s): STEPPED — ON TWOS (12 FPS · 83 MS HELD POSES) — C-01 spotlight
    await setClipPhase(
      'PHASE B · C-01',
      'STEPPED — ON TWOS (12 FPS · 83 MS HELD POSES)',
      '7 → 90 → 30 DAYS · 3-POSE JUMP · DIFFERENCE INVERSION · 2-FRAME BURST',
      'C-01',
    );
    await videoPage.waitForTimeout(900);
    await videoPage.click('#stage-stepped-rng-7');
    await videoPage.waitForTimeout(1600);
    await videoPage.click('#stage-stepped-rng-90');
    await videoPage.waitForTimeout(1600);
    await videoPage.click('#stage-stepped-rng-30');
    await videoPage.waitForTimeout(1650);

    // Phase C1 (11.8s – 15.4s): SIDE-BY-SIDE SYNCHRONIZED REPLAY (LIGHT SHEET)
    await setClipPhase(
      'PHASE C · LIGHT',
      'SIDE-BY-SIDE SYNCHRONIZED REPLAY (12 FPS VS 60 FPS)',
      'PLAY COMPARISON (7 → 90 → 30 DAYS) · WARM PAPER SHEET',
      'BOTH',
    );
    await videoPage.waitForTimeout(450);
    await videoPage.click('#motion-play-btn');
    await videoPage.waitForTimeout(3150);

    // Phase C2 (15.4s – 19.2s): SIDE-BY-SIDE SYNCHRONIZED REPLAY (DARK FLASHBACK GUTTERS)
    await videoPage.click('#site-theme-dark');
    await setClipPhase(
      'PHASE C · DARK',
      'FLASHBACK DARK THEME · BLACK GUTTERS (#070708)',
      'PLAY COMPARISON (7 → 90 → 30 DAYS) · 12 FPS ON TWOS VS 60 FPS SMOOTH',
      'BOTH',
    );
    await videoPage.waitForTimeout(550);
    await videoPage.click('#motion-play-btn');
    await videoPage.waitForTimeout(3300);

    const recordedVideo = videoPage.video();
    await videoPage.close();
    await videoCtx.close();

    const rawVideoPath = await recordedVideo.path();
    const targetWebmPath = resolve(CLIPS_DIR, 'motion-on-twos.webm');
    copyFileSync(rawVideoPath, targetWebmPath);
    rmSync(TMP_VIDEO_DIR, { recursive: true, force: true });

    const webmBytes = statSync(targetWebmPath).size;
    console.log(`Saved ${targetWebmPath} (${(webmBytes / 1024).toFixed(1)} KB)`);

    // Convert to GIF if ffmpeg is installed
    const ffmpegCheck = spawnSync('which', ['ffmpeg'], { encoding: 'utf8' });
    if (ffmpegCheck.status === 0) {
      const targetGifPath = resolve(CLIPS_DIR, 'motion-on-twos.gif');
      console.log('ffmpeg detected — converting motion-on-twos.webm to palette-optimized GIF...');
      const ffRes = spawnSync(
        'ffmpeg',
        [
          '-y',
          '-i',
          targetWebmPath,
          '-vf',
          'fps=24,scale=960:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle',
          '-loop',
          '0',
          targetGifPath,
        ],
        { stdio: 'inherit' },
      );
      if (ffRes.status === 0 && existsSync(targetGifPath)) {
        console.log(`Saved ${targetGifPath}`);
      }
    } else {
      console.log(
        'Note: ffmpeg is not installed on this machine; skipping .gif conversion (documented in launch/clips/README.md).',
      );
    }
  }

  // =========================================================================
  // 2. Render Static Social Hero Card (launch/clips/social-hero.png, 1200x630 @ 2x)
  // =========================================================================
  console.log('Rendering launch/clips/social-hero.png (1200x630 @ 2x DPI)...');
  const heroCtx = await browser.newContext({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 2,
    colorScheme: 'light',
    reducedMotion: 'reduce',
  });

  const heroPage = await heroCtx.newPage();
  await heroPage.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
  await heroPage.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve()));

  // Replace body with a dedicated 1200x630 showcase composition using the live FRAME/12 styles and fonts
  await heroPage.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'light');
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.overflow = 'hidden';
    document.body.style.background = 'var(--f-desk)';

    document.body.innerHTML = `
      <div class="f12-dash f12-frame f12-theme-light f12-m-stepped" style="width: 1200px; height: 630px; padding: 14px; overflow: hidden;">
        <div class="f12-sheet" style="height: 100%; padding: 30px 24px 18px; gap: 16px; justify-content: space-between;">
          <div class="f12-pegs" aria-hidden="true" style="top: 10px;">
            <span class="f12-peg round"></span>
            <span class="f12-peg slot"></span>
            <span class="f12-peg round"></span>
          </div>

          <header class="f12-hd" style="gap: 12px; align-items: center;">
            <div>
              <p class="f12-eyebrow">
                INTERFACE DESIGN LANGUAGE · SHADCN REGISTRY · AGENT SKILL
                <span class="f12-tag">MIT OPEN SOURCE</span>
              </p>
              <h1 class="f12-title" style="font-size: 30px; margin-top: 4px;">FRAME/12 — DESIGNING INTERFACES ON TWOS</h1>
            </div>
            <span class="f12-badge" style="font-size: 11px; padding: 5px 10px;">
              <span class="f12-badge-t">npx shadcn@latest add https://frame12.dev/r/frame12.json</span>
            </span>
          </header>

          <div class="f12-scene f12-scene-split f12-scene-scene" style="grid-template-columns: 1.38fr 1fr; gap: 20px; flex: 1; min-height: 0;">
            <!-- C-01: Screentone Area Chart + Speech Balloon -->
            <section class="f12-panel f12-rect">
              <svg class="f12-panel-frame" viewBox="0 0 640 310" preserveAspectRatio="none" aria-hidden="true">
                <polygon points="1.25,1.25 638.75,1.25 638.75,308.75 1.25,308.75" />
              </svg>
              <span class="f12-cut">C-01</span>
              <div class="f12-panel-body" style="padding: 16px 18px 14px; justify-content: space-between;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                  <div>
                    <p class="f12-m-label">RECOVERED REVENUE · 45° HALFTONE SCREENTONE</p>
                    <div style="display: flex; align-items: baseline; gap: 12px; margin-top: 4px;">
                      <span class="f12-m-value" style="font-size: 32px; margin: 0;">$142,840</span>
                      <span class="f12-delta up" style="margin: 0;">
                        <span class="f12-delta-sym">▲</span>
                        <span>+18.4%</span>
                        <span class="f12-delta-ref">vs prior 30d</span>
                      </span>
                    </div>
                  </div>
                  <span class="f12-tag">NO GRADIENTS · NO BLUR</span>
                </div>

                <div class="f12-chart" style="margin-top: 6px;">
                  <svg class="f12-chart-svg" viewBox="0 0 580 175" width="100%" height="175" aria-hidden="true">
                    <defs>
                      <pattern id="hero-tone" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                        <circle cx="3" cy="3" r="1.45" class="f12-tone-dot" />
                      </pattern>
                    </defs>
                    <line x1="0" y1="36" x2="580" y2="36" class="f12-grid" stroke-dasharray="3 3" />
                    <line x1="0" y1="86" x2="580" y2="86" class="f12-grid" stroke-dasharray="3 3" />
                    <line x1="0" y1="136" x2="580" y2="136" class="f12-grid" stroke-dasharray="3 3" />
                    <path d="M 0 138 L 64 120 L 128 126 L 192 94 L 256 102 L 320 68 L 384 76 L 448 30 L 512 52 L 580 38 L 580 156 L 0 156 Z" fill="url(#hero-tone)" />
                    <path d="M 0 138 L 64 120 L 128 126 L 192 94 L 256 102 L 320 68 L 384 76 L 448 30 L 512 52 L 580 38" fill="none" class="f12-l-total" />
                    <line x1="0" y1="156" x2="580" y2="156" class="f12-baseline" />
                    <circle cx="448" cy="30" r="6" class="f12-peak-dot" />
                    <!-- Speech balloon annotation pointing to peak -->
                    <g transform="translate(256, 8)">
                      <rect x="0" y="0" width="172" height="30" fill="var(--f-marker)" stroke="var(--f-rule)" stroke-width="2.2" />
                      <polygon points="172,11 185,20 172,22" fill="var(--f-marker)" stroke="var(--f-rule)" stroke-width="2.2" />
                      <text x="10" y="19" style="font-family: var(--font-f-mono); font-size: 11px; font-weight: 700; fill: var(--f-marker-ink);">PEAK · OCT 19 · $7,420</text>
                    </g>
                    <text x="4" y="171">OCT 02</text>
                    <text x="270" y="171">OCT 16</text>
                    <text x="530" y="171">OCT 31</text>
                  </svg>
                </div>
              </div>
            </section>

            <!-- C-02 & C-03: Diagonal PanelPair across 12px pair gutter -->
            <div class="f12-pair" style="gap: 12px;">
              <section class="f12-panel f12-slant-bottom">
                <svg class="f12-panel-frame" viewBox="0 0 460 150" preserveAspectRatio="none" aria-hidden="true">
                  <polygon points="1.25,1.25 458.75,1.25 458.75,133 1.25,148.75" />
                </svg>
                <span class="f12-cut">C-02</span>
                <div class="f12-panel-body" style="padding: 14px 16px 26px;">
                  <p class="f12-m-label">DIAGONAL PANEL PAIR · GUTTER GRAMMAR</p>
                  <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 10px;">
                    <div style="border: 2px solid var(--f-rule); padding: 7px 9px; background: var(--f-panel);">
                      <div style="font-family: var(--font-f-display); font-size: 15px;">12px PAIR</div>
                      <div style="font-family: var(--font-f-mono); font-size: 10px; color: var(--f-ink-2); margin-top: 2px;">16px slant cut</div>
                    </div>
                    <div style="border: 2px solid var(--f-rule); padding: 7px 9px; background: var(--f-panel);">
                      <div style="font-family: var(--font-f-display); font-size: 15px;">20px SCENE</div>
                      <div style="font-family: var(--font-f-mono); font-size: 10px; color: var(--f-ink-2); margin-top: 2px;">Same beat</div>
                    </div>
                    <div style="border: 2px solid var(--f-rule); padding: 7px 9px; background: var(--f-ink); color: var(--f-panel);">
                      <div style="font-family: var(--font-f-display); font-size: 15px;">32px CUT</div>
                      <div style="font-family: var(--font-f-mono); font-size: 10px; margin-top: 2px;">Flashback dark</div>
                    </div>
                  </div>
                </div>
              </section>

              <section class="f12-panel f12-slant-top">
                <svg class="f12-panel-frame" viewBox="0 0 460 150" preserveAspectRatio="none" aria-hidden="true">
                  <polygon points="1.25,17 458.75,1.25 458.75,148.75 1.25,148.75" />
                </svg>
                <span class="f12-cut">C-03</span>
                <div class="f12-panel-body" style="padding: 24px 16px 14px; justify-content: center;">
                  <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px;">
                    <div>
                      <p class="f12-m-label">AI AGENT SKILL + STATIC GRAMMAR LINTER</p>
                      <div style="font-family: var(--font-f-display); font-size: 18px; margin-top: 4px;">22 REGISTRY ITEMS · GRAMMAR LINTER</div>
                      <p style="font-family: var(--font-f-mono); font-size: 11px; color: var(--f-ink-2); margin-top: 3px;">Tokens · Gutters · Cut order · Marker contrast</p>
                    </div>
                    <span class="f12-badge"><span class="f12-badge-t">WCAG AA</span></span>
                  </div>
                </div>
              </section>
            </div>
          </div>

          <!-- C-04: Exposure Sheet Film Strip (On Twos · 12fps · 83.33ms per held pose) -->
          <section class="f12-panel f12-rect">
            <svg class="f12-panel-frame" viewBox="0 0 1120 96" preserveAspectRatio="none" aria-hidden="true">
              <polygon points="1.25,1.25 1118.75,1.25 1118.75,94.75 1.25,94.75" />
            </svg>
            <span class="f12-cut">C-04</span>
            <div class="f12-panel-body" style="padding: 12px 18px; flex-direction: row; align-items: center; justify-content: space-between; gap: 20px;">
              <div style="min-width: 245px;">
                <p class="f12-m-label">EXPOSURE SHEET · MOTION ON TWOS</p>
                <div style="font-family: var(--font-f-display); font-size: 17px; margin-top: 3px;">12 FPS · 83.33 MS HELD POSES</div>
                <div style="font-family: var(--font-f-mono); font-size: 11px; color: var(--f-ink-2); margin-top: 2px;">mix-blend-mode: difference</div>
              </div>

              <div class="pose-strip" style="flex: 1; margin: 0;">
                <div class="pose-cell">
                  <span class="pose-cell-frame">F1–2 · 0 MS</span>
                  <span class="pose-cell-val">POSE 1 / 4</span>
                  <span class="pose-cell-ms">[■ 7D]  30D   90D</span>
                </div>
                <div class="pose-cell">
                  <span class="pose-cell-frame">F3–4 · 83 MS</span>
                  <span class="pose-cell-val">POSE 2 / 4</span>
                  <span class="pose-cell-ms"> 7D [■ 30D]  90D</span>
                </div>
                <div class="pose-cell">
                  <span class="pose-cell-frame">F5–6 · 167 MS</span>
                  <span class="pose-cell-val">POSE 3 / 4</span>
                  <span class="pose-cell-ms"> 7D   30D [■ 90D]</span>
                </div>
                <div class="pose-cell active">
                  <span class="pose-cell-frame">F7–8 · 250 MS</span>
                  <span class="pose-cell-val">SETTLED</span>
                  <span class="pose-cell-ms">LOCKED ON 90 DAYS</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    `;
  });

  await heroPage.waitForTimeout(200);
  const socialHeroPath = resolve(CLIPS_DIR, 'social-hero.png');
  await heroPage.screenshot({ path: socialHeroPath, fullPage: false });
  await heroCtx.close();

  const heroBytes = statSync(socialHeroPath).size;
  console.log(`Saved ${socialHeroPath} (${(heroBytes / 1024).toFixed(1)} KB)`);

  await browser.close();
} finally {
  serverProc.kill('SIGTERM');
}
