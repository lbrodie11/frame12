# Static HTML with `@frame12/static`

`@frame12/static` renders FRAME/12 pages without React. Each function returns an `Html` string
with the **same DOM, classes and attributes** as the React primitive it mirrors, so the
canonical stylesheet styles both. Use it for CI reports, PR pages, CLI-generated HTML, static
exports and VS Code webviews. The contract, prop by prop, is in
[`packages/static/PARITY.md`](../../../packages/static/PARITY.md).

## Install

```bash
npm install @frame12/static
```

The only runtime dependency is `@frame12/tokens`.

## API

```ts
type Html = string & { readonly [brand]: true }; // compile-time aid only, see "Escaping"

document(o: { title: string; lang?: string; body: Html; theme?: 'auto' | 'light' | 'dark'; variant?: 'expressive' | 'quiet'; inlineCss?: boolean /* default true */ }): Html
sheet(o: { pegs?: boolean; autoCut?: boolean; theme?: 'light' | 'dark'; children: Html | string }): Html
scene(o: { gutter?: 'pair' | 'scene' | 'change'; layout?: 'split' | 'stack' | 'equal' | 'three' | 'areas'; areas?: string[]; columns?: number; breakpoint?: number | string; children: Html | string }): Html
sceneArea(o: { area: string; children: Html | string }): Html
panel(o: { cut?: string | false; shape?: 'rect' | 'slant-bottom' | 'slant-top'; variant?: 'expressive' | 'quiet'; label?: string; area?: string; width?: number; height?: number; children?: Html | string }): Html
panelPair(o: { variant?; area?; top?: Omit<PanelOpts, 'shape'>; bottom?: Omit<PanelOpts, 'shape'>; topCut?: string | false; bottomCut?: string | false; topLabel?: string; bottomLabel?: string; children?: Html | string }): Html
balloon(o: { tailOffset?: number /* -36..36 */; showDot?: boolean; children: Html | string }): Html
tag(o: { variant?: 'default' | 'stamp'; status?: 'neutral' | 'info' | 'success' | 'warning' | 'danger'; glyph?: string | false; srLabel?: string | false; children: Html | string }): Html
badge(o: { status?; glyph?: string | false; srLabel?: string | false; children: Html | string }): Html
metric(o: { label: string; value: number; format?: (v: number) => string; delta?: number; deltaKind?: 'pct' | 'pp'; comparisonLabel?: string; range?: number | string; note?: string; big?: boolean; variant?: 'expressive' | 'quiet'; headingLevel?: 'h2' | 'h3' | 'h4' | 'div' | 'p'; spark?: Html }): Html
toneBarList(o: { title?: string; subtitle?: string; items: { id: string; name: string; value: number; formattedValue?: string; share?: number; badge?: string; pattern?: 'dots' | 'hatch' | 'dense' }[]; selectedId?: string | null; density?: 'comfortable' | 'compact'; idPrefix?: string }): Html
ghostWire(o: { from: Html | string; to: Html | string; label?: string; strength?: number /* 0..1 */; orientation?: 'auto' | 'horizontal' | 'vertical' }): Html
receipt(o: { kind: 'commit' | 'file' | 'link'; value: string; href?: string; title?: string; date?: string; origin?: 'human' | 'agent' | 'bot' }): Html
receiptList(o: { items: ReceiptOpts[]; ariaLabel?: string }): Html
fragment(...parts: Array<Html | string | null | undefined | false>): Html
unsafeRaw(trustedHtml: string): Html // the ONLY way to bypass escaping
escapeHtml(s: string): string
safeUrl(u: string): string | null
fmtPct, fmtPPAbs, fmtMoney // same output as React (en-US)
```

## Example

```js
import { document, sheet, scene, panel, metric, receiptList, fragment } from '@frame12/static';

const html = document({
  title: pr.title, // escaped
  body: sheet({
    autoCut: true, // cuts are numbered by CSS: never compute C-01… yourself
    children: scene({
      areas: ['summary evidence'],
      children: fragment(
        panel({ area: 'summary', label: 'Summary', children: pr.body }), // plain string: escaped
        panel({ area: 'evidence', children: receiptList({ items: pr.commits.map((c) => ({ kind: 'commit', value: c.sha, href: c.url })) }) }),
      ),
    }),
  }),
});
```

## Escaping rules

- Text is escaped exactly once. `Html` is never re-escaped.
- Attributes are always quoted, with `& < > " '` escaped.
- `href`s go through `safeUrl()`: `http:`, `https:`, `mailto:` and `#fragment` only. Anything
  else (`javascript:`, `data:`, `vbscript:`, whitespace- or entity-obfuscated schemes) renders
  no link, and the value is shown as text.
- `area`, `areas` cells, `idPrefix`, `selectedId` and tone-bar item ids must match
  `^[a-z][a-z0-9-]{0,63}$`. Numbers must be finite and in range. A string `breakpoint` must match
  `^\d{2,4}(px|rem|em)$`. Anything else throws a `TypeError`, and caller strings never reach CSS.
- `Html` branding is a **compile-time aid, not a security boundary**. At runtime only strings the
  kit produced are trusted, so a string cast to `Html` is still escaped.

## `unsafeRaw()` warning

`unsafeRaw()` is the only bypass, and its name is meant to be alarming. Use it only for
literal markup in your own source. **Never pass** commit subjects or messages, author names,
file names or paths, PR or issue titles, bodies or comments, branch names, CI logs, or any user
or network input. Pass those as plain strings to a renderer instead. `lintHtml()` (rule
`unsafe-html`) is a checker run as defense in depth, not a sanitizer.

## Mistakes to avoid

| Don't | Do |
| --- | --- |
| Hand-write `<div class="f12-panel">…` markup | `panel({ … })` |
| `panel(a) + panel(b)` | `fragment(panel(a), panel(b))` |
| `cut: 'C-01'` inside `sheet({ autoCut: true })` | Leave `cut` unset (or `false`) |
| `unsafeRaw(commit.subject)` | `panel({ children: commit.subject })` |
| Interpolating ids or classes from data | `idPrefix: 'pr-142'` (validated) |
| Expecting motion or interactivity | Static output is the resting frame. There are no inert buttons (`toneBarList` rows are `<div data-static>`) |
| Loosening a webview CSP for inline styles | `document({ inlineCss: false })` + `tokens.css` + `static.css` |
