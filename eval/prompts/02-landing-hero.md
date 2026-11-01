# Prompt 02: Product Landing Page Hero + Feature Breakdown

Build a product landing page hero, live interactive metric/chart showcase, and feature breakdown using the FRAME/12 design system (`@frame12/registry`) and following `skills/frame12/SKILL.md`.

## Requirements

1. **Sheet Header & Hero Call to Action:**
   - Render a `<Sheet>` with registration pegs, an eyebrow with `<Tag>` (`Release 2.4`) and `<Badge>` (`On Twos · 12fps`), a bold display headline (`Checkout Recovery Drawn in Ink`), and a concise value proposition subtitle.
   - Provide a `<SegmentedControl>` to toggle the live preview window between `7 days`, `30 days`, and `90 days`, a motion mode selector (`12fps`, `60fps`, `0ms`), and hero action buttons (`Start recovery sheet` `variant="primary"` and `Read specification` `variant="secondary"`).

2. **Establishing Scene (`gutter="scene"`, `layout="split"`) — Live Showcase (`C-01`, `C-02`, `C-03`):**
   - `C-01`: Hero showcase panel with a `big` `<Metric>` (`Recovered checkout revenue`), a comparison legend, and an interactive `<ToneAreaChart>` featuring a 45° screentone fill, speech-balloon peak callout, keyboard crosshair navigation, and collapsible `<details className="tbl">` data table.
   - `<PanelPair>` (`C-02` over `C-03`):
     - `C-02`: `Net margin retained` `<Metric>` with directional `<Delta>` and `<ToneSpark>`.
     - `C-03`: `Checkout conversion lift` `<Metric>` (percentage points) with directional `<Delta>` and `<ToneSpark>`.

3. **Feature Breakdown Scene (`gutter="change"`, `layout="equal"`) — Interactive Capability Comparison (`C-04`) & Architecture Guarantees (`C-05`):**
   - `C-04`: `<ToneBarList>` ranking recovery capabilities (`Abandoned-cart dispatch`, `Exit-intent holdout offer`, `Payment-retry cadence`, `Back-in-stock reservation`) where clicking a capability overlays its comparison curve onto `C-01`'s `<ToneAreaChart>`.
   - `C-05`: Production guarantees panel with a standalone `<Balloon>` annotation, a `<Table>` of latency and contrast guarantees, and a trial onboarding `<Dialog>` (`cut="C-06"`) with an `<Input>` for work email and a `<Select>` for monthly order volume.
