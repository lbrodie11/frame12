# CutMorph: state changes as film edits (F12-10)

CutMorph gives a FRAME/12 state change an editor's choice:

- a **cut**: the shot changes at once;
- a **match cut**: one subject keeps its identity from one shot to the next.

It is built on the platform's same-document View Transitions. It ships as three things:

1. **The grammar**: view-transition CSS in `registry/styles/frame12.css`.
2. **`useCutMorph`**: an interruption-safe hook for React 18.3 through 19.x.
3. **`CutMorphName`**: names one subject.

`withCutMorphMode` lets React 19.3's `<ViewTransition>` use the same grammar. Nothing animates through CutMorph unless a call site opts in. It has no dependencies and no FLIP engine.

## Spike (recorded 2026-11-11)

`registry/scripts/cut-morph-spike.mjs` answers each question by:

- pausing the pseudo-element animations (`document.getAnimations()`), seeking them, and reading `getComputedStyle(html, '::view-transition-…')` at pose times;
- checking pixels in screenshots;
- probing clicks and scrolls.

It runs against the real `frame12.css`. The raw answers are in [`cut-morph-spike.json`](cut-morph-spike.json), and the screenshots are in [`docs/images/cut-morph/spike/`](../images/cut-morph/spike/). `tests/cross-browser.mjs` re-asks questions 1–4 on every run.

| Engine (Playwright 1.64.1) | Version | View Transitions | `view-transition-class` | `activeViewTransition` | Types | Element-scoped | Nested groups |
|---|---|---|---|---|---|---|---|
| Chromium | 153.0.8010.12 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Firefox | 157.0 | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| WebKit | 27.2 | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |

### Answers

| # | Question | Chromium | Firefox | WebKit |
|---|---|---|---|---|
| 1 | `steps(3, end)` over 250 ms gives 3 held poses | ✅ x = 0, 0, 100, 100, 200, 200 at 10/75/90/160/175/245 ms | ✅ same | ✅ same |
| 2 | Old/new never at partial opacity (17 samples at 60 Hz, plus ±0.5 ms around the swap) | ✅, and 0 blended pixels | ✅ (computed styles) | ✅ (computed styles) |
| 3 | Root excluded: only named elements move | ✅ 0 root animations, 0 static pixels changed | ✅ 0 root animations | ✅ 0 root animations |
| 4 | `::view-transition { pointer-events: none }`: a click reaches the live DOM | ✅ (without it: ❌, the click hits `<html>`) | ✅ (❌ without) | ✅ (❌ without) |
| 5a | Scrolling during a document transition | Drifts: only the new end re-targets to the live element (group y 40 → 30 while the content moved to 10) | Viewport-fixed: the group stays at y 40 while the content moved to 10 | Drifts, as in Chromium |
| 5b | A named element inside `overflow: hidden` | Not clipped (3404 px outside); clipped with `view-transition-group: nearest` plus `::view-transition-group-children(…) { overflow: clip }` | Not clipped (no nested groups) | Not clipped (no nested groups) |
| 6 | Element-scoped `Element.startViewTransition()` | ✅ Animations target the scope element; no root; the snapshot follows the scroll (330 → 300); clipped to the scope; the rest of the page stays clickable | n/a | n/a |
| 7 | `document.getAnimations()` exposes the pseudo-element animations, and they can be paused and seeked | ✅ | ✅ | ✅ |

**Pixel evidence is only valid in Chromium.** Pixel answers count only where a control passes: the UA default crossfade, paused mid-way, must show blended red and blue pixels.

- **Chromium:** the control passes (5000 blended pixels).
- **Firefox:** Playwright's screenshot paints the overlay at its end state.
- **WebKit:** the screenshot paints the live element under the overlay.

In Firefox and WebKit the pixel answers are therefore recorded as `null`, and the computed-style samples are the evidence. We could not tell from headless capture whether a real WebKit paint also shows the live element during a transition. That is a human check (see the PR).

### Decisions

- **Every engine animates.** All three pass questions 1–3, so the decision rule's instant fallback is not used anywhere. The hook still falls back to an instant update without `startViewTransition`, without `view-transition-class` support (without it the grammar could not apply, and the UA crossfade would play), during SSR, and in a hidden document.
- **The hard swap is at the second pose boundary (166.67 ms), not the first (83.33 ms).** The spike sized a subject 2× up and 2× down. It measured how far the image on screen is from its own size, in stops (|log₂ scale|), at each pose:

  | Swap at | 2× grow | 2× shrink |
  |---|---|---|
  | first boundary (83.33 ms) | 0.585 | 0.737 |
  | **second boundary (166.67 ms)** | **0.415** | **0.415** |

  At the second boundary each image is only shown within one third of the move from its own size, so neither is stretched more than the other. That is also where the stepped geometry crosses the midpoint. Smooth mode uses the same rule: it swaps at 33.8 ms, where `cubic-bezier(0.2, 0.8, 0.2, 1)` crosses 0.5.
- **The root is unnamed rather than set to `animation: none`.** `html.f12-vt-* { view-transition-name: none }` means there is no root snapshot at all. Everything except the named subjects stays live DOM during the transition: hover, focus rings, live regions and text. `::view-transition-group(root) { animation: none }` is kept as a guard for transitions that name the root anyway.
- **Element scope only where it exists.** With `scope`, Chromium runs `scopeEl.startViewTransition()`, and the mode key goes on the scope element. This fixes questions 3–5 for a contained demo: snapshots scroll and clip with the scope, and the rest of the page is untouched. Firefox and WebKit get a document transition with the root excluded.
- **Skip on scroll, resize and pointer drag (document scope).** Question 5a shows that document snapshots detach from their content in every engine, each in its own way. The DOM is already updated when the transition is skipped, so nothing is lost. Element-scoped transitions follow the scroll, so they are not skipped.
- **Clipping is the caller's job.** Don't put named subjects inside scroll or `overflow: hidden` containers in Firefox or WebKit. Chromium can clip them with nested groups, but CutMorph does not ship that, because it would only work in one engine.

## The grammar (CSS)

Every rule needs two things:

- a mode key on the transition root (`f12-vt-stepped` or `f12-vt-smooth`), set by whoever starts the transition and removed by the same generation;
- a CutMorph `view-transition-class` (`f12-match` or `f12-cut`).

Other libraries' transitions and the app's own are never restyled.

| | Group geometry | Old/new images |
|---|---|---|
| `f12-match` + `f12-vt-stepped` | `250ms steps(3, end)` | hard swap at 166.67 ms (`steps(1, end)`), `mix-blend-mode: normal` |
| `f12-match` + `f12-vt-smooth` | `260ms cubic-bezier(0.2, 0.8, 0.2, 1)` | hard swap at 33.8 ms |
| `f12-cut` | none | old hidden, new shown at once |

`@media (prefers-reduced-motion: reduce)` sets every `f12-match`/`f12-cut` pseudo-element animation to `none`, and hides the old image, whatever JS does.

## The hook

`useCutMorph(opts?)` resolves the motion mode from the **calling component's** context with `useResolvedMotion('stepped')`. A nested `TempoProvider value="still"` therefore stays still even when the page is at 60.

One owner record per document lives on `globalThis[Symbol.for('frame12.cutmorph')]`, so two React roots or two copied-in copies share it. Each call gets a generation number. A new call while a CutMorph transition is in flight:

1. runs every earlier update that has not run yet, in order (inside `flushSync` on the transition path, plainly on the immediate path) and marks it done; the browser's own later invocation becomes a no-op;
2. skips the old transition;
3. starts the new one, or updates at once.

Mode classes are generation-guarded, so a stale `finally` never strips a newer class. `ready`, `updateCallbackDone` and `finished` all get handlers: skips are not errors. If `update` throws, the call rejects once with that error.

**`flushSync`.** The transition path runs `update` inside `flushSync`, so the new DOM exists when the browser captures it. This commits Suspense fallbacks at once (tested). Preload what the update reveals, or use React 19.3's `<ViewTransition>`, which waits for Suspense. The `cut` and fallback paths never call `flushSync`.

## React 19.3 recipe

```tsx
const mode = useResolvedMotion('stepped');
const select = (id: string) =>
  mode === 'cut'
    ? setSelected(id)
    : withCutMorphMode(mode, () => startTransition(() => setSelected(id)));

<ViewTransition name={`shot-${id}`} default="f12-match">…</ViewTransition>
```

`withCutMorphMode` sets the mode key on `<html>` and removes it when the transition React starts has finished. If none starts within about 60 frames, it removes the key then. React 19.3 adds its own 0 ms `::view-transition-group(root)` animation, a size fixup, which does not move anything.

## Not supported

- Cross-document transitions.
- Scrubbing, drag, typing, focus movement, playback (including ExposureScrubber's scrubbing), and continuous input: these are direct manipulation and are never stepped or delayed.
- Automatic transitions on any FRAME/12 component.
