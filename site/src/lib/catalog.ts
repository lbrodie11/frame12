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
        type: 'React.ReactNode',
        defaultValue: 'undefined',
        description: 'Visible label text programmatically linked to the <input> via htmlFor/id (optional when wrapped in <Field>).',
      },
      {
        name: 'hint',
        type: 'React.ReactNode',
        defaultValue: 'undefined',
        description: 'Optional helper text linked via aria-describedby.',
      },
      {
        name: 'error',
        type: 'React.ReactNode',
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
      'Automatically generates a stable ID via React.useId() when id is omitted, or inherits FieldContext when placed inside <Field>.',
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
    slug: 'field',
    title: 'Field',
    category: 'Controls',
    summary:
      'Shared form field coordinator that links label, hint, marker-flagged error alert, required indicator, and density across form controls via FieldContext.',
    registryUrl: 'https://frame12.dev/r/field.json',
    sourceFile: 'registry/ui/field.tsx',
    props: [
      {
        name: 'label',
        type: 'React.ReactNode',
        defaultValue: 'undefined',
        description: 'Uppercase monospace field label linked to the child control via htmlFor/id (or <legend> when wrapping <RadioGroup>).',
      },
      {
        name: 'hint',
        type: 'React.ReactNode',
        defaultValue: 'undefined',
        description: 'Helper text rendered below the control and chained into aria-describedby.',
      },
      {
        name: 'error',
        type: 'React.ReactNode',
        defaultValue: 'undefined',
        description: 'Marker-flagged error message rendered in a role="alert" live region and setting aria-invalid="true".',
      },
      {
        name: 'density',
        type: "'comfortable' | 'compact'",
        defaultValue: "'comfortable'",
        description: 'Propagates comfortable or compact density to child Input, Textarea, Checkbox, RadioGroup, Switch, or Select controls.',
      },
      {
        name: 'required / disabled',
        type: 'boolean',
        defaultValue: 'false',
        description: 'Propagates required and disabled states to child controls via FieldContext.',
      },
    ],
    a11yNotes: [
      'Prevents duplicate labels, hints, and error alerts when wrapping Input, Textarea, Checkbox, Switch, RadioGroup, or Select. For single Input/Textarea/Select controls, <Field label="..."> takes precedence over a child label; for Checkbox/Switch children with their own label (or multiple controls), <Field> becomes role="group" with aria-labelledby while each option keeps its own <label htmlFor>.',
      'Supports both FieldContext-aware components and render-prop children ((field) => ...) or native <input>/<textarea>/<select> elements. Do not nest <Field> inside another <Field>.',
    ],
    grammarNotes: [
      'Uses .f12-label uppercase monospace headers and .f12-error-flag marker badges for validation alerts.',
    ],
    usageTemplate: `import { Field, Input } from '@/components/frame12';

export function EndpointField() {
  return (
    <Field
      label="Webhook endpoint URL"
      hint="Must accept TLS 1.3 POST requests"
      required
    >
      <Input defaultValue="https://api.acme.dev/webhooks/f12" />
    </Field>
  );
}`,
  },
  {
    slug: 'textarea',
    title: 'Textarea',
    category: 'Controls',
    summary:
      'Ink-framed multi-line text input with linked monospace label, hint, marker-flagged error alert, and FieldContext integration.',
    registryUrl: 'https://frame12.dev/r/textarea.json',
    sourceFile: 'registry/ui/textarea.tsx',
    props: [
      {
        name: 'label',
        type: 'React.ReactNode',
        defaultValue: 'undefined',
        description: 'Visible label text programmatically linked to the <textarea> via htmlFor/id (optional inside <Field>).',
      },
      {
        name: 'hint',
        type: 'React.ReactNode',
        defaultValue: 'undefined',
        description: 'Optional helper text linked via aria-describedby.',
      },
      {
        name: 'error',
        type: 'React.ReactNode',
        defaultValue: 'undefined',
        description: 'Validation error message rendered in a role="alert" live region.',
      },
      {
        name: 'density',
        type: "'comfortable' | 'compact'",
        defaultValue: "'comfortable'",
        description: 'Switches to a 1.5px rule and tighter padding for dense operational forms.',
      },
    ],
    a11yNotes: [
      'Forwards ref to a native <textarea> element for direct compatibility with FormData and react-hook-form register().',
      'Chains hintId, errorId, and FieldContext describedBy IDs into aria-describedby.',
    ],
    grammarNotes: [
      'Square 2.5px ink rule (1.5px in compact density) with vertical resize and dashed border when disabled.',
    ],
    usageTemplate: `import { Textarea } from '@/components/frame12';

export function RunbookNotes() {
  return (
    <Textarea
      label="Incident runbook notes"
      hint="Included in webhook alert payloads"
      defaultValue="Escalate to on-call if 5xx exceeds 1.5% over 3 consecutive cuts."
    />
  );
}`,
  },
  {
    slug: 'checkbox',
    title: 'Checkbox',
    category: 'Controls',
    summary:
      'Native ink-framed checkbox with crisp SVG checkmark, SSR-safe indeterminate mixed mark, and 24×24px minimum target size.',
    registryUrl: 'https://frame12.dev/r/checkbox.json',
    sourceFile: 'registry/ui/checkbox.tsx',
    props: [
      {
        name: 'label',
        type: 'React.ReactNode',
        defaultValue: 'undefined',
        description: 'Inline label linked to the native <input type="checkbox"> via htmlFor/id.',
      },
      {
        name: 'indeterminate',
        type: 'boolean',
        defaultValue: 'false',
        description: 'Renders the horizontal mixed-state mark in SSR HTML/CSS and syncs DOM input.indeterminate across user activation and form.reset().',
      },
      {
        name: 'onCheckedChange',
        type: '(checked: boolean) => void',
        defaultValue: 'undefined',
        description: 'Convenience callback invoked with the boolean checked state on change.',
      },
      {
        name: 'density',
        type: "'comfortable' | 'compact'",
        defaultValue: "'comfortable'",
        description: 'Reduces border weight to 1.5px while preserving a 24×24px WCAG 2.5.8 click target.',
      },
    ],
    a11yNotes: [
      'Built on a native <input type="checkbox"> with appearance: none so FormData, form.reset(), required, form=, label clicks, and react-hook-form register() work natively.',
      'Provides explicit system-color rules under @media (forced-colors: active).',
    ],
    grammarNotes: [
      'Uses a square 24×24px ink frame that fills with --f-ink when checked or indeterminate.',
    ],
    usageTemplate: `import { Checkbox } from '@/components/frame12';

export function AuditToggle() {
  return (
    <Checkbox
      label="Require dual-key signoff on production cuts"
      hint="Enforced for all expressive storyboard sheets"
      defaultChecked
    />
  );
}`,
  },
  {
    slug: 'radio-group',
    title: 'RadioGroup',
    category: 'Controls',
    summary:
      'Accessible radio group built on native <fieldset>, <legend>, and <input type="radio"> elements with vertical or horizontal layout.',
    registryUrl: 'https://frame12.dev/r/radio-group.json',
    sourceFile: 'registry/ui/radio-group.tsx',
    props: [
      {
        name: 'label',
        type: 'React.ReactNode',
        defaultValue: 'undefined',
        description: 'Group caption rendered inside <legend className="f12-label">.',
      },
      {
        name: 'options',
        type: 'RadioOption[]',
        defaultValue: 'undefined',
        description: 'Shorthand array of { value, label, hint?, disabled? } items; or pass <RadioGroupItem> children.',
      },
      {
        name: 'orientation',
        type: "'vertical' | 'horizontal'",
        defaultValue: "'vertical'",
        description: 'Stacks radio items vertically or wraps them horizontally.',
      },
      {
        name: 'density',
        type: "'comfortable' | 'compact'",
        defaultValue: "'comfortable'",
        description: 'Switches to 1.5px radio borders and tighter spacing while keeping 24×24px targets.',
      },
    ],
    a11yNotes: [
      'Relies on native <input type="radio"> inside <fieldset> + <legend> for browser-native arrow-key navigation, single tab stop, FormData, and form.reset().',
      'When wrapped in <Field label="..."> (including via render-prop or wrapper), renders the Field label as the <fieldset> <legend> so no invalid <label htmlFor="fieldset"> or duplicate label is produced.',
      'For react-hook-form, spread {...register("field")} onto each <RadioGroupItem>, or wrap <RadioGroup> in <Controller> when using the options prop.',
    ],
    grammarNotes: [
      'Uses circular 24×24px ink frames to distinguish single-choice radio buttons from square multi-choice checkboxes.',
    ],
    usageTemplate: `import { RadioGroup } from '@/components/frame12';

export function CadenceRadio() {
  return (
    <RadioGroup
      label="Digest cadence"
      name="cadence"
      defaultValue="daily"
      options={[
        { value: 'realtime', label: 'Real-time', hint: 'Immediate webhook dispatch' },
        { value: 'daily', label: 'Daily cut', hint: '09:00 UTC exposure sheet summary' },
        { value: 'weekly', label: 'Weekly rollup', hint: 'Monday 09:00 UTC digest' },
      ]}
    />
  );
}`,
  },
  {
    slug: 'switch',
    title: 'Switch',
    category: 'Controls',
    summary:
      'Exposure-sheet toggle switch built on native <input type="checkbox" role="switch"> with configurable ON/OFF glyph, RTL-ready logical thumb, and stepped 12fps motion.',
    registryUrl: 'https://frame12.dev/r/switch.json',
    sourceFile: 'registry/ui/switch.tsx',
    props: [
      {
        name: 'label',
        type: 'React.ReactNode',
        defaultValue: 'undefined',
        description: 'Inline label linked to the native <input type="checkbox" role="switch">.',
      },
      {
        name: 'onLabel / offLabel',
        type: 'React.ReactNode',
        defaultValue: "'ON' / 'OFF'",
        description: 'Configurable visual track glyphs (marked aria-hidden="true" so role="switch" never double-announces English text).',
      },
      {
        name: 'onCheckedChange',
        type: '(checked: boolean) => void',
        defaultValue: 'undefined',
        description: 'Callback fired with the boolean checked state on toggle.',
      },
      {
        name: 'density',
        type: "'comfortable' | 'compact'",
        defaultValue: "'comfortable'",
        description: 'Selects 54×28px (2.5px border) or 48×24px (1.5px border) exposure-sheet cell dimensions.',
      },
    ],
    a11yNotes: [
      'Built on a native <input type="checkbox" role="switch"> so FormData, form.reset(), required, form=, label clicks, and react-hook-form register() work out of the box.',
      'Uses logical inset-inline-start positioning so the thumb moves in the reverse direction under dir="rtl".',
    ],
    grammarNotes: [
      'When checked, the track inverts to --f-ink with a --f-panel thumb that steps across the track in 3 held poses (steps(3, end)) in stepped motion mode.',
    ],
    usageTemplate: `import { Switch } from '@/components/frame12';

export function ReplaySwitch() {
  return (
    <Switch
      label="Auto-replay failed webhook deliveries"
      hint="Retries up to 3 times with exponential backoff"
      defaultChecked
    />
  );
}`,
  },
  {
    slug: 'tabs',
    title: 'Tabs',
    category: 'Controls',
    summary:
      'WAI-ARIA tablist, tab, and tabpanel primitives with roving focus, automatic or manual keyboard activation, and default quiet panel context.',
    registryUrl: 'https://frame12.dev/r/tabs.json',
    sourceFile: 'registry/ui/tabs.tsx',
    props: [
      {
        name: 'value / defaultValue',
        type: 'string',
        defaultValue: "''",
        description: 'Controlled or uncontrolled active tab value.',
      },
      {
        name: 'onValueChange',
        type: '(value: string) => void',
        defaultValue: 'undefined',
        description: 'Callback invoked when the active tab changes.',
      },
      {
        name: 'orientation',
        type: "'horizontal' | 'vertical'",
        defaultValue: "'horizontal'",
        description: 'Tab list orientation (vertical stacks automatically below 760px container width).',
      },
      {
        name: 'density',
        type: "'comfortable' | 'compact'",
        defaultValue: "'comfortable'",
        description: 'Adjusts tab trigger padding and rule weight (2.5px vs 1.5px).',
      },
      {
        name: 'activationMode',
        type: "'automatic' | 'manual'",
        defaultValue: "'automatic'",
        description: 'Whether arrow keys activate the focused tab immediately (automatic) or only move focus until Enter/Space (manual).',
      },
    ],
    a11yNotes: [
      'Implements WAI-ARIA role="tablist", role="tab" (aria-selected, aria-controls), and role="tabpanel" (aria-labelledby) with roving tabIndex and Home/End/Arrow key support.',
      'Inactive TabsContent elements remain mounted with hidden so aria-controls always references a valid DOM ID. Always pass defaultValue (or value) when wrapping TabsTrigger in custom components so the initial panel renders visibly in SSR HTML before hydration.',
    ],
    grammarNotes: [
      'Use <Tabs> when switching between distinct content panels (e.g., Routing vs. Retries vs. Signing Keys); use <SegmentedControl> when changing the view or time range of the same content.',
      'Panels inside <TabsContent> default to variant="quiet" and suppress CSS autoCut counters so switching tabs never shifts C-01/C-02 cut numbers on the sheet.',
    ],
    usageTemplate: `import { Tabs, TabsList, TabsTrigger, TabsContent, Panel, Input } from '@/components/frame12';

export function SettingsTabs() {
  return (
    <Tabs defaultValue="routing">
      <TabsList ariaLabel="Pipeline configuration">
        <TabsTrigger value="routing">Routing</TabsTrigger>
        <TabsTrigger value="retries">Retries</TabsTrigger>
      </TabsList>
      <TabsContent value="routing">
        <Panel label="Routing configuration">
          <Input label="Primary endpoint" defaultValue="https://api.acme.dev/hooks" />
        </Panel>
      </TabsContent>
      <TabsContent value="retries">
        <Panel label="Retry configuration">
          <Input label="Max retry attempts" defaultValue="5" />
        </Panel>
      </TabsContent>
    </Tabs>
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
        name: 'srLabel',
        type: 'string | false',
        defaultValue: 'undefined',
        description:
          'Overrides or suppresses (false) the screen-reader status announcement prefix (e.g., for localized labels).',
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
        name: 'srLabel',
        type: 'string | false',
        defaultValue: 'undefined',
        description:
          'Overrides or suppresses (false) the screen-reader status announcement prefix (e.g., for localized labels).',
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
    slug: 'alert',
    title: 'Alert & Notice',
    category: 'Controls',
    summary:
      'Inline non-color semantic status notices and alerts with restrained ARIA live regions, orthographic status glyphs, and optional dismiss control.',
    registryUrl: 'https://frame12.dev/r/alert.json',
    sourceFile: 'registry/ui/alert.tsx',
    props: [
      {
        name: 'status',
        type: "'neutral' | 'info' | 'success' | 'warning' | 'danger'",
        defaultValue: "'info'",
        description:
          'Non-color semantic status combining [i]/[+]/[!]/[×] glyph prefix, screen-reader prefix, and border/rail treatment.',
      },
      {
        name: 'title',
        type: 'React.ReactNode',
        defaultValue: 'undefined',
        description: 'Optional inline title or use <AlertTitle> compound subcomponent.',
      },
      {
        name: 'live',
        type: "'off' | 'polite' | 'assertive'",
        defaultValue: "Notice: 'off' | Alert: 'assertive' on danger, 'off' otherwise",
        description:
          'Controls ARIA live-region behavior: off -> role="note", polite -> role="status", assertive -> role="alert".',
      },
      {
        name: 'onDismiss',
        type: '() => void',
        defaultValue: 'undefined',
        description: 'Renders a 24×24px minimum dismiss button when provided.',
      },
    ],
    a11yNotes: [
      'Notice defaults to role="note" so static page load notices never spam screen-reader live regions.',
      'Alert defaults to role="alert" only when status="danger" (or live="assertive"), and role="status" when live="polite".',
    ],
    grammarNotes: [
      'Preserves --f-panel card contrast for inner text and action buttons while encoding status via border style, inline-start rail, and glyph stamp.',
    ],
    usageTemplate: `import { Alert, Notice } from '@/components/frame12';

export function WebhookNotices() {
  return (
    <div className="f12-stack-pair">
      <Notice status="info" title="Dual-key rotation window">
        Both webhook signing keys remain valid for 24 hours.
      </Notice>
      <Alert status="danger" title="Dead-letter queue threshold exceeded">
        14 checkout events require manual replay.
      </Alert>
    </div>
  );
}`,
  },
  {
    slug: 'toast',
    title: 'Toast',
    category: 'Controls',
    summary:
      'Bounded exposure-sheet notification stack with hover/focus timer pause, Escape dismissal, +N QUEUED indicator, and stepped 12fps entrance.',
    registryUrl: 'https://frame12.dev/r/toast.json',
    sourceFile: 'registry/ui/toast.tsx',
    props: [
      {
        name: 'maxVisible',
        type: 'number',
        defaultValue: '3',
        description: 'Maximum simultaneously visible toasts before showing the +N QUEUED indicator.',
      },
      {
        name: 'duration',
        type: 'number',
        defaultValue: '5000',
        description: 'Auto-dismiss timeout in milliseconds (0 disables auto-dismiss; pauses on hover or focus-within).',
      },
      {
        name: 'status',
        type: "'neutral' | 'info' | 'success' | 'warning' | 'danger'",
        defaultValue: "'neutral'",
        description: 'Non-color semantic status with [i]/[+]/[!]/[×] glyph and deduplicated screen-reader prefix.',
      },
    ],
    a11yNotes: [
      'Announces notifications through shared .f12-sr-only live regions (aria-live="assertive" for status="danger" and aria-live="polite" for all other statuses, portaled alongside ToastViewport into any open modal <dialog>); individual <Toast> cards are non-live by default unless an explicit role or aria-live prop is passed.',
      'Pauses auto-dismiss timers while hovered or focused, and dismisses the newest visible toast on Escape.',
    ],
    grammarNotes: [
      'Enters on twos (steps(3, end)) with a hard ink offset shadow and zero opacity blur.',
    ],
    usageTemplate: `import { ToastProvider, useToast, Button } from '@/components/frame12';

function ReplayTrigger() {
  const { toast } = useToast();
  return (
    <Button
      variant="secondary"
      onClick={() =>
        toast({
          status: 'success',
          title: 'Webhook replayed',
          description: 'Dispatched cut C-04 to primary endpoint.',
        })
      }
    >
      Trigger Toast
    </Button>
  );
}

export function ToastDemo() {
  return (
    <ToastProvider>
      <ReplayTrigger />
    </ToastProvider>
  );
}`,
  },
  {
    slug: 'skeleton',
    title: 'Skeleton',
    category: 'Controls',
    summary:
      'Zero-CLS loading placeholder using rotated screentone dot fills (var(--f-tone)) and stepped 12fps opacity cadence.',
    registryUrl: 'https://frame12.dev/r/skeleton.json',
    sourceFile: 'registry/ui/skeleton.tsx',
    props: [
      {
        name: 'variant',
        type: "'block' | 'line' | 'circle' | 'metric' | 'panel'",
        defaultValue: "'block'",
        description: 'Selects pre-sized geometry matching text lines, avatars, KPI metrics, or full panels.',
      },
      {
        name: 'label',
        type: 'string',
        defaultValue: 'undefined',
        description:
          'When omitted, renders aria-hidden="true"; when provided, renders role="status" aria-busy="true" with a .f12-sr-only label.',
      },
      {
        name: 'animated',
        type: 'boolean',
        defaultValue: 'true',
        description: 'Enables the 4-step 12fps opacity pulse (automatically disabled under prefers-reduced-motion: reduce).',
      },
    ],
    a11yNotes: [
      'Decorative skeletons default to aria-hidden="true" so screen readers are not flooded; pass label="Loading metrics" on the container skeleton for a single polite status announcement.',
    ],
    grammarNotes: [
      'Uses --f-tone halftone dots framed by a dashed --f-rule border instead of blurred shimmer gradients.',
    ],
    usageTemplate: `import { Skeleton, SkeletonText } from '@/components/frame12';

export function LoadingPanel() {
  return (
    <div className="f12-stack-pair">
      <Skeleton variant="metric" label="Loading revenue metric" />
      <SkeletonText lines={3} />
    </div>
  );
}`,
  },
  {
    slug: 'empty-state',
    title: 'EmptyState',
    category: 'Controls',
    summary:
      'Structured zero-data and filtered-empty state with registration-mark glyph ([ ∅ ]), monospace code badge, and primary/secondary action slots.',
    registryUrl: 'https://frame12.dev/r/empty-state.json',
    sourceFile: 'registry/ui/empty-state.tsx',
    props: [
      {
        name: 'title',
        type: 'React.ReactNode',
        defaultValue: 'undefined',
        description: 'Headline title for the empty state (or use <EmptyStateTitle>).',
      },
      {
        name: 'description',
        type: 'React.ReactNode',
        defaultValue: 'undefined',
        description: 'Supporting explanation or recovery guidance (or use <EmptyStateDescription>).',
      },
      {
        name: 'code',
        type: 'string',
        defaultValue: 'undefined',
        description: 'Optional uppercase monospace status code stamp (e.g., "0 MATCHING ROWS").',
      },
      {
        name: 'variant',
        type: "'dashed' | 'quiet'",
        defaultValue: "'dashed'",
        description: 'Selects a 2px dashed ink frame or a quiet 1px exposure-sheet frame.',
      },
    ],
    a11yNotes: [
      'Default [ ∅ ] registration glyph is marked aria-hidden="true" while title, description, and action buttons remain in natural reading order.',
    ],
    grammarNotes: [
      'Centers an inked registration stamp and clear recovery actions inside a dashed storyboard frame.',
    ],
    usageTemplate: `import { EmptyState, Button } from '@/components/frame12';

export function ZeroLedger({ onReset }: { onReset: () => void }) {
  return (
    <EmptyState
      code="0 MATCHING ROWS"
      title="No matching interventions"
      description="Clear the search filter or broaden the exposure window."
      action={<Button variant="secondary" size="sm" onClick={onReset}>Reset filters</Button>}
    />
  );
}`,
  },
  {
    slug: 'breadcrumb',
    title: 'Breadcrumb',
    category: 'Controls',
    summary:
      'Accessible hierarchical path navigation (<nav aria-label="Breadcrumb"> + <ol>) with monospace separators, React 18/19 asChild links, and ellipsis collapse.',
    registryUrl: 'https://frame12.dev/r/breadcrumb.json',
    sourceFile: 'registry/ui/breadcrumb.tsx',
    props: [
      {
        name: 'items',
        type: 'BreadcrumbEntry[]',
        defaultValue: 'undefined',
        description:
          'Optional shorthand array of { label, href?, onClick?, onSelect?, current? } items. href renders a real <a> (new-tab and copy-link work; onClick is skipped on Ctrl/⌘/Shift/Alt-clicks). onSelect renders a <button> for in-page levels such as a tab or filter scope. With neither, the item is plain context text.',
      },
      {
        name: 'separator',
        type: 'React.ReactNode',
        defaultValue: "'/'",
        description: 'Custom visual separator rendered between breadcrumb items with aria-hidden="true".',
      },
      {
        name: 'ariaLabel',
        type: 'string',
        defaultValue: "'Breadcrumb'",
        description: 'Accessible landmark label for the outer <nav> element.',
      },
    ],
    a11yNotes: [
      'Marks the active page with aria-current="page" and hides separators with role="presentation" aria-hidden="true".',
      'BreadcrumbEllipsis keeps its .f12-sr-only label outside the aria-hidden glyph so screen readers announce collapsed levels.',
      'Never fake an in-page action with <a href="#…"> + preventDefault(): use onSelect / BreadcrumbButton so assistive tech hears a button and the browser offers no dead open-in-new-tab or copy-link.',
      'Actionable crumbs carry a dotted underline so they stay distinguishable from plain ancestor text without relying on colour.',
    ],
    grammarNotes: [
      'Uses uppercase monospace path tokens with 24×24px minimum interactive link targets.',
    ],
    usageTemplate: `import { Breadcrumb } from '@/components/frame12';

export function SheetPath({ onOpenSheets }: { onOpenSheets: () => void }) {
  return (
    <Breadcrumb
      items={[
        { label: 'Workspace', href: '/workspace' }, // real route → <a>
        { label: 'Sheets', onSelect: onOpenSheets }, // in-page level → <button>
        { label: 'Cut C-04 Ledger', current: true },
      ]}
    />
  );
}`,
  },
  {
    slug: 'pagination',
    title: 'Pagination',
    category: 'Controls',
    summary:
      'Deterministic page navigation (<nav aria-label="Pagination">) with ink-inverted aria-current="page" buttons, ellipsis range builder, and exposure-sheet summary.',
    registryUrl: 'https://frame12.dev/r/pagination.json',
    sourceFile: 'registry/ui/pagination.tsx',
    props: [
      {
        name: 'page / totalPages',
        type: 'number',
        defaultValue: 'undefined',
        description: 'Current 1-indexed page and total page count for data-driven rendering.',
      },
      {
        name: 'onPageChange',
        type: '(page: number) => void',
        defaultValue: 'undefined',
        description: 'Callback fired when a page number or Prev/Next button is activated.',
      },
      {
        name: 'showSummary',
        type: 'boolean',
        defaultValue: 'false',
        description: 'Renders the monospace PAGE X OF Y exposure-sheet counter alongside the page buttons.',
      },
      {
        name: 'density',
        type: "'comfortable' | 'compact'",
        defaultValue: "'comfortable'",
        description: 'Switches to 1.5px rules and compact padding while preserving >= 24×24px targets.',
      },
    ],
    a11yNotes: [
      'Sets aria-current="page" on the active page control and disables Previous/Next at range boundaries.',
      'PaginationEllipsis exposes a .f12-sr-only "More pages" label outside its aria-hidden visual glyph.',
    ],
    grammarNotes: [
      'Active page control inverts to --f-ink background with --f-sheet text for high-contrast storyboard clarity.',
    ],
    usageTemplate: `import { Pagination } from '@/components/frame12';

export function LedgerPagination({ page, onChange }: { page: number; onChange: (p: number) => void }) {
  return (
    <Pagination
      page={page}
      totalPages={12}
      onPageChange={onChange}
      showSummary
    />
  );
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
