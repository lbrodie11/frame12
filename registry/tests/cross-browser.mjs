// Cross-browser verification suite for @frame12/registry across Chromium, Firefox, and WebKit.
// Covers viewports (1280px desktop, 768px container-query transition, 390px mobile),
// themes (light, dark), preferences (reduced-motion, forced-colors), and all 19 components.

import { launch, openGallery, getRenderedCuts, check, finish } from './lib.mjs';

const BROWSER_NAMES = (process.env.BROWSERS || 'chromium,firefox,webkit')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

for (const browserName of BROWSER_NAMES) {
  console.log(`\n=== Cross-Browser Matrix: ${browserName.toUpperCase()} ===`);
  const browser = await launch(browserName);

  try {
    // 1. Desktop (1280x900) Light Theme + Component Compatibility
    {
      const { ctx, page, errors } = await openGallery(browser, {
        w: 1280,
        h: 900,
        scheme: 'light',
      });
      await page.evaluate(() => window.__mountUnitFixtures && window.__mountUnitFixtures());
      await page.waitForSelector('#unit-test-fixtures', { timeout: 5000 });

      // Sheet & Panel composition + PanelPair 16px slant geometry + host-style reset protection
      const compGeometry = await page.evaluate(() => {
        const sheet = document.getElementById('gallery-sheet');
        const sheetStyle = getComputedStyle(sheet);
        const c01 = document.querySelector('#scene-primary .c01');
        const pair = document.getElementById('panel-pair-kpis');
        const c01Rect = c01.getBoundingClientRect();
        const pairRect = pair.getBoundingClientRect();

        const topFill = document
          .querySelector('#panel-pair-kpis .f12-slant-bottom .f12-panel-frame polygon')
          ?.getAttribute('points');
        const botFill = document
          .querySelector('#panel-pair-kpis .f12-slant-top .f12-panel-frame polygon')
          ?.getAttribute('points');
        const parsePts = (pts) =>
          (pts || '')
            .trim()
            .split(/\s+/)
            .map((p) => p.split(',').map(Number));
        const topPts = parsePts(topFill);
        const botPts = parsePts(botFill);
        const topSlantDrop =
          topPts.length === 4 ? Math.round(topPts[3][1] - topPts[2][1]) : -1;
        const botSlantDrop =
          botPts.length === 4 ? Math.round(botPts[0][1] - botPts[1][1]) : -1;

        // Verify .f12-dash :where(h2, h3, p, ul) protects against host element margins while preserving .f12-sub (8px) and .f12-delta (14px) margin-top
        const hostStyle = document.createElement('style');
        hostStyle.id = 'host-leak-test';
        hostStyle.textContent = 'p, h2, h3, ul { margin: 16px 0; }';
        document.head.appendChild(hostStyle);
        const eyebrowCs = getComputedStyle(document.querySelector('.f12-eyebrow'));
        const subCs = getComputedStyle(document.querySelector('.f12-sub'));
        const deltaCs = getComputedStyle(document.querySelector('.f12-delta'));
        const eyebrowMarginTop = eyebrowCs.marginTop;
        const eyebrowMarginBottom = eyebrowCs.marginBottom;
        const subMarginTop = subCs.marginTop;
        const subMarginBottom = subCs.marginBottom;
        const deltaMarginTop = deltaCs.marginTop;
        hostStyle.remove();

        return {
          containerType: sheetStyle.containerType,
          sheetBg: sheetStyle.backgroundColor,
          sideBySide: c01Rect.right <= pairRect.left + 1,
          topSlantDrop,
          botSlantDrop,
          eyebrowMarginTop,
          eyebrowMarginBottom,
          subMarginTop,
          subMarginBottom,
          deltaMarginTop,
          docOverflow:
            document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
        };
      });

      check(
        compGeometry.containerType === 'inline-size' &&
          compGeometry.sideBySide &&
          compGeometry.eyebrowMarginTop === '0px' &&
          compGeometry.eyebrowMarginBottom === '0px' &&
          compGeometry.subMarginTop === '8px' &&
          compGeometry.subMarginBottom === '0px' &&
          compGeometry.deltaMarginTop === '14px',
        `[${browserName} 1280px] Sheet container-type, 2-col Scene split, and .f12-dash host-style protection (.f12-delta 14px preserved)`,
        JSON.stringify(compGeometry),
      );
      check(
        compGeometry.topSlantDrop === 16 && compGeometry.botSlantDrop === 16,
        `[${browserName} 1280px] PanelPair parallel 16px SVG slant geometry`,
        `top=${compGeometry.topSlantDrop}px bottom=${compGeometry.botSlantDrop}px`,
      );
      check(
        compGeometry.docOverflow,
        `[${browserName} 1280px] zero horizontal document overflow`,
      );

      // Automatic cut numbering (<Sheet autoCut>): in Chromium read CDP layout snapshot; in Firefox & WebKit verify panel count, visible auto-cut badges, and reading order
      const panelOrder = await page.evaluate(() => {
        const panels = [...document.querySelectorAll('#gallery-sheet .f12-panel:not(.f12-panel-quiet)')];
        const quietPanels = [...document.querySelectorAll('#gallery-sheet .f12-panel.f12-panel-quiet')];
        const cutEls = [...document.querySelectorAll('#gallery-sheet .f12-panel > .f12-cut')].filter(
          (e) => getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0,
        );
        const rects = cutEls.map((e) => {
          const r = e.getBoundingClientRect();
          return { top: Math.round(r.top), left: Math.round(r.left) };
        });
        let readingOrder = rects.length === 7;
        for (let i = 1; i < rects.length; i++) {
          const prev = rects[i - 1];
          const cur = rects[i];
          const sameRow = Math.abs(cur.top - prev.top) < 40;
          if (sameRow && cur.left < prev.left) readingOrder = false;
          if (!sameRow && cur.top < prev.top - 40) readingOrder = false;
        }
        const compVisibleCuts = [
          ...document.querySelectorAll('#fixture-autocut-composition .f12-panel > .f12-cut'),
        ].filter((e) => getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0);
        const slantTopPx = getComputedStyle(
          document.querySelector('#fixture-autocut-pair .f12-panel.f12-slant-top > .f12-cut'),
        ).top;
        return {
          panelCount: panels.length,
          quietPanelCount: quietPanels.length,
          visibleCutCount: cutEls.length,
          readingOrder,
          compVisibleCount: compVisibleCuts.length,
          slantTopPx,
        };
      });
      const chromiumCuts =
        browserName === 'chromium'
          ? await getRenderedCuts(page, { rootId: 'gallery-sheet', panelsOnly: true })
          : null;
      check(
        panelOrder.panelCount === 7 &&
          panelOrder.quietPanelCount === 1 &&
          panelOrder.visibleCutCount === 7 &&
          panelOrder.readingOrder &&
          panelOrder.compVisibleCount === 7 &&
          panelOrder.slantTopPx === '8px' &&
          (browserName !== 'chromium' ||
            chromiumCuts.join(',') === 'C-01,C-02,C-03,C-04,C-05,C-06,C-07'),
        `[${browserName} 1280px] <Sheet autoCut> panel count (7 expressive + 1 unnumbered quiet), reading order, slant-top position (8px), and skipped hidden/cut={false}/quiet panels`,
        JSON.stringify({ ...panelOrder, chromiumCuts }),
      );

      // SegmentedControl roving tabindex, modified-key guard, focus-only arrows, Space/Enter activation, and focus contrast
      await page.focus('#mo-stepped');
      await page.keyboard.press('Alt+ArrowRight');
      const afterAltRight = await page.evaluate(() => ({
        activeId: document.activeElement?.id,
        steppedTabIndex: document.getElementById('mo-stepped')?.tabIndex,
        smoothTabIndex: document.getElementById('mo-smooth')?.tabIndex,
        cutTabIndex: document.getElementById('mo-cut')?.tabIndex,
      }));
      await page.keyboard.press('ArrowRight');
      const afterRightFocusOnly = await page.evaluate(() => {
        const smooth = document.getElementById('mo-smooth');
        return {
          activeId: document.activeElement?.id,
          steppedPressed: document.getElementById('mo-stepped')?.getAttribute('aria-pressed'),
          smoothPressed: smooth?.getAttribute('aria-pressed'),
          smoothTabIndex: smooth?.tabIndex,
          steppedTabIndex: document.getElementById('mo-stepped')?.tabIndex,
          smoothOutlineColor: smooth ? getComputedStyle(smooth).outlineColor : '',
        };
      });
      await page.keyboard.press('Space');
      const afterSpaceActivate = await page.evaluate(() => ({
        smoothPressed: document.getElementById('mo-smooth')?.getAttribute('aria-pressed'),
      }));
      await page.keyboard.press('End');
      const afterEndFocusOnly = await page.evaluate(() => ({
        activeId: document.activeElement?.id,
        smoothStillPressed: document.getElementById('mo-smooth')?.getAttribute('aria-pressed'),
        cutPressed: document.getElementById('mo-cut')?.getAttribute('aria-pressed'),
      }));
      await page.keyboard.press('Enter');
      await page.keyboard.press('Home');
      await page.keyboard.press('Space');
      const afterHomeActivate = await page.evaluate(() => ({
        activeId: document.activeElement?.id,
        steppedPressed: document.getElementById('mo-stepped')?.getAttribute('aria-pressed'),
      }));
      check(
        afterAltRight.activeId === 'mo-stepped' &&
          afterAltRight.steppedTabIndex === 0 &&
          afterAltRight.smoothTabIndex === -1 &&
          afterAltRight.cutTabIndex === -1 &&
          afterRightFocusOnly.activeId === 'mo-smooth' &&
          afterRightFocusOnly.steppedPressed === 'true' &&
          afterRightFocusOnly.smoothPressed === 'false' &&
          afterRightFocusOnly.smoothTabIndex === 0 &&
          afterRightFocusOnly.steppedTabIndex === -1 &&
          afterRightFocusOnly.smoothOutlineColor === 'rgb(18, 18, 18)' &&
          afterSpaceActivate.smoothPressed === 'true' &&
          afterEndFocusOnly.activeId === 'mo-cut' &&
          afterEndFocusOnly.smoothStillPressed === 'true' &&
          afterEndFocusOnly.cutPressed === 'false' &&
          afterHomeActivate.activeId === 'mo-stepped' &&
          afterHomeActivate.steppedPressed === 'true',
        `[${browserName}] SegmentedControl roving tabindex, Alt+Arrow guard, focus-only Arrow/Home/End, Space/Enter activation, and 18.7:1 ink focus ring`,
        JSON.stringify({
          afterAltRight,
          afterRightFocusOnly,
          afterSpaceActivate,
          afterEndFocusOnly,
          afterHomeActivate,
        }),
      );

      // Dialog modal focus containment, background inertness, nested DropdownMenu Escape isolation, and focus restoration
      // Focus #input-store before clicking #gal-dialog-open to verify WebKit pointer-click focus restoration
      await page.focus('#input-store');
      await page.click('#gal-dialog-open');
      await page.waitForSelector('dialog.f12-dialog[open]', { timeout: 3000 });

      const modalContainment = await page.evaluate(() => {
        const dlg = document.querySelector('dialog.f12-dialog[open]');
        if (!dlg) return { isModal: false, initialInside: false };
        window.__dlgInitialFocus = document.activeElement;
        const isModal = dlg.matches(':modal');
        const initialInside = dlg.contains(document.activeElement);
        return { isModal, initialInside };
      });
      await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
      const focusAfterTab = await page.evaluate(() => {
        const dlg = document.querySelector('dialog.f12-dialog[open]');
        const afterTabEl = document.activeElement;
        // Also verify background controls outside modal <dialog> cannot steal focus
        document.getElementById('mo-smooth')?.focus();
        const afterBgFocusAttempt = document.activeElement;
        return Boolean(
          dlg &&
            dlg.contains(afterTabEl) &&
            afterTabEl !== window.__dlgInitialFocus &&
            dlg.contains(afterBgFocusAttempt),
        );
      });
      check(
        modalContainment.isModal && modalContainment.initialInside && focusAfterTab,
        `[${browserName}] Dialog opens as top-layer :modal, keeps Tab focus inside dialog, and makes background controls inert`,
        JSON.stringify({ modalContainment, focusAfterTab }),
      );

      // Open nested DropdownMenu inside Dialog and verify it portals inside <dialog> and closes on first Escape
      await page.focus('#gal-dialog-menu-trigger');
      await page.keyboard.press('Enter');
      await page.waitForSelector('[role="menu"]', { timeout: 3000 });
      const menuPortaledInDialog = await page.evaluate(() => {
        const dlg = document.querySelector('dialog.f12-dialog[open]');
        const menu = document.querySelector('[role="menu"]');
        return Boolean(dlg && menu && dlg.contains(menu) && dlg.contains(document.activeElement));
      });
      await page.keyboard.press('Escape');
      await page.waitForFunction(
        () =>
          !document.querySelector('[role="menu"]') &&
          Boolean(document.querySelector('dialog.f12-dialog')?.open) &&
          document.activeElement?.id === 'gal-dialog-menu-trigger',
        null,
        { timeout: 3000 },
      );

      const afterFirstEsc = await page.evaluate(() => ({
        menuPresent: Boolean(document.querySelector('[role="menu"]')),
        dialogStillOpen: Boolean(document.querySelector('dialog.f12-dialog')?.open),
      }));
      check(
        menuPortaledInDialog && !afterFirstEsc.menuPresent && afterFirstEsc.dialogStillOpen,
        `[${browserName}] Nested DropdownMenu portals into <dialog> and first Escape closes only the menu`,
        JSON.stringify({ menuPortaledInDialog, afterFirstEsc }),
      );

      // Second Escape closes Dialog and restores focus to #gal-dialog-open (even when #input-store was focused pre-click)
      await page.keyboard.press('Escape');
      await page.waitForFunction(
        () =>
          !document.querySelector('dialog.f12-dialog')?.open &&
          document.activeElement?.id === 'gal-dialog-open',
        null,
        { timeout: 3000 },
      );
      const afterSecondEsc = await page.evaluate(() => ({
        dialogOpen: Boolean(document.querySelector('dialog.f12-dialog')?.open),
        activeId: document.activeElement?.id,
      }));
      check(
        !afterSecondEsc.dialogOpen && afterSecondEsc.activeId === 'gal-dialog-open',
        `[${browserName}] Dialog Escape close restores focus to trigger (#gal-dialog-open) even after pre-click input focus`,
        JSON.stringify(afterSecondEsc),
      );

      // Re-open Dialog and close via DialogClose button -> verify focus returns to #gal-dialog-open
      await page.click('#gal-dialog-open');
      await page.waitForSelector('dialog.f12-dialog[open]', { timeout: 3000 });
      await page.click('#gal-dialog-close');
      await page.waitForFunction(
        () =>
          !document.querySelector('dialog.f12-dialog')?.open &&
          document.activeElement?.id === 'gal-dialog-open',
        null,
        { timeout: 3000 },
      );
      const afterBtnClose = await page.evaluate(() => ({
        dialogOpen: Boolean(document.querySelector('dialog.f12-dialog')?.open),
        activeId: document.activeElement?.id,
      }));
      check(
        !afterBtnClose.dialogOpen && afterBtnClose.activeId === 'gal-dialog-open',
        `[${browserName}] DialogClose button restores focus to trigger (#gal-dialog-open)`,
        JSON.stringify(afterBtnClose),
      );

      // Re-open Dialog after focusing #input-store and close via backdrop click (5, 5) -> verify focus returns to #gal-dialog-open
      await page.focus('#input-store');
      await page.click('#gal-dialog-open');
      await page.waitForSelector('dialog.f12-dialog[open]', { timeout: 3000 });
      await page.mouse.click(5, 5);
      await page.waitForFunction(
        () =>
          !document.querySelector('dialog.f12-dialog')?.open &&
          document.activeElement?.id === 'gal-dialog-open',
        null,
        { timeout: 3000 },
      );
      const afterBackdropClose = await page.evaluate(() => ({
        dialogOpen: Boolean(document.querySelector('dialog.f12-dialog')?.open),
        activeId: document.activeElement?.id,
      }));
      check(
        !afterBackdropClose.dialogOpen && afterBackdropClose.activeId === 'gal-dialog-open',
        `[${browserName}] Dialog backdrop click close restores focus to trigger (#gal-dialog-open) after pre-click input focus`,
        JSON.stringify(afterBackdropClose),
      );

      // Select keyboard navigation, highlighted item focus contrast, & Escape dismissal
      await page.focus('#gal-select');
      await page.keyboard.press('Enter');
      await page.waitForSelector('[role="listbox"] .f12-select-item[data-highlighted]', {
        timeout: 3000,
      });
      await page.keyboard.press('ArrowDown');
      const selectHighlightedOutline = await page.evaluate(() => {
        const item = document.querySelector('.f12-select-item[data-highlighted]');
        return item ? getComputedStyle(item).outlineColor : '';
      });
      await page.keyboard.press('Escape');
      await page.waitForFunction(
        () =>
          !document.querySelector('[role="listbox"]') &&
          document.activeElement?.id === 'gal-select',
        null,
        { timeout: 3000 },
      );
      const selectAfterEsc = {
        ...(await page.evaluate(() => {
          const form = document.getElementById('gal-select-form');
          const fd = form ? new FormData(form) : null;
          return {
            listboxOpen: Boolean(document.querySelector('[role="listbox"]')),
            activeId: document.activeElement?.id,
            hiddenVal: fd ? fd.get('recoveryChannel') : null,
          };
        })),
        selectHighlightedOutline,
      };
      check(
        !selectAfterEsc.listboxOpen &&
          selectAfterEsc.activeId === 'gal-select' &&
          selectAfterEsc.hiddenVal === 'email' &&
          selectHighlightedOutline === 'rgb(255, 255, 255)',
        `[${browserName}] Select keyboard open/navigate/Escape, highlighted item focus ring, & FormData sync`,
        JSON.stringify(selectAfterEsc),
      );

      // DropdownMenu standalone keyboard navigation, highlighted item focus contrast, & Escape focus return
      await page.focus('#gal-menu-trigger');
      await page.keyboard.press('Enter');
      await page.waitForSelector('[role="menu"] .f12-menu-item[data-highlighted]', {
        timeout: 3000,
      });
      await page.keyboard.press('ArrowDown');
      const menuHighlightedOutline = await page.evaluate(() => {
        const item = document.querySelector('.f12-menu-item[data-highlighted]');
        return item ? getComputedStyle(item).outlineColor : '';
      });
      await page.keyboard.press('Escape');
      await page.waitForFunction(
        () =>
          !document.querySelector('[role="menu"]') &&
          document.activeElement?.id === 'gal-menu-trigger',
        null,
        { timeout: 3000 },
      );
      const menuAfterEsc = {
        ...(await page.evaluate(() => ({
          menuOpen: Boolean(document.querySelector('[role="menu"]')),
          activeId: document.activeElement?.id,
        }))),
        menuHighlightedOutline,
      };
      check(
        !menuAfterEsc.menuOpen &&
          menuAfterEsc.activeId === 'gal-menu-trigger' &&
          menuHighlightedOutline === 'rgb(255, 255, 255)',
        `[${browserName}] DropdownMenu keyboard open/ArrowDown/Escape, highlighted item focus ring, & focus return`,
        JSON.stringify(menuAfterEsc),
      );

      // ToneBarList selected row focus-visible outline contrast (--f-panel on --f-ink)
      await page.focus('#int-gal-exit');
      await page.keyboard.press('Space');
      const barSelectedFocus = await page.evaluate(() => {
        const row = document.getElementById('int-gal-exit');
        if (!row) return { pressed: null, outlineColor: '', bgColor: '' };
        const cs = getComputedStyle(row);
        return {
          pressed: row.getAttribute('aria-pressed'),
          outlineColor: cs.outlineColor,
          bgColor: cs.backgroundColor,
        };
      });
      await page.keyboard.press('Space');
      check(
        barSelectedFocus.pressed === 'true' &&
          barSelectedFocus.bgColor === 'rgb(18, 18, 18)' &&
          barSelectedFocus.outlineColor === 'rgb(255, 255, 255)',
        `[${browserName}] ToneBarList selected row (aria-pressed="true") switches focus-visible outline to --f-panel (18.7:1)`,
        JSON.stringify(barSelectedFocus),
      );

      // Tooltip keyboard focus & Escape dismissal
      await page.focus('#gal-tooltip-trigger');
      await page.waitForSelector('#gal-tooltip-trigger + [role="tooltip"]', { timeout: 3000 });
      await page.keyboard.press('Escape');
      await page.waitForFunction(
        () =>
          !document.querySelector('#gal-tooltip-trigger + [role="tooltip"]') &&
          document.activeElement?.id === 'gal-tooltip-trigger',
        null,
        { timeout: 3000 },
      );
      const tipAfterEsc = await page.evaluate(() => ({
        tipVisible: Boolean(document.querySelector('#gal-tooltip-trigger + [role="tooltip"]')),
        activeId: document.activeElement?.id,
      }));
      check(
        !tipAfterEsc.tipVisible && tipAfterEsc.activeId === 'gal-tooltip-trigger',
        `[${browserName}] Tooltip focus reveal & Escape dismissal without losing trigger focus`,
      );

      // Charts keyboard scrubbing + accessible <details class="f12-tbl"> table alternative
      const chartSelector = '#scene-primary .f12-chart-svg';
      await page.focus(chartSelector);
      await page.keyboard.press('ArrowLeft');
      const chartA11y = await page.evaluate(() => {
        const tipVisible = Boolean(document.querySelector('#scene-primary .f12-chart .f12-tip'));
        const tblRows = document.querySelectorAll('#scene-primary details.f12-tbl tbody tr').length;
        const sparkRole = document
          .querySelector('#panel-pair-kpis .f12-spark svg')
          ?.getAttribute('role');
        return { tipVisible, tblRows, sparkRole };
      });
      await page.keyboard.press('Escape');
      check(
        chartA11y.tipVisible && chartA11y.tblRows === 30 && chartA11y.sparkRole === 'img',
        `[${browserName}] ToneAreaChart keyboard crosshair tooltip, 30-row <details> table, and ToneSpark role="img"`,
        JSON.stringify(chartA11y),
      );

      // Long filenames/tokens in Balloon & Unicode text in Input + Input role="alert" error
      await page.fill('#input-store', '東京 · フレーム/12 — C-01 «テスト»');
      await page.fill('#input-threshold', '5');
      const textAndError = await page.evaluate(() => {
        const balloon = document.getElementById('test-balloon-long');
        const bWrap = document.getElementById('test-balloon-wrap');
        const storeVal = document.getElementById('input-store')?.value;
        const eyebrow = document.querySelector('.f12-eyebrow')?.textContent || '';
        const thresh = document.getElementById('input-threshold');
        const alertEl = document.querySelector('#scene-secondary [role="alert"]');
        return {
          balloonFits: balloon && bWrap ? balloon.scrollWidth <= bWrap.clientWidth + 1 : false,
          unicodeRendered:
            storeVal === '東京 · フレーム/12 — C-01 «テスト»' &&
            eyebrow.includes('東京 · フレーム/12'),
          ariaInvalid: thresh?.getAttribute('aria-invalid'),
          alertText: alertEl?.textContent || '',
        };
      });
      check(
        textAndError.balloonFits &&
          textAndError.unicodeRendered &&
          textAndError.ariaInvalid === 'true' &&
          textAndError.alertText.includes('at least 10%'),
        `[${browserName}] Long unbroken token wraps in Balloon, Unicode CJK text renders, and Input error announces via role="alert"`,
        JSON.stringify(textAndError),
      );

      check(
        errors.length === 0,
        `[${browserName} 1280px light] zero console/page errors after all interactions`,
        errors.join('; '),
      );

      await ctx.close();
    }

    // 2. Targeted 768px Viewport & Container-Query Transition (<= 760px vs > 760px)
    {
      const { ctx, page, errors } = await openGallery(browser, {
        w: 768,
        h: 900,
        scheme: 'light',
      });

      const cqTransition = await page.evaluate(() => {
        const sheet = document.getElementById('gallery-sheet');
        const c01 = document.querySelector('#scene-primary .c01');
        const pair = document.getElementById('panel-pair-kpis');

        // At 768px viewport, .f12-dash has 20px horizontal padding -> content-box inline-size <= 728px (<= 760px container query active)
        const stackedAtDefault768 =
          c01.getBoundingClientRect().bottom <= pair.getBoundingClientRect().top + 2;
        const overflowAt768 =
          document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1;

        // Set container content-box inline-size to 768px (> 760px threshold) to verify container-query 2-column transition
        sheet.style.boxSizing = 'content-box';
        sheet.style.width = '768px';
        const splitAt768Container =
          c01.getBoundingClientRect().right <= pair.getBoundingClientRect().left + 2;
        sheet.style.boxSizing = '';
        sheet.style.width = '';

        return { stackedAtDefault768, splitAt768Container, overflowAt768 };
      });

      check(
        cqTransition.stackedAtDefault768 &&
          cqTransition.splitAt768Container &&
          cqTransition.overflowAt768 &&
          errors.length === 0,
        `[${browserName} 768px] @container (max-width: 760px) transitions cleanly between 1-col (<=760px) and 2-col (768px) with zero overflow or errors`,
        errors.length ? errors.join('; ') : JSON.stringify(cqTransition),
      );

      await ctx.close();
    }

    // 3. Mobile (390x844) Dark Theme, Reduced Motion, and Table Overflow Containment
    {
      const { ctx, page, errors } = await openGallery(browser, {
        w: 390,
        h: 844,
        scheme: 'dark',
        reduced: 'reduce',
      });

      const mobileState = await page.evaluate(() => {
        const sheet = document.getElementById('gallery-sheet');
        const sheetStyle = getComputedStyle(sheet);
        const sheetToken = sheetStyle.getPropertyValue('--f-sheet').trim();
        const deskBg = sheetStyle.backgroundColor;
        const indTransition = getComputedStyle(
          document.querySelector('.f12-rng-ind'),
        ).transitionDuration;
        const c01 = document.querySelector('#scene-primary .c01').getBoundingClientRect();
        const pair = document.getElementById('panel-pair-kpis').getBoundingClientRect();
        const tableWrap = document.querySelector('.f12-table-wrap');
        const tableWrapStyle = getComputedStyle(tableWrap);

        // Constrain table wrapper to 200px to verify horizontal scroll containment without page overflow
        tableWrap.style.maxWidth = '200px';
        const tableContained =
          tableWrapStyle.overflowX === 'auto' &&
          document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1;
        tableWrap.style.maxWidth = '';

        return {
          sheetToken,
          deskBg,
          indTransition,
          stacked: c01.bottom <= pair.top + 2,
          noDocOverflow:
            document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
          tableContained,
        };
      });

      check(
        mobileState.sheetToken === '#050505' &&
          mobileState.indTransition === '0s' &&
          mobileState.stacked &&
          mobileState.noDocOverflow &&
          mobileState.tableContained &&
          errors.length === 0,
        `[${browserName} 390px dark + reduced-motion] Dark tokens (#050505), transition: 0s, single-column stack, Table overflow containment, and zero errors`,
        errors.length ? errors.join('; ') : JSON.stringify(mobileState),
      );

      await ctx.close();
    }

    // 4. Forced-Colors Mode (supported natively by Chromium and Firefox in Playwright)
    if (browserName === 'chromium' || browserName === 'firefox') {
      const { ctx, page, errors } = await openGallery(browser, {
        w: 1280,
        h: 900,
        scheme: 'light',
        forcedColors: 'active',
      });

      await page.evaluate(() => window.__mountUnitFixtures && window.__mountUnitFixtures());
      const fcState = await page.evaluate(() => {
        const matchesFC = window.matchMedia('(forced-colors: active)').matches;
        const tag = document.querySelector('.f12-tag');
        const rngInd = document.querySelector('.f12-rng-ind');
        const hatchFill = document.querySelector('.f12-int-fill-hatch');
        const denseFill = document.querySelector('.f12-int-fill-dense');
        const warnTag = document.querySelector('#fixture-tag-warning');
        const dangerTag = document.querySelector('#fixture-tag-danger');
        const tagBorder = getComputedStyle(tag).borderTopWidth;
        const warnBorderStyle = warnTag ? getComputedStyle(warnTag).borderTopStyle : '';
        const dangerBorderStyle = dangerTag ? getComputedStyle(dangerTag).borderTopStyle : '';
        const rngMixBlend = getComputedStyle(rngInd).mixBlendMode;
        const rngBorder = getComputedStyle(rngInd).borderTopWidth;
        const hatchBgImg = hatchFill ? getComputedStyle(hatchFill).backgroundImage : '';
        const denseBgImg = denseFill ? getComputedStyle(denseFill).backgroundImage : '';
        return {
          matchesFC,
          tagBorder,
          warnBorderStyle,
          dangerBorderStyle,
          rngMixBlend,
          rngBorder,
          hatchBgImg,
          denseBgImg,
        };
      });

      check(
        fcState.matchesFC &&
          fcState.tagBorder === '1px' &&
          fcState.warnBorderStyle === 'dashed' &&
          fcState.dangerBorderStyle === 'double' &&
          fcState.rngMixBlend === 'normal' &&
          fcState.rngBorder === '2px' &&
          fcState.hatchBgImg === 'none' &&
          fcState.denseBgImg === 'none' &&
          errors.length === 0,
        `[${browserName} forced-colors: active] activates CanvasText/Highlight borders, preserves distinct status border styles (dashed/double), clears hatch/dense bar gradients, disables mix-blend-mode, and has zero errors`,
        errors.length ? errors.join('; ') : JSON.stringify(fcState),
      );

      await ctx.close();
    }
  } finally {
    await browser.close();
  }
}

finish();
