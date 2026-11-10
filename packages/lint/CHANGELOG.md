# Changelog — `@frame12/lint`

All notable changes to `@frame12/lint` are documented in this file.

## [0.3.0] - 2026-11-10

### Added

- `ink-autoplay` rule (minor: a new rule can report violations in code that passed `0.2.x`). `play` on `InkStroke`, `InkReveal`, and `InkSequence` must not be the literal `true` (including the shorthand `play`, `!0`, `!false`) or a value constant at mount: an identifier bound to a `true` constant, a `useState(true)` whose setter is never used, or state set to `true` in a mount effect. FRAME/12 line art never draws on initial load (rule 5). The TypeScript AST path checks every form and resolves identifiers and state setters by lexical binding (sibling components with same-named setters, nested shadowing and parameters shadowing a module constant are told apart), and only mount-time calls count: a setter called directly in a mount effect or from a timer/microtask/promise callback scheduled there is flagged, one called from an event listener the effect registers is not; the regex fallback (no `typescript` installed) checks the literal forms.

## [0.2.1] - 2026-11-10

### Changed

- `lintHtml()` also accepts an object with a string form (for example an `@frame12/static` `Html` value) and lints `String(input)`. Before, a non-string argument was indexed character by character, so it linted nothing (or never finished when the object had a `length`). The declared type is now `string | { toString(): string }`.

## [0.2.0] - 2026-11-08

### Added

- Extracted the FRAME/12 design-grammar checker into the zero-dependency `@frame12/lint` package (`lintSource`, `lintFiles`, `lintDirectory`, `collectFiles`, `lintHtml`, `RULES`, `FORBIDDEN_SHADCN_MODULES`, `FORBIDDEN_EXTERNAL_PACKAGES`, `runCli`, and the `frame12-lint` CLI).
- Added `lintHtml(html, opts)` with a dependency-free HTML/SVG tag and attribute scanner enforcing `color-literal`, `illegal-gutter`, `marker-misuse`, `cut-order`, and `unsafe-html` with 1-based `line` and `column` reporting.
- Made `typescript` an optional peer dependency (`peerDependenciesMeta.typescript.optional = true`) with a built-in regex fallback and warning notice when `typescript` is not installed.
