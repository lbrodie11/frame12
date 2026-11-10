// Captures, for every motion consumer rendered WITHOUT a TempoProvider:
//   - the SSR HTML (React 18.3 renderToString), hashed;
//   - the settled client DOM, hashed;
//   - the animation timeline of one state change: the DOM hash at each 60 Hz sample over 1 s
//     (Playwright's fake clock drives requestAnimationFrame deterministically), plus the timing of
//     every CSS animation/transition that change starts (document.getAnimations()).
// tempo.mjs captures the pre-tempo registry source (extracted from git) and the current source
// with this, in the same browser, and requires identical results. Comparing within one
// environment matters: layout-measured values differ between Chromium builds and fonts.
import * as React from 'react';
import { resolve } from 'node:path';
import { bundlePage, loadServerModule, openFixture, sampleAt60Hz, sha, REGISTRY_ROOT } from './harness.mjs';

export const CONSUMERS_ENTRY = resolve(REGISTRY_ROOT, 'tests/fixtures/consumers.tsx');

// Blocks have no external "step" prop: one real state change is a click on their first
// unpressed segmented option (or unselected tab).
const CLICK_TRIGGER = `(() => {
  const el = document.querySelector('#root .f12-rng-btn[aria-pressed="false"]') ||
    document.querySelector('#root [role="tab"][aria-selected="false"]');
  if (!el) throw new Error('no trigger');
  el.click();
  return el.id || el.textContent;
})()`;

const DOM_HASH = `(() => {
  const s = document.getElementById('root').innerHTML;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16) + ':' + s.length;
})()`;

const ANIMATIONS = `document.getAnimations().map((a) => {
  const t = a.effect.getTiming();
  return [a.constructor.name, a.animationName || a.transitionProperty || '', t.duration, t.easing, t.iterations, t.delay].join(' ');
}).sort()`;

/** `source`: { dirs: { hooksDir, uiDir, blocksDir }, cssPath } of the registry to capture (default: this one). */
export async function captureNoProvider(browser, source = {}) {
  const html = await bundlePage(CONSUMERS_ENTRY, { react: 18, dirs: source.dirs, cssPath: source.cssPath });
  const { mod, server } = await loadServerModule(CONSUMERS_ENTRY, { react: 18, dirs: source.dirs });
  const names = Object.keys(mod.CONSUMERS);
  const result = {};
  for (const name of names) {
    const ssr = server.renderToString(mod.renderConsumer(name, 0));
    const { ctx, page, errors } = await openFixture(browser, html);
    await page.evaluate((n) => window.__mount(n), name);
    await page.clock.runFor(1200);
    await page.waitForTimeout(150);
    await page.clock.runFor(1200);
    const settled = await page.evaluate(DOM_HASH);
    const trigger = mod.CONSUMERS[name].trigger
      ? await page.evaluate(CLICK_TRIGGER)
      : await page.evaluate(() => (window.__step(), 'step'));
    // React commits on a real-time MessageChannel task; the paused clock does not move meanwhile.
    await page.waitForTimeout(60);
    const animations = await page.evaluate(ANIMATIONS);
    const samples = await sampleAt60Hz(page, 1000, () => page.evaluate(DOM_HASH));
    // Collapse identical consecutive samples: [sampleIndex, hash] at each change.
    const timeline = [];
    samples.forEach((h, i) => {
      if (!timeline.length || timeline[timeline.length - 1][1] !== h) timeline.push([i, h]);
    });
    result[name] = { ssr: sha(ssr), ssrLength: ssr.length, settled, trigger, animations, timeline, errors };
    await ctx.close();
  }
  return result;
}

export { React };
