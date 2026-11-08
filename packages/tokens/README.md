# `@frame12/tokens`

Zero-dependency design tokens for **FRAME/12** — generated from a single W3C Design Tokens (`src/tokens.source.json`) source into CSS custom properties (`tokens.css`), resolved DTCG JSON (`tokens.json`), and TypeScript/JavaScript exports (`tokens`, `cssText`).

Use `@frame12/tokens` whenever rendering FRAME/12 outside React or without the full component stylesheet (for example in standalone HTML reports, SVG cards, emails, or VS Code webviews).

---

## Install

```bash
npm install @frame12/tokens
```

Or install the standalone CSS token file via the `shadcn` CLI:

```bash
npx shadcn@latest add @frame12/frame12-tokens
# or via full manifest URL:
npx shadcn@latest add https://frame12.dev/r/frame12-tokens.json
```

---

## The Three Outputs

### 1. CSS Custom Properties (`@frame12/tokens/tokens.css`)

```ts
import '@frame12/tokens/tokens.css';
```

Defines:
- `:where(:root)` typography (`--font-f-display`, `--font-f-body`, `--font-f-mono`), gutters (`--f-gutter-pair: 12px`, `--f-gutter-scene: 20px`, `--f-gutter-change: 32px`), ink stroke (`--f-stroke: 2.5px`), motion on twos (`--f-pose: 83.33ms`, `--f-fps: 12`), and sheet/peg shadows (`--f-shadow-sheet`, `--f-shadow-peg`).
- Paper Light (`:where(:root), :root[data-theme="light"], .f12-theme-light`) and Flashback Dark (`@media (prefers-color-scheme: dark)` and `:root[data-theme="dark"], .f12-theme-dark`) surface and ink variables (`--f-desk`, `--f-sheet`, `--f-panel`, `--f-ink`, `--f-ink-2`, `--f-rule`, `--f-tone`, `--f-grid`, `--f-marker`, `--f-marker-ink`, `--f-hole`).

### 2. TypeScript / JavaScript Module (`@frame12/tokens`)

```ts
import { tokens, cssText } from '@frame12/tokens';

// Palette by mode ('light' | 'dark')
const panelBg = tokens.light.panel;        // '#ffffff'
const darkInk = tokens.dark.ink;           // '#f1f0ea'
const mutedInk = tokens.light['ink-2'];    // '#4b4b4b' (also available as tokens.light.ink2)
const markerInk = tokens.light.markerInk;  // '#121212' (also available as tokens.light['marker-ink'])

// Structural & motion tokens
const sceneGutter = tokens.gutters.scene;  // '20px'
const inkStroke = tokens.stroke.ink;       // '2.5px'
const poseDuration = tokens.motion.pose;   // '83.33ms'
const fps = tokens.motion.fps;             // 12
const monoFont = tokens.fonts.mono;
```

### 3. W3C Design Tokens JSON (`@frame12/tokens/tokens.json`)

```ts
import dtcgTokens from '@frame12/tokens/tokens.json' with { type: 'json' };
```

Provides the resolved W3C DTCG token tree (`$type`, `$value`, `$description`, and `dev.frame12.cssVar` extensions) for design tools and style pipelines.

---

## Inlining `cssText` in a Static HTML Page or Webview

String renderers (such as static HTML generators, CLI report exporters, or VS Code webviews) can inline `cssText` directly into a `<style>` tag without filesystem reads:

```ts
import { cssText, tokens } from '@frame12/tokens';

export function renderStaticPage(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="en" data-theme="light">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>${cssText}</style>
  <style>
    body {
      margin: 0;
      padding: var(--f-gutter-change);
      background: var(--f-desk);
      color: var(--f-ink);
      font-family: var(--font-f-body);
    }
    .card {
      background: var(--f-panel);
      border: var(--f-stroke) solid var(--f-rule);
      padding: var(--f-gutter-scene);
      box-shadow: var(--f-shadow-sheet);
    }
  </style>
</head>
<body>
  <main class="card" data-pose-ms="${tokens.motion.pose}">
    ${bodyHtml}
  </main>
</body>
</html>`;
}
```

---

## License

MIT
