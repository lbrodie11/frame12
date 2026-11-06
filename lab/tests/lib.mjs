// Shared Playwright harness. Opens the standalone built pages from disk.
//
// Offline mode (no CDN access): set F12_REACT_UMD to a JS file that defines
// window.React and window.ReactDOM; requests to cdnjs are answered from it and
// font requests are dropped. CHROME_PATH picks a specific browser binary.
import { chromium } from 'playwright';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RUN = resolve('.f12-run');
const OUT = resolve('test-results');
mkdirSync(RUN, { recursive: true });
mkdirSync(OUT, { recursive: true });

const shim = process.env.F12_REACT_UMD ? readFileSync(process.env.F12_REACT_UMD, 'utf8') : null;
// Without a shim, answer the cdnjs React 18.3.1 UMD requests from this workspace's pinned
// `react`/`react-dom` devDependencies so tests don't depend on CDN availability.
const LAB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workspaceRequire = createRequire(resolve(LAB_ROOT, 'package.json'));
const readUmd = (pkg, file) => {
  try {
    const p = resolve(dirname(workspaceRequire.resolve(`${pkg}/package.json`)), 'umd', file);
    return existsSync(p) ? readFileSync(p, 'utf8') : null;
  } catch {
    return null;
  }
};
const localReactUmd = readUmd('react', 'react.production.min.js');
const localReactDomUmd = readUmd('react-dom', 'react-dom.production.min.js');

export const outPath = (name) => resolve(OUT, name);

export async function launch() {
  return chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] });
}

export async function openPage(browser, file, { w = 1280, h = 900, scheme = 'light', reduced = 'no-preference', css = '' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, reducedMotion: reduced });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(`console: ${m.text()}`); });
  if (shim) {
    await page.route('**/*', (route) => {
      const u = route.request().url();
      if (u.startsWith('file://')) return route.continue();
      if (u.includes('cdnjs') && u.includes('react-dom')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
      if (u.includes('cdnjs') && u.includes('/react/')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: shim });
      return route.abort();
    });
  } else if (localReactUmd && localReactDomUmd) {
    await page.route('**/*cdnjs.cloudflare.com/**', (route) => {
      const u = route.request().url();
      if (u.includes('react-dom')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: localReactDomUmd });
      if (u.includes('/react/')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: localReactUmd });
      return route.continue();
    });
  }
  const standalonePath = resolve('dist/standalone', file);
  let targetPath = standalonePath;
  if (css) {
    const html = readFileSync(standalonePath, 'utf8');
    const custom = resolve(RUN, `${scheme}-${w}-${file}`);
    writeFileSync(custom, html.replace('</head>', `<style>${css}</style></head>`));
    targetPath = custom;
  }
  await page.goto(pathToFileURL(targetPath).href);
  await page.waitForSelector('#root > *', { timeout: 15000 });
  await page.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve()));
  await page.waitForTimeout(400);
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
