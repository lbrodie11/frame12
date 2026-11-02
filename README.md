# FRAME/12

[![License: MIT](https://img.shields.io/badge/License-MIT-ffd60a?style=flat-square&labelColor=121212&color=ffd60a)](LICENSE)
[![Next.js + TypeScript](https://img.shields.io/badge/Next.js_14-TypeScript-121212?style=flat-square&labelColor=121212&color=ffffff)](site/)
[![shadcn Registry](https://img.shields.io/badge/shadcn-Registry_22_Items-ffd60a?style=flat-square&labelColor=121212&color=ffd60a)](registry/)
[![Agent Skill](https://img.shields.io/badge/SKILL.md-Grammar_Linter-121212?style=flat-square&labelColor=121212&color=ffffff)](skills/frame12/)

An interface design language, copy-in React component registry, and AI agent skill drawn from sequential print page composition and hand-drawn cel-animation production craft: `2.5px` mitered ink panels, semantic `12px`/`20px`/`32px` gutter grammar, rotated `45°` SVG halftone screentone fills instead of alpha gradients, and discrete state transitions held **on twos** (`12fps`, `83.33ms` per pose).

![FRAME/12 Social Hero](docs/images/social-hero.png)

---

## Install in 10 Seconds

Install the complete **FRAME/12** kit (styles, motion hooks, 14 core components, and 5 accessible primitive adapters) or individual items via the `shadcn` CLI:

```bash
# Full kit
npx shadcn@latest add https://frame12.dev/r/frame12.json

# Individual registry items
npx shadcn@latest add https://frame12.dev/r/frame12-styles.json
npx shadcn@latest add https://frame12.dev/r/sheet.json
npx shadcn@latest add https://frame12.dev/r/scene.json
npx shadcn@latest add https://frame12.dev/r/panel.json
npx shadcn@latest add https://frame12.dev/r/panel-pair.json
npx shadcn@latest add https://frame12.dev/r/segmented-control.json
npx shadcn@latest add https://frame12.dev/r/tone-area-chart.json
```

> **Note on Registry Origin:** `https://frame12.dev` is the live production registry origin (override for self-hosted deployments via `NEXT_PUBLIC_SITE_URL`). For offline or local development, you can also serve the registry locally (`npm --workspace=@frame12/site run dev` → `npx shadcn@latest add http://localhost:3000/r/frame12.json`), verify end-to-end with `node scripts/smoke-install.mjs`, or start directly from [`templates/next-starter/`](templates/next-starter/).

Install the portable AI Agent Skill (`skills/frame12/SKILL.md`) for Claude Code, Cursor, and compatible coding agents:

```bash
npx skills add lbrodie11/frame12 --skill frame12
```

---

## Monorepo Workspaces & Directories

Every workspace is self-contained, shares a single root toolchain, and is verified by `npm test` and `npm run lint:frame12`:

| Workspace / Directory | Milestone | What It Contains |
| --- | --- | --- |
| [`lab/`](lab/) | `m1-fix-restructure` | Phase 1 recovery dashboard prototype (`prototype.html`), interactive A/B comparison harness (`study.html`), and interactive style sheet (`style-sheet.html`). |
| [`registry/`](registry/) | `m2-registry` | 22 `shadcn`-compatible registry items installing into `components/frame12/*.tsx`, `hooks/use-on-twos.ts`, and `styles/frame12.css`: 14 core components (`Sheet`, `Scene`, `Panel`, `PanelPair`, `SegmentedControl`, `Button`, `Input`, `Badge`, `Tag`, `Metric`, `Balloon`, `ToneAreaChart`, `ToneBarList`, `ToneSpark`), 5 primitive adapters (`Dialog`, `Select`, `Tooltip`, `DropdownMenu`, `Table`), `useOnTwos` hooks, and standalone `.f12-*` scoped `frame12.css`. |
| [`skills/frame12/`](skills/frame12/) | `m3-skill` | Portable Agent Skill (`SKILL.md`, `references/components-and-adapters.md`, `references/examples-and-mistakes.md`) and ESLint flat-config rules (`eslint.frame12.mjs`). |
| [`eval/`](eval/) | `m3-skill` | AI reproduction benchmark across 3 product archetypes (`01-settings`, `02-landing-hero`, `03-data-table`), static linter tests (`check-linter.mjs`), and Playwright WCAG AA + `@axe-core/playwright` + mobile verification ([`eval/RESULTS.md`](eval/RESULTS.md)). |
| [`site/`](site/) | `m4-site` | Next.js App Router documentation and interactive showcase (`/` Home, `/motion` On Twos Studio, `/components` Gallery & `[slug]` docs, `/agents` Skill & Linter benchmark, `/style-sheet`, `/get-started`, plus `/r/*.json` endpoints and dynamic Open Graph images). |
| [`templates/next-starter/`](templates/next-starter/) | `m5-launch` | Standalone Next.js App Router + TypeScript starter template pre-loaded with `src/components/frame12/`, `src/hooks/use-on-twos.ts`, `src/styles/frame12.css`, Google Fonts, `.claude/skills/frame12/SKILL.md`, and `scripts/check-frame12.mjs`. |

---

## Quick Start (Local Development)

```bash
npm install
npx playwright install chromium   # first time only, for automated browser verification
npm run build                     # builds lab, registry, eval, site, and templates/next-starter
npm run lint:frame12              # runs static design-grammar checker across all workspaces
npm test                          # runs full lint, unit, build, and Playwright a11y/study suites
```

To run the documentation and showcase site (`site/`) locally:

```bash
npm --workspace site run dev
```

To run the standalone Next.js starter template (`templates/next-starter/`):

```bash
npm --prefix templates/next-starter run dev
```

---

## The 8 Non-Negotiable Rules (`scripts/check-frame12.mjs`)

1. **Tokens, not literals (`color-literal`):** No hard-coded hex/RGB/HSL colors or font stacks outside `frame12.css` / `frame12-tailwind.css`. Always use `var(--f-*)` and `var(--font-f-*)`.
2. **Gutter grammar (`illegal-gutter`):** Layout gutters come strictly from three semantic values:
   - `12px` (`--f-gutter-pair` / `gutter="pair"`): tightly paired panels (`PanelPair`) across a `16px` diagonal slant.
   - `20px` (`--f-gutter-scene` / `gutter="scene"`): panels within the same narrative scene.
   - `32px` (`--f-gutter-change` / `gutter="change"`): separation between scenes down the sheet.
3. **Sequential cut numbers (`cut-order`):** Every panel (`C-01`, `C-02`, `C-03`…) is numbered sequentially in DOM and reading order starting at `C-01`.
4. **Marker-yellow discipline (`marker-misuse`):** Highlighter yellow (`--f-marker`, `#ffd60a`) is used **only** as a background paired with `--f-marker-ink` (`#121212`) text, or as an inked peak dot with a `2px` `--f-rule` stroke.
5. **Motion on twos:** Discrete state transitions hold each pose for `83.33ms` (`12fps`) via `useOnTwos`. Pointer hover, scrolling, typing, and chart crosshairs stay immediate (`0ms`). `prefers-reduced-motion: reduce` switches all transitions to instant hard cuts (`0ms`).
6. **Flashback dark mode & WCAG AA accessibility:** Dark mode turns the gutters pitch black (`#050505`) while keeping panels legible (`#19191a`) with ≥4.5:1 body contrast, ≥3:1 display contrast, visible `:focus-visible` outlines, keyboard chart navigation, and semantic `<table>` fallbacks.
7. **Describe the craft, never name people or franchises:** Zero named artists, studios, comics, or franchises appear anywhere in code or docs.
8. **Zero external animation or charting libraries (`raw-shadcn-import`):** Built purely with React, SVG, and CSS custom properties.

---

## Fonts & License

All typefaces used in FRAME/12 (`Dela Gothic One`, `Zen Kaku Gothic New`, and `M PLUS 1 Code`), as well as `Geist` and `Geist Mono` (used in the Phase 1 conventional comparison baseline only), are open-source under the [SIL Open Font License 1.1](https://openfontlicense.org/).

MIT License — see [`LICENSE`](LICENSE). Copyright (c) 2026 Laqwan Brodie.
