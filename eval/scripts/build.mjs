// Builds standalone HTML5 bundles for the three FRAME/12 skill evaluation screens
// (eval/dist/settings.html, eval/dist/landing.html, eval/dist/table.html)
// plus a side-by-side family comparison view (eval/dist/family.html).

import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const evalRoot = resolve(__dirname, '..');
const repoRoot = resolve(evalRoot, '..');
const registryRoot = resolve(repoRoot, 'registry');
const distDir = resolve(evalRoot, 'dist');
mkdirSync(distDir, { recursive: true });

const FONTS =
  'https://fonts.googleapis.com/css2?family=Dela+Gothic+One&family=Zen+Kaku+Gothic+New:wght@400;500;700&family=M+PLUS+1+Code:wght@400;500;700&display=swap';
const REACT = 'https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js';
const REACT_DOM =
  'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js';
const HOST_RESET =
  ':root{color-scheme:light;padding:env(safe-area-inset-top,0) 0 env(safe-area-inset-bottom,0)}body{margin:0;background:var(--f-desk);color:var(--f-ink);font:15px/1.5 var(--font-f-body)}img{max-width:100%}[hidden]{display:none!important}';

const css = readFileSync(resolve(registryRoot, 'styles/frame12.css'), 'utf8');

const f12Plugin = {
  name: 'frame12-eval-resolver',
  setup(b) {
    b.onResolve({ filter: /^react$/ }, () => ({ path: 'react', namespace: 'react-global' }));
    b.onLoad({ filter: /.*/, namespace: 'react-global' }, () => ({
      contents: 'module.exports = window.React;',
      loader: 'js',
    }));
    b.onResolve({ filter: /^react-dom$/ }, () => ({
      path: 'react-dom',
      namespace: 'react-dom-global',
    }));
    b.onLoad({ filter: /.*/, namespace: 'react-dom-global' }, () => ({
      contents: 'module.exports = window.ReactDOM;',
      loader: 'js',
    }));
    b.onResolve({ filter: /^react\/jsx-runtime$/ }, () => ({
      path: 'react/jsx-runtime',
      namespace: 'react-jsx-runtime-global',
    }));
    b.onLoad({ filter: /.*/, namespace: 'react-jsx-runtime-global' }, () => ({
      contents: `
        const React = window.React;
        function jsx(type, config, maybeKey) {
          if (maybeKey !== undefined) {
            return React.createElement(type, Object.assign({}, config, { key: '' + maybeKey }));
          }
          return React.createElement(type, config);
        }
        module.exports = { jsx, jsxs: jsx, Fragment: React.Fragment };
      `,
      loader: 'js',
    }));
    b.onResolve({ filter: /^@\/components\/frame12$/ }, () => ({
      path: resolve(registryRoot, 'ui/index.ts'),
    }));
    b.onResolve({ filter: /^@\/components\/frame12\/(.*)$/ }, (args) => {
      const sub = args.path.replace(/^@\/components\/frame12\//, '');
      return { path: resolve(registryRoot, 'ui', `${sub}.tsx`) };
    });
    b.onResolve({ filter: /^@\/hooks\/(.*)$/ }, (args) => {
      const sub = args.path.replace(/^@\/hooks\//, '');
      return { path: resolve(registryRoot, 'hooks', `${sub}.ts`) };
    });
    b.onResolve({ filter: /^@\/components\/ui\/(.*)$/ }, (args) => {
      const sub = args.path.replace(/^@\/components\/ui\//, '');
      return { path: resolve(registryRoot, 'ui', `${sub}.tsx`) };
    });
  },
};

async function bundleEntry(stdinSource, title, outName, extraCss = '') {
  const res = await build({
    stdin: {
      contents: stdinSource,
      resolveDir: evalRoot,
      sourcefile: `${outName}-entry.tsx`,
      loader: 'tsx',
    },
    bundle: true,
    format: 'iife',
    write: false,
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
    target: ['es2019'],
    charset: 'utf8',
    legalComments: 'none',
    plugins: [f12Plugin],
  });

  const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
<style>${HOST_RESET}${extraCss}</style>
<style>
${css}
</style>
</head>
<body>
<div id="root"></div>
<script src="${REACT}"></script>
<script src="${REACT_DOM}"></script>
<script>
${js}
</script>
</body>
</html>
`;
  const outPath = resolve(distDir, `${outName}.html`);
  writeFileSync(outPath, html);
  console.log(`eval/dist/${outName}.html`, (html.length / 1024).toFixed(1) + ' KB');
}

await bundleEntry(
  `
  import * as React from 'react';
  import { SettingsScreen } from './screens/settings-screen';
  const rootEl = document.getElementById('root');
  if (rootEl) {
    (window as any).ReactDOM.createRoot(rootEl).render(<SettingsScreen />);
  }
  `,
  'FRAME/12 Eval 01 · Workspace & Dispatch Settings',
  'settings',
);

await bundleEntry(
  `
  import * as React from 'react';
  import { LandingScreen } from './screens/landing-screen';
  const rootEl = document.getElementById('root');
  if (rootEl) {
    (window as any).ReactDOM.createRoot(rootEl).render(<LandingScreen />);
  }
  `,
  'FRAME/12 Eval 02 · Product Landing Hero',
  'landing',
);

await bundleEntry(
  `
  import * as React from 'react';
  import { TableScreen } from './screens/table-screen';
  const rootEl = document.getElementById('root');
  if (rootEl) {
    (window as any).ReactDOM.createRoot(rootEl).render(<TableScreen />);
  }
  `,
  'FRAME/12 Eval 03 · Order Recovery Ledger',
  'table',
);

await bundleEntry(
  `
  import * as React from 'react';
  import { SettingsScreen } from './screens/settings-screen';
  import { LandingScreen } from './screens/landing-screen';
  import { TableScreen } from './screens/table-screen';

  function FamilyOverview() {
    return (
      <div className="family-grid">
        <div className="family-col">
          <p className="family-tag">01 · SaaS Settings Sheet</p>
          <SettingsScreen />
        </div>
        <div className="family-col">
          <p className="family-tag">02 · Product Landing Hero</p>
          <LandingScreen />
        </div>
        <div className="family-col">
          <p className="family-tag">03 · Order Recovery Ledger</p>
          <TableScreen />
        </div>
      </div>
    );
  }

  const rootEl = document.getElementById('root');
  if (rootEl) {
    (window as any).ReactDOM.createRoot(rootEl).render(<FamilyOverview />);
  }
  `,
  'FRAME/12 Eval · Visual Family Overview',
  'family',
  '.family-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px;padding:20px;background:var(--f-desk)}.family-col{min-width:0;display:flex;flex-direction:column;gap:12px}.family-tag{margin:0;padding:4px 10px;width:max-content;font:700 11px/1.4 var(--font-f-mono);letter-spacing:0.12em;text-transform:uppercase;background:var(--f-marker);color:var(--f-marker-ink);border:2px solid var(--f-rule)}',
);
