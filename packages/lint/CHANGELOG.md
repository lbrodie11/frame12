# Changelog — `@frame12/lint`

All notable changes to `@frame12/lint` are documented in this file.

## [0.2.1] - 2026-11-10

### Changed

- `lintHtml()` also accepts an object with a string form (for example an `@frame12/static` `Html` value) and lints `String(input)`. Before, a non-string argument was indexed character by character, so it linted nothing (or never finished when the object had a `length`). The declared type is now `string | { toString(): string }`.

## [0.2.0] - 2026-11-08

### Added

- Extracted the FRAME/12 design-grammar checker into the zero-dependency `@frame12/lint` package (`lintSource`, `lintFiles`, `lintDirectory`, `collectFiles`, `lintHtml`, `RULES`, `FORBIDDEN_SHADCN_MODULES`, `FORBIDDEN_EXTERNAL_PACKAGES`, `runCli`, and the `frame12-lint` CLI).
- Added `lintHtml(html, opts)` with a dependency-free HTML/SVG tag and attribute scanner enforcing `color-literal`, `illegal-gutter`, `marker-misuse`, `cut-order`, and `unsafe-html` with 1-based `line` and `column` reporting.
- Made `typescript` an optional peer dependency (`peerDependenciesMeta.typescript.optional = true`) with a built-in regex fallback and warning notice when `typescript` is not installed.
