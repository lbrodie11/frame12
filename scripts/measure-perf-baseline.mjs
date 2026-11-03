#!/usr/bin/env node
/**
 * Reproducible laboratory performance baseline runner for @frame12/site.
 *
 * Runs 5 independent fresh browser-context loads per route against `next start`
 * under both unthrottled localhost and 4x CPU throttled conditions, verifying
 * SSR pre-hydration markup (`hasFoucScript`, `hasSheetMarkup`, `hasPanelPolygon`)
 * and dark-on-first-paint (`firstPaintDark`), plus an optional `--font-delay-ms=<ms>`
 * mode to simulate cold-network .woff2 font swaps.
 */
import { spawn } from 'node:child_process';
import net from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE_DIR = resolve(ROOT, 'site');
const NEXT_BIN = resolve(ROOT, 'node_modules/next/dist/bin/next');
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

function getAvailablePort(preferredPort = 0) {
  return new Promise((resolvePort, rejectPort) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', rejectPort);
    srv.listen(preferredPort, '127.0.0.1', () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      srv.close((err) => (err ? rejectPort(err) : resolvePort(port)));
    });
  });
}

async function waitForServer(url, childProc, getExitError, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const exitErr = getExitError();
    if (exitErr) throw exitErr;
    if (childProc.exitCode !== null) {
      throw new Error(`next start exited prematurely with code ${childProc.exitCode}`);
    }
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

async function stopServer(childProc) {
  if (childProc.exitCode !== null || childProc.killed) return;
  await new Promise((resolveStop) => {
    const timer = setTimeout(() => {
      try {
        childProc.kill('SIGKILL');
      } catch {
        // ignore
      }
      resolveStop();
    }, 2000);
    childProc.once('close', () => {
      clearTimeout(timer);
      resolveStop();
    });
    try {
      childProc.kill('SIGTERM');
    } catch {
      clearTimeout(timer);
      resolveStop();
    }
  });
}

async function measureMode(browser, port, { cpuThrottleRate = 1, fontDelayMs = 0 }) {
  const results = {};
  for (const route of ROUTES) {
    const lcpRuns = [];
    const clsRuns = [];
    const inpRuns = [];
    let jsBytes = 0;
    let jsChunks = 0;
    let htmlBytes = 0;
    let hasFoucScript = false;
    let hasSheetMarkup = false;
    let hasPanelPolygon = false;
    let firstPaintDark = false;
    let warnings = 0;

    for (let i = 0; i < RUNS; i++) {
      // Use OS colorScheme: 'light' with saved localStorage 'color-scheme' = 'dark'
      // so FOUC_SCRIPT is exercised overriding a light OS preference on frame 0.
      const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        colorScheme: 'light',
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
        try {
          localStorage.setItem('color-scheme', 'dark');
        } catch {
          // ignore
        }
        window.__f12Perf = {
          lcp: 0,
          cls: 0,
          _clsSessionVal: 0,
          _clsFirstStart: -1,
          _clsPrevStart: -1,
          firstPaintDark: null,
          lightFrames: 0,
        };
        new PerformanceObserver((list) => {
          for (const e of list.getEntries()) window.__f12Perf.lcp = e.startTime;
        }).observe({ type: 'largest-contentful-paint', buffered: true });
        new PerformanceObserver((list) => {
          for (const e of list.getEntries()) {
            if (e.hadRecentInput) continue;
            // Web Vitals CLS session window: max 1000ms gap between shifts, max 5000ms window duration
            if (
              window.__f12Perf._clsFirstStart >= 0 &&
              e.startTime - window.__f12Perf._clsPrevStart <= 1000 &&
              e.startTime - window.__f12Perf._clsFirstStart <= 5000
            ) {
              window.__f12Perf._clsSessionVal += e.value;
            } else {
              window.__f12Perf._clsFirstStart = e.startTime;
              window.__f12Perf._clsSessionVal = e.value;
            }
            window.__f12Perf._clsPrevStart = e.startTime;
            if (window.__f12Perf._clsSessionVal > window.__f12Perf.cls) {
              window.__f12Perf.cls = window.__f12Perf._clsSessionVal;
            }
          }
        }).observe({ type: 'layout-shift', buffered: true });
        const isDarkActive = () => {
          if (!document.documentElement) return false;
          if (document.documentElement.getAttribute('data-theme') !== 'dark') return false;
          const target = document.querySelector('.f12-sheet') || document.documentElement;
          const sheetToken = getComputedStyle(target)
            .getPropertyValue('--f-sheet')
            .trim()
            .toLowerCase();
          return !sheetToken || sheetToken === '#050505';
        };
        // Observe on `document` (which exists before <html> is parsed) so we sample
        // the exact moment <body> is inserted before frame 0 can paint.
        const mo = new MutationObserver(() => {
          if (document.body && window.__f12Perf.firstPaintDark === null) {
            window.__f12Perf.firstPaintDark = isDarkActive();
            mo.disconnect();
          }
        });
        mo.observe(document, { childList: true, subtree: true });
        const checkFrame = () => {
          if (document.body && ! window.__f12Perf._stopFrameCheck) {
            if (window.__f12Perf.firstPaintDark === null) {
              window.__f12Perf.firstPaintDark = isDarkActive();
            }
            if (!isDarkActive()) {
              window.__f12Perf.lightFrames += 1;
            }
          }
          if (!window.__f12Perf._stopFrameCheck) {
            requestAnimationFrame(checkFrame);
          }
        };
        requestAnimationFrame(checkFrame);
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

      const url = `http://127.0.0.1:${port}${route.path}`;
      const resp = await page.goto(url, { waitUntil: 'networkidle' });
      if (!resp || !resp.ok()) {
        throw new Error(
          `Navigation to ${url} failed with HTTP status ${resp ? resp.status() : 'no response'}`,
        );
      }
      if (i === 0) {
        const body = await resp.body();
        htmlBytes = body.byteLength;
        const html = body.toString('utf8');
        hasFoucScript =
          html.includes('localStorage.getItem("color-scheme")') && html.includes('data-theme');
        hasSheetMarkup = html.includes('f12-sheet');
        hasPanelPolygon = html.includes('<polygon');
        if (!hasFoucScript || !hasSheetMarkup || !hasPanelPolygon) {
          throw new Error(
            `Pre-hydration SSR check failed on ${route.path}: ${JSON.stringify({
              hasFoucScript,
              hasSheetMarkup,
              hasPanelPolygon,
            })}`,
          );
        }
      }
      await page.waitForTimeout(fontDelayMs > 0 ? fontDelayMs + 250 : 200);

      const perf = await page.evaluate(() => {
        const target = document.querySelector('.f12-sheet') || document.documentElement;
        const sheetToken = getComputedStyle(target)
          .getPropertyValue('--f-sheet')
          .trim()
          .toLowerCase();
        return {
          lcp: window.__f12Perf.lcp,
          cls: window.__f12Perf.cls,
          firstPaintDark:
            (window.__f12Perf.firstPaintDark ?? sheetToken === '#050505') &&
            window.__f12Perf.lightFrames === 0,
          lightFrames: window.__f12Perf.lightFrames,
        };
      });
      if (!perf.firstPaintDark) {
        throw new Error(
          `Dark first-paint check failed on ${route.path} (lightFrames=${perf.lightFrames})`,
        );
      }
      if (i === 0) {
        firstPaintDark = Boolean(perf.firstPaintDark);
      }
      lcpRuns.push(Math.round(perf.lcp));
      clsRuns.push(Number(perf.cls.toFixed(4)));

      const latency = await page.evaluate(async (sel) => {
        window.__f12Perf._stopFrameCheck = true;
        const el = document.querySelector(sel);
        if (!el) return null;
        const t0 = performance.now();
        el.click();
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        return Number((performance.now() - t0).toFixed(1));
      }, route.actionSelector);
      if (latency === null) {
        throw new Error(
          `Action selector "${route.actionSelector}" not found on route ${route.path}`,
        );
      }
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
      hasFoucScript,
      hasSheetMarkup,
      hasPanelPolygon,
      firstPaintDark,
      warnings,
    };
  }
  return results;
}

const requestedPort = process.env.F12_PERF_PORT ? Number(process.env.F12_PERF_PORT) : 0;
const port = await getAvailablePort(requestedPort);

let serverExitError = null;
const server = spawn(process.execPath, [NEXT_BIN, 'start', '-H', '127.0.0.1', '-p', String(port)], {
  cwd: SITE_DIR,
  stdio: ['ignore', 'ignore', 'pipe'],
});
let stderrBuf = '';
server.stderr?.on('data', (chunk) => {
  stderrBuf += chunk.toString();
});
server.on('error', (err) => {
  serverExitError = err;
});
server.on('exit', (code, signal) => {
  if (code !== null && code !== 0) {
    serverExitError = new Error(
      `next start exited with code ${code} (${signal || 'no signal'}): ${stderrBuf.trim()}`,
    );
  }
});

try {
  await waitForServer(`http://127.0.0.1:${port}/`, server, () => serverExitError);
  const browser = await chromium.launch({ headless: true });
  try {
    const unthrottled = await measureMode(browser, port, {
      cpuThrottleRate: 1,
      fontDelayMs: FONT_DELAY_MS,
    });
    const throttled4x = await measureMode(browser, port, {
      cpuThrottleRate: 4,
      fontDelayMs: FONT_DELAY_MS,
    });
    console.log(
      JSON.stringify({ runs: RUNS, fontDelayMs: FONT_DELAY_MS, unthrottled, throttled4x }, null, 2),
    );
  } finally {
    await browser.close();
  }
} finally {
  await stopServer(server);
}
