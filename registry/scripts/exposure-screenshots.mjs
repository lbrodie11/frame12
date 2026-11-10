#!/usr/bin/env node
// Screenshots and the flipbook recording for ExposureScrubber reviews (F12-09). Writes PNGs and a
// WebM to docs/images/exposure/ (or --out=<dir>). Chromium, fonts inlined by the harness.
//   node registry/scripts/exposure-screenshots.mjs [--out=<dir>]
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { launch } from '../tests/lib.mjs';
import { bundlePage, REGISTRY_ROOT, REPO_ROOT } from '../tests/harness.mjs';

const OUT = resolve(process.argv.find((a) => a.startsWith('--out='))?.split('=')[1] ?? resolve(REPO_ROOT, 'docs/images/exposure'));
mkdirSync(OUT, { recursive: true });
const html = await bundlePage(resolve(REGISTRY_ROOT, 'tests/fixtures/exposure-demo-entry.tsx'));
const browser = await launch('chromium');

async function shot(name, { vw = 1440, vh = 900, scale = 2, ...opts }, act) {
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: scale, colorScheme: opts.theme ?? 'light' });
  const page = await ctx.newPage();
  await page.route('http://f12.test/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: html }));
  await page.goto('http://f12.test/index.html');
  await page.evaluate((o) => window.__demo(o), opts);
  // Hydrated: the "Replay needs JavaScript" note is gone (empty and one-frame states keep the
  // transport disabled on purpose).
  await page.waitForFunction(() => document.querySelector('#demo .f12-xs-note')?.textContent !== 'Replay needs JavaScript' && document.getElementById('demo'));
  await page.waitForTimeout(250);
  if (act) await act(page);
  await page.waitForTimeout(350);
  await page.locator('#demo-box').screenshot({ path: resolve(OUT, `${name}.png`) });
  await ctx.close();
}

for (const theme of ['light', 'dark']) {
  await shot(`agent-1440-${theme}`, { theme });
  await shot(`agent-420-container-${theme}`, { theme, width: 420 });
  await shot(`agent-390-mobile-${theme}`, { theme, vw: 390, vh: 844, scale: 3 });
}
await shot('ci-1440-quiet-light', { demo: 'ci', variant: 'quiet' });
await shot('agent-1440-focus-row-light', {}, async (p) => {
  await p.focus('#demo tbody .f12-xs-btn[tabindex="0"]');
  await p.keyboard.press('ArrowUp');
});
await shot('flipbook-slate-light', { frames: 200, timing: 'flipbook' }, async (p) => {
  await p.click('#demo-play');
  await p.waitForTimeout(900);
});
await shot('empty-light', { demo: 'empty', width: 640 });
await shot('one-frame-light', { demo: 'one', width: 640 });
await shot('agent-320-light', { vw: 320, vh: 800 });

// 6-second flipbook recording (1×, 200 frames): deterministic. The fake clock advances 1/30 s
// per captured frame; frames are encoded at 30 fps with the system ffmpeg (VP8 WebM).
{
  const frameDir = mkdtempSync(join(tmpdir(), 'f12-flip-'));
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.clock.install({ time: 0 });
  await page.route('http://f12.test/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: html }));
  await page.goto('http://f12.test/index.html');
  await page.evaluate(() => window.__demo({ frames: 200, timing: 'flipbook' }));
  await page.clock.runFor(500);
  await page.waitForTimeout(300);
  await page.clock.pauseAt(10000);
  await page.click('#demo-play');
  const flush = () => page.evaluate(() => new Promise((r) => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); }));
  for (let i = 0; i < 180; i++) {
    await page.clock.runFor(1000 / 30);
    for (let k = 0; k < 4; k++) await flush();
    await page.screenshot({ path: join(frameDir, `f${String(i).padStart(4, '0')}.png`) });
  }
  await ctx.close();
  const ff = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', join(frameDir, 'f%04d.png'), '-c:v', 'libvpx', '-b:v', '1M', '-pix_fmt', 'yuv420p', resolve(OUT, 'flipbook-6s.webm')]);
  if (ff.status !== 0) console.error(`ffmpeg failed: ${ff.stderr}`);
  rmSync(frameDir, { recursive: true, force: true });
}
await browser.close();
console.log(`Wrote screenshots and flipbook-6s.webm to ${OUT}`);
