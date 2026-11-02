// Playwright production verification, WCAG AA accessibility, responsive overflow,
// registry JSON endpoint, Open Graph image, font binding, and screenshot suite for @frame12/site.

import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = resolve(__dirname, '..');
const REPO_ROOT = resolve(SITE_ROOT, '..');
const DOCS_IMAGES = resolve(REPO_ROOT, 'docs/images');
mkdirSync(DOCS_IMAGES, { recursive: true });

let failures = 0;
function check(ok, label, detail = '') {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`);
}

function getFreePort() {
  return new Promise((resolvePort, rejectPort) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 3456;
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

const CONTRAST = () => {
  const parse = (c) => {
    const m = c && c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const blend = (t, b) => ({
    r: t.r * t.a + b.r * (1 - t.a),
    g: t.g * t.a + b.g * (1 - t.a),
    b: t.b * t.a + b.b * (1 - t.a),
    a: 1,
  });
  const bgOf = (el) => {
    const st = [];
    for (let e = el; e; e = e.parentElement) {
      const c = parse(getComputedStyle(e).backgroundColor);
      if (c && c.a > 0) {
        st.push(c);
        if (c.a >= 1) break;
      }
    }
    let col = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = st.length - 1; i >= 0; i--) col = blend(st.at(i), col);
    return col;
  };
  const ratio = (fg, bg) => {
    const a = lum(blend(fg, bg));
    const b = lum(bg);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  };
  const out = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const t = walker.currentNode;
    const el = t.parentElement;
    if (
      !el ||
      !t.textContent.trim() ||
      el.closest('svg, .f12-sr-only, .f12-rng, .skip-link, [inert], dialog:not([open])')
    )
      continue;
    const rc = el.getBoundingClientRect();
    if (!rc.width || !rc.height) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    const size = parseFloat(cs.fontSize);
    const bold = +cs.fontWeight >= 700;
    const need = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5;
    const r = ratio(parse(cs.color), bgOf(el));
    if (r < need) out.push(`${t.textContent.trim().slice(0, 30)} (${r.toFixed(2)} < ${need})`);
  }
  for (const tx of document.querySelectorAll('.f12-chart svg text')) {
    const r = ratio(parse(getComputedStyle(tx).fill), bgOf(tx.closest('.f12-chart')));
    if (r < 4.5) {
      out.push(`chart label ${tx.textContent} (${r.toFixed(2)})`);
      break;
    }
  }
  return out;
};

const NAMES = () => {
  const unnamed = [];
  for (const el of document.querySelectorAll(
    'button, input:not([type="hidden"]), select:not([tabindex="-1"]):not([aria-hidden="true"]), textarea, [tabindex="0"], a[href]',
  )) {
    if (el.closest('[inert], dialog:not([open]), [aria-hidden="true"]')) continue;
    const name = (
      el.getAttribute('aria-label') ||
      el.textContent ||
      (el.labels && [...el.labels].map((l) => l.textContent).join(' ')) ||
      ''
    ).trim();
    if (!name) unnamed.push(el.outerHTML.slice(0, 60));
  }
  const ids = {};
  for (const el of document.querySelectorAll('[id]')) ids[el.id] = (ids[el.id] || 0) + 1;
  return { unnamed, dup: Object.keys(ids).filter((k) => ids[k] > 1) };
};

const GRAMMAR_DOM = () => {
  const scenes = [...document.querySelectorAll('.f12-scene')];
  const sceneGaps = scenes.map((s) =>
    parseFloat(getComputedStyle(s).rowGap || getComputedStyle(s).gap),
  );
  const pairs = [...document.querySelectorAll('.f12-pair')];
  const pairGaps = pairs.map((p) => parseFloat(getComputedStyle(p).gap));

  const cutEls = [...document.querySelectorAll('.f12-panel > .f12-cut')];
  const cuts = cutEls.map((e) => e.textContent.trim());
  const sequential =
    cuts.length > 0 &&
    cuts.every((c, idx) => c === `C-${String(idx + 1).padStart(2, '0')}`);

  const rects = cutEls.map((e) => {
    const r = e.getBoundingClientRect();
    return { top: Math.round(r.top), left: Math.round(r.left) };
  });
  let readingOrder = true;
  for (let i = 1; i < rects.length; i++) {
    const prev = rects[i - 1];
    const cur = rects[i];
    const sameRow = Math.abs(cur.top - prev.top) < 40;
    if (sameRow && cur.left < prev.left) readingOrder = false;
    if (!sameRow && cur.top < prev.top - 40) readingOrder = false;
  }

  const markerRgb = 'rgb(255, 214, 10)';
  const inkRgb = 'rgb(18, 18, 18)';
  const markerViolations = [];
  for (const el of document.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (cs.color === markerRgb) markerViolations.push(`marker text on ${el.tagName}`);
    if (cs.backgroundColor === markerRgb && el.textContent.trim() && cs.color !== inkRgb) {
      markerViolations.push(`non-ink text on marker bg ${el.tagName}`);
    }
  }

  return {
    guttersOk:
      sceneGaps.every((g) => g === 12 || g === 20 || g === 32) &&
      pairGaps.every((g) => g === 12),
    cuts,
    sequential,
    readingOrder,
    markerViolations,
  };
};

async function focusMissesAll(page) {
  const misses = [];
  const seenKeys = new Set();
  await page.evaluate(() => {
    if (document.activeElement && document.activeElement !== document.body) {
      document.activeElement.blur();
    }
  });
  for (let i = 0; i < 120; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const e = document.activeElement;
      if (!e || e === document.body) return null;
      const cs = getComputedStyle(e);
      const key =
        e.id ||
        `${e.tagName}:${(e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 30)}:${Math.round(e.getBoundingClientRect().top)}`;
      return {
        key,
        id: e.id || e.tagName,
        vis:
          (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) ||
          cs.boxShadow !== 'none',
      };
    });
    if (!info) break;
    if (seenKeys.has(info.key)) break;
    seenKeys.add(info.key);
    if (!info.vis) misses.push(info.id);
  }
  return { misses, totalStops: seenKeys.size };
}

const ROUTES = [
  '/',
  '/motion',
  '/components',
  '/components/panel',
  '/components/tone-area-chart',
  '/agents',
  '/style-sheet',
  '/get-started',
];

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

  // 1. Verify static registry JSON endpoints served from site/public/r/
  for (const item of ['panel.json', 'frame12.json', 'registry.json']) {
    const res = await fetch(`${baseUrl}/r/${item}`);
    const body = await res.json();
    check(
      res.status === 200 && Boolean(body.name || body.items),
      `site registry endpoint /r/${item} returns HTTP 200 valid JSON`,
    );
  }

  // 2. Verify Open Graph image routes return HTTP 200 image/png
  for (const ogPath of [
    '/opengraph-image',
    '/motion/opengraph-image',
    '/components/opengraph-image',
    '/agents/opengraph-image',
    '/style-sheet/opengraph-image',
    '/get-started/opengraph-image',
  ]) {
    const res = await fetch(`${baseUrl}${ogPath}`);
    const ct = res.headers.get('content-type') || '';
    const buf = await res.arrayBuffer();
    check(
      res.status === 200 && ct.includes('image/png') && buf.byteLength > 1000,
      `site OG image ${ogPath} returns HTTP 200 image/png (${buf.byteLength} bytes)`,
    );
  }

  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox'],
  });

  // 3. Desktop (1280px) light & dark verification across all routes + screenshots
  for (const route of ROUTES) {
    for (const scheme of ['light', 'dark']) {
      const ctx = await browser.newContext({
        viewport: { width: 1280, height: 920 },
        colorScheme: scheme,
        reducedMotion: 'no-preference',
      });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(`console: ${m.text()}`);
      });

      await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
      await page.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve()));
      await page.waitForTimeout(250);

      // Capture required screenshots
      if (route === '/' && scheme === 'light') {
        await page.screenshot({ path: resolve(DOCS_IMAGES, 'site-home-light.png'), fullPage: true });

        // Verify next/font CSS variable bindings on <html> win over :where(:root) defaults
        const fontBinding = await page.evaluate(() => {
          const titleFont = getComputedStyle(document.querySelector('.f12-title')).fontFamily;
          const bodyFont = getComputedStyle(document.body).fontFamily;
          const monoFont = getComputedStyle(document.querySelector('.f12-cut')).fontFamily;
          const htmlVarDisplay = getComputedStyle(document.documentElement)
            .getPropertyValue('--font-f-display')
            .trim();
          return { titleFont, bodyFont, monoFont, htmlVarDisplay };
        });
        check(
          Boolean(fontBinding.titleFont) &&
            Boolean(fontBinding.bodyFont) &&
            Boolean(fontBinding.monoFont) &&
            !fontBinding.htmlVarDisplay.startsWith('"Dela Gothic One", "Arial Black"'),
          'site next/font binding: <html> next/font CSS variables override :where(:root) fallback stacks',
          JSON.stringify(fontBinding),
        );
      } else if (route === '/motion' && scheme === 'light') {
        await page.screenshot({
          path: resolve(DOCS_IMAGES, 'site-motion-light.png'),
          fullPage: true,
        });
      } else if (route === '/motion' && scheme === 'dark') {
        await page.screenshot({
          path: resolve(DOCS_IMAGES, 'site-motion-dark.png'),
          fullPage: true,
        });
      } else if (route === '/components' && scheme === 'light') {
        await page.screenshot({
          path: resolve(DOCS_IMAGES, 'site-components-light.png'),
          fullPage: true,
        });
      } else if (route === '/agents' && scheme === 'light') {
        await page.screenshot({
          path: resolve(DOCS_IMAGES, 'site-agents-light.png'),
          fullPage: true,
        });
      }

      const c = await page.evaluate(CONTRAST);
      const axe = await new AxeBuilder({ page }).analyze();
      const n = await page.evaluate(NAMES);
      const g = await page.evaluate(GRAMMAR_DOM);
      const f = await focusMissesAll(page);
      const sw = await page.evaluate(() => document.documentElement.scrollWidth);

      check(
        c.length === 0,
        `site ${route} (${scheme}, 1280px): WCAG AA text contrast`,
        c.slice(0, 3).join('; '),
      );
      check(
        axe.violations.length === 0,
        `site ${route} (${scheme}, 1280px): @axe-core/playwright zero violations`,
        axe.violations.map((v) => `${v.id} (${v.nodes.length})`).join(', '),
      );
      check(
        n.unnamed.length === 0 && n.dup.length === 0,
        `site ${route} (${scheme}, 1280px): controls named & IDs unique`,
        [...n.unnamed, ...n.dup].slice(0, 3).join('; '),
      );
      check(
        g.guttersOk && g.sequential && g.readingOrder && g.markerViolations.length === 0,
        `site ${route} (${scheme}, 1280px): gutters, sequential cuts (${g.cuts.join(',')}), reading order, marker discipline`,
        JSON.stringify(g),
      );
      check(
        f.misses.length === 0 && f.totalStops > 0,
        `site ${route} (${scheme}, 1280px): visible keyboard focus across all ${f.totalStops} tab stops`,
        f.misses.slice(0, 3).join(', '),
      );
      check(
        sw <= 1280 && errors.length === 0,
        `site ${route} (${scheme}, 1280px): zero horizontal overflow & 0 console/page errors`,
        `scrollWidth=${sw} errors=${errors.join('; ')}`,
      );

      await ctx.close();
    }
  }

  // 4. Mobile (390px) responsive & contrast checks across all routes
  for (const route of ROUTES) {
    for (const scheme of ['light', 'dark']) {
      const ctx = await browser.newContext({
        viewport: { width: 390, height: 844 },
        colorScheme: scheme,
        reducedMotion: 'no-preference',
      });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(`console: ${m.text()}`);
      });

      await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
      await page.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve()));
      await page.waitForTimeout(200);

      const c = await page.evaluate(CONTRAST);
      const sw = await page.evaluate(() => document.documentElement.scrollWidth);
      check(
        c.length === 0 && sw <= 390 && errors.length === 0,
        `site ${route} (${scheme}, 390px mobile): WCAG AA contrast & zero horizontal overflow`,
        `scrollWidth=${sw} contrast=${c.slice(0, 2).join('; ')} errors=${errors.join('; ')}`,
      );
      await ctx.close();
    }
  }

  // 5. Interactive behavioral checks on Home and Motion
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 920 } });
    const page = await ctx.newPage();
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });

    // Toggle site theme to dark via header control
    await page.click('#site-theme-dark');
    const isDarkAttr = await page.evaluate(
      () => document.documentElement.getAttribute('data-theme') === 'dark',
    );
    await page.click('#site-theme-light');

    // Switch home dashboard range to 7 days and select exit intervention
    await page.click('#home-rng-7');
    await page.waitForTimeout(300);
    await page.click('#int-home-exit');
    await page.waitForTimeout(200);
    const hasCompareLine = await page.evaluate(() =>
      Boolean(document.querySelector('.f12-chart .f12-l-focus')),
    );

    check(
      isDarkAttr && hasCompareLine,
      'site / interactive flow: header theme toggle and recovery dashboard range + intervention overlay',
    );

    await page.goto(`${baseUrl}/motion`, { waitUntil: 'networkidle' });
    await page.click('#stage-compare-mode-cut');
    await page.click('#motion-play-btn');
    await page.waitForTimeout(300);
    const hasCutClass = await page.evaluate(() =>
      Boolean(document.querySelector('.f12-m-cut')),
    );
    check(
      hasCutClass,
      'site /motion interactive flow: comparison mode toggle and synchronized Play comparison trigger',
    );

    await ctx.close();
  }

  await browser.close();
} finally {
  serverProc.kill('SIGTERM');
}

console.log(failures ? `\n${failures} site check(s) failed` : '\nAll site checks passed');
process.exitCode = failures ? 1 : 0;
