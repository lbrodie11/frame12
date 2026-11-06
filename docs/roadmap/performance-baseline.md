# FRAME/12 Performance Baseline (`v0.2.0` Phase 0 / WP1)

- **Baseline Commit:** `840b134561f137f289f26cbd36a998c446c2dd89` (with WP1 fixes on `quality/cross-browser`)
- **Measurement Environment:**
  - OS: macOS (Apple Silicon)
  - Node.js: `v20.19.0`, npm: `10.8.2`
  - Next.js Production Build: `next build` + `next start` (`Next.js 14.2.35`, static/SSG routes on localhost)
  - Browser Harness: Playwright `1.64.1` resolved (`^1.55.0` declared; `Chromium 1248`, `1280×900`, `colorScheme: 'dark'`)
  - Methodology: **5 independent fresh browser-context runs per route** via `node scripts/measure-perf-baseline.mjs` under both **unthrottled localhost (Apple Silicon)** and **4× CPU throttled (`Emulation.setCPUThrottlingRate({ rate: 4 })`)** conditions, recording `PerformanceObserver('largest-contentful-paint')`, `PerformanceObserver('layout-shift')` (`!hadRecentInput`), network JavaScript bytes (`/_next/static/**/*.js`), SSR HTML byte size & pre-hydration content presence, console/hydration warnings, and a **clearly labeled laboratory interaction latency proxy** (click + double `requestAnimationFrame` next-paint completion time in ms).

---

## 1. Next.js Production Build Bundle Table (`@frame12/site`)

```text
Route (app)                              Route JS   First Load JS (gzipped)
┌ ○ /                                    6.55 kB         149 kB
├ ○ /_not-found                          873 B          88.2 kB
├ ○ /agents                              7.42 kB         150 kB
├ ○ /components                          13.1 kB         155 kB
├ ● /components/[slug] (19 SSG routes)   6.86 kB         149 kB
├ ○ /get-started                         6.04 kB         148 kB
├ ○ /motion                              7.13 kB         141 kB
└ ○ /style-sheet                         7.69 kB         150 kB
+ First Load JS shared by all            87.3 kB
```

**React 18 Starter Template (`@frame12/next-starter`):**
- `/` Route Size: `11.4 kB`, First Load JS: `98.6 kB` (shared `87.2 kB`).

---

## 2. Five-Run Laboratory Measurements Across Representative Routes

### 2.1 Summary Table — Unthrottled Localhost (Apple Silicon, 5-Run Medians)

| Route | LCP Median (ms) | CLS Median | First Load JS (Next Build) | Uncompressed Static JS (`/_next/static/*.js`) | SSR HTML Size | Pre-Hydration Theme & Content | Console / Hydration Warnings | Lab Interaction Next-Paint Proxy Median (ms) |
| --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| `/` | **40.0 ms** | **0.0003** | 149 kB | 614.4 KB (14 chunks) | 47.2 KB | Dark on frame 0 (`FOUC_SCRIPT` + `<polygon>` + chart `<path>` + spark `<svg>`) | 0 / 0 | 17.7 ms |
| `/motion` | **40.0 ms** | **0.0003** | 141 kB | 614.4 KB (14 chunks) | 63.2 KB | Dark on frame 0 (`FOUC_SCRIPT` + filmstrip + comparison stage) | 0 / 0 | 11.2 ms |
| `/components` | **36.0 ms** | **0.0000** | 155 kB | 637.8 KB (15 chunks) | 30.6 KB | Dark on frame 0 (`FOUC_SCRIPT` + 19-row catalog table + live specimens) | 0 / 0 | 9.6 ms |
| `/style-sheet` | **40.0 ms** | **0.0001** | 150 kB | 614.4 KB (14 chunks) | 80.4 KB | Dark on frame 0 (`FOUC_SCRIPT` + grammar SVG + 14 `.sw-chip` swatches) | 0 / 0 | 17.8 ms |
| `/agents` | **32.0 ms** | **0.0000** | 150 kB | 614.4 KB (14 chunks) | 29.5 KB | Dark on frame 0 (`FOUC_SCRIPT` + skill/linter rule reference) | 0 / 0 | 7.3 ms |
| `/get-started` | **32.0 ms** | **0.0000** | 148 kB | 614.4 KB (14 chunks) | 30.1 KB | Dark on frame 0 (`FOUC_SCRIPT` + step-by-step install guide) | 0 / 0 | 15.7 ms |
| `/components/panel` | **32.0 ms** | **0.0000** | 149 kB | 637.8 KB (15 chunks) | 25.2 KB | Dark on frame 0 (`FOUC_SCRIPT` + live `Panel` specimen + props table) | 0 / 0 | 15.6 ms |

### 2.2 Summary Table — 4× CPU Throttled (`Emulation.setCPUThrottlingRate({ rate: 4 })`, 5-Run Medians)

| Route | 4× CPU LCP Median (ms) | 4× CPU LCP 5-Run Raw (ms) | 4× CPU CLS Median | 4× CPU Lab Interaction Proxy Median (ms) | 4× CPU Interaction 5-Run Raw (ms) | Console / Hydration Warnings |
| --- | ---: | --- | ---: | ---: | --- | ---: |
| `/` | **92.0 ms** | `[252, 92, 136, 88, 92]` | **0.0003** | **24.5 ms** | `[27.7, 23.7, 23.4, 24.5, 30.0]` | 0 / 0 |
| `/motion` | **100.0 ms** | `[108, 100, 100, 96, 108]` | **0.0003** | **16.6 ms** | `[15.2, 16.5, 34.1, 16.6, 34.5]` | 0 / 0 |
| `/components` | **84.0 ms** | `[96, 84, 84, 80, 84]` | **0.0000** | **15.2 ms** | `[17.1, 14.6, 15.2, 19.2, 14.9]` | 0 / 0 |
| `/style-sheet` | **100.0 ms** | `[100, 100, 96, 104, 100]` | **0.0001** | **34.2 ms** | `[34.8, 32.8, 34.2, 38.3, 32.3]` | 0 / 0 |
| `/agents` | **72.0 ms** | `[68, 72, 72, 72, 72]` | **0.0000** | **14.9 ms** | `[14.9, 13.6, 18.3, 18.7, 14.3]` | 0 / 0 |
| `/get-started` | **84.0 ms** | `[84, 76, 96, 80, 84]` | **0.0000** | **16.7 ms** | `[16.7, 20.3, 12.0, 30.5, 12.4]` | 0 / 0 |
| `/components/panel` | **80.0 ms** | `[80, 76, 80, 76, 80]` | **0.0000** | **18.4 ms** | `[14.6, 14.9, 18.4, 32.5, 18.5]` | 0 / 0 |

### 2.3 Cold-Network Font-Swap CLS Verification (WP10 / TF-2)

- **Root Cause & Fix (WP10 TF-2):** Under `--font-delay-ms=1500` (delaying all `.woff2` responses by 1.5s):
  1. `M PLUS 1 Code` (`0.50em` advance width, `ascent: 1.0`, `descent: -0.235`, `lineGap: 0`) previously fell back to `ui-monospace` (`~0.60em` advance width).
  2. On Linux environments (where `local("Arial")` is absent), `next/font/local`'s auto-generated `Fallback` faces (`src: local("Arial")`) failed to match any installed font, falling back to unadjusted `DejaVu Sans` / `Liberation Sans` for `Dela Gothic One` (`131.74%` width ratio) and `Zen Kaku Gothic New` (`100.39%` width ratio).
  3. `.f12-body-copy` / `.f12-muted-copy` width caps used `ch` units (`68ch` / `66ch`, which shrank by ~48px when `Zen Kaku Gothic New`'s narrower `'0'` glyph swapped in), and at `320px` `.site-controls` wrapped from 1 row in fallback font to 2 rows in `Dela Gothic One`.
  4. **Resolution:** Added cross-platform metric-matched `@font-face` rules directly in `registry/styles/frame12.css` covering macOS, Windows, Linux, and Android (`f12DisplayFallback` & `f12DisplayFallbackDejaVu` for `Dela Gothic One`; `f12BodyFallback` & `f12BodyFallbackDejaVu` for `Zen Kaku Gothic New`; `f12MonoFallbackConsolas` & `f12MonoFallback` for `M PLUS 1 Code`), replaced font-dependent `ch` width caps with font-swap-invariant `em` units (`34.25em` / `33.25em`), and made `.site-controls` stack deterministically at `<= 360px` while staying single-row at `>= 361px` (`390px`).
- **10-Route Verification Results (`node scripts/measure-perf-baseline.mjs` & `--font-delay-ms=1500` on Next.js `15.5.29` / React `19.3.1`):**

| Route | LCP Median 1× / 4× (ms) | CLS Median (Local Fonts) | CLS Median (`.woff2` +1.5s Cold Swap) | Lab Interaction Proxy Median 1× / 4× (ms) | Pre-Hydration Dark & SSR Markup |
| --- | ---: | ---: | ---: | ---: | --- |
| `/` | **36 / 116** | **0.0002** | **0.0003** *(was 0.0526)* | 24.8 / 33.4 | ✓ (`FOUC_SCRIPT` + `<polygon>`) |
| `/motion` | **40 / 112** | **0.0001** | **0.0003** *(was 0.2686)* | 31.1 / 30.6 | ✓ (`FOUC_SCRIPT` + `<polygon>`) |
| `/components` | **40 / 100** | **0.0000** | **0.0001** *(was 0.1967)* | 28.7 / 26.8 | ✓ (`FOUC_SCRIPT` + `<polygon>`) |
| `/style-sheet` | **40 / 116** | **0.0001** | **0.0001** *(was 0.0520)* | 24.5 / 34.5 | ✓ (`FOUC_SCRIPT` + `<polygon>`) |
| `/agents` | **36 / 84** | **0.0000** | **0.0013** *(was 0.0518)* | 24.1 / 20.1 | ✓ (`FOUC_SCRIPT` + `<polygon>`) |
| `/get-started` | **36 / 92** | **0.0000** | **0.0002** *(was 0.0541)* | 23.9 / 22.7 | ✓ (`FOUC_SCRIPT` + `<polygon>`) |
| `/components/panel` | **32 / 96** | **0.0000** | **0.0004** *(was 0.0507)* | 22.4 / 28.1 | ✓ (`FOUC_SCRIPT` + `<polygon>`) |
| `/blocks/developer-console` | **44 / 132** | **0.0000** | **0.0002** *(was 0.0470)* | 24.1 / 31.1 | ✓ (`FOUC_SCRIPT` + `<polygon>`) |
| `/blocks/workspace-settings` | **36 / 100** | **0.0016** | **0.0013** *(was 0.3339)* | 20.4 / 29.1 | ✓ (`FOUC_SCRIPT` + `<polygon>`) |
| `/blocks/analytics-dashboard` | **44 / 120** | **0.0002** | **0.0002** *(was 0.0992)* | 26.0 / 38.0 | ✓ (`FOUC_SCRIPT` + `<polygon>`) |

Every single route now holds **CLS ≤ `0.0016`** with local fonts and **CLS ≤ `0.0013`** even under a 1.5-second cold-network webfont delay—nearly 8× below the `≤ 0.01` performance guardrail.

---

### Individual 5-Run Raw Data Per Route

#### 1. `/` (Home — Interactive Recovery Dashboard & Grammar Overview)
- **LCP (ms):** `[96, 40, 40, 36, 40]` -> **Median: `40.0 ms`**
- **CLS:** `[0.0003, 0.0003, 0.0003, 0.0003, 0.0003]` -> **Median: `0.0003`**
- **Lab Interaction Latency Proxy (`#home-rng-7` click -> 2× rAF paint, ms):** `[13.6, 18.6, 12.4, 19.3, 17.7]` -> **Median: `17.7 ms`**
- **SSR & First-Paint Verification:** `47,226 bytes` HTML; `hasFoucScript: true`, `hasSheetMarkup: true`, `hasPanelPolygon: true`; `0` console warnings, `0` hydration errors.

#### 2. `/motion` (Motion on Twos — 12fps vs 60fps vs Cut Comparison Stage)
- **LCP (ms):** `[40, 40, 40, 40, 40]` -> **Median: `40.0 ms`**
- **CLS:** `[0.0003, 0.0003, 0.0003, 0.0003, 0.0003]` -> **Median: `0.0003`**
- **Lab Interaction Latency Proxy (`#stage-compare-mode-cut` click -> 2× rAF paint, ms):** `[18.6, 8.2, 8.7, 16.8, 11.2]` -> **Median: `11.2 ms`**
- **SSR & First-Paint Verification:** `63,208 bytes` HTML; `hasFoucScript: true`, `hasSheetMarkup: true`, `hasPanelPolygon: true`; `0` console warnings, `0` hydration errors.

#### 3. `/components` (Component & Adapter Registry Index)
- **LCP (ms):** `[40, 36, 60, 36, 36]` -> **Median: `36.0 ms`**
- **CLS:** `[0, 0, 0, 0, 0]` -> **Median: `0.0000`**
- **Lab Interaction Latency Proxy (`#site-theme-light` click -> 2× rAF paint, ms):** `[9.6, 7.4, 12.2, 7.8, 16.9]` -> **Median: `9.6 ms`**
- **SSR & First-Paint Verification:** `30,649 bytes` HTML; `hasFoucScript: true`, `hasSheetMarkup: true`, `hasPanelPolygon: true`; `0` console warnings, `0` hydration errors.

#### 4. `/style-sheet` (Production Style Sheet, Tokens & Typography)
- **LCP (ms):** `[40, 40, 72, 40, 40]` -> **Median: `40.0 ms`**
- **CLS:** `[0.0001, 0.0001, 0.0001, 0.0001, 0.0001]` -> **Median: `0.0001`**
- **Lab Interaction Latency Proxy (`#site-theme-light` click -> 2× rAF paint, ms):** `[17.0, 17.8, 21.9, 17.5, 18.5]` -> **Median: `17.8 ms`**
- **SSR & First-Paint Verification:** `80,440 bytes` HTML; `hasFoucScript: true`, `hasSheetMarkup: true`, `hasPanelPolygon: true`; `0` console warnings, `0` hydration errors.

#### 5. `/agents` (AI Agent Skill, Linter & Evaluation Harness)
- **LCP (ms):** `[32, 32, 36, 32, 32]` -> **Median: `32.0 ms`**
- **CLS:** `[0, 0, 0, 0, 0]` -> **Median: `0.0000`**
- **Lab Interaction Latency Proxy (`#site-theme-light` click -> 2× rAF paint, ms):** `[10.0, 6.7, 7.3, 6.5, 10.4]` -> **Median: `7.3 ms`**
- **SSR & First-Paint Verification:** `29,499 bytes` HTML; `hasFoucScript: true`, `hasSheetMarkup: true`, `hasPanelPolygon: true`; `0` console warnings, `0` hydration errors.

#### 6. `/get-started` (Installation & Integration Guide)
- **LCP (ms):** `[36, 32, 36, 32, 32]` -> **Median: `32.0 ms`**
- **CLS:** `[0, 0, 0, 0, 0]` -> **Median: `0.0000`**
- **Lab Interaction Latency Proxy (`#site-theme-light` click -> 2× rAF paint, ms):** `[28.3, 14.3, 7.1, 15.7, 16.1]` -> **Median: `15.7 ms`**
- **SSR & First-Paint Verification:** `30,110 bytes` HTML; `hasFoucScript: true`, `hasSheetMarkup: true`, `hasPanelPolygon: true`; `0` console warnings, `0` hydration errors.

#### 7. `/components/panel` (Representative Dynamic SSG Component Detail Route)
- **LCP (ms):** `[32, 36, 32, 32, 32]` -> **Median: `32.0 ms`**
- **CLS:** `[0, 0, 0, 0, 0]` -> **Median: `0.0000`**
- **Lab Interaction Latency Proxy (`#site-theme-light` click -> 2× rAF paint, ms):** `[6.8, 16.1, 7.2, 19.9, 15.6]` -> **Median: `15.6 ms`**
- **SSR & First-Paint Verification:** `25,243 bytes` HTML; `hasFoucScript: true`, `hasSheetMarkup: true`, `hasPanelPolygon: true`; `0` console warnings, `0` hydration errors.

---

## 3. Performance Guardrails for v0.2.0 Work Packages (WP2–WP10)

1. **Zero Layout-Shift Regression:** Every route must maintain laboratory `CLS <= 0.01` (current medians `0.0000–0.0003`) by providing deterministic SSR viewBox/polygon dimensions and CSS `:has([aria-pressed="true"])` pre-hydration states for new components.
2. **Pre-Hydration Theme & Content Fidelity:** All new showcase routes (`/examples`, `/tokens`, `/changelog`) and new components must render complete structural markup with JavaScript disabled and paint dark on frame 0 when OS or saved `color-scheme` is `dark`.
3. **Client Bundle Discipline:** Shared First Load JS (`87.3 kB`) and per-route First Load JS (`141–155 kB`) must not grow through unnecessary third-party primitive libraries (enforced by ADR-001 in `docs/architecture/primitive-foundation.md`).
