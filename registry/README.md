# `@frame12/registry`

Copy-in component source, CSS tokens, motion hooks, and [shadcn](https://ui.shadcn.com) registry for the **FRAME/12** design language.

## Design Grammar Rules

1. **Tokens, not literals:** All colors and font stacks come from `--f-*` and `--font-f-*` variables in `styles/frame12.css` (optional Tailwind v4 `@theme` mapping in `styles/frame12-tailwind.css`).
2. **Gutter grammar:** Gutters inside `Scene` come strictly from `12px` (`pair`), `20px` (`scene`), and `32px` (`change`).
3. **Cut numbers:** Numbered in reading order (`C-01`, `C-02`…); visual order, reading order, and DOM order always match.
4. **Marker yellow (`--f-marker`):** Only ever sits under ink text (`--f-marker-ink`). Never used as a line, chart series, or text color.
5. **Motion on twos:** Discrete state transitions hold each pose for two frames at 24fps (`1000 / 12` = 83.33ms per pose, 12 poses/second). Hover, scrolling, typing, and crosshairs remain immediate. `prefers-reduced-motion: reduce` switches all transitions to instant hard cuts (`cut`).
6. **Screentone:** Rotated SVG halftone dot patterns replace gradients and semi-transparent fills.

## Installation via `shadcn` CLI

```bash
# Install the full FRAME/12 kit (styles, hooks, components, and adapters)
npx shadcn@latest add https://frame12.dev/r/frame12.json

# Or install individual components
npx shadcn@latest add https://frame12.dev/r/frame12-styles.json
npx shadcn@latest add https://frame12.dev/r/panel.json
npx shadcn@latest add https://frame12.dev/r/tone-area-chart.json
```

> **Note:** `https://frame12.dev` is the live production registry origin (override via `NEXT_PUBLIC_SITE_URL`). For local development, run `npm --workspace=@frame12/site run dev` and install from `http://localhost:3000/r/frame12.json` (verified automatically by `node scripts/smoke-install.mjs`).

Import `styles/frame12.css` (or `styles/frame12-tailwind.css` when using Tailwind v4) in your root layout. Every component works standalone with `frame12.css` without requiring Tailwind.

## Component Reference

### Hooks (`hooks/use-on-twos.ts`)

| Export | Description |
| --- | --- |
| `useOnTwos(key, duration?, motion?)` | Samples an ease-out curve at 12 poses/second (`83.33ms` per pose) in `'stepped'` mode, continuous in `'smooth'`, or instant in `'cut'` / reduced motion. |
| `useCountUp(value, motion?, duration?)` | Interpolates numeric values on twos when `value` changes. |
| `useChanged(key)` | Returns `false` on initial paint and `true` after the first change of `key`. |
| `useSize(ref)` | Tracks layout `offsetWidth` and `offsetHeight` via `ResizeObserver`. |
| `useReducedMotion()` | Tracks `(prefers-reduced-motion: reduce)`. |

### Layout (`ui/sheet.tsx`, `scene.tsx`, `panel.tsx`, `panel-pair.tsx`)

| Component | Key Props | Purpose |
| --- | --- | --- |
| `Sheet` | `pegs?: boolean`, `motion?: 'stepped' \| 'smooth' \| 'cut'`, `theme?: 'light' \| 'dark'` | Top-level storyboard sheet with registration pegs and 32px scene-change flow. |
| `Scene` | `gutter?: 'pair' \| 'scene' \| 'change'`, `layout?: 'split' \| 'stack' \| 'equal' \| 'three'` | Enforces the three legal FRAME/12 gutter widths (`12px`, `20px`, `32px`). |
| `Panel` | `cut?: string`, `shape?: 'rect' \| 'slant-bottom' \| 'slant-top'`, `label?: string` | Ink-framed section with SVG mitered polygon border (`2.5px` stroke, `16px` slant rise). |
| `PanelPair` | `top`, `bottom`, `topCut`, `bottomCut`, `children` | Pairs two related panels across a shared 12px slanted gutter (`slant-bottom` over `slant-top`). |

### Controls (`ui/segmented-control.tsx`, `button.tsx`, `input.tsx`, `badge.tsx`, `tag.tsx`)

| Component | Key Props | Purpose |
| --- | --- | --- |
| `SegmentedControl` | `options`, `value`, `onChange`, `ariaLabel`, `idPrefix` | Exposure-sheet cell selector with `mix-blend-mode: difference` marker and stepped motion. |
| `Button` | `variant?: 'primary' \| 'secondary' \| 'marker'`, `size?: 'sm' \| 'md' \| 'lg'` | Ink-framed button with visible focus ring and marker-yellow accent variant. |
| `Input` | `label`, `hint?`, `error?` | Ink-framed input with linked `<label>`, hint, and marker-flagged error alert. |
| `Badge` | `pop?: boolean`, `burst?: boolean` | Marker-yellow badge with ink text and two-frame SVG impact `Burst`. |
| `Tag` | `children` | Flat marker-yellow tag with ink text (`.f12-tag`). |

### Data (`ui/metric.tsx`, `tone-area-chart.tsx`, `tone-bar-list.tsx`, `tone-spark.tsx`, `balloon.tsx`)

| Component | Key Props | Purpose |
| --- | --- | --- |
| `Metric` & `Delta` | `label`, `value`, `format`, `delta`, `deltaKind`, `comparisonLabel`, `note`, `big`, `headingLevel`, `motion`, `spark` | Display KPI with count-up on twos, marker delta symbol, and optional `ToneSpark`. |
| `ToneAreaChart` | `data`, `seriesLabel`, `labelColumnHeader`, `compareLabel`, `formatValue`, `formatShort`, `annotation`, `motion`, `height`, `tableSummary` | 4-band SVG screentone halftone area chart, speech-balloon annotation, keyboard arrow navigation, pointer crosshair, and `<details className="f12-tbl">` data table. |
| `ToneBarList` | `title`, `subtitle`, `items`, `selectedId`, `onSelect`, `motion`, `changed`, `idPrefix` | Ranked comparison list with screentone bars, share percentages, and impact-burst leader badge. |
| `ToneSpark` | `values`, `label`, `ariaLabel`, `rangeKey`, `motion` | Daily mini bar chart filled with rotated SVG screentone dots. |
| `Balloon` | `tailOffset?`, `showDot?`, `children` | Standalone speech-balloon annotation with mitered tail and marker target dot. |

## Adapter Policy for Complex Primitives

For complex interactive primitives (`Dialog`, `Select`, `Tooltip`, `DropdownMenu`, `Table`), FRAME/12 ships accessible adapters (`ui/dialog.tsx`, `ui/select.tsx`, `ui/tooltip.tsx`, `ui/dropdown-menu.tsx`, `ui/table.tsx`) that:
1. Target `components/frame12/*.tsx`, `hooks/use-on-twos.ts`, and `styles/frame12.css` in `registry/registry.json` so installing FRAME/12 never overwrites existing `components/ui/*.tsx` shadcn primitives in a host project.
2. Preserve full WAI-ARIA and keyboard accessibility (native `<dialog>` with `showModal()`, `aria-labelledby`, conditional `aria-describedby`, `Escape` isolation with nested popups, and pointer light-dismiss; `@radix-ui/react-select` and `@radix-ui/react-dropdown-menu` with portal theme inheritance and hidden `<select>` form submission; `TooltipTrigger asChild` handler/ref/aria-describedby merging; and semantic `<table>` with `scope="col"`).
3. Style all surfaces, borders, focus rings, and active states strictly through `.f12-*` classes and `--f-*` / `--font-f-*` tokens in `styles/frame12.css`.
