# `@frame12/lint`

Zero-dependency design-grammar checker for [FRAME/12](../../README.md) across TypeScript/JSX (`.tsx`, `.ts`, `.jsx`, `.js`), CSS (`.css`), and generated HTML (`lintHtml()`).

> **Distribution status:** `@frame12/lint` is currently a workspace package in the `lbrodie11/frame12` monorepo (`packages/lint`) and is not yet published to the public npm registry.

---

## Usage

### Library API

```ts
import {
  lintSource,
  lintFiles,
  collectFiles,
  lintHtml,
  RULES,
  type RuleId,
  type Violation,
} from '@frame12/lint';

// 1. Lint TSX / JSX / TS / JS / CSS source text
const tsxViolations: Violation[] = lintSource(code, 'src/app/page.tsx');

// 2. Lint generated HTML documents or fragments
const htmlViolations: Violation[] = lintHtml(htmlString, {
  file: 'report.html',
  tokenStyleIds: ['f12-tokens'], // <style id="f12-tokens"> or <style data-f12-tokens> is exempt
});

// 3. Lint directories or file paths on disk
const { files, violations } = lintFiles(['src/components', 'src/app']);
```

### CLI (`frame12-lint`)

```bash
npx frame12-lint src/app src/components
# PASS  check-frame12: 42 file(s) checked, 0 violations.
```

### Optional `typescript` Peer Dependency

`typescript` (`>=5.0.0`) is an **optional** peer dependency:
- When `typescript` is installed, `lintSource()` parses JSX/TSX with the TypeScript compiler AST (`ts.createSourceFile`) to trace `cut-order` and `explicit-cut-in-autocut` through spread props, local variable identifiers, and `<PanelPair>` slots.
- When `typescript` is not installed (for example, in a standalone HTML generator that only calls `lintHtml()`), `lintHtml()` and all CSS/regex source rules work with zero dependencies, and `lintSource()` falls back to its built-in regex cut scanner without crashing.

---

## Rules

Every violation carries a stable `rule` ID (`RuleId`), `file`, 1-based `line` and `column`, human-readable `message`, and `snippet`.

| Rule ID | Summary |
| :--- | :--- |
| [`color-literal`](#color-literal) | Forbid hard-coded color literals (`#hex`, `rgb`/`hsl`/`oklch`, CSS gradients, font names) outside token definitions; use `var(--f-*)` tokens. |
| [`illegal-gutter`](#illegal-gutter) | Permit only `0`, `12px` (`--f-gutter-pair`), `20px` (`--f-gutter-scene`), or `32px` (`--f-gutter-change`) gutters on `gap`, `grid-gap`, `row-gap`, and `column-gap`. |
| [`marker-misuse`](#marker-misuse) | Permit `--f-marker` (`#ffd60a`) only as a surface background paired with `color: var(--f-marker-ink)` in the same rule; never on text, borders, outlines, shadows, or SVG strokes/fills. |
| [`cut-order`](#cut-order) | Require panel cut labels (`C-01`, `C-02`, …) to use two-digit formatting and appear in strict sequential reading order starting at `C-01` without gaps or duplicates. |
| [`explicit-cut-in-autocut`](#explicit-cut-in-autocut) | Forbid explicit `cut` props on `Panel`/`PanelPair` inside `<Sheet autoCut>` where cuts are numbered automatically. |
| [`raw-shadcn-import`](#raw-shadcn-import) | Forbid raw `@/components/ui/*`, `@radix-ui/*`, or third-party chart/motion imports where a FRAME/12 component or adapter exists. |
| [`unsafe-html`](#unsafe-html) | Forbid external `<script src="…">` tags, inline `on*=` event handler attributes, and `javascript:` URLs in generated HTML. |

---

### `color-literal`

Forbid hard-coded color literals (`#hex`, `rgb()`, `hsl()`, `oklch()`, CSS gradients, and raw font-family names) outside token files (`frame12.css`, `frame12-tokens.css`, `<style data-f12-tokens>`, or `opts.tokenStyleIds`). Use `var(--f-*)` and `var(--font-f-*)` tokens instead.

**Bad:**
```css
.card {
  background: #ffffff;
  color: rgb(18, 18, 18);
  background-image: linear-gradient(180deg, #fff, #eee);
  font-family: "Dela Gothic One", sans-serif;
}
```

**Good:**
```css
.card {
  background: var(--f-panel);
  color: var(--f-ink);
  font-family: var(--font-f-display);
}
```

---

### `illegal-gutter`

Permit only `0`, `12px` (`--f-gutter-pair`), `20px` (`--f-gutter-scene`), or `32px` (`--f-gutter-change`) gutters on `<Scene gutter="...">`, CSS `gap` / `grid-gap` / `row-gap` / `column-gap`, inline styles, and Tailwind `gap-*` classes.

**Bad:**
```html
<div class="grid gap-4" style="gap: 14px"></div>
```

**Good:**
```html
<div class="grid gap-gutter-scene" style="gap: var(--f-gutter-pair)"></div>
```

---

### `marker-misuse`

Permit `--f-marker` (`#ffd60a`) only as a surface background paired with `color: var(--f-marker-ink)` in the same CSS rule or inline style object. Never use `--f-marker` on `color`, `border`, `outline`, `box-shadow`, or SVG `stroke` / `fill`.

**Bad:**
```css
.focus-ring:focus-visible {
  outline: var(--f-stroke) solid var(--f-marker);
}
.badge {
  background: var(--f-marker);
}
```

**Good:**
```css
.focus-ring:focus-visible {
  outline: var(--f-stroke) solid var(--f-rule);
}
.badge {
  background: var(--f-marker);
  color: var(--f-marker-ink);
}
```

---

### `cut-order`

Require panel cut labels (`C-01`, `C-02`, `C-03`, …) to use two-digit `C-NN` formatting, start at `C-01`, and increase sequentially by 1 in DOM/reading order without gaps or duplicates. Quiet panels (`variant="quiet"`) must not carry cut labels, and `data-cut="auto"` (or empty `data-cut=""`) is ignored.

**Bad:**
```html
<section class="panel" data-cut="1">First</section>
<section class="panel" data-cut="C-03">Skipped C-02</section>
```

**Good:**
```html
<section class="panel" data-cut="C-01">First</section>
<section class="panel" data-cut="C-02">Second</section>
```

---

### `explicit-cut-in-autocut`

Forbid explicit `cut`, `topCut`, or `bottomCut` props on `<Panel>` or `<PanelPair>` inside `<Sheet autoCut>` where cut numbers are assigned automatically.

**Bad:**
```tsx
<Sheet autoCut>
  <Panel cut="C-01" title="Overview">...</Panel>
</Sheet>
```

**Good:**
```tsx
<Sheet autoCut>
  <Panel title="Overview">...</Panel>
</Sheet>
```

---

### `raw-shadcn-import`

Forbid raw `@/components/ui/*` imports, `@radix-ui/*` primitives, or third-party chart/animation libraries (`recharts`, `chart.js`, `d3`, `framer-motion`, `gsap`) where a FRAME/12 component, adapter, or hook exists.

**Bad:**
```tsx
import { Button } from '@/components/ui/button';
import * as DialogPrimitive from '@radix-ui/react-dialog';
```

**Good:**
```tsx
import { Button, Dialog, DialogContent } from '@/components/frame12';
```

---

### `unsafe-html`

Active in `lintHtml()`. Forbid external `<script src="…">` tags, inline event handler attributes (`onclick=`, `onload=`, `onerror=`, …), and `javascript:` URLs in attribute values. Self-contained inline `<script>` elements without `src` (such as the on-twos pose clock) are permitted.

**Bad:**
```html
<script src="https://cdn.example.com/tracker.js"></script>
<button onclick="doSomething()">Run</button>
<a href="javascript:alert(1)">Link</a>
```

**Good:**
```html
<script>
  // Self-contained on-twos motion pose clock
</script>
<button type="button" id="run-btn">Run</button>
<a href="#details">Link</a>
```

---

## `lintHtml()` Scanner Scope & Limits

`lintHtml(html, opts)` uses a fast, zero-dependency HTML tag/attribute/style scanner rather than a full WHATWG HTML5 parser:
- **Supported constructs:** `<!-- comments -->`, `<![CDATA[ ... ]]>`, `<!DOCTYPE ...>`, `<style>` and `<script>` raw-text blocks, single-quoted / double-quoted / unquoted attributes, boolean attributes, HTML void elements (`<img>`, `<meta>`, `<br>`, etc.), and self-closing SVG/HTML tags (`<line />`).
- **Token `<style>` exemption:** `<style data-f12-tokens>` and any `<style id="...">` whose `id` is listed in `opts.tokenStyleIds` (for example `{ tokenStyleIds: ['f12-tokens'] }`) are skipped by the CSS literal rules.
- **Known limits:**
  - CSS rules inside `<style>` inspect single-level `{ ... }` declaration blocks; deeply nested CSS rules (`@layer` / native CSS nesting with `--f-marker` split across parent and nested blocks) are evaluated per declaration block.
  - Dynamic DOM mutations performed at runtime by inline `<script>` code are not executed or inspected.
  - Malformed HTML with unescaped `<` followed immediately by an ASCII letter in raw text (e.g. `a <b` instead of `a &lt; b`) is tokenized as an opening tag.
