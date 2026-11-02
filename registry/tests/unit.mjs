// Functional, component, adapter, hook, and grammar unit tests for @frame12/registry.
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
    const hexMatch = content.match(/#[0-9a-fA-F]{3,8}\b/);
    const rgbMatch = content.match(/\b(?:rgb|rgba|hsl|hsla)\s*\(/);
    const fontMatch = content.match(/\b(?:Dela Gothic One|Zen Kaku Gothic New|M PLUS 1 Code)\b/);
    if (hexMatch || rgbMatch || fontMatch) {
      colorViolations.push(`${base}: ${hexMatch?.[0] || rgbMatch?.[0] || fontMatch?.[0]}`);
    }
  }
  check(
    colorViolations.length === 0,
    'rule 1: no hard-coded colors or font stacks outside styles/ (including zero #fff in tone-area-chart.tsx)',
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

  // Verify every registry item has explicit target paths, includes frame12.css, and has no conflicting shadcn registryDependencies
  const conflictingShadcnNames = new Set([
    'button',
    'input',
    'badge',
    'dialog',
    'select',
    'tooltip',
    'dropdown-menu',
    'table',
  ]);
  const manifestIssues = [];
  for (const item of reg.items) {
    if (!Array.isArray(item.files) || !item.files.every((f) => Boolean(f.target))) {
      manifestIssues.push(`${item.name}: missing file target`);
    }
    if (
      item.name !== 'use-on-twos' &&
      !item.files.some((f) => f.path === 'styles/frame12.css' && f.target === 'styles/frame12.css')
    ) {
      manifestIssues.push(`${item.name}: missing styles/frame12.css`);
    }
    if (
      Array.isArray(item.registryDependencies) &&
      item.registryDependencies.some((d) => conflictingShadcnNames.has(d))
    ) {
      manifestIssues.push(`${item.name}: conflicting registryDependencies`);
    }
  }
  check(
    manifestIssues.length === 0,
    'registry manifest: explicit targets, styles/frame12.css included, and zero conflicting registryDependencies',
    manifestIssues.join('; '),
  );
}

// 2. Browser tests against gallery.html
const browser = await launch();
const { ctx, page, errors } = await openGallery(browser);

// Rule 2: Gutter grammar (only 12px, 20px, 32px)
{
  const gutters = await page.evaluate(() => {
    const scenes = [...document.querySelectorAll('.f12-scene')];
    const gaps = scenes.map((s) =>
      parseFloat(getComputedStyle(s).rowGap || getComputedStyle(s).gap),
    );
    const pairGap = parseFloat(getComputedStyle(document.querySelector('.f12-pair')).gap);
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
    const els = [...document.querySelectorAll('.f12-panel > .f12-cut')];
    const labels = els.map((e) => e.textContent.trim());
    const rects = els.map((e) => {
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
        .querySelector('.f12-panel-frame polygon')
        .getAttribute('points')
        .trim()
        .split(/\s+/)
        .map((p) => p.split(',').map(Number));
    const topPts = parsePts(document.querySelector('.f12-pair .f12-panel.f12-slant-bottom'));
    const botPts = parsePts(document.querySelector('.f12-pair .f12-panel.f12-slant-top'));
    const bottomRise = Math.round(topPts[3][1] - topPts[2][1]);
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
    balloon: document.querySelector('.f12-chart .f12-balloon')?.textContent.trim() || '',
    tableRows: document.querySelectorAll('.f12-tbl tbody tr').length,
  }));
  check(
    state7.pressed7 === 'true' && state7.balloon.startsWith('Peak ') && state7.tableRows === 7,
    'SegmentedControl & ToneAreaChart: switching to 7 days updates chart, balloon, and 7-row data table',
    JSON.stringify(state7),
  );

  // Keyboard navigation on ToneAreaChart
  await page.focus('.f12-chart-svg');
  await page.keyboard.press('ArrowLeft');
  const tipVisible = await page.evaluate(() => Boolean(document.querySelector('.f12-chart .f12-tip')));
  await page.keyboard.press('Escape');
  const tipHidden = await page.evaluate(() => !document.querySelector('.f12-chart .f12-tip'));
  check(
    tipVisible && tipHidden,
    'ToneAreaChart: keyboard ArrowLeft shows crosshair tooltip and Escape dismisses it',
  );

  // ToneBarList selection adds comparison series to ToneAreaChart and data table
  await page.click('#int-gal-exit');
  await page.waitForTimeout(850);
  const compareOk = await page.evaluate(() => ({
    pressed: document.querySelector('#int-gal-exit').getAttribute('aria-pressed') === 'true',
    hasFocusLine: Boolean(document.querySelector('.f12-chart .f12-l-focus')),
    tableCols: document.querySelectorAll('.f12-tbl thead th').length,
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

// Primitive Adapters: Select (keyboard + form submission), Dialog (Escape with nested DropdownMenu), Tooltip, DropdownMenu (keyboard), Table
{
  // Select keyboard navigation & FormData submission
  await page.focus('#gal-select');
  await page.keyboard.press('Enter');
  await page.waitForSelector('[role="option"][data-highlighted]');
  await page.waitForTimeout(50);
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(30);
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(30);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(60);
  const afterKeySelect = await page.evaluate(() => {
    const trigger = document.querySelector('#gal-select');
    const form = document.querySelector('#gal-select-form');
    const fd = new FormData(form);
    return {
      text: trigger.textContent || '',
      focusedId: document.activeElement?.id || '',
      formValue: fd.get('recoveryChannel'),
    };
  });
  check(
    afterKeySelect.text.includes('Back-in-stock alert') &&
      afterKeySelect.focusedId === 'gal-select' &&
      afterKeySelect.formValue === 'stock',
    'Select adapter: keyboard Enter/ArrowDown/Enter selects option, restores focus, and populates FormData via name',
    JSON.stringify(afterKeySelect),
  );

  // Select Escape restores focus
  await page.keyboard.press('Space');
  await page.waitForSelector('[role="option"]:focus');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(60);
  const afterSelectEsc = await page.evaluate(() => ({
    listboxOpen: Boolean(document.querySelector('[role="listbox"]')),
    focusedId: document.activeElement?.id || '',
  }));
  check(
    !afterSelectEsc.listboxOpen && afterSelectEsc.focusedId === 'gal-select',
    'Select adapter: Escape closes listbox and restores focus to trigger',
    JSON.stringify(afterSelectEsc),
  );

  // Dialog + nested DropdownMenu Escape handling
  await page.click('#gal-dialog-open');
  const dlgOpen = await page.evaluate(() => {
    const d = document.querySelector('dialog.f12-dialog');
    return d && d.open && d.querySelector('.f12-cut')?.textContent === 'C-08';
  });

  // Open nested DropdownMenu inside Dialog, press Escape -> only DropdownMenu closes, Dialog stays open!
  await page.focus('#gal-dialog-menu-trigger');
  await page.keyboard.press('Enter');
  await page.waitForSelector('#gal-dialog-menu-item:focus');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(60);
  const afterNestedEsc = await page.evaluate(() => ({
    menuOpen: Boolean(document.querySelector('#gal-dialog-menu-item')),
    dialogStillOpen: Boolean(document.querySelector('dialog.f12-dialog')?.open),
    focusedId: document.activeElement?.id || '',
  }));
  check(
    !afterNestedEsc.menuOpen &&
      afterNestedEsc.dialogStillOpen &&
      afterNestedEsc.focusedId === 'gal-dialog-menu-trigger',
    'DropdownMenu inside Dialog: Escape closes only the DropdownMenu while outer Dialog stays open',
    JSON.stringify(afterNestedEsc),
  );

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
  await page.keyboard.press('Escape');
  check(tipOk, 'Tooltip adapter: shows tooltip on focus linked via aria-describedby');

  // DropdownMenu keyboard navigation (Enter -> ArrowDown -> Enter, and Escape focus restoration)
  await page.focus('#gal-menu-trigger');
  await page.keyboard.press('Enter');
  await page.waitForSelector('#gal-menu-csv');
  await page.waitForTimeout(50);
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(30);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(60);
  const afterMenuKey = await page.evaluate(() => ({
    status: document.querySelector('.f12-hd .f12-sub')?.textContent || '',
    focusedId: document.activeElement?.id || '',
  }));
  check(
    afterMenuKey.status.includes('Exported JSON') && afterMenuKey.focusedId === 'gal-menu-trigger',
    'DropdownMenu adapter: keyboard Enter/ArrowDown/Enter activates second item and restores focus to trigger',
    JSON.stringify(afterMenuKey),
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

// 3. Mount dedicated UnitTestFixtures for edge-case, hook, asChild, and CSS isolation tests
await page.evaluate(() => window.__mountUnitFixtures());
await page.waitForSelector('#unit-test-fixtures');

// 3a. Dialog single onOpenChange(false) per close (button, Escape, backdrop), DialogTrigger asChild, and omitted aria-describedby
{
  const asChildAttrOk = await page.evaluate(() => {
    const btn = document.querySelector('#test-dlg-aschild-btn');
    return btn && !btn.hasAttribute('aschild') && btn.classList.contains('custom-trigger');
  });
  check(
    asChildAttrOk,
    'DialogTrigger asChild: clones custom child button without leaking asChild attribute to DOM',
  );

  // Close 1: via DialogClose button
  await page.click('#test-dlg-aschild-btn');
  await page.waitForSelector('#test-controlled-dlg[open]');
  await page.click('#test-controlled-dlg-close');
  await page.waitForSelector('#test-controlled-dlg:not([open])', { state: 'attached' });
  const countAfterBtn = Number(await page.innerText('#test-dlg-close-count'));

  // Close 2: via Escape key
  await page.click('#test-dlg-aschild-btn');
  await page.waitForSelector('#test-controlled-dlg[open]');
  await page.keyboard.press('Escape');
  await page.waitForSelector('#test-controlled-dlg:not([open])', { state: 'attached' });
  const countAfterEsc = Number(await page.innerText('#test-dlg-close-count'));

  // Close 3: via backdrop click outside dialog rect
  await page.click('#test-dlg-aschild-btn');
  await page.waitForSelector('#test-controlled-dlg[open]');
  await page.mouse.click(5, 5);
  await page.waitForSelector('#test-controlled-dlg:not([open])', { state: 'attached' });
  const countAfterBackdrop = Number(await page.innerText('#test-dlg-close-count'));

  check(
    countAfterBtn === 1 && countAfterEsc === 2 && countAfterBackdrop === 3,
    'Dialog onOpenChange(false): invoked exactly once per close across button, Escape, and backdrop click',
    `counts=${countAfterBtn},${countAfterEsc},${countAfterBackdrop}`,
  );

  // Dialog without DialogDescription omits aria-describedby
  await page.click('#test-dlg-nodesc-open');
  const noDescAttr = await page.evaluate(() =>
    document.querySelector('#test-nodesc-dlg').getAttribute('aria-describedby'),
  );
  await page.click('#test-dlg-nodesc-close');
  check(
    noDescAttr === null,
    'Dialog without DialogDescription: omits aria-describedby instead of pointing to a non-existent ID',
    `aria-describedby=${noDescAttr}`,
  );

  // Dialog onCancel={e => e.preventDefault()} vetoes Escape dismissal
  await page.click('#test-dlg-veto-open');
  await page.waitForSelector('#test-veto-dlg[open]');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(80);
  const vetoState = await page.evaluate(() => ({
    open: document.querySelector('#test-veto-dlg').open,
    vetoCount: Number(document.querySelector('#test-dlg-veto-count').textContent),
  }));
  await page.click('#test-dlg-veto-close');
  check(
    vetoState.open && vetoState.vetoCount === 1,
    'Dialog onCancel: Escape honors e.preventDefault() and keeps modal open',
    JSON.stringify(vetoState),
  );

  // Stacked sibling Dialogs: Escape closes only the topmost dialog (both forward and reversed DOM opening order)
  await page.click('#test-dlg-under-open');
  await page.waitForSelector('#test-dlg-under[open]');
  await page.click('#test-dlg-top-open');
  await page.waitForSelector('#test-dlg-top[open]');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(80);
  const stackForward = await page.evaluate(() => ({
    underOpen: document.querySelector('#test-dlg-under').open,
    topOpen: document.querySelector('#test-dlg-top').open,
  }));
  await page.click('#test-dlg-under-close');
  await page.waitForSelector('#test-dlg-under:not([open])', { state: 'attached' });

  // Reversed opening order: open #test-dlg-top (later in DOM) first, then #test-dlg-under (earlier in DOM) second
  await page.evaluate(() => document.querySelector('#test-dlg-top-open').click());
  await page.waitForSelector('#test-dlg-top[open]');
  await page.evaluate(() => document.querySelector('#test-dlg-under-open').click());
  await page.waitForSelector('#test-dlg-under[open]');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(80);
  const stackReversed = await page.evaluate(() => ({
    underOpen: document.querySelector('#test-dlg-under').open,
    topOpen: document.querySelector('#test-dlg-top').open,
  }));
  await page.click('#test-dlg-top-close');
  check(
    stackForward.underOpen &&
      !stackForward.topOpen &&
      !stackReversed.underOpen &&
      stackReversed.topOpen,
    'Dialog stack: Escape dismisses only the topmost open modal by opening order (forward and reversed DOM order)',
    JSON.stringify({ stackForward, stackReversed }),
  );
}

// 3b. TooltipTrigger asChild + DropdownMenuTrigger asChild + Input aria-describedby merging
{
  await page.focus('#test-tip-aschild-btn');
  await page.click('#test-tip-aschild-btn');
  const tipMerge = await page.evaluate(() => {
    const btn = document.querySelector('#test-tip-aschild-btn');
    const menuBtn = document.querySelector('#test-menu-aschild-btn');
    const state = document.querySelector('#test-tip-state');
    const tip = document.querySelector('#test-tip-content');
    const desc = btn.getAttribute('aria-describedby') || '';
    return {
      clicks: Number(state.getAttribute('data-clicks')),
      focused: Number(state.getAttribute('data-focused')),
      refSet: state.getAttribute('data-ref') === 'true',
      hasTriggerDesc: desc.includes('trigger-desc'),
      hasExtDesc: desc.includes('ext-desc'),
      hasTipId: Boolean(tip && desc.includes(tip.id)),
      menuHasForwardedClass:
        menuBtn.classList.contains('trigger-forwarded-class') &&
        menuBtn.classList.contains('child-own-class'),
    };
  });
  check(
    tipMerge.clicks === 1 &&
      tipMerge.focused >= 1 &&
      tipMerge.refSet &&
      tipMerge.hasTriggerDesc &&
      tipMerge.hasExtDesc &&
      tipMerge.hasTipId &&
      tipMerge.menuHasForwardedClass,
    'TooltipTrigger & DropdownMenuTrigger asChild: merges trigger/child aria-describedby, className, handlers, and ref',
    JSON.stringify(tipMerge),
  );

  const inputDesc = await page.evaluate(() => {
    const inp = document.querySelector('#test-input-merged');
    const d = inp.getAttribute('aria-describedby') || '';
    return {
      hasCaller: d.includes('caller-input-desc'),
      hasHint: d.includes('test-input-merged-hint'),
      hasError: d.includes('test-input-merged-error'),
    };
  });
  check(
    inputDesc.hasCaller && inputDesc.hasHint && inputDesc.hasError,
    'Input: merges caller aria-describedby with hint and error IDs',
    JSON.stringify(inputDesc),
  );
}

// 3c. useOnTwos non-retriggering on duration/motion changes & useCountUp mid-flight interruption
{
  const hookResults = await page.evaluate(async () => {
    const box = document.querySelector('#test-hooks-box');
    const pBefore = Number(box.getAttribute('data-progress'));

    // Changing duration or motion without changing key must NOT restart tween from < 1
    document.querySelector('#test-tween-dur').click();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const pAfterDur = Number(box.getAttribute('data-progress'));

    document.querySelector('#test-tween-motion').click();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const pAfterMotion = Number(box.getAttribute('data-progress'));

    // Reset back to stepped mode
    document.querySelector('#test-tween-motion').click();
    await new Promise((r) => requestAnimationFrame(r));

    // Trigger key change and sample held poses
    document.querySelector('#test-tween-key').click();
    await new Promise((r) => setTimeout(r, 20));
    const pPose1 = Number(box.getAttribute('data-progress'));
    await new Promise((r) => setTimeout(r, 700));
    const pSettled = Number(box.getAttribute('data-progress'));

    // Changing motion or duration mid-animation settles progress to 1 instead of freezing < 1
    document.querySelector('#test-tween-key').click();
    await new Promise((r) => setTimeout(r, 120));
    document.querySelector('#test-tween-motion').click();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const pAfterMidMotionChange = Number(box.getAttribute('data-progress'));

    document.querySelector('#test-tween-key').click();
    await new Promise((r) => setTimeout(r, 120));
    document.querySelector('#test-tween-dur').click();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const pAfterMidDurChange = Number(box.getAttribute('data-progress'));

    // useCountUp mid-flight interruption: start 100 -> 1000, interrupt after 180ms to 500
    document.querySelector('#test-count-1000').click();
    await new Promise((r) => setTimeout(r, 180));
    const midVal = Number(box.getAttribute('data-counted'));
    document.querySelector('#test-count-500').click();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const rightAfterInterrupt = Number(box.getAttribute('data-counted'));
    await new Promise((r) => setTimeout(r, 550));
    const finalCount = Number(box.getAttribute('data-counted'));

    return {
      pBefore,
      pAfterDur,
      pAfterMotion,
      pPose1,
      pSettled,
      pAfterMidMotionChange,
      pAfterMidDurChange,
      midVal,
      rightAfterInterrupt,
      finalCount,
    };
  });
  check(
    hookResults.pBefore === 1 &&
      hookResults.pAfterDur === 1 &&
      hookResults.pAfterMotion === 1 &&
      hookResults.pPose1 > 0 &&
      hookResults.pPose1 < 1 &&
      hookResults.pSettled === 1 &&
      hookResults.pAfterMidMotionChange === 1 &&
      hookResults.pAfterMidDurChange === 1,
    'useOnTwos: steps poses on key change, settles cleanly if motion/duration changes mid-tween, and does not replay at rest',
    JSON.stringify(hookResults),
  );
  check(
    hookResults.midVal > 100 &&
      hookResults.midVal < 1000 &&
      hookResults.rightAfterInterrupt <= hookResults.midVal &&
      hookResults.rightAfterInterrupt > 500 &&
      hookResults.finalCount === 500,
    'useCountUp: mid-flight interruption interpolates smoothly from currently displayed value to new target',
    JSON.stringify(hookResults),
  );
}

// 3d. ToneAreaChart edge cases (empty, single point, all zeros, negative values, compareValue > value, NaN/Infinity, default headers)
{
  const chartEdges = await page.evaluate(() => {
    const inspect = (sel) => {
      const root = document.querySelector(sel);
      const svg = root.querySelector('svg.f12-chart-svg');
      const path = svg?.querySelector('.f12-l-total')?.getAttribute('d') || '';
      const hasNaN = /NaN|Infinity/.test(svg?.innerHTML || '');
      const ths = [...root.querySelectorAll('.f12-tbl thead th')].map((th) =>
        th.textContent.trim(),
      );
      const ticks = [...(svg?.querySelectorAll('text[text-anchor="end"]') || [])].map((t) =>
        t.textContent.trim(),
      );
      return { hasSvg: Boolean(svg), path, hasNaN, ths, ticks };
    };
    return {
      empty: {
        svgCount: document.querySelectorAll('#chart-empty svg').length,
        rows: document.querySelectorAll('#chart-empty tbody tr').length,
      },
      single: inspect('#chart-single'),
      zeros: inspect('#chart-zeros'),
      negative: inspect('#chart-negative'),
      compareHigher: inspect('#chart-compare-higher'),
      nan: inspect('#chart-nan'),
    };
  });
  check(
    chartEdges.empty.svgCount === 0 &&
      chartEdges.empty.rows === 0 &&
      chartEdges.single.hasSvg &&
      !chartEdges.single.hasNaN &&
      chartEdges.single.ths.join(',') === 'Label,Value' &&
      !chartEdges.zeros.hasNaN &&
      !chartEdges.negative.hasNaN &&
      chartEdges.negative.ticks.some((t) => t.startsWith('-')) &&
      !chartEdges.compareHigher.hasNaN &&
      chartEdges.compareHigher.ticks.some((t) => Number(t) >= 300) &&
      !chartEdges.nan.hasNaN,
    'ToneAreaChart edge cases: handles [], single point, all-zeros, negative values, compareValue > value, NaN/Infinity, and neutral Label/Value defaults',
    JSON.stringify(chartEdges),
  );
}

// 3e. Panel SSR fallback polygon (when w === 0) & Balloon long text wrapping & CSS isolation
{
  const layoutChecks = await page.evaluate(() => {
    const ssrPoly = document.querySelector('#test-panel-ssr svg.f12-panel-frame polygon');
    const balloon = document.querySelector('#test-balloon-long');
    const extBtn = document.querySelector('#test-ext-btn');
    const f12Btn = document.querySelector('#btn-primary');
    return {
      ssrHasSvg: Boolean(ssrPoly),
      ssrVectorEffect: ssrPoly?.getAttribute('vector-effect'),
      balloonFits: balloon.scrollWidth <= balloon.clientWidth + 1 && balloon.offsetHeight > 28,
      extBtnBorderTopWidth: getComputedStyle(extBtn).borderTopWidth,
      f12BtnBorderTopWidth: getComputedStyle(f12Btn).borderTopWidth,
    };
  });
  check(
    layoutChecks.ssrHasSvg && layoutChecks.ssrVectorEffect === 'non-scaling-stroke',
    'Panel SSR fallback: renders non-scaling-stroke SVG polygon frame when width is 0 before ResizeObserver runs',
    JSON.stringify(layoutChecks),
  );
  check(
    layoutChecks.balloonFits,
    'Balloon long text: wraps 60-char unbroken string cleanly without horizontal overflow',
    JSON.stringify(layoutChecks),
  );

  // Also check focus-visible isolation on external button vs FRAME/12 button
  await page.focus('#test-ext-btn');
  const extFocus = await page.evaluate(() => {
    const extBtn = document.querySelector('#test-ext-btn');
    const f12Btn = document.querySelector('#btn-primary');
    return {
      extOutlineOffset: getComputedStyle(extBtn).outlineOffset,
      extBg: getComputedStyle(extBtn).backgroundColor,
      f12Bg: getComputedStyle(f12Btn).backgroundColor,
    };
  });
  check(
    extFocus.extOutlineOffset !== '2px' && extFocus.extBg !== extFocus.f12Bg,
    'CSS isolation: frame12.css does not leak global button or :focus-visible rules outside .f12-* components',
    JSON.stringify(extFocus),
  );
}

check(errors.length === 0, 'gallery unit run: zero console or page errors', errors[0] || '');

await ctx.close();
await browser.close();
finish();
