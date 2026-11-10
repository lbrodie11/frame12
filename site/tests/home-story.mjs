// "How a frame gets made" (F12-14): the home page's line-art story, served from the production
// build. Animation time is deterministic: every CSS animation is paused and seeked (the
// flash-safety.mjs convention); scroll progress is set with window.scrollTo (native scroll).
//   node tests/home-story.mjs                      # chromium, firefox, webkit
//   BROWSERS=chromium node tests/home-story.mjs
import { chromium, firefox, webkit } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';
import net from 'node:net';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = resolve(__dirname, '..');
const REPO_ROOT = resolve(SITE_ROOT, '..');
const ENGINES = { chromium, firefox, webkit };
const BROWSERS = (process.env.BROWSERS || 'chromium,firefox,webkit').split(',').map((s) => s.trim()).filter(Boolean);
const POSE = 1000 / 12;

let failures = 0;
function check(ok, label, detail = '') {
  if (!ok) failures++;
  const d = detail === '' ? '' : `  ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${d}`);
}

// ------------------------------------------------------------------------- static checks (no browser)
const tokenSource = JSON.parse(readFileSync(resolve(REPO_ROOT, 'packages/tokens/src/tokens.source.json'), 'utf8'));
const geometrySrc = readFileSync(resolve(SITE_ROOT, 'src/lib/story-geometry.ts'), 'utf8');
// The catalog's component count (every entry except motion hooks), as /components shows it.
const COMPONENT_COUNT = (() => {
  const ts = createRequire(resolve(REPO_ROOT, 'package.json'))('typescript');
  const src = readFileSync(resolve(SITE_ROOT, 'src/lib/catalog.ts'), 'utf8');
  const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const mod = { exports: {} };
  new Function('exports', 'require', 'module', out)(mod.exports, () => ({ REGISTRY_BASE_URL: '' }), mod);
  return mod.exports.COMPONENT_COUNT;
})();
const SCALE = Number(geometrySrc.match(/export const SCALE = ([\d.]+);/)[1]);
const TOKENS = Object.fromEntries(
  ['pair', 'scene', 'change'].map((k) => [k, tokenSource.gutter[k].$value.value]),
);

// The story's own client JavaScript: the Play/scroll shell plus the ink primitives it needs (React
// and the FRAME/12 components it shares with the page are external), minified and gzipped. The
// drawing and the captions are a server component, so they ship as HTML, not JavaScript.
{
  const alias = {
    name: 'alias',
    setup(b) {
      b.onResolve({ filter: /^@\/components\/frame12\/(ink|ink-sequence)$/ }, (a) => ({
        path: resolve(REPO_ROOT, `registry/ui/${a.path.split('/').pop()}.tsx`),
      }));
      b.onResolve({ filter: /^(react(-dom)?(\/.*)?|next\/link|@\/components\/frame12|@\/hooks\/.*|@frame12\/tokens)$/ }, (a) => ({ path: a.path, external: true }));
      b.onResolve({ filter: /^\.\/(ink|ink-pencil)$/ }, (a) => ({ path: resolve(REPO_ROOT, `registry/ui/${a.path.slice(2)}${a.path.endsWith('pencil') ? '.ts' : '.tsx'}`) }));
    },
  };
  const res = await build({
    entryPoints: [resolve(SITE_ROOT, 'src/components/story-shell.tsx')],
    bundle: true,
    minify: true,
    format: 'esm',
    write: false,
    jsx: 'automatic',
    plugins: [alias],
    logLevel: 'silent',
  });
  const gz = gzipSync(res.outputFiles[0].contents).length;
  check(gz <= 2048, `story JavaScript ≤ 2 KB gzipped (CSS-driven: no animation code; drawing and captions are server-rendered)`, `${res.outputFiles[0].contents.length} B minified, ${gz} B gzipped`);
}

function getFreePort() {
  return new Promise((ok, fail) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => ok(port));
    });
    srv.on('error', fail);
  });
}
const port = await getFreePort();
const base = `http://127.0.0.1:${port}`;
const nextBin = createRequire(resolve(SITE_ROOT, 'package.json')).resolve('next/dist/bin/next');
const server = spawn(process.execPath, [nextBin, 'start', '-p', String(port), '-H', '127.0.0.1'], {
  cwd: SITE_ROOT,
  stdio: 'ignore',
  env: { ...process.env, NODE_ENV: 'production' },
});
for (let i = 0; i < 100; i++) {
  try {
    if ((await fetch(`${base}/r/registry.json`)).ok) break;
  } catch {}
  await new Promise((r) => setTimeout(r, 250));
}

const SCROLL_SPY = `(() => {
  window.__scrollListeners = 0;
  window.__scrollTargets = [];
  const add = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (type, ...rest) {
    if (type === 'scroll' || type === 'scrollend' || type === 'wheel') {
      window.__scrollListeners++;
      window.__scrollTargets.push(this instanceof Element ? Boolean(this.closest('#home-story')) : false);
    }
    return add.call(this, type, ...rest);
  };
})()`;

const storyState = (page) => page.evaluate(() => document.getElementById('home-story').dataset.inkState);
const seek = (page, t) =>
  page.evaluate((t) => {
    for (const a of document.getAnimations()) {
      if (a.timeline !== document.timeline) continue;
      a.pause();
      a.currentTime = t;
    }
  }, t);
/** Scrolls so the story track is at `p` (0..1) of its contain range. */
const scrollToProgress = (page, p) =>
  page.evaluate((p) => {
    const t = document.getElementById('home-story');
    const top = t.getBoundingClientRect().top + window.scrollY;
    const range = Math.max(0, t.offsetHeight - window.innerHeight);
    window.scrollTo(0, top + range * p);
  }, p);
const finished = (page) =>
  page.evaluate(() => {
    const strokes = [...document.querySelectorAll('#home-story .f12-ink')];
    const lands = [...document.querySelectorAll('#home-story .f12-ink-land, #home-story .f12-ink-wipe')];
    return {
      strokes: strokes.length,
      allSolid: strokes.every((s) => getComputedStyle(s).strokeDasharray === 'none'),
      allLanded: lands.every((l) => getComputedStyle(l).visibility === 'visible' && ['none', 'inset(0px)'].includes(getComputedStyle(l).clipPath)),
      panels: document.querySelectorAll('#home-story .home-story-beat .f12-panel').length,
      svgsVisible: [...document.querySelectorAll('#home-story svg.home-story-art')].every((s) => s.getBoundingClientRect().height > 20),
    };
  });
const CAPTIONS = [
  ['heading', '12 columns, three gutters: 12 · 20 · 32'],
  ['heading', 'One mitered 2.5 px line frames every panel'],
  ['heading', '45° screentone instead of fills'],
  ['heading', 'Cuts are numbered in reading order'],
  ['link', 'Inspect Style Sheet'],
  ['link', /^Browse \d+ Components$/],
  ['link', 'Compare 12fps vs 60fps'],
];

try {
  for (const engineName of BROWSERS) {
    const engine = ENGINES[engineName];
    const browser = await engine.launch(
      engineName === 'chromium' ? { executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] } : {},
    );
    const tag = `[${engineName}]`;
    const newPage = async (opts = {}) => {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
      await ctx.addInitScript(SCROLL_SPY);
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      return { ctx, page, errors };
    };

    // ------------------------------------------------------------ load, geometry, size, a11y tree
    {
      const { ctx, page, errors } = await newPage();
      await page.goto(`${base}/`, { waitUntil: 'networkidle' });
      const supports = await page.evaluate(() => CSS.supports('animation-timeline: view()'));
      const state = await storyState(page);
      const timeAnims = await page.evaluate(() => document.getAnimations().filter((a) => a.timeline === document.timeline && a.effect?.target?.closest?.('#home-story')).length);
      check(timeAnims === 0 && state === (supports ? 'scrubbing' : 'rest') && errors.length === 0,
        `${tag} load: nothing plays (0 time-driven story animations); state is ${supports ? 'scrubbing (scroll timeline supported)' : 'rest'}`, { state, supports, errors });

      const geo = await page.evaluate(() => {
        const svg = document.querySelector('#home-story svg[data-story-beat="1"]');
        const frames = [...svg.querySelectorAll('.f12-ink-frame')].map((p) =>
          p.getAttribute('d').replace(/[MZ]/g, '').split('L').map((pt) => pt.trim().split(/\s+/).map(Number)),
        );
        return frames;
      });
      // frames[0] big panel, [1] pair top, [2] pair bottom, [3..5] the three-up scene.
      const measured = {
        pair: geo[2][0][1] - geo[1][3][1],
        scene: geo[1][0][0] - geo[0][1][0],
        change: geo[3][0][1] - geo[0][3][1],
        sceneB: geo[4][0][0] - geo[3][1][0],
      };
      check(
        measured.pair === TOKENS.pair * SCALE && measured.scene === TOKENS.scene * SCALE &&
          measured.change === TOKENS.change * SCALE && measured.sceneB === TOKENS.scene * SCALE,
        `${tag} geometry truth: the drawing's gutters equal the tokens × scale (${TOKENS.pair}/${TOKENS.scene}/${TOKENS.change}px × ${SCALE})`,
        measured,
      );
      const size = await page.evaluate(() => {
        const svgs = [...document.querySelectorAll('#home-story svg')];
        return { paths: svgs.reduce((n, s) => n + s.querySelectorAll('path').length, 0), markup: svgs.map((s) => s.outerHTML).join('') };
      });
      const gz = gzipSync(Buffer.from(size.markup)).length;
      check(size.paths <= 60 && gz <= 12 * 1024, `${tag} inline SVG budget: ${size.paths} paths (≤ 60) and ${gz} B gzipped (≤ 12 KB)`);
      const hidden = await page.evaluate(() => [...document.querySelectorAll('#home-story svg')].every((s) => s.getAttribute('aria-hidden') === 'true'));
      check(hidden, `${tag} every story drawing is aria-hidden="true"; the section has a heading`, String(await page.getByRole('heading', { name: 'How a frame gets made' }).count()));

      // Captions and links: visible and in the accessibility tree at every scroll progress.
      const seen = [];
      for (const p of [0, 0.33, 0.66, 1]) {
        await scrollToProgress(page, p);
        await page.waitForTimeout(100);
        let ok = true;
        for (const [role, name] of CAPTIONS) {
          const loc = page.getByRole(role, typeof name === 'string' ? { name, exact: true } : { name });
          if ((await loc.count()) !== 1 || !(await loc.isVisible())) ok = false;
        }
        seen.push(ok);
      }
      check(seen.every(Boolean), `${tag} captions and links: visible and in the accessibility tree at 0/33/66/100% scroll progress`, seen);
      const linkText = (await page.locator('#home-link-components').textContent()).trim();
      check(linkText === `Browse ${COMPONENT_COUNT} Components`, `${tag} "Browse N Components" quotes the live catalog count (${COMPONENT_COUNT}, every entry except motion hooks)`, linkText);

      // Scroll driver: poses advance and reverse with scroll, no listeners, no scroll-snap.
      if (supports) {
        const frameOffset = () =>
          page.evaluate(() => {
            const s = document.querySelector('#home-story svg[data-story-beat="1"] .f12-ink');
            return getComputedStyle(s).strokeDashoffset;
          });
        const at = async (p) => {
          await scrollToProgress(page, p);
          await page.waitForTimeout(120);
          return parseFloat(await frameOffset());
        };
        const forward = [await at(0.2), await at(0.3), await at(0.36), await at(0.6)];
        const back = [await at(0.36), await at(0.3), await at(0.2)];
        check(
          forward[0] === 1 && forward[1] < 1 && forward[2] < forward[1] && forward[3] === 0 && back[0] === forward[2] && back[2] === 1,
          `${tag} scroll driver: beat 2 (ink) poses advance with scroll (offset ${forward.join(' → ')}) and reverse when scrolling back (${back.join(' → ')})`,
        );
      }
      const snap = await page.evaluate(() =>
        [document.documentElement, document.body, ...document.querySelectorAll('#home-story, #home-story *')].some(
          (e) => !['none', ''].includes(getComputedStyle(e).scrollSnapType) || !['none', ''].includes(getComputedStyle(e).scrollSnapAlign),
        ),
      );
      const listeners = await page.evaluate(() => window.__scrollListeners);
      const onStory = await page.evaluate(() => window.__scrollTargets.filter((t) => t).length);
      const ref = await browser.newContext();
      await ref.addInitScript(SCROLL_SPY);
      const refPage = await ref.newPage();
      await refPage.goto(`${base}/get-started`, { waitUntil: 'networkidle' });
      const baseline = await refPage.evaluate(() => window.__scrollListeners);
      await ref.close();
      check(!snap && onStory === 0 && listeners === baseline,
        `${tag} native scroll only: the story adds no scroll/wheel listeners (${listeners} on / = ${baseline} on /get-started, from React and the site nav; 0 on story elements) and no scroll-snap anywhere`);

      // Skip the story.
      await scrollToProgress(page, 0.1);
      const from = await page.evaluate(() => window.scrollY);
      await page.click('#home-story-skip');
      await page.waitForTimeout(300);
      const skip = await page.evaluate((from) => ({ from, y: window.scrollY, hash: location.hash, top: Math.round(document.getElementById('home-install').getBoundingClientRect().top) }), from);
      check(skip.hash === '#home-install' && skip.top >= -2 && skip.top < 900 * 0.75 && skip.y > skip.from,
        `${tag} "Skip the story" jumps past the story to the next section (in view)`, skip);
      await ctx.close();
    }

    // ------------------------------------------------------------------------------- Play driver
    {
      const { ctx, page, errors } = await newPage();
      await page.goto(`${base}/`, { waitUntil: 'networkidle' });
      // Start mid-scroll, so scroll-linked animations exist when Play takes over.
      await scrollToProgress(page, 0.5);
      await page.waitForTimeout(100);
      const btn = page.locator('#home-story-play');
      await btn.click();
      await page.waitForTimeout(80);
      await seek(page, 2 * POSE + 1);
      const pose3 = await page.evaluate(() => {
        const off = (sel) => parseFloat(getComputedStyle(document.querySelector(sel)).strokeDashoffset);
        return {
          pencil: off('#home-story svg[data-story-beat="0"] .f12-ink'),
          ink: [...document.querySelectorAll('#home-story svg[data-story-beat="1"] .f12-ink')].map((e) => parseFloat(getComputedStyle(e).strokeDashoffset)),
        };
      });
      check(pose3.pencil > 0 && pose3.pencil < 1 && pose3.ink.every((o) => o === 1),
        `${tag} Play after scrolling: fresh time-based animations (pose 3: pencil part-drawn, every ink frame still undrawn), never the scroll-linked poses re-timed`, pose3);
      const playing = await page.evaluate(() => {
        const t = document.getElementById('home-story');
        const b = document.getElementById('home-story-play');
        return { state: t.dataset.inkState, scroll: t.hasAttribute('data-ink-scroll'), pressed: b.getAttribute('aria-pressed'), label: b.textContent };
      });
      await seek(page, 48 * POSE - 2);
      await page.waitForTimeout(60);
      const before = await storyState(page);
      await seek(page, 48 * POSE + 1);
      await page.waitForTimeout(100);
      const after = await page.evaluate(() => ({ state: document.getElementById('home-story').dataset.inkState, pressed: document.getElementById('home-story-play').getAttribute('aria-pressed') }));
      check(
        playing.state === 'playing' && !playing.scroll && playing.pressed === 'true' && playing.label === 'Stop' &&
          before === 'playing' && after.state === 'rest' && after.pressed === 'false',
        `${tag} Play: "Watch it get made" → Stop (aria-pressed true), detaches the scroll timeline, plays 48 poses = 4.0 s, then rest with aria-pressed false`,
        { playing, before, after },
      );
      await btn.click();
      await page.waitForTimeout(60);
      await seek(page, 900);
      await btn.click();
      await page.waitForTimeout(80);
      const stop = await finished(page);
      check(stop.allSolid && stop.allLanded && (await storyState(page)) === 'rest',
        `${tag} Stop mid-play → finished drawing (rest), never half-drawn`, stop);
      for (let i = 0; i < 20; i++) await btn.click();
      await page.waitForTimeout(100);
      check((await storyState(page)) === 'rest' && (await btn.getAttribute('aria-pressed')) === 'false',
        `${tag} rapid Play/Stop (20 toggles) ends at rest`);
      await btn.click();
      await page.waitForTimeout(60);
      await seek(page, 1200);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForTimeout(100);
      const rm = { state: await storyState(page), fin: await finished(page), disabled: await btn.isDisabled() };
      check(rm.state === 'still' && rm.fin.allSolid && rm.disabled && errors.length === 0,
        `${tag} reduced motion turning on mid-play → finished storyboard (still); Play is disabled with an explanation`, { ...rm, errors });
      await ctx.close();
    }

    // ------------------------------------------------------------------------------- fallbacks
    const fallbacks = [
      ['OS reduced motion', { reducedMotion: 'reduce' }],
      ['JavaScript disabled', { javaScriptEnabled: false }],
      ['forced colors', { forcedColors: 'active' }],
      ['still tempo', {}, async (page) => {
        await page.evaluate(() => localStorage.setItem('frame12-tempo', 'still'));
        await page.reload({ waitUntil: 'networkidle' });
      }],
      ['print', {}, async (page) => page.emulateMedia({ media: 'print' })],
    ];
    for (const [name, opts, prep] of fallbacks) {
      const { ctx, page } = await newPage(opts);
      await page.goto(`${base}/`, { waitUntil: 'networkidle' });
      if (prep) await prep(page);
      await scrollToProgress(page, 0.2);
      await page.waitForTimeout(150);
      const f = await finished(page);
      const extra = {};
      if (name === 'forced colors') {
        extra.stroke = await page.evaluate(() => {
          const s = document.querySelector('#home-story .f12-ink-frame');
          const probe = document.createElement('span');
          probe.style.color = 'CanvasText';
          document.body.append(probe);
          const r = [getComputedStyle(s).stroke, getComputedStyle(probe).color];
          probe.remove();
          return r;
        });
      }
      const forcedOk = name !== 'forced colors' || extra.stroke[0] === extra.stroke[1];
      check(f.panels === 4 && f.svgsVisible && f.allSolid && f.allLanded && forcedOk,
        `${tag} fallback (${name}): the four finished panels show as a storyboard${name === 'forced colors' ? ', strokes map to CanvasText' : ''}`, { ...f, ...extra });
      await ctx.close();
    }
    {
      // Engines without scroll timelines (simulated): storyboard plus Play.
      const { ctx, page } = await newPage();
      await ctx.addInitScript(() => {
        const orig = CSS.supports.bind(CSS);
        CSS.supports = (...a) => (String(a.join(' ')).includes('animation-timeline') ? false : orig(...a));
      });
      await page.goto(`${base}/`, { waitUntil: 'networkidle' });
      await scrollToProgress(page, 0.4);
      await page.waitForTimeout(100);
      const f = await finished(page);
      check((await storyState(page)) === 'rest' && f.allSolid && f.allLanded && (await page.locator('#home-story-play').isEnabled()),
        `${tag} without scroll-timeline support: finished storyboard plus an enabled Play button`);
      await ctx.close();
    }

    // ------------------------------------------------------------------- axe, reflow, focus order
    for (const scheme of ['light', 'dark']) {
      for (const w of [320, 768, 1440]) {
        const { ctx, page } = await newPage({ viewport: { width: w, height: 900 }, colorScheme: scheme });
        await page.goto(`${base}/`, { waitUntil: 'networkidle' });
        const axe = await new AxeBuilder({ page }).include('.home-story').analyze();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
        check(axe.violations.length === 0 && !overflow,
          `${tag} axe (${scheme}, ${w}px): zero violations in the story; no horizontal overflow${w === 320 ? ' (400% zoom reflow)' : w === 768 ? '' : ''}`,
          axe.violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`).join('; '));
        await ctx.close();
      }
    }
    {
      const { ctx, page } = await newPage({ viewport: { width: 640, height: 800 } });
      await page.goto(`${base}/`, { waitUntil: 'networkidle' });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      check(!overflow, `${tag} 200% zoom reflow (640px): no horizontal overflow`);
      await ctx.close();
    }
    {
      const { ctx, page } = await newPage();
      await page.goto(`${base}/`, { waitUntil: 'networkidle' });
      await page.focus('#home-rng-7');
      const order = [];
      for (let i = 0; i < 80 && order.length < 200; i++) {
        await page.keyboard.press(engineName === 'webkit' ? 'Alt+Tab' : 'Tab');
        const id = await page.evaluate(() => document.activeElement?.id || '');
        if (id) order.push(id);
        if (id === 'home-link-start') break;
      }
      const idx = (id) => order.indexOf(id);
      const want = ['home-story-play', 'home-link-style-sheet', 'home-link-components', 'home-link-motion', 'home-story-skip', 'home-link-start'];
      const ok = want.every((id) => idx(id) >= 0) && want.every((id, i) => i === 0 || idx(want[i - 1]) < idx(id));
      check(ok, `${tag} focus order: hero → story (Play, captions' links, Skip) → next section`, want.map((id) => `${id}@${idx(id)}`).join(' '));
      await ctx.close();
    }

    await browser.close();
  }
} finally {
  server.kill();
}

console.log(failures ? `\n${failures} home-story check(s) failed` : '\nAll home-story checks passed');
process.exit(failures ? 1 : 0);
