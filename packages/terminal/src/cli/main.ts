/**
 * `frame12-term`: FRAME/12 output for any program that can print JSON lines.
 *
 *   producer | frame12-term render [--format rich|plain|json|live] [--strict] [--record run.f12rec]
 *   frame12-term render --from run.f12rec --replay [--speed 4]
 *
 * Reads NDJSON events (contract v1) from stdin or `--from`, one per line, and renders them through
 * the run session `startLive` uses (`../ink/session.ts`): the same views, signals, exit codes and
 * terminal restoration. The linear formats never load React or Ink; `--format live` loads them.
 *
 * - Lines longer than 64 KiB, and lines that are not JSON, are reported with their line number and
 *   skipped. Invalid events are dropped with a warning naming the line. `--strict` stops at the
 *   first of these instead, with exit code 2.
 * - A `.f12rec` recording (first line `{"f12rec":1,...}`) is always labeled REPLAY. `--replay`
 *   plays any input with its original timing (recording offsets, or event timestamps), `--speed`
 *   times faster (default 4), never waiting more than 1 s between two events.
 * - `--record <file>` writes the run as a `.f12rec` recording. The file is opened before any input
 *   is read: a path that cannot be written, or the input file itself, is a usage error.
 */
import { createReadStream, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, join, resolve } from 'node:path';
import { detectCapabilities, type Capabilities } from '../core/capabilities.js';
import { createStreamValidator, describeIssues } from '../core/validate.js';
import { resolveTerminalMotion } from '../core/motion.js';
import { parseRecordingEntry, recordingHeaderIssue, type RecordSink } from '../core/recording.js';
import { sanitizeText } from '../core/safety.js';
import { fileRecordSink } from '../node/record-file.js';
import { startSession, type LiveOptions, type LiveRun } from '../ink/session.js';

/** Lines longer than this (in bytes, without the newline) are skipped. */
export const MAX_LINE_BYTES = 64 * 1024;
/** Default replay speed, and the longest wait between two replayed events. */
export const DEFAULT_SPEED = 4;
export const MAX_REPLAY_GAP_MS = 1000;
/** Problems with the input reported one by one; the rest are counted in one summary line. */
export const MAX_REPORTED_PROBLEMS = 20;

/** The package's own version (dist/cli/main.js → package.json), so it cannot drift. */
const VERSION: string = (createRequire(import.meta.url)('../../package.json') as { version: string }).version;

const USAGE = `Usage: frame12-term render [options]

Renders FRAME/12 terminal events (NDJSON, contract v1) from stdin or a file.

Options:
  --from <file>         Read events from a file instead of stdin (.ndjson or .f12rec)
  --format <format>     rich (default), plain, json or live
  --plain, --json       Shorthands for --format plain / --format json
  --strict              Stop at the first malformed line or invalid event (exit 2)
  --replay              Play with the original timing, labeled REPLAY
  --speed <n>           Replay speed (default 4); no gap is longer than 1 s
  --record <file>       Write the run as a .f12rec recording
  --verbose             Also narrate info and debug log lines
  --color, --no-color, --ascii, --unicode, --links, --no-links,
  --screen-reader, --motion <tempo>, --columns <n>, --rows <n>
                        Terminal capabilities (see the README)
  -h, --help            Show this help
  --version             Show the version

Exit codes: 0 completed; 1 failed, incomplete, or the recording could not be completed;
2 usage error or --strict failure (it wins over the others); 130 canceled.
`;

const VALUE_FLAGS = new Set(['--from', '--format', '--speed', '--record', '--motion', '--columns', '--rows']);
const BOOLEAN_FLAGS = new Set(['--strict', '--replay', '--verbose', '--plain', '--json', '--color', '--no-color', '--ascii', '--unicode', '--links', '--no-links', '--screen-reader', '--help', '-h', '--version']);
/** Flags read by capability and motion detection; only these (and their values) reach them. */
const CAPABILITY_FLAGS = new Set(['--motion', '--columns', '--rows', '--color', '--no-color', '--ascii', '--unicode', '--links', '--no-links', '--screen-reader']);
const FORMATS = ['rich', 'plain', 'json', 'live'] as const;
type Format = (typeof FORMATS)[number];

/** Everything the CLI touches, injectable for tests. */
export interface CliIO {
  stdin: NodeJS.ReadStream;
  stdout: NodeJS.WriteStream;
  stderr: NodeJS.WriteStream;
  env: Record<string, string | undefined>;
  /** Opens `--from`. Default: `fs.createReadStream`. */
  open?: (path: string) => AsyncIterable<Buffer | string> & { destroy?(): void };
  /** Waits between replayed events. Default: a timer. */
  sleep?: (ms: number) => Promise<void>;
  /** Opens `--record`. Default: a synchronous file sink. */
  openRecord?: (path: string) => RecordSink;
  /** Loads the live adapter. Default: `import('../ink/index.js')`. */
  loadLive?: () => Promise<{ startLive(options: LiveOptions): LiveRun }>;
  /** Passed to the session (tests turn signals off). */
  handleSignals?: boolean;
  exit?: (code: number) => void;
}

interface Parsed {
  command: string | undefined;
  from?: string;
  format: Format;
  strict: boolean;
  replay: boolean;
  speed: number;
  speedGiven: boolean;
  record?: string;
  /** The capability flags, as given, for detectCapabilities and resolveTerminalMotion. */
  capabilityArgs: string[];
  verbose: boolean;
  help: boolean;
  version: boolean;
}

class UsageError extends Error {}

function parseArgs(argv: readonly string[]): Parsed {
  const out: Parsed = { command: undefined, format: 'rich', strict: false, replay: false, speed: DEFAULT_SPEED, speedGiven: false, verbose: false, help: false, version: false, capabilityArgs: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--') break;
    if (!arg.startsWith('-')) {
      if (out.command !== undefined) throw new UsageError(`Unexpected argument: ${arg}`);
      out.command = arg;
      continue;
    }
    const eq = arg.indexOf('=');
    const name = eq === -1 ? arg : arg.slice(0, eq);
    if (VALUE_FLAGS.has(name)) {
      const value = eq === -1 ? argv[++i] : arg.slice(eq + 1);
      if (value === undefined || value === '') throw new UsageError(`${name} needs a value.`);
      if (CAPABILITY_FLAGS.has(name)) out.capabilityArgs.push(name, value);
      if (name === '--from') out.from = value;
      else if (name === '--record') out.record = value;
      else if (name === '--format') {
        if (!(FORMATS as readonly string[]).includes(value)) throw new UsageError(`--format must be one of ${FORMATS.join(', ')}.`);
        out.format = value as Format;
      } else if (name === '--speed') {
        const n = Number(value);
        if (!Number.isFinite(n) || n <= 0) throw new UsageError('--speed must be a number greater than 0.');
        out.speed = n;
        out.speedGiven = true;
      }
      continue;
    }
    if (eq !== -1 || !BOOLEAN_FLAGS.has(name)) throw new UsageError(`Unknown option: ${name}`);
    if (CAPABILITY_FLAGS.has(name)) out.capabilityArgs.push(name);
    if (name === '--strict') out.strict = true;
    else if (name === '--replay') out.replay = true;
    else if (name === '--verbose') out.verbose = true;
    else if (name === '--plain') out.format = 'plain';
    else if (name === '--json') out.format = 'json';
    else if (name === '--help' || name === '-h') out.help = true;
    else if (name === '--version') out.version = true;
  }
  return out;
}

/** Splits a byte stream into numbered lines, skipping (not buffering) lines over `max` bytes. */
async function* numberedLines(source: AsyncIterable<Buffer | string>, max: number): AsyncGenerator<{ n: number; text?: string }> {
  let parts: Buffer[] = [];
  let size = 0;
  let tooLong = false;
  let n = 0;
  const take = (piece: Buffer) => {
    if (tooLong) return;
    if (size + piece.length > max) {
      tooLong = true;
      parts = [];
      size = 0;
      return;
    }
    if (piece.length > 0) parts.push(piece);
    size += piece.length;
  };
  const line = () => {
    n++;
    let text = tooLong ? undefined : Buffer.concat(parts, size).toString('utf8').replace(/\r$/, '');
    // A byte-order mark (files saved by Windows editors) belongs to the file, not to line 1.
    if (n === 1 && text?.startsWith('\ufeff')) text = text.slice(1);
    const out = text === undefined ? { n } : { n, text };
    parts = [];
    size = 0;
    tooLong = false;
    return out;
  };
  for await (const chunk of source) {
    const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
    let start = 0;
    for (;;) {
      const nl = buf.indexOf(10, start);
      take(buf.subarray(start, nl === -1 ? buf.length : nl));
      if (nl === -1) break;
      yield line();
      start = nl + 1;
    }
  }
  if (size > 0 || tooLong) yield line();
}

/** Text from the input, made safe to print in a message. */
const quote = (s: string) => sanitizeText(s, { maxLineLength: 120 });

/** Runs `frame12-term` with `argv` (without node and the script); resolves with the exit code. */
export async function main(argv: readonly string[], io: CliIO): Promise<number> {
  let args: Parsed;
  try {
    args = parseArgs(argv);
  } catch (err) {
    io.stderr.write(`frame12-term: ${(err as Error).message}\n\n${USAGE}`);
    return 2;
  }
  if (args.version) {
    io.stdout.write(`${VERSION}\n`);
    return 0;
  }
  if (args.help || args.command === undefined) {
    (args.help ? io.stdout : io.stderr).write(USAGE);
    return args.help ? 0 : 2;
  }
  if (args.command !== 'render') {
    io.stderr.write(`frame12-term: unknown command "${quote(args.command)}".\n\n${USAGE}`);
    return 2;
  }

  // Events come from stdin unless --from: then stdin cannot also be the keyboard.
  const detected = detectCapabilities(io.env, { stdin: io.stdin, stdout: io.stdout, stderr: io.stderr }, args.capabilityArgs);
  const caps: Capabilities = args.from === undefined ? { ...detected, interactive: false } : detected;
  const { tempo } = resolveTerminalMotion({ argv: args.capabilityArgs, env: io.env, caps });

  if (args.speedGiven && !args.replay) io.stderr.write('frame12-term: --speed has no effect without --replay.\n');
  if (args.from === undefined && io.stdin.isTTY) {
    io.stderr.write('frame12-term: reading events from the terminal (Ctrl-D ends them). Pipe a producer in, or use --from <file>.\n');
  }

  // The recording is opened before any input is read: a bad path is a usage error, and it must not
  // be the input file (opening it for writing would truncate what is being read).
  let recordSink: RecordSink | undefined;
  let recordFailed = false;
  if (args.record !== undefined) {
    if (args.from !== undefined && sameFile(args.from, args.record)) {
      io.stderr.write(`frame12-term: --record ${quote(args.record)} is the --from file; record to another file.\n`);
      return 2;
    }
    try {
      const sink = (io.openRecord ?? fileRecordSink)(args.record);
      // Remember a failed write: the run goes on, but the requested recording is incomplete.
      recordSink = {
        ...(sink.name !== undefined ? { name: sink.name } : { name: args.record }),
        write(line) {
          try {
            sink.write(line);
          } catch (err) {
            recordFailed = true;
            throw err;
          }
        },
        end: () => sink.end?.(),
      };
    } catch (err) {
      io.stderr.write(`frame12-term: cannot write ${quote(args.record)}: ${quote((err as Error).message)}\n`);
      return 2;
    }
  }

  let source: AsyncIterable<Buffer | string> & { destroy?(): void };
  try {
    source = args.from === undefined ? io.stdin : (io.open ?? ((p: string) => createReadStream(p)))(args.from);
  } catch (err) {
    recordSink?.end?.();
    io.stderr.write(`frame12-term: cannot read ${quote(args.from ?? '')}: ${quote((err as Error).message)}\n`);
    return 2;
  }

  // Replays always say so; a recording is a replay even without --replay.
  let replay = args.replay;
  let stopped = false;
  const options = (): LiveOptions => ({
    caps,
    motion: tempo,
    stdin: io.stdin,
    stdout: io.stdout,
    stderr: io.stderr,
    format: args.format,
    ...(args.verbose ? { verbose: true } : {}),
    ...(recordSink ? { record: recordSink } : {}),
    ...(replay ? { replay: true } : {}),
    ...(io.handleSignals === false ? { handleSignals: false } : {}),
    ...(io.exit ? { exit: io.exit } : {}),
    onCancel: () => {
      stopped = true;
      source.destroy?.();
    },
  });

  let run: LiveRun | undefined;
  const start = async (): Promise<LiveRun> => {
    let started: LiveRun;
    if (args.format !== 'live') started = startSession(options());
    else {
      let live: { startLive(options: LiveOptions): LiveRun };
      try {
        live = await (io.loadLive ?? (() => import('../ink/index.js')))();
      } catch (err) {
        throw new UsageError(`--format live needs the optional peers ink@^8 and react@^19.3 (${quote((err as Error).message)}). Use --format rich instead.`);
      }
      started = live.startLive(options());
    }
    // Once the run is over (its snapshot arrived, or q), stop reading: a producer that keeps its
    // output open must not keep the CLI waiting.
    void started.done.then(() => {
      stopped = true;
      source.destroy?.();
    });
    return started;
  };

  const strictValidator = args.strict ? createStreamValidator() : undefined;
  const sleep = io.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let lastTime: number | undefined;
  let recording = false;
  let firstLine = true;
  let failed: string | undefined;
  let problems = 0;
  let firstUnreported: string | undefined;
  let summarized = 0;
  /** The count of problems not listed one by one, said once before the results (and at the end). */
  const summarize = () => {
    const unlisted = problems - MAX_REPORTED_PROBLEMS;
    if (!run || firstUnreported === undefined || unlisted <= summarized) return;
    run.director.log('warn', `… and ${unlisted - summarized} more problems with the input, the first at ${firstUnreported} (skipped).`);
    summarized = unlisted;
    firstUnreported = undefined;
  };

  /** One problem with the input: fatal under --strict, otherwise a warning (the first 20, then counted). */
  const problem = async (where: string, message: string) => {
    const text = `${where}: ${message}`;
    run ??= await start();
    if (args.strict) {
      failed = text;
      run.director.log('error', `${text} (stopped: --strict)`);
      return;
    }
    problems++;
    if (problems <= MAX_REPORTED_PROBLEMS) run.director.log('warn', `${text} (skipped)`);
    else firstUnreported ??= where;
  };

  /** The whole read; any error it throws is turned into an exit code by the caller. */
  const read = async (): Promise<number | undefined> => {
    try {
      for await (const { n, text } of numberedLines(source, MAX_LINE_BYTES)) {
        if (stopped || failed) break;
        const where = `line ${n}`;
        if (text === undefined) {
          await problem(where, `longer than ${MAX_LINE_BYTES / 1024} KiB`);
          continue;
        }
        if (text.trim() === '') continue;
        let value: unknown;
        try {
          value = JSON.parse(text);
        } catch (err) {
          await problem(where, `not valid JSON (${quote((err as Error).message)})`);
          continue;
        }
        if (firstLine) {
          firstLine = false;
          const issue = recordingHeaderIssue(value);
          if (issue === undefined) {
            recording = true;
            replay = true;
            continue;
          }
          // A recording this version cannot read is one clear error, not one per line.
          if (issue !== 'not a recording') {
            io.stderr.write(`frame12-term: ${where}: ${issue}.\n`);
            return 2;
          }
        }
        let event: unknown = value;
        let at: number | undefined;
        if (recording) {
          const entry = parseRecordingEntry(value);
          if (!entry) {
            await problem(where, 'not a recording entry ({"t":…,"event":…})');
            continue;
          }
          event = entry.event;
          at = entry.t;
        } else {
          const ts = Date.parse(String((value as { ts?: unknown } | null)?.ts ?? ''));
          at = Number.isFinite(ts) ? ts : undefined;
        }
        if (strictValidator) {
          const r = strictValidator.push(event);
          if (!r.ok && !r.ignorable) {
            await problem(where, describeIssues(r.issues));
            continue;
          }
        }
        if (args.replay && at !== undefined) {
          // Gaps run from the latest time seen: an event stamped earlier adds no wait.
          if (lastTime !== undefined && at > lastTime) await sleep(Math.min(MAX_REPLAY_GAP_MS, (at - lastTime) / args.speed));
          lastTime = Math.max(lastTime ?? at, at);
        }
        run ??= await start();
        if (stopped) break;
        if ((event as { type?: unknown } | null)?.type === 'snapshot') summarize();
        run.push(event, where);
      }
    } catch (err) {
      if (err instanceof UsageError) throw err;
      // `--from` that cannot be opened fails before anything was read.
      if (args.from !== undefined && run === undefined && (err as NodeJS.ErrnoException).code !== undefined) {
        io.stderr.write(`frame12-term: cannot read ${quote(args.from)}: ${quote((err as Error).message)}\n`);
        return 2;
      }
      // A canceled read ends with a premature-close error; anything else is reported.
      if (!stopped) {
        run ??= await start();
        run.director.log('error', `reading the input failed: ${quote((err as Error).message)}`);
      }
    }
    return undefined;
  };

  try {
    const early = await read();
    if (early !== undefined) {
      recordSink?.end?.();
      return early;
    }
    run ??= await start();
  } catch (err) {
    recordSink?.end?.();
    io.stderr.write(`frame12-term: ${quote((err as Error).message)}\n`);
    return 2;
  }
  summarize();
  const code = await run.end();
  // --strict wins; then a recording that could not be completed; then the run's own code.
  if (failed) return 2;
  if (recordFailed && code === 0) return 1;
  return code;
}

/** True when two paths name the same file (the second may not exist yet). */
function sameFile(a: string, b: string): boolean {
  const real = (p: string) => {
    try {
      return realpathSync(p);
    } catch {
      try {
        return join(realpathSync(dirname(resolve(p))), basename(p));
      } catch {
        return resolve(p);
      }
    }
  };
  return real(a) === real(b);
}
