# @frame12/terminal

FRAME/12's interface language for the command line. A long-running command reads as a sequence
of **cuts** (`C-01`, `C-02`…), the finding that matters comes first as a **frame** (`F-01`), and
every claim carries **receipts** (`E-01`).

> **Status: 0.1.0 in progress (F12-13 PRs 1–3).** The core, the zero-dependency linear renderers
> (`./render`), the Director, the live Ink view (`./ink`) and `spawnLogged` (`./process`) are in.
> The `frame12-term` CLI arrives in PR 4.

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
  a cut is running. Memory is bounded (500-line log ring, 200 warnings, events counted past 5,000).
- **Keys:** `j`/`k` or arrows move, `Enter` inspects (every receipt), `Esc` closes, `o` opens the
  focused receipt's link after a `y/N` confirmation (https only), `?` toggles help, `q` quits.
- **Ctrl-C:** the first cancels gracefully (running cuts become `canceled`, results print, exit
  code 130); a second within 2 s forces exit. SIGTERM and SIGHUP cancel like one Ctrl-C.
- **Exit codes:** `completed` 0, `failed` 1, `canceled` 130. EPIPE on stdout (`| head`) exits 0.
- **The terminal is always restored** (cursor, raw mode, alternate screen) on every exit path,
  including uncaught exceptions and unhandled rejections.
- **Linear fallback:** the live view runs only when stdin and stdout are terminals, outside CI,
  without a screen reader, with 10+ rows. Otherwise the same run is narrated as append-only lines
  and one line says why. `--screen-reader` prints plain, self-describing lines.
- **Results are printed linearly** when the live view closes, so nothing important exists only in
  a redraw. The alternate screen is opt-in (`fullscreen: true`) because it loses scrollback.
- **Resizing** re-lays out without leftovers, including terminals that re-wrap what is on screen.
- **Foreign output:** `console.*` lands above the live region. A direct `process.stdout.write` or a
  child process writing to the terminal corrupts the live view: run children through
  `spawnLogged`, or use `--plain`. In development a stray write is reported once in the view.

```ts
import { spawnLogged } from '@frame12/terminal/process';

const { code } = await spawnLogged(run.director, 'npm', ['test'], { cut: 'test' });
```

`spawnLogged` never uses a shell, logs each stdout line as `info` and stderr line as `warn`
(sanitized and redacted), kills the child when the run is canceled, and resolves with the exit code.

## Capabilities

```ts
import { detectCapabilities } from '@frame12/terminal';

const caps = detectCapabilities(process.env, process, process.argv);
// { colorLevel, stderrColorLevel, attributes, unicode, ambiguousWide, links, columns, rows,
//   isTTY, stderrIsTTY, interactive, screenReader, ci, ciProvider, dumb, multiplexer }
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
