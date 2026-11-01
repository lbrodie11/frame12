// Unit and CLI tests for scripts/check-frame12.mjs
// Verifies that every violation rule (color-literal, illegal-gutter, marker-misuse,
// cut-order, raw-shadcn-import) is caught and that compliant code passes cleanly.

import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lintSource } from '../../scripts/check-frame12.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');
const CHECKER_PATH = resolve(REPO_ROOT, 'scripts/check-frame12.mjs');

let failures = 0;
function check(ok, label, detail = '') {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`);
}

// 1. Compliant FRAME/12 screen passes with 0 violations
{
  const cleanCode = `
    import * as React from 'react';
    import { Sheet, Scene, Panel, PanelPair, Button, Badge, Tag } from '@frame12/registry';

    export function CleanScreen() {
      return (
        <Sheet>
          <Scene gutter="scene" layout="split">
            <Panel cut="C-01" label="Primary panel">
              <div style={{ display: 'flex', gap: 'var(--f-gutter-pair)', color: 'var(--f-ink)' }}>
                <span style={{ background: 'var(--f-marker)', color: 'var(--f-marker-ink)' }}>
                  Highlighted
                </span>
                <Button variant="primary">Save</Button>
              </div>
            </Panel>
            <PanelPair
              top={{ cut: 'C-02', label: 'Top KPI', children: <Tag>OK</Tag> }}
              bottom={{ cut: 'C-03', label: 'Bottom KPI', children: <Badge>99%</Badge> }}
            />
          </Scene>
        </Sheet>
      );
    }
  `;
  const res = lintSource(cleanCode, 'eval/screens/clean.tsx');
  check(res.length === 0, 'linter: clean FRAME/12 component passes with 0 violations', JSON.stringify(res));
}

// 2. Rule 1: color-literal
{
  const hexCode = `export const Box = () => <div style={{ color: '#ef4444', background: 'rgb(10, 20, 30)' }} />;`;
  const res = lintSource(hexCode, 'eval/screens/bad-color.tsx');
  const rules = res.map((v) => v.rule);
  check(
    res.length === 2 && rules.every((r) => r === 'color-literal'),
    'linter [color-literal]: flags hex (#ef4444) and rgb(...) literals in TSX',
  );

  const fontCode = `.bad { font-family: "Dela Gothic One", sans-serif; color: hsl(120, 50%, 50%); }`;
  const resCss = lintSource(fontCode, 'eval/screens/bad.css');
  check(
    resCss.length === 2 && resCss.every((v) => v.rule === 'color-literal'),
    'linter [color-literal]: flags hard-coded font family and hsl(...) in CSS outside token files',
  );

  const tokenRes = lintSource(`:root { --f-ink: #121212; }`, 'registry/styles/frame12.css');
  check(tokenRes.length === 0, 'linter [color-literal]: exempts token file frame12.css');
}

// 3. Rule 2: illegal-gutter
{
  const badSceneGutter = `
    import { Scene } from '@frame12/registry';
    export const S = () => <Scene gutter="wide" layout="split"><div style={{ gap: '16px' }} /></Scene>;
  `;
  const res = lintSource(badSceneGutter, 'eval/screens/bad-gutter.tsx');
  check(
    res.length === 2 && res.every((v) => v.rule === 'illegal-gutter'),
    'linter [illegal-gutter]: flags invalid <Scene gutter="wide"> and inline gap: "16px"',
  );

  const badTailwindGap = `export const G = () => <div className="grid gap-4 gap-x-6" />;`;
  const resTw = lintSource(badTailwindGap, 'eval/screens/bad-tw-gap.tsx');
  check(
    resTw.length === 2 && resTw.every((v) => v.rule === 'illegal-gutter'),
    'linter [illegal-gutter]: flags Tailwind gap-4 and gap-x-6 classes',
  );

  const goodGutters = `
    export const Ok = () => (
      <div className="gap-gutter-pair gap-[20px]" style={{ gap: '12px 20px', rowGap: 'var(--f-gutter-change)' }} />
    );
  `;
  const resGood = lintSource(goodGutters, 'eval/screens/good-gutter.tsx');
  check(resGood.length === 0, 'linter [illegal-gutter]: allows 12px, 20px, 32px, and --f-gutter-* tokens');
}

// 4. Rule 3: marker-misuse
{
  const badMarkerProp = `
    export const M = () => (
      <div style={{ color: 'var(--f-marker)', borderColor: 'var(--f-marker)' }}>
        <svg><path stroke="var(--f-marker)" /></svg>
      </div>
    );
  `;
  const res = lintSource(badMarkerProp, 'eval/screens/bad-marker.tsx');
  check(
    res.length === 3 && res.every((v) => v.rule === 'marker-misuse'),
    'linter [marker-misuse]: flags --f-marker on color, borderColor, and SVG stroke',
  );

  const badMarkerUnpairedBg = `
    export const M2 = () => <span style={{ background: 'var(--f-marker)', color: 'var(--f-ink)' }}>Warn</span>;
  `;
  const resUnpaired = lintSource(badMarkerUnpairedBg, 'eval/screens/bad-marker-bg.tsx');
  check(
    resUnpaired.length === 1 && resUnpaired[0].rule === 'marker-misuse',
    'linter [marker-misuse]: flags --f-marker background when not paired with --f-marker-ink text',
  );
}

// 5. Rule 4: cut-order
{
  const dupAndOutOfOrder = `
    import { Panel } from '@frame12/registry';
    export const C = () => (
      <>
        <Panel cut="C-01">First</Panel>
        <Panel cut="C-03">Skipped C-02</Panel>
        <Panel cut="C-03">Duplicate C-03</Panel>
      </>
    );
  `;
  const res = lintSource(dupAndOutOfOrder, 'eval/screens/bad-cuts.tsx');
  check(
    res.length === 2 && res.every((v) => v.rule === 'cut-order'),
    'linter [cut-order]: flags skipped cut (C-01 -> C-03) and duplicate cut (C-03)',
  );

  const wrongStartAndFormat = `
    import { Panel } from '@frame12/registry';
    export const C2 = () => (
      <>
        <Panel cut="C-02">Starts at 2</Panel>
        <Panel cut="C-3">Malformed single digit</Panel>
      </>
    );
  `;
  const res2 = lintSource(wrongStartAndFormat, 'eval/screens/bad-cuts-2.tsx');
  check(
    res2.length === 2 && res2.every((v) => v.rule === 'cut-order'),
    'linter [cut-order]: flags non-C-01 start and malformed C-3 label',
  );
}

// 6. Rule 5: raw-shadcn-import
{
  const badImports = `
    import { Button } from '@/components/ui/button';
    import { Tabs } from '@/components/ui/tabs';
    import * as DialogPrimitive from '@radix-ui/react-dialog';
    import { AreaChart } from 'recharts';
    export const X = () => null;
  `;
  const res = lintSource(badImports, 'eval/screens/bad-imports.tsx');
  check(
    res.length === 4 && res.every((v) => v.rule === 'raw-shadcn-import'),
    'linter [raw-shadcn-import]: flags @/components/ui/button, tabs, @radix-ui/react-dialog, and recharts',
  );
}

// 7. End-to-end CLI exit code check
{
  const tmpDir = resolve(__dirname, '../.f12-run-linter');
  mkdirSync(tmpDir, { recursive: true });
  const badFile = resolve(tmpDir, 'drift-fixture.tsx');
  writeFileSync(
    badFile,
    `import { Button } from '@/components/ui/button';\nexport const F = () => <div style={{ color: '#ff0000', gap: '18px' }} />;`,
  );

  const failRun = spawnSync(process.execPath, [CHECKER_PATH, badFile], { encoding: 'utf8' });
  check(
    failRun.status === 1 &&
      failRun.stderr.includes('[color-literal]') &&
      failRun.stderr.includes('[illegal-gutter]') &&
      failRun.stderr.includes('[raw-shadcn-import]'),
    'linter CLI: exits with code 1 and reports rule IDs on drifting fixture',
  );

  const passRun = spawnSync(process.execPath, [CHECKER_PATH, resolve(REPO_ROOT, 'registry/ui')], {
    encoding: 'utf8',
  });
  check(
    passRun.status === 0 && passRun.stdout.includes('PASS  check-frame12'),
    'linter CLI: exits with code 0 on registry/ui',
  );

  rmSync(tmpDir, { recursive: true, force: true });
}

console.log(failures ? `\n${failures} linter check(s) failed` : '\nAll linter checks passed');
process.exitCode = failures ? 1 : 0;
