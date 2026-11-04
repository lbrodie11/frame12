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
//      with `tsc --noEmit`.

import http from 'node:http';
import { chromium } from 'playwright';
import { getRenderedCuts } from '../registry/tests/lib.mjs';
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
          typescript: '^5.8.2',
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
console.log('R19_RUNTIME_OK:' + html.length);
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
    'npx shadcn registry validate passes across root registry.json and registry/registry.json (32 items)',
    validateRes.status !== 0 ? `${validateRes.stdout}\n${validateRes.stderr}` : '',
  );

  // 7. Individual component consumer installation (/r/sheet.json + /r/panel.json + /r/badge.json + /r/switch.json via registryDependencies)
  const singleDir = mkdtempSync(join(tmpdir(), 'frame12-single-'));
  try {
    mkdirSync(join(singleDir, 'src/app'), { recursive: true });
    mkdirSync(join(singleDir, '.shim-bin'), { recursive: true });
    const singleShim = join(singleDir, '.shim-bin/npm');
    writeFileSync(singleShim, '#!/bin/sh\nexit 0\n');
    chmodSync(singleShim, 0o755);
    writeFileSync(join(singleDir, 'src/app/globals.css'), '/* host globals */\n');
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
      ['--yes', 'shadcn', 'add', sheetUrl, panelUrl, badgeUrl, switchUrl, '--yes', '--overwrite'],
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
      existsSync(join(singleDir, 'src/hooks/use-on-twos.ts')) &&
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
export function SingleCheck() {
  return (
    <Sheet autoCut>
      <Panel label="First">One <Badge status="warning">Warn</Badge> <Switch label="TLS" defaultChecked /></Panel>
      <Panel label="Second">Two</Panel>
      <Panel cut={false} label="Unnumbered">None</Panel>
      <Panel label="Third">Three</Panel>
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
      'Individual install (/r/sheet.json + /r/panel.json + /r/badge.json + /r/switch.json) resolves frame12-styles, use-on-twos, tag.json, and field.json via registryDependencies and passes tsc --noEmit',
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
} finally {
  server.close();
  rmSync(tempDir, { recursive: true, force: true });
}

console.log(failures ? `\n${failures} smoke check(s) failed` : '\nAll smoke-install checks passed');
process.exitCode = failures ? 1 : 0;
