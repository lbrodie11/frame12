# Work Package 2 — Registry & Distribution Modernization (`@frame12/registry`)

**Status:** Implemented & Verified  
**shadcn CLI Version Tested:** `4.23.0` (`@shadcn/registry`)  
**Total Validated Payloads:** `26` (`site/public/r/*.json`) + `registry.json` catalog

---

## 1. Shared `registryDependencies` Architecture (8.1)

Prior to Work Package 2, every individual component manifest (`sheet.json`, `panel.json`, `tone-area-chart.json`, etc.) embedded duplicate copies of `styles/frame12.css` (`~31 KB`), `hooks/use-on-twos.ts` (`~4 KB`), and sibling primitives (`ui/panel.tsx`, `ui/button.tsx`, `ui/badge.tsx`) directly inside its `files` array.

### Dependency Graph (Strict Acyclic DAG, Max Depth = 2)

All 19 individual component items now declare only their own source file in `files` and reference shared assets via `registryDependencies`:

| Tier | Registry Items | `registryDependencies` |
| --- | --- | --- |
| **Tier 0 (Leaf Primitives)** | `frame12-styles`, `use-on-twos`, `font-dela-gothic-one`, `font-zen-kaku-gothic-new`, `font-m-plus-1-code` | None (`[]`) |
| **Tier 1 (Core UI & Base)** | `scene`, `segmented-control`, `button`, `input`, `tag`, `balloon`, `select`, `tooltip`, `table` | `["https://frame12.dev/r/frame12-styles.json"]` |
| **Tier 1 (Motion-Enabled UI)** | `sheet`, `panel`, `metric`, `tone-area-chart`, `tone-spark` | `["https://frame12.dev/r/frame12-styles.json", "https://frame12.dev/r/use-on-twos.json"]` |
| **Tier 1 (`registry:base`)** | `frame12-base` | `frame12-styles`, `use-on-twos`, `font-dela-gothic-one`, `font-zen-kaku-gothic-new`, `font-m-plus-1-code` |
| **Tier 2 (Composite UI)** | `badge` | `frame12-styles`, `tag` |
| **Tier 2 (Composite UI)** | `panel-pair` | `frame12-styles`, `use-on-twos`, `panel` |
| **Tier 2 (Composite UI)** | `tone-bar-list` | `frame12-styles`, `use-on-twos`, `badge` |
| **Tier 2 (Composite Adapters)** | `dialog`, `dropdown-menu` | `frame12-styles`, `button` |
| **Bundle (`registry:block`)** | `frame12` | Self-contained full-kit bundle (`23` files + Radix dependencies) for single-request installation |

### CLI Deduplication & Overwrite Semantics

- When installing multiple components (e.g., `npx shadcn@latest add https://frame12.dev/r/sheet.json https://frame12.dev/r/panel.json`), `@shadcn/registry` deduplicates `registryDependencies` URLs in memory before fetching (`new Set`) and deduplicates resolved target files by output path (`styles/frame12.css`, `hooks/use-on-twos.ts`), writing each shared file once.
- All FRAME/12 UI files explicitly set `"target": "components/frame12/<name>.tsx"`, ensuring zero collision with existing `components/ui/*` files in consumer repositories.
- **Modified `frame12.css` & Non-Interactive Installs (`--overwrite`):** Because every individual component manifest depends on `frame12-styles` (`styles/frame12.css`), if a consumer edits `styles/frame12.css` locally or has an older version installed, running `npx shadcn@latest add <url> -y` without `--overwrite` will skip overwriting and exit with code `0` without installing the requested component in non-interactive shells. Consumer and agent docs therefore enforce three rules:
  1. Never edit `styles/frame12.css` directly; place custom `--f-*` token overrides in your own stylesheet (e.g., `app/globals.css`).
  2. Pass `--overwrite` when upgrading or adding components after a FRAME/12 update.
  3. Coding agents must verify that `components/frame12/<name>.tsx` exists on disk after running `shadcn add`, rather than trusting exit code `0`.

---

## 2. `registry:base` Foundation Item (`frame12-base.json`) (8.2)

`https://frame12.dev/r/frame12-base.json` (`type: "registry:base"`) provides a single-command foundation setup:

```bash
npx shadcn@latest add https://frame12.dev/r/frame12-base.json
```

- Configures the `@frame12` namespace (`"registries": { "@frame12": "https://frame12.dev/r/{name}.json" }`) so subsequent installs can use short `@frame12/panel` names.
- Installs `styles/frame12.css`, `styles/frame12-tailwind.css`, and `hooks/use-on-twos.ts`.
- Pulls all three `registry:font` declarations (`font-dela-gothic-one`, `font-zen-kaku-gothic-new`, `font-m-plus-1-code`).
- Does **not** force a `style` migration (`base-nova` vs `new-york`) on existing projects, avoiding unexpected primitive transformations.

---

## 3. `registry:font` Declarations & Self-Hosted Option (8.3)

Three schema-validated `registry:font` items are published in `registry/registry.json` and `site/public/r/`:

| Item Name | Font Variable | Resolved FRAME/12 Token (`frame12.css`) | Family | Weights | License |
| --- | --- | --- | --- | --- | --- |
| `font-dela-gothic-one` | `--font-dela-gothic-one` | `--font-f-display` | `Dela Gothic One` | `400` | SIL OFL 1.1 |
| `font-zen-kaku-gothic-new` | `--font-zen-kaku-gothic-new` | `--font-f-body` | `Zen Kaku Gothic New` | `400`, `500`, `700` | SIL OFL 1.1 |
| `font-m-plus-1-code` | `--font-m-plus-1-code` | `--font-f-mono` | `M PLUS 1 Code` | `400`, `500`, `700` | SIL OFL 1.1 |

- **Distinct Font Variable Names Avoid Circular `@theme inline` Definitions:** Each `registry:font` item uses its own `--font-<slug>` CSS variable (`--font-dela-gothic-one`, `--font-zen-kaku-gothic-new`, `--font-m-plus-1-code`) so `shadcn`'s `@theme inline` mapping never generates a circular `--font-f-display: var(--font-f-display)` rule in `globals.css`. In `styles/frame12.css`, `:where(:root)` resolves `--font-f-display: var(--font-dela-gothic-one, "Dela Gothic One"), ...` (and likewise for `--font-f-body` and `--font-f-mono`).
- **Zero Runtime Network Dependency Required:** `styles/frame12.css` defines `:where(:root)` fallback stacks for `--font-f-display`, `--font-f-body`, and `--font-f-mono`, and `templates/next-starter/` ships self-hosted `.woff2` files via `next/font/local` with `site/src/fonts/OFL.txt` attribution.

---

## 4. Modern Registry Tooling & Validation (8.4)

- **Root `registry.json` Composition via `include`:**
  - `/registry.json` at the repository root declares `"include": ["./registry/registry.json"]`, enabling both `npx shadcn registry validate` from the repository root and direct GitHub source resolution (`lbrodie11/frame12`).
  - `/site/public/r/registry.json` serves the resolved, flattened `items` catalog required by `shadcn` HTTP consumer endpoints (which reject unflattened `include` arrays over HTTP).
- **CLI Inspection Flags Verified:**
  - `npx shadcn registry validate` — validates `registry.json` + `registry/registry.json` (`2` files, `26` items, `0` diagnostics).
  - `npx shadcn add <url> --view` / `--dry-run` / `--diff` — supported against all 26 `/r/*.json` payloads.

---

## 5. AI-Friendly Discovery (`/llms.txt`, `/llms-full.txt`, and `shadcn` MCP) (8.5)

- **`/llms.txt` (`site/app/llms.txt/route.ts`):** Statically generated (`force-static`) summary index derived from `CATALOG` (`site/src/lib/catalog.ts`) and `SITE_URL` (`site/src/lib/config.ts`).
- **`/llms-full.txt` (`site/app/llms-full.txt/route.ts`):** Statically generated (`force-static`) single-file reference compiled directly from `skills/frame12/SKILL.md`, `skills/frame12/references/components-and-adapters.md`, `skills/frame12/references/examples-and-mistakes.md`, `registry/registry.json`, and `CATALOG` (`site/src/lib/catalog.ts`), guaranteeing zero manual documentation drift.
- **`shadcn` MCP Integration:** Documented in `/llms.txt`, `/llms-full.txt`, and `README.md` via the `@frame12` namespace in `components.json` (`"@frame12": "https://frame12.dev/r/{name}.json"`).

---

## 6. Official `shadcn` Registry Directory Readiness (8.6)

FRAME/12 satisfies the technical requirements for listing in the official `shadcn` Registry Directory (`ui.shadcn.com/docs/directory`):

1. **Public Flat Catalog Endpoint:** `https://frame12.dev/r/registry.json` returns a resolved `registry.json` conforming to `https://ui.shadcn.com/schema/registry.json` without `include`.
2. **Valid Item Payloads:** All 26 `/r/{name}.json` endpoints conform to `https://ui.shadcn.com/schema/registry-item.json` and pass `npx shadcn registry validate`.
3. **URL Pattern:** `https://frame12.dev/r/{name}.json` (includes the required `{name}` placeholder).
4. **Proposed Directory Entry (Do Not Submit Without Maintainer Approval):**
   ```json
   {
     "name": "@frame12",
     "homepage": "https://frame12.dev",
     "url": "https://frame12.dev/r/{name}.json",
     "description": "Storyboard-grade React UI design system with ink-framed panels, screentone halftone charts, and 12fps motion on twos."
   }
   ```
