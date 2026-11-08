# Releasing Publishable `@frame12/*` Packages

FRAME/12 distributes its React component kit (`registry/`) through the `shadcn` registry (`@frame12` / `https://frame12.dev/r/<name>.json`), while standalone packages under `packages/*` are published to the npm registry under the `@frame12` scope:

| Package | Directory | Status | Purpose | Internal Dependencies |
| --- | --- | --- | --- | --- |
| `@frame12/tokens` | `packages/tokens` | In tree | Zero-dependency design tokens (`dist/tokens.css`, W3C DTCG 2025.10 `dist/tokens.json`, and TypeScript/JS `tokens` + `cssText`) | None |
| `@frame12/lint` | `packages/lint` | In tree | Programmatic design-grammar linter (`lintSource`, `lintHtml`, `lintFiles`, `lintDirectory`) and CLI (`frame12-lint`) with an optional `typescript` peer | None |
| `@frame12/static` | `packages/static` | Joining in F12-06 | Non-React HTML (`document`, `panel`, `metric`, `badge`, `tag`, `stamp`, `receipt`, `ghostWire`, `toneBarList`) and deterministic SVG/PNG social-card renderer (`renderCard`) | `@frame12/tokens` (exact version) |

> **Note:** The release pipeline never hard-codes package names. Both [`scripts/check-packages.mjs`](../scripts/check-packages.mjs) and [`scripts/release-packages.mjs`](../scripts/release-packages.mjs) discover publishable packages dynamically from `workspaces` entries in the root [`package.json`](../package.json) that live under `packages/` and do not set `"private": true`, then sort them in topological dependency order (`tokens` → `lint` → `static`). When `@frame12/lint` (F12-02) and `@frame12/static` (F12-06) land under `packages/`, they join the pipeline automatically.

---

## 1. Versioning & Exact Internal Dependencies

1. **Independent SemVer & Changelog per Package:**
   - Every publishable package under `packages/<pkg>/` maintains its own `version` in `packages/<pkg>/package.json` and its own `packages/<pkg>/CHANGELOG.md` using Keep-a-Changelog headings (`## [0.2.0] - YYYY-MM-DD`).
   - Do not modify the root `package.json` `"private": true` setting or the repo-wide `"packageManager": "npm@10.8.2"` pin.
2. **Exact Internal Dependency Versions (Never `workspace:*`):**
   - npm workspaces do **not** rewrite `workspace:*` specifiers during `npm publish`; publishing a manifest with `workspace:*` ships an uninstallable package to npm.
   - Internal dependencies between `@frame12/*` packages (for example `@frame12/static` depending on `@frame12/tokens`) must use the **exact** version string of the target workspace package (e.g. `"@frame12/tokens": "0.2.0"` — no `^`, `~`, or `workspace:` range prefix).
   - After bumping a package version, run:
     ```bash
     node scripts/check-packages.mjs --sync-deps
     npm run sync:workspaces
     ```
     to rewrite any internal `@frame12/*` dependency specifiers across `packages/*` to the exact current workspace versions and copy the root `LICENSE` into each package directory.

---

## 2. Automated Package Checks (`npm run pkg:check`)

`scripts/check-packages.mjs` runs automatically as part of `npm test` (via `npm run pkg:check`) and verifies every discovered package under `packages/`:

- `name` is scoped under `@frame12/<dir>` matching its `packages/<dir>` folder.
- `version` is valid SemVer (`X.Y.Z` or `X.Y.Z-prerelease`) and has a corresponding non-empty `## [<version>]` section in `packages/<dir>/CHANGELOG.md`.
- `license` is `"MIT"` and `LICENSE` + `README.md` exist in the package directory.
- `publishConfig.access` is `"public"`.
- `repository.directory` equals `"packages/<dir>"`.
- `files` contains **only** built output (`dist`), `README.md`, and `LICENSE` (no `src/`, `scripts/`, or `tests/`).
- Every target in `main`, `types`, `bin`, and `exports` resolves to an existing file on disk after `npm run build` (`types` condition listed before `default`).
- Zero external runtime `dependencies` — only internal `@frame12/*` workspace packages pinned to their **exact** current version (`@frame12/lint` may declare an optional `typescript` `peerDependencies` entry; no other runtime or peer dependencies are allowed).

### Standalone Install Smoke Test

`node scripts/smoke-install.mjs` (and `node scripts/smoke-install.mjs --packages-only`) packs every present publishable package with `npm pack`, installs the `.tgz` tarballs into an isolated temporary directory with **no other dependencies**, and executes runtime checks for whichever packages exist in the workspace:

- **`@frame12/tokens`:** imports `cssText` and `tokens`, verifying `--f-ink` and `--f-stroke` custom properties and palette tokens.
- **`@frame12/lint`:** calls `lintHtml` on a sample HTML page, verifying clean grammar passes and a hardcoded hex color triggers `color-literal`.
- **`@frame12/static`:** renders a full HTML page with `document()` and renders a deterministic `1200×630` SVG card with `renderCard()`.

---

## 3. Release Order & Tag Format

### Topological Release Order

Always release packages in dependency order so every internal `@frame12/*` dependency is already published on npm before a downstream package is tagged:

```text
1. tokens@<version>   (@frame12/tokens — zero dependencies)
2. lint@<version>     (@frame12/lint   — zero runtime dependencies)
3. static@<version>   (@frame12/static — depends on @frame12/tokens@<version>)
```

The release workflow enforces this order automatically: before publishing `<pkg>@<version>`, `node scripts/release-packages.mjs --verify-publish --tag <pkg>@<version>` queries `npm view <dep>@<exactVersion> version` for every internal dependency and aborts with a clear message if the required upstream version is not yet live on npm.

### Tag Format

Each package is released independently by pushing an annotated Git tag matching `<pkg>@<version>`:

- `tokens@0.2.0` → publishes `@frame12/tokens@0.2.0`
- `lint@0.2.0` → publishes `@frame12/lint@0.2.0`
- `static@0.2.0` → publishes `@frame12/static@0.2.0`

Repository-wide tags such as `v0.2.0` do not contain `@` and never trigger the package release workflow.

---

## 4. Dry-Run Mode

You can run the full release verification and tarball build without publishing to npm or creating a GitHub Release—either locally or in GitHub Actions.

### Option A: GitHub Actions `workflow_dispatch` (`dry_run: true`)

1. Open **Actions → Release Packages** (`.github/workflows/release-packages.yml`) in GitHub.
2. Click **Run workflow** on `main` with:
   - `package`: `all` (or a specific short name such as `tokens`, `lint`, or `static`)
   - `tag`: leave empty (or pass `tokens@0.2.0` to test tag matching)
   - `dry_run`: `true` (default)
3. The `verify` job installs dependencies, builds all workspaces, runs `npm test`, runs `node scripts/smoke-install.mjs --packages-only`, runs `npm publish --dry-run` + `npm pack` for each selected package, and uploads the `frame12-package-tarballs` artifact containing:
   - `frame12-tokens-<version>.tgz` (and `frame12-lint-<version>.tgz`, `frame12-static-<version>.tgz` when present)
   - `<pkg>-<version>-notes.md` (extracted changelog notes for the release)
   - `release-manifest.json` (packed file list, byte sizes, release order, and internal dependency status)
4. Because `dry_run` is `true`, the `publish` job is skipped.

### Option B: Local CLI Dry Run

```bash
npm run build
node scripts/release-packages.mjs --dry-run --out-dir /tmp/frame12-release-artifacts
```

Inspect `/tmp/frame12-release-artifacts/release-manifest.json` and the generated `.tgz` tarballs.

---

## 5. Trusted Publishing Architecture (OIDC Provenance)

`.github/workflows/release-packages.yml` publishes packages using **npm Trusted Publishing (OIDC)** with SLSA build provenance (`npm publish "$TARBALL_PATH" --provenance --access public --ignore-scripts`):

- **Zero long-lived npm tokens:** No `NPM_TOKEN` secret is stored in GitHub repository or organization secrets.
- **Verified-tarball promotion (no rebuild or `npm ci` in `publish`):** The `verify` job builds, tests, smoke-installs, and packs `frame12-<pkg>-<version>.tgz` alongside its SHA-256 digest in `release-manifest.json`. The privileged `publish` job downloads `frame12-package-tarballs`, verifies the `.tgz` SHA-256 digest against `release-manifest.json`, and publishes that exact `.tgz` tarball without running `npm ci` or `npm run build` while holding `id-token: write` and `contents: write`.
- **Git tag commit pinning & concurrency serialization:** Non-dry-run releases verify that `refs/tags/<pkg>@<version>^{commit}` equals `$GITHUB_SHA` in both `--resolve` and `--verify-publish`, preventing untagged branch commits from being published. Workflow and `publish`-job `concurrency` groups (`cancel-in-progress: false`) serialize simultaneous tag pushes so upstream npm dependency checks and GitHub Releases cannot race.
- **Node 24 + npm >= 11.5.1 runtime guard:** npm OIDC trusted publishing requires **Node.js >= 22.14.0** and **npm >= 11.5.1**. While the repository's root `packageManager` stays pinned at `npm@10.8.2` for local development and CI `verify` jobs, the isolated `publish` job runs on `ubuntu-24.04` with `node-version: 24` and executes `node scripts/release-packages.mjs --check-env` first, failing fast with a clear diagnostic if `npm --version` is below `11.5.1`.
- **Least-privilege permissions, `persist-credentials: false`, & SHA-pinned actions:** All third-party GitHub Actions are pinned to full 40-character commit SHAs, and `actions/checkout` runs with `persist-credentials: false`. Top-level permissions and the `verify` job have `contents: read` only; `id-token: write` and `contents: write` are scoped exclusively to the `publish` job.

---

## 6. Human Steps for First-Time Setup & Releasing

Automated agents never create npm orgs, modify npm package settings, or push release tags. Perform the following steps manually:

### One-Time npm Organization & Trusted Publisher Setup

1. **HUMAN STEP:** Create the `@frame12` organization on [npmjs.com](https://www.npmjs.com/) if it does not already exist.
2. **HUMAN STEP:** On npmjs.com, stage-create each package (`@frame12/tokens`, and `@frame12/lint`, `@frame12/static` when ready) and add a **Trusted Publisher** under **Package Settings → Publishing access**:
   - **Provider:** GitHub Actions
   - **Organization or user:** `lbrodie11`
   - **Repository:** `frame12`
   - **Workflow filename:** `release-packages.yml`
   - **Environment name:** *(leave blank unless you configure a GitHub Actions environment)*
3. **Important npm caveats:**
   - **2-day staging window:** Stage-created packages on npm expire after **2 days** if not published. Push the initial `<pkg>@<version>` tag within 2 days of staging the package on npm.
   - **Do not bootstrap with a manual prerelease:** If a package's very first publish on npm is a prerelease (e.g. `0.2.0-alpha.0`) without a stable `latest` dist-tag, `npm install @frame12/<pkg>` can fail to resolve `latest`. Make the initial publish a normal release version (`0.2.0`).

### Cutting a Package Release

1. Verify `packages/<pkg>/package.json` has the target `version` and `packages/<pkg>/CHANGELOG.md` has a matching `## [<version>] - YYYY-MM-DD` section on `main`.
2. Trigger a dry run first (**Actions → Release Packages → Run workflow** with `dry_run: true`) and inspect the uploaded `frame12-package-tarballs` artifact.
3. **HUMAN STEP:** Create and push the package tag in topological order (`tokens` → `lint` → `static`):
   ```bash
   git checkout main && git pull --ff-only
   git tag -a tokens@0.2.0 -m "Release @frame12/tokens v0.2.0"
   git push origin tokens@0.2.0
   ```
4. **HUMAN STEP:** Once the **Release Packages** workflow completes:
   - Confirm `@frame12/tokens@0.2.0` is live on npm (`npm view @frame12/tokens@0.2.0 version`) and displays the **Verified Provenance** badge on `https://www.npmjs.com/package/@frame12/tokens`.
   - Confirm the GitHub Release `tokens@0.2.0` (`@frame12/tokens v0.2.0`) was created with the extracted changelog notes.
   - Repeat for `lint@0.2.0` and then `static@0.2.0` once their PRs are merged and their packages are stage-created on npm.
