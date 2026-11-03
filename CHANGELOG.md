# Changelog

All notable changes to **FRAME/12** are documented in this file.

## [Unreleased]

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
