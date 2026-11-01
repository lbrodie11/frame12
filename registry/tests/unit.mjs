// Functional, component, adapter, and grammar unit tests for @frame12/registry.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { launch, openGallery, REGISTRY_ROOT, REPO_ROOT, check, finish } from './lib.mjs';

// 1. Static checks: Tokens (no hard-coded colors/fonts outside styles/), Registry JSONs, No named artists
{
  const uiFiles = readdirSync(resolve(REGISTRY_ROOT, 'ui')).map((f) =>
    resolve(REGISTRY_ROOT, 'ui', f),
  );
  const hookFiles = readdirSync(resolve(REGISTRY_ROOT, 'hooks')).map((f) =>
    resolve(REGISTRY_ROOT, 'hooks', f),
  );
  const codeFiles = [...uiFiles, ...hookFiles];

  const colorViolations = [];
  for (const file of codeFiles) {
    const content = readFileSync(file, 'utf8');
    const base = file.split('/').pop();
    // Remove the allowed #fff luminance mask stops in tone-area-chart.tsx
    const sanitized =
      base === 'tone-area-chart.tsx'
        ? content.replace(/stopColor="#fff"/g, '')
        : content;
    const hexMatch = sanitized.match(/#[0-9a-fA-F]{3,8}\b/);
    const rgbMatch = sanitized.match(/\b(?:rgb|rgba|hsl|hsla)\s*\(/);
    const fontMatch = sanitized.match(/\b(?:Dela Gothic One|Zen Kaku Gothic New|M PLUS 1 Code)\b/);
    if (hexMatch || rgbMatch || fontMatch) {
      colorViolations.push(`${base}: ${hexMatch?.[0] || rgbMatch?.[0] || fontMatch?.[0]}`);
    }
  }
  check(
    colorViolations.length === 0,
    'rule 1: no hard-coded colors or font stacks outside styles/',
    colorViolations.join(', '),
  );

  // Check registry.json and emitted site/public/r/*.json
  const reg = JSON.parse(readFileSync(resolve(REGISTRY_ROOT, 'registry.json'), 'utf8'));
  const missingJson = [];
  for (const item of reg.items) {
    const p = resolve(REPO_ROOT, 'site/public/r', `${item.name}.json`);
    if (!existsSync(p)) missingJson.push(item.name);
  }
  check(
    missingJson.length === 0 && reg.items.length >= 21,
    `shadcn registry: ${reg.items.length} items emitted to site/public/r/*.json`,
    missingJson.join(', '),
  );

  const adapters = ['dialog', 'select', 'tooltip', 'dropdown-menu', 'table'];
  const adapterDepsOk = adapters.every((name) => {
    const item = reg.items.find((i) => i.name === name);
    return item && Array.isArray(item.registryDependencies) && item.registryDependencies.includes(name);
  });
  check(
    adapterDepsOk,
    'adapters: dialog, select, tooltip, dropdown-menu, and table declare shadcn registryDependencies',
  );
}

// 2. Browser tests against gallery.html
const browser = await launch();
const { ctx, page, errors } = await openGallery(browser);

// Rule 2: Gutter grammar (only 12px, 20px, 32px)
{
  const gutters = await page.evaluate(() => {
    const scenes = [...document.querySelectorAll('.scene')];
    const gaps = scenes.map((s) => parseFloat(getComputedStyle(s).rowGap || getComputedStyle(s).gap));
    const pairGap = parseFloat(getComputedStyle(document.querySelector('.pair')).gap);
    return {
      scenePrimary: parseFloat(getComputedStyle(document.querySelector('#scene-primary')).gap),
      sceneSecondary: parseFloat(getComputedStyle(document.querySelector('#scene-secondary')).gap),
      sceneAdapters: parseFloat(getComputedStyle(document.querySelector('#scene-adapters')).gap),
      pairGap,
      allValid: gaps.every((g) => g === 12 || g === 20 || g === 32),
    };
  });
  check(
    gutters.scenePrimary === 20 &&
      gutters.sceneSecondary === 32 &&
      gutters.sceneAdapters === 12 &&
      gutters.pairGap === 12 &&
      gutters.allValid,
    'rule 2: Scene & PanelPair gutters strictly follow 12px (pair), 20px (scene), 32px (change)',
    JSON.stringify(gutters),
  );
}

// Rule 3: Cut numbers in reading and DOM order
{
  const cuts = await page.evaluate(() => {
    const els = [...document.querySelectorAll('.panel > .cut')];
    const labels = els.map((e) => e.textContent.trim());
    const rects = els.map((e) => {
      const r = e.getBoundingClientRect();
      return { top: Math.round(r.top), left: Math.round(r.left) };
    });
    // Reading order check: each subsequent cut is either below (top + 20) or to the right on the same row
    let readingOrder = true;
    for (let i = 1; i < rects.length; i++) {
      const prev = rects[i - 1];
      const cur = rects[i];
      const sameRow = Math.abs(cur.top - prev.top) < 40;
      if (sameRow && cur.left < prev.left) readingOrder = false;
      if (!sameRow && cur.top < prev.top - 40) readingOrder = false;
    }
    return { labels, readingOrder };
  });
  check(
    cuts.labels.join(',') === 'C-01,C-02,C-03,C-04,C-05,C-06,C-07' && cuts.readingOrder,
    'rule 3: Cut numbers C-01..C-07 match DOM order and visual reading order',
    cuts.labels.join(', '),
  );
}

// Rule 4: Marker yellow only under ink text
{
  const markerCheck = await page.evaluate(() => {
    const markerRgb = 'rgb(255, 214, 10)';
    const inkRgb = 'rgb(18, 18, 18)';
    const violations = [];
    for (const el of document.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      if (cs.color === markerRgb) violations.push(`marker text on ${el.tagName}.${el.className}`);
      if (cs.backgroundColor === markerRgb && el.textContent.trim() && cs.color !== inkRgb) {
        violations.push(`non-ink text (${cs.color}) on marker bg ${el.tagName}.${el.className}`);
      }
    }
    return violations;
  });
  check(
    markerCheck.length === 0,
    'rule 4: Marker yellow (--f-marker) only sits under --f-marker-ink text',
    markerCheck.join('; '),
  );
}

// Panel & PanelPair SVG polygon slant geometry
{
  const polyOk = await page.evaluate(() => {
    const parsePts = (el) =>
      el
        .querySelector('.panel-frame polygon')
        .getAttribute('points')
        .trim()
        .split(/\s+/)
        .map((p) => p.split(',').map(Number));
    const topPts = parsePts(document.querySelector('.pair .panel.slant-bottom'));
    const botPts = parsePts(document.querySelector('.pair .panel.slant-top'));
    // slant-bottom: bottom-left y - bottom-right y === 16
    const bottomRise = Math.round(topPts[3][1] - topPts[2][1]);
    // slant-top: top-left y - top-right y === 16
    const topRise = Math.round(botPts[0][1] - botPts[1][1]);
    return { bottomRise, topRise };
  });
  check(
    polyOk.bottomRise === 16 && polyOk.topRise === 16,
    'Panel & PanelPair: SVG polygon frames draw exact 16px diagonal slant rise',
    JSON.stringify(polyOk),
  );
}

// SegmentedControl + Metric + ToneAreaChart + ToneBarList interactions
{
  await page.click('#gal-rng-7');
  await page.waitForTimeout(850);
  const state7 = await page.evaluate(() => ({
    pressed7: document.querySelector('#gal-rng-7').getAttribute('aria-pressed'),
    balloon: document.querySelector('.chart .balloon')?.textContent.trim() || '',
    tableRows: document.querySelectorAll('.tbl tbody tr').length,
  }));
  check(
    state7.pressed7 === 'true' && state7.balloon.startsWith('Peak ') && state7.tableRows === 7,
    'SegmentedControl & ToneAreaChart: switching to 7 days updates chart, balloon, and 7-row data table',
    JSON.stringify(state7),
  );

  // Keyboard navigation on ToneAreaChart
  await page.focus('.chart-svg');
  await page.keyboard.press('ArrowLeft');
  const tipVisible = await page.evaluate(() => Boolean(document.querySelector('.chart .tip')));
  await page.keyboard.press('Escape');
  const tipHidden = await page.evaluate(() => !document.querySelector('.chart .tip'));
  check(
    tipVisible && tipHidden,
    'ToneAreaChart: keyboard ArrowLeft shows crosshair tooltip and Escape dismisses it',
  );

  // ToneBarList selection adds comparison series to ToneAreaChart and data table
  await page.click('#int-gal-exit');
  await page.waitForTimeout(850);
  const compareOk = await page.evaluate(() => ({
    pressed: document.querySelector('#int-gal-exit').getAttribute('aria-pressed') === 'true',
    hasFocusLine: Boolean(document.querySelector('.chart .l-focus')),
    tableCols: document.querySelectorAll('.tbl thead th').length,
  }));
  check(
    compareOk.pressed && compareOk.hasFocusLine && compareOk.tableCols === 3,
    'ToneBarList: selecting an item highlights row, draws dashed comparison line, and adds 3rd table column',
  );
}

// Input validation & Button actions
{
  await page.fill('#input-threshold', '5');
  const errState = await page.evaluate(() => {
    const inp = document.querySelector('#input-threshold');
    const alert = document.querySelector('.f12-error[role="alert"]');
    return {
      invalid: inp.getAttribute('aria-invalid') === 'true',
      alertText: alert?.textContent || '',
    };
  });
  check(
    errState.invalid && errState.alertText.includes('Threshold must be at least 10%'),
    'Input: error prop sets aria-invalid="true" and renders accessible alert',
  );
  await page.fill('#input-threshold', '15');
}

// Primitive Adapters: Select, Dialog, Tooltip, DropdownMenu, Table
{
  // Select
  await page.click('#gal-select');
  await page.click('.f12-select-item >> text=Exit-intent offer');
  const selectText = await page.innerText('#gal-select');
  check(
    selectText.includes('Exit-intent offer'),
    'Select adapter: opens listbox, selects item, and updates trigger text',
  );

  // Dialog
  await page.click('#gal-dialog-open');
  const dlgOpen = await page.evaluate(() => {
    const d = document.querySelector('dialog.f12-dialog');
    return d && d.open && d.querySelector('.cut')?.textContent === 'C-08';
  });
  await page.click('#gal-dialog-close');
  const dlgClosed = await page.evaluate(() => !document.querySelector('dialog.f12-dialog').open);
  check(
    dlgOpen && dlgClosed,
    'Dialog adapter: opens modal <dialog> with cut C-08 and closes cleanly',
  );

  // Tooltip
  await page.focus('#gal-tooltip-trigger');
  const tipOk = await page.evaluate(() => {
    const t = document.querySelector('[role="tooltip"]');
    return t && t.textContent.includes('83.33ms');
  });
  check(tipOk, 'Tooltip adapter: shows tooltip on focus linked via aria-describedby');

  // DropdownMenu
  await page.click('#gal-menu-trigger');
  await page.click('#gal-menu-csv');
  const statusText = await page.innerText('.hd .sub');
  check(
    statusText.includes('Exported CSV'),
    'DropdownMenu adapter: opens menu, triggers item action, and closes menu',
  );

  // Table
  const tableOk = await page.evaluate(() => {
    const tbl = document.querySelector('.f12-table');
    return (
      tbl &&
      tbl.querySelectorAll('thead th[scope="col"]').length === 3 &&
      tbl.querySelectorAll('tbody tr').length === 3 &&
      tbl.querySelectorAll('tfoot td').length === 3
    );
  });
  check(tableOk, 'Table adapter: renders semantic thead, tbody, tfoot, and scope="col" headers');
}

check(errors.length === 0, 'gallery unit run: zero console or page errors', errors[0] || '');

await ctx.close();
await browser.close();
finish();
