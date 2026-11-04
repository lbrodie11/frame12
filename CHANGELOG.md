# Changelog

All notable changes to **FRAME/12** are documented in this file.

## [Unreleased]

### Added

- **Essential Form Kit & Tabs (Work Package 4):**
  - Added 6 new Tier-1 native HTML / WAI-ARIA primitives in `registry/ui/` (`field.tsx`, `textarea.tsx`, `checkbox.tsx`, `radio-group.tsx`, `switch.tsx`, `tabs.tsx`) and `registry/registry.json` (`25` components, `28` registry payloads, `32` total registry items):
    - **`Field` (`registry/ui/field.tsx`):** Reusable form field coordinator providing `FieldContext` so wrapping `Input`, `Textarea`, `Checkbox`, `Switch`, or `RadioGroup` inside `<Field label="..." hint="..." error="...">` links `<label htmlFor>`, `aria-describedby`, and `aria-invalid="true"` without rendering duplicate labels, hints, or `role="alert"` errors (delegating `<Field label>` to `<RadioGroup>`'s `<legend>` when wrapping a radio fieldset).
    - **`Textarea` (`registry/ui/textarea.tsx`):** Multi-line `<textarea>` control matching `Input` ink borders, `:focus-visible` outline, `density?: 'comfortable' | 'compact'`, `FieldContext` coordination, and `react-hook-form` `register()` ref forwarding.
    - **`Checkbox` (`registry/ui/checkbox.tsx`):** Built on native `<input type="checkbox">` with `2px` ink frame, SVG check mark, and SSR-safe `indeterminate` mixed state (`aria-checked="mixed"`, `.f12-checkbox-indeterminate` class for pre-hydration CSS, and DOM `node.indeterminate` sync).
    - **`RadioGroup` & `RadioGroupItem` (`registry/ui/radio-group.tsx`):** Built on native `<fieldset role="radiogroup">` + `<legend>` + `<input type="radio">`, delegating arrow-key roving focus, single Tab stop, `FormData`, and `form.reset()` to native browser radio groups.
    - **`Switch` (`registry/ui/switch.tsx`):** Built on native `<input type="checkbox" role="switch">` with an exposure-sheet rectangular track, configurable `onLabel` (default `'ON'`) and `offLabel` (default `'OFF'`) glyphs hidden from screen readers (`aria-hidden="true"`), logical `inset-inline-start` RTL thumb travel (`dir="rtl"`), stepped 2-pose transition (`steps(2, end)`), and full native `<form>` (`FormData`, `form.reset()`, `required`, `form=`) and `react-hook-form` `register()` support.
    - **`Tabs` (`registry/ui/tabs.tsx`):** WAI-ARIA `role="tablist"` / `role="tab"` / `role="tabpanel"` with roving `tabIndex`, `ArrowLeft`/`ArrowRight`/`ArrowUp`/`ArrowDown`/`Home`/`End` navigation (including `dir="rtl"` horizontal flip and modified-key guard), and `activationMode?: 'automatic' | 'manual'`. Panels inside `<TabsContent>` default to `variant="quiet"` (`Symbol.for('frame12.PanelVariantContext')`) and `.f12-tabs-content` suppresses `autoCut` counter increments so switching tabs never shifts `C-01..C-0n` cut numbers on `<Sheet autoCut>`.
  - Guaranteed `>= 24×24px` WCAG 2.5.8 target sizes across both `comfortable` and `compact` densities and added explicit `@media (forced-colors: active)` system-color rules (`Canvas`, `CanvasText`, `Highlight`, `HighlightText`, `GrayText`) for all `appearance: none` form controls and active tabs.
  - Updated `scripts/check-frame12.mjs` and `skills/frame12/eslint.frame12.mjs` (`raw-shadcn-import`) to flag `@/components/ui/{checkbox,radio-group,switch,textarea,field,label}`.
- **Expressive / Quiet Design Grammar & Non-Color Semantic States (Work Package 3):**
  - Added `variant?: 'expressive' | 'quiet'` (default `'expressive'`) to `Panel` (`registry/ui/panel.tsx`), `PanelPair` (`registry/ui/panel-pair.tsx`), and `Metric` (`registry/ui/metric.tsx`).
    - `<Panel variant="quiet">` renders a crisp `1px solid var(--f-rule)` exposure-sheet frame (`.f12-panel-quiet`), skips `useSize` (`ResizeObserver`) and SVG `<polygon>` rendering when `shape === 'rect'` (while scoping `.f12-panel-quiet > .f12-panel-frame > polygon` so nested Expressive panels keep their `2.5px` frame), tightens interior padding (`16px 18px` desktop, `14px 12px` mobile container), and omits the cut badge by default (`cut === undefined` behaves as `cut={false}`) so subordinate Quiet groups never increment `<Sheet autoCut>` counters or require sequential `C-01..C-0n` cut numbers.
    - `<PanelPair variant="quiet">` defaults its top and bottom slots to `shape="rect"` and `variant="quiet"`.
    - `<Metric variant="quiet">` renders `22px` tabular monospace numerals (`.f12-metric-quiet`) and defaults `motion` to `'cut'` (instant updates) unless `motion` is explicitly passed.
    - Updated `scripts/check-frame12.mjs` (`cut-order`) to resolve effective `variant` and `cut` props in JSX/spread precedence order (including `PanelPair` slot and direct child inheritance), allowing unnumbered `<Panel variant="quiet">` subgroups between sequential narrative cuts while flagging explicit `cut` strings on `variant="quiet"` panels.
  - Added non-color semantic states (`status?: 'neutral' | 'info' | 'success' | 'warning' | 'danger'` and `glyph?: string | false`) to `Tag` (`registry/ui/tag.tsx`) and `Badge` (`registry/ui/badge.tsx`), pairing orthographic glyph prefixes (`[i]`, `[+]`, `[!]`, `[×]`) and screen-reader `.f12-sr-only` status announcements with ink-and-paper border weight/style, diagonal hatch (`warning`), and fill inversion (`danger`) (`14.63:1–18.74:1` contrast in light and dark themes, without repurposing `--f-marker` yellow).
  - Added pattern-based data differentiation: hollow diamond registration markers (`.f12-compare-pt`, with `5px` end-clip padding so the final sample's diamond is never clipped) at labeled x-axis ticks and a diamond crosshair dot (`.f12-cross-dot2`) on the dashed comparison series in `ToneAreaChart` (`registry/ui/tone-area-chart.tsx`), plus `pattern?: 'dots' | 'hatch' | 'dense'` on `ToneBarItem` in `ToneBarList` (`registry/ui/tone-bar-list.tsx`).
  - Added `density?: 'comfortable' | 'compact'` (default `'comfortable'`) to `Table` (`registry/ui/table.tsx`), `Input` (`registry/ui/input.tsx`), `Select` (`registry/ui/select.tsx`), and `ToneBarList` (`registry/ui/tone-bar-list.tsx`).
- **Automatic Cut Numbering (`<Sheet autoCut>`):**
  - Added `autoCut?: boolean` (default `false`) to `Sheet` (`registry/ui/sheet.tsx`), setting `data-autocut` and `--f12-autocut-display: block` on `.f12-sheet` when `true` (`--f12-autocut-display: none` when `false`) and resetting CSS counter `f12-cut` (`registry/styles/frame12.css`).
  - Updated `Panel` (`registry/ui/panel.tsx`) and `PanelPair` (`registry/ui/panel-pair.tsx`) `cut` / `topCut` / `bottomCut` props to `string | false`: omitting `cut` renders `<span className="f12-cut" data-autocut aria-hidden="true" />` numbered via `counter(f12-cut, decimal-leading-zero)` inside `<Sheet autoCut>` (hidden outside `autoCut`), `cut={false}` suppresses the cut badge entirely, and explicit string cuts render as before (with a dev-only `console.warn` once when mixed inside `<Sheet autoCut>`).
  - Added the `explicit-cut-in-autocut` static linter rule in `scripts/check-frame12.mjs` to catch hand-numbered `<Panel>` or `<PanelPair>` cuts inside `<Sheet autoCut>`.
- **Registry & Distribution Modernization (Work Package 2):**
  - Migrated all 19 individual component manifests in `registry/registry.json` (`site/public/r/*.json`) to declare shared dependencies (`frame12-styles`, `use-on-twos`, `panel`, `button`, `badge`) via `registryDependencies` instead of duplicating `styles/frame12.css` and `hooks/use-on-twos.ts` inside every payload.
  - Added `frame12-base` (`type: "registry:base"`) and three `type: "registry:font"` manifests (`font-dela-gothic-one`, `font-zen-kaku-gothic-new`, `font-m-plus-1-code`), plus root `/registry.json` `include` composition validated by `npx shadcn registry validate`.
  - Added static `/llms.txt` and `/llms-full.txt` routes (`site/app/llms.txt/route.ts`, `site/app/llms-full.txt/route.ts`) generated directly from `skills/frame12/SKILL.md`, `skills/frame12/references/*.md`, `registry/registry.json`, and `site/src/lib/catalog.ts`.

### Changed

- **`SegmentedControl` Keyboard Navigation & Focus Contrast (`registry/ui/segmented-control.tsx`, `registry/styles/frame12.css`):**
  - Implemented roving `tabIndex` (`tabIndex={0}` on the active segment, `tabIndex={-1}` on inactive segments) so each `SegmentedControl` is a single Tab stop.
  - Added `ArrowRight`/`ArrowDown`, `ArrowLeft`/`ArrowUp`, `Home`, and `End` keyboard navigation that moves focus between segment buttons (ignoring modified keystrokes with `Alt`, `Ctrl`, `Meta`, or `Shift`), while `Space` or `Enter` activates the focused segment (`aria-pressed="true"`).
  - Updated `.f12-rng-btn:focus-visible` from `--f-marker` (`1.41:1` on unselected light-mode cells) to `3px solid var(--f-ink)` (`18.74:1` in light mode, `14.63:1` in dark mode, and automatically inverted by `.f12-rng-ind` `mix-blend-mode: difference` when selected).
- **`Dialog` Cross-Browser Focus Restoration (`registry/ui/dialog.tsx`):**
  - Tracked both the activating `DialogTrigger` (`returnFocusRef`) and pre-open `document.activeElement` (`preOpenActiveRef`) so closing a `<Dialog>` via `Escape`, `DialogClose`, or backdrop click reliably returns focus to the trigger across Chromium, Firefox, and WebKit (even when pointer clicks in WebKit leave a prior input focused), while respecting intentional consumer focus changes.
- **`.f12-dash` Scoped Typography Reset (`registry/styles/frame12.css`):**
  - Updated `.f12-dash h2, .f12-dash h3, .f12-dash p, .f12-dash ul` to `.f12-dash :where(h2, h3, p, ul)` (`(0, 1, 0)` specificity), preserving host-app style isolation against element selectors (`p, h2, h3, ul`) while allowing `.f12-delta { margin: 14px 0 0 }` to take effect (`14.00px` descender clearance under `.f12-m-value`).

## [0.1.0] - 2026-11-02

Initial public release of **FRAME/12**, an interface design language, `shadcn`-compatible React + TypeScript component registry, and AI agent grammar toolkit built from sequential print page composition and `12fps` ("on twos") cel-animation production craft.

### Added

- **Component Registry (`@frame12/registry` & `https://frame12.dev/r/*.json`):**
  - **22 self-contained registry payloads** (`frame12.json` full bundle, `frame12-styles.json`, `use-on-twos.json`, and 19 individual component/adapter manifests) plus the `registry.json` index.
  - **4 Storyboard Layout Components:** `Sheet` (with top-edge registration pegs and `32px` scene-change vertical rhythm), `Scene` (`12px` `pair`, `20px` `scene`, and `32px` `change` gutter grammar), `Panel` (`2.5px` mitered SVG polygon frame and sequential `C-01` cut numbers), and `PanelPair` (`16px` diagonal slant across a `12px` gutter).
  - **5 Exposure-Sheet Controls & Markers:** `SegmentedControl` (`mix-blend-mode: difference` active cell stepping in 3 poses), `Button` (`primary`, `secondary`, `marker`), `Input` (linked label, hint, and marker-flagged `role="alert"` error), `Badge` (with optional two-frame 14-ray SVG impact burst), and `Tag`.
  - **5 Zero-Dependency Screentone Data & Chart Components:** `Metric` & `Delta` (`useCountUp` stepped numerals and directional marker badges), `ToneAreaChart` (4-band `45°` SVG halftone fills, dashed comparison series, peak `Balloon`, keyboard crosshair inspection, and collapsible `<details className="f12-tbl">` semantic table), `ToneBarList`, `ToneSpark`, and `Balloon`.
  - **5 Accessible Primitive Adapters:** `Dialog` (native modal `<dialog>` with opening-order stack tracking, cancellable `onCancel`, and `asChild` support), `Select` (`@radix-ui/react-select` listbox with portal theme inheritance and native `<form>` `FormData` support), `Tooltip` (focus/hover trigger with full `asChild` event/ref/aria composition), `DropdownMenu` (`@radix-ui/react-dropdown-menu`), and `Table`.
  - **12fps Motion Hooks (`hooks/use-on-twos.ts`):** `useOnTwos`, `useCountUp`, `useChanged`, `useSize`, and `useReducedMotion` sampling cubic ease-out curves at `83.33ms` per pose (`12fps`) while honoring `prefers-reduced-motion: reduce`.
  - **Scoped Stylesheet & Tokens (`styles/frame12.css` & `styles/frame12-tailwind.css`):** `.f12-*` namespace isolation, Paper Light and Flashback Dark (`#050505` gutters, `#19191a` panels) themes, and non-colliding `--font-f12-*` Tailwind v4 `@theme` mappings.
  - **React 18 & React 19 Compatibility:** Full support for React 18 and React 19 (including warning-free `element.props.ref` / `element.ref` resolution in `DialogTrigger` and `TooltipTrigger` `asChild` mode).
- **AI Agent Skill & Static Grammar Linter (`skills/frame12/` & `scripts/check-frame12.mjs`):**
  - Portable `SKILL.md` with progressive-disclosure references (`components-and-adapters.md` and `examples-and-mistakes.md`).
  - Deterministic static checker (`scripts/check-frame12.mjs`) enforcing `color-literal`, `illegal-gutter`, `cut-order`, `marker-misuse`, and `raw-shadcn-import` rules.
  - ESLint flat config (`skills/frame12/eslint.frame12.mjs`).
- **Documentation & Showcase Site (`@frame12/site` at `https://frame12.dev`) & Starter (`templates/next-starter/`):**
  - Interactive showcase (`/`, `/motion`, `/components`, `/agents`, `/style-sheet`, `/get-started`), self-hosted OFL fonts (`Dela Gothic One`, `Zen Kaku Gothic New`, `M PLUS 1 Code`), dynamic Open Graph images, and global `T` (theme) / `M` (motion) keyboard shortcuts.
  - Standalone Next.js App Router starter template (`templates/next-starter/`).

### Known Scope Boundaries in `0.1.0`

- Form controls beyond `Input`, `Select`, `SegmentedControl`, and `Button` (such as `Checkbox`, `Switch`, `Textarea`, and `Toast`) are planned for `0.2.0`.
