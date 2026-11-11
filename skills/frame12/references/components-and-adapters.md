# FRAME/12 Components, Hooks & Primitive Adapters

Complete API reference for `@/components/frame12` (including `cut-morph`), `@/hooks/use-on-twos` and `@/hooks/use-tempo`.

---

## 1. Design Tokens (`@frame12/tokens` & `styles/frame12.css`)

Canonical tokens live in `packages/tokens/src/tokens.source.json` and generate `@frame12/tokens` (`dist/tokens.css`, `dist/tokens.json`, `dist/index.js`, `dist/index.d.ts`), `registry/styles/frame12-tokens.css` (`@frame12/frame12-tokens`), and the `/* @tokens:start */` … `/* @tokens:end */` region of `registry/styles/frame12.css`.

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

/* Stroke, Motion & Shadow Tokens */
--f-stroke: 2.5px;       /* Expressive panel & control stroke width */
--f-pose: 83.33ms;       /* Reference token: single pose duration held on twos (12fps) */
--f-fps: 12;             /* Reference token: stepped frame rate on twos */
--f-shadow-sheet         /* Storyboard sheet elevation shadow */
--f-shadow-peg           /* Registration peg punch-hole inset shadow */

/* Typography Tokens */
--font-f-display /* Display headlines & metric numerals */
--font-f-body    /* Body copy, table cells, descriptions */
--font-f-mono    /* Cut labels, eyebrows, table headers, controls */
```

For non-React consumers (static HTML pages, SVG cards, emails, VS Code webviews), install `@frame12/frame12-tokens` via `npx shadcn@latest add @frame12/frame12-tokens` or import `tokens` and `cssText` from `@frame12/tokens` (`packages/tokens/`, prepared for npm publication under `@frame12`):

```ts
import { tokens, cssText } from '@frame12/tokens';
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
  Tracks `(prefers-reduced-motion: reduce)`. Lives in `hooks/use-tempo.ts`; `use-on-twos` re-exports it.
- `useOnTwos` (and so `useCountUp`) resolves `motion` against the nearest `TempoProvider` and the OS (see below).

---

## 2b. Tempo: one motion preference (`hooks/use-tempo.ts`, `ui/tempo.tsx`, `ui/tempo-control.tsx`)

Tempo is the viewer's single animation preference, followed by every FRAME/12 animation. It is an accessibility feature first and a style choice second.

| Tempo | Label | Meaning |
|---|---|---|
| `auto` (default) | AUTO | each component's own intended motion |
| `twos` | 12 | on twos: held poses, 12 per second |
| `ones` | 60 | smooth, continuous motion (follows the display's refresh rate; "60" names the style, not a guarantee) |
| `still` | 0 | no non-essential motion |

```tsx
import {
  type Tempo,          // 'auto' | 'twos' | 'ones' | 'still'
  TEMPOS,              // ['auto', 'twos', 'ones', 'still']
  resolveMotion,       // ({ base, tempo, ancestorStill, reduced }) => MotionMode
  useTempo,            // () => { tempo, setTempo, ancestorStill, inProvider, reduced, effectiveTempo }
  useResolvedMotion,   // (base?: MotionMode) => MotionMode
  useReducedMotion,
} from '@/hooks/use-tempo';
import { TempoProvider, TempoControl } from '@/components/frame12';
```

**Precedence** (`resolveMotion`, in order; `base` is the component's `motion` prop, otherwise its own default, e.g. quiet `Metric` → `'cut'`):

| # | Condition | Result |
|---|---|---|
| 1 | OS `prefers-reduced-motion: reduce` | `'cut'` |
| 2 | `still` here or in any ancestor provider | `'cut'` |
| 3 | `base === 'cut'` (explicit prop, variant or default) | `'cut'`: tempo never turns motion on |
| 4 | `twos` / `ones` | `'stepped'` / `'smooth'` |
| 5 | `auto` (also any invalid value, e.g. a stored `"fast"`) | `base` |

**Never stepped, at any tempo:** pointer tracking, drag, scroll, typing and focus movement stay immediate. Tempo only applies to animations of discrete state changes.

```tsx
export interface TempoProviderProps {
  value?: Tempo;                         // controlled; wins over defaultValue (dev warning if both)
  onChange?: (tempo: Tempo) => void;
  defaultValue?: Tempo;                  // uncontrolled start; server render uses it (or 'auto')
  storageKey?: string;                   // uncontrolled: persisted in localStorage, synced across tabs
  asChild?: boolean;                     // put data-f12-tempo + class on the single child element
  children?: React.ReactNode;
}

export interface TempoControlProps {
  legend?: string;                       // default: 'Animation tempo' (visually hidden)
  showLegend?: boolean;                  // default: false
  idPrefix?: string;                     // radio ids: `${idPrefix}-auto`, `-twos`, `-ones`, `-still`
  className?: string;
}
```

- `TempoProvider` renders a layout-neutral `<div style="display: contents" data-f12-tempo>` (or decorates its child with `asChild`). When the tempo forces a mode it also carries `f12-m-stepped` / `f12-m-smooth` / `f12-m-cut`, so CSS-only consumers with no other motion-aware ancestor follow it. Nested providers set `twos`/`ones`/`auto` for their subtree; `still` from any ancestor cannot be undone below. Without `matchMedia`, the OS preference reads as "no preference".
- `TempoControl` is a `<fieldset>` + `<legend>` with four native radios (accessible names such as "12, on twos"): arrow keys move and select, Tab enters and leaves as one stop. Under OS reduced motion it shows `0 · your system setting` and keeps the stored choice selectable ("applies when your system allows motion"); it never claims to override the OS. Without a provider it renders disabled with an explanation.
- Components that emit an `f12-m-*` class (`Sheet`, your own wrappers) must emit the **resolved** mode: `` `f12-m-${useResolvedMotion(base)}` ``. A hand-written `className="f12-m-stepped"` does not follow the tempo.
- First paint: set `<html data-f12-tempo>` from storage in an inline script before hydration; `frame12.css` then turns off CSS motion for a stored `still` before React runs (safety direction only). `TempoProvider` with a `storageKey` keeps that attribute current.
- Not covered: `@frame12/static` documents (React context cannot reach a standalone HTML document).

```tsx
<TempoProvider storageKey="my-app-tempo">
  <header><TempoControl /></header>
  <Sheet autoCut>{/* every Metric, chart, Sheet and Skeleton follows the tempo */}</Sheet>
</TempoProvider>
```

---

## 2c. Ink: line art on twos (`ui/ink.tsx`, `ui/ink-reveal.tsx`, `ui/ink-sequence.tsx`)

Three opt-in registry items (`@frame12/ink-stroke`, `@frame12/ink-reveal`, `@frame12/ink-sequence`; not in the full kit or the barrel, import them from their module paths). They draw SVG line art **on twos with CSS only**: no `requestAnimationFrame`, no timers, no `getTotalLength()`. Every stroke is a `<path pathLength="1">`; drawing animates `stroke-dashoffset` 1 → 0 with `steps(poses, jump-start)` over `poses × var(--f-pose)` (`smooth` tempo: `linear`, same duration; `cut`: no animation). At rest no dash properties apply, so a finished stroke is pixel-identical to a plain path.

```tsx
export type InkWeight = 'pencil' | 'detail' | 'frame';

export interface InkStrokeProps
  extends Omit<React.SVGProps<SVGPathElement>, 'ref' | 'pathLength' | 'stroke' | 'fill' | 'd'> {
  d: string;
  weight?: InkWeight;      // default: 'detail' ('pencil' --f-stroke-pencil/--f-ink-2, 'frame' --f-stroke/--f-rule)
  poses?: number;          // 1–24; default: the beat's poses, or 6
  at?: number;             // pose offset inside a beat
  play?: boolean;          // default: false; draws when it changes to true AFTER mount
  motion?: MotionMode;     // default: 'stepped' (resolved against the tempo)
  onEnd?: () => void;
}

export interface InkRevealProps {
  play?: boolean;          // frame 6 poses → cut 1 pose → content in one cut
  motion?: MotionMode;
  onEnd?: () => void;
  children?: React.ReactNode; // one Panel or PanelPair
}

export type InkSequenceState = 'rest' | 'playing' | 'scrubbing' | 'still';

export interface InkSequenceProps extends React.HTMLAttributes<HTMLDivElement> {
  beats: readonly number[];   // pose count per beat; beats chain by CSS animation-delay sums
  play?: boolean;             // default: false; false (Stop) returns to rest = finished
  scroll?: boolean;           // default: false; animation-timeline: view() where supported
  motion?: MotionMode;
  onEnd?: () => void;         // animationend of the last beat
  onStateChange?: (state: InkSequenceState) => void;
}

export interface InkBeatProps extends React.SVGProps<SVGGElement> {
  beat: number;               // index into the parent's beats
}

export interface InkLandProps extends React.SVGProps<SVGGElement> {
  reveal?: 'cut' | 'wipe';    // default: 'cut' (one pose); 'wipe' uncovers in reading order
  at?: number;
  poses?: number;
}
```

- **One play, one draw.** A play is consumed when it finishes or when motion resolves to `cut` mid-draw (still tempo, reduced motion); re-enabling motion never replays it. Only a new `false → true` change of `play` draws again. `InkReveal`'s `onEnd` fires once per reveal, also around a `PanelPair`.
- **Never on load.** `play` must change after mount through a user action (or `useChanged`). The `ink-autoplay` rule in `@frame12/lint` flags `play`, `play={true}` and values constant at mount (a `true` constant, an unchanging `useState(true)`, state set to `true` in a mount effect).
- **Finished at rest.** `rest` is the default, SSR and no-JS state. `still` tempo, OS reduced motion, print and forced colors always show the finished drawing.
- **Tokens only.** Strokes use `currentColor` from `--f-ink` / `--f-rule` (main line) and `--f-ink-2` (pencil, decorative, `aria-hidden`). Widths: `--f-stroke-pencil` (1px), `--f-stroke-detail` (1.5px), `--f-stroke` (2.5px). No opacity fades: every pose has the finished line's contrast.
- **Deterministic pencil.** `inkPencil(segments, seed?, wobble?)` is a pure function of geometry and a seed (mulberry32); no `Math.random`.
- **Scroll driver.** `scroll` attaches `animation-timeline: view()` (or a named timeline via `--f12-ink-timeline`) after mount, once the drawing has been out of view (an IntersectionObserver, not a scroll listener), where `@supports (animation-timeline: view())`; poses are quantized with `steps()`. Native scroll only: no scroll listeners, no `scroll-snap`.
- **When not to use ink:** never on data that updates, never more than one `InkSequence` per page, and `InkReveal` only on a panel's first user-triggered appearance.
- **Panel:** the measured frame polygon carries `pathLength="1"` (additive). The SSR `viewBox` polygon (`vector-effect: non-scaling-stroke`) is never dashed.

---

## 2d. CutMorph: state changes as film edits (`ui/cut-morph.tsx`)

Opt-in match cuts on the platform's same-document View Transitions. A **cut** changes the shot at once; a **match cut** keeps one subject's identity from one shot to the next. Install `@frame12/cut-morph` (it pulls `frame12-styles` and `use-tempo`). Nothing in FRAME/12 animates through it unless you call it.

- `useCutMorph(opts?)` → `cutMorph(update, { kind })`. `kind` defaults to `'match'` (calling the hook is the opt-in); `'cut'` updates at once with no View Transition and no `flushSync`. `update` must be **synchronous** (dev warning if it returns a promise). Every update runs **exactly once, in call order**, even when calls interrupt each other: calls made before the running edit has applied its update (two clicks in one frame, two calls from one effect) join it as one edit; later calls supersede it.
- Resolution comes from the **calling component's** tempo (`useResolvedMotion('stepped')`): reduced motion, `still` or a `still` ancestor → immediate update; 12 → `f12-vt-stepped` (250ms `steps(3, end)`, 3 held poses); 60 → `f12-vt-smooth` (260ms `cubic-bezier(0.2, 0.8, 0.2, 1)`). No View Transitions / no `view-transition-class` / SSR / hidden document → immediate update. A transition CutMorph does not own (`document.activeViewTransition`) → immediate update; it is **never** cancelled.
- `scope` (a ref): element-scoped transition where `Element.prototype.startViewTransition` exists (Chromium); elsewhere a document transition with the root excluded.
- The promise resolves once the edit is committed: when the transition finishes, or on the immediate paths after the calling component's next commit (superseded and skipped transitions resolve too). It rejects only with what `update` threw.
- Old/new images never crossfade: one hard swap at the second pose boundary (166.67ms). The root never animates; `::view-transition` has `pointer-events: none`, so clicks reach the updated DOM. A page scroll, resize, pointer press, wheel, touch-move or PageUp/PageDown during a document transition skips it (the DOM is already updated); scrolls the update itself causes do not. A transition CutMorph does not own (also on the `scope` element) is never cancelled.
- `flushSync` runs `update` on the transition path, so a suspending update shows its fallback at once: preload, or use React 19.3 `<ViewTransition>` with `withCutMorphMode`.
- **Focus is yours.** Move it in the same update (a layout effect), as `/motion/edit-room` does.

```tsx
export type CutMorphKind = 'match' | 'cut';
export type CutMorphMode = 'stepped' | 'smooth';
export interface UseCutMorphOptions {
  scope?: React.RefObject<HTMLElement | null>;
}
export interface CutMorphCallOptions {
  kind?: CutMorphKind;
}
export type CutMorph = (update: () => void, opts?: CutMorphCallOptions) => Promise<void>;
export interface CutMorphSupport {
  viewTransitions: boolean;
  elementScoped: boolean;
  activeViewTransition: boolean;
}
export function useCutMorph(opts?: UseCutMorphOptions): CutMorph;
export function withCutMorphMode<T>(mode: 'stepped' | 'smooth', fn: () => T): T;
export function isCutMorphName(name: unknown): name is string;
export function getCutMorphSupport(): CutMorphSupport;

export interface CutMorphNameProps {
  name: string;                       // ^[a-z][a-z0-9-]{0,63}$ from a stable data id; not none, auto, match-element, root, default or a CSS-wide keyword
  className?: 'f12-match' | string;   // the view-transition-class; default 'f12-match'
  children: React.ReactElement;       // ONE host element (or a component forwarding style + ref)
}
```

`CutMorphName` sets `view-transition-name` and `view-transition-class` on its single host child. Its `className` prop is the **view-transition-class**, not the DOM class: your own classes are added to `f12-match` (never instead of it, or the browser's crossfade would play); pass `f12-cut` for a subject that changes at once. It keeps the child's own `style`, `className`, `ref` and handlers. Fragment, text or array children and invalid names are a development error and render unchanged in production. A duplicate **live** name warns in development with both owners' stacks; in production the browser skips the transition (the update still lands). Names are removed on unmount.

```tsx
const cutMorph = useCutMorph();
<SegmentedControl options={STAGES} value={stage} onChange={(v) => cutMorph(() => setStage(v))} />
<ul>
  {shots.filter(byStage(stage)).map((s) => (
    <CutMorphName key={s.id} name={`shot-${s.id}`}>
      <li>{s.title}</li>
    </CutMorphName>
  ))}
</ul>
```

React 19.3 `<ViewTransition>` plays the same grammar: `<ViewTransition name={`shot-${id}`} default="f12-match">`, started with `withCutMorphMode(mode, () => startTransition(() => setX(…)))` where `mode = useResolvedMotion('stepped')` (update outside a Transition when it is `'cut'`). Never use CutMorph for pointer drag, typing, focus movement, playback or continuous scrubbing (ExposureScrubber's included), and don't name subjects inside scroll or `overflow: hidden` containers (Firefox and WebKit don't clip the snapshots). Spike, decisions and per-engine support: `docs/architecture/cut-morph.md`.

## 3. Layout Components

### `Sheet` (`ui/sheet.tsx`)
Top-level storyboard container with registration pegs and `32px` scene-change vertical flow.

```tsx
export interface SheetProps extends React.HTMLAttributes<HTMLDivElement> {
  pegs?: boolean;              // default: true
  autoCut?: boolean;           // default: false — enables CSS counter cut numbering (C-01, C-02…)
  motion?: MotionMode;         // default: 'stepped'; resolved against the tempo, emitted as f12-m-<resolved>
  theme?: 'light' | 'dark';    // optional explicit theme override
  sheetClassName?: string;
  children?: React.ReactNode;
}
```

### `Scene` (`ui/scene.tsx`)
Grid container enforcing the three legal gutter widths (`12px` `pair`, `20px` `scene`, `32px` `change`). Supports preset layouts (`split`, `stack`, `equal`, `three`) as well as named CSS Grid areas (`areas: string[]` with column count derived from the token count of the first `areas` row, activated at or above `breakpoint`, default `'860px'`, and collapsing inside `.f12-dash` containers `<= 760px`). Below `breakpoint` (or inside a narrow `.f12-dash`), named-area scenes stack into a single column in DOM/reading/cut order with zero `grid-column` specificity traps. Custom `breakpoint` values emit a scoped `<style>` `@media` rule so SSR, no-JS, and first paint match with zero layout shift. Also exports `resolveAreaProps(area, style)` shared by `SceneArea`, `Panel`, and `PanelPair`.

```tsx
export type SceneGutter = 'pair' | 'scene' | 'change'; // 12px | 20px | 32px
export type SceneLayout = 'split' | 'stack' | 'equal' | 'three' | 'areas';
// 'split' = 2fr 1fr, 'stack' = 1fr, 'equal' = 1fr 1fr, 'three' = 1fr 1fr 1fr, 'areas' = named grid-template-areas

export interface SceneProps extends React.HTMLAttributes<HTMLDivElement> {
  gutter?: SceneGutter; // default: 'scene' (20px)
  layout?: SceneLayout; // default: 'split' (2fr 1fr), or 'areas' when areas is provided
  areas?: string[];
  columns?: number;             // derived from first areas row token count when areas is given (fallback: 12)
  breakpoint?: number | string; // default: '860px'
  children?: React.ReactNode;
}

export interface SceneAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  area: string;
  children?: React.ReactNode;
}
```

### `Panel` (`ui/panel.tsx`)
Ink-framed `<section>` drawn with a measured SVG `<polygon>` (`2.5px` mitered stroke) and a top-edge cut label in `'expressive'` mode, or a crisp `1px solid var(--f-rule)` unnumbered exposure-sheet frame in `'quiet'` mode. Accepts `area?: string` to place the panel into a named grid area inside `<Scene areas={...}>`.

```tsx
export type PanelShape = 'rect' | 'slant-bottom' | 'slant-top';
export type PanelVariant = 'expressive' | 'quiet';

export interface PanelProps extends React.HTMLAttributes<HTMLElement> {
  cut?: string | false;   // undefined = automatic inside <Sheet autoCut> for expressive, unnumbered for quiet; false = unnumbered; string = explicit
  shape?: PanelShape;     // default: 'rect'
  variant?: PanelVariant; // default: 'expressive'
  label?: string;         // sets aria-label on the <section>
  area?: string;          // named CSS Grid area when placed inside <Scene areas={...}>
  children?: React.ReactNode;
}
```

### `PanelPair` (`ui/panel-pair.tsx`)
Stacks two related panels across a `12px` (`pair`) gutter (`slant-bottom` over `slant-top` with `16px` diagonal rise in `'expressive'` mode, or `rect` over `rect` in `'quiet'` mode). Accepts either `top` + `bottom` panel prop objects or two child nodes/panels, plus optional `area?: string` for named-area scenes.

```tsx
export interface PanelPairProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: PanelVariant; // default: 'expressive'
  area?: string;
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

### `Field` (`ui/field.tsx`)
Reusable form field coordinator linking `<label>`, optional `hint`, and `role="alert"` `error` message to a child control (`Input`, `Textarea`, `Checkbox`, `Switch`, `Select`, or `RadioGroup`) via `FieldContext` so wrapping a control inside `<Field>` never renders duplicate labels, hints, or errors. For single `Input`/`Textarea`/`Select` controls, `<Field label="...">` takes precedence over a child's `label` prop. For `Checkbox` or `Switch` children that pass their own `label` (or when multiple controls are placed inside `<Field>`), `<Field>` renders as `role="group"` with `aria-labelledby` while each option keeps its own `<label htmlFor>`. When wrapping `<RadioGroup>`, `Field` delegates the group label to `RadioGroup`'s `<legend>` inside `<fieldset>`. Do not nest a `<Field>` inside another `<Field>`.

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

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
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
Native `<input type="checkbox">` with `2.5px` (`1.5px` compact) ink frame, geometric SVG check mark, and SSR-safe `indeterminate` mixed mark (`.f12-checkbox-indeterminate`, `data-indeterminate="true"`, and DOM `node.indeterminate` synchronized across user activation, controlled updates, `readOnly`, and `form.reset()`).

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
Native `<fieldset role="radiogroup">` + `<legend>` + `<input type="radio">` options with circular `24×24px` outer ink frame and solid inner ink dot when selected. Preserves native browser arrow-key navigation, single Tab stop, `FormData`, and `form.reset()`. For `react-hook-form`, pass `{...register('field')}` to each `<RadioGroupItem>` (item-level `name` wins when `RadioGroup` omits `name`), or use `<Controller>` when passing the `options` array to `<RadioGroup>`.

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
WAI-ARIA tabbed interface (`role="tablist"`, `role="tab"`, `role="tabpanel"`) with roving `tabIndex`, `ArrowLeft`/`ArrowRight`/`ArrowUp`/`ArrowDown`/`Home`/`End` navigation (including `dir="rtl"` horizontal flip and modified-key guard), and `activationMode?: 'automatic' | 'manual'` (default `'automatic'`). Always pass `defaultValue` (or controlled `value`) when wrapping `TabsTrigger` in custom components so the initial panel is visible in server-rendered HTML before hydration.
- **When to use `Tabs` vs `SegmentedControl`:** Use `Tabs` to switch between distinct content panels (`role="tabpanel"`). Use `SegmentedControl` (`role="group"` + `aria-pressed`) to switch the view, mode, or time window of the same content.
- **Cut numbers inside `TabsContent`:** Any `<Panel>` or `<PanelPair>` placed inside `<TabsContent>` defaults to `variant="quiet"` (unnumbered `1px` exposure-sheet frame) and `.f12-tabs-content` suppresses `autoCut` counter increments so switching tabs never renumbers `C-01..C-0n` panels on the surrounding `<Sheet autoCut>`. If you explicitly opt into `<Panel variant="expressive" cut="C-02">` inside a tab on a manually numbered sheet, cuts remain file-wide sequential (`C-01`, `C-02`, `C-03`, ... without duplicates across tabs).

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

### `Badge` (`ui/badge.tsx`) & `Tag` / `Stamp` (`ui/tag.tsx`)
Both render `--f-marker` yellow backgrounds with `--f-marker-ink` text by default, and support non-color semantic states (`status?: 'neutral' | 'info' | 'success' | 'warning' | 'danger'`) with orthographic glyph prefixes (`[i]`, `[+]`, `[!]`, `[×]`, or custom/suppressed via `glyph?: string | false`) and screen-reader status announcements (`.f12-sr-only`, customizable or suppressible via `srLabel?: string | false`).
- `Badge`: bordered (`2px solid var(--f-rule)`), supports `pop?: boolean`, `burst?: boolean` (14-ray SVG impact burst; defaults to `true` when `status` is omitted and `false` when `status` is set), `status?: BadgeStatus`, `glyph?: string | false`, and `srLabel?: string | false`.
- `Tag`: flat inline marker strip (`<Tag>Production</Tag>` or `<Tag status="warning">Degraded</Tag>`), or rotated ink stamp (`<Tag variant="stamp">removed</Tag>` / `<Stamp>bot</Stamp>`) with `-3deg` rotation, `--font-f-display`, uppercase text, and `2px solid var(--f-rule)` border.

```tsx
export type SemanticStatus = 'neutral' | 'info' | 'success' | 'warning' | 'danger';
export type BadgeStatus = SemanticStatus;
export type TagVariant = 'default' | 'stamp';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status?: BadgeStatus;
  glyph?: string | false;
  srLabel?: string | false;
  pop?: boolean;
  burst?: boolean;
  children?: React.ReactNode;
}

export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: TagVariant; // default: 'default'
  status?: SemanticStatus;
  glyph?: string | false;
  srLabel?: string | false;
  children?: React.ReactNode;
}

export interface StampProps extends Omit<TagProps, 'variant'> {
  children?: React.ReactNode;
}
```

### `Alert` & `Notice` (`ui/alert.tsx`)
Non-color semantic status callouts (`status?: 'neutral' | 'info' | 'success' | 'warning' | 'danger'`) with `[i]`/`[+]`/`[!]`/`[×]` glyph stamps, deduplicated `.f12-sr-only` prefix, optional dismiss button (`onDismiss`), and compound subcomponents (`AlertTitle`, `AlertDescription`, `AlertActions`).
- **Live-region restraint:** `Notice` defaults to `live="off"` (`role="note"`) for static page-load notices. `Alert` defaults to `role="alert"` (`live="assertive"`) only when `status="danger"` (and `role="note"` otherwise unless `live="polite"` -> `role="status"` or `live="assertive"` -> `role="alert"` is passed).

```tsx
export type AlertStatus = TagStatus;
export type AlertLive = 'off' | 'polite' | 'assertive';
export type AlertDensity = 'comfortable' | 'compact';

export interface AlertProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  status?: AlertStatus;       // default: 'info'
  title?: React.ReactNode;
  description?: React.ReactNode;
  glyph?: string | false;
  srLabel?: string | false;
  actions?: React.ReactNode;
  onDismiss?: () => void;
  dismissLabel?: string;      // default: 'Dismiss notice'
  density?: AlertDensity;     // default: 'comfortable'
  live?: AlertLive;
}

export type NoticeProps = AlertProps;
export type AlertTitleProps = React.HTMLAttributes<HTMLDivElement>;
export type AlertDescriptionProps = React.HTMLAttributes<HTMLDivElement>;
export type AlertActionsProps = React.HTMLAttributes<HTMLDivElement>;
```

### `Toast` (`ui/toast.tsx`)
Bounded exposure-sheet notification stack (`ToastProvider`, `useToast`, `ToastViewport`, `Toast`, `ToastTitle`, `ToastDescription`, `ToastAction`, `ToastClose`) with `maxVisible` (default `3`), `+N QUEUED` indicator, hover/focus/background-tab timer pause with remaining duration tracking, `F8` hotkey to focus the viewport, `Escape` dismissal when focused inside the toast viewport, top-layer `<dialog[open]>` portaling, shared `.f12-sr-only` live regions (`aria-live="assertive"` for `danger` vs `aria-live="polite"` for non-danger toasts, portaled alongside `ToastViewport`), non-live `<Toast>` cards by default (unless explicit `role` or `aria-live` props are passed), and stepped 12fps entrance (`steps(3, end)`).

```tsx
export type ToastStatus = TagStatus;
export type ToastDensity = 'comfortable' | 'compact';

export interface ToastOptions {
  id?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  status?: ToastStatus;       // default: 'neutral'
  glyph?: string | false;
  srLabel?: string | false;
  duration?: number;          // default: 5000 (10000 when action is provided; 0 disables auto-dismiss)
  action?: ToastActionDescriptor | React.ReactNode;
  dismissible?: boolean;      // default: true
  dismissLabel?: string;
  onDismiss?: (id: string) => void;
}

export interface ToastProviderProps {
  maxVisible?: number;        // default: 3
  defaultDuration?: number;   // default: 5000
  density?: ToastDensity;     // default: 'comfortable'
  label?: string;             // default: 'Notifications'
  renderViewport?: boolean;   // default: true
  children?: React.ReactNode;
}

export interface ToastViewportProps extends React.HTMLAttributes<HTMLDivElement> {
  density?: ToastDensity;
  label?: string;             // default: 'Notifications'
  hotkey?: string;            // default: 'F8'
}

export interface ToastProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  status?: ToastStatus;       // default: 'neutral'
  title?: React.ReactNode;
  description?: React.ReactNode;
  glyph?: string | false;
  srLabel?: string | false;
  action?: React.ReactNode;
  duration?: number;
  resetKey?: number;          // default: 0
  paused?: boolean;
  dismissible?: boolean;      // default: true
  dismissLabel?: string;      // default: 'Dismiss notification'
  density?: ToastDensity;
  onDismiss?: () => void;
}

export interface ToastActionProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  altText?: string;
}

export type ToastTitleProps = React.HTMLAttributes<HTMLDivElement>;
export type ToastDescriptionProps = React.HTMLAttributes<HTMLDivElement>;
export type ToastCloseProps = React.ButtonHTMLAttributes<HTMLButtonElement>;
```

### `Skeleton` & `SkeletonText` (`ui/skeleton.tsx`)
Zero-CLS loading placeholders using rotated screentone dot fills (`var(--f-tone)`) and 4-step 12fps (`333ms steps(4, end)`) screentone shift and opacity pulse (`f12SkeletonStep`). Decorative skeletons default to `aria-hidden="true"`; passing `label="Loading..."` sets `role="status" aria-busy="true"` with both `aria-label` and a `.f12-sr-only` label.

```tsx
export type SkeletonVariant = 'block' | 'line' | 'circle' | 'metric' | 'panel';
export type SkeletonDensity = 'comfortable' | 'compact';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: SkeletonVariant;  // default: 'block'
  width?: number | string;
  height?: number | string;
  animated?: boolean;         // default: true
  density?: SkeletonDensity;  // default: 'comfortable'
  label?: string;
}

export interface SkeletonTextProps extends React.HTMLAttributes<HTMLDivElement> {
  lines?: number;             // default: 3
  lastLineWidth?: number | string; // default: '68%'
  animated?: boolean;         // default: true
  density?: SkeletonDensity;  // default: 'comfortable'
  label?: string;
}
```

### `EmptyState` (`ui/empty-state.tsx`)
Structured zero-data and filtered-empty state (`EmptyState`, `EmptyStateIcon`, `EmptyStateTitle`, `EmptyStateDescription`, `EmptyStateActions`) with default `[ ∅ ]` registration glyph (`aria-hidden="true"`), monospace `code` badge, `variant?: 'dashed' | 'quiet'`, and primary/secondary action slots.

```tsx
export type EmptyStateVariant = 'dashed' | 'quiet';
export type EmptyStateDensity = 'comfortable' | 'compact';
export type EmptyStateHeadingLevel = 'h2' | 'h3' | 'h4' | 'div';

export interface EmptyStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  icon?: React.ReactNode | false;
  code?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  variant?: EmptyStateVariant;           // default: 'dashed'
  density?: EmptyStateDensity;           // default: 'comfortable'
  headingLevel?: EmptyStateHeadingLevel; // default: 'h3'
}

export interface EmptyStateTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: EmptyStateHeadingLevel;           // default: 'h3'
}

export type EmptyStateIconProps = React.HTMLAttributes<HTMLDivElement>;
export type EmptyStateDescriptionProps = React.HTMLAttributes<HTMLParagraphElement>;
export type EmptyStateActionsProps = React.HTMLAttributes<HTMLDivElement>;
```

### `Breadcrumb` (`ui/breadcrumb.tsx`)
Accessible hierarchical path navigation (`<nav aria-label="Breadcrumb">` + `<ol>`) supporting shorthand `items` or compound `BreadcrumbList`, `BreadcrumbItem`, `BreadcrumbLink` (React 18/19-safe `asChild`), `BreadcrumbButton`, `BreadcrumbPage` (`aria-current="page"`), `BreadcrumbSeparator` (`role="presentation" aria-hidden="true"`), and `BreadcrumbEllipsis` (`.f12-sr-only` outside `aria-hidden="true"`).

- Items: `href` for a real route (renders `<a>`; `onClick` is skipped on Ctrl/⌘/Shift/Alt-clicks so new-tab works), `onSelect` for an in-page level such as a tab or filter scope (renders `BreadcrumbButton`, a `<button type="button">`), neither for plain context text, `current: true` for the active level.
- Never write `{ href: '#section', onClick: (e) => e.preventDefault() }` for in-page state: it advertises a URL that doesn't restore that view. Make an ancestor actionable only when activating it changes the view, and move focus to what it reveals before the button unmounts.

```tsx
export type BreadcrumbDensity = 'comfortable' | 'compact';

export interface BreadcrumbProps extends React.HTMLAttributes<HTMLElement> {
  items?: BreadcrumbEntry[];
  separator?: React.ReactNode;
  density?: BreadcrumbDensity;
  ariaLabel?: string; // default: 'Breadcrumb'
}

export interface BreadcrumbLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  asChild?: boolean;
}

export interface BreadcrumbPageProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'aria-current'> {
  'aria-current'?: React.AriaAttributes['aria-current'] | false; // default: 'page'
}

export type BreadcrumbButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;
export type BreadcrumbListProps = React.OlHTMLAttributes<HTMLOListElement>;
export type BreadcrumbItemProps = React.LiHTMLAttributes<HTMLLIElement>;
export type BreadcrumbSeparatorProps = React.HTMLAttributes<HTMLElement>;
export type BreadcrumbEllipsisProps = React.HTMLAttributes<HTMLSpanElement>;
```

### `Pagination` (`ui/pagination.tsx`)
Deterministic page navigation (`<nav aria-label="Pagination">`) supporting data-driven `page`, `totalPages`, `onPageChange`, `siblingCount`, `boundaryCount`, `showSummary` (`PAGE X OF Y`), and `density?: 'comfortable' | 'compact'`, or compound `PaginationContent`, `PaginationItem`, `PaginationLink` (`aria-current="page"` ink inversion), `PaginationPrevious`, `PaginationNext`, `PaginationEllipsis`, and `buildPaginationRange`.

```tsx
export type PaginationDensity = 'comfortable' | 'compact';

export interface PaginationSummaryDetails {
  page: number;
  totalPages: number;
  startItem?: number;
  endItem?: number;
  totalItems?: number;
}

export interface PaginationProps extends Omit<React.HTMLAttributes<HTMLElement>, 'onChange'> {
  page?: number;
  defaultPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  siblingCount?: number;
  boundaryCount?: number;
  density?: PaginationDensity;
  ariaLabel?: string;
  previousLabel?: React.ReactNode;
  nextLabel?: React.ReactNode;
  ellipsisLabel?: string;
  showSummary?: boolean;
  totalItems?: number;
  pageSize?: number;
  formatSummary?: (details: PaginationSummaryDetails) => React.ReactNode;
  getItemAriaLabel?: (
    type: 'page' | 'previous' | 'next',
    page: number,
    isCurrent: boolean,
  ) => string;
  getItemHref?: (page: number) => string | undefined;
}

export interface PaginationLinkProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'type'>,
    Pick<
      React.AnchorHTMLAttributes<HTMLAnchorElement>,
      'href' | 'target' | 'download' | 'rel' | 'hrefLang' | 'ping' | 'referrerPolicy' | 'media'
    > {
  type?: React.ButtonHTMLAttributes<HTMLButtonElement>['type'] | (string & {});
  disabled?: boolean;
  isActive?: boolean;
  density?: PaginationDensity;
  onClick?: React.MouseEventHandler<HTMLElement>;
}

export type PaginationContentProps = React.HTMLAttributes<HTMLUListElement>;
export type PaginationItemProps = React.LiHTMLAttributes<HTMLLIElement>;
export type PaginationPreviousProps = PaginationLinkProps;
export type PaginationNextProps = PaginationLinkProps;
export type PaginationEllipsisProps = React.HTMLAttributes<HTMLSpanElement>;
```

---

## 5. Data & Visualization Components

### `Metric` & `Delta` (`ui/metric.tsx`)
Headline KPI numeral (`tabular-nums`) with stepped count-up (`useCountUp`), screen-reader live region, directional marker delta (`▲` / `▼` / `=`), and optional `spark` slot. In `variant="quiet"`, renders `22px` tabular monospace numerals and defaults `motion` to `'cut'`.

```tsx
export type MetricHeadingLevel = 'h2' | 'h3' | 'h4' | 'div' | 'p';
export type MetricVariant = 'expressive' | 'quiet';

export interface DeltaProps {
  value: number;
  kind?: 'pct' | 'pp'; // default: 'pct'
  comparisonLabel?: string;
  range?: number | string;
}

export interface MetricProps {
  label: string;
  value: number;
  format?: (value: number) => string; // default: fmtMoney
  delta?: number;
  deltaKind?: 'pct' | 'pp';           // default: 'pct'
  comparisonLabel?: string;
  range?: number | string;
  note?: string;
  big?: boolean;                      // column-aware clamp(20px, min(14cqi, 100cqi / (var(--f12-m-chars, 8) * 0.8)), 56px) for C-01 hero metrics
  variant?: MetricVariant;            // default: 'expressive'
  headingLevel?: MetricHeadingLevel;  // default: 'h2'
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

export interface ToneAreaAnnotation {
  index: number;
  text: string;
}

export interface ToneAreaChartProps {
  data: ToneAreaDatum[];
  seriesLabel?: string;       // default: 'Value'
  labelColumnHeader?: string; // default: 'Label'
  compareLabel?: string;
  formatValue?: (v: number) => string; // default: plain number; export fmtCurrency for USD
  formatShort?: (v: number) => string; // default: plain k/M; export fmtCurrencyShort for USD
  annotation?: ToneAreaAnnotation | null; // undefined = auto-detect peak
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
- `ToneSpark` (`ToneSparkProps`): compact daily screentone bar chart (`values: number[]`, `label: string`, `ariaLabel?: string`, `rangeKey?: string | number`, `motion?: MotionMode`, `height?: number`, `className?: string`).
- `Balloon` (`BalloonProps`): standalone speech-balloon callout (`tailOffset?: number` from `-36` to `+36`, `showDot?: boolean`, `className?: string`).

```tsx
export interface ToneSparkProps {
  values: number[];
  label: string;
  ariaLabel?: string;
  rangeKey?: string | number;
  motion?: MotionMode;
  height?: number;
  className?: string;
}

export interface BalloonProps extends React.HTMLAttributes<HTMLDivElement> {
  tailOffset?: number; // default: 0 (-36 to +36)
  showDot?: boolean;   // default: true
  children?: React.ReactNode;
}
```

### `GhostWire` (`ui/ghost-wire.tsx`) & `Receipt` / `ReceiptList` (`ui/receipt.tsx`)
- `GhostWire` (`GhostWireProps`): dashed co-change connector wire linking a solid `from` endpoint chip (changed) to a dashed `to` endpoint chip (untouched). Maps `strength` (`0..1`) to SVG stroke dash density (never color/opacity), uses `vector-effect: non-scaling-stroke`, drives `orientation="auto"` from `data-orientation` (horizontal at `>= 520px` inline width, vertical below `520px`, measured synchronously via `useLayoutEffect` + `ResizeObserver`), wraps the wire in a single `role="group"` with an accessible `aria-label` built from `label` (when `label` is omitted, the synthesized default `"<from> usually changes with <to>, which was not changed"` assumes the missed-companion use case; other uses should pass `label`), marks the SVG `aria-hidden="true"`, and reveals the stationary dashed line via an SVG `<mask>` line (`stroke-dasharray="100 100"`, `stroke-dashoffset` stepped `100 -> 0` at `83.33ms` via `useOnTwos` from a layout effect, with zero animation frames under `prefers-reduced-motion: reduce`).
- `Receipt` (`ReceiptProps`) & `ReceiptList` (`ReceiptListProps`): evidence chips (`<ul role="list">` in `ReceiptList`) for `commit` (7-char SHA in `<code>` with the full hash preserved in `title={rawValue}` and `.f12-sr-only`), `file` (repo path in mono, wrapping anywhere without overflow), or `link` (allows `http(s)`, same-origin root-relative `/…` excluding `//…`, and `#…` fragment URLs; rejects `javascript:`, `data:`, protocol-relative, and other schemes as escaped plain text; falls back to `title` or `href` when `value` is empty so links always have an accessible name), with optional WP3 non-color `origin` (`'human' | 'agent' | 'bot'`) glyph + `.f12-sr-only` label.

```tsx
export type GhostWireOrientation = 'auto' | 'horizontal' | 'vertical';

export interface GhostWireProps extends React.HTMLAttributes<HTMLDivElement> {
  from: React.ReactNode;
  to: React.ReactNode;
  label?: string;
  strength?: number;                   // default: 0.5 (maps to stroke dash density, never color)
  orientation?: GhostWireOrientation;  // default: 'auto' (horizontal >= 520px, vertical < 520px)
  motion?: MotionMode;                 // default: 'stepped'
}

export type ReceiptKind = 'commit' | 'file' | 'link';
export type ReceiptOrigin = 'human' | 'agent' | 'bot';

export interface ReceiptProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'title'> {
  kind: ReceiptKind;
  value: string;
  href?: string;
  title?: string;
  date?: string;
  origin?: ReceiptOrigin;
}

export interface ReceiptListProps extends React.HTMLAttributes<HTMLUListElement> {
  ariaLabel?: string;
  children?: React.ReactNode;
}
```

### `ExposureScrubber` (`ui/exposure-scrubber.tsx`) & `useExposure` (`hooks/use-exposure.ts`)
- `ExposureScrubber` (`ExposureScrubberProps`): reads a discrete history (an agent run's tool calls, CI steps, an incident timeline) like an animator's exposure sheet. A semantic X-sheet table (`FRAME` · `ACTION` · `TIMING` · `MARK`, explicit ARIA table roles over a CSS-grid layout so rows can use `content-visibility: auto`; every row stays in the DOM up to 5,000 frames), a detail `Panel` (`CURRENT CUT / F-04`, `renderFrame` inside a per-frame error boundary, "Led here from" buttons built only from `causes`, a one-level "Back to F-07"), and a transport (Play with a constant name + `aria-pressed`, a native `<input type="range">` with `aria-valuetext`, rate `SegmentedControl`, timing radios). Three tab regions in order: transport → sheet (one roving stop) → panel; step buttons use `aria-disabled` at the ends and following a cause moves focus to the new frame's title. One polite live region (settle-only, ≤ 1 per second). **Never autoplays.**
- Timing modes: `even` (`stepMs × hold ÷ rate`, default `1000` ms, min `250`), `elapsed` (the run's real rhythm, `clamp(gap, 250, 3000) ÷ rate`; gap = `durationMs`, else the `at` difference to the next frame; a missing gap falls back to `even`), `flipbook` (`FRAME_MS × hold ÷ rate`, 12 poses per second; the panel shows a `FLIPPING` slate and settles where playback stops; unavailable when `useTempo().effectiveTempo === 'still'`). `useResolvedMotion()` governs only transitions, never reading speed.
- **Rules:** order is not causality — `causes` must come from your data (unknown, self and forward links are dropped). Never invent durations (no timing data → the column says so once). Redact secrets, tokens and personal data before passing tool payloads to any client component. `renderFrame` must be pure. Exactly one primary marker gets marker yellow.
- `useExposure(options)` is the headless engine (state, clock, keyboard map, data-change rules, announcements); the planned `TraceTimeline` reuses it (see `docs/architecture/exposure-engine.md`).

```tsx
export interface ExposureFrame {
  id: string;            // unique and stable
  label: string;
  at?: string;           // ISO 8601; unparseable → missing
  durationMs?: number;   // ≥ 0, finite
  kind?: string;
  status?: 'ok' | 'warn' | 'error' | 'pending';
  marker?: boolean;
  causes?: string[];     // ids of EARLIER frames the data says led here; never inferred
  hold?: number;         // 1–12, default 1
  detail?: string;       // plain text, readable without JS
}

export interface ExposureScrubberProps {
  frames: readonly ExposureFrame[];
  label: string;
  renderFrame: (frame: ExposureFrame, index: number, ctx: { scrubbing: boolean; settled: boolean }) => React.ReactNode;
  value?: string;
  defaultValue?: string;
  onValueChange?: (id: string, info: { index: number; reason: 'keyboard' | 'pointer' | 'row' | 'marker' | 'cause' | 'playback' | 'data' }) => void;
  playing?: boolean;
  onPlayingChange?: (playing: boolean, reason: 'user' | 'end' | 'scrub' | 'hidden' | 'data' | 'tempo' | 'rejected') => void;
  timing?: 'even' | 'elapsed' | 'flipbook';
  rate?: 0.5 | 1 | 2 | 4;
  defaultRate?: 0.5 | 1 | 2 | 4;
  onRateChange?: (r: 0.5 | 1 | 2 | 4) => void;
  stepMs?: number;
  loop?: boolean;
  primaryMarker?: string;
  emptyState?: React.ReactNode;
  idPrefix?: string;
  density?: 'comfortable' | 'compact';
  variant?: 'expressive' | 'quiet';
  className?: string;
}
```

---

## 6. Primitive Adapters (`Dialog`, `Select`, `Tooltip`, `DropdownMenu`, `Table`)

FRAME/12 wraps the five complex interactive primitives in accessible adapters that install into `components/frame12/*.tsx` (never colliding with stock `components/ui/*.tsx` shadcn primitives) while enforcing FRAME/12 ink rules, tokens, and WAI-ARIA semantics:

1. **`Dialog` (`ui/dialog.tsx`):**
   - Exports: `Dialog` (`DialogProps`: `open`, `defaultOpen`, `onOpenChange`, `children`), `DialogTrigger` (`DialogTriggerProps`: extends `ButtonProps` with `asChild?: boolean`), `DialogContent` (`DialogContentProps`: extends `React.DialogHTMLAttributes<HTMLDialogElement>` with `cut?: string`), `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `DialogClose` (accepts `ButtonProps` and renders `<Button>`; does not support `asChild`).
   - Uses native `<dialog>` with `.showModal()`, `DialogTrigger asChild` support, conditional `aria-describedby` (omitted when `DialogDescription` is absent), single-fire `onOpenChange(false)`, `Escape` isolation with nested `Select`/`DropdownMenu` popups, pointer light-dismiss, `overscroll-behavior: contain`, screentone backdrop, and optional `cut="C-0X"` on `DialogContent`.
2. **`Select` (`ui/select.tsx`):**
   - Exports: `Select` (`SelectProps`: extends `SelectPrimitive.Root` with `label`, `id`, `density`, `className`), `SelectTrigger` (`SelectTriggerProps`: `ariaLabel`, `density`), `SelectValue` (`SelectValueProps`), `SelectContent` (`SelectContentProps`), `SelectItem` (`SelectItemProps`), `SelectGroup` (`SelectGroupProps`), `SelectLabel` (`SelectLabelProps`), `SelectSeparator` (`SelectSeparatorProps`), `type SelectDensity`.
   - Built on `@radix-ui/react-select` with full WAI-ARIA listbox keyboard navigation (`ArrowUp`/`ArrowDown`/`Home`/`End`/`Enter`/`Space`/`Escape`, typeahead, focus restoration), portal theme inheritance (`.f12-dash` / `dialog[open]`), `density?: 'comfortable' | 'compact'`, and native `<form>` `FormData` participation via `name` and `required`. Pass `label="Channel"` and `id="channel-select"` directly to `<Select>` for an automatically linked `<label>`.
3. **`Tooltip` (`ui/tooltip.tsx`):**
   - Exports: `TooltipProvider` (`{ children?: React.ReactNode }`), `Tooltip` (`TooltipProps`: `open`, `defaultOpen`, `onOpenChange`, `children`), `TooltipTrigger` (`TooltipTriggerProps`: extends `React.ButtonHTMLAttributes<HTMLButtonElement>` with `asChild?: boolean`), `TooltipContent` (`React.HTMLAttributes<HTMLSpanElement>`).
   - Opens on hover or keyboard focus, dismisses on `Escape`, links trigger to content via `aria-describedby`, and merges caller event handlers, `ref`, `className`, and `aria-describedby` when `asChild` is used.
4. **`DropdownMenu` (`ui/dropdown-menu.tsx`):**
   - Exports: `DropdownMenu` (`DropdownMenuProps`), `DropdownMenuTrigger` (`DropdownMenuTriggerProps`: extends `ButtonProps` with `asChild?: boolean`), `DropdownMenuContent` (`DropdownMenuContentProps`), `DropdownMenuLabel` (`DropdownMenuLabelProps`), `DropdownMenuSeparator` (`DropdownMenuSeparatorProps`), `DropdownMenuItem` (`DropdownMenuItemProps`), `DropdownMenuGroup` (`DropdownMenuGroupProps`).
   - Built on `@radix-ui/react-dropdown-menu` with full WAI-ARIA menu keyboard navigation (`ArrowDown`/`ArrowUp`/`Home`/`End`/`Enter`/`Space`/`Escape`), focus restoration, and portal theme inheritance.
5. **`Table` (`ui/table.tsx`):**
   - Exports: `Table` (`TableProps`: `density`, `wrapperProps`), `TableHeader`, `TableBody`, `TableFooter`, `TableRow`, `TableHead`, `TableCell`, `TableCaption`, `type TableDensity`. Use `wrapperProps={{ className: '...' }}` to customize the scroll wrapper.
   - Monospace uppercase headers with `2.5px` bottom ink rule, `scope="col"` by default on `TableHead`, `density?: 'comfortable' | 'compact'` (`<Table density="compact">`), and `tabular-nums` alignment.

```tsx
export interface DialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}
export interface DialogTriggerProps extends ButtonProps {
  asChild?: boolean;
}
export interface DialogContentProps extends React.DialogHTMLAttributes<HTMLDialogElement> {
  cut?: string;
}

export type SelectDensity = 'comfortable' | 'compact';
export interface SelectProps
  extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Root> {
  label?: string;
  id?: string;
  density?: SelectDensity;
  className?: string;
}
export interface SelectTriggerProps
  extends Omit<React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>, 'asChild'> {
  ariaLabel?: string;
}
export type SelectValueProps = React.ComponentPropsWithoutRef<typeof SelectPrimitive.Value>;
export type SelectContentProps = React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>;
export type SelectItemProps = Omit<
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>,
  'asChild'
>;
export type SelectGroupProps = React.ComponentPropsWithoutRef<typeof SelectPrimitive.Group>;
export type SelectLabelProps = React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>;
export type SelectSeparatorProps = React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>;

export interface TooltipProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}
export interface TooltipTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

export type DropdownMenuProps = React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Root>;
export interface DropdownMenuTriggerProps extends ButtonProps {
  asChild?: boolean;
}
export type DropdownMenuContentProps = React.ComponentPropsWithoutRef<
  typeof DropdownMenuPrimitive.Content
>;
export type DropdownMenuLabelProps = React.ComponentPropsWithoutRef<
  typeof DropdownMenuPrimitive.Label
>;
export type DropdownMenuSeparatorProps = React.ComponentPropsWithoutRef<
  typeof DropdownMenuPrimitive.Separator
>;
export type DropdownMenuItemProps = React.ComponentPropsWithoutRef<
  typeof DropdownMenuPrimitive.Item
>;
export type DropdownMenuGroupProps = React.ComponentPropsWithoutRef<
  typeof DropdownMenuPrimitive.Group
>;

export type TableDensity = 'comfortable' | 'compact';
export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  density?: TableDensity;
  wrapperProps?: React.HTMLAttributes<HTMLDivElement>;
}
```

---

## 7. Application Blocks (`registry:block`)

### `DeveloperConsole` (`blocks/developer-console.tsx`)
Flagship API & webhook control-plane Developer Console block (`npx shadcn@latest add https://frame12.dev/r/developer-console.json`). Demonstrates Expressive hero KPIs (`Metric`), 45° screentone throughput charts (`ToneAreaChart`), and ranked service insights (`ToneBarList`) alongside Quiet exposure-sheet views (`<Panel variant="quiet">`, `Table density="compact"`, `Field`, `Switch`, `Dialog`, `Pagination`, `ToastProvider`) across Overview, Services & Endpoints, Masked Fictional API Keys (`f12_sim_*`), and Request Logs, with reconciled deterministic fixtures and populated/loading/empty/error states.

```tsx
export interface DeveloperConsoleProps {
  defaultSection?: ConsoleSection;
  defaultDatasetState?: ConsoleDatasetState;
  defaultTimeRange?: ConsoleTimeRange;
  defaultEnvironment?: ConsoleEnvironment;
  initialSection?: ConsoleSection;
  initialDatasetState?: ConsoleDatasetState;
  initialTimeRange?: ConsoleTimeRange;
  initialEnvironment?: ConsoleEnvironment;
  motion?: MotionMode;
  theme?: 'light' | 'dark';
  idPrefix?: string;
  showSandboxControls?: boolean;
  className?: string;
  headerSlot?: React.ReactNode;
  footerSlot?: React.ReactNode;
  onSectionChange?: (section: ConsoleSection) => void;
}
```

`onSectionChange` (additive, optional) fires once with the new section after every internal section change (tab, breadcrumb, empty-state or cross-link), never on mount. It keeps the block router-agnostic: mirror the section into the URL in your app (e.g. `?section=` via `history.replaceState`) and pass it back as `defaultSection` so Back/reload/shared links reopen the same tab.

### `WorkspaceSettings` (`blocks/workspace-settings.tsx`)
Operational Workspace Settings block (`npx shadcn@latest add https://frame12.dev/r/workspace-settings.json`). Emphasizes Quiet presentation (`<Panel variant="quiet">`, compact form density, 1px rules) paired with one focused Expressive posture header (`C-01`) across 7 canonical sections: Profile, Workspace Preferences, Notifications, Appearance, Motion Preferences, Team & Roles, and Danger Zone. Includes cross-tab unsaved-change detection, field-level and cross-section validation with focus transfer, save/discard/reset, navigation protection (`beforeunload` + workspace target switch guard modal `C-02`), RBAC member management (`C-03`), and destructive lifecycle confirmations (`C-04`).

```tsx
export interface WorkspaceSettingsProps {
  defaultSection?: SettingsSection;
  defaultDatasetState?: SettingsDatasetState;
  defaultWorkspaceId?: WorkspaceTargetId;
  initialSection?: SettingsSection;
  initialDatasetState?: SettingsDatasetState;
  initialWorkspaceId?: WorkspaceTargetId;
  motion?: MotionMode;
  theme?: 'light' | 'dark';
  className?: string;
  showSandboxControls?: boolean;
  idPrefix?: string;
  onDirtyChange?: (isDirty: boolean, dirtySections: SettingsSection[]) => void;
  onSectionChange?: (section: SettingsSection) => void;
  headerSlot?: React.ReactNode;
  footerSlot?: React.ReactNode;
}
```

`onSectionChange` follows the same contract as `DeveloperConsole`'s: once per committed section change, never on mount.

### `AnalyticsDashboard` & `RevenueRecoveryCoreScenes` (`blocks/analytics-dashboard.tsx`)
Installable Revenue Recovery Analytics block (`npx shadcn@latest add https://frame12.dev/r/analytics-dashboard.json`). Shares a single authoritative deterministic `mulberry32(1207)` 180-day recovery fixture model (`Fernwood Supply Co.`) with the public homepage (`/`). Combines the Expressive Storyboard establishing shot (`C-01` `Metric` + `ToneAreaChart`, `C-02`/`C-03` `PanelPair` + `ToneSpark`, and `C-04` `ToneBarList`) with Quiet period-over-period comparison (`Current` vs `Prior` window), checkout segment breakdown (`Returning VIP & Loyalty`, `First-Time Mobile Checkout`, `High-AOV Desktop Carts`), filterable daily attribution evidence ledger (`Input`, `Select`, `Table`, `Pagination`), and `C-05` Daily Attribution modal `<Dialog>`, plus `populated` / `loading` / `empty` / `error` sandbox states.

```tsx
export interface RevenueRecoveryCoreScenesProps {
  range: RangeDays;
  focus: string | null;
  onSelectFocus: (nextId: string | null) => void;
  motion?: MotionMode;
  idPrefix?: string;
  chartHeight?: number;
  datasetState?: AnalyticsDatasetState;
  comparisonMode?: AnalyticsComparisonMode;
  onRestorePopulated?: () => void;
}

export interface AnalyticsDashboardProps {
  defaultRange?: RangeDays;
  defaultFocusId?: string | null;
  defaultComparisonMode?: AnalyticsComparisonMode;
  defaultDatasetState?: AnalyticsDatasetState;
  initialRange?: RangeDays;
  initialFocusId?: string | null;
  initialComparisonMode?: AnalyticsComparisonMode;
  initialDatasetState?: AnalyticsDatasetState;
  motion?: MotionMode;
  theme?: 'light' | 'dark';
  className?: string;
  showSandboxControls?: boolean;
  idPrefix?: string;
  headerSlot?: React.ReactNode;
  footerSlot?: React.ReactNode;
}
```
