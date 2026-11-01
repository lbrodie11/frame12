# Prompt 01: SaaS Workspace & Notification Settings

Build a workspace and notification settings page for a checkout recovery SaaS product using the FRAME/12 design system (`@frame12/registry`) and following `skills/frame12/SKILL.md`.

## Requirements

1. **Header & Environment Switcher:**
   - Render a top-level `<Sheet>` with registration pegs, eyebrow tags, a display title (`Workspace & Dispatch Settings`), and a subtitle showing the active environment and last saved status.
   - Include a `<SegmentedControl>` to switch between `Production` (`prod`), `Staging` (`stage`), and `Sandbox` (`dev`), plus a `<SegmentedControl>` to preview `12fps` (`stepped`), `60fps` (`smooth`), and `Cut` (`cut`) motion modes.

2. **Establishing Panel (`C-01`) — General Profile & Alert Thresholds:**
   - Inside `<Scene gutter="scene" layout="split">`, place `Panel` `C-01` as the primary form container.
   - Provide `<Input>` controls for:
     - `Workspace display name` (with helper hint)
     - `Alert lift threshold (%)` (validates that numeric value is `>= 10`; shows an accessible error alert when `< 10`)
     - `Webhook endpoint URL` (with helper hint)
   - Provide a `<Select>` adapter for `Primary delivery channel` (`Signed HTTPS webhook`, `Operations digest email`, `Slack incident room`).
   - Provide `Save configuration` (`variant="primary"`) and `Reset defaults` (`variant="secondary"`) buttons, plus a `<Tooltip>` explaining webhook retry timing.

3. **Paired KPIs (`C-02` & `C-03`) — Delivery Health:**
   - In the right column of the first scene, use `<PanelPair>` (`top` `C-02`, `bottom` `C-03`) across a `12px` slanted gutter:
     - `C-02`: `Webhook delivery rate` `<Metric>` with count-up on twos, directional `<Delta>`, and a `<ToneSpark>` showing daily delivery success over the last 14 days.
     - `C-03`: `Mean dispatch latency` `<Metric>` (in milliseconds) with directional `<Delta>` and `<ToneSpark>`.

4. **Second Scene (`gutter="change"`, `layout="equal"`) — API Keys (`C-04`) & Danger Zone (`C-05`):**
   - `C-04`: `API Signing Keys` panel containing a semantic `<Table>` of active keys (Key ID, Scope, Created, Status `<Tag>`) and a `<DropdownMenu>` to rotate or export key audit logs.
   - `C-05`: `Danger Zone` panel with a `<Balloon>` warning callout and a confirmation `<Dialog>` (`DialogContent cut="C-06"`) triggered by a `variant="marker"` button (`Revoke active signing secret`) with `Cancel` and `Confirm revocation` actions.
