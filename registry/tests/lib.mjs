// Shared Playwright harness for @frame12/registry tests.
import { chromium, firefox, webkit } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const REGISTRY_ROOT = resolve(__dirname, '..');
export const REPO_ROOT = resolve(REGISTRY_ROOT, '..');
const RUN = resolve(REGISTRY_ROOT, '.f12-run');
const OUT = resolve(REGISTRY_ROOT, 'test-results');
mkdirSync(RUN, { recursive: true });
mkdirSync(OUT, { recursive: true });

const shim = process.env.F12_REACT_UMD ? readFileSync(process.env.F12_REACT_UMD, 'utf8') : null;
const localReactPath = resolve(REPO_ROOT, 'node_modules/react/umd/react.production.min.js');
const localReactDomPath = resolve(
  REPO_ROOT,
  'node_modules/react-dom/umd/react-dom.production.min.js',
);
const localReactUmd = existsSync(localReactPath) ? readFileSync(localReactPath, 'utf8') : null;
const localReactDomUmd = existsSync(localReactDomPath)
  ? readFileSync(localReactDomPath, 'utf8')
  : null;

export const outPath = (name) => resolve(OUT, name);

export const ENGINES = { chromium, firefox, webkit };

export async function launch(browserName = process.env.BROWSER || 'chromium') {
  if (!Object.prototype.hasOwnProperty.call(ENGINES, browserName)) {
    throw new Error(
      `Unknown browser engine "${browserName}". Expected one of: ${Object.keys(ENGINES).join(', ')}`,
    );
  }
  const engine = ENGINES[browserName];
  if (engine === chromium) {
    return chromium.launch({
      executablePath: process.env.CHROME_PATH || undefined,
      args: ['--no-sandbox'],
    });
  }
  return engine.launch();
}

export async function openGallery(
  browser,
  {
    w = 1280,
    h = 900,
    scheme = 'light',
    reduced = 'no-preference',
    forcedColors = 'none',
    css = '',
  } = {},
) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    colorScheme: scheme,
    reducedMotion: reduced,
    forcedColors,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) {
      errors.push(`console: ${m.text()}`);
    }
  });
  if (shim) {
    await page.route('**/*', (route) => {
      const u = route.request().url();
      if (u.startsWith('file://')) return route.continue();
      if (u.includes('cdnjs') && u.includes('react-dom')) {
        return route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
      }
      if (u.includes('cdnjs') && u.includes('/react/')) {
        return route.fulfill({ status: 200, contentType: 'application/javascript', body: shim });
      }
      return route.abort();
    });
  } else if (localReactUmd && localReactDomUmd) {
    await page.route('**/*cdnjs.cloudflare.com/**', (route) => {
      const u = route.request().url();
      if (u.includes('react-dom')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/javascript',
          body: localReactDomUmd,
        });
      }
      if (u.includes('/react/')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/javascript',
          body: localReactUmd,
        });
      }
      return route.continue();
    });
  }
  const galleryPath = resolve(REGISTRY_ROOT, 'dist/gallery.html');
  let targetPath = galleryPath;
  if (css) {
    const html = readFileSync(galleryPath, 'utf8');
    const custom = resolve(RUN, `${scheme}-${w}-gallery.html`);
    writeFileSync(custom, html.replace('</head>', `<style>${css}</style></head>`));
    targetPath = custom;
  }
  await page.goto(pathToFileURL(targetPath).href, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#root > *', { timeout: 15000 });
  await Promise.race([
    page.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve())),
    page.waitForTimeout(3000),
  ]);
  await page.waitForTimeout(350);
  return { ctx, page, errors };
}

export async function getRenderedCuts(page, options = {}) {
  const opts = typeof options === 'string' ? { rootId: options } : options;
  const { rootId = null, directSheetId = null, panelsOnly = false } = opts;
  const browserTypeName = page.context().browser()?.browserType().name() || 'chromium';

  if (browserTypeName !== 'chromium') {
    throw new Error(
      `getRenderedCuts requires Chromium CDP (DOMSnapshot.captureSnapshot), but browser is "${browserTypeName}". In Firefox/WebKit, assert panel count and reading order instead.`,
    );
  }

  const cdp = await page.context().newCDPSession(page);
  try {
    const snap = await cdp.send('DOMSnapshot.captureSnapshot', {
      computedStyles: ['display', 'visibility'],
    });
    const doc = snap.documents[0];
    const s = (idx) => (idx !== undefined && idx >= 0 ? snap.strings[idx] : '');
    const numNodes = doc.nodes.nodeName.length;
    const parentIndex = doc.nodes.parentIndex;

    const layoutByNode = new Map();
    for (let lIdx = 0; lIdx < doc.layout.nodeIndex.length; lIdx++) {
      const nIdx = doc.layout.nodeIndex[lIdx];
      if (!layoutByNode.has(nIdx)) layoutByNode.set(nIdx, []);
      layoutByNode.get(nIdx).push(lIdx);
    }

    const childrenByNode = new Map();
    for (let nIdx = 0; nIdx < numNodes; nIdx++) {
      const pIdx = parentIndex[nIdx];
      if (pIdx >= 0) {
        if (!childrenByNode.has(pIdx)) childrenByNode.set(pIdx, []);
        childrenByNode.get(pIdx).push(nIdx);
      }
    }

    const getAttr = (nIdx, attrName) => {
      const attrs = doc.nodes.attributes[nIdx] || [];
      for (let i = 0; i < attrs.length; i += 2) {
        if (s(attrs[i]) === attrName) return s(attrs[i + 1]);
      }
      return null;
    };

    const hasClass = (nIdx, className) => {
      const cls = getAttr(nIdx, 'class') || '';
      return cls.split(/\s+/).includes(className);
    };

    const hasAncestor = (nIdx, pred) => {
      let cur = parentIndex[nIdx];
      while (cur >= 0) {
        if (pred(cur)) return true;
        cur = parentIndex[cur];
      }
      return false;
    };

    const findNearestAncestor = (nIdx, pred) => {
      let cur = parentIndex[nIdx];
      while (cur >= 0) {
        if (pred(cur)) return cur;
        cur = parentIndex[cur];
      }
      return -1;
    };

    const cuts = [];
    for (let nIdx = 0; nIdx < numNodes; nIdx++) {
      if (!hasClass(nIdx, 'f12-cut')) continue;

      const selfLayouts = layoutByNode.get(nIdx);
      if (!selfLayouts || selfLayouts.length === 0) continue;
      const styles = doc.layout.styles[selfLayouts[0]] || [];
      if (s(styles[0]) === 'none' || s(styles[1]) === 'hidden') continue;

      if (rootId && !hasAncestor(nIdx, (anc) => getAttr(anc, 'id') === rootId)) continue;
      if (directSheetId) {
        const nearestFrame = findNearestAncestor(
          nIdx,
          (anc) => hasClass(anc, 'f12-frame') || hasClass(anc, 'f12-sheet'),
        );
        const frameWithId =
          nearestFrame >= 0 && getAttr(nearestFrame, 'id')
            ? nearestFrame
            : nearestFrame >= 0
              ? parentIndex[nearestFrame]
              : -1;
        if (frameWithId < 0 || getAttr(frameWithId, 'id') !== directSheetId) continue;
      }
      if (panelsOnly && hasAncestor(nIdx, (anc) => s(doc.nodes.nodeName[anc]) === 'DIALOG')) {
        continue;
      }

      const children = childrenByNode.get(nIdx) || [];
      let text = '';
      for (const cIdx of children) {
        const cLayouts = layoutByNode.get(cIdx) || [];
        for (const lIdx of cLayouts) {
          const frag = s(doc.layout.text[lIdx]);
          if (frag) text += frag;
        }
      }
      if (!text) {
        for (const lIdx of selfLayouts) {
          const frag = s(doc.layout.text[lIdx]);
          if (frag) text += frag;
        }
      }
      text = text.trim();
      if (text) cuts.push(text);
    }
    return cuts;
  } finally {
    await cdp.detach().catch(() => {});
  }
}

let failures = 0;
export function check(ok, label, detail = '') {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`);
}

export function finish() {
  console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
  process.exitCode = failures ? 1 : 0;
}
