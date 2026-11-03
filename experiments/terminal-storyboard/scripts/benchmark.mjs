import { performance } from 'node:perf_hooks';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runGitHistoryWorkload } from '../dist/workload/git-history.js';
import { PlainStreamPrinter, renderPlainSummary } from '../dist/render-plain/index.js';
import { InkStreamController, renderInkStaticSummary } from '../dist/render-ink/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../../..');

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

async function runSingleMode(style, maxCommits = 200) {
  let renderMs = 0;
  const t0 = performance.now();

  if (style === 'plain') {
    const r0 = performance.now();
    const printer = new PlainStreamPrinter(() => {}, { columns: 80, isTTY: true });
    renderMs += performance.now() - r0;

    const result = await runGitHistoryWorkload({
      repoPath: repoRoot,
      maxCommits,
      topN: 5,
      onEvent: (ev) => {
        const s0 = performance.now();
        printer.onEvent(ev);
        renderMs += performance.now() - s0;
      },
    });

    const f0 = performance.now();
    renderPlainSummary(result.snapshot, { columns: 80, isTTY: true });
    renderMs += performance.now() - f0;

    const totalMs = performance.now() - t0;
    const workloadMs = Math.max(0, totalMs - renderMs);
    return {
      totalMs: Number(totalMs.toFixed(2)),
      workloadMs: Number(workloadMs.toFixed(2)),
      renderMs: Number(renderMs.toFixed(2)),
    };
  }

  const r0 = performance.now();
  const controller = new InkStreamController({
    write: () => {},
    columns: 80,
    isTTY: true,
  });
  renderMs += performance.now() - r0;

  let result;
  try {
    result = await runGitHistoryWorkload({
      repoPath: repoRoot,
      maxCommits,
      topN: 5,
      onEvent: (ev) => {
        const s0 = performance.now();
        controller.onEvent(ev);
        renderMs += performance.now() - s0;
      },
    });
  } finally {
    const d0 = performance.now();
    await controller.dispose();
    renderMs += performance.now() - d0;
  }

  const f0 = performance.now();
  renderInkStaticSummary(result.snapshot, result.events, { columns: 80, isTTY: true });
  renderMs += performance.now() - f0;

  const totalMs = performance.now() - t0;
  const workloadMs = Math.max(0, totalMs - renderMs);
  return {
    totalMs: Number(totalMs.toFixed(2)),
    workloadMs: Number(workloadMs.toFixed(2)),
    renderMs: Number(renderMs.toFixed(2)),
  };
}

const WARMUP_RUNS = 2;
const MEASURED_RUNS = 7;

const report = {
  target: 'frame12 (--max-commits 200)',
  warmupRuns: WARMUP_RUNS,
  measuredRuns: MEASURED_RUNS,
  plain: { raw: [], medians: {} },
  panels: { raw: [], medians: {} },
};

for (const style of ['plain', 'panels']) {
  for (let i = 0; i < WARMUP_RUNS; i++) {
    await runSingleMode(style, 200);
  }
  for (let i = 0; i < MEASURED_RUNS; i++) {
    const sample = await runSingleMode(style, 200);
    report[style].raw.push(sample);
  }
  report[style].medians = {
    totalMs: Number(median(report[style].raw.map((r) => r.totalMs)).toFixed(2)),
    workloadMs: Number(median(report[style].raw.map((r) => r.workloadMs)).toFixed(2)),
    renderMs: Number(median(report[style].raw.map((r) => r.renderMs)).toFixed(2)),
  };
}

console.log(JSON.stringify(report, null, 2));
