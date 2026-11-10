#!/usr/bin/env node
/**
 * A small program for the pty tests: it runs the real startLive() in whatever terminal it is given
 * and plays a fixture with one of these scenarios (--scenario):
 *   complete       every event, then exit with the run's code
 *   hold           everything but run-end/snapshot, then wait; a cancel ends the run (code 130)
 *   ignore-cancel  like hold, but the producer never reacts to cancel (needs a second Ctrl-C)
 *   idle           everything but the snapshot, then wait (the run is over; nothing is running)
 *   crash          throw after the first few events
 *   reject         an unhandled promise rejection after the first few events
 *   burst          10,000 cut-progress events per second for 3 s, then finish
 *   console        console.log during the live view (Ink routes it above the live region), then finish
 *   stray          a direct process.stdout.write during the live view (the dev warning), then hold
 * On exit it prints `F12-EXIT raw=<stdin raw mode> code=<exit code>` (after startLive's restore).
 * Nothing else is written to the terminal directly while the live view runs: a stray write would
 * move the cursor under Ink and corrupt its erase accounting (exactly what spawnLogged prevents).
 */
import { detectCapabilities, resolveTerminalMotion } from '@frame12/terminal';
import { startLive } from '@frame12/terminal/ink';
import { createEventFactory, fixture } from '@frame12/terminal/testing';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const scenario = opt('scenario', 'complete');
const delay = Number(opt('delay', '10'));
const name = opt('fixture', 'success');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const caps = detectCapabilities(process.env, process, process.argv);
const { tempo } = resolveTerminalMotion({ argv: process.argv, env: process.env, caps });
let onCancel = () => {};
const run = startLive({ caps, motion: tempo, devWarnings: scenario === 'stray' || opt('dev-warnings', 'off') === 'on', onCancel: (why) => onCancel(why) });
process.on('exit', (code) => process.stderr.write(`\nF12-EXIT raw=${process.stdin.isRaw === true} code=${code}\n`));
run.done.then((code) => process.exit(code));

const events = fixture(name).events;
const last = events.at(-1);
let seq = last.seq;
const extra = (type, payload) => ({ schemaVersion: 1, type, runId: last.runId, seq: ++seq, ts: new Date(Date.parse(last.ts) + seq).toISOString(), id: `${last.runId}-x${seq}`, ...payload });
const finishCanceled = () => {
  run.push(extra('run-end', { status: 'canceled' }));
  run.push(extra('snapshot', { snapshot: { ...last.snapshot, status: 'canceled' } }));
};

async function play(list) {
  for (const ev of list) {
    run.push(ev);
    if (delay) await sleep(delay);
  }
}

if (scenario === 'complete') {
  await play(events);
} else if (scenario === 'hold' || scenario === 'ignore-cancel') {
  if (scenario === 'hold') onCancel = () => finishCanceled();
  await play(events.filter((e) => e.type !== 'run-end' && e.type !== 'snapshot'));
  setInterval(() => {}, 1 << 30); // wait for keys or signals
} else if (scenario === 'idle') {
  await play(events.filter((e) => e.type !== 'snapshot'));
  setInterval(() => {}, 1 << 30);
} else if (scenario === 'crash') {
  await play(events.slice(0, 4));
  setTimeout(() => {
    throw new Error('fixture crash');
  }, 50);
  setInterval(() => {}, 1 << 30);
} else if (scenario === 'reject') {
  await play(events.slice(0, 4));
  setTimeout(() => void Promise.reject(new Error('fixture rejection')), 50);
  setInterval(() => {}, 1 << 30);
} else if (scenario === 'console') {
  await play(events.filter((e) => e.type !== 'run-end' && e.type !== 'snapshot'));
  console.log('F12-CONSOLE-LINE from the host');
  await sleep(300);
  await play(events.filter((e) => e.type === 'run-end' || e.type === 'snapshot'));
} else if (scenario === 'stray') {
  onCancel = () => finishCanceled();
  await play(events.filter((e) => e.type !== 'run-end' && e.type !== 'snapshot'));
  await sleep(100);
  process.stdout.write('stray');
  setInterval(() => {}, 1 << 30);
} else if (scenario === 'burst') {
  const f = createEventFactory({ runId: 'burst' });
  run.push(f.next('run-start', { title: 'Burst' }));
  run.push(f.next('cut-start', { cut: 'flood', title: 'Flood' }));
  const total = 30_000;
  let done = 0;
  const start = Date.now();
  while (done < total) {
    // 10 events per millisecond, yielding to the event loop so rendering and input keep running.
    const due = Math.min(total, Math.floor((Date.now() - start) * 10));
    while (done < due) run.push(f.next('cut-progress', { cut: 'flood', done: ++done, total, unit: 'events' }));
    await new Promise((r) => setImmediate(r));
  }
  run.push(f.next('cut-end', { cut: 'flood', status: 'ok', summary: `${total} events` }));
  run.push(f.next('run-end', { status: 'completed' }));
  const heapMb = Math.round(process.memoryUsage().heapUsed / 1e6);
  process.stderr.write(`F12-HEAP=${heapMb}\n`);
  run.push(f.next('snapshot', { snapshot: { schemaVersion: 1, runId: 'burst', title: 'Burst', status: 'completed', startedAt: '2026-11-10T09:00:00.000Z', finishedAt: '2026-11-10T09:00:03.000Z', cuts: [{ cut: 'flood', title: 'Flood', status: 'ok', summary: `${total} events` }], metrics: [{ name: 'events', value: total }], findings: [], warnings: [] } }));
}
