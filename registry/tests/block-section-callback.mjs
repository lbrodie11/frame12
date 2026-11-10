// `onSectionChange` contract for the tabbed blocks (DeveloperConsole, WorkspaceSettings), checked
// on React 18.3 (this workspace's pinned devDependency) and React 19 (the repo root):
//   1. fires exactly once per section change with the new value, never on mount, also under
//      <StrictMode> (which replays effects);
//   2. re-selecting the active tab does not fire;
//   3. without a callback, the React 18 server-rendered markup is byte-identical to the pre-change
//      block (SHA-256 snapshot of DeveloperConsole and WorkspaceSettings HTML at commit d168c47), and
//      passing a callback does not change markup either.
//
// To refresh the snapshot after an intentional markup change, run with F12_UPDATE_SNAPSHOT=1 and
// commit the printed hashes.
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { launch, REGISTRY_ROOT, REPO_ROOT, check, finish } from './lib.mjs';

// The markup snapshot runs on React 18.3, the registry's pinned test runtime (React 18 and 19
// serialize differently, e.g. useId). React 19 is covered by the client behavior checks below and
// by the site's Next.js SSR tests.
const SNAPSHOT = {
  'react@18': {
    'developer-console': 'c81fb12c31b73067c98f8914481e50a477b0e3dcec7eae3bdf472804e1fb7ec1',
    'workspace-settings': '32241ece6dae5b6daaf5124f0d4d7aadfa3ddfdb00181db9e07dbd95328f5ad2',
  },
};
const UPDATE = Boolean(process.env.F12_UPDATE_SNAPSHOT);

const RUN_DIR = resolve(REGISTRY_ROOT, '.f12-run');
mkdirSync(RUN_DIR, { recursive: true });

const REACT_ROOTS = {
  'react@18': REGISTRY_ROOT,
  'react@19': REPO_ROOT,
};

function aliasPlugin(reactRoot, { externalReact = false } = {}) {
  const req = createRequire(resolve(reactRoot, 'package.json'));
  return {
    name: 'f12-block-alias',
    setup(b) {
      // Server bundles load React from its own (absolute) CJS entry so exactly one copy runs.
      b.onResolve({ filter: /^react(-dom)?(\/.*)?$/ }, (args) => ({
        path: req.resolve(args.path),
        external: externalReact,
      }));
      b.onResolve({ filter: /^@\/hooks\/(.*)$/ }, (args) => ({
        path: resolve(REGISTRY_ROOT, 'hooks', `${args.path.replace(/^@\/hooks\//, '')}.ts`),
      }));
      b.onResolve({ filter: /^@\/components\/frame12$/ }, () => ({
        path: resolve(REGISTRY_ROOT, 'ui/index.ts'),
      }));
      b.onResolve({ filter: /^@\/components\/frame12\/(.*)$/ }, (args) => ({
        path: resolve(REGISTRY_ROOT, 'ui', `${args.path.replace(/^@\/components\/frame12\//, '')}.tsx`),
      }));
    },
  };
}

const BROWSER_ENTRY = `
import * as React from 'react';
import * as ReactDOMClient from 'react-dom/client';
import { DeveloperConsole } from '${resolve(REGISTRY_ROOT, 'blocks/developer-console.tsx')}';
import { WorkspaceSettings } from '${resolve(REGISTRY_ROOT, 'blocks/workspace-settings.tsx')}';
window.__calls = { console: [], settings: [] };
const App = () =>
  React.createElement(React.StrictMode, null,
    React.createElement(DeveloperConsole, {
      idPrefix: 'cb-console',
      showSandboxControls: false,
      defaultSection: 'overview',
      onSectionChange: (s) => window.__calls.console.push(s),
    }),
    React.createElement(WorkspaceSettings, {
      idPrefix: 'cb-settings',
      showSandboxControls: false,
      onSectionChange: (s) => window.__calls.settings.push(s),
    }),
    React.createElement(DeveloperConsole, { idPrefix: 'cb-plain', showSandboxControls: false }),
  );
ReactDOMClient.createRoot(document.getElementById('root')).render(React.createElement(App));
window.__reactVersion = React.version;
`;

const SERVER_ENTRY = `
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { DeveloperConsole } from '${resolve(REGISTRY_ROOT, 'blocks/developer-console.tsx')}';
import { WorkspaceSettings } from '${resolve(REGISTRY_ROOT, 'blocks/workspace-settings.tsx')}';
export const version = React.version;
export function render(name, withCallback) {
  const extra = withCallback ? { onSectionChange: () => {} } : {};
  const el = name === 'developer-console'
    ? React.createElement(DeveloperConsole, { idPrefix: 'snap', ...extra })
    : React.createElement(WorkspaceSettings, { idPrefix: 'snap', ...extra });
  return renderToString(el);
}
`;

const sha = (s) => createHash('sha256').update(s).digest('hex');

for (const [label, reactRoot] of Object.entries(REACT_ROOTS)) {
  // --- SSR markup snapshot -------------------------------------------------------------------
  if (SNAPSHOT[label]) {
  const serverOut = resolve(RUN_DIR, `block-callback-server-${label.replace('@', '')}.mjs`);
  await build({
    stdin: { contents: SERVER_ENTRY, loader: 'tsx', resolveDir: REGISTRY_ROOT },
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: serverOut,
    jsx: 'automatic',
    logLevel: 'error',
    plugins: [aliasPlugin(reactRoot, { externalReact: true })],
    banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  });
  const server = await import(`${pathToFileURL(serverOut).href}?v=${Date.now()}`);
  for (const name of Object.keys(SNAPSHOT[label])) {
    const plain = server.render(name, false);
    const withCb = server.render(name, true);
    const hash = sha(plain);
    if (UPDATE) console.log(`snapshot ${label} ${name}: ${hash}`);
    check(
      plain === withCb,
      `${label} ${name}: onSectionChange does not change server markup`,
    );
    check(
      hash === SNAPSHOT[label][name],
      `${label} ${name}: markup without onSectionChange is byte-identical to the pre-change snapshot`,
      hash === SNAPSHOT[label][name] ? '' : `got ${hash}`,
    );
  }
  }

  if (UPDATE) continue;

  // --- Client behavior -----------------------------------------------------------------------
  const res = await build({
    stdin: { contents: BROWSER_ENTRY, loader: 'tsx', resolveDir: REGISTRY_ROOT },
    bundle: true,
    format: 'iife',
    write: false,
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
    logLevel: 'error',
    plugins: [aliasPlugin(reactRoot)],
  });
  const js = res.outputFiles[0].text;
  const htmlPath = resolve(RUN_DIR, `block-callback-${label.replace('@', '')}.html`);
  const cssHref = pathToFileURL(resolve(REGISTRY_ROOT, 'styles/frame12.css')).href;
  writeFileSync(
    htmlPath,
    `<!doctype html><html><head><link rel="stylesheet" href="${cssHref}"></head><body><div id="root"></div><script>${js}</script></body></html>`,
  );

  const browser = await launch('chromium');
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
      reducedMotion: 'reduce',
    });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(pathToFileURL(htmlPath).href);
    await page.waitForSelector('#cb-console-tab-services');
    const version = await page.evaluate(() => window.__reactVersion);
    const mountCalls = await page.evaluate(() => JSON.stringify(window.__calls));
    check(
      mountCalls === '{"console":[],"settings":[]}',
      `${label} (${version}) onSectionChange is not called on mount (StrictMode)`,
      mountCalls,
    );

    await page.click('#cb-console-tab-services');
    await page.click('#cb-console-tab-request-logs');
    await page.click('#cb-console-tab-request-logs'); // re-selecting the active tab: no call
    await page.click('#cb-console-tab-overview');
    await page.click('#cb-settings-tabs-tab-team');
    await page.click('#cb-settings-tabs-tab-team');
    await page.click('#cb-plain-tab-api-keys');
    await page.waitForTimeout(100);
    const calls = await page.evaluate(() => window.__calls);
    check(
      JSON.stringify(calls.console) === '["services","request-logs","overview"]',
      `${label} DeveloperConsole onSectionChange fires once per change with the new value`,
      JSON.stringify(calls.console),
    );
    check(
      JSON.stringify(calls.settings) === '["team"]',
      `${label} WorkspaceSettings onSectionChange fires once per change with the new value`,
      JSON.stringify(calls.settings),
    );
    const plainSelected = await page.getAttribute('#cb-plain-tab-api-keys', 'aria-selected');
    check(
      plainSelected === 'true' && errors.length === 0,
      `${label} DeveloperConsole without onSectionChange switches tabs with no errors`,
      errors.join('; '),
    );
  } finally {
    await browser.close();
  }
}

finish();
