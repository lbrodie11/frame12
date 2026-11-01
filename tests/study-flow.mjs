// Walks the whole study twice (desktop, then phone with one wrong FRAME/12 answer),
// decodes the result codes, then imports them into the results view and checks
// the analysis and decision rule.
import { launch, openPage, outPath, check, finish } from './lib.mjs';
import { buildTaskSets } from '../src/data.js';

const sets = buildTaskSets();
const ANSWERS = Object.fromEntries([...sets.A, ...sets.B].map((q) => [q.prompt, q.answer]));
const decode = (code) => JSON.parse(Buffer.from(code.slice(code.indexOf('.') + 1), 'base64').toString('utf8'));

async function runStudy(browser, w, h, tag, wrongOnFrame) {
  const { ctx, page, errors } = await openPage(browser, 'study.html', { w, h });
  await page.click('#role-0');
  await page.click('#start');
  const order = [];
  for (let part = 0; part < 2; part++) {
    await page.click(`#intro-go-${part}`);
    for (let q = 0; q < 3; q++) {
      await page.waitForSelector('#task-submit');
      const prompt = (await page.innerText('.task-q legend')).trim();
      const design = (await page.locator('.task-dash .dash.frame').count()) ? 'frame' : 'conv';
      if (q === 0) order.push(design);
      const btns = page.locator('.task-dash .rng-btn');
      await btns.nth(0).click();
      await btns.nth(2).click();
      await page.locator('.task-dash .int-row').nth(1).click();
      let ans = ANSWERS[prompt];
      if (wrongOnFrame && design === 'frame' && q === 0) ans = "I'm not sure";
      await page.locator('.task-q .ch-o', { hasText: ans }).first().click();
      await page.click('#task-submit');
    }
    for (const k of ['polished', 'trust', 'easy', 'identity', 'coherent', 'want']) {
      await page.click(`#r${part}-${k}-${order[part] === 'frame' ? 6 : 4}`, { force: true });
    }
    await page.click(`#rate-next-${part}`);
  }
  await page.waitForTimeout(500);
  await page.screenshot({ path: outPath(`study-${tag}-compare.png`), fullPage: true });
  const fi = order.indexOf('frame');
  await page.click(`#cmp-distinct-${fi}`);
  await page.click(`#cmp-prefer-${fi}`);
  await page.click('#cmp-next');
  for (const [mi, kind] of ['tabs', 'chart', 'badge'].entries()) {
    await page.click(`#play-${kind}-a`);
    await page.click(`#play-${kind}-b`);
    await page.waitForTimeout(1300);
    await page.click(`#mo-pref-${kind}-0`);
    await page.click(`#mo-next-${mi}`);
  }
  await page.fill('#c-stood', 'Test run.');
  await page.click('#submit');
  await page.waitForSelector('#code', { timeout: 15000 });
  const code = await page.inputValue('#code');
  const r = decode(code);
  check(errors.length === 0, `study ${tag}: no script errors`, errors[0] || '');
  check(r.tasks.length === 6, `study ${tag}: 6 tasks recorded`);
  check(r.compare.distinct === 'frame' && r.compare.prefer === 'frame', `study ${tag}: comparison maps back to the right design`, `order ${order.join('>')}`);
  const slotA = r.motion.order[0];
  check(r.motion.items.every((m) => m.prefer === slotA), `study ${tag}: motion "Version X" maps to ${slotA}`);
  check(r.tasks.filter((t) => t.correct).length === (wrongOnFrame ? 5 : 6), `study ${tag}: answers scored against the data`);
  await ctx.close();
  return code;
}

const browser = await launch();
const c1 = await runStudy(browser, 1280, 900, 'desktop', false);
const c2 = await runStudy(browser, 390, 844, 'phone', true);

const { ctx, page, errors } = await openPage(browser, 'study.html', { w: 1100, h: 900 });
await page.evaluate(() => { location.hash = '#results'; });
await page.waitForSelector('#imp');
await page.fill('#imp', [c1, c2, 'not-a-code'].join('\n'));
await page.click('#imp-go');
await page.selectOption('#chk-a11y', 'pass');
await page.selectOption('#chk-mobile', 'pass');
await page.waitForTimeout(300);
const text = await page.innerText('main');
await page.screenshot({ path: outPath('study-results.png'), fullPage: true });
check(/2 responses imported/.test(text) && /1 code could not be read/.test(text), 'results: imports valid codes, rejects bad ones');
check(/83% vs 100%/.test(text), 'results: task success computed (5/6 vs 6/6)');
check(/Revise/.test(text), 'results: a 17-point success gap returns Revise');
check(errors.length === 0, 'results: no script errors', errors[0] || '');
await ctx.close();
await browser.close();
finish();
