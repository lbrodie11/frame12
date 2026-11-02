// Builds registry/dist/gallery.html (standalone HTML5 document rendering all
// FRAME/12 components and adapters) and runs the shadcn registry JSON build.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

const FONTS =
  'https://fonts.googleapis.com/css2?family=Dela+Gothic+One&family=Zen+Kaku+Gothic+New:wght@400;500;700&family=M+PLUS+1+Code:wght@400;500;700&display=swap';
const REACT = 'https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js';
const REACT_DOM = 'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js';
const HOST_RESET =
  ':root{color-scheme:light;padding:env(safe-area-inset-top,0) 0 env(safe-area-inset-bottom,0)}body{margin:0;background:var(--f-desk);color:var(--f-ink);font:15px/1.5 var(--font-f-body)}img{max-width:100%}[hidden]{display:none!important}';

const css = readFileSync(resolve(rootDir, 'styles/frame12.css'), 'utf8');
mkdirSync(resolve(rootDir, 'dist'), { recursive: true });

const reactGlobalPlugin = {
  name: 'react-global-shim',
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
    b.onResolve({ filter: /^@\/hooks\/(.*)$/ }, (args) => {
      const sub = args.path.replace(/^@\/hooks\//, '');
      return { path: resolve(rootDir, 'hooks', `${sub}.ts`) };
    });
    b.onResolve({ filter: /^@\/components\/frame12$/ }, () => ({
      path: resolve(rootDir, 'ui/index.ts'),
    }));
    b.onResolve({ filter: /^@\/components\/frame12\/(.*)$/ }, (args) => {
      const sub = args.path.replace(/^@\/components\/frame12\//, '');
      return { path: resolve(rootDir, 'ui', `${sub}.tsx`) };
    });
    b.onResolve({ filter: /^@\/components\/ui\/(.*)$/ }, (args) => {
      const sub = args.path.replace(/^@\/components\/ui\//, '');
      return { path: resolve(rootDir, 'ui', `${sub}.tsx`) };
    });
  },
};

const res = await build({
  entryPoints: [resolve(rootDir, 'scripts/gallery.tsx')],
  bundle: true,
  format: 'iife',
  write: false,
  jsxFactory: 'React.createElement',
  jsxFragment: 'React.Fragment',
  target: ['es2019'],
  charset: 'utf8',
  legalComments: 'none',
  plugins: [reactGlobalPlugin],
});

const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>FRAME/12 Component Gallery</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
<style>${HOST_RESET}</style>
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

const outFile = resolve(rootDir, 'dist/gallery.html');
writeFileSync(outFile, html);
console.log('registry/dist/gallery.html', (html.length / 1024).toFixed(1) + ' KB');
