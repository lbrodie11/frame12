# FRAME/12 4-Condition × 6-Task Guardrail & Reference Fixture Report

> Generated deterministically by `node eval/agent-eval/run-eval.mjs`. Universal UI quality metrics are reported separately from FRAME/12 grammar compliance so the conventional shadcn/Tailwind baseline (Condition 1) is never penalized for FRAME/12-specific aesthetic rules.

## 1. Condition Summary Table (6 Application Tasks per Condition)

| Condition | Universal UI Quality Pass | Axe WCAG AA Violations (Light+Dark) | Contrast Failures (Light+Dark) | Responsive Overflow (1280px/390px) | FRAME/12 Grammar Pass | Static `check-frame12.mjs` Violations |
| --- | --- | --- | --- | --- | --- | --- |
| **Condition 1: Conventional shadcn/Tailwind Baseline** | `6 / 6` | `0` | `0` | `0 / 6` | `N/A (Baseline)` | `N/A (Baseline)` |
| **Condition 2: Negative Fixture Suite (Planted Linter & Runtime Violations)** | `0 / 6` | `7` | `15` | `0 / 6` | `0 / 6` | `58` |
| **Condition 3: Pre-Checker Reference Fixtures (Planted Single-Rule Drift)** | `6 / 6` | `0` | `0` | `0 / 6` | `4 / 6` | `2` |
| **Condition 4: Checker-Verified Reference Fixtures (Post-Remediation)** | `6 / 6` | `0` | `0` | `0 / 6` | `6 / 6` | `0` |

## 2. Per-Task Breakdown Across All 24 Fixture Screens

| Condition | Task | Universal Pass | Contrast Failures (L/D) | Static Grammar Violations | Cut Sequence Valid | Chart Table Present | Expressive / Quiet Balance |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `c1-shadcn-baseline` | `01-dashboard` (Operational Incident & SLO Dashboard) | `PASS` | `0/0` | `N/A` | `N/A` | `N/A` | `N/A` |
| `c1-shadcn-baseline` | `02-settings` (Organization Security & Billing Preferences) | `PASS` | `0/0` | `N/A` | `N/A` | `N/A` | `N/A` |
| `c1-shadcn-baseline` | `03-developer-console` (Webhook Delivery & Event Stream Console) | `PASS` | `0/0` | `N/A` | `N/A` | `N/A` | `N/A` |
| `c1-shadcn-baseline` | `04-data-heavy` (Multi-Region Inventory & Fulfillment Ledger) | `PASS` | `0/0` | `N/A` | `N/A` | `N/A` | `N/A` |
| `c1-shadcn-baseline` | `05-landing-page` (Developer Platform Product Launch & Pricing Page) | `PASS` | `0/0` | `N/A` | `N/A` | `N/A` | `N/A` |
| `c1-shadcn-baseline` | `06-multi-step-form` (Production Deployment & Rollout Wizard) | `PASS` | `0/0` | `N/A` | `N/A` | `N/A` | `N/A` |
| `c2-frame12-no-skill` | `01-dashboard` (Operational Incident & SLO Dashboard) | `FAIL` | `2/2` | `13` | `NO` | `NO` | `5E / 0Q` |
| `c2-frame12-no-skill` | `02-settings` (Organization Security & Billing Preferences) | `FAIL` | `0/2` | `11` | `NO` | `YES` | `4E / 1Q` |
| `c2-frame12-no-skill` | `03-developer-console` (Webhook Delivery & Event Stream Console) | `FAIL` | `1/0` | `9` | `NO` | `NO` | `5E / 0Q` |
| `c2-frame12-no-skill` | `04-data-heavy` (Multi-Region Inventory & Fulfillment Ledger) | `FAIL` | `2/0` | `4` | `NO` | `NO` | `5E / 0Q` |
| `c2-frame12-no-skill` | `05-landing-page` (Developer Platform Product Launch & Pricing Page) | `FAIL` | `3/1` | `8` | `NO` | `NO` | `5E / 0Q` |
| `c2-frame12-no-skill` | `06-multi-step-form` (Production Deployment & Rollout Wizard) | `FAIL` | `1/1` | `13` | `YES` | `YES` | `3E / 0Q` |
| `c3-frame12-with-skill` | `01-dashboard` (Operational Incident & SLO Dashboard) | `PASS` | `0/0` | `0` | `YES` | `YES` | `4E / 2Q` |
| `c3-frame12-with-skill` | `02-settings` (Organization Security & Billing Preferences) | `PASS` | `0/0` | `1` | `YES` | `YES` | `1E / 5Q` |
| `c3-frame12-with-skill` | `03-developer-console` (Webhook Delivery & Event Stream Console) | `PASS` | `0/0` | `0` | `YES` | `YES` | `4E / 2Q` |
| `c3-frame12-with-skill` | `04-data-heavy` (Multi-Region Inventory & Fulfillment Ledger) | `PASS` | `0/0` | `1` | `YES` | `YES` | `4E / 2Q` |
| `c3-frame12-with-skill` | `05-landing-page` (Developer Platform Product Launch & Pricing Page) | `PASS` | `0/0` | `0` | `YES` | `YES` | `4E / 2Q` |
| `c3-frame12-with-skill` | `06-multi-step-form` (Production Deployment & Rollout Wizard) | `PASS` | `0/0` | `0` | `YES` | `YES` | `1E / 5Q` |
| `c4-frame12-skill-plus-checker` | `01-dashboard` (Operational Incident & SLO Dashboard) | `PASS` | `0/0` | `0` | `YES` | `YES` | `4E / 2Q` |
| `c4-frame12-skill-plus-checker` | `02-settings` (Organization Security & Billing Preferences) | `PASS` | `0/0` | `0` | `YES` | `YES` | `1E / 5Q` |
| `c4-frame12-skill-plus-checker` | `03-developer-console` (Webhook Delivery & Event Stream Console) | `PASS` | `0/0` | `0` | `YES` | `YES` | `4E / 2Q` |
| `c4-frame12-skill-plus-checker` | `04-data-heavy` (Multi-Region Inventory & Fulfillment Ledger) | `PASS` | `0/0` | `0` | `YES` | `YES` | `4E / 2Q` |
| `c4-frame12-skill-plus-checker` | `05-landing-page` (Developer Platform Product Launch & Pricing Page) | `PASS` | `0/0` | `0` | `YES` | `YES` | `4E / 2Q` |
| `c4-frame12-skill-plus-checker` | `06-multi-step-form` (Production Deployment & Rollout Wizard) | `PASS` | `0/0` | `0` | `YES` | `YES` | `1E / 5Q` |

## 3. Methodology & Scope Notes

- **Separation of Universal vs. Grammar Metrics:** Condition 1 (`c1-shadcn-baseline`) is evaluated strictly on universal UI engineering metrics (esbuild compilation, TypeScript `tsc --noEmit`, `@axe-core/playwright` WCAG 2.1 AA, computed text contrast in light & dark themes, keyboard focus visibility, interactive task workflow assertions, and zero horizontal overflow at `1280px` and `390px`) and achieves `6 / 6` universal pass.
- **Negative Fixture Suite (`c2-frame12-no-skill`):** Exercises all 6 static `scripts/check-frame12.mjs` rules across task-specific screens (`color-literal`, `illegal-gutter`, `marker-misuse`, `cut-order`, `explicit-cut-in-autocut`, and `raw-shadcn-import`) as well as runtime DOM/contrast failures (`showTable={false}`, non-sequential cut order, and low-contrast text). Each of the 6 tasks tests a distinct combination and count of planted violations.
- **Pre-Checker vs. Checker-Verified Reference Fixtures (`c3` vs `c4`):** Condition 3 (`c3-frame12-with-skill`) and Condition 4 (`c4-frame12-skill-plus-checker`) are distinct across all 6 tasks. Condition 3 plants realistic single-rule static drift in Task 02 (`explicit-cut-in-autocut` on `<Panel cut="C-01">` inside `<Sheet autoCut>`) and Task 04 (`illegal-gutter` `gap: "16px"` on the filter toolbar) (`6 / 6` universal pass, `4 / 6` grammar pass, `2` static violations). Condition 4 remediates those violations and standardizes layout utility classes (`6 / 6` universal pass, `6 / 6` grammar pass, `0` violations).
- **Scope & Honesty Note:** This suite is a deterministic guardrail & reference fixture harness (`4 conditions × 6 tasks = 24 committed TSX fixtures`), not a stochastic multi-sample LLM benchmark. No live model API calls are executed during `run-eval.mjs`; instead, it regression-tests the static linter (`scripts/check-frame12.mjs`), TypeScript contracts, and Playwright DOM/WCAG invariants against known-good and known-bad reference screens.
