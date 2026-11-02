# FRAME/12 Next.js Starter (`templates/next-starter`)

A standalone, production-ready **Next.js (App Router) + TypeScript** starter pre-configured with the **FRAME/12** design language: `2.5px` mitered ink panels, `12px`/`20px`/`32px` semantic gutter grammar, `45°` SVG halftone screentone charts, `12fps` stepped motion ("on twos"), and automated AI agent guardrails.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Flbrodie11%2Fframe12%2Ftree%2Fmain%2Ftemplates%2Fnext-starter&project-name=frame12-starter&repository-name=frame12-starter)

---

## What's Pre-Installed

| Path | Purpose |
| --- | --- |
| `app/layout.tsx` | Loads `Dela_Gothic_One`, `Zen_Kaku_Gothic_New`, and `M_PLUS_1_Code` via `next/font/google` and imports `src/registry/styles/frame12.css`. |
| `app/page.tsx` | Multi-scene FRAME/12 workspace (`C-01`..`C-05`) with live window (`7` / `30` / `90` days), motion (`12fps on twos` / `60fps smooth` / `0ms cut`), and theme (`Light paper` / `Dark flashback`) switchers, `ToneAreaChart`, `PanelPair`, `ToneBarList`, `ToneSpark`, and `Dialog`. |
| `src/registry/` | Copy-in source for all 14 core FRAME/12 components, 5 accessible primitive adapters (`Dialog`, `Select`, `Tooltip`, `DropdownMenu`, `Table`), `useOnTwos` motion hooks, and standalone `frame12.css`. |
| `.claude/skills/frame12/` | Portable Agent Skill (`SKILL.md` + `references/`) so Claude Code, Cursor, and other AI coding agents build new screens without aesthetic drift. |
| `scripts/check-frame12.mjs` | Zero-dependency static design-grammar linter enforcing CSS tokens, `12/20/32px` gutters, marker-yellow contrast discipline, sequential `C-01..C-0N` cut numbers, and zero forbidden imports. |

---

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## Verifying Design Grammar & Production Build

Run the FRAME/12 static grammar checker, TypeScript compiler, and Next.js production build:

```bash
npm run lint:frame12   # Checks app/ and src/registry/ against all 5 static grammar rules
npm run typecheck      # Runs tsc --noEmit
npm run build          # Builds the production Next.js App Router bundle
```

---

## Adding or Updating Registry Components

You can also install or update individual components directly from the hosted FRAME/12 `shadcn` registry:

```bash
npx shadcn@latest add https://frame12.dev/r/frame12.json
```

## License

MIT License.
