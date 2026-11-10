// Bundles the real React primitives from registry/ui with esbuild (React stays external) so the
// parity tests render them with react-dom/server's renderToStaticMarkup.
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, '../../..');
const RUN_DIR = path.resolve(__dirname, '../.f12-run');

let cached;
export async function loadReactKit() {
  if (cached) return cached;
  fs.mkdirSync(RUN_DIR, { recursive: true });
  const outfile = path.join(RUN_DIR, 'react-kit.mjs');
  const entry = path.join(RUN_DIR, 'react-kit-entry.ts');
  fs.writeFileSync(
    entry,
    [
      'sheet',
      'scene',
      'panel',
      'panel-pair',
      'balloon',
      'tag',
      'badge',
      'metric',
      'tone-bar-list',
      'ghost-wire',
      'receipt',
    ]
      .map((n) => `export * from ${JSON.stringify(path.join(REPO_ROOT, 'registry/ui', `${n}.tsx`))};`)
      .join('\n'),
  );
  await build({
    entryPoints: [entry],
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile,
    jsx: 'automatic',
    external: ['react', 'react-dom', 'react/jsx-runtime'],
    define: { 'process.env.NODE_ENV': '"production"' },
    logLevel: 'silent',
    plugins: [
      {
        name: 'frame12-alias',
        setup(b) {
          b.onResolve({ filter: /^@\/hooks\/(.*)$/ }, (args) => ({
            path: path.join(REPO_ROOT, 'registry/hooks', `${args.path.slice('@/hooks/'.length)}.ts`),
          }));
        },
      },
    ],
  });
  cached = await import(pathToFileURL(outfile).href);
  return cached;
}
