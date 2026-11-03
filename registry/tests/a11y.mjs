// Accessibility, axe-core, forced-colors, and motion checks for @frame12/registry gallery.html:
// WCAG AA text contrast in light & dark themes, @axe-core/playwright audit, accessible names,
// unique IDs, full-cycle visible keyboard focus, forced-colors high-contrast mode,
// stepped motion pose count <= 4 vs smooth > 6, instant reduced-motion, and gallery screenshots.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { launch, openGallery, REPO_ROOT, check, finish } from './lib.mjs';

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
    const a = lum(blend(fg, bg)),
      b = lum(bg);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  };
  const out = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const t = walker.currentNode,
      el = t.parentElement;
    if (
      !el ||
      !t.textContent.trim() ||
      el.closest('svg, .f12-sr-only, .sr-only, .f12-rng, .rng, [inert], dialog:not([open])')
    )
      continue;
    const rc = el.getBoundingClientRect();
    if (!rc.width || !rc.height) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    const size = parseFloat(cs.fontSize),
      bold = +cs.fontWeight >= 700;
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
    'button, input, select:not([tabindex="-1"]), textarea, [tabindex="0"], a[href]',
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

async function focusMissesAll(page) {
  const totalFocusable = await page.evaluate(() => {
    const sel =
      'a[href], button:not([disabled]):not([tabindex="-1"]), input:not([disabled]), select:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]), summary, [tabindex="0"]';
    return [...document.querySelectorAll(sel)].filter((el) => {
      if (el.closest('[inert], dialog:not([open])')) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
    }).length;
  });

  const misses = [];
  const visited = [];
  await page.mouse.click(3, 300);
  for (let i = 0; i < totalFocusable + 4; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const e = document.activeElement;
      if (!e || e === document.body) return null;
      const cs = getComputedStyle(e);
      const key = e.id || `${e.tagName}:${(e.textContent || '').trim().slice(0, 20)}`;
      return {
        key,
        vis:
          (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) ||
          cs.boxShadow !== 'none',
      };
    });
    if (!info) break;
    if (visited.length > 0 && info.key === visited[0]) break;
    visited.push(info.key);
    if (!info.vis) misses.push(info.key);
  }
  return { misses, checkedCount: visited.length, totalFocusable };
}

const docsImagesDir = resolve(REPO_ROOT, 'docs/images');
mkdirSync(docsImagesDir, { recursive: true });

const browser = await launch();

for (const scheme of ['light', 'dark']) {
  const { ctx, page, errors } = await openGallery(browser, { scheme });
  await page.screenshot({
    path: resolve(docsImagesDir, `gallery-${scheme}.png`),
    fullPage: true,
  });

  await page.click('#int-gal-exit');
  await page.waitForTimeout(850);

  const c = await page.evaluate(CONTRAST);
  const n = await page.evaluate(NAMES);
  const axe = await new AxeBuilder({ page }).analyze();
  const f = await focusMissesAll(page);
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);

  check(
    c.length === 0,
    `gallery ${scheme}: text contrast meets WCAG AA`,
    c.slice(0, 3).join('; '),
  );
  check(
    axe.violations.length === 0,
    `gallery ${scheme}: @axe-core/playwright zero violations`,
    axe.violations.map((v) => `${v.id} (${v.nodes.length})`).join(', '),
  );
  check(
    n.unnamed.length === 0 && n.dup.length === 0,
    `gallery ${scheme}: controls named, ids unique`,
    [...n.unnamed, ...n.dup].slice(0, 3).join('; '),
  );
  check(
    f.misses.length === 0 && f.checkedCount >= f.totalFocusable,
    `gallery ${scheme}: keyboard focus visible across all ${f.checkedCount} tab stops`,
    f.misses.slice(0, 3).join(', '),
  );
  check(
    sw <= 1280 && errors.length === 0,
    `gallery ${scheme}: no horizontal overflow or script errors`,
    `scrollWidth ${sw}${errors.length ? ' ' + errors[0] : ''}`,
  );
  await ctx.close();
}

// Forced-colors (Windows High Contrast) mode check
{
  const { ctx, page, errors } = await openGallery(browser, { scheme: 'light' });
  await page.emulateMedia({ forcedColors: 'active' });
  await page.waitForTimeout(100);
  const fcState = await page.evaluate(() => {
    const mq = window.matchMedia('(forced-colors: active)').matches;
    const panelPoly = document.querySelector('.f12-panel-frame polygon');
    const tag = document.querySelector('.f12-tag');
    return {
      mq,
      polyStrokeWidth: panelPoly ? getComputedStyle(panelPoly).strokeWidth : '0px',
      tagBorderStyle: tag ? getComputedStyle(tag).borderTopStyle : 'none',
    };
  });
  check(
    fcState.mq && parseFloat(fcState.polyStrokeWidth) >= 2 && fcState.tagBorderStyle === 'solid' && errors.length === 0,
    'gallery forced-colors: high-contrast media query active with visible borders on panels and tags',
    JSON.stringify(fcState),
  );
  await ctx.close();
}

// Stepped vs smooth motion pose count
{
  const { ctx, page } = await openGallery(browser);
  const sample = (target) =>
    page.evaluate(async (t) => {
      const ind = document
        .querySelector('#gal-rng-30')
        .closest('.f12-rng')
        .querySelector('.f12-rng-ind');
      document.querySelector(t).click();
      const xs = [];
      const t0 = performance.now();
      while (performance.now() - t0 < 330) {
        await new Promise((r) => requestAnimationFrame(r));
        xs.push(Math.round(new DOMMatrix(getComputedStyle(ind).transform).m41));
      }
      return [...new Set(xs)].length;
    }, target);

  await page.click('#mo-stepped');
  await page.waitForTimeout(200);
  const stepped = await sample('#gal-rng-90');

  await page.click('#mo-smooth');
  await page.waitForTimeout(200);
  const smooth = await sample('#gal-rng-7');

  check(stepped <= 4, 'registry stepped motion holds discrete poses', `${stepped} positions`);
  check(smooth > 6, 'registry smooth motion is continuous', `${smooth} positions`);
  await ctx.close();
}

// Reduced motion check
{
  const { ctx, page } = await openGallery(browser, { reduced: 'reduce' });
  await page.click('#mo-stepped');
  const r = await page.evaluate(async () => {
    document.querySelector('#gal-rng-90').click();
    await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
    const clip = document.querySelector('.f12-dash clipPath rect');
    const svg = clip.closest('svg');
    const btn = document.querySelector('#gal-rng-90');
    const ind = btn.closest('.f12-rng').querySelector('.f12-rng-ind');
    return {
      chart: +clip.getAttribute('width') >= +svg.getAttribute('width') - 20,
      marker:
        Math.abs(
          new DOMMatrix(getComputedStyle(ind).transform).m41 - (btn.offsetLeft + btn.clientLeft),
        ) < 1,
    };
  });
  check(r.chart && r.marker, 'registry reduced motion: changes land instantly');
  await ctx.close();
}

await browser.close();
finish();
