// Accessibility and motion checks (stand-in for axe-core plus motion timing):
// text contrast against the rendered background, accessible names, duplicate ids,
// visible keyboard focus, stepped-motion pose count, and reduced-motion behaviour.
import { launch, openPage, check, finish } from './lib.mjs';

const CONTRAST = () => {
  const parse = (c) => { const m = c && c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const blend = (t, b) => ({ r: t.r * t.a + b.r * (1 - t.a), g: t.g * t.a + b.g * (1 - t.a), b: t.b * t.a + b.b * (1 - t.a), a: 1 });
  const bgOf = (el) => { const st = []; for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { st.push(c); if (c.a >= 1) break; } } let col = { r: 255, g: 255, b: 255, a: 1 }; for (let i = st.length - 1; i >= 0; i--) col = blend(st.at(i), col); return col; };
  const ratio = (fg, bg) => { const a = lum(blend(fg, bg)), b = lum(bg); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
  const out = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const t = walker.currentNode, el = t.parentElement;
    if (!el || !t.textContent.trim() || el.closest('svg, .sr-only, .rng, [inert]')) continue;
    const rc = el.getBoundingClientRect(); if (!rc.width || !rc.height) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    const size = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700;
    const need = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5;
    const r = ratio(parse(cs.color), bgOf(el));
    if (r < need) out.push(`${t.textContent.trim().slice(0, 30)} (${r.toFixed(2)} < ${need})`);
  }
  for (const tx of document.querySelectorAll('.chart svg text')) {
    const r = ratio(parse(getComputedStyle(tx).fill), bgOf(tx.closest('.chart')));
    if (r < 4.5) { out.push(`chart label ${tx.textContent} (${r.toFixed(2)})`); break; }
  }
  return out;
};

const NAMES = () => {
  const unnamed = [];
  for (const el of document.querySelectorAll('button, input, select, textarea, [tabindex="0"], a[href]')) {
    if (el.closest('[inert]')) continue;
    const name = (el.getAttribute('aria-label') || el.textContent || (el.labels && [...el.labels].map((l) => l.textContent).join(' ')) || '').trim();
    if (!name) unnamed.push(el.outerHTML.slice(0, 60));
  }
  const ids = {};
  for (const el of document.querySelectorAll('[id]')) ids[el.id] = (ids[el.id] || 0) + 1;
  return { unnamed, dup: Object.keys(ids).filter((k) => ids[k] > 1) };
};

async function focusMisses(page, stops = 40) {
  const misses = [];
  await page.mouse.click(3, 300);
  for (let i = 0; i < stops; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const e = document.activeElement;
      if (!e || e === document.body) return null;
      const cs = getComputedStyle(e);
      return { id: e.id || e.tagName, vis: (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none' };
    });
    if (info && !info.vis) misses.push(info.id);
  }
  return misses;
}

const browser = await launch();
for (const scheme of ['light', 'dark']) {
  for (const design of ['frame', 'conv']) {
    const { ctx, page } = await openPage(browser, 'prototype.html', { scheme });
    await page.click(`#ds-${design}`);
    await page.click(`#int-x${design}-exit`);
    await page.waitForTimeout(900);
    const c = await page.evaluate(CONTRAST);
    const n = await page.evaluate(NAMES);
    const f = await focusMisses(page);
    check(c.length === 0, `${design} ${scheme}: text contrast meets WCAG AA`, c.slice(0, 3).join('; '));
    check(n.unnamed.length === 0 && n.dup.length === 0, `${design} ${scheme}: controls named, ids unique`, [...n.unnamed, ...n.dup].slice(0, 3).join('; '));
    check(f.length === 0, `${design} ${scheme}: keyboard focus visible`, f.slice(0, 3).join(', '));
    await ctx.close();
  }
}

{
  const { ctx, page } = await openPage(browser, 'prototype.html');
  await page.click('#ds-frame');
  const sample = (target) => page.evaluate(async (t) => {
    const ind = document.querySelector('.dash .rng-ind');
    document.querySelector(t).click();
    const xs = []; const t0 = performance.now();
    while (performance.now() - t0 < 330) { await new Promise((r) => requestAnimationFrame(r)); xs.push(Math.round(new DOMMatrix(getComputedStyle(ind).transform).m41)); }
    return [...new Set(xs)].length;
  }, target);
  await page.click('#mo-stepped'); await page.waitForTimeout(200);
  const stepped = await sample('#xframe-frame-90');
  await page.click('#mo-smooth'); await page.waitForTimeout(200);
  const smooth = await sample('#xframe-frame-7');
  check(stepped <= 4, 'stepped motion holds discrete poses', `${stepped} positions`);
  check(smooth > 6, 'smooth motion is continuous', `${smooth} positions`);
  await ctx.close();
}

{
  const { ctx, page } = await openPage(browser, 'prototype.html', { reduced: 'reduce' });
  await page.click('#ds-frame'); await page.click('#mo-stepped');
  const r = await page.evaluate(async () => {
    document.querySelector('#xframe-frame-90').click();
    await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
    const clip = document.querySelector('.dash clipPath rect'), svg = clip.closest('svg');
    const ind = document.querySelector('.dash .rng-ind'), btn = document.querySelector('#xframe-frame-90');
    return {
      chart: +clip.getAttribute('width') >= +svg.getAttribute('width') - 20,
      marker: Math.abs(new DOMMatrix(getComputedStyle(ind).transform).m41 - (btn.offsetLeft + btn.clientLeft)) < 1,
    };
  });
  check(r.chart && r.marker, 'reduced motion: changes land instantly');
  await ctx.close();
}

{
  const { ctx, page } = await openPage(browser, 'study.html', { w: 390, h: 844, scheme: 'dark' });
  await page.click('#role-1'); await page.click('#start'); await page.click('#intro-go-0'); await page.waitForTimeout(400);
  const c = await page.evaluate(CONTRAST);
  const n = await page.evaluate(NAMES);
  check(c.length === 0 && n.unnamed.length === 0 && n.dup.length === 0, 'study task screen (phone, dark): contrast, names, ids', [...c, ...n.unnamed, ...n.dup].slice(0, 3).join('; '));
  await ctx.close();
}

for (const scheme of ['light', 'dark']) {
  const { ctx, page } = await openPage(browser, 'style-sheet.html', { scheme });
  const c = await page.evaluate(CONTRAST);
  const n = await page.evaluate(NAMES);
  check(c.length === 0 && n.dup.length === 0 && n.unnamed.length === 0, `style sheet ${scheme}: contrast, names, ids`, [...c, ...n.unnamed, ...n.dup].slice(0, 3).join('; '));
  await ctx.close();
}

await browser.close();
finish();
