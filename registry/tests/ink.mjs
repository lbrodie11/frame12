// Ink primitives (F12-14): InkStroke, InkReveal, InkSequence draw SVG line art on twos with CSS only.
//
// Timing is deterministic: Playwright's fake clock is installed (so no real timer can advance the
// page), and every CSS animation from document.getAnimations() is paused and seeked to the sample
// time, the same convention as flash-safety.mjs. Nothing here relies on real-time screenshots.
//   node tests/ink.mjs                      # chromium, firefox, webkit
//   BROWSERS=chromium node tests/ink.mjs    # one engine
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { launch } from './lib.mjs';
import { bundlePage, loadServerModule, openFixture, REGISTRY_ROOT } from './harness.mjs';

let failures = 0;
function check(ok, label, detail = '') {
  if (!ok) failures++;
  const d = detail === '' ? '' : `  ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${d}`);
}

const POSE = 1000 / 12;
const BROWSERS = (process.env.BROWSERS || 'chromium,firefox,webkit').split(',').map((s) => s.trim()).filter(Boolean);
const FIXTURE = resolve(REGISTRY_ROOT, 'tests/fixtures/ink-fixture.tsx');
const html = await bundlePage(FIXTURE);

// Server render: `play` is true at mount, which must render the finished (rest) state.
const { mod: ssrMod, React, server } = await loadServerModule(resolve(REGISTRY_ROOT, 'tests/fixtures/ink-ssr.tsx'));
const ssrHtml = server.renderToString(React.createElement(ssrMod.SsrScene, { play: true }));
check(
  /data-ink-state="rest"/.test(ssrHtml) &&
    !/data-ink="[ab]"/.test(ssrHtml) &&
    !/data-ink-scroll/.test(ssrHtml) &&
    /vector-effect="non-scaling-stroke"/.test(ssrHtml) &&
    !/<polygon[^>]*pathLength/i.test(ssrHtml),
  'SSR: play={true} at mount renders rest (finished): no data-ink, no scroll driver, and the SSR viewBox polygon (vector-effect) carries no pathLength',
);
const pencilServer = ssrMod.inkPencil([[10, 10, 290, 10], [10, 10, 10, 190], [150, 10, 150, 190]], 12);

const sha = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);

/** Pauses every animation and seeks it to `t` ms after the action that started it. */
const seek = (page, t) =>
  page.evaluate((t) => {
    for (const a of document.getAnimations()) {
      a.pause();
      a.currentTime = t;
    }
  }, t);
// Ink's own time-driven animations (the fixture's #spin is panel content, not ink).
const timeAnimations = (page) =>
  page.evaluate(() => document.getAnimations().filter((a) => a.timeline === document.timeline && a.effect?.target?.id !== 'spin').length);
const settle = (page) => page.waitForTimeout(60); // React commits on a real-time task; the clock is paused.
/**
 * `animationend` is dispatched asynchronously after a seek (and React commits on a real-time
 * task), so a fixed wait can read the count too early on a loaded runner. Poll (≤ 3 s) until the
 * onEnd count reaches `n`, then return the actual count: exact checks still catch an extra call.
 */
async function endsAtLeast(page, n) {
  for (let i = 0; i < 60; i++) {
    const ends = await page.evaluate(() => window.__ends);
    if (ends >= n) return ends;
    await page.waitForTimeout(50);
  }
  return page.evaluate(() => window.__ends);
}
const strokeStyle = (page, id = 'ink') =>
  page.evaluate((id) => {
    const cs = getComputedStyle(document.getElementById(id));
    return { a: cs.strokeDasharray, o: cs.strokeDashoffset, color: cs.stroke, opacity: cs.opacity, sw: cs.strokeWidth };
  }, id);

async function samplePoses(page, hz, until) {
  const out = [];
  for (let i = 0; i * (1000 / hz) <= until + 0.001; i++) {
    const t = i * (1000 / hz);
    await seek(page, t);
    const s = await strokeStyle(page);
    out.push({ t, v: `${s.a}|${s.o}` });
  }
  return out;
}
const runs = (samples) => {
  const r = [];
  for (const s of samples) {
    if (r.length && r[r.length - 1].v === s.v) r[r.length - 1].n++;
    else r.push({ v: s.v, t: s.t, n: 1 });
  }
  return r;
};

/** Decodes a PNG screenshot and returns a function giving the luminance (0..1) at (x, y). */
async function decoder(browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.setContent('<canvas id="c"></canvas>');
  return {
    close: () => ctx.close(),
    lum: (png, points) =>
      page.evaluate(
        async ({ b64, points }) => {
          const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
          const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
          const c = document.getElementById('c');
          c.width = bmp.width;
          c.height = bmp.height;
          const g = c.getContext('2d', { willReadFrequently: true });
          g.drawImage(bmp, 0, 0);
          return points.map(([x, y]) => {
            const d = g.getImageData(x, y, 1, 1).data;
            return (0.2126 * d[0] + 0.7152 * d[1] + 0.0722 * d[2]) / 255;
          });
        },
        { b64: png.toString('base64'), points },
      ),
    diff: (a, b) =>
      page.evaluate(
        async ({ a, b }) => {
          const load = async (b64) => {
            const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
            return createImageBitmap(new Blob([bytes], { type: 'image/png' }));
          };
          const [x, y] = [await load(a), await load(b)];
          if (x.width !== y.width || x.height !== y.height) return -1;
          const px = (bmp) => {
            const c = new OffscreenCanvas(bmp.width, bmp.height);
            const g = c.getContext('2d');
            g.drawImage(bmp, 0, 0);
            return g.getImageData(0, 0, bmp.width, bmp.height).data;
          };
          const [p, q] = [px(x), px(y)];
          let n = 0;
          for (let i = 0; i < p.length; i += 4) {
            if (p[i] !== q[i] || p[i + 1] !== q[i + 1] || p[i + 2] !== q[i + 2]) n++;
          }
          return n;
        },
        { a: a.toString('base64'), b: b.toString('base64') },
      ),
  };
}

const relLum = (rgb) => {
  const [r, g, b] = rgb.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [x, y] = [relLum(a), relLum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

for (const engine of BROWSERS) {
  const browser = await launch(engine);
  const dec = await decoder(browser);
  const SPY = `(() => {
    window.__spy = { raf: 0, timeout: 0, on: false };
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => { if (window.__spy.on) window.__spy.raf++; return raf(cb); };
    const st = window.setTimeout.bind(window);
    window.setTimeout = (...a) => { if (window.__spy.on) window.__spy.timeout++; return st(...a); };
  })()`;
  const open = (opts = {}) => openFixture(browser, html, { init: SPY, ...opts });
  const tag = `[${engine}]`;

  // ------------------------------------------------------------------------------- poses
  {
    const { ctx, page, errors } = await open();
    await page.evaluate(() => window.__render('stroke', { tempo: 'twos', poses: 6 }));
    await settle(page);
    const rest = await strokeStyle(page);
    await page.evaluate(() => (window.__spy.on = true));
    await page.evaluate(() => window.__toggle());
    await settle(page);
    const s60 = runs(await samplePoses(page, 60, 600));
    const active = s60.filter((r) => !r.v.startsWith('none'));
    const end = await strokeStyle(page);
    const holds = active.map((r) => r.n);
    check(
      rest.a === 'none' &&
        active.length === 6 &&
        new Set(active.map((r) => r.v.split('|')[1])).size === 6 &&
        holds.slice(0, 5).every((n) => n >= 4 && n <= 6) &&
        end.a === 'none',
      `${tag} InkStroke poses=6 at twos: exactly 6 distinct stroke-dashoffset values, each held ~83.33ms (5 samples at 60 Hz), ending at rest with stroke-dasharray: none`,
      { offsets: active.map((r) => r.v.split('|')[1]), holds, end: end.a },
    );
    // Replay (play false → true restarts with the other keyframe name) and sample at 120 Hz.
    // First let the finished draw report its onEnd: it is delivered asynchronously.
    await endsAtLeast(page, 1);
    await page.evaluate(() => window.__toggle());
    await settle(page);
    await page.evaluate(() => window.__toggle());
    await settle(page);
    const s120 = runs(await samplePoses(page, 120, 600)).filter((r) => !r.v.startsWith('none'));
    const lastChange120 = s120[s120.length - 1].t;
    const lastChange60 = active[active.length - 1].t;
    check(
      s120.length === 6 && Math.abs(lastChange120 - 5 * POSE) <= 1000 / 120 + 0.01 && Math.abs(lastChange60 - 5 * POSE) <= 1000 / 60 + 0.01,
      `${tag} 120 Hz sampling gives the same 6 poses and the same 500ms duration (time-based, not frame-based)`,
      { lastChange60, lastChange120 },
    );
    await page.waitForTimeout(60);
    const ends = await endsAtLeast(page, 2);
    const spy = await page.evaluate(() => window.__spy);
    check(spy.raf === 0 && spy.timeout === 0 && ends === 2 && errors.length === 0,
      `${tag} zero JS animation: 0 requestAnimationFrame and 0 setTimeout calls across two full draws (a replay restarts); onEnd fired once per draw`, { spy, ends, errors });
    // Contrast at every pose: same color, full opacity, ≥ 3:1 against --f-panel.
    await page.evaluate(() => window.__toggle());
    await settle(page);
    await page.evaluate(() => window.__toggle());
    await settle(page);
    const posesOk = [];
    for (let k = 0; k < 6; k++) {
      await seek(page, k * POSE + 1);
      const s = await strokeStyle(page);
      posesOk.push(s.color === rest.color && s.opacity === '1');
    }
    const panel = await page.evaluate(() => {
      const el = document.createElement('div');
      el.style.color = 'var(--f-panel)';
      document.body.append(el);
      const c = getComputedStyle(el).color;
      el.remove();
      return c;
    });
    check(posesOk.every(Boolean) && contrast(rest.color, panel) >= 3,
      `${tag} contrast: every pose keeps the finished stroke color at opacity 1, ≥ 3:1 against --f-panel (light)`, { ratio: contrast(rest.color, panel).toFixed(2) });
    await ctx.close();
  }

  // ------------------------------------------------------------------- ones / cut / dark contrast
  {
    const { ctx, page } = await open({ scheme: 'dark' });
    await page.evaluate(() => window.__render('stroke', { tempo: 'ones', poses: 6 }));
    await settle(page);
    await page.evaluate(() => window.__toggle());
    await settle(page);
    const s = runs(await samplePoses(page, 60, 600));
    const active = s.filter((r) => !r.v.startsWith('none'));
    check(active.length >= 25 && s[s.length - 1].v.startsWith('none') && Math.abs(active[active.length - 1].t - 500) <= 1000 / 60 + 0.01,
      `${tag} ones (smooth): linear, a new dash offset at every 60 Hz sample, same 500ms total`, { distinct: active.length });
    const fin = await strokeStyle(page);
    const panel = await page.evaluate(() => getComputedStyle(document.getElementById('stage')).backgroundColor);
    check(contrast(fin.color, panel) >= 3, `${tag} contrast (dark): stroke ≥ 3:1 against --f-panel`, contrast(fin.color, panel).toFixed(2));
    await page.evaluate(() => window.__setTempo('still'));
    await settle(page);
    await page.evaluate(() => window.__toggle());
    await settle(page);
    await page.evaluate(() => window.__toggle());
    await settle(page);
    const st = await strokeStyle(page);
    check((await timeAnimations(page)) === 0 && st.a === 'none',
      `${tag} cut (still tempo): toggling play never animates; the stroke stays finished`);
    await ctx.close();
  }

  // ------------------------------------------------------------------------------- never on load
  {
    const { ctx, page, errors } = await open();
    await page.evaluate(() => window.__render('stroke', { tempo: 'twos', initial: true }));
    await settle(page);
    const s = await strokeStyle(page);
    const attr = await page.evaluate(() => document.getElementById('ink').getAttribute('data-ink'));
    check(attr === null && s.a === 'none' && (await timeAnimations(page)) === 0,
      `${tag} never on load: play={true} at mount does not draw (client render)`);
    await page.evaluate((h) => window.__hydrate(h), ssrHtml);
    // Hydration commits on a real-time task; poll (≤ 3 s) for the measured polygon instead of
    // a fixed wait, which a loaded WebKit run can miss.
    for (let i = 0; i < 60; i++) {
      if (await page.evaluate(() => document.querySelector('#ssr-panel .f12-panel-frame polygon:not([vector-effect])') !== null)) break;
      await page.waitForTimeout(50);
    }
    const hyd = await page.evaluate(() => ({
      state: document.getElementById('ssr-seq').dataset.inkState,
      ink: document.querySelector('#ssr [data-ink]')?.getAttribute('data-ink') ?? null,
      measured: document.querySelector('#ssr-panel .f12-panel-frame polygon')?.getAttribute('pathLength'),
    }));
    check(
      (await timeAnimations(page)) === 0 && hyd.ink === null && ['rest', 'scrubbing'].includes(hyd.state) && hyd.measured === '1' &&
        errors.filter((e) => /hydrat|did not match/i.test(e)).length === 0,
      `${tag} hydration of SSR markup with play={true}: no hydration warnings, no time-driven drawing, measured polygon gets pathLength="1"`,
      { hyd, errors },
    );
    // The sequence is on screen at hydration: it must stay finished (rest), never jump to a scroll
    // pose. Once scrolled out of view, the scroll driver may attach (where supported).
    await page.waitForTimeout(150);
    const inView = await page.evaluate(() => ({
      state: document.getElementById('ssr-seq').dataset.inkState,
      dash: getComputedStyle(document.getElementById('ssr-stroke')).strokeDasharray,
      supports: CSS.supports('animation-timeline: view()'),
    }));
    await page.evaluate(() => {
      const spacer = document.createElement('div');
      spacer.id = 'spacer';
      spacer.style.height = '4000px';
      document.body.append(spacer);
      window.scrollTo(0, 3000);
    });
    let outOfView = '';
    for (let i = 0; i < 40; i++) {
      outOfView = await page.evaluate(() => document.getElementById('ssr-seq').dataset.inkState);
      if (outOfView === 'scrubbing' || !inView.supports) break;
      await page.waitForTimeout(50);
    }
    await page.evaluate(() => {
      document.getElementById('spacer').remove();
      window.scrollTo(0, 0);
    });
    check(
      inView.state === 'rest' && inView.dash === 'none' && outOfView === (inView.supports ? 'scrubbing' : 'rest'),
      `${tag} scroll driver never attaches while the hydrated drawing is on screen (finished, rest); it attaches once the drawing has been out of view${inView.supports ? '' : ' (no scroll-timeline support here: stays rest)'}`,
      { inView, outOfView },
    );
    // SSR polygon: even forced into a playing reveal, the viewBox polygon never receives dashes.
    const ssrPoly = await page.evaluate((h) => {
      const host = document.createElement('div');
      host.innerHTML = h;
      document.body.append(host);
      host.querySelector('.f12-ink-reveal').setAttribute('data-ink', 'a');
      const poly = host.querySelector('polygon[vector-effect]');
      const cs = getComputedStyle(poly);
      const r = { name: cs.animationName, dash: cs.strokeDasharray };
      host.remove();
      return r;
    }, ssrHtml);
    check(ssrPoly.name === 'none' && ssrPoly.dash === 'none',
      `${tag} SSR viewBox polygon (vector-effect: non-scaling-stroke) never receives dash properties or an animation`, ssrPoly);
    const pencilClient = await page.evaluate(() => [window.__pencil(12), window.__pencil(12)]);
    check(pencilClient[0] === pencilClient[1] && sha(pencilClient[0]) === sha(pencilServer) && pencilClient[0] !== (await page.evaluate(() => window.__pencil(13))),
      `${tag} deterministic pencil: identical across two renders and across server and client (sha ${sha(pencilServer)}); a different seed differs`);
    await ctx.close();
  }

  // --------------------------------------------------------------------- pixel identity at rest
  for (const scheme of ['light', 'dark']) {
    const { ctx, page } = await open({ scheme });
    await page.evaluate(() => window.__render('plain-panel', { tempo: 'twos' }));
    await settle(page);
    const plain = await page.locator('#host').screenshot();
    await page.evaluate(() => window.__render('reveal', { tempo: 'twos' }));
    await settle(page);
    await page.evaluate(() => window.__toggle());
    await settle(page);
    await seek(page, 2000);
    await settle(page);
    const revealed = await page.locator('#host').screenshot();
    const panelDiff = await dec.diff(plain, revealed);
    const ends = await endsAtLeast(page, 1);
    await page.evaluate(() => window.__render('plain-stroke', { tempo: 'twos' }));
    await settle(page);
    const plainStroke = await page.locator('#stage').screenshot();
    await page.evaluate(() => window.__render('stroke', { tempo: 'twos' }));
    await settle(page);
    await page.evaluate(() => window.__toggle());
    await settle(page);
    await seek(page, 2000);
    await settle(page);
    const strokeRest = await page.locator('#stage').screenshot();
    const strokeDiff = await dec.diff(plainStroke, strokeRest);
    check(panelDiff === 0 && strokeDiff === 0 && ends === 1,
      `${tag} pixel identity at rest (${scheme}): InkReveal-wrapped Panel after its reveal = plain Panel, and a finished closed mitered InkStroke = plain path (diff 0 px, no seam at the start corner)`,
      { panelDiff, strokeDiff, ends });
    await ctx.close();
  }

  // ------------------------------------------------------------------- reveal order, RTL, resize
  {
    const { ctx, page } = await open();
    for (const dir of ['ltr', 'rtl']) {
      await page.evaluate((dir) => window.__render('reveal', { tempo: 'twos', dir }), dir);
      await settle(page);
      await page.evaluate(() => window.__toggle());
      await settle(page);
      await seek(page, 1);
      const order = await page.evaluate(() => ({
        cut: getComputedStyle(document.querySelector('#panel .f12-cut')).visibility,
        body: getComputedStyle(document.querySelector('#panel .f12-panel-body')).visibility,
      }));
      const shot = await page.locator('#host').screenshot();
      // Panel occupies x 20..300 in the 320px host (20px padding); the top edge is at y ≈ 21.
      const [left, right] = await dec.lum(shot, [[40, 21], [280, 21]]);
      const startsRight = right < 0.5 && left > 0.5;
      const startsLeft = left < 0.5 && right > 0.5;
      await seek(page, 6 * POSE + 1);
      const cutAt7 = await page.evaluate(() => [
        getComputedStyle(document.querySelector('#panel .f12-cut')).visibility,
        getComputedStyle(document.querySelector('#panel .f12-panel-body')).visibility,
      ]);
      await seek(page, 7 * POSE + 1);
      const bodyAt8 = await page.evaluate(() => getComputedStyle(document.querySelector('#panel .f12-panel-body')).visibility);
      check(
        (dir === 'rtl' ? startsRight : startsLeft) && order.cut === 'hidden' && order.body === 'hidden' &&
          cutAt7[0] === 'visible' && cutAt7[1] === 'hidden' && bodyAt8 === 'visible',
        `${tag} InkReveal ${dir}: the frame starts at the top-${dir === 'rtl' ? 'right' : 'left'} corner; frame (6 poses) → cut lands (pose 7) → content in one cut (pose 8)`,
        { left: left.toFixed(2), right: right.toFixed(2), order, cutAt7, bodyAt8 },
      );
    }
    // Resize mid-reveal: pathLength normalizes, so the reveal still finishes as a plain panel.
    await page.evaluate(() => window.__render('plain-panel', { tempo: 'twos', width: 420 }));
    await settle(page);
    const plainWide = await page.locator('#host').screenshot();
    await page.evaluate(() => window.__render('reveal', { tempo: 'twos', width: 320 }));
    await settle(page);
    await page.evaluate(() => window.__toggle());
    await settle(page);
    await seek(page, 3 * POSE + 1);
    await page.evaluate(() => (document.getElementById('host').style.width = '420px'));
    await page.waitForTimeout(120);
    await seek(page, 2000);
    await settle(page);
    const resized = await page.locator('#host').screenshot();
    check((await dec.diff(plainWide, resized)) === 0, `${tag} resize mid-reveal (320 → 420px at pose 3) finishes pixel-identical to a plain 420px Panel`);
    await ctx.close();
  }

  // ------------------------------------- a finished or cancelled cycle never replays (stroke, reveal)
  {
    const { ctx, page, errors } = await open();
    const attrOf = (sel) => page.evaluate((sel) => document.querySelector(sel)?.getAttribute('data-ink') ?? null, sel);
    const flip = async (tempo) => {
      await page.evaluate((t) => window.__setTempo(t), tempo);
      await settle(page);
    };
    const reducedFlip = async () => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await settle(page);
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await settle(page);
    };
    for (const [scenario, sel] of [['stroke', '#ink'], ['reveal', '.f12-ink-reveal']]) {
      // After completion: play stays true; twos → still → twos and reduced motion on/off.
      await page.evaluate((n) => window.__render(n, { tempo: 'twos' }), scenario);
      await settle(page);
      await page.evaluate(() => window.__toggle());
      await settle(page);
      await seek(page, 2000);
      await settle(page);
      const endsDone = await endsAtLeast(page, 1);
      await flip('still');
      await flip('twos');
      await reducedFlip();
      const afterDone = { anims: await timeAnimations(page), attr: await attrOf(sel), ends: await page.evaluate(() => window.__ends) };
      const content = scenario === 'reveal' ? await page.evaluate(() => getComputedStyle(document.querySelector('#panel .f12-panel-body')).visibility) : 'visible';
      // Mid-animation: cancel with still, re-enable; then cancel with reduced motion, re-enable.
      await page.evaluate(() => window.__toggle());
      await settle(page);
      await page.evaluate(() => window.__toggle());
      await settle(page);
      await seek(page, 2 * POSE + 1);
      await flip('still');
      await flip('twos');
      const afterCut = { anims: await timeAnimations(page), attr: await attrOf(sel) };
      await page.evaluate(() => window.__toggle());
      await settle(page);
      await page.evaluate(() => window.__toggle());
      await settle(page);
      await seek(page, 2 * POSE + 1);
      await reducedFlip();
      const afterReduced = { anims: await timeAnimations(page), attr: await attrOf(sel) };
      // A new false → true play still replays.
      await page.evaluate(() => window.__toggle());
      await settle(page);
      await page.evaluate(() => window.__toggle());
      await settle(page);
      const replay = await timeAnimations(page);
      check(
        endsDone === 1 && afterDone.anims === 0 && afterDone.attr === null && afterDone.ends === 1 && content === 'visible' &&
          afterCut.anims === 0 && afterCut.attr === null && afterReduced.anims === 0 && afterReduced.attr === null &&
          replay > 0 && errors.length === 0,
        `${tag} ${scenario === 'stroke' ? 'InkStroke' : 'InkReveal'}: a finished draw, or one cancelled by still tempo or reduced motion, never restarts when motion returns (content stays visible); only a new false → true play replays`,
        { endsDone, afterDone, content, afterCut, afterReduced, replay, errors },
      );
    }
    // RTL PanelPair: each frame starts at its own top-right corner (the two shapes differ).
    await page.evaluate(() => window.__render('reveal', { tempo: 'twos', pair: true, dir: 'rtl' }));
    await settle(page);
    await page.evaluate(() => window.__toggle());
    await settle(page);
    await seek(page, 1);
    const rtlPair = await page.evaluate(() =>
      [...document.querySelectorAll('#panel .f12-panel-frame polygon:not([vector-effect])')].map((poly) => {
        const n = poly.getAttribute('points').trim().split(/[\s,]+/).map(Number);
        const pts = [];
        for (let i = 0; i + 1 < n.length; i += 2) pts.push([n[i], n[i + 1]]);
        const lens = pts.map((p, i) => Math.hypot(pts[(i + 1) % pts.length][0] - p[0], pts[(i + 1) % pts.length][1] - p[1]));
        const a = lens[0] / lens.reduce((x, y) => x + y, 0);
        return { a, offset: parseFloat(getComputedStyle(poly).strokeDashoffset) };
      }),
    );
    // Pose 1 of 6: offset = p − a with p = 1/6, using each polygon's own a.
    check(
      rtlPair.length === 2 && Math.abs(rtlPair[0].a - rtlPair[1].a) > 1e-4 &&
        rtlPair.every((r) => Math.abs(r.offset - (1 / 6 - r.a)) < 1e-3),
      `${tag} InkReveal rtl around a PanelPair: each frame's stroke starts at its own top-right corner (per-polygon start, the two slanted shapes differ)`,
      rtlPair,
    );
    await seek(page, 2000);
    await settle(page);
    // PanelPair: two panel bodies, one completion per reveal.
    await page.evaluate(() => window.__render('reveal', { tempo: 'twos', pair: true }));
    await settle(page);
    const bodies = await page.evaluate(() => document.querySelectorAll('#panel .f12-panel-body').length);
    await page.evaluate(() => window.__toggle());
    await settle(page);
    await seek(page, 2000);
    await settle(page);
    const first = await endsAtLeast(page, 1);
    await page.evaluate(() => window.__toggle());
    await settle(page);
    await page.evaluate(() => window.__toggle());
    await settle(page);
    await seek(page, 2000);
    await settle(page);
    const second = await endsAtLeast(page, 2);
    check(bodies === 2 && first === 1 && second === 2,
      `${tag} InkReveal around a PanelPair (2 panel bodies): onEnd fires exactly once per reveal (1, then 2 after a replay)`, { bodies, first, second });
    await ctx.close();
  }

  // ------------------------------------------- forced colors and print: finished look, onEnd still fires
  for (const media of [{ forcedColors: 'active' }, { media: 'print' }]) {
    const label = media.media ? 'print' : 'forced colors';
    const { ctx, page, errors } = await open();
    await page.emulateMedia(media);
    const shot = (sel) => page.locator(sel).screenshot();
    // InkStroke: mid-draw it already looks finished; the draw still ends and calls onEnd once.
    await page.evaluate(() => window.__render('plain-stroke', { tempo: 'twos' }));
    await settle(page);
    const plainStroke = await shot('#stage');
    await page.evaluate(() => window.__render('stroke', { tempo: 'twos' }));
    await settle(page);
    await page.evaluate(() => window.__toggle());
    await settle(page);
    await seek(page, 2 * POSE + 1);
    const midStroke = await shot('#stage');
    const strokeDash = await strokeStyle(page);
    await seek(page, 2000);
    await settle(page);
    const strokeEnds = await endsAtLeast(page, 1);
    // InkReveal: content visible mid-reveal; one onEnd; the content's own animation untouched.
    await page.evaluate(() => window.__render('reveal', { tempo: 'twos' }));
    await settle(page);
    const spinBefore = await page.evaluate(() => document.getElementById('spin').getAnimations().length);
    await page.evaluate(() => window.__toggle());
    await settle(page);
    await seek(page, 2 * POSE + 1);
    const mid = await page.evaluate(() => ({
      body: getComputedStyle(document.querySelector('#panel .f12-panel-body')).visibility,
      cut: getComputedStyle(document.querySelector('#panel .f12-cut')).visibility,
      dash: getComputedStyle(document.querySelector('#panel .f12-panel-frame polygon')).strokeDasharray,
    }));
    await seek(page, 2000);
    await settle(page);
    const revealEnds = await endsAtLeast(page, 1);
    const spinAfter = await page.evaluate(() => document.getElementById('spin').getAnimations().length);
    const strokeDiff = await dec.diff(plainStroke, midStroke);
    check(
      strokeDash.a === 'none' && strokeDiff === 0 && strokeEnds === 1 &&
        mid.body === 'visible' && mid.cut === 'visible' && mid.dash === 'none' && revealEnds === 1 &&
        spinBefore === 1 && spinAfter === 1 && errors.length === 0,
      `${tag} ${label}: a play in flight already looks finished (stroke pixel-identical to a plain path mid-draw, reveal content visible), still ends and calls onEnd once, and content's own CSS animations keep running`,
      { strokeDash: strokeDash.a, strokeDiff, strokeEnds, mid, revealEnds, spinBefore, spinAfter, errors },
    );
    await ctx.close();
  }

  // ------------------------- a draw that finishes as play changes still reports its own completion
  {
    // The browser delivers animationend asynchronously, so it can arrive after the consumer has
    // already changed `play`. The event names the play it finished (keyframes …A / …B), so a
    // completed draw still calls onEnd. WebKit drops animationend entirely when the animation is
    // removed in the same task it finished, so there it may never arrive: never more than once.
    const { ctx, page, errors } = await open();
    const got = {};
    for (const name of ['stroke', 'reveal']) {
      await page.evaluate((n) => window.__render(n, { tempo: 'twos' }), name);
      await settle(page);
      await page.evaluate(() => window.__toggle());
      await settle(page);
      await page.evaluate(() => {
        for (const a of document.getAnimations()) {
          a.pause();
          a.currentTime = 5000;
        }
        window.__toggle(); // Stop, in the same task the draw finished
      });
      got[name] = await endsAtLeast(page, 1);
    }
    const ok = engine === 'webkit' ? got.stroke <= 1 && got.reveal <= 1 : got.stroke === 1 && got.reveal === 1;
    check(ok && errors.length === 0,
      `${tag} a draw that finishes as play turns false still calls onEnd exactly once (InkStroke, InkReveal)${engine === 'webkit' ? ' — WebKit drops the event when the animation is removed in the same task: at most once' : ''}`,
      { got, errors });
    await ctx.close();
  }

  // ------------------------------------------------------------------------------ InkSequence
  {
    const { ctx, page, errors } = await open();
    await page.evaluate(() => window.__render('sequence', { tempo: 'twos' }));
    await settle(page);
    await page.evaluate(() => (window.__spy.on = true));
    await page.evaluate(() => window.__toggle());
    await settle(page);
    await seek(page, 48 * POSE - 2);
    await settle(page);
    const before = await page.evaluate(() => [document.getElementById('seq').dataset.inkState, window.__ends]);
    await seek(page, 48 * POSE + 1);
    await endsAtLeast(page, 1);
    await settle(page);
    const after = await page.evaluate(() => [document.getElementById('seq').dataset.inkState, window.__ends, window.__states.join(',')]);
    const spy = await page.evaluate(() => window.__spy);
    check(before[0] === 'playing' && before[1] === 0 && after[0] === 'rest' && after[1] === 1 && spy.raf === 0 && spy.timeout === 0,
      `${tag} InkSequence: 4 beats × 12 poses = 48 poses = 4.0s at twos; onEnd at 4000ms from the last beat; 0 rAF and 0 setTimeout calls`,
      { before, after, spy });
    // Stop mid-play → rest (finished), never half-drawn.
    await page.evaluate(() => window.__toggle());
    await settle(page);
    await seek(page, 1000);
    await page.evaluate(() => window.__toggle());
    await settle(page);
    const stopped = await page.evaluate(() => ({
      state: document.getElementById('seq').dataset.inkState,
      dash: ['b0', 'b1'].map((id) => getComputedStyle(document.getElementById(id)).strokeDasharray),
      vis: getComputedStyle(document.getElementById('b3')).visibility,
    }));
    check(stopped.state === 'rest' && (await timeAnimations(page)) === 0 && stopped.dash.every((d) => d === 'none') && stopped.vis === 'visible',
      `${tag} InkSequence Stop mid-play returns to rest: every stroke finished, no animation left`, stopped);
    // Rapid Play/Stop (20 toggles) ends at rest.
    for (let i = 0; i < 20; i++) await page.evaluate(() => window.__toggle());
    await settle(page);
    check((await page.evaluate(() => document.getElementById('seq').dataset.inkState)) === 'rest' && (await timeAnimations(page)) === 0,
      `${tag} InkSequence rapid Play/Stop (20 toggles) ends at rest`);
    // Tempo changing mid-play finishes the play (still), and it never resumes.
    await page.evaluate(() => window.__toggle());
    await settle(page);
    await seek(page, 1500);
    await page.evaluate(() => window.__setTempo('still'));
    await settle(page);
    const still = await page.evaluate(() => document.getElementById('seq').dataset.inkState);
    const stillAnims = await timeAnimations(page);
    await page.evaluate(() => window.__setTempo('twos'));
    await settle(page);
    const back = await page.evaluate(() => document.getElementById('seq').dataset.inkState);
    check(still === 'still' && stillAnims === 0 && back === 'rest' && errors.length === 0,
      `${tag} InkSequence tempo → still mid-play: finished at once (still), and back at twos it stays at rest (no resume)`, { still, back, errors });
    await ctx.close();
  }
  {
    // Reduced motion mid-play goes to finished too.
    const { ctx, page } = await open();
    await page.evaluate(() => window.__render('sequence', { tempo: 'auto' }));
    await settle(page);
    await page.evaluate(() => window.__toggle());
    await settle(page);
    await seek(page, 800);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await settle(page);
    const s = await page.evaluate(() => document.getElementById('seq').dataset.inkState);
    check(s === 'still' && (await timeAnimations(page)) === 0, `${tag} OS reduced motion turning on mid-play: finished at once (still)`);
    await ctx.close();
  }

  await dec.close();
  await browser.close();
}

console.log(failures ? `\n${failures} ink check(s) failed` : '\nAll ink checks passed');
process.exit(failures ? 1 : 0);
