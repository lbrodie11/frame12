# Terminal output with `@frame12/terminal`

`@frame12/terminal` brings FRAME/12 to the command line. A run is a sequence of **cuts**
(`C-01`…), the finding that matters is a **frame** (`F-01`) shown first, and evidence is
**receipts** (`E-01`). Those labels are presentation: your events carry stable ids.

> **0.1.0** exports the core (contract, validation, capabilities, motion, safety, width,
> tokens, the Director), the linear renderers (`./render`), the live view (`./ink`, optional
> `ink@^8`/`react@^19.3` peers), `spawnLogged` (`./process`), `./testing`, and the
> `frame12-term` CLI with `.f12rec` recordings.

## Install

```bash
npm install @frame12/terminal
```

Node 22+. The only runtime dependency is `@frame12/tokens`; the core never loads React, Ink, Git
or `node:child_process`.

## API (0.1.0)

```ts
// Contract v1 (schemaVersion: 1) and validation: never throws, returns typed issues.
type EventType = 'run-start' | 'scene-start' | 'cut-start' | 'cut-progress' | 'metric' | 'finding' | 'receipt' | 'log' | 'warning' | 'cut-end' | 'scene-end' | 'run-end' | 'snapshot';
validateEvent(raw: unknown, o?: { maxEventBytes?: number; maxSnapshotBytes?: number }): ValidationResult<TerminalEvent>;
validateSnapshot(raw: unknown, o?: ValidateOptions): ValidationResult<Snapshot>;
createStreamValidator(o?: ValidateOptions & { idMemory?: number; lifecycle?: boolean }): { push(raw: unknown): ValidationResult<TerminalEvent>; finish(): ValidationIssue[]; runId; ended };
// ValidationResult<T> = { ok: true; value: T } | { ok: false; issues: ValidationIssue[]; ignorable: boolean }

// Capabilities: pure, inject everything.
detectCapabilities(env, { stdin?, stdout?, stderr? }, argv, o?: { platform?: string }): Capabilities;
resolveTerminalMotion({ argv?, env?, caps, defaultTempo? }): { tempo: 'twos' | 'ones' | 'still'; source; reason?; warnings };

// Safety: run every untrusted string through it before printing.
createSanitizer(o?: { redact?: (text, { field, source }) => string; defaultRedaction?: boolean; maxLineLength?; tabWidth?; ascii?; ambiguousWide?; links?: { allowLocalhostHttp?: boolean } }): Sanitizer;
sanitizeText(input: unknown, o?: { mode?: 'text' | 'identifier'; newlines?: 'space' | 'keep' | 'escape'; tabWidth?; maxLineLength?; ascii?; ambiguousWide? }): string;
safeLink(href: unknown, policy?): string | undefined; // https: only (+ http: localhost when allowed), credentials removed
formatLink(text: string, href: unknown, enabled: boolean, policy?): string; // the only OSC 8 the package emits
redactSecrets(text: string): string;

// Width: grapheme clusters, UAX #11 (Unicode 17.0.0), ambiguous-width switch.
stringWidth(text, o?: { ambiguousWide? }): number;
truncateMiddle(text, max, o?: { ellipsis?; ambiguousWide? }): { text: string; truncated: boolean };
truncateEnd(text, max, o?): string;
wrap(text, width, o?: { indent?; ambiguousWide? }): string[];
padEnd(text, width, o?): string;

// Tokens: style levels 'none' | 'mono' | 'ansi16' | 'ansi256' | 'truecolor'.
styleLevel(colorLevel, attributes): StyleLevel;
paint(text: string, role: Role, level: StyleLevel): string;
GUTTER_CELLS = { pair: 1, scene: 2, change: 3 };
```

// Linear renderers (@frame12/terminal/render): sanitize their input, never write themselves.
renderJson(snapshot: Snapshot): string;
renderPlain(snapshot: Snapshot, o?: { product?; nextSteps?: NextStep[]; safety? }): string;
renderRich(snapshot: Snapshot, rc: RenderCaps, o?: { product?; nextSteps?; safety? }): string;
renderCapsFor(caps: Capabilities, stream?: 'stdout' | 'stderr', o?: { verbose?: boolean }): RenderCaps;
createLinearWriter(o: { format: 'rich' | 'plain' | 'json'; caps: Capabilities; stdout; stderr; verbose?; nextSteps?; safety?; validation? }): { write(raw: unknown, where?: string): void; log(level, text): void; end(): LinearResult };

// Director (core) and live view (@frame12/terminal/ink).
createDirector(o: { caps; motion: Tempo; onEvent?; onCancel?; maxLogs?; maxEvents?; maxItems?; maxWarnings?; safety?; validation?; scheduler?; record?: { write(line): void; end?(): void } }): Director;
// Director: { push(raw, where?); tap((raw, where?) => void); subscribe(state => void); snapshot(); cancel(reason); log(level, text, meta?); flush(); signal; dispose() }. LogLine.origin: 'event' | 'host'.
startLive(o: { caps; motion; stdin?; stdout?; stderr?; format?: 'live' | 'rich' | 'plain' | 'json'; verbose?; fullscreen?; product?; nextSteps?; safety?; replay?; record?: string | RecordSink; director?; onCancel?; handleSignals?; exit?; devWarnings? }): { director; mode: 'live' | 'linear'; reason?; push(e, where?); end(): Promise<number>; done };

// Recordings (.f12rec, core): header {"f12rec":1,"schemaVersion":1}, then {"t": ms, "event": {...}} lines ending with the snapshot.
// t comes from the events' own ts; tokens in links are masked; a sink that throws stops the recording with a warning.
recordingHeader(): string; recordingLine(t, event): string; isRecordingHeader(v): boolean; recordingHeaderIssue(v): string | undefined; parseRecordingEntry(v): { t; event } | undefined; redactLinks(value, redact?, source, policy?);
spawnLogged(director, cmd: string, args?: string[], o?: { cwd?; env?; cut?; signal?; stderrLevel?; killAfterMs?; maxLineLength?; drainMs? }): Promise<{ code; signal; error? }>; // @frame12/terminal/process

## The `frame12-term` CLI

Any language can drive FRAME/12 output: print contract v1 events as NDJSON and pipe them in.

```bash
# Always name the package: a bare `npx frame12-term` would look for another package of that name.
my-tool --events | npx -p @frame12/terminal frame12-term render            # --format rich|plain|json|live
my-tool --events | npx -p @frame12/terminal frame12-term render --record run.f12rec
npx -p @frame12/terminal frame12-term render --from run.f12rec --replay    # original timing, x4, gaps <= 1 s, REPLAY
```

Lines over 64 KiB and non-JSON lines are reported with their line number and skipped; `--strict`
stops at the first problem (exit 2). Exit codes: 0 completed, 1 failed or incomplete, 2 usage or
`--strict`, 130 canceled. The README has Go, Python and Rust emitters.

## Rules

- **Validate, then sanitize, then render.** Never print a producer's string directly; use
  `createSanitizer().event(ev)` / `.snapshot(s)`.
- **Results come from the snapshot.** The event stream narrates; it never stands in for results.
- **Ids are domain ids** (`read-history`), never `C-01`, `F-01` or `E-01`; the validator rejects
  those.
- **One marker chip per screen**, as a background (`paint(label, 'marker', level)`), never yellow
  text. Ink is the terminal's own foreground; statuses are weight and inversion plus a word.
- **Information is never paced.** Use `resolveTerminalMotion` only for decoration; errors,
  endings and cancellation show immediately. Terminals have no OS reduced-motion signal, so honor
  `NO_MOTION` / `REDUCED_MOTION`.
- **Narration goes to stderr, results to stdout.** Detect color per stream
  (`colorLevel` vs `stderrColorLevel`); pipes get no escape sequences at all.
- **Never write to stdout during a live view.** Use `console.*`, or run child processes through
  `spawnLogged`; direct writes corrupt the redraw.
- **Width in cells, not characters.** Use `stringWidth`, `truncateMiddle` for paths (never wrap a
  path) and `wrap` for prose.
