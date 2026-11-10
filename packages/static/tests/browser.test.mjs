// Browser checks for @frame12/static (Playwright):
//   1. Cut grammar: computed ::before content (C-01…) for static and React output.
//   2. Geometry: static exact-mode polygons equal React's measured polygons for every shape.
//   3. Accessibility: axe-core (WCAG 2.1 A/AA) with zero violations on the demo and fixtures,
//      heading levels, SVGs hidden or labeled, list semantics, no focusable element without a function.
//   4. Visual parity: the demo report and an edge-case report rendered by React and by
//      @frame12/static at 360/768/1440 px, light and dark. Targeted geometry assertions (panel
//      boxes, polygon points, slant rise, cut positions, gutters, per-component element counts)
//      plus a reported (not gated) full-page diff ratio.
//   5. Strict CSP: document({ inlineCss: false }) served with a real Content-Security-Policy header
//      and the two stylesheets linked, under a fully strict policy and the recommended one.
//
// Engines: run directly, BROWSERS defaults to chromium. Through tests/run.mjs (npm test), BROWSERS
// defaults to chromium,firefox,webkit, like registry/tests/cross-browser.mjs.
import AxeBuilder from '@axe-core/playwright';
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { chromium, firefox, webkit } from 'playwright';
import { PKG_ROOT, REPO_ROOT, S, check, finish } from './lib.mjs';
import { loadReactKit } from './react-harness.mjs';
import { getRenderedCuts } from '../../../registry/tests/lib.mjs';

const RUN = path.join(PKG_ROOT, '.f12-run');
const OUT = path.join(PKG_ROOT, 'test-results');
fs.mkdirSync(RUN, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });
const ENGINES = { chromium, firefox, webkit };
const BROWSERS = (process.env.BROWSERS || 'chromium').split(',').map((b) => b.trim()).filter(Boolean);
const WIDTHS = [360, 768, 1440];
const SCHEMES = ['light', 'dark'];

// ------------------------------------------------------------------------------ fixtures
const alias = {
  name: 'frame12-site-alias',
  setup(b) {
    b.onResolve({ filter: /^@\/components\/frame12$/ }, () => ({ path: path.join(REPO_ROOT, 'registry/ui/index.ts') }));
    b.onResolve({ filter: /^@\/hooks\/(.*)$/ }, (a) => ({ path: path.join(REPO_ROOT, 'registry/hooks', `${a.path.slice(8)}.ts`) }));
    b.onResolve({ filter: /^@\/lib\/pr-report$/ }, () => ({ path: path.join(REPO_ROOT, 'site/src/lib/pr-report.ts') }));
    b.onResolve({ filter: /^@\/components\/pr-report-react$/ }, () => ({ path: path.join(REPO_ROOT, 'site/src/components/pr-report-react.tsx') }));
  },
};

// Node: the site's static report renderer (shares this package's dist through @frame12/static).
await build({
  entryPoints: [path.join(REPO_ROOT, 'site/src/lib/pr-report.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: path.join(RUN, 'pr-report.mjs'),
  external: ['@frame12/static'],
  logLevel: 'silent',
});
const report = await import(pathToFileURL(path.join(RUN, 'pr-report.mjs')).href);

// Browser: React 19 client bundle with the site's React report and a Panel mount helper.
fs.writeFileSync(
  path.join(RUN, 'react-client-entry.tsx'),
  `import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Panel } from '@/components/frame12';
import { PrReportReact } from '@/components/pr-report-react';
import { PR_REPORT, PR_REPORT_EDGE } from '@/lib/pr-report';
(window as any).f12 = {
  report(el: HTMLElement, which: 'demo' | 'edge') {
    flushSync(() => createRoot(el).render(<PrReportReact data={which === 'edge' ? PR_REPORT_EDGE : PR_REPORT} />));
  },
  panel(el: HTMLElement, shape: 'rect' | 'slant-bottom' | 'slant-top') {
    flushSync(() => createRoot(el).render(<Panel shape={shape} cut={false}>x</Panel>));
  },
};
`,
);
await build({
  entryPoints: [path.join(RUN, 'react-client-entry.tsx')],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  jsx: 'automatic',
  outfile: path.join(RUN, 'react-client.js'),
  define: { 'process.env.NODE_ENV': '"production"' },
  // One React: registry/ pins React 18.3 for its own tests; the site (and this page) run the root's React 19.
  alias: { react: path.join(REPO_ROOT, 'node_modules/react'), 'react-dom': path.join(REPO_ROOT, 'node_modules/react-dom') },
  plugins: [alias],
  logLevel: 'silent',
});
const reactClient = fs.readFileSync(path.join(RUN, 'react-client.js'), 'utf8');
const canonicalCss = fs.readFileSync(path.join(REPO_ROOT, 'registry/styles/frame12.css'), 'utf8');
// The React page gets the canonical stylesheet plus the same zero-specificity document base
// static.css carries, so the two pages differ only in renderer.
const docBase = ':where(html){background:var(--f-desk);color:var(--f-ink)}:where(body){margin:0;font-family:var(--font-f-body)}';

const h1 = (t) => S.fragment(S.unsafeRaw('<h1 class="f12-sr-only">'), t, S.unsafeRaw('</h1>'));
function writePage(name, html) {
  const file = path.join(RUN, name);
  fs.writeFileSync(file, String(html));
  return pathToFileURL(file).href;
}
const pages = {};
for (const which of ['demo', 'edge']) {
  const data = which === 'edge' ? report.PR_REPORT_EDGE : report.PR_REPORT;
  pages[`static-${which}`] = writePage(`static-${which}.html`, S.document({ title: data.title, body: S.fragment(h1(data.title), report.renderStaticPrReport(data)) }));
  pages[`react-${which}`] = writePage(
    `react-${which}.html`,
    `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${S.escapeHtml(data.title)}</title><style>${canonicalCss}</style><style>${docBase}</style></head><body><h1 class="f12-sr-only">${S.escapeHtml(data.title)}</h1><div id="root"></div><script>${reactClient}</script><script>f12.report(document.getElementById('root'), '${which}')</script></body></html>\n`,
  );
}

// A fixtures page with every renderer, empty states and hostile text.
const fixtures = S.document({
  title: 'Fixtures',
  lang: 'en',
  body: S.sheet({
    autoCut: true,
    children: S.fragment(
      h1('Fixtures'),
      S.scene({
        layout: 'three',
        children: S.fragment(
          S.panel({ label: 'Tags', children: S.fragment(S.tag({ children: 'plain' }), ' ', S.tag({ variant: 'stamp', status: 'danger', children: 'Void' }), ' ', ...['neutral', 'info', 'success', 'warning'].map((status) => S.tag({ status, children: status }))) }),
          S.panel({ shape: 'slant-bottom', label: 'Badges', children: S.fragment(S.badge({ children: 'new' }), ' ', S.badge({ status: 'warning', children: 'drift' })) }),
          S.panel({ shape: 'slant-top', label: 'Balloon', children: S.balloon({ tailOffset: -20, children: '<script>alert("not markup")</script>' }) }),
        ),
      }),
      S.panelPair({ variant: 'quiet', topLabel: 'Quiet pair', top: { children: S.metric({ label: 'Empty', value: 0, variant: 'quiet' }) }, bottom: { children: S.metric({ label: 'Huge', value: 1e15, big: true, delta: 1.5, range: 90 }) } }),
      S.panel({ cut: false, label: 'Empty states', children: S.fragment(S.toneBarList({ title: 'No hotspots', items: [] }), S.receiptList({ items: [] })) }),
      S.panel({ label: 'RTL', children: S.ghostWire({ from: 'שלום.ts', to: 'עולם.ts', orientation: 'horizontal' }) }),
    ),
  }),
});
pages.fixtures = writePage('fixtures.html', fixtures);

// Strict-CSP page: the demo report plus a balloon and tone bars, with no inline <style>.
const cspPage = S.document({
  title: 'CSP',
  inlineCss: false,
  body: S.fragment(
    h1('CSP'),
    report.renderStaticPrReport(report.PR_REPORT),
    S.sheet({ autoCut: true, children: S.panel({ children: S.fragment(S.balloon({ children: 'Centred tail' }), S.toneBarList({ items: [{ id: 'a', name: 'A', value: 100 }, { id: 'b', name: 'B', value: 10 }] })) }) }),
  ),
});

// React SSR markup for the in-browser cut check (CSS counters number it the same way).
const R = await loadReactKit();
const e = React.createElement;
const reactCuts = renderToStaticMarkup(
  e(R.Sheet, { autoCut: true }, e(R.Panel, null, 'a'), e(R.Panel, { cut: false }, 'b'), e(R.PanelPair, { top: {}, bottom: {} }), e(R.Panel, { variant: 'quiet' }, 'q'), e(R.Panel, null, 'c')),
);
const staticCuts = S.sheet({ autoCut: true, children: S.fragment(S.panel({ children: 'a' }), S.panel({ cut: false, children: 'b' }), S.panelPair({ top: {}, bottom: {} }), S.panel({ variant: 'quiet', children: 'q' }), S.panel({ children: 'c' })) });
pages.cutsStatic = writePage('cuts-static.html', S.document({ title: 'Cuts', body: staticCuts }));
pages.cutsReact = writePage('cuts-react.html', `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Cuts</title><style>${canonicalCss}</style></head><body>${reactCuts}</body></html>`);
pages.geometry = writePage('geometry.html', `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Geometry</title><style>${canonicalCss}</style><style>.box{display:flex;width:320px;height:200px;margin:20px}.box>*{flex:1}</style></head><body><div class="box" id="rect"></div><div class="box" id="slant-bottom"></div><div class="box" id="slant-top"></div><script>${reactClient}</script></body></html>`);

// ------------------------------------------------------------------------------- helpers
function launch(name) {
  if (name === 'chromium') return chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] });
  return ENGINES[name].launch();
}

async function open(browser, url, { width = 1280, scheme = 'light', wait = '.f12-sheet' } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce', deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  const requests = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('request', (r) => {
    if (!r.url().startsWith('file:') && !r.url().startsWith('data:')) requests.push(r.url());
  });
  await page.goto(url);
  await page.waitForSelector(wait);
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForTimeout(150);
  return { ctx, page, errors, requests };
}

/** Geometry of every panel, cut, scene and polygon on the page, in CSS px. */
function collectGeometry() {
  const r = (el) => {
    const b = el.getBoundingClientRect();
    return { x: b.x + scrollX, y: b.y + scrollY, w: b.width, h: b.height };
  };
  const panels = [...document.querySelectorAll('section.f12-panel')].map((el) => {
    const svg = el.querySelector(':scope > svg.f12-panel-frame');
    let pts = null;
    if (svg) {
      const sb = svg.getBoundingClientRect();
      const vb = svg.getAttribute('viewBox');
      const raw = svg.querySelector('polygon').getAttribute('points').trim().split(/\s+/).map((p) => p.split(',').map(Number));
      pts = vb ? raw.map(([x, y]) => [(x / 100) * sb.width, (y / 100) * sb.height]) : raw;
    }
    return { box: r(el), shape: ([...el.classList].find((c) => /^f12-(rect|slant-bottom|slant-top)$/.test(c)) || '').slice(4), ssr: !!svg?.getAttribute('viewBox'), pts };
  });
  const cuts = [...document.querySelectorAll('.f12-cut')].filter((c) => getComputedStyle(c).display !== 'none').map((c) => ({ box: r(c), text: (c.textContent || getComputedStyle(c, '::before').content).replace(/"/g, '') }));
  const scenes = [...document.querySelectorAll('.f12-scene')].map((s) => ({ col: getComputedStyle(s).columnGap, row: getComputedStyle(s).rowGap }));
  const pairs = [...document.querySelectorAll('.f12-pair')].map((p) => {
    const [a, b] = [...p.children].map((c) => c.getBoundingClientRect());
    return a && b ? b.top - a.bottom : null;
  });
  return { panels, cuts, scenes, pairs, scrollWidth: document.documentElement.scrollWidth, width: innerWidth };
}

const near = (a, b, tol = 1) => Math.abs(a - b) <= tol;
const boxNear = (a, b, tol = 1) => near(a.x, b.x, tol) && near(a.y, b.y, tol) && near(a.w, b.w, tol) && near(a.h, b.h, tol);

/** Expected polygon (CSS px) for a panel box, in React's measured mode or the shared SSR mode. */
function expectedPts(shape, w, h, ssr) {
  if (ssr) {
    const p = { rect: [[0.35, 0.35], [99.65, 0.35], [99.65, 99.65], [0.35, 99.65]], 'slant-bottom': [[0.35, 0.35], [99.65, 0.35], [99.65, 93.2], [0.35, 99.65]], 'slant-top': [[0.35, 6.8], [99.65, 0.35], [99.65, 99.65], [0.35, 99.65]] }[shape];
    return p.map(([x, y]) => [(x / 100) * w, (y / 100) * h]);
  }
  const s = 1.25;
  const d = 16;
  if (shape === 'slant-bottom') return [[s, s], [w - s, s], [w - s, h - s - d], [s, h - s]];
  if (shape === 'slant-top') return [[s, s + d], [w - s, s], [w - s, h - s], [s, h - s]];
  return [[s, s], [w - s, s], [w - s, h - s], [s, h - s]];
}

async function diffRatio(page, a, b) {
  return page.evaluate(
    async ([da, db]) => {
      const load = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = src; });
      const [ia, ib] = await Promise.all([load(da), load(db)]);
      const w = Math.max(ia.width, ib.width);
      const h = Math.max(ia.height, ib.height);
      const ctx = (img) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.fillStyle = '#808080'; x.fillRect(0, 0, w, h); x.drawImage(img, 0, 0); return x.getImageData(0, 0, w, h).data; };
      const pa = ctx(ia);
      const pb = ctx(ib);
      let diff = 0;
      for (let i = 0; i < pa.length; i += 4) if (Math.abs(pa[i] - pb[i]) > 40 || Math.abs(pa[i + 1] - pb[i + 1]) > 40 || Math.abs(pa[i + 2] - pb[i + 2]) > 40) diff++;
      return diff / (w * h);
    },
    [`data:image/png;base64,${a.toString('base64')}`, `data:image/png;base64,${b.toString('base64')}`],
  );
}

const report_lines = [];

// ---------------------------------------------------------------------------------- run
for (const engine of BROWSERS) {
  const browser = await launch(engine);
  const tag = `[${engine}]`;
  try {
    // 1. Cut grammar in the browser.
    {
      // Chromium: the rendered ::before text via DOMSnapshot (getRenderedCuts). Firefox/WebKit expose
      // no rendered pseudo-element text, so assert the counter rules and visible cut order instead.
      const read = async (url) => {
        const { ctx, page } = await open(browser, url);
        let cuts;
        if (engine === 'chromium') {
          cuts = await getRenderedCuts(page);
        } else {
          cuts = await page.evaluate(() => {
            let n = 0;
            return [...document.querySelectorAll('.f12-cut')]
              .filter((c) => getComputedStyle(c).display !== 'none')
              .map((c) => {
                const before = getComputedStyle(c, '::before').content;
                const sheetReset = getComputedStyle(c.closest('.f12-sheet')).counterReset.startsWith('f12-cut');
                if (c.hasAttribute('data-autocut')) {
                  n++;
                  const inc = getComputedStyle(c).counterIncrement.startsWith('f12-cut');
                  return sheetReset && inc && /counter\(f12-cut, decimal-leading-zero\)/.test(before) ? `C-${String(n).padStart(2, '0')}` : 'BAD';
                }
                return c.textContent;
              });
          });
        }
        await ctx.close();
        return cuts;
      };
      const s = await read(pages.cutsStatic);
      const r = await read(pages.cutsReact);
      check(JSON.stringify(s) === '["C-01","C-02","C-03","C-04"]' && JSON.stringify(s) === JSON.stringify(r), `${tag} cuts: computed ::before content numbers static and React panels identically in DOM order`, `static=${s} react=${r}`);
      for (const which of ['demo', 'edge']) {
        const a = await read(pages[`static-${which}`]);
        const b = await read(pages[`react-${which}`]);
        check(a.join() === 'C-01,C-02,C-03,C-04,C-05' && a.join() === b.join(), `${tag} cuts: ${which} report reads C-01…C-05 in both renderers`, `${a} | ${b}`);
      }
    }

    // 2. Exact geometry: static width/height mode equals React's measured polygon.
    {
      {
        const { ctx, page } = await open(browser, pages.geometry, { wait: '#rect' });
        await page.evaluate(() => ['rect', 'slant-bottom', 'slant-top'].forEach((s) => window.f12.panel(document.getElementById(s), s)));
        await page.waitForTimeout(100);
        for (const shape of ['rect', 'slant-bottom', 'slant-top']) {
          const got = await page.evaluate((s) => {
            const svg = document.querySelector(`#${s} svg.f12-panel-frame`);
            return { w: svg.getAttribute('width'), h: svg.getAttribute('height'), pts: svg.querySelector('polygon').getAttribute('points') };
          }, shape);
          const expected = S.panel({ shape, cut: false, width: Number(got.w), height: Number(got.h), children: 'x' });
          check(got.w === '320' && got.h === '200' && expected.includes(`points="${got.pts}"`), `${tag} geometry: static panel({ shape: '${shape}', width: 320, height: 200 }) equals React's measured polygon`, got.pts);
        }
        await ctx.close();
      }
    }

    // 3. Accessibility.
    for (const [name, url] of [['demo', pages['static-demo']], ['edge', pages['static-edge']], ['fixtures', pages.fixtures]]) {
      for (const scheme of SCHEMES) {
        const { ctx, page, errors, requests } = await open(browser, url, { scheme, width: 1280 });
        const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        check(axe.violations.length === 0, `${tag} a11y: axe-core zero violations on static ${name} (${scheme})`, axe.violations.map((v) => `${v.id}: ${v.nodes.length}`).join(', '));
        const sem = await page.evaluate(() => {
          const levels = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => Number(h.tagName[1]));
          const skips = levels.filter((l, i) => i > 0 && l > levels[i - 1] + 1).length;
          const svgs = [...document.querySelectorAll('svg')].filter((s) => s.getAttribute('aria-hidden') !== 'true' && !(s.getAttribute('role') === 'img' && s.getAttribute('aria-label')));
          const lists = [...document.querySelectorAll('.f12-receipt-list, .f12-ints-list')].every((ul) => ul.tagName === 'UL' && [...ul.children].every((li) => li.tagName === 'LI'));
          const focusable = [...document.querySelectorAll('a, button, input, select, textarea, [tabindex], [contenteditable], [onclick]')].filter((el) => !(el.tagName === 'A' && el.getAttribute('href')));
          return { first: levels[0], skips, svgs: svgs.length, lists, focusable: focusable.map((f) => f.outerHTML.slice(0, 60)) };
        });
        check(sem.first === 1 && sem.skips === 0, `${tag} a11y: heading levels start at h1 and never skip (static ${name}, ${scheme})`);
        check(sem.svgs === 0, `${tag} a11y: every SVG is aria-hidden or labeled (static ${name}, ${scheme})`);
        check(sem.lists, `${tag} a11y: receiptList/toneBarList keep ul > li list semantics (static ${name}, ${scheme})`);
        check(sem.focusable.length === 0, `${tag} a11y: no focusable element without a function (only real links) (static ${name}, ${scheme})`, sem.focusable.join(' | '));
        check(errors.length === 0 && requests.length === 0, `${tag} static ${name} (${scheme}): no script errors and zero network requests`, [...errors, ...requests].join(' | '));
        await ctx.close();
      }
    }

    // 5. Strict CSP (VS Code webviews): inlineCss: false + linked stylesheets + a real CSP header.
    for (const [policy, csp] of [
      ['fully strict', "default-src 'none'; style-src http://f12.test"],
      ['recommended', "default-src 'none'; style-src http://f12.test; style-src-attr 'unsafe-inline'"],
    ]) {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
      const page = await ctx.newPage();
      await page.addInitScript(() => {
        window.__cspViolations = [];
        document.addEventListener('securitypolicyviolation', (e) => window.__cspViolations.push(`${e.violatedDirective} ${e.blockedURI}`));
      });
      const files = {
        '/tokens.css': fs.readFileSync(path.join(REPO_ROOT, 'packages/tokens/dist/tokens.css'), 'utf8'),
        '/static.css': fs.readFileSync(path.join(PKG_ROOT, 'dist/static.css'), 'utf8'),
        '/page.html': String(cspPage).replace('</head>', '<link rel="stylesheet" href="/tokens.css"><link rel="stylesheet" href="/static.css"></head>'),
      };
      await page.route('http://f12.test/**', (route) => {
        const p = new URL(route.request().url()).pathname;
        if (!(p in files)) return route.fulfill({ status: 404, body: '' });
        return route.fulfill({
          status: 200,
          contentType: p.endsWith('.css') ? 'text/css' : 'text/html; charset=utf-8',
          headers: p.endsWith('.html') ? { 'content-security-policy': csp } : {},
          body: files[p],
        });
      });
      await page.goto('http://f12.test/page.html');
      await page.waitForSelector('.f12-sheet');
      await page.waitForTimeout(200);
      const r = await page.evaluate(() => {
        const fills = [...document.querySelectorAll('.f12-int-fill')].map((f) => ({ want: Number(f.dataset.fill), got: (f.getBoundingClientRect().width / f.parentElement.getBoundingClientRect().width) * 100 }));
        const visibleCuts = [...document.querySelectorAll('.f12-cut[data-autocut]')].filter((c) => getComputedStyle(c).display !== 'none').length;
        const autoCuts = document.querySelectorAll('.f12-cut[data-autocut]').length;
        const sheetBg = getComputedStyle(document.querySelector('.f12-sheet')).backgroundColor;
        const gap = getComputedStyle(document.querySelector('.f12-balloon-gap')).left;
        const balloon = document.querySelector('.f12-balloon').getBoundingClientRect();
        const scene = document.querySelector('.f12-scene-areas');
        const areas = getComputedStyle(scene).gridTemplateAreas;
        const sceneW = scene.getBoundingClientRect().width;
        const panelWidths = [...scene.children].filter((c) => c.matches('.f12-panel, .f12-pair')).map((c) => c.getBoundingClientRect().width / sceneW);
        const gapEl = document.querySelector('.f12-balloon-gap');
        // Firefox requests /favicon.ico for every page, which default-src 'none' blocks (img-src); that
        // request comes from the browser, not the page, so it is the one report excluded.
        const violations = window.__cspViolations.filter((v) => !/^img-src \S*\/favicon\.ico$/.test(v));
        return { fills, visibleCuts, autoCuts, sheetBg, gapCentre: parseFloat(gap) + 5 - gapEl.offsetParent.clientWidth / 2, areas, panelWidths, violations };
      });
      const tag2 = `${tag} CSP ${policy}`;
      check(r.sheetBg !== 'rgba(0, 0, 0, 0)' && r.sheetBg !== '', `${tag2}: linked tokens.css + static.css load and style the page`, r.sheetBg);
      check(r.autoCuts > 0 && r.visibleCuts === r.autoCuts, `${tag2}: every auto-cut label is displayed (${r.visibleCuts}/${r.autoCuts})`);
      if (engine === 'chromium') {
        const cuts = await getRenderedCuts(page);
        // Two sheets on the page: the report (C-01…C-05) and the balloon/tone-bar sheet (C-01).
        check(cuts.join() === 'C-01,C-02,C-03,C-04,C-05,C-01' && cuts.length === r.autoCuts, `${tag2}: rendered cut labels read C-01…C-05 then C-01 (one sequence per sheet)`, cuts.join());
      }
      check(r.fills.length > 0 && r.fills.every((f) => Math.abs(f.got - f.want) <= 1.5), `${tag2}: tone-bar fills keep their length (within 1.5% of the data)`, JSON.stringify(r.fills.map((f) => [f.want, Number(f.got.toFixed(1))])));
      check(Math.abs(r.gapCentre) <= 1, `${tag2}: the balloon seam stays centred under the tail`, String(r.gapCentre));
      if (policy === 'recommended') {
        check(r.violations.length === 0, `${tag2}: zero CSP violations`, r.violations.join(', '));
        check(r.areas.includes('summary') && r.panelWidths.every((w) => w < 0.7), `${tag2}: named areas are placed (inline custom properties allowed)`, `${r.areas} ${r.panelWidths.map((w) => w.toFixed(2))}`);
      } else {
        check(r.violations.length > 0 && r.violations.every((v) => /^style-src/.test(v)), `${tag2}: only style attributes are blocked (${r.violations.length} reports, all style-src)`, [...new Set(r.violations)].join(', '));
        check(r.areas === 'none' && r.panelWidths.length === 4 && r.panelWidths.every((w) => w > 0.99), `${tag2}: documented degradation: named areas fall back to one full-width column in DOM order`, `${r.areas} ${r.panelWidths.map((w) => w.toFixed(2))}`);
      }
      await ctx.close();
    }

    // 4. Visual parity, React vs static.
    for (const which of ['demo', 'edge']) {
      for (const scheme of SCHEMES) {
        for (const width of WIDTHS) {
          const label = `${tag} visual ${which} ${width}px ${scheme}`;
          const st = await open(browser, pages[`static-${which}`], { width, scheme });
          const re = await open(browser, pages[`react-${which}`], { width, scheme });
          await re.page.waitForTimeout(200); // ResizeObserver measurement
          const gs = await st.page.evaluate(collectGeometry);
          const gr = await re.page.evaluate(collectGeometry);
          const boxesOk = gs.panels.length === gr.panels.length && gs.panels.every((p, i) => boxNear(p.box, gr.panels[i].box));
          check(boxesOk, `${label}: ${gs.panels.length} panel boxes match within 1px`, boxesOk ? '' : JSON.stringify(gs.panels.map((p, i) => [p.box, gr.panels[i]?.box]).find(([a, b]) => !b || !boxNear(a, b))));
          // Polygon points: React draws the measured polygon, static the SSR polygon React also
          // draws before hydration. Each must equal its formula for the shared panel box.
          let ptsOk = true;
          let maxDev = 0;
          let rise = [];
          gs.panels.forEach((p, i) => {
            const q = gr.panels[i];
            if (!p.pts || !q?.pts) return (ptsOk = ptsOk && !p.pts === !q?.pts);
            const es = expectedPts(p.shape, p.box.w, p.box.h, true);
            const er = expectedPts(q.shape, q.box.w, q.box.h, false);
            ptsOk &&= p.ssr && !q.ssr && p.pts.every((v, k) => near(v[0], es[k][0], 0.5) && near(v[1], es[k][1], 0.5)) && q.pts.every((v, k) => near(v[0], er[k][0], 0.5) && near(v[1], er[k][1], 0.5));
            p.pts.forEach((v, k) => (maxDev = Math.max(maxDev, Math.hypot(v[0] - q.pts[k][0], v[1] - q.pts[k][1]))));
            if (p.shape !== 'rect') rise.push(`${(q.pts[0][1] - q.pts[1][1] || q.pts[3][1] - q.pts[2][1]).toFixed(1)}/${(p.pts[0][1] - p.pts[1][1] || p.pts[3][1] - p.pts[2][1]).toFixed(1)}`);
          });
          check(ptsOk, `${label}: polygon points equal React's measured formula (React) and the shared ssrPts (static) for every panel`, `max vertex distance ${maxDev.toFixed(2)}px`);
          const reactRises = gr.panels.filter((q) => q.pts && q.shape !== 'rect').map((q) => Math.abs((q.pts[0][1] - q.pts[1][1]) || (q.pts[3][1] - q.pts[2][1])));
          check(reactRises.every((r) => near(r, 16, 0.01)), `${label}: React slant rise is 16px; static SSR rise is 6.45% of panel height (documented)`, `react/static rise px: ${rise.join(' ')}`);
          const cutsOk = gs.cuts.length === gr.cuts.length && gs.cuts.every((c, k) => c.text === gr.cuts[k].text && boxNear(c.box, gr.cuts[k].box));
          check(cutsOk, `${label}: cut labels (text and position) match within 1px`, cutsOk ? '' : JSON.stringify([gs.cuts, gr.cuts]).slice(0, 300));
          const gutterOk = JSON.stringify(gs.scenes) === JSON.stringify(gr.scenes) && JSON.stringify(gs.pairs) === JSON.stringify(gr.pairs) && gs.pairs.every((g) => near(g, 12, 0.5));
          check(gutterOk, `${label}: scene gutters and 12px pair gutters match`, JSON.stringify([gs.scenes, gs.pairs, gr.scenes, gr.pairs]));
          if (which === 'demo') {
            check(gs.scrollWidth <= width && gr.scrollWidth <= width, `${label}: no horizontal overflow`, `${gs.scrollWidth}/${gr.scrollWidth}`);
          } else {
            // Known kit behaviour (React too): a 14-digit non-big Metric value can't wrap and
            // overflows at 360px. Static must match React exactly; the fix belongs to the kit.
            check(gs.scrollWidth === gr.scrollWidth, `${label}: horizontal extent matches React (${gs.scrollWidth}px vs ${gr.scrollWidth}px)`);
          }
          const [sa, sb] = await Promise.all([st.page.screenshot({ fullPage: true }), re.page.screenshot({ fullPage: true })]);
          fs.writeFileSync(path.join(OUT, `${engine}-${which}-${width}-${scheme}-static.png`), sa);
          fs.writeFileSync(path.join(OUT, `${engine}-${which}-${width}-${scheme}-react.png`), sb);
          const ratio = await diffRatio(st.page, sa, sb);
          report_lines.push({ engine, which, width, scheme, diffRatio: Number(ratio.toFixed(4)), maxVertexDistancePx: Number(maxDev.toFixed(2)) });
          // Reported, not gated: the pixel ratio mixes antialiasing with the documented SSR slant,
          // so the geometry assertions above are the gate. Component counts catch a missing piece.
          console.log(`INFO  ${label}: full-page diff ratio ${(ratio * 100).toFixed(2)}%`);
          const countsOf = (page) => page.evaluate(() => {
            const out = {};
            for (const el of document.querySelectorAll('[class*="f12-"]')) for (const c of el.classList) if (c.startsWith('f12-')) out[c] = (out[c] || 0) + 1;
            return out;
          });
          const [cs, cr] = await Promise.all([countsOf(st.page), countsOf(re.page)]);
          const ignore = new Set(['f12-m-cut', 'f12-m-stepped']);
          const keys = [...new Set([...Object.keys(cs), ...Object.keys(cr)])].filter((k) => !ignore.has(k)).sort();
          const diffKeys = keys.filter((k) => cs[k] !== cr[k]);
          check(diffKeys.length === 0, `${label}: every f12-* class appears the same number of times in both renderers`, diffKeys.map((k) => `${k}:${cs[k]}/${cr[k]}`).join(' '));
          await st.ctx.close();
          await re.ctx.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
}

fs.writeFileSync(path.join(OUT, 'visual-report.json'), JSON.stringify(report_lines, null, 2) + '\n');
console.log(`Visual diff report: ${path.relative(REPO_ROOT, path.join(OUT, 'visual-report.json'))}`);
finish(`browser (${BROWSERS.join(', ')})`);
