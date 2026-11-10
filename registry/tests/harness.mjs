// Fixture harness for the tempo, no-provider compatibility and flash-safety tests.
//
// Bundles a TSX fixture entry (with React bundled in, either the registry's pinned React 18.3 or
// the root's React 19) into one self-contained HTML document, serves it to Playwright from a fake
// origin, and renders the same entry on the server with `react-dom/server` for SSR snapshots.
// Nothing is fetched from the network.
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { REGISTRY_ROOT, REPO_ROOT } from './lib.mjs';

export { REGISTRY_ROOT, REPO_ROOT };

const REACT_BASES = {
  18: createRequire(resolve(REGISTRY_ROOT, 'package.json')),
  19: createRequire(resolve(REPO_ROOT, 'package.json')),
};

export function reactVersion(major) {
  return REACT_BASES[major]('react/package.json').version;
}

function aliasPlugin(
  major,
  {
    externalReact = false,
    hooksDir = resolve(REGISTRY_ROOT, 'hooks'),
    uiDir = resolve(REGISTRY_ROOT, 'ui'),
    blocksDir = resolve(REGISTRY_ROOT, 'blocks'),
  } = {},
) {
  const req = REACT_BASES[major];
  return {
    name: 'f12-fixture-alias',
    setup(b) {
      b.onResolve({ filter: /^react(-dom)?(\/.*)?$/ }, (args) =>
        externalReact ? { path: args.path, external: true } : { path: req.resolve(args.path) },
      );
      b.onResolve({ filter: /^@\/hooks\/(.*)$/ }, (args) => ({
        path: resolve(hooksDir, `${args.path.replace(/^@\/hooks\//, '')}.ts`),
      }));
      b.onResolve({ filter: /^@\/components\/frame12$/ }, () => ({
        path: resolve(uiDir, 'index.ts'),
      }));
      b.onResolve({ filter: /^@\/components\/frame12\/blocks\/(.*)$/ }, (args) => ({
        path: resolve(
          blocksDir,
          `${args.path.replace(/^@\/components\/frame12\/blocks\//, '')}.tsx`,
        ),
      }));
      b.onResolve({ filter: /^@\/components\/frame12\/(.*)$/ }, (args) => ({
        path: resolve(uiDir, `${args.path.replace(/^@\/components\/frame12\//, '')}.tsx`),
      }));
    },
  };
}

const HOST_RESET =
  ':root{color-scheme:light}body{margin:0;background:var(--f-desk);color:var(--f-ink);font:15px/1.5 var(--font-f-body)}[hidden]{display:none!important}';

/** Bundles `entry` for the browser and returns a complete HTML document. */
export async function bundlePage(
  entry,
  { react = 18, nodeEnv = 'production', head = '', dirs = {}, returnJs = false } = {},
) {
  const res = await build({
    entryPoints: [entry],
    bundle: true,
    format: 'iife',
    write: false,
    jsx: 'automatic',
    target: ['es2020'],
    legalComments: 'none',
    define: { 'process.env.NODE_ENV': JSON.stringify(nodeEnv) },
    plugins: [aliasPlugin(react, dirs)],
    logLevel: 'silent',
  });
  if (returnJs) return res.outputFiles[0].text;
  const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const css = readFileSync(resolve(REGISTRY_ROOT, 'styles/frame12.css'), 'utf8');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>fixture</title>${head}<style>${HOST_RESET}</style><style>${css}</style></head><body><div id="root"></div><script>${js}</script></body></html>`;
}

/** Bundles `entry` for Node (React external) and returns its module exports. */
export async function loadServerModule(entry, { react = 18 } = {}) {
  const req = REACT_BASES[react];
  const res = await build({
    entryPoints: [entry],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false,
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [aliasPlugin(react, { externalReact: true })],
    logLevel: 'silent',
  });
  const mod = { exports: {} };
  new Function('exports', 'require', 'module', res.outputFiles[0].text)(
    mod.exports,
    (id) => req(id),
    mod,
  );
  return { mod: mod.exports, React: req('react'), server: req('react-dom/server') };
}

export const sha = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);

/** Opens `html` in a new context at a fake origin. Returns { ctx, page, errors, warnings }. */
export async function openFixture(
  browser,
  html,
  { w = 1024, h = 768, reduced = 'no-preference', scheme = 'light', clock = true, init } = {},
) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    reducedMotion: reduced,
    colorScheme: scheme,
  });
  const page = await ctx.newPage();
  const errors = [];
  const warnings = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
    if (m.type() === 'warning') warnings.push(m.text());
  });
  await page.route('http://f12.test/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: html }),
  );
  if (init) await page.addInitScript(init);
  if (clock) await page.clock.install({ time: 0 });
  await page.goto('http://f12.test/index.html');
  // The fake clock flows in real time until paused; pause it so every sample is deterministic.
  if (clock) await page.clock.pauseAt(5000);
  return { ctx, page, errors, warnings };
}

/** Advances the fake clock to the 60 Hz sample times in [0, ms], calling `sample(t)` at each. */
export async function sampleAt60Hz(page, ms, sample) {
  let elapsed = 0;
  const out = [];
  for (let i = 0; i * (1000 / 60) <= ms + 0.001; i++) {
    const target = Math.round((i * 1000) / 60);
    if (target > elapsed) {
      await page.clock.runFor(target - elapsed);
      elapsed = target;
    }
    out.push(await sample(target));
  }
  return out;
}
