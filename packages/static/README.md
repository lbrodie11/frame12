# @frame12/static

Framework-free HTML renderers for [FRAME/12](https://frame12.dev). They're pure functions that
return escaped, deterministic HTML (as `Html` values; `String(html)` gives the markup) with the **same DOM, classes and attributes** as the
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

const page = document({ title: pr.title, body }); // a complete, self-contained page
fs.writeFileSync('report.html', String(page));    // Html is an object: String() gives the markup
```

`document()` returns `<!doctype html>`, charset, viewport, `<style data-f12-tokens>` (the
`@frame12/tokens` `cssText`), `<style data-f12-static>` (this package's `static.css`), then
your body.

Compose children with `fragment(...)`. `String(html)`, `${html}` and `a + b` all produce plain
strings, which the next renderer escapes as text.

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
| `toIdent(s)` | Turns any string (a file path, a title) into a valid identifier for `area`, `idPrefix`, `selectedId` and tone-bar item ids |
| `dedupeIds(html)` | Makes auto ids unique when you assemble a page without `document()` |
| `fmtPct`, `fmtPPAbs`, `fmtMoney` | Same output as React (`en-US`) |
| `staticCss` | The generated CSS as a string |

Every renderer returns `Html`: a frozen object whose `toString()`, `valueOf()` and `toJSON()`
return the markup. Write it with `String(html)`; TypeScript rejects passing an `Html` where a
`string` is expected, so a missing `String()` fails at compile time. Stamps are `tag({ variant: 'stamp' })`, as in
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
  match `^[a-z][a-z0-9-]{0,63}$`, otherwise the renderer throws a `TypeError`. When ids come from
  data (file paths, names), pass them through `toIdent()`, which keeps valid identifiers and
  turns anything else into a deterministic, collision-resistant one (`src/Foo.ts` →
  `src-foo-ts-<hash>`), so one odd value can't take down a report. Each named area in `areas`
  must form one rectangle, and `panelPair` needs both `top` and `bottom` (or neither).
- **Options** must be objects: `receipt(null)` throws the same `[@frame12/static receipt()] …`
  `TypeError` as any other invalid input.
- **Numbers** (`breakpoint`, `columns`, `width`, `height`, `strength`, `tailOffset`, `value`,
  `share`, `delta`) must be finite and in range, otherwise the renderer throws. A string
  `breakpoint` must match `^\d{2,4}(px|rem|em)$`, and a number must be an integer from 10 to 9999
  (px), the same range. Only these validated, re-serialized values ever
  reach CSS (inline custom properties and the scoped `<style>` for a custom `breakpoint`);
  caller strings are never interpolated into CSS.
- **`lang`** must be a BCP 47-shaped tag, otherwise `en` (the one input that falls back instead
  of throwing, as the F12-04 contract specifies). **`title`** is escaped.

### How `Html` is recognised

Trust is decided by **object identity, not text**. Only `Html` objects created inside this
package (by a renderer, `fragment()` or `unsafeRaw()`) carry a private field; `isHtml()` checks
that field. A plain string is always escaped, even when its text equals markup the kit rendered
earlier, so replaying a previous render's output as, say, a commit subject shows it as text. A
forged object (`Object.create(…)`, `{ toString() {…} }`) is rejected with a `TypeError`. Nothing
is cached: an `Html` is garbage-collected like any object, and output never depends on what was
rendered before.

The TypeScript type is a compile-time aid, not the security boundary: a cast such as
`'<b>' as unknown as Html` compiles, but the runtime check still escapes or rejects it. The
boundary is the rule below: never pass untrusted input to `unsafeRaw()`.

One consequence: `Html` from two different copies of `@frame12/static` (for example two
versions installed side by side) isn't recognised across copies and is escaped. Keep one copy.

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
counter scoped to that one call. It only rewrites two attributes inside tags: an auto `id`, and
the `mask="url(#…)"` with which the same ghost wire references its own mask. Text, `href`s and
caller-chosen ids (`idPrefix`) are never touched. If you assemble a page without `document()`,
call `dedupeIds(fragment(...))` on it.

## Targets

- **Standalone modern-browser HTML** (first-class): `document()` with the default
  `inlineCss: true`. The page makes no requests.
- **CSP-restricted hosts** (VS Code webviews, strict `style-src`): render with
  `document({ inlineCss: false })` and load both stylesheets as resources allowed by the host's
  CSP.

  Renderers still put a few per-instance values in `style` attributes, exactly like React
  (tone-bar widths, named-area placement, the balloon tail offset, hero metric sizing). A host
  CSP decides what happens to them:

  | Host policy | Result |
  | --- | --- |
  | `style-src <host>; style-src-attr 'unsafe-inline'` (**recommended**) | Identical to the inline page. `style-src-attr` allows only style *attributes*, not `<style>` elements or scripts. |
  | `style-src <host>` (fully strict) | Still correct and readable: cut labels stay numbered (`[data-autocut]` rule), tone-bar lengths come from `data-fill` (whole-percent precision), and the balloon seam uses its centred default. Named areas fall back to one full-width column in DOM order, a non-zero balloon `tailOffset` loses its seam offset, and big metrics use the default hero size. A scene with a custom `breakpoint` also stacks, because its scoped `<style>` element is blocked. |

  Don't loosen a host's policy beyond that to fit the page. Both rows are tested in Chromium,
  Firefox and WebKit with a real `Content-Security-Policy` header.

  ```js
  const page = String(document({ title, body, inlineCss: false }));
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
   gives a reason), when the output references a class outside the manifest (dead weight), when
   a `var()` without a fallback is never defined, or when `frame12.css` contains an at-rule the
   generator doesn't handle (a statement at-rule such as `@layer a, b;`, an `@keyframes` nested
   in a condition, `@page`, …) rather than dropping or hoisting it.
4. Two static-only blocks are appended, both using tokens only: a zero-specificity document base
   (`html`/`body` background, margin and font), and the strict-CSP fallbacks described under
   **Targets** (`.f12-int-fill[data-fill]` widths and a one-column fallback for named-area
   scenes whose inline custom properties are blocked).

`frame12.css` stays canonical, so `static.css` never needs editing by hand.

The canonical stylesheet's component internals use spacing such as `gap: 6px` inside chips and
rows, plus a `#fff` mask stroke. Run through `lintHtml()` as page CSS, `static.css` reports
those as `illegal-gutter`, `color-literal` and `marker-misuse` findings. `frame12.css` is exempt
from the linter by file name. The test suite pins the exact list, so any new finding fails it,
and `unsafe-html` findings must be zero.

## License

MIT
