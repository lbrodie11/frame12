// F12-10 feasibility spike: can the platform's same-document View Transitions carry FRAME/12's
// edit grammar? Answers the seven spike questions per engine with computed-style samples at
// pose times (every animation is paused and seeked through `document.getAnimations()`, so each
// sample is deterministic), pixel checks on screenshots, and click / scroll probes.
//
//   node scripts/cut-morph-spike.mjs                    # Chromium, Firefox, WebKit
//   BROWSERS=chromium node scripts/cut-morph-spike.mjs
//   node scripts/cut-morph-spike.mjs --update-docs      # also writes docs/architecture/cut-morph-spike.json
//                                                       # and docs/images/cut-morph/spike/*.png
//
// The page uses the real `registry/styles/frame12.css`, so the answers describe the shipped
// grammar, not a copy of it. Questions 1–4 are re-asserted on every run by tests/cross-browser.mjs.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { PNG } from './png.mjs';
import { launch, REGISTRY_ROOT, REPO_ROOT } from '../tests/lib.mjs';

const updateDocs = process.argv.includes('--update-docs');
const IMG_DIR = updateDocs
  ? resolve(REPO_ROOT, 'docs/images/cut-morph/spike')
  : resolve(tmpdir(), 'frame12-cut-morph-spike');
mkdirSync(IMG_DIR, { recursive: true });
const BROWSERS = (process.env.BROWSERS || 'chromium,firefox,webkit').split(',').map((s) => s.trim()).filter(Boolean);
const CSS = readFileSync(resolve(REGISTRY_ROOT, 'styles/frame12.css'), 'utf8');

// Solid colour blocks (no text, no antialiasing) so every screenshot pixel is classifiable.
export const SPIKE_HTML = (extraCss = '') => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<style>${CSS}</style>
<style>
body{margin:0;background:#fff;font:14px/1.4 sans-serif}
#stage{position:relative;height:300px}
#static{position:absolute;left:20px;top:200px;width:200px;height:60px;border:2.5px solid #000;
  background:repeating-linear-gradient(45deg,#000 0 2px,#fff 2px 6px)}
#static-text{position:absolute;left:260px;top:220px;font-weight:700}
#box{position:absolute;left:0;top:40px;width:100px;height:50px;background:#ff0000;view-transition-name:box;view-transition-class:f12-match}
#box.moved{left:300px;background:#0000ff}
#grow{position:absolute;left:0;top:120px;width:100px;height:40px;view-transition-name:grow;view-transition-class:f12-match;
  background:linear-gradient(90deg,#ff0000 0 50%,#00ff00 50% 100%)}
#grow.big{width:200px;height:80px}
#grow.small{width:50px;height:20px}
#target{position:absolute;left:300px;top:100px;width:100px;height:40px;display:none}
#target.shown{display:block}
#clip{position:absolute;left:500px;top:40px;width:80px;height:80px;overflow:hidden;outline:1px solid #000}
#inner{position:absolute;left:0;top:0;width:60px;height:60px;background:#00ff00;view-transition-name:inner;view-transition-class:f12-match}
#inner.moved{left:200px;top:200px}
#tall{height:2400px}
#scope{position:absolute;left:20px;top:320px;width:360px;height:120px;overflow:hidden;contain:layout;outline:1px solid #000}
#sbox{position:absolute;left:0;top:10px;width:80px;height:40px;background:#ff0000;view-transition-name:sbox;view-transition-class:f12-match}
#sbox.moved{left:500px;background:#0000ff}
${extraCss}
</style></head><body>
<div id="stage"><div id="box"></div><div id="grow"></div><button id="target" type="button">target</button>
<div id="static"></div><div id="static-text">STATIC TEXT</div>
<div id="clip"><div id="inner"></div></div></div>
<div id="scope"><div id="sbox"></div></div>
<div id="tall"></div>
<script>
window.__clicks = [];
document.getElementById('target').addEventListener('click', () => window.__clicks.push('target'));
document.addEventListener('click', (e) => window.__clicks.push('doc:' + (e.target.id || e.target.tagName)));
window.__vtAnims = () => document.getAnimations().filter((a) => a.effect && a.effect.pseudoElement && a.effect.pseudoElement.startsWith('::view-transition'));
window.__start = async (mode, update, opts = {}) => {
  const host = opts.scope ? document.getElementById(opts.scope) : document.documentElement;
  if (mode) host.classList.add('f12-vt-' + mode);
  const vt = opts.scope ? host.startViewTransition(update) : document.startViewTransition(update);
  window.__vt = vt; window.__vtHost = host; window.__vtMode = mode;
  vt.ready.catch(() => {}); vt.finished.catch(() => {});
  await vt.ready;
  const anims = window.__vtAnims();
  anims.forEach((a) => a.pause());
  window.__paused = anims;
  return anims.map((a) => ({ pe: a.effect.pseudoElement, name: a.animationName, duration: a.effect.getTiming().duration,
    easing: a.effect.getKeyframes().map((k) => k.easing)[0], target: a.effect.target === document.documentElement ? 'html' : (a.effect.target && a.effect.target.id) }));
};
window.__seek = (t) => window.__paused.forEach((a) => { a.currentTime = t; });
window.__end = async () => {
  window.__paused.forEach((a) => a.play());
  await window.__vt.finished.catch(() => {});
  if (window.__vtMode) window.__vtHost.classList.remove('f12-vt-' + window.__vtMode);
};
window.__pseudo = (pe) => { const host = window.__vtHost; const cs = getComputedStyle(host, pe);
  return { transform: cs.transform, width: cs.width, height: cs.height, opacity: cs.opacity }; };
</script></body></html>`;

const POSE_MS = 1000 / 12;
const AT_60HZ = Array.from({ length: 16 }, (_, i) => Math.round((i * 1000) / 60 * 10) / 10);

function px(png, x, y) {
  const i = (png.width * y + x) << 2;
  return [png.data[i], png.data[i + 1], png.data[i + 2]];
}
// A crossfade between the red (old) and blue (new) blocks shows red AND blue over green; edge
// antialiasing against the white page (pink or light blue) does not.
const isBlend = ([r, g, b]) => r > 24 && b > 24 && g < Math.min(r, b) - 24;

/** Opens the spike page. */
async function open(browser, extraCss) {
  const ctx = await browser.newContext({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setContent(SPIKE_HTML(extraCss));
  return { ctx, page, errors };
}

// Pixel evidence needs a screenshot path that paints the paused View Transition overlay as the
// page would. The control: the UA default crossfade, paused mid-way, must show red+blue blended
// pixels. Measured: Chromium's does; Firefox's paints the overlay at its end state (the
// animation's current value is ignored) and WebKit's paints the live element under the overlay.
// Where the control fails, pixel answers are reported as null and the computed-style answers
// (getComputedStyle on the pseudo-elements, document.getAnimations()) are the evidence.
const evidenceCache = new WeakMap();
export async function pixelEvidence(browser) {
  if (evidenceCache.has(browser)) return evidenceCache.get(browser);
  const { ctx, page } = await open(browser);
  await page.evaluate(() => window.__start(null, () => document.getElementById('box').classList.add('moved')));
  await page.evaluate(() => window.__seek(125));
  const png = PNG.read(await page.screenshot({ clip: { x: 0, y: 40, width: 420, height: 50 } }));
  let blended = 0;
  for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++) if (isBlend(px(png, x, y))) blended++;
  await page.evaluate(() => window.__end());
  await ctx.close();
  const r = { blendedPixels: blended, detected: blended > 0 };
  evidenceCache.set(browser, r);
  return r;
}

/** Q1/Q2: stepped and smooth group geometry, old/new opacity at 60 Hz, swap boundary. */
export async function askGrammar(browser) {
  const out = {};
  const evidence = await pixelEvidence(browser);
  for (const mode of ['stepped', 'smooth']) {
    const { ctx, page } = await open(browser);
    const anims = await page.evaluate((m) => window.__start(m, () => document.getElementById('box').classList.add('moved')), mode);
    const samples = [];
    for (const t of mode === 'stepped' ? [10, 75, 90, 160, 175, 245] : [0, 30, 40, 130, 255]) {
      await page.evaluate((x) => window.__seek(x), t);
      const g = await page.evaluate(() => window.__pseudo('::view-transition-group(box)'));
      const x = Number((g.transform.match(/matrix\(1, 0, 0, 1, ([-\d.]+)/) || [])[1]);
      samples.push({ t, x: Math.round(x * 10) / 10 });
    }
    const opacity = [];
    for (const t of AT_60HZ.concat([POSE_MS * 2 - 0.5, POSE_MS * 2 + 0.5])) {
      await page.evaluate((x) => window.__seek(x), t);
      opacity.push({
        t,
        old: Number(await page.evaluate(() => window.__pseudo('::view-transition-old(box)').opacity)),
        new: Number(await page.evaluate(() => window.__pseudo('::view-transition-new(box)').opacity)),
      });
    }
    // Pixel check: every pixel of the moving block is pure red (old) or pure blue (new), never a blend.
    let blended = 0;
    let shots = 0;
    for (const t of evidence.detected ? (mode === 'stepped' ? [40, 120, 200] : [20, 60, 200]) : []) {
      await page.evaluate((x) => window.__seek(x), t);
      const buf = await page.screenshot({ clip: { x: 0, y: 40, width: 420, height: 50 } });
      const png = PNG.read(buf);
      for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++) if (isBlend(px(png, x, y))) blended++;
      shots++;
      if (updateDocs || browser.browserType().name() === 'chromium') {
        writeFileSync(resolve(IMG_DIR, `${browser.browserType().name()}-q2-${mode}-${t}ms.png`), buf);
      }
    }
    await page.evaluate(() => window.__end());
    const distinctX = [...new Set(samples.filter((s) => s.t < 250).map((s) => s.x))];
    const swaps = opacity.filter((o) => o.old + o.new !== 1 || (o.old !== 0 && o.old !== 1));
    const firstNew = opacity.find((o) => o.new === 1)?.t ?? null;
    out[mode] = {
      groupAnimation: anims.find((a) => a.pe === '::view-transition-group(box)'),
      imageAnimations: anims.filter((a) => /old|new/.test(a.pe) && a.pe.includes('(box)')).map((a) => `${a.pe} ${a.name} ${a.duration}ms`),
      samples,
      distinctPoses: distinctX.length,
      partialOpacityFrames: swaps.length,
      firstFrameShowingNew: firstNew,
      blendedPixels: evidence.detected ? blended : null,
      screenshots: shots,
    };
    await ctx.close();
  }
  out.control_uaCrossfade = evidence;
  return out;
}

/** Q2 boundary choice: show the old/new image at its own size ± how much, per boundary. */
export async function askBoundary(browser) {
  const res = {};
  for (const [label, swapMs] of [['first (83.33ms)', POSE_MS], ['second (166.67ms)', POSE_MS * 2]]) {
    const css = `.f12-vt-stepped::view-transition-old(*.f12-match),.f12-vt-stepped::view-transition-new(*.f12-match){animation-duration:${swapMs}ms}`;
    const worst = {};
    for (const [dir, cls] of [['grow 2x', 'big'], ['shrink 2x', 'small']]) {
      const { ctx, page } = await open(browser, css);
      await page.evaluate((c) => window.__start('stepped', () => document.getElementById('grow').classList.add(c)), cls);
      const nativeOld = 100;
      const nativeNew = cls === 'big' ? 200 : 50;
      let maxStops = 0;
      for (const t of [40, 120, 200]) {
        await page.evaluate((x) => window.__seek(x), t);
        const w = parseFloat(await page.evaluate(() => window.__pseudo('::view-transition-group(grow)').width));
        const newShown = Number(await page.evaluate(() => window.__pseudo('::view-transition-new(grow)').opacity)) === 1;
        const stops = Math.abs(Math.log2(w / (newShown ? nativeNew : nativeOld)));
        maxStops = Math.max(maxStops, stops);
      }
      await page.evaluate(() => window.__end());
      worst[dir] = Math.round(maxStops * 1000) / 1000;
      await ctx.close();
    }
    res[label] = worst;
  }
  return res;
}

/** Q3: with the root excluded, only named elements animate and the page stays put. */
export async function askRootIsolation(browser) {
  const out = {};
  const evidence = await pixelEvidence(browser);
  for (const [label, mode] of [['excluded (CutMorph)', 'stepped'], ['default root (no CutMorph class)', null]]) {
    const { ctx, page } = await open(browser);
    const before = await page.screenshot({ clip: { x: 0, y: 190, width: 420, height: 90 } });
    const anims = await page.evaluate((m) => window.__start(m, () => document.getElementById('box').classList.add('moved')), mode);
    let staticChanged = 0;
    for (const t of [40, 120, 200]) {
      await page.evaluate((x) => window.__seek(x), t);
      const during = await page.screenshot({ clip: { x: 0, y: 190, width: 420, height: 90 } });
      const a = PNG.read(before);
      const b = PNG.read(during);
      for (let i = 0; i < a.data.length; i += 4) if (Math.abs(a.data[i] - b.data[i]) > 8 || Math.abs(a.data[i + 1] - b.data[i + 1]) > 8) staticChanged++;
      if (mode && t === 120 && evidence.detected) writeFileSync(resolve(IMG_DIR, `${browser.browserType().name()}-q3-pose2.png`), await page.screenshot({ clip: { x: 0, y: 0, width: 620, height: 290 } }));
    }
    await page.evaluate(() => window.__end());
    out[label] = {
      rootAnimations: anims.filter((a) => a.pe.includes('(root)')).length,
      animatedNames: [...new Set(anims.map((a) => a.pe.replace(/^::view-transition-[a-z-]+\((.*)\)$/, '$1')))],
      staticPixelsChanged: evidence.detected ? staticChanged : null,
    };
    await ctx.close();
  }
  return out;
}

/** Q4: a click during the transition reaches the live (updated) DOM. */
export async function askClickThrough(browser) {
  const out = {};
  for (const [label, css] of [['pointer-events: none (CutMorph)', ''], ['UA default', ':is(.f12-vt-stepped)::view-transition{pointer-events:auto}']]) {
    const { ctx, page } = await open(browser, css);
    await page.evaluate(() => window.__start('stepped', () => { document.getElementById('box').classList.add('moved'); document.getElementById('target').classList.add('shown'); }));
    await page.evaluate(() => window.__seek(120));
    await page.mouse.click(350, 120);
    const clicks = await page.evaluate(() => window.__clicks.slice());
    await page.evaluate(() => window.__end());
    out[label] = { reachedTarget: clicks.includes('target'), clicks };
    await ctx.close();
  }
  return out;
}

/** Q5: scrolling and clipping during a document-scoped transition. */
export async function askScrollAndClip(browser) {
  const out = {};
  {
    const { ctx, page } = await open(browser);
    await page.evaluate(() => window.__start('stepped', () => document.getElementById('box').classList.add('moved')));
    await page.evaluate(() => window.__seek(120));
    const groupY = () => page.evaluate(() => Number(window.__pseudo('::view-transition-group(box)').transform.split(',')[5].replace(')', '')));
    const yBefore = await groupY();
    await page.evaluate(() => window.scrollBy(0, 30));
    await page.waitForTimeout(50);
    const yAfter = await groupY();
    const liveTop = await page.evaluate(() => Math.round(document.getElementById('box').getBoundingClientRect().top));
    const stillActive = await page.evaluate(() => !!document.activeViewTransition);
    await page.evaluate(() => window.__end());
    out.scroll = {
      groupTopBefore: yBefore,
      groupTopAfterScroll30: yAfter,
      liveElementTopAfterScroll: liveTop,
      transitionStillActive: stillActive,
      behaviour:
        yAfter === yBefore
          ? 'viewport-fixed: the snapshot ignores the scroll and detaches from its content'
          : yAfter === liveTop
            ? 'follows content'
            : 'drifts: only the new end re-targets to the live element, so the snapshot moves by the remaining progress and still detaches',
      matchesContent: yAfter === liveTop,
    };
    await ctx.close();
  }
  for (const [label, css] of [
    ['overflow:hidden, no nesting', ''],
    ['nested group (view-transition-group: nearest)', '#clip{view-transition-name:clipper;view-transition-class:f12-cut}#inner{view-transition-group:nearest}.f12-vt-stepped::view-transition-group-children(clipper){overflow:clip}'],
  ]) {
    const { ctx, page } = await open(browser, css);
    const evidence = await pixelEvidence(browser);
    const supported = await page.evaluate(() => CSS.supports('view-transition-group: nearest'));
    await page.evaluate(() => window.__start('stepped', () => document.getElementById('inner').classList.add('moved')));
    await page.evaluate(() => window.__seek(120));
    // Pixels of #inner's snapshot outside #clip's 80x80 box (500,40)-(580,120).
    const png = PNG.read(await page.screenshot({ clip: { x: 480, y: 20, width: 300, height: 280 } }));
    let outside = 0;
    for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++) {
      const [r, g, b] = px(png, x, y);
      const inClip = x + 480 >= 500 && x + 480 < 580 && y + 20 >= 40 && y + 20 < 120;
      if (!inClip && g > 240 && r < 10 && b < 10) outside++;
    }
    if (label.startsWith('overflow') && evidence.detected) writeFileSync(resolve(IMG_DIR, `${browser.browserType().name()}-q5-clip.png`), PNG.write(png));
    await page.evaluate(() => window.__end());
    out[label] = evidence.detected
      ? { supported, pixelsOutsideClip: outside, clipped: outside === 0 }
      : {
          supported,
          pixelsOutsideClip: null,
          clipped: supported ? null : false,
          basis: 'no pixel evidence in this engine; without nested view-transition groups every snapshot is painted in the top-layer ::view-transition tree, outside any overflow clip',
        };
    await ctx.close();
  }
  return out;
}

/** Q6: element-scoped transitions, where Element.prototype.startViewTransition exists. */
export async function askScoped(browser) {
  const { ctx, page } = await open(browser, '#stage{display:none}');
  const has = await page.evaluate(() => typeof Element.prototype.startViewTransition === 'function');
  if (!has) {
    await ctx.close();
    return { supported: false };
  }
  const anims = await page.evaluate(() => window.__start('stepped', () => document.getElementById('sbox').classList.add('moved'), { scope: 'scope' }));
  await page.evaluate(() => window.__seek(120));
  const docPseudo = await page.evaluate(() => getComputedStyle(document.documentElement, '::view-transition').display);
  const redBox = async () => {
    const png = PNG.read(await page.screenshot({ clip: { x: 0, y: 0, width: 800, height: 600 } }));
    let top = -1; let maxX = -1;
    for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++) { const [r, g, b] = px(png, x, y); if (r > 240 && g < 10 && b < 10) { if (top < 0) top = y; maxX = Math.max(maxX, x); } }
    return { top, maxX };
  };
  const before = await redBox();
  writeFileSync(resolve(IMG_DIR, `${browser.browserType().name()}-q6-scoped.png`), await page.screenshot({ clip: { x: 0, y: 300, width: 600, height: 160 } }));
  await page.evaluate(() => window.scrollBy(0, 30));
  await page.waitForTimeout(50);
  const after = await redBox();
  await page.evaluate(() => (window.__clicks.length = 0));
  // The scope covers (20,320)-(380,440); click outside it, on the page, during the transition.
  await page.mouse.click(600, 200);
  const clicks = await page.evaluate(() => window.__clicks.slice());
  const stillActive = await page.evaluate(() => window.__paused.some((a) => a.playState === 'paused'));
  await page.evaluate(() => window.__end());
  await ctx.close();
  // Q6b (added after release): subjects that EXIT. Remove named rows from a scoped list, five
  // shapes, and record whether `ready` resolves (the transition ran) or rejects (aborted).
  const exits = {};
  {
    const ctx2 = await browser.newContext({ viewport: { width: 800, height: 600 } });
    const p2 = await ctx2.newPage();
    for (const [label, update] of [
      ['move one (control)', 's.prepend(s.lastElementChild)'],
      ['remove 1 of 3', 's.children[1].remove()'],
      ['remove last of 24', 's.lastElementChild.remove()'],
      ['remove 12 of 24', '[...s.children].forEach((c, i) => i % 2 && c.remove())'],
      ['hide 1 of 24', "s.firstElementChild.style.display = 'none'"],
    ]) {
      const n = label.includes('of 3') ? 3 : 24;
      const runs = [];
      for (let k = 0; k < 3; k++) {
        await p2.setContent(`<!doctype html><style>#s{display:grid;gap:4px;width:300px}.r{height:20px;background:#ccc}</style><div id="s">${Array.from({ length: n }, (_, i) => `<div class="r" style="view-transition-name:r${i}">${i}</div>`).join('')}</div>`);
        runs.push(await p2.evaluate(async (u) => {
          const s = document.getElementById('s');
          const vt = s.startViewTransition(() => new Function('s', u)(s));
          try { await vt.ready; return 'ran'; } catch (e) { return `aborted (${e.message.replace(/^.*\. /, '')})`; }
        }, update));
      }
      exits[label] = runs;
    }
    await ctx2.close();
  }
  return {
    supported: true,
    exits,
    animationTargets: [...new Set(anims.map((a) => a.target))],
    rootAnimations: anims.filter((a) => a.pe.includes('(root)')).length,
    groupAnimation: anims.find((a) => a.pe === '::view-transition-group(sbox)'),
    documentPseudo: docPseudo,
    snapshotTopBefore: before.top,
    snapshotTopAfterScroll30: after.top,
    followsScroll: before.top - after.top === 30,
    snapshotRightmostPixel: before.maxX,
    clippedToScope: before.maxX >= 0 && before.maxX < 20 + 360,
    restOfPageClickable: clicks.some((c) => c.startsWith('doc:')),
    transitionSurvivedScroll: stillActive,
  };
}

/** Q7: `document.getAnimations()` exposes the pseudo-element animations (and they can be paused). */
export async function askGetAnimations(browser) {
  const { ctx, page } = await open(browser);
  const anims = await page.evaluate(() => window.__start('stepped', () => document.getElementById('box').classList.add('moved')));
  await page.evaluate(() => window.__seek(100));
  const paused = await page.evaluate(() => window.__paused.every((a) => a.playState === 'paused'));
  await page.evaluate(() => window.__end());
  await ctx.close();
  return { exposed: anims.length > 0, pseudoElements: [...new Set(anims.map((a) => a.pe))], seekable: paused };
}

export async function runSpike(browser) {
  const caps = await (async () => {
    const { ctx, page } = await open(browser);
    const r = await page.evaluate(() => ({
      startViewTransition: typeof document.startViewTransition === 'function',
      activeViewTransition: 'activeViewTransition' in document,
      elementScoped: typeof Element.prototype.startViewTransition === 'function',
      viewTransitionClass: CSS.supports('view-transition-class: a'),
      nestedGroups: CSS.supports('view-transition-group: nearest'),
      types: typeof ViewTransition !== 'undefined' && 'types' in ViewTransition.prototype,
    }));
    await ctx.close();
    return r;
  })();
  return {
    engine: browser.browserType().name(),
    version: browser.version(),
    capabilities: caps,
    q1q2_grammar: await askGrammar(browser),
    q2_boundary: await askBoundary(browser),
    q3_rootIsolation: await askRootIsolation(browser),
    q4_clickThrough: await askClickThrough(browser),
    q5_scrollAndClip: await askScrollAndClip(browser),
    q6_elementScoped: await askScoped(browser),
    q7_getAnimations: await askGetAnimations(browser),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const results = [];
  for (const name of BROWSERS) {
    const browser = await launch(name);
    try {
      const r = await runSpike(browser);
      results.push(r);
      console.log(JSON.stringify(r, null, 2));
    } finally {
      await browser.close();
    }
  }
  if (updateDocs) {
    writeFileSync(
      resolve(REPO_ROOT, 'docs/architecture/cut-morph-spike.json'),
      `${JSON.stringify({ recorded: new Date().toISOString().slice(0, 10), results }, null, 2)}\n`,
    );
  }
  console.log(`screenshots: ${IMG_DIR}`);
}
