# Reddit Launch Posts (`launch/drafts/reddit-posts.md`)

Tailored launch posts for `r/reactjs` and `r/webdev`, written to match each community's technical norms (architecture-first, concrete code and CSS mechanics, zero marketing hype, MIT open source).

---

## 1. `r/reactjs` Post

### Title

```text
[Open Source] Building a React component system that animates "on twos" (12fps stepped hooks, ResizeObserver SVG polygon frames, and a static design-grammar linter)
```

### Body

I’ve been exploring what happens when a React component library drops floating cards, soft shadows, and 60fps spring physics in favor of production mechanics from sequential print layout and traditional cel animation.

The result is **FRAME/12** ([GitHub (MIT)](https://github.com/lbrodie11/frame12) · [Live Motion Studio](https://frame12.dev/motion)), a zero-dependency copy-in React + TypeScript registry (`shadcn`-compatible) and AI agent skill.

Here are the four most interesting React & DOM problems we had to solve while building it:

#### 1. Quantizing an easing curve "on twos" (`useOnTwos`)
In hand-drawn animation, most movement is shot "on twos"—each drawing is held for two frames at `24fps` (`83.33ms` per pose, `12` poses per second). Simply applying CSS `steps(4)` with linear timing feels robotic because every jump covers the exact same distance.

Instead, `useOnTwos` samples a cubic ease-out spacing chart inside `requestAnimationFrame`, bucketed into `83.33ms` (`1000 / 12`) intervals. You get a wide initial jump and tight settling poses, while still holding each discrete pose cleanly:

```ts
export const FRAME_MS = 1000 / 12; // 83.333ms ("on twos")
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

// Inside requestAnimationFrame loop:
const elapsed = now - t0;
const k = Math.min(frames, Math.floor(elapsed / FRAME_MS) + 1);
setProgress(easeOut(k / frames));
```

We also strict-split *what* gets stepped:
- **Discrete state changes** (`SegmentedControl` cell jumps, `Metric` count-ups, `ToneAreaChart` clip-path wipes, `Badge` 2-frame SVG impact bursts) run on twos (`12fps`).
- **Direct manipulation** (hover states, scrolling, typing, chart pointer/keyboard crosshairs) stays at `0ms` immediate latency.
- **Initial mount (`useChanged`)**: A custom hook tracks whether a key has changed *after* first mount so entrance animations never fire on initial page load.
- **Accessibility**: `prefers-reduced-motion: reduce` automatically switches all hooks and CSS classes to `'cut'` (`0ms` hard cuts).

#### 2. Non-warping diagonal panel frames with `ResizeObserver`
In `PanelPair`, two vertically paired KPI panels are separated by a `12px` gutter with a `16px` diagonal slant (`slant-bottom` over `slant-top`). If you use CSS `clip-path: polygon(...)`, CSS borders get clipped off along the diagonal edge; if you scale a fixed-viewBox `<svg>` with `preserveAspectRatio="none"`, the `2.5px` ink stroke stretches unevenly.

Our `Panel` component attaches a `ResizeObserver` to measure the panel's exact `width × height` in pixels and computes mitered `<polygon>` points inset by half the stroke width (`1.25px`), keeping the `2.5px` ink border uniform at any aspect ratio.

#### 3. Zero-dependency SVG screentone charts with built-in keyboard & table fallbacks
Instead of pulling in `recharts` or `d3` and rendering translucent gradient fills, `ToneAreaChart` renders a `<pattern id="..." patternTransform="rotate(45)">` of halftone dots (`var(--f-tone)`), an inked `2.5px` polyline, a marker-yellow peak dot, and a speech-balloon SVG annotation (`Balloon`) that flips direction near the right edge of the viewBox.

Every chart is focusable (`tabIndex={0}`), supports `ArrowLeft` / `ArrowRight` / `Home` / `End` / `Escape` to inspect data points via an aria-live readout, and includes a collapsible `<details className="tbl">` semantic HTML `<table>`.

#### 4. Linting UI structure so AI coding agents don't drift
When AI agents generate React UI, they quickly drift toward arbitrary Tailwind gaps (`gap-4`, `gap-6`), hex literals, or unstyled primitives. Because FRAME/12's rules are structural, we wrote `scripts/check-frame12.mjs` (plus `skills/frame12/SKILL.md` and an ESLint flat-config plugin) to enforce:
1. `color-literal`: Zero hex/RGB/HSL literals outside `frame12.css`
2. `illegal-gutter`: Only `12px` (`pair`), `20px` (`scene`), and `32px` (`change`) gutters allowed
3. `marker-misuse`: Marker yellow (`--f-marker`, `#ffd60a`) only allowed as a background paired with `--f-marker-ink` (`#121212`) text
4. `cut-order`: Every `<Panel cut="C-01">` must increment sequentially (`C-01`, `C-02`, `C-03`…) in DOM and reading order
5. `raw-shadcn-import`: Forbids raw `@radix-ui/*` or external chart/animation libraries where a `@frame12/registry` component or adapter exists

You can install the full kit or individual components via the `shadcn` CLI:

```bash
npx shadcn@latest add https://frame12.dev/r/frame12.json
```

- **Repo (MIT):** https://github.com/lbrodie11/frame12
- **Interactive Motion Studio (`12fps` vs `60fps` vs `0ms`):** https://frame12.dev/motion
- **Component Gallery & Style Sheet:** https://frame12.dev/components

Would love feedback from folks here on the hook ergonomics and the static UI grammar linter!

---

## 2. `r/webdev` Post

### Title

```text
We replaced soft gradients, rounded cards, and 60fps easing with print gutter grammar, 45° SVG screentone, and 12fps stepped animation — here’s the CSS & SVG breakdown (MIT Open Source)
```

### Body

Almost every dashboard template on the web today shares the same visual DNA: `1px` low-contrast borders, `8px–16px` border-radius, blurred backdrops, translucent area-chart gradients, and `250ms` cubic-bezier glides.

Over the past few weeks, we built **FRAME/12** ([Live Site](https://frame12.dev) · [GitHub (MIT)](https://github.com/lbrodie11/frame12)), an open-source interface design language and component registry that borrows its layout and motion grammar from sequential print production and cel animation.

Here is how the CSS and SVG mechanics work under the hood:

#### 1. Semantic Gutter Grammar (`12px` / `20px` / `32px`) + Container Queries
In print page layout, the width of the gutter between panels isn't arbitrary whitespace—it tells the reader how two moments relate in time and space. FRAME/12 restricts all layout gaps to three CSS custom properties:
- `--f-gutter-pair: 12px` — tightly couples two vertically stacked panels across a `16px` diagonal cut (`PanelPair`)
- `--f-gutter-scene: 20px` — separates panels that belong to the same scene (`Scene gutter="scene"`)
- `--f-gutter-change: 32px` — separates distinct narrative scenes down the sheet (`Sheet`)

The outer `.dash.frame` wrapper defines `container-type: inline-size`, so multi-column scenes (`.scene-split`, `.scene-equal`, `.scene-three`) collapse cleanly via `@container (max-width: 760px)` whether the sheet is full-bleed on a `390px` phone or embedded inside a narrow split-pane preview.

#### 2. Flashback Dark Mode (`data-theme="dark"`)
Standard dark modes invert the page into dark gray and make cards slightly lighter gray. In print comics, when a scene shifts into a flashback, the printer floods the **gutters** between panels with solid black ink so the panels read as illuminated memories cut out of darkness.

In FRAME/12:
- **Light mode:** Warm paper sheet (`#fbf8f1`), crisp white panels (`#ffffff`), heavy ink rules (`#121212`).
- **Dark mode (Flashback):** Black gutters (`#070708`), charcoal panels (`#131316`), bone-white ink rules (`#f4f1ea`), and unchanged marker yellow (`#ffd60a`) strictly paired with `#121212` ink text so WCAG AA contrast (`4.5:1` body, `3:1` display) holds in both themes.

#### 3. Exposure-Sheet Segmented Control with `mix-blend-mode: difference`
When switching tabs or time ranges in `SegmentedControl`, a solid ink indicator bar (`background: #fff; mix-blend-mode: difference`) jumps across cells using `transition: transform 250ms steps(3, end)`. Because of `mix-blend-mode: difference` inside an `isolation: isolate` track, any label or numeral the indicator crosses on intermediate poses (`0ms → 83ms → 167ms → 250ms`) inverts sharply with zero sub-pixel anti-aliasing blur.

#### 4. Static Verification & Playwright Accessibility Suite
The repository includes:
- `lab/`: A self-contained blind counterbalanced usability study comparing FRAME/12 against a conventional dashboard across timed tasks.
- `registry/`: 19 `shadcn`-compatible registry items (components, primitive adapters, hooks, and standalone `frame12.css`).
- `skills/frame12/` & `scripts/check-frame12.mjs`: An AI agent skill and static linter that enforces token usage, `12/20/32px` gutters, sequential `C-01..C-0N` panel cut numbers, and marker-yellow contrast rules.
- `templates/next-starter/`: A ready-to-deploy Next.js App Router starter with the skill and linter pre-wired.

**Links:**
- Live interactive comparison (`12fps` on twos vs `60fps` smooth): https://frame12.dev/motion
- Visual style sheet & construction specs: https://frame12.dev/style-sheet
- GitHub repository (MIT): https://github.com/lbrodie11/frame12
