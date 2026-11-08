# `@frame12/tokens`

Single source of truth for **FRAME/12** design tokens — Paper Light and Flashback Dark color palettes, typography font stacks, legal gutters (`12px`, `20px`, `32px`), `2.5px` mitered ink stroke, and `12fps` "on twos" pose timing (`83.33ms` per pose).

Zero runtime dependencies. Generated deterministically from [`src/tokens.source.json`](src/tokens.source.json) by [`scripts/build-tokens.mjs`](scripts/build-tokens.mjs).

---

## Install

Install the standalone token stylesheet today via the `shadcn` registry:

```bash
npx shadcn@latest add https://frame12.dev/r/frame12-tokens.json
# or with the @frame12 namespace configured in components.json:
npx shadcn@latest add @frame12/frame12-tokens
```

Within the `frame12` monorepo (or once `@frame12/tokens` is published to the public npm registry under the `@frame12` scope):

```bash
# Monorepo workspace dependency (npm publish pending initial @frame12 release)
npm install @frame12/tokens
```

---

## The Three Generated Outputs

### 1. CSS Custom Properties (`@frame12/tokens/tokens.css` / `styles/frame12-tokens.css`)

Self-contained CSS custom properties (`--f-*` and `--font-f-*`) with automatic `@media (prefers-color-scheme: dark)` switching and explicit `:root[data-theme="light"]` / `:root[data-theme="dark"]` (plus `.f12-theme-light` / `.f12-theme-dark`) overrides:

```css
@import "@frame12/tokens/tokens.css";
```

> **Font fallback note:** `tokens.css` / `frame12-tokens.css` includes the 6 cross-platform metric-matched `@font-face` fallback rules (`"f12DisplayFallback"`, `"f12DisplayFallbackDejaVu"`, `"f12BodyFallback"`, `"f12BodyFallbackDejaVu"`, `"f12MonoFallbackConsolas"`, `"f12MonoFallback"`) so standalone consumers get zero-reflow metric fallbacks across macOS, Windows, Linux, and Android even before `.woff2` web fonts finish loading.
>
> **Motion token note:** `--f-stroke` (`2.5px`) is consumed via `var(--f-stroke)` across `frame12.css`, whereas `--f-pose` (`83.33ms`) and `--f-fps` (`12`) are reference-only CSS custom properties exposed on `:root` for external consumers (`useOnTwos` computes `FRAME_MS = 1000 / 12` in JS, and `.f12-m-stepped` uses integer multi-pose `250ms` / `333ms` keyframe durations).

### 2. W3C DTCG 2025.10 Design Tokens JSON (`@frame12/tokens/tokens.json`)

Resolved [W3C Design Tokens Community Group (2025.10)](https://www.designtokens.org/tr/2025.10/format/) JSON with typed `$value` objects (`color` with `colorSpace: "srgb"`, `components`, `alpha`, and `hex`; `dimension` and `duration` with `{ value, unit }`; `fontFamily` string arrays; and structured `shadow` objects), plus mode maps under `$extensions["dev.frame12.modes"]` and CSS custom property names under `$extensions["dev.frame12.cssVar"]`:

```json
{
  "color": {
    "$type": "color",
    "ink": {
      "$type": "color",
      "$value": {
        "colorSpace": "srgb",
        "components": [0.0706, 0.0706, 0.0706],
        "alpha": 1,
        "hex": "#121212"
      },
      "$extensions": {
        "dev.frame12.scope": "themed",
        "dev.frame12.cssVar": "--f-ink",
        "dev.frame12.modes": {
          "light": {
            "colorSpace": "srgb",
            "components": [0.0706, 0.0706, 0.0706],
            "alpha": 1,
            "hex": "#121212"
          },
          "dark": {
            "colorSpace": "srgb",
            "components": [0.9451, 0.9412, 0.9176],
            "alpha": 1,
            "hex": "#f1f0ea"
          }
        }
      }
    }
  }
}
```

### 3. TypeScript / JavaScript Module (`@frame12/tokens`)

Exports deeply frozen `tokens` (`{ light, dark, gutters, stroke, motion, fonts, shadow }`) and `cssText` (`string`) so static HTML generators, SVG card renderers, emails, and VS Code webviews can inline the exact token stylesheet without filesystem I/O:

```ts
import { tokens, cssText } from '@frame12/tokens';

// Use typed token values in SVG / Canvas / JS renderers:
const strokeWidth = tokens.stroke.ink;       // "2.5px"
const poseMs = tokens.motion.pose;           // "83.33ms"
const fps = tokens.motion.fps;               // 12
const pairGutter = tokens.gutters.pair;      // "12px"
const lightInk = tokens.light.ink;           // "#121212"
const darkPanel = tokens.dark.panel;         // "#19191a"

// Inline cssText directly into a static HTML page or webview without fs.readFileSync:
export function renderStaticPage(bodyHtml: string): string {
  return `<!doctype html>
<html lang="en" data-theme="light">
  <head>
    <meta charset="utf-8" />
    <style>${cssText}</style>
  </head>
  <body style="background: var(--f-sheet); color: var(--f-ink); font-family: var(--font-f-body);">
    ${bodyHtml}
  </body>
</html>`;
}
```

---

## WCAG Contrast Gate

Verified on every test run (`packages/tokens/tests/tokens.test.mjs`):

| Pair | Requirement | Paper Light (`light`) | Flashback Dark (`dark`) |
| --- | --- | --- | --- |
| `ink` / `sheet` | `>= 4.5:1` (body) | `18.73:1` (`#121212` on `#ffffff`) | `17.85:1` (`#f1f0ea` on `#050505`) |
| `ink` / `panel` | `>= 4.5:1` (body) | `18.73:1` (`#121212` on `#ffffff`) | `15.39:1` (`#f1f0ea` on `#19191a`) |
| `ink-2` / `panel` | `>= 4.5:1` (body) | `8.72:1` (`#4b4b4b` on `#ffffff`) | `8.83:1` (`#b9b8b1` on `#19191a`) |
| `marker-ink` / `marker` | `>= 4.5:1` (body) | `13.27:1` (`#121212` on `#ffd60a`) | `13.27:1` (`#121212` on `#ffd60a`) |
| `rule` / `panel` | `>= 3.0:1` (non-text) | `18.73:1` (`#121212` on `#ffffff`) | `15.39:1` (`#f1f0ea` on `#19191a`) |
