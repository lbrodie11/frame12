# `@frame12/static` ↔ React parity matrix

`@frame12/static` mirrors the React primitives in `registry/ui/*.tsx`. A static renderer must emit
the **same elements, classes, attributes and nesting** as `renderToStaticMarkup(<Component …/>)`
for the same props, so one stylesheet (`registry/styles/frame12.css`) styles both.

This file is the contract. It was committed before any renderer existed. Every React prop
appears below with its static equivalent, or with a documented divergence and the reason.
`packages/static/tests/parity.test.mjs` asserts the "same" rows by comparing normalized
markup and asserts each divergence explicitly.

## Allowed divergences (apply to every row)

| React | Static | Why |
| --- | --- | --- |
| `children: ReactNode` | `children: Html \| string` | No React tree. A `string` is escaped as text, and an `Html` value (a frozen object returned by a renderer, `fragment()` or `unsafeRaw()`, recognised by identity) is inserted as is. Renderers return `Html`; `String(html)` gives the markup. |
| `ref`, `on*` handlers, `className`, `style`, `...rest` HTML attributes | dropped | Static output has no behaviour. Arbitrary attribute or class pass-through would turn the API into an escape hatch around the grammar. |
| `motion?: MotionMode` and motion-only props (`pop`, `burst`, `changed`) | dropped | `useOnTwos` animates only when `key` changes. A static document never changes, so first paint is the resting frame (see **Motion** below). |
| *(none)* | `Panel` `width?` / `height?` | Static-only. React measures with `ResizeObserver`; static output can't, so callers that know the box size can request the exact-pixel polygon. |
| Lenient prop coercion (`console.warn` + fallback) | validation `TypeError` | Static output is often built from untrusted data (commit subjects, file paths). Invalid identifiers, numbers and lengths **throw** instead of being coerced, so nothing unvalidated reaches an attribute, an id, or CSS. See [`README.md#escaping-and-validation`](./README.md#escaping-and-validation). |

### Motion

Every renderer emits the state React reaches at rest: `useOnTwos` returns progress `1` on first
render, `useCountUp` shows the final value, and `GhostWire`'s reveal mask has
`stroke-dashoffset="0"`. `Sheet` always emits `f12-m-cut` (React emits `f12-m-<motion>`, which
is `f12-m-cut` under `prefers-reduced-motion: reduce`). No renderer emits `f12-enter`, `pop` or
`f12-pop`, and the package emits no `<script>`.

### Ids

React ids come from `React.useId()`. Static ids are deterministic. Each is derived from a
stable hash of the renderer's inputs, then `document()` (or `dedupeIds()`) makes duplicates
unique with a counter scoped to that one call. It renames the second and later copies of an
auto `id`, and the ghost wire's own `mask="url(#…)"` that follows it. Text, `href`s and
caller-chosen ids are never rewritten. The parity test normalizes React `useId` fragments and static hash fragments
to the same placeholder before comparing.

## Rows

Legend: **=** same output · **Δ** divergence (reason given) · **+** static-only addition.

### `Sheet` → `sheet()` (`registry/ui/sheet.tsx`)

| React prop | Static | Notes |
| --- | --- | --- |
| `pegs?: boolean = true` | `pegs?: boolean = true` | **=** Emits the same `Pegs` markup (`.f12-pegs` / `.f12-peg slot|round|slot`, `aria-hidden="true"`). |
| `autoCut?: boolean = false` | `autoCut?: boolean = false` | **=** `data-autocut=""` on `.f12-sheet` plus `style="--f12-autocut-display:block\|none"`, exactly as `Sheet`. |
| `theme?: 'light' \| 'dark'` | `theme?: 'light' \| 'dark'` | **=** `f12-theme-<theme>` class and `data-theme` on the outer `.f12-dash`. |
| `motion?: MotionMode = 'stepped'` | dropped | **Δ** Outer class is always `f12-m-cut` (see **Motion**). |
| `sheetClassName?`, `className`, `...rest` | dropped | **Δ** Allowed divergence (no class pass-through). |
| `children` | `children: Html` | **=** Allowed divergence. |

### `Scene` → `scene()` (`registry/ui/scene.tsx`)

| React prop | Static | Notes |
| --- | --- | --- |
| `gutter?: 'pair' \| 'scene' \| 'change' = 'scene'` | same | **=** Same `f12-scene-<gutter>` class and `data-gutter` (12/20/32). **Δ** An unknown value throws (React falls back to `scene`). |
| `layout?: 'split' \| 'stack' \| 'equal' \| 'three' \| 'areas' = 'split'` | same | **=** Non-empty `areas` forces `areas`, as in React. **Δ** An unknown value throws. |
| `areas?: string[]` | `areas?: string[]` | **=** Same `--f12-scene-cols` / `--f12-scene-areas` style and `data-columns`. **Δ** Every cell token must match `^[a-z][a-z0-9-]{0,63}$` (or be a `.` null cell), every row must have the same token count, and each named area must form one rectangle (browsers ignore the whole value otherwise), otherwise it throws. React warns and passes raw strings to CSS. |
| `columns?: number` | `columns?: number` | **=** Used when `areas` is absent (default 12); the areas token count wins when present. **Δ** Must be an integer 1–24, otherwise it throws. A mismatch with the areas token count throws (React warns). |
| `breakpoint?: number \| string = '860px'` | same | **=** Same `data-breakpoint`, and for a custom breakpoint the same scoped `<style>` block keyed by `data-scene-bp`. **Δ** A number must be an integer 10–9999 (px), the same range as the string form. A string must match `^\d{2,4}(px\|rem\|em)$` (React also accepts decimals and bare digits), otherwise it throws. Only the validated, re-serialized value is written into the `<style>` block. The scope suffix is a hash, not `useId`. |
| `className`, `style`, `...rest` | dropped | **Δ** Allowed divergence. |
| `children` | `children: Html` | **=** |

### `SceneArea` → `sceneArea()` (`registry/ui/scene.tsx`)

| React prop | Static | Notes |
| --- | --- | --- |
| `area: string` | `area: string` | **=** `data-area` + `style="--f12-area:<area>"`. **Δ** Must match `^[a-z][a-z0-9-]{0,63}$` or it throws (React trims and passes any string). |
| `children` | `children: Html` | **=** |

### `Panel` → `panel()` (`registry/ui/panel.tsx`)

| React prop | Static | Notes |
| --- | --- | --- |
| `cut?: string \| false` | same | **=** A non-empty string renders `<span class="f12-cut" aria-hidden="true">C-07</span>`. `undefined` on a non-quiet panel renders the empty `<span class="f12-cut" data-autocut="" aria-hidden="true">` that the CSS counter numbers. `false` (or quiet with no cut) renders nothing. The static kit never computes cut numbers. |
| `shape?: 'rect' \| 'slant-bottom' \| 'slant-top' = 'rect'` | same | **=** Same `f12-<shape>` class and polygon. **Δ** An unknown value throws. |
| `variant?: 'expressive' \| 'quiet'` | same | **=** `f12-panel-quiet` + `data-variant="quiet"`; quiet `rect` panels have no SVG frame. **Δ** No context inheritance: React reads `PanelVariantContext`, which only `Tabs` provides. `panelPair()` passes the variant explicitly. |
| `label?: string` | same | **=** `aria-label` (escaped). |
| `area?: string` | same | **=** `data-area` + `--f12-area`. **Δ** Validated identifier (throws). |
| *(measured `w`/`h`)* | `width?: number`, `height?: number` | **+** Without them: the SSR frame `viewBox="0 0 100 100" preserveAspectRatio="none"`, `vector-effect="non-scaling-stroke"`, identical to React's server render (`ssrPts`). With both: the measured frame `<svg width height><polygon points>` using `panel.tsx`'s formula (inset 1.25, slant rise 16), identical to React after `useSize` measures. Both must be finite numbers in `[20, 100000]` (big enough for the 16 px slant plus stroke), and passing only one throws. |
| `className`, `style`, `ref`, `...rest` | dropped | **Δ** Allowed divergence. |
| `children` | `children: Html \| string` | **=** |

### `PanelPair` → `panelPair()` (`registry/ui/panel-pair.tsx`)

| React prop | Static | Notes |
| --- | --- | --- |
| `variant?` | same | **=** Effective pair variant. Quiet slots render `rect`, expressive slots render `slant-bottom` / `slant-top`. |
| `area?` | same | **=** Validated identifier. |
| `top` without `bottom` (or the reverse) | throws | **Δ** React silently renders an empty pair; static throws, in line with its stricter validation. |
| `top?`, `bottom?: Omit<PanelProps,'shape'>` | `top?`, `bottom?: Omit<PanelOpts,'shape'>` | **=** When both are given, `top.cut ?? topCut`, `top.label ?? topLabel` and `top.variant ?? variant`, exactly as React. |
| `topCut?`, `bottomCut?: string \| false` | same | **=** Same rules (`undefined` → auto-cut span, `false` → none). |
| `topLabel?`, `bottomLabel?` | same | **=** |
| `children?: ReactNode` (up to 2 nodes; bare nodes are wrapped in slanted Panels, Panel elements are cloned) | `children?: Html` | **Δ** An `Html` string is opaque and can't be split into slots or have its props cloned. `children` is inserted verbatim inside `.f12-pair`, so pass panels with explicit shapes, or use `top`/`bottom` to get React's slotting rules. When `top` and `bottom` are both set, `children` is ignored, as in React. |
| `className`, `style`, `...rest` | dropped | **Δ** Allowed divergence. |

### `Balloon` → `balloon()` (`registry/ui/balloon.tsx`)

| React prop | Static | Notes |
| --- | --- | --- |
| `tailOffset?: number = 0` | same | **=** Same tail path, dot position and `.f12-balloon-gap` `left: calc(…)` style. **Δ** Must be finite and within `[-36, 36]`, otherwise it throws (React clamps). |
| `showDot?: boolean = true` | same | **=** |
| `children` | `children: Html \| string` | **=** |
| `className`, `...rest` | dropped | **Δ** Allowed divergence. |

### `Tag` (+ `Stamp`) → `tag()` (`registry/ui/tag.tsx`)

| React prop | Static | Notes |
| --- | --- | --- |
| `variant?: 'default' \| 'stamp' = 'default'` | same | **=** Stamps are `tag({ variant: 'stamp' })` (`f12-tag-stamp`, `data-variant="stamp"`). There's no separate `stamp()` function, mirroring `<Stamp>` = `<Tag variant="stamp">`. |
| `status?: 'neutral' \| 'info' \| 'success' \| 'warning' \| 'danger'` | same | **=** `f12-status-<status>` + `data-status`. **Δ** An unknown value throws. |
| `glyph?: string \| false` | same | **=** Status default glyph; `false` hides it. |
| `srLabel?: string \| false` | same | **=** Status default label; it's skipped when the visible text already starts with it (same `startsWithStatusLabel` synonyms). The visible text of an `Html` child is extracted the same way React's `extractTextContent` does, ignoring `aria-hidden` and `hidden` subtrees. |
| `children` | `children: Html \| string` | **=** |

### `Badge` → `badge()` (`registry/ui/badge.tsx`)

| React prop | Static | Notes |
| --- | --- | --- |
| `status?`, `glyph?`, `srLabel?` | same | **=** As `tag()`. |
| `pop?: boolean` | dropped | **Δ** Motion. Never emits `f12-pop pop`. |
| `burst?: boolean` | dropped | **Δ** The `.f12-burst` SVG is decoration for the `pop` motion (it's `opacity: 0` at rest). Static keeps React's default: the burst SVG is emitted exactly when `status` is unset, so the DOM matches `<Badge>` with no `burst` prop. |
| `children` | `children: Html \| string` | **=** |

### `Metric` → `metric()` (`registry/ui/metric.tsx`)

| React prop | Static | Notes |
| --- | --- | --- |
| `label: string` | same | **=** |
| `value: number` | same | **=** `useCountUp` shows the final value on first render. **Δ** Must be finite, otherwise it throws. |
| `format?: (v) => string = fmtMoney` | same | **=** Its return value is escaped as text. |
| `delta?: number` | same | **=** Same `Delta` markup (`f12-delta up\|down\|flat`). **Δ** Must be finite. |
| `deltaKind?: 'pct' \| 'pp' = 'pct'` | same | **=** |
| `comparisonLabel?`, `range?: number \| string` | same | **=** |
| `note?: string` | same | **=** |
| `big?: boolean = false` | same | **=** `big` class + `--f12-m-chars` (settled value length, minimum 4). |
| `variant?: 'expressive' \| 'quiet' = 'expressive'` | same | **=** |
| `headingLevel?: 'h2' \| 'h3' \| 'h4' \| 'div' \| 'p' = 'h2'` | same | **=** **Δ** An unknown value throws. |
| `spark?: ReactNode` | `spark?: Html` | **=** Allowed divergence (Html). |
| `motion?` | dropped | **Δ** Motion. |
| `className?` | dropped | **Δ** Allowed divergence. |
| `fmtPct`, `fmtPPAbs`, `fmtMoney` | exported | **=** Same output (`en-US` fixed). |

### `ToneBarList` → `toneBarList()` (`registry/ui/tone-bar-list.tsx`)

| React prop | Static | Notes |
| --- | --- | --- |
| `title?`, `subtitle?` | same | **=** `<h3 class="f12-m-label">` + `<p class="f12-ints-sub">`. |
| `items: ToneBarItem[]` | same | **=** Same fill width, formatted value, share and pattern classes. Item badges render as `badge({ children })`, which matches `<Badge burst>` at rest. **Δ** `id` must match `^[a-z][a-z0-9-]{0,63}$` (it becomes part of an element id). `value` must be finite and ≥ 0, and `share` must be finite in `[0, 1]`, otherwise it throws. |
| `selectedId?: string \| null` | same | **Δ** The selected row carries `aria-current="true"` instead of `aria-pressed="true"` (see the row element below). It must match the identifier pattern (use `toIdent()` for data-derived ids). |
| fill `<span class="f12-int-fill" data-pattern style="width:N%">` | adds `data-fill="round(N)"` | **Δ** Static-only. `static.css` styles `[data-fill="0…100"]` widths, so bars keep their length (to whole-percent precision) when a host CSP blocks the exact inline `style`. With inline styles allowed the inline width wins and the result is identical. |
| `density?: 'comfortable' \| 'compact'` | same | **=** |
| `idPrefix?: string` | same | **=** Row ids are `int-<idPrefix>-<id>`. **Δ** Validated identifier. The default prefix is `f12-s<hash>` (React: `f12-<useId>`). |
| row element `<button type="button" class="f12-int-row" aria-pressed>` | `<div class="f12-int-row" data-static="">` | **Δ** A static page has no handler, and an inert `<button>` would look and announce as clickable without being one. The row keeps the same class and children, so layout is identical. The `data-static` and `aria-current` variants are styled by rules added to the canonical `frame12.css` in a separate parity commit (no pointer cursor, no hover underline, same selected styling). |
| `onSelect?`, `motion?`, `changed?` | dropped | **Δ** Interactive / motion. |
| `className?` | dropped | **Δ** Allowed divergence. |

### `GhostWire` → `ghostWire()` (`registry/ui/ghost-wire.tsx`)

| React prop | Static | Notes |
| --- | --- | --- |
| `from`, `to: ReactNode` | `from`, `to: Html \| string` | **=** Allowed divergence. The default `aria-label` is built from their visible text, as in React. |
| `label?: string` | same | **=** |
| `strength?: number = 0.5` | same | **=** Same `stroke-dasharray` and `data-strength`. **Δ** Must be finite in `[0, 1]`, otherwise it throws (React clamps). |
| `orientation?: 'auto' \| 'horizontal' \| 'vertical' = 'auto'` | same | **=** For `horizontal`/`vertical`. **Δ** `auto` keeps the `f12-ghost-wire-auto` class but resolves to `data-orientation="horizontal"` (React's server render and first paint). React then measures and switches to vertical below 520 px; static can't measure, so pass `orientation: 'vertical'` for narrow targets. |
| `motion?` | dropped | **Δ** Motion. The reveal mask is at rest (`stroke-dashoffset="0"`). |
| mask id `f12-gw-mask-<slug>-<useId>` | `f12-gw-mask-<slug>-s<hash>` | **Δ** Deterministic, made unique per `document()` (see **Ids**). |
| `className`, `aria-label`, `...rest` | dropped | **Δ** Allowed divergence. |

### `Receipt` → `receipt()` (`registry/ui/receipt.tsx`)

| React prop | Static | Notes |
| --- | --- | --- |
| `kind: 'commit' \| 'file' \| 'link'` | same | **=** Commit values are truncated to 7 characters, with the full SHA in `title` and `.f12-sr-only`. **Δ** An unknown value throws (React falls back to `file`). |
| `value: string` | same | **=** Escaped text. |
| `href?: string` | same | **Δ** Uses `safeUrl()`: `http:`, `https:`, `mailto:` and same-document `#fragment` only. React additionally allows root-relative `/path` and doesn't allow `mailto:`. Static pages are often opened from `file://` or a CI artifact host, where a root-relative path resolves somewhere unintended. A rejected href fails closed: no `<a>`, and the value renders as text. |
| `title?`, `date?` | same | **=** |
| `origin?: 'human' \| 'agent' \| 'bot'` | same | **=** Same glyph + `.f12-sr-only` prefix. **Δ** An unknown value throws. |
| `className`, `...rest` | dropped | **Δ** Allowed divergence. |

### `ReceiptList` → `receiptList()` (`registry/ui/receipt.tsx`)

| React prop | Static | Notes |
| --- | --- | --- |
| `children` (`<Receipt>` elements, each wrapped in `<li class="f12-receipt-item">`) | `items: ReceiptOpts[]` | **Δ** The list owns its items, so every item is a validated receipt. Output equals React with one `<Receipt>` child per item. |
| `ariaLabel?: string` | same | **=** Default `Evidence receipts`. |
| `className`, `...rest` | dropped | **Δ** Allowed divergence. |

### Static-only helpers (no React counterpart)

| Function | Purpose |
| --- | --- |
| `document()` | **+** A self-contained page: `<!doctype html>`, charset, viewport, `<style data-f12-tokens>`, `<style data-f12-static>`, body. It de-duplicates auto ids. |
| `fragment(...parts)` | **+** Concatenates `Html` parts and escapes strings. `Html` values joined with `+` become plain strings and would be escaped. React's equivalent is `<>…</>`. |
| `toIdent(s)` | **+** Turns any string into a valid identifier (valid ones unchanged; others slugged plus a hash). |
| `dedupeIds(html)` | **+** The auto-id de-duplication `document()` applies, for pages assembled without it. Touches only auto `id`s and the ghost wire's own `mask` reference. |
| `unsafeRaw(trustedHtml)` | **+** The only way to bypass escaping. |
| `escapeHtml(s)`, `safeUrl(u)` | **+** Exported building blocks of the escaping contract. |

### Not mirrored in this package

`ToneSpark`, `ToneAreaChart`, `Table`, form controls, overlays and other interactive adapters
have no static renderer yet. `Metric`'s `spark` accepts any `Html`. SVG/PNG export and
`renderCard` arrive in F12-05, and page-level quiet semantics in F12-06.
