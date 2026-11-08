# FRAME/12

[![Release: v0.2.0](https://img.shields.io/badge/Release-v0.2.0_·_Experimental-ffd60a?style=flat-square&labelColor=121212&color=ffd60a)](https://github.com/lbrodie11/frame12/releases/tag/v0.2.0)
[![React 18 & 19](https://img.shields.io/badge/React-18_%26_19_·_TypeScript-121212?style=flat-square&labelColor=121212&color=ffffff)](registry/)
[![shadcn Registry](https://img.shields.io/badge/shadcn_Registry-31_Components_·_42_Registry_Items-ffd60a?style=flat-square&labelColor=121212&color=ffd60a)](https://frame12.dev/components)
[![License: MIT](https://img.shields.io/badge/License-MIT-121212?style=flat-square&labelColor=121212&color=ffffff)](LICENSE)

**A React design system that makes interfaces look like comic pages and move like hand-drawn animation.**

Build expressive dashboards, developer tools, and editorial interfaces with ink-framed panels, screentone charts, deliberate `12fps` motion ("on twos"), and a visual grammar that both humans and AI coding agents can follow consistently.

**[Live Demo → frame12.dev](https://frame12.dev)** · **[Developer Console Block](https://frame12.dev/blocks/developer-console)** · **[Workspace Settings Block](https://frame12.dev/blocks/workspace-settings)** · **[Analytics Block](https://frame12.dev/blocks/analytics-dashboard)** · **[Motion on Twos Studio](https://frame12.dev/motion)** · **[Components (31)](https://frame12.dev/components)** · **[AI Agent Skill & Linter](https://frame12.dev/agents)** · **[Get Started Guide](https://frame12.dev/get-started)**

![FRAME/12 — Designing Interfaces on Twos](docs/images/social-hero.png)

---

## Why FRAME/12?

- **Built for products that want a distinct point of view:** Ideal for developer tools, analytics dashboards, and editorial apps tired of interchangeable rounded-card, soft-gradient templates.
- **Deliberate motion ("on twos"):** In hand-drawn animation, most action is shot on twos—each drawing is held for two frames at `24fps` (`12fps`, `83.33ms` per pose). FRAME/12 applies that same spacing chart to discrete UI state changes while keeping pointer tracking, scrolling, and typing instant (`0ms`).
- **Engineered for AI coding agents:** Instead of vague aesthetic prompts, FRAME/12 ships a portable Agent Skill (`SKILL.md`) paired with a static grammar linter (`scripts/check-frame12.mjs`) so coding agents produce consistent layouts without visual drift.

| Paper Light (`data-theme="light"`) | Flashback Dark (`data-theme="dark"`) |
| --- | --- |
| [![Motion on Twos — Light](docs/images/site-motion-light.png)](https://frame12.dev/motion) | [![Motion on Twos — Dark](docs/images/site-motion-dark.png)](https://frame12.dev/motion) |

---

## Install FRAME/12

### Requirements & Compatibility

- **React & Next.js:** Verified on React `18.3` (isolated Vite consumer: `tsc` against `@types/react` 18, SSR, hydration and interaction checks; plus the React 18 UMD component gallery in Chromium, Firefox and WebKit, and the eval and lab harnesses) and React `19` (documentation site, Next.js `16.4` starter, `create-next-app@latest` install, and `element.props.ref` runtime checks). The registry components have no Next.js dependency.
- **Project setup:** An initialized `shadcn` project (`components.json` with a `@/*` path alias; tested with Radix-based `shadcn` styles such as `new-york` as well as `shadcn init -d` / `base-nova`). Or start from a pre-configured repo in [`templates/next-starter/`](templates/next-starter/).
- **TypeScript:** Tested with TypeScript 6. From TypeScript 6 on, `import '@/styles/frame12.css'` needs a `*.css` module declaration. Next.js (`next-env.d.ts`) and Vite (`vite/client`) projects already provide one; in other setups, add `declare module '*.css';` to a `.d.ts` file.
- **Styling:** Works standalone via scoped `.f12-*` CSS custom properties (`styles/frame12.css`). Tailwind CSS is optional (`styles/frame12-tailwind.css` is included if you want Tailwind v4 utility classes).
- **Status:** Pre-1.0 and experimental (package version `0.2.0`). The registry ships 33 components (including named-area `Scene`, `GhostWire`, `Receipt` / `ReceiptList`, and `Tag variant="stamp"`), 3 application blocks (Developer Console, Workspace Settings, Revenue Recovery Analytics), the `use-on-twos` motion hook, and 3 font packages. Release notes for `0.2.0` are in [`CHANGELOG.md`](CHANGELOG.md), the `v0.2.0` release-readiness audit is in [`docs/roadmap/v0.2-release-readiness.md`](docs/roadmap/v0.2-release-readiness.md), and planned `v0.3` / `v0.4` work is in [`docs/roadmap/v0.3-v0.4-roadmap.md`](docs/roadmap/v0.3-v0.4-roadmap.md).

### 1. Add the registry kit (`@frame12` namespace or direct URL)

FRAME/12 is published in the official [`shadcn` registry index](https://ui.shadcn.com/r/registries.json) under the lowercase **`@frame12`** namespace. Run the `shadcn` CLI from your project root to copy the components (`components/frame12/`), motion hook (`hooks/use-on-twos.ts`), and stylesheet (`styles/frame12.css`) into your repo:

```bash
# Install the full 31-component kit + base styles and hook (configure fonts in Step 2 or via @frame12/frame12-base):
npx shadcn@latest add @frame12/frame12

# Or install an individual component:
npx shadcn@latest add @frame12/sheet

# Or install a full-page application block + its required primitives:
npx shadcn@latest add @frame12/developer-console
npx shadcn@latest add @frame12/workspace-settings
npx shadcn@latest add @frame12/analytics-dashboard
```

Full manifest URLs remain supported anywhere URL-based installation is preferred:

```bash
npx shadcn@latest add https://frame12.dev/r/frame12.json
npx shadcn@latest add https://frame12.dev/r/developer-console.json
npx shadcn@latest add https://frame12.dev/r/workspace-settings.json
npx shadcn@latest add https://frame12.dev/r/analytics-dashboard.json
```

<details>
<summary><strong>Install individual components instead of the full bundle</strong></summary>

Every component manifest in `@frame12/<name>` (or `https://frame12.dev/r/<name>.json`) resolves `frame12-styles` (`styles/frame12.css`) and any required hooks (`hooks/use-on-twos.ts`) or sibling primitives via `registryDependencies` (configure fonts in Step 2 or via `npx shadcn@latest add @frame12/frame12-base`):

```bash
npx shadcn@latest add @frame12/sheet
npx shadcn@latest add @frame12/scene
npx shadcn@latest add @frame12/panel
npx shadcn@latest add @frame12/panel-pair
npx shadcn@latest add @frame12/segmented-control
npx shadcn@latest add @frame12/metric
npx shadcn@latest add @frame12/tone-area-chart
npx shadcn@latest add @frame12/dialog
npx shadcn@latest add @frame12/select

# Direct URL alternative:
npx shadcn@latest add https://frame12.dev/r/sheet.json
npx shadcn@latest add https://frame12.dev/r/panel.json
```

> **Upgrading & Customizing Tokens:** Do not edit `styles/frame12.css` directly—put custom `--f-*` token overrides in your own stylesheet (such as `app/globals.css`). When upgrading or adding components after a FRAME/12 update (or in non-interactive CI/agent shells where `shadcn add -y` will skip installing if `styles/frame12.css` differs and still exit `0`), pass `--overwrite` and verify that `components/frame12/<name>.tsx` exists on disk.

Browse all 31 components and 42 registry items at **[frame12.dev/components](https://frame12.dev/components)**, or explore the **[Developer Console Block](https://frame12.dev/blocks/developer-console)**, **[Workspace Settings Block](https://frame12.dev/blocks/workspace-settings)**, and **[Analytics Block](https://frame12.dev/blocks/analytics-dashboard)**. For non-React consumers (static HTML, SVG cards, email, VS Code webviews), install the standalone token stylesheet via `npx shadcn@latest add @frame12/frame12-tokens` or use the [`@frame12/tokens`](packages/tokens/) workspace package (`tokens.css` with metric-matched `@font-face` fallbacks, W3C DTCG 2025.10 `tokens.json`, and TypeScript `tokens` + `cssText`; prepared for npm publication under `@frame12`).
</details>

### 2. Import the stylesheet and fonts (`app/layout.tsx`)

Import `@/styles/frame12.css` and bind `--font-dela-gothic-one`, `--font-zen-kaku-gothic-new`, and `--font-m-plus-1-code` (or install `frame12-base.json` to wire the `registry:font` items automatically):

```tsx
import { Dela_Gothic_One, Zen_Kaku_Gothic_New, M_PLUS_1_Code } from 'next/font/google';
import '@/styles/frame12.css';

const display = Dela_Gothic_One({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-dela-gothic-one',
  adjustFontFallback: false,
  fallback: ['f12DisplayFallback', 'f12DisplayFallbackDejaVu', 'sans-serif'],
});
const body = Zen_Kaku_Gothic_New({
  weight: ['400', '500', '700'],
  subsets: ['latin'],
  variable: '--font-zen-kaku-gothic-new',
  adjustFontFallback: false,
  fallback: ['f12BodyFallback', 'f12BodyFallbackDejaVu', 'sans-serif'],
});
const mono = M_PLUS_1_Code({
  weight: ['400', '500', '700'],
  subsets: ['latin'],
  variable: '--font-m-plus-1-code',
  adjustFontFallback: false,
  fallback: ['f12MonoFallbackConsolas', 'f12MonoFallback', 'ui-monospace', 'monospace'],
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

### 3. Compose a `<Sheet>` → `<Scene>` → `<Panel>` (`app/page.tsx`)

```tsx
import { Sheet, Scene, Panel, PanelPair, Metric, ToneAreaChart, Tag } from '@/components/frame12';

const REVENUE_DAYS = [
  { label: 'May 01', value: 3820 },
  { label: 'May 08', value: 4410 },
  { label: 'May 15', value: 5420 },
  { label: 'May 22', value: 4980 },
];

export default function DashboardPage() {
  return (
    <Sheet autoCut pegs motion="stepped">
      <header className="f12-hd">
        <div>
          <p className="f12-eyebrow">Checkout Recovery <Tag>30 Days</Tag></p>
          <h1 className="f12-title">Recovered Revenue</h1>
        </div>
      </header>

      <Scene gutter="scene" layout="split">
        <Panel label="Primary revenue chart">
          <Metric label="Recovered revenue" value={142840} delta={0.184} deltaKind="pct" range={30} big />
          <ToneAreaChart data={REVENUE_DAYS} seriesLabel="Recovered ($)" height={220} />
        </Panel>

        <PanelPair
          top={{
            label: 'Incremental profit',
            children: <Metric label="Incremental profit" value={54280} delta={0.142} deltaKind="pct" range={30} />,
          }}
          bottom={{
            label: 'Conversion lift',
            children: <Metric label="Conversion lift" value={0.55} delta={0.08} deltaKind="pp" range={30} />,
          }}
        />
      </Scene>
    </Sheet>
  );
}
```

For full setup details (including dark-mode toggle persistence and Tailwind v4 configuration), see **[frame12.dev/get-started](https://frame12.dev/get-started)**.

---

## npm Packages (`@frame12/*`)

In addition to the `shadcn` component registry, FRAME/12 ships standalone packages under `packages/*` published to npm under the `@frame12` scope for non-React consumers, static HTML/SVG generators, and CI pipelines:

| Package | Status | Purpose |
| --- | --- | --- |
| [`@frame12/tokens`](packages/tokens/) | In tree (`0.2.0`) | Zero-dependency design tokens: standalone `tokens.css` (light/dark `--f-*` custom properties and metric-matched `@font-face` fallbacks), resolved W3C DTCG 2025.10 `tokens.json`, and TypeScript/JS `tokens` + `cssText` exports. |
| [`@frame12/lint`](packages/lint/) | In tree (`0.2.0`) | Programmatic design-grammar checker (`lintSource`, `lintHtml`, `lintFiles`, `lintDirectory`) and CLI (`frame12-lint`) enforcing the FRAME/12 design rules across `.tsx`, `.jsx`, `.css`, and static `.html` files (optional `typescript` peer for TSX AST rules). |
| `@frame12/static` | Joining in F12-06 | Non-React HTML (`document`, `panel`, `metric`, `badge`, `tag`, `stamp`, `receipt`, `ghostWire`, `toneBarList`) and deterministic `1200×630` SVG/PNG social-card renderer (`renderCard`), built on `@frame12/tokens`. |

Each package has independent SemVer versioning, its own `CHANGELOG.md`, and tag-driven npm OIDC trusted-publishing releases (`<pkg>@<version>`). See [`docs/RELEASING-PACKAGES.md`](docs/RELEASING-PACKAGES.md) for the release order (`tokens` → `lint` → `static`), dry-run mode, and verification gates.

---

## For AI Coding Agents (`SKILL.md` & Linter)

Install the portable agent skill for Claude Code, Cursor, and compatible coding agents:

```bash
npx skills add lbrodie11/frame12 --skill frame12
```

To verify that generated screens follow the design grammar with zero drift, run the static checker (`scripts/check-frame12.mjs`) or wire in the ESLint flat config (`skills/frame12/eslint.frame12.mjs`):

```bash
node scripts/check-frame12.mjs src
```

---

## The 8 Design Rules (and How Each Is Verified)

FRAME/12 replaces subjective styling feedback with eight explicit rules—**five enforced statically by `scripts/check-frame12.mjs`** and **three verified by runtime hooks, Playwright accessibility checks, and architecture constraints**:

### Statically Enforced by `scripts/check-frame12.mjs`

1. **Tokens, not literals (`color-literal`):** No hard-coded hex/RGB/HSL colors or font stacks in component or screen files. Every surface, border, and text style uses `var(--f-*)` and `var(--font-f-*)`.
2. **Semantic gutter grammar (`illegal-gutter`):** Layout spacing between panels uses three narrative gutters so distance carries meaning:
   - `12px` (`--f-gutter-pair` / `gutter="pair"`): tightly paired panels (`PanelPair`) across a `16px` diagonal slant.
   - `20px` (`--f-gutter-scene` / `gutter="scene"`): panels within the same scene.
   - `32px` (`--f-gutter-change` / `gutter="change"`): separation between scenes down the sheet.
3. **Sequential cut numbers (`cut-order` & `explicit-cut-in-autocut`):** Prefer `<Sheet autoCut>` so panels (`C-01`, `C-02`, `C-03`…) number automatically via CSS counters in DOM and reading order (`cut={false}` suppresses a panel's cut badge). When hand-numbering outside `autoCut`, cut labels must increment sequentially starting at `C-01`, and mixing explicit `cut` strings inside `<Sheet autoCut>` is flagged by `explicit-cut-in-autocut`.
4. **Marker-yellow discipline (`marker-misuse`):** Highlighter yellow (`--f-marker`, `#ffd60a`) is used strictly as a highlight surface paired with `--f-marker-ink` (`#121212`) text or as an inked peak dot with a `2px` `--f-rule` stroke—never as raw text on a white sheet.
5. **Adapter boundary (`raw-shadcn-import`):** Screens import primitives from `@/components/frame12` rather than bypassing the design language with unstyled third-party UI kits.

### Verified by Runtime Hooks, Playwright Tests (`npm test`), and Conventions

6. **Motion on twos (`useOnTwos`):** Discrete state transitions hold each pose for `83.33ms` (`12fps`). Pointer hover, scrolling, typing, and chart crosshairs stay immediate (`0ms`). `prefers-reduced-motion: reduce` switches transitions to instant cuts (`0ms`).
7. **Flashback dark mode & WCAG AA accessibility:** Dark mode flips the sheet gutters pitch black (`#050505`) while keeping panels elevated (`#19191a`). Verified by automated Playwright + `@axe-core/playwright` audits for WCAG AA contrast, visible `:focus-visible` outlines, keyboard chart navigation, and semantic `<table>` fallbacks.
8. **Minimal dependencies & craft originality:** Zero external animation or charting libraries—charts, screentone patterns, and stepped animations are built with React, SVG, and CSS. Accessible menu and select primitives use `@radix-ui/react-dropdown-menu` and `@radix-ui/react-select` (while `Dialog` uses native `<dialog>`). The system is inspired by print and cel-animation production craft rather than copied from any named work.

---

## Contributing & Monorepo Structure

```bash
npm install
npx playwright install --with-deps chromium firefox webkit # first time only, for automated cross-browser verification
npm run build                     # builds lab, registry, eval, site, and templates/next-starter
npm run doc:check                 # verifies canonical TypeScript API <-> documentation & skill sync
npm run lint:frame12              # runs static design-grammar checker across all workspaces
npm test                          # runs sync checks, doc checks, static linter, and Playwright a11y/functional suites
```

- Run the documentation site locally: `npm --workspace=@frame12/site run dev`
- Run the standalone Next.js starter template: `npm --prefix templates/next-starter run dev`
- Verify registry JSON placement, React 19 runtime and the isolated React 18 + Vite consumer: `node scripts/smoke-install.mjs`
- Run the 4-condition × 6-task (`24`-screen) guardrail & reference fixture suite: `node eval/agent-eval/run-eval.mjs`

| Workspace / Directory | Contents |
| --- | --- |
| [`packages/tokens/`](packages/tokens/) | Zero-dependency `@frame12/tokens` package generating `dist/tokens.css`, W3C DTCG `dist/tokens.json`, and TypeScript/JS `dist/index.js` + `dist/index.d.ts` (`tokens`, `cssText`) plus the token region of `registry/styles/frame12.css` from `src/tokens.source.json`. |
| [`packages/lint/`](packages/lint/) | Zero-dependency `@frame12/lint` package (`lintSource`, `lintFiles`, `collectFiles`, `lintHtml`, `RULES`, and `frame12-lint` CLI) enforcing FRAME/12 design grammar across TSX/JSX/TS/JS, CSS, and generated HTML. |
| [`registry/`](registry/) | Source for the 42 `shadcn`-compatible registry payloads (`registry/ui/`, `registry/blocks/`, `registry/hooks/use-on-twos.ts`, `registry/styles/frame12.css`, `registry/styles/frame12-tokens.css`), built into `site/public/r/*.json`. |
| [`skills/frame12/`](skills/frame12/) | Portable AI Agent Skill (`SKILL.md`, `references/components-and-adapters.md`, `references/examples-and-mistakes.md`) and ESLint flat config (`eslint.frame12.mjs`). |
| [`site/`](site/) | Next.js App Router documentation and interactive showcase deployed at **[frame12.dev](https://frame12.dev)**. |
| [`templates/next-starter/`](templates/next-starter/) | Standalone Next.js App Router + TypeScript starter template pre-configured with local WOFF2 fonts (`next/font/local`), `.claude/skills/frame12/SKILL.md`, and `scripts/check-frame12.mjs`. |
| [`eval/`](eval/) | Reference screens across 3 product archetypes (`01-settings`, `02-landing-hero`, `03-data-table`), 4-condition × 6-task guardrail & reference fixture suite ([`eval/agent-eval/`](eval/agent-eval/)), static linter tests (`check-linter.mjs`), and Playwright WCAG AA + mobile verification ([`eval/RESULTS.md`](eval/RESULTS.md)). |
| [`lab/`](lab/) | Phase 1 recovery dashboard prototype (`prototype.html`), interactive A/B comparison harness (`study.html`), and interactive style sheet (`style-sheet.html`). |

---

## Open-Source Commitment, Roadmap & Community Feedback

### What Ships in the Free MIT Release (`v0.2.0`)

All FRAME/12 source code, components, blocks, hooks, styles, agent skills, and linters in this repository and the public `@frame12` registry are open source under the [MIT License](LICENSE) (bundled font binaries remain under the [SIL Open Font License 1.1](https://openfontlicense.org/); see [Fonts & License](#fonts--license)):

- **31 UI & Data-Visualization Primitives:** Layout (`Sheet`, `Scene`, `Panel`, `PanelPair`, `SegmentedControl`), forms (`Button`, `Field`, `Input`, `Textarea`, `Checkbox`, `RadioGroup`, `Switch`, `Select`), navigation & disclosure (`Tabs`, `Breadcrumb`, `Pagination`, `Dialog`, `DropdownMenu`, `Tooltip`), status & feedback (`Badge`, `Tag`, `Alert`, `Toast`, `Skeleton`, `EmptyState`, `Balloon`), and data display (`Table`, `Metric`, `ToneAreaChart`, `ToneBarList`, `ToneSpark`).
- **3 Full-Page Application Blocks (`registry:block`):**
  - **[Developer Console (`@frame12/developer-console`)](https://frame12.dev/blocks/developer-console):** API gateway telemetry, service error attribution, API key issuance/revocation, and request log replay.
  - **[Workspace Settings (`@frame12/workspace-settings`)](https://frame12.dev/blocks/workspace-settings):** Multi-section control plane with dirty-state guardrails, cross-tab validation, team role management, and live theme/motion configuration.
  - **[Revenue Recovery Analytics (`@frame12/analytics-dashboard`)](https://frame12.dev/blocks/analytics-dashboard):** Executive KPI storyboard with `7d`/`30d`/`90d` window reconciliation, intervention attribution, and daily ledger inspection.
- **Core Style System, Hook, Agent Skill & Grammar Checker:** `styles/frame12.css`, `styles/frame12-tailwind.css`, `hooks/use-on-twos.ts`, `skills/frame12/SKILL.md`, and `scripts/check-frame12.mjs`.
- **Long-Term Open-Source Direction:** Existing MIT components, the three flagship blocks, the style system, the agent skill, and the grammar checker remain open source under MIT. Nobody needs to purchase a commercial product to adopt or ship with the FRAME/12 design system. Any potential future commercial extensions (if introduced after customer validation) will be separately identified, separately licensed, and hosted outside this repository.

### Roadmap & Feedback

- **Public `v0.3` & `v0.4` Roadmap:** Read [`docs/roadmap/v0.3-v0.4-roadmap.md`](docs/roadmap/v0.3-v0.4-roadmap.md) for planned open-source core primitives (`CommandPalette`, `Drawer`, `Popover`, `DateRangePicker`, `Accordion`, `CodeBlock`, `Kbd`/`CopyButton`, `Avatar`), screentone charts, free application blocks (`AgentReviewConsole`, `IncidentWarRoom`), and scope classifications.
- **Share Feedback & Requests:**
  - **Bug reports & installation issues:** Open an issue at **[github.com/lbrodie11/frame12/issues](https://github.com/lbrodie11/frame12/issues)**.
  - **Feature requests, component prioritization & showcase ("Built with FRAME/12"):** Join **[github.com/lbrodie11/frame12/discussions](https://github.com/lbrodie11/frame12/discussions)**.

---

## Fonts & License

All typefaces used in FRAME/12 (`Dela Gothic One`, `Zen Kaku Gothic New`, and `M PLUS 1 Code`), as well as `Geist` and `Geist Mono` (used in the Phase 1 comparison baseline only), are open-source under the [SIL Open Font License 1.1](https://openfontlicense.org/).

MIT License — see [`LICENSE`](LICENSE). Copyright (c) 2026 Laqwan Brodie.

### Official sources & the FRAME/12 name

FRAME/12 is only published from this repository, **[frame12.dev](https://frame12.dev)**, and its registry at `@frame12` (`https://frame12.dev/r/<name>.json`). The MIT License covers the code; the FRAME/12 name and logo are covered by the [trademark policy](TRADEMARKS.md). Forks are welcome. Give yours its own name, and feel free to describe it as "based on FRAME/12".

### Security

Please report vulnerabilities privately as described in [`SECURITY.md`](SECURITY.md), not in public issues.
