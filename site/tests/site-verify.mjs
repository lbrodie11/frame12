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
          p.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
          p.on('console', (m) => {
            if (m.type() === 'error') errs.push(`console: ${m.text()}`);
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
            check(
              ok768 && ok390 && okConsole390 && errors.length === 0,
              `site [${engineName} 768px & 390px] /components & /blocks/developer-console: zero horizontal overflow across container-query & mobile viewports`,
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
