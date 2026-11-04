import { REGISTRY_BASE_URL } from '@/lib/config';

export type ComponentCategory =
  | 'Layout'
  | 'Controls'
  | 'Data & Charts'
  | 'Motion Hooks'
  | 'Primitive Adapters';

export interface PropDoc {
  name: string;
  type: string;
  defaultValue: string;
  description: string;
}

export interface CatalogEntry {
  slug: string;
  title: string;
  category: ComponentCategory;
  summary: string;
  registryUrl: string;
  sourceFile: string;
  props: PropDoc[];
  a11yNotes: string[];
  grammarNotes: string[];
  usageTemplate: string;
}

export const COMPONENT_CATEGORIES: ComponentCategory[] = [
  'Layout',
  'Controls',
  'Data & Charts',
  'Motion Hooks',
  'Primitive Adapters',
];

const RAW_CATALOG: CatalogEntry[] = [
  {
    slug: 'sheet',
    title: 'Sheet',
    category: 'Layout',
    summary:
      'Top-level storyboard container with top-edge registration pegs and 32px scene-change vertical rhythm.',
    registryUrl: 'https://frame12.dev/r/sheet.json',
    sourceFile: 'registry/ui/sheet.tsx',
    props: [
      {
        name: 'pegs',
        type: 'boolean',
        defaultValue: 'true',
        description: 'Renders the three animation registration peg punch-holes along the top edge.',
      },
      {
        name: 'autoCut',
        type: 'boolean',
        defaultValue: 'false',
        description:
          'Numbers child <Panel> and <PanelPair> elements automatically (C-01, C-02…) in DOM order via CSS counters.',
      },
      {
        name: 'motion',
        type: "'stepped' | 'smooth' | 'cut'",
        defaultValue: "'stepped'",
        description: 'Sets the active motion grammar class (.f12-m-stepped, .f12-m-smooth, or .f12-m-cut).',
      },
      {
        name: 'theme',
        type: "'light' | 'dark' | undefined",
        defaultValue: 'undefined',
        description: 'Optional explicit theme override (.f12-theme-light or .f12-theme-dark).',
      },
      {
        name: 'sheetClassName',
        type: 'string',
        defaultValue: "''",
        description: 'Additional class names applied to the inner .f12-sheet surface.',
      },
    ],
    a11yNotes: [
      'Registration pegs are marked aria-hidden="true" so assistive technologies skip decorative punch-holes.',
      'Automatically honors prefers-reduced-motion: reduce by switching stepped transitions to instant cuts.',
    ],
    grammarNotes: [
      'Establishes a 32px (--f-gutter-change) vertical gap between the header and each Scene.',
      'Frames the white paper sheet (--f-sheet) against the outer worktable desk (--f-desk).',
    ],
    usageTemplate: `import { Sheet, Scene, Panel } from '@/components/frame12';

export function OverviewSheet() {
  return (
    <Sheet autoCut pegs motion="stepped">
      <Scene gutter="scene" layout="stack">
        <Panel label="Establishing frame">
          <p>Storyboard sheet content</p>
        </Panel>
      </Scene>
    </Sheet>
  );
}`,
  },
  {
    slug: 'scene',
    title: 'Scene',
    category: 'Layout',
    summary:
      'Responsive CSS Grid layout container enforcing the three legal FRAME/12 gutter widths: 12px (pair), 20px (scene), and 32px (change).',
    registryUrl: 'https://frame12.dev/r/scene.json',
    sourceFile: 'registry/ui/scene.tsx',
    props: [
      {
        name: 'gutter',
        type: "'pair' | 'scene' | 'change'",
        defaultValue: "'scene'",
        description: 'Selects 12px (pair), 20px (scene), or 32px (change) grid gap.',
      },
      {
        name: 'layout',
        type: "'split' | 'stack' | 'equal' | 'three'",
        defaultValue: "'split'",
        description: 'Grid column template: 2fr/1fr (split), 1fr (stack), 1fr/1fr (equal), or 3-col (three).',
      },
    ],
    a11yNotes: [
      'Collapses multi-column grids to a single reading-order column below 760px container width.',
      'Preserves DOM order and keyboard tab sequence across desktop and mobile viewports.',
    ],
    grammarNotes: [
      'Arbitrary gaps (8px, 16px, 24px) are forbidden by check-frame12.mjs; always use Scene gutter props.',
      'Use layout="split" (2fr 1fr) when pairing an establishing C-01 panel with a PanelPair.',
    ],
    usageTemplate: `import { Scene, Panel } from '@/components/frame12';

export function SplitScene() {
  return (
    <Scene gutter="scene" layout="equal">
      <Panel label="Left frame">Left scene panel</Panel>
      <Panel label="Right frame">Right scene panel</Panel>
    </Scene>
  );
}`,
  },
  {
    slug: 'panel',
    title: 'Panel',
    category: 'Layout',
    summary:
      'Ink-framed section drawn with a measured SVG mitered polygon (2.5px stroke, 16px slant rise) and top-edge cut number.',
    registryUrl: 'https://frame12.dev/r/panel.json',
    sourceFile: 'registry/ui/panel.tsx',
    props: [
      {
        name: 'cut',
        type: 'string | false',
        defaultValue: 'undefined',
        description:
          'Inside <Sheet autoCut>, omit to number automatically (C-01, C-02…) via CSS counters, or pass false to hide the cut badge. Outside <Sheet autoCut>, pass an explicit sequential string (C-01, C-02…).',
      },
      {
        name: 'shape',
        type: "'rect' | 'slant-bottom' | 'slant-top'",
        defaultValue: "'rect'",
        description: 'Polygon geometry: rectangular or 16px diagonal slant along bottom/top edge.',
      },
      {
        name: 'variant',
        type: "'expressive' | 'quiet'",
        defaultValue: "'expressive'",
        description:
          'Selects the 2.5px SVG polygon storyboard frame (expressive) or the 1px orthographic exposure-sheet ledger frame (quiet, which omits automatic cut numbers by default).',
      },
      {
        name: 'label',
        type: 'string',
        defaultValue: 'undefined',
        description: 'Accessible aria-label applied to the underlying <section> element.',
      },
    ],
    a11yNotes: [
      'The SVG polygon border and cut badge carry aria-hidden="true" so screen readers announce the semantic content cleanly.',
      'Uses ResizeObserver on layout offsetWidth/offsetHeight so borders stay crisp at any viewport size.',
    ],
    grammarNotes: [
      'Inside <Sheet autoCut>, panels number automatically in DOM and reading order via CSS counters; pass cut={false} to suppress a cut on a panel, or pass explicit sequential cuts outside autoCut.',
      'Never replace Panel with a rounded card or drop-shadow box.',
    ],
    usageTemplate: `import { Panel, Metric, fmtCurrency } from '@/components/frame12';

export function RevenuePanel() {
  return (
    <Panel label="Recovered revenue">
      <Metric label="Recovered revenue" value={120054} format={fmtCurrency} big />
    </Panel>
  );
}`,
  },
  {
    slug: 'panel-pair',
    title: 'PanelPair',
    category: 'Layout',
    summary:
      'Couples two related panels vertically across a shared 12px slanted gutter (slant-bottom over slant-top).',
    registryUrl: 'https://frame12.dev/r/panel-pair.json',
    sourceFile: 'registry/ui/panel-pair.tsx',
    props: [
      {
        name: 'variant',
        type: "'expressive' | 'quiet'",
        defaultValue: "'expressive'",
        description:
          'When set to quiet, renders rectangular 1px orthographic panels without diagonal slants or automatic cut badges.',
      },
      {
        name: 'top',
        type: "Omit<PanelProps, 'shape'>",
        defaultValue: 'undefined',
        description: 'Props and children for the upper slant-bottom panel.',
      },
      {
        name: 'bottom',
        type: "Omit<PanelProps, 'shape'>",
        defaultValue: 'undefined',
        description: 'Props and children for the lower slant-top panel.',
      },
      {
        name: 'topCut / bottomCut',
        type: 'string | false',
        defaultValue: 'undefined',
        description:
          'Cut labels (or false to hide) when passing two child elements directly; omit inside <Sheet autoCut> for automatic numbering.',
      },
    ],
    a11yNotes: [
      'Renders top panel before bottom panel in DOM order, matching top-to-bottom reading order.',
      'Adds extra interior padding along the slanted edge so text never collides with the 16px diagonal.',
    ],
    grammarNotes: [
      'Encodes "these two metrics belong together" via a 12px (--f-gutter-pair) slanted gutter.',
      'Always pairs slant-bottom on top with slant-top on the bottom.',
    ],
    usageTemplate: `import { PanelPair, Metric, fmtCurrency, fmtPP } from '@/components/frame12';

export function PairedMetrics() {
  return (
    <PanelPair
      top={{ label: 'Profit', children: <Metric label="Incremental profit" value={38420} format={fmtCurrency} /> }}
      bottom={{ label: 'Lift', children: <Metric label="Conversion lift" value={0.51} format={fmtPP} /> }}
    />
  );
}`,
  },
  {
    slug: 'segmented-control',
    title: 'SegmentedControl',
    category: 'Controls',
    summary:
      'Exposure-sheet cell selector with a mix-blend-mode: difference indicator that steps across cells in 3 held poses.',
    registryUrl: 'https://frame12.dev/r/segmented-control.json',
    sourceFile: 'registry/ui/segmented-control.tsx',
    props: [
      {
        name: 'options',
        type: 'Array<{ value: T; label: string; unit?: string }>',
        defaultValue: 'required',
        description: 'Ordered cell options with display numeral/label and optional mono unit.',
      },
      {
        name: 'value',
        type: 'T',
        defaultValue: 'required',
        description: 'Currently active option value.',
      },
      {
        name: 'onChange',
        type: '(value: T) => void',
        defaultValue: 'required',
        description: 'Callback fired when a cell is activated.',
      },
      {
        name: 'ariaLabel',
        type: 'string',
        defaultValue: "'Options'",
        description: 'Accessible label for the role="group" container.',
      },
      {
        name: 'idPrefix',
        type: 'string',
        defaultValue: "'seg'",
        description: 'Prefix for deterministic button IDs (${idPrefix}-${opt.value}).',
      },
    ],
    a11yNotes: [
      'Uses role="group" with aria-pressed={active} on native <button type="button"> elements.',
      'Provides a 3px solid --f-marker inset focus ring on :focus-visible.',
    ],
    grammarNotes: [
      'In .f12-m-stepped mode, the indicator transitions with steps(3, end) over 250ms (3 held poses at 83.33ms).',
      'Uses mix-blend-mode: difference so text covered by the indicator remains legible at every intermediate pose.',
    ],
    usageTemplate: `import { SegmentedControl } from '@/components/frame12';

export function RangeSelector({ range, setRange }: { range: number; setRange: (r: number) => void }) {
  return (
    <SegmentedControl
      ariaLabel="Date range"
      options={[
        { value: 7, label: '7', unit: 'days' },
        { value: 30, label: '30', unit: 'days' },
        { value: 90, label: '90', unit: 'days' },
      ]}
      value={range}
      onChange={setRange}
    />
  );
}`,
  },
  {
    slug: 'button',
    title: 'Button',
    category: 'Controls',
    summary:
      'Ink-framed action button with immediate offset shadow on hover and primary, secondary, and marker-yellow variants.',
    registryUrl: 'https://frame12.dev/r/button.json',
    sourceFile: 'registry/ui/button.tsx',
    props: [
      {
        name: 'variant',
        type: "'primary' | 'secondary' | 'marker'",
        defaultValue: "'secondary'",
        description: 'Visual style: inverted ink (primary), paper surface (secondary), or marker yellow (marker).',
      },
      {
        name: 'size',
        type: "'sm' | 'md' | 'lg'",
        defaultValue: "'md'",
        description: 'Padding and monospace font scale.',
      },
    ],
    a11yNotes: [
      'Forwards ref to a native <button type="button"> with 3px solid --f-ink focus-visible outline.',
      'Marker variant pairs --f-marker background with --f-marker-ink text for 14.8:1 contrast.',
    ],
    grammarNotes: [
      'Hover state applies a hard 3px 3px 0 var(--f-rule) offset shadow immediately (0ms latency).',
      'Disabled buttons switch to a dashed ink border with --f-ink-2 text.',
    ],
    usageTemplate: `import { Button } from '@/components/frame12';

export function ActionRow() {
  return (
    <div className="f12-row-pair">
      <Button variant="primary">Deploy Rules</Button>
      <Button variant="marker">Run Replay</Button>
      <Button variant="secondary">Export CSV</Button>
    </div>
  );
}`,
  },
  {
    slug: 'input',
    title: 'Input',
    category: 'Controls',
    summary:
      'Accessible text input with linked monospace label, optional hint, and marker-flagged error alert.',
    registryUrl: 'https://frame12.dev/r/input.json',
    sourceFile: 'registry/ui/input.tsx',
    props: [
      {
        name: 'label',
        type: 'string',
        defaultValue: 'required',
        description: 'Visible label text programmatically linked to the <input> via htmlFor/id.',
      },
      {
        name: 'hint',
        type: 'string',
        defaultValue: 'undefined',
        description: 'Optional helper text linked via aria-describedby.',
      },
      {
        name: 'error',
        type: 'string',
        defaultValue: 'undefined',
        description: 'Validation error message rendered in a role="alert" live region with a marker flag.',
      },
      {
        name: 'density',
        type: "'comfortable' | 'compact'",
        defaultValue: "'comfortable'",
        description: 'Reduces input padding and switches to a 1.5px rule for dense settings and filter bars.',
      },
    ],
    a11yNotes: [
      'Automatically generates a stable ID via React.useId() when id is omitted.',
      'Sets aria-invalid={Boolean(error)} and chains hintId/errorId into aria-describedby.',
    ],
    grammarNotes: [
      'Uses a 2.5px solid --f-rule square border with zero border-radius.',
      'Error flags use --f-marker background under bold --f-marker-ink text.',
    ],
    usageTemplate: `import { Input } from '@/components/frame12';

export function WebhookField() {
  return (
    <Input
      label="Webhook signing secret"
      hint="Rotated every 90 days across production endpoints"
      defaultValue="whsec_f12_99481a"
    />
  );
}`,
  },
  {
    slug: 'badge',
    title: 'Badge',
    category: 'Controls',
    summary:
      'Bordered marker-yellow badge with ink text and an optional 14-ray SVG impact burst drawn for two frames.',
    registryUrl: 'https://frame12.dev/r/badge.json',
    sourceFile: 'registry/ui/badge.tsx',
    props: [
      {
        name: 'status',
        type: "'neutral' | 'info' | 'success' | 'warning' | 'danger'",
        defaultValue: 'undefined',
        description:
          'Non-color semantic status combining [i]/[+]/[!]/[×] glyph prefix, screen-reader status announcement, border weight/style, and fill inversion.',
      },
      {
        name: 'glyph',
        type: 'string | false',
        defaultValue: 'undefined',
        description: 'Overrides or suppresses (false) the automatic status glyph prefix.',
      },
      {
        name: 'pop',
        type: 'boolean',
        defaultValue: 'false',
        description: 'Triggers the 4-pose popStep animation and 2-frame impact burst when true.',
      },
      {
        name: 'burst',
        type: 'boolean',
        defaultValue: 'true',
        description: 'Renders the decorative 14-line radial SVG Burst behind the badge.',
      },
    ],
    a11yNotes: [
      'The radial SVG impact burst is marked aria-hidden="true".',
      'Always renders --f-marker-ink text over --f-marker background.',
    ],
    grammarNotes: [
      'Pair pop={changed} with useChanged(key) so the impact burst fires only on user-triggered changes, never on initial page load.',
    ],
    usageTemplate: `import { Badge } from '@/components/frame12';

export function LeaderBadge() {
  return <Badge pop burst>Top performer</Badge>;
}`,
  },
  {
    slug: 'tag',
    title: 'Tag',
    category: 'Controls',
    summary:
      'Flat inline highlighter strip (--f-marker background under --f-marker-ink uppercase monospace text).',
    registryUrl: 'https://frame12.dev/r/tag.json',
    sourceFile: 'registry/ui/tag.tsx',
    props: [
      {
        name: 'status',
        type: "'neutral' | 'info' | 'success' | 'warning' | 'danger'",
        defaultValue: 'undefined',
        description:
          'Non-color semantic status combining [i]/[+]/[!]/[×] glyph prefix, screen-reader status announcement, border weight/style, and fill inversion.',
      },
      {
        name: 'glyph',
        type: 'string | false',
        defaultValue: 'undefined',
        description: 'Overrides or suppresses (false) the automatic status glyph prefix.',
      },
      {
        name: 'children',
        type: 'React.ReactNode',
        defaultValue: 'required',
        description: 'Short metadata label rendered inside the marker strip.',
      },
    ],
    a11yNotes: [
      'Maintains 14.8:1 contrast ratio in both light and dark themes because --f-marker-ink stays dark ink.',
    ],
    grammarNotes: [
      'Marker yellow flags metadata and status callouts; it is never used as a text color or line stroke.',
    ],
    usageTemplate: `import { Tag } from '@/components/frame12';

export function EyebrowTag() {
  return <Tag>Example data</Tag>;
}`,
  },
  {
    slug: 'metric',
    title: 'Metric',
    category: 'Data & Charts',
    summary:
      'Headline KPI display with stepped count-up on twos, screen-reader polite live region, directional marker delta, and optional ToneSpark slot.',
    registryUrl: 'https://frame12.dev/r/metric.json',
    sourceFile: 'registry/ui/metric.tsx',
    props: [
      {
        name: 'label',
        type: 'string',
        defaultValue: 'required',
        description: 'Uppercase monospace metric heading (.f12-m-label).',
      },
      {
        name: 'value',
        type: 'number',
        defaultValue: 'required',
        description: 'Numeric metric value interpolated on twos via useCountUp.',
      },
      {
        name: 'format',
        type: '(value: number) => string',
        defaultValue: 'fmtCurrency',
        description: 'Formatter function converting numeric values to display strings.',
      },
      {
        name: 'delta',
        type: 'number',
        defaultValue: 'undefined',
        description: 'Optional relative change (percentage or percentage points).',
      },
      {
        name: 'deltaKind',
        type: "'pct' | 'pp'",
        defaultValue: "'pct'",
        description: 'Formats delta as percentage (%) or percentage points (pp).',
      },
      {
        name: 'big',
        type: 'boolean',
        defaultValue: 'false',
        description: 'Uses fluid clamp(36px, 6cqi, 56px) display scale for establishing C-01 panels.',
      },
      {
        name: 'variant',
        type: "'expressive' | 'quiet'",
        defaultValue: "'expressive'",
        description:
          'Selects display headline scale on twos (expressive) or 22px tabular monospace exposure-sheet scale with instant cut default (quiet).',
      },
      {
        name: 'spark',
        type: 'React.ReactNode',
        defaultValue: 'undefined',
        description: 'Optional bottom slot for a ToneSpark daily bar strip.',
      },
    ],
    a11yNotes: [
      'Exposes the final formatted value inside .f12-sr-only while hiding intermediate count-up frames with aria-hidden="true" so screen readers announce the change once.',
      'Includes "Up" or "Down" screen-reader text alongside the ▲ / ▼ delta symbol.',
    ],
    grammarNotes: [
      'Uses tabular-nums so numerals never jitter horizontally while counting on twos.',
    ],
    usageTemplate: `import { Metric, fmtCurrency } from '@/components/frame12';

export function HeroKpi() {
  return (
    <Metric
      label="Recovered revenue"
      value={120054}
      format={fmtCurrency}
      delta={0.114}
      deltaKind="pct"
      range={30}
      big
    />
  );
}`,
  },
  {
    slug: 'tone-area-chart',
    title: 'ToneAreaChart',
    category: 'Data & Charts',
    summary:
      'Screentone halftone area chart with 4-band dot-density fade, speech-balloon peak callout, keyboard/pointer crosshair, and collapsible data table.',
    registryUrl: 'https://frame12.dev/r/tone-area-chart.json',
    sourceFile: 'registry/ui/tone-area-chart.tsx',
    props: [
      {
        name: 'data',
        type: 'ToneAreaDatum[]',
        defaultValue: 'required',
        description: 'Array of { label, longLabel?, value, compareValue? } points.',
      },
      {
        name: 'seriesLabel',
        type: 'string',
        defaultValue: "'Value'",
        description: 'Primary series label shown in the crosshair readout and table header.',
      },
      {
        name: 'compareLabel',
        type: 'string',
        defaultValue: 'undefined',
        description: 'Optional dashed comparison series label.',
      },
      {
        name: 'height',
        type: 'number',
        defaultValue: '260',
        description: 'SVG chart height in pixels.',
      },
      {
        name: 'showTable',
        type: 'boolean',
        defaultValue: 'true',
        description: 'Renders the accessible <details className="tbl"> semantic data table.',
      },
    ],
    a11yNotes: [
      'Focusable SVG (tabIndex={0}) supports ArrowLeft, ArrowRight, and Escape for full keyboard inspection.',
      'Always includes a collapsible <details className="f12-tbl"> table with <th scope="col"> headers.',
    ],
    grammarNotes: [
      'Replaces CSS/SVG color gradients with four vertical 45° rotated screentone dot-radius bands (1.25px to 0.62px).',
      'Peak annotation is a speech balloon with a mitered tail pointing to the marker-yellow peak dot.',
    ],
    usageTemplate: `import { ToneAreaChart, fmtCurrency } from '@/components/frame12';

export function RecoveryTrend({ data }: { data: Array<{ label: string; value: number }> }) {
  return (
    <ToneAreaChart
      data={data}
      seriesLabel="Recovered revenue"
      formatValue={fmtCurrency}
      height={240}
    />
  );
}`,
  },
  {
    slug: 'tone-bar-list',
    title: 'ToneBarList',
    category: 'Data & Charts',
    summary:
      'Interactive ranked comparison list with screentone fill bars, share percentages, and impact-burst leader badge.',
    registryUrl: 'https://frame12.dev/r/tone-bar-list.json',
    sourceFile: 'registry/ui/tone-bar-list.tsx',
    props: [
      {
        name: 'items',
        type: 'ToneBarItem[]',
        defaultValue: 'required',
        description: 'Ranked items with id, name, value, formattedValue, share (0..1), and optional badge.',
      },
      {
        name: 'selectedId',
        type: 'string | null',
        defaultValue: 'null',
        description: 'Currently selected row ID for chart comparison filtering.',
      },
      {
        name: 'onSelect',
        type: '(id: string | null) => void',
        defaultValue: 'undefined',
        description: 'Callback fired when a row is toggled.',
      },
      {
        name: 'changed',
        type: 'boolean',
        defaultValue: 'false',
        description: 'Triggers the 3-pose .f12-enter list cascade and leader badge pop.',
      },
      {
        name: 'density',
        type: "'comfortable' | 'compact'",
        defaultValue: "'comfortable'",
        description: 'Reduces row padding and bar height for high-density operational lists.',
      },
    ],
    a11yNotes: [
      'Each row is a native <button type="button" aria-pressed={selected}> inside a semantic list.',
      'Selected rows invert to --f-ink with a --f-marker bar fill for unmistakable visual and ARIA state.',
    ],
    grammarNotes: [
      'Unselected bars use a 5px × 5px halftone dot pattern (--f-tone) framed by a 2px ink rule.',
    ],
    usageTemplate: `import { ToneBarList } from '@/components/frame12';

export function ChannelBreakdown({ items }: { items: Array<{ id: string; name: string; value: number; share: number }> }) {
  return (
    <ToneBarList
      title="Revenue by intervention"
      subtitle="Last 30 days"
      items={items}
    />
  );
}`,
  },
  {
    slug: 'tone-spark',
    title: 'ToneSpark',
    category: 'Data & Charts',
    summary:
      'Compact daily bar sparkline filled with 45° rotated SVG screentone dots that wipe on twos.',
    registryUrl: 'https://frame12.dev/r/tone-spark.json',
    sourceFile: 'registry/ui/tone-spark.tsx',
    props: [
      {
        name: 'values',
        type: 'number[]',
        defaultValue: 'required',
        description: 'Daily numeric values rendered as one screentone bar per day.',
      },
      {
        name: 'label',
        type: 'string',
        defaultValue: 'required',
        description: 'Uppercase monospace caption rendered above the sparkline.',
      },
      {
        name: 'rangeKey',
        type: 'string | number',
        defaultValue: 'undefined',
        description: 'Key that replays the stepped bar reveal when changed.',
      },
    ],
    a11yNotes: [
      'Renders role="img" with a descriptive aria-label summarizing the series and bar count.',
    ],
    grammarNotes: [
      'Uses a 4px × 4px rotated SVG pattern (#uid-st) with a 2px solid --f-rule baseline.',
    ],
    usageTemplate: `import { ToneSpark } from '@/components/frame12';

export function DailyProfitSpark() {
  return <ToneSpark label="Daily profit" values={[420, 510, 490, 610, 580, 640, 710]} rangeKey={7} />;
}`,
  },
  {
    slug: 'balloon',
    title: 'Balloon',
    category: 'Data & Charts',
    summary:
      'Standalone speech-balloon callout with mitered SVG tail and inked marker-yellow target dot.',
    registryUrl: 'https://frame12.dev/r/balloon.json',
    sourceFile: 'registry/ui/balloon.tsx',
    props: [
      {
        name: 'tailOffset',
        type: 'number',
        defaultValue: '0',
        description: 'Horizontal tail tip offset in pixels (-36 to +36).',
      },
      {
        name: 'showDot',
        type: 'boolean',
        defaultValue: 'true',
        description: 'Renders the 4px marker-yellow target dot with 2px ink stroke below the tail.',
      },
    ],
    a11yNotes: [
      'Keeps annotation text in the DOM while marking the decorative SVG tail aria-hidden="true".',
    ],
    grammarNotes: [
      'Replaces floating shadow popovers with an inked speech balloon and seamless .f12-balloon-gap bridge.',
    ],
    usageTemplate: `import { Balloon } from '@/components/frame12';

export function PeakCallout() {
  return <Balloon tailOffset={-8} showDot>Peak Oct 26 · $6,120</Balloon>;
}`,
  },
  {
    slug: 'use-on-twos',
    title: 'useOnTwos',
    category: 'Motion Hooks',
    summary:
      'Core motion hooks (useOnTwos, useCountUp, useChanged, useSize, useReducedMotion) that sample transitions at 12 poses per second (83.33ms per pose).',
    registryUrl: 'https://frame12.dev/r/use-on-twos.json',
    sourceFile: 'registry/hooks/use-on-twos.ts',
    props: [
      {
        name: 'key',
        type: 'unknown',
        defaultValue: 'required',
        description: 'Dependency value; changing key replays the 0..1 progress transition.',
      },
      {
        name: 'duration',
        type: 'number',
        defaultValue: '600',
        description: 'Total transition duration in milliseconds.',
      },
      {
        name: 'motion',
        type: "'stepped' | 'smooth' | 'cut'",
        defaultValue: "'stepped'",
        description: 'Sampling mode: 12fps stepped poses, 60fps continuous, or instant hard cut.',
      },
    ],
    a11yNotes: [
      'useReducedMotion() listens to (prefers-reduced-motion: reduce) and forces instant hard cuts.',
      'Returns 1 on initial mount so pages render complete at rest with zero layout shift.',
    ],
    grammarNotes: [
      'Quantizes elapsed time into FRAME_MS = 1000 / 12 (83.33ms) steps and applies cubic easeOut.',
    ],
    usageTemplate: `import { useOnTwos, useCountUp, useChanged } from '@/hooks/use-on-twos';

export function AnimatedStat({ value }: { value: number }) {
  const shown = useCountUp(value, 'stepped', 600);
  const changed = useChanged(value);
  const progress = useOnTwos(value, 600, 'stepped');
  return <output data-changed={changed} data-p={progress.toFixed(2)}>{Math.round(shown)}</output>;
}`,
  },
  {
    slug: 'dialog',
    title: 'Dialog',
    category: 'Primitive Adapters',
    summary:
      'Native modal <dialog> adapter with .showModal(), screentone backdrop, light-dismiss fallback, and sequential cut label.',
    registryUrl: 'https://frame12.dev/r/dialog.json',
    sourceFile: 'registry/ui/dialog.tsx',
    props: [
      {
        name: 'open / onOpenChange',
        type: 'boolean / (open: boolean) => void',
        defaultValue: 'uncontrolled',
        description: 'Controlled or uncontrolled modal state synchronized with native dialog.showModal().',
      },
      {
        name: 'cut',
        type: 'string',
        defaultValue: 'undefined',
        description: 'Optional sequential cut badge rendered on the top edge of DialogContent.',
      },
    ],
    a11yNotes: [
      'Uses native HTML <dialog> with .showModal() so the browser marks background content inert automatically.',
      'Links DialogTitle via aria-labelledby and supports Escape key + backdrop click dismissal.',
    ],
    grammarNotes: [
      'Installs into components/frame12/dialog.tsx with 2.5px ink borders and a 6px × 6px screentone backdrop without overwriting existing components/ui/ files.',
    ],
    usageTemplate: `import {
  Dialog, DialogTrigger, DialogContent, DialogHeader,
  DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from '@/components/frame12';

export function ConfirmModal() {
  return (
    <Dialog>
      <DialogTrigger variant="marker">Open Modal</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rotate webhook secret?</DialogTitle>
          <DialogDescription>Active endpoints will verify both keys for 24 hours.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose variant="secondary">Cancel</DialogClose>
          <DialogClose variant="primary">Confirm</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}`,
  },
  {
    slug: 'select',
    title: 'Select',
    category: 'Primitive Adapters',
    summary:
      'Accessible listbox selector adapter with linked label, marker-yellow ▼ caret, and ink-inverted active item.',
    registryUrl: 'https://frame12.dev/r/select.json',
    sourceFile: 'registry/ui/select.tsx',
    props: [
      {
        name: 'value / defaultValue',
        type: 'string',
        defaultValue: "''",
        description: 'Controlled or uncontrolled selected item value.',
      },
      {
        name: 'onValueChange',
        type: '(value: string) => void',
        defaultValue: 'undefined',
        description: 'Callback fired when an option is selected.',
      },
      {
        name: 'label',
        type: 'string',
        defaultValue: 'undefined',
        description: 'Optional visible <label> automatically linked to the trigger button.',
      },
      {
        name: 'density',
        type: "'comfortable' | 'compact'",
        defaultValue: "'comfortable'",
        description: 'Reduces trigger padding and border width for dense operational forms.',
      },
    ],
    a11yNotes: [
      'Exposes aria-haspopup="listbox", aria-expanded, and role="listbox" with aria-selected on options.',
      'Dismisses on Escape or outside pointer down.',
    ],
    grammarNotes: [
      'Uses a marker-yellow ▼ caret badge and a ✓ marker check on the selected option.',
    ],
    usageTemplate: `import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/frame12';

export function ChannelSelect() {
  return (
    <Select defaultValue="cart" label="Intervention channel">
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="cart">Abandoned-cart email</SelectItem>
        <SelectItem value="exit">Exit-intent offer</SelectItem>
        <SelectItem value="stock">Back-in-stock alert</SelectItem>
      </SelectContent>
    </Select>
  );
}`,
  },
  {
    slug: 'tooltip',
    title: 'Tooltip',
    category: 'Primitive Adapters',
    summary:
      'Keyboard- and hover-accessible ink-framed tooltip adapter with hard offset shadow.',
    registryUrl: 'https://frame12.dev/r/tooltip.json',
    sourceFile: 'registry/ui/tooltip.tsx',
    props: [
      {
        name: 'TooltipTrigger',
        type: '{ asChild?: boolean; children: React.ReactElement }',
        defaultValue: 'required',
        description: 'Trigger element that opens the tooltip on hover or keyboard focus.',
      },
      {
        name: 'TooltipContent',
        type: 'React.HTMLAttributes<HTMLDivElement>',
        defaultValue: 'required',
        description: 'Tooltip surface linked to the trigger via aria-describedby.',
      },
    ],
    a11yNotes: [
      'Opens on both pointer enter and keyboard focus, and dismisses immediately on Escape.',
      'Links trigger to role="tooltip" content via aria-describedby when open.',
    ],
    grammarNotes: [
      'Framed with a 2px solid --f-rule border and 3px 3px 0 var(--f-rule) offset shadow.',
    ],
    usageTemplate: `import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent, Button } from '@/components/frame12';

export function HoldoutHint() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild><Button variant="secondary" size="sm">Holdout spec</Button></TooltipTrigger>
        <TooltipContent>10% randomized checkout holdout cohort</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}`,
  },
  {
    slug: 'dropdown-menu',
    title: 'DropdownMenu',
    category: 'Primitive Adapters',
    summary:
      'Ink-framed action menu adapter with keyboard Escape/outside-click dismissal and ink-inverted item focus.',
    registryUrl: 'https://frame12.dev/r/dropdown-menu.json',
    sourceFile: 'registry/ui/dropdown-menu.tsx',
    props: [
      {
        name: 'DropdownMenuTrigger',
        type: '{ asChild?: boolean; children: React.ReactElement }',
        defaultValue: 'required',
        description: 'Button that toggles the role="menu" popup.',
      },
      {
        name: 'DropdownMenuItem',
        type: '{ onSelect?: () => void }',
        defaultValue: 'optional',
        description: 'Focusable role="menuitem" button that closes the menu on activation.',
      },
    ],
    a11yNotes: [
      'Sets aria-haspopup="menu" and aria-expanded on the trigger and role="menuitem" on each action.',
    ],
    grammarNotes: [
      'Uses 2.5px ink rules, uppercase monospace DropdownMenuLabel, and 1px --f-grid separators.',
    ],
    usageTemplate: `import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem,
} from '@/components/frame12';

export function RowActions() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger variant="secondary" size="sm">Actions ▼</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Webhook</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Replay payload</DropdownMenuItem>
        <DropdownMenuItem>Inspect headers</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}`,
  },
  {
    slug: 'table',
    title: 'Table',
    category: 'Primitive Adapters',
    summary:
      'Semantic data table adapter with uppercase monospace column headers, 2.5px ink header rule, and tabular-nums alignment.',
    registryUrl: 'https://frame12.dev/r/table.json',
    sourceFile: 'registry/ui/table.tsx',
    props: [
      {
        name: 'density',
        type: "'comfortable' | 'compact'",
        defaultValue: "'comfortable'",
        description: 'Reduces cell padding and header rule weight for high-row-count operational ledgers.',
      },
      {
        name: 'TableHead',
        type: 'React.ThHTMLAttributes<HTMLTableCellElement>',
        defaultValue: 'scope="col"',
        description: 'Header cell defaulting to scope="col" with 2.5px bottom ink border.',
      },
      {
        name: 'TableCaption',
        type: 'React.HTMLAttributes<HTMLTableCaptionElement>',
        defaultValue: 'optional',
        description: 'Accessible table caption placed at the bottom edge in monospace type.',
      },
    ],
    a11yNotes: [
      'Wraps <table> in an overflow-x: auto container (.f12-table-wrap) so narrow mobile viewports scroll the table without page overflow.',
      'Defaults TableHead to scope="col" for screen-reader cell header association.',
    ],
    grammarNotes: [
      'Uses 2.5px solid --f-rule under thead, 1px solid --f-grid between rows, and 2px solid --f-rule above tfoot.',
    ],
    usageTemplate: `import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableCaption, Tag,
} from '@/components/frame12';

export function RecoveryTable() {
  return (
    <Table>
      <TableCaption>Recent recovered checkouts</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Order</TableHead>
          <TableHead>Intervention</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>ORD-9041</TableCell>
          <TableCell>Abandoned-cart email</TableCell>
          <TableCell><Tag>Recovered</Tag></TableCell>
          <TableCell>$184</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}`,
  },
];

export const CATALOG: CatalogEntry[] = RAW_CATALOG.map((entry) => ({
  ...entry,
  registryUrl: `${REGISTRY_BASE_URL}/${entry.slug}.json`,
}));

export function getCatalogEntry(slug: string): CatalogEntry | undefined {
  return CATALOG.find((c) => c.slug === slug);
}
