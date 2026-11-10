// Functional, component, adapter, hook, and grammar unit tests for @frame12/registry.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  launch,
  openGallery,
  getRenderedCuts,
  REGISTRY_ROOT,
  REPO_ROOT,
  check,
  finish,
} from './lib.mjs';

// 1. Static checks: Tokens (no hard-coded colors/fonts outside styles/), Registry JSONs, No named artists
{
  const uiFiles = readdirSync(resolve(REGISTRY_ROOT, 'ui')).map((f) =>
    resolve(REGISTRY_ROOT, 'ui', f),
  );
  const blockFiles = existsSync(resolve(REGISTRY_ROOT, 'blocks'))
    ? readdirSync(resolve(REGISTRY_ROOT, 'blocks')).map((f) =>
        resolve(REGISTRY_ROOT, 'blocks', f),
      )
    : [];
  const hookFiles = readdirSync(resolve(REGISTRY_ROOT, 'hooks')).map((f) =>
    resolve(REGISTRY_ROOT, 'hooks', f),
  );
  const codeFiles = [...uiFiles, ...blockFiles, ...hookFiles];

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
    missingJson.length === 0 && reg.items.length >= 28,
    `shadcn registry: ${reg.items.length} items emitted to site/public/r/*.json`,
    missingJson.join(', '),
  );

  // Verify every registry item has explicit target paths (or font config), includes frame12-styles (directly or via registryDependencies), and has no conflicting bare shadcn registryDependencies
  const conflictingShadcnNames = new Set([
    'button',
    'input',
    'textarea',
    'checkbox',
    'radio-group',
    'switch',
    'field',
    'tabs',
    'badge',
    'dialog',
    'select',
    'tooltip',
    'dropdown-menu',
    'table',
  ]);
  const manifestIssues = [];
  for (const item of reg.items) {
    if (item.type === 'registry:font') {
      if (!item.font || !item.font.family || !item.font.variable) {
        manifestIssues.push(`${item.name}: invalid registry:font metadata`);
      }
      continue;
    }
    if (!Array.isArray(item.files) || item.files.length === 0 || !item.files.every((f) => Boolean(f.target))) {
      manifestIssues.push(`${item.name}: missing file target`);
      continue;
    }
    const hasDirectStyles = item.files.some(
      (f) => f.path === 'styles/frame12.css' && f.target === 'styles/frame12.css',
    );
    const hasDirectTokens = item.files.some(
      (f) => f.path === 'styles/frame12-tokens.css' && f.target === 'styles/frame12-tokens.css',
    );
    const hasDepStyles =
      Array.isArray(item.registryDependencies) &&
      item.registryDependencies.includes('https://frame12.dev/r/frame12-styles.json');
    if (item.name === 'frame12-tokens' && (!hasDirectTokens || item.type !== 'registry:ui')) {
      manifestIssues.push(`${item.name}: must be registry:ui with styles/frame12-tokens.css`);
    }
    // Pure hook items (no markup, no classes) do not need the stylesheet.
    if (
      item.name !== 'use-on-twos' &&
      item.name !== 'use-tempo' &&
      item.name !== 'frame12-tokens' &&
      !hasDirectStyles &&
      !hasDepStyles
    ) {
      manifestIssues.push(`${item.name}: missing styles/frame12.css (direct or registryDependencies)`);
    }
    if (
      Array.isArray(item.registryDependencies) &&
      item.registryDependencies.some((d) => conflictingShadcnNames.has(d))
    ) {
      manifestIssues.push(`${item.name}: conflicting bare registryDependencies`);
    }
  }
  check(
    manifestIssues.length === 0,
    'registry manifest: explicit targets, frame12-styles dependency/file included, registry:font valid, and zero conflicting bare registryDependencies',
    manifestIssues.join('; '),
  );
}

// 2. Browser tests against gallery.html
const browser = await launch();
const isChromium = browser.browserType().name() === 'chromium';
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
  const labels = isChromium
    ? await getRenderedCuts(page, { rootId: 'gallery-sheet', panelsOnly: true })
    : null;
  const orderInfo = await page.evaluate(() => {
    const els = [...document.querySelectorAll('#gallery-sheet .f12-panel > .f12-cut')].filter(
      (e) => getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0,
    );
    const rects = els.map((e) => {
      const r = e.getBoundingClientRect();
      return { top: Math.round(r.top), left: Math.round(r.left) };
    });
    let readingOrder = els.length === 7;
    for (let i = 1; i < rects.length; i++) {
      const prev = rects[i - 1];
      const cur = rects[i];
      const sameRow = Math.abs(cur.top - prev.top) < 40;
      if (sameRow && cur.left < prev.left) readingOrder = false;
      if (!sameRow && cur.top < prev.top - 40) readingOrder = false;
    }
    return { count: els.length, readingOrder };
  });
  check(
    orderInfo.count === 7 &&
      orderInfo.readingOrder &&
      (!isChromium || labels.join(',') === 'C-01,C-02,C-03,C-04,C-05,C-06,C-07'),
    'rule 3: Cut numbers C-01..C-07 match DOM order and visual reading order',
    isChromium ? labels.join(', ') : `count=${orderInfo.count} readingOrder=${orderInfo.readingOrder}`,
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

  // Rejected controlled DialogTrigger open followed by programmatic open from another focused control
  // must discard the rejected trigger and restore focus to the control that was focused when opened.
  await page.click('#test-dlg-reject-toggle');
  await page.click('#test-dlg-aschild-btn');
  const stayedClosedOnReject = await page.evaluate(
    () => !document.querySelector('#test-controlled-dlg').open,
  );
  await page.focus('#test-dlg-prog-open');
  await page.keyboard.press('Enter');
  await page.waitForSelector('#test-controlled-dlg[open]');
  await page.keyboard.press('Escape');
  await page.waitForSelector('#test-controlled-dlg:not([open])', { state: 'attached' });
  const afterRejectedThenProg = await page.evaluate(() => ({
    activeId: document.activeElement?.id || '',
  }));
  await page.click('#test-dlg-reject-toggle');
  check(
    stayedClosedOnReject && afterRejectedThenProg.activeId === 'test-dlg-prog-open',
    'Dialog controlled rejected open: discards rejected DialogTrigger capture when later opened programmatically from another focused control',
    JSON.stringify({ stayedClosedOnReject, ...afterRejectedThenProg }),
  );

  // Conditionally mounted {open && <DialogContent>} closed via DialogClose restores focus to trigger
  await page.click('#test-dlg-cond-open');
  await page.waitForSelector('#test-cond-dlg[open]');
  await page.click('#test-dlg-cond-close');
  await page.waitForFunction(() => !document.querySelector('#test-cond-dlg'));
  const afterCondClose = await page.evaluate(() => ({
    unmounted: !document.querySelector('#test-cond-dlg'),
    activeId: document.activeElement?.id || '',
  }));
  check(
    afterCondClose.unmounted && afterCondClose.activeId === 'test-dlg-cond-open',
    'Dialog conditionally mounted DialogContent: restores focus to trigger when DialogClose unmounts DialogContent',
    JSON.stringify(afterCondClose),
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
  await page.click('#test-dlg-top-trigger');
  await page.waitForSelector('#test-dlg-top[open]');
  await page.click('#test-dlg-under-from-top');
  await page.waitForSelector('#test-dlg-under[open]');
  // Trigger a parent state update & rerender with inline onOpenChange while both dialogs are open
  await page.click('#test-dlg-under-rerender');
  await page.waitForTimeout(30);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(80);
  const stackReversed = await page.evaluate(() => ({
    underOpen: document.querySelector('#test-dlg-under').open,
    topOpen: document.querySelector('#test-dlg-top').open,
  }));

  // Host native <dialog> opened via showModal() above an open FRAME/12 <Dialog>:
  // pressing Escape must NOT close the underlying FRAME/12 dialog.
  const nativeStack = await page.evaluate(() => {
    const hostDlg = document.createElement('dialog');
    hostDlg.id = 'test-host-native-dlg';
    document.body.appendChild(hostDlg);
    hostDlg.showModal();
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
    const f12StillOpen = document.querySelector('#test-dlg-top').open;
    hostDlg.close();
    hostDlg.remove();
    return { f12StillOpen };
  });

  await page.click('#test-dlg-top-close');
  check(
    stackForward.underOpen &&
      !stackForward.topOpen &&
      !stackReversed.underOpen &&
      stackReversed.topOpen &&
      nativeStack.f12StillOpen,
    'Dialog stack: Escape dismisses only the topmost open modal (forward/reversed DOM order, after rerender, and beneath host native <dialog>)',
    JSON.stringify({ stackForward, stackReversed, nativeStack }),
  );
}

// 3b. TooltipTrigger asChild + DropdownMenuTrigger asChild + Input aria-describedby merging
{
  await page.click('#test-tip-aschild-btn');
  await page.focus('#test-tip-aschild-btn');
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

  // Automatic cut numbering (<Sheet autoCut>) fixtures
  {
    const compCuts = isChromium ? await getRenderedCuts(page, 'fixture-autocut-composition') : null;
    const slantTopPos = await page.evaluate(() => {
      const visibleCuts = [
        ...document.querySelectorAll('#fixture-autocut-composition .f12-panel > .f12-cut'),
      ].filter((e) => getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0);
      const slantTopCut = document.querySelector(
        '#fixture-autocut-pair .f12-panel.f12-slant-top > .f12-cut',
      );
      const rectCut = document.querySelector(
        '#fixture-autocut-pair .f12-panel.f12-slant-bottom > .f12-cut',
      );
      const cutFalseSpan = document.querySelector('#fixture-autocut-false > .f12-cut');
      return {
        visibleCount: visibleCuts.length,
        slantTopPx: slantTopCut ? getComputedStyle(slantTopCut).top : null,
        rectTopPx: rectCut ? getComputedStyle(rectCut).top : null,
        cutFalseHasSpan: Boolean(cutFalseSpan),
      };
    });
    check(
      slantTopPos.visibleCount === 7 &&
        (!isChromium || compCuts.join(',') === 'C-01,C-02,C-03,C-04,C-05,C-06,C-07') &&
        !slantTopPos.cutFalseHasSpan &&
        slantTopPos.slantTopPx === '8px' &&
        slantTopPos.rectTopPx === '-8px',
      '<Sheet autoCut>: numbers nested wrappers, PanelPair (slant-top at top: 8px), and .map() while skipping display:none and cut={false}',
      `cuts=${compCuts ? compCuts.join(',') : slantTopPos.visibleCount} pos=${JSON.stringify(slantTopPos)}`,
    );

    // Nested non-auto Sheet inside auto Sheet, and auto Sheet inside non-auto Sheet
    if (isChromium) {
      const outerAutoDirect = await getRenderedCuts(page, {
        directSheetId: 'fixture-nested-outer-auto',
      });
      const innerNonAutoDirect = await getRenderedCuts(page, {
        directSheetId: 'fixture-nested-inner-nonauto',
      });
      const outerNonAutoDirect = await getRenderedCuts(page, {
        directSheetId: 'fixture-nested-outer-nonauto',
      });
      const innerAutoDirect = await getRenderedCuts(page, {
        directSheetId: 'fixture-nested-inner-auto',
      });
      check(
        outerAutoDirect.join(',') === 'C-01,C-02' &&
          innerNonAutoDirect.join(',') === 'C-01' &&
          outerNonAutoDirect.length === 0 &&
          innerAutoDirect.join(',') === 'C-01,C-02',
        '<Sheet autoCut> nesting: non-auto inside auto turns off auto-cuts and outer continues; auto inside non-auto numbers inner only',
        JSON.stringify({
          outerAutoDirect,
          innerNonAutoDirect,
          outerNonAutoDirect,
          innerAutoDirect,
        }),
      );
    } else {
      const nestedCountInfo = await page.evaluate(() => {
        const directVisibleCuts = (sheetId) =>
          [...document.querySelectorAll(`#${sheetId} .f12-cut`)].filter((el) => {
            const nearestFrame = el.closest('.f12-frame, .f12-sheet');
            const frameWithId =
              nearestFrame && nearestFrame.id
                ? nearestFrame
                : nearestFrame?.parentElement || null;
            return (
              frameWithId?.id === sheetId &&
              getComputedStyle(el).display !== 'none' &&
              el.getBoundingClientRect().width > 0
            );
          }).length;
        return {
          outerAutoCount: directVisibleCuts('fixture-nested-outer-auto'),
          innerNonAutoCount: directVisibleCuts('fixture-nested-inner-nonauto'),
          outerNonAutoCount: directVisibleCuts('fixture-nested-outer-nonauto'),
          innerAutoCount: directVisibleCuts('fixture-nested-inner-auto'),
        };
      });
      check(
        nestedCountInfo.outerAutoCount === 2 &&
          nestedCountInfo.innerNonAutoCount === 1 &&
          nestedCountInfo.outerNonAutoCount === 0 &&
          nestedCountInfo.innerAutoCount === 2,
        '<Sheet autoCut> nesting: non-auto inside auto turns off auto-cuts and outer continues; auto inside non-auto numbers inner only',
        JSON.stringify(nestedCountInfo),
      );
    }

    // Open dialog with explicit cut="C-08": panel numbers in #gallery-sheet stay unchanged
    await page.click('#gal-dialog-open');
    await page.waitForSelector('dialog.f12-dialog[open]');
    if (isChromium) {
      const cutsWithOpenDialog = await getRenderedCuts(page, 'gallery-sheet');
      const panelOnlyWithOpenDialog = await getRenderedCuts(page, {
        rootId: 'gallery-sheet',
        panelsOnly: true,
      });
      await page.click('#gal-dialog-close');
      check(
        panelOnlyWithOpenDialog.join(',') === 'C-01,C-02,C-03,C-04,C-05,C-06,C-07' &&
          cutsWithOpenDialog.includes('C-08') &&
          cutsWithOpenDialog.length === 8,
        '<Sheet autoCut> + Dialog: opening explicit DialogContent cut="C-08" leaves panel numbers C-01..C-07 unchanged',
        cutsWithOpenDialog.join(','),
      );
    } else {
      const dlgInfo = await page.evaluate(() => {
        const panelCuts = [...document.querySelectorAll('#gallery-sheet .f12-panel > .f12-cut')].filter(
          (e) => getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0,
        ).length;
        const dlgCut = document.querySelector('dialog.f12-dialog[open] .f12-cut')?.textContent?.trim();
        return { panelCuts, dlgCut };
      });
      await page.click('#gal-dialog-close');
      check(
        dlgInfo.panelCuts === 7 && dlgInfo.dlgCut === 'C-08',
        '<Sheet autoCut> + Dialog: opening explicit DialogContent cut="C-08" leaves panel count (7) unchanged',
        JSON.stringify(dlgInfo),
      );
    }

    // Dev warning fires once in development (even across re-renders) and zero times in production
    const devWarnings = await page.evaluate(() => window.__testAutoCutWarning('development'));
    const prodWarnings = await page.evaluate(() => window.__testAutoCutWarning('production'));
    check(
      devWarnings.length === 1 &&
        devWarnings[0].includes('C-09') &&
        prodWarnings.length === 0,
      '<Sheet autoCut> mixing warning: logs console.warn once with cut value in development and zero times in production',
      JSON.stringify({ devWarnings, prodWarnings }),
    );

    // 3m. WP3: Expressive/Quiet Panels, Semantic Statuses, Pattern Differentiation & Compact Density
    const wp3Check = await page.evaluate(() => {
      const quietPanel = document.querySelector('#fixture-autocut-quiet');
      const quietHasSvg = Boolean(quietPanel?.querySelector('.f12-panel-frame'));
      const quietHasCut = Boolean(quietPanel?.querySelector('.f12-cut'));
      const quietBorder = quietPanel ? getComputedStyle(quietPanel).borderTopWidth : '0px';

      const quietPairPanels = [...document.querySelectorAll('#fixture-wp3-quiet-pair .f12-panel')];
      const quietPairAllRect =
        quietPairPanels.length === 2 &&
        quietPairPanels.every(
          (p) =>
            p.classList.contains('f12-panel-quiet') &&
            p.classList.contains('f12-rect') &&
            !p.querySelector('.f12-panel-frame') &&
            !p.querySelector('.f12-cut'),
        );

      const quietMetric = document.querySelector('#fixture-wp3-quiet-pair .f12-metric-quiet .f12-m-value');
      const quietMetricFontSize = quietMetric ? getComputedStyle(quietMetric).fontSize : '0px';

      const tagInfo = document.querySelector('#fixture-tag-info .f12-status-glyph')?.textContent;
      const tagSuccess = document.querySelector('#fixture-tag-success .f12-status-glyph')?.textContent;
      const tagWarning = document.querySelector('#fixture-tag-warning .f12-status-glyph')?.textContent;
      const tagDanger = document.querySelector('#fixture-tag-danger .f12-status-glyph')?.textContent;
      const tagNeutralGlyph = document.querySelector('#fixture-tag-neutral .f12-status-glyph');
      const tagSuppressedGlyph = document.querySelector('#fixture-tag-no-glyph .f12-status-glyph');

      const tagWarningEl = document.querySelector('#fixture-tag-warning');
      const warningBg = tagWarningEl ? getComputedStyle(tagWarningEl).backgroundColor : '';
      const warningBgImg = tagWarningEl ? getComputedStyle(tagWarningEl).backgroundImage : '';

      const statusSyncOk = [
        ['neutral', '#fixture-tag-neutral', '#fixture-badge-neutral', undefined, undefined],
        ['info', '#fixture-tag-info', '#fixture-badge-info', '[i]', 'Info: '],
        ['success', '#fixture-tag-success', '#fixture-badge-status', '[+]', 'Success: '],
        ['warning', '#fixture-tag-warning', '#fixture-badge-burst', '[!]', 'Warning: '],
        ['danger', '#fixture-tag-danger', '#fixture-badge-danger', '[×]', 'Error: '],
      ].every(([, tagSel, badgeSel, expectedGlyph, expectedSr]) => {
        const tG = document.querySelector(`${tagSel} .f12-status-glyph`)?.textContent;
        const bG = document.querySelector(`${badgeSel} .f12-status-glyph`)?.textContent;
        const tSr = document.querySelector(`${tagSel} .f12-sr-only`)?.textContent;
        const bSr = document.querySelector(`${badgeSel} .f12-sr-only`)?.textContent;
        return tG === expectedGlyph && bG === expectedGlyph && tSr === expectedSr && bSr === expectedSr;
      });

      const badgeStatusBurst = document.querySelector('#fixture-badge-status .f12-burst');
      const badgeExplicitBurst = document.querySelector('#fixture-badge-burst .f12-burst');
      const badgeStatusGlyph = document.querySelector('#fixture-badge-status .f12-status-glyph')?.textContent;

      const nestedExpPoly = document.querySelector(
        '#fixture-nested-expressive-in-quiet > .f12-panel-frame > polygon',
      );
      const nestedExpStrokeWidth = nestedExpPoly ? getComputedStyle(nestedExpPoly).strokeWidth : '0px';
      const quietSlantTopBody = document.querySelector('#fixture-quiet-slant-top > .f12-panel-body');
      const quietSlantTopPad = quietSlantTopBody ? getComputedStyle(quietSlantTopBody).paddingTop : '0px';

      const customSrText = document.querySelector('#fixture-tag-custom-sr .f12-sr-only')?.textContent;
      const suppressedSrEl = document.querySelector('#fixture-tag-no-sr .f12-sr-only');
      const successorSrText = document.querySelector('#fixture-tag-successor .f12-sr-only')?.textContent;
      const erroredSrEl = document.querySelector('#fixture-tag-errored .f12-sr-only');
      const hiddenPrefixSrText = document.querySelector(
        '#fixture-tag-hidden-prefix .f12-sr-only',
      )?.textContent;
      const domHiddenPrefixSrText = document.querySelector(
        '#fixture-tag-dom-hidden-prefix .f12-sr-only',
      )?.textContent;
      const tagIconEl = document.querySelector('#fixture-tag-icon');
      const tagIconSvg = document.querySelector('#fixture-tag-icon svg');
      const badgeIconEl = document.querySelector('#fixture-badge-icon');
      const badgeIconSvg = document.querySelector('#fixture-badge-icon .f12-badge-t svg');
      const iconInlineOk = Boolean(
        tagIconEl &&
          tagIconSvg &&
          badgeIconEl &&
          badgeIconSvg &&
          getComputedStyle(tagIconSvg).display === 'inline-block' &&
          getComputedStyle(badgeIconSvg).display === 'inline-block' &&
          tagIconEl.getBoundingClientRect().height <= 26 &&
          badgeIconEl.getBoundingClientRect().height <= 26,
      );
      const tableTagEl = document.querySelector('#fixture-table-tag');
      const tableTagOneLine = tableTagEl ? tableTagEl.getBoundingClientRect().height <= 26 : false;
      const narrowTagEl = document.querySelector('#fixture-narrow-tag');
      const narrowBadgeEl = document.querySelector('#fixture-narrow-badge');
      const narrowWrapOk = (() => {
        if (!narrowTagEl || !narrowBadgeEl) return false;
        const tr = narrowTagEl.getBoundingClientRect();
        const tg = narrowTagEl.querySelector('.f12-status-glyph')?.getBoundingClientRect();
        const br = narrowBadgeEl.getBoundingClientRect();
        const bg = narrowBadgeEl.querySelector('.f12-status-glyph')?.getBoundingClientRect();
        return (
          Math.round(tr.width) <= 90 &&
          narrowTagEl.scrollWidth <= narrowTagEl.clientWidth &&
          Boolean(tg && tg.top - tr.top <= 8) &&
          Math.round(br.width) <= 90 &&
          narrowBadgeEl.scrollWidth <= narrowBadgeEl.clientWidth &&
          Boolean(bg && bg.top - br.top <= 8)
        );
      })();
      const glyphEl = document.querySelector('#fixture-tag-warning .f12-status-glyph');
      const srEl = document.querySelector('#fixture-tag-warning .f12-sr-only');
      const copyCleanOk =
        glyphEl &&
        srEl &&
        (getComputedStyle(glyphEl).userSelect === 'none' ||
          getComputedStyle(glyphEl).webkitUserSelect === 'none') &&
        (getComputedStyle(srEl).userSelect === 'none' ||
          getComputedStyle(srEl).webkitUserSelect === 'none');
      const successTagEl = document.querySelector('#fixture-tag-success');
      const successInlineStartBorder = successTagEl
        ? getComputedStyle(successTagEl).borderInlineStartWidth
        : '0px';

      const compactInput = document.querySelector('#fixture-input-compact');
      const compactSelect = document.querySelector('#fixture-select-compact');
      const compactTable = document.querySelector('#fixture-table-compact');
      const compactBars = document.querySelector('#fixture-wp3-patterns .f12-ints-compact');
      const compactFontSizesOk =
        compactInput &&
        compactSelect &&
        compactTable &&
        getComputedStyle(compactInput).fontSize === '13px' &&
        getComputedStyle(compactSelect).fontSize === '13px' &&
        getComputedStyle(compactTable).fontSize === '13px';
      const hatchFill = document.querySelector('#fixture-wp3-patterns .f12-int-fill-hatch');
      const denseFill = document.querySelector('#fixture-wp3-patterns .f12-int-fill-dense');

      return {
        quietIsQuietClass: quietPanel?.classList.contains('f12-panel-quiet') ?? false,
        quietHasSvg,
        quietHasCut,
        quietBorder,
        quietPairAllRect,
        quietMetricFontSize,
        nestedExpStrokeWidth,
        quietSlantTopPad,
        warningNotMarkerYellow:
          warningBg === 'rgb(255, 255, 255)' && warningBgImg.includes('linear-gradient'),
        statusSyncOk,
        srCustomOk:
          customSrText === '警告: ' &&
          !suppressedSrEl &&
          successorSrText === 'Success: ' &&
          !erroredSrEl &&
          hiddenPrefixSrText === 'Error: ' &&
          domHiddenPrefixSrText === 'Error: ' &&
          iconInlineOk,
        tableTagOneLine,
        narrowWrapOk,
        copyCleanOk: Boolean(copyCleanOk),
        successInlineStartBorder,
        glyphsOk:
          tagInfo === '[i]' &&
          tagSuccess === '[+]' &&
          tagWarning === '[!]' &&
          tagDanger === '[×]' &&
          !tagNeutralGlyph &&
          !tagSuppressedGlyph,
        badgeOk: !badgeStatusBurst && Boolean(badgeExplicitBurst) && badgeStatusGlyph === '[+]',
        compactOk:
          Boolean(compactInput?.classList.contains('f12-input-compact')) &&
          Boolean(compactSelect?.closest('.f12-select-compact')) &&
          Boolean(compactTable?.classList.contains('f12-table-compact')) &&
          Boolean(compactBars) &&
          Boolean(compactFontSizesOk) &&
          Boolean(hatchFill) &&
          Boolean(denseFill),
      };
    });
    check(
      wp3Check.quietIsQuietClass &&
        !wp3Check.quietHasSvg &&
        !wp3Check.quietHasCut &&
        wp3Check.quietBorder === '1px' &&
        wp3Check.quietPairAllRect &&
        wp3Check.quietMetricFontSize === '22px' &&
        wp3Check.nestedExpStrokeWidth === '2.5px' &&
        wp3Check.quietSlantTopPad === '32px' &&
        wp3Check.warningNotMarkerYellow &&
        wp3Check.statusSyncOk &&
        wp3Check.srCustomOk &&
        wp3Check.tableTagOneLine &&
        wp3Check.narrowWrapOk &&
        wp3Check.copyCleanOk &&
        wp3Check.successInlineStartBorder === '5px' &&
        wp3Check.glyphsOk &&
        wp3Check.badgeOk &&
        wp3Check.compactOk,
      'WP3 grammar: <Panel variant="quiet"> (1px rule, nested expressive keeps 2.5px, slant clearance 32px), <PanelPair variant="quiet">, <Metric variant="quiet">, non-yellow warning + synced Tag/Badge status glyphs ([i]/[+]/[!]/[×]) + srLabel/user-select:none + logical border-inline-start, bar patterns, and 13px compact density',
      JSON.stringify(wp3Check),
    );

    // 3n. WP4: Essential Form Kit (Field, Textarea, Checkbox, RadioGroup, Switch) & Tabs
    {
      // 1. Real <form>: FormData, required, form=, and reset
      await page.click('#wp4-form-submit');
      const initialFormJson = await page.innerText('#wp4-form-output');
      const initialFormData = JSON.parse(initialFormJson || '{}');

      // Mutate form controls, then click reset and re-submit
      await page.fill('#wp4-form-input', 'changed-handle');
      await page.fill('#wp4-form-textarea', 'changed-notes');
      await page.click('#wp4-form-checkbox'); // uncheck
      await page.click('#wp4-form-radio-wk'); // select weekly
      await page.click('#wp4-form-switch'); // uncheck

      const validityWhenRequiredUnchecked = await page.evaluate(() =>
        document.querySelector('#wp4-real-form').checkValidity(),
      );

      await page.click('#wp4-form-reset');
      const afterResetState = await page.evaluate(() => ({
        handle: document.querySelector('#wp4-form-input').value,
        notes: document.querySelector('#wp4-form-textarea').value,
        audit: document.querySelector('#wp4-form-checkbox').checked,
        cadenceDaily: document.querySelector('#wp4-form-radio-daily').checked,
        cadenceWk: document.querySelector('#wp4-form-radio-wk').checked,
        replay: document.querySelector('#wp4-form-switch').checked,
        replayTrackBg: getComputedStyle(document.querySelector('#wp4-form-switch')).backgroundColor,
        validAfterReset: document.querySelector('#wp4-real-form').checkValidity(),
      }));

      check(
        initialFormData.handle === 'atelier-prod' &&
          initialFormData.notes === 'Initial note' &&
          initialFormData.audit === 'enabled' &&
          initialFormData.cadence === 'daily' &&
          initialFormData.replay === 'on' &&
          initialFormData.externalFlag === 'ext-yes' &&
          !validityWhenRequiredUnchecked &&
          afterResetState.handle === 'atelier-prod' &&
          afterResetState.notes === 'Initial note' &&
          afterResetState.audit === true &&
          afterResetState.cadenceDaily === true &&
          afterResetState.cadenceWk === false &&
          afterResetState.replay === true &&
          afterResetState.validAfterReset === true,
        'WP4 real <form>: FormData submission, form="wp4-real-form" association, required validity, and native <button type="reset"> across Input, Textarea, Checkbox, RadioGroup, and Switch',
        JSON.stringify({ initialFormData, validityWhenRequiredUnchecked, afterResetState }),
      );

      // 2. react-hook-form register() simulation & label-click toggling (including RadioGroupItem name override)
      await page.click('label[for="wp4-rhf-checkbox"]');
      await page.click('label[for="wp4-rhf-switch"]');
      await page.click('label[for="wp4-rhf-radio-free"]');
      await page.fill('#wp4-rhf-textarea', 'Hook form payload');
      const rhfResult = await page.evaluate(() => {
        const out = document.querySelector('#wp4-rhf-output');
        const freeRadio = document.querySelector('#wp4-rhf-radio-free');
        const proRadio = document.querySelector('#wp4-rhf-radio-pro');
        return {
          check: out.getAttribute('data-check'),
          sw: out.getAttribute('data-sw'),
          notes: out.getAttribute('data-notes'),
          plan: out.getAttribute('data-plan'),
          freeName: freeRadio.getAttribute('name'),
          proName: proRadio.getAttribute('name'),
          freeChecked: freeRadio.checked,
          proChecked: proRadio.checked,
          checkTag: out.getAttribute('data-check-tag'),
          swTag: out.getAttribute('data-sw-tag'),
          notesTag: out.getAttribute('data-notes-tag'),
        };
      });
      check(
        rhfResult.check === 'true' &&
          rhfResult.sw === 'true' &&
          rhfResult.notes === 'Hook form payload' &&
          rhfResult.plan === 'free' &&
          rhfResult.freeName === 'rhfPlan' &&
          rhfResult.proName === 'rhfPlan' &&
          rhfResult.freeChecked === true &&
          rhfResult.proChecked === false &&
          rhfResult.checkTag === 'INPUT' &&
          rhfResult.swTag === 'INPUT' &&
          rhfResult.notesTag === 'TEXTAREA',
        'WP4 react-hook-form register() & label clicks: forwards native INPUT/TEXTAREA refs, preserves RadioGroupItem name="rhfPlan" when RadioGroup has no name, fires onChange, and toggles Checkbox/Switch/Radio when clicking <label>',
        JSON.stringify(rhfResult),
      );

      // 3. Field + Control deduplication, composition (labeled Checkbox in Field, multi-Checkbox Field, Field id vs child id, native <input>, render-prop & wrapped RadioGroup), & standalone error announcements
      const dedupAndErrorInfo = await page.evaluate(() => {
        const zone = document.querySelector('#wp4-field-dedup-zone');
        const fields = [...zone.querySelectorAll('.f12-field')];
        const perFieldCounts = fields.map((f) => ({
          labels: f.querySelectorAll('label.f12-label, label.f12-check-label').length,
          legends: f.querySelectorAll('legend.f12-label').length,
          hints: f.querySelectorAll('.f12-hint').length,
          errors: f.querySelectorAll('.f12-error[role="alert"]').length,
        }));
        const controlLabelCounts = [
          '#wp4-dedup-input',
          '#wp4-dedup-textarea',
          '#wp4-dedup-checkbox',
          '#wp4-dedup-switch',
        ].map((sel) => document.querySelector(sel).labels?.length ?? 0);
        const radioInputs = [
          ...document.querySelectorAll('#wp4-dedup-radiogroup input[type="radio"]'),
        ];
        const radioInputsOneLabel = radioInputs.every((r) => r.labels?.length === 1);
        const radioInputsNoDuplicateGroupDesc = radioInputs.every(
          (r) => !r.hasAttribute('aria-describedby'),
        );
        const noLabelForFieldset = !zone.querySelector('label[for="wp4-dedup-radiogroup"]');

        // Composition zone checks:
        // (a) <Field label="Notifications"><Checkbox label="Email me weekly" /></Field>
        const notifField = document.querySelector('#wp4-notif-field');
        const notifCheckbox = document.querySelector('#wp4-notif-checkbox');
        const notifGroupOk =
          notifField?.getAttribute('role') === 'group' &&
          notifField?.getAttribute('aria-labelledby') === 'wp4-notif-field-label' &&
          document.getElementById('wp4-notif-field-label')?.textContent?.trim() ===
            'Notifications' &&
          notifCheckbox?.labels?.length === 1 &&
          notifCheckbox?.labels?.[0]?.textContent?.trim() === 'Email me weekly';

        // (b) <Field label="Channels" required><Checkbox label="Email channel" /><Checkbox label="SMS channel" /></Field>
        const channelsField = document.querySelector('#wp4-channels-field');
        const channelsGroupLabel = document.getElementById('wp4-channels-field-label');
        const channelChecks = [...(channelsField?.querySelectorAll('input[type="checkbox"]') || [])];
        const channelsGroupOk =
          channelsField?.getAttribute('role') === 'group' &&
          channelsField?.getAttribute('aria-labelledby') === 'wp4-channels-field-label' &&
          Boolean(channelsGroupLabel?.querySelector('.f12-field-req')) &&
          channelChecks.length === 2 &&
          Boolean(channelChecks[0].id) &&
          Boolean(channelChecks[1].id) &&
          channelChecks[0].id !== channelChecks[1].id &&
          channelChecks.every(
            (c) => !c.required && !c.labels?.[0]?.querySelector('.f12-field-req'),
          ) &&
          channelChecks[0].labels?.[0]?.textContent?.trim() === 'Email channel' &&
          channelChecks[1].labels?.[0]?.textContent?.trim() === 'SMS channel';

        // (b2) Single consent checkbox inside <Field label="Legal" required> stays required, while render-prop multi-checkbox group clears required and nested <Sheet motion="cut"> overrides outer motion="stepped"
        const legalConsentCb = document.getElementById('wp4-legal-consent-checkbox');
        const rpCh1 = document.getElementById('wp4-rp-ch-1');
        const rpCh2 = document.getElementById('wp4-rp-ch-2');
        const rpGroupLabel = document.getElementById('wp4-rp-channels-field-label');
        const nestedCutThumb = document.querySelector('#wp4-nested-cut-sheet .f12-switch-thumb');
        const singleRequiredAndNestedMotionOk =
          legalConsentCb?.required === true &&
          rpCh1?.required === false &&
          rpCh2?.required === false &&
          Boolean(rpGroupLabel?.querySelector('.f12-field-req')) &&
          Boolean(nestedCutThumb) &&
          getComputedStyle(nestedCutThumb).transitionDuration === '0s';

        // (c) <Field id="wp4-wrapper-id-field" label="Explicit child ID"><Input id="wp4-child-explicit-id" /></Field>
        const wrapperField = document.querySelector('#wp4-wrapper-id-field');
        const explicitInput = document.querySelector('#wp4-child-explicit-id');
        const explicitIdOk =
          wrapperField?.classList.contains('f12-field') &&
          explicitInput?.labels?.length === 1 &&
          explicitInput?.labels?.[0]?.getAttribute('for') === 'wp4-child-explicit-id';

        // (d) <Field id="wp4-native-field" label="Native input in Field"><input id="wp4-native-input" /></Field>
        const nativeInput = document.querySelector('#wp4-native-input');
        const nativeInputOk =
          nativeInput?.classList.contains('f12-input') &&
          nativeInput?.labels?.length === 1 &&
          nativeInput?.labels?.[0]?.getAttribute('for') === 'wp4-native-input';

        // (e) Render-prop and <div>-wrapped RadioGroup inside <Field>
        const rpRadio = document.querySelector('#wp4-rp-radiogroup');
        const rpField = rpRadio?.closest('.f12-field');
        const wrappedRadio = document.querySelector('#wp4-wrapped-radiogroup');
        const wrappedField = wrappedRadio?.closest('.f12-field');
        const nestedRadioGroupsOk =
          rpField?.querySelectorAll('legend.f12-label').length === 1 &&
          rpField?.querySelectorAll('label.f12-label').length === 0 &&
          wrappedField?.querySelectorAll('legend.f12-label').length === 1 &&
          wrappedField?.querySelectorAll('label.f12-label').length === 0;

        // No duplicate IDs anywhere in #fixture-wp4-sheet
        const allIds = [...document.querySelectorAll('#fixture-wp4-sheet [id]')].map((n) => n.id);
        const dupIds = allIds.filter((id, idx) => allIds.indexOf(id) !== idx);

        const standaloneErrControls = [
          '#wp4-err-textarea',
          '#wp4-err-checkbox',
          '#wp4-err-radiogroup',
          '#wp4-err-switch',
        ];
        const standaloneErrorsOk = standaloneErrControls.every((sel) => {
          const el = document.querySelector(sel);
          if (!el || el.getAttribute('aria-invalid') !== 'true') return false;
          const descIds = (el.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
          const errEl = descIds
            .map((id) => document.getElementById(id))
            .find((n) => n && n.getAttribute('role') === 'alert');
          return Boolean(errEl && errEl.textContent.trim().length > 0);
        });

        return {
          fieldCount: fields.length,
          perFieldCounts,
          controlLabelCounts,
          radioInputsOneLabel,
          radioInputsNoDuplicateGroupDesc,
          noLabelForFieldset,
          notifGroupOk,
          channelsGroupOk,
          singleRequiredAndNestedMotionOk,
          explicitIdOk,
          nativeInputOk,
          nestedRadioGroupsOk,
          dupIds,
          standaloneErrorsOk,
        };
      });
      check(
        dedupAndErrorInfo.fieldCount === 5 &&
          dedupAndErrorInfo.controlLabelCounts.every((n) => n === 1) &&
          dedupAndErrorInfo.radioInputsOneLabel &&
          dedupAndErrorInfo.radioInputsNoDuplicateGroupDesc &&
          dedupAndErrorInfo.noLabelForFieldset &&
          dedupAndErrorInfo.notifGroupOk &&
          dedupAndErrorInfo.channelsGroupOk &&
          dedupAndErrorInfo.singleRequiredAndNestedMotionOk &&
          dedupAndErrorInfo.explicitIdOk &&
          dedupAndErrorInfo.nativeInputOk &&
          dedupAndErrorInfo.nestedRadioGroupsOk &&
          dedupAndErrorInfo.dupIds.length === 0 &&
          dedupAndErrorInfo.perFieldCounts.every((c) => c.hints === 1 && c.errors === 1) &&
          dedupAndErrorInfo.standaloneErrorsOk,
        'WP4 Field coordination, composition (labeled Checkbox, multi-Checkbox group, Field id vs child id, native <input>, render-prop/wrapped RadioGroup), zero duplicate IDs, and role="alert" error announcements',
        JSON.stringify(dedupAndErrorInfo),
      );

      // 4. Checkbox mixed state (SSR class + DOM indeterminate, uncontrolled click/reset sync, no invalid aria-checked="mixed"), localized & long German Switch labels, RTL Switch & Tabs, and WCAG 2.5.8 24×24px compact targets
      const specialInfo = await page.evaluate(async () => {
        const indEl = document.querySelector('#wp4-indeterminate-checkbox');
        const indDomProp = indEl.indeterminate === true;
        const indNoInvalidAriaChecked =
          !indEl.hasAttribute('aria-checked') &&
          indEl.getAttribute('data-indeterminate') === 'true';
        const indHasClass = indEl.classList.contains('f12-checkbox-indeterminate');
        // Simulate pre-hydration SSR state where DOM .indeterminate is false
        indEl.indeterminate = false;
        const markEl = indEl.parentElement.querySelector('.f12-checkbox-mark');
        const ssrMarkVisible = getComputedStyle(markEl).opacity === '1';
        indEl.indeterminate = true;

        // Uncontrolled mixed checkbox: clicking clears .f12-checkbox-indeterminate and switches to checkmark; form.reset() restores mixed state
        const uncMixed = document.querySelector('#wp4-uncontrolled-mixed');
        const uncBefore = {
          ind: uncMixed.indeterminate,
          cls: uncMixed.classList.contains('f12-checkbox-indeterminate'),
        };
        uncMixed.click();
        await Promise.resolve();
        const uncAfterClick = {
          ind: uncMixed.indeterminate,
          checked: uncMixed.checked,
          cls: uncMixed.classList.contains('f12-checkbox-indeterminate'),
        };
        document.querySelector('#wp4-uncontrolled-mixed-reset').click();
        await new Promise((r) => setTimeout(r, 10));
        const uncAfterReset = {
          ind: uncMixed.indeterminate,
          checked: uncMixed.checked,
          cls: uncMixed.classList.contains('f12-checkbox-indeterminate'),
        };

        // Read-only Checkbox and Switch expose aria-readonly="true" and do not toggle on click
        const roCb = document.querySelector('#wp4-readonly-checkbox');
        const roSw = document.querySelector('#wp4-readonly-switch');
        roCb.click();
        roSw.click();
        const readOnlyOk =
          roCb?.getAttribute('aria-readonly') === 'true' &&
          roSw?.getAttribute('aria-readonly') === 'true' &&
          roCb?.checked === true &&
          roSw?.checked === true;

        const customSw = document.querySelector('#wp4-custom-label-switch');
        const customTrack = customSw.parentElement.querySelector('.f12-switch-track');
        const customTrackHidden = customTrack.getAttribute('aria-hidden') === 'true';
        const onGlyph = customTrack.querySelector('.f12-switch-glyph-on')?.textContent;
        const offGlyph = customTrack.querySelector('.f12-switch-glyph-off')?.textContent;

        // Long German Switch labels ("AKTIVIERT" / "DEAKTIVIERT") auto-size track without clipping or thumb overlap
        const deSw = document.querySelector('#wp4-german-switch');
        const deTrack = deSw.parentElement.querySelector('.f12-switch-track');
        const deThumb = deSw.parentElement.querySelector('.f12-switch-thumb');
        const deOffGlyph = deTrack.querySelector('.f12-switch-glyph-off');
        const deOnGlyph = deTrack.querySelector('.f12-switch-glyph-on');
        deThumb.style.transition = 'none';
        const deTrackRect = deTrack.getBoundingClientRect();
        const deThumbUncheckedRect = deThumb.getBoundingClientRect();
        const deOffRect = deOffGlyph.getBoundingClientRect();
        const deOffStyle = getComputedStyle(deOffGlyph);
        const deOffTextLeft = deOffRect.left + parseFloat(deOffStyle.paddingLeft);
        const deOffTextRight = deOffRect.right - parseFloat(deOffStyle.paddingRight);
        const deUncheckedNoClip =
          deTrackRect.width > 54 &&
          deTrack.scrollWidth <= deTrack.clientWidth &&
          deOffTextLeft >= deThumbUncheckedRect.right &&
          deOffTextRight <= deTrackRect.right;
        deSw.click();
        const deThumbCheckedRect = deThumb.getBoundingClientRect();
        const deOnRect = deOnGlyph.getBoundingClientRect();
        const deOnStyle = getComputedStyle(deOnGlyph);
        const deOnTextLeft = deOnRect.left + parseFloat(deOnStyle.paddingLeft);
        const deOnTextRight = deOnRect.right - parseFloat(deOnStyle.paddingRight);
        const deCheckedNoClip =
          deTrack.scrollWidth <= deTrack.clientWidth &&
          deOnTextLeft >= deTrackRect.left &&
          deOnTextRight <= deThumbCheckedRect.left;
        deSw.click();
        deThumb.style.transition = '';

        // LTR vs RTL Switch thumb movement
        const ltrSw = document.querySelector('#wp4-ltr-switch');
        const ltrThumb = ltrSw.parentElement.querySelector('.f12-switch-thumb');
        ltrThumb.style.transition = 'none';
        const ltrBefore = ltrThumb.getBoundingClientRect().left;
        ltrSw.click();
        const ltrAfter = ltrThumb.getBoundingClientRect().left;
        ltrThumb.style.transition = '';

        const rtlSw = document.querySelector('#wp4-rtl-switch');
        const rtlThumb = rtlSw.parentElement.querySelector('.f12-switch-thumb');
        rtlThumb.style.transition = 'none';
        const rtlBefore = rtlThumb.getBoundingClientRect().left;
        rtlSw.click();
        const rtlAfter = rtlThumb.getBoundingClientRect().left;
        rtlThumb.style.transition = '';

        // Compact target sizes (>= 24×24px)
        const compactTargets = [
          document.querySelector('#wp4-compact-checkbox'),
          ...document.querySelectorAll('#wp4-compact-radiogroup .f12-radio-input'),
          document.querySelector('#wp4-compact-switch'),
          ...document.querySelectorAll('#wp4-tabs-manual .f12-tabs-trigger'),
        ];
        const allTargetsAtLeast24 = compactTargets.every((el) => {
          const r = el.getBoundingClientRect();
          return r.width >= 24 && r.height >= 24;
        });

        return {
          indDomProp,
          indNoInvalidAriaChecked,
          indHasClass,
          ssrMarkVisible,
          uncBefore,
          uncAfterClick,
          uncAfterReset,
          readOnlyOk,
          customTrackHidden,
          onGlyph,
          offGlyph,
          deTrackWidth: Math.round(deTrackRect.width),
          deUncheckedNoClip,
          deCheckedNoClip,
          ltrDelta: Math.round(ltrAfter - ltrBefore),
          rtlDelta: Math.round(rtlAfter - rtlBefore),
          allTargetsAtLeast24,
        };
      });
      check(
        specialInfo.indDomProp &&
          specialInfo.indNoInvalidAriaChecked &&
          specialInfo.indHasClass &&
          specialInfo.ssrMarkVisible &&
          specialInfo.uncBefore.ind === true &&
          specialInfo.uncBefore.cls === true &&
          specialInfo.uncAfterClick.ind === false &&
          specialInfo.uncAfterClick.checked === true &&
          specialInfo.uncAfterClick.cls === false &&
          specialInfo.uncAfterReset.ind === true &&
          specialInfo.uncAfterReset.checked === false &&
          specialInfo.uncAfterReset.cls === true &&
          specialInfo.readOnlyOk &&
          specialInfo.customTrackHidden &&
          specialInfo.onGlyph === '入' &&
          specialInfo.offGlyph === '切' &&
          specialInfo.deUncheckedNoClip &&
          specialInfo.deCheckedNoClip &&
          specialInfo.ltrDelta > 0 &&
          specialInfo.rtlDelta < 0 &&
          specialInfo.allTargetsAtLeast24,
        'WP4 Checkbox mixed SSR/DOM state + uncontrolled click/reset sync, Switch configurable/long German auto-sizing labels without clipping, RTL Switch reverse thumb travel, and >=24×24px WCAG 2.5.8 compact targets',
        JSON.stringify(specialInfo),
      );

      // 5. Tabs: default quiet panels inside Tabs, non-shifting autoCut numbers across tab switches, keyboard navigation, wrapped triggers (with and without defaultValue), collision-free value encoding ("a b" vs "a-b"), and custom trigger/panel IDs
      const cutsBeforeTabSwitch = isChromium
        ? await getRenderedCuts(page, { directSheetId: 'fixture-wp4-sheet' })
        : null;
      await page.focus('#wp4-tabs-tab-one');
      await page.keyboard.press('ArrowRight'); // skips disabled tab, activates "two"
      const afterRight = await page.evaluate(() => ({
        activeId: document.activeElement?.id,
        twoSelected: document.querySelector('#wp4-tabs-tab-two')?.getAttribute('aria-selected'),
        twoHidden: document.querySelector('#wp4-tabs-panel-two')?.hidden,
        onePanelQuiet: document
          .querySelector('#wp4-tab-one-panel')
          ?.classList.contains('f12-panel-quiet'),
        twoPanelQuiet: document
          .querySelector('#wp4-tab-two-panel')
          ?.classList.contains('f12-panel-quiet'),
      }));
      await page.keyboard.press('End'); // activates "three" (which contains an explicit expressive panel)
      const cutsOnTabThree = isChromium
        ? await getRenderedCuts(page, { directSheetId: 'fixture-wp4-sheet' })
        : null;
      await page.keyboard.press('Home'); // activates "one"

      // Manual activation tabs: ArrowRight moves focus without changing aria-selected until Enter
      await page.focus('#wp4-tabs-manual-tab-m1');
      await page.keyboard.press('ArrowRight');
      const manualFocusOnly = await page.evaluate(() => ({
        activeId: document.activeElement?.id,
        m1Selected: document.querySelector('#wp4-tabs-manual-tab-m1')?.getAttribute('aria-selected'),
        m2Selected: document.querySelector('#wp4-tabs-manual-tab-m2')?.getAttribute('aria-selected'),
      }));
      await page.keyboard.press('Enter');
      const manualAfterEnter = await page.evaluate(() =>
        document.querySelector('#wp4-tabs-manual-tab-m2')?.getAttribute('aria-selected'),
      );

      // RTL horizontal tabs: ArrowLeft moves forward from r1 to r2
      await page.focus('#wp4-rtl-tabs-tab-r1');
      await page.keyboard.press('ArrowLeft');
      const rtlTabSelected = await page.evaluate(() =>
        document.querySelector('#wp4-rtl-tabs-tab-r2')?.getAttribute('aria-selected'),
      );

      // Wrapped triggers without defaultValue: w1 auto-selected, panel visible, ArrowRight moves to w2
      const wrappedNoDefaultBefore = await page.evaluate(() => ({
        w1Selected: document
          .querySelector('#wp4-tabs-wrapped-nodefault-tab-w1')
          ?.getAttribute('aria-selected'),
        w1TabIndex: document.querySelector('#wp4-tabs-wrapped-nodefault-tab-w1')?.tabIndex,
        w1PanelHidden: document.querySelector('#wp4-tabs-wrapped-nodefault-panel-w1')?.hidden,
      }));
      await page.focus('#wp4-tabs-wrapped-nodefault-tab-w1');
      await page.keyboard.press('ArrowRight');
      const wrappedNoDefaultAfterRight = await page.evaluate(() => ({
        activeId: document.activeElement?.id,
        w2Selected: document
          .querySelector('#wp4-tabs-wrapped-nodefault-tab-w2')
          ?.getAttribute('aria-selected'),
        w2PanelHidden: document.querySelector('#wp4-tabs-wrapped-nodefault-panel-w2')?.hidden,
      }));

      // Wrapped trigger with defaultValue alongside a direct trigger, collision-free IDs ("a b" vs "a-b"), and custom trigger/panel IDs
      const extraTabsInfo = await page.evaluate(() => {
        const wsel = document.querySelector('#wp4-tabs-wrapped-default-tab-wsel');
        const wother = document.querySelector('#wp4-tabs-wrapped-default-tab-wother');
        const wrappedDefaultOk =
          wsel?.getAttribute('aria-selected') === 'true' &&
          wsel?.tabIndex === 0 &&
          wother?.getAttribute('aria-selected') === 'false' &&
          wother?.tabIndex === -1;

        const collisionTabs = [
          ...document.querySelectorAll('#wp4-tabs-collision-tab-a_20_b, #wp4-tabs-collision-tab-a-b'),
        ];
        const collisionPanels = [
          ...document.querySelectorAll(
            '#wp4-tabs-collision-panel-a_20_b, #wp4-tabs-collision-panel-a-b',
          ),
        ];
        const collisionOk =
          collisionTabs.length === 2 &&
          collisionPanels.length === 2 &&
          collisionTabs[0].id !== collisionTabs[1].id &&
          collisionPanels[0].id !== collisionPanels[1].id &&
          collisionTabs[0].getAttribute('aria-controls') === collisionPanels[0].id &&
          collisionPanels[0].getAttribute('aria-labelledby') === collisionTabs[0].id;

        const customTab = document.querySelector('#wp4-custom-tab-id');
        const customPanel = document.querySelector('#wp4-custom-panel-id');
        const customTab2 = document.querySelector('#wp4-custom-tab-id-2');
        const customPanel2 = document.querySelector('#wp4-tabs-custom-ids-panel-cid2');
        const customIdsOk =
          customTab?.getAttribute('aria-controls') === 'wp4-custom-panel-id' &&
          customPanel?.getAttribute('aria-labelledby') === 'wp4-custom-tab-id' &&
          customTab2?.getAttribute('aria-controls') === 'wp4-tabs-custom-ids-panel-cid2' &&
          customPanel2?.getAttribute('aria-labelledby') === 'wp4-custom-tab-id-2';

        return { wrappedDefaultOk, collisionOk, customIdsOk };
      });

      check(
        afterRight.activeId === 'wp4-tabs-tab-two' &&
          afterRight.twoSelected === 'true' &&
          afterRight.twoHidden === false &&
          afterRight.onePanelQuiet === true &&
          afterRight.twoPanelQuiet === true &&
          (!isChromium ||
            (cutsBeforeTabSwitch.join(',') === 'C-01,C-02' &&
              cutsOnTabThree.join(',') === 'C-01,C-02')) &&
          manualFocusOnly.activeId === 'wp4-tabs-manual-tab-m2' &&
          manualFocusOnly.m1Selected === 'true' &&
          manualFocusOnly.m2Selected === 'false' &&
          manualAfterEnter === 'true' &&
          rtlTabSelected === 'true' &&
          wrappedNoDefaultBefore.w1Selected === 'true' &&
          wrappedNoDefaultBefore.w1TabIndex === 0 &&
          wrappedNoDefaultBefore.w1PanelHidden === false &&
          wrappedNoDefaultAfterRight.activeId === 'wp4-tabs-wrapped-nodefault-tab-w2' &&
          wrappedNoDefaultAfterRight.w2Selected === 'true' &&
          wrappedNoDefaultAfterRight.w2PanelHidden === false &&
          extraTabsInfo.wrappedDefaultOk &&
          extraTabsInfo.collisionOk &&
          extraTabsInfo.customIdsOk,
        'WP4 Tabs: WAI-ARIA keyboard navigation, wrapped triggers (with/without defaultValue), collision-free value encoding, custom ID pairing, default quiet inner panels, and stable C-01/C-02 autoCut numbering across tab switches',
        JSON.stringify({
          afterRight,
          cutsBeforeTabSwitch,
          cutsOnTabThree,
          manualFocusOnly,
          manualAfterEnter,
          rtlTabSelected,
          wrappedNoDefaultBefore,
          wrappedNoDefaultAfterRight,
          extraTabsInfo,
        }),
      );

      // 6. WP5 Feedback, Loading & Navigation Kit (Alert/Notice, Toast, Skeleton, EmptyState, Breadcrumb, Pagination)
      if (await page.locator('#fixture-wp5-sheet').count()) {
        // 6a. Alert & Notice roles, status borders, SR deduplication, compound slots, and dismiss target size
        const alertBeforeDismiss = await page.evaluate(() => {
          const getRole = (id) => document.getElementById(id)?.getAttribute('role');
          const getSrText = (id) =>
            document.getElementById(id)?.querySelector('.f12-sr-only')?.textContent ?? null;
          const dismissBtn = document.querySelector('#wp5-alert-dismissible .f12-alert-dismiss');
          const dismissRect = dismissBtn?.getBoundingClientRect();
          const compoundDescCount = document.querySelectorAll(
            '#wp5-alert-hidden-prefix .f12-alert-description',
          ).length;
          return {
            noticeNeutralRole: getRole('wp5-notice-neutral'),
            noticeDangerRole: getRole('wp5-notice-danger-static'),
            alertInfoRole: getRole('wp5-alert-info'),
            alertSuccessRole: getRole('wp5-alert-success'),
            alertWarnRole: getRole('wp5-alert-warning-dedup'),
            alertDangerRole: getRole('wp5-alert-danger'),
            alertPoliteRole: getRole('wp5-alert-polite'),
            successSr: getSrText('wp5-alert-success'),
            warnDedupSr: getSrText('wp5-alert-warning-dedup'),
            hiddenPrefixSr: getSrText('wp5-alert-hidden-prefix'),
            compoundDescCount,
            infoBorder: getComputedStyle(document.getElementById('wp5-alert-info')).borderTopStyle,
            warnBorder: getComputedStyle(document.getElementById('wp5-alert-warning-dedup'))
              .borderTopStyle,
            dangerBorder: getComputedStyle(document.getElementById('wp5-alert-danger'))
              .borderTopStyle,
            dismissTargetOk: Boolean(
              dismissRect && dismissRect.width >= 24 && dismissRect.height >= 24,
            ),
          };
        });
        await page.click('#wp5-alert-dismissible .f12-alert-dismiss');
        const alertAfterDismiss = await page.evaluate(
          () =>
            !document.getElementById('wp5-alert-dismissible') &&
            document.getElementById('wp5-alert-dismissed')?.getAttribute('data-dismissed') ===
              'true',
        );
        check(
          alertBeforeDismiss.noticeNeutralRole === 'note' &&
            alertBeforeDismiss.noticeDangerRole === 'note' &&
            alertBeforeDismiss.alertInfoRole === 'note' &&
            alertBeforeDismiss.alertSuccessRole === 'note' &&
            alertBeforeDismiss.alertWarnRole === 'note' &&
            alertBeforeDismiss.alertDangerRole === 'alert' &&
            alertBeforeDismiss.alertPoliteRole === 'status' &&
            alertBeforeDismiss.successSr === 'Success: ' &&
            alertBeforeDismiss.warnDedupSr === null &&
            alertBeforeDismiss.hiddenPrefixSr === 'Error: ' &&
            alertBeforeDismiss.compoundDescCount === 1 &&
            alertBeforeDismiss.infoBorder === 'solid' &&
            alertBeforeDismiss.warnBorder === 'dashed' &&
            alertBeforeDismiss.dangerBorder === 'double' &&
            alertBeforeDismiss.dismissTargetOk &&
            alertAfterDismiss,
          'WP5 Alert & Notice: restrained ARIA roles (note vs status vs alert), non-color status borders, SR prefix deduplication (ignoring aria-hidden children), single compound description wrapper, and >=24×24px dismiss button',
          JSON.stringify({ alertBeforeDismiss, alertAfterDismiss }),
        );

        // 6b. ToastProvider, ToastViewport (wrapped single viewport), bounded queue, action, F8+Escape dismissal, search-input Escape isolation, hover pause, keyboard/mouse close focus/pause reconciliation, transition+flushSync preservation, nested provider isolation, modal Dialog top-layer portaling, and ToastClose onClick composition
        await page.click('#wp5-toast-push-four');
        const toastQueueInitial = await page.evaluate(() => {
          const viewports = document.querySelectorAll(
            '#wp5-toast-viewport',
          ).length;
          const visibleIds = [
            ...document.querySelectorAll('#wp5-toast-viewport .f12-toast'),
          ].map((el) => el.id);
          const queueBadge =
            document.querySelector('#wp5-toast-viewport .f12-toast-queue-badge')?.textContent ?? '';
          const t1Role = document.getElementById('t-1')?.getAttribute('role');
          const t1Live = document.getElementById('t-1')?.getAttribute('aria-live');
          const t1ActionAriaLabel = document
            .querySelector('#t-1 .f12-toast-action')
            ?.getAttribute('aria-label');
          const t2Sr = document.querySelector('#t-2 .f12-sr-only');
          const politeLiveText =
            document
              .querySelector('.wrapped-viewport-shell .f12-sr-only[aria-live="polite"]')
              ?.textContent ?? '';
          return {
            viewports,
            visibleIds,
            queueBadge,
            t1Role,
            t1Live,
            t1ActionAriaLabel,
            t2Deduped: t2Sr === null,
            politeLiveText,
          };
        });

        // Pressing Escape inside a search input must NOT dismiss any toast
        await page.focus('#wp5-search-input');
        await page.keyboard.press('Escape');
        const stillTwoAfterSearchEsc = await page.evaluate(
          () =>
            [...document.querySelectorAll('#wp5-toast-viewport .f12-toast')]
              .map((el) => el.id)
              .join(',') === 't-1,t-2',
        );

        // Pressing F8 jumps focus into the toast viewport; pressing Escape inside the toast viewport dismisses #t-2, clears polite region (does NOT re-announce #t-1), and promotes #t-3 (danger) into assertive region
        await page.keyboard.press('F8');
        await page.keyboard.press('Escape');
        await page.click('#t-1 .f12-toast-action');
        const toastAfterEsc = await page.evaluate(() => {
          const visibleIds = [
            ...document.querySelectorAll('#wp5-toast-viewport .f12-toast'),
          ].map((el) => el.id);
          const queueBadge =
            document.querySelector('#wp5-toast-viewport .f12-toast-queue-badge')?.textContent ?? '';
          const t3Role = document.getElementById('t-3')?.getAttribute('role');
          const t3Live = document.getElementById('t-3')?.getAttribute('aria-live');
          const politeAfterDismissNewest =
            document
              .querySelector('.wrapped-viewport-shell .f12-sr-only[aria-live="polite"]')
              ?.textContent ?? '';
          const assertiveAfterPromote =
            document
              .querySelector('.wrapped-viewport-shell .f12-sr-only[aria-live="assertive"]')
              ?.textContent ?? '';
          const actions =
            document.getElementById('wp5-toast-output')?.getAttribute('data-actions') ?? '';
          return {
            visibleIds,
            queueBadge,
            t3Role,
            t3Live,
            politeAfterDismissNewest,
            assertiveAfterPromote,
            actions,
          };
        });
        await page.hover('#t-1');
        const pausedOnHover = await page.evaluate(
          () => document.getElementById('t-1')?.getAttribute('data-paused') === 'true',
        );
        await page.hover('#wp5-toast-dismiss-all');
        await page.click('#wp5-toast-dismiss-all');
        const toastAfterClear = await page.evaluate(() => ({
          remaining: document.querySelectorAll('#wp5-toast-viewport .f12-toast').length,
          dismissedList:
            document.getElementById('wp5-toast-output')?.getAttribute('data-dismissed') ?? '',
        }));

        // Keyboard dismissal of focused toast (#t-focus-1) must NOT leave viewport paused, so remaining (#t-focus-2) and subsequent (#t-timed) auto-dismiss
        await page.focus('#wp5-toast-push-focus-pair');
        await page.click('#wp5-toast-push-focus-pair');
        await page.focus('#t-focus-1 .f12-toast-close');
        await page.keyboard.press('Enter');
        await page.waitForFunction(() => !document.getElementById('t-focus-2'), null, {
          timeout: 2000,
        });
        const vpPausedAfterKeyDismiss = await page.evaluate(
          () => document.getElementById('wp5-toast-viewport')?.getAttribute('data-paused'),
        );

        // Mouse click dismissal of #t-focus-1 also must NOT leave viewport paused for subsequent timed toast
        await page.click('#wp5-toast-push-focus-pair');
        await page.click('#t-focus-1 .f12-toast-close');
        await page.waitForFunction(() => !document.getElementById('t-focus-2'), null, {
          timeout: 2000,
        });

        // Timed toast pause-on-hover and resume-on-leave
        await page.click('#wp5-toast-push-timed');
        await page.hover('#t-timed');
        await page.waitForTimeout(260);
        const timedStillPresentWhileHovered = await page.evaluate(() =>
          Boolean(document.getElementById('t-timed')),
        );
        await page.hover('#wp5-toast-dismiss-all');
        await page.waitForFunction(() => !document.getElementById('t-timed'), null, {
          timeout: 2000,
        });

        // Same-ID toast update resets full lifetime (updating #t-timed at ~130ms of 220ms must keep it alive past 250ms total)
        await page.click('#wp5-toast-push-timed');
        await page.waitForTimeout(130);
        await page.click('#wp5-toast-push-timed');
        await page.waitForTimeout(130);
        const sameIdResetStillAlive = await page.evaluate(() =>
          Boolean(document.getElementById('t-timed')),
        );
        await page.waitForFunction(() => !document.getElementById('t-timed'), null, {
          timeout: 2000,
        });

        // React.startTransition + synchronous flushSync parent render preserves both transition and urgent notifications
        await page.click('#wp5-toast-push-transition');
        const transitionIds = await page.evaluate(() =>
          [...document.querySelectorAll('#wp5-toast-viewport .f12-toast')]
            .map((el) => el.id)
            .join(','),
        );
        await page.click('#wp5-toast-dismiss-all');

        // Nested ToastProvider: outer default viewport is not suppressed by inner explicit viewport
        await page.click('#wp5-push-outer-toast');
        await page.click('#wp5-push-inner-toast');
        const nestedToastState = await page.evaluate(() => ({
          outerRendered: Boolean(document.getElementById('t-outer-provider')),
          innerRendered: Boolean(
            document.querySelector('#wp5-inner-toast-viewport #t-inner-provider'),
          ),
        }));
        await page.click('#wp5-clear-outer-toast');
        await page.click('#wp5-clear-inner-toast');

        // Modal Dialog top-layer portaling: live regions are already inside dialog[open] when Dialog opens, and toast triggered inside open Dialog updates the existing live region in-place
        await page.click('#wp5-dialog-toast-trigger');
        const liveInDialogBeforeFire = await page.evaluate(() => {
          const dlg = document.getElementById('wp5-toast-dialog');
          const live = dlg?.querySelector('.f12-sr-only[aria-live="polite"]');
          if (live) live.setAttribute('data-pre-existing', 'true');
          return Boolean(live && live.textContent === '');
        });
        await page.click('#wp5-dialog-fire-toast');
        const dialogToastState = await page.evaluate(() => {
          const dlg = document.getElementById('wp5-toast-dialog');
          const toastEl = document.getElementById('t-in-dialog');
          const liveInDialog = dlg?.querySelector('.f12-sr-only[aria-live="polite"]');
          const closeBtn = toastEl?.querySelector('.f12-toast-close');
          const r = closeBtn?.getBoundingClientRect();
          const hit =
            r && r.width > 0
              ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
              : null;
          return {
            inDialogSubtree: Boolean(dlg && toastEl && dlg.contains(toastEl)),
            liveRegionInDialog: Boolean(
              liveInDialog &&
                liveInDialog.getAttribute('data-pre-existing') === 'true' &&
                liveInDialog.textContent?.includes('Saved inside dialog'),
            ),
            closeClickable: Boolean(closeBtn && hit && (hit === closeBtn || closeBtn.contains(hit))),
          };
        });
        await page.click('#t-in-dialog .f12-toast-close');
        const dialogStillOpenAfterToastClose = await page.evaluate(() => {
          const dlg = document.getElementById('wp5-toast-dialog');
          return Boolean(dlg?.hasAttribute('open') && !document.getElementById('t-in-dialog'));
        });
        // Non-dismissible toast inside Dialog: pressing Escape while focused on its action closes the Dialog
        await page.click('#wp5-dialog-fire-nondismissible');
        await page.focus('#t-in-dialog-nondismissible .f12-toast-action');
        await page.keyboard.press('Escape');
        const dialogClosedOnNonDismissibleToastEsc = await page.evaluate(() => {
          const dlg = document.getElementById('wp5-toast-dialog');
          return !dlg?.hasAttribute('open');
        });
        await page.click('#wp5-toast-dismiss-all');

        // Repeated identical toast ("Saved" fired twice): live region clears and re-announces "Success: Saved"
        await page.click('#wp5-toast-push-repeated');
        const repeatedToastReannounced = await page.evaluate(async () => {
          const live = document.querySelector(
            '.wrapped-viewport-shell .f12-sr-only[aria-live="polite"]',
          );
          if (!live || live.textContent !== 'Success: Saved') return false;
          const mutations = [];
          const mo = new MutationObserver(() => {
            mutations.push(live.textContent);
          });
          mo.observe(live, { childList: true, characterData: true, subtree: true });
          document.getElementById('wp5-toast-push-repeated')?.click();
          await new Promise((r) => setTimeout(r, 90));
          mo.disconnect();
          return mutations.includes('') && mutations[mutations.length - 1] === 'Success: Saved';
        });
        await page.click('#wp5-toast-dismiss-all');

        // Custom action button (non-ToastAction) F8 focus & standalone Toast inside provider local hover pause
        await page.click('#wp5-toast-push-custom-action');
        await page.keyboard.press('F8');
        const customActionF8Focused = await page.evaluate(
          () => document.activeElement?.id === 't-custom-btn-action',
        );
        await page.click('#wp5-toast-dismiss-all');

        await page.hover('#wp5-standalone-in-provider');
        const standaloneInProviderPausedOnHover = await page.evaluate(
          () =>
            document.getElementById('wp5-standalone-in-provider')?.getAttribute('data-paused') ===
            'true',
        );
        await page.mouse.move(0, 0);

        // Custom ToastClose onClick composition and preventDefault opt-out
        await page.click('#wp5-toast-custom-close-btn');
        await page.click('#wp5-toast-prevented-close-btn');
        const customCloseState = await page.evaluate(() => {
          const out = document.getElementById('wp5-toast-close-output');
          return {
            customOpen: out?.getAttribute('data-custom-open'),
            customTracks: out?.getAttribute('data-custom-tracks'),
            customDismisses: out?.getAttribute('data-custom-dismisses'),
            preventedOpen: out?.getAttribute('data-prevented-open'),
            preventedTracks: out?.getAttribute('data-prevented-tracks'),
          };
        });

        check(
          toastQueueInitial.viewports === 1 &&
            toastQueueInitial.visibleIds.join(',') === 't-1,t-2' &&
            toastQueueInitial.queueBadge === '+2 QUEUED' &&
            toastQueueInitial.t1Role === null &&
            toastQueueInitial.t1Live === null &&
            toastQueueInitial.t1ActionAriaLabel === null &&
            toastQueueInitial.t2Deduped &&
            toastQueueInitial.politeLiveText.includes('Cut 02 drift') &&
            stillTwoAfterSearchEsc &&
            toastAfterEsc.visibleIds.join(',') === 't-1,t-3' &&
            toastAfterEsc.queueBadge === '+1 QUEUED' &&
            toastAfterEsc.t3Role === null &&
            toastAfterEsc.t3Live === null &&
            toastAfterEsc.politeAfterDismissNewest === '' &&
            toastAfterEsc.assertiveAfterPromote.includes('Processor halted') &&
            toastAfterEsc.actions === 't-1' &&
            pausedOnHover &&
            toastAfterClear.remaining === 0 &&
            toastAfterClear.dismissedList === 't-2,t-1,t-3,t-4' &&
            vpPausedAfterKeyDismiss === 'false' &&
            timedStillPresentWhileHovered &&
            sameIdResetStillAlive &&
            transitionIds === 't-transition,t-urgent' &&
            nestedToastState.outerRendered &&
            nestedToastState.innerRendered &&
            liveInDialogBeforeFire &&
            dialogToastState.inDialogSubtree &&
            dialogToastState.liveRegionInDialog &&
            dialogToastState.closeClickable &&
            dialogStillOpenAfterToastClose &&
            dialogClosedOnNonDismissibleToastEsc &&
            repeatedToastReannounced &&
            customActionF8Focused &&
            standaloneInProviderPausedOnHover &&
            customCloseState.customOpen === 'false' &&
            customCloseState.customTracks === '1' &&
            customCloseState.customDismisses === '1' &&
            customCloseState.preventedOpen === 'true' &&
            customCloseState.preventedTracks === '1',
          'WP5 Toast: single shared live regions without duplicate per-toast role/aria-live or old-toast re-announcement, WCAG 2.5.3 action label preservation, F8+Escape dismissal, search-input Escape isolation, keyboard/mouse close focus/pause reconciliation, transition+flushSync preservation, nested provider isolation, modal Dialog top-layer portaling (including live regions and non-dismissible Escape passthrough), and ToastClose onClick composition',
          JSON.stringify({
            toastQueueInitial,
            stillTwoAfterSearchEsc,
            toastAfterEsc,
            pausedOnHover,
            toastAfterClear,
            vpPausedAfterKeyDismiss,
            timedStillPresentWhileHovered,
            transitionIds,
            nestedToastState,
            dialogToastState,
            dialogStillOpenAfterToastClose,
            dialogClosedOnNonDismissibleToastEsc,
            customCloseState,
          }),
        );

        // 6c. Skeleton, EmptyState, Breadcrumb (non-current items + React 19 ref cleanup + asChild handler composition), and Pagination (modified-link clicks + NaN resilience)
        await page.focus('#wp5-breadcrumb-aschild');
        await page.click('#wp5-breadcrumb-aschild');
        await page.click('#wp5-breadcrumb-unmount-btn');
        await page.click('#wp5-pagination-controlled .f12-pagination-next');

        // Breadcrumb items: href+onClick skips onClick on modified clicks (native new-tab wins);
        // onSelect renders a real <button> for in-page levels; current items ignore onSelect.
        await page.click('#wp5-breadcrumb-actions a[href="#atelier-route"]', {
          modifiers: ['Shift'],
        });
        await page.click('#wp5-breadcrumb-actions a[href="#atelier-route"]');
        await page.click('#wp5-breadcrumb-actions button.f12-breadcrumb-button');
        await page.click('#wp5-breadcrumb-actions [aria-current="page"]');
        for (const extra of page.context().pages()) if (extra !== page) await extra.close();

        // Modified link clicks (Control+click and Meta+click) on PaginationLink and PaginationNext must NOT mutate page state
        await page.click('#wp5-pagination-links a[href="#link-page-2"]', {
          modifiers: ['Control'],
        });
        await page.click('#wp5-pagination-links .f12-pagination-next', {
          modifiers: ['Shift'],
        });
        const pageBeforeUnmodifiedClick = await page.evaluate(() => ({
          linkPage: document
            .getElementById('wp5-pagination-ranges')
            ?.getAttribute('data-link-page'),
          linkCalls: document
            .getElementById('wp5-pagination-ranges')
            ?.getAttribute('data-link-calls'),
        }));
        await page.click('#wp5-pagination-links a[href="#link-page-2"]');

        const navAndSkeletonInfo = await page.evaluate(() => {
          const skelDec = document.getElementById('wp5-skeleton-decorative');
          const skelDecRect = skelDec?.getBoundingClientRect();
          const skelLab = document.getElementById('wp5-skeleton-labeled');
          const skelLabSr = skelLab?.querySelector('.f12-sr-only')?.textContent;
          const skelLines = document.querySelectorAll('#wp5-skeleton-text .f12-skeleton-line');
          const skeletonOk =
            skelDec?.getAttribute('aria-hidden') === 'true' &&
            !skelDec?.hasAttribute('role') &&
            Math.round(skelDecRect?.width ?? 0) === 180 &&
            Math.round(skelDecRect?.height ?? 0) === 24 &&
            skelLab?.getAttribute('role') === 'status' &&
            skelLab?.getAttribute('aria-busy') === 'true' &&
            skelLab?.getAttribute('aria-label') === 'Loading revenue metric' &&
            skelLabSr === 'Loading revenue metric' &&
            !skelLab?.hasAttribute('aria-hidden') &&
            skelLines.length === 3 &&
            (skelLines[2]?.getAttribute('style') || '').includes('60%');

          const emptyDefaultIcons = document.querySelectorAll(
            '#wp5-empty-default .f12-empty-icon',
          ).length;
          const emptyCompoundIcons = document.querySelectorAll(
            '#wp5-empty-compound .f12-empty-icon',
          ).length;
          const emptyOk =
            emptyDefaultIcons === 1 &&
            emptyCompoundIcons === 1 &&
            document.querySelector('#wp5-empty-default .f12-empty-title')?.tagName === 'H3';

          const bcItems = document.getElementById('wp5-breadcrumb-items');
          const bcCurrent = bcItems?.querySelector('.f12-breadcrumb-page');
          const bcNonCurrentSpans = [
            ...document.querySelectorAll('#wp5-breadcrumb-noncurrent .f12-breadcrumb-page'),
          ];
          const bcLastNonCurrent = document.querySelector(
            '#wp5-breadcrumb-last-noncurrent .f12-breadcrumb-page',
          );
          const bcMidCurrentPages = [
            ...document.querySelectorAll(
              '#wp5-breadcrumb-mid-current [aria-current="page"]',
            ),
          ];
          const bcMidLastLink = document.querySelector(
            '#wp5-breadcrumb-mid-current a[href="#c05"]',
          );
          const bcOut = document.getElementById('wp5-breadcrumb-output');
          const bcSepLi = document.getElementById('wp5-breadcrumb-sep-li');
          const bcSepSpan = document.getElementById('wp5-breadcrumb-sep-span');
          const bcEllipsisSr = document.querySelector(
            '#wp5-breadcrumb-ellipsis .f12-sr-only',
          )?.textContent;
          const bcActions = document.getElementById('wp5-breadcrumb-actions');
          const bcActionBtn = bcActions?.querySelector('button');
          const bcActionLink = bcActions?.querySelector('a');
          const breadcrumbOk =
            document.getElementById('wp5-breadcrumb-actions-output')?.getAttribute('data-actions') ===
              'link,select' &&
            bcActions?.querySelectorAll('button').length === 1 &&
            bcActionBtn?.getAttribute('type') === 'button' &&
            bcActionBtn?.classList.contains('f12-breadcrumb-link') &&
            bcActionBtn?.textContent === 'Storyboards' &&
            getComputedStyle(bcActionBtn).textDecorationStyle === 'dotted' &&
            getComputedStyle(bcActionLink).textDecorationStyle === 'dotted' &&
            bcActions?.querySelector('[aria-current="page"]')?.tagName === 'SPAN' &&
            bcItems?.tagName === 'NAV' &&
            bcItems?.getAttribute('aria-label') === 'Breadcrumb' &&
            bcCurrent?.getAttribute('aria-current') === 'page' &&
            bcNonCurrentSpans.length === 2 &&
            !bcNonCurrentSpans[0]?.hasAttribute('aria-current') &&
            bcNonCurrentSpans[1]?.getAttribute('aria-current') === 'page' &&
            !bcLastNonCurrent?.hasAttribute('aria-current') &&
            bcMidCurrentPages.length === 1 &&
            bcMidCurrentPages[0]?.textContent === 'Cut 04' &&
            bcMidLastLink?.tagName === 'A' &&
            bcOut?.getAttribute('data-clicks')?.includes('focus-outer,focus-inner') &&
            bcOut?.getAttribute('data-clicks')?.includes('outer,inner') &&
            bcOut?.getAttribute('data-ref-tag') === 'A' &&
            bcOut?.getAttribute('data-ref-cleaned') === 'true' &&
            bcSepLi?.tagName === 'LI' &&
            bcSepSpan?.tagName === 'SPAN' &&
            bcEllipsisSr === 'More breadcrumb levels';

          const pgRanges = document.getElementById('wp5-pagination-ranges');
          const pgSummary =
            document.querySelector('#wp5-pagination-controlled .f12-pagination-summary')
              ?.textContent ?? '';
          const pgActive = document.querySelector(
            '#wp5-pagination-controlled .f12-pagination-link[aria-current="page"]',
          )?.textContent;
          const pgEllipsisSr = document.querySelector(
            '#wp5-pagination-controlled .f12-pagination-ellipsis .f12-sr-only',
          )?.textContent;
          const pgNanSummary =
            document.querySelector('#wp5-pagination-nan .f12-pagination-summary')?.textContent ??
            '';
          const pgNanCurrent = document.querySelector(
            '#wp5-pagination-nan .f12-pagination-link[aria-current="page"]',
          )?.textContent;
          const pgCompactLinks = [
            ...document.querySelectorAll('#wp5-pagination-compact .f12-pagination-link'),
          ];
          const pgCompactPrevAtPage1 = document.querySelector(
            '#wp5-pagination-compact .f12-pagination-prev',
          );
          const pgAnchorAttrLink = document.getElementById('wp5-pagination-anchor-link');
          const tableWrapAt1280 = document.querySelector('.f12-table-wrap');
          const pgCompactTargetsOk = pgCompactLinks.every((el) => {
            const r = el.getBoundingClientRect();
            return r.width >= 24 && r.height >= 24;
          });
          const paginationOk =
            pgRanges?.getAttribute('data-small') === '[1,2,3,4,5]' &&
            pgRanges?.getAttribute('data-start') === '[1,2,3,4,5,"ellipsis-end",10]' &&
            pgRanges?.getAttribute('data-middle') ===
              '[1,"ellipsis-start",4,5,6,"ellipsis-end",10]' &&
            pgRanges?.getAttribute('data-end') === '[1,"ellipsis-start",6,7,8,9,10]' &&
            pgRanges?.getAttribute('data-boundary2') ===
              '[1,2,"ellipsis-start",5,6,7,"ellipsis-end",11,12]' &&
            pgRanges?.getAttribute('data-page') === '3' &&
            pgRanges?.getAttribute('data-link-page') === '2' &&
            pgRanges?.getAttribute('data-link-calls') === '1' &&
            pgActive === '3' &&
            pgSummary === 'PAGE 03 OF 10 · 41–60 OF 194' &&
            pgNanSummary === 'PAGE 01 OF 20' &&
            pgNanCurrent === '1' &&
            pgEllipsisSr === 'More pages' &&
            pgCompactPrevAtPage1?.tagName === 'A' &&
            pgCompactPrevAtPage1?.getAttribute('aria-disabled') === 'true' &&
            pgAnchorAttrLink?.getAttribute('target') === '_self' &&
            pgAnchorAttrLink?.getAttribute('download') === 'sheet-1.json' &&
            !tableWrapAt1280?.hasAttribute('tabindex') &&
            !tableWrapAt1280?.hasAttribute('role') &&
            pgCompactTargetsOk;

          return { skeletonOk, emptyOk, breadcrumbOk, paginationOk };
        });

        check(
          pageBeforeUnmodifiedClick.linkPage === '1' &&
            pageBeforeUnmodifiedClick.linkCalls === '0' &&
            navAndSkeletonInfo.skeletonOk &&
            navAndSkeletonInfo.emptyOk &&
            navAndSkeletonInfo.breadcrumbOk &&
            navAndSkeletonInfo.paginationOk,
          'WP5 Skeleton (zero-CLS + SR label), EmptyState, Breadcrumb (non-current items without aria-current + React 19 ref cleanup), and Pagination (range builder + boundaryCount, modified-link click preservation, NaN resilience, >=24×24px targets)',
          JSON.stringify({ pageBeforeUnmodifiedClick, navAndSkeletonInfo }),
        );
      }
    }
  }
}

// With JavaScript disabled, auto cut numbers appear in the server-rendered HTML
{
  const noJsCtx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    javaScriptEnabled: false,
  });
  const noJsPage = await noJsCtx.newPage();
  await noJsPage.goto(pathToFileURL(resolve(REGISTRY_ROOT, 'dist/gallery.html')).href, {
    waitUntil: 'load',
  });
  if (isChromium) {
    const noJsCuts = await getRenderedCuts(noJsPage, {
      rootId: 'gallery-sheet',
      panelsOnly: true,
    });
    await noJsCtx.close();
    check(
      noJsCuts.join(',') === 'C-01,C-02,C-03,C-04,C-05,C-06,C-07',
      '<Sheet autoCut> SSR (javaScriptEnabled: false): auto cut numbers C-01..C-07 appear in server-rendered HTML without JS',
      noJsCuts.join(','),
    );
  } else {
    const noJsCount = await noJsPage.evaluate(
      () =>
        [...document.querySelectorAll('#gallery-sheet .f12-panel > .f12-cut')].filter(
          (e) => getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0,
        ).length,
    );
    await noJsCtx.close();
    check(
      noJsCount === 7,
      '<Sheet autoCut> SSR (javaScriptEnabled: false): 7 visible auto-cut badges render in server-rendered HTML without JS',
      `count=${noJsCount}`,
    );
  }
}

// SegmentedControl: a value restored right after mount (saved theme/filter/tab) must snap into
// place with no indicator transition, while a real click afterwards still animates.
{
  const readRestored = () =>
    page.evaluate(() => {
      const wrap = document.getElementById('fixture-restored-seg');
      const ind = wrap.querySelector('.f12-rng-ind');
      const pressed = wrap.querySelector('[aria-pressed="true"]');
      return {
        runs: Number(wrap.getAttribute('data-transition-runs')),
        pressed: pressed?.id ?? null,
        indOnPressed:
          !!ind &&
          !!pressed &&
          Math.abs(ind.getBoundingClientRect().left - pressed.getBoundingClientRect().left) <= 3,
      };
    });
  const afterMount = await readRestored();
  await page.click('#fixture-restored-seg-a');
  await page.waitForTimeout(400);
  const afterClick = await readRestored();
  check(
    afterMount.runs === 0 &&
      afterMount.pressed === 'fixture-restored-seg-c' &&
      afterMount.indOnPressed &&
      afterClick.runs >= 1 &&
      afterClick.pressed === 'fixture-restored-seg-a' &&
      afterClick.indOnPressed,
    'SegmentedControl: value restored right after mount snaps the indicator into place (0 transitions), and a later click still animates',
    JSON.stringify({ afterMount, afterClick }),
  );
}

// F12-03: Named-area layout (desktop placement, specificity regression, mobile DOM/reading/cut order),
// GhostWire (endpoints, vector-effect, strength dash density, auto orientation, group aria-label, on-twos draw-on),
// Receipt & ReceiptList (7-char SHA, path wrapping, WP3 origin glyph+srLabel, javascript: link safety),
// and Tag variant="stamp" / Stamp (-3deg rotation, display font, uppercase, ink border, full contrast).
{
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(150);

  const f1203DesktopCuts = isChromium
    ? await getRenderedCuts(page, { rootId: 'gallery-f12-03-sheet', panelsOnly: true })
    : ['C-01', 'C-02', 'C-03'];

  const f1203Desktop = await page.evaluate(() => {
    const scene = document.getElementById('gallery-areas-scene');
    const hero = document.getElementById('gallery-area-hero');
    const sideTop = document.getElementById('gallery-area-side-top');
    const sideBotWrap = document.getElementById('gallery-scene-area-wrap');
    const sideBot = document.getElementById('gallery-area-side-bot');

    const sceneCs = getComputedStyle(scene);
    const heroCs = getComputedStyle(hero);
    const sideTopCs = getComputedStyle(sideTop);
    const sideBotWrapCs = getComputedStyle(sideBotWrap);

    const heroRect = hero.getBoundingClientRect();
    const sideTopRect = sideTop.getBoundingClientRect();
    const sideBotRect = sideBot.getBoundingClientRect();
    const sceneRect = scene.getBoundingClientRect();

    // Specificity regression check: hero panel is placed by its named grid-area ('hero'),
    // spans 8 of 12 columns beside the 4-column right stack, and spans both rows vertically.
    const placedByAreaName =
      heroCs.gridColumnStart === 'hero' &&
      heroCs.gridRowStart === 'hero' &&
      sideTopCs.gridColumnStart === 'sideTop' &&
      sideBotWrapCs.gridColumnStart === 'sideBot';
    const heroBesideStack =
      heroRect.width > sceneRect.width * 0.55 &&
      heroRect.right <= sideTopRect.left - 18 &&
      sideTopRect.bottom <= sideBotRect.top - 18 &&
      Math.abs(heroRect.top - sideTopRect.top) <= 2 &&
      Math.abs(heroRect.bottom - sideBotRect.bottom) <= 2;

    // GhostWire checks
    const gwHigh = document.getElementById('gallery-ghost-wire');
    const gwLow = document.getElementById('gallery-ghost-wire-low');
    const gwVert = document.getElementById('gallery-ghost-wire-vertical');
    const fromChip = gwHigh.querySelector('.f12-ghost-wire-from');
    const toChip = gwHigh.querySelector('.f12-ghost-wire-to');
    const svgHigh = gwHigh.querySelector('svg.f12-ghost-wire-svg');
    const lineHigh = gwHigh.querySelector('line.f12-ghost-wire-line');
    const revealHigh = gwHigh.querySelector('mask line.f12-ghost-wire-reveal');
    const lineLow = gwLow.querySelector('line.f12-ghost-wire-line');

    const dashHigh = (lineHigh.getAttribute('stroke-dasharray') || '').split(/\s+/).map(Number);
    const dashLow = (lineLow.getAttribute('stroke-dasharray') || '').split(/\s+/).map(Number);
    const strengthMapsToDashNotColor =
      dashHigh.length === 2 &&
      dashLow.length === 2 &&
      dashHigh[0] > dashLow[0] &&
      dashHigh[1] < dashLow[1] &&
      getComputedStyle(lineHigh).stroke === getComputedStyle(lineLow).stroke &&
      getComputedStyle(lineHigh).opacity === '1' &&
      getComputedStyle(lineLow).opacity === '1';

    const ghostWireOk =
      gwHigh.getAttribute('role') === 'group' &&
      gwHigh.getAttribute('aria-label') ===
        'src/checkout/webhook.ts usually changes with db/schema.sql, which was not changed' &&
      gwLow.getAttribute('aria-label') ===
        'registry/ui/tag.tsx usually changes with registry/styles/frame12.css, which was not changed' &&
      gwHigh.getAttribute('data-orientation') === 'horizontal' &&
      gwVert.getAttribute('data-orientation') === 'vertical' &&
      svgHigh.getAttribute('viewBox') === '0 0 100 12' &&
      getComputedStyle(fromChip).borderTopStyle === 'solid' &&
      getComputedStyle(toChip).borderTopStyle === 'dashed' &&
      svgHigh.getAttribute('aria-hidden') === 'true' &&
      lineHigh.getAttribute('vector-effect') === 'non-scaling-stroke' &&
      (lineHigh.getAttribute('mask') || '').startsWith('url(#') &&
      lineHigh.getAttribute('stroke-dashoffset') === null &&
      Boolean(revealHigh) &&
      revealHigh.getAttribute('stroke-dasharray') === '100 100' &&
      strengthMapsToDashNotColor;

    // Receipt & ReceiptList checks
    const rList = document.getElementById('gallery-receipt-list');
    const rCommit = document.getElementById('gallery-receipt-commit');
    const rFile = document.getElementById('gallery-receipt-file');
    const rLong = document.getElementById('gallery-receipt-long-file');
    const rLink = document.getElementById('gallery-receipt-link');
    const rUnsafe = document.getElementById('gallery-receipt-unsafe');

    const commitAnchor = rCommit.querySelector('a.f12-receipt-link');
    const commitCode = commitAnchor ? commitAnchor.querySelector('code.f12-receipt-code') : null;
    const commitShaSr = rCommit.querySelector('.f12-receipt-sha-sr');
    const linkAnchor = rLink.querySelector('a.f12-receipt-link');
    const unsafeAnchor = rUnsafe.querySelector('a');
    const unsafeValueEl = rUnsafe.querySelector('.f12-receipt-value');

    // Relative & scheme safety matrix + empty value fallbacks from unit fixtures
    const rMatrixList = document.getElementById('fixture-receipt-href-matrix');
    const rRelSlash = document.getElementById('fixture-receipt-rel-slash');
    const rRelHash = document.getElementById('fixture-receipt-rel-hash');
    const rProtoRel = document.getElementById('fixture-receipt-proto-rel');
    const rData = document.getElementById('fixture-receipt-data');
    const rCommitUnlinked = document.getElementById('fixture-receipt-commit-unlinked');
    const rEmptyValTitle = document.getElementById('fixture-receipt-empty-val-title');
    const rEmptyValHref = document.getElementById('fixture-receipt-empty-val-href');

    const relSlashAnchor = rRelSlash?.querySelector('a.f12-receipt-link');
    const relHashAnchor = rRelHash?.querySelector('a.f12-receipt-link');
    const protoRelAnchor = rProtoRel?.querySelector('a');
    const dataAnchor = rData?.querySelector('a');
    const unlinkedCode = rCommitUnlinked?.querySelector('code.f12-receipt-value.f12-receipt-code');
    const unlinkedShaSr = rCommitUnlinked?.querySelector('.f12-receipt-sha-sr');
    const emptyTitleAnchor = rEmptyValTitle?.querySelector('a.f12-receipt-link');
    const emptyTitleDuplicate = rEmptyValTitle?.querySelector('.f12-receipt-title');
    const emptyHrefAnchor = rEmptyValHref?.querySelector('a.f12-receipt-link');

    // Narrow .f12-dash (640px) container collapse for areas Scene on 1280px desktop
    const narrowLeft = document.getElementById('fixture-narrow-dash-left');
    const narrowRight = document.getElementById('fixture-narrow-dash-right');
    const narrowLeftRect = narrowLeft?.getBoundingClientRect();
    const narrowRightRect = narrowRight?.getBoundingClientRect();
    const narrowDashAreasCollapsed =
      Boolean(narrowLeftRect && narrowRightRect) &&
      narrowLeftRect.bottom <= narrowRightRect.top + 2 &&
      Math.abs(narrowLeftRect.left - narrowRightRect.left) <= 2;

    // 2-column and 3-column derived areas layouts
    const scene2Col = document.getElementById('fixture-areas-2col');
    const nav2Col = document.getElementById('fixture-areas-2col-nav');
    const main2Col = document.getElementById('fixture-areas-2col-main');
    const scene3Col = document.getElementById('fixture-areas-3col');
    const hero3Col = document.getElementById('fixture-areas-3col-hero');
    const top3Col = document.getElementById('fixture-areas-3col-top');
    const bot3Col = document.getElementById('fixture-areas-3col-bot');

    const nav2Rect = nav2Col?.getBoundingClientRect();
    const main2Rect = main2Col?.getBoundingClientRect();
    const hero3Rect = hero3Col?.getBoundingClientRect();
    const top3Rect = top3Col?.getBoundingClientRect();
    const bot3Rect = bot3Col?.getBoundingClientRect();

    const areas2ColOk =
      scene2Col?.getAttribute('data-columns') === '2' &&
      Boolean(nav2Rect && main2Rect) &&
      nav2Rect.width > 400 &&
      main2Rect.width > 400 &&
      Math.abs(nav2Rect.width - main2Rect.width) <= 2 &&
      nav2Rect.right <= main2Rect.left + 24;

    const areas3ColOk =
      scene3Col?.getAttribute('data-columns') === '3' &&
      Boolean(hero3Rect && top3Rect && bot3Rect) &&
      hero3Rect.width > top3Rect.width * 1.5 &&
      hero3Rect.right <= top3Rect.left + 24 &&
      top3Rect.bottom <= bot3Rect.top + 24;

    // Custom breakpoint via scoped <style>
    const sceneBp1600 = document.getElementById('fixture-areas-bp-1600');
    const bp1600A = document.getElementById('fixture-areas-bp-1600-a')?.getBoundingClientRect();
    const bp1600B = document.getElementById('fixture-areas-bp-1600-b')?.getBoundingClientRect();
    const sceneBp800 = document.getElementById('fixture-areas-bp-800');
    const bp800A = document.getElementById('fixture-areas-bp-800-a')?.getBoundingClientRect();
    const bp800B = document.getElementById('fixture-areas-bp-800-b')?.getBoundingClientRect();
    const customBreakpointOk =
      Boolean(sceneBp1600?.getAttribute('data-scene-bp')) &&
      (sceneBp1600?.querySelector('style')?.textContent || '').includes(
        '@media (min-width: 1600px)',
      ) &&
      Boolean(bp1600A && bp1600B) &&
      bp1600A.bottom <= bp1600B.top + 2 &&
      Boolean(sceneBp800?.getAttribute('data-scene-bp')) &&
      (sceneBp800?.querySelector('style')?.textContent || '').includes(
        '@media (min-width: 800px)',
      ) &&
      Boolean(bp800A && bp800B) &&
      bp800A.right <= bp800B.left + 24 &&
      Math.abs(bp800A.top - bp800B.top) <= 2;

    // Narrow container (360px) GhostWire auto orientation on 1280px desktop viewport
    const gwNarrowContainer = document.getElementById('fixture-ghost-wire-narrow-container');
    const gwNarrowContainerVertical =
      gwNarrowContainer?.getAttribute('data-orientation') === 'vertical' &&
      gwNarrowContainer?.querySelector('svg.f12-ghost-wire-svg')?.getAttribute('viewBox') ===
        '0 0 12 100';

    const receiptsOk =
      rList?.getAttribute('role') === 'list' &&
      rMatrixList?.getAttribute('role') === 'list' &&
      Boolean(commitAnchor) &&
      Boolean(commitCode) &&
      commitCode.tagName === 'CODE' &&
      commitCode.textContent.trim() === 'ab107e2' &&
      commitCode.getAttribute('title') === 'ab107e29f4c18820' &&
      commitAnchor.getAttribute('title') === 'ab107e29f4c18820' &&
      commitShaSr?.textContent?.includes('ab107e29f4c18820') &&
      commitAnchor.getAttribute('href') === 'https://github.com/lbrodie11/frame12/commit/ab107e2' &&
      rCommit.querySelector('.f12-status-glyph')?.textContent === '[H]' &&
      rCommit.querySelector('.f12-sr-only')?.textContent === 'Origin: human: ' &&
      rFile.querySelector('.f12-status-glyph')?.textContent === '[A]' &&
      rFile.querySelector('.f12-sr-only')?.textContent === 'Origin: agent: ' &&
      rLong.querySelector('.f12-status-glyph')?.textContent === '[B]' &&
      rLong.querySelector('.f12-sr-only')?.textContent === 'Origin: bot: ' &&
      getComputedStyle(rLong.querySelector('.f12-receipt-value')).overflowWrap === 'anywhere' &&
      Boolean(linkAnchor) &&
      unsafeAnchor === null &&
      unsafeValueEl?.tagName === 'SPAN' &&
      unsafeValueEl?.textContent === 'Blocked Unsafe Script' &&
      relSlashAnchor?.getAttribute('href') === '/blob/main/registry/ui/receipt.tsx' &&
      relHashAnchor?.getAttribute('href') === '#cut-c-02' &&
      protoRelAnchor === null &&
      dataAnchor === null &&
      Boolean(unlinkedCode) &&
      unlinkedCode.textContent.trim() === 'deadbee' &&
      unlinkedCode.getAttribute('title') === 'deadbeefcafe1234567890' &&
      unlinkedShaSr?.textContent?.includes('deadbeefcafe1234567890') &&
      emptyTitleAnchor?.textContent?.trim() === 'Fallback title link' &&
      emptyTitleDuplicate === null &&
      emptyHrefAnchor?.textContent?.trim() === 'https://frame12.dev/raw';

    // Stamp checks
    const stampRemoved = document.getElementById('gallery-stamp-removed');
    const stampVerified = document.getElementById('gallery-stamp-verified');
    const stampLocked = document.getElementById('fixture-stamp-locked');
    const srCs = getComputedStyle(stampRemoved);
    const mat = new DOMMatrix(srCs.transform);
    const angleDeg = Math.round(Math.atan2(mat.b, mat.a) * (180 / Math.PI));
    const stampsOk =
      stampRemoved.getAttribute('data-variant') === 'stamp' &&
      stampVerified.getAttribute('data-variant') === 'stamp' &&
      stampLocked?.getAttribute('data-variant') === 'stamp' &&
      angleDeg === -3 &&
      srCs.textTransform === 'uppercase' &&
      parseFloat(srCs.borderTopWidth) === 2 &&
      srCs.borderTopStyle === 'solid' &&
      srCs.opacity === '1' &&
      stampRemoved.textContent.trim().length > 0;

    return {
      sceneGap: sceneCs.rowGap || sceneCs.gap,
      placedByAreaName,
      heroBesideStack,
      narrowDashAreasCollapsed,
      areas2ColOk,
      areas3ColOk,
      customBreakpointOk,
      gwNarrowContainerVertical,
      ghostWireOk,
      receiptsOk,
      stampsOk,
      angleDeg,
    };
  });

  const areasMismatchWarnings = await page.evaluate(async () => {
    const dev = await window.__testAreasRowMismatchWarning('development');
    const prod = await window.__testAreasRowMismatchWarning('production');
    return { dev, prod };
  });

  const gwMountPose = await page.evaluate(async () => {
    return window.__testGhostWireInitialMountPose();
  });

  // Verify GhostWire on-twos draw-on mask reveal when strength changes (via range switch)
  const drawOffsets = await page.evaluate(async () => {
    const line = document.querySelector('#gallery-ghost-wire line.f12-ghost-wire-reveal');
    const btn = document.getElementById('gal-rng-90');
    btn.click();
    const seen = [];
    const start = performance.now();
    while (performance.now() - start < 560) {
      await new Promise((r) => requestAnimationFrame(r));
      seen.push(Number(line.getAttribute('stroke-dashoffset') || '0'));
    }
    return {
      uniquePoses: [...new Set(seen)],
      finalOffset: Number(line.getAttribute('stroke-dashoffset') || '0'),
    };
  });
  await page.click('#gal-rng-30');

  // Resize below 860px (and below 520px for GhostWire auto orientation) to 360px
  await page.setViewportSize({ width: 360, height: 800 });
  await page.waitForTimeout(150);

  const f1203MobileCuts = isChromium
    ? await getRenderedCuts(page, { rootId: 'gallery-f12-03-sheet', panelsOnly: true })
    : ['C-01', 'C-02', 'C-03'];

  const f1203Mobile = await page.evaluate(() => {
    const hero = document.getElementById('gallery-area-hero');
    const sideTop = document.getElementById('gallery-area-side-top');
    const sideBot = document.getElementById('gallery-area-side-bot');
    const gwHigh = document.getElementById('gallery-ghost-wire');
    const fromChip = gwHigh.querySelector('.f12-ghost-wire-from').getBoundingClientRect();
    const toChip = gwHigh.querySelector('.f12-ghost-wire-to').getBoundingClientRect();

    const rHero = hero.getBoundingClientRect();
    const rTop = sideTop.getBoundingClientRect();
    const rBot = sideBot.getBoundingClientRect();

    const mobileOrderMatchesDom =
      getComputedStyle(hero).gridColumnStart === 'auto' &&
      rHero.bottom <= rTop.top + 2 &&
      rTop.bottom <= rBot.top + 2 &&
      Math.abs(rHero.left - rTop.left) <= 2 &&
      Math.abs(rTop.left - rBot.left) <= 2;

    const autoGhostWireVerticalBelow520 =
      gwHigh.getAttribute('data-orientation') === 'vertical' &&
      gwHigh.querySelector('svg.f12-ghost-wire-svg')?.getAttribute('viewBox') === '0 0 12 100' &&
      fromChip.bottom <= toChip.top + 2;

    const fixturesRoot = document.getElementById('unit-fixtures-root');
    const prevDisplay = fixturesRoot ? fixturesRoot.style.display : '';
    if (fixturesRoot) fixturesRoot.style.display = 'none';
    const scrollWidth = document.documentElement.scrollWidth;
    const noOverflow360 = scrollWidth <= document.documentElement.clientWidth + 1;
    if (fixturesRoot) fixturesRoot.style.display = prevDisplay;

    return {
      mobileOrderMatchesDom,
      autoGhostWireVerticalBelow520,
      noOverflow360,
      scrollWidth,
    };
  });

  await page.setViewportSize({ width: 1280, height: 900 });

  check(
    f1203Desktop.sceneGap === '20px' &&
      f1203Desktop.placedByAreaName &&
      f1203Desktop.heroBesideStack &&
      f1203Desktop.narrowDashAreasCollapsed &&
      f1203Desktop.areas2ColOk &&
      f1203Desktop.areas3ColOk &&
      f1203Desktop.customBreakpointOk &&
      f1203Desktop.gwNarrowContainerVertical &&
      areasMismatchWarnings.dev.warnings.length === 3 &&
      areasMismatchWarnings.dev.warnings.some((w) => w.includes('Mismatched column counts')) &&
      areasMismatchWarnings.dev.warnings.some((w) =>
        w.includes('Explicit columns (12) does not match'),
      ) &&
      areasMismatchWarnings.dev.warnings.some((w) => w.includes('Invalid breakpoint "calc(50vw)"')) &&
      areasMismatchWarnings.dev.derivedCols === '2' &&
      areasMismatchWarnings.dev.fallbackBp === '860px' &&
      areasMismatchWarnings.prod.warnings.length === 0 &&
      gwMountPose.firstFrameOffset > 0 &&
      gwMountPose.finalOffset === 0 &&
      gwMountPose.multiRootDistinctMasks &&
      f1203Desktop.ghostWireOk &&
      f1203Desktop.receiptsOk &&
      f1203Desktop.stampsOk &&
      drawOffsets.uniquePoses.length >= 2 &&
      drawOffsets.uniquePoses.length <= 7 &&
      drawOffsets.finalOffset === 0 &&
      f1203DesktopCuts.join(',') === 'C-01,C-02,C-03' &&
      f1203Mobile.mobileOrderMatchesDom &&
      f1203Mobile.autoGhostWireVerticalBelow520 &&
      f1203Mobile.noOverflow360 &&
      f1203MobileCuts.join(',') === 'C-01,C-02,C-03',
    'F12-03 primitives: named-area Scene (2/3/12-col derived areas, explicit columns override + dev warnings, scoped <style> breakpoint, narrow .f12-dash @container collapse, <860px single-column DOM/reading/cut order), GhostWire (solid/dashed chips, non-scaling-stroke, strength dash density, single data-orientation source of truth at <520px, on-twos SVG mask reveal without initial full-line flash), Receipt/ReceiptList (role="list", <code> 7-char SHA + full hash title/sr-only, empty-value accessible fallback, 200-char path wrap at 360px, WP3 origin glyph+srLabel, relative/hash/http(s) vs javascript:/data:/protocol-relative link safety), and Tag variant="stamp" (-3deg rotation, display font, 2px ink border, locked variant)',
    JSON.stringify({
      f1203Desktop,
      areasMismatchWarnings,
      gwMountPose,
      drawOffsets,
      f1203DesktopCuts,
      f1203Mobile,
      f1203MobileCuts,
    }),
  );
}

check(errors.length === 0, 'gallery unit run: zero console or page errors', errors[0] || '');

await ctx.close();
await browser.close();
finish();
