# Changelog: `@frame12/terminal`

All notable changes to `@frame12/terminal` are documented in this file.
This package adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - Unreleased

### Added

- Foundation (F12-13 PR 1). Core entry point `@frame12/terminal`, with no React, Ink, Git or
  child processes, and `@frame12/tokens` (exact version) as its only runtime dependency.
  - **Event contract v1** (`schemaVersion: 1`): `run-start`, `scene-start`, `cut-start`,
    `cut-progress`, `metric`, `finding`, `receipt`, `log`, `warning`, `cut-end`, `scene-end`,
    `run-end` and the authoritative `snapshot`. Generic findings (`subject`, `strength`,
    `prominence`, `status`, `receipts`) with no Git vocabulary. JSON Schema generated from the
    same spec as the validator, published as `@frame12/terminal/schema.json`.
  - **Validation** (`validateEvent`, `validateSnapshot`, `createStreamValidator`): typed issues,
    never throws, 8 KiB event and 1 MiB snapshot caps (configurable), unknown event types
    ignored with a warning, unknown fields preserved, presentation labels (`C-01`) rejected as
    ids, `__proto__` / `constructor` / `prototype` keys rejected, a snapshot's `runId` checked
    against its event's, timestamps checked by one pattern shared with the schema, strictly
    increasing `seq`, monotonic `cut-progress`, and the run lifecycle (`run-start`
    first, cuts started before they end and ended before `run-end`, receipts only for announced
    findings; `lifecycle: false` reads partial streams, `finish()` reports incomplete ones).
  - **Capabilities** (`detectCapabilities(env, streams, argv)`, pure): Repo Archaeology's color
    precedence plus `--color`, and `unicode`, `ambiguousWide`, `links` (OSC 8 terminal allowlist;
    off in CI, pipes, `TERM=dumb`, tmux and screen unless `FRAME12_LINKS=1`), `columns`/`rows`
    (clamped), `interactive`, `screenReader`, `ci`/`ciProvider`, `attributes`.
  - **Motion** (`resolveTerminalMotion`): F12-08 Tempo values `auto | twos | ones | still`, with
    `--motion` > `FRAME12_MOTION` > `NO_MOTION`/`REDUCED_MOTION` > environment > default.
  - **Safety** (`sanitizeText`, `createSanitizer`, `safeLink`, `formatLink`, `redactSecrets`):
    one sanitizer merged from Repo Archaeology and PR #2 for CSI, OSC (incl. OSC 8 and OSC 52),
    DCS/APC/PM/SOS, ESC and C1 forms, CR/BS overwrite tricks, bidi controls, zero-width
    characters, tabs and oversized lines; `https:`-only links without credentials; a redaction
    hook and default masks, on every text field (not ids or paths), for GitHub, OpenAI/Anthropic, Slack, AWS, JWT
    and URL-credential shapes.
  - **Width** (`stringWidth`, `graphemeWidth`, `truncateMiddle`, `truncateEnd`, `wrap`,
    `padEnd`): grapheme clusters, UAX #11 from Unicode 17.0.0 with the ambiguous-width switch,
    emoji presentation, ZWJ, flags and combining marks.
  - **Tokens** (`roleSgr`, `paint`, `tokenSgr`, `nearestAnsi256`, `ANSI16`, `GUTTER_CELLS`):
    derived at build time from `@frame12/tokens`; truecolor, computed nearest 256, a
    hand-tuned 16-color table, and `mono` / `none` levels. Marker yellow is only ever a
    background chip.
  - **Linear renderers** (F12-13 PR 2, `@frame12/terminal/render`): `renderJson`, `renderPlain`,
    `renderRich` and `createLinearWriter` (narration to stderr, results to stdout, append-only,
    no spinner). The grammar as pure functions (`masthead`, `cut`, `panel`, `panelPair`,
    `evidenceCard`, `compactFinding`, `receiptList`, `toneBar`, `metricRows`, `hintBar`), the
    `GLYPHS` table with ASCII twins, width tiers, and one marker chip per render.
  - **Director and live view** (F12-13 PR 3): `createDirector` (core) with immediate, coalesced
    and tempo-paced publishing and bounded memory (`maxItems` caps stored cuts, findings, receipts
    and metrics; receipts merged in linear time and without duplicates; a cancel that lands before
    run-start sticks); `@frame12/terminal/ink` (`startLive`,
    `Storyboard`, `Cut`, `Inspector`, `HintBar`) on optional `ink@^8` / `react@^19.3` peers, with
    keys, Ctrl-C/SIGINT/SIGTERM/SIGHUP handling, exit codes, terminal restoration on every exit
    path, EPIPE handling, a linear fallback, focus that follows its finding when the order
    changes, final results that keep the live view's cut labels, `onCancel` for a host-supplied
    Director too, and reflow-aware resizing; `@frame12/terminal/process` (`spawnLogged` with SIGKILL
    after `killAfterMs` when a canceled child ignores SIGTERM, bounded pending lines via
    `maxLineLength`, and child output narrated in the linear view; `openUrl`). `LinearWriter.log()`
    narrates log lines that did not arrive as events. `Director.tap()` sees every pushed event (the
    linear view narrates events pushed straight to a shared Director); `LogLine.origin` tells event
    logs from host logs; `Capabilities.reflow` gates the resize cleanup to terminals that re-wrap;
    SIGTERM/SIGHUP finish and exit when nothing is left to cancel; EPIPE on stderr exits 0; final
    results use the current width; `spawnLogged` settles `drainMs` after the child exits even if a
    grandchild holds its pipes.
  - **The `frame12-term` CLI and recordings** (F12-13 PR 4): `frame12-term render` reads NDJSON
    events from stdin or `--from` and renders `--format rich|plain|json|live`, with a 64 KiB line
    limit, line-numbered reports of malformed lines, `--strict`, `--replay` (original timing,
    `--speed`, default ×4, gaps capped at 1 s, labeled `REPLAY`) and `--record`. Deterministic
    `.f12rec` recordings (`createDirector({ record })`, `startLive({ record })`): sanitized events
    timed by their own `ts`, ending with the snapshot; tokens are masked in links (live OSC 8 links
    too) and links go through the redaction hook. **Note for redaction hooks:** `RedactField` gains
    `link`, so a hook with an exhaustive `switch` needs a case for it (at runtime a hook that throws
    on a link only drops that link). `startLive` gains `format`, `verbose`, `replay` and `record`,
    and its session runs without React or Ink for the linear formats. Go, Python and Rust emitters in the
    README, tested through the CLI.
  - Contract: optional `Finding.relation` (`history-only | direct | indirect`) for typed connectors;
    the stream validator rejects a second `snapshot` (`duplicate-snapshot`).
  - `@frame12/terminal/testing`: `createEventFactory` (injected clock), `fakeStreams`, and seven
    deterministic v1 fixtures, including PR #2's Repo Archaeology fixture converted once to v1.
