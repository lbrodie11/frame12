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
Ink-framed `<section>` drawn with a measured SVG `<polygon>` (`2.5px` mitered stroke) and a top-edge cut label in `'expressive'` mode, or a crisp `1px solid var(--f-rule)` unnumbered exposure-sheet frame in `'quiet'` mode.

```tsx
export type PanelShape = 'rect' | 'slant-bottom' | 'slant-top';
export type PanelVariant = 'expressive' | 'quiet';

export interface PanelProps extends React.HTMLAttributes<HTMLElement> {
  cut?: string | false;   // undefined = automatic inside <Sheet autoCut> for expressive, unnumbered for quiet; false = unnumbered; string = explicit
  shape?: PanelShape;     // default: 'rect'
  variant?: PanelVariant; // default: 'expressive'
  label?: string;         // sets aria-label on the <section>
  children?: React.ReactNode;
}
```

### `PanelPair` (`ui/panel-pair.tsx`)
Stacks two related panels across a `12px` (`pair`) gutter (`slant-bottom` over `slant-top` with `16px` diagonal rise in `'expressive'` mode, or `rect` over `rect` in `'quiet'` mode). Accepts either `top` + `bottom` panel prop objects or two child nodes/panels.

```tsx
export interface PanelPairProps extends React.HTMLAttributes<HTMLDivElement> {
  top?: Omit<PanelProps, 'shape'>;
  bottom?: Omit<PanelProps, 'shape'>;
  topCut?: string | false;
  bottomCut?: string | false;
  topLabel?: string;
  bottomLabel?: string;
  variant?: PanelVariant; // default: 'expressive'
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

### `Field` (`ui/field.tsx`)
Reusable form field coordinator linking `<label>`, optional `hint`, and `role="alert"` `error` message to a child control (`Input`, `Textarea`, `Checkbox`, `Switch`, `Select`, or `RadioGroup`) via `FieldContext` so wrapping a control inside `<Field>` never renders duplicate labels, hints, or errors. When wrapping `<RadioGroup>`, `Field` delegates the group label to `RadioGroup`'s `<legend>` inside `<fieldset>`.

```tsx
export type FieldDensity = 'comfortable' | 'compact';

export interface FieldContextValue {
  id: string;
  label?: React.ReactNode;
  labelId?: string;
  hintId?: string;
  errorId?: string;
  describedBy?: string;
  invalid?: boolean;
  disabled?: boolean;
  required?: boolean;
  density: FieldDensity;
}

export interface FieldProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  id?: string;
  htmlFor?: string;
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  density?: FieldDensity; // default: 'comfortable'
  required?: boolean;
  disabled?: boolean;
  children?: React.ReactNode | ((field: FieldContextValue) => React.ReactNode);
}
```

### `Input` (`ui/input.tsx`)
Accessible field with linked `<label>`, optional hint, and marker-flagged `role="alert"` error message. Can be used standalone (`<Input label="Name" />`) or inside `<Field label="Name"><Input /></Field>`.

```tsx
export type InputDensity = 'comfortable' | 'compact';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  density?: InputDensity; // default: 'comfortable'
  fieldClassName?: string;
}
```

### `Textarea` (`ui/textarea.tsx`)
Multi-line exposure-sheet text input (`<textarea>`) matching `Input` ink borders, focus ring, `density`, and `FieldContext` / `aria-describedby` semantics.

```tsx
export type TextareaDensity = 'comfortable' | 'compact';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  density?: TextareaDensity; // default: 'comfortable'
  fieldClassName?: string;
}
```

### `Checkbox` (`ui/checkbox.tsx`)
Native `<input type="checkbox">` with `2.5px` (`1.5px` compact) ink frame, geometric SVG check mark, and SSR-safe `indeterminate` mixed mark (`aria-checked="mixed"`, `.f12-checkbox-indeterminate`, and DOM `node.indeterminate`).

```tsx
export type CheckboxDensity = 'comfortable' | 'compact';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  indeterminate?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  density?: CheckboxDensity; // default: 'comfortable'
  fieldClassName?: string;
}
```

### `RadioGroup` & `RadioGroupItem` (`ui/radio-group.tsx`)
Native `<fieldset role="radiogroup">` + `<legend>` + `<input type="radio">` options with circular `24×24px` outer ink frame and solid inner ink dot when selected. Preserves native browser arrow-key navigation, single Tab stop, `FormData`, and `form.reset()`.

```tsx
export type RadioGroupOrientation = 'vertical' | 'horizontal';
export type RadioGroupDensity = 'comfortable' | 'compact';

export interface RadioOption {
  value: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  disabled?: boolean;
}

export interface RadioGroupProps
  extends Omit<React.FieldsetHTMLAttributes<HTMLFieldSetElement>, 'onChange'> {
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  options?: RadioOption[];
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  density?: RadioGroupDensity;         // default: 'comfortable'
  orientation?: RadioGroupOrientation; // default: 'vertical'
  disabled?: boolean;
  required?: boolean;
}

export interface RadioGroupItemProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value'> {
  value: string;
  label?: React.ReactNode;
  hint?: React.ReactNode;
  density?: RadioGroupDensity;
}
```

### `Switch` (`ui/switch.tsx`)
Exposure-sheet rectangular toggle built on native `<input type="checkbox" role="switch">` with configurable `onLabel` (default `'ON'`) and `offLabel` (default `'OFF'`) track glyphs (`aria-hidden="true"`), logical `inset-inline-start` RTL thumb travel, stepped 3-pose motion (`steps(3, end)`), and full native `<form>` (`FormData`, `form.reset()`, `required`, `form=`) and `react-hook-form` `register()` compatibility.

```tsx
export type SwitchDensity = 'comfortable' | 'compact';

export interface SwitchProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'role'> {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  onLabel?: React.ReactNode;  // default: 'ON'
  offLabel?: React.ReactNode; // default: 'OFF'
  onCheckedChange?: (checked: boolean) => void;
  density?: SwitchDensity; // default: 'comfortable'
  fieldClassName?: string;
}
```

### `Tabs` (`ui/tabs.tsx`)
WAI-ARIA tabbed interface (`role="tablist"`, `role="tab"`, `role="tabpanel"`) with roving `tabIndex`, `ArrowLeft`/`ArrowRight`/`ArrowUp`/`ArrowDown`/`Home`/`End` navigation (including `dir="rtl"` horizontal flip and modified-key guard), and `activationMode?: 'automatic' | 'manual'` (default `'automatic'`).
- **When to use `Tabs` vs `SegmentedControl`:** Use `Tabs` to switch between distinct content panels (`role="tabpanel"`). Use `SegmentedControl` (`role="group"` + `aria-pressed`) to switch the view, mode, or time window of the same content.
- **Cut numbers inside `TabsContent`:** Any `<Panel>` or `<PanelPair>` placed inside `<TabsContent>` defaults to `variant="quiet"` (unnumbered `1px` exposure-sheet frame) and `.f12-tabs-content` suppresses `autoCut` counter increments so switching tabs never renumbers `C-01..C-0n` panels on the surrounding `<Sheet autoCut>`.

```tsx
export type TabsOrientation = 'horizontal' | 'vertical';
export type TabsActivationMode = 'automatic' | 'manual';
export type TabsDensity = 'comfortable' | 'compact';

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  orientation?: TabsOrientation;       // default: 'horizontal'
  activationMode?: TabsActivationMode; // default: 'automatic'
  density?: TabsDensity;               // default: 'comfortable'
  idPrefix?: string;
}

export interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> {
  ariaLabel?: string;
}

export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  forceMount?: boolean;
}
```

### `Badge` (`ui/badge.tsx`) & `Tag` (`ui/tag.tsx`)
Both render `--f-marker` yellow backgrounds with `--f-marker-ink` text by default, and support non-color semantic states (`status?: 'neutral' | 'info' | 'success' | 'warning' | 'danger'`) with orthographic glyph prefixes (`[i]`, `[+]`, `[!]`, `[×]`, or custom/suppressed via `glyph?: string | false`) and screen-reader status announcements (`.f12-sr-only`, customizable or suppressible via `srLabel?: string | false`).
- `Badge`: bordered (`2px solid var(--f-rule)`), supports `pop?: boolean`, `burst?: boolean` (14-ray SVG impact burst; defaults to `true` when `status` is omitted and `false` when `status` is set), `status?: BadgeStatus`, `glyph?: string | false`, and `srLabel?: string | false`.
- `Tag`: flat inline marker strip (`<Tag>Production</Tag>` or `<Tag status="warning">Degraded</Tag>`).

---

## 5. Data & Visualization Components

### `Metric` & `Delta` (`ui/metric.tsx`)
Headline KPI numeral (`tabular-nums`) with stepped count-up (`useCountUp`), screen-reader live region, directional marker delta (`▲` / `▼` / `=`), and optional `spark` slot. In `variant="quiet"`, renders `22px` tabular monospace numerals and defaults `motion` to `'cut'`.

```tsx
export type MetricVariant = 'expressive' | 'quiet';

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
  variant?: MetricVariant;            // default: 'expressive'
  headingLevel?: 'h2' | 'h3' | 'h4' | 'div' | 'p'; // default: 'h2'
  motion?: MotionMode;
  spark?: React.ReactNode;            // pass <ToneSpark ... />
  className?: string;
}
```
Helper formatters exported from `metric.tsx`: `fmtMoney(v)`, `fmtPct(v)`, `fmtPPAbs(v)`.

### `ToneAreaChart` (`ui/tone-area-chart.tsx`)
Primary time-series chart with 4-band 45° SVG screentone area fill, dashed comparison series with hollow diamond registration markers (`.f12-compare-pt`) at labeled x-axis ticks and a diamond crosshair dot (`.f12-cross-dot2`), speech-balloon peak callout, keyboard crosshair navigation (`ArrowLeft`, `ArrowRight`, `Escape`), and collapsible `<details className="f12-tbl">` data table.

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
Interactive ranked comparison list with screentone fill bars (`pattern?: 'dots' | 'hatch' | 'dense'`). Selecting a row (`aria-pressed="true"`) inverts the row to `--f-ink` and switches its bar fill to `--f-marker`.

```tsx
export type ToneBarPattern = 'dots' | 'hatch' | 'dense';
export type ToneBarDensity = 'comfortable' | 'compact';

export interface ToneBarItem {
  id: string;
  name: string;
  value: number;
  formattedValue?: string;
  share?: number;          // 0..1 ratio
  badge?: string;          // renders <Badge pop={changed} burst>
  pattern?: ToneBarPattern; // default: 'dots'
}

export interface ToneBarListProps {
  title?: string;
  subtitle?: string;
  items: ToneBarItem[];
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  motion?: MotionMode;
  changed?: boolean;
  density?: ToneBarDensity; // default: 'comfortable'
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
   - Exports: `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`, `SelectGroup`, `SelectLabel`, `SelectSeparator`, `type SelectDensity`.
   - Built on `@radix-ui/react-select` with full WAI-ARIA listbox keyboard navigation (`ArrowUp`/`ArrowDown`/`Home`/`End`/`Enter`/`Space`/`Escape`, typeahead, focus restoration), portal theme inheritance (`.f12-dash` / `dialog[open]`), `density?: 'comfortable' | 'compact'`, and native `<form>` `FormData` participation via `name` and `required`. Pass `label="Channel"` and `id="channel-select"` directly to `<Select>` for an automatically linked `<label>`.
3. **`Tooltip` (`ui/tooltip.tsx`):**
   - Exports: `TooltipProvider`, `Tooltip`, `TooltipTrigger`, `TooltipContent`.
   - Opens on hover or keyboard focus, dismisses on `Escape`, links trigger to content via `aria-describedby`, and merges caller event handlers, `ref`, `className`, and `aria-describedby` when `asChild` is used.
4. **`DropdownMenu` (`ui/dropdown-menu.tsx`):**
   - Exports: `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuLabel`, `DropdownMenuSeparator`, `DropdownMenuItem`, `DropdownMenuGroup`.
   - Built on `@radix-ui/react-dropdown-menu` with full WAI-ARIA menu keyboard navigation (`ArrowDown`/`ArrowUp`/`Home`/`End`/`Enter`/`Space`/`Escape`), focus restoration, and portal theme inheritance.
5. **`Table` (`ui/table.tsx`):**
   - Exports: `Table`, `TableHeader`, `TableBody`, `TableFooter`, `TableRow`, `TableHead`, `TableCell`, `TableCaption`, `type TableDensity`.
   - Monospace uppercase headers with `2.5px` bottom ink rule, `scope="col"` by default on `TableHead`, `density?: 'comfortable' | 'compact'` (`<Table density="compact">`), and `tabular-nums` alignment.
