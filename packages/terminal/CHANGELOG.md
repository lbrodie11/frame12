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
  - `@frame12/terminal/testing`: `createEventFactory` (injected clock), `fakeStreams`, and seven
    deterministic v1 fixtures, including PR #2's Repo Archaeology fixture converted once to v1.
