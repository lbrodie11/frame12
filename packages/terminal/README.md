# @frame12/terminal

FRAME/12's interface language for the command line. A long-running command reads as a sequence
of **cuts** (`C-01`, `C-02`…), the finding that matters comes first as a **frame** (`F-01`), and
every claim carries **receipts** (`E-01`).

> **Status: 0.1.0 in progress (F12-13 PRs 1–5).** The core, the zero-dependency linear renderers
> (`./render`), the Director, the live Ink view (`./ink`), `spawnLogged` (`./process`), the
> `frame12-term` CLI with `.f12rec` recordings, and three reference apps
> ([`examples/`](examples/)) are in.

```sh
npm install @frame12/terminal
```

Requires Node.js 22 or later. The core has no dependencies besides `@frame12/tokens` and never
loads React, Ink, Git or `node:child_process`.

## Principles

1. **Time becomes composition.** Cuts, frames and receipts are presentation labels; your data
   carries stable ids (`read-history`). The validator rejects `C-01` as an id.
2. **Information is never paced; presentation sometimes is.** Errors, cancellation and results
   appear immediately. Only decoration follows the tempo.
3. **Linear first.** Nothing important exists only in a live redraw.
4. **One marker per screen,** always as a background chip with ink text, never as yellow text.
5. **Meaning never rests on color or glyphs alone.** Every status has a word.
6. **Honest evidence.** Results render from the snapshot; narration never invents them.

## The event contract (v1)

A run is NDJSON: one event per line, then one authoritative `snapshot`. Every event carries
`schemaVersion: 1`, `type`, `runId`, `seq` (strictly increasing), `ts` (ISO 8601 with a zone) and
`id` (unique in the run).

| Event | Fields |
| --- | --- |
| `run-start` | `title`, `product?`, `command?` |
| `scene-start` / `scene-end` | `scene`, `title` / `scene` |
| `cut-start` | `cut`, `title`, `scene?` |
| `cut-progress` | `cut`, `done?`, `total?`, `unit?`, `note?` (`done` never decreases) |
| `metric` | `metric: { name, label?, value, unit? }`, `cut?` |
| `finding` | `finding: Finding`, `cut?` |
| `receipt` | `finding` (its id), `receipt: ReceiptRef` |
| `log` | `level: debug\|info\|warn\|error`, `text`, `stream?`, `cut?` |
| `warning` | `message`, `code?`, `cut?` |
| `cut-end` | `cut`, `status: ok\|warning\|error\|skipped\|canceled`, `summary?`, `durationMs?` |
| `run-end` | `status: completed\|failed\|canceled`, `error?` |
| `snapshot` | `snapshot: Snapshot` (the result every renderer draws from) |

```ts
interface Finding {
  id: string;
  title: string;
  summary?: string;
  subject: { kind: string; label: string; href?: string }[];
  strength?: { value: number; low?: number; high?: number; label: string }; // 0–1
  prominence: 'hero' | 'primary' | 'secondary';
  status: 'review' | 'info' | 'ok' | 'warning' | 'danger';
  receipts?: { kind: 'commit' | 'file' | 'link' | 'log' | 'test' | 'tool-call'; value: string; href?: string; at?: string; note?: string }[];
}
```

Limits: 8 KiB per event and 1 MiB per snapshot (both configurable). The keys `__proto__`,
`constructor` and `prototype` are rejected at any depth, a `snapshot` event's `snapshot.runId`
must match its own `runId`, and timestamps need an explicit zone (the schema uses the same pattern). Unknown event types are
ignored with a warning, so older renderers keep working with newer producers. Unknown fields are
preserved. The JSON Schema is `@frame12/terminal/schema.json`
([`schema/events.schema.json`](schema/events.schema.json)).

```ts
import { createStreamValidator, describeIssues } from '@frame12/terminal';

const stream = createStreamValidator();
for (const line of ndjson.split('\n').filter(Boolean)) {
  const r = stream.push(JSON.parse(line));
  if (!r.ok) console.error(r.ignorable ? 'skipped:' : 'invalid:', describeIssues(r.issues));
}
```

Validation never throws: it returns typed issues (`code`, `path`, `message`, `severity`). The
stream validator also checks the run lifecycle: `run-start` first, each cut started before it
progresses or ends and ended before `run-end`, and receipts only for announced findings. Pass
`{ lifecycle: false }` to read a partial stream, and call `stream.finish()` at end of input to
learn whether the run was incomplete.

## Rendering (`@frame12/terminal/render`)

Three linear renderers, all zero-dependency and all sanitizing their input first:

| Renderer | For | Output |
| --- | --- | --- |
| `renderJson(snapshot)` | automation | the snapshot verbatim (2-space JSON); re-rendering parsed output is byte-identical |
| `renderPlain(snapshot)` | CI logs, pipes, screen readers, diffs | no escape sequences, ASCII template text, one self-describing fact per line, every receipt and full path; independent of width |
| `renderRich(snapshot, renderCaps)` | people at a terminal | the FRAME/12 grammar below, styled to the terminal's color level |

`createLinearWriter({ format, caps, stdout, stderr })` drives them from an event stream:
narration (cut endings, warnings, errors, dropped events) goes to **stderr** as append-only lines,
and results go to **stdout** once, from the snapshot. So `cmd > out.txt` captures only results and
`--json` writes only JSON to stdout. There is no spinner and no cursor movement in linear output,
and nothing is delayed for effect.

```ts
import { detectCapabilities } from '@frame12/terminal';
import { createLinearWriter } from '@frame12/terminal/render';

const caps = detectCapabilities(process.env, process, process.argv);
const writer = createLinearWriter({ format: 'rich', caps, stdout: process.stdout, stderr: process.stderr });
for (const event of events) writer.write(event);
const { status, snapshot } = writer.end();
```

### The grammar

```
FRAME/12 · Investigate coupling in payments-service
────────────────────────────────────────────────────

RUN · 4 CUTS                        ✓ completed  4.3s


FINDINGS  3 (1 top, 2 primary)

 F-01   Settlement runner moves with the ledger reconciler      ← the one marker chip
┃ needs review · top finding · pair-001                         ← heavy rule: the hero only
┃ src/module-1/runner.ts
┃   ⇢ changes with it, no code link                             ← typed connector + words
┃ src/module-1/ledger.ts
┃ ▰▰▰▰▰▰▰▱ 92% (range 74–99%)                                   ← tone bar, number always printed
┃ E-01  8947a15  2026-10-28  change 1 touching both sides
┃ +3 more receipts
```

- `masthead`, `cut` (`C-01 · READ HISTORY  ✓ done  2.4s`), `panel`, `panelPair`, `evidenceCard`,
  `compactFinding`, `receiptList`, `toneBar`, `metricRows`, `hintBar` (printed once as
  "Next steps" in linear output) are exported as pure functions: data and `RenderCaps` in, text out.
- **One marker chip per render,** on the top finding's label. Never yellow text.
- **No boxes.** A panel is a label line and an indented body; only the hero gets `┃`.
- **Every status is a word** (`✓ done`, `✕ failed`, `○ skipped`; ASCII `[ok]`, `[fail]`, `[skip]`).
- **Glyph rule.** Every non-ASCII glyph is in `GLYPHS` with its East Asian Width and an ASCII
  twin. Ambiguous-width glyphs switch to their twins when ambiguous characters render wide (CJK
  locales, `FRAME12_AMBIGUOUS_WIDE=1`); wide and emoji-capable glyphs are never used.
- **Width tiers.** Under 40 columns: one fact per line, no rules. 40–79: standard. 80–119:
  two-column metrics. 120+: wider truncation only. No line is ever wider than the terminal, at
  any width from 20 columns (tested at every width from 20 to 130). Paths and receipt values are
  middle-truncated, never wrapped; `verbose` prints each truncated one in full on its own line,
  the one place a line may be wider than the terminal. Ids, numbers and metric values wrap
  instead of being cut, and next-step commands wrap with ` \` continuations so a copied command
  still runs.
- **Nothing is invented.** A typed connector is drawn only when a finding states its `relation`;
  results reuse the cut labels narration printed; a run has exactly one snapshot (a second one is
  rejected, so `--json` output is always one document).

### Gallery

`npm run gallery --workspace=@frame12/terminal` writes the design-review matrix to `gallery/`:
6 fixtures × rich at 40/80/120 columns × mono/16/256/truecolor, plus plain, JSON and the full
terminal view. Add `-- --png` for light and dark PNGs rendered through `@xterm/headless` (a real
terminal parser) in Playwright. The committed `.txt`/`.ansi` files are the test goldens.

## Live view (`@frame12/terminal/ink`)

`./ink` needs the optional peers `ink@^8` and `react@^19.3`; nothing else in the package loads them.

```ts
import { detectCapabilities, resolveTerminalMotion } from '@frame12/terminal';
import { startLive } from '@frame12/terminal/ink';

const caps = detectCapabilities(process.env, process, process.argv);
const { tempo } = resolveTerminalMotion({ argv: process.argv, env: process.env, caps });
const run = startLive({ caps, motion: tempo, onCancel: () => job.abort() });
for await (const event of job.events()) run.push(event);
process.exitCode = await run.end();
```

- **The Director** (`createDirector`, in core, no React) validates, sanitizes and folds events
  into one `RunState`. Errors, warnings, cut and run endings, the snapshot, cancellation and key
  echo publish immediately; everything else coalesces to one publish per frame (newest wins);
  only the decorative pose follows the tempo (83.33 ms at `twos`, never at `still`), and only while
  a cut is running. Memory is bounded (500-line log ring, 200 warnings, at most 5,000 stored cuts,
  findings, receipts and metrics; past that, updates still apply and new items are only counted,
  since the snapshot carries the full result).
- **Keys:** `j`/`k` or arrows move, `Enter` inspects (every receipt), `Esc` closes, `o` opens the
  focused receipt's link after a `y/N` confirmation (https only), `?` toggles help, `q` quits.
- **Ctrl-C:** the first cancels gracefully (running cuts become `canceled`, results print, exit
  code 130); a second within 2 s forces exit. SIGTERM and SIGHUP cancel a running job like one
  Ctrl-C; a second one, or one when nothing is running, finishes with what is there and exits, so a
  closed terminal never leaves the process behind.
- **Exit codes:** `completed` 0, `failed` 1, `canceled` 130. EPIPE on stdout or stderr (`| head`,
  `2>&1 | head`) exits 0.
- **The terminal is always restored** (cursor, raw mode, alternate screen) on every exit path,
  including uncaught exceptions and unhandled rejections.
- **Linear fallback:** the live view runs only when stdin and stdout are terminals, outside CI,
  without a screen reader, with 10+ rows. Otherwise the same run is narrated as append-only lines
  and one line says why. `--screen-reader` prints plain, self-describing lines.
- **Results are printed linearly** when the live view closes, so nothing important exists only in
  a redraw. The alternate screen is opt-in (`fullscreen: true`) because it loses scrollback.
- **Resizing** re-lays out without leftovers. Terminals that re-wrap what is on screen when they
  narrow (iTerm2, kitty, WezTerm, VTE, Windows Terminal, VS Code; `caps.reflow`) get an extra
  cleanup of the re-wrapped rows; it is skipped elsewhere, where it would erase lines above the
  live view. `FRAME12_REFLOW=1|0` overrides the detection.
- **Foreign output:** `console.*` lands above the live region. A direct `process.stdout.write` or a
  child process writing to the terminal corrupts the live view: run children through
  `spawnLogged`, or use `--plain`. In development a stray write is reported once in the view.

```ts
import { spawnLogged } from '@frame12/terminal/process';

// No shell, so pass a real executable: on Windows `npm` is a .cmd shim that only a shell can run.
const { code } = await spawnLogged(run.director, process.execPath, ['--test'], { cut: 'test' });
```

`spawnLogged` never uses a shell, logs each stdout line as `info` and stderr line as `warn`
(sanitized and redacted), and resolves with the exit code. When the run is canceled it sends the
child SIGTERM, then SIGKILL if it is still running after `killAfterMs` (default 5000). A line
that never ends is bounded: past `maxLineLength` (default 16,384) its head is logged, the rest is
dropped, and one line says how many characters were not logged; carriage-return progress keeps
only its latest text. Once the child exits, its output gets `drainMs` (default 500) to arrive, so a
grandchild that inherited the pipes cannot keep the promise pending. In the linear view these lines are narrated like log events (errors and
warnings always), so a child's failure reason reaches CI logs too.

## Reference apps

[`examples/`](examples/) has three programs built only on the public API, each running in all four
renderers (`--format rich|plain|json|live`) with a VHS tape:

- **Repo Archaeology investigation:** wraps the published `repo-archaeology` CLI as child
  processes and maps its JSON to findings with commit receipts (adapter tested against a fixture
  from hono at a pinned commit). Follow-up rates read as historical activity, never correctness.
- **Build pipeline:** lint, typecheck, test and build through `spawnLogged`; a failure becomes a
  `danger` panel whose receipts are the failing tests and error lines.
- **Agent approval:** a tool call for an explicit y/N decision. It never approves by itself (a
  timeout or a non-interactive terminal denies), and untrusted free text in the arguments is
  withheld.

## The `frame12-term` CLI

Any program that can print JSON lines gets FRAME/12 output: emit contract v1 events, one per line,
and pipe them in.

```sh
my-tool --events | npx -p @frame12/terminal frame12-term render          # rich (default), plain, json or live
my-tool --events | npx -p @frame12/terminal frame12-term render --record run.f12rec
npx -p @frame12/terminal frame12-term render --from run.f12rec --replay --speed 2
```

`frame12-term` is the executable inside `@frame12/terminal`; once the package is installed, run
`frame12-term` (or `npx frame12-term`) directly. Without it installed, always name the package
(`npx -p @frame12/terminal …`): a bare `npx frame12-term` would look for a package called
`frame12-term`, which is not this one.

| Option | |
| --- | --- |
| `--from <file>` | Read events from a file instead of stdin (`.ndjson` or `.f12rec`) |
| `--format rich\|plain\|json\|live` | `rich` is the default; `--plain` and `--json` are shorthands. `live` needs the optional `ink`/`react` peers, and reads keys only when the events come from `--from` (stdin is then free for the keyboard); with events on stdin it falls back to the linear view |
| `--strict` | Stop at the first malformed line or invalid event, with exit code 2 |
| `--replay` | Play with the original timing (recording offsets, or event timestamps), labeled `REPLAY` |
| `--speed <n>` | Replay speed, default ×4. No wait between two events is longer than 1 s |
| `--record <file>` | Write the run as a `.f12rec` recording |
| `--verbose` | Also narrate `info` and `debug` log lines |

Capability flags (`--color`, `--no-color`, `--ascii`, `--links`, `--screen-reader`, `--motion`,
`--columns`, `--rows`) and environment variables work as everywhere else in the package. Exit
codes: `0` completed; `1` failed, incomplete, or the requested recording could not be completed;
`2` usage error or `--strict` failure (it wins over the others); `130` canceled. Narration goes to
stderr and results to stdout, as with the linear writer.

**Input limits.** A line longer than 64 KiB, or one that is not JSON, is reported with its line
number (`line 12: not valid JSON (…) (skipped)`) and skipped without being buffered; an invalid
event (or one of an unknown type) is skipped with a warning naming its line. The first 20 problems
are listed, the rest counted in one line; reading stops after the snapshot. `--strict` turns the first problem into a stop. A UTF-8 byte-order mark is ignored, a
recording of another version is one clear error (exit 2), and everything quoted from the input is
sanitized before it is printed. A completed run whose snapshot never arrived exits 1 (no results
were shown). `--record` is checked before any input is read: a path that cannot be written, or the
input file itself (the same file, however it is named, `--from` or stdin), is a usage error. The
recording is written to a temporary file and moved into place when it ends, so a run that stops
early never replaces an existing file. A recording entry line may exceed 64 KiB by its small
envelope, so every accepted event can be read back.

### Emitters

Each of these prints a complete run (start, one cut, end, snapshot) that `frame12-term render
--strict` accepts; the package's tests run all three through the CLI.

<!-- emitter: python -->
```python
import json
from datetime import datetime, timezone

seq = 0
def now(): return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
def emit(type, **fields):
    global seq
    seq += 1
    print(json.dumps({"schemaVersion": 1, "type": type, "runId": "py-1", "seq": seq, "ts": now(), "id": f"py-1-{seq}", **fields}), flush=True)

started = now()
emit("run-start", title="Build the docs")
emit("cut-start", cut="compile", title="Compile")
emit("cut-end", cut="compile", status="ok")
emit("run-end", status="completed")
emit("snapshot", snapshot={"schemaVersion": 1, "runId": "py-1", "title": "Build the docs", "status": "completed",
    "startedAt": started, "finishedAt": now(), "cuts": [{"cut": "compile", "title": "Compile", "status": "ok"}],
    "metrics": [], "findings": [], "warnings": []})
```

<!-- emitter: go -->
```go
package main

import (
	"encoding/json"
	"fmt"
	"time"
)

var seq = 0

func now() string { return time.Now().UTC().Format("2006-01-02T15:04:05.000Z") }

func emit(kind string, fields map[string]any) {
	seq++
	fields["schemaVersion"], fields["type"], fields["runId"] = 1, kind, "go-1"
	fields["seq"], fields["ts"], fields["id"] = seq, now(), fmt.Sprintf("go-1-%d", seq)
	line, _ := json.Marshal(fields)
	fmt.Println(string(line))
}

func main() {
	started := now()
	emit("run-start", map[string]any{"title": "Build the docs"})
	emit("cut-start", map[string]any{"cut": "compile", "title": "Compile"})
	emit("cut-end", map[string]any{"cut": "compile", "status": "ok"})
	emit("run-end", map[string]any{"status": "completed"})
	emit("snapshot", map[string]any{"snapshot": map[string]any{"schemaVersion": 1, "runId": "go-1", "title": "Build the docs",
		"status": "completed", "startedAt": started, "finishedAt": now(), "metrics": []any{}, "findings": []any{}, "warnings": []any{},
		"cuts": []any{map[string]any{"cut": "compile", "title": "Compile", "status": "ok"}}}})
}
```

<!-- emitter: rust -->
```rust
use std::time::{SystemTime, UNIX_EPOCH};

// UTC ISO 8601 from the system clock (the standard library has no date formatting).
fn now() -> String {
    let ms = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as i64;
    let (z, t) = (ms.div_euclid(86_400_000) + 719_468, ms.rem_euclid(86_400_000));
    let (era, doe) = (z.div_euclid(146_097), z.rem_euclid(146_097));
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let (d, m) = (doy - (153 * mp + 2) / 5 + 1, if mp < 10 { mp + 3 } else { mp - 9 });
    let y = yoe + era * 400 + i64::from(m <= 2);
    format!("{y:04}-{m:02}-{d:02}T{:02}:{:02}:{:02}.{:03}Z", t / 3_600_000, t / 60_000 % 60, t / 1000 % 60, t % 1000)
}

fn emit(seq: &mut u32, kind: &str, fields: &str) {
    *seq += 1;
    println!(r#"{{"schemaVersion":1,"type":"{kind}","runId":"rs-1","seq":{seq},"ts":"{}","id":"rs-1-{seq}"{fields}}}"#, now());
}

fn main() {
    let (mut seq, started) = (0, now());
    emit(&mut seq, "run-start", r#","title":"Build the docs""#);
    emit(&mut seq, "cut-start", r#","cut":"compile","title":"Compile""#);
    emit(&mut seq, "cut-end", r#","cut":"compile","status":"ok""#);
    emit(&mut seq, "run-end", r#","status":"completed""#);
    let snapshot = format!(r#","snapshot":{{"schemaVersion":1,"runId":"rs-1","title":"Build the docs","status":"completed","startedAt":"{started}","finishedAt":"{}","cuts":[{{"cut":"compile","title":"Compile","status":"ok"}}],"metrics":[],"findings":[],"warnings":[]}}"#, now());
    emit(&mut seq, "snapshot", &snapshot);
}
```

### Recordings (`.f12rec`)

A recording is the run's data, not its screen: NDJSON whose first line is the header
`{"f12rec":1,"schemaVersion":1}` (written as soon as recording starts, so even an empty recording is
recognizable), then one `{"t":<ms>,"event":{…}}` line per accepted event, ending with the snapshot.
`t` comes from the events' own `ts` (ms since the first event's, never decreasing), so a recording
keeps the run's real rhythm however fast its events were read, and re-recording a replay keeps it
too; the same events always give the same bytes. Events are recorded after validation and
sanitization: tokens are masked in links as in text, and links (remotes) also go through the
redaction hook (paths already do, as identifiers), so a recording never holds what the renderers
would not print. A hook that throws on a link drops that link. A sink that fails stops the
recording with a visible warning ("Recording stopped: …; run.f12rec is incomplete"), never
silently. A recording always renders labeled `REPLAY`.

- **CLI:** `--record <file>`; play back with `render --from <file>` (add `--replay` for timing).
- **Live view:** `startLive({ record: 'run.f12rec' })` (a path, or a sink).
- **Director:** `createDirector({ record: sink })`, where a sink is `{ write(line), end?() }`. Core
  has no file system, so it can run in a browser (the docs site plays recordings); in Node, for
  example `{ write: (l) => fs.appendFileSync(path, l) }`.
- **Reading:** `isRecordingHeader(value)`, `recordingHeaderIssue(value)` and `parseRecordingEntry(value)`
  from the core.

## Capabilities

```ts
import { detectCapabilities } from '@frame12/terminal';

const caps = detectCapabilities(process.env, process, process.argv);
// { colorLevel, stderrColorLevel, attributes, unicode, ambiguousWide, links, columns, rows,
//   isTTY, stderrIsTTY, interactive, screenReader, ci, ciProvider, dumb, multiplexer, reflow }
```

`detectCapabilities` is pure: everything it reads is passed in. Color is resolved separately for
stdout (results) and stderr (narration), so `cmd > out.txt` writes plain results while narration
stays styled.

### Environment variables and flags

| Variable / flag | Effect |
| --- | --- |
| `--color` / `--no-color` | Force color on (terminal's depth) or off. The last one wins. |
| `NO_COLOR` (non-empty) | No color ([no-color.org](https://no-color.org)). Bold, dim, inverse and underline remain on a TTY. |
| `NODE_DISABLE_COLORS` (non-empty, not `0`) | No color. |
| `FORCE_COLOR` | `0`/`false` off, `1`/`true` 16 colors, `2` 256, `3` truecolor; honored on pipes. |
| `TERM=dumb` | No color, ASCII glyphs, no links, no motion, not interactive. |
| `COLORTERM`, `TERM_PROGRAM`, `WT_SESSION`, `TERM=*256color` | Color depth. |
| `--ascii` / `--unicode`, `FRAME12_ASCII=1` | ASCII twins for every glyph, or force Unicode. Otherwise Unicode follows the locale (`LC_ALL`, `LC_CTYPE`, `LANG`) and known terminals; legacy Windows console gets ASCII. |
| `FRAME12_AMBIGUOUS_WIDE=1` / `0` | Treat East Asian ambiguous-width characters as 2 cells (on by default for `ja`, `zh`, `ko` locales). |
| `--links` / `--no-links`, `FRAME12_LINKS=1` / `0` | OSC 8 hyperlinks. Default on only for TTYs in terminals known to support them, never in CI, pipes or `TERM=dumb`, and off inside tmux and screen unless `FRAME12_LINKS=1`. `FORCE_HYPERLINK` is also read. |
| `--columns N`, `--rows N`, `COLUMNS`, `LINES` | Size. A TTY's own size wins over `COLUMNS`/`LINES`. Clamped to 20–400 columns and 5–200 rows. |
| `--screen-reader`, `FRAME12_SCREEN_READER=1`, `INK_SCREEN_READER=true` | Screen-reader mode: append-only plain lines, no cursor movement, no motion. |
| `CI`, `GITHUB_ACTIONS`, `GITLAB_CI`, `BUILDKITE`, `CIRCLECI`, `JENKINS_URL`, `TF_BUILD`, … | CI: not interactive, no links, no motion. |
| `--motion auto\|twos\|ones\|still`, `FRAME12_MOTION` | Tempo (below). |
| `NO_MOTION`, `REDUCED_MOTION` (non-empty, not `0`) | No animation. |

## Motion

**Terminals have no operating-system reduced-motion signal.** There is no
`prefers-reduced-motion` for a TTY, so set `NO_MOTION=1` (or `REDUCED_MOTION=1`) in your shell
profile if you want stillness everywhere. FRAME/12 also turns motion off on its own wherever
motion cannot help.

`resolveTerminalMotion({ argv, env, caps })` uses FRAME/12's Tempo values:

1. `--motion <auto|twos|ones|still>` (an explicit `--motion auto` overrides `FRAME12_MOTION`)
2. `FRAME12_MOTION`
3. `NO_MOTION` / `REDUCED_MOTION` → `still`
4. not interactive, CI, a screen reader or `TERM=dumb` → `still`
5. `auto` → the component's default, `twos` (12 poses per second, 83.33 ms)

Motion only paces decoration: progress glyphs, tone-bar fills, cut transitions. Key echo,
errors, cut and run endings, and cancellation are always shown immediately.

## Security

Every string from a producer is untrusted. `createSanitizer()` cleans every field of an event or
snapshot before a renderer sees it:

- **Escape sequences removed:** CSI, OSC (including smuggled OSC 8 links and OSC 52 clipboard
  writes), DCS, APC, PM, SOS and two-byte ESC sequences, in 7-bit and C1 forms.
- **Overwrite tricks made visible:** a carriage return becomes a line break and a backspace
  becomes `\x08`, so text cannot be painted over.
- **Trojan Source:** bidi controls are shown as `\u{202e}` escapes. Zero-width characters are
  shown as escapes in ids, paths and labels.
- **Tabs and length:** tabs expand at fixed 4-cell stops; lines over 2,000 graphemes end in
  `…+N chars`. Sanitizing twice changes nothing, and a count is never read from the input.
- **Unterminated sequences** end at the line break, so they can never hide the lines after them.
- **Links:** `https:` only (`http:` to localhost when allowed), credentials removed, and the
  only OSC 8 sequences in output are ones this package emits.
- **Redaction:** GitHub (`ghp_`, `gho_`, `ghs_`, `github_pat_`), OpenAI and Anthropic (`sk-`),
  Slack (`xoxa-`, `xoxb-`, `xoxp-`, `xoxr-`), AWS access key ids, JWTs and URL credentials are
  masked as `[redacted]` in every text field: commands, errors, warnings, titles, logs and
  receipts. Ids, paths and labels are left intact so findings and receipts stay linked. Pass `redact(text, { field, source })` for
  your own secrets; it runs on every field, and its output is sanitized again.

## Width

`stringWidth`, `truncateMiddle`, `truncateEnd`, `wrap` and `padEnd` measure grapheme clusters
(UAX #29) with East Asian Width from Unicode 17.0.0 (UAX #11): wide and fullwidth are 2 cells,
ambiguous is 1 (2 under `ambiguousWide`), emoji presentation, ZWJ sequences and flags are 2, and
combining marks are 0. Middle truncation never splits a grapheme and keeps a path's file name.
Wrapping breaks only at spaces, so a path or URL is never split unless it alone is wider than the
line.

## Tokens

Terminal tokens are derived at build time from `@frame12/tokens`. Because a terminal's background
can't be detected reliably, ink is always the terminal's own foreground: secondary ink and rules
are `dim`, and statuses use weight and inversion, like FRAME/12's monochrome web statuses. Exact
colors appear only on the marker chip, which sets both its background and its text.

| Level | When | Marker chip |
| --- | --- | --- |
| `truecolor` | `colorLevel` 3 | `#ffd60a` background, `#121212` text |
| `ansi256` | `colorLevel` 2 | nearest index (220 on 233), computed |
| `ansi16` | `colorLevel` 1 | bright-yellow background (103), black text, hand-tuned |
| `mono` | color off on a TTY | inverse + bold (inverse is reserved for the marker) |
| `none` | pipes, files, `TERM=dumb` | no escape sequences |

Gutters translate to cells: a pair (12 px) is 1, a scene (20 px) is 2, a change (32 px) is 3.

## Testing helpers

`@frame12/terminal/testing` exports `createEventFactory` (deterministic `seq`, `ts` and `id` from
an injected clock), `fakeStreams`, `toNdjson`, and seven v1 fixtures: `success`, `failed`,
`canceled`, `empty`, `one-finding`, `forty-findings` and `repo-archaeology`.

## Compatibility

| | Target | Verified in this release |
| --- | --- | --- |
| Node | 22, 24 | 22 and 24 on ubuntu, macOS and Windows (CI `terminal` job) |
| OS | macOS 14+ (Terminal.app, iTerm2, Ghostty, WezTerm, kitty), Linux (GNOME Terminal/VTE, Konsole, xterm, Alacritty), Windows 11 (Windows Terminal, VS Code; legacy conhost: `plain` only) | Detection rules only (table tests); renderers arrive in PR 2 |
| Multiplexers | tmux 3.x, GNU screen (no links by default) | Detection rules only |
| Remote and CI | SSH; GitHub Actions, GitLab CI and Buildkite logs (non-interactive) | Detection rules only |
| Ink adapter | `ink@8.0.x` + `react@19.3.x` | `ink@8.0.0` + `react@19.3.1`, with real-pty tests (node-pty + @xterm/headless) on ubuntu, macOS and Windows (ConPTY; POSIX-signal tests skipped there) |

Bun and Deno: best effort, not guaranteed.

## License

MIT
