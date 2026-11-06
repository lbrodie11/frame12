# FRAME/12 Guardrail & Reference Fixture Suite (`eval/agent-eval/`)

This directory contains the reproducible **4-Condition × 6-Task (`24`-Screen) Guardrail & Reference Fixture Suite** for FRAME/12 (`v0.2`).

## 1. Quick Start

Run the complete fixture suite (TypeScript `tsc --noEmit` compilation, `esbuild` bundling, `scripts/check-frame12.mjs` static grammar analysis, interactive Playwright workflow assertions, and headless Chromium Playwright + `@axe-core/playwright` audits across light & dark themes at `1280px` desktop and `390px` mobile viewports):

```bash
node eval/agent-eval/run-eval.mjs
```

Outputs are written deterministically to:
- [`eval/agent-eval/results/summary.json`](results/summary.json) — Machine-readable JSON matrix of all 24 fixture screens and 4 condition rollups.
- [`eval/agent-eval/results/REPORT.md`](results/REPORT.md) — Human-readable Markdown fixture report.

---

## 2. Fixture Conditions

| Condition ID | Description | Universal UI Quality Audited? | FRAME/12 Grammar Audited? |
| --- | --- | --- | --- |
| `c1-shadcn-baseline` | Conventional shadcn/Tailwind-style React baseline (rounded `8px` cards, system typography, accessible forms, tier switchers, 3-step rollout wizard, & tables). | **Yes** (`6 / 6` pass) | **No (`N/A`)** — never penalized for FRAME/12 aesthetic rules |
| `c2-frame12-no-skill` | Negative fixture suite with planted static linter & runtime violations across task-specific screens. | **Yes** (`0 / 6` pass — `7` axe & `15` contrast failures from planted low-contrast/marker misuse) | **Yes** (`0 / 6` pass — `58` total static violations exercising all 6 `check-frame12.mjs` rules: `13, 11, 9, 4, 8, 13` per task) |
| `c3-frame12-with-skill` | Pre-checker reference fixtures structured per `skills/frame12/SKILL.md` with planted single-rule static drift in Tasks `02` and `04`. | **Yes** (`6 / 6` pass) | **Yes** (`4 / 6` pass — `2` planted static violations: `explicit-cut-in-autocut` on `02-settings` and `16px` `illegal-gutter` on `04-data-heavy`) |
| `c4-frame12-skill-plus-checker` | Checker-verified reference fixtures after remediating `scripts/check-frame12.mjs` violations and standardizing layout classes. | **Yes** (`6 / 6` pass) | **Yes** (`6 / 6` pass — `0` static or live DOM violations) |

---

## 3. Six Application Task Archetypes (`tasks/tasks.json`)

1. **`01-dashboard` — Operational Incident & SLO Dashboard:** Hero MTTR KPI (`C-01`, computed in minutes from incident recovery durations), error-budget burn `ToneAreaChart`, paired P95 latency & SLO availability `PanelPair` + `ToneSpark`, service blast-radius `ToneBarList`, and active incident responder `Table`.
2. **`02-settings` — Organization Security & Billing Preferences:** Quiet-first security posture & billing configuration across SSO & Passkeys, Invoice Routing, and Audit Retention (`Tabs`, `Field`, `Input`, `Select`, `RadioGroup`, `Switch`, `Checkbox`, `Textarea`, `Notice`) with verified `Save Preferences` and `Reset to Defaults` workflows.
3. **`03-developer-console` — Webhook Delivery & Event Stream Console:** Expressive throughput & retry `ToneAreaChart` + destination `ToneBarList` paired with a Quiet filterable, paginated event delivery ledger (`Table density="compact"`, `Pagination`, `Tag status`).
4. **`04-data-heavy` — Multi-Region Inventory & Fulfillment Ledger:** Regional fill-rate KPIs, backorder trend chart, fulfillment center breakdown, and high-density SKU allocation table with SKU/resource search (`SKU-8801`), region filter, pagination, and `EmptyState`.
5. **`05-landing-page` — Developer Platform Product Launch & Pricing Page:** Storyboard launch sheet with hero benchmark chart, paired latency/reliability proof points, `Balloon` callout, plan comparison `Table`, and interactive seat/volume tier switcher.
6. **`06-multi-step-form` — Production Deployment & Rollout Wizard:** Hierarchical `Breadcrumb`, 3-step rollout configuration (`Target Artifact`, `Canary Traffic Policy`, `Pre-Flight Signoff`), readiness `Notice`, and modal `Dialog` (`<dialog>.showModal()`) promotion sign-off.

---

## 4. Separation of Universal Quality vs. FRAME/12 Grammar Metrics

To ensure a fair comparison against non-FRAME/12 baselines:

1. **Universal UI Quality Metrics (applied to all 4 conditions):**
   - Clean TypeScript (`tsc --noEmit`) + `esbuild` compilation (`buildOk` & `tscOk`)
   - Verified interactive task workflows (`taskWorkflowOk`: region scope filtering, pagination row slicing, settings save/reset, SKU ID search, pricing tier switching, and 3-step rollout wizard navigation)
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

## 5. Methodology & Scope Note

- **Deterministic Fixture Suite:** All 24 task×condition screens in `conditions/` are committed TSX fixtures compiled and audited in a real headless Chromium browser by `run-eval.mjs` with zero network dependencies and no live LLM API calls.
- **Guardrail & Reference Purpose:** Rather than claiming stochastic multi-run model generation statistics, this suite regression-tests that `scripts/check-frame12.mjs`, TypeScript contracts, and Playwright DOM/WCAG audits reliably catch planted violations (`c2`, `c3`) and pass remediated reference screens (`c1`, `c4`).
