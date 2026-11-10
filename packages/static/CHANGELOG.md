# Changelog: `@frame12/static`

All notable changes to `@frame12/static` are documented in this file.
This package adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-11-10

### Added

- Initial publishable release of `@frame12/static` (matching FRAME/12 `0.2.0`): framework-free
  HTML renderers with the React components' contract (F12-04).
  - Renderers: `sheet`, `scene`, `sceneArea`, `panel`, `panelPair`, `balloon`, `tag` (stamps
    are `tag({ variant: 'stamp' })`), `badge`, `metric`, `toneBarList`, `ghostWire`,
    `receipt` and `receiptList`. Each returns a branded `Html` string structurally identical to
    `renderToStaticMarkup` of the React primitive (see `PARITY.md` for every prop and divergence).
  - `document()` for self-contained offline pages (`<style data-f12-tokens>` +
    `<style data-f12-static>`, no scripts or requests), with `inlineCss: false` for
    CSP-restricted hosts.
  - Escaping contract: `escapeHtml`, `safeUrl` (`http:`, `https:`, `mailto:`, `#fragment`;
    fails closed), `unsafeRaw` as the only bypass, `fragment` for composition, and `isHtml`.
    Identifiers and numbers are validated and throw `TypeError` on bad input.
  - `panel({ width, height })` for exact-pixel frames (static-only), defaulting to React's SSR
    `viewBox="0 0 100 100"` frame.
  - `fmtPct`, `fmtPPAbs` and `fmtMoney` with the same output as React.
  - `dist/static.css` (`@frame12/static/static.css`) and `staticCss`, generated from
    `registry/styles/frame12.css` with class-manifest coverage and dead-weight gates.
  - Deterministic output: hash-derived auto ids, de-duplicated per `document()` call (or
    `dedupeIds()`), touching only auto `id`s and the ghost wire's own `mask` reference.
  - `Html` is a frozen object recognised by identity (not by text), so output never depends on
    earlier renders, replayed markup is escaped, and nothing is retained in memory.
  - `toIdent()` turns data (file paths, names) into valid identifiers.
  - Strict-CSP support: `data-fill` tone-bar widths and a one-column named-area fallback in
    `static.css`, tested under a real `Content-Security-Policy` in Chromium, Firefox and WebKit.
