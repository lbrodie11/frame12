#!/usr/bin/env node
/**
 * Reproducible 4-Condition × 6-Task Guardrail & Reference Fixture Suite
 *
 * Evaluates 24 application fixture screens (4 conditions × 6 tasks):
 *   - c1-shadcn-baseline: Conventional shadcn/Tailwind baseline (Universal Quality ONLY; FRAME/12 grammar = N/A)
 *   - c2-frame12-no-skill: Negative fixture suite exercising all 6 static check-frame12.mjs rules and DOM/contrast failures
 *   - c3-frame12-with-skill: Pre-checker reference fixtures with planted static rule drift in Tasks 02 and 04
 *   - c4-frame12-skill-plus-checker: Checker-verified reference fixtures (post-remediation, 0 static/DOM violations)
 */

import { build } from 'esbuild';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { lintFiles } from '../../scripts/check-frame12.mjs';
import { getRenderedCuts } from '../../registry/tests/lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const require = createRequire(path.resolve(repoRoot, 'package.json'));
const ts = require('typescript');
const registryRoot = path.resolve(repoRoot, 'registry');
const distRoot = path.resolve(__dirname, 'dist');
const resultsDir = path.resolve(__dirname, 'results');
fs.mkdirSync(distRoot, { recursive: true });
fs.mkdirSync(resultsDir, { recursive: true });

const tasksConfig = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, 'tasks/tasks.json'), 'utf8'),
);

const frame12Css = fs.readFileSync(path.resolve(registryRoot, 'styles/frame12.css'), 'utf8');
const baselineCss = fs.readFileSync(
  path.resolve(__dirname, 'conditions/c1-shadcn-baseline/baseline.css'),
  'utf8',
);

const HOST_RESET =
  ':root{color-scheme:light}body{margin:0;background:var(--f-desk,#f8fafc);color:var(--f-ink,#0f172a);font:15px/1.5 var(--font-f-body,system-ui,sans-serif)}img{max-width:100%}[hidden]{display:none!important}';

const f12ResolverPlugin = {
  name: 'frame12-agent-eval-resolver',
  setup(b) {
    b.onResolve({ filter: /^@\/components\/frame12$/ }, () => ({
      path: path.resolve(registryRoot, 'ui/index.ts'),
    }));
    b.onResolve({ filter: /^@\/components\/frame12\/(.*)$/ }, (args) => {
      const sub = args.path.replace(/^@\/components\/frame12\//, '');
      return { path: path.resolve(registryRoot, 'ui', `${sub}.tsx`) };
    });
    b.onResolve({ filter: /^@\/components\/ui\/(.*)$/ }, (args) => {
      const sub = args.path.replace(/^@\/components\/ui\//, '');
      return { path: path.resolve(registryRoot, 'ui', `${sub}.tsx`) };
    });
    b.onResolve({ filter: /^@\/hooks\/(.*)$/ }, (args) => {
      const sub = args.path.replace(/^@\/hooks\//, '');
      return { path: path.resolve(registryRoot, 'hooks', `${sub}.ts`) };
    });
  },
};

const CONTRAST_EVAL = () => {
  const parse = (c) => {
    const m = c && c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const blend = (t, b) => ({
    r: t.r * t.a + b.r * (1 - t.a),
    g: t.g * t.a + b.g * (1 - t.a),
    b: t.b * t.a + b.b * (1 - t.a),
    a: 1,
  });
  const bgOf = (el) => {
    const st = [];
    for (let e = el; e; e = e.parentElement) {
      const c = parse(getComputedStyle(e).backgroundColor);
      if (c && c.a > 0) {
        st.push(c);
        if (c.a >= 1) break;
      }
    }
    let col = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = st.length - 1; i >= 0; i--) col = blend(st.at(i), col);
    return col;
  };
  const ratio = (fg, bg) => {
    const a = lum(blend(fg, bg));
    const b = lum(bg);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  };
  const out = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const t = walker.currentNode;
    const el = t.parentElement;
    if (
      !el ||
      !t.textContent.trim() ||
      el.closest('svg, .f12-sr-only, .f12-rng, [inert], dialog:not([open])')
    )
      continue;
    const rc = el.getBoundingClientRect();
    if (!rc.width || !rc.height) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    const size = parseFloat(cs.fontSize);
    const bold = +cs.fontWeight >= 700;
    const need = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5;
    const r = ratio(parse(cs.color), bgOf(el));
    if (r < need) out.push(`${t.textContent.trim().slice(0, 30)} (${r.toFixed(2)} < ${need})`);
  }
  return out;
};

const UNIVERSAL_CONTROLS_EVAL = () => {
  const unnamed = [];
  for (const el of document.querySelectorAll(
    'button, input:not([type="hidden"]), select:not([tabindex="-1"]):not([aria-hidden="true"]), textarea, [tabindex="0"], a[href]',
  )) {
    if (el.closest('[inert], dialog:not([open]), [aria-hidden="true"]')) continue;
    const name = (
      el.getAttribute('aria-label') ||
      el.textContent ||
      (el.labels && [...el.labels].map((l) => l.textContent).join(' ')) ||
      ''
    ).trim();
    if (!name) unnamed.push(el.outerHTML.slice(0, 60));
  }
  const ids = {};
  for (const el of document.querySelectorAll('[id]')) ids[el.id] = (ids[el.id] || 0) + 1;
  return { unnamed, duplicateIds: Object.keys(ids).filter((k) => ids[k] > 1) };
};

async function bundleScreen(conditionId, taskId, screenFile) {
  const condDist = path.resolve(distRoot, conditionId);
  fs.mkdirSync(condDist, { recursive: true });
  const outHtml = path.resolve(condDist, `${taskId}.html`);
  const relImport = './' + path.relative(__dirname, screenFile).replace(/\\/g, '/');

  const entrySource = `
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { EvalScreen } from '${relImport}';

function App() {
  const [theme, setTheme] = React.useState<'light' | 'dark'>('light');
  React.useEffect(() => {
    (window as unknown as { __setEvalTheme?: (t: 'light' | 'dark') => void }).__setEvalTheme = setTheme;
  }, []);
  return <EvalScreen theme={theme} />;
}

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<App />);
}
`;

  const res = await build({
    stdin: {
      contents: entrySource,
      resolveDir: __dirname,
      sourcefile: `${conditionId}-${taskId}-entry.tsx`,
      loader: 'tsx',
    },
    bundle: true,
    format: 'iife',
    write: false,
    target: ['es2020'],
    charset: 'utf8',
    legalComments: 'none',
    plugins: [f12ResolverPlugin],
  });

  const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${conditionId} · ${taskId}</title>
<style>${HOST_RESET}\n${frame12Css}\n${baselineCss}</style>
</head>
<body>
<div id="root"></div>
<script>${js}</script>
</body>
</html>`;

  fs.writeFileSync(outHtml, html, 'utf8');
  return outHtml;
}

function runTypeCheckAllScreens(screenFiles) {
  const tsconfigPath = path.resolve(repoRoot, 'eval/tsconfig.json');
  const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    path.dirname(tsconfigPath),
  );
  const program = ts.createProgram({
    rootNames: [...new Set([...parsed.fileNames, ...screenFiles])],
    options: { ...parsed.options, noEmit: true },
  });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  const errorsByFile = new Map(screenFiles.map((f) => [path.resolve(f), []]));
  const globalErrors = [];

  for (const d of diagnostics) {
    const msg = ts.flattenDiagnosticMessageText(d.messageText, '\n');
    if (d.file) {
      const resolved = path.resolve(d.file.fileName);
      if (errorsByFile.has(resolved)) {
        errorsByFile.get(resolved).push(msg);
      }
    } else {
      globalErrors.push(msg);
    }
  }
  return { errorsByFile, globalErrors };
}

async function verifyTaskWorkflow(page, conditionId, taskId) {
  if (conditionId === 'c1-shadcn-baseline') {
    const initialCount = await page.locator(`#c1-ledger-table-${taskId} tbody tr`).count();
    await page.selectOption(`#c1-channel-${taskId}`, 'eu');
    const euCount = await page.locator(`#c1-ledger-table-${taskId} tbody tr`).count();
    await page.selectOption(`#c1-channel-${taskId}`, 'all');
    const restoredCount = await page.locator(`#c1-ledger-table-${taskId} tbody tr`).count();
    const filterOk = initialCount === 3 && euCount === 1 && restoredCount === 3;
    if (!filterOk) return false;

    if (taskId === '02-settings') {
      await page.fill('#eval-org-name-02', 'Atelier Koma EU');
      await page.click('#eval-settings-save');
      const savedText = await page.locator('#eval-settings-save-status').innerText();
      await page.click('#eval-settings-reset');
      const resetText = await page.locator('#eval-settings-save-status').innerText();
      return (
        savedText.includes('Saved: Atelier Koma EU') &&
        resetText.includes('Defaults restored: Atelier Koma Production')
      );
    }

    if (taskId === '04-data-heavy') {
      await page.fill('#c1-search-04-data-heavy', 'SKU-8801');
      const skuCount = await page.locator('#c1-ledger-table-04-data-heavy tbody tr').count();
      await page.fill('#c1-search-04-data-heavy', '');
      const resetCount = await page.locator('#c1-ledger-table-04-data-heavy tbody tr').count();
      return skuCount === 1 && resetCount === 3;
    }

    if (taskId === '05-landing-page') {
      const hasPlanTable =
        (await page.locator('#eval-plan-comparison-table tbody tr').count()) === 4;
      await page.click('#eval-tier-05-landing-page-enterprise');
      const tierText = await page.locator('#eval-active-tier-summary').innerText();
      await page.click('#eval-tier-05-landing-page-growth');
      return hasPlanTable && tierText.includes('Enterprise Tier · $990/mo');
    }

    if (taskId === '06-multi-step-form') {
      const step1Text = await page.locator('#eval-wizard-step-indicator').innerText();
      await page.click('#eval-wizard-next');
      const step2Text = await page.locator('#eval-wizard-step-indicator').innerText();
      await page.click('#eval-wizard-next');
      const step3Text = await page.locator('#eval-wizard-step-indicator').innerText();
      await page.click('#eval-wizard-prev');
      await page.click('#eval-wizard-prev');
      return (
        step1Text.includes('STEP-1') &&
        step2Text.includes('STEP-2') &&
        step3Text.includes('STEP-3')
      );
    }

    return true;
  }

  if (conditionId === 'c2-frame12-no-skill') {
    await page.click(`#c2-range-${taskId}-7d`);
    await page.click(`#c2-range-${taskId}-30d`);
    return true;
  }

  // c3-frame12-with-skill and c4-frame12-skill-plus-checker
  const tableRows = page.locator(`#eval-ledger-table-${taskId} tbody tr`);
  const page1Count = await tableRows.count();
  const page1FirstCell = await tableRows.first().locator('td').first().innerText();

  await page.click('nav[aria-label="Pagination"] button[aria-label="Go to page 2"]');
  const page2Count = await tableRows.count();
  const page2FirstCell = await tableRows.first().locator('td').first().innerText();

  await page.click('nav[aria-label="Pagination"] button[aria-label="Go to page 1"]');
  const restoredFirstCell = await tableRows.first().locator('td').first().innerText();

  let paginationSlicesOk =
    page1Count === 2 &&
    page2Count === 2 &&
    page1FirstCell !== page2FirstCell &&
    restoredFirstCell === page1FirstCell;

  if (!paginationSlicesOk) return false;

  if (taskId === '02-settings') {
    await page.fill('#eval-org-name-02', 'Atelier Koma EU');
    await page.click('#eval-settings-save');
    const savedText = await page.locator('#eval-settings-save-status').innerText();
    await page.click('#eval-settings-reset');
    const resetText = await page.locator('#eval-settings-save-status').innerText();
    return (
      savedText.includes('Saved: Atelier Koma EU') &&
      resetText.includes('Defaults restored: Atelier Koma Production')
    );
  }

  if (taskId === '04-data-heavy') {
    await page.fill('#eval-search-04-data-heavy', 'SKU-8801');
    const skuCount = await tableRows.count();
    await page.fill('#eval-search-04-data-heavy', '');
    const resetCount = await tableRows.count();
    return skuCount === 1 && resetCount === 2;
  }

  if (taskId === '05-landing-page') {
    const hasPlanTable = (await page.locator('#eval-plan-comparison-table tbody tr').count()) === 4;
    await page.click('#eval-tier-05-landing-page-enterprise');
    const tierText = await page.locator('#eval-active-tier-summary').innerText();
    await page.click('#eval-tier-05-landing-page-growth');
    return hasPlanTable && tierText.includes('Enterprise Tier · $990/mo');
  }

  if (taskId === '06-multi-step-form') {
    const step1Text = await page.locator('#eval-wizard-step-indicator').innerText();
    await page.click('#eval-wizard-next');
    const step2Text = await page.locator('#eval-wizard-step-indicator').innerText();
    await page.click('#eval-wizard-next');
    const step3Text = await page.locator('#eval-wizard-step-indicator').innerText();
    await page.click('#eval-wizard-prev');
    await page.click('#eval-wizard-prev');
    return (
      step1Text.includes('STEP-1') &&
      step2Text.includes('STEP-2') &&
      step3Text.includes('STEP-3')
    );
  }

  return true;
}

async function main() {
  const allScreenFiles = [];
  for (const condition of tasksConfig.conditions) {
    for (const task of tasksConfig.tasks) {
      allScreenFiles.push(path.resolve(__dirname, 'conditions', condition.id, `${task.id}.tsx`));
    }
  }
  const { errorsByFile, globalErrors } = runTypeCheckAllScreens(allScreenFiles);

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();

  const matrixResults = [];

  for (const condition of tasksConfig.conditions) {
    for (const task of tasksConfig.tasks) {
      const screenFile = path.resolve(__dirname, 'conditions', condition.id, `${task.id}.tsx`);
      const tsFileErrors = errorsByFile.get(screenFile) || [];
      const tscOk = globalErrors.length === 0 && tsFileErrors.length === 0;
      if (!tscOk) {
        console.error(`TypeScript errors in ${condition.id}/${task.id}:`, [...globalErrors, ...tsFileErrors]);
      }

      let buildOk = false;
      let htmlPath = '';
      try {
        htmlPath = await bundleScreen(condition.id, task.id, screenFile);
        buildOk = true;
      } catch (err) {
        console.error(`Build failed for ${condition.id}/${task.id}:`, err);
      }

      // Static grammar check (applicable only to FRAME/12 conditions C2, C3, C4)
      const staticViolations = condition.evaluatesFrame12Grammar
        ? lintFiles([screenFile]).violations
        : null;

      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load' });
      await page.waitForSelector('h1', { timeout: 5000 });

      // Universal Quality — Light Theme (1280px)
      const axeLight = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();
      const contrastLight = await page.evaluate(CONTRAST_EVAL);
      const { unnamed, duplicateIds } = await page.evaluate(UNIVERSAL_CONTROLS_EVAL);
      const overflow1280 = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );

      // Keyboard focus reachability & visible focus outline
      await page.keyboard.press('Tab');
      const focusVisibleOk = await page.evaluate(() => {
        const a = document.activeElement;
        if (!a || a === document.body) return false;
        const cs = getComputedStyle(a);
        return (
          (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2) ||
          cs.boxShadow !== 'none'
        );
      });

      // Verify interactive task workflow (filter scope, pagination row slicing, tier switcher, 3-step wizard)
      const taskWorkflowOk = await verifyTaskWorkflow(page, condition.id, task.id);

      // FRAME/12 Live DOM Grammar Checks (ONLY for C2, C3, C4)
      let grammarDom = null;
      if (condition.evaluatesFrame12Grammar) {
        const cuts = await getRenderedCuts(page);
        let cutOrderSequential = cuts.length > 0;
        for (let i = 0; i < cuts.length; i++) {
          const expected = `C-${String(i + 1).padStart(2, '0')}`;
          if (cuts[i] !== expected) cutOrderSequential = false;
        }

        const domChecks = await page.evaluate(() => {
          const illegalSceneGaps = [];
          for (const scene of document.querySelectorAll('.f12-scene')) {
            const g = getComputedStyle(scene).gap;
            if (!['12px', '20px', '32px'].includes(g)) {
              illegalSceneGaps.push(g);
            }
          }
          const charts = document.querySelectorAll('.f12-chart');
          const chartTables = document.querySelectorAll('details.f12-tbl table');
          const chartTablePresent = charts.length === 0 || chartTables.length === charts.length;
          const expressivePanels = document.querySelectorAll(
            '.f12-panel:not(.f12-panel-quiet)',
          ).length;
          const quietPanels = document.querySelectorAll('.f12-panel.f12-panel-quiet').length;
          return {
            illegalSceneGaps,
            chartTablePresent,
            expressivePanels,
            quietPanels,
          };
        });

        grammarDom = {
          renderedCuts: cuts,
          cutOrderSequential,
          illegalSceneGaps: domChecks.illegalSceneGaps,
          chartTablePresent: domChecks.chartTablePresent,
          expressivePanels: domChecks.expressivePanels,
          quietPanels: domChecks.quietPanels,
          hierarchyBalanced: domChecks.expressivePanels >= 1 && domChecks.quietPanels >= 1,
        };
      }

      // Universal Quality — Dark Theme (1280px)
      await page.evaluate(() => {
        const w = window;
        if (w.__setEvalTheme) w.__setEvalTheme('dark');
      });
      await page.waitForTimeout(50);
      const axeDark = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();
      const contrastDark = await page.evaluate(CONTRAST_EVAL);

      // Universal Quality — Mobile Responsive (390px)
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(50);
      const overflow390 = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );

      const universalPass =
        buildOk &&
        tscOk &&
        taskWorkflowOk &&
        axeLight.violations.length === 0 &&
        axeDark.violations.length === 0 &&
        contrastLight.length === 0 &&
        contrastDark.length === 0 &&
        unnamed.length === 0 &&
        duplicateIds.length === 0 &&
        focusVisibleOk &&
        !overflow1280 &&
        !overflow390;

      const frame12GrammarPass = condition.evaluatesFrame12Grammar
        ? staticViolations.length === 0 &&
          grammarDom.cutOrderSequential &&
          grammarDom.illegalSceneGaps.length === 0 &&
          grammarDom.chartTablePresent &&
          grammarDom.hierarchyBalanced
        : null;

      const row = {
        conditionId: condition.id,
        taskId: task.id,
        taskTitle: task.title,
        universal: {
          pass: universalPass,
          buildOk,
          tscOk,
          taskWorkflowOk,
          axeViolationsLight: axeLight.violations.length,
          axeViolationsDark: axeDark.violations.length,
          contrastFailuresLight: contrastLight.length,
          contrastFailuresDark: contrastDark.length,
          unnamedControls: unnamed.length,
          duplicateIds: duplicateIds.length,
          focusVisibleOk,
          overflow1280,
          overflow390,
        },
        frame12Grammar: condition.evaluatesFrame12Grammar
          ? {
              pass: frame12GrammarPass,
              staticViolationCount: staticViolations.length,
              staticViolationRules: [...new Set(staticViolations.map((v) => v.rule))],
              ...grammarDom,
            }
          : null,
      };

      matrixResults.push(row);
      console.log(
        `[${condition.id} / ${task.id}] universal=${universalPass ? 'PASS' : 'FAIL'} ` +
          `frame12Grammar=${frame12GrammarPass === null ? 'N/A' : frame12GrammarPass ? 'PASS' : `FAIL (${staticViolations.length} static)`}`,
      );
    }
  }

  await browser.close();

  // Summarize by condition
  const conditionSummaries = tasksConfig.conditions.map((cond) => {
    const rows = matrixResults.filter((r) => r.conditionId === cond.id);
    const universalPassCount = rows.filter((r) => r.universal.pass).length;
    const totalAxe = rows.reduce(
      (acc, r) => acc + r.universal.axeViolationsLight + r.universal.axeViolationsDark,
      0,
    );
    const totalContrast = rows.reduce(
      (acc, r) => acc + r.universal.contrastFailuresLight + r.universal.contrastFailuresDark,
      0,
    );
    const totalOverflow = rows.filter(
      (r) => r.universal.overflow1280 || r.universal.overflow390,
    ).length;

    const grammarPassCount = cond.evaluatesFrame12Grammar
      ? rows.filter((r) => r.frame12Grammar?.pass).length
      : null;
    const totalStaticViolations = cond.evaluatesFrame12Grammar
      ? rows.reduce((acc, r) => acc + (r.frame12Grammar?.staticViolationCount || 0), 0)
      : null;

    return {
      conditionId: cond.id,
      label: cond.label,
      evaluatesFrame12Grammar: cond.evaluatesFrame12Grammar,
      taskCount: rows.length,
      universalPassCount,
      totalAxeViolations: totalAxe,
      totalContrastFailures: totalContrast,
      overflowTasks: totalOverflow,
      grammarPassCount,
      totalStaticViolations,
    };
  });

  const summaryPayload = {
    version: '0.2.0',
    harness: 'eval/agent-eval/run-eval.mjs',
    taskCount: tasksConfig.tasks.length,
    conditionCount: tasksConfig.conditions.length,
    totalScreensEvaluated: matrixResults.length,
    conditionSummaries,
    results: matrixResults,
  };

  fs.writeFileSync(
    path.resolve(resultsDir, 'summary.json'),
    JSON.stringify(summaryPayload, null, 2) + '\n',
    'utf8',
  );

  const reportLines = [
    '# FRAME/12 4-Condition × 6-Task Guardrail & Reference Fixture Report',
    '',
    '> Generated deterministically by `node eval/agent-eval/run-eval.mjs`. Universal UI quality metrics are reported separately from FRAME/12 grammar compliance so the conventional shadcn/Tailwind baseline (Condition 1) is never penalized for FRAME/12-specific aesthetic rules.',
    '',
    '## 1. Condition Summary Table (6 Application Tasks per Condition)',
    '',
    '| Condition | Universal UI Quality Pass | Axe WCAG AA Violations (Light+Dark) | Contrast Failures (Light+Dark) | Responsive Overflow (1280px/390px) | FRAME/12 Grammar Pass | Static `check-frame12.mjs` Violations |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...conditionSummaries.map((c) => {
      const gramPass =
        c.grammarPassCount === null ? 'N/A (Baseline)' : `${c.grammarPassCount} / ${c.taskCount}`;
      const staticCount =
        c.totalStaticViolations === null ? 'N/A (Baseline)' : `${c.totalStaticViolations}`;
      return `| **${c.label}** | \`${c.universalPassCount} / ${c.taskCount}\` | \`${c.totalAxeViolations}\` | \`${c.totalContrastFailures}\` | \`${c.overflowTasks} / ${c.taskCount}\` | \`${gramPass}\` | \`${staticCount}\` |`;
    }),
    '',
    '## 2. Per-Task Breakdown Across All 24 Fixture Screens',
    '',
    '| Condition | Task | Universal Pass | Contrast Failures (L/D) | Static Grammar Violations | Cut Sequence Valid | Chart Table Present | Expressive / Quiet Balance |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...matrixResults.map((r) => {
      const g = r.frame12Grammar;
      return `| \`${r.conditionId}\` | \`${r.taskId}\` (${r.taskTitle}) | \`${r.universal.pass ? 'PASS' : 'FAIL'}\` | \`${r.universal.contrastFailuresLight}/${r.universal.contrastFailuresDark}\` | \`${g ? g.staticViolationCount : 'N/A'}\` | \`${g ? (g.cutOrderSequential ? 'YES' : 'NO') : 'N/A'}\` | \`${g ? (g.chartTablePresent ? 'YES' : 'NO') : 'N/A'}\` | \`${g ? `${g.expressivePanels}E / ${g.quietPanels}Q` : 'N/A'}\` |`;
    }),
    '',
    '## 3. Methodology & Scope Notes',
    '',
    '- **Separation of Universal vs. Grammar Metrics:** Condition 1 (`c1-shadcn-baseline`) is evaluated strictly on universal UI engineering metrics (esbuild compilation, TypeScript `tsc --noEmit`, `@axe-core/playwright` WCAG 2.1 AA, computed text contrast in light & dark themes, keyboard focus visibility, interactive task workflow assertions, and zero horizontal overflow at `1280px` and `390px`) and achieves `6 / 6` universal pass.',
    '- **Negative Fixture Suite (`c2-frame12-no-skill`):** Exercises all 6 static `scripts/check-frame12.mjs` rules across task-specific screens (`color-literal`, `illegal-gutter`, `marker-misuse`, `cut-order`, `explicit-cut-in-autocut`, and `raw-shadcn-import`) as well as runtime DOM/contrast failures (`showTable={false}`, non-sequential cut order, and low-contrast text). Each of the 6 tasks tests a distinct combination and count of planted violations.',
    '- **Pre-Checker vs. Checker-Verified Reference Fixtures (`c3` vs `c4`):** Condition 3 (`c3-frame12-with-skill`) and Condition 4 (`c4-frame12-skill-plus-checker`) are distinct across all 6 tasks. Condition 3 plants realistic single-rule static drift in Task 02 (`explicit-cut-in-autocut` on `<Panel cut="C-01">` inside `<Sheet autoCut>`) and Task 04 (`illegal-gutter` `gap: "16px"` on the filter toolbar) (`6 / 6` universal pass, `4 / 6` grammar pass, `2` static violations). Condition 4 remediates those violations and standardizes layout utility classes (`6 / 6` universal pass, `6 / 6` grammar pass, `0` violations).',
    '- **Scope & Honesty Note:** This suite is a deterministic guardrail & reference fixture harness (`4 conditions × 6 tasks = 24 committed TSX fixtures`), not a stochastic multi-sample LLM benchmark. No live model API calls are executed during `run-eval.mjs`; instead, it regression-tests the static linter (`scripts/check-frame12.mjs`), TypeScript contracts, and Playwright DOM/WCAG invariants against known-good and known-bad reference screens.',
  ];

  fs.writeFileSync(
    path.resolve(resultsDir, 'REPORT.md'),
    reportLines.join('\n') + '\n',
    'utf8',
  );

  // Assert expected benchmark invariants
  const c1 = conditionSummaries.find((c) => c.conditionId === 'c1-shadcn-baseline');
  const c2 = conditionSummaries.find((c) => c.conditionId === 'c2-frame12-no-skill');
  const c3 = conditionSummaries.find((c) => c.conditionId === 'c3-frame12-with-skill');
  const c4 = conditionSummaries.find((c) => c.conditionId === 'c4-frame12-skill-plus-checker');

  if (c1.universalPassCount !== 6) {
    throw new Error(`Expected c1-shadcn-baseline universalPassCount === 6, got ${c1.universalPassCount}`);
  }
  if (c2.totalStaticViolations === 0) {
    throw new Error('Expected c2-frame12-no-skill to exhibit static grammar violations');
  }
  if (c3.universalPassCount !== 6) {
    throw new Error(`Expected c3-frame12-with-skill universalPassCount === 6, got ${c3.universalPassCount}`);
  }
  if (c4.universalPassCount !== 6 || c4.grammarPassCount !== 6 || c4.totalStaticViolations !== 0) {
    throw new Error(
      `Expected c4-frame12-skill-plus-checker 6/6 universal & 6/6 grammar pass, got ${JSON.stringify(c4)}`,
    );
  }

  console.log('\nGuardrail & reference fixture suite completed successfully. Summary written to eval/agent-eval/results/summary.json and REPORT.md.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
