# FRAME/12 4-Condition × 6-Task Reproducible Agent Evaluation Report

> Generated deterministically by `node eval/agent-eval/run-eval.mjs`. Universal UI quality metrics are reported separately from FRAME/12 grammar compliance so the conventional shadcn/Tailwind baseline (Condition 1) is never penalized for FRAME/12-specific aesthetic rules.

## 1. Condition Summary Table (6 Unseen Application Tasks per Condition)

| Condition | Universal UI Quality Pass | Axe WCAG AA Violations (Light+Dark) | Contrast Failures (Light+Dark) | Responsive Overflow (1280px/390px) | FRAME/12 Grammar Pass | Static `check-frame12.mjs` Violations |
| --- | --- | --- | --- | --- | --- | --- |
| **Condition 1: Conventional shadcn/Tailwind Baseline** | `6 / 6` | `0` | `0` | `0 / 6` | `N/A (Baseline)` | `N/A (Baseline)` |
| **Condition 2: FRAME/12 Components Without SKILL.md** | `0 / 6` | `12` | `24` | `0 / 6` | `0 / 6` | `78` |
| **Condition 3: FRAME/12 Components With SKILL.md (Single-Pass)** | `6 / 6` | `0` | `0` | `0 / 6` | `5 / 6` | `1` |
| **Condition 4: FRAME/12 Components With SKILL.md + check-frame12.mjs** | `6 / 6` | `0` | `0` | `0 / 6` | `6 / 6` | `0` |

## 2. Per-Task Breakdown Across All 24 Screens

| Condition | Task | Universal Pass | Contrast Failures (L/D) | Static Grammar Violations | Cut Sequence Valid | Chart Table Present | Expressive / Quiet Balance |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `c1-shadcn-baseline` | `01-dashboard` (Operational Incident & SLO Dashboard) | `PASS` | `0/0` | `N/A` | `N/A` | `N/A` | `N/A` |
| `c1-shadcn-baseline` | `02-settings` (Organization Security & Billing Preferences) | `PASS` | `0/0` | `N/A` | `N/A` | `N/A` | `N/A` |
| `c1-shadcn-baseline` | `03-developer-console` (Webhook Delivery & Event Stream Console) | `PASS` | `0/0` | `N/A` | `N/A` | `N/A` | `N/A` |
| `c1-shadcn-baseline` | `04-data-heavy` (Multi-Region Inventory & Fulfillment Ledger) | `PASS` | `0/0` | `N/A` | `N/A` | `N/A` | `N/A` |
| `c1-shadcn-baseline` | `05-landing-page` (Developer Platform Product Launch & Pricing Page) | `PASS` | `0/0` | `N/A` | `N/A` | `N/A` | `N/A` |
| `c1-shadcn-baseline` | `06-multi-step-form` (Production Deployment & Rollout Wizard) | `PASS` | `0/0` | `N/A` | `N/A` | `N/A` | `N/A` |
| `c2-frame12-no-skill` | `01-dashboard` (Operational Incident & SLO Dashboard) | `FAIL` | `2/2` | `13` | `NO` | `NO` | `5E / 0Q` |
| `c2-frame12-no-skill` | `02-settings` (Organization Security & Billing Preferences) | `FAIL` | `2/2` | `13` | `NO` | `NO` | `5E / 0Q` |
| `c2-frame12-no-skill` | `03-developer-console` (Webhook Delivery & Event Stream Console) | `FAIL` | `2/2` | `13` | `NO` | `NO` | `5E / 0Q` |
| `c2-frame12-no-skill` | `04-data-heavy` (Multi-Region Inventory & Fulfillment Ledger) | `FAIL` | `2/2` | `13` | `NO` | `NO` | `5E / 0Q` |
| `c2-frame12-no-skill` | `05-landing-page` (Developer Platform Product Launch & Pricing Page) | `FAIL` | `2/2` | `13` | `NO` | `NO` | `5E / 0Q` |
| `c2-frame12-no-skill` | `06-multi-step-form` (Production Deployment & Rollout Wizard) | `FAIL` | `2/2` | `13` | `NO` | `NO` | `5E / 0Q` |
| `c3-frame12-with-skill` | `01-dashboard` (Operational Incident & SLO Dashboard) | `PASS` | `0/0` | `0` | `YES` | `YES` | `4E / 2Q` |
| `c3-frame12-with-skill` | `02-settings` (Organization Security & Billing Preferences) | `PASS` | `0/0` | `0` | `YES` | `YES` | `1E / 5Q` |
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

- **Separation of Universal vs. Grammar Metrics:** Condition 1 (`c1-shadcn-baseline`) is evaluated strictly on universal UI engineering metrics (esbuild compilation, `@axe-core/playwright` WCAG 2.1 AA, computed text contrast in light & dark themes, keyboard focus visibility, and zero horizontal overflow at `1280px` and `390px`) and achieves `6 / 6` universal pass.
- **Unguided FRAME/12 Failure Modes (`c2-frame12-no-skill`):** When FRAME/12 components are used without `skills/frame12/SKILL.md`, screens compile (`6 / 6` build) but exhibit predictable grammar drift: hardcoded hex literals (`color-literal`), arbitrary `16px`/`24px` gaps (`illegal-gutter`), explicit or skipped cut props inside `<Sheet autoCut>` (`explicit-cut-in-autocut`, `cut-order`), foreground `--f-marker` text (`marker-misuse`, which also fails light-paper contrast), and omitted chart data tables (`showTable={false}`).
- **Single-Pass Skill vs. Skill + Static Checker (`c3` vs `c4`):** Providing `skills/frame12/SKILL.md` (`c3-frame12-with-skill`) resolves contrast, cut numbering, chart tables, and Expressive/Quiet hierarchy (`6 / 6` universal pass, `5 / 6` zero-violation grammar pass, with `1` single-pass inline `16px` gap in `04-data-heavy`). Pairing `SKILL.md` with `node scripts/check-frame12.mjs` (`c4-frame12-skill-plus-checker`) catches that remaining single-pass violation and achieves `6 / 6` universal quality pass and `6 / 6` (`0` violations) FRAME/12 grammar compliance.
- **Limitations & Honesty Note:** This harness is a deterministic repository benchmark across 24 representative reference screens (`4 conditions × 6 unseen tasks`). It verifies mechanical reproducibility of the evaluation criteria and static/DOM guardrails rather than claiming statistical significance from a multi-sample external human-subject study.
