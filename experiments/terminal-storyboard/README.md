# FRAME/12 — Terminal Storyboard Proof of Concept (`experiments/terminal-storyboard`)

> **Status:** Experimental Proof of Concept (`schemaVersion: "0-experimental"`) · Branch: `experiment/terminal-storyboard`
> **Scope:** Isolated vertical slice testing whether a single structured event stream + result snapshot can drive both (a) accessible, append-only plain terminal narration and (b) an offline, zero-JS static HTML report built from real FRAME/12 registry components.

---

## Implementation Plan (Written Before Code)

### 1. Planned File Layout

```text
experiments/terminal-storyboard/
  README.md                              # Upfront plan, usage commands, side-by-side output comparison, honest evaluation, and usability test script
  package.json                           # Private experiment scripts (build, typecheck, test, demo) — isolated from root workspaces
  tsconfig.json                          # TypeScript config mapping @/components/frame12 -> ../../registry/ui
  scripts/
    build.mjs                            # esbuild compiler keeping core/plain React-free and render-web as a separate entry point
  bin/
    storyboard.ts                        # CLI entry point: `storyboard run <repo-path> [flags]`
  src/
    model/                               # Framework-free TypeScript event & snapshot contract (no React, Ink, fs, or FRAME/12 imports)
      types.ts                           # StoryboardEvent, ResultSnapshot, CochangeFinding, StepId, EventType
      validate.ts                        # Runtime validator & stream state machine (seq order, post-run-end, payload bounds)
      index.ts
    core/                                # Re-exports of src/model/* for architectural compatibility
      types.ts
      events.ts
      validate.ts
      state.ts
    workload/                            # Real live git-history co-change analysis (<200 lines, child_process.spawn, shell: false)
      git-history.ts                     # Incremental event emission during `git log --name-only` parsing & pair ranking
      repo-archaeology-adapter.ts        # Converter from Repo Archaeology schemaVersion: 1 JSON to ResultSnapshot (labeled reconstructed)
    workflows/
      git-history.ts                     # Re-export of src/workload/git-history.ts
    render-plain/                        # Append-only terminal & baseline renderer (no cursor motion, spinners, or Ink)
      index.ts                           # Sanitizer (C0/C1, CSI, OSC 8, bidi), C-01..C-0N formatter, and --baseline formatter
    render-web/                          # Separate entry point: offline static HTML report using real FRAME/12 registry components
      index.tsx                          # react-dom/server renderToStaticMarkup + inlined registry/styles/frame12.css
    renderers/
      plain.ts                           # Re-export of src/render-plain/index.ts
      web.tsx                            # Re-export of src/render-web/index.tsx
    cli.ts                               # CLI argument parser, stream router, and SIGINT / error lifecycle handler
  fixtures/
    create-fixture-repo.ts               # Deterministic temp git repo generator (scripted co-change commits, no tracked .git)
    repo-archaeology-reconstructed.json  # Representative Repo Archaeology v0.3.0 (schemaVersion: 1) completed snapshot
  tests/
    storyboard.test.mjs                  # Automated suite: validator, equivalence, terminal escape safety, output contracts, lifecycle, and Playwright HTML audit
```

### 2. Event & Snapshot Schema (`schemaVersion: "0-experimental"`)

- **`StoryboardEvent`:**
  - `schemaVersion`: `"0-experimental"` (experimental; no backward compatibility promised)
  - `eventId`: unique string per event within a run (e.g., `"evt-0001"`)
  - `runId`: unique string identifying the run (e.g., `"run-mvzvalvy"`)
  - `seq`: monotonically increasing positive integer (`1, 2, 3, ...`)
  - `ts`: ISO-8601 UTC timestamp string
  - `type`: `'run-start' | 'step-start' | 'step-progress' | 'metric' | 'finding' | 'warning' | 'step-end' | 'run-end'`
  - `stepId`: semantic step ID (`'validate-repo' | 'read-history' | 'pair-cochanges' | 'rank-findings' | null`) — `C-01`, `C-02` cut numbers are assigned strictly by renderers in presentation order and never stored as domain identity.
  - `payload`: size-bounded (`<= 8192` UTF-8 bytes) discriminated union per event `type`.
- **`ResultSnapshot`:**
  - Authoritative structured result distinct from the event stream: `schemaVersion`, `runId`, `status` (`'completed' | 'failed' | 'canceled'`), `repoLabel`, `startedAt`, `finishedAt`, `maxCommits`, `commitsExamined`, `uniqueFilesObserved`, `totalPairsObserved`, `findings` (`id`, `files: [string, string]`, `cochangeCount`, `fileACommits`, `fileBCommits`, `couplingRatio`, `evidence: { commitShas, sampleSubjects, count }`, `reason`), `hotFiles`, `warnings`, `error`, and optional `reconstructed` metadata.

### 3. CLI Flags & Stream Contract (`bin/storyboard.ts`)

```text
storyboard run <repo-path> [--max-commits N] [--top N] [--events | --json | --baseline] [--report <out.html>] [--theme light|dark] [--replay <events.ndjson>]
storyboard import-archaeology <fixture.json> [--report <out.html>] [--json | --baseline] [--theme light|dark]
```

- **`stderr`:** Human-readable live storyboard progress narration (default mode) and diagnostic/error messages.
- **`stdout`:**
  - Default: Final human-readable storyboard summary and findings table.
  - `--baseline`: Unframed plain list of findings (no `C-01` cuts, no step narration) for A/B usability comparison.
  - `--json`: Only the serialized `ResultSnapshot` JSON (`--json` and `--events` are mutually exclusive -> exit `2`).
  - `--events`: Only valid NDJSON `StoryboardEvent` lines.
- **Signals & Exit Codes:**
  - `0`: Completed (`status: "completed"`)
  - `1`: Workload/Git failure (`status: "failed"`, single `run-end` event emitted)
  - `2`: Invalid CLI flags or validation error
  - `130`: `SIGINT` cancellation (`status: "canceled"`, single `run-end` event emitted, child `git` process terminated, streams flushed)

---

## How to Run the Demo

All commands run from `/Users/brodie/Workspace/frame12/experiments/terminal-storyboard` using the existing root `node_modules` (no extra packages installed):

```bash
cd experiments/terminal-storyboard

# 1. Build, typecheck, lint (check-frame12.mjs), and run all 16 automated tests:
npm test

# 2. Run the storyboard CLI against this repository and generate an offline HTML report:
npm run demo
# -> Streams C-01..C-04 narration to stderr, prints findings to stdout,
#    and writes dist/sample-report.html

# 3. Compare output modes on any git repository:
node dist/bin/storyboard.js run ../.. --max-commits 40
node dist/bin/storyboard.js run ../.. --max-commits 40 --baseline
node dist/bin/storyboard.js run ../.. --max-commits 40 --json
node dist/bin/storyboard.js run ../.. --max-commits 40 --events > dist/events.ndjson

# 4. Replay a saved NDJSON event stream (explicitly labeled [REPLAY]):
node dist/bin/storyboard.js run --replay dist/events.ndjson

# 5. Convert a completed Repo Archaeology (schemaVersion: 1) JSON snapshot into a
#    FRAME/12 HTML report (explicitly badged RECONSTRUCTED SNAPSHOT · NOT LIVE EVENTS):
node dist/bin/storyboard.js import-archaeology fixtures/repo-archaeology-reconstructed.json \
  --report dist/archaeology-report.html
```

---

## Side-by-Side Output Comparison (Deterministic Fixture Repository)

The following outputs were captured from the same 13-commit deterministic fixture repository generated by `fixtures/create-fixture-repo.ts`:

### A. Storyboard Plain Mode (Default: `stderr` Cut Narration + `stdout` Summary)

```text
# stderr (live append-only cut narration as each workflow step completes):
FRAME/12 STORYBOARD · f12-storyboard-fixture-8PxgUH (window: 60 commits)
----------------------------------------------------------------
C-01 Validate target repository [validate-repo]
     Status: OK · repo: f12-storyboard-fixture-8PxgUH
C-02 Read commit history [read-history]
     Status: OK · 13 commits · 6 files
C-03 Pair co-changing files [pair-cochanges]
     Status: OK · 3 co-change pairs observed
C-04 Rank coupled file pairs and evidence [rank-findings]
     Status: OK · 3 findings ranked

# stdout (final structured findings & result block):
FINDINGS (3)
  F-01  src/checkout/session.ts <-> src/checkout/webhook.ts
        Co-changes: 6 commits (100% coupling · file commits: 6, 6)
        Commits: eb06cb0, 314bc98, 6163d01, 4ab8a8f, f5ef14b, 21c6a53
Why: Co-changed in 6 commits (100% coupling across eb06cb0, 314bc98, 6163d01);
        inspect together before modifying either file in isolation.
  F-02  src/billing/invoice.ts <-> src/billing/ledger.ts
        Co-changes: 4 commits (100% coupling · file commits: 4, 4)
        Commits: 1613961, d836a2d, e72a72c, d630d87
Why: Co-changed in 4 commits (100% coupling across 1613961, d836a2d, e72a72c);
        inspect together before modifying either file in isolation.
  F-03  src/styles/tokens.css <-> src/ui/panel.tsx
        Co-changes: 3 commits (100% coupling · file commits: 3, 3)
        Commits: a725bfa, 0c8cc14, 4e1d030
Why: Co-changed in 3 commits (100% coupling across a725bfa, 0c8cc14, 4e1d030);
        inspect together before modifying either file in isolation.

RESULT
  Status: COMPLETED
  Evidence: 13 commits, 6 files, 3 pairs
```

### B. Unframed Baseline Mode (`--baseline` on `stdout`, Zero Cut Narration)

```text
CO-CHANGE ANALYSIS BASELINE: f12-storyboard-fixture-8PxgUH
Status: COMPLETED | Commits: 13 | Files: 6 | Pairs: 3

F-01: src/checkout/session.ts + src/checkout/webhook.ts (6 shared commits, 100%
     coupling)
  Commits: eb06cb0, 314bc98, 6163d01, 4ab8a8f, f5ef14b, 21c6a53
Reason: Co-changed in 6 commits (100% coupling across eb06cb0, 314bc98,
  6163d01); inspect together before modifying either file in isolation.
F-02: src/billing/invoice.ts + src/billing/ledger.ts (4 shared commits, 100%
     coupling)
  Commits: 1613961, d836a2d, e72a72c, d630d87
Reason: Co-changed in 4 commits (100% coupling across 1613961, d836a2d,
  e72a72c); inspect together before modifying either file in isolation.
F-03: src/styles/tokens.css + src/ui/panel.tsx (3 shared commits, 100% coupling)
  Commits: a725bfa, 0c8cc14, 4e1d030
Reason: Co-changed in 3 commits (100% coupling across a725bfa, 0c8cc14,
  4e1d030); inspect together before modifying either file in isolation.
```

### C. Raw NDJSON Event Stream (`--events` on `stdout`)

```json
{"schemaVersion":"0-experimental","eventId":"evt-0001","runId":"run-mvzvalvy","seq":1,"ts":"2026-11-02T23:05:41.710Z","type":"run-start","stepId":null,"payload":{"repoLabel":"f12-storyboard-fixture-8PxgUH","repoPath":"/tmp/f12-storyboard-fixture-8PxgUH","maxCommits":60,"topN":5}}
{"schemaVersion":"0-experimental","eventId":"evt-0002","runId":"run-mvzvalvy","seq":2,"ts":"2026-11-02T23:05:41.710Z","type":"step-start","stepId":"validate-repo","payload":{"title":"Validate target repository","repoLabel":"f12-storyboard-fixture-8PxgUH"}}
{"schemaVersion":"0-experimental","eventId":"evt-0003","runId":"run-mvzvalvy","seq":3,"ts":"2026-11-02T23:05:41.718Z","type":"step-end","stepId":"validate-repo","payload":{"status":"ok","summary":"repo: f12-storyboard-fixture-8PxgUH"}}
{"schemaVersion":"0-experimental","eventId":"evt-0004","runId":"run-mvzvalvy","seq":4,"ts":"2026-11-02T23:05:41.718Z","type":"step-start","stepId":"read-history","payload":{"title":"Read commit history","maxCommits":60}}
{"schemaVersion":"0-experimental","eventId":"evt-0018","runId":"run-mvzvalvy","seq":18,"ts":"2026-11-02T23:05:41.727Z","type":"metric","stepId":"read-history","payload":{"name":"commitsExamined","value":13}}
{"schemaVersion":"0-experimental","eventId":"evt-0019","runId":"run-mvzvalvy","seq":19,"ts":"2026-11-02T23:05:41.727Z","type":"metric","stepId":"read-history","payload":{"name":"uniqueFilesObserved","value":6}}
{"schemaVersion":"0-experimental","eventId":"evt-0020","runId":"run-mvzvalvy","seq":20,"ts":"2026-11-02T23:05:41.727Z","type":"step-end","stepId":"read-history","payload":{"status":"ok","summary":"13 commits · 6 files"}}
{"schemaVersion":"0-experimental","eventId":"evt-0021","runId":"run-mvzvalvy","seq":21,"ts":"2026-11-02T23:05:41.727Z","type":"step-start","stepId":"pair-cochanges","payload":{"title":"Pair co-changing files"}}
{"schemaVersion":"0-experimental","eventId":"evt-0022","runId":"run-mvzvalvy","seq":22,"ts":"2026-11-02T23:05:41.727Z","type":"metric","stepId":"pair-cochanges","payload":{"name":"totalPairsObserved","value":3}}
{"schemaVersion":"0-experimental","eventId":"evt-0023","runId":"run-mvzvalvy","seq":23,"ts":"2026-11-02T23:05:41.727Z","type":"step-end","stepId":"pair-cochanges","payload":{"status":"ok","summary":"3 co-change pairs observed"}}
{"schemaVersion":"0-experimental","eventId":"evt-0024","runId":"run-mvzvalvy","seq":24,"ts":"2026-11-02T23:05:41.727Z","type":"step-start","stepId":"rank-findings","payload":{"title":"Rank coupled file pairs and evidence"}}
{"schemaVersion":"0-experimental","eventId":"evt-0025","runId":"run-mvzvalvy","seq":25,"ts":"2026-11-02T23:05:41.727Z","type":"finding","stepId":"rank-findings","payload":{"finding":{"id":"F-01","files":["src/checkout/session.ts","src/checkout/webhook.ts"],"cochangeCount":6,"fileACommits":6,"fileBCommits":6,"couplingRatio":1,"evidence":{"commitShas":["eb06cb0","314bc98","6163d01","4ab8a8f","f5ef14b","21c6a53"],"sampleSubjects":["chore(checkout): tighten session and webhook schema validation"],"count":6},"reason":"Co-changed in 6 commits (100% coupling across eb06cb0, 314bc98, 6163d01); inspect together before modifying either file in isolation."}}}
{"schemaVersion":"0-experimental","eventId":"evt-0028","runId":"run-mvzvalvy","seq":28,"ts":"2026-11-02T23:05:41.727Z","type":"step-end","stepId":"rank-findings","payload":{"status":"ok","summary":"3 findings ranked"}}
{"schemaVersion":"0-experimental","eventId":"evt-0029","runId":"run-mvzvalvy","seq":29,"ts":"2026-11-02T23:05:41.727Z","type":"run-end","stepId":null,"payload":{"status":"completed","summary":"3 findings from 13 commits"}}
```

### D. Offline FRAME/12 Static HTML Report (`--report`)

- Generated light-mode HTML artifact: `experiments/terminal-storyboard/dist/sample-report.html`
- Generated dark-mode HTML artifact: `experiments/terminal-storyboard/dist/sample-report-dark.html`
- Full-page headless Chromium screenshots:
  - `experiments/terminal-storyboard/dist/sample-report-light.png`
  - `experiments/terminal-storyboard/dist/sample-report-dark.png`

---

## Test Results Summary

Running `npm test` in `experiments/terminal-storyboard` executes **16 automated tests across 9 suites** (`0` failures):

| Suite | Verification Scope | Result |
|---|---|---|
| **1. Event Model & Stream Validator** | Pure TS check (`0` React/fs/child_process imports in `src/model` & `src/core`), valid stream/snapshot, unknown event rejection, unsupported `schemaVersion` rejection, `C-01` presentation cut as `stepId` rejection, duplicate `eventId`, out-of-order `seq`, missing `run-start`, unstarted `step-end`, post-`run-end` events, incomplete stream (`finalize()`), and `> 8192` byte payload bounds | **PASS (6/6)** |
| **2. Deterministic Fixture Workload** | Live `git log --name-only` child process analysis against `createFixtureRepo()`, verifying exact top pairs `F-01` (`session.ts` + `webhook.ts`, 6 commits), `F-02` (`invoice.ts` + `ledger.ts`, 4 commits), and `F-03` (`tokens.css` + `panel.tsx`, 3 commits) | **PASS (1/1)** |
| **3. Renderer Equivalence** | Every finding ID (`F-01..F-03`), file pair, co-change count, and supporting commit SHA in `ResultSnapshot` is present across plain storyboard output, `--baseline` output, and the FRAME/12 HTML report | **PASS (1/1)** |
| **4. Escape & XSS Sanitization** | Strips ANSI CSI (`\x1b[31m`), OSC 8 hyperlinks (`\x1b]8;;https://evil.example\x07click-label\x1b]8;;\x07`, keeping `click-label` and dropping the URL), `\r`, `\b`, and Unicode bidi overrides (`\u202E`); HTML-escapes `<script>` and `<img onerror=...>` in the Web report | **PASS (1/1)** |
| **5. CLI Contracts & Width/Color** | Conflicting flags (`--json --events`) exit `2`; `--json` and `--events` emit zero ANSI; `--replay` marks output `[REPLAY]`; `NO_COLOR=1`, `TERM=dumb`, and non-TTY emit zero ANSI; `columns: 40` wraps every line to `<= 40` chars | **PASS (2/2)** |
| **6. Failure & Cancellation (`SIGINT`)** | Non-git directory emits single `run-end` (`status: 'failed'`) and exits `1`; `AbortController` / `SIGINT` terminates child `git` process, emits single `run-end` (`status: 'canceled'`) with zero trailing events, and exits `130` | **PASS (2/2)** |
| **7. Repo Archaeology Adapter** | Converts `fixtures/repo-archaeology-reconstructed.json` (`schemaVersion: 1`) into a `ResultSnapshot` and renders `RECONSTRUCTED SNAPSHOT · NOT LIVE EVENTS` in HTML | **PASS (1/1)** |
| **8. Playwright Offline HTML & Axe Audit** | Headless Chromium audit of `sample-report.html` (`light` & `dark`, `1280x900` desktop & `390x844` mobile) with all network requests blocked: `0` external requests, `0` console/page errors, `C-01..C-06` in DOM order, `0` horizontal overflow, and `0` `@axe-core/playwright` WCAG 2.1 AA violations | **PASS (1/1)** |
| **9. FRAME/12 Grammar Linter** | `node ../../scripts/check-frame12.mjs src` across all 15 source files (`0` violations) + root `npm run sync:check` (`PASS`) | **PASS (1/1)** |

---

## Known Limitations & Scope Boundaries

1. **Static SSR Geometry in Zero-JS HTML (`motion="cut"`):**
   - Because the HTML report uses `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; img-src data:;` with zero client JavaScript, `Panel` renders its SSR fallback `<svg viewBox="0 0 100 100" preserveAspectRatio="none"><polygon vectorEffect="non-scaling-stroke" ... /></svg>` rather than `ResizeObserver`-measured pixel coordinates, and `ToneBarList` renders static screentone fills without client selection state.
2. **Co-Change Heuristic Scope:**
   - File co-change frequency measures historical lockstep edits within the commit window (`--max-commits`, excluding bulk commits touching `> 50` files). High coupling indicates files that frequently evolve together, not a guaranteed defect.
3. **Experimental Schema (`0-experimental`):**
   - `StoryboardEvent` and `ResultSnapshot` are scoped to this proof of concept and intentionally versioned `"0-experimental"` to avoid premature lock-in before multi-workflow adoption.

---

## Honest Engineering Assessment & Go/No-Go Recommendation on Ink

### What Worked Well
- **Strict Separation of Domain Identity vs. Presentation Cuts:** Keeping `stepId` semantic (`validate-repo`, `read-history`, `pair-cochanges`, `rank-findings`) while letting the plain renderer assign `C-01..C-04` dynamically and the web report assign `C-01..C-06` to its spatial panel layout prevented the awkward coupling where adding a UI summary card would break CLI step numbering.
- **Append-Only `stderr` + Structured `stdout`:** Writing cut narration to `stderr` while keeping `stdout` clean for final human summaries, `--baseline`, `--json`, or `--events` NDJSON works seamlessly in CI logs, pipes, screen readers, and narrow 40-column terminals.
- **Zero-JS Offline FRAME/12 HTML Report:** Using `renderToStaticMarkup` with the real `registry/ui` components (`Sheet`, `Scene`, `Panel`, `PanelPair`, `Metric`, `Balloon`, `ToneBarList`, `Table`, `Badge`, `Tag`) and inlined `registry/styles/frame12.css` produces a ~45 KB self-contained HTML artifact that renders genuine manga panel frames, slanted `PanelPair` seams, and 45° screentone bars offline with zero network requests and zero Axe accessibility violations.

### Where Plain Storyboard vs. `--baseline` vs. HTML Report Win
- **For fast terminal scanning (`< 15s`):** `--baseline` is ~8 lines shorter because it omits the 4-step `C-01..C-04` execution header. However, when a run skips bulk commits, fails validation, or is canceled mid-stream, the Storyboard `C-01..C-04` cut log immediately shows *which* stage produced the warning or failure.
- **For visual hierarchy & shareable artifacts:** The FRAME/12 HTML report (`--report`) is dramatically more expressive than any terminal view—it pairs the headline metric and `<Balloon>` callout with `<ToneBarList>` screentone bars (`C-01`), supporting `PanelPair` counters (`C-02`/`C-03`), the full commit evidence table (`C-04`), the step execution log (`C-05`), and scope notes (`C-06`).

### Go/No-Go Decision on an Ink TUI Renderer: **NO-GO on Ink**
- **Recommendation:** **Do not add an Ink / full-screen ANSI TUI renderer.**
- **Why:**
  1. **FRAME/12's visual signature is geometric and typographic:** Slanted `PanelPair` polygons (`2.5px` mitered SVG strokes), `45°` screentone fills, `Dela Gothic One` display headers, and registration `Pegs` cannot be faithfully represented in character cells—approximating them with Unicode box-drawing characters in Ink creates a fragile caricature while breaking copy-paste and screen readers.
  2. **Append-only `stderr` + `--report <out.html>` covers both jobs cleanly:** Developers in a terminal get fast, pipe-safe, zero-flicker plain output, and when they want visual spatial framing, `--report` emits a genuine, offline FRAME/12 HTML sheet in `< 20ms` with zero extra runtime dependencies.

---

## Counterbalanced Developer Usability Test Script & Worksheet (5–8 Developers)

Use this protocol to evaluate whether Storyboard framing improves developer comprehension and evidence citation compared to `--baseline`.

### Participant Assignment (Counterbalanced Latin Square)
- **Group A (Odd-numbered participants: P1, P3, P5, P7):**
  1. Task 1 using **Condition 1 (`--baseline` Unframed Output)** on Repo Fixture A.
  2. Task 2 using **Condition 2 (Storyboard Plain Output + HTML Report)** on Repo Fixture B.
- **Group B (Even-numbered participants: P2, P4, P6, P8):**
  1. Task 1 using **Condition 2 (Storyboard Plain Output + HTML Report)** on Repo Fixture A.
  2. Task 2 using **Condition 1 (`--baseline` Unframed Output)** on Repo Fixture B.

### Moderator Prompt (Read Verbatim)
> *"You are preparing to modify a file in this repository. Using only the output in front of you, please answer three questions aloud and in the worksheet:*
> *1. Which file pair has the strongest historical coupling and needs to be reviewed together?*
> *2. Why do those two files need to be reviewed together (what is the co-change count and coupling ratio)?*
> *3. Cite at least two supporting commit SHAs as evidence, and state how many total commits and unique files were examined in this run."*

### Recording Worksheet

| Participant ID | Group (A/B) | Condition (`baseline` / `storyboard`) | Time to Answer (sec) | Correct Top File Pair Identified? (`Y/N`) | Cited `>= 2` Valid Commit SHAs? (`Y/N`) | Correctly Stated Run Scope (Commits/Files)? (`Y/N`) | Confidence (`1–5`) | Observed Confusion / Notes |
|---|---|---|---|---|---|---|---|---|
| P1 | A | `baseline` | | | | | | |
| P1 | A | `storyboard` | | | | | | |
| P2 | B | `storyboard` | | | | | | |
| P2 | B | `baseline` | | | | | | |
| P3 | A | `baseline` | | | | | | |
| P3 | A | `storyboard` | | | | | | |
| P4 | B | `storyboard` | | | | | | |
| P4 | B | `baseline` | | | | | | |
| P5 | A | `baseline` | | | | | | |
| P5 | A | `storyboard` | | | | | | |

### Decision Threshold for Advancing the Experiment
- Advance the Storyboard Plain + HTML workflow only if participants in the `storyboard` condition achieve **equal or faster time-to-answer** and **equal or higher evidence-citation accuracy** than `--baseline` without misinterpreting `C-01..C-04` step cuts as finding IDs (`F-01..F-03`).
