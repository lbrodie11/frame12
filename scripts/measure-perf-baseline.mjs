#!/usr/bin/env node
/**
 * Reproducible laboratory performance baseline runner for @frame12/site.
 *
 * Runs 5 independent fresh browser-context loads per route against `next start`
 * under both unthrottled localhost and 4x CPU throttled conditions, plus an
 * optional `--font-delay-ms=<ms>` mode to simulate cold-network .woff2 font swaps.
 */
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE_DIR = resolve(ROOT, 'site');
const PORT = Number(process.env.F12_PERF_PORT || 4319);
const RUNS = Number(process.env.F12_PERF_RUNS || 5);
const fontDelayArg = process.argv.find((a) => a.startsWith('--font-delay-ms='));
const FONT_DELAY_MS = fontDelayArg ? Number(fontDelayArg.split('=')[1]) : 0;

const ROUTES = [
  { path: '/', actionSelector: '#home-rng-7' },
  { path: '/motion', actionSelector: '#stage-compare-mode-cut' },
  { path: '/components', actionSelector: '#site-theme-light' },
  { path: '/style-sheet', actionSelector: '#site-theme-light' },
  { path: '/agents', actionSelector: '#site-theme-light' },
  { path: '/get-started', actionSelector: '#site-theme-light' },
  { path: '/components/panel', actionSelector: '#site-theme-light' },
];

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

async function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function measureMode(browser, { cpuThrottleRate = 1, fontDelayMs = 0 }) {
  const results = {};
  for (const route of ROUTES) {
    const lcpRuns = [];
    const clsRuns = [];
    const inpRuns = [];
    let jsBytes = 0;
    let jsChunks = 0;
    let htmlBytes = 0;
    let warnings = 0;

    for (let i = 0; i < RUNS; i++) {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        colorScheme: 'dark',
      });
      const page = await context.newPage();

      if (fontDelayMs > 0) {
        await page.route('**/*.woff2', async (routeReq) => {
          await new Promise((r) => setTimeout(r, fontDelayMs));
          await routeReq.continue();
        });
      }

      if (cpuThrottleRate > 1) {
        const cdp = await context.newCDPSession(page);
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuThrottleRate });
      }

      await page.addInitScript(() => {
        window.__f12Perf = { lcp: 0, cls: 0 };
        new PerformanceObserver((list) => {
          for (const e of list.getEntries()) window.__f12Perf.lcp = e.startTime;
        }).observe({ type: 'largest-contentful-paint', buffered: true });
        new PerformanceObserver((list) => {
          for (const e of list.getEntries()) {
            if (!e.hadRecentInput) window.__f12Perf.cls += e.value;
          }
        }).observe({ type: 'layout-shift', buffered: true });
      });

      let runJsBytes = 0;
      let runJsChunks = 0;
      page.on('response', async (res) => {
        const u = res.url();
        if (u.includes('/_next/static/') && u.endsWith('.js')) {
          try {
            const buf = await res.body();
            runJsBytes += buf.byteLength;
            runJsChunks += 1;
          } catch {
            // ignore cancelled responses
          }
        }
      });
      page.on('console', (msg) => {
        if (msg.type() === 'error' || msg.type() === 'warning') warnings += 1;
      });
      page.on('pageerror', () => {
        warnings += 1;
      });

      const url = `http://127.0.0.1:${PORT}${route.path}`;
      const resp = await page.goto(url, { waitUntil: 'networkidle' });
      if (i === 0 && resp) {
        const body = await resp.body();
        htmlBytes = body.byteLength;
      }
      await page.waitForTimeout(fontDelayMs > 0 ? fontDelayMs + 250 : 200);

      const perf = await page.evaluate(() => window.__f12Perf);
      lcpRuns.push(Math.round(perf.lcp));
      clsRuns.push(Number(perf.cls.toFixed(4)));

      const latency = await page.evaluate(async (sel) => {
        const el = document.querySelector(sel);
        if (!el) return 0;
        const t0 = performance.now();
        el.click();
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        return Number((performance.now() - t0).toFixed(1));
      }, route.actionSelector);
      inpRuns.push(latency);

      if (i === 0) {
        jsBytes = runJsBytes;
        jsChunks = runJsChunks;
      }
      await context.close();
    }

    results[route.path] = {
      lcpMedian: median(lcpRuns),
      lcpRuns,
      clsMedian: Number(median(clsRuns).toFixed(4)),
      clsRuns,
      interactionMedian: Number(median(inpRuns).toFixed(1)),
      interactionRuns: inpRuns,
      jsKB: Number((jsBytes / 1024).toFixed(1)),
      jsChunks,
      htmlKB: Number((htmlBytes / 1024).toFixed(1)),
      warnings,
    };
  }
  return results;
}

const server = spawn('npx', ['next', 'start', '-p', String(PORT)], {
  cwd: SITE_DIR,
  stdio: 'ignore',
});

try {
  await waitForServer(`http://127.0.0.1:${PORT}/`);
  const browser = await chromium.launch({ headless: true });
  try {
    const unthrottled = await measureMode(browser, { cpuThrottleRate: 1, fontDelayMs: FONT_DELAY_MS });
    const throttled4x = await measureMode(browser, { cpuThrottleRate: 4, fontDelayMs: FONT_DELAY_MS });
    console.log(JSON.stringify({ runs: RUNS, fontDelayMs: FONT_DELAY_MS, unthrottled, throttled4x }, null, 2));
  } finally {
    await browser.close();
  }
} finally {
  server.kill('SIGTERM');
}
