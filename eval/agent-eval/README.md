# FRAME/12 Reproducible AI-Agent Evaluation Harness (`eval/agent-eval/`)

This directory contains the reproducible **4-Condition × 6-Task (`24`-Screen) AI-Agent Evaluation Harness** for FRAME/12 (`v0.2`).

## 1. Quick Start

Run the complete evaluation harness (TypeScript compilation, `esbuild` bundling, `scripts/check-frame12.mjs` static grammar analysis, and headless Chromium Playwright + `@axe-core/playwright` audits across light & dark themes at `1280px` desktop and `390px` mobile viewports):

```bash
node eval/agent-eval/run-eval.mjs
```

Outputs are written deterministically to:
- [`eval/agent-eval/results/summary.json`](results/summary.json) — Machine-readable JSON matrix of all 24 screens and 4 condition rollups.
- [`eval/agent-eval/results/REPORT.md`](results/REPORT.md) — Human-readable Markdown evaluation report.

---

## 2. Evaluation Conditions

| Condition ID | Description | Universal UI Quality Audited? | FRAME/12 Grammar Audited? |
| --- | --- | --- | --- |
| `c1-shadcn-baseline` | Conventional shadcn/Tailwind-style React baseline (rounded `8px` cards, system typography, accessible forms & tables). | **Yes** (`6 / 6` pass) | **No (`N/A`)** — never penalized for FRAME/12 aesthetic rules |
| `c2-frame12-no-skill` | Uses `@/components/frame12` components from component names alone without `skills/frame12/SKILL.md` or `scripts/check-frame12.mjs`. | **Yes** (fails light-theme contrast when `--f-marker` yellow is misused as text color) | **Yes** (`0 / 6` pass — exhibits hex literals, `16px`/`24px` gaps, explicit/skipped cuts inside `autoCut`, and `showTable={false}`) |
| `c3-frame12-with-skill` | Guided by `skills/frame12/SKILL.md` (single-pass generation prior to running the static checker). | **Yes** (`6 / 6` pass) | **Yes** (`5 / 6` pass — `1` single-pass inline `16px` gap on `04-data-heavy`) |
| `c4-frame12-skill-plus-checker` | Guided by `skills/frame12/SKILL.md` + `node scripts/check-frame12.mjs` + Playwright verification loop. | **Yes** (`6 / 6` pass) | **Yes** (`6 / 6` pass — `0` static or live DOM violations) |

---

## 3. Six Previously Unseen Application Tasks (`tasks/tasks.json`)

1. **`01-dashboard` — Operational Incident & SLO Dashboard:** Hero MTTR KPI (`C-01`), error-budget burn `ToneAreaChart`, paired P95 latency & SLO availability `PanelPair` + `ToneSpark`, service blast-radius `ToneBarList`, and active incident responder `Table`.
2. **`02-settings` — Organization Security & Billing Preferences:** Quiet-first security posture & billing configuration across SSO & Passkeys, Invoice Routing, and Audit Retention (`Tabs`, `Field`, `Input`, `Select`, `RadioGroup`, `Switch`, `Checkbox`, `Textarea`, `Notice`).
3. **`03-developer-console` — Webhook Delivery & Event Stream Console:** Expressive throughput & retry `ToneAreaChart` + destination `ToneBarList` paired with a Quiet filterable, paginated event delivery ledger (`Table density="compact"`, `Pagination`, `Tag status`).
4. **`04-data-heavy` — Multi-Region Inventory & Fulfillment Ledger:** Regional fill-rate KPIs, backorder trend chart, fulfillment center breakdown, and high-density SKU allocation table with search, region filter, pagination, and `EmptyState`.
5. **`05-landing-page` — Developer Platform Product Launch & Pricing Page:** Storyboard launch sheet with hero benchmark chart, paired latency/reliability proof points, `Balloon` callout, plan comparison `Table`, and interactive tier switcher.
6. **`06-multi-step-form` — Production Deployment & Rollout Wizard:** Hierarchical `Breadcrumb`, multi-step rollout configuration, readiness `Notice`, and modal `Dialog` (`<dialog>.showModal()`) promotion sign-off.

---

## 4. Separation of Universal Quality vs. FRAME/12 Grammar Metrics

To ensure a fair comparison against non-FRAME/12 baselines:

1. **Universal UI Quality Metrics (applied to all 4 conditions):**
   - Clean TypeScript + `esbuild` compilation (`buildOk`)
   - Zero `@axe-core/playwright` WCAG 2.1 A/AA violations in both `light` and `dark` themes
   - Zero WCAG AA text contrast failures (`4.5:1` body text, `3.0:1` large display text) in both `light` and `dark` themes
   - Zero unnamed interactive controls (`button`, `input`, `select`, `textarea`, `a[href]`, `[tabindex="0"]`) and zero duplicate DOM `id` attributes
   - Keyboard `Tab` reachability and visible `:focus-visible` outline (`>= 2px` outline or box-shadow)
   - Zero horizontal page overflow (`documentElement.scrollWidth <= clientWidth + 1`) at `1280×900` desktop and `390×844` mobile viewports
2. **FRAME/12 Identity & Grammar Metrics (applied ONLY to Conditions 2, 3, and 4):**
   - Zero static `scripts/check-frame12.mjs` violations (`color-literal`, `illegal-gutter`, `marker-misuse`, `cut-order`, `explicit-cut-in-autocut`, `raw-shadcn-import`)
   - Live DOM `.f12-scene` computed `gap` strictly in `{12px, 20px, 32px}`
   - Sequential rendered `.f12-cut` badges (`C-01, C-02, ...`) in top-to-bottom, left-to-right visual reading order
   - Semantic `<details class="f12-tbl">` table present for every rendered `.f12-chart`
   - Balanced Expressive (`2.5px` mitered polygon) and Quiet (`1px` exposure-sheet) panel hierarchy

---

## 5. Methodology & Limitations

- **Deterministic Harness:** All 24 task×condition artifacts in `conditions/` are compiled and audited in a real headless Chromium browser by `run-eval.mjs` with zero network dependencies.
- **No Overclaimed Statistical Generalization:** This evaluation measures deterministic compliance across 6 representative task archetypes (`N = 6` tasks × `4` conditions = `24` screens). It demonstrates how `SKILL.md` and `scripts/check-frame12.mjs` eliminate specific, reproducible classes of design-system drift, without claiming statistical significance from a large-N human preference trial.
