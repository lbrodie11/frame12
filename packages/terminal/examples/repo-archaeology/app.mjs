#!/usr/bin/env node
/**
 * Reference app: a Repo Archaeology investigation, told as cuts.
 *
 *   node app.mjs --repo <git dir> --base <ref> [--head <ref>] [--format …] [--record run.f12rec]
 *   node app.mjs --fixture [--format …]           # the committed hono 61f7c59 fixture, offline
 *
 * It wraps the published `repo-archaeology` CLI (pinned 0.10.0) as a child process: no analysis of
 * its own. `diff --json-out` gives the suggestions while the CLI's own progress lines stream into
 * the log through spawnLogged; `explain --json` adds counterexamples for the top pair. The adapter
 * (`adapter.mjs`) maps the v1 JSON to findings.
 *
 * Repo Archaeology is found as an installed package (`npm i repo-archaeology@0.10.0` next to this
 * app, or globally on NODE_PATH), or given with `--ra <path to its dist/cli.js>`. It is run with
 * this Node, never through a shell.
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnLogged } from '@frame12/terminal/process';
import { flag, option, startApp } from '../lib/run.mjs';
import { findingsFromDiff, metricsFromDiff, snapshotFrom } from './adapter.mjs';

export const RA_VERSION = '0.10.0';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = { diff: path.join(HERE, 'fixtures/hono-61f7c59.diff.json'), explain: path.join(HERE, 'fixtures/hono-61f7c59.explain.json') };

/** The repo-archaeology CLI script: `--ra`, or the installed package's bin. */
export function findRepoArchaeology(argv) {
  const given = option(argv, '--ra');
  if (given) return path.resolve(given);
  for (const from of [path.join(process.cwd(), 'noop.js'), path.join(HERE, 'noop.js')]) {
    try {
      const req = createRequire(from);
      const pkgPath = req.resolve('repo-archaeology/package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const bin = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.['repo-archaeology'];
      if (bin) return path.join(path.dirname(pkgPath), bin);
    } catch {
      // not installed there
    }
  }
  return undefined;
}

async function main(argv) {
  const fixture = flag(argv, '--fixture');
  const repo = path.resolve(option(argv, '--repo') ?? process.cwd());
  const base = option(argv, '--base') ?? (fixture ? '61f7c59~6' : undefined);
  const head = option(argv, '--head') ?? (fixture ? '61f7c59' : undefined);
  const ra = fixture ? undefined : findRepoArchaeology(argv);
  if (!fixture && (!ra || !base)) {
    process.stderr.write(
      !ra
        ? `repo-archaeology ${RA_VERSION} is not installed here. Install it (npm i repo-archaeology@${RA_VERSION}), pass --ra <path to dist/cli.js>, or use --fixture.\n`
        : 'Pass --base <ref> (the branch your change is compared against).\n',
    );
    return 2;
  }

  const runId = `ra-${Date.now().toString(36)}`;
  const startedAt = new Date().toISOString();
  const abort = new AbortController();
  const { run, emit, cut, skip, cuts } = startApp(argv, { runId, product: 'Repo Archaeology', onCancel: () => abort.abort() });
  const title = fixture ? 'Which files usually change with this hono change? (fixture, 61f7c59)' : `Which files usually change with ${head ?? 'HEAD'} since ${base}?`;
  emit('run-start', { title, product: 'Repo Archaeology', command: fixture ? `repo-archaeology diff --base ${base} --head ${head} (fixture)` : `repo-archaeology diff --base ${base}${head ? ` --head ${head}` : ''}` });

  const raArgs = (...rest) => [ra, '-C', repo, ...(head ? ['--head', head] : []), '--no-color', ...rest];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'f12-ra-'));
  let diff;
  let explain;
  try {
    // C-01: read history and check the change (Repo Archaeology's own progress lines go to the log).
    const d = await cut('read-history', 'Read history and check the change', async () => {
      if (fixture) {
        diff = JSON.parse(fs.readFileSync(FIXTURE.diff, 'utf8'));
        return { summary: `${diff.meta.commitsAnalyzed} commits from the committed fixture (repo-archaeology ${diff.tool.version}).` };
      }
      const out = path.join(tmp, 'diff.json');
      const r = await spawnLogged(run.director, process.execPath, raArgs('diff', '--base', base, '--json-out', out), { cut: 'read-history', signal: abort.signal, stderrLevel: 'info' });
      if (r.code !== 0) return { status: 'error', summary: r.error ?? `repo-archaeology exited with ${r.signal ?? r.code}` };
      diff = JSON.parse(fs.readFileSync(out, 'utf8'));
      return { summary: `${diff.meta.commitsAnalyzed} commits analyzed, ${diff.changed.length} changed files.` };
    });
    for (const m of diff ? metricsFromDiff(diff) : []) emit('metric', { metric: m });

    // C-02: explain the top pair (counterexamples), when there is one.
    const top = diff?.suggestions?.[0];
    if (d.status === 'error' || !top) skip('explain', 'Explain the top pair', d.status === 'error' ? 'history could not be read' : 'no suggestions to explain');
    else
      await cut('explain', 'Explain the top pair', async () => {
        if (fixture) {
          explain = JSON.parse(fs.readFileSync(FIXTURE.explain, 'utf8'));
        } else {
          const stdout = await new Promise((resolve, reject) =>
            execFile(process.execPath, raArgs('explain', top.from, top.to, '--json'), { maxBuffer: 16 * 1024 * 1024, signal: abort.signal }, (err, out, errOut) => {
              for (const line of String(errOut).split('\n').filter(Boolean)) run.director.log('info', line, { cut: 'explain', stream: 'stderr' });
              return err ? reject(err) : resolve(out);
            }),
          );
          explain = JSON.parse(stdout);
        }
        return { summary: `${explain.sharedCommits?.length ?? 0} shared commits inspected.` };
      });

    // C-03: findings, strongest first, with their receipts.
    if (diff) {
      await cut('rank', 'Rank what to look at', async () => {
        for (const f of findingsFromDiff(diff, explain)) emit('finding', { cut: 'rank', finding: f });
        return { summary: diff.suggestions.length === 0 ? 'Nothing usually changes with this change.' : `${diff.suggestions.length} files usually change with this change.` };
      });
    } else skip('rank', 'Rank what to look at', 'no results to rank');

    const status = cuts.some((c) => c.status === 'error') ? 'failed' : abort.signal.aborted ? 'canceled' : 'completed';
    emit('run-end', { status });
    if (diff) emit('snapshot', { snapshot: { ...snapshotFrom({ runId, title, startedAt, finishedAt: new Date().toISOString(), cuts, diff, explain }), status } });
    else emit('snapshot', { snapshot: { schemaVersion: 1, runId, title, status, startedAt, finishedAt: new Date().toISOString(), cuts, metrics: [], findings: [], warnings: [], error: cuts.find((c) => c.status === 'error')?.summary ?? 'no results' } });
    return await run.end();
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
