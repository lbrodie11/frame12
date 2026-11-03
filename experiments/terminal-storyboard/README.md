# FRAME/12 — Terminal Storyboard Proof of Concept (`experiments/terminal-storyboard`)

> **Status:** Experimental Proof of Concept (`schemaVersion: "0-experimental"`) · Branch: `experiment/terminal-storyboard`
> **Scope:** Isolated vertical slice testing whether a single structured event stream + result snapshot can drive both (a) accessible, append-only plain terminal narration and (b) an offline, zero-JS static HTML report built from real FRAME/12 registry components.

---

## Implementation Plan (Written Before Code)

### 1. Planned File Layout

```text
experiments/terminal-storyboard/
  README.md                              # Upfront plan, usage commands, side-by-side output comparison, design hypotheses, and usability test script
  package.json                           # Private experiment scripts (build, typecheck, test, demo) — isolated from root workspaces
  tsconfig.json                          # TypeScript config mapping @/components/frame12/* -> ../../registry/ui/*
  scripts/
    build.mjs                            # esbuild compiler keeping model/workload/plain React-free and render-web as a separate entry point
  bin/
    storyboard.ts                        # CLI entry point: `storyboard run <repo-path> [flags]`
  src/
    model/                               # Framework-free TypeScript event & snapshot contract (no React, Ink, fs, or FRAME/12 imports)
      types.ts                           # StoryboardEvent, ResultSnapshot, CochangeFinding, StepId, EventType
      validate.ts                        # Runtime validator & stream state machine (seq order, post-run-end, payload & nested metadata bounds)
      index.ts
    workload/                            # Real live git-history co-change analysis (child_process.spawn, shell: false, timeout + noise filter)
      git-history.ts                     # Incremental event emission during `git log --name-only` parsing, noise filtering & Jaccard/overlap ranking
      repo-archaeology-adapter.ts        # Converter from Repo Archaeology schemaVersion: 1 JSON to ResultSnapshot (labeled reconstructed)
    render-plain/                        # Append-only terminal & baseline renderer (no cursor motion, spinners, or Ink)
      index.ts                           # Sanitizer (C0/C1, CSI, OSC 8, bidi), Unicode display-width wrapper, live C-01..C-0N narrator, and --baseline formatter
    render-ink/                          # Optional editorial Ink renderer (--style panels or --style auto in interactive TTY)
      MarkerLabel.tsx                    # Restrained yellow-background marker pill ([LABEL] under NO_COLOR / --ascii)
      ToneBar.tsx                        # Segmented 16-cell horizontal tone bar (▄/░ in Unicode, #/- in --ascii)
      FilePair.tsx                       # Two-line file pair with middle-segment path abbreviation (src/…/map.ts)
      StepLine.tsx                       # Compact editorial step row (C-01 ✓ Repository validated, etc.)
      FindingPanel.tsx                   # Single framed hero panel for F-01 / TOP FINDING
      RunSummary.tsx                     # Concise run completion status line
      StoryboardApp.tsx                  # Top-level Ink composition (<Static> steps + hero panel + secondary rows)
      index.tsx                          # 12fps Motion-on-Twos InkStreamController + renderInkStaticSummary
    render-web/                          # Separate entry point: offline static HTML report using direct FRAME/12 registry components
      index.tsx                          # react-dom/server renderToStaticMarkup + inlined registry/styles/frame12.css + C-04 finding cards
    cli.ts                               # CLI argument parser, stream router, error boundary, and SIGINT / timeout lifecycle handler
  fixtures/
    create-fixture-repo.ts               # Deterministic temp git repo generator supporting Fixture A and Fixture B (scripted co-change commits, no tracked .git)
    repo-archaeology-reconstructed.json  # Authentic Repo Archaeology v0.3.0 (schemaVersion: 1) completed diff/suggestions snapshot
  tests/
    storyboard.test.mjs                  # Automated suite: validator, equivalence, terminal escape safety, Unicode width, fault injection, and Playwright HTML audit
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
  - Authoritative structured result distinct from the event stream: `schemaVersion`, `runId`, `status` (`'completed' | 'failed' | 'canceled'`), `repoLabel`, `startedAt`, `finishedAt`, `maxCommits`, `commitsExamined`, `uniqueFilesObserved`, `totalPairsObserved`, `findings` (`id`, `files: [string, string]`, `cochangeCount`, `fileACommits`, `fileBCommits`, `couplingRatio` [overlap: shared ÷ commits of less-changed file], `jaccardRatio` [shared ÷ union], `evidence: { commitShas, sampleSubjects, count }`, `reason`), `hotFiles`, `warnings`, `error`, and optional `reconstructed` metadata.

### 3. CLI Flags & Stream Contract (`bin/storyboard.ts`)

```text
storyboard run <repo-path> [--max-commits N] [--top N] [--exclude <glob>] [--include-noise] [--style auto|panels|plain] [--ascii] [--events | --json | --baseline] [--report <out.html>] [--theme light|dark] [--replay <events.ndjson>]
storyboard import-archaeology <fixture.json> [--report <out.html>] [--style auto|panels|plain] [--ascii] [--events | --json | --baseline] [--theme light|dark]
```

- **`--style auto | panels | plain` (default: `auto`):**
  - `auto`: Uses `panels` (Ink editorial layout) **only** when `stderr.isTTY && stdout.isTTY && TERM !== 'dumb' && !CI`; otherwise falls back to `plain`.
  - `panels`: Forces the Ink editorial renderer (`FindingPanel` + secondary rows + `RunSummary`), dynamically importing `dist/render-ink/index.js`.
  - `plain`: Uses the zero-Ink append-only plain narrator (`dist/render-ink/index.js` is never loaded).
- **`--ascii`:** Uses 7-bit ASCII borders (`+---+`), bars (`#`/`-`), and status markers (`[OK]`, `<->`).
- **`stderr`:** Human-readable live storyboard progress narration (emitted on `step-start`, `12 fps` / `83.33ms` Motion-on-Twos throttled `step-progress`, and `step-end` in default mode) and diagnostic/error messages.
- **`stdout`:**
  - Default (`panels` in interactive TTY or `plain` in non-TTY): Final human-readable storyboard summary and findings.
  - `--baseline`: Unframed plain list of findings (no `C-01` cuts, no step narration) for A/B usability comparison.
  - `--json`: Only the serialized `ResultSnapshot` JSON (`--json`, `--events`, `--baseline`, and explicit `--style` are mutually exclusive -> exit `2`).
  - `--events`: Only valid NDJSON `StoryboardEvent` lines.
- **Signals & Exit Codes:**
  - `0`: Completed (`status: "completed"`)
  - `1`: Workload/Git failure, timeout, or report write failure (`status: "failed"`, single `run-end` event emitted)
  - `2`: Invalid CLI flags (`--max-commits` outside `1..10000`, `--top` outside `1..100`) or schema validation error
  - `130`: `SIGINT` cancellation (`status: "canceled"`, single `run-end` event emitted, child `git` process terminated, streams flushed)

---

## How to Run the Demo

First, ensure both root workspace dependencies and the isolated experiment dependencies (`ink`) are installed (`npm ci` at the repository root and `npm ci` inside `experiments/terminal-storyboard`), then run the experiment commands from `experiments/terminal-storyboard`:

```bash
# From the repository root:
npm ci

# Move into the isolated experiment directory and install experiment-local dependencies:
cd experiments/terminal-storyboard
npm ci

# 1. Build, typecheck, lint (check-frame12.mjs), and run all automated tests:
npm test

# 2. Run the storyboard CLI against this repository and generate an offline HTML report:
npm run demo
# -> Streams C-01..C-04 narration to stderr as each step starts/completes,
#    prints ranked findings to stdout, and writes dist/sample-report.html

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

## Side-by-Side Output Comparison (Deterministic Fixture Repository A)

The following outputs were captured from the 13-commit deterministic Fixture Repository A generated by `createFixtureRepo('A')` in `fixtures/create-fixture-repo.ts`:

### A. Storyboard Plain Mode (Default: `stderr` Live Cut Narration + `stdout` Summary)

```text
# stderr (live append-only cut narration emitted on step-start and step-end):
FRAME/12 STORYBOARD · f12-storyboard-fixture-a-xxxxxx (window: 60 commits)
----------------------------------------------------------------
C-01 Validate target repository [validate-repo]
     Status: OK · repo: f12-storyboard-fixture-a-xxxxxx (C-01 complete)
C-02 Read commit history [read-history]
     Status: OK · 13 commits · 6 files (C-02 complete)
C-03 Pair co-changing files [pair-cochanges]
     Status: OK · 3 co-change pairs observed (C-03 complete)
C-04 Rank coupled file pairs and evidence [rank-findings]
     Status: OK · 3 findings ranked (C-04 complete)

# stdout (final structured findings & result block):
FINDINGS (3)
  F-01  src/checkout/session.ts <-> src/checkout/webhook.ts [★ PRIMARY]
        Co-changes: 6 commits (100% overlap [shared ÷ commits of less-changed file] · 100% Jaccard [6/6 union])
        Directional: src/checkout/session.ts (6/6) · src/checkout/webhook.ts (6/6)
        Commits: eb06cb0, 314bc98, 6163d01, 4ab8a8f, f5ef14b, 21c6a53
        Why: Co-changed in 6 commits (100% overlap [shared ÷ commits of less-changed file], 100% Jaccard [6/6 union]; directional: src/checkout/session.ts 6/6, src/checkout/webhook.ts 6/6 across eb06cb0, 314bc98, 6163d01); inspect together before modifying either file in isolation.
  F-02  src/billing/invoice.ts <-> src/billing/ledger.ts
        Co-changes: 4 commits (100% overlap [shared ÷ commits of less-changed file] · 100% Jaccard [4/4 union])
        Directional: src/billing/invoice.ts (4/4) · src/billing/ledger.ts (4/4)
        Commits: 1613961, d836a2d, e72a72c, d630d87
        Why: Co-changed in 4 commits (100% overlap [shared ÷ commits of less-changed file], 100% Jaccard [4/4 union]; directional: src/billing/invoice.ts 4/4, src/billing/ledger.ts 4/4 across 1613961, d836a2d, e72a72c); inspect together before modifying either file in isolation.
  F-03  src/styles/tokens.css <-> src/ui/panel.tsx
        Co-changes: 3 commits (100% overlap [shared ÷ commits of less-changed file] · 100% Jaccard [3/3 union])
        Directional: src/styles/tokens.css (3/3) · src/ui/panel.tsx (3/3)
        Commits: a725bfa, 0c8cc14, 4e1d030
        Why: Co-changed in 3 commits (100% overlap [shared ÷ commits of less-changed file], 100% Jaccard [3/3 union]; directional: src/styles/tokens.css 3/3, src/ui/panel.tsx 3/3 across a725bfa, 0c8cc14, 4e1d030); inspect together before modifying either file in isolation.

RESULT
  Status: COMPLETED
  Evidence: 13 commits, 6 files, 3 pairs
```

### B. Unframed Baseline Mode (`--baseline` on `stdout`, Zero Cut Narration)

```text
CO-CHANGE ANALYSIS BASELINE: f12-storyboard-fixture-a-xxxxxx
Status: COMPLETED | Commits: 13 | Files: 6 | Pairs: 3

F-01: src/checkout/session.ts + src/checkout/webhook.ts (6 shared commits, 100% overlap [shared ÷ commits of less-changed file], 100% Jaccard [6/6 union])
  Directional: src/checkout/session.ts (6/6) | src/checkout/webhook.ts (6/6)
  Commits: eb06cb0, 314bc98, 6163d01, 4ab8a8f, f5ef14b, 21c6a53
  Reason: Co-changed in 6 commits (100% overlap [shared ÷ commits of less-changed file], 100% Jaccard [6/6 union]; directional: src/checkout/session.ts 6/6, src/checkout/webhook.ts 6/6 across eb06cb0, 314bc98, 6163d01); inspect together before modifying either file in isolation.
```

---

## Known Limitations & Scope Boundaries

1. **Static SSR Geometry in Zero-JS HTML (`motion="cut"`):**
   - Because the HTML report uses `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; img-src data:;` with zero client JavaScript, `Panel` renders its SSR fallback `<svg viewBox="0 0 100 100" preserveAspectRatio="none"><polygon vectorEffect="non-scaling-stroke" ... /></svg>` rather than `ResizeObserver`-measured pixel coordinates, and `ToneBarList` renders static screentone fills without client selection state.
2. **Co-Change Heuristic & Noise Filtering Scope:**
   - File co-change frequency measures historical lockstep edits within the commit window (`--max-commits`, excluding bulk commits touching `> 50` files and filtering lockfiles, binaries, and generated `dist/` / `site/public/r/` outputs by default unless `--include-noise` is passed). Both **overlap** (`shared ÷ commits of less-changed file`) and **Jaccard** (`shared ÷ union`) are reported alongside directional counts (`fileA: shared/total, fileB: shared/total`) so hub-and-spoke files are never mistaken for bilateral lockstep coupling.
3. **Experimental Schema (`0-experimental`):**
   - `StoryboardEvent` and `ResultSnapshot` are scoped to this proof of concept and intentionally versioned `"0-experimental"` to avoid premature lock-in before multi-workflow adoption.

---

## Engineering Assessment & Design Hypothesis on an Ink TUI Renderer

### What Worked Well in Implementation
- **Strict Separation of Domain Identity vs. Presentation Cuts:** Keeping `stepId` semantic (`validate-repo`, `read-history`, `pair-cochanges`, `rank-findings`) while letting the plain renderer assign `C-01..C-04` dynamically and the web report assign `C-01..C-06` to its spatial panel layout prevented coupling between domain workflow steps and UI card count.
- **Append-Only `stderr` + Structured `stdout`:** Writing live cut narration (`step-start`, throttled `step-progress`, `step-end`) to `stderr` while keeping `stdout` clean for final human summaries, `--baseline`, `--json`, or `--events` NDJSON works cleanly in CI logs, pipes, screen readers, and narrow 40-column terminals.
- **Zero-JS Offline FRAME/12 HTML Report:** Using `renderToStaticMarkup` with direct `registry/ui/*.tsx` component imports (`Sheet`, `Scene`, `Panel`, `PanelPair`, `Metric`, `Balloon`, `ToneBarList`, `Table`, `Badge`, `Tag`) and inlined `registry/styles/frame12.css` produces a self-contained HTML artifact that renders genuine manga panel frames, slanted `PanelPair` seams, and 45° screentone bars offline with zero network requests and zero Axe accessibility violations.

### Design Hypothesis on an Ink TUI Renderer (Pending Usability Study Evaluation)
- **Current Hypothesis:** **Hold / No-Go on adding an Ink / full-screen ANSI TUI renderer unless the usability study reveals a comprehension gap that append-only plain text + HTML cannot solve.**
- **Rationale to Test:**
  1. **Geometric fidelity vs. terminal character cells:** Slanted `PanelPair` polygons (`2.5px` mitered SVG strokes), `45°` screentone fills, `Dela Gothic One` display headers, and registration `Pegs` are continuous 2D graphic elements; approximating them with Unicode box-drawing characters in an interactive TUI risks degrading copy-paste and screen-reader ergonomics.
  2. **Complementary surfaces:** Append-only `stderr`/`stdout` + `--report <out.html>` separates fast CLI scanning from spatial visual inspection without requiring React/Ink inside the terminal process.
  3. **Empirical gate:** Whether storyboard cut framing (`C-01..C-04` + HTML report) actually improves developer speed and evidence-citation accuracy over unframed `--baseline` output is an empirical question that must be validated using the counterbalanced developer usability study below before making a permanent product decision.

---

## Counterbalanced Developer Usability Test Script & Worksheet (8 Developers: `P1–P8`)

Use this protocol to evaluate whether Storyboard framing improves developer comprehension and evidence citation compared to `--baseline` across **Fixture A** (`createFixtureRepo('A')`) and **Fixture B** (`createFixtureRepo('B')`).

### Participant Assignment (Counterbalanced Latin Square)
- **Group A (Odd-numbered participants: `P1, P3, P5, P7`):**
  1. Task 1 using **Condition 1 (`--baseline` Unframed Output)** on **Fixture A** (`createFixtureRepo('A')`).
  2. Task 2 using **Condition 2 (Storyboard Plain Output + HTML Report)** on **Fixture B** (`createFixtureRepo('B')`).
- **Group B (Even-numbered participants: `P2, P4, P6, P8`):**
  1. Task 1 using **Condition 2 (Storyboard Plain Output + HTML Report)** on **Fixture A** (`createFixtureRepo('A')`).
  2. Task 2 using **Condition 1 (`--baseline` Unframed Output)** on **Fixture B** (`createFixtureRepo('B')`).

### Moderator Prompt (Read Verbatim)
> *"You are preparing to modify a file in this repository. Using only the output in front of you, please answer three questions aloud and in the worksheet:*
> *1. Which file pair has the strongest historical coupling and needs to be reviewed together?*
> *2. Why do those two files need to be reviewed together (what are the shared commit count, overlap/Jaccard percentages, and individual file commit counts)?*
> *3. Cite at least two supporting commit SHAs as evidence, and state how many total commits and unique files were examined in this run."*

### Recording Worksheet (`P1–P8`)

| Participant ID | Group (`A/B`) | Fixture (`A/B`) | Condition (`baseline` / `storyboard`) | Time to Answer (sec) | Correct Top File Pair Identified? (`Y/N`) | Cited `>= 2` Valid Commit SHAs? (`Y/N`) | Correctly Stated Run Scope (Commits/Files)? (`Y/N`) | Confidence (`1–5`) | Observed Confusion / Notes |
|---|---|---|---|---|---|---|---|---|---|
| P1 | A | A | `baseline` | | | | | | |
| P1 | A | B | `storyboard` | | | | | | |
| P2 | B | A | `storyboard` | | | | | | |
| P2 | B | B | `baseline` | | | | | | |
| P3 | A | A | `baseline` | | | | | | |
| P3 | A | B | `storyboard` | | | | | | |
| P4 | B | A | `storyboard` | | | | | | |
| P4 | B | B | `baseline` | | | | | | |
| P5 | A | A | `baseline` | | | | | | |
| P5 | A | B | `storyboard` | | | | | | |
| P6 | B | A | `storyboard` | | | | | | |
| P6 | B | B | `baseline` | | | | | | |
| P7 | A | A | `baseline` | | | | | | |
| P7 | A | B | `storyboard` | | | | | | |
| P8 | B | A | `storyboard` | | | | | | |
| P8 | B | B | `baseline` | | | | | | |

### Decision Threshold for Advancing the Experiment
- Advance the Storyboard Plain + HTML workflow only if participants in the `storyboard` condition achieve **equal or faster time-to-answer** and **equal or higher evidence-citation accuracy** than `--baseline` without misinterpreting `C-01..C-04` step cuts as finding IDs (`F-01..F-03`).
