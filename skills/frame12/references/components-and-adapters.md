# FRAME/12 Components, Hooks & Primitive Adapters

Complete API reference for `@/components/frame12` and `@/hooks/use-on-twos`.

---

## 1. CSS Custom Properties (`styles/frame12.css`)

```css
/* Color Tokens (automatically switch in .f12-theme-dark / [data-theme="dark"] / prefers-color-scheme: dark) */
--f-desk        /* Outer worktable background */
--f-sheet       /* Storyboard sheet surface */
--f-panel       /* Panel interior surface */
--f-ink         /* Primary ink text & active fill */
--f-ink-2       /* Secondary caption & metadata ink */
--f-rule        /* 2.5px panel border & structural rule ink */
--f-tone        /* Screentone halftone dot ink */
--f-grid        /* Hairline table & chart grid rule */
--f-marker      /* Highlighter yellow (#ffd60a) — background only */
--f-marker-ink  /* Ink on marker yellow (#121212 in both themes) */
--f-hole        /* Registration peg punch-hole fill */

/* Gutter Grammar Tokens */
--f-gutter-pair: 12px;   /* Paired panels & compact control groups */
--f-gutter-scene: 20px;  /* Same-scene panel grid gap */
--f-gutter-change: 32px; /* Scene-change vertical separation */

/* Typography Tokens */
--font-f-display /* Display headlines & metric numerals */
--font-f-body    /* Body copy, table cells, descriptions */
--font-f-mono    /* Cut labels, eyebrows, table headers, controls */
```

---

## 2. Motion Hooks (`hooks/use-on-twos.ts`)

```tsx
import {
  type MotionMode, // 'stepped' | 'smooth' | 'cut'
  FRAME_MS,        // 83.33333333333333 (1000 / 12)
  useOnTwos,
  useCountUp,
  useChanged,
  useSize,
  useReducedMotion,
} from '@/hooks/use-on-twos';
```

- `useOnTwos(key: unknown, duration = 600, motion: MotionMode = 'stepped'): number`
  Returns progress `0..1` whenever `key` changes. Returns `1` on initial mount so the screen renders complete at rest. In `'stepped'` mode, samples the cubic ease-out curve at `12fps` (`83.33ms` per pose). Honors `prefers-reduced-motion: reduce`.
- `useCountUp(value: number, motion: MotionMode = 'stepped', duration = 600): number`
  Interpolates from the previous numeric `value` to the new `value` on twos.
- `useChanged(key: unknown): boolean`
  Returns `false` on first render and `true` after `key` changes for the first time. Pass `changed` to `<ToneBarList changed={changed}>` and `<Badge pop={changed}>`.
- `useSize(ref: { readonly current: HTMLElement | null }): { w: number; h: number }`
  Measures `offsetWidth` and `offsetHeight` via `ResizeObserver`.
- `useReducedMotion(): boolean`
  Tracks `(prefers-reduced-motion: reduce)`.

---

## 3. Layout Components

### `Sheet` (`ui/sheet.tsx`)
Top-level storyboard container with registration pegs and `32px` scene-change vertical flow.

```tsx
export interface SheetProps extends React.HTMLAttributes<HTMLDivElement> {
  pegs?: boolean;              // default: true
  autoCut?: boolean;           // default: false — enables CSS counter cut numbering (C-01, C-02…)
  motion?: MotionMode;         // default: 'stepped'
  theme?: 'light' | 'dark';    // optional explicit theme override
  sheetClassName?: string;
  children?: React.ReactNode;
}
```

### `Scene` (`ui/scene.tsx`)
Grid container enforcing the three legal gutter widths. Collapses to a single column below `760px` container width.

```tsx
export type SceneGutter = 'pair' | 'scene' | 'change'; // 12px | 20px | 32px
export type SceneLayout = 'split' | 'stack' | 'equal' | 'three';
// 'split' = 2fr 1fr, 'stack' = 1fr, 'equal' = 1fr 1fr, 'three' = 1fr 1fr 1fr

export interface SceneProps extends React.HTMLAttributes<HTMLDivElement> {
  gutter?: SceneGutter; // default: 'scene' (20px)
  layout?: SceneLayout; // default: 'split' (2fr 1fr)
  children?: React.ReactNode;
}
```

### `Panel` (`ui/panel.tsx`)
Ink-framed `<section>` drawn with a measured SVG `<polygon>` (`2.5px` mitered stroke) and a top-edge cut label.

```tsx
export type PanelShape = 'rect' | 'slant-bottom' | 'slant-top';

export interface PanelProps extends React.HTMLAttributes<HTMLElement> {
  cut?: string | false; // undefined = automatic inside <Sheet autoCut>; false = unnumbered; string = explicit
  shape?: PanelShape;   // default: 'rect'
  label?: string;       // sets aria-label on the <section>
  children?: React.ReactNode;
}
```

### `PanelPair` (`ui/panel-pair.tsx`)
Stacks two related panels across a `12px` (`pair`) slanted gutter (`slant-bottom` over `slant-top` with `16px` diagonal rise). Accepts either `top` + `bottom` panel prop objects or two child nodes/panels.

```tsx
export interface PanelPairProps extends React.HTMLAttributes<HTMLDivElement> {
  top?: Omit<PanelProps, 'shape'>;
  bottom?: Omit<PanelProps, 'shape'>;
  topCut?: string | false;
  bottomCut?: string | false;
  topLabel?: string;
  bottomLabel?: string;
  children?: React.ReactNode;
}
```

---

## 4. Control Components

### `SegmentedControl` (`ui/segmented-control.tsx`)
Exposure-sheet selector with `mix-blend-mode: difference` active cell indicator that steps in 3 poses (`steps(3, end)`).

```tsx
export interface SegmentedOption<T extends string | number = string | number> {
  value: T;
  label: string;
  unit?: string;
}

export interface SegmentedControlProps<T extends string | number = string | number> {
  options: Array<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string; // default: 'Options'
  idPrefix?: string;  // default: 'seg' -> renders button id="${idPrefix}-${opt.value}"
  className?: string;
}
```

### `Button` (`ui/button.tsx`)
Ink-framed button with hard offset shadow on hover (`3px 3px 0 var(--f-rule)`).

```tsx
export type ButtonVariant = 'primary' | 'secondary' | 'marker';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant; // default: 'secondary'
  size?: ButtonSize;       // default: 'md'
}
```

### `Input` (`ui/input.tsx`)
Accessible field with linked `<label>`, optional hint, and marker-flagged `role="alert"` error message.

```tsx
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
  fieldClassName?: string;
}
```

### `Badge` (`ui/badge.tsx`) & `Tag` (`ui/tag.tsx`)
Both render `--f-marker` yellow backgrounds with `--f-marker-ink` text.
- `Badge`: bordered (`2px solid var(--f-rule)`), supports `pop?: boolean` and `burst?: boolean` (14-ray SVG impact burst).
- `Tag`: flat inline marker strip (`<Tag>Production</Tag>`).

---

## 5. Data & Visualization Components

### `Metric` & `Delta` (`ui/metric.tsx`)
Headline KPI numeral (`tabular-nums`) with stepped count-up (`useCountUp`), screen-reader live region, directional marker delta (`▲` / `▼` / `=`), and optional `spark` slot.

```tsx
export interface MetricProps {
  label: string;
  value: number;
  format?: (value: number) => string; // default: fmtMoney
  delta?: number;
  deltaKind?: 'pct' | 'pp';           // default: 'pct'
  comparisonLabel?: string;
  range?: number | string;
  note?: string;
  big?: boolean;                      // fluid clamp(36px, 6cqi, 56px) for C-01 hero metrics
  headingLevel?: 'h2' | 'h3' | 'h4' | 'div' | 'p'; // default: 'h2'
  motion?: MotionMode;
  spark?: React.ReactNode;            // pass <ToneSpark ... />
  className?: string;
}
```
Helper formatters exported from `metric.tsx`: `fmtMoney(v)`, `fmtPct(v)`, `fmtPPAbs(v)`.

### `ToneAreaChart` (`ui/tone-area-chart.tsx`)
Primary time-series chart with 4-band 45° SVG screentone area fill, dashed comparison series, speech-balloon peak callout, keyboard crosshair navigation (`ArrowLeft`, `ArrowRight`, `Escape`), and collapsible `<details className="f12-tbl">` data table.

```tsx
export interface ToneAreaDatum {
  label: string;
  longLabel?: string;
  value: number;
  compareValue?: number;
}

export interface ToneAreaChartProps {
  data: ToneAreaDatum[];
  seriesLabel?: string;       // default: 'Value'
  labelColumnHeader?: string; // default: 'Label'
  compareLabel?: string;
  formatValue?: (v: number) => string; // default: plain number; export fmtCurrency for USD
  formatShort?: (v: number) => string; // default: plain k/M; export fmtCurrencyShort for USD
  annotation?: { index: number; text: string } | null; // undefined = auto-detect peak
  motion?: MotionMode;
  height?: number;       // default: 260
  tableSummary?: string; // default: 'Show data table'
  showTable?: boolean;   // default: true (keep true for accessibility!)
  ariaLabel?: string;
  className?: string;
}
```

### `ToneBarList` (`ui/tone-bar-list.tsx`)
Interactive ranked comparison list with screentone fill bars. Selecting a row (`aria-pressed="true"`) inverts the row to `--f-ink` and switches its bar fill to `--f-marker`.

```tsx
export interface ToneBarItem {
  id: string;
  name: string;
  value: number;
  formattedValue?: string;
  share?: number; // 0..1 ratio
  badge?: string; // renders <Badge pop={changed} burst>
}

export interface ToneBarListProps {
  title?: string;
  subtitle?: string;
  items: ToneBarItem[];
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  motion?: MotionMode;
  changed?: boolean;
  idPrefix?: string; // renders button id="int-${idPrefix}-${item.id}"
  className?: string;
}
```

### `ToneSpark` (`ui/tone-spark.tsx`) & `Balloon` (`ui/balloon.tsx`)
- `ToneSpark`: compact daily screentone bar chart (`values: number[]`, `label: string`, `rangeKey?: string | number`, `motion?: MotionMode`, `height?: number`).
- `Balloon`: standalone speech-balloon callout (`tailOffset?: number` from `-36` to `+36`, `showDot?: boolean`).

---

## 6. Primitive Adapters (`Dialog`, `Select`, `Tooltip`, `DropdownMenu`, `Table`)

FRAME/12 wraps the five complex interactive primitives in accessible adapters that install into `components/frame12/*.tsx` (never colliding with stock `components/ui/*.tsx` shadcn primitives) while enforcing FRAME/12 ink rules, tokens, and WAI-ARIA semantics:

1. **`Dialog` (`ui/dialog.tsx`):**
   - Exports: `Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `DialogClose`.
   - Uses native `<dialog>` with `.showModal()`, `DialogTrigger asChild` support, conditional `aria-describedby` (omitted when `DialogDescription` is absent), single-fire `onOpenChange(false)`, `Escape` isolation with nested `Select`/`DropdownMenu` popups, pointer light-dismiss, `overscroll-behavior: contain`, screentone backdrop, and optional `cut="C-0X"` on `DialogContent`.
2. **`Select` (`ui/select.tsx`):**
   - Exports: `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`, `SelectGroup`, `SelectLabel`, `SelectSeparator`.
   - Built on `@radix-ui/react-select` with full WAI-ARIA listbox keyboard navigation (`ArrowUp`/`ArrowDown`/`Home`/`End`/`Enter`/`Space`/`Escape`, typeahead, focus restoration), portal theme inheritance (`.f12-dash` / `dialog[open]`), and native `<form>` `FormData` participation via `name` and `required`. Pass `label="Channel"` and `id="channel-select"` directly to `<Select>` for an automatically linked `<label>`.
3. **`Tooltip` (`ui/tooltip.tsx`):**
   - Exports: `TooltipProvider`, `Tooltip`, `TooltipTrigger`, `TooltipContent`.
   - Opens on hover or keyboard focus, dismisses on `Escape`, links trigger to content via `aria-describedby`, and merges caller event handlers, `ref`, `className`, and `aria-describedby` when `asChild` is used.
4. **`DropdownMenu` (`ui/dropdown-menu.tsx`):**
   - Exports: `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuLabel`, `DropdownMenuSeparator`, `DropdownMenuItem`, `DropdownMenuGroup`.
   - Built on `@radix-ui/react-dropdown-menu` with full WAI-ARIA menu keyboard navigation (`ArrowDown`/`ArrowUp`/`Home`/`End`/`Enter`/`Space`/`Escape`), focus restoration, and portal theme inheritance.
5. **`Table` (`ui/table.tsx`):**
   - Exports: `Table`, `TableHeader`, `TableBody`, `TableFooter`, `TableRow`, `TableHead`, `TableCell`, `TableCaption`.
   - Monospace uppercase headers with `2.5px` bottom ink rule, `scope="col"` by default on `TableHead`, and `tabular-nums` alignment.
