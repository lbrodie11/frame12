#!/usr/bin/env node
/**
 * Reference app: a build pipeline (lint → typecheck → test → build) on a small fixture project,
 * each step a cut, run for real through spawnLogged (its output lands in the log, never on the
 * terminal directly).
 *
 *   node app.mjs [--project <dir>] [--break lint|typecheck|test|build] [--format …] [--record …]
 *
 * A failing step ends its cut as `error` and becomes a `danger` finding whose receipts are the
 * evidence: the failing tests (`test` receipts) and the step's last error lines (`log` receipts),
 * a keypress away in the live view's Inspector. Later steps are skipped, not run.
 *
 * Steps run with this Node, never through a shell (so npm's .cmd shims on Windows do not matter):
 * the commands are the fixture project's package.json scripts, which all start with `node`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnLogged } from '@frame12/terminal/process';
import { option, startApp } from '../lib/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const STEPS = [
  { id: 'lint', title: 'Lint' },
  { id: 'typecheck', title: 'Typecheck' },
  { id: 'test', title: 'Test' },
  { id: 'build', title: 'Build' },
];

/** `node scripts/x.mjs a b` → [script, a, b]; this app only runs scripts that start with node. */
export function nodeArgs(script) {
  const parts = script.trim().split(/\s+/);
  if (parts[0] !== 'node') throw new Error(`only "node …" scripts run here: ${script}`);
  return parts.slice(1);
}

/** What a failed step's log says: failing test names (node:test TAP) and the last error lines. */
export function evidenceFrom(lines) {
  const tests = [];
  for (const l of lines) {
    const m = /^not ok \d+ - (.+)$/.exec(l.text.trim());
    if (m && !/^tests[\\/]/.test(m[1])) tests.push(m[1]);
  }
  // The lines that say what went wrong: stderr, and assertion messages and values from node:test's
  // report; not its YAML scaffolding (`error: |-`, `code:`, `stack:`, `---`).
  const scaffolding = /^(?:#|---|\.\.\.|[\w]+:\s*(?:\|-|>-)?\s*$|(?:code|name|operator|stack|location|failureType|type|duration_ms):)/;
  const errors = lines
    .filter((l) => l.stream === 'stderr' || /Expected|AssertionError|Error:|expected:|actual:|\+ actual|- expected/.test(l.text))
    .map((l) => l.text.trim())
    .filter((t) => t && !scaffolding.test(t) && !/exited with code/.test(t));
  return { tests, errors: [...new Set(errors)].slice(-6) };
}

async function main(argv) {
  const project = path.resolve(option(argv, '--project') ?? path.join(HERE, 'project'));
  const broken = option(argv, '--break');
  const pkg = JSON.parse(fs.readFileSync(path.join(project, 'package.json'), 'utf8'));
  const runId = `build-${Date.now().toString(36)}`;
  const startedAt = new Date().toISOString();
  const abort = new AbortController();
  const { run, emit, cut, skip, cuts } = startApp(argv, { runId, product: 'Build', onCancel: () => abort.abort() });
  const title = `Build ${pkg.name}`;
  emit('run-start', { title, product: 'Build', command: STEPS.map((s) => `npm run ${s.id}`).join(' && ') });

  const findings = [];
  let failedAt;
  const passed = [];
  for (const step of STEPS) {
    if (failedAt || abort.signal.aborted) {
      skip(step.id, step.title, abort.signal.aborted ? 'canceled' : `skipped: ${failedAt} failed`);
      continue;
    }
    const outcome = await cut(step.id, step.title, async () => {
      const r = await spawnLogged(run.director, process.execPath, nodeArgs(pkg.scripts[step.id]), {
        cwd: project,
        cut: step.id,
        signal: abort.signal,
        env: { ...process.env, BREAK: broken ?? '' },
      });
      if (r.code === 0) return { summary: lastLine(run, step.id) };
      return { status: 'error', summary: r.error ?? `npm run ${step.id} exited with ${r.signal ?? r.code}` };
    });
    if (outcome.status === 'error') {
      failedAt = step.id;
      const lines = run.director.snapshot().logs.filter((l) => l.cut === step.id);
      const { tests, errors } = evidenceFrom(lines);
      const finding = {
        id: `step-${step.id}-failed`,
        title: tests.length > 0 ? `${step.title} failed: ${tests.length} failing test${tests.length === 1 ? '' : 's'}` : `${step.title} failed`,
        summary: `npm run ${step.id} (${pkg.scripts[step.id]}) ${outcome.summary.replace(/^npm run \S+ /, '')}. Later steps were skipped.`,
        subject: [{ kind: 'step', label: `npm run ${step.id}` }],
        prominence: 'hero',
        status: 'danger',
        receipts: [...tests.map((t) => ({ kind: 'test', value: t, note: 'failing test' })), ...errors.map((e) => ({ kind: 'log', value: e }))],
      };
      findings.push(finding);
      emit('finding', { cut: step.id, finding });
    } else passed.push(step.id);
  }

  const status = abort.signal.aborted ? 'canceled' : failedAt ? 'failed' : 'completed';
  emit('run-end', { status });
  const metrics = [
    { name: 'steps-passed', label: 'Steps passed', value: passed.length },
    { name: 'steps-total', label: 'Steps', value: STEPS.length },
  ];
  emit('snapshot', {
    snapshot: {
      schemaVersion: 1,
      runId,
      title,
      status,
      startedAt,
      finishedAt: new Date().toISOString(),
      cuts,
      metrics,
      findings,
      warnings: [],
      ...(failedAt ? { error: `npm run ${failedAt} failed` } : {}),
    },
  });
  return run.end();
}

/** The last line a step printed, as its cut summary ("test: 3 passed"). */
function lastLine(run, cutId) {
  const lines = run.director.snapshot().logs.filter((l) => l.cut === cutId && l.stream === 'stdout' && !/exited with code/.test(l.text));
  const tap = lines.map((l) => /^# (pass|fail) (\d+)$/.exec(l.text.trim())).filter(Boolean);
  if (tap.length) return tap.map((m) => `${m[2]} ${m[1] === 'pass' ? 'passed' : 'failed'}`).join(', ');
  return lines.at(-1)?.text;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
