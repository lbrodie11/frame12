// Builds three self-contained HTML pages from the shared source into dist/.
// React loads from cdnjs at view time; everything else is inlined.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const FONTS =
  'https://fonts.googleapis.com/css2?family=Dela+Gothic+One&family=Zen+Kaku+Gothic+New:wght@400;500;700&family=M+PLUS+1+Code:wght@400;500;700&family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap';
const REACT = 'https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js';
const REACT_DOM = 'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js';

const read = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
const baseCss = read('styles.css') + '\n' + read('shell.css');
mkdirSync('dist', { recursive: true });

async function page(entry, title, out, extraCss = '') {
  const res = await build({
    entryPoints: [`src/${entry}`],
    bundle: true,
    format: 'iife',
    write: false,
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
    target: ['es2019'],
    charset: 'utf8',
    legalComments: 'none',
  });
  const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const html = `<title>${title}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
<style>
${baseCss}
${extraCss}
</style>
<div id="root"></div>
<script src="${REACT}"></script>
<script src="${REACT_DOM}"></script>
<script>
${js}
</script>
`;
  writeFileSync(`dist/${out}`, html);
  console.log(`dist/${out}`, (html.length / 1024).toFixed(1) + ' KB');
}

await page('explorer.jsx', 'FRAME/12 Prototype', 'prototype.html');
await page('study.jsx', 'FRAME/12 Design Study', 'study.html');
await page('specimen.jsx', 'FRAME/12 Style Sheet', 'style-sheet.html', read('specimen.css'));
