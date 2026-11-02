# Designing Interfaces on Twos

Open ten modern software dashboards in separate browser tabs and squint. Despite different brand palettes, they resolve into the same blurred silhouette: translucent floating cards, one-pixel low-contrast borders, sixteen-pixel corner radii, pastel status pills, and area charts fading into twenty-percent alpha gradients. Click a filter, and every element glides across the screen at sixty frames per second along the same cubic-bezier curve.

This visual convergence is a consequence of soft primitives. When a design system defines hierarchy through subtle opacity shifts, multi-layered shadows, and eight-point spacing scales where every step (`4px` to `32px`) is equally legal, structure becomes subjective tuning. Engineers spend hours nudging margins until a screen feels balanced. AI coding agents fare worse: ask an agent to build a second screen in a custom theme, and without hard geometric boundaries it regresses to generic rounded cards, arbitrary Tailwind gaps, and invented hex literals.

**FRAME/12** starts from a different premise. Instead of treating a web page as a stack of floating glass panes, it borrows its layout and motion grammar from two physical production crafts that solved visual hierarchy and temporal pacing decades ago: sequential print page composition and hand-drawn cel animation.

---

## 1. The Page Is a Pegged Sheet, Not an Infinite Canvas

In traditional animation and sequential print production, every drawing sits on a physical sheet punched at the top edge to lock onto registration pegs. Within that sheet, space is divided into **panels** framed by heavy (`2.5px`) mitered ink borders.

Most CSS frameworks treat spacing as visual breathing room. In sequential print layout, the **gutter**—the blank channel between inked frames—is semantic punctuation. Its width tells the reader how two moments relate in time and space. FRAME/12 restricts all layout gutters to three values enforced by CSS custom properties:

- **Pair gutter (`12px` / `--f-gutter-pair`):** Couples two vertically stacked panels that form one comparative thought. In `PanelPair`, the `12px` gutter is sliced at a `16px` diagonal slant (`slant-bottom` above `slant-top`). Because CSS `clip-path` chops off standard element borders along diagonal edges, each `Panel` runs a `ResizeObserver` to measure its pixel box and computes mitered `<svg>` `<polygon>` coordinates inset by half the stroke width (`1.25px`). The `2.5px` ink rule stays sharp at any viewport width.
- **Scene gutter (`20px` / `--f-gutter-scene`):** Groups panels that answer the same operational question within a single `<Scene>`.
- **Scene-change gutter (`32px` / `--f-gutter-change`):** Marks a narrative beat change down the `<Sheet>`—for example, moving from headline KPIs to a filterable transaction ledger.

Every panel also carries a sequential **cut number** (`C-01`, `C-02`, `C-03`…) set into its top-left frame line. `C-01` is always the establishing shot—the largest panel on the sheet—and cut numbers increment strictly in DOM and visual reading order (`top-to-bottom`, `left-to-right`), guaranteeing that keyboard `Tab` traversal matches visual layout.

---

## 2. Screentone and Flashback Gutters

Conventional dark modes invert the background to dark gray and lift cards to slightly lighter gray. Print comics use a stronger editorial device: when a story shifts into a flashback, the printer floods the **gutters** between panels with solid black ink while keeping panel interiors distinct.

FRAME/12 adopts this flashback convention directly. In light mode, the sheet is warm paper (`#ffffff` over a `#e2e3e5` desk) with `#121212` ink rules. In dark mode (`data-theme="dark"`), the sheet gutters drop to pitch black (`#050505`) while panel interiors sit at `#19191a` framed by `#f1f0ea` bone-white ink rules.

Inside those panels, transparency and blur are replaced by inked linework:

1. **Rotated 45° halftone screentone:** Area charts (`ToneAreaChart`), ranked bar lists (`ToneBarList`), and daily sparklines (`ToneSpark`) fill with an SVG `<pattern>` of `var(--f-tone)` dots rotated forty-five degrees. Halftone screentone reads as crisp texture in both themes without alpha-blending artifacts.
2. **Speech-balloon annotations:** Instead of requiring hover inspection to discover a chart's peak, `Balloon` renders an inked callout with a mitered SVG tail pointing directly at the peak datum.
3. **Marker-yellow discipline:** Highlighter yellow (`--f-marker`, `#ffd60a`) is the sole chromatic accent. To preserve WCAG AA contrast across light and dark modes, `--f-marker` is permitted *only* as a surface background under `--f-marker-ink` (`#121212`) text, or as an inked peak dot ringed by a `2px` `--f-rule` stroke.

---

## 3. Animating Interfaces "On Twos"

In hand-drawn film production at `24` frames per second, drawing a new cel for every frame ("on ones") is reserved for rapid camera pans. Most action is shot **"on twos"**—each drawing is held for two frames, producing `12` discrete poses per second (`83.33ms` per pose). Holding a pose for `83.33ms` gives the eye enough dwell time to register each silhouette as a deliberate drawing rather than motion blur.

When web developers try stepped CSS animations (`steps(4)`), the result often feels mechanical because standard CSS steps divide distance linearly. Traditional animators follow a **spacing chart** (an exposure sheet) where poses bunch closely together as an object settles.

FRAME/12 implements this in the `useOnTwos` hook:

```ts
export const FRAME_MS = 1000 / 12; // 83.333ms ("on twos")
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

// Inside requestAnimationFrame:
const k = Math.min(frames, Math.floor(elapsed / FRAME_MS) + 1);
const progress = easeOut(k / frames);
```

Time is quantized into `83.33ms` buckets, and a cubic ease-out curve is sampled at each bucket boundary. Across a `250ms` (`3`-pose) or `333ms` (`4`-pose) transition, an element jumps widely on the first pose and settles crisply into its final keyframe.

Crucially, FRAME/12 separates **state transitions** from **direct hand manipulation**:

- **Stepped on twos (`12fps`):** Triggered *only* after a discrete user decision—switching ranges in `SegmentedControl`, counting up a `Metric`, wiping a `ToneAreaChart` clip rectangle, or firing the two-frame SVG impact burst on a `Badge`. In `SegmentedControl`, the active indicator bar (`background: #ffffff; mix-blend-mode: difference`) steps across cells in three poses (`0ms → 83ms → 167ms → 250ms`), cleanly inverting any numeral it crosses mid-flight without blur.
- **Immediate (`0ms`):** Anything tied to the user's hand—button offset shadows on `:hover`, scrolling, typing, and chart crosshairs—stays at zero latency.
- **Cut (`0ms` override):** Under `prefers-reduced-motion: reduce`, or on initial page mount (`useChanged`), every transition collapses to an instant hard cut.

---

## 4. Why Hard Rules Stop AI Agent Drift

Replacing soft conventions with production geometry makes **every rule machine-checkable**. In `skills/frame12/SKILL.md` and `scripts/check-frame12.mjs`, the design language is enforced by five static checks: zero color or font literals outside the token sheet, gutter values restricted to `{12px, 20px, 32px}`, marker yellow restricted to backgrounds under `#121212` ink, sequential `C-01..C-0N` cuts in DOM order, and zero unadapted UI or charting imports.

When we benchmarked unassisted product prompts—Settings, Landing Hero, and an Order Recovery Ledger—copy-in `@frame12/registry` primitives paired with `check-frame12.mjs` eliminated aesthetic drift while passing WCAG AA contrast and `390px` mobile container-query checks.

Constraint does not make interfaces monotonous. Three gutter widths, one highlighter ink, forty-five-degree screentone, and twelve poses a second let software read like a crafted page rather than another coat of paint on the same template.
