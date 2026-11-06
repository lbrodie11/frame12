# FRAME/12 — Privacy-Conscious Adoption Measurement Specification

> **Status:** Launch-Readiness Specification (`v0.2.0`)  
> **Scope:** Public documentation site (`frame12.dev`), static `shadcn` registry endpoints (`/r/*.json`), and GitHub repository (`lbrodie11/frame12`)  
> **30-Day Launch Stack:** Vercel Web Analytics (cookieless aggregate pageviews & referrers on `frame12.dev`) + GitHub Insights (with regular snapshots) + direct developer feedback  
> **Policy:** Zero telemetry in copied components; no custom visitor fingerprinting or session-identification hashes.

---

## 1. 30-Day Launch Measurement Architecture & Privacy Policy

FRAME/12 is hosted on Vercel (`frame12.dev`). For the initial 30-day public launch window, adoption measurement uses a minimal, privacy-conscious stack without building custom tracking infrastructure:

1. **Vercel Web Analytics (Documentation Site Only):**
   - Uses Vercel's included **Web Analytics** (cookieless, anonymized aggregate pageviews, top routes, and HTTP referrers) inside `site/app/layout.tsx` (`@vercel/analytics/next`).
   - Do **not** enable paid add-on tiers (such as Web Analytics Plus) or third-party analytics providers (Google Analytics, Plausible, Umami); monitor usage under the Vercel team's Spend Management settings.
   - Keep Vercel Runtime Logs for operational diagnostics rather than launch analytics, as runtime logs have short retention windows and do not capture cached static CDN hits comprehensively.
2. **GitHub Repository Insights (With Regular Snapshots):**
   - Tracks repository stars, forks, watchers, unique visitors, unique cloners, and referring sites.
   - Because GitHub Insights only retains traffic data for a **rolling 14-day window**, record weekly snapshots so a complete 30-day launch comparison is preserved.
3. **Strict Non-Invasive Privacy Boundaries:**
   - **Zero telemetry in copied registry payloads:** Code distributed via `npx shadcn@latest add @frame12/*` (`registry/ui/*`, `registry/blocks/*`, `registry/hooks/*`, `registry/styles/*`) and `templates/next-starter/*` must remain 100% free of analytics imports, outbound network beacons, or runtime tracking.
   - **No custom visitor fingerprinting or session hashing:** Do not build custom visitor-identification hashes, cookies, or cross-session tracking mechanisms.

---

## 2. Measurement Matrix Across the 8 Core Adoption Signals

| # | Signal Category | Primary Observable Indicators | Collection Source (Cookieless / Non-Invasive) | What It Decision-Validates |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Documentation Visits** | Aggregate visitors & pageviews, top entry routes (`/`, `/get-started`, `/components`, `/style-sheet`, `/motion`, `/agents`), and traffic sources/referrers (`ui.shadcn.com`, `github.com`, X/social, search). | Vercel Web Analytics + GitHub Insights Referring Sites. | Which launch channels drive top-of-funnel awareness and whether visitors reach `/get-started` and `/components`. |
| **2** | **Application Block Interest** | Pageviews on `/blocks/developer-console`, `/blocks/workspace-settings`, and `/blocks/analytics-dashboard`, alongside approximate manifest requests to `/r/developer-console.json`, `/r/workspace-settings.json`, and `/r/analytics-dashboard.json`. | Vercel Web Analytics (`/blocks/*` routes) + CDN/hosting request counts where available. | Relative interest across developer tooling (`DeveloperConsole`), everyday SaaS workflows (`WorkspaceSettings`), and analytics applications (`AnalyticsDashboard`). |
| **3** | **Registry Endpoint Requests** | Approximate HTTP `200` / `304` request counts by item slug (`/r/frame12.json`, `/r/sheet.json`, `/r/panel.json`, `/r/<block>.json`) and `/llms.txt` / `/llms-full.txt`. | Hosting/edge request metrics where available (treated strictly as approximate interest, never confirmed installs). | Relative demand across full-kit downloads, individual primitives, application blocks, and LLM context endpoints. |
| **4** | **Successful Installation Feedback** | Qualitative and opt-in signals: GitHub Discussions *"Show & Tell / Built with FRAME/12"*, GitHub Issues labeled `installation`, starter template clones (`templates/next-starter`), and `npx skills add` reports. | GitHub Discussions, GitHub Issues, and GitHub traffic API (`clones`, `views`). | Whether developers complete end-to-end setup into a compiling app and where framework/tooling friction occurs. |
| **5** | **GitHub Community Participation** | Stars, forks, watchers, unique repository visitors/clones (rolling 14-day GitHub Insights window archived weekly), open/closed issues, external PRs, and discussion threads. | GitHub Repository Insights & GitHub REST/GraphQL API. | Organic developer advocacy, contributor velocity, and long-term open-source momentum. |
| **6** | **Returning Developers (Where Measurable)** | Repeat GitHub issue/discussion contributors and repeat repository cloners (`total clones` vs. `unique cloners` in 14-day GitHub Insights snapshots) without custom visitor-identification hashes. | GitHub Insights & community activity logs. | Whether evaluators return after initial discovery to contribute, ask follow-up questions, or pull updates. |
| **7** | **Requests for Advanced Integrations** | Feature requests and discussion threads asking for `v0.3`/`v0.4` components (`CommandPalette`, `Drawer`, `DateRangePicker`), framework starters (`Vite`, `Astro`, `Remix`), or live data/auth adapters. | Structured GitHub Issue templates and GitHub Discussions upvote counts. | Prioritization order for the `v0.3` component backlog and `v0.4` agentic primitives. |
| **8** | **Interest in Commercial Workflow Kits** | Inbound inquiries, GitHub Discussions threads on production human-in-the-loop agent governance, and direct customer discovery interviews regarding **FRAME/12 Studio — Agent Review Kit**. | Direct developer conversations and GitHub Discussions (`Agentic UI & Production Workflows`). | Whether teams building with Vercel AI SDK + Next.js (and MCP tool calls or LangGraph) have urgent, funded backend approval needs. |

---

## 3. Explicit Limitations & Interpretation Guardrails

To avoid vanity metrics or false conclusions, launch reporting must enforce the following analytical guardrails:

### 3.1 Why `/r/*.json` Request Counts $\neq$ Unique Developers or Successful Installs

Raw HTTP request counts to `https://frame12.dev/r/*.json` **must never be reported as "unique developers" or "completed installations"** for six technical reasons:

1. **Manifest Dependency Fan-Out Varies by Target:** Different `npx shadcn@latest add` commands produce different HTTP request patterns based on `registry/registry.json`:
   - `@frame12/frame12` (`frame12.json`) embeds all 31 components, styles, and the motion hook in a single self-contained manifest (`0` `registryDependencies`, `1` manifest request).
   - Flagship block items (`@frame12/developer-console`, `@frame12/workspace-settings`, `@frame12/analytics-dashboard`) declare `registryDependencies` on `frame12-styles.json` and `frame12.json` (`3` manifest requests for a single CLI command).
   - `@frame12/frame12-base` (`frame12-base.json`) resolves `frame12-styles.json`, `use-on-twos.json`, and the 3 `font-*.json` manifests (`6` manifest requests).
   - Individual components resolve `frame12-styles.json` plus any required hook (`use-on-twos.json`) or sibling component manifests (e.g., `sheet.json` fetches `frame12-styles.json` and `use-on-twos.json`; `dialog.json` fetches `frame12-styles.json` and `button.json`).
2. **CDN & Edge Caching:** Repeat requests from the same region may be served from edge cache without hitting origin logs, while uncached retries inflate origin counts.
3. **CI/CD Pipelines & Automated Smoke Tests:** Repository CI workflows, `site-verify.mjs` smoke checks, and downstream user CI builds repeatedly fetch `/r/*.json` on every commit.
4. **Registry Directory Crawlers & AI Scrapers:** Because `@frame12` is listed in `https://ui.shadcn.com/r/registries.json`, ecosystem indexers, security scanners, and LLM crawlers periodically fetch `/r/registry.json` and item manifests without installing them into a project.
5. **Downstream Package Manager Failures:** The `shadcn` CLI fetches `/r/<name>.json` *before* running `npm install` / `pnpm add`. If a developer's local environment fails during dependency installation, `/r/<name>.json` still records an HTTP `200` even though the install did not complete.
6. **Direct Browser Inspection:** Developers clicking raw manifest links on `/components` or `/get-started` generate browser `GET /r/*.json` requests strictly for inspection.

> **Analytical Guardrail:** No single manifest endpoint (including `/r/frame12-base.json` or `/r/frame12.json`) bounds total workspace initializations—developers can install `@frame12/frame12`, individual components (`@frame12/sheet`), or blocks (`@frame12/developer-console`) while `/r/frame12-base.json` remains zero. Always report `/r/*.json` request counts as **approximate item-level interest signals**, never as unique developers or confirmed installations.

### 3.2 Metrics That Cannot Be Measured Reliably Without Invasive Telemetry

The following metrics **cannot** be measured accurately under FRAME/12's privacy-first, copy-paste architecture, and we explicitly accept this trade-off rather than introducing invasive tracking:

| Unmeasurable / Partially Measurable Metric | Why It Cannot Be Reliably Measured Without Invasive Telemetry | Accepted Non-Invasive Substitute |
| :--- | :--- | :--- |
| **Exact count of production apps running FRAME/12** | Once source files are copied into `components/frame12/*`, they compile into the developer's own bundle with zero runtime callbacks to `frame12.dev`. | Opt-in *"Built with FRAME/12"* showcase submissions in GitHub Discussions and public GitHub code search (`"f12-sheet"` / `"--f-ink"`). |
| **Client-side CLI install success vs. failure rate** | `npx shadcn@latest add @frame12/*` executes inside the user's local terminal; `frame12.dev` only sees the static JSON manifest `GET` request, not the local exit code. | Periodic clean-room E2E install tests in CI + friction reports in GitHub Issues. |
| **Cross-week individual visitor identity** | Cookieless analytics and the absence of login walls or custom fingerprinting mean visitors are not tracked across weeks or devices. | Aggregate pageview trends in Vercel Web Analytics, GitHub Star/Watcher growth, 14-day unique vs. total git clones, and repeat community contributors. |
| **Post-install component customization or grammar drift** | We cannot observe whether teams keep `check-frame12.mjs` enabled in their private repositories after copying components. | Downloads/invocations of `skills/frame12/SKILL.md` and community feedback on `check-frame12` rules. |

---

## 4. Recommended 30-Day Launch Checklist

1. **Vercel Web Analytics (`frame12.dev`):**
   - Monitor aggregate visitors, pageviews, referrers (`ui.shadcn.com`, `github.com`, X/social), and top routes (`/get-started`, `/components`, `/blocks/developer-console`, `/blocks/workspace-settings`, `/blocks/analytics-dashboard`, `/agents`).
   - Optionally evaluate 2–3 lightweight custom events later (e.g., *Copy Install Command*, *Copy Component Code*, *Open GitHub*) only if needed after establishing a baseline.
2. **Weekly GitHub Insights Snapshot:**
   - Export or log a weekly snapshot (Day 7, Day 14, Day 21, Day 30) of GitHub Stars, Forks, Unique Visitors, Unique Cloners, and Referring Sites so the rolling 14-day window does not lose early launch data.
3. **GitHub Issues & Discussions Feedback Loop:**
   - Track installation friction in **[GitHub Issues](https://github.com/lbrodie11/frame12/issues)** and component/workflow requests in **[GitHub Discussions](https://github.com/lbrodie11/frame12/discussions)**.
