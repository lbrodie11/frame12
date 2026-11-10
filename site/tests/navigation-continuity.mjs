// Navigation continuity (F12-12): Back, contextual return links and focus land where you were.
// Runs against the production build (`next start`) in Chromium, Firefox and WebKit.
//
// Regression tests for the four reported issues:
//   [issue-1 tab reset]        "round trip: … Back restores Request Logs"
//   [issue-2 contextual return] "contextual link …", "tokens: …"
//   [issue-3 focus lost]        "keyboard round trip: … Back focuses …", "catalog round trip …"
//   [issue-4 nav ownership]     "ownership: …"
import { chromium, firefox, webkit } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = resolve(__dirname, '..');

let failures = 0;
function check(ok, label, detail = '') {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`);
}

function getFreePort() {
  return new Promise((res, rej) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      srv.close(() => res(typeof addr === 'object' && addr ? addr.port : 3457));
    });
    srv.on('error', rej);
  });
}

async function waitForServer(url, timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if ((await fetch(`${url}/r/registry.json`)).ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Next.js server at ${url} did not become ready within ${timeoutMs}ms`);
}

const CONSOLE = '/blocks/developer-console';
const DEP_ID = 'block-developer-console-dep-use-on-twos';
const DEP_HEADING = 'block-doc-developer-console-dependencies';
const NEXT_KEYS = ['__NA', '__PRIVATE_NEXTJS_INTERNALS_TREE'];

const port = await getFreePort();
const base = `http://127.0.0.1:${port}`;
const nextBin = createRequire(resolve(SITE_ROOT, 'package.json')).resolve('next/dist/bin/next');
const server = spawn(process.execPath, [nextBin, 'start', '-p', String(port), '-H', '127.0.0.1'], {
  cwd: SITE_ROOT,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, NODE_ENV: 'production' },
});

async function open(ctx, path) {
  const page = await ctx.newPage();
  const errors = [];
  // Same filter as site-verify.mjs: RSC prefetches cancelled by a navigation are logged by WebKit
  // as "…?_rsc=… due to access control checks" and are not page errors.
  const isRscNoise = (text) => text.includes('_rsc=') || text.includes('Failed to fetch RSC payload');
  page.on('pageerror', (e) => {
    if (!isRscNoise(e.message)) errors.push(e.message);
  });
  page.on('console', (m) => {
    const text = m.text();
    if (m.type() === 'error' && !/Failed to load resource/.test(text) && !isRscNoise(text)) {
      errors.push(text);
    }
  });
  page.__errors = errors;
  if (path) await goto(page, path);
  return page;
}

async function hydrated(page) {
  await page.waitForSelector('.site-root[data-hydrated="true"]', { timeout: 15000 });
}

async function goto(page, path) {
  await page.goto(`${base}${path}`);
  await hydrated(page);
}

const activeId = (page) =>
  page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName || '');

async function waitForFocus(page, id, timeout = 4000) {
  try {
    await page.waitForFunction((target) => document.activeElement?.id === target, id, { timeout });
    return true;
  } catch {
    return false;
  }
}

async function selectedTab(page) {
  return page.evaluate(
    () => document.querySelector('[role="tab"][aria-selected="true"]')?.id ?? null,
  );
}

async function inViewport(page, id) {
  return page.evaluate((target) => {
    const el = document.getElementById(target);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight;
  }, id);
}

/** Presses Tab until `id` has focus. Returns the number of presses, or -1. */
async function tabTo(page, id, max = 500) {
  for (let i = 1; i <= max; i++) {
    await page.keyboard.press('Tab');
    if ((await activeId(page)) === id) return i;
  }
  return -1;
}

async function back(page) {
  await page.goBack();
}

async function forward(page) {
  await page.goForward();
}

async function runEngine(engineName, engine) {
  const launchOpts =
    engine === chromium
      ? { executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] }
      : {};
  let browser;
  try {
    browser = await engine.launch(launchOpts);
  } catch (e) {
    check(false, `[${engineName}] browser launches`, e.message.split('\n')[0]);
    return;
  }
  const T = (label) => `[${engineName}] ${label}`;
  const newCtx = (opts = {}) =>
    browser.newContext({ viewport: { width: 1280, height: 900 }, ...opts });

  try {
    // ---------------------------------------------------------------- [issue-1] mouse round trip
    {
      const ctx = await newCtx();
      const page = await open(ctx, CONSOLE);
      await page.click('#dev-console-tab-request-logs');
      await page.waitForURL(/section=request-logs/);
      await page.locator(`#${DEP_ID}`).scrollIntoViewIfNeeded();
      await page.click(`#${DEP_ID}`);
      await page.waitForURL(/\/components\/use-on-twos\?from=/);
      await hydrated(page);
      await back(page);
      await page.waitForURL(/section=request-logs$/);
      await waitForFocus(page, DEP_ID);
      check(
        (await selectedTab(page)) === 'dev-console-tab-request-logs' &&
          (await inViewport(page, DEP_HEADING)) &&
          page.__errors.length === 0,
        T('[issue-1] round trip: Console → Request Logs → use-on-twos → Back restores Request Logs with Dependencies in view'),
        `tab=${await selectedTab(page)} errors=${page.__errors.join('; ')}`,
      );
      const state = await page.evaluate(() => window.history.state);
      check(
        NEXT_KEYS.every((k) => k in (state ?? {})) && state?.f12Focus?.id === DEP_ID,
        T("history hygiene: Next.js's own history.state keys are intact after the f12Focus merge"),
        JSON.stringify(Object.keys(state ?? {})),
      );
      await ctx.close();
    }

    // ---------------------------------------------------------------- [issue-3] keyboard-only round trip
    {
      const ctx = await newCtx();
      const page = await open(ctx, CONSOLE);
      const toTabs = await tabTo(page, 'dev-console-tab-overview', 200);
      for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
      if ((await selectedTab(page)) !== 'dev-console-tab-request-logs') await page.keyboard.press('Enter');
      await page.waitForURL(/section=request-logs/);
      const toDep = await tabTo(page, DEP_ID, 600);
      const yBefore = await page.evaluate(() => window.scrollY);
      await page.keyboard.press('Enter');
      await page.waitForURL(/\/components\/use-on-twos\?from=/);
      await hydrated(page);
      const detailFocus = await activeId(page);
      await back(page);
      const focused = await waitForFocus(page, DEP_ID);
      const yAfter = await page.evaluate(() => window.scrollY);
      await page.waitForTimeout(300);
      const ySettled = await page.evaluate(() => window.scrollY);
      check(
        toTabs > 0 && toDep > 0 && focused && Math.abs(yAfter - yBefore) <= 3 && ySettled === yAfter,
        T(`[issue-3] keyboard round trip: Back focuses #${DEP_ID} and the viewport does not jump`),
        `tabs=${toTabs} dep=${toDep} focused=${focused} y ${yBefore}→${yAfter}→${ySettled}`,
      );
      check(
        detailFocus !== DEP_ID && (await selectedTab(page)) === 'dev-console-tab-request-logs',
        T('keyboard round trip: fresh navigation steals no focus, and Back keeps Request Logs selected'),
        `detailFocus=${detailFocus}`,
      );
      const visible = await page.evaluate(() => {
        const el = document.activeElement;
        const cs = el ? getComputedStyle(el) : null;
        return Boolean(cs && ((cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none'));
      });
      check(visible, T('keyboard round trip: the restored focus is visible'));
      await ctx.close();
    }

    // ---------------------------------------------------------------- catalog round trip
    {
      const ctx = await newCtx();
      const page = await open(ctx, '/components');
      const link = page.locator('#comp-link-use-on-twos');
      check(
        (await link.getAttribute('href')) === '/components/use-on-twos?from=catalog.hooks-adapters',
        T('catalog link carries the catalog.hooks-adapters origin token'),
      );
      await link.scrollIntoViewIfNeeded();
      const yBefore = await page.evaluate(() => window.scrollY);
      await link.focus();
      await page.keyboard.press('Enter');
      await page.waitForURL(/\/components\/use-on-twos\?from=catalog/);
      await hydrated(page);
      const ctxLabel = await page.locator('#detail-return-context').textContent();
      await back(page);
      await page.waitForURL(/\/components$/);
      const focused = await waitForFocus(page, 'comp-link-use-on-twos');
      const yAfter = await page.evaluate(() => window.scrollY);
      check(
        focused && Math.abs(yAfter - yBefore) <= 3 && ctxLabel === '← Back to Components · Hooks & Adapters',
        T('[issue-3] catalog round trip: Catalog → use-on-twos → Back focuses #comp-link-use-on-twos'),
        `focused=${focused} y ${yBefore}→${yAfter} label=${ctxLabel}`,
      );
      await ctx.close();
    }

    // ---------------------------------------------------------------- [issue-2] contextual link, Back/Forward
    {
      const ctx = await newCtx();
      const page = await open(ctx, `${CONSOLE}?section=request-logs`);
      await page.locator(`#${DEP_ID}`).scrollIntoViewIfNeeded();
      await page.click(`#${DEP_ID}`);
      await page.waitForURL(/\/components\/use-on-twos\?from=/);
      await hydrated(page);
      const crumbs = await page.locator('#detail-return-trail li').allTextContents();
      const ret = page.locator('#detail-return-context');
      check(
        (await ret.textContent()) === '← Back to Developer Console · Dependencies' &&
          (await ret.getAttribute('href')) ===
            '/blocks/developer-console?section=request-logs#block-doc-developer-console-dependencies' &&
          (await page.locator('#detail-browse-components').getAttribute('href')) === '/components' &&
          crumbs.join(' ').replace(/\s+/g, ' ').includes('Blocks / Developer Console / Dependencies'),
        T('[issue-2] detail header shows the trail, the contextual return link and "Browse all components"'),
        crumbs.join(' | '),
      );

      await back(page);
      await waitForFocus(page, DEP_ID);
      await forward(page);
      await page.waitForURL(/\/components\/use-on-twos\?from=/);
      await page.waitForSelector('#detail-return-context');
      check(
        (await page.locator('#detail-return-context').count()) === 1 &&
          (await page.locator('h1').textContent()).replace(/\s/g, '') === 'useOnTwos' &&
          (await activeId(page)) !== DEP_ID,
        T('Back then Forward restores the detail page with its contextual link'),
        await page.locator('h1').textContent(),
      );

      await page.click('#detail-return-context');
      await page.waitForURL(/section=request-logs#block-doc-developer-console-dependencies/);
      await page.waitForTimeout(300);
      const top = await page.evaluate(
        (id) => document.getElementById(id).getBoundingClientRect().top,
        DEP_HEADING,
      );
      const af = await activeId(page);
      check(
        (await selectedTab(page)) === 'dev-console-tab-request-logs' &&
          top >= 0 &&
          top < 120 &&
          !af.startsWith('block-developer-console-dep-'),
        T('contextual link lands on the Dependencies section with Request Logs selected and no focus theft'),
        `top=${top} active=${af}`,
      );
      await ctx.close();
    }

    // ---------------------------------------------------------------- several dependencies in a row
    {
      const ctx = await newCtx();
      const page = await open(ctx, `${CONSOLE}?section=request-logs`);
      const depA = DEP_ID;
      const ids = await page.$$eval('[id^="block-developer-console-dep-"]', (els) => els.map((e) => e.id));
      const depB = ids.find((id) => id !== depA);
      await page.locator(`#${depA}`).scrollIntoViewIfNeeded();
      await page.click(`#${depA}`); // entry 2: detail A
      await page.waitForURL(/\/components\/use-on-twos/);
      await hydrated(page);
      await page.click('#detail-return-context'); // entry 3: console (request-logs)
      await page.waitForURL(/#block-doc-developer-console-dependencies/);
      await hydrated(page);
      await page.click('#dev-console-tab-services'); // replace: entry 3 → services
      await page.waitForURL(/section=services/);
      await page.locator(`#${depB}`).scrollIntoViewIfNeeded();
      await page.click(`#${depB}`); // entry 4: detail B
      await page.waitForURL(/from=block\.developer-console\.services\.dependencies/);
      await hydrated(page);

      await back(page); // → entry 3
      const step1 = (await waitForFocus(page, depB)) && (await selectedTab(page)) === 'dev-console-tab-services';
      await back(page); // → entry 2 (detail A)
      await page.waitForURL(/\/components\/use-on-twos/);
      const step2 = (await page.locator('#detail-return-context').count()) === 1;
      await back(page); // → entry 1
      const step3 =
        (await waitForFocus(page, depA)) && (await selectedTab(page)) === 'dev-console-tab-request-logs';
      check(
        step1 && step2 && step3,
        T('several dependencies in a row: each Back step restores its own origin (tab + focus)'),
        `step1=${step1} step2=${step2} step3=${step3}`,
      );
      await ctx.close();
    }

    // ---------------------------------------------------------------- workspace settings uses the same pattern
    {
      const ctx = await newCtx();
      const page = await open(ctx, '/blocks/workspace-settings');
      await page.click('#ws-settings-tabs-tab-team');
      await page.waitForURL(/section=team/);
      const dep = page.locator('[id^="block-workspace-settings-dep-"]').first();
      const depId = await dep.getAttribute('id');
      check(
        /from=block\.workspace-settings\.team\.dependencies$/.test((await dep.getAttribute('href')) ?? ''),
        T('workspace settings dependency links carry the current tab in their origin token'),
      );
      await dep.scrollIntoViewIfNeeded();
      await dep.click();
      await page.waitForURL(/\/components\//);
      await hydrated(page);
      await back(page);
      check(
        (await waitForFocus(page, depId)) && (await selectedTab(page)) === 'ws-settings-tabs-tab-team',
        T('workspace settings round trip: Back restores Team & Roles and focus'),
      );
      await ctx.close();
    }

    // ---------------------------------------------------------------- direct open, reload, new tab
    {
      const ctx = await newCtx();
      const page = await open(ctx, '/components/use-on-twos');
      check(
        (await page.locator('#detail-return-context').count()) === 0 &&
          (await page.locator('#detail-back-components').textContent()) === '← All Components',
        T('direct open of /components/use-on-twos shows only "← All Components"'),
      );
      await goto(page, '/components/use-on-twos?from=block.developer-console.request-logs.dependencies');
      await page.reload();
      await hydrated(page);
      await page.waitForSelector('#detail-return-context');
      await page.click('#detail-return-context');
      await page.waitForURL(/section=request-logs#block-doc/);
      check(
        (await selectedTab(page)) === 'dev-console-tab-request-logs',
        T('reload keeps the contextual link (it is in the URL) and it works'),
      );

      const catalog = await open(ctx, '/components');
      let popup = null;
      let how = 'middle-click';
      try {
        [popup] = await Promise.all([
          ctx.waitForEvent('page', { timeout: 4000 }),
          catalog.click('#comp-link-panel', { button: 'middle' }),
        ]);
      } catch {
        how = 'ctrl-click';
        try {
          [popup] = await Promise.all([
            ctx.waitForEvent('page', { timeout: 4000 }),
            catalog.click('#comp-link-panel', { modifiers: ['Control'] }),
          ]);
        } catch {
          popup = null;
        }
      }
      if (popup) {
        await popup.waitForLoadState();
        await hydrated(popup);
        await popup.waitForSelector('#detail-return-context');
      }
      check(
        Boolean(popup) &&
          (await popup.locator('#detail-return-context').textContent()) === '← Back to Components · Layout' &&
          catalog.url() === `${base}/components`,
        T(`new tab (${how}) shows the correct context from its own URL`),
        popup ? popup.url() : 'no new tab opened',
      );
      await ctx.close();
    }

    // ---------------------------------------------------------------- tokens (e2e)
    {
      const ctx = await newCtx();
      const page = await open(ctx);
      const bad = [];
      for (const token of [
        'https://evil.example',
        '//evil.example',
        'block.../../',
        'block.developer-console.request-logs.dependencies/../',
        encodeURIComponent('https://evil.example'),
        'catalog.nope',
        'x'.repeat(4000),
      ]) {
        await goto(page, `/components/use-on-twos?from=${encodeURIComponent(token)}`);
        await page.waitForTimeout(100);
        const hrefs = await page.$$eval('.f12-hd a[href]', (as) => as.map((a) => a.href));
        if (
          (await page.locator('#detail-return-context').count()) !== 0 ||
          hrefs.some((h) => !h.startsWith(base))
        ) {
          bad.push(token.slice(0, 40));
        }
      }
      await page.click('#detail-back-components');
      await page.waitForURL(`${base}/components`);
      check(
        bad.length === 0 && page.__errors.length === 0,
        T('[issue-2] tokens: malformed, unknown, oversized and encoded tokens give no contextual link or off-site link'),
        bad.join(', ') + page.__errors.join('; '),
      );
      page.__errors.length = 0;
      await goto(page, `${CONSOLE}?section=bogus`);
      const bogusTab = await selectedTab(page);
      await page.waitForURL(`${base}${CONSOLE}`);
      check(
        bogusTab === 'dev-console-tab-overview' && page.__errors.length === 0,
        T('?section=bogus gives Overview, no error, and the bogus parameter is removed'),
        `tab=${bogusTab} errors=${page.__errors.join('; ')}`,
      );
      await ctx.close();
    }

    // ---------------------------------------------------------------- missing focus target
    {
      const ctx = await newCtx();
      const page = await open(ctx, `${CONSOLE}?section=request-logs`);
      // Leave through a real dependency link whose id (and fallback) we rename first, so the
      // recorded target no longer exists when we come back.
      const leaveVia = async (fallbackId) => {
        await page.locator(`#${DEP_ID}`).scrollIntoViewIfNeeded();
        await page.evaluate(
          ([id, fb]) => {
            const a = document.getElementById(id);
            a.id = 'block-developer-console-dep-gone';
            a.setAttribute('data-f12-focus-fallback', fb);
          },
          [DEP_ID, fallbackId],
        );
        await page.click('#block-developer-console-dep-gone');
        await page.waitForURL(/\/components\/use-on-twos/);
        await hydrated(page);
        await back(page);
        await page.waitForURL(/section=request-logs$/);
      };
      await leaveVia(DEP_HEADING);
      const heading = await waitForFocus(page, DEP_HEADING);
      await page.evaluate(() => document.activeElement?.blur());
      await leaveVia('heading-gone');
      await page.waitForTimeout(800);
      const nothing = await activeId(page);
      // "Nothing" means we leave focus wherever the browser put it and never move it into the page.
      check(
        heading &&
          nothing !== DEP_HEADING &&
          !nothing.startsWith('block-developer-console-dep-') &&
          page.__errors.length === 0,
        T('missing target: falls back to the section heading, then to nothing, without errors'),
        `heading=${heading} then=${nothing} ${page.__errors.join('; ')}`,
      );
      await ctx.close();
    }

    // ---------------------------------------------------------------- stale focus target (review #1)
    {
      const ctx = await newCtx();
      const page = await open(ctx, `${CONSOLE}?section=request-logs`);
      await page.locator(`#${DEP_ID}`).scrollIntoViewIfNeeded();
      await page.click(`#${DEP_ID}`);
      await page.waitForURL(/\/components\/use-on-twos/);
      await hydrated(page);
      await back(page);
      const restored = await waitForFocus(page, DEP_ID);
      // Leave the same entry another way: scroll to the top and use the primary nav.
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.locator('#nav-motion').focus();
      await page.keyboard.press('Enter');
      await page.waitForURL(/\/motion$/);
      await hydrated(page);
      await back(page);
      await page.waitForURL(/section=request-logs$/);
      await page.waitForTimeout(800);
      const after = await activeId(page);
      const visible = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return true;
        const r = el.getBoundingClientRect();
        return r.bottom > 0 && r.top < window.innerHeight;
      });
      check(
        restored && after !== DEP_ID && visible,
        T('stale target: after leaving through the nav, Back does not pull focus to the old dependency link'),
        `restored=${restored} after=${after} visible=${visible}`,
      );

      // Modified clicks (new tab / window) record nothing on the current entry.
      await page.evaluate(() => {
        const { f12Focus, ...rest } = window.history.state ?? {};
        void f12Focus;
        window.history.replaceState(rest, '', window.location.href);
      });
      const popup = ctx.waitForEvent('page', { timeout: 4000 }).catch(() => null);
      await page.locator(`#${DEP_ID}`).click({ modifiers: ['Control'] });
      const opened = await popup;
      await opened?.close();
      await page.waitForTimeout(150);
      const recorded = await page.evaluate(() => Boolean(window.history.state?.f12Focus));
      check(
        !recorded && page.url().includes('section=request-logs'),
        T('modified (Ctrl) click on a dependency link records no focus target'),
        `recorded=${recorded}`,
      );
      await ctx.close();
    }

    // ---------------------------------------------------------------- unsaved-changes guard + ?section= (review #2)
    {
      const ctx = await newCtx();
      const page = await open(ctx, '/blocks/workspace-settings');
      await page.fill('#ws-settings-profile-name', 'Draft Operator Name');
      await page.click('#ws-settings-tabs-tab-team');
      await page.waitForURL(/section=team/);
      await page.click('#nav-workspace-settings');
      await page.waitForURL(/\/blocks\/workspace-settings$/);
      await page.waitForTimeout(300);
      const dialog = await page.locator('dialog[open]').count();
      const tab = await selectedTab(page);
      const value = await page.inputValue('#ws-settings-profile-name');
      check(
        dialog === 0 && tab === 'ws-settings-tabs-tab-profile' && value === 'Draft Operator Name',
        T('workspace settings: a same-page link with an unsaved draft and ?section= shows no guard and keeps the draft'),
        `dialog=${dialog} tab=${tab} value=${value}`,
      );
      await page.click('#nav-motion');
      await page.waitForTimeout(300);
      check(
        (await page.locator('dialog[open]').count()) === 1 && page.url().includes('/blocks/workspace-settings'),
        T('workspace settings: leaving for another page with an unsaved draft still shows the guard'),
      );
      await ctx.close();
    }

    // ---------------------------------------------------------------- history hygiene
    {
      const ctx = await newCtx();
      const page = await open(ctx, CONSOLE);
      const before = await page.evaluate(() => window.history.length);
      const order = ['services', 'api-keys', 'request-logs', 'overview'];
      for (let i = 0; i < 10; i++) {
        await page.click(`#dev-console-tab-${order[i % order.length]}`);
      }
      await page.waitForTimeout(200);
      const after = await page.evaluate(() => window.history.length);
      const state = await page.evaluate(() => window.history.state);
      check(
        after === before &&
          page.url().endsWith('?section=api-keys') && NEXT_KEYS.every((k) => k in (state ?? {})),
        T('history hygiene: 10 tab switches add zero history entries and keep Next.js state keys'),
        `length ${before}→${after} url=${page.url()}`,
      );
      await ctx.close();
    }

    // ---------------------------------------------------------------- [issue-4] ownership
    {
      const ctx = await newCtx();
      const page = await open(ctx);
      const rows = [
        ['/experiments/agent-approval', 'nav-agents', 'true'],
        ['/agents', 'nav-agents', 'page'],
        ['/components', 'nav-components', 'page'],
        ['/components/use-on-twos', 'nav-components', 'true'],
        [`${CONSOLE}?section=services`, 'nav-developer-console', 'page'],
      ];
      const bad = [];
      for (const [path, id, want] of rows) {
        await goto(page, path);
        const current = await page.$$eval('.site-nav-link[aria-current]', (els) =>
          els.map((e) => [e.id, e.getAttribute('aria-current'), e.classList.contains('is-page')]),
        );
        const ok =
          current.length === 1 &&
          current[0][0] === id &&
          current[0][1] === want &&
          current[0][2] === (want === 'page');
        if (!ok) bad.push(`${path}: ${JSON.stringify(current)}`);
      }
      const deco = await page.evaluate(() => [
        getComputedStyle(document.getElementById('nav-developer-console')).textDecorationLine,
      ]);
      await goto(page, '/components/use-on-twos');
      const childDeco = await page.evaluate(
        () => getComputedStyle(document.getElementById('nav-components')).textDecorationLine,
      );
      check(
        bad.length === 0 && deco[0].includes('underline') && !childDeco.includes('underline'),
        T('[issue-4] ownership: exact page aria-current="page" (+ underline), owning section aria-current="true"'),
        bad.join('; ') + ` deco=${deco} child=${childDeco}`,
      );
      await ctx.close();
    }

    // ---------------------------------------------------------------- mobile overflow cue
    for (const [label, opts] of [
      ['320px', { viewport: { width: 320, height: 640 } }],
      ['200% zoom (1280px at 2x = 640 CSS px)', { viewport: { width: 640, height: 450 }, deviceScaleFactor: 2 }],
    ]) {
      const ctx = await browser.newContext(opts);
      const page = await open(ctx, '/get-started');
      const cue = () =>
        page.evaluate(() => {
          const nav = document.querySelector('.site-nav');
          const vis = (sel) => {
            const el = nav.querySelector(sel);
            return Boolean(el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0);
          };
          const list = nav.querySelector('.site-nav-list');
          return {
            overflow: list.scrollWidth > list.clientWidth,
            start: vis('.site-nav-cue-start'),
            end: vis('.site-nav-cue-end'),
            hidden: nav.querySelector('.site-nav-cue').getAttribute('aria-hidden'),
          };
        });
      const atActive = await cue();
      const activeInView = await page.evaluate(() => {
        const list = document.querySelector('.site-nav-list');
        const a = list.querySelector('[aria-current]').getBoundingClientRect();
        const l = list.getBoundingClientRect();
        return a.left >= l.left - 1 && a.right <= l.right + 1;
      });
      await page.evaluate(() => {
        document.querySelector('.site-nav-list').scrollLeft = 0;
      });
      await page.waitForTimeout(100);
      const atStart = await cue();
      // Every nav link is reachable by keyboard and scrolls into the row when focused.
      await page.evaluate(() => document.activeElement?.blur());
      const reached = [];
      for (let i = 0; i < 40 && reached.length < 9; i++) {
        await page.keyboard.press('Tab');
        // Focus scrolling inside the row can land a frame later (scroll snapping).
        await page.waitForTimeout(120);
        const info = await page.evaluate(() => {
          const el = document.activeElement;
          if (!el?.classList.contains('site-nav-link')) return null;
          const nav = document.querySelector('.site-nav');
          const list = nav.querySelector('.site-nav-list').getBoundingClientRect();
          const r = el.getBoundingClientRect();
          const cueRect = (sel) => {
            const c = nav.querySelector(sel);
            return c && getComputedStyle(c).display !== 'none' ? c.getBoundingClientRect() : null;
          };
          const cs = cueRect('.site-nav-cue-start');
          const ce = cueRect('.site-nav-cue-end');
          const clear = (!cs || r.left >= cs.right - 1) && (!ce || r.right <= ce.left + 1);
          return {
            id: el.id,
            inRow: r.left >= list.left - 1 && r.right <= list.right + 1 && clear,
          };
        });
        if (info && !reached.find((x) => x.id === info.id)) reached.push(info);
      }
      const atEnd = await cue();
      check(
        atActive.overflow && activeInView && atStart.end && !atStart.start && atEnd.start && !atEnd.end && atActive.hidden === 'true',
        T(`mobile ${label}: overflow cue shows only at scrollable edges, active item scrolled into view`),
        JSON.stringify({ atActive, activeInView, atStart, atEnd }),
      );
      check(
        reached.length === 9 && reached.every((r) => r.inRow),
        T(`mobile ${label}: all 9 nav links reachable by keyboard, scrolled into the row and clear of the cue`),
        JSON.stringify(reached),
      );
      await ctx.close();
    }
    {
      const ctx = await newCtx();
      const page = await open(ctx, '/get-started');
      const desktop = await page.evaluate(() => ({
        overflow: (() => {
          const l = document.querySelector('.site-nav-list');
          return l.scrollWidth > l.clientWidth;
        })(),
        cues: [...document.querySelectorAll('.site-nav-cue')].filter((c) => getComputedStyle(c).display !== 'none').length,
      }));
      check(!desktop.overflow && desktop.cues === 0, T('desktop 1280px: no overflow, no overflow cue'), JSON.stringify(desktop));
      await ctx.close();
    }

    // ---------------------------------------------------------------- reduced motion: no smooth scroll
    {
      const ctx = await newCtx({ reducedMotion: 'reduce' });
      const page = await open(ctx, `${CONSOLE}?section=request-logs`);
      const behaviors = async () =>
        page.evaluate(() =>
          [document.documentElement, document.body, document.querySelector('.site-root')].map(
            (el) => getComputedStyle(el).scrollBehavior,
          ),
        );
      const onBlock = await behaviors();
      await page.locator(`#${DEP_ID}`).scrollIntoViewIfNeeded();
      await page.click(`#${DEP_ID}`);
      await page.waitForURL(/\/components\//);
      await hydrated(page);
      await back(page);
      await waitForFocus(page, DEP_ID);
      const afterRestore = await behaviors();
      check(
        [...onBlock, ...afterRestore].every((b) => b === 'auto'),
        T('reduced motion: scroll-behavior is auto on every restoration'),
        JSON.stringify({ onBlock, afterRestore }),
      );
      await ctx.close();
    }

    // ---------------------------------------------------------------- no JavaScript
    {
      const ctx = await newCtx({ javaScriptEnabled: false });
      const page = await ctx.newPage();
      await page.goto(`${base}${CONSOLE}?section=request-logs`);
      const ssrTab = await selectedTab(page);
      const depHref = await page.getAttribute(`#${DEP_ID}`, 'href');
      const anchorExists = (await page.locator(`#${DEP_HEADING}`).count()) === 1;
      await page.click(`#${DEP_ID}`);
      await page.waitForURL(/\/components\/use-on-twos\?from=/);
      const plain = await page.locator('#detail-back-components').getAttribute('href');
      await page.click('#detail-back-components');
      await page.waitForURL(`${base}/components`);
      const groupAnchor = (await page.locator('#catalog-hooks-adapters').count()) === 1;
      await page.goto(`${base}/components#catalog-hooks-adapters`);
      const top = await page.evaluate(() =>
        document.getElementById('catalog-hooks-adapters').getBoundingClientRect().top,
      );
      check(
        ssrTab === 'dev-console-tab-request-logs' &&
          depHref === '/components/use-on-twos?from=block.developer-console.request-logs.dependencies' &&
          anchorExists &&
          plain === '/components' &&
          groupAnchor &&
          top >= 0 &&
          top < 60,
        T('no JS: ?section= renders the right tab server-side; links, anchors and "← All Components" work'),
        JSON.stringify({ ssrTab, depHref, anchorExists, plain, groupAnchor, top }),
      );
      await ctx.close();
    }

    // ---------------------------------------------------------------- canonical
    {
      const ctx = await newCtx();
      const page = await ctx.newPage();
      const bad = [];
      for (const [path, want] of [
        ['/components/use-on-twos?from=catalog.hooks-adapters', 'https://frame12.dev/components/use-on-twos'],
        [`${CONSOLE}?section=request-logs`, 'https://frame12.dev/blocks/developer-console'],
        ['/blocks/workspace-settings?section=team', 'https://frame12.dev/blocks/workspace-settings'],
        ['/blocks/analytics-dashboard', 'https://frame12.dev/blocks/analytics-dashboard'],
      ]) {
        await page.goto(`${base}${path}`);
        const hrefs = await page.$$eval('link[rel="canonical"]', (ls) => ls.map((l) => l.getAttribute('href')));
        if (hrefs.length !== 1 || hrefs[0] !== want || hrefs[0].includes('?')) bad.push(`${path}: ${hrefs}`);
      }
      check(bad.length === 0, T('canonical: link[rel=canonical] has no query string'), bad.join('; '));
      await ctx.close();
    }

    // ---------------------------------------------------------------- axe (light + dark)
    {
      const bad = [];
      for (const scheme of ['light', 'dark']) {
        const ctx = await newCtx({ colorScheme: scheme });
        const page = await open(ctx);
        for (const path of [
          `${CONSOLE}?section=request-logs`,
          '/blocks/workspace-settings?section=team',
          '/blocks/analytics-dashboard',
          '/components',
          '/components/use-on-twos?from=block.developer-console.request-logs.dependencies',
          '/components/use-on-twos?from=catalog.hooks-adapters',
          '/components/use-on-twos',
          '/experiments/agent-approval',
        ]) {
          await goto(page, path);
          await page.waitForTimeout(150);
          const res = await new AxeBuilder({ page }).analyze();
          if (res.violations.length) {
            bad.push(`${scheme} ${path}: ${res.violations.map((v) => `${v.id}(${v.nodes.length})`).join(',')}`);
          }
        }
        await ctx.close();
      }
      check(bad.length === 0, T('axe: zero violations on all touched pages, light and dark'), bad.join('; '));
    }
  } finally {
    await browser.close();
  }
}

try {
  await waitForServer(base);
  const only = process.env.BROWSER;
  for (const [name, engine] of [
    ['chromium', chromium],
    ['firefox', firefox],
    ['webkit', webkit],
  ]) {
    if (only && only !== name) continue;
    await runEngine(name, engine);
  }
} finally {
  server.kill('SIGTERM');
}

console.log(failures ? `\n${failures} navigation check(s) failed` : '\nAll navigation continuity checks passed');
process.exitCode = failures ? 1 : 0;
