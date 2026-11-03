// Cross-browser verification suite for @frame12/registry across Chromium, Firefox, and WebKit.
// Covers viewports (1280px desktop, 768px container-query transition, 390px mobile),
// themes (light, dark), preferences (reduced-motion, forced-colors), and all 19 components.

import { launch, openGallery, check, finish } from './lib.mjs';

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

      check(
        errors.length === 0,
        `[${browserName} 1280px light] zero console/page errors`,
        errors.join('; '),
      );

      // Sheet & Panel composition + PanelPair 16px slant geometry
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

        return {
          containerType: sheetStyle.containerType,
          sheetBg: sheetStyle.backgroundColor,
          sideBySide: c01Rect.right <= pairRect.left + 1,
          topSlantDrop,
          botSlantDrop,
          docOverflow:
            document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
        };
      });

      check(
        compGeometry.containerType === 'inline-size' && compGeometry.sideBySide,
        `[${browserName} 1280px] Sheet container-type: inline-size & Scene 2-column split layout`,
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

      // SegmentedControl keyboard navigation (ArrowRight, End, Home)
      await page.focus('#mo-stepped');
      await page.keyboard.press('ArrowRight');
      const afterRight = await page.evaluate(() => ({
        smoothPressed: document.getElementById('mo-smooth')?.getAttribute('aria-pressed'),
        activeId: document.activeElement?.id,
      }));
      await page.keyboard.press('End');
      const afterEnd = await page.evaluate(() => ({
        cutPressed: document.getElementById('mo-cut')?.getAttribute('aria-pressed'),
        activeId: document.activeElement?.id,
      }));
      await page.keyboard.press('Home');
      const afterHome = await page.evaluate(() => ({
        steppedPressed: document.getElementById('mo-stepped')?.getAttribute('aria-pressed'),
        activeId: document.activeElement?.id,
      }));
      check(
        afterRight.smoothPressed === 'true' &&
          afterRight.activeId === 'mo-smooth' &&
          afterEnd.cutPressed === 'true' &&
          afterEnd.activeId === 'mo-cut' &&
          afterHome.steppedPressed === 'true' &&
          afterHome.activeId === 'mo-stepped',
        `[${browserName}] SegmentedControl keyboard navigation (ArrowRight/End/Home) updates selection & focus`,
      );

      // Dialog focus trapping, nested DropdownMenu Escape isolation, and focus restoration
      await page.focus('#gal-dialog-open');
      await page.click('#gal-dialog-open');
      await page.waitForSelector('dialog.f12-dialog[open]', { timeout: 3000 });

      const focusInsideDialog = await page.evaluate(() => {
        const dlg = document.querySelector('dialog.f12-dialog[open]');
        return Boolean(dlg && dlg.contains(document.activeElement));
      });
      check(
        focusInsideDialog,
        `[${browserName}] Dialog moves focus inside modal on open`,
      );

      // Open nested DropdownMenu inside Dialog
      await page.focus('#gal-dialog-menu-trigger');
      await page.keyboard.press('Enter');
      await page.waitForSelector('[role="menu"]', { timeout: 3000 });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(80);

      const afterFirstEsc = await page.evaluate(() => ({
        menuPresent: Boolean(document.querySelector('[role="menu"]')),
        dialogStillOpen: Boolean(document.querySelector('dialog.f12-dialog')?.open),
      }));
      check(
        !afterFirstEsc.menuPresent && afterFirstEsc.dialogStillOpen,
        `[${browserName}] Nested-overlay Escape closes inner DropdownMenu while keeping outer Dialog open`,
      );

      // Second Escape closes Dialog and restores focus to #gal-dialog-open
      await page.keyboard.press('Escape');
      await page.waitForTimeout(80);
      const afterSecondEsc = await page.evaluate(() => ({
        dialogOpen: Boolean(document.querySelector('dialog.f12-dialog')?.open),
        activeId: document.activeElement?.id,
      }));
      check(
        !afterSecondEsc.dialogOpen && afterSecondEsc.activeId === 'gal-dialog-open',
        `[${browserName}] Dialog Escape close restores focus to trigger (#gal-dialog-open)`,
        JSON.stringify(afterSecondEsc),
      );

      // Re-open Dialog and close via DialogClose button -> verify focus returns to #gal-dialog-open
      await page.click('#gal-dialog-open');
      await page.waitForSelector('dialog.f12-dialog[open]', { timeout: 3000 });
      await page.click('#gal-dialog-close');
      await page.waitForTimeout(80);
      const afterBtnClose = await page.evaluate(() => ({
        dialogOpen: Boolean(document.querySelector('dialog.f12-dialog')?.open),
        activeId: document.activeElement?.id,
      }));
      check(
        !afterBtnClose.dialogOpen && afterBtnClose.activeId === 'gal-dialog-open',
        `[${browserName}] DialogClose button restores focus to trigger (#gal-dialog-open)`,
        JSON.stringify(afterBtnClose),
      );

      // Select keyboard navigation & Escape dismissal
      await page.focus('#gal-select');
      await page.keyboard.press('Enter');
      await page.waitForSelector('[role="listbox"]', { timeout: 3000 });
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(80);
      const selectAfterEsc = await page.evaluate(() => {
        const form = document.getElementById('gal-select-form');
        const fd = form ? new FormData(form) : null;
        return {
          listboxOpen: Boolean(document.querySelector('[role="listbox"]')),
          activeId: document.activeElement?.id,
          hiddenVal: fd ? fd.get('recoveryChannel') : null,
        };
      });
      check(
        !selectAfterEsc.listboxOpen &&
          selectAfterEsc.activeId === 'gal-select' &&
          selectAfterEsc.hiddenVal === 'email',
        `[${browserName}] Select keyboard open/navigate/Escape & hidden form input sync`,
        JSON.stringify(selectAfterEsc),
      );

      // DropdownMenu standalone keyboard navigation & Escape focus return
      await page.focus('#gal-menu-trigger');
      await page.keyboard.press('Enter');
      await page.waitForSelector('[role="menu"]', { timeout: 3000 });
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(80);
      const menuAfterEsc = await page.evaluate(() => ({
        menuOpen: Boolean(document.querySelector('[role="menu"]')),
        activeId: document.activeElement?.id,
      }));
      check(
        !menuAfterEsc.menuOpen && menuAfterEsc.activeId === 'gal-menu-trigger',
        `[${browserName}] DropdownMenu keyboard open/ArrowDown/Escape & focus return`,
        JSON.stringify(menuAfterEsc),
      );

      // Tooltip keyboard focus & Escape dismissal
      await page.focus('#gal-tooltip-trigger');
      await page.waitForSelector('#gal-tooltip-trigger + [role="tooltip"]', { timeout: 3000 });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(60);
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

      await ctx.close();
    }

    // 2. Targeted 768px Viewport & Container-Query Transition (<= 760px vs > 760px)
    {
      const { ctx, page } = await openGallery(browser, {
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
          cqTransition.overflowAt768,
        `[${browserName} 768px] @container (max-width: 760px) transitions cleanly between 1-col (<=760px) and 2-col (768px) with zero overflow`,
        JSON.stringify(cqTransition),
      );

      await ctx.close();
    }

    // 3. Mobile (390x844) Dark Theme, Reduced Motion, and Table Overflow Containment
    {
      const { ctx, page } = await openGallery(browser, {
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
          mobileState.tableContained,
        `[${browserName} 390px dark + reduced-motion] Dark tokens (#050505), transition: 0s, single-column stack, and Table overflow containment`,
        JSON.stringify(mobileState),
      );

      await ctx.close();
    }

    // 4. Forced-Colors Mode (supported natively by Chromium and Firefox in Playwright)
    if (browserName === 'chromium' || browserName === 'firefox') {
      const { ctx, page } = await openGallery(browser, {
        w: 1280,
        h: 900,
        scheme: 'light',
        forcedColors: 'active',
      });

      const fcState = await page.evaluate(() => {
        const matchesFC = window.matchMedia('(forced-colors: active)').matches;
        const tag = document.querySelector('.f12-tag');
        const rngInd = document.querySelector('.f12-rng-ind');
        const tagBorder = getComputedStyle(tag).borderTopWidth;
        const rngMixBlend = getComputedStyle(rngInd).mixBlendMode;
        const rngBorder = getComputedStyle(rngInd).borderTopWidth;
        return { matchesFC, tagBorder, rngMixBlend, rngBorder };
      });

      check(
        fcState.matchesFC &&
          fcState.tagBorder === '1px' &&
          fcState.rngMixBlend === 'normal' &&
          fcState.rngBorder === '2px',
        `[${browserName} forced-colors: active] activates CanvasText/Highlight borders and disables mix-blend-mode`,
        JSON.stringify(fcState),
      );

      await ctx.close();
    }
  } finally {
    await browser.close();
  }
}

finish();
