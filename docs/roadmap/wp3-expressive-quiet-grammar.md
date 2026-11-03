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
| **`Panel`** (`registry/ui/panel.tsx`) | `2.5px` mitered SVG `<polygon>` border (`ResizeObserver`), `22px 24px` padding (`18px 16px` mobile), automatic `C-01..C-0n` cut badge inside `<Sheet autoCut>` | Crisp `1px solid var(--f-rule)` CSS border (`.f12-panel-quiet`), no SVG polygon overhead when `shape === 'rect'`, `16px 18px` padding (`14px 12px` mobile), **unnumbered by default** (`cut === undefined` omits `.f12-cut[data-autocut]`) |
| **`PanelPair`** (`registry/ui/panel-pair.tsx`) | `16px` diagonal slant (`slant-bottom` over `slant-top`) across a `12px` (`pair`) gutter | Rectangular (`shape="rect"`) slots across a `12px` (`pair`) gutter (`variant="quiet"` forwarded to both slots) |
| **`Metric`** (`registry/ui/metric.tsx`) | `36px` (`clamp(36px, 6cqi, 56px)` when `big`) `--font-f-display` numerals with `useCountUp` stepped motion (`motion="stepped"`) | `22px` `--font-f-mono` tabular numerals (`.f12-metric-quiet`), `6px` delta spacing, and instant `motion="cut"` default unless `motion` is explicitly provided |

**Static Linter Integration (`scripts/check-frame12.mjs`):**
- Inside `<Sheet autoCut>`, `<Panel variant="quiet">` without `cut` renders no `[data-autocut]` element and therefore never increments the `f12-cut` CSS counter.
- In legacy manual-cut files (`cut-order`), `<Panel variant="quiet">` without `cut` is allowed as an unnumbered subordinate group between sequential `C-01..C-0n` narrative panels, whereas passing an explicit string `cut="C-01"` on `<Panel variant="quiet">` is flagged by `cut-order`.

### 1.2 Non-Color Semantic Status System (`status` & `glyph` on `Tag` and `Badge`)

Status never relies on red/amber/green color coding. Both `Tag` (`registry/ui/tag.tsx`) and `Badge` (`registry/ui/badge.tsx`) accept `status?: 'neutral' | 'info' | 'success' | 'warning' | 'danger'` and `glyph?: string | false`:

| Status | Default Glyph (`.f12-status-glyph`) | Surface & Ink Treatment | Border Treatment | Light / Dark Contrast |
| --- | --- | --- | --- | --- |
| *(omitted)* | None | `var(--f-marker)` bg / `var(--f-marker-ink)` text | `Tag`: none · `Badge`: `2px solid var(--f-rule)` + burst | `15.11:1` (both themes) |
| `'neutral'` | None | `var(--f-panel)` bg / `var(--f-ink)` text | `1px solid var(--f-rule)` | `18.74:1` light / `14.63:1` dark |
| `'info'` | `[i]` | `var(--f-panel)` bg / `var(--f-ink)` text | `1.5px dashed var(--f-rule)` | `18.74:1` light / `14.63:1` dark |
| `'success'` | `[✓]` | `var(--f-panel)` bg / `var(--f-ink)` text | `2px solid var(--f-rule)` | `18.74:1` light / `14.63:1` dark |
| `'warning'` | `[!]` | `var(--f-marker)` bg / `var(--f-marker-ink)` text | `2px solid var(--f-marker-ink)` | `15.11:1` (both themes) |
| `'danger'` | `[×]` | `var(--f-ink)` bg / `var(--f-panel)` text | `2px double var(--f-panel)` | `18.74:1` light / `14.63:1` dark |

- In `@media (forced-colors: active)`, `.f12-tag` and `.f12-badge` preserve `border: 1px solid CanvasText` while retaining their orthographic `[i]` / `[✓]` / `[!]` / `[×]` text prefixes.
- On `Badge`, `burst` defaults to `true` when `status` is omitted and `false` when `status` is set (unless `burst={true}` is explicitly passed).

### 1.3 Pattern-Based Data Visualization (`ToneAreaChart` & `ToneBarList`)

1. **`ToneAreaChart` (`registry/ui/tone-area-chart.tsx`):**
   - Renders hollow diamond registration markers (`<polygon className="f12-compare-pt" />`) at labeled x-axis ticks along the dashed comparison series (`.f12-l-focus`), and uses a diamond `<polygon className="f12-cross-dot2" />` during pointer/keyboard inspection.
   - Distinguishes primary vs. comparison series across three non-color channels simultaneously: **area fill** (`45° halftone dots` vs. `unfilled`), **stroke style** (`2.5px solid` vs. `1.75px dashed`), and **point geometry** (`circle` vs. `diamond`).
2. **`ToneBarList` (`registry/ui/tone-bar-list.tsx`):**
   - Adds `pattern?: 'dots' | 'hatch' | 'dense'` (default `'dots'`) to `ToneBarItem` (`.f12-int-fill-hatch`, `.f12-int-fill-dense`) so categorical bars can be differentiated by screentone texture when needed.

### 1.4 Component-Level Density (`density?: 'comfortable' | 'compact'`)

Added `density?: 'comfortable' | 'compact'` (default `'comfortable'`) to:
- `Table` (`registry/ui/table.tsx` -> `.f12-table-compact`: `6px 8px` cell padding, `13px` body font size)
- `Input` (`registry/ui/input.tsx` -> `.f12-field-compact` + `.f12-input-compact`: `6px 10px` input padding, `13px` font size)
- `Select` (`registry/ui/select.tsx` -> `.f12-field-compact` + `.f12-select-compact`: `6px 10px` trigger padding, `13px` font size)
- `ToneBarList` (`registry/ui/tone-bar-list.tsx` -> `.f12-ints-compact`: `7px 10px` row padding, `6px` stack gap)

### 1.5 Three Evaluation Compositions (`eval/screens/`)

1. **`eval/screens/landing-screen.tsx` (Expressive Narrative Dashboard):**
   - Uses `<Sheet autoCut>` with Expressive `2.5px` SVG-framed panels (`C-01..C-05`), `Metric big`, `ToneAreaChart` with diamond comparison markers, and `ToneBarList` with `dots`/`hatch`/`dense` screentone patterns.
2. **`eval/screens/settings-screen.tsx` (Quiet Operational Settings):**
   - Uses `<Panel variant="quiet">`, `<PanelPair variant="quiet">`, `<Metric variant="quiet">`, `Input`/`Select`/`Table` with `density="compact"`, and semantic `<Tag status="...">` / `<Badge status="...">` indicators.
3. **`eval/screens/table-screen.tsx` (Mixed Narrative + Quiet Operational Ledger):**
   - Uses `<Sheet autoCut>` where primary narrative panels (`C-01..C-04`) are automatically numbered, while nested `<Panel variant="quiet">` filter and summary subgroups inside `C-04` remain unnumbered (`0` `.f12-cut` badges inside quiet panels).
