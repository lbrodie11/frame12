# Porting PR #2 (`experiments/terminal-storyboard`) to `@frame12/terminal`

PR #2 (tip `22a8b66`, 15 commits) is not merged. Its code moves into this package across the six
F12-13 pull requests, and its tests either gain an equivalent here or are listed as obsolete with a
reason. This file is the record; PR 1's description links to it, and the closing comment on PR #2
reuses the tables below.

## Test count

The F12-13 prompt says PR #2 has 41 tests. `tests/storyboard.test.mjs` at `22a8b66` contains
**28 `it()` tests in 11 `describe()` suites** (39 `node:test` nodes counting the root suite). The
28 tests are mapped below.

## File destinations

| PR #2 path | Destination | Status |
| --- | --- | --- |
| `src/model/types.ts`, `src/model/validate.ts` | `src/core/contract.ts`, `src/core/validate.ts` (contract v1) | Done in PR 1 |
| `src/render-plain/index.ts` (`sanitizeTerminalText`, `shouldUseColor`, `getDisplayWidth`, `wrapLineToWidth`) | `src/core/safety.ts`, `src/core/capabilities.ts`, `src/core/width.ts` (merged with Repo Archaeology's) | Done in PR 1; the plain renderer itself lands in PR 2 as `src/render/plain.ts` |
| `src/render-ink/*` | `src/ink/*` (`Storyboard`, `Cut`, `Inspector`, `HintBar`), without Git vocabulary | Done in PR 3 |
| `src/workload/*` | `examples/repo-archaeology/` (reference only) | PR 5 |
| `src/render-web/*` | docs-site integration | PR 6 |
| `fixtures/repo-archaeology-reconstructed.json` | `testing` fixture `repo-archaeology` (converted once to v1) | Done in PR 1 |
| `tests/*` | ported per module (below) | In progress |

## Tests

| # | PR #2 test | Destination | Status |
| --- | --- | --- | --- |
| 1.1 | keeps src/model pure (no React, fs, child_process, registry imports) | `tests/boundaries.test.mjs`: loader-hook import test and source scan for all of core | Ported (stricter) |
| 1.2 | accepts a valid live event stream and ResultSnapshot | `tests/contract.test.mjs`: every fixture validates alone, as a stream, and against the JSON Schema | Ported |
| 1.3 | rejects unknown event types and unsupported schemaVersion | `tests/contract.test.mjs`: unsupported schemaVersion rejected; unknown types are now **ignorable warnings** | Ported, behavior changed by the v1 forward-compatibility rule |
| 1.4 | rejects presentation cut numbers (C-01) as domain stepId | `tests/contract.test.mjs`: rejects `C-01`, `F-01`, `E-01` as ids | Ported (wider) |
| 1.5 | rejects duplicate eventId, out-of-order seq, missing run-start, unstarted step-end | `tests/contract.test.mjs`: stream rules and run lifecycle | Ported |
| 1.6 | rejects events after run-end, incomplete streams missing run-end, oversized payloads | `tests/contract.test.mjs`: `after-run-end`, `finish()` → `missing-run-end`, 8 KiB / 1 MiB caps | Ported |
| 1.7 | rejects malformed finding/metric/warning payloads, negative counts, unclosed steps, NaN/Infinity, malformed hotFiles/reconstructed | `tests/contract.test.mjs`: malformed findings, NaN, ranges, `cut-not-ended` | Ported; `hotFiles` / `reconstructed` are obsolete (Git-specific fields are not in the generic contract) |
| 2.1 | exact top co-changing pairs for fixtures A and B | Reference app adapter test | PR 5; Git analysis is not product code |
| 2.2 | astral emoji in C-quoted git paths, NFD→NFC, >10 KB subjects | Emoji and grapheme preservation: `tests/safety.test.mjs`, `tests/width.test.mjs`; line cap: `tests/safety.test.mjs`. Git path unquoting moves to PR 5 | Partly ported; NFC normalization dropped on purpose (it changes path identity) |
| 2.3 | `**` globs in `--exclude`, pair classification | Reference app | PR 5 (Git workload) |
| 2.4 | full path identities (>320 chars), rejects paths >2048 bytes | Middle truncation never merges or splits: `tests/width.test.mjs`; size caps: `tests/contract.test.mjs` | Partly ported; the workload half moves to PR 5 |
| 3.1 | identical findings, pairs, counts, ratios and SHAs across all 3 views | Data-integrity test (every number, path and id in plain, rich and live) | PR 2 / PR 3 |
| 3.2 | SNAPSHOT ONLY notice for events=[]; throws on invalid stream; no Radix bundling | Renderer test (PR 2); HTML report (PR 6) | PR 2 / PR 6 |
| 4.1 | strips CSI, OSC 8 (keeping the label), CR/BS, bidi; HTML-escapes tags | `tests/safety.test.mjs`: 10,000-case fuzz plus specific attacks | Ported; CR/BS are now **made visible** instead of stripped, so overwritten text can't hide. HTML escaping moves to PR 6 |
| 5.1 | CLI flags: `--json`, `--events`, `--baseline`, `--replay`, `--exclude`, bounds | `frame12-term` CLI tests | PR 4 |
| 5.2 | live narration on stderr before step-end; FORCE_COLOR; CJK/emoji wrap at 40/80/120 | Color precedence: `tests/capabilities.test.mjs`; wrap property: `tests/width.test.mjs`; streams test | Partly ported; stderr narration in PR 2 |
| 5.3 | sanitizes escapes in replay, import and CLI error diagnostics | CLI tests | PR 4 |
| 6.1 | single run-end (failed) and exit 1 for a non-git dir or unwritable report path | Lifecycle and exit codes | PR 3 (exit codes), PR 5 (Git) |
| 6.2 | empty unborn repo vs corrupt HEAD | Reference app | PR 5 |
| 6.3 | mid-workflow git failure and subprocess timeout | `spawnLogged` and reference app | PR 3 / PR 5 |
| 6.4 | single run-end (canceled) with no trailing events on AbortSignal | `tests/director.test.mjs` (cancel, signal), `tests/live.pty.test.mjs` (Ctrl-C, SIGINT, SIGTERM) | Ported |
| 7.1 | Repo Archaeology schemaVersion 1 adapter | Fixture converted now (`fixture('repo-archaeology')`); adapter test against a pinned hono SHA | PR 5 |
| 8.1 | offline HTML report in Chromium (1280/390, light/dark, 0 requests, axe) | Docs-site integration | PR 6 |
| 9.1 | `check-frame12.mjs` passes on the experiment's src | Grammar tests for terminal output (one marker, no yellow foreground, no boxes, status words) | PR 2; `check-frame12` rules target CSS/TSX, which the terminal core does not contain |
| 10.1 | Ink components at 40/60/80/120 columns, `--ascii`, NO_COLOR | `tests/ink.test.mjs` (the components draw the width-tested PR 2 grammar) | Ported |
| 10.2 | 12 fps throttle, no-op redraw skip, immediate lifecycle flush, resize | `tests/director.test.mjs` (pacing, coalescing, immediate paths, idle), `tests/live.pty.test.mjs` (resize, latency, idle bytes) | Ported |
| 10.3 | `--style auto\|panels\|plain` resolution, exit code 2 for incompatible flags | `--format` resolution | PR 4 |
| 10.4 | plain output byte-identical to golden; never loads ink in plain/json | Goldens (PR 2); loader hook for `.` and `./render` (`tests/boundaries.test.mjs`) | Partly ported; goldens in PR 2 |
