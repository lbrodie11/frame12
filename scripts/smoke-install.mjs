#!/usr/bin/env node
// End-to-end smoke test for `npx shadcn add <origin>/r/frame12.json`:
//   1. Serves `site/public/r/` over a local HTTP server.
//   2. Scaffolds a temporary TypeScript project containing pre-existing sentinel
//      `src/components/ui/button.tsx` and `src/components/ui/dialog.tsx` files.
//   3. Runs `npx --yes shadcn add http://127.0.0.1:<port>/r/frame12.json --yes --overwrite`.
//   4. Asserts that `src/components/frame12/*.tsx`, `src/hooks/use-on-twos.ts`, and
//      `src/styles/frame12.css` are installed at their explicit target paths.
//   5. Asserts that pre-existing `src/components/ui/button.tsx` and `src/components/ui/dialog.tsx`
//      are 100% untouched (no collisions with stock shadcn/ui primitives).
//   6. Compiles a consumer TSX file importing both `@/components/frame12` and `@/components/ui/button`
//      with `tsc --noEmit`, then runs the installed components on the repo's React 19 runtime.
//   7. Installs the full kit + 3 blocks into an isolated React 18 + Vite consumer (real npm install)
//      and verifies tsc, SSR, vite build, and hydration/interaction in Chromium on React 18.3.1.

import http from 'node:http';
import { chromium } from 'playwright';
import { getRenderedCuts } from '../registry/tests/lib.mjs';
import { runStandalonePackageSmokeTest } from './check-packages.mjs';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  symlinkSync,
  chmodSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const REGISTRY_PUBLIC_DIR = resolve(REPO_ROOT, 'site/public/r');

let failures = 0;
function check(ok, label, detail = '') {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`);
}

if (process.argv.includes('--packages-only')) {
  try {
    const pkgRes = runStandalonePackageSmokeTest(REPO_ROOT, { silent: true });
    check(
      pkgRes.verified.length >= 1,
      `Standalone npm package tarball install (${pkgRes.verified.join(', ')}): npm pack -> zero-dep consumer install -> verified exports`,
      JSON.stringify(pkgRes.results),
    );
  } catch (err) {
    check(false, 'Standalone npm package tarball install', err.message);
  }
  console.log(
    failures ? `\n${failures} smoke check(s) failed` : '\nAll standalone package smoke-install checks passed',
  );
  process.exit(failures ? 1 : 0);
}

const CANONICAL_REGISTRY_PATH = resolve(REPO_ROOT, 'registry/registry.json');
const CANONICAL_REGISTRY_RAW = readFileSync(CANONICAL_REGISTRY_PATH, 'utf8');
const CANONICAL_ITEMS_BY_NAME = new Map(
  (JSON.parse(CANONICAL_REGISTRY_RAW).items || []).map((item) => [item.name, item]),
);

function rewriteCanonicalValue(value, registryBaseUrl) {
  if (typeof value === 'string') {
    return value.replaceAll('https://frame12.dev/r/', `${registryBaseUrl}/`);
  }
  if (Array.isArray(value)) {
    return value.map((item) => rewriteCanonicalValue(item, registryBaseUrl));
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = rewriteCanonicalValue(v, registryBaseUrl);
    }
    return out;
  }
  return value;
}

function startRegistryServer() {
  return new Promise((resolveServer, rejectServer) => {
    const server = http.createServer((req, res) => {
      const urlPath = (req.url || '/').split('?')[0];
      if (!urlPath.startsWith('/r/')) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const fileName = urlPath.slice('/r/'.length);
      const filePath = resolve(REGISTRY_PUBLIC_DIR, fileName);
      if (!filePath.startsWith(REGISTRY_PUBLIC_DIR) || !existsSync(filePath)) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const hostOrigin = `http://${req.headers.host || '127.0.0.1'}`;
      const registryBaseUrl = `${hostOrigin}/r`;
      let body;
      if (fileName === 'registry.json') {
        body = CANONICAL_REGISTRY_RAW.replaceAll('https://frame12.dev/r/', `${registryBaseUrl}/`);
      } else {
        const parsed = JSON.parse(readFileSync(filePath, 'utf8'));
        const canonicalItem = CANONICAL_ITEMS_BY_NAME.get(parsed.name);
        if (canonicalItem?.registryDependencies) {
          parsed.registryDependencies = rewriteCanonicalValue(
            canonicalItem.registryDependencies,
            registryBaseUrl,
          );
        }
        if (canonicalItem?.config) {
          parsed.config = rewriteCanonicalValue(canonicalItem.config, registryBaseUrl);
        }
        body = JSON.stringify(parsed, null, 2);
      }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(body);
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolveServer({ server, port });
    });
    server.on('error', rejectServer);
  });
}

function runAsync(cmd, args, options) {
  return new Promise((resolveProc, rejectProc) => {
    const child = spawn(cmd, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', rejectProc);
    child.on('close', (status) => {
      resolveProc({ status: status ?? 1, stdout, stderr });
    });
  });
}

const { server, port } = await startRegistryServer();
// Real Next.js apps get `declare module '*.css'` from next-env.d.ts (and Vite apps from
// vite/client). These synthetic consumers strip ambient types, so declare it the same way: from
// TypeScript 6 on, `noUncheckedSideEffectImports` rejects `import '@/styles/frame12.css'` without it.
const CSS_MODULE_DECL = "// Mirrors the CSS module declaration Next.js and Vite provide.\ndeclare module '*.css';\n";

const tempDir = mkdtempSync(join(tmpdir(), 'frame12-smoke-'));

try {
  // 1. Scaffold minimal Next.js + TypeScript project with sentinel shadcn/ui files
  mkdirSync(join(tempDir, 'src/components/ui'), { recursive: true });
  mkdirSync(join(tempDir, 'src/app'), { recursive: true });
  mkdirSync(join(tempDir, '.shim-bin'), { recursive: true });

  const SENTINEL_BUTTON = `// Sentinel stock shadcn/ui Button — must not be overwritten by FRAME/12\nexport const SENTINEL_SHADCN_BUTTON = 'untouched-button' as const;\n`;
  const SENTINEL_DIALOG = `// Sentinel stock shadcn/ui Dialog — must not be overwritten by FRAME/12\nexport const SENTINEL_SHADCN_DIALOG = 'untouched-dialog' as const;\n`;

  writeFileSync(join(tempDir, 'src/components/ui/button.tsx'), SENTINEL_BUTTON);
  writeFileSync(join(tempDir, 'src/components/ui/dialog.tsx'), SENTINEL_DIALOG);
  writeFileSync(join(tempDir, 'src/app/globals.css'), '/* host globals */\n');
  writeFileSync(join(tempDir, 'src/global.d.ts'), CSS_MODULE_DECL);

  // Create a fast npm shim so `shadcn add` records requested npm packages without hitting the network,
  // after which we symlink the workspace node_modules for real TypeScript compilation.
  const npmShimPath = join(tempDir, '.shim-bin/npm');
  writeFileSync(
    npmShimPath,
    `#!/bin/sh\necho "$@" >> "${join(tempDir, '.npm-args.log')}"\nexit 0\n`,
  );
  chmodSync(npmShimPath, 0o755);

  writeFileSync(
    join(tempDir, 'package.json'),
    JSON.stringify(
      {
        name: 'frame12-smoke-consumer',
        private: true,
        version: '0.0.0',
        dependencies: {
          next: '^15.2.0',
          react: '^19.0.0',
          'react-dom': '^19.0.0',
        },
        devDependencies: {
          '@types/node': '^22.13.0',
          '@types/react': '^19.0.0',
          '@types/react-dom': '^19.0.0',
          typescript: '^6.0.3',
        },
      },
      null,
      2,
    ),
  );
  writeFileSync(join(tempDir, 'package-lock.json'), JSON.stringify({ lockfileVersion: 3 }, null, 2));

  writeFileSync(
    join(tempDir, 'tsconfig.json'),
    JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          lib: ['dom', 'dom.iterable', 'esnext'],
          allowJs: false,
          skipLibCheck: true,
          strict: true,
          noEmit: true,
          esModuleInterop: true,
          module: 'esnext',
          moduleResolution: 'bundler',
          resolveJsonModule: true,
          isolatedModules: true,
          jsx: 'react-jsx',
          paths: {
            '@/*': ['./src/*'],
          },
        },
        include: ['src/**/*.ts', 'src/**/*.tsx'],
      },
      null,
      2,
    ),
  );

  writeFileSync(
    join(tempDir, 'components.json'),
    JSON.stringify(
      {
        $schema: 'https://ui.shadcn.com/schema.json',
        style: 'base-nova',
        rsc: true,
        tsx: true,
        tailwind: {
          config: '',
          css: 'src/app/globals.css',
          baseColor: 'neutral',
          cssVariables: true,
          prefix: '',
        },
        aliases: {
          components: '@/components',
          utils: '@/lib/utils',
          ui: '@/components/ui',
          lib: '@/lib',
          hooks: '@/hooks',
        },
      },
      null,
      2,
    ),
  );

  // 2. Run `npx --yes shadcn add http://127.0.0.1:<port>/r/frame12.json --yes --overwrite` asynchronously
  // so our in-process HTTP server can serve `/r/frame12.json`.
  const registryUrl = `http://127.0.0.1:${port}/r/frame12.json`;
  const addRes = await runAsync(
    'npx',
    ['--yes', 'shadcn', 'add', registryUrl, '--yes', '--overwrite'],
    {
      cwd: tempDir,
      env: {
        ...process.env,
        CI: 'true',
        PATH: `${join(tempDir, '.shim-bin')}:${process.env.PATH || ''}`,
      },
    },
  );

  check(
    addRes.status === 0,
    `npx shadcn add ${registryUrl} exits with code 0`,
    addRes.status !== 0 ? `${addRes.stdout}\n${addRes.stderr}` : '',
  );

  // 3. Assert target files were created under src/components/frame12, src/hooks, and src/styles
  const expectedFiles = [
    'src/components/frame12/index.ts',
    'src/components/frame12/sheet.tsx',
    'src/components/frame12/scene.tsx',
    'src/components/frame12/panel.tsx',
    'src/components/frame12/panel-pair.tsx',
    'src/components/frame12/segmented-control.tsx',
    'src/components/frame12/button.tsx',
    'src/components/frame12/field.tsx',
    'src/components/frame12/input.tsx',
    'src/components/frame12/textarea.tsx',
    'src/components/frame12/checkbox.tsx',
    'src/components/frame12/radio-group.tsx',
    'src/components/frame12/switch.tsx',
    'src/components/frame12/tabs.tsx',
    'src/components/frame12/badge.tsx',
    'src/components/frame12/tag.tsx',
    'src/components/frame12/alert.tsx',
    'src/components/frame12/toast.tsx',
    'src/components/frame12/skeleton.tsx',
    'src/components/frame12/empty-state.tsx',
    'src/components/frame12/breadcrumb.tsx',
    'src/components/frame12/pagination.tsx',
    'src/components/frame12/metric.tsx',
    'src/components/frame12/balloon.tsx',
    'src/components/frame12/tone-area-chart.tsx',
    'src/components/frame12/tone-bar-list.tsx',
    'src/components/frame12/tone-spark.tsx',
    'src/components/frame12/dialog.tsx',
    'src/components/frame12/select.tsx',
    'src/components/frame12/tooltip.tsx',
    'src/components/frame12/dropdown-menu.tsx',
    'src/components/frame12/table.tsx',
    'src/hooks/use-on-twos.ts',
    'src/styles/frame12.css',
  ];
  const missingFiles = expectedFiles.filter((rel) => !existsSync(join(tempDir, rel)));
  check(
    missingFiles.length === 0,
    `shadcn add installed all ${expectedFiles.length} files to src/components/frame12, src/hooks, and src/styles`,
    missingFiles.join(', '),
  );

  // 3b. Assert shadcn's base-nova style codemod did not rewrite Radix triggers to Base UI `render={` prop
  const installedDropdownMenu = readFileSync(
    join(tempDir, 'src/components/frame12/dropdown-menu.tsx'),
    'utf8',
  );
  check(
    !installedDropdownMenu.includes('render={'),
    'dropdown-menu.tsx is free of Base UI render={} rewrites under shadcn base-nova style',
  );

  // 4. Assert sentinel src/components/ui/button.tsx and src/components/ui/dialog.tsx are untouched
  const afterButton = readFileSync(join(tempDir, 'src/components/ui/button.tsx'), 'utf8');
  const afterDialog = readFileSync(join(tempDir, 'src/components/ui/dialog.tsx'), 'utf8');
  check(
    afterButton === SENTINEL_BUTTON && afterDialog === SENTINEL_DIALOG,
    'shadcn add preserved existing src/components/ui/button.tsx and src/components/ui/dialog.tsx without collision',
  );

  // 5. Symlink node_modules, write a consumer component, and run `tsc --noEmit`
  symlinkSync(resolve(REPO_ROOT, 'node_modules'), join(tempDir, 'node_modules'), 'dir');

  writeFileSync(
    join(tempDir, 'src/app/consumer-check.tsx'),
    `import * as React from 'react';
import '@/styles/frame12.css';
import { SENTINEL_SHADCN_BUTTON } from '@/components/ui/button';
import { SENTINEL_SHADCN_DIALOG } from '@/components/ui/dialog';
import { useOnTwos, useReducedMotion, useCountUp } from '@/hooks/use-on-twos';
import {
  Sheet,
  Scene,
  Panel,
  PanelPair,
  Button,
  Field,
  Input,
  Textarea,
  Checkbox,
  RadioGroup,
  RadioGroupItem,
  Switch,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Badge,
  Tag,
  Alert,
  Notice,
  ToastProvider,
  Skeleton,
  SkeletonText,
  EmptyState,
  Breadcrumb,
  Pagination,
  Metric,
  Balloon,
  ToneAreaChart,
  ToneBarList,
  ToneSpark,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/frame12';

export function ConsumerSmokeTest() {
  const reduced = useReducedMotion();
  const progress = useOnTwos('k', 250, reduced ? 'cut' : 'stepped');
  const counted = useCountUp(42, 'stepped');
  return (
    <Sheet data-sentinel={\`\${SENTINEL_SHADCN_BUTTON}-\${SENTINEL_SHADCN_DIALOG}-\${progress}-\${counted}\`}>
      <Scene layout="split" gutter="scene">
        <Panel cut="C-01" label="Primary">
          <Metric label="Revenue" value={1200} headingLevel="h2" />
          <ToneAreaChart data={[{ label: 'D1', value: 100 }]} />
          <ToneBarList title="Channels" items={[{ id: 'a', name: 'Email', value: 100, formattedValue: '$100', share: 1 }]} />
          <ToneSpark values={[10, 20]} label="Spark" />
          <Balloon>Peak</Balloon>
          <Badge>New</Badge>
          <Tag>Note</Tag>
          <Notice status="info" title="Notice">Ready</Notice>
          <Alert status="warning" live="off" title="Warn">Check</Alert>
          <ToastProvider maxVisible={3}>
            <Skeleton variant="line" />
            <SkeletonText lines={2} />
            <EmptyState code="0 ROWS" title="Empty" description="No rows" />
            <Breadcrumb items={[{ label: 'Home', href: '#home' }, { label: 'Page', current: true }]} />
            <Pagination page={1} totalPages={3} showSummary />
          </ToastProvider>
          <Field label="Operator Name" hint="Public handle">
            <Input />
          </Field>
          <Field label="Runbook Notes">
            <Textarea rows={2} />
          </Field>
          <Checkbox label="Immutable audit log" defaultChecked />
          <RadioGroup label="Signing Mode" defaultValue="hmac">
            <RadioGroupItem value="hmac" label="HMAC-SHA256" />
            <RadioGroupItem value="ed25519" label="Ed25519" />
          </RadioGroup>
          <Switch label="Enforce TLS" defaultChecked onLabel="ON" offLabel="OFF" />
          <Tabs defaultValue="policy">
            <TabsList aria-label="Tabs">
              <TabsTrigger value="policy">Policy</TabsTrigger>
              <TabsTrigger value="audit">Audit</TabsTrigger>
            </TabsList>
            <TabsContent value="policy">Policy body</TabsContent>
            <TabsContent value="audit">Audit body</TabsContent>
          </Tabs>
          <Button variant="primary">Save</Button>
          <Select label="Mode" defaultValue="a">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="a">Alpha</SelectItem></SelectContent>
          </Select>
          <Dialog>
            <DialogTrigger asChild><Button>Open</Button></DialogTrigger>
            <DialogContent cut="C-03"><DialogTitle>Modal</DialogTitle></DialogContent>
          </Dialog>
          <DropdownMenu>
            <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
            <DropdownMenuContent><DropdownMenuItem>Run</DropdownMenuItem></DropdownMenuContent>
          </DropdownMenu>
        </Panel>
        <PanelPair
          top={{ cut: 'C-02', label: 'Top', children: <div>Top</div> }}
          bottom={{ cut: 'C-03', label: 'Bottom', children: <div>Bottom</div> }}
        />
      </Scene>
    </Sheet>
  );
}
`,
  );

  const tscBin = resolve(REPO_ROOT, 'node_modules/.bin/tsc');
  const tscRes = spawnSync(tscBin, ['--noEmit', '-p', join(tempDir, 'tsconfig.json')], {
    cwd: tempDir,
    encoding: 'utf8',
  });
  check(
    tscRes.status === 0,
    'tsc --noEmit succeeds in temporary consumer project with installed FRAME/12 components',
    tscRes.status !== 0 ? `${tscRes.stdout}\n${tscRes.stderr}` : '',
  );

  // 6. Verify React 19 element.props.ref runtime compatibility & SSR execution
  writeFileSync(
    join(tempDir, 'src/app/r19-runtime-entry.tsx'),
    `import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ConsumerSmokeTest } from './consumer-check';
import { Dialog, DialogTrigger, TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/frame12';

let dlgPropsRefRead = 0;
let tipPropsRefRead = 0;
function makeReact19Element(onPropsRefRead: () => void) {
  const base = React.createElement('button', { type: 'button' }, 'R19 Child');
  const propsWithRef: Record<string, unknown> = { ...base.props };
  Object.defineProperty(propsWithRef, 'ref', {
    get() {
      onPropsRefRead();
      return () => {};
    },
    enumerable: true,
    configurable: true,
  });
  const r19El = Object.assign({}, base, { props: propsWithRef, ref: null });
  let dialogOrTooltipAccessedLegacyRef = false;
  Object.defineProperty(r19El, 'ref', {
    get() {
      const stack = new Error().stack || '';
      if (stack.includes('getElementRef') || stack.includes('DialogTrigger') || stack.includes('TooltipTrigger')) {
        if (!stack.includes('cloneElement')) {
          dialogOrTooltipAccessedLegacyRef = true;
        }
      }
      return null;
    },
    configurable: true,
  });
  return {
    el: r19El as unknown as React.ReactElement,
    didAccessLegacyRef: () => dialogOrTooltipAccessedLegacyRef,
  };
}

const dlgR19 = makeReact19Element(() => { dlgPropsRefRead++; });
const tipR19 = makeReact19Element(() => { tipPropsRefRead++; });

const html = renderToStaticMarkup(
  React.createElement(
    React.Fragment,
    null,
    React.createElement(ConsumerSmokeTest),
    React.createElement(
      Dialog,
      null,
      React.createElement(DialogTrigger, { asChild: true }, dlgR19.el),
    ),
    React.createElement(
      TooltipProvider,
      null,
      React.createElement(
        Tooltip,
        null,
        React.createElement(TooltipTrigger, { asChild: true }, tipR19.el),
        React.createElement(TooltipContent, null, 'Tip'),
      ),
    ),
  ),
);
if (dlgPropsRefRead === 0 || tipPropsRefRead === 0 || dlgR19.didAccessLegacyRef() || tipR19.didAccessLegacyRef()) {
  throw new Error(
    \`React 19 props.ref check failed: dlgPropsRefRead=\${dlgPropsRefRead} tipPropsRefRead=\${tipPropsRefRead} dlgLegacy=\${dlgR19.didAccessLegacyRef()} tipLegacy=\${tipR19.didAccessLegacyRef()}\`,
  );
}
if (!html.includes('C-01') || !html.includes('R19 Child')) {
  throw new Error('Unexpected SSR output: ' + html.slice(0, 200));
}
if (!React.version.startsWith('19.')) {
  throw new Error('Expected the React 19 runtime, got React ' + React.version);
}
console.log('R19_RUNTIME_OK:' + html.length + ' react@' + React.version);
`,
  );

  const esbuildBin = resolve(REPO_ROOT, 'node_modules/.bin/esbuild');
  const bundleOut = join(tempDir, 'r19-runtime.cjs');
  const buildRes = spawnSync(
    esbuildBin,
    [
      join(tempDir, 'src/app/r19-runtime-entry.tsx'),
      '--bundle',
      '--platform=node',
      '--format=cjs',
      '--loader:.css=empty',
      `--outfile=${bundleOut}`,
    ],
    { cwd: tempDir, encoding: 'utf8' },
  );
  const runRes =
    buildRes.status === 0
      ? spawnSync(process.execPath, [bundleOut], { cwd: tempDir, encoding: 'utf8' })
      : buildRes;
  check(
    runRes.status === 0 && (runRes.stdout || '').includes('R19_RUNTIME_OK:'),
    'React 19 runtime execution: renders installed components and resolves element.props.ref without triggering element.ref deprecation getter',
    runRes.status !== 0 ? `${runRes.stdout}\n${runRes.stderr}` : runRes.stdout.trim(),
  );

  // 0. Validate registry schema (`registry.json` + `registry/registry.json`) with `shadcn registry validate`
  const validateRes = await runAsync('npx', ['--yes', 'shadcn', 'registry', 'validate'], {
    cwd: REPO_ROOT,
    env: { ...process.env, CI: 'true' },
  });
  check(
    validateRes.status === 0,
    'npx shadcn registry validate passes across root registry.json and registry/registry.json (40 items)',
    validateRes.status !== 0 ? `${validateRes.stdout}\n${validateRes.stderr}` : '',
  );

  // 6b. Flagship Block consumer installation (/r/developer-console.json, /r/workspace-settings.json, /r/analytics-dashboard.json)
  const blockDir = mkdtempSync(join(tmpdir(), 'frame12-block-'));
  try {
    mkdirSync(join(blockDir, 'src/app'), { recursive: true });
    mkdirSync(join(blockDir, '.shim-bin'), { recursive: true });
    const blockShim = join(blockDir, '.shim-bin/npm');
    writeFileSync(blockShim, '#!/bin/sh\nexit 0\n');
    chmodSync(blockShim, 0o755);
    writeFileSync(join(blockDir, 'src/app/globals.css'), '/* host globals */\n');
    writeFileSync(join(blockDir, 'src/global.d.ts'), CSS_MODULE_DECL);
    writeFileSync(
      join(blockDir, 'package.json'),
      readFileSync(join(tempDir, 'package.json'), 'utf8'),
    );
    writeFileSync(
      join(blockDir, 'package-lock.json'),
      readFileSync(join(tempDir, 'package-lock.json'), 'utf8'),
    );
    writeFileSync(
      join(blockDir, 'tsconfig.json'),
      readFileSync(join(tempDir, 'tsconfig.json'), 'utf8'),
    );
    writeFileSync(
      join(blockDir, 'components.json'),
      readFileSync(join(tempDir, 'components.json'), 'utf8'),
    );

    const blockUrl = `http://127.0.0.1:${port}/r/developer-console.json`;
    const settingsBlockUrl = `http://127.0.0.1:${port}/r/workspace-settings.json`;
    const analyticsBlockUrl = `http://127.0.0.1:${port}/r/analytics-dashboard.json`;
    const blockAdd = await runAsync(
      'npx',
      ['--yes', 'shadcn', 'add', blockUrl, settingsBlockUrl, analyticsBlockUrl, '--yes', '--overwrite'],
      {
        cwd: blockDir,
        env: {
          ...process.env,
          CI: 'true',
          PATH: `${join(blockDir, '.shim-bin')}:${process.env.PATH || ''}`,
        },
      },
    );
    const installedBlockCss = existsSync(join(blockDir, 'src/styles/frame12.css'))
      ? readFileSync(join(blockDir, 'src/styles/frame12.css'), 'utf8')
      : '';
    const hasBlockFiles =
      existsSync(join(blockDir, 'src/components/frame12/blocks/developer-console.tsx')) &&
      existsSync(join(blockDir, 'src/components/frame12/blocks/workspace-settings.tsx')) &&
      existsSync(join(blockDir, 'src/components/frame12/blocks/analytics-dashboard.tsx')) &&
      existsSync(join(blockDir, 'src/components/frame12/index.ts')) &&
      existsSync(join(blockDir, 'src/hooks/use-on-twos.ts')) &&
      /dialog\.f12-dialog\s*\{[^}]*margin:\s*auto\s*;/s.test(installedBlockCss);
    symlinkSync(resolve(REPO_ROOT, 'node_modules'), join(blockDir, 'node_modules'), 'dir');
    writeFileSync(
      join(blockDir, 'src/app/block-check.tsx'),
      `import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import '@/styles/frame12.css';
import { DeveloperConsole } from '@/components/frame12/blocks/developer-console';
import { WorkspaceSettings } from '@/components/frame12/blocks/workspace-settings';
import { AnalyticsDashboard, RevenueRecoveryCoreScenes } from '@/components/frame12/blocks/analytics-dashboard';

export function BlockConsumerCheck() {
  return (
    <div>
      <DeveloperConsole defaultSection="overview" theme="light" className="custom-console" />
      <DeveloperConsole defaultSection="services" defaultEnvironment="staging-eu-central-1" />
      <WorkspaceSettings defaultSection="profile" theme="light" className="custom-settings" />
      <WorkspaceSettings defaultSection="notifications" defaultWorkspaceId="staging-atelier" />
      <AnalyticsDashboard defaultRange={30} theme="light" className="custom-analytics" />
      <AnalyticsDashboard defaultRange={7} defaultComparisonMode="prior-period" />
      <RevenueRecoveryCoreScenes range={30} focus={null} onSelectFocus={() => {}} />
      <RevenueRecoveryCoreScenes range={7} focus={null} onSelectFocus={() => {}} />
    </div>
  );
}
export function renderBlockHtml() {
  return renderToStaticMarkup(<BlockConsumerCheck />);
}
`,
    );
    const blockTsc = spawnSync(tscBin, ['--noEmit', '-p', join(blockDir, 'tsconfig.json')], {
      cwd: blockDir,
      encoding: 'utf8',
    });
    const blockBundle = join(blockDir, 'block-ssr.cjs');
    const blockBuild = spawnSync(
      esbuildBin,
      [
        join(blockDir, 'src/app/block-check.tsx'),
        '--bundle',
        '--platform=node',
        '--format=cjs',
        '--loader:.css=empty',
        `--outfile=${blockBundle}`,
      ],
      { cwd: blockDir, encoding: 'utf8' },
    );
    const blockSsr =
      blockBuild.status === 0
        ? spawnSync(
            process.execPath,
            ['-e', `console.log(require(${JSON.stringify(blockBundle)}).renderBlockHtml())`],
            { cwd: blockDir, encoding: 'utf8' },
          )
        : blockBuild;
    const ssrHtml = blockSsr.stdout || '';
    const idMatches = [...ssrHtml.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
    const duplicateIds = idMatches.filter((id, idx) => idMatches.indexOf(id) !== idx);
    check(
      blockAdd.status === 0 &&
        hasBlockFiles &&
        blockTsc.status === 0 &&
        blockSsr.status === 0 &&
        ssrHtml.includes('Developer Console') &&
        ssrHtml.includes('1,482,900') &&
        ssrHtml.includes('Workspace &amp; Operator Settings') &&
        ssrHtml.includes('Fernwood Supply Co.') &&
        ssrHtml.includes('DAILY RECOVERY &amp; ATTRIBUTION EVIDENCE LEDGER') &&
        duplicateIds.length === 0,
      'Block installs (/r/developer-console.json, /r/workspace-settings.json, /r/analytics-dashboard.json) install block files + full kit, pass tsc --noEmit, and render deterministic SSR markup with zero duplicate IDs across multi-instance renders',
      blockTsc.status !== 0
        ? `${blockTsc.stdout}\n${blockTsc.stderr}`
        : blockSsr.status !== 0
          ? `${blockSsr.stdout}\n${blockSsr.stderr}`
          : duplicateIds.length > 0
            ? `Duplicate IDs: ${duplicateIds.slice(0, 5).join(', ')}`
            : '',
    );
  } finally {
    rmSync(blockDir, { recursive: true, force: true });
  }

  // 7. Individual component consumer installation (/r/sheet.json + /r/panel.json + /r/badge.json + /r/switch.json + /r/alert.json + /r/pagination.json via registryDependencies)
  const singleDir = mkdtempSync(join(tmpdir(), 'frame12-single-'));
  try {
    mkdirSync(join(singleDir, 'src/app'), { recursive: true });
    mkdirSync(join(singleDir, '.shim-bin'), { recursive: true });
    const singleShim = join(singleDir, '.shim-bin/npm');
    writeFileSync(singleShim, '#!/bin/sh\nexit 0\n');
    chmodSync(singleShim, 0o755);
    writeFileSync(join(singleDir, 'src/app/globals.css'), '/* host globals */\n');
    writeFileSync(join(singleDir, 'src/global.d.ts'), CSS_MODULE_DECL);
    writeFileSync(
      join(singleDir, 'package.json'),
      readFileSync(join(tempDir, 'package.json'), 'utf8'),
    );
    writeFileSync(
      join(singleDir, 'package-lock.json'),
      readFileSync(join(tempDir, 'package-lock.json'), 'utf8'),
    );
    writeFileSync(
      join(singleDir, 'tsconfig.json'),
      readFileSync(join(tempDir, 'tsconfig.json'), 'utf8'),
    );
    writeFileSync(
      join(singleDir, 'components.json'),
      readFileSync(join(tempDir, 'components.json'), 'utf8'),
    );

    const sheetUrl = `http://127.0.0.1:${port}/r/sheet.json`;
    const panelUrl = `http://127.0.0.1:${port}/r/panel.json`;
    const badgeUrl = `http://127.0.0.1:${port}/r/badge.json`;
    const switchUrl = `http://127.0.0.1:${port}/r/switch.json`;
    const alertUrl = `http://127.0.0.1:${port}/r/alert.json`;
    const paginationUrl = `http://127.0.0.1:${port}/r/pagination.json`;
    const baseUrl = `http://127.0.0.1:${port}/r/frame12-base.json`;

    const viewBase = await runAsync('npx', ['--yes', 'shadcn', 'add', baseUrl, '--view'], {
      cwd: singleDir,
      env: { ...process.env, CI: 'true' },
    });
    check(
      viewBase.status === 0 && viewBase.stdout.includes('frame12.css'),
      'shadcn add --view on /r/frame12-base.json resolves base styles, hooks, and registry:font items',
      viewBase.status !== 0 ? `${viewBase.stdout}\n${viewBase.stderr}` : '',
    );

    const singleAdd = await runAsync(
      'npx',
      [
        '--yes',
        'shadcn',
        'add',
        sheetUrl,
        panelUrl,
        badgeUrl,
        switchUrl,
        alertUrl,
        paginationUrl,
        '--yes',
        '--overwrite',
      ],
      {
        cwd: singleDir,
        env: {
          ...process.env,
          CI: 'true',
          PATH: `${join(singleDir, '.shim-bin')}:${process.env.PATH || ''}`,
        },
      },
    );
    const hasSingleFiles =
      existsSync(join(singleDir, 'src/components/frame12/sheet.tsx')) &&
      existsSync(join(singleDir, 'src/components/frame12/panel.tsx')) &&
      existsSync(join(singleDir, 'src/components/frame12/badge.tsx')) &&
      existsSync(join(singleDir, 'src/components/frame12/tag.tsx')) &&
      existsSync(join(singleDir, 'src/components/frame12/switch.tsx')) &&
      existsSync(join(singleDir, 'src/components/frame12/field.tsx')) &&
      existsSync(join(singleDir, 'src/components/frame12/alert.tsx')) &&
      existsSync(join(singleDir, 'src/components/frame12/pagination.tsx')) &&
      existsSync(join(singleDir, 'src/hooks/use-on-twos.ts')) &&
      existsSync(join(singleDir, 'src/hooks/use-tempo.ts')) &&
      existsSync(join(singleDir, 'src/styles/frame12.css'));
    symlinkSync(resolve(REPO_ROOT, 'node_modules'), join(singleDir, 'node_modules'), 'dir');
    writeFileSync(
      join(singleDir, 'src/app/single-check.tsx'),
      `import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import '@/styles/frame12.css';
import { Sheet } from '@/components/frame12/sheet';
import { Panel } from '@/components/frame12/panel';
import { Badge } from '@/components/frame12/badge';
import { Switch } from '@/components/frame12/switch';
import { Notice } from '@/components/frame12/alert';
import { Pagination } from '@/components/frame12/pagination';
export function SingleCheck() {
  return (
    <Sheet autoCut>
      <Panel label="First">One <Badge status="warning">Warn</Badge> <Switch label="TLS" defaultChecked /></Panel>
      <Panel label="Second"><Notice status="info">Two</Notice></Panel>
      <Panel cut={false} label="Unnumbered">None</Panel>
      <Panel label="Third"><Pagination page={1} totalPages={3} /></Panel>
    </Sheet>
  );
}
export function renderSingleHtml() {
  return renderToStaticMarkup(<SingleCheck />);
}
`,
    );
    const singleTsc = spawnSync(tscBin, ['--noEmit', '-p', join(singleDir, 'tsconfig.json')], {
      cwd: singleDir,
      encoding: 'utf8',
    });
    check(
      singleAdd.status === 0 && hasSingleFiles && singleTsc.status === 0,
      'Individual install (/r/sheet.json + /r/panel.json + /r/badge.json + /r/switch.json + /r/alert.json + /r/pagination.json) resolves frame12-styles, use-on-twos, tag.json, and field.json via registryDependencies and passes tsc --noEmit',
      singleTsc.status !== 0 ? `${singleTsc.stdout}\n${singleTsc.stderr}` : '',
    );

    // Bundle and render SingleCheck in Chromium to verify <Sheet autoCut> CSS counters from installed sheet.json + panel.json
    const singleBundle = join(singleDir, 'single-ssr.cjs');
    spawnSync(
      esbuildBin,
      [
        join(singleDir, 'src/app/single-check.tsx'),
        '--bundle',
        '--platform=node',
        '--format=cjs',
        '--loader:.css=empty',
        `--outfile=${singleBundle}`,
      ],
      { cwd: singleDir, encoding: 'utf8' },
    );
    const ssrRes = spawnSync(
      process.execPath,
      ['-e', `console.log(require(${JSON.stringify(singleBundle)}).renderSingleHtml())`],
      { cwd: singleDir, encoding: 'utf8' },
    );
    const installedCss = readFileSync(join(singleDir, 'src/styles/frame12.css'), 'utf8');
    const fontDelaManifest = JSON.parse(
      readFileSync(resolve(REGISTRY_PUBLIC_DIR, 'font-dela-gothic-one.json'), 'utf8'),
    );
    const fontZenManifest = JSON.parse(
      readFileSync(resolve(REGISTRY_PUBLIC_DIR, 'font-zen-kaku-gothic-new.json'), 'utf8'),
    );
    const fontMplusManifest = JSON.parse(
      readFileSync(resolve(REGISTRY_PUBLIC_DIR, 'font-m-plus-1-code.json'), 'utf8'),
    );
    check(
      fontDelaManifest.font?.variable === '--font-dela-gothic-one' &&
        fontZenManifest.font?.variable === '--font-zen-kaku-gothic-new' &&
        fontMplusManifest.font?.variable === '--font-m-plus-1-code' &&
        installedCss.includes('--font-f-display: var(--font-dela-gothic-one, "Dela Gothic One")') &&
        installedCss.includes('--font-f-body: var(--font-zen-kaku-gothic-new, "Zen Kaku Gothic New")') &&
        installedCss.includes('--font-f-mono: var(--font-m-plus-1-code, "M PLUS 1 Code")'),
      'registry:font items use distinct --font-<slug> variables and frame12.css resolves --font-f-* via var(--font-<slug>, fallback)',
    );
    const browser = await chromium.launch({
      executablePath: process.env.CHROME_PATH || undefined,
      args: ['--no-sandbox'],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(
        `<!doctype html><html><head><style>${installedCss}</style></head><body>${ssrRes.stdout}</body></html>`,
      );
      const renderedCuts = await getRenderedCuts(page);
      check(
        renderedCuts.join(',') === 'C-01,C-02,C-03',
        `Individual sheet.json + panel.json install renders <Sheet autoCut> CSS counters (${renderedCuts.join(', ')})`,
      );
    } finally {
      await browser.close();
    }
  } finally {
    rmSync(singleDir, { recursive: true, force: true });
  }

  // 7b. `metric` installed ALONE (F12-08): registryDependencies must bring hooks/use-tempo.ts
  // (imported by use-on-twos.ts), and a consumer that adds a TempoProvider must type-check.
  const metricDir = mkdtempSync(join(tmpdir(), 'frame12-metric-only-'));
  try {
    mkdirSync(join(metricDir, 'src/app'), { recursive: true });
    mkdirSync(join(metricDir, '.shim-bin'), { recursive: true });
    writeFileSync(join(metricDir, '.shim-bin/npm'), '#!/bin/sh\nexit 0\n');
    chmodSync(join(metricDir, '.shim-bin/npm'), 0o755);
    writeFileSync(join(metricDir, 'src/app/globals.css'), '/* host globals */\n');
    writeFileSync(join(metricDir, 'src/global.d.ts'), CSS_MODULE_DECL);
    for (const f of ['package.json', 'package-lock.json', 'tsconfig.json', 'components.json']) {
      writeFileSync(join(metricDir, f), readFileSync(join(tempDir, f), 'utf8'));
    }
    const env = { ...process.env, CI: 'true', PATH: `${join(metricDir, '.shim-bin')}:${process.env.PATH || ''}` };
    const metricAdd = await runAsync(
      'npx',
      ['--yes', 'shadcn', 'add', `http://127.0.0.1:${port}/r/metric.json`, '--yes', '--overwrite'],
      { cwd: metricDir, env },
    );
    const metricFiles = ['src/components/frame12/metric.tsx', 'src/hooks/use-on-twos.ts', 'src/hooks/use-tempo.ts', 'src/styles/frame12.css'];
    const missing = metricFiles.filter((f) => !existsSync(join(metricDir, f)));
    const tempoAdd = await runAsync(
      'npx',
      ['--yes', 'shadcn', 'add', `http://127.0.0.1:${port}/r/tempo.json`, '--yes', '--overwrite'],
      { cwd: metricDir, env },
    );
    // Ink items one by one: each brings only what it needs (ink-reveal → ink-stroke + panel).
    const inkAdd = await runAsync(
      'npx',
      ['--yes', 'shadcn', 'add', `http://127.0.0.1:${port}/r/ink-reveal.json`, `http://127.0.0.1:${port}/r/ink-sequence.json`, '--yes', '--overwrite'],
      { cwd: metricDir, env },
    );
    const inkFiles = ['src/components/frame12/ink.tsx', 'src/components/frame12/ink-pencil.ts', 'src/components/frame12/ink-reveal.tsx', 'src/components/frame12/ink-sequence.tsx', 'src/components/frame12/panel.tsx'];
    const inkMissing = inkFiles.filter((f) => !existsSync(join(metricDir, f)));
    symlinkSync(resolve(REPO_ROOT, 'node_modules'), join(metricDir, 'node_modules'), 'dir');
    writeFileSync(
      join(metricDir, 'src/app/metric-check.tsx'),
      `import * as React from 'react';
import { Metric } from '@/components/frame12/metric';
import { TempoProvider } from '@/components/frame12/tempo';
import { useTempo } from '@/hooks/use-tempo';
export function MetricCheck() {
  return (
    <TempoProvider defaultValue="twos">
      <Metric label="Revenue" value={42} />
    </TempoProvider>
  );
}
export function useCurrentTempo() {
  return useTempo().tempo;
}
`,
    );
    writeFileSync(
      join(metricDir, 'src/app/ink-check.tsx'),
      `import * as React from 'react';
import { Panel } from '@/components/frame12/panel';
import { InkStroke } from '@/components/frame12/ink';
import { InkReveal } from '@/components/frame12/ink-reveal';
import { InkBeat, InkSequence } from '@/components/frame12/ink-sequence';
export function InkCheck() {
  const [play, setPlay] = React.useState(false);
  return (
    <>
      <button type="button" aria-pressed={play} onClick={() => setPlay((p) => !p)}>Draw</button>
      <InkSequence beats={[6]} play={play}>
        <svg aria-hidden="true"><InkBeat beat={0}><InkStroke d="M0 0H10" /></InkBeat></svg>
      </InkSequence>
      <InkReveal play={play}><Panel label="P" /></InkReveal>
    </>
  );
}
`,
    );
    const metricTsc = spawnSync(tscBin, ['--noEmit', '-p', join(metricDir, 'tsconfig.json')], {
      cwd: metricDir,
      encoding: 'utf8',
    });
    check(
      inkAdd.status === 0 && inkMissing.length === 0 && metricTsc.status === 0,
      'Individual install of /r/ink-reveal.json and /r/ink-sequence.json (React 19) brings ink.tsx, ink-pencil.ts and panel.tsx and passes tsc --noEmit',
      inkMissing.length ? `missing: ${inkMissing.join(', ')}` : '',
    );
    check(
      metricAdd.status === 0 && missing.length === 0 && tempoAdd.status === 0 && metricTsc.status === 0,
      'Individual install of /r/metric.json alone brings hooks/use-tempo.ts (via use-on-twos and its own registryDependencies); adding /r/tempo.json shares that one module and passes tsc --noEmit',
      missing.length ? `missing: ${missing.join(', ')}` : metricTsc.status !== 0 ? `${metricTsc.stdout}\n${metricTsc.stderr}` : '',
    );
  } finally {
    rmSync(metricDir, { recursive: true, force: true });
  }

  // 8. React 18 consumer (Vite). The repo hoists React 19, so React 18 support is proven in an
  // isolated project with its own real React 18 install: shadcn add (full kit + 3 blocks) →
  // tsc --noEmit against @types/react 18 → react-dom/server 18 SSR → vite build → hydrateRoot in
  // Chromium with interaction checks and zero hydration/console errors.
  const r18Dir = mkdtempSync(join(tmpdir(), 'frame12-react18-'));
  let r18Server;
  try {
    mkdirSync(join(r18Dir, 'src'), { recursive: true });
    mkdirSync(join(r18Dir, '.shim-bin'), { recursive: true });
    const r18Shim = join(r18Dir, '.shim-bin/npm');
    writeFileSync(r18Shim, '#!/bin/sh\nexit 0\n');
    chmodSync(r18Shim, 0o755);
    writeFileSync(join(r18Dir, 'src/index.css'), '/* host globals */\n');
    // The standard Vite template file: brings in vite/client types, including `*.css` imports.
    writeFileSync(join(r18Dir, 'src/vite-env.d.ts'), '/// <reference types="vite/client" />\n');
    writeFileSync(
      join(r18Dir, 'package.json'),
      JSON.stringify(
        {
          name: 'frame12-react18-consumer',
          private: true,
          version: '0.0.0',
          type: 'module',
          dependencies: {
            '@radix-ui/react-dropdown-menu': '^2.1.6',
            '@radix-ui/react-select': '^2.1.6',
            react: '18.3.1',
            'react-dom': '18.3.1',
          },
          devDependencies: {
            '@types/react': '^18.3.31',
            '@types/react-dom': '^18.3.7',
            vite: '^8.0.0',
          },
        },
        null,
        2,
      ),
    );
    writeFileSync(
      join(r18Dir, 'tsconfig.json'),
      JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2022',
            lib: ['dom', 'dom.iterable', 'esnext'],
            skipLibCheck: true,
            strict: true,
            noEmit: true,
            module: 'esnext',
            moduleResolution: 'bundler',
            isolatedModules: true,
            jsx: 'react-jsx',
            types: [],
            paths: { '@/*': ['./src/*'] },
          },
          include: ['src/**/*.ts', 'src/**/*.tsx'],
        },
        null,
        2,
      ),
    );
    writeFileSync(
      join(r18Dir, 'components.json'),
      JSON.stringify(
        {
          $schema: 'https://ui.shadcn.com/schema.json',
          style: 'new-york',
          rsc: false,
          tsx: true,
          tailwind: { config: '', css: 'src/index.css', baseColor: 'neutral', cssVariables: true, prefix: '' },
          aliases: {
            components: '@/components',
            utils: '@/lib/utils',
            ui: '@/components/ui',
            lib: '@/lib',
            hooks: '@/hooks',
          },
        },
        null,
        2,
      ),
    );

    const r18Add = await runAsync(
      'npx',
      [
        '--yes',
        'shadcn',
        'add',
        `http://127.0.0.1:${port}/r/frame12.json`,
        `http://127.0.0.1:${port}/r/developer-console.json`,
        `http://127.0.0.1:${port}/r/workspace-settings.json`,
        `http://127.0.0.1:${port}/r/analytics-dashboard.json`,
        `http://127.0.0.1:${port}/r/ink-stroke.json`,
        `http://127.0.0.1:${port}/r/ink-reveal.json`,
        `http://127.0.0.1:${port}/r/ink-sequence.json`,
        '--yes',
        '--overwrite',
      ],
      {
        cwd: r18Dir,
        env: { ...process.env, CI: 'true', PATH: `${join(r18Dir, '.shim-bin')}:${process.env.PATH || ''}` },
      },
    );
    // Real install (network): React 18.3.1 + @types/react 18 + Vite, isolated from the repo tree.
    const r18Install = await runAsync(
      'npm',
      ['install', '--no-audit', '--no-fund', '--loglevel=error'],
      { cwd: r18Dir, env: { ...process.env, CI: 'true' } },
    );
    const r18Version = existsSync(join(r18Dir, 'node_modules/react/package.json'))
      ? JSON.parse(readFileSync(join(r18Dir, 'node_modules/react/package.json'), 'utf8')).version
      : 'missing';
    const r18TypesVersion = existsSync(join(r18Dir, 'node_modules/@types/react/package.json'))
      ? JSON.parse(readFileSync(join(r18Dir, 'node_modules/@types/react/package.json'), 'utf8')).version
      : 'missing';
    check(
      r18Add.status === 0 && r18Install.status === 0 && r18Version === '18.3.1' && r18TypesVersion.startsWith('18.'),
      `React 18 consumer: shadcn add (kit + 3 blocks) and isolated install resolve react@${r18Version}, @types/react@${r18TypesVersion}`,
      r18Add.status !== 0
        ? `${r18Add.stdout}\n${r18Add.stderr}`
        : r18Install.status !== 0
          ? `${r18Install.stdout}\n${r18Install.stderr}`
          : '',
    );

    writeFileSync(
      join(r18Dir, 'src/App.tsx'),
      `import * as React from 'react';
import {
  Sheet, Scene, Panel, Button, Tabs, TabsList, TabsTrigger, TabsContent,
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Metric, Switch, ToastProvider,
} from '@/components/frame12';
import { DeveloperConsole } from '@/components/frame12/blocks/developer-console';
import { WorkspaceSettings } from '@/components/frame12/blocks/workspace-settings';
import { AnalyticsDashboard } from '@/components/frame12/blocks/analytics-dashboard';
import { InkStroke, inkPencil } from '@/components/frame12/ink';
import { InkReveal } from '@/components/frame12/ink-reveal';
import { InkBeat, InkLand, InkSequence } from '@/components/frame12/ink-sequence';

function Ink() {
  const [playing, setPlaying] = React.useState(false);
  return (
    <>
      <Button id="r18-ink-play" aria-pressed={playing} onClick={() => setPlaying((p) => !p)}>
        {playing ? 'Stop' : 'Watch it get made'}
      </Button>
      <InkSequence id="r18-ink" beats={[6, 6]} play={playing} onEnd={() => setPlaying(false)}>
        <svg viewBox="0 0 200 100" width="200" height="100" aria-hidden="true">
          <InkBeat beat={0}><InkStroke weight="pencil" d={inkPencil([[10, 50, 190, 50]])} /></InkBeat>
          <InkBeat beat={1}>
            <InkStroke weight="frame" d="M10 10H190V90H10Z" />
            <InkLand at={2}><text x="20" y="30">C-01</text></InkLand>
          </InkBeat>
        </svg>
      </InkSequence>
      <InkReveal play={playing}>
        <Panel label="Revealed" cut={false}>Ink reveal</Panel>
      </InkReveal>
    </>
  );
}

export function App() {
  const [on, setOn] = React.useState(false);
  return (
    <ToastProvider>
      <Sheet autoCut theme="light" motion="cut">
        <Scene gutter="scene" layout="split">
          <Panel label="Hero"><Metric label="Recovered" value={120054} big /></Panel>
          <Panel label="Controls">
            <Switch id="r18-switch" label="Signed commits" checked={on} onCheckedChange={setOn} />
            <Dialog>
              <DialogTrigger asChild><Button id="r18-dialog-open">Open dialog</Button></DialogTrigger>
              <DialogContent cut="C-09">
                <DialogHeader>
                  <DialogTitle>React 18 dialog</DialogTitle>
                  <DialogDescription>Native dialog on React 18.</DialogDescription>
                </DialogHeader>
                <DialogFooter><DialogClose id="r18-dialog-close">Close</DialogClose></DialogFooter>
              </DialogContent>
            </Dialog>
            <Select defaultValue="email">
              <SelectTrigger id="r18-select" aria-label="Channel"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="pager">Pager</SelectItem>
              </SelectContent>
            </Select>
          </Panel>
        </Scene>
        <Tabs defaultValue="one" idPrefix="r18-tabs">
          <TabsList aria-label="React 18 tabs">
            <TabsTrigger value="one">One</TabsTrigger>
            <TabsTrigger value="two">Two</TabsTrigger>
          </TabsList>
          <TabsContent value="one">First panel</TabsContent>
          <TabsContent value="two">Second panel</TabsContent>
        </Tabs>
      </Sheet>
      <DeveloperConsole idPrefix="r18-console" />
      <WorkspaceSettings idPrefix="r18-settings" />
      <AnalyticsDashboard idPrefix="r18-analytics" />
      <Ink />
    </ToastProvider>
  );
}
`,
    );
    writeFileSync(
      join(r18Dir, 'src/main.tsx'),
      `import * as React from 'react';
import { hydrateRoot } from 'react-dom/client';
import '@/styles/frame12.css';
import { App } from './App';

(window as unknown as { __REACT_VERSION__: string }).__REACT_VERSION__ = React.version;
hydrateRoot(document.getElementById('root')!, <App />, {
  onRecoverableError: (err) => console.error('recoverable: ' + String((err as Error)?.message ?? err)),
});
`,
    );
    writeFileSync(
      join(r18Dir, 'src/ssr.tsx'),
      `import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { App } from './App';
export const html = () => renderToString(<App />);
export const version = React.version;
`,
    );
    writeFileSync(
      join(r18Dir, 'vite.config.mjs'),
      `import { fileURLToPath } from 'node:url';
export default {
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  esbuild: { jsx: 'automatic' },
  logLevel: 'error',
};
`,
    );

    const r18Tsc = spawnSync(tscBin, ['--noEmit', '-p', join(r18Dir, 'tsconfig.json')], {
      cwd: r18Dir,
      encoding: 'utf8',
    });
    check(
      r18Tsc.status === 0,
      'React 18 consumer: tsc --noEmit passes for the full kit + 3 blocks against @types/react 18',
      r18Tsc.status !== 0 ? `${r18Tsc.stdout}\n${r18Tsc.stderr}`.slice(0, 2000) : '',
    );

    const r18SsrBundle = join(r18Dir, 'ssr.cjs');
    const r18SsrBuild = spawnSync(
      esbuildBin,
      [
        join(r18Dir, 'src/ssr.tsx'),
        '--bundle',
        '--platform=node',
        '--format=cjs',
        '--jsx=automatic',
        '--loader:.css=empty',
        `--tsconfig=${join(r18Dir, 'tsconfig.json')}`,
        `--outfile=${r18SsrBundle}`,
      ],
      { cwd: r18Dir, encoding: 'utf8' },
    );
    const r18Ssr =
      r18SsrBuild.status === 0
        ? spawnSync(
            process.execPath,
            ['-e', `const m=require(${JSON.stringify(r18SsrBundle)});process.stdout.write(JSON.stringify({v:m.version,html:m.html()}))`],
            { cwd: r18Dir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
          )
        : r18SsrBuild;
    let r18SsrOut = { v: '', html: '' };
    try {
      r18SsrOut = JSON.parse(r18Ssr.stdout || '{}');
    } catch {
      // reported below
    }
    const r18Ids = [...(r18SsrOut.html || '').matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
    const r18DupIds = r18Ids.filter((id, idx) => r18Ids.indexOf(id) !== idx);
    check(
      r18Ssr.status === 0 &&
        r18SsrOut.v === '18.3.1' &&
        r18SsrOut.html.includes('Developer Console') &&
        r18SsrOut.html.includes('Workspace &amp; Operator Settings') &&
        r18SsrOut.html.includes('Fernwood Supply Co.') &&
        r18DupIds.length === 0,
      `React 18 consumer: react-dom/server@${r18SsrOut.v || '?'} renders the kit + 3 blocks with zero duplicate IDs`,
      r18Ssr.status !== 0
        ? `${r18Ssr.stdout}\n${r18Ssr.stderr}`.slice(0, 2000)
        : r18DupIds.length
          ? `Duplicate IDs: ${r18DupIds.slice(0, 5).join(', ')}`
          : '',
    );

    // `<link rel="icon" href="data:,">` stops Chromium requesting /favicon.ico, whose 404 would
    // otherwise surface as a console error in the zero-console-errors hydration check below.
    writeFileSync(
      join(r18Dir, 'index.html'),
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><link rel="icon" href="data:,"><title>FRAME/12 React 18</title></head><body><div id="root">${r18SsrOut.html}</div><script type="module" src="/src/main.tsx"></script></body></html>`,
    );
    const r18Build = await runAsync(join(r18Dir, 'node_modules/.bin/vite'), ['build'], {
      cwd: r18Dir,
      env: { ...process.env, CI: 'true' },
    });
    check(
      r18Build.status === 0 && existsSync(join(r18Dir, 'dist/index.html')),
      'React 18 consumer: vite build succeeds',
      r18Build.status !== 0 ? `${r18Build.stdout}\n${r18Build.stderr}`.slice(0, 2000) : '',
    );

    if (r18Build.status === 0) {
      const distDir = join(r18Dir, 'dist');
      r18Server = http.createServer((req, res) => {
        const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
        const filePath = resolve(distDir, `.${urlPath === '/' ? '/index.html' : urlPath}`);
        if (!filePath.startsWith(distDir) || !existsSync(filePath)) {
          res.writeHead(404);
          res.end();
          return;
        }
        const type = filePath.endsWith('.js')
          ? 'text/javascript'
          : filePath.endsWith('.css')
            ? 'text/css'
            : 'text/html';
        res.writeHead(200, { 'Content-Type': type });
        res.end(readFileSync(filePath));
      });
      await new Promise((r) => r18Server.listen(0, '127.0.0.1', r));
      const r18Port = r18Server.address().port;
      const browser = await chromium.launch({
        executablePath: process.env.CHROME_PATH || undefined,
        args: ['--no-sandbox'],
      });
      try {
        const page = await browser.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
        page.on('console', (m) => {
          // Include the source URL: for "Failed to load resource" it names the missing file.
          if (m.type() === 'error') errors.push(`console: ${m.text()} (${m.location()?.url || 'no url'})`);
        });
        await page.goto(`http://127.0.0.1:${r18Port}/`, { waitUntil: 'load' });
        await page.waitForFunction(() => (window).__REACT_VERSION__);
        const runtimeVersion = await page.evaluate(() => (window).__REACT_VERSION__);
        await page.click('#r18-dialog-open');
        const dialogOpened = await page
          .waitForFunction(() => document.querySelector('dialog.f12-dialog[open]'), null, { timeout: 3000 })
          .then(() => true, () => false);
        await page.keyboard.press('Escape');
        const dialogClosed = await page
          .waitForFunction(() => !document.querySelector('dialog.f12-dialog[open]'), null, { timeout: 3000 })
          .then(() => true, () => false);
        const focusReturned = await page.evaluate(() => document.activeElement?.id === 'r18-dialog-open');
        await page.click('#r18-switch');
        const switchOn = await page.evaluate(
          () => document.getElementById('r18-switch')?.getAttribute('aria-checked') === 'true' ||
            (document.getElementById('r18-switch')).checked === true,
        );
        await page.focus('#r18-tabs-tab-one');
        await page.keyboard.press('ArrowRight');
        const secondTabSelected = await page.evaluate(() => {
          const tabs = [...document.querySelectorAll('[role="tablist"][aria-label="React 18 tabs"] [role="tab"]')];
          return tabs[1]?.getAttribute('aria-selected') === 'true';
        });
        const inkRest = await page.evaluate(() => document.getElementById('r18-ink')?.dataset.inkState);
        await page.click('#r18-ink-play');
        const inkPlaying = await page
          .waitForFunction(() => document.getElementById('r18-ink')?.dataset.inkState === 'playing', null, { timeout: 3000 })
          .then(() => true, () => false);
        check(
          inkRest === 'rest' && inkPlaying && errors.length === 0,
          'React 18 consumer: ink-stroke, ink-reveal and ink-sequence install, type-check, SSR at rest, build, hydrate and play on a click',
          JSON.stringify({ inkRest, inkPlaying }),
        );
        check(
          runtimeVersion === '18.3.1' && dialogOpened && dialogClosed && focusReturned && switchOn && secondTabSelected && errors.length === 0,
          `React 18 consumer: hydrates on react-dom@${runtimeVersion} in Chromium; Dialog open/Escape/focus return, Switch, and Tabs arrow-key selection work with zero console/hydration errors`,
          JSON.stringify({ dialogOpened, dialogClosed, focusReturned, switchOn, secondTabSelected, errors: errors.slice(0, 5) }),
        );
      } finally {
        await browser.close();
      }
    }
  } finally {
    if (r18Server) r18Server.close();
    // F12_SMOKE_KEEP=1 keeps the React 18 consumer on disk for debugging.
    if (process.env.F12_SMOKE_KEEP) console.log(`(kept React 18 consumer at ${r18Dir})`);
    else rmSync(r18Dir, { recursive: true, force: true });
  }

  // 9. Standalone publishable npm packages (packages/*): npm pack -> install tarballs into a
  // temp project with NO other dependencies -> verify cssText, lintHtml, and every @frame12/static export (document() with fs blocked, static.css, .d.ts)
  // for whichever packages are present.
  try {
    const pkgSmokeRes = runStandalonePackageSmokeTest(REPO_ROOT, { silent: true });
    check(
      pkgSmokeRes.verified.length >= 1 && Boolean(pkgSmokeRes.results.tokens),
      `Standalone npm package tarball install (${pkgSmokeRes.verified.join(', ')}): npm pack -> zero-dep consumer install -> verified exports`,
      JSON.stringify(pkgSmokeRes.results),
    );
  } catch (err) {
    check(false, 'Standalone npm package tarball install', err.message);
  }
} finally {
  server.close();
  rmSync(tempDir, { recursive: true, force: true });
}

console.log(failures ? `\n${failures} smoke check(s) failed` : '\nAll smoke-install checks passed');
process.exitCode = failures ? 1 : 0;
