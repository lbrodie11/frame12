// Shared Playwright harness for @frame12/registry tests.
import { chromium, firefox, webkit } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
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

export const outPath = (name) => resolve(OUT, name);

export const ENGINES = { chromium, firefox, webkit };

export async function launch(browserName = process.env.BROWSER || 'chromium') {
  const engine = ENGINES[browserName] || chromium;
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

let failures = 0;
export function check(ok, label, detail = '') {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`);
}

export function finish() {
  console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
  process.exitCode = failures ? 1 : 0;
}
