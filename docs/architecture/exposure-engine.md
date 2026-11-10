# ADR-002: One exposure engine (`useExposure`) for replaying discrete histories

- **Status:** Accepted (F12-09)
- **Date:** 2026-11-10
- **Applies to:** `registry/hooks/use-exposure.ts`, `registry/ui/exposure-scrubber.tsx`, and the planned `TraceTimeline` (`docs/roadmap/v0.3-v0.4-roadmap.md` §6.2)

## 1. Context

Developer tools are full of discrete histories: an agent run's tool calls, a CI pipeline's steps, an incident timeline. The roadmap plans `TraceTimeline` (a vertical comic-strip of agent steps) and `StreamingLog` (a 12 fps-quantized live stream). F12-09 adds `ExposureScrubber`, which reads a finished run like an animator's exposure sheet.

All of these need the same hard parts: selection that survives data changes, a playback clock that never skips frames or runs while idle, pause rules (scrub, hidden tab, motion preference), a keyboard map that never steals keys from editable content, and settle-only announcements. Building them twice would give two subtly different navigation models in one design system.

## 2. Decision

**`useExposure` is the single navigation and playback engine.** It is headless: it renders nothing and owns:

| Concern | What the engine does |
| --- | --- |
| Input contract | `normalizeExposureFrames` keys frames by id (`id#2` for later duplicates, `#index` for bad ids), clamps `hold` to 1–12, ignores bad `durationMs`/`at`, keeps only backward `causes`, computes elapsed time from the first valid `at` (never `Date.now()`), and reports each problem once in development. **Array order is the truth.** |
| Selection | By id (`value` / `defaultValue` / `onValueChange` with a reason). Controlled or uncontrolled; the first mode wins. |
| Data changes | The current id survives reorders; a removed current frame moves to the nearest survivor at the previous index (`reason: 'data'`) and pauses playback; appends keep playing; fewer than two frames stops playback so it can never resume on its own. |
| Clock | One `setTimeout` per step against `performance.now()` deadlines; at most one frame per tick (a stall rebases, it never catches up); `even` / `elapsed` / `flipbook` durations; stop at the end unless `loop`; Play at the end restarts. Zero timers and zero rAF while paused or idle. |
| Pauses | Any user scrub (`scrub`), hidden tab (`hidden`, no auto-resume), a flipbook losing motion (`tempo`), a controlled parent ignoring an advance by the next deadline (`rejected`), data (`data`), end (`end`). No autoplay. |
| Motion vs reading | `useTempo().effectiveTempo === 'still'` makes flipbook unavailable. Reading speed is never derived from motion; the UI uses `useResolvedMotion()` only for transitions. |
| Keyboard map | `handleShortcut` (`j` / `k` / `[` / `]` / `p`, never in editable targets) and `rowKeyTarget` (`↑` / `↓` / `Home` / `End`). The UI scopes them to its own root; there are no global listeners. |
| Settle and announcements | `scrubbing` during pointer drags and key repeats, settling 500 ms after the last key; one rate-limited (≤ 1/s) announcement stream: settle text, "Playing", "Paused at frame N of M". |
| History | A one-level "Back" after following a cause. |

**`ExposureScrubber` is the engine's first UI**: the X-sheet table, detail panel and transport.

**The planned `TraceTimeline` reuses `useExposure`** for step selection, replay, keyboard navigation and announcements, and renders its own comic-strip layout on top. It must not add a second engine. `StreamingLog` is a live view; if it gains replay, it reuses the engine too.

## 3. Consequences

- New replay UIs get the input contract, data-change rules, pause reasons and announcement policy for free, and they behave the same.
- The engine's public surface (`useExposure`, `normalizeExposureFrames`, `exposureStepDuration`, the format helpers, the reason unions) is API: changes go through `scripts/check-api-compat.mjs` and the skill reference.
- The engine has no DOM dependency beyond `document.visibilitychange` (registered only while playing), so it is unit-testable in Node (`registry/tests/exposure.mjs` runs the pure parts through `loadServerModule`).
- Live streaming and branching or concurrent lanes are out of scope for v1; appending frames is supported only so it does not break.

## 4. Rendering notes for UIs built on the engine

- Server and first client render must match: no `Date.now()`, no locale formatting, `useId` for ids. Enable controls after hydration.
- `content-visibility: auto` does nothing on internal table boxes; `ExposureScrubber` lays the native `<table>` out with CSS grid and restores explicit table roles. Every row stays in the DOM up to 5,000 frames (no JS windowing in v1); windowing above 1,000 frames is the documented fallback only if the performance budgets fail.
