# Prompt 03: Order Recovery Ledger Data Table & Filter View

Build an order recovery and intervention ledger data table screen with multi-criteria filtering, summary KPIs, and row inspection using the FRAME/12 design system (`@frame12/registry`) and following `skills/frame12/SKILL.md`.

## Requirements

1. **Header & Status Filter (`SegmentedControl`):**
   - Render a `<Sheet>` with registration pegs, eyebrow metadata (`Ledger Sheet · Live Dispatch Log`), a display headline (`Order Recovery Ledger`), and a subtitle showing matching row count and filtered sum.
   - Provide a `<SegmentedControl>` to filter ledger rows by dispatch status (`All` / `Recovered` / `Pending` / `Holdout`) and a motion mode selector (`12fps`, `60fps`, `0ms`).

2. **Primary Scene (`gutter="scene"`, `layout="split"`) — Filter Bar + Ledger Table (`C-01`) & Paired Summary KPIs (`C-02`, `C-03`):**
   - `C-01`:
     - Filter bar combining `<Input>` (`Search order or customer`), `<Select>` (`Filter by channel`: `All channels`, `Abandoned-cart email`, `Exit-intent offer`, `Payment retry`, `Back-in-stock alert`), `<DropdownMenu>` (`Export filtered ledger` as CSV or JSON), and a `Reset filters` `<Button>`.
     - Semantic `<Table>` (`TableHeader`, `TableBody`, `TableFooter`, `TableRow`, `TableHead`, `TableCell`, `TableCaption`) listing order dispatches (`Order ID`, `Customer`, `Channel`, `Status`, `Lift`, `Recovered Amount`, and an `Inspect` action button).
   - `<PanelPair>` (`C-02` over `C-03`):
     - `C-02`: `Filtered recovery total` `<Metric>` (`big` numeral that counts up on twos as filters change) with `<Delta>` and `<ToneSpark>`.
     - `C-03`: `Filtered recovery rate` `<Metric>` with `<Delta>` and a standalone `<Balloon>` highlighting the top recovery channel.

3. **Secondary Scene (`gutter="change"`, `layout="equal"`) — Channel Share (`C-04`) & Audit Inspection (`C-05`, `C-06`):**
   - `C-04`: `<ToneBarList>` breaking down recovered revenue across channels for the active status filter; clicking a bar filters the table to that channel.
   - `C-05`: Dispatch inspection panel showing the currently selected order's timeline and a `<Dialog>` (`DialogContent cut="C-06"`) to inspect full webhook payload headers and trigger a manual replay.
