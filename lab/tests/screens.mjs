// Full-page screenshots of every page at desktop and phone width, light and dark.
// Output: test-results/*.png. Also fails if any page scrolls sideways.
import { launch, openPage, outPath, check, finish } from './lib.mjs';

const browser = await launch();
for (const scheme of ['light', 'dark']) {
  for (const [w, h, tag] of [[1280, 900, 'desktop'], [390, 844, 'phone']]) {
    for (const design of ['frame', 'conv']) {
      const { ctx, page, errors } = await openPage(browser, 'prototype.html', { w, h, scheme });
      await page.click(`#ds-${design}`);
      await page.waitForTimeout(300);
      await page.screenshot({ path: outPath(`prototype-${design}-${tag}-${scheme}.png`), fullPage: true });
      const sw = await page.evaluate(() => document.documentElement.scrollWidth);
      check(sw <= w && errors.length === 0, `prototype ${design} ${tag} ${scheme}`, `scrollWidth ${sw}${errors.length ? ' ' + errors[0] : ''}`);
      await ctx.close();
    }
    const { ctx, page, errors } = await openPage(browser, 'style-sheet.html', { w, h, scheme });
    await page.screenshot({ path: outPath(`style-sheet-${tag}-${scheme}.png`), fullPage: true });
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    check(sw <= w && errors.length === 0, `style sheet ${tag} ${scheme}`, `scrollWidth ${sw}${errors.length ? ' ' + errors[0] : ''}`);
    await ctx.close();
  }
}
await browser.close();
finish();
