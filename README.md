# FRAME/12

An interface design language taken from animation and manga production: ink-framed panels, gutters whose width means something, screentone instead of gradients, and motion held on twos.

**Status: Phase 1 / Milestone 1.** This repository holds the Phase 1 lab (prototype, blind study, and style sheet) alongside the workspaces for the component registry, agent skill, and showcase site.

![FRAME/12 style sheet](docs/images/style-sheet-light.png)

## What's here

Three self-contained pages in `lab/`, built from one React codebase and one seeded dataset, so every number matches everywhere. Each build produces both `lab/dist/artifact/*.html` (page fragments for the Claude artifact host) and `lab/dist/standalone/*.html` (complete HTML5 documents with mobile viewport configuration).

| Page | For | What it does |
| --- | --- | --- |
| `lab/dist/standalone/prototype.html` | You and the designer critique | One recovery dashboard in a strong conventional style and in FRAME/12. Switch design, motion (smooth, stepped, cut), theme, and a grayscale test. |
| `lab/dist/standalone/study.html` | Participants | Blind, counterbalanced study: 3 timed tasks per design, 6 ratings each, a side-by-side comparison, 3 stepped-vs-smooth motion pairs. Add `#results` to the URL for the live decision. |
| `lab/dist/standalone/style-sheet.html` | Anyone | The visual language on one page: the sheet in light, dark and phone, panel grammar, construction details, motion, type and palette. |

All data is fictional (Fernwood Supply Co., 180 days ending Oct 31, 2026) and labelled "Example data" on screen.

## Quick start

```bash
npm install
npx playwright install chromium   # first time only, for the tests
npm run build                     # writes lab/dist/artifact/*.html and lab/dist/standalone/*.html
open lab/dist/standalone/style-sheet.html
```

The pages load React 18 from cdnjs and fonts from Google Fonts at view time. Everything else is inlined, so each file can be opened directly or published as a single page.

## Tests

| Command | Checks |
| --- | --- |
| `npm --workspace lab run test:study` | Walks the whole study on desktop and phone, decodes the result codes, imports them into the results view, and confirms scoring, design mapping and the decision rule. |
| `npm --workspace lab run test:a11y` | Text contrast against rendered backgrounds (WCAG AA), accessible names, unique ids, visible keyboard focus, stepped-motion pose count, reduced-motion behaviour. |
| `npm --workspace lab run test:screens` | Full-page screenshots of every page at 1280 and 390 px, light and dark, into `lab/test-results/`; fails on sideways scroll. |
| `npm test` | Runs `build` and test suites across all workspaces. |

Offline runs: set `F12_REACT_UMD` to a file that defines `window.React` and `window.ReactDOM`, and the harness serves it in place of the CDN. `CHROME_PATH` selects a browser binary.

## The language, briefly

- **Panel grammar.** Gutter width encodes relationship: 12 px pairs two panels, 20 px keeps them in one scene, 32 px starts a new scene. The largest panel is the establishing frame.
- **Cut numbers** (C-01, C-02…) sit in the frame line and always match reading order and code order.
- **Screentone** halftone fills replace gradients and transparency.
- **Speech-balloon annotations** point at the value they describe.
- **Marker yellow** is the only accent, and only ever sits under ink text.
- **Dark mode** turns the gutters black, the manga convention for flashback pages.
- **Motion on twos.** Discrete changes hold each pose for 83 ms (12 poses a second). Hover, scrolling and typing stay immediate. Reduced-motion settings make everything instant.
- **Type.** Dela Gothic One for display numbers, Zen Kaku Gothic New for body, M PLUS 1 Code for labels.

No named artist's work is reproduced or referenced in the product; every element is original.

## Phase 1 decision rule

The results view applies these automatically. Mobile and accessibility are team checks set on that page.

| Criterion | Passing rule |
| --- | --- |
| Visual distinctiveness | ≥70% pick FRAME/12 as more distinctive |
| Overall preference | ≥60% would rather use FRAME/12 |
| Task success | FRAME/12 within 10 points of Conventional |
| Efficiency | Median task time no more than 15% slower |
| Design consistency | Designers rate coherence ≥5.0 of 7 (3+ designers) |
| Mobile, accessibility | No critical defects |
| Animation | For one interaction or more: ≥60% prefer stepped or see no difference, ≤20% call it broken |

- **Proceed:** all of distinctiveness, preference, task success, efficiency, mobile and accessibility pass.
- **Revise:** distinctive, but anything else fails.
- **Stop or change direction:** not distinctive after one focused redesign.

Results are provisional until 16 responses.

## Roadmap

Each phase starts only when the gate before it passes.

1. **Visual identity:** prove FRAME/12 against an excellent conventional design. Gate: Proceed.
2. **Design grammar:** three reference screens (dashboard, landing page, settings); extract rules from what works. Gate: five screens in new palettes still read as one family.
3. **AI reproducibility:** small component set with shadcn adapters, tokens, a SKILL.md and lint rules, served as a shadcn registry. Gate: an agent builds a new screen with no manual restyling.
4. **Benchmark:** 20 fixed tasks comparing plain shadcn, an existing design skill and FRAME/12, rated blind. Gate: FRAME/12 preferred in 70%+ at reasonable cost.

## Layout

```
lab/
  src/
    data.js         seeded example data and study tasks (answers computed from the data)
    ui.jsx          shared dashboard components for both designs, motion hooks
    explorer.jsx    prototype page
    study.jsx       study flow, analysis and results view
    specimen.jsx    style sheet page
    styles.css      both design languages, themes, motion grammar
    shell.css       neutral chrome for the prototype and study
    specimen.css    style sheet layout
  scripts/build.mjs builds dist/artifact/*.html and dist/standalone/*.html with esbuild
  tests/            Playwright checks (Node) against dist/standalone/*.html
registry/           copy-in component source and shadcn registry (Milestone 2)
skills/frame12/     agent skill and design rules (Milestone 3)
site/               FRAME/12 documentation and showcase website (Milestone 4)
docs/images/        rendered screenshots
```

## Naming

Use `frame12` for anything technical (package, repo, URLs, registry); the slash in "FRAME/12" breaks them. "FRAME/12" stays the display name. The name has not been checked for trademark conflicts.

## Fonts

All typefaces used in FRAME/12 (`Dela Gothic One`, `Zen Kaku Gothic New`, and `M PLUS 1 Code`), as well as `Geist` and `Geist Mono` (used in the conventional comparison baseline only), are open-source and licensed under the [SIL Open Font License 1.1](https://openfontlicense.org/).

## License

MIT License — see [`LICENSE`](LICENSE). Copyright (c) 2026 Laqwan Brodie.
