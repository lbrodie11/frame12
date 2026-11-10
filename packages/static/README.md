# @frame12/static

Framework-free HTML renderers for [FRAME/12](https://frame12.dev). They're pure functions that
return escaped, deterministic HTML strings with the **same DOM, classes and attributes** as the
React components in the shadcn registry. A page made with `@frame12/static` and a page made with
`<Sheet>`/`<Panel>` are styled by the same canonical CSS and look the same.

Use it where React can't run: CI reports, PR pages, static exports, CLI-generated HTML and
VS Code webviews.

- **Zero runtime dependencies** other than [`@frame12/tokens`](../tokens).
- **No scripts, no motion, no network requests** in the output.
- **Contextual escaping by default.** `unsafeRaw()` is the only bypass.
- **Deterministic.** The same input always gives byte-identical output.

[`PARITY.md`](https://github.com/lbrodie11/frame12/blob/main/packages/static/PARITY.md) lists every React prop and its static equivalent or documented divergence.

## Install

```bash
npm install @frame12/static
```

## Render a page

```js
import { document, sheet, scene, panel, panelPair, metric, ghostWire, receiptList, fragment, fmtPct } from '@frame12/static';

const body = sheet({
  autoCut: true, // panels without a cut are numbered C-01, C-02… by the stylesheet
  children: scene({
    areas: ['summary metrics', 'risk evidence'],
    children: fragment(
      panel({ area: 'summary', label: 'Change summary', children: pr.summary }), // strings are escaped
      panelPair({
        area: 'metrics',
        top: { children: metric({ label: 'Lines changed', value: pr.lines, format: (v) => v.toLocaleString('en-US') }) },
        bottom: { children: metric({ label: 'Coverage', value: pr.coverage, format: fmtPct, delta: pr.coverageDelta }) },
      }),
      panel({ area: 'risk', children: ghostWire({ from: pr.changedFile, to: pr.coupledFile, strength: 0.8, orientation: 'vertical' }) }),
      panel({ area: 'evidence', children: receiptList({ items: pr.receipts }) }),
    ),
  }),
});

const html = document({ title: pr.title, body }); // a complete, self-contained page
```

`document()` returns `<!doctype html>`, charset, viewport, `<style data-f12-tokens>` (the
`@frame12/tokens` `cssText`), `<style data-f12-static>` (this package's `static.css`), then
your body.

Compose children with `fragment(...)`. Joining two `Html` values with `+` produces a plain
string, which the next renderer escapes as text.

## API

| Function | Mirrors |
| --- | --- |
| `document({ title, lang?, body, theme?: 'auto'\|'light'\|'dark', variant?, inlineCss? = true })` | A full page |
| `sheet({ pegs?, autoCut?, theme?, children })` | `<Sheet>` |
| `scene({ gutter?, layout?, areas?, columns?, breakpoint?, children })` | `<Scene>` |
| `sceneArea({ area, children })` | `<SceneArea>` |
| `panel({ cut?, shape?, variant?, label?, area?, width?, height?, children })` | `<Panel>` |
| `panelPair({ variant?, area?, top?, bottom?, topCut?, bottomCut?, topLabel?, bottomLabel?, children? })` | `<PanelPair>` |
| `balloon({ tailOffset?, showDot?, children })` | `<Balloon>` |
| `tag({ variant?: 'default'\|'stamp', status?, glyph?, srLabel?, children })` | `<Tag>` / `<Stamp>` |
| `badge({ status?, glyph?, srLabel?, children })` | `<Badge>` |
| `metric({ label, value, format?, delta?, deltaKind?, comparisonLabel?, range?, note?, big?, variant?, headingLevel?, spark? })` | `<Metric>` |
| `toneBarList({ title?, subtitle?, items, selectedId?, density?, idPrefix? })` | `<ToneBarList>` |
| `ghostWire({ from, to, label?, strength?, orientation? })` | `<GhostWire>` |
| `receipt({ kind, value, href?, title?, date?, origin? })` | `<Receipt>` |
| `receiptList({ items, ariaLabel? })` | `<ReceiptList>` |
| `fragment(...parts)` | `<>…</>` |
| `unsafeRaw(trustedHtml)`, `escapeHtml(s)`, `safeUrl(u)`, `isHtml(v)` | Escaping building blocks |
| `fmtPct`, `fmtPPAbs`, `fmtMoney` | Same output as React (`en-US`) |
| `staticCss` | The generated CSS as a string |

Every renderer returns `Html`, a branded string. Stamps are `tag({ variant: 'stamp' })`, as in
React. Interactive and motion props (`onSelect`, `motion`, `pop`, `changed`, handlers, refs,
`className`) aren't offered. `toneBarList` shows `selectedId` as the selected state, but its
rows are plain `<div data-static>` elements, never inert buttons.

## Escaping and validation

The security contract:

- **Text** is HTML-escaped exactly once. Control characters and lone surrogates become U+FFFD.
  `Html` values are inserted as is and never re-escaped.
- **Attributes** are always double-quoted, with `& < > " '` escaped.
- **URLs** (`receipt.href`) go through `safeUrl()`. Only `http:`, `https:`, `mailto:` and
  same-document `#fragment` are allowed. Control characters, whitespace, backslashes,
  entity-encoded schemes (`&#106;avascript:`) and every other scheme are rejected. Validation
  fails closed: no `href` is rendered, and the value is shown as text.
- **Identifiers** (`area`, `areas` cells, `idPrefix`, `selectedId`, tone-bar item `id`s) must
  match `^[a-z][a-z0-9-]{0,63}$`, otherwise the renderer throws a `TypeError`.
- **Numbers** (`breakpoint`, `columns`, `width`, `height`, `strength`, `tailOffset`, `value`,
  `share`, `delta`) must be finite and in range, otherwise the renderer throws. A string
  `breakpoint` must match `^\d{2,4}(px|rem|em)$`. Only these validated, re-serialized values ever
  reach CSS (inline custom properties and the scoped `<style>` for a custom `breakpoint`);
  caller strings are never interpolated into CSS.
- **`lang`** must be a BCP 47-shaped tag, otherwise `en`. **`title`** is escaped.

### `Html` branding is not a security boundary

`Html` is a TypeScript brand. It's a compile-time aid only: anyone can write `'<b>' as Html`.
At runtime, the kit recognises markup through an internal registry of strings that its
renderers, `fragment()` and `unsafeRaw()` produced, so a string that was only *cast* to `Html` is
still escaped. Don't rely on the type for safety. Rely on never passing untrusted input to
`unsafeRaw()`.

### `unsafeRaw()`: the only bypass

`unsafeRaw(trustedHtml)` marks a string as `Html` without escaping it. The name is meant to be
alarming. Use it only for markup you wrote yourself, as a literal in your source code.

**Never pass** any of these to `unsafeRaw()`:

- commit subjects, messages, author names or emails
- file names and paths
- PR or issue titles, bodies, comments and labels
- branch, tag or repository names
- CI logs and tool output
- anything from user input, a network request, a database or an environment variable

Pass those as plain strings to a renderer, which escapes them.

`@frame12/lint`'s `lintHtml()` runs over the package's output in the test suite as defense in
depth (rule `unsafe-html`). It's a grammar and safety *checker*, not a sanitizer, so never use it
to make untrusted HTML safe.

## Geometry

`panel()` can't measure itself the way React's `Panel` does with `ResizeObserver`. By default
it emits React's server-render frame: a `viewBox="0 0 100 100"` polygon with
`preserveAspectRatio="none"` and `vector-effect: non-scaling-stroke`, which stretches to any box.
In that mode the slant rise is 6.45% of the panel height, the same as React before hydration.

When you know the box size, pass `width` and `height` (px) to get the exact pixel polygon React
draws after measuring (stroke inset 1.25, slant rise 16):

```js
panel({ shape: 'slant-bottom', width: 640, height: 280, children: '…' });
```

## Auto-cut

`sheet({ autoCut: true })` sets `data-autocut` and `--f12-autocut-display` exactly like
`<Sheet autoCut>`. Panels inside it with `cut` unset emit an empty
`<span class="f12-cut" data-autocut>`, and the stylesheet's CSS counter numbers them
`C-01`, `C-02`… in DOM order. `cut: 'C-07'` renders that text, and `cut: false` renders no cut.
The kit never computes cut numbers itself, so React and static output can't disagree.

## Motion

None. `useOnTwos` animates only when its key changes, and a static document never changes, so
the output is the resting frame: full first paint, no `<script>`, no entrance classes. `<Sheet>`'s
motion class is always `f12-m-cut`. React-equivalent stepped motion for interactive static pages
is a separate, later change.

## Ids

Auto ids (`ghostWire` masks, `toneBarList` rows without `idPrefix`) are derived from a hash of the
renderer's inputs, so fragments are deterministic. `document()` makes duplicates unique with a
counter scoped to that one call and rewrites the `url(#…)` references that follow them. If you
build pages without `document()`, pass `idPrefix` or avoid rendering identical ghost wires twice.

## Targets

- **Standalone modern-browser HTML** (first-class): `document()` with the default
  `inlineCss: true`. The page makes no requests.
- **CSP-restricted hosts** (VS Code webviews, strict `style-src`): render with
  `document({ inlineCss: false })` and load both stylesheets as resources allowed by the host's
  CSP. Never loosen the host CSP to fit the page.

  ```js
  const page = document({ title, body, inlineCss: false });
  // In a VS Code webview, inject before </head>:
  //   <link rel="stylesheet" href="${webview.asWebviewUri(tokensCssUri)}">   // @frame12/tokens/tokens.css
  //   <link rel="stylesheet" href="${webview.asWebviewUri(staticCssUri)}">   // @frame12/static/static.css
  ```

  Both files are package exports (`@frame12/tokens/tokens.css`, `@frame12/static/static.css`).
- **Email** is not a target. Mail clients drop `<style>`, CSS custom properties, grid and SVG.
  An email adapter may come later.

## Fonts

No webfonts are loaded. The page falls back to the metric-matched stacks in `@frame12/tokens`
(`f12DisplayFallback`, `f12BodyFallback`, `f12MonoFallback`, …). To use the real faces, serve
them yourself and declare the `--font-*` variables the tokens read:

```css
@font-face { font-family: "Dela Gothic One"; src: url("/fonts/dela-gothic-one-400.woff2") format("woff2"); font-display: swap; }
@font-face { font-family: "Zen Kaku Gothic New"; src: url("/fonts/zen-kaku-gothic-new-400.woff2") format("woff2"); font-display: swap; }
@font-face { font-family: "M PLUS 1 Code"; src: url("/fonts/m-plus-1-code-400.woff2") format("woff2"); font-display: swap; }
```

The token stacks already list `"Dela Gothic One"`, `"Zen Kaku Gothic New"` and
`"M PLUS 1 Code"` first, so declaring the faces is enough.

## `static.css`

`dist/static.css` is generated at build time from the canonical
`registry/styles/frame12.css` by `scripts/build-static-css.mjs`, using a small, tested CSS
tokenizer (no dependencies):

1. The token block is left out, because it ships in `@frame12/tokens`.
2. A selector is kept only when every class and attribute it references is in the static class
   manifest (`src/manifest.ts`), which lists everything the renderers can emit. Enclosing
   `@media`/`@container`/`@supports` blocks and referenced `@keyframes` are kept. Focus-visible
   and screen-reader-only rules are always kept.
3. Gates fail the build when a manifest class has no rule (unless a `CLASS_EXCEPTIONS` entry
   gives a reason), when the output references a class outside the manifest (dead weight), or
   when a `var()` without a fallback is never defined.

`frame12.css` stays canonical, so `static.css` never needs editing by hand.

The canonical stylesheet's component internals use spacing such as `gap: 6px` inside chips and
rows, plus a `#fff` mask stroke. Run through `lintHtml()` as page CSS, `static.css` reports
those as `illegal-gutter`, `color-literal` and `marker-misuse` findings. `frame12.css` is exempt
from the linter by file name. The test suite pins the exact list, so any new finding fails it,
and `unsafe-html` findings must be zero.

## License

MIT
