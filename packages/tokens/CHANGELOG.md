# Changelog — `@frame12/tokens`

All notable changes to `@frame12/tokens` are documented in this file.
This package adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Line-art stroke widths for the ink primitives (`InkStroke`, `InkReveal`, `InkSequence`): `stroke.pencil` (`--f-stroke-pencil: 1px`, decorative construction lines) and `stroke.detail` (`--f-stroke-detail: 1.5px`, lines inside a frame), beside the existing `stroke.ink` (`--f-stroke: 2.5px`) for frames. Additive: no existing token changes. Not released yet (no version bump in this change).

## [0.2.0] - 2026-11-08

### Added

- Initial publishable release of `@frame12/tokens` (matching FRAME/12 `0.2.0`):
  - **`dist/tokens.css`** (`@frame12/tokens/tokens.css` and `@frame12/tokens/frame12-tokens.css`): self-contained CSS custom properties (`--f-*` and `--font-f-*`) for Paper Light and Flashback Dark modes (`@media (prefers-color-scheme: dark)`, `:root[data-theme="light"|"dark"]`, `.f12-theme-light`, `.f12-theme-dark`), plus 6 cross-platform metric-matched `@font-face` fallback rules (`f12DisplayFallback`, `f12DisplayFallbackDejaVu`, `f12BodyFallback`, `f12BodyFallbackDejaVu`, `f12MonoFallbackConsolas`, `f12MonoFallback`).
  - **`dist/tokens.json`** (`@frame12/tokens/tokens.json`): resolved W3C Design Tokens Community Group (DTCG 2025.10) JSON with typed `color`, `dimension`, `duration`, `number`, `fontFamily`, and `shadow` `$value` objects and light/dark mode maps under `$extensions["dev.frame12.modes"]`.
  - **`dist/index.js` & `dist/index.d.ts`** (`@frame12/tokens`): zero-dependency ESM module and TypeScript declarations exporting deep-frozen `tokens` (`light`, `dark`, `gutters`, `stroke`, `motion`, `fonts`, `shadow`) and `cssText`.
