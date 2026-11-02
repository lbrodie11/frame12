# Show HN Draft (`launch/drafts/show-hn.md`)

## Title (76 characters)

```text
Show HN: FRAME/12 – UI components drawn like print panels and shot on twos
```

## URL

```text
https://frame12.dev
```

*(Repository link in first comment / post text: `https://github.com/lbrodie11/frame12`)*

---

## First Comment / Post Text

Hi HN,

I built **FRAME/12** (`https://github.com/lbrodie11/frame12`), an open-source interface design language, React component registry, and AI agent skill drawn from two physical production crafts: sequential print page layout and hand-drawn cel animation.

Most modern web themes only swap surface colors, border radii, and drop shadows on top of the same floating-card layout. When you ask an AI coding agent to build three screens in a custom theme, it usually drifts back to generic `rounded-lg shadow-sm gap-4` cards by the second prompt because soft visual cues are hard to specify and impossible to lint.

FRAME/12 replaces soft decoration with structural geometry and explicit timing rules that both human engineers and coding agents can follow deterministically:

1. **Gutter width is semantic hierarchy (`12px` / `20px` / `32px`).** Instead of arbitrary spacing tokens, gutter width encodes narrative relationship: `12px` (`--f-gutter-pair`) couples two panels across a `16px` diagonal SVG slant (`PanelPair`), `20px` (`--f-gutter-scene`) groups panels within one scene, and `32px` (`--f-gutter-change`) marks a scene change on the sheet.
2. **Cut numbers (`C-01`, `C-02`…) lock visual and DOM order.** Every panel carries a sequential cut label in its top-left `2.5px` mitered ink border. Reading order, visual layout, and DOM order are required to match (`C-01` is always the establishing panel).
3. **45° SVG screentone instead of alpha gradients.** Area charts (`ToneAreaChart`), comparison bars (`ToneBarList`), and sparklines (`ToneSpark`) fill with rotated `<pattern>` halftone dots (`var(--f-tone)`) rather than translucent gradients or blur filters. Peak values use inked speech-balloon annotations (`Balloon`) that point directly at the datum.
4. **Flashback dark mode.** In print comics, a flashback scene signals a time shift by flooding the page gutters with solid black ink while keeping panel interiors legible. FRAME/12's dark mode sets the sheet gutters to `#070708` (`--f-sheet`) and panels to `#131316` (`--f-panel`) with `#f4f1ea` ink rules.
5. **Motion held "on twos" (`12fps`, `83.33ms` per pose).** In hand-drawn animation, most action is shot on twos—each drawing is held for two frames at `24fps` (`83.33ms`). In FRAME/12, discrete state transitions triggered by a decision (switching date ranges, counting up KPIs, wiping chart series, popping a badge with a two-frame SVG impact burst) quantize an ease-out spacing chart into `83.33ms` poses via `useOnTwos`. Meanwhile, direct hand manipulation (pointer hover, scrolling, typing, chart crosshairs) stays at `0ms` latency, and `prefers-reduced-motion: reduce` automatically switches every transition to an instant editorial hard cut (`0ms`).

### Zero External Animation or Charting Dependencies

Every component is copy-in React + TypeScript + CSS (`registry/styles/frame12.css`) served as a `shadcn`-compatible registry (`19` registry items: 14 core components, 5 accessible primitive adapters for `Dialog`, `Select`, `Tooltip`, `DropdownMenu`, and `Table`, motion hooks, and CSS tokens). There is no `framer-motion`, `gsap`, `recharts`, `d3`, or `lucide-react`:

- Diagonal panel frames (`Panel`, `PanelPair`) use a `ResizeObserver` to measure pixel dimensions and compute mitered `<svg>` `<polygon>` coordinates so the `2.5px` ink border never warps along the `16px` diagonal cut.
- The exposure-sheet segmented control (`SegmentedControl`) moves a solid ink bar across cells in 3 stepped poses (`steps(3, end)`) using `mix-blend-mode: difference`, cleanly inverting any numeral it crosses mid-step without sub-pixel blur.
- Every chart includes keyboard arrow inspection (`ArrowLeft`/`ArrowRight`/`Escape`) and a collapsible `<details>` semantic `<table>` fallback.

```bash
npx shadcn@latest add https://frame12.dev/r/frame12.json
```

### AI Reproducibility & Static Grammar Linting

Because every rule in FRAME/12 is structural, we packaged the design system into a portable Agent Skill (`skills/frame12/SKILL.md`) paired with a zero-dependency static checker (`scripts/check-frame12.mjs`) and ESLint plugin (`skills/frame12/eslint.frame12.mjs`) that fail on:
- `color-literal`: any hex/RGB/HSL literal or font name outside `frame12.css`
- `illegal-gutter`: any grid/flex gap or `Scene` gutter not in `{12px, 20px, 32px}`
- `marker-misuse`: highlighter yellow (`--f-marker`, `#ffd60a`) used anywhere except as a background under `--f-marker-ink` (`#121212`) text
- `cut-order`: skipped, duplicate, or out-of-order `C-01..C-0N` panel cuts
- `raw-shadcn-import`: raw unadapted UI primitives or external charting/animation packages

In `eval/`, we tested three unassisted product prompts (SaaS Workspace Settings, Product Landing Hero, and an Order Recovery Ledger) built from `SKILL.md` and verified them with Playwright across desktop (`1280px`) and mobile (`390px`) in light and dark themes (WCAG AA contrast, keyboard focus rings, sequential cut order, and zero horizontal overflow). The repo also includes the Phase 1 counterbalanced blind study (`lab/`) comparing FRAME/12 against a conventional baseline on timed comprehension tasks.

Live interactive motion studio, component gallery, and style sheet:
- Motion on twos studio: `https://frame12.dev/motion`
- Component registry & previews: `https://frame12.dev/components`
- Agent skill & linter benchmark: `https://frame12.dev/agents`
- Source (MIT): `https://github.com/lbrodie11/frame12`

Happy to answer questions about the SVG polygon frame math, the `useOnTwos` quantized spacing hook, or what we learned from linting AI-generated UI!
