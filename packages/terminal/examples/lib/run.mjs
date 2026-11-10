/**
 * What the three reference apps share: their command-line options, an event emitter (contract v1),
 * and timed cuts. Each app is a plain Node program on the public API (`@frame12/terminal`,
 * `/ink`, `/process`); none of this is published.
 *
 *   --format rich|plain|json|live   how to render (default: live when the terminal allows it)
 *   --record <file>                 also write the run as a .f12rec recording
 */
import { detectCapabilities, resolveTerminalMotion } from '@frame12/terminal';
import { startLive } from '@frame12/terminal/ink';

const FORMATS = ['rich', 'plain', 'json', 'live'];

/** `--name value` / `--name=value`; the last one wins. */
export function option(argv, name) {
  let found;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === name && i + 1 < argv.length) found = argv[i + 1];
    else if (argv[i].startsWith(`${name}=`)) found = argv[i].slice(name.length + 1);
  }
  return found;
}

export const flag = (argv, name) => argv.includes(name);

/** Builds contract v1 events for one run: seq, ts and id are filled in. */
export function createEmitter(runId, now = () => new Date()) {
  let seq = 0;
  return (type, payload = {}) => {
    seq++;
    return { schemaVersion: 1, type, runId, seq, ts: now().toISOString(), id: `${runId}-${String(seq).padStart(4, '0')}`, ...payload };
  };
}

/**
 * Starts a run with the app's `--format` and `--record`. Returns the run, an `emit` that builds and
 * pushes an event, and `cut()`, which times one step and reports how it ended.
 */
export function startApp(argv, { runId, product, onCancel }) {
  const format = option(argv, '--format') ?? 'live';
  if (!FORMATS.includes(format)) {
    process.stderr.write(`--format must be one of ${FORMATS.join(', ')}.\n`);
    process.exit(2);
  }
  const caps = detectCapabilities(process.env, process, argv);
  const { tempo } = resolveTerminalMotion({ argv, env: process.env, caps });
  const record = option(argv, '--record');
  const run = startLive({ caps, motion: tempo, format, product, ...(record ? { record } : {}), ...(onCancel ? { onCancel } : {}) });
  const make = createEmitter(runId);
  const emit = (type, payload) => {
    const ev = make(type, payload);
    run.push(ev);
    return ev;
  };
  const cuts = [];
  /**
   * Runs `step` as one cut. It returns `{ status, summary }` (status `ok` unless said otherwise);
   * a thrown error ends the cut as `error`.
   */
  const cut = async (id, title, step) => {
    const t0 = performance.now();
    emit('cut-start', { cut: id, title });
    let outcome;
    try {
      outcome = (await step((progress) => emit('cut-progress', { cut: id, ...progress }))) ?? {};
    } catch (err) {
      outcome = { status: 'error', summary: err instanceof Error ? err.message : String(err) };
    }
    const status = outcome.status ?? 'ok';
    const durationMs = Math.round(performance.now() - t0);
    emit('cut-end', { cut: id, status, durationMs, ...(outcome.summary ? { summary: outcome.summary } : {}) });
    cuts.push({ cut: id, title, status, durationMs, ...(outcome.summary ? { summary: outcome.summary } : {}) });
    return outcome;
  };
  /** A cut that did not run because an earlier one failed. */
  const skip = (id, title, summary) => {
    emit('cut-start', { cut: id, title });
    emit('cut-end', { cut: id, status: 'skipped', durationMs: 0, summary });
    cuts.push({ cut: id, title, status: 'skipped', durationMs: 0, summary });
  };
  return { run, emit, cut, skip, cuts, format };
}
