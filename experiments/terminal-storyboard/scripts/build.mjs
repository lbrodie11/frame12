import { build } from 'esbuild';
import { chmodSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const expRoot = resolve(__dirname, '..');
const repoRoot = resolve(expRoot, '../..');
const distDir = resolve(expRoot, 'dist');

rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });

const frame12AliasPlugin = {
  name: 'frame12-alias',
  setup(b) {
    b.onResolve({ filter: /^@\/hooks\/(.*)$/ }, (args) => {
      const sub = args.path.replace(/^@\/hooks\//, '');
      return { path: resolve(repoRoot, 'registry/hooks', `${sub}.ts`) };
    });
    b.onResolve({ filter: /^@\/components\/frame12$/ }, () => ({
      path: resolve(repoRoot, 'registry/ui/index.ts'),
    }));
    b.onResolve({ filter: /^@\/components\/frame12\/(.*)$/ }, (args) => {
      const sub = args.path.replace(/^@\/components\/frame12\//, '');
      return { path: resolve(repoRoot, 'registry/ui', `${sub}.tsx`) };
    });
    b.onResolve({ filter: /^@\/components\/ui\/(.*)$/ }, (args) => {
      const sub = args.path.replace(/^@\/components\/ui\//, '');
      return { path: resolve(repoRoot, 'registry/ui', `${sub}.tsx`) };
    });
    b.onResolve({ filter: /^\.\.\/src\/cli\.js$/ }, () => ({
      path: '../cli.js',
      external: true,
    }));
  },
};

// 1. Build React-free core, model, workload, plain renderer, fixture helper, and CLI
await build({
  entryPoints: {
    'model/index': resolve(expRoot, 'src/model/index.ts'),
    'core/types': resolve(expRoot, 'src/core/types.ts'),
    'core/events': resolve(expRoot, 'src/core/events.ts'),
    'core/validate': resolve(expRoot, 'src/core/validate.ts'),
    'core/state': resolve(expRoot, 'src/core/state.ts'),
    'workload/git-history': resolve(expRoot, 'src/workload/git-history.ts'),
    'workload/repo-archaeology-adapter': resolve(expRoot, 'src/workload/repo-archaeology-adapter.ts'),
    'workflows/git-history': resolve(expRoot, 'src/workflows/git-history.ts'),
    'render-plain/index': resolve(expRoot, 'src/render-plain/index.ts'),
    'renderers/plain': resolve(expRoot, 'src/renderers/plain.ts'),
    'fixtures/create-fixture-repo': resolve(expRoot, 'fixtures/create-fixture-repo.ts'),
    cli: resolve(expRoot, 'src/cli.ts'),
    'bin/storyboard': resolve(expRoot, 'bin/storyboard.ts'),
  },
  outdir: distDir,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: ['node20'],
  sourcemap: false,
  plugins: [frame12AliasPlugin],
  external: ['react', 'react-dom', 'react-dom/server', '../render-web/index.js', './render-web/index.js'],
});

// 2. Build Web HTML renderer entry point (bundles registry/ui components, keeps react & react-dom/server external)
await build({
  entryPoints: {
    'render-web/index': resolve(expRoot, 'src/render-web/index.tsx'),
    'renderers/web': resolve(expRoot, 'src/renderers/web.tsx'),
  },
  outdir: distDir,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: ['node20'],
  jsx: 'automatic',
  sourcemap: false,
  plugins: [frame12AliasPlugin],
  external: ['react', 'react-dom', 'react-dom/server', 'react/jsx-runtime', '@radix-ui/*'],
});

chmodSync(resolve(distDir, 'bin/storyboard.js'), 0o755);
console.log('Built experiments/terminal-storyboard/dist successfully.');
