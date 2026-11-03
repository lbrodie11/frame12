import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runGitHistoryWorkload } from '../dist/workload/git-history.js';
import { PlainStreamPrinter, renderPlainSummary } from '../dist/render-plain/index.js';
import { InkStreamController, renderInkStaticSummary } from '../dist/render-ink/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const expRoot = resolve(__dirname, '..');
const repoRoot = resolve(__dirname, '../../..');
const cliBin = resolve(expRoot, 'dist/bin/storyboard.js');

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

function runPtySubprocess(style, maxCommits = 200) {
  const pyScript = [
    'import os, pty, select, subprocess, sys, time',
    't0 = time.perf_counter()',
    'master_out, slave_out = pty.openpty()',
    'master_err, slave_err = pty.openpty()',
    'proc = subprocess.Popen(sys.argv[1:], stdin=subprocess.DEVNULL, stdout=slave_out, stderr=slave_err, close_fds=True)',
    'os.close(slave_out)',
    'os.close(slave_err)',
    'fds = [master_out, master_err]',
    'while fds:',
    '    r, _, _ = select.select(fds, [], [], 0.1)',
    '    for fd in r:',
    '        try:',
    '            data = os.read(fd, 4096)',
    '            if not data:',
    '                fds.remove(fd)',
    '                os.close(fd)',
    '        except OSError:',
    '            fds.remove(fd)',
    '            os.close(fd)',
    'proc.wait()',
    'elapsed = (time.perf_counter() - t0) * 1000.0',
    'print(f"{elapsed:.2f}")',
  ].join('\n');

  const res = spawnSync(
    'python3',
    ['-c', pyScript, process.execPath, cliBin, 'run', repoRoot, '--max-commits', String(maxCommits), '--style', style],
    { encoding: 'utf8', env: { ...process.env, TERM: 'xterm-256color', CI: '' } },
  );
  return Number(res.stdout.trim()) || 0;
}

const report = {
  target: 'frame12 (--max-commits 200)',
  warmupRuns: WARMUP_RUNS,
  measuredRuns: MEASURED_RUNS,
  plain: { raw: [], medians: {}, ptySubprocessMedianMs: 0 },
  panels: { raw: [], medians: {}, ptySubprocessMedianMs: 0 },
};

for (const style of ['plain', 'panels']) {
  for (let i = 0; i < WARMUP_RUNS; i++) {
    await runSingleMode(style, 200);
  }
  const ptySamples = [];
  for (let i = 0; i < MEASURED_RUNS; i++) {
    const sample = await runSingleMode(style, 200);
    report[style].raw.push(sample);
    if (i < 3) {
      ptySamples.push(runPtySubprocess(style, 200));
    }
  }
  report[style].medians = {
    totalMs: Number(median(report[style].raw.map((r) => r.totalMs)).toFixed(2)),
    workloadMs: Number(median(report[style].raw.map((r) => r.workloadMs)).toFixed(2)),
    renderMs: Number(median(report[style].raw.map((r) => r.renderMs)).toFixed(2)),
  };
  report[style].ptySubprocessMedianMs = Number(median(ptySamples).toFixed(2));
}

console.log(JSON.stringify(report, null, 2));
