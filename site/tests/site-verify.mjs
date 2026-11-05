// Playwright production verification, WCAG AA accessibility, responsive overflow,
// registry JSON endpoint, Open Graph image, font binding, and screenshot suite for @frame12/site.

import { chromium, firefox, webkit } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import { getRenderedCuts } from '../../registry/tests/lib.mjs';

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

  const cutEls = [...document.querySelectorAll('.f12-panel > .f12-cut')].filter(
    (e) => getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0,
  );
  const cuts = cutEls.map((e) => e.textContent.trim());
  const sequential =
    cuts.length > 0 &&
    cuts.every((c, idx) => c === `C-${String(idx + 1).padStart(2, '0')}`);

  const rects = cutEls.map((e) => {
    const r = e.getBoundingClientRect();
    return { top: Math.round(r.top), left: Math.round(r.left) };
  });
  let readingOrder = rects.length > 0;
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
  let totalStops = 0;
  let cycled = false;
  let consecutiveBody = 0;
  await page.evaluate(() => {
    window.__f12SeenFocus = new Set();
    if (document.activeElement && document.activeElement !== document.body) {
      document.activeElement.blur();
    }
  });
  for (let i = 0; i < 200; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const e = document.activeElement;
      if (!e || e === document.body) return { status: 'body' };
      const seen = window.__f12SeenFocus;
      if (seen.has(e)) return { status: 'cycled' };
      seen.add(e);
      const cs = getComputedStyle(e);
      return {
        status: 'visited',
        id: e.id || e.tagName,
        vis:
          (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) ||
          cs.boxShadow !== 'none',
      };
    });
    if (info.status === 'cycled') {
      cycled = true;
      break;
    }
    if (info.status === 'body') {
      consecutiveBody++;
      if (consecutiveBody >= 2) break;
      continue;
    }
    consecutiveBody = 0;
    totalStops++;
    if (!info.vis) misses.push(info.id);
  }
  return { misses, totalStops, cycled };
}

const ROUTES = [
  '/',
  '/motion',
  '/components',
  '/components/panel',
  '/components/tone-area-chart',
  '/components/toast',
  '/components/pagination',
  '/blocks/developer-console',
  '/blocks/workspace-settings',
  '/blocks/analytics-dashboard',
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
  for (const item of [
    'panel.json',
    'sheet.json',
    'field.json',
    'textarea.json',
    'checkbox.json',
    'radio-group.json',
    'switch.json',
    'tabs.json',
    'alert.json',
    'toast.json',
    'skeleton.json',
    'empty-state.json',
    'breadcrumb.json',
    'pagination.json',
    'frame12-base.json',
    'font-dela-gothic-one.json',
    'frame12.json',
    'developer-console.json',
    'workspace-settings.json',
    'analytics-dashboard.json',
    'registry.json',
  ]) {
    const res = await fetch(`${baseUrl}/r/${item}`);
    const body = await res.json();
    check(
      res.status === 200 && Boolean(body.name || body.items),
      `site registry endpoint /r/${item} returns HTTP 200 valid JSON`,
    );
  }

  // 1a. Verify AI discovery endpoints (/llms.txt and /llms-full.txt)
  {
    const llmsRes = await fetch(`${baseUrl}/llms.txt`);
    const llmsCt = llmsRes.headers.get('content-type') || '';
    const llmsText = await llmsRes.text();
    check(
      llmsRes.status === 200 &&
        llmsCt.includes('text/plain') &&
        llmsText.includes('# FRAME/12') &&
        llmsText.includes('<Sheet autoCut>') &&
        llmsText.includes('/components/panel'),
      'site /llms.txt returns HTTP 200 text/plain with canonical catalog links and <Sheet autoCut> guidance',
    );

    const llmsFullRes = await fetch(`${baseUrl}/llms-full.txt`);
    const llmsFullCt = llmsFullRes.headers.get('content-type') || '';
    const llmsFullText = await llmsFullRes.text();
    check(
      llmsFullRes.status === 200 &&
        llmsFullCt.includes('text/plain') &&
        llmsFullText.includes('skills/frame12/SKILL.md') &&
        llmsFullText.includes('explicit-cut-in-autocut') &&
        llmsFullText.includes('frame12-base'),
      'site /llms-full.txt returns HTTP 200 text/plain generated from SKILL.md, references, registry.json, and catalog.ts',
    );
  }

  // 1b. Verify branded SVG favicon and Apple touch icon endpoints
  {
    const iconRes = await fetch(`${baseUrl}/icon.svg`);
    const iconCt = iconRes.headers.get('content-type') || '';
    const iconText = await iconRes.text();
    check(
      iconRes.status === 200 && iconCt.includes('image/svg+xml') && iconText.includes('#ffd60a'),
      'site favicon /icon.svg returns HTTP 200 image/svg+xml with FRAME/12 marker yellow',
    );
    const appleRes = await fetch(`${baseUrl}/apple-icon`);
    const appleCt = appleRes.headers.get('content-type') || '';
    const appleBuf = await appleRes.arrayBuffer();
    check(
      appleRes.status === 200 && appleCt.includes('image/png') && appleBuf.byteLength > 500,
      `site Apple touch icon /apple-icon returns HTTP 200 image/png (${appleBuf.byteLength} bytes)`,
    );
  }

  // 2. Verify Open Graph image routes return HTTP 200 image/png
  for (const ogPath of [
    '/opengraph-image',
    '/motion/opengraph-image',
    '/components/opengraph-image',
    '/blocks/developer-console/opengraph-image',
    '/blocks/workspace-settings/opengraph-image',
    '/blocks/analytics-dashboard/opengraph-image',
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

        // Verify next/font CSS variable bindings on <html> resolve through :where(:root) --font-f-* stacks with fallbacks intact
        const fontBinding = await page.evaluate(() => {
          const titleFont = getComputedStyle(document.querySelector('.f12-title')).fontFamily;
          const bodyFont = getComputedStyle(document.body).fontFamily;
          const monoFont = getComputedStyle(document.querySelector('.f12-cut')).fontFamily;
          const rootStyle = getComputedStyle(document.documentElement);
          const htmlVarDisplay = rootStyle.getPropertyValue('--font-dela-gothic-one').trim();
          const htmlVarBody = rootStyle.getPropertyValue('--font-zen-kaku-gothic-new').trim();
          const htmlVarMono = rootStyle.getPropertyValue('--font-m-plus-1-code').trim();
          return {
            titleFont,
            bodyFont,
            monoFont,
            htmlVarDisplay,
            htmlVarBody,
            htmlVarMono,
          };
        });
        const normFont = (s) => (s || '').replace(/["'\s]/g, '');
        check(
          Boolean(fontBinding.htmlVarDisplay) &&
            Boolean(fontBinding.htmlVarBody) &&
            Boolean(fontBinding.htmlVarMono) &&
            normFont(fontBinding.titleFont).startsWith(normFont(fontBinding.htmlVarDisplay)) &&
            normFont(fontBinding.bodyFont).startsWith(normFont(fontBinding.htmlVarBody)) &&
            normFont(fontBinding.monoFont).startsWith(normFont(fontBinding.htmlVarMono)) &&
            normFont(fontBinding.titleFont).includes('ArialBlack') &&
            normFont(fontBinding.bodyFont).includes('HiraginoSans') &&
            normFont(fontBinding.monoFont).includes('ui-monospace'),
          'site next/font binding: <html> --font-<slug> CSS variables resolve into --font-f-* while preserving fallback stacks',
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
      g.cuts = await getRenderedCuts(page, { panelsOnly: true });
      g.sequential =
        g.cuts.length > 0 &&
        g.cuts.every((cut, idx) => cut === `C-${String(idx + 1).padStart(2, '0')}`);
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
        f.misses.length === 0 && f.totalStops > 0 && f.cycled,
        `site ${route} (${scheme}, 1280px): visible keyboard focus across all ${f.totalStops} tab stops`,
        `cycled=${f.cycled} misses=${f.misses.slice(0, 3).join(', ')}`,
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
      const axeMobile = await new AxeBuilder({ page }).analyze();
      const sw = await page.evaluate(() => document.documentElement.scrollWidth);
      check(
        c.length === 0 && axeMobile.violations.length === 0 && sw <= 390 && errors.length === 0,
        `site ${route} (${scheme}, 390px mobile): WCAG AA contrast, @axe-core/playwright zero violations, & zero horizontal overflow`,
        `scrollWidth=${sw} axe=${axeMobile.violations.map((v) => v.id).join(',')} contrast=${c.slice(0, 2).join('; ')} errors=${errors.join('; ')}`,
      );
      await ctx.close();
    }
  }

  // 5. Interactive behavioral checks on Home and Motion
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 920 } });
    const page = await ctx.newPage();
    const titles = new Map();
    for (const r of ROUTES) {
      await page.goto(`${baseUrl}${r}`, { waitUntil: 'networkidle' });
      titles.set(r, await page.title());
    }
    const uniqueTitles = new Set(titles.values());
    check(
      uniqueTitles.size === ROUTES.length,
      `site route metadata: all ${ROUTES.length} routes have distinct document.title values`,
      JSON.stringify(Object.fromEntries(titles)),
    );

    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });

    // Toggle site theme via 't' keyboard shortcut and cycle motion via 'm' shortcut
    await page.keyboard.press('t');
    const isDarkViaShortcut = await page.evaluate(
      () => document.documentElement.getAttribute('data-theme') === 'dark',
    );
    await page.keyboard.press('t');
    await page.keyboard.press('m');
    const isSmoothViaShortcut = await page.evaluate(() =>
      Boolean(document.querySelector('.site-root.f12-m-smooth')),
    );
    await page.keyboard.press('m');
    await page.keyboard.press('m');

    // Toggle site theme to dark via header control
    await page.click('#site-theme-dark');
    const isDarkAttr = await page.evaluate(
      () => document.documentElement.getAttribute('data-theme') === 'dark',
    );

    // Verify pre-hydration first paint & no-JS completeness:
    // 1. OS dark mode with JavaScript completely disabled across routes -> dark theme, charts, sparklines, and segmented controls all render on first frame
    {
      const noJsCtx = await browser.newContext({
        viewport: { width: 1280, height: 920 },
        colorScheme: 'dark',
        javaScriptEnabled: false,
      });
      const noJsPage = await noJsCtx.newPage();
      await noJsPage.goto(`${baseUrl}/`, { waitUntil: 'load' });
      const noJsHome = await noJsPage.evaluate(() => {
        const sparks = [...document.querySelectorAll('.f12-spark')];
        const rngs = [...document.querySelectorAll('.f12-rng')];
        const unhighlightedRngs = rngs.filter((rng) => {
          const btns = [...rng.querySelectorAll('.f12-rng-btn')];
          return !btns.some((b) => getComputedStyle(b).backgroundColor !== 'rgba(0, 0, 0, 0)');
        });
        return {
          sheetBg: getComputedStyle(document.querySelector('.f12-sheet')).backgroundColor,
          frameFill: getComputedStyle(document.querySelector('.f12-panel svg polygon')).fill,
          titleColor: getComputedStyle(document.querySelector('.f12-title')).color,
          darkToggleBg: getComputedStyle(document.querySelector('#site-theme-dark')).backgroundColor,
          lightToggleBg: getComputedStyle(document.querySelector('#site-theme-light')).backgroundColor,
          chartPaths: document.querySelectorAll('.f12-chart svg path.f12-l-total').length,
          sparkSvgs: document.querySelectorAll('.f12-spark svg').length,
          sparkMinHeight: Math.min(...sparks.map((s) => s.getBoundingClientRect().height)),
          unhighlightedRngs: unhighlightedRngs.length,
        };
      });
      const noJsCuts = await getRenderedCuts(noJsPage, { panelsOnly: true });
      check(
        noJsHome.sheetBg === 'rgb(5, 5, 5)' &&
          noJsHome.frameFill === 'rgb(25, 25, 26)' &&
          noJsHome.titleColor === 'rgb(241, 240, 234)' &&
          noJsHome.darkToggleBg === 'rgb(241, 240, 234)' &&
          noJsHome.lightToggleBg === 'rgba(0, 0, 0, 0)' &&
          noJsHome.chartPaths >= 1 &&
          noJsHome.sparkSvgs >= 2 &&
          noJsHome.sparkMinHeight >= 70 &&
          noJsHome.unhighlightedRngs === 0 &&
          noJsCuts.join(',') === 'C-01,C-02,C-03,C-04,C-05,C-06,C-07,C-08',
        'site / pre-hydration OS dark mode (JS disabled): dark sheet/panel, server-rendered chart & sparklines (74px height), highlighted segmented controls, and auto cuts C-01..C-08',
        JSON.stringify({ ...noJsHome, noJsCuts }),
      );
      await noJsCtx.close();
    }

    // 2. Saved localStorage dark setting on OS light mode with React bundle blocked (only <head> FOUC_SCRIPT runs)
    {
      const savedDarkCtx = await browser.newContext({
        viewport: { width: 1280, height: 920 },
        colorScheme: 'light',
      });
      await savedDarkCtx.addInitScript(() => {
        localStorage.setItem('color-scheme', 'dark');
      });
      const savedDarkPage = await savedDarkCtx.newPage();
      await savedDarkPage.route('**/_next/static/**/*.js', (route) => route.abort());
      await savedDarkPage.goto(`${baseUrl}/`, { waitUntil: 'load' });
      const savedDarkColors = await savedDarkPage.evaluate(() => ({
        dataTheme: document.documentElement.getAttribute('data-theme'),
        sheetBg: getComputedStyle(document.querySelector('.f12-sheet')).backgroundColor,
        frameFill: getComputedStyle(document.querySelector('.f12-panel svg polygon')).fill,
        titleColor: getComputedStyle(document.querySelector('.f12-title')).color,
      }));
      check(
        savedDarkColors.dataTheme === 'dark' &&
          savedDarkColors.sheetBg === 'rgb(5, 5, 5)' &&
          savedDarkColors.frameFill === 'rgb(25, 25, 26)' &&
          savedDarkColors.titleColor === 'rgb(241, 240, 234)',
        'site / pre-hydration saved dark mode (before React loads): .f12-sheet, .f12-panel svg polygon, and .f12-title paint dark on first frame',
        JSON.stringify(savedDarkColors),
      );
      await savedDarkCtx.close();
    }

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
      isDarkViaShortcut && isSmoothViaShortcut && isDarkAttr && hasCompareLine,
      'site / interactive flow: header & keyboard (T/M) toggles and recovery dashboard range + intervention overlay',
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

    // 5b. Developer Console Flagship Block (/blocks/developer-console) end-to-end interactive verification
    await page.goto(`${baseUrl}/blocks/developer-console`, { waitUntil: 'networkidle' });
    await page.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve()));

    // Dataset state transitions: loading -> empty -> error -> retry recovery
    await page.click('#dev-console-dataset-state-loading');
    const hasSkeletonInLoading = await page.evaluate(
      () => document.querySelectorAll('.f12-skeleton').length >= 6,
    );
    await page.click('#dev-console-dataset-state-empty');
    const emptyOverviewTelemetry = await page.evaluate(() => {
      const hasEmptyBanner = Boolean(document.getElementById('dev-console-empty-workspace'));
      const hasEmptyChart = Boolean(document.getElementById('dev-console-chart-empty'));
      const noChartSvg = !document.querySelector('#dev-console-sheet .f12-chart');
      const text = document.getElementById('dev-console-sheet')?.textContent || '';
      const hasZeroServiceTotal = text.includes('Total 0 requests');
      const hasZeroLogsTab = text.includes('04 · Request Logs (0)');
      return (
        hasEmptyBanner &&
        hasEmptyChart &&
        noChartSvg &&
        hasZeroServiceTotal &&
        hasZeroLogsTab
      );
    });
    await page.click('#dev-console-tab-request-logs');
    const emptyLogsTabOk = await page.evaluate(
      () =>
        Boolean(document.getElementById('dev-console-logs-empty')) &&
        document.querySelectorAll('#dev-console-sheet tbody tr').length === 0,
    );
    await page.click('#dev-console-tab-overview');
    const hasEmptyWorkspace = emptyOverviewTelemetry && emptyLogsTabOk;
    await page.click('#dev-console-dataset-state-error');
    const hasErrorBanner = await page.evaluate(() =>
      Boolean(document.getElementById('dev-console-error-banner')),
    );
    await page.click('#dev-console-retry-telemetry');
    const recoveredFromError = await page.evaluate(
      () =>
        !document.getElementById('dev-console-error-banner') &&
        document.querySelectorAll('.f12-toast').length >= 1,
    );
    check(
      hasSkeletonInLoading && hasEmptyWorkspace && hasErrorBanner && recoveredFromError,
      'site /blocks/developer-console dataset states: loading skeletons, consistent empty state across Overview & Request Logs, 503 error banner, and retry recovery with toast',
      JSON.stringify({
        hasSkeletonInLoading,
        emptyOverviewTelemetry,
        emptyLogsTabOk,
        hasErrorBanner,
        recoveredFromError,
      }),
    );

    // Overview: time range switching, SLO breach badge on 7d/30d vs 24h within budget, & ranked service selection
    const slo24hOk = await page.evaluate(() => {
      const tag = document.getElementById('dev-console-slo-status-tag');
      return (
        Boolean(tag?.textContent?.includes('SLO WITHIN BUDGET')) &&
        Boolean(tag?.classList.contains('f12-status-success'))
      );
    });
    await page.click('#dev-console-range-7d');
    await page.click('#int-dev-console-svc-bar-svc-inventory-ledger');
    const overviewUpdated = await page.evaluate(() => {
      const text = document.body.textContent || '';
      const tag = document.getElementById('dev-console-slo-status-tag');
      return (
        text.includes('9,840,200') &&
        text.includes('OVERLAY: SVC-03') &&
        Boolean(tag?.textContent?.includes('SLO BUDGET BREACHED')) &&
        Boolean(tag?.classList.contains('f12-status-warning'))
      );
    });
    await page.click('#dev-console-range-30d');
    const slo30dOk = await page.evaluate(() => {
      const tag = document.getElementById('dev-console-slo-status-tag');
      return (
        Boolean(tag?.textContent?.includes('SLO BUDGET BREACHED')) &&
        Boolean(tag?.classList.contains('f12-status-warning'))
      );
    });
    await page.click('#dev-console-range-24h');
    check(
      slo24hOk && overviewUpdated && slo30dOk,
      'site /blocks/developer-console Overview: 24h/7d/30d SLO status badge accuracy and ranked service overlay selection reconcile KPIs & chart',
      JSON.stringify({ slo24hOk, overviewUpdated, slo30dOk }),
    );

    // Services & Endpoints: circuit-breaker switch, search empty state, and filter reset
    await page.click('#dev-console-tab-services');
    await page.click('#dev-console-shed-svc-webhook-dispatch');
    await page.fill('#dev-console-endpoint-search', 'nonexistent-route-xyz');
    const hasEndpointsEmpty = await page.evaluate(() =>
      Boolean(document.getElementById('dev-console-endpoints-empty')),
    );
    await page.click('#dev-console-reset-endpoint-filters');
    const endpointsRestored = await page.evaluate(
      () =>
        !document.getElementById('dev-console-endpoints-empty') &&
        document.querySelectorAll('#dev-console-sheet tbody tr').length === 8,
    );
    check(
      hasEndpointsEmpty && endpointsRestored,
      'site /blocks/developer-console Services & Endpoints: circuit-breaker toggle, search empty state, and filter reset',
      JSON.stringify({ hasEndpointsEmpty, endpointsRestored }),
    );

    // API Keys: validation error on short label, valid key issuance, and modal Dialog revocation confirmation
    await page.click('#dev-console-tab-api-keys');
    await page.fill('#dev-console-key-label-input', 'ab');
    await page.click('#dev-console-issue-key-submit');
    const hasValidationError = await page.evaluate(() => {
      const input = document.getElementById('dev-console-key-label-input');
      return input?.getAttribute('aria-invalid') === 'true';
    });
    await page.fill('#dev-console-key-label-input', 'Tokyo Edge Worker');
    await page.click('#dev-console-issue-key-submit');
    const issuedBannerVisible = await page.evaluate(() =>
      Boolean(document.getElementById('dev-console-issued-key-banner')),
    );
    await page.click('#dev-console-revoke-key-key-prod-primary');
    await page.waitForSelector('dialog[open]', { timeout: 3000 });
    await page.click('#dev-console-confirm-revoke');
    const revokedApplied = await page.evaluate(
      () =>
        !document.querySelector('dialog[open]') &&
        !document.getElementById('dev-console-revoke-key-key-prod-primary'),
    );
    check(
      hasValidationError && issuedBannerVisible && revokedApplied,
      'site /blocks/developer-console API Keys: Field validation, simulated f12_sim_* issuance, and Dialog revocation confirmation',
      JSON.stringify({ hasValidationError, issuedBannerVisible, revokedApplied }),
    );

    // Request Logs: revoked key replay rejection (401), active key replay (202), page-3 replay focus restoration, dialog centering under Tailwind margin:0 reset, and route/overview drilldown focus + filter reset
    await page.click('#dev-console-tab-request-logs');
    // Inject a simulated Tailwind base reset (*, dialog { margin: 0; }) at the start of <head> to verify dialog.f12-dialog { margin: auto; } keeps modals centered with unclipped C-05 cut labels
    await page.evaluate(() => {
      const resetStyle = document.createElement('style');
      resetStyle.id = 'test-tailwind-preflight';
      resetStyle.textContent = '*, ::before, ::after, dialog { margin: 0; }';
      document.head.insertBefore(resetStyle, document.head.firstChild);
    });
    // 1) Replay log-1 whose key (key-prod-primary) was just revoked -> must return 401 (4XX) and dialog must be centered with visible C-05 cut
    await page.click('#dev-console-inspect-log-log-1');
    await page.waitForSelector('dialog[open]', { timeout: 3000 });
    const dialogCenteredAndCutVisible = await page.evaluate(() => {
      const dlg = document.querySelector('dialog.f12-dialog[open]');
      const cut = dlg?.querySelector('.f12-cut');
      if (!dlg || !cut) return false;
      const r = dlg.getBoundingClientRect();
      const cr = cut.getBoundingClientRect();
      const centerXDelta = Math.abs((r.left + r.right) / 2 - window.innerWidth / 2);
      return centerXDelta <= 24 && r.top >= 16 && cr.top >= 4 && cr.left >= 4;
    });
    await page.click('#dev-console-replay-log-btn');
    const revokedReplay401 = await page.evaluate(() => {
      const dlgText = document.querySelector('dialog[open]')?.textContent || '';
      return dlgText.includes('401 (4XX)') && dlgText.includes('revoked_api_key');
    });
    await page.click('#dev-console-close-log-dialog');

    // 2) Navigate to Page 3, inspect log-11 (active key-eu-staging), replay (switches to Page 1), and close dialog -> focus must land on the connected replayed row's Inspect button, not document.body
    await page.click('.f12-pagination button:has-text("3")');
    await page.click('#dev-console-inspect-log-log-11');
    await page.waitForSelector('dialog[open]', { timeout: 3000 });
    await page.click('#dev-console-replay-log-btn');
    await page.click('#dev-console-close-log-dialog');
    await page.waitForTimeout(50);
    const focusAfterPage3Replay = await page.evaluate(() => {
      const active = document.activeElement;
      return {
        id: active?.id || '',
        tag: active?.tagName || '',
        connected: Boolean(active?.isConnected && active !== document.body),
      };
    });

    // 3) Status filter 5XX + route drilldown from Services & Endpoints must clear stale 5XX filter AND move focus to #dev-console-log-search
    await page.click('#dev-console-log-status-5xx');
    const fiveXxRows = await page.evaluate(
      () => document.querySelectorAll('#dev-console-sheet tbody tr').length,
    );
    await page.click('#dev-console-tab-services');
    await page.click('#dev-console-inspect-ep-ep-session-get');
    await page.click('#dev-console-ep-filter-logs');
    await page.waitForTimeout(40);
    const drilldownClearedStaleFilter = await page.evaluate(() => {
      const rows = document.querySelectorAll('#dev-console-sheet tbody tr').length;
      const statusAllPressed =
        document
          .getElementById('dev-console-log-status-all')
          ?.getAttribute('aria-pressed') === 'true';
      const focusedSearch = document.activeElement?.id === 'dev-console-log-search';
      return (
        rows >= 1 &&
        statusAllPressed &&
        focusedSearch &&
        !document.getElementById('dev-console-logs-empty')
      );
    });

    // 3b) Overview "Inspect request logs →" shortcut must also move focus to #dev-console-log-search (never document.body) and Overview layout must have 1 peak balloon and balanced panels
    await page.click('#dev-console-tab-overview');
    const overviewVisualPolishOk = await page.evaluate(() => {
      const balloons = document.querySelectorAll('#dev-console-sheet .f12-balloon').length;
      const serviceNames = [
        ...document.querySelectorAll('#dev-console-sheet .f12-int-name'),
      ];
      const maxServiceLines = Math.max(
        0,
        ...serviceNames.map((el) => el.getClientRects().length),
      );
      const expressivePanels = [
        ...document.querySelectorAll(
          '#dev-console-sheet .f12-tabs-content:not([hidden]) .f12-panel:not(.f12-panel-quiet)',
        ),
      ];
      const heightDiff =
        expressivePanels.length === 2
          ? Math.abs(
              expressivePanels[0].getBoundingClientRect().height -
                expressivePanels[1].getBoundingClientRect().height,
            )
          : 999;
      return balloons === 1 && maxServiceLines <= 2 && heightDiff <= 120;
    });
    await page.click('#dev-console-overview-goto-logs');
    await page.waitForTimeout(40);
    const overviewShortcutFocusedSearch = await page.evaluate(
      () => document.activeElement?.id === 'dev-console-log-search',
    );

    // 4) Reset sandbox restores form defaults and initial logs
    await page.click('#dev-console-tab-api-keys');
    await page.click('#dev-console-key-hmac');
    await page.click('#dev-console-reset-sandbox');
    const sandboxResetComplete = await page.evaluate(() => {
      const hmacEl = document.getElementById('dev-console-key-hmac');
      const hmacChecked = Boolean(hmacEl && 'checked' in hmacEl && hmacEl.checked);
      const revokeBtnRestored = Boolean(
        document.getElementById('dev-console-revoke-key-key-prod-primary'),
      );
      return hmacChecked && revokeBtnRestored;
    });

    check(
      dialogCenteredAndCutVisible &&
        revokedReplay401 &&
        focusAfterPage3Replay.connected &&
        focusAfterPage3Replay.id.startsWith('dev-console-inspect-log-log-replay-') &&
        fiveXxRows === 2 &&
        drilldownClearedStaleFilter &&
        overviewVisualPolishOk &&
        overviewShortcutFocusedSearch &&
        sandboxResetComplete,
      'site /blocks/developer-console Request Logs, Overview Polish, Dialog Centering & Sandbox Reset: centered modal with visible cut under margin:0 reset, revoked-key 401 replay, page-3 replay focus restoration, cross-tab drilldown focus on search input, single peak balloon, and full sandbox reset',
      JSON.stringify({
        dialogCenteredAndCutVisible,
        revokedReplay401,
        focusAfterPage3Replay,
        fiveXxRows,
        drilldownClearedStaleFilter,
        overviewVisualPolishOk,
        overviewShortcutFocusedSearch,
        sandboxResetComplete,
      }),
    );

    // Verify 320px narrow mobile containment + full-width stacked tabs across all 4 console tabs + forced-colors: active
    await page.setViewportSize({ width: 320, height: 640 });
    const mobileTabsFullWidth = await page.evaluate(() => {
      const list = document.querySelector('#dev-console-sheet .f12-tabs-list');
      const triggers = [
        ...document.querySelectorAll('#dev-console-sheet .f12-tabs-trigger'),
      ];
      if (!list || triggers.length !== 4) return false;
      const listClientW = list.clientWidth;
      return triggers.every((t, idx) => {
        const w = t.getBoundingClientRect().width;
        const st = getComputedStyle(t);
        const borderOk =
          idx === 0 || (parseFloat(st.borderTopWidth) >= 1.5 && parseFloat(st.borderLeftWidth) === 0);
        return Math.abs(w - listClientW) <= 2 && borderOk;
      });
    });
    const tabOverflow320 = {};
    for (const tabId of [
      '#dev-console-tab-overview',
      '#dev-console-tab-services',
      '#dev-console-tab-api-keys',
      '#dev-console-tab-request-logs',
    ]) {
      await page.click(tabId);
      await page.waitForTimeout(60);
      tabOverflow320[tabId] = await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
      );
    }
    await page.emulateMedia({ forcedColors: 'active' });
    const fcConsoleOk = await page.evaluate(() => {
      const quietPanel = document.querySelector('.f12-panel.f12-panel-quiet');
      const kvItem = document.querySelector('.f12-console-kv-item');
      return (
        window.matchMedia('(forced-colors: active)').matches &&
        Boolean(quietPanel && getComputedStyle(quietPanel).borderTopStyle === 'solid') &&
        Boolean(kvItem && getComputedStyle(kvItem).borderTopStyle === 'solid')
      );
    });
    check(
      mobileTabsFullWidth && Object.values(tabOverflow320).every(Boolean) && fcConsoleOk,
      'site /blocks/developer-console (320px mobile & forced-colors): full-width stacked mobile tabs, zero horizontal overflow across all 4 tabs, and high-contrast system borders',
      JSON.stringify({ mobileTabsFullWidth, tabOverflow320, fcConsoleOk }),
    );

    await ctx.close();
  }

  // 5b. Workspace Settings Operational Block (/blocks/workspace-settings) end-to-end interactive verification
  {
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 920 },
      colorScheme: 'light',
      reducedMotion: 'no-preference',
    });
    const page = await ctx.newPage();
    await page.goto(`${baseUrl}/blocks/workspace-settings`, { waitUntil: 'networkidle' });
    await page.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve()));

    // Initial synchronized posture + host motion toggle ('M') does not mark draft dirty
    await page.keyboard.press('m');
    await page.waitForTimeout(40);
    await page.keyboard.press('m');
    await page.waitForTimeout(40);
    const initialPosture = await page.evaluate(() => {
      const bar = document.querySelector('#ws-settings-persistence-bar');
      const saveBtn = document.querySelector('#ws-settings-save-btn');
      const discardBtn = document.querySelector('#ws-settings-discard-btn');
      const seats = document.querySelector('#ws-settings-kpi-seats')?.textContent || '';
      const channels = document.querySelector('#ws-settings-kpi-channels')?.textContent || '';
      const motionTabText = document.querySelector('#ws-settings-tabs-tab-motion')?.textContent || '';
      return {
        dirtyAttr: bar?.getAttribute('data-dirty'),
        saveDisabled: Boolean(saveBtn?.disabled),
        discardDisabled: Boolean(discardBtn?.disabled),
        motionTabHasDot: motionTabText.includes('•'),
        seats,
        channels,
      };
    });
    check(
      initialPosture.dirtyAttr === 'false' &&
        initialPosture.saveDisabled &&
        initialPosture.discardDisabled &&
        !initialPosture.motionTabHasDot &&
        initialPosture.seats.includes('5 / 10 SEATS') &&
        initialPosture.channels.includes('3 ACTIVE'),
      'site /blocks/workspace-settings (Posture & External Motion Sync): initial REV-042 state and host motion toggle remain clean with 5/10 seats, 3 active channels, and Save/Discard disabled',
      JSON.stringify(initialPosture),
    );

    // Dirty state detection + beforeunload navigation guard + Workspace target switch & internal link click modal guard (C-02)
    await page.fill('#ws-settings-profile-name', 'Sora Takahashi-Vance');
    const dirtyState = await page.evaluate(() => {
      const bar = document.querySelector('#ws-settings-persistence-bar');
      const saveBtn = document.querySelector('#ws-settings-save-btn');
      const profileTab = document.querySelector('#ws-settings-tabs-tab-profile')?.textContent || '';
      const ev = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(ev);
      return {
        dirtyAttr: bar?.getAttribute('data-dirty'),
        saveDisabled: Boolean(saveBtn?.disabled),
        profileTabHasDot: profileTab.includes('•'),
        beforeUnloadPrevented: ev.defaultPrevented,
      };
    });
    await page.click('#ws-settings-ws-target-staging-atelier');
    await page.waitForSelector('#ws-settings-nav-guard-dialog[open]');
    await page.click('#ws-settings-nav-guard-stay');
    await page.waitForTimeout(60);
    // Internal showcase link click while dirty must also open C-02 instead of silently dropping draft
    await page.click('a[href="/"]');
    await page.waitForSelector('#ws-settings-nav-guard-dialog[open]');
    await page.click('#ws-settings-nav-guard-stay');
    await page.waitForTimeout(60);
    const stayedValue = await page.inputValue('#ws-settings-profile-name');
    check(
      dirtyState.dirtyAttr === 'true' &&
        !dirtyState.saveDisabled &&
        dirtyState.profileTabHasDot &&
        dirtyState.beforeUnloadPrevented &&
        stayedValue === 'Sora Takahashi-Vance' &&
        page.url().endsWith('/blocks/workspace-settings'),
      'site /blocks/workspace-settings (Unsaved & Navigation Guard): editing field marks section dirty, arms beforeunload, and intercepts both workspace target switches and internal route links with modal C-02',
      JSON.stringify({ dirtyState, stayedValue, url: page.url() }),
    );

    // Cross-tab validation + automatic tab switch + focus transfer to invalid control
    await page.fill('#ws-settings-profile-name', '');
    await page.click('#ws-settings-tabs-tab-notifications');
    await page.click('#ws-settings-save-btn');
    await page.waitForTimeout(80);
    const crossTabValidation = await page.evaluate(() => ({
      activeTabSelected:
        document.querySelector('#ws-settings-tabs-tab-profile')?.getAttribute('aria-selected') ===
        'true',
      validationAlertVisible: Boolean(document.querySelector('#ws-settings-validation-alert')),
      profileNameInvalid:
        document.querySelector('#ws-settings-profile-name')?.getAttribute('aria-invalid') ===
        'true',
      activeElementId: document.activeElement?.id || '',
    }));
    check(
      crossTabValidation.activeTabSelected &&
        crossTabValidation.validationAlertVisible &&
        crossTabValidation.profileNameInvalid &&
        crossTabValidation.activeElementId === 'ws-settings-profile-name',
      'site /blocks/workspace-settings (Cross-Tab Validation): saving with invalid field in another tab switches to that tab, displays summary alert, and focuses the invalid input',
      JSON.stringify(crossTabValidation),
    );

    // Discard changes reverts draft and preserves keyboard focus
    await page.click('#ws-settings-discard-btn');
    await page.waitForTimeout(80);
    const afterDiscard = await page.evaluate(() => ({
      dirtyAttr: document.querySelector('#ws-settings-persistence-bar')?.getAttribute('data-dirty'),
      revertedName: document.querySelector('#ws-settings-profile-name')?.value || '',
      activeElementId: document.activeElement?.id || '',
    }));
    check(
      afterDiscard.dirtyAttr === 'false' &&
        afterDiscard.revertedName === 'Sora Takahashi' &&
        afterDiscard.activeElementId === 'ws-settings-reset-btn',
      'site /blocks/workspace-settings (Discard): Discard changes reverts draft to saved snapshot and transfers focus to #ws-settings-reset-btn',
      JSON.stringify(afterDiscard),
    );

    // Valid edit + conditional & new URL() webhook validation + Save increments revision to REV-043
    await page.click('#ws-settings-tabs-tab-notifications');
    // Port :65536 must be rejected by new URL()
    await page.fill('#ws-settings-notif-webhook-url', 'https://hooks.atelier-koma.io:65536/v2/ops');
    await page.click('#ws-settings-save-btn');
    const invalidPortRejected = await page.evaluate(
      () =>
        document
          .querySelector('#ws-settings-notif-webhook-url')
          ?.getAttribute('aria-invalid') === 'true',
    );
    // Query string ?token=abc must be accepted by new URL()
    await page.fill(
      '#ws-settings-notif-webhook-url',
      'https://hooks.atelier-koma.io/v2/ops?token=abc',
    );
    const queryUrlValid = await page.evaluate(
      () =>
        !document
          .querySelector('#ws-settings-notif-webhook-url')
          ?.hasAttribute('aria-invalid'),
    );
    await page.fill('#ws-settings-notif-webhook-url', '');
    await page.click('#ws-settings-notif-ch-webhook'); // uncheck webhook channel -> empty URL must not block save
    const webhookDisabledWhenUnchecked = await page.evaluate(() =>
      Boolean(document.querySelector('#ws-settings-notif-webhook-url')?.disabled),
    );
    await page.click('#ws-settings-tabs-tab-workspace');
    await page.fill('#ws-settings-ws-name', 'Atelier Koma Global Prod');
    await page.click('#ws-settings-save-btn');
    await page.waitForTimeout(80);
    const afterSave = await page.evaluate(() => ({
      dirtyAttr: document.querySelector('#ws-settings-persistence-bar')?.getAttribute('data-dirty'),
      metricText: document.querySelector('#ws-settings-posture-metric')?.textContent || '',
    }));
    check(
      invalidPortRejected &&
        queryUrlValid &&
        webhookDisabledWhenUnchecked &&
        afterSave.dirtyAttr === 'false' &&
        afterSave.metricText.includes('REV-043'),
      'site /blocks/workspace-settings (Save, new URL() & Conditional Webhook Validation): invalid port :65536 rejected, query string ?token=abc accepted, disabling webhook channel disables URL input and allows saving, incrementing revision to REV-043',
      JSON.stringify({ invalidPortRejected, queryUrlValid, webhookDisabledWhenUnchecked, afterSave }),
    );

    // Appearance & Motion tabs live sheet application (theme, System Default OS resolution, pegs, highContrastRules, animateCharts, read-only reduced motion)
    await page.click('#ws-settings-tabs-tab-appearance');
    await page.click('input[type="radio"][value="dark"]');
    await page.click('#ws-settings-appearance-density-comfortable');
    await page.click('#ws-settings-appearance-reg-marks'); // uncheck registration marks -> hides .f12-pegs
    await page.click('#ws-settings-appearance-hc-rules'); // check high-contrast rules -> 2px border on quiet panels
    const appearanceApplied = await page.evaluate(() => {
      const sheet = document.querySelector('#ws-settings-sheet');
      const specimen = document.querySelector('#ws-settings-appearance-specimen');
      return {
        sheetTheme: sheet?.getAttribute('data-theme'),
        hasPegsWhenOff: Boolean(sheet?.querySelector('.f12-pegs')),
        highContrastAttr: sheet?.getAttribute('data-high-contrast-rules'),
        specimenBorderWidth: specimen ? getComputedStyle(specimen).borderTopWidth : '',
        specimenText: specimen?.textContent || '',
      };
    });
    // Switch back to System Default while forcing host documentElement data-theme="dark": sheet must resolve OS light preference ('light')
    await page.click('input[type="radio"][value="system"]');
    await page.click('#ws-settings-appearance-reg-marks'); // restore pegs
    await page.click('#ws-settings-appearance-hc-rules'); // restore normal quiet rules
    await page.click('#ws-settings-appearance-density-compact');
    const systemOsThemeResolved = await page.evaluate(() => {
      const prev = document.documentElement.getAttribute('data-theme');
      document.documentElement.setAttribute('data-theme', 'dark');
      const sheetTheme = document.querySelector('#ws-settings-sheet')?.getAttribute('data-theme');
      const hasPegsRestored = Boolean(
        document.querySelector('#ws-settings-sheet')?.querySelector('.f12-pegs'),
      );
      if (prev) document.documentElement.setAttribute('data-theme', prev);
      else document.documentElement.removeAttribute('data-theme');
      return { sheetTheme, hasPegsRestored };
    });

    await page.click('#ws-settings-tabs-tab-motion');
    await page.click('input[type="radio"][value="cut"]');
    await page.click('#ws-settings-trigger-pose-btn');
    await page.click('#ws-settings-motion-charts'); // uncheck chart animation
    const motionApplied = await page.evaluate(() => {
      const switchThumb = document.querySelector('#ws-settings-sheet .f12-switch-thumb');
      return {
        hasCutClass: Boolean(
          document.querySelector('#ws-settings-sheet')?.classList.contains('f12-m-cut'),
        ),
        switchThumbTransitionDuration: switchThumb
          ? getComputedStyle(switchThumb).transitionDuration
          : '',
        chartMotionAttr: document
          .querySelector('#ws-settings-motion-specimen')
          ?.getAttribute('data-motion-chart'),
        reducedEnforcementText:
          document.querySelector('#ws-settings-motion-reduced')?.textContent || '',
        poseText: document.querySelector('#ws-settings-motion-specimen')?.textContent || '',
      };
    });
    await page.click('#ws-settings-discard-btn');
    await page.waitForTimeout(60);
    check(
      appearanceApplied.sheetTheme === 'dark' &&
        !appearanceApplied.hasPegsWhenOff &&
        appearanceApplied.highContrastAttr === 'true' &&
        appearanceApplied.specimenBorderWidth === '2px' &&
        appearanceApplied.specimenText.includes('COMFORTABLE') &&
        systemOsThemeResolved.sheetTheme === 'light' &&
        systemOsThemeResolved.hasPegsRestored &&
        motionApplied.hasCutClass &&
        motionApplied.switchThumbTransitionDuration === '0s' &&
        motionApplied.chartMotionAttr === 'cut' &&
        motionApplied.reducedEnforcementText.includes('ALWAYS ENFORCED') &&
        motionApplied.poseText.includes('POSE #02'),
      'site /blocks/workspace-settings (Appearance & Motion): live Sheet theme, OS System Default resolution, registration marks (pegs), high-contrast 2px rules, chart motion toggle, and read-only reduced-motion indicator work end-to-end',
      JSON.stringify({ appearanceApplied, systemOsThemeResolved, motionApplied }),
    );

    // Team & Roles tab: invite validation, 10-seat capacity cap, filter empty recovery, and member removal confirmation (C-03)
    await page.click('#ws-settings-tabs-tab-team');
    await page.fill('#ws-settings-invite-email', 'sora@atelier-koma.io');
    await page.click('#ws-settings-invite-submit');
    const dupInviteInvalid = await page.evaluate(
      () =>
        document.querySelector('#ws-settings-invite-email')?.getAttribute('aria-invalid') ===
        'true',
    );
    await page.fill('#ws-settings-invite-email', 'akira@atelier-koma.io');
    await page.fill('#ws-settings-invite-name', 'Akira Sato');
    await page.click('#ws-settings-invite-submit');
    await page.waitForTimeout(60);
    const seatsAfterInvite = await page.textContent('#ws-settings-kpi-seats');

    // Fill remaining 4 seats (7, 8, 9, 10) and verify 11th invite is rejected by 10-seat cap
    for (let i = 7; i <= 10; i++) {
      await page.fill('#ws-settings-invite-email', `operator${i}@atelier-koma.io`);
      await page.click('#ws-settings-invite-submit');
    }
    const seatsAtCap = await page.textContent('#ws-settings-kpi-seats');
    await page.fill('#ws-settings-invite-email', 'overflow11@atelier-koma.io');
    await page.click('#ws-settings-invite-submit');
    const eleventhInviteRejected = await page.evaluate(() => {
      const inp = document.querySelector('#ws-settings-invite-email');
      const seats = document.querySelector('#ws-settings-kpi-seats')?.textContent || '';
      return inp?.getAttribute('aria-invalid') === 'true' && seats.includes('10 / 10 SEATS');
    });

    await page.fill('#ws-settings-member-search', 'nonexistent-member-xyz');
    await page.waitForSelector('#ws-settings-member-empty');
    await page.click('#ws-settings-clear-member-filters');
    await page.waitForTimeout(80);
    const focusAfterFilterReset = await page.evaluate(() => document.activeElement?.id || '');

    await page.click('#ws-settings-remove-mem-5');
    await page.waitForSelector('#ws-settings-remove-member-dialog[open]');
    await page.click('#ws-settings-remove-member-confirm');
    await page.waitForTimeout(80);
    const afterRemoval = await page.evaluate(() => ({
      seats: document.querySelector('#ws-settings-kpi-seats')?.textContent || '',
      activeElementId: document.activeElement?.id || '',
    }));
    check(
      dupInviteInvalid &&
        (seatsAfterInvite || '').includes('6 / 10 SEATS') &&
        (seatsAtCap || '').includes('10 / 10 SEATS') &&
        eleventhInviteRejected &&
        focusAfterFilterReset === 'ws-settings-member-search' &&
        afterRemoval.seats.includes('9 / 10 SEATS') &&
        afterRemoval.activeElementId === 'ws-settings-member-search',
      'site /blocks/workspace-settings (Team & Roles): duplicate invite validation, new member invite, 10-seat capacity limit enforcement, empty filter recovery, and confirmed member removal (C-03) with focus restoration work end-to-end',
      JSON.stringify({
        dupInviteInvalid,
        seatsAfterInvite,
        seatsAtCap,
        eleventhInviteRejected,
        focusAfterFilterReset,
        afterRemoval,
      }),
    );

    // Danger Zone tab: rotate secret, purge cache (focus transfers to enabled rotate button), and slug-verified archive against saved slug even when draft slug is cleared (C-04)
    await page.click('#ws-settings-tabs-tab-workspace');
    await page.fill('#ws-settings-ws-slug', ''); // clear draft slug to attempt blank-slug archive bypass
    await page.click('#ws-settings-tabs-tab-danger-zone');
    await page.click('#ws-settings-danger-rotate-btn');
    await page.waitForSelector('#ws-settings-danger-dialog[open]');
    await page.click('#ws-settings-danger-dialog-confirm');
    await page.waitForTimeout(80);
    const rotatedSecret = await page.textContent('#ws-settings-signing-secret-val');

    await page.click('#ws-settings-danger-purge-btn');
    await page.waitForSelector('#ws-settings-danger-dialog[open]');
    await page.click('#ws-settings-danger-dialog-confirm');
    await page.waitForTimeout(80);
    const afterPurgeFocusAndDisabled = await page.evaluate(() => ({
      purgeDisabled: Boolean(document.querySelector('#ws-settings-danger-purge-btn')?.disabled),
      activeElementId: document.activeElement?.id || '',
    }));

    await page.click('#ws-settings-danger-archive-btn');
    await page.waitForSelector('#ws-settings-danger-dialog[open]');
    const archiveDialogVisuals = await page.evaluate(() => {
      const dlg = document.querySelector('#ws-settings-danger-dialog');
      const cut = dlg?.querySelector('.f12-cut');
      const inp = document.querySelector('#ws-settings-archive-confirm-input');
      const dlgRect = dlg?.getBoundingClientRect();
      const cutRect = cut?.getBoundingClientRect();
      return {
        cutUnclipped: Boolean(
          dlgRect && cutRect && cutRect.top >= dlgRect.top + 4 && cutRect.left >= dlgRect.left + 4,
        ),
        noSlugPlaceholder: !inp?.getAttribute('placeholder'),
      };
    });
    // Attempt blank submission when draft slug was cleared -> must be rejected!
    await page.fill('#ws-settings-archive-confirm-input', '');
    await page.click('#ws-settings-danger-dialog-confirm');
    const blankSlugRejected = await page.evaluate(
      () =>
        document
          .querySelector('#ws-settings-archive-confirm-input')
          ?.getAttribute('aria-invalid') === 'true',
    );
    await page.fill('#ws-settings-archive-confirm-input', 'wrong-slug');
    await page.click('#ws-settings-danger-dialog-confirm');
    const wrongSlugInvalid = await page.evaluate(
      () =>
        document
          .querySelector('#ws-settings-archive-confirm-input')
          ?.getAttribute('aria-invalid') === 'true',
    );
    await page.fill('#ws-settings-archive-confirm-input', 'atelier-koma-prod');
    await page.click('#ws-settings-danger-dialog-confirm');
    await page.waitForTimeout(80);
    const afterArchiveFocus = await page.evaluate(() => document.activeElement?.id || '');
    check(
      (rotatedSecret || '').includes('77e4') &&
        afterPurgeFocusAndDisabled.purgeDisabled &&
        afterPurgeFocusAndDisabled.activeElementId === 'ws-settings-danger-rotate-btn' &&
        archiveDialogVisuals.cutUnclipped &&
        archiveDialogVisuals.noSlugPlaceholder &&
        blankSlugRejected &&
        wrongSlugInvalid &&
        afterArchiveFocus === 'ws-settings-danger-archive-btn',
      'site /blocks/workspace-settings (Danger Zone): secret rotation, cache purge focus transfer to enabled rotate button, unclipped C-04 badge & empty archive input placeholder, blank-slug archive bypass prevention, and confirmed archive & reset work end-to-end',
      JSON.stringify({
        rotatedSecret,
        afterPurgeFocusAndDisabled,
        archiveDialogVisuals,
        blankSlugRejected,
        wrongSlugInvalid,
        afterArchiveFocus,
      }),
    );

    // Dataset states (ZERO / ERR): inviting in ZERO state goes 0 -> 1 seat and Discard restores saved 5-member roster, ERR retry restores focus, & 320px responsive check
    await page.click('#ws-settings-dataset-empty');
    const emptyCheck = await page.evaluate(() => ({
      seats: document.querySelector('#ws-settings-kpi-seats')?.textContent || '',
      channels: document.querySelector('#ws-settings-kpi-channels')?.textContent || '',
    }));
    await page.click('#ws-settings-tabs-tab-team');
    await page.fill('#ws-settings-invite-email', 'sora@atelier-koma.io');
    await page.click('#ws-settings-invite-submit');
    await page.waitForTimeout(60);
    const seatsAfterZeroInvite = await page.textContent('#ws-settings-kpi-seats');
    await page.click('#ws-settings-discard-btn');
    await page.waitForTimeout(60);
    const seatsAfterZeroInviteDiscard = await page.textContent('#ws-settings-kpi-seats');
    await page.click('#ws-settings-dataset-error');
    await page.waitForSelector('#ws-settings-error-banner');
    await page.click('#ws-settings-retry-sync');
    await page.waitForTimeout(80);
    const focusAfterRetry = await page.evaluate(() => document.activeElement?.id || '');

    // Breadcrumb interactive navigation: clicking workspace link switches to 02 · Workspace and focuses #ws-settings-ws-name; clicking control-plane link switches to 01 · Profile
    await page.click('#ws-settings-sheet a[href="#ws-settings-ws-name"]');
    await page.waitForTimeout(60);
    const afterWsBreadcrumb = await page.evaluate(() => ({
      wsTabSelected:
        document.querySelector('#ws-settings-tabs-tab-workspace')?.getAttribute('aria-selected') ===
        'true',
      activeElementId: document.activeElement?.id || '',
    }));
    await page.click('#ws-settings-sheet a[href="#ws-settings-sheet"]');
    await page.waitForTimeout(60);
    const afterRootBreadcrumb = await page.evaluate(() => ({
      profileTabSelected:
        document.querySelector('#ws-settings-tabs-tab-profile')?.getAttribute('aria-selected') ===
        'true',
      activeElementId: document.activeElement?.id || '',
    }));

    await page.setViewportSize({ width: 320, height: 800 });
    await page.waitForTimeout(80);
    const overflow320 = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    );
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const headerReducedMotionOk = await page.evaluate(() => {
      const headerInds = [...document.querySelectorAll('.site-header .f12-rng-ind')];
      return (
        headerInds.length >= 2 &&
        headerInds.every((el) => getComputedStyle(el).transitionDuration === '0s')
      );
    });
    check(
      emptyCheck.seats.includes('0 / 10 SEATS') &&
        emptyCheck.channels.includes('0 ACTIVE') &&
        (seatsAfterZeroInvite || '').includes('1 / 10 SEATS') &&
        (seatsAfterZeroInviteDiscard || '').includes('5 / 10 SEATS') &&
        focusAfterRetry === 'ws-settings-reset-btn' &&
        afterWsBreadcrumb.wsTabSelected &&
        afterWsBreadcrumb.activeElementId === 'ws-settings-ws-name' &&
        afterRootBreadcrumb.profileTabSelected &&
        afterRootBreadcrumb.activeElementId === 'ws-settings-tabs-tab-profile' &&
        overflow320 &&
        headerReducedMotionOk,
      'site /blocks/workspace-settings (Empty/Error states, Breadcrumb navigation, 320px & site header reduced-motion): ZERO state reconciles seats/channels to 0, inviting in ZERO transitions to 1/10 seats, Discard restores saved 5/10 seats, ERR retry restores focus, Breadcrumb links switch sections with focus transfer, site header SegmentedControls respect prefers-reduced-motion, and 320px has zero horizontal overflow',
      JSON.stringify({
        emptyCheck,
        seatsAfterZeroInvite,
        seatsAfterZeroInviteDiscard,
        focusAfterRetry,
        afterWsBreadcrumb,
        afterRootBreadcrumb,
        overflow320,
        headerReducedMotionOk,
      }),
    );

    await ctx.close();
  }

  // 5c. Revenue Recovery Analytics Block (/blocks/analytics-dashboard) end-to-end interactive verification
  {
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 920 },
      colorScheme: 'light',
      reducedMotion: 'no-preference',
    });
    const page = await ctx.newPage();
    await page.goto(`${baseUrl}/blocks/analytics-dashboard`, { waitUntil: 'networkidle' });
    await page.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve()));

    // 1) Mathematical reconciliation across 30d, 7d, and 90d windows (C-01, C-02, C-04, Period Comparison, Segment Breakdown, and Daily Ledger)
    const reconcileWindow = async (rangeBtnId) => {
      await page.click(rangeBtnId);
      await page.waitForTimeout(300); // allow stepped countUp to settle
      return page.evaluate(() => {
        const parseMoney = (s) => Number((s || '').replace(/[^0-9.-]/g, ''));
        const c01Rev = parseMoney(
          document.querySelector('#analytics-sheet .c01 .f12-m-value .f12-sr-only')?.textContent,
        );
        const c02Prof = parseMoney(
          document.querySelectorAll('#analytics-sheet .f12-pair .f12-m-value .f12-sr-only')[0]
            ?.textContent,
        );
        const barSum = [
          ...document.querySelectorAll('#analytics-sheet .c04 .f12-int-val'),
        ].reduce((acc, el) => acc + parseMoney(el.childNodes[0]?.textContent), 0);
        const periodRev = parseMoney(
          document.querySelector('#analytics-period-cur-revenue')?.textContent,
        );
        const periodProf = parseMoney(
          document.querySelector('#analytics-period-cur-profit')?.textContent,
        );
        const segRev = parseMoney(
          document.querySelector('#analytics-segment-total-revenue')?.textContent,
        );
        const segProf = parseMoney(
          document.querySelector('#analytics-segment-total-profit')?.textContent,
        );
        const ledgerRev = parseMoney(
          document.querySelector('#analytics-ledger-total-revenue')?.textContent,
        );
        const ledgerProf = parseMoney(
          document.querySelector('#analytics-ledger-total-profit')?.textContent,
        );
        return {
          ok:
            c01Rev > 0 &&
            c02Prof > 0 &&
            c01Rev === barSum &&
            c01Rev === periodRev &&
            c01Rev === segRev &&
            c01Rev === ledgerRev &&
            c02Prof === periodProf &&
            c02Prof === segProf &&
            c02Prof === ledgerProf,
          c01Rev,
          barSum,
          periodRev,
          segRev,
          ledgerRev,
          c02Prof,
          periodProf,
          segProf,
          ledgerProf,
        };
      });
    };

    const rec30 = await reconcileWindow('#analytics-rng-30');
    const rec7 = await reconcileWindow('#analytics-rng-7');
    const rec90 = await reconcileWindow('#analytics-rng-90');
    await page.click('#analytics-rng-30');
    await page.waitForTimeout(300);
    check(
      rec30.ok && rec7.ok && rec90.ok,
      'site /blocks/analytics-dashboard (Window Switching & 100% Reconciliation): C-01 revenue, C-02 profit, C-04 intervention sum, Period Comparison, Checkout Segment Breakdown, and Daily Recovery Ledger reconcile to the exact dollar across 7d, 30d, and 90d',
      JSON.stringify({ rec30, rec7, rec90 }),
    );

    // 2) Period comparison overlay ('PREV') and C-04 intervention click-to-overlay + scoped table reconciliation
    await page.click('#analytics-toggle-prev-overlay');
    const prevOverlayActive = await page.evaluate(() => {
      const hasFocusLine = Boolean(document.querySelector('#analytics-sheet .f12-l-focus'));
      const legendText = document.querySelector('#analytics-sheet .f12-legend')?.textContent || '';
      return hasFocusLine && legendText.includes('Prior 30d window');
    });

    await page.click('#int-analytics-exit');
    await page.waitForTimeout(80);
    const exitScopeReconciled = await page.evaluate(() => {
      const parseMoney = (s) => Number((s || '').replace(/[^0-9.-]/g, ''));
      const exitBarVal = parseMoney(
        document.querySelector('#int-analytics-exit .f12-int-val')?.childNodes[0]?.textContent,
      );
      const periodRev = parseMoney(
        document.querySelector('#analytics-period-cur-revenue')?.textContent,
      );
      const segRev = parseMoney(
        document.querySelector('#analytics-segment-total-revenue')?.textContent,
      );
      const ledgerRev = parseMoney(
        document.querySelector('#analytics-ledger-total-revenue')?.textContent,
      );
      const periodProf = parseMoney(
        document.querySelector('#analytics-period-cur-profit')?.textContent,
      );
      const segProf = parseMoney(
        document.querySelector('#analytics-segment-total-profit')?.textContent,
      );
      const ledgerProf = parseMoney(
        document.querySelector('#analytics-ledger-total-profit')?.textContent,
      );
      const legendText = document.querySelector('#analytics-sheet .f12-legend')?.textContent || '';
      return {
        ok:
          exitBarVal > 0 &&
          exitBarVal === periodRev &&
          exitBarVal === segRev &&
          exitBarVal === ledgerRev &&
          periodProf > 0 &&
          periodProf === segProf &&
          periodProf === ledgerProf &&
          legendText.includes('Exit-intent offer'),
        exitBarVal,
        periodRev,
        segRev,
        ledgerRev,
        periodProf,
        segProf,
        ledgerProf,
      };
    });

    // Click First-Time Mobile segment filter while Exit-intent is focused -> ledger total matches segment row
    await page.click('#analytics-seg-filter-first-time-mobile');
    await page.waitForTimeout(60);
    const segmentFilterReconciled = await page.evaluate(() => {
      const parseMoney = (s) => Number((s || '').replace(/[^0-9.-]/g, ''));
      const segRows = [...document.querySelectorAll('#analytics-segment-table tbody tr')];
      const mobileRow = segRows[1];
      const mobileRowRev = parseMoney(mobileRow?.querySelectorAll('td')[1]?.textContent);
      const mobileRowProf = parseMoney(mobileRow?.querySelectorAll('td')[2]?.textContent);
      const ledgerRev = parseMoney(
        document.querySelector('#analytics-ledger-total-revenue')?.textContent,
      );
      const ledgerProf = parseMoney(
        document.querySelector('#analytics-ledger-total-profit')?.textContent,
      );
      return {
        ok: mobileRowRev > 0 && mobileRowRev === ledgerRev && mobileRowProf === ledgerProf,
        mobileRowRev,
        ledgerRev,
        mobileRowProf,
        ledgerProf,
      };
    });
    await page.click('#analytics-clear-ledger-filters');
    await page.waitForTimeout(60);
    check(
      prevOverlayActive && exitScopeReconciled.ok && segmentFilterReconciled.ok,
      'site /blocks/analytics-dashboard (Period Overlay, Intervention Focus & Segment Scope): PREV overlays prior 30d window, C-04 click scopes Period/Segment/Ledger tables to exact intervention totals, and segment filter reconciles ledger totals with segment row',
      JSON.stringify({ prevOverlayActive, exitScopeReconciled, segmentFilterReconciled }),
    );

    // 3) Daily ledger search, empty filter recovery, pagination, and C-05 Daily Attribution Dialog + focus restoration
    await page.fill('#analytics-ledger-search', 'no-matching-day-query-999');
    await page.waitForSelector('#analytics-ledger-empty');
    await page.click('#analytics-ledger-reset-empty');
    await page.waitForTimeout(80);
    const focusAfterEmptyReset = await page.evaluate(() => document.activeElement?.id || '');

    await page.click('#analytics-inspect-day-2026-10-31');
    await page.waitForSelector('#analytics-day-dialog[open]');
    const dayDialogCheck = await page.evaluate(() => {
      const parseMoney = (s) => Number((s || '').replace(/[^0-9.-]/g, ''));
      const dlg = document.querySelector('#analytics-day-dialog');
      const cut = dlg?.querySelector('.f12-cut');
      const dlgRect = dlg?.getBoundingClientRect();
      const cutRect = cut?.getBoundingClientRect();
      const cutUnclipped = Boolean(
        dlgRect && cutRect && cutRect.top >= dlgRect.top + 4 && cutRect.left >= dlgRect.left + 4,
      );
      const rowRevs = [
        ...document.querySelectorAll('#analytics-day-dialog-table tbody tr'),
      ].map((tr) => parseMoney(tr.querySelectorAll('td')[2]?.textContent));
      const rowProfs = [
        ...document.querySelectorAll('#analytics-day-dialog-table tbody tr'),
      ].map((tr) => parseMoney(tr.querySelectorAll('td')[3]?.textContent));
      const totalRev = parseMoney(
        document.querySelector('#analytics-day-dialog-total-rev')?.textContent,
      );
      const totalProf = parseMoney(
        document.querySelector('#analytics-day-dialog-total-profit')?.textContent,
      );
      const sumRev = rowRevs.reduce((a, b) => a + b, 0);
      const sumProf = rowProfs.reduce((a, b) => a + b, 0);
      const segRevs = [
        ...document.querySelectorAll('#analytics-day-dialog-segment-table tbody tr'),
      ].map((tr) => parseMoney(tr.querySelectorAll('td')[1]?.textContent));
      const segProfs = [
        ...document.querySelectorAll('#analytics-day-dialog-segment-table tbody tr'),
      ].map((tr) => parseMoney(tr.querySelectorAll('td')[2]?.textContent));
      const sumSegRev = segRevs.reduce((a, b) => a + b, 0);
      const sumSegProf = segProfs.reduce((a, b) => a + b, 0);
      return {
        cutUnclipped,
        reconciled:
          totalRev > 0 &&
          sumRev === totalRev &&
          sumProf === totalProf &&
          sumSegRev === totalRev &&
          sumSegProf === totalProf,
        totalRev,
        sumRev,
        sumSegRev,
        totalProf,
        sumProf,
        sumSegProf,
      };
    });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(80);
    const focusAfterDialogEscape = await page.evaluate(() => document.activeElement?.id || '');

    await page.click('#analytics-inspect-day-2026-10-31');
    await page.waitForSelector('#analytics-day-dialog[open]');
    await page.click('#analytics-day-dialog-filter-top');
    await page.waitForTimeout(80);
    const focusAfterDialogFilterTop = await page.evaluate(() => document.activeElement?.id || '');
    await page.click('#analytics-reset-btn');
    await page.waitForTimeout(80);
    check(
      focusAfterEmptyReset === 'analytics-ledger-search' &&
        dayDialogCheck.cutUnclipped &&
        dayDialogCheck.reconciled &&
        focusAfterDialogEscape === 'analytics-inspect-day-2026-10-31' &&
        focusAfterDialogFilterTop === 'analytics-ledger-search',
      'site /blocks/analytics-dashboard (Ledger Filter Recovery & C-05 Daily Attribution Dialog): empty search reset restores focus, C-05 dialog cut is unclipped and reconciles daily rows, Escape restores focus to trigger button, and Filter by top intervention scopes view and focuses search',
      JSON.stringify({
        focusAfterEmptyReset,
        dayDialogCheck,
        focusAfterDialogEscape,
        focusAfterDialogFilterTop,
      }),
    );

    // 4) Dataset states (LOAD, ZERO, ERR) + 320px responsive check + forced-colors
    await page.click('#analytics-dataset-loading');
    const hasLoadingSkeletons = await page.evaluate(
      () =>
        Boolean(document.querySelector('#analytics-c01-skeleton')) &&
        Boolean(document.querySelector('#analytics-ledger-skeleton')),
    );
    await page.click('#analytics-dataset-empty');
    await page.waitForTimeout(250);
    const zeroStateReconciled = await page.evaluate(() => ({
      chartEmpty: Boolean(document.querySelector('#analytics-chart-empty')),
      interventionsEmpty: Boolean(document.querySelector('#analytics-interventions-empty')),
      ledgerEmpty: Boolean(document.querySelector('#analytics-ledger-empty')),
      periodRev: document.querySelector('#analytics-period-cur-revenue')?.textContent || '',
      segRev: document.querySelector('#analytics-segment-total-revenue')?.textContent || '',
    }));
    await page.click('#analytics-dataset-error');
    await page.waitForSelector('#analytics-error-banner');
    await page.click('#analytics-retry-btn');
    await page.waitForTimeout(80);
    const focusAfterAnalyticsRetry = await page.evaluate(() => document.activeElement?.id || '');

    await page.setViewportSize({ width: 320, height: 800 });
    await page.waitForTimeout(80);
    const analyticsOverflow320 = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    );
    await page.emulateMedia({ forcedColors: 'active' });
    const analyticsForcedColorsOk = await page.evaluate(() => {
      const quietPanel = document.querySelector('#analytics-period-comparison-panel');
      return (
        window.matchMedia('(forced-colors: active)').matches &&
        Boolean(quietPanel && getComputedStyle(quietPanel).borderTopStyle === 'solid')
      );
    });
    check(
      hasLoadingSkeletons &&
        zeroStateReconciled.chartEmpty &&
        zeroStateReconciled.interventionsEmpty &&
        zeroStateReconciled.ledgerEmpty &&
        zeroStateReconciled.periodRev === '$0' &&
        zeroStateReconciled.segRev === '$0' &&
        focusAfterAnalyticsRetry === 'analytics-rng-30' &&
        analyticsOverflow320 &&
        analyticsForcedColorsOk,
      'site /blocks/analytics-dashboard (LOAD/ZERO/ERR states, 320px & forced-colors): skeletons in LOAD, reconciled $0 + EmptyStates in ZERO, 503 banner + retry focus restoration in ERR, zero overflow at 320px, and forced-colors borders',
      JSON.stringify({
        hasLoadingSkeletons,
        zeroStateReconciled,
        focusAfterAnalyticsRetry,
        analyticsOverflow320,
        analyticsForcedColorsOk,
      }),
    );

    await ctx.close();
  }

  await browser.close();

  // 6. Cross-Browser Site Matrix (Chromium, Firefox, WebKit) across 1280px, 768px, and 390px + Visual Defect Geometry Checks
  for (const [engineName, engine] of [
    ['chromium', chromium],
    ['firefox', firefox],
    ['webkit', webkit],
  ]) {
    const xb = await engine.launch(
      engineName === 'chromium'
        ? { executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] }
        : {},
    );
    try {
      for (const scheme of ['light', 'dark']) {
        const ctx = await xb.newContext({
          viewport: { width: 1280, height: 920 },
          colorScheme: scheme,
          reducedMotion: 'no-preference',
        });

        const openTrackedPage = async () => {
          const p = await ctx.newPage();
          const errs = [];
          p.on('pageerror', (e) => {
            if (e.message.includes('?_rsc=')) return;
            errs.push(`pageerror: ${e.message}`);
          });
          p.on('console', (m) => {
            if (m.type() === 'error') {
              const text = m.text();
              if (text.includes('Failed to fetch RSC payload') || text.includes('?_rsc=')) return;
              errs.push(`console: ${text}`);
            }
          });
          return { page: p, errors: errs };
        };

        // 6a. Home (/) — Conversion lift metric descender clearance (#1), panel count/order & layout
        {
          const { page, errors } = await openTrackedPage();
          await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
          await page.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve()));
          const homeGeom = await page.evaluate(() => {
            const panels = [...document.querySelectorAll('.f12-panel')];
            const cutEls = [...document.querySelectorAll('.f12-panel > .f12-cut')].filter(
              (e) => getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0,
            );
            const rects = cutEls.map((e) => {
              const r = e.getBoundingClientRect();
              return { top: Math.round(r.top), left: Math.round(r.left) };
            });
            let readingOrder = rects.length === 8;
            for (let i = 1; i < rects.length; i++) {
              const prev = rects[i - 1];
              const cur = rects[i];
              const sameRow = Math.abs(cur.top - prev.top) < 40;
              if (sameRow && cur.left < prev.left) readingOrder = false;
              if (!sameRow && cur.top < prev.top - 40) readingOrder = false;
            }
            const liftPanel = panels.find((p) =>
              (p.getAttribute('aria-label') || '').includes('Conversion lift'),
            );
            const mVal = liftPanel?.querySelector('.f12-m-value')?.getBoundingClientRect();
            const delta = liftPanel?.querySelector('.f12-delta')?.getBoundingClientRect();
            const clearancePx =
              mVal && delta ? Number((delta.top - mVal.bottom).toFixed(2)) : -999;
            return {
              panelCount: panels.length,
              visibleCutCount: cutEls.length,
              readingOrder,
              clearancePx,
              noOverlap: clearancePx >= 10,
              noOverflow:
                document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
            };
          });
          check(
            homeGeom.noOverlap &&
              homeGeom.panelCount === 8 &&
              homeGeom.visibleCutCount === 8 &&
              homeGeom.readingOrder &&
              homeGeom.noOverflow &&
              errors.length === 0,
            `site [${engineName} 1280px ${scheme}] /: 8 ordered panels, Conversion lift descender clearance (${homeGeom.clearancePx}px >= 10px) & zero overflow`,
            errors.join('; '),
          );
          await page.close();
        }

        // 6b. Style Sheet (/style-sheet) — .sw-chip contrast boundaries (#3) & token-pill nowrap (#2)
        {
          const { page, errors } = await openTrackedPage();
          await page.goto(`${baseUrl}/style-sheet`, { waitUntil: 'networkidle' });
          await page.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve()));
          const styleSheetGeom = await page.evaluate(() => {
            const chips = [...document.querySelectorAll('.sw-chip')];
            const allChipsHaveDualRing =
              chips.length >= 14 &&
              chips.every((ch) => {
                const st = getComputedStyle(ch);
                return (
                  st.borderTopWidth === '2px' &&
                  st.boxShadow.includes('inset') &&
                  st.boxShadow.split('rgb').length >= 3
                );
              });
            const tokenPills = [...document.querySelectorAll('code.f12-code-inline.f12-nowrap')];
            const allPillsSingleLine =
              tokenPills.length >= 7 &&
              tokenPills.every(
                (el) =>
                  getComputedStyle(el).whiteSpace === 'nowrap' && el.getClientRects().length === 1,
              );
            return {
              chipCount: chips.length,
              allChipsHaveDualRing,
              allPillsSingleLine,
              noOverflow:
                document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
            };
          });
          check(
            styleSheetGeom.allChipsHaveDualRing &&
              styleSheetGeom.allPillsSingleLine &&
              styleSheetGeom.noOverflow &&
              errors.length === 0,
            `site [${engineName} 1280px ${scheme}] /style-sheet: all ${styleSheetGeom.chipCount} .sw-chip swatches have inset+outer contrast rings & token pills stay single-line`,
            `${JSON.stringify(styleSheetGeom)} errors=${errors.join('; ')}`,
          );
          await page.close();
        }

        // 6c. Components (/components) — registry column widths (#4), 768px & 390px responsiveness, Dialog focus return
        {
          const { page, errors } = await openTrackedPage();
          await page.goto(`${baseUrl}/components`, { waitUntil: 'networkidle' });
          await page.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve()));
          const compGeom = await page.evaluate(() => {
            const cells = [...document.querySelectorAll('.f12-comp-cell code.f12-nowrap')];
            const allSingleLine =
              cells.length >= 31 &&
              cells.every(
                (c) =>
                  getComputedStyle(c).whiteSpace === 'nowrap' && c.getClientRects().length === 1,
              );
            return {
              cellCount: cells.length,
              allSingleLine,
              noOverflow:
                document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
            };
          });
          check(
            compGeom.allSingleLine && compGeom.noOverflow && errors.length === 0,
            `site [${engineName} 1280px ${scheme}] /components: all ${compGeom.cellCount} registry JSON paths render single-line with zero overflow`,
            errors.join('; '),
          );

          if (scheme === 'light') {
            // Test 768px container-query transition & 390px mobile on /components and /blocks/developer-console
            await page.setViewportSize({ width: 768, height: 900 });
            await page.waitForTimeout(100);
            const ok768 = await page.evaluate(
              () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
            );
            await page.setViewportSize({ width: 390, height: 844 });
            await page.waitForTimeout(100);
            const ok390 = await page.evaluate(
              () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
            );
            await page.goto(`${baseUrl}/blocks/developer-console`, { waitUntil: 'networkidle' });
            const okConsole390 = await page.evaluate(
              () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
            );
            await page.goto(`${baseUrl}/blocks/workspace-settings`, { waitUntil: 'networkidle' });
            const okSettings390 = await page.evaluate(
              () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
            );
            await page.goto(`${baseUrl}/blocks/analytics-dashboard`, { waitUntil: 'networkidle' });
            const okAnalytics390 = await page.evaluate(
              () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
            );
            check(
              ok768 && ok390 && okConsole390 && okSettings390 && okAnalytics390 && errors.length === 0,
              `site [${engineName} 768px & 390px] /components, /blocks/developer-console, /blocks/workspace-settings & /blocks/analytics-dashboard: zero horizontal overflow across container-query & mobile viewports`,
              errors.join('; '),
            );
          }
          await page.close();
        }

        await ctx.close();
      }
    } finally {
      await xb.close();
    }
  }
} finally {
  serverProc.kill('SIGTERM');
}

console.log(failures ? `\n${failures} site check(s) failed` : '\nAll site checks passed');
process.exitCode = failures ? 1 : 0;
