// Playwright accessibility, design-grammar, responsive, and screenshot verification
// for the three FRAME/12 skill evaluation screens (settings, landing, table) and family overview.

import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EVAL_ROOT = resolve(__dirname, '..');
const REPO_ROOT = resolve(EVAL_ROOT, '..');
const DIST_DIR = resolve(EVAL_ROOT, 'dist');
const DOCS_IMAGES = resolve(REPO_ROOT, 'docs/images');
mkdirSync(DOCS_IMAGES, { recursive: true });

const shim = process.env.F12_REACT_UMD ? readFileSync(process.env.F12_REACT_UMD, 'utf8') : null;

let failures = 0;
function check(ok, label, detail = '') {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`);
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
    if (!el || !t.textContent.trim() || el.closest('svg, .sr-only, .rng, [inert], dialog:not([open])'))
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
  for (const tx of document.querySelectorAll('.chart svg text')) {
    const r = ratio(parse(getComputedStyle(tx).fill), bgOf(tx.closest('.chart')));
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
    'button, input, select, textarea, [tabindex="0"], a[href]',
  )) {
    if (el.closest('[inert], dialog:not([open])')) continue;
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
  const scenes = [...document.querySelectorAll('.scene')];
  const sceneGaps = scenes.map((s) =>
    parseFloat(getComputedStyle(s).rowGap || getComputedStyle(s).gap),
  );
  const pairs = [...document.querySelectorAll('.pair')];
  const pairGaps = pairs.map((p) => parseFloat(getComputedStyle(p).gap));

  const cutEls = [...document.querySelectorAll('.panel > .cut')];
  const cuts = cutEls.map((e) => e.textContent.trim());
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
    readingOrder,
    markerViolations,
  };
};

async function focusMisses(page, stops = 18) {
  const misses = [];
  await page.mouse.click(3, 300);
  for (let i = 0; i < stops; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const e = document.activeElement;
      if (!e || e === document.body) return null;
      const cs = getComputedStyle(e);
      return {
        id: e.id || e.tagName,
        vis:
          (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) ||
          cs.boxShadow !== 'none',
      };
    });
    if (info && !info.vis) misses.push(info.id);
  }
  return misses;
}

async function openScreen(
  browser,
  name,
  { w = 1280, h = 900, scheme = 'light', reduced = 'no-preference' } = {},
) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    colorScheme: scheme,
    reducedMotion: reduced,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) {
      errors.push(`console: ${m.text()}`);
    }
  });
  if (shim) {
    await page.route('**/*', (route) => {
      const u = route.request().url();
      if (u.startsWith('file://')) return route.continue();
      if (u.includes('cdnjs') && u.includes('react-dom')) {
        return route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
      }
      if (u.includes('cdnjs') && u.includes('/react/')) {
        return route.fulfill({ status: 200, contentType: 'application/javascript', body: shim });
      }
      return route.abort();
    });
  }
  const target = resolve(DIST_DIR, `${name}.html`);
  await page.goto(pathToFileURL(target).href);
  await page.waitForSelector('#root > *', { timeout: 15000 });
  await page.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve()));
  await page.waitForTimeout(350);
  return { ctx, page, errors };
}

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox'],
});

const SCREENS = ['settings', 'landing', 'table'];

// 1. Desktop (1280px) light & dark checks + screenshots for all 3 screens
for (const screen of SCREENS) {
  for (const scheme of ['light', 'dark']) {
    const { ctx, page, errors } = await openScreen(browser, screen, {
      w: 1280,
      h: 920,
      scheme,
    });

    await page.screenshot({
      path: resolve(DOCS_IMAGES, `eval-${screen}-${scheme}.png`),
      fullPage: true,
    });

    const c = await page.evaluate(CONTRAST);
    const n = await page.evaluate(NAMES);
    const g = await page.evaluate(GRAMMAR_DOM);
    const f = await focusMisses(page);
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);

    check(
      c.length === 0,
      `eval/${screen} (${scheme}, 1280px): WCAG AA text contrast`,
      c.slice(0, 3).join('; '),
    );
    check(
      n.unnamed.length === 0 && n.dup.length === 0,
      `eval/${screen} (${scheme}, 1280px): controls named & IDs unique`,
      [...n.unnamed, ...n.dup].slice(0, 3).join('; '),
    );
    check(
      g.guttersOk &&
        g.cuts.join(',') === 'C-01,C-02,C-03,C-04,C-05' &&
        g.readingOrder &&
        g.markerViolations.length === 0,
      `eval/${screen} (${scheme}, 1280px): gutters (12/20/32), cuts C-01..C-05 reading order, marker discipline`,
      JSON.stringify(g),
    );
    check(
      f.length === 0,
      `eval/${screen} (${scheme}, 1280px): visible keyboard focus`,
      f.slice(0, 3).join(', '),
    );
    check(
      sw <= 1280 && errors.length === 0,
      `eval/${screen} (${scheme}, 1280px): no horizontal overflow or script errors`,
      `scrollWidth=${sw} errors=${errors.join('; ')}`,
    );

    await ctx.close();
  }
}

// 2. Mobile (390px) responsive & contrast checks across all 3 screens
for (const screen of SCREENS) {
  for (const scheme of ['light', 'dark']) {
    const { ctx, page, errors } = await openScreen(browser, screen, {
      w: 390,
      h: 844,
      scheme,
    });
    const c = await page.evaluate(CONTRAST);
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    check(
      c.length === 0 && sw <= 390 && errors.length === 0,
      `eval/${screen} (${scheme}, 390px mobile): WCAG AA contrast & zero horizontal overflow`,
      `scrollWidth=${sw} contrast=${c.slice(0, 2).join('; ')}`,
    );
    await ctx.close();
  }
}

// 3. Interactive behavioral verification on each screen
// 3a. Settings screen interactions
{
  const { ctx, page } = await openScreen(browser, 'settings');
  await page.click('#set-env-stage');
  await page.waitForTimeout(300);
  const envSub = await page.innerText('#settings-status');
  await page.fill('#settings-threshold', '5');
  const hasAlert = await page.evaluate(() =>
    Boolean(document.querySelector('.f12-error[role="alert"]')),
  );
  await page.fill('#settings-threshold', '15');
  await page.click('#settings-revoke-open');
  const dlgCut = await page.evaluate(
    () => document.querySelector('dialog.f12-dialog[open] .cut')?.textContent,
  );
  await page.click('#settings-revoke-confirm');
  const dlgClosed = await page.evaluate(() => !document.querySelector('dialog.f12-dialog').open);
  check(
    envSub.includes('Staging') && hasAlert && dlgCut === 'C-06' && dlgClosed,
    'eval/settings interactions: environment switch, threshold alert, and C-06 revocation dialog',
  );
  await ctx.close();
}

// 3b. Landing screen interactions
{
  const { ctx, page } = await openScreen(browser, 'landing');
  await page.click('#land-win-7');
  await page.waitForTimeout(400);
  await page.click('#int-land-exit');
  await page.waitForTimeout(400);
  const hasCompareLine = await page.evaluate(() =>
    Boolean(document.querySelector('.chart .l-focus')),
  );
  await page.click('#landing-trial-open');
  const dlgCut = await page.evaluate(
    () => document.querySelector('dialog.f12-dialog[open] .cut')?.textContent,
  );
  await page.click('#landing-trial-confirm');
  const statusText = await page.innerText('#landing-status');
  check(
    hasCompareLine && dlgCut === 'C-06' && statusText.includes('Provisioned'),
    'eval/landing interactions: window switch, C-04 capability comparison overlay, and C-06 trial dialog',
  );
  await ctx.close();
}

// 3c. Table screen interactions
{
  const { ctx, page } = await openScreen(browser, 'table');
  await page.click('#tbl-status-recovered');
  await page.waitForTimeout(300);
  const wonRows = await page.evaluate(
    () => document.querySelectorAll('#table-scene-primary .f12-table tbody tr').length,
  );
  await page.fill('#ledger-search', 'Takahashi');
  const searchRows = await page.evaluate(
    () => document.querySelectorAll('#table-scene-primary .f12-table tbody tr').length,
  );
  await page.click('#ledger-reset-btn');
  await page.click('#table-payload-open');
  const dlgCut = await page.evaluate(
    () => document.querySelector('dialog.f12-dialog[open] .cut')?.textContent,
  );
  await page.click('#table-payload-replay');
  const statusText = await page.innerText('#table-status');
  check(
    wonRows === 5 && searchRows === 1 && dlgCut === 'C-06' && statusText.includes('Replayed webhook'),
    'eval/table interactions: status filter, search input, reset, and C-06 webhook replay dialog',
  );
  await ctx.close();
}

// 4. Family overview screenshot (side-by-side comparison of all 3 screens)
{
  const { ctx, page, errors } = await openScreen(browser, 'family', {
    w: 3200,
    h: 1080,
    scheme: 'light',
  });
  await page.screenshot({
    path: resolve(DOCS_IMAGES, 'eval-family-light.png'),
    fullPage: true,
  });
  check(
    errors.length === 0,
    'eval/family overview: rendered side-by-side family comparison screenshot with zero errors',
  );
  await ctx.close();
}

await browser.close();
console.log(failures ? `\n${failures} eval check(s) failed` : '\nAll eval checks passed');
process.exitCode = failures ? 1 : 0;
