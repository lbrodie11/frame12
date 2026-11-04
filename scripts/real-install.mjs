#!/usr/bin/env node
// End-to-end fresh Next.js + shadcn init -d + registry install + <Sheet autoCut> + next build verification.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { getRenderedCuts } from '../registry/tests/lib.mjs';

function runCmd(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: 'inherit' });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(' ')} exited with code ${code}`));
    });
  });
}

function getFreePort() {
  return new Promise((resolvePort, rejectPort) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => {
      const p = s.address().port;
      s.close(() => resolvePort(p));
    });
    s.on('error', rejectPort);
  });
}

const repoRoot = process.cwd();
const pubDir = path.join(repoRoot, 'site/public/r');
const canonicalRegistryRaw = fs.readFileSync(path.join(repoRoot, 'registry/registry.json'), 'utf8');
const canonicalItemsByName = new Map(
  (JSON.parse(canonicalRegistryRaw).items || []).map((item) => [item.name, item]),
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

const srv = http.createServer((req, res) => {
  const fileName = path.basename((req.url || '').split('?')[0]);
  const file = path.join(pubDir, fileName);
  if (file.startsWith(pubDir) && fs.existsSync(file)) {
    const hostOrigin = `http://${req.headers.host || '127.0.0.1'}`;
    const registryBaseUrl = `${hostOrigin}/r`;
    let body;
    if (fileName === 'registry.json') {
      body = canonicalRegistryRaw.replaceAll('https://frame12.dev/r/', `${registryBaseUrl}/`);
    } else {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      const canonicalItem = canonicalItemsByName.get(parsed.name);
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
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

srv.listen(0, '127.0.0.1', async () => {
  const port = srv.address().port;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'frame12-next-app-'));
  try {
    await runCmd(
      'npx',
      [
        '--yes',
        'create-next-app@latest',
        'app',
        '--ts',
        '--tailwind',
        '--eslint',
        '--app',
        '--src-dir',
        '--import-alias',
        '@/*',
        '--use-npm',
        '--yes',
      ],
      tmp,
    );
    const appDir = path.join(tmp, 'app');
    await runCmd('npx', ['--yes', 'shadcn@latest', 'init', '-d', '--yes'], appDir);

    // 1. Install sheet.json, panel.json, and badge.json individually (resolving frame12-styles, use-on-twos, and tag.json via registryDependencies)
    await runCmd(
      'npx',
      [
        '--yes',
        'shadcn@latest',
        'add',
        `http://127.0.0.1:${port}/r/sheet.json`,
        `http://127.0.0.1:${port}/r/panel.json`,
        `http://127.0.0.1:${port}/r/badge.json`,
        '--yes',
        '--overwrite',
      ],
      appDir,
    );

    for (const expectedRel of [
      'src/components/frame12/sheet.tsx',
      'src/components/frame12/panel.tsx',
      'src/components/frame12/badge.tsx',
      'src/components/frame12/tag.tsx',
      'src/hooks/use-on-twos.ts',
      'src/styles/frame12.css',
    ]) {
      if (!fs.existsSync(path.join(appDir, expectedRel))) {
        throw new Error(`Expected installed file missing after shadcn add: ${expectedRel}`);
      }
    }

    const pageSource = [
      'import "@/styles/frame12.css";',
      'import { Sheet } from "@/components/frame12/sheet";',
      'import { Panel } from "@/components/frame12/panel";',
      'import { Badge } from "@/components/frame12/badge";',
      'import { Tag } from "@/components/frame12/tag";',
      '',
      'export default function Page() {',
      '  return (',
      '    <Sheet autoCut>',
      '      <Panel label="First">',
      '        One <Badge status="warning">Warn</Badge>',
      '        <Tag id="tailwind-icon-tag">',
      '          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">',
      '            <rect width="10" height="10" />',
      '          </svg>',
      '          LIVE',
      '        </Tag>',
      '      </Panel>',
      '      <Panel label="Second">Two</Panel>',
      '    </Sheet>',
      '  );',
      '}',
      '',
    ].join('\n');

    fs.writeFileSync(path.join(appDir, 'src/app/page.tsx'), pageSource);

    await runCmd('npx', ['next', 'build'], appDir);

    const appPort = await getFreePort();
    const nextProc = spawn('npx', ['next', 'start', '-p', String(appPort), '-H', '127.0.0.1'], {
      cwd: appDir,
      stdio: 'ignore',
    });
    try {
      for (let i = 0; i < 60; i++) {
        try {
          const r = await fetch(`http://127.0.0.1:${appPort}/`);
          if (r.ok) break;
        } catch {
          // wait for server
        }
        await new Promise((r) => setTimeout(r, 250));
      }
      const browser = await chromium.launch({ args: ['--no-sandbox'] });
      try {
        const page = await browser.newPage();
        await page.goto(`http://127.0.0.1:${appPort}/`, { waitUntil: 'networkidle' });
        const cuts = await getRenderedCuts(page);
        if (cuts.join(',') !== 'C-01,C-02') {
          throw new Error(`Expected C-01,C-02 in fresh app, got: ${cuts.join(',')}`);
        }
        const tagIconOk = await page.evaluate(() => {
          const tag = document.querySelector('#tailwind-icon-tag');
          const svg = document.querySelector('#tailwind-icon-tag svg');
          return Boolean(
            tag &&
              svg &&
              getComputedStyle(svg).display === 'inline-block' &&
              tag.getBoundingClientRect().height <= 26,
          );
        });
        if (!tagIconOk) {
          throw new Error('Expected <Tag><svg/>LIVE</Tag> to stay inline on one line in Tailwind app');
        }
        console.log(
          'PASS  Fresh app individual sheet.json + panel.json <Sheet autoCut> rendered:',
          cuts.join(', '),
        );
      } finally {
        await browser.close();
      }
    } finally {
      nextProc.kill('SIGTERM');
    }

    // 2. Install frame12-base.json (registry:base + registry:font) and verify no self-referencing --font-f-* variables
    await runCmd(
      'npx',
      [
        '--yes',
        'shadcn@latest',
        'add',
        `http://127.0.0.1:${port}/r/frame12-base.json`,
        '--yes',
        '--overwrite',
      ],
      appDir,
    );
    const globalsCssPath = path.join(appDir, 'src/app/globals.css');
    if (fs.existsSync(globalsCssPath)) {
      const globalsCss = fs.readFileSync(globalsCssPath, 'utf8');
      if (/--font-f-(?:display|body|mono)\s*:\s*var\(--font-f-(?:display|body|mono)\)/.test(globalsCss)) {
        throw new Error(
          `Found self-referencing --font-f-* CSS variable in globals.css:\n${globalsCss}`,
        );
      }
    }

    // 3. Install full kit (frame12.json) and verify next build
    await runCmd(
      'npx',
      [
        '--yes',
        'shadcn@latest',
        'add',
        `http://127.0.0.1:${port}/r/frame12.json`,
        '--yes',
        '--overwrite',
      ],
      appDir,
    );
    await runCmd('npx', ['next', 'build'], appDir);
    console.log('PASS  Fresh app frame12-base.json + frame12.json full-kit next build succeeded');
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    srv.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
