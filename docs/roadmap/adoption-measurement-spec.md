# FRAME/12 — Privacy-Conscious Adoption Measurement Specification

> **Status:** Launch-Readiness Specification (`v0.2.0`)  
> **Scope:** Public documentation site (`frame12.dev`), static `shadcn` registry endpoints (`/r/*.json`), and GitHub repository (`lbrodie11/frame12`)  
> **Policy:** Zero telemetry in copied components; no third-party analytics provider added without explicit maintainer approval.

---

## 1. Current Baseline Audit (`v0.2.0`)

An audit of `site/app/layout.tsx`, `site/package.json`, `site/next.config.mjs`, and `registry/**` at `v0.2.0` (`271c1fb`) confirms:

- **Documentation site (`site/`):** **Zero** client-side analytics scripts, tracking pixels, cookies, or third-party telemetry SDKs are installed.
- **Copied registry components (`registry/ui/*`, `registry/blocks/*`, `registry/hooks/*`, `registry/styles/*`):** **Zero** outbound network calls, beacons, or telemetry hooks exist in any distributable source file.
- **Registry manifests (`site/public/r/*.json`):** Served as static JSON files from `frame12.dev/r/<name>.json` (and indexed in `https://ui.shadcn.com/r/registries.json` under `@frame12`).

### Non-Negotiable Privacy & Architecture Constraints

1. **Never embed telemetry in copied components or blocks.** Code installed via `npx shadcn@latest add @frame12/*` belongs to the adopting developer's application and must remain 100% free of phone-home beacons, hidden headers, or runtime tracking.
2. **No new analytics provider without explicit approval.** This document specifies what can be observed from existing infrastructure (hosting access logs and GitHub signals) and defines an optional, cookie-free first-party measurement schema if approved in the future.

---

## 2. Measurement Matrix Across the 8 Core Adoption Signals

| # | Signal Category | Primary Observable Indicators | Collection Source (Zero-Cookie / Non-Invasive) | What It Decision-Validates |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Documentation Visits** | Aggregate pageviews, top entry routes (`/`, `/get-started`, `/components`, `/style-sheet`, `/motion`, `/agents`), HTTP referrer headers (`ui.shadcn.com`, `github.com`, X/social, search), and geographic/device split. | Edge/CDN server access logs (or approved privacy-friendly pageview counter without cookies). | Which launch channels drive top-of-funnel discovery and whether visitors reach `/get-started`. |
| **2** | **Application Block Interest** | Pageviews on `/blocks/developer-console`, `/blocks/workspace-settings`, and `/blocks/analytics-dashboard`, plus `/r/developer-console.json`, `/r/workspace-settings.json`, and `/r/analytics-dashboard.json` manifest requests. | Edge/CDN server access logs filtered by `/blocks/*` and `/r/<block>.json`. | Which domain vertical (DevTools/Infra vs. SaaS Control Plane vs. Revenue Analytics) resonates strongest with evaluators. |
| **3** | **Registry Endpoint Requests** | HTTP `200` / `304` request volume by item slug (`/r/frame12.json`, `/r/frame12-base.json`, `/r/sheet.json`, `/r/panel.json`, `/r/<block>.json`) and `User-Agent` class (`node` / `undici` from `shadcn` CLI vs. browser preview vs. bot). | Hosting/CDN request logs for `/r/*.json` and `/llms.txt` / `/llms-full.txt`. | Relative demand across full-kit installs (`@frame12/frame12`), individual primitives, application blocks, and LLM context files. |
| **4** | **Successful Installation Feedback** | Qualitative and opt-in signals: GitHub Discussions *"Show & Tell / Built with FRAME/12"*, GitHub Issues labeled `installation`, starter template clones (`templates/next-starter`), and `npx skills add` reports. | GitHub Discussions, GitHub Issues, and GitHub repository traffic API (`clones`, `views`). | Whether developers complete end-to-end setup into a compiling app and where framework/tooling friction occurs. |
| **5** | **GitHub Community Participation** | Stars, forks, watchers, unique repository visitors/clones (14-day GitHub Insights window), open/closed issues, external PRs, and discussion threads. | GitHub Repository Insights & GitHub REST/GraphQL API. | Organic developer advocacy, contributor velocity, and long-term open-source momentum. |
| **6** | **Returning Developers (Where Measurable)** | Repeat GitHub issue/discussion contributors, repeat repository cloners (14-day aggregate unique vs. total clones), and—only if privacy-safe edge analytics is enabled—short-lived daily salted hash recurrence without cross-site cookies. | GitHub Insights (`total clones` vs. `unique cloners`) and aggregate repeat-visit cohorts (if approved). | Whether evaluators return after initial discovery to build a second screen or adopt additional primitives. |
| **7** | **Requests for Advanced Integrations** | Feature requests and discussion polls asking for `v0.3`/`v0.4` components (`CommandPalette`, `Drawer`, `DateRangePicker`), framework starters (`Vite`, `Astro`, `Remix`), or live data/auth adapters. | Structured GitHub Issue templates (`feature-request`, `integration-request`) and GitHub Discussions upvote counts. | Prioritization order for the `v0.3` component backlog and `v0.4` agentic primitives. |
| **8** | **Interest in Commercial Workflow Kits** | Inbound inquiries, GitHub Discussions threads on production human-in-the-loop agent governance, and direct customer discovery interviews regarding **FRAME/12 Studio — Agent Review Kit**. | Structured customer discovery conversations, GitHub Discussions, and opt-in architecture review requests (see [`commercial-validation-plan.md`](./commercial-validation-plan.md)). | Whether engineering teams have urgent, funded backend/security problems around agent approvals worth a commercial kit. |

---

## 3. Explicit Limitations & Interpretation Guardrails

To avoid vanity metrics or false conclusions, launch reporting must enforce the following analytical guardrails:

### 3.1 Why `/r/*.json` Request Counts $\neq$ Unique Developers or Successful Installs

Raw HTTP request counts to `https://frame12.dev/r/*.json` **must never be reported as "unique developers" or "completed installations"** for six technical reasons:

1. **Dependency Fan-Out Multiplication:** Installing a single composite item (such as `npx shadcn@latest add @frame12/frame12` or `@frame12/developer-console`) triggers `registryDependencies` resolution in the `shadcn` CLI, fetching `frame12-base.json`, `font-dela-gothic-one.json`, and up to 31 individual component manifests in a single CLI invocation.
2. **CDN & Edge Caching:** Depending on `Cache-Control` headers and edge PoP behavior, repeat requests from the same region may be served from edge cache without hitting origin logs, or conversely, uncached retries may inflate origin counts.
3. **CI/CD Pipelines & Automated Smoke Tests:** Repository CI workflows, `site-verify.mjs` smoke checks, and downstream user CI builds repeatedly fetch `/r/*.json` on every commit.
4. **Registry Directory Crawlers & AI Scrapers:** Now that `@frame12` is listed in `https://ui.shadcn.com/r/registries.json`, ecosystem indexers, security scanners, and LLM crawlers periodically fetch `/r/registry.json` and item manifests without installing them into a project.
5. **Downstream Package Manager Failures:** The `shadcn` CLI fetches `/r/<name>.json` *before* running `npm install` / `pnpm add`. If a developer's local environment fails during dependency installation (e.g., peer dependency conflict, network timeout, or disk space), `/r/<name>.json` still records an HTTP `200` even though the install did not succeed.
6. **Direct Browser Inspection:** Developers clicking raw manifest links on `/components` or `/get-started` generate browser `GET /r/*.json` requests strictly for inspection.

**Recommended Heuristic for Registry Log Analysis:**
- Separate `/r/*.json` traffic by `User-Agent` (CLI runtime requests vs. browser `Mozilla/*` requests vs. known crawler bots).
- Group CLI requests within a 15-second window from the same anonymized request context as a **single install session**, using `/r/frame12-base.json` as the upper-bound proxy for a new FRAME/12 workspace initialization rather than summing all 38 JSON endpoints.

### 3.2 Metrics That Cannot Be Measured Reliably Without Invasive Telemetry

The following metrics **cannot** be measured accurately under FRAME/12's privacy-first, copy-paste architecture, and we explicitly accept this trade-off rather than introducing invasive tracking:

| Unmeasurable / Partially Measurable Metric | Why It Cannot Be Reliably Measured Without Invasive Telemetry | Accepted Non-Invasive Substitute |
| :--- | :--- | :--- |
| **Exact count of production apps running FRAME/12** | Once source files are copied into `components/frame12/*`, they compile into the developer's own bundle with zero runtime callbacks to `frame12.dev`. | Opt-in *"Built with FRAME/12"* showcase submissions in GitHub Discussions and public GitHub code search (`"f12-sheet"` / `"--f12-ink"`). |
| **Client-side CLI install success vs. failure rate** | `npx shadcn@latest add @frame12/*` executes inside the user's local terminal; `frame12.dev` only sees the initial static JSON manifest `GET` request, not the local exit code. | Periodic clean-room E2E install tests in CI + friction reports in GitHub Issues. |
| **Long-window returning visitor retention (>24h)** | Without persistent tracking cookies, browser fingerprinting, or mandatory login walls on `frame12.dev`, cross-week visitor identity cannot be stitched deterministically. | GitHub Star/Watcher growth, 14-day unique vs. total git clones, and repeat community contributors. |
| **Post-install component customization or grammar drift** | We cannot observe whether teams keep `check-frame12.mjs` enabled in their private repositories after copying components. | Downloads/invocations of `skills/frame12/SKILL.md` and community feedback on `check-frame12` rules. |

---

## 4. Recommended Low-Friction Feedback Loops for Launch

Without adding any analytics SDK or changing component code, we recommend using three transparent GitHub channels to capture high-signal qualitative data during the `v0.2.0` public launch:

1. **GitHub Issues (`https://github.com/lbrodie11/frame12/issues`):**
   - Bug reports, accessibility/layout edge cases, and `shadcn` CLI installation issues.
2. **GitHub Discussions (`https://github.com/lbrodie11/frame12/discussions`):**
   - **`Show & Tell`:** Developers share screenshots or URLs of apps built with FRAME/12.
   - **`Component & Block Requests`:** Upvoted prioritization for `v0.3` primitives (`CommandPalette`, `Drawer`, `DateRangePicker`, etc.).
   - **`Agentic UI & Production Workflows`:** Open thread to gauge real-world pain points around human-in-the-loop agent approvals (`agent-review-console` vs. server-enforced approval workflows).
3. **GitHub Insights Weekly Snapshot:**
   - Record a simple weekly markdown log of GitHub Stars, Forks, Unique Visitors, Unique Cloners, Referring Sites (`ui.shadcn.com` referrals), and Open Issues/PRs to track launch velocity over the first 30 days.
