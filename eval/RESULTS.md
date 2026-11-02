# FRAME/12 Skill Reproduction & Evaluation Report (`m3-skill`)

This report documents the Milestone 3 reproduction test for `skills/frame12/SKILL.md`, the static design-grammar checker (`scripts/check-frame12.mjs`), and the Playwright accessibility and visual family benchmark (`eval/tests/eval-a11y.mjs`).

---

## 1. Benchmark Setup

Three product archetypes not present in the original Phase 1 prototype were specified as plain prompts in `eval/prompts/` and implemented in-repo in `eval/screens/` following `skills/frame12/SKILL.md` and importing from `@/components/frame12` and `@/hooks/use-on-twos` (note: this is an in-repo rule-conformance and visual-family evaluation rather than an external multi-rater blind human study):

| Screen | Prompt | Implementation | Next.js App Router Page | Standalone Bundle |
| --- | --- | --- | --- | --- |
| **01 · SaaS Settings** | `eval/prompts/01-settings.md` | `eval/screens/settings-screen.tsx` | `eval/next-app/app/settings/page.tsx` | `eval/dist/settings.html` |
| **02 · Product Landing Hero** | `eval/prompts/02-landing-hero.md` | `eval/screens/landing-screen.tsx` | `eval/next-app/app/landing/page.tsx` | `eval/dist/landing.html` |
| **03 · Order Recovery Ledger** | `eval/prompts/03-data-table.md` | `eval/screens/table-screen.tsx` | `eval/next-app/app/table/page.tsx` | `eval/dist/table.html` |
| **Family Overview** | Side-by-side comparison | `eval/scripts/build.mjs` | — | `eval/dist/family.html` |

---

## 2. Automated Rule Checker (`scripts/check-frame12.mjs`)

`scripts/check-frame12.mjs` enforces the five checkable static grammar rules across `.tsx`, `.ts`, `.jsx`, `.js`, and `.css` files:

1. **`color-literal`:** Flags any hex (`#...`), `rgb()`, `rgba()`, `hsl()`, `hsla()`, `oklch()`, CSS named-color gradients, or hard-coded font family name outside `frame12.css` / `frame12-tailwind.css` (with zero file exceptions).
2. **`illegal-gutter`:** Flags any `<Scene gutter="...">` prop not in `{'pair', 'scene', 'change'}`, any inline or CSS `gap` / `rowGap` / `columnGap` / `gridGap` not in `{0, 12px, 20px, 32px, var(--f-gutter-*)}`, and any Tailwind `gap-*` class (in strings, template literals, or `cn()`/`clsx()` calls) not mapped to the three legal gutter widths.
3. **`marker-misuse`:** Flags `--f-marker` or `#ffd60a` used on `color`, `stroke`, `fill`, `border*`, `outline*`, or `boxShadow`, as well as any `--f-marker` background in inline styles or CSS that does not explicitly pair with `color: var(--f-marker-ink)`.
4. **`cut-order`:** Extracts all `cut`, `topCut`, and `bottomCut` literals in DOM order and verifies two-digit formatting (`C-01`), starting at `C-01`, and strict `n + 1` sequential increments with zero gaps, duplicates, or reversals.
5. **`raw-shadcn-import`:** Flags imports from `@/components/ui/*` where a FRAME/12 component or adapter exists (`button`, `input`, `badge`, `tag`, `card`, `tabs`, `dialog`, `select`, `tooltip`, `dropdown-menu`, `table`, `sheet`, `panel`), raw `@radix-ui/*` primitives in application screens, and external charting or animation libraries (`recharts`, `chart.js`, `d3`, `framer-motion`, `gsap`).

Companion ESLint flat-config rules are exported in `skills/frame12/eslint.frame12.mjs`, and unit/CLI tests for all five rules run in `eval/tests/check-linter.mjs` (17/17 assertions passing).

---

## 3. Pre-Check vs. Post-Check Findings & Fix Cycles

Rather than hiding issues encountered during verification, we recorded every failure surfaced by the automated tool suite and the exact fix cycle required:

### Finding 1 — Strict Next.js + TypeScript Compilation (`tsc --noEmit`)
- **Initial result:** Running `npx tsc -p eval/tsconfig.json --noEmit` against the eval screens, Next.js App Router pages, and `registry/ui/*.tsx` surfaced 1 type error in `registry/ui/dialog.tsx:121`:
  - `TS2322: Type 'RefObject<HTMLDialogElement | null>' is not assignable to type 'LegacyRef<HTMLDialogElement> | undefined'` under React 18 `@types/react`.
- **Fix cycle (Cycle 1):** Cast `ref={dialogRef as React.RefObject<HTMLDialogElement>}` in `registry/ui/dialog.tsx` and rebuilt the shadcn registry JSON output (`site/public/r/dialog.json`, `site/public/r/frame12.json`).
- **Post-fix result:** `npx tsc -p eval/tsconfig.json --noEmit` passes with `0` errors across all 26 TypeScript/TSX files.

### Finding 2 — Mobile (`390px`) Horizontal Overflow in Container Queries (`eval-a11y.mjs`)
- **Initial result:** All 3 eval screens passed static linting (`0` violations in `check-frame12.mjs`) and passed desktop (`1280px`) accessibility, contrast, keyboard focus, and grammar checks on the first run. However, the `390px` mobile Playwright check failed on all 3 screens:
  - `eval/settings (390px)`: `scrollWidth = 421px` (overflow by `31px`)
  - `eval/landing (390px)`: `scrollWidth = 441px` (overflow by `51px`)
  - `eval/table (390px)`: `scrollWidth = 478px` (overflow by `88px`)
- **Root cause:**
  1. In `registry/styles/frame12.css`, `.frame .scene.scene-split` and `.frame .scene.scene-equal` had selector specificity `(0, 3, 0)`, which overrode `@container (max-width: 760px) { .scene.scene-split, .scene.scene-equal }` with specificity `(0, 2, 0)`, preventing 2-column scenes from collapsing on mobile.
  2. `.panel-body` lacked `min-width: 0`, allowing wide `<Table>` elements inside flex panels to expand the panel rather than scrolling inside `.f12-table-wrap`.
  3. `.dash.frame` is the container element itself (`container-type: inline-size`), so `.frame { padding: 6px }` inside `@container (max-width: 760px)` needed a matching `@media (max-width: 760px)` rule and compact `.rng-btn` padding (`6px 10px 5px`) for 4-option `SegmentedControl` groups.
- **Fix cycle (Cycle 1):** Updated `registry/styles/frame12.css` with matching `.frame .scene.scene-*` specificity inside `@container (max-width: 760px)`, `min-width: 0` on `.panel-body`, and compact mobile padding. Rebuilt `registry` and `eval`.
- **Post-fix result:** All 3 screens report `scrollWidth = 390px` at `390px` mobile width and `scrollWidth = 1280px` at `1280px` desktop width in both light and dark themes.

---

## 4. Verification Matrix Across All 3 Eval Screens

| Check | `01-settings` | `02-landing-hero` | `03-data-table` |
| --- | --- | --- | --- |
| **`check-frame12.mjs` violations** | `0` | `0` | `0` |
| **Next.js + TS (`tsc --noEmit`)** | Pass | Pass | Pass |
| **Panel cuts (DOM & reading order)** | `C-01`..`C-05` + modal `C-06` | `C-01`..`C-05` + modal `C-06` | `C-01`..`C-05` + modal `C-06` |
| **Gutters in live DOM** | `20px` (`scene`), `12px` (`pair`), `32px` (`change`) | `20px` (`scene`), `12px` (`pair`), `32px` (`change`) | `20px` (`scene`), `12px` (`pair`), `32px` (`change`) |
| **Marker yellow discipline** | Pass (`0` violations) | Pass (`0` violations) | Pass (`0` violations) |
| **WCAG AA contrast (`light` & `dark`)** | Pass (`1280px` & `390px`) | Pass (`1280px` & `390px`) | Pass (`1280px` & `390px`) |
| **Accessible names & unique IDs** | Pass (`0` unnamed, `0` dup) | Pass (`0` unnamed, `0` dup) | Pass (`0` unnamed, `0` dup) |
| **Visible `:focus-visible` ring** | Pass (`18/18` tab stops) | Pass (`18/18` tab stops) | Pass (`18/18` tab stops) |
| **Desktop (`1280px`) overflow** | `scrollWidth = 1280px` | `scrollWidth = 1280px` | `scrollWidth = 1280px` |
| **Mobile (`390px`) overflow** | `scrollWidth = 390px` | `scrollWidth = 390px` | `scrollWidth = 390px` |
| **Interactive flows verified** | Env switch, input error alert, `C-06` revoke modal | Window switch, `C-04` chart comparison overlay, `C-06` trial modal | Status filter, search query, channel bar filter, `C-06` payload modal |

---

## 5. Visual Family Screenshots

Rendered by `eval/tests/eval-a11y.mjs` into `docs/images/`:

- `docs/images/eval-settings-light.png` & `docs/images/eval-settings-dark.png`
- `docs/images/eval-landing-light.png` & `docs/images/eval-landing-dark.png`
- `docs/images/eval-table-light.png` & `docs/images/eval-table-dark.png`
- `docs/images/eval-family-light.png` (side-by-side overview of all three screens)

---

## 6. Remaining Limitations

1. **Per-file static cut-order analysis:** `scripts/check-frame12.mjs` verifies `cut="C-01"`..`C-0N` sequentially within each file. If a screen splits its panels across multiple child component files, static per-file linting should be paired with the live DOM `.panel > .cut` reading-order check in `eval/tests/eval-a11y.mjs`.
2. **Computed contrast and overflow require browser layout:** Static regex/AST checks catch hard-coded colors, illegal gutters, and marker misuse at author time, while WCAG AA blended contrast and `390px` container overflow are verified by the Playwright suite (`npm test`).
