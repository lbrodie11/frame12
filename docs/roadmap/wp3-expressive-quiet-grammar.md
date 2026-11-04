# Work Package 3: Expressive/Quiet Design Grammar & Semantic States

**Branch:** `feature/wp3-quiet-and-semantics`  
**Status:** Implemented & Verified  
**Scope:** Master Engineering Program — Section 9 (Expressive/Quiet Design Grammar and Semantic States)

---

## 1. Architectural Summary

Work Package 3 extends FRAME/12 so the design language scales cleanly from high-contrast narrative storyboards (**Expressive**) to dense operational settings, filter bars, and tabular ledgers (**Quiet**), while introducing a non-color semantic status grammar and multi-pattern data differentiation.

### 1.1 Expressive vs. Quiet (`variant="expressive" | "quiet"`)

| Component | `'expressive'` (Default — 100% Backward Compatible) | `'quiet'` (Operational / Subordinate Mode) |
| --- | --- | --- |
| **`Panel`** (`registry/ui/panel.tsx`) | `2.5px` mitered SVG `<polygon>` border (`ResizeObserver`), `22px 24px` padding (`22px 14px 18px` mobile), automatic `C-01..C-0n` cut badge inside `<Sheet autoCut>` | Crisp `1px solid var(--f-rule)` CSS border (`.f12-panel-quiet`), skips `useSize` (`ResizeObserver`) and SVG `<polygon>` rendering when `shape === 'rect'` (while scoping `.f12-panel-quiet > .f12-panel-frame > polygon` so nested Expressive panels keep their `2.5px` frame), `16px 18px` padding (`14px 12px` mobile, with `32px` slant clearance on `slant-top`/`slant-bottom`), **unnumbered by default** (`cut === undefined` omits `.f12-cut[data-autocut]`) |
| **`PanelPair`** (`registry/ui/panel-pair.tsx`) | `16px` diagonal slant (`slant-bottom` over `slant-top`) across a `12px` (`pair`) gutter | Rectangular (`shape="rect"`) slots across a `12px` (`pair`) gutter (`variant="quiet"` forwarded to both slots) |
| **`Metric`** (`registry/ui/metric.tsx`) | `34px` (`clamp(36px, 6cqi, 56px)` when `big`) `--font-f-display` numerals with `useCountUp` stepped motion (`motion="stepped"`) | `22px` `--font-f-mono` tabular numerals (`.f12-metric-quiet`), `8px` delta spacing (`11px` font size), and instant `motion="cut"` default unless `motion` is explicitly provided |

**Static Linter Integration (`scripts/check-frame12.mjs`):**
- Inside `<Sheet autoCut>`, `<Panel variant="quiet">` without `cut` renders no `[data-autocut]` element and therefore never increments the `f12-cut` CSS counter.
- In legacy manual-cut files (`cut-order`), `scripts/check-frame12.mjs` resolves each panel or `PanelPair` slot's effective `variant` and `cut` in exact JSX/spread precedence order (including nested spreads, explicit `undefined` vs `false`, shorthand properties, local scalar/object constants, non-`Panel` child slots, JSX fragments, and slot-children-before-next-slot traversal). Unnumbered `<Panel variant="quiet">` subgroups are allowed between sequential `C-01..C-0n` narrative panels, whereas an effective string `cut` on a `variant="quiet"` panel is flagged by `cut-order`.

### 1.2 Non-Color Semantic Status System (`status`, `glyph`, & `srLabel` on `Tag` and `Badge`)

Status never relies on red/amber/green color coding and never repurposes `--f-marker` yellow (which remains exclusively for editorial emphasis). Both `Tag` (`registry/ui/tag.tsx`) and `Badge` (`registry/ui/badge.tsx`) accept `status?: 'neutral' | 'info' | 'success' | 'warning' | 'danger'`, `glyph?: string | false`, and `srLabel?: string | false`:

| Status | Default Glyph (`.f12-status-glyph`) | Screen-Reader Prefix (`.f12-sr-only`) | Surface & Ink Treatment | Border Treatment | Light / Dark Contrast |
| --- | --- | --- | --- | --- | --- |
| *(omitted)* | None | None | `var(--f-marker)` bg / `var(--f-marker-ink)` text | `Tag`: none · `Badge`: `2px solid var(--f-rule)` + burst | `13.27:1` (both themes) |
| `'neutral'` | None | None | `var(--f-panel)` bg / `var(--f-ink)` text | `1px solid var(--f-rule)` | `18.74:1` light / `14.63:1` dark |
| `'info'` | `[i]` | `Info: ` | `var(--f-panel)` bg / `var(--f-ink)` text | `1.5px solid var(--f-rule)` | `18.74:1` light / `14.63:1` dark |
| `'success'` | `[+]` | `Success: ` | `var(--f-panel)` bg / `var(--f-ink)` text | `2px solid var(--f-rule)` + `border-inline-start: 5px solid var(--f-rule)` | `18.74:1` light / `14.63:1` dark |
| `'warning'` | `[!]` | `Warning: ` | `var(--f-panel)` bg with `-45deg` `var(--f-grid)` hatch / `var(--f-ink)` text | `2px dashed var(--f-rule)` | `18.74:1` light / `14.63:1` dark |
| `'danger'` | `[×]` | `Error: ` | `var(--f-ink)` bg / `var(--f-panel)` text | `2px solid var(--f-rule)` + `inset 0 0 0 1.5px var(--f-panel)` (`3px double` in forced-colors/print) | `18.74:1` light / `14.63:1` dark |

- All four status glyphs (`[i]`, `[+]`, `[!]`, `[×]`) use characters included in the bundled `M PLUS 1 Code` Latin subset so they never fall back to OS system fonts.
- Both `.f12-status-glyph` and `.f12-sr-only` set `user-select: none` so copying text from a status tag or table cell copies only the clean visible label.
- In `@media (forced-colors: active)`, each status retains its distinct border weight/style (`1px solid`, `1.5px solid`, `2px solid` with `5px` inline-start bar, `2px dashed`, `3px double`) alongside the orthographic glyphs and `.f12-sr-only` announcements.
- On `Badge`, `burst` defaults to `true` when `status` is omitted and `false` when `status` is set (unless `burst={true}` is explicitly passed).

### 1.3 Pattern-Based Data Visualization (`ToneAreaChart` & `ToneBarList`)

1. **`ToneAreaChart` (`registry/ui/tone-area-chart.tsx`):**
   - Renders hollow diamond registration markers (`<polygon className="f12-compare-pt" />`) at labeled x-axis ticks along the dashed comparison series (`.f12-l-focus`), extends the reveal clip by `5px` (`clipW = pad.l + iw * p + 5`) so the final sample's diamond marker is never clipped, and uses a diamond `<polygon className="f12-cross-dot2" />` during pointer/keyboard inspection.
   - Distinguishes primary vs. comparison series across three non-color channels simultaneously: **area fill** (`45° halftone dots` vs. `unfilled`), **stroke style** (`2.5px solid` vs. `2px dashed`), and **point geometry** (`circle` vs. `diamond`).
2. **`ToneBarList` (`registry/ui/tone-bar-list.tsx`):**
   - Adds `pattern?: 'dots' | 'hatch' | 'dense'` (default `'dots'`) to `ToneBarItem` (`.f12-int-fill-hatch`, `.f12-int-fill-dense` at single-class `(0, 1, 0)` specificity so `@media (forced-colors: active) { .f12-int-fill { background: Highlight; } }` clears the pattern gradients in forced-colors mode).

### 1.4 Component-Level Density (`density?: 'comfortable' | 'compact'`)

Added `density?: 'comfortable' | 'compact'` (default `'comfortable'`) to:
- `Table` (`registry/ui/table.tsx` -> `.f12-table-compact`: `5px 10px 5px 0` cell/header padding, `1.5px` header rule, `13px` body font size)
- `Input` (`registry/ui/input.tsx` -> `.f12-field-compact` + `.f12-input-compact`: `6px 10px` input padding, `1.5px` border, `13px` font size)
- `Select` (`registry/ui/select.tsx` -> `.f12-select-compact`: `6px 10px` trigger padding, `1.5px` border, `13px` font size)
- `ToneBarList` (`registry/ui/tone-bar-list.tsx` -> `.f12-ints-compact`: `7px 6px` row padding, `12px` bar height, `13px` label font size)

### 1.5 Three Evaluation Compositions (`eval/screens/`)

1. **`eval/screens/landing-screen.tsx` (Expressive Narrative Dashboard):**
   - Uses Expressive `2.5px` SVG-framed panels (`C-01..C-05`), `Metric big`, `ToneAreaChart` with diamond comparison markers, and `ToneBarList` with tier-encoded `dense`/`hatch`/`dots` screentone patterns.
2. **`eval/screens/settings-screen.tsx` (Operational Settings with Quiet Subgroups):**
   - Uses `<Panel variant="quiet">`, `<PanelPair variant="quiet">`, `<Metric variant="quiet">`, `Input`/`Select`/`Table` with `density="compact"`, and semantic `<Tag status="...">` / `<Badge status="...">` indicators.
3. **`eval/screens/table-screen.tsx` (Mixed Narrative + Quiet Operational Ledger):**
   - Uses `<Sheet autoCut>` where primary narrative panels (`C-01..C-05`) are automatically numbered, while nested `<Panel variant="quiet">` filter and summary subgroups inside `C-04` remain unnumbered (`0` `.f12-cut` badges inside quiet panels).
