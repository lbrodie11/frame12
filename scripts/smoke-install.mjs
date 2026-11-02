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
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(readFileSync(filePath));
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
        style: 'new-york',
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
    'src/components/frame12/input.tsx',
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
  Input,
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
          <Input label="Name" />
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
} finally {
  server.close();
  rmSync(tempDir, { recursive: true, force: true });
}

console.log(failures ? `\n${failures} smoke check(s) failed` : '\nAll smoke-install checks passed');
process.exitCode = failures ? 1 : 0;
