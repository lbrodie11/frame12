---
name: frame12
description: Build interfaces, dashboards, settings screens, landing pages, and data tables in the FRAME/12 design language using ink-framed panels, rotated SVG screentone fills, strict 12px/20px/32px gutter grammar, sequential cut numbers (C-01, C-02…), marker-yellow highlights, and 12fps stepped motion ("on twos"). Use whenever creating or modifying UI with @/components/frame12 components.
---

# FRAME/12 Design System Skill

FRAME/12 is an interface design language built from page composition and cel-animation production craft: heavy `2.5px` mitered ink panel borders, rotated 45° SVG screentone dot patterns instead of gradients, exposure-sheet segmented controls, speech-balloon data annotations, and discrete state transitions sampled "on twos" (`12fps`, `83.33ms` per pose).

For complete TypeScript prop signatures and adapter details, read [references/components-and-adapters.md](references/components-and-adapters.md).
For worked screen examples, common drift fixes, and ESLint enforcement, read [references/examples-and-mistakes.md](references/examples-and-mistakes.md).

---

## 1. Installation & Setup

Install the full kit or individual components via the `shadcn` CLI:

```bash
# Full kit (styles, hooks, 26 core components, and 5 primitive adapters)
npx shadcn@latest add https://frame12.dev/r/frame12.json

# Or individual registry items
npx shadcn@latest add https://frame12.dev/r/frame12-styles.json
npx shadcn@latest add https://frame12.dev/r/sheet.json
npx shadcn@latest add https://frame12.dev/r/scene.json
npx shadcn@latest add https://frame12.dev/r/panel.json
npx shadcn@latest add https://frame12.dev/r/panel-pair.json
npx shadcn@latest add https://frame12.dev/r/tone-area-chart.json
```

> **Local / Self-Hosted Registry:** `https://frame12.dev` is the live production registry origin (`NEXT_PUBLIC_SITE_URL`). When working offline or locally, serve `site/public/r/` (`npm --workspace=@frame12/site run dev`) and pass `http://localhost:3000/r/frame12.json` to `npx shadcn@latest add`, or start from `templates/next-starter/`.

> **Safe Upgrades & Non-Interactive Agent Installs (`--overwrite`):**
> 1. **Do not edit `styles/frame12.css` directly:** Place any custom token overrides in your own stylesheet (e.g., `app/globals.css`) so future `shadcn add` runs never hit a modified-file conflict on `frame12.css`.
> 2. **Pass `--overwrite` when adding components after an update:** Because every individual component manifest depends on `frame12-styles` (`styles/frame12.css`), running `npx shadcn@latest add <url> -y` without `--overwrite` when `styles/frame12.css` differs locally will skip installation in non-interactive shells and still exit with code `0`.
> 3. **Verify installed files on disk:** Coding agents MUST check that `components/frame12/<name>.tsx` (and `styles/frame12.css`) exist on disk after running `shadcn add`, rather than trusting exit code `0`.

Import `styles/frame12.css` (or `styles/frame12-tailwind.css` for Tailwind CSS v4 `@theme` mappings) once at the root of your application. Every component works standalone with `frame12.css` without requiring Tailwind.

---

## 2. The 8 Non-Negotiable Rules

Every screen, component, and stylesheet MUST pass these 8 rules (`node scripts/check-frame12.mjs`):

1. **Tokens, not literals (`color-literal`):**
   - Never write hex (`#...`), `rgb(...)`, `rgba(...)`, `hsl(...)`, or `hsla(...)` colors or font-family names outside `frame12.css` / `frame12-tailwind.css`.
   - Always use CSS custom properties:
     - Surfaces: `--f-desk`, `--f-sheet`, `--f-panel`, `--f-hole`
     - Ink & rules: `--f-ink`, `--f-ink-2`, `--f-rule`, `--f-tone`, `--f-grid`
     - Marker highlight: `--f-marker`, `--f-marker-ink`
     - Gutters: `--f-gutter-pair` (`12px`), `--f-gutter-scene` (`20px`), `--f-gutter-change` (`32px`)
     - Typography: `--font-f-display`, `--font-f-body`, `--font-f-mono`
2. **Gutter grammar (`illegal-gutter`):**
   - Gutters come strictly from three values:
     - `12px` (`gutter="pair"` / `--f-gutter-pair`): tightly paired panels (`PanelPair`) or compact control groups.
     - `20px` (`gutter="scene"` / `--f-gutter-scene`): panels and columns within the same scene.
     - `32px` (`gutter="change"` / `--f-gutter-change`): separation between scenes on a `Sheet`.
   - Never use arbitrary gaps (`8px`, `16px`, `24px`, `gap-4`, `gap-6`) in `Scene`, panel layouts, or inline `gap` styles.
3. **Automatic cut numbers (`explicit-cut-in-autocut` & `cut-order`):**
   - Use `<Sheet autoCut>` and don't write cut numbers. Use `cut={false}` for panels that shouldn't be numbered. Only `DialogContent` takes an explicit cut (`<DialogContent cut="C-0X">`).
   - Visual order, reading order (top-to-bottom, left-to-right), and DOM order MUST match. Never pass an explicit `cut` prop on a `Panel` or `PanelPair` inside `<Sheet autoCut>` (`explicit-cut-in-autocut`); on legacy sheets without `autoCut`, explicit cuts must start at `C-01` and increment sequentially (`cut-order`).
4. **Marker yellow discipline (`marker-misuse`):**
   - `--f-marker` (`#ffd60a`) is a highlighter. It may **only** be used as a `background` / `background-color` paired with `--f-marker-ink` (`#121212`) text, or as an inked target dot (`.f12-peak-dot`, `.f12-cross-dot`) with a `2px` `--f-rule` stroke.
   - Never use `--f-marker` as a text color, line stroke, chart series color, or standalone border.
5. **Motion on twos:**
   - Default motion mode is `'stepped'`: discrete state changes (switching time ranges, filtering rows, counting metrics) sample an ease-out curve at `12fps` (`83.33ms` per pose).
   - Continuous pointer interactions—hover states, scrolling, dragging, typing in inputs, and chart crosshairs—MUST stay immediate (`0ms`).
   - `prefers-reduced-motion: reduce` automatically switches all transitions to instant hard cuts (`'cut'`).
   - Use `useChanged(key)` so entrance animations (`.f12-enter`, `<Badge pop={changed}>`) never fire on initial page load; the sheet is complete at rest.
6. **Accessibility (WCAG AA):**
   - Text contrast must meet WCAG AA (`4.5:1` body, `3:1` large display) in both `light` and `dark` themes.
   - Every interactive control must have an accessible name (`label`, `aria-label`, or visible text), unique `id`, and visible `:focus-visible` outline (`3px solid var(--f-ink)`).
   - Every chart must provide keyboard inspection (`tabIndex={0}`, `ArrowLeft`/`ArrowRight`/`Escape`) and a collapsible `<details className="f12-tbl">` semantic data table (`showTable`).
   - All decorative SVG frames, bursts, pegs, and tails must carry `aria-hidden="true"`.
7. **Describe the craft, never name people or franchises:**
   - Never mention specific artists, studios, comics, anime titles, or franchises in code, comments, copy, or documentation. Refer strictly to the production craft: *panels, mitered ink frames, screentone, registration pegs, exposure sheets, cut numbers, and animating on twos*.
8. **Zero external animation, drawing, or charting libraries:**
   - Do not import `framer-motion`, `gsap`, `recharts`, `chart.js`, `d3`, or `lucide-react`. Use `@/components/frame12` components (`ToneAreaChart`, `ToneBarList`, `ToneSpark`, `Balloon`) and `@/hooks/use-on-twos` hooks (`useOnTwos`, `useCountUp`, `useChanged`).

---

## 3. Panel Composition & Storyboard Hierarchy

Compose every screen like a production storyboard sheet:

1. **Wrap the page in `<Sheet autoCut>`:**
   - `<Sheet autoCut pegs motion={motion} theme={theme}>` renders the registration pegs at the top edge, numbers every `<Panel>` automatically in DOM reading order (`C-01`, `C-02`, `C-03`…) via CSS counters, and establishes a `32px` vertical rhythm between `<header className="f12-hd">` and each `<Scene>`.
2. **Establish the scene in `C-01`:**
   - The first `<Panel>` inside `<Sheet autoCut>` is automatically numbered `C-01` as the establishing shot. Give it dominant visual weight using `<Scene gutter="scene" layout="split">` (`2fr 1fr` on desktop, single-column stack under `760px`) or a full-width `<Scene gutter="scene" layout="stack">`.
3. **Pair secondary KPIs or coupled controls with `<PanelPair>`:**
   - Place `<PanelPair top={{ label: '...', children: ... }} bottom={{ label: '...', children: ... }} />` in the secondary column of a `split` scene (or alongside a detail panel). Inside `<Sheet autoCut>`, both halves are numbered automatically (`C-02`, `C-03`) across a `16px` diagonal slant and `12px` (`pair`) gutter (`slant-bottom` over `slant-top`). Use `cut={false}` on any subordinate panel that shouldn't be numbered.
4. **Use `20px` (`gutter="scene"`) within a scene and `32px` (`gutter="change"`) between scenes:**
   - Keep panels that answer the same question in one `<Scene gutter="scene" layout="equal" | "three" | "split">`.
   - Start a new `<Scene>` for a new narrative beat (e.g., moving from hero KPIs to a filterable ledger or danger-zone configuration).
5. **Balance Expressive vs. Quiet (`variant="expressive" | "quiet"`):**
   - **Expressive (default):** `2.5px` mitered SVG polygon frames, sequential `C-01..C-0n` cut badges, `16px` diagonal `PanelPair` slants, column-aware `clamp(20px, min(14cqi, 100cqi / (var(--f12-m-chars, 8) * 0.8)), 56px)` hero display numerals (`min-width: min(100%, 12rem)`), and stepped `useCountUp` motion. Use for primary narrative beats, hero metrics, and focal charts.
   - **Quiet (`variant="quiet"`):** Crisp `1px solid var(--f-rule)` exposure-sheet border, tighter interior padding, rectangular `PanelPair` slots, `22px` tabular monospace `Metric` numerals (`motion="cut"` by default), and **no cut badge by default** (`cut` omitted renders no `.f12-cut`, so Quiet panels never increment `<Sheet autoCut>` counters or require sequential `C-01..C-0n` cuts).
   - **When Expressive becomes excessive:** Do not put `2.5px` Expressive frames and cut numbers on every nested filter group, operational form subsection, or dense configuration ledger. Use `<Panel variant="quiet">`, `<Metric variant="quiet">`, and `density="compact"` (`Table`, `Input`, `Select`, `ToneBarList`) for subordinate operational groups so the numbered Expressive panels retain clear visual hierarchy.
6. **Non-color semantic status (`status` on `Tag` and `Badge`) & pattern differentiation:**
   - Never invent red/green/amber pills, and never repurpose `--f-marker` yellow as a warning/status color. Pass `status="neutral" | "info" | "success" | "warning" | "danger"` to `<Tag>` or `<Badge>`, which pairs orthographic glyph prefixes (`[i]`, `[+]`, `[!]`, `[×]`) and a visually hidden screen-reader status label (`Info: `, `Success: `, `Warning: `, `Error: `) with ink-and-paper border weight, stroke style,diagonal hatch (`warning`), and fill inversion (`danger`) (`14.63:1–18.74:1` contrast in light and dark themes).
   - Differentiate categorical bars in `<ToneBarList>` using `pattern: 'dots' | 'hatch' | 'dense'` on `ToneBarItem` only when the pattern encodes a meaningful grouping or cross-chart link (such as execution tier or channel class)—do not scatter decorative patterns across bars that measure the same homogeneous dimension. Rely on `<ToneAreaChart>`'s built-in diamond comparison markers (`.f12-compare-pt`) and dashed ink stroke for secondary series.

---

## 4. Component Selection & Adapter Policy

When you installed the full kit (`frame12.json`) or started from `templates/next-starter`, import components from the barrel (`@/components/frame12`) or directly from their module (`@/components/frame12/<name>`). When you installed individual registry items (e.g., `button.json`, `panel.json`), import each component from its module path (`@/components/frame12/button`, `@/components/frame12/panel`) and hooks from `@/hooks/use-on-twos`. Never import raw `@/components/ui/*` or `@radix-ui/*` primitives in application screens when a FRAME/12 component or adapter exists.

| UI Need | FRAME/12 Component | Forbidden Raw Alternative |
| --- | --- | --- |
| Page shell & registration pegs | `Sheet` (`autoCut`) | Custom wrapper divs with hard-coded padding |
| Multi-column / stacked grid | `Scene` (`gutter="pair" \| "scene" \| "change"`, `layout="split" \| "equal" \| "three" \| "stack"`) | Arbitrary CSS grid or Tailwind `gap-4` / `gap-6` |
| Framed section / card | `Panel` (`label="..."`, `cut={false}` if unnumbered) | shadcn `Card`, bordered `<div>` |
| Vertically paired KPIs / panels | `PanelPair` (`top`, `bottom`, 12px slanted gutter) | Two stacked cards with `gap-4` |
| Mode, range, or view switcher (same content) | `SegmentedControl` | Radio button pills |
| Sectioned content panels (distinct views) | `Tabs` (`TabsList`, `TabsTrigger`, `TabsContent`) | Unstyled tab buttons or raw `@/components/ui/tabs` |
| Action button | `Button` (`variant="primary" \| "secondary" \| "marker"`) | Raw `<button>` or unadapted `@/components/ui/button` |
| Form field wrapper (`label`, `hint`, `error`) | `Field` | Unlinked `<label>` + manual `aria-describedby` |
| Text / number / search field | `Input` (`label`, `hint`, `error`) | Unlabeled `<input>` or raw `@/components/ui/input` |
| Multi-line text field | `Textarea` (`label`, `hint`, `error`) | Unlabeled `<textarea>` or raw `@/components/ui/textarea` |
| Boolean / mixed option | `Checkbox` (`label`, `indeterminate`, `onCheckedChange`) | Raw `<input type="checkbox">` or `@/components/ui/checkbox` |
| Mutually exclusive option set | `RadioGroup` & `RadioGroupItem` | Unstyled radios or raw `@/components/ui/radio-group` |
| Binary on/off toggle | `Switch` (`label`, `onLabel`, `offLabel`, `onCheckedChange`) | Custom toggle `<button>` or raw `@/components/ui/switch` |
| Highlight callout with impact burst | `Badge` (`pop`, `burst`) | Colored status pills (green/red/blue badges) |
| Compact metadata marker | `Tag` | Colored chips |
| Inline status banner / static notice | `Alert` & `Notice` (`status="neutral" \| "info" \| "success" \| "warning" \| "danger"`, `live="off" \| "polite" \| "assertive"`) | Raw `@/components/ui/alert` or colored banners |
| Ephemeral notification stack | `ToastProvider`, `useToast`, `Toast` (`maxVisible={3}`, hover/focus timer pause, `Escape` dismissal) | `sonner`, `react-hot-toast`, or raw `@/components/ui/toast` |
| Zero-CLS loading placeholder | `Skeleton` & `SkeletonText` (`variant="block" \| "line" \| "circle" \| "metric" \| "panel"`) | Blurred shimmer gradients or raw `@/components/ui/skeleton` |
| Zero-data / filtered-empty view | `EmptyState` (`code`, `title`, `description`, `action`, `secondaryAction`) | Ad-hoc empty text divs or raw `@/components/ui/empty-state` |
| Hierarchical path navigation | `Breadcrumb` (`items` or `BreadcrumbList` / `BreadcrumbItem` / `BreadcrumbLink` / `BreadcrumbPage`) | Unstructured `>` links or raw `@/components/ui/breadcrumb` |
| Page range navigation | `Pagination` (`page`, `totalPages`, `onPageChange`, `showSummary`) | Custom page buttons or raw `@/components/ui/pagination` |
| Headline KPI + directional delta | `Metric` & `Delta` | Custom stat card |
| Time-series or trend chart | `ToneAreaChart` | Recharts, Chart.js, Visx |
| Ranked comparison bar list | `ToneBarList` | Progress bars, horizontal bar chart libraries |
| Compact daily bar sparkline | `ToneSpark` | SVG sparkline libraries |
| Speech-balloon callout | `Balloon` | Floating popovers for static callouts |
| Modal confirmation / detail view | `Dialog` (`DialogTrigger`, `DialogContent cut="C-0X"`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `DialogClose`) | Raw `@radix-ui/react-dialog` or `window.confirm` |
| Single-value dropdown selector | `Select` (`SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`) | Native `<select>` without styling or raw Radix Select |
| Focus/hover hint | `Tooltip` (`TooltipProvider`, `TooltipTrigger`, `TooltipContent`) | `title` attribute or raw Radix Tooltip |
| Action menu | `DropdownMenu` (`DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuLabel`, `DropdownMenuSeparator`) | Raw Radix DropdownMenu |
| Structured tabular ledger | `Table` (`TableHeader`, `TableBody`, `TableFooter`, `TableRow`, `TableHead`, `TableCell`, `TableCaption`) | Unstyled `<table>` or data-grid libraries |

---

## 5. Pre-Flight & Automated Verification Checklist

Before finishing any FRAME/12 task, run the automated checker and verify:

```bash
node scripts/check-frame12.mjs <your-files-or-directories>
```

- [ ] **Zero `color-literal` errors:** All colors use `var(--f-*)` and all fonts use `var(--font-f-*)`.
- [ ] **Zero `illegal-gutter` errors:** Every `Scene` `gutter` and every flex/grid `gap` uses `12px` (`var(--f-gutter-pair)`), `20px` (`var(--f-gutter-scene)`), or `32px` (`var(--f-gutter-change)`).
- [ ] **Zero `marker-misuse` errors:** `--f-marker` only appears as a background with `--f-marker-ink` foreground text.
- [ ] **Zero `explicit-cut-in-autocut` & `cut-order` errors:** Screens use `<Sheet autoCut>` with no hand-written panel cuts (using `cut={false}` when a panel shouldn't be numbered, and explicit `cut="C-0X"` only on `DialogContent`).
- [ ] **Zero `raw-shadcn-import` errors:** All UI primitives and adapters come from FRAME/12.
- [ ] **Both themes & viewports verified:** Light and dark themes meet WCAG AA contrast, and layouts have no horizontal overflow at `1280px` desktop or `390px` mobile widths.
