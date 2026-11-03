# ADR-001: Primitive Foundation for FRAME/12 v0.2.0

- **Status:** Accepted (v0.2.0 Baseline / Work Package 1)
- **Date:** 2026-11-02
- **Baseline Commit:** `840b134561f137f289f26cbd36a998c446c2dd89`

---

## 1. Context & Problem Statement

FRAME/12 is a comic-page, manga-production, and cel-animation React design system distributed both as workspace source and as a `shadcn`-compatible component registry (`https://frame12.dev/r/*.json`).

To expand from 19 v0.1.0 primitives to a complete v0.2.0 application kit (adding `Textarea`, `Checkbox`, `RadioGroup`, `Switch`, `Field`, `Tabs`, `Accordion`, `Alert`, `Toast`, `SheetDrawer`, `Breadcrumbs`, `Pagination`, `Popover`, `Combobox`, `CommandPalette`, `Skeleton`, and `EmptyState`), FRAME/12 needs an explicit architectural rule governing **when to use native HTML elements**, **when to use external headless primitives**, and **how to prevent `shadcn` CLI style-codemod breakage** across consumer projects.

---

## 2. Current v0.1.0 Primitive Inventory

| Component | Underlying Foundation | Runtime Dependencies | Notes |
| --- | --- | --- | --- |
| `Sheet`, `Scene`, `Panel`, `PanelPair` | Native HTML (`<div>`, `<section>`, inline `<svg>`) | None | `ResizeObserver` upgrades SSR fallback `<polygon>` to exact 16px slant coordinates |
| `SegmentedControl` | Native `<div role="group">` + `<button aria-pressed>` | None | Roving `tabIndex` (`0` on active/focused button, `-1` on others); `ArrowLeft`/`ArrowRight`/`ArrowUp`/`ArrowDown`/`Home`/`End` move focus only (ignoring modified keys); `Space`/`Enter` activates selection; CSS `:has([aria-pressed="true"])` provides pre-hydration selected state |
| `Button`, `Badge`, `Tag`, `Balloon`, `Metric`, `Table` | Native HTML (`<button>`, `<span>`, `<div>`, `<table>`) | None | Pure semantic HTML + `.f12-*` CSS (`Metric` sets `aria-live="polite"` on `.f12-m-value`) |
| `Input` | Native `<input>` + `<label>` + `<p role="alert">` | None | Automatic `useId()` binding for `aria-describedby` and `aria-invalid` |
| `Dialog` | Native `<dialog>` (`showModal()` / `close()`) | None | Top-layer modal, custom stacked-dialog observer, capture-phase nested-popup Escape guard, cross-browser opener focus restoration (`returnFocusRef` + `preOpenActiveRef`) |
| `Tooltip` | Native React state + `role="tooltip"` | None | Hover/focus reveal, Escape dismissal without losing trigger focus, React 18/19 dual `ref` compatibility |
| `ToneAreaChart`, `ToneBarList`, `ToneSpark` | Native SVG + optional `<details>`/`<table>` | None | Deterministic `680×H` SSR coordinate system; `<svg role="img" tabIndex={0}>` with `ArrowLeft`/`ArrowRight`/`Escape` scrubbing and `.f12-tip[role="status"]` readout |
| `Select` | `@radix-ui/react-select` (`^2.1.6`) | `@radix-ui/react-select` | Portals `SelectContent` into `closest('dialog, .f12-frame, .f12-sheet, ...')` for `<dialog>` top-layer compatibility; adds SSR preview shell + hidden `<input>` for native `<form>` submission |
| `DropdownMenu` | `@radix-ui/react-dropdown-menu` (`^2.1.6`) | `@radix-ui/react-dropdown-menu` | Portals `DropdownMenuContent` into `closest('dialog, .f12-frame, .f12-sheet, ...')` for `<dialog>` top-layer compatibility; renders `DropdownMenuPrimitive.Trigger` directly with `.f12-btn` classes (`shadcn` `base-nova` codemod safe) |

---

## 3. Evaluation Matrix Across Candidate Foundations

We evaluated four candidate foundations across the seven engineering dimensions required by FRAME/12:

| Dimension | 1. Native HTML + Targeted React Hooks | 2. Radix UI Primitives (`@radix-ui/react-*`) | 3. Base UI (`@base-ui-components/react`) | 4. React Aria Components (`react-aria-components`) |
| --- | --- | --- | --- | --- |
| **React 18 & React 19 Support** | **Full.** Zero external `element.ref` assumptions; FRAME/12 controls `getElementRef()` directly. | **Full** in `@radix-ui/*` `^2.1.6+`. Requires avoiding `<Trigger asChild><Button>` patterns that trigger `shadcn` CLI codemods. | **Good** on React 19; adds larger peer surface and uses `render={<El />}` composition instead of `asChild`. | **Good**, but couples to `@react-aria/*` + `@react-stately/*` version trees across React 18/19. |
| **Keyboard & WAI-ARIA Behavior** | **Native** for `<dialog>`, `<button>`, `<input>`, `<textarea>`, `<details>`. Requires custom roving tabindex / typeahead for complex widgets (`Tabs`, `Select`, `Menu`, `Combobox`). | **Complete** WAI-ARIA roving focus, typeahead, portal collision positioning, and pointer-exit handling for `Select` and `DropdownMenu`. | **Complete** WAI-ARIA support, but uses different data attributes (`data-open`, `data-highlighted`) than existing `.f12-*` CSS rules. | **Complete** WAI-ARIA support, but uses custom event responders (`onPress`) that diverge from standard React `onClick`/`HTMLAttributes`. |
| **Server Rendering (SSR) & First Paint** | **Excellent.** Deterministic HTML on first frame; zero portal hydration mismatch. | **Good with SSR shell.** Portaled popups (`SelectContent`, `DropdownMenuContent`) mount on open; FRAME/12 `Select` adds an SSR preview fallback so closed triggers show the selected label before JS loads. | **Good**, similar portal lifecycle to Radix. | **Moderate.** Requires careful SSR provider/id coordination in older React 18 setups. |
| **Client Bundle Size (gzipped)** | **0 KB** external overhead (`~0.5–2.5 KB` per component). | **~14–22 KB** shared across `@radix-ui/react-select` and `@radix-ui/react-dropdown-menu` (floating-ui + dismissable-layer + focus-scope). | **~18–25 KB** if added alongside Radix; replacing Radix would break v0.1.0 API parity (`asChild`, `onValueChange`, `onSelect`). | **~28–45 KB** across state + interaction hooks. |
| **CSS Customization & FRAME/12 Grammar Fit** | **100% Direct.** Zero fighting against library inline styles or animations; obeys `2.5px` ink rules, `0px` border-radius, `0` shadow, and `--f-step` (`83.33ms`). | **High.** Unstyled DOM nodes styled via `.f12-select-*` and `.f12-menu-*`; requires explicit coordination with native `<dialog>` top-layer Escape handling. | **Medium.** Would require rewriting `[data-highlighted]` / `[data-state]` selectors or maintaining dual selector sets. | **Low–Medium.** Uses render-prop / `data-*` state attributes and custom press handlers. |
| **`shadcn` CLI Installation Transformations** | **Immune.** No `@radix-ui/*` imports for the `shadcn` AST transformer to rewrite. | **Safe when `asChild` wrapping `<Button>` is avoided.** In `shadcn@4.2.0+`, `shadcn init -d` defaults to `style: "base-nova"`, whose codemod rewrites `<Primitive.Trigger asChild><Button /></Primitive.Trigger>` to Base UI's `render={<Button />}`. Rendering `<Primitive.Trigger className="f12-btn ...">` directly prevents this rewrite completely. | **Fragile in Radix-configured repos.** Consumers with `"style": "new-york"` or `"default"` have the opposite expectation. | **Unsupported** by `shadcn` style transformers. |
| **Consumer Dependency Complexity** | **Zero** external npm packages required for 17 of 19 components. | **Minimal (2 packages)** when restricted strictly to floating-overlay primitives (`@radix-ui/react-select`, `@radix-ui/react-dropdown-menu`). | **High** if mixed with Radix; breaking change if replacing Radix. | **High** (multi-package `@react-aria` / `@react-stately` tree). |

---

## 4. Critical Finding: `shadcn` CLI `base-nova` Codemod Behavior

During React 19 / Next.js 16 consumer installation verification (`840b134`), we identified a subtle interaction between the `shadcn` CLI (`v4.2.0+`) and Radix-based registry components:

1. Running `npx shadcn@latest init -d` in a fresh Next.js project now writes `"style": "base-nova"` into `components.json`.
2. When `npx shadcn@latest add <url>` installs a registry item into a `"style": "base-nova"` project, its AST transformer inspects JSX elements matching `<*Primitive.Trigger asChild><Child ... /></*Primitive.Trigger>` and rewrites `asChild` into Base UI's `render={<Child ... />}` prop.
3. Because `@radix-ui/react-dropdown-menu` does not accept a `render` prop, TypeScript compilation (`next build`) fails with `TS2322` if a Radix trigger uses `asChild` around an internal `<Button>`.
4. **Architectural Rule:** Any FRAME/12 component backed by a `@radix-ui/*` primitive MUST render `<*Primitive.Trigger>` directly with `.f12-btn` classes (and only use `React.cloneElement` when the consumer explicitly passes `asChild={true}`), never wrapping an internal `<Button>` inside `<*Primitive.Trigger asChild>`. This is verified in CI by both `scripts/smoke-install.mjs` and the `real-install` GitHub Actions job.

---

## 5. Decision for v0.2.0

We adopt a **Strict Two-Tier Hybrid Foundation** for FRAME/12 v0.2.0:

### Tier 1 — Native HTML + Deterministic React Hooks (Default for 90% of Components)
Use zero-dependency semantic HTML elements paired with FRAME/12 hooks (`useId`, `useIsoLayoutEffect`, `ResizeObserver`, roving keyboard handlers) whenever native browser primitives provide complete semantics and cross-browser styling control across Chromium, Firefox, and WebKit:

- **Existing:** `Sheet`, `Scene`, `Panel`, `PanelPair`, `SegmentedControl`, `Button`, `Input`, `Badge`, `Tag`, `Metric`, `Balloon`, `Table`, `ToneAreaChart`, `ToneBarList`, `ToneSpark`, `Dialog` (`<dialog>`), `Tooltip`.
- **v0.2.0 Additions (WP3–WP5):**
  - `Textarea` (`<textarea>`)
  - `Checkbox` (`<input type="checkbox">` with custom `.f12-*` ink box + SVG check mark)
  - `RadioGroup` (`<fieldset>` / `role="radiogroup"` + `<input type="radio">`)
  - `Switch` (`<button role="switch" aria-checked>`)
  - `Field` (`<div>` + `<label>` + hint/error `aria-describedby` coordinator)
  - `Tabs` (`role="tablist"` / `role="tab"` / `role="tabpanel"` with horizontal/vertical roving tabindex and `Home`/`End`)
  - `Accordion` (native `<details>` / `<summary>` or WAI-ARIA button/region with `2.5px` ink rules)
  - `Alert`, `Toast` (`role="status"` / `role="alert"`), `Breadcrumbs` (`<nav aria-label="Breadcrumb">`), `Pagination` (`<nav aria-label="Pagination">`), `Skeleton`, `EmptyState`
  - `SheetDrawer` & `CommandPalette` (built on native `<dialog>` top-layer modal infrastructure shared with `Dialog`, inheriting stacked-dialog Escape isolation and opener focus restoration).

### Tier 2 — Isolated Radix UI Adapters (Strictly for Positioned Floating Overlays)
Retain `@radix-ui/react-select` and `@radix-ui/react-dropdown-menu` (and if needed in WP5, `@radix-ui/react-popover` or native anchored positioning with fallback) **only** for non-modal floating overlays that require viewport-collision positioning, portal layering, and typeahead listbox/menu state machines:

- **Guardrails for Tier 2 Adapters:**
  1. Never wrap `<Button>` inside `<*Primitive.Trigger asChild>` in component source (`base-nova` codemod immunity).
  2. Coordinate Escape dismissal with native `<dialog>` (`DialogContent` checks `[role="listbox"], [role="menu"]` in capture phase so pressing `Escape` inside a nested `Select` or `DropdownMenu` closes only the floating popup, never the parent `<dialog>`).
  3. Provide an SSR preview shell where applicable (as in `Select`) so server-rendered HTML displays the selected value before client hydration.
  4. Never introduce Base UI or React Aria alongside Radix UI in v0.2.0.

---

## 6. Consequences

- **Positive:**
  - 17 of 19 existing components (and ~14 of 16 planned v0.2.0 components) have **zero external runtime dependencies**, install cleanly as single-component registry items, and render deterministically in SSR with zero FOUC.
  - Full compatibility across React 18 (`templates/next-starter`) and React 19 (`create-next-app@latest` + `shadcn@latest init -d`) is preserved and continuously verified in CI.
  - Cross-browser behavior across Chromium, Firefox, and WebKit is deterministic and tested in CI (`registry/tests/cross-browser.mjs`).
- **Trade-offs & Mitigations:**
  - **Portal Placement Inside Top-Layer `<dialog>`:** Native `<dialog>` opened via `showModal()` sits in the browser's top layer above normal `document.body` portals. To ensure floating overlays remain visible and interactive when opened inside a modal `<Dialog>`, both `SelectContent` (`registry/ui/select.tsx:129-135`) and `DropdownMenuContent` (`registry/ui/dropdown-menu.tsx:88-94`) resolve their portal container via `field?.containerEl?.closest('dialog, .f12-frame, .f12-sheet, .f12-theme-dark, .f12-theme-light, [data-theme]')`, portaling directly into the enclosing `<dialog>` element when rendered inside a `Dialog`.
  - **Escape-Key Isolation Inside `<dialog>`:** Separately from portal placement, pressing `Escape` while a nested `Select` or `DropdownMenu` is open inside a `<Dialog>` would normally fire the native `<dialog>` `cancel` event alongside Radix's `DismissableLayer`. `DialogContent` (`registry/ui/dialog.tsx:221-246`) attaches a document capture-phase `keydown` listener (`onDocKeyDownCapture`) that detects an open `[role="listbox"], [role="menu"]` before Radix unmounts it and calls `e.preventDefault()` on the `<dialog>` `cancel` event for that tick. Future WP5 floating overlays (`Popover`, `Combobox`) will reuse this same dual mechanism (dialog-aware portal container resolution + capture-phase Escape guard).
