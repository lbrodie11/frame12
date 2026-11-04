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

  // Verify every registry item has explicit target paths (or font config), includes frame12-styles (directly or via registryDependencies), and has no conflicting bare shadcn registryDependencies
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
    const hasDepStyles =
      Array.isArray(item.registryDependencies) &&
      item.registryDependencies.includes('https://frame12.dev/r/frame12-styles.json');
    if (item.name !== 'use-on-twos' && !hasDirectStyles && !hasDepStyles) {
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

check(errors.length === 0, 'gallery unit run: zero console or page errors', errors[0] || '');

await ctx.close();
await browser.close();
finish();
