import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  SCHEMA_VERSION,
  validateEventStream,
  validateResultSnapshot,
  type CochangeFinding,
  type HotFileSummary,
  type ReconstructedMetadata,
  type ResultSnapshot,
  type StoryboardEvent,
} from './model/index.js';
import {
  PlainStreamPrinter,
  renderBaseline,
  renderPlainSummary,
  sanitizeTerminalText,
  type PlainRenderOptions,
} from './render-plain/index.js';
import { runGitHistoryWorkload } from './workload/git-history.js';
import { convertRepoArchaeologySnapshot } from './workload/repo-archaeology-adapter.js';

export interface CliIo {
  stdout: (chunk: string) => void;
  stderr: (chunk: string) => void;
  isTTY?: boolean;
  stderrIsTTY?: boolean;
  columns?: number;
  env?: Record<string, string | undefined>;
  signal?: AbortSignal;
}

interface ParsedCliArgs {
  command: 'run' | 'import-archaeology' | 'help';
  targetPath: string | null;
  maxCommits: number;
  topN: number;
  includeNoise: boolean;
  excludePatterns: string[];
  mode: 'storyboard' | 'baseline' | 'json' | 'events';
  style: 'auto' | 'panels' | 'plain';
  styleExplicit: boolean;
  ascii: boolean;
  reportPath: string | null;
  theme: 'light' | 'dark';
  replayPath: string | null;
  columns?: number;
  noColor: boolean;
  error?: string;
}

const MAX_COMMITS_LIMIT = 10000;
const MAX_TOP_LIMIT = 100;

function parseArgs(argv: string[]): ParsedCliArgs {
  const res: ParsedCliArgs = {
    command: 'run',
    targetPath: null,
    maxCommits: 60,
    topN: 5,
    includeNoise: false,
    excludePatterns: [],
    mode: 'storyboard',
    style: 'auto',
    styleExplicit: false,
    ascii: false,
    reportPath: null,
    theme: 'light',
    replayPath: null,
    noColor: false,
  };

  const modesSelected: Array<'baseline' | 'json' | 'events'> = [];
  const args = [...argv];

  if (args[0] === '--help' || args[0] === '-h' || args[0] === 'help') {
    res.command = 'help';
    return res;
  }

  if (args[0] === 'run' || args[0] === 'import-archaeology') {
    res.command = args.shift() as 'run' | 'import-archaeology';
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === '--help' || arg === '-h') {
      res.command = 'help';
      return res;
    } else if (arg === '--json') {
      modesSelected.push('json');
      res.mode = 'json';
    } else if (arg === '--events') {
      modesSelected.push('events');
      res.mode = 'events';
    } else if (arg === '--baseline') {
      modesSelected.push('baseline');
      res.mode = 'baseline';
    } else if (arg === '--no-color') {
      res.noColor = true;
    } else if (arg === '--ascii') {
      res.ascii = true;
    } else if (arg === '--style') {
      const next = args[++i];
      if (next !== 'auto' && next !== 'panels' && next !== 'plain') {
        res.error = `Invalid --style "${String(next)}". Expected "auto", "panels", or "plain".`;
        return res;
      }
      res.style = next;
      res.styleExplicit = true;
    } else if (arg === '--include-noise') {
      res.includeNoise = true;
    } else if (arg === '--exclude') {
      const next = args[++i];
      if (!next || next.startsWith('--')) {
        res.error = 'Flag --exclude requires a path prefix or glob pattern.';
        return res;
      }
      res.excludePatterns.push(next);
    } else if (arg === '--max-commits') {
      const next = args[++i];
      const n = Number(next);
      if (!next || !Number.isInteger(n) || n < 1 || n > MAX_COMMITS_LIMIT) {
        res.error = `Invalid value for --max-commits: "${String(next)}". Must be an integer between 1 and ${MAX_COMMITS_LIMIT}.`;
        return res;
      }
      res.maxCommits = n;
    } else if (arg === '--top') {
      const next = args[++i];
      const n = Number(next);
      if (!next || !Number.isInteger(n) || n < 1 || n > MAX_TOP_LIMIT) {
        res.error = `Invalid value for --top: "${String(next)}". Must be an integer between 1 and ${MAX_TOP_LIMIT}.`;
        return res;
      }
      res.topN = n;
    } else if (arg === '--columns') {
      const next = args[++i];
      const n = Number(next);
      if (!next || !Number.isInteger(n) || n < 1) {
        res.error = `Invalid value for --columns: "${String(next)}".`;
        return res;
      }
      res.columns = n;
    } else if (arg === '--report') {
      const next = args[++i];
      if (!next || next.startsWith('--')) {
        res.error = 'Flag --report requires an output HTML file path.';
        return res;
      }
      res.reportPath = next;
    } else if (arg === '--theme') {
      const next = args[++i];
      if (next !== 'light' && next !== 'dark') {
        res.error = `Invalid --theme "${String(next)}". Expected "light" or "dark".`;
        return res;
      }
      res.theme = next;
    } else if (arg === '--replay') {
      const next = args[++i];
      if (!next || next.startsWith('--')) {
        res.error = 'Flag --replay requires a path to an NDJSON event log file.';
        return res;
      }
      res.replayPath = next;
    } else if (arg.startsWith('-')) {
      res.error = `Unknown CLI flag: "${arg}".`;
      return res;
    } else if (!res.targetPath) {
      res.targetPath = arg;
    } else {
      res.error = `Unexpected positional argument: "${arg}".`;
      return res;
    }
  }

  if (modesSelected.length > 1) {
    res.error = `Flags ${modesSelected.map((m) => `--${m}`).join(' and ')} are mutually exclusive. Choose at most one output mode.`;
    return res;
  }

  if (res.styleExplicit && res.mode !== 'storyboard') {
    res.error = `Flags --style ${res.style} and --${res.mode} are mutually exclusive.`;
    return res;
  }

  if (res.command === 'import-archaeology' && res.replayPath) {
    res.error = 'Flag --replay cannot be combined with import-archaeology.';
    return res;
  }

  if (res.targetPath && res.replayPath) {
    res.error = 'Cannot specify both <repo-path> and --replay <events.ndjson>.';
    return res;
  }

  if (!res.targetPath && !res.replayPath) {
    res.error =
      res.command === 'import-archaeology'
        ? 'Missing <json-path> for import-archaeology.'
        : 'Missing <repo-path> (or --replay <events.ndjson>).';
  }

  return res;
}

export function reconstructSnapshotFromEvents(events: StoryboardEvent[]): ResultSnapshot {
  const first = events[0]!;
  const last = events[events.length - 1]!;
  const repoLabel = String(first.payload.repoLabel ?? 'replayed-repo');
  const maxCommits =
    typeof first.payload.maxCommits === 'number' &&
    Number.isInteger(first.payload.maxCommits) &&
    first.payload.maxCommits >= 1
      ? first.payload.maxCommits
      : 60;
  let commitsExamined = 0;
  let uniqueFilesObserved = 0;
  let totalPairsObserved = 0;
  const findings: CochangeFinding[] = [];
  const warnings: string[] = [];

  for (const ev of events) {
    if (ev.type === 'metric') {
      if (ev.payload.name === 'commitsExamined' && typeof ev.payload.value === 'number') {
        commitsExamined = ev.payload.value;
      } else if (ev.payload.name === 'uniqueFilesObserved' && typeof ev.payload.value === 'number') {
        uniqueFilesObserved = ev.payload.value;
      } else if (ev.payload.name === 'totalPairsObserved' && typeof ev.payload.value === 'number') {
        totalPairsObserved = ev.payload.value;
      }
    } else if (ev.type === 'finding' && ev.payload.finding) {
      findings.push(ev.payload.finding as CochangeFinding);
    } else if (ev.type === 'warning' && typeof ev.payload.message === 'string') {
      warnings.push(ev.payload.message);
    }
  }

  const hotFiles: HotFileSummary[] = Array.isArray(last.payload.hotFiles)
    ? (last.payload.hotFiles as HotFileSummary[])
    : [];

  let reconstructed: ReconstructedMetadata | undefined;
  if (
    typeof last.payload.reconstructed === 'object' &&
    last.payload.reconstructed !== null &&
    !Array.isArray(last.payload.reconstructed)
  ) {
    reconstructed = last.payload.reconstructed as ReconstructedMetadata;
  } else if (first.payload.reconstructed === true || last.payload.reconstructed === true) {
    reconstructed = {
      source: 'repo-archaeology',
      originalSchemaVersion: 1,
      note: String(
        first.payload.note ??
          last.payload.summary ??
          'Reconstructed from a completed Repo Archaeology (schemaVersion: 1) analysis, not live events',
      ),
    };
  }

  const status = (last.payload.status as ResultSnapshot['status']) ?? 'completed';
  const error = typeof last.payload.error === 'string' ? last.payload.error : undefined;

  const candidate: ResultSnapshot = {
    schemaVersion: SCHEMA_VERSION,
    runId: first.runId,
    status,
    repoLabel,
    startedAt: first.ts,
    finishedAt: last.ts,
    maxCommits,
    commitsExamined,
    uniqueFilesObserved,
    totalPairsObserved,
    findings,
    hotFiles,
    warnings,
    ...(error ? { error } : {}),
    ...(reconstructed ? { reconstructed } : {}),
  };

  const snapCheck = validateResultSnapshot(candidate);
  if (!snapCheck.ok) {
    throw new Error(`Reconstructed snapshot failed validation: ${snapCheck.error}`);
  }
  return snapCheck.snapshot;
}

const HELP_TEXT = [
  'FRAME/12 Terminal Storyboard CLI (0-experimental)',
  '',
  'Usage:',
  '  storyboard run <repo-path> [--max-commits N] [--top N] [--exclude <glob>] [--include-noise] [--style auto|panels|plain] [--ascii] [--events | --json | --baseline] [--report <out.html>] [--theme light|dark] [--replay <events.ndjson>]',
  '  storyboard import-archaeology <json-path> [--report <out.html>] [--style auto|panels|plain] [--ascii] [--events | --json | --baseline] [--theme light|dark]',
].join('\n');

export async function runCli(argv: string[], io?: Partial<CliIo>): Promise<number> {
  const stdout = io?.stdout ?? ((s: string) => process.stdout.write(s));
  const stderr = io?.stderr ?? ((s: string) => process.stderr.write(s));
  const writeDiag = (message: string) => {
    stderr(`${sanitizeTerminalText(message)}\n`);
  };
  const isTTY = io?.isTTY ?? (io?.stdout ? false : Boolean(process.stdout.isTTY));
  const stderrIsTTY = io?.stderrIsTTY ?? (io?.stderr ? Boolean(io?.isTTY) : Boolean(process.stderr.isTTY));
  const explicitEnv = io ? io.env : process.env;
  const env = explicitEnv ?? process.env;
  const envCols = env.COLUMNS !== undefined ? Number(env.COLUMNS) : Number.NaN;
  const columns =
    io?.columns ??
    (Number.isFinite(envCols) && envCols > 0 ? Math.floor(envCols) : undefined) ??
    process.stderr.columns ??
    process.stdout.columns ??
    80;

  const parsed = parseArgs(argv);
  if (parsed.error) {
    writeDiag(`Error: ${parsed.error}`);
    return 2;
  }

  if (parsed.command === 'help') {
    stdout(`${HELP_TEXT}\n`);
    return 0;
  }

  const usePanels =
    parsed.mode === 'storyboard' &&
    (parsed.style === 'panels' ||
      (parsed.style === 'auto' &&
        Boolean(stderrIsTTY && isTTY && env.TERM !== 'dumb' && !env.CI)));

  const plainOpts: PlainRenderOptions = {
    columns: parsed.columns ?? columns,
    isTTY,
    noColor: parsed.noColor,
    isReplay: Boolean(parsed.replayPath),
    env: explicitEnv,
  };

  const inkMod = usePanels ? await import('./render-ink/index.js') : null;

  let snapshot: ResultSnapshot;
  let events: StoryboardEvent[];

  if (parsed.command === 'import-archaeology') {
    const filePath = resolve(parsed.targetPath!);
    if (!existsSync(filePath)) {
      writeDiag(`Error: Archaeology JSON file not found: ${filePath}`);
      return 1;
    }
    try {
      const rawJson = JSON.parse(readFileSync(filePath, 'utf8'));
      const converted = convertRepoArchaeologySnapshot(rawJson);
      const snapCheck = validateResultSnapshot(converted.snapshot);
      if (!snapCheck.ok) {
        writeDiag(`Error validating converted archaeology snapshot: ${snapCheck.error}`);
        return 2;
      }
      snapshot = snapCheck.snapshot;
      events = converted.events;
    } catch (err) {
      writeDiag(`Error converting Repo Archaeology JSON: ${(err as Error).message}`);
      return 2;
    }

    if (parsed.mode === 'events') {
      for (const ev of events) stdout(`${JSON.stringify(ev)}\n`);
    } else if (parsed.mode === 'storyboard') {
      if (inkMod) {
        const controller = new inkMod.InkStreamController({
          ...plainOpts,
          isTTY: stderrIsTTY,
          ascii: parsed.ascii,
          write: (s) => stderr(s),
        });
        try {
          for (const ev of events) controller.onEvent(ev);
        } finally {
          await controller.dispose();
        }
      } else {
        const printer = new PlainStreamPrinter((l) => stderr(`${l}\n`), plainOpts);
        for (const ev of events) printer.onEvent(ev);
      }
    }
  } else if (parsed.replayPath) {
    const filePath = resolve(parsed.replayPath);
    if (!existsSync(filePath)) {
      writeDiag(`Error: Replay NDJSON file not found: ${filePath}`);
      return 1;
    }
    try {
      const lines = readFileSync(filePath, 'utf8')
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      const rawEvents = lines.map((l) => JSON.parse(l));
      const validated = validateEventStream(rawEvents);
      if (!validated.ok) {
        writeDiag(`Error validating replay stream: ${validated.error}`);
        return 2;
      }
      events = validated.events;
      snapshot = reconstructSnapshotFromEvents(events);
    } catch (err) {
      writeDiag(`Error reading replay file: ${(err as Error).message}`);
      return 2;
    }

    if (parsed.mode === 'events') {
      for (const ev of events) stdout(`${JSON.stringify(ev)}\n`);
    } else if (parsed.mode === 'storyboard') {
      if (inkMod) {
        const controller = new inkMod.InkStreamController({
          ...plainOpts,
          isTTY: stderrIsTTY,
          ascii: parsed.ascii,
          write: (s) => stderr(s),
        });
        try {
          for (const ev of events) controller.onEvent(ev);
        } finally {
          await controller.dispose();
        }
      } else {
        const printer = new PlainStreamPrinter((l) => stderr(`${l}\n`), plainOpts);
        for (const ev of events) printer.onEvent(ev);
      }
    }
  } else {
    const ac = new AbortController();
    const onSigint = () => ac.abort();
    process.once('SIGINT', onSigint);
    if (io?.signal) {
      if (io.signal.aborted) ac.abort();
      else io.signal.addEventListener('abort', onSigint, { once: true });
    }

    const inkController =
      parsed.mode === 'storyboard' && inkMod
        ? new inkMod.InkStreamController({
            ...plainOpts,
            isTTY: stderrIsTTY,
            ascii: parsed.ascii,
            write: (s) => stderr(s),
            resizeTarget: !io?.columns
              ? process.stderr.isTTY
                ? process.stderr
                : process.stdout
              : undefined,
          })
        : null;

    const printer =
      parsed.mode === 'storyboard' && !inkMod
        ? new PlainStreamPrinter((l) => stderr(`${l}\n`), plainOpts)
        : null;

    try {
      const result = await runGitHistoryWorkload({
        repoPath: parsed.targetPath!,
        maxCommits: parsed.maxCommits,
        topN: parsed.topN,
        includeNoise: parsed.includeNoise,
        excludePatterns: parsed.excludePatterns,
        signal: ac.signal,
        onEvent: (ev) => {
          if (parsed.mode === 'events') {
            stdout(`${JSON.stringify(ev)}\n`);
          } else if (inkController) {
            inkController.onEvent(ev);
          } else if (printer) {
            printer.onEvent(ev);
          }
        },
      });
      snapshot = result.snapshot;
      events = result.events;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      writeDiag(`Run failed: ${msg}`);
      return 1;
    } finally {
      process.removeListener('SIGINT', onSigint);
      if (inkController) {
        await inkController.dispose();
      }
    }
  }

  // Write HTML report if requested (inside error boundary so unwritable paths exit 1 cleanly)
  let reportWritten = false;
  if (parsed.reportPath) {
    try {
      const outPath = resolve(parsed.reportPath);
      mkdirSync(dirname(outPath), { recursive: true });
      const { renderWebReportHtml } = await import('./render-web/index.js');
      const html = renderWebReportHtml(snapshot, events, { theme: parsed.theme });
      writeFileSync(outPath, html, 'utf8');
      reportWritten = true;
      writeDiag(`Wrote FRAME/12 HTML report: ${outPath}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      writeDiag(`Error writing HTML report: ${msg}`);
      return 1;
    }
  }

  // Output to stdout based on mode
  if (parsed.mode === 'json') {
    stdout(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else if (parsed.mode === 'baseline') {
    stdout(`${renderBaseline(snapshot, plainOpts)}\n`);
  } else if (parsed.mode === 'storyboard') {
    if (inkMod) {
      stdout(
        inkMod.renderInkStaticSummary(snapshot, events, {
          ...plainOpts,
          isTTY,
          ascii: parsed.ascii,
          reportWritten,
          includeHeaderAndSteps: false,
        }),
      );
    } else {
      stdout(`${renderPlainSummary(snapshot, plainOpts)}\n`);
    }
  }

  if (snapshot.status === 'canceled') {
    writeDiag('Run canceled (SIGINT).');
    return 130;
  }
  if (snapshot.status === 'failed') {
    writeDiag(`Run failed: ${snapshot.error ?? 'Unknown error'}`);
    return 1;
  }
  return 0;
}
