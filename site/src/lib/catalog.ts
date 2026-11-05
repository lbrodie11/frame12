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
  whenToUse: string[];
  whenNotToUse: string[];
  props: PropDoc[];
  stateBehavior: string;
  a11yNotes: string[];
  keyboardNotes: string[];
  themeBehavior: string;
  responsiveBehavior: string;
  grammarNotes: string[];
  commonErrors: string[];
  usageTemplate: string;
}

export interface BlockCatalogEntry {
  slug: string;
  title: string;
  route: string;
  registryUrl: string;
  sourceFile: string;
  summary: string;
  architectureNotes: string[];
  fixtureNotes: string[];
  componentDependencies: string[];
  props: PropDoc[];
  customizationGuidance: string[];
  a11yNotes: string[];
  knownLimitations: string[];
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
    "slug": "sheet",
    "title": "Sheet",
    "category": "Layout",
    "summary": "Top-level storyboard container with top-edge registration pegs and 32px scene-change vertical rhythm.",
    "registryUrl": "https://frame12.dev/r/sheet.json",
    "sourceFile": "registry/ui/sheet.tsx",
    "whenToUse": [
      "As the top-level page or application block container to establish registration pegs, paper/ink surface tokens, and a 32px vertical rhythm between scenes.",
      "Whenever you want automatic sequential cut numbering (C-01, C-02…) in DOM reading order via autoCut."
    ],
    "whenNotToUse": [
      "Do not nest multiple <Sheet autoCut> containers with pegs inside individual cards or table cells; use <Scene> and <Panel> for interior regions.",
      "Do not use Sheet as a modal overlay; use <Dialog> and <DialogContent> for modal workflows."
    ],
    "props": [
      {
        "name": "pegs",
        "type": "boolean",
        "defaultValue": "true",
        "description": "Renders the three animation registration peg punch-holes along the top edge."
      },
      {
        "name": "autoCut",
        "type": "boolean",
        "defaultValue": "false",
        "description": "Numbers child <Panel> and <PanelPair> elements automatically (C-01, C-02…) in DOM order via CSS counters."
      },
      {
        "name": "motion",
        "type": "'stepped' | 'smooth' | 'cut'",
        "defaultValue": "'stepped'",
        "description": "Sets the active motion grammar class (.f12-m-stepped, .f12-m-smooth, or .f12-m-cut)."
      },
      {
        "name": "theme",
        "type": "'light' | 'dark' | undefined",
        "defaultValue": "undefined",
        "description": "Optional explicit theme override (.f12-theme-light or .f12-theme-dark)."
      },
      {
        "name": "sheetClassName",
        "type": "string",
        "defaultValue": "''",
        "description": "Additional class names applied to the inner .f12-sheet surface."
      }
    ],
    "stateBehavior": "Stateless layout container. Accepts controlled presentation props (motion=\"stepped\" | \"smooth\" | \"cut\" and theme=\"light\" | \"dark\") that scope CSS custom properties and motion timing to the sheet subtree.",
    "a11yNotes": [
      "Registration pegs are marked aria-hidden=\"true\" so assistive technologies skip decorative punch-holes.",
      "Automatically honors prefers-reduced-motion: reduce by switching stepped transitions to instant cuts."
    ],
    "keyboardNotes": [
      "Does not trap or intercept focus; preserves natural top-to-bottom, left-to-right DOM tab order across child scenes.",
      "Registration pegs are decorative (aria-hidden=\"true\") and skipped by keyboard Tab navigation."
    ],
    "themeBehavior": "Applies .f12-theme-light or .f12-theme-dark when theme is passed; when theme is omitted, inherits the document theme or OS prefers-color-scheme: dark automatically.",
    "responsiveBehavior": "Centers a max-width 1320px paper sheet on --f-desk with fluid horizontal padding and responsive registration peg spacing down to 320px viewports.",
    "grammarNotes": [
      "Establishes a 32px (--f-gutter-change) vertical gap between the header and each Scene.",
      "Frames the white paper sheet (--f-sheet) against the outer worktable desk (--f-desk)."
    ],
    "commonErrors": [
      "Passing explicit cut=\"C-01\" props on child <Panel> elements inside <Sheet autoCut> triggers check-frame12.mjs rule explicit-cut-in-autocut. Omit cut on numbered panels or pass cut={false} to suppress numbering.",
      "Forgetting to pass motion={motion} when your host page exposes a 12fps / 60fps / Cut motion switcher."
    ],
    "usageTemplate": "import { Sheet, Scene, Panel } from '@/components/frame12';\n\nexport function OverviewSheet() {\n  return (\n    <Sheet autoCut pegs motion=\"stepped\">\n      <Scene gutter=\"scene\" layout=\"stack\">\n        <Panel label=\"Establishing frame\">\n          <p>Storyboard sheet content</p>\n        </Panel>\n      </Scene>\n    </Sheet>\n  );\n}"
  },
  {
    "slug": "scene",
    "title": "Scene",
    "category": "Layout",
    "summary": "Responsive CSS Grid layout container enforcing the three legal FRAME/12 gutter widths: 12px (pair), 20px (scene), and 32px (change).",
    "registryUrl": "https://frame12.dev/r/scene.json",
    "sourceFile": "registry/ui/scene.tsx",
    "whenToUse": [
      "To arrange two or three related panels side-by-side within a single narrative beat using legal 12px (pair), 20px (scene), or 32px (change) gutters.",
      "To pair a dominant 2fr establishing shot (C-01) with a 1fr secondary column (layout=\"split\")."
    ],
    "whenNotToUse": [
      "Do not use arbitrary CSS Grid or Tailwind gap utilities (gap-4, gap-6, 16px, 24px) instead of Scene; illegal gutters fail check-frame12.mjs.",
      "Do not use Scene for inline button groups; use .f12-row-pair (12px flex gap) for compact horizontal toolbars."
    ],
    "props": [
      {
        "name": "gutter",
        "type": "'pair' | 'scene' | 'change'",
        "defaultValue": "'scene'",
        "description": "Selects 12px (pair), 20px (scene), or 32px (change) grid gap."
      },
      {
        "name": "layout",
        "type": "'split' | 'stack' | 'equal' | 'three'",
        "defaultValue": "'split'",
        "description": "Grid column template: 2fr/1fr (split), 1fr (stack), 1fr/1fr (equal), or 3-col (three)."
      }
    ],
    "stateBehavior": "Stateless CSS Grid layout primitive driven by gutter (\"pair\" | \"scene\" | \"change\") and layout (\"split\" | \"stack\" | \"equal\" | \"three\").",
    "a11yNotes": [
      "Collapses multi-column grids to a single reading-order column below 760px container width.",
      "Preserves DOM order and keyboard tab sequence across desktop and mobile viewports."
    ],
    "keyboardNotes": [
      "Maintains strict visual-to-DOM reading order: left-to-right across columns on desktop and top-to-bottom when stacked on mobile."
    ],
    "themeBehavior": "Transparent structural grid container; exposes --f-desk or --f-sheet through legal gutter gaps between framed panels.",
    "responsiveBehavior": "Uses CSS container queries (@container (max-width: 760px)) and media queries to collapse split, equal, and three layouts into a single 1fr column on narrow viewports.",
    "grammarNotes": [
      "Arbitrary gaps (8px, 16px, 24px) are forbidden by check-frame12.mjs; always use Scene gutter props.",
      "Use layout=\"split\" (2fr 1fr) when pairing an establishing C-01 panel with a PanelPair."
    ],
    "commonErrors": [
      "Overriding Scene spacing with arbitrary pixel gaps (such as 16px or 24px) instead of gutter=\"pair\" | \"scene\" | \"change\" (flagged as illegal-gutter).",
      "Placing unrelated narrative sections inside a single Scene instead of starting a new Scene separated by the Sheet 32px change gutter."
    ],
    "usageTemplate": "import { Scene, Panel } from '@/components/frame12';\n\nexport function SplitScene() {\n  return (\n    <Scene gutter=\"scene\" layout=\"equal\">\n      <Panel label=\"Left frame\">Left scene panel</Panel>\n      <Panel label=\"Right frame\">Right scene panel</Panel>\n    </Scene>\n  );\n}"
  },
  {
    "slug": "panel",
    "title": "Panel",
    "category": "Layout",
    "summary": "Ink-framed section drawn with a measured SVG mitered polygon (2.5px stroke, 16px slant rise) and top-edge cut number.",
    "registryUrl": "https://frame12.dev/r/panel.json",
    "sourceFile": "registry/ui/panel.tsx",
    "whenToUse": [
      "In expressive mode (default) for primary storyboard beats, hero KPIs, and charts that require a 2.5px mitered SVG polygon frame and sequential C-01..C-0n cut badge.",
      "In quiet mode (variant=\"quiet\") for dense operational forms, filter bars, settings groups, and secondary tables that use a 1px solid --f-rule frame without cut badges."
    ],
    "whenNotToUse": [
      "Do not put expressive 2.5px frames and cut numbers on every small form subsection or filter bar; use variant=\"quiet\" for subordinate operational chrome.",
      "Do not replace Panel with rounded cards, drop shadows, or raw bordered <div> elements."
    ],
    "props": [
      {
        "name": "cut",
        "type": "string | false",
        "defaultValue": "undefined",
        "description": "Inside <Sheet autoCut>, omit to number automatically (C-01, C-02…) via CSS counters, or pass false to hide the cut badge. Outside <Sheet autoCut>, pass an explicit sequential string (C-01, C-02…)."
      },
      {
        "name": "shape",
        "type": "'rect' | 'slant-bottom' | 'slant-top'",
        "defaultValue": "'rect'",
        "description": "Polygon geometry: rectangular or 16px diagonal slant along bottom/top edge."
      },
      {
        "name": "variant",
        "type": "'expressive' | 'quiet'",
        "defaultValue": "'expressive'",
        "description": "Selects the 2.5px SVG polygon storyboard frame (expressive) or the 1px orthographic exposure-sheet ledger frame (quiet, which omits automatic cut numbers by default)."
      },
      {
        "name": "label",
        "type": "string",
        "defaultValue": "undefined",
        "description": "Accessible aria-label applied to the underlying <section> element."
      }
    ],
    "stateBehavior": "Stateless semantic <section> wrapper that tracks its own offsetWidth/offsetHeight via useSize (ResizeObserver) when rendering an expressive SVG polygon border.",
    "a11yNotes": [
      "The SVG polygon border and cut badge carry aria-hidden=\"true\" so screen readers announce the semantic content cleanly.",
      "Uses ResizeObserver on layout offsetWidth/offsetHeight so borders stay crisp at any viewport size."
    ],
    "keyboardNotes": [
      "Renders as a semantic <section aria-label={label}> landmark when label is provided; does not add an extra Tab stop unless tabIndex is explicitly passed."
    ],
    "themeBehavior": "Fills the panel interior with --f-panel and strokes the 2.5px SVG polygon (or 1px quiet border) with --f-rule, inverting cleanly between warm paper and dark ink surfaces.",
    "responsiveBehavior": "Recomputes SVG polygon vertex coordinates on resize via ResizeObserver so 2.5px mitered borders and 16px slant diagonals never stretch or blur at any viewport width.",
    "grammarNotes": [
      "Inside <Sheet autoCut>, panels number automatically in DOM and reading order via CSS counters; pass cut={false} to suppress a cut on a panel, or pass explicit sequential cuts outside autoCut.",
      "Never replace Panel with a rounded card or drop-shadow box."
    ],
    "commonErrors": [
      "Passing cut=\"C-01\" inside <Sheet autoCut> instead of letting CSS counters assign cuts automatically (or passing cut={false} to hide the cut).",
      "Omitting label on primary expressive panels, which leaves <section> elements without an accessible region name."
    ],
    "usageTemplate": "import { Panel, Metric, fmtCurrency } from '@/components/frame12';\n\nexport function RevenuePanel() {\n  return (\n    <Panel label=\"Recovered revenue\">\n      <Metric label=\"Recovered revenue\" value={120054} format={fmtCurrency} big />\n    </Panel>\n  );\n}"
  },
  {
    "slug": "panel-pair",
    "title": "PanelPair",
    "category": "Layout",
    "summary": "Couples two related panels vertically across a shared 12px slanted gutter (slant-bottom over slant-top).",
    "registryUrl": "https://frame12.dev/r/panel-pair.json",
    "sourceFile": "registry/ui/panel-pair.tsx",
    "whenToUse": [
      "To couple two closely related secondary KPIs or companion panels vertically across a shared 12px slanted gutter (slant-bottom over slant-top).",
      "In the 1fr right-hand column of a <Scene layout=\"split\"> beside a dominant C-01 establishing panel."
    ],
    "whenNotToUse": [
      "Do not use PanelPair for more than two stacked panels or for unrelated sections; use <Scene layout=\"stack\"> instead.",
      "Do not use diagonal slants inside dense settings forms; pass variant=\"quiet\" if pairing two quiet operational panels."
    ],
    "props": [
      {
        "name": "variant",
        "type": "'expressive' | 'quiet'",
        "defaultValue": "'expressive'",
        "description": "When set to quiet, renders rectangular 1px orthographic panels without diagonal slants or automatic cut badges."
      },
      {
        "name": "top",
        "type": "Omit<PanelProps, 'shape'>",
        "defaultValue": "undefined",
        "description": "Props and children for the upper slant-bottom panel."
      },
      {
        "name": "bottom",
        "type": "Omit<PanelProps, 'shape'>",
        "defaultValue": "undefined",
        "description": "Props and children for the lower slant-top panel."
      },
      {
        "name": "topCut / bottomCut",
        "type": "string | false",
        "defaultValue": "undefined",
        "description": "Cut labels (or false to hide) when passing two child elements directly; omit inside <Sheet autoCut> for automatic numbering."
      },
      {
        "name": "topLabel / bottomLabel",
        "type": "string",
        "defaultValue": "undefined",
        "description": "Accessible aria-label overrides for the top and bottom <section> panels when passing two child elements directly."
      }
    ],
    "stateBehavior": "Stateless composition wrapper that renders two <Panel> instances (either from top/bottom prop objects or from two React child nodes).",
    "a11yNotes": [
      "Renders top panel before bottom panel in DOM order, matching top-to-bottom reading order.",
      "Adds extra interior padding along the slanted edge so text never collides with the 16px diagonal."
    ],
    "keyboardNotes": [
      "Top panel always precedes bottom panel in DOM order, preserving top-to-bottom keyboard Tab navigation."
    ],
    "themeBehavior": "Inherits --f-panel surface and --f-rule stroke tokens from the active light or dark theme.",
    "responsiveBehavior": "Stacks cleanly at full width when a parent <Scene layout=\"split\"> collapses below 760px, maintaining the 16px diagonal slant and 12px pair gap.",
    "grammarNotes": [
      "Encodes \"these two metrics belong together\" via a 12px (--f-gutter-pair) slanted gutter.",
      "Always pairs slant-bottom on top with slant-top on the bottom."
    ],
    "commonErrors": [
      "Passing three or more children to <PanelPair>; PanelPair only renders its first two children (top and bottom).",
      "Passing explicit topCut / bottomCut strings inside <Sheet autoCut> instead of letting autoCut number both panels sequentially."
    ],
    "usageTemplate": "import { PanelPair, Metric, fmtCurrency, fmtPP } from '@/components/frame12';\n\nexport function PairedMetrics() {\n  return (\n    <PanelPair\n      top={{ label: 'Profit', children: <Metric label=\"Incremental profit\" value={38420} format={fmtCurrency} /> }}\n      bottom={{ label: 'Lift', children: <Metric label=\"Conversion lift\" value={0.51} format={fmtPP} /> }}\n    />\n  );\n}"
  },
  {
    "slug": "segmented-control",
    "title": "SegmentedControl",
    "category": "Controls",
    "summary": "Exposure-sheet cell selector with a mix-blend-mode: difference indicator that steps across cells in 3 held poses.",
    "registryUrl": "https://frame12.dev/r/segmented-control.json",
    "sourceFile": "registry/ui/segmented-control.tsx",
    "whenToUse": [
      "To switch the active view, time window (7D / 30D / 90D), environment (PROD / STAGE), or motion mode of the same underlying content."
    ],
    "whenNotToUse": [
      "Do not use SegmentedControl to switch between completely distinct content sections with separate forms or tables; use <Tabs> (role=\"tablist\") instead.",
      "Do not use SegmentedControl for 6+ options that overflow mobile widths; use <Select> instead."
    ],
    "props": [
      {
        "name": "options",
        "type": "Array<{ value: T; label: string; unit?: string }>",
        "defaultValue": "required",
        "description": "Ordered cell options with display numeral/label and optional mono unit."
      },
      {
        "name": "value",
        "type": "T",
        "defaultValue": "required",
        "description": "Currently active option value."
      },
      {
        "name": "onChange",
        "type": "(value: T) => void",
        "defaultValue": "required",
        "description": "Callback fired when a cell is activated."
      },
      {
        "name": "ariaLabel",
        "type": "string",
        "defaultValue": "'Options'",
        "description": "Accessible label for the role=\"group\" container."
      },
      {
        "name": "idPrefix",
        "type": "string",
        "defaultValue": "'seg'",
        "description": "Prefix for deterministic button IDs (${idPrefix}-${opt.value})."
      }
    ],
    "stateBehavior": "Controlled component requiring value and onChange(nextValue). Tracks the active option index to position the mix-blend-mode: difference indicator.",
    "a11yNotes": [
      "Uses role=\"group\" with aria-pressed={active} on native <button type=\"button\"> elements.",
      "Provides a 3px solid --f-marker inset focus ring on :focus-visible."
    ],
    "keyboardNotes": [
      "Renders native <button type=\"button\" aria-pressed={active}> elements inside role=\"group\"; reachable via Tab and activated with Enter or Space.",
      "Displays a 3px solid --f-marker inset focus ring on :focus-visible."
    ],
    "themeBehavior": "Uses mix-blend-mode: difference on an active cell indicator inside an isolation: isolate container so active cells invert ink and paper in both light and dark themes.",
    "responsiveBehavior": "Cells flex equally across available width (--seg-count) and wrap cleanly inside header toolbars on 390px mobile viewports.",
    "grammarNotes": [
      "In .f12-m-stepped mode, the indicator transitions with steps(3, end) over 250ms (3 held poses at 83.33ms).",
      "Uses mix-blend-mode: difference so text covered by the indicator remains legible at every intermediate pose."
    ],
    "commonErrors": [
      "Using SegmentedControl as a tab bar for unrelated views instead of <Tabs>, or omitting ariaLabel when multiple SegmentedControls appear on the same page.",
      "Reusing the same idPrefix across multiple SegmentedControls with identical option values, producing duplicate DOM IDs."
    ],
    "usageTemplate": "import { SegmentedControl } from '@/components/frame12';\n\nexport function RangeSelector({ range, setRange }: { range: number; setRange: (r: number) => void }) {\n  return (\n    <SegmentedControl\n      ariaLabel=\"Date range\"\n      options={[\n        { value: 7, label: '7', unit: 'days' },\n        { value: 30, label: '30', unit: 'days' },\n        { value: 90, label: '90', unit: 'days' },\n      ]}\n      value={range}\n      onChange={setRange}\n    />\n  );\n}"
  },
  {
    "slug": "button",
    "title": "Button",
    "category": "Controls",
    "summary": "Ink-framed action button with immediate offset shadow on hover and primary, secondary, and marker-yellow variants.",
    "registryUrl": "https://frame12.dev/r/button.json",
    "sourceFile": "registry/ui/button.tsx",
    "whenToUse": [
      "For primary form submissions (variant=\"primary\"), secondary utility actions (variant=\"secondary\"), or high-visibility storyboard triggers (variant=\"marker\")."
    ],
    "whenNotToUse": [
      "Do not use a raw <button> or unadapted @/components/ui/button in FRAME/12 screens.",
      "Do not use Button for navigation between URLs when an anchor link (<a href=\"...\"> or BreadcrumbLink) is semantically appropriate."
    ],
    "props": [
      {
        "name": "variant",
        "type": "'primary' | 'secondary' | 'marker'",
        "defaultValue": "'secondary'",
        "description": "Visual style: inverted ink (primary), paper surface (secondary), or marker yellow (marker)."
      },
      {
        "name": "size",
        "type": "'sm' | 'md' | 'lg'",
        "defaultValue": "'md'",
        "description": "Padding and monospace font scale."
      }
    ],
    "stateBehavior": "Stateless forwarded-ref <button> primitive defaulting to type=\"button\" so buttons inside forms do not accidentally submit unless type=\"submit\" is passed.",
    "a11yNotes": [
      "Forwards ref to a native <button type=\"button\"> with 3px solid --f-ink focus-visible outline.",
      "Marker variant pairs --f-marker background with --f-marker-ink text for 14.8:1 contrast."
    ],
    "keyboardNotes": [
      "Native <button> keyboard activation via Enter and Space with a 3px solid --f-ink focus-visible outline offset by 2px."
    ],
    "themeBehavior": "Primary inverts --f-ink and --f-sheet; secondary uses --f-panel; marker uses --f-marker with dark --f-marker-ink in both light and dark themes.",
    "responsiveBehavior": "Maintains >= 24×24px WCAG 2.5.8 target size across sm, md, and lg sizes and wraps cleanly inside .f12-row-pair containers.",
    "grammarNotes": [
      "Hover state applies a hard 3px 3px 0 var(--f-rule) offset shadow immediately (0ms latency).",
      "Disabled buttons switch to a dashed ink border with --f-ink-2 text."
    ],
    "commonErrors": [
      "Forgetting type=\"submit\" when placing <Button> inside a <form onSubmit={...}> element (Button defaults to type=\"button\").",
      "Overusing variant=\"marker\" on multiple adjacent buttons instead of reserving marker yellow for a single focal action."
    ],
    "usageTemplate": "import { Button } from '@/components/frame12';\n\nexport function ActionRow() {\n  return (\n    <div className=\"f12-row-pair\">\n      <Button variant=\"primary\">Deploy Rules</Button>\n      <Button variant=\"marker\">Run Replay</Button>\n      <Button variant=\"secondary\">Export CSV</Button>\n    </div>\n  );\n}"
  },
  {
    "slug": "input",
    "title": "Input",
    "category": "Controls",
    "summary": "Accessible text input with linked monospace label, optional hint, and marker-flagged error alert.",
    "registryUrl": "https://frame12.dev/r/input.json",
    "sourceFile": "registry/ui/input.tsx",
    "whenToUse": [
      "For single-line text, search, email, URL, or numeric inputs in settings forms, filter bars, and modal dialogs.",
      "Either standalone (<Input label=\"Endpoint\" />) or coordinated inside <Field label=\"Endpoint\"><Input /></Field>."
    ],
    "whenNotToUse": [
      "Do not use Input for multi-line text entry; use <Textarea> instead.",
      "Do not use an unlabeled raw <input> element."
    ],
    "props": [
      {
        "name": "label",
        "type": "React.ReactNode",
        "defaultValue": "undefined",
        "description": "Visible label text programmatically linked to the <input> via htmlFor/id (optional when wrapped in <Field>)."
      },
      {
        "name": "hint",
        "type": "React.ReactNode",
        "defaultValue": "undefined",
        "description": "Optional helper text linked via aria-describedby."
      },
      {
        "name": "error",
        "type": "React.ReactNode",
        "defaultValue": "undefined",
        "description": "Validation error message rendered in a role=\"alert\" live region with a marker flag."
      },
      {
        "name": "density",
        "type": "'comfortable' | 'compact'",
        "defaultValue": "'comfortable'",
        "description": "Reduces input padding and switches to a 1.5px rule for dense settings and filter bars."
      },
      {
        "name": "fieldClassName",
        "type": "string",
        "defaultValue": "undefined",
        "description": "Additional class names applied to the outer .f12-field wrapper when Input renders standalone."
      }
    ],
    "stateBehavior": "Supports both controlled (value + onChange) and uncontrolled (defaultValue) usage, forwarding ref directly to the native <input> for FormData and react-hook-form register().",
    "a11yNotes": [
      "Automatically generates a stable ID via React.useId() when id is omitted, or inherits FieldContext when placed inside <Field>.",
      "Sets aria-invalid={Boolean(error)} and chains hintId/errorId into aria-describedby."
    ],
    "keyboardNotes": [
      "Standard native <input> keyboard editing and selection with immediate (0ms) focus ring and typing feedback."
    ],
    "themeBehavior": "Renders on --f-panel with --f-ink text, --f-ink-2 placeholder ink, and a --f-marker error badge with --f-marker-ink text when invalid.",
    "responsiveBehavior": "Expands to 100% of its field container width with box-sizing: border-box and compact density support for multi-column filter bars.",
    "grammarNotes": [
      "Uses a 2.5px solid --f-rule square border with zero border-radius.",
      "Error flags use --f-marker background under bold --f-marker-ink text."
    ],
    "commonErrors": [
      "Omitting both label and aria-label on a standalone <Input>, leaving the form control unnamed for screen readers.",
      "Nesting <Input label=\"X\" /> with a different <Field label=\"Y\"> without realizing <Field> coordinates the label for single-control children."
    ],
    "usageTemplate": "import { Input } from '@/components/frame12';\n\nexport function WebhookField() {\n  return (\n    <Input\n      label=\"Webhook signing secret\"\n      hint=\"Rotated every 90 days across production endpoints\"\n      defaultValue=\"whsec_f12_99481a\"\n    />\n  );\n}"
  },
  {
    "slug": "field",
    "title": "Field",
    "category": "Controls",
    "summary": "Shared form field coordinator that links label, hint, marker-flagged error alert, required indicator, and density across form controls via FieldContext.",
    "registryUrl": "https://frame12.dev/r/field.json",
    "sourceFile": "registry/ui/field.tsx",
    "whenToUse": [
      "To wrap Input, Textarea, Select, RadioGroup, Checkbox, or Switch when coordinating shared labels, hints, role=\"alert\" validation errors, required flags, and density.",
      "To group multiple related Checkboxes or Switches under a single role=\"group\" label with shared hint/error messaging."
    ],
    "whenNotToUse": [
      "Do not nest a <Field> inside another <Field>; nested Field contexts cause duplicate wrapper spacing."
    ],
    "props": [
      {
        "name": "label",
        "type": "React.ReactNode",
        "defaultValue": "undefined",
        "description": "Uppercase monospace field label linked to the child control via htmlFor/id (or <legend> when wrapping <RadioGroup>)."
      },
      {
        "name": "hint",
        "type": "React.ReactNode",
        "defaultValue": "undefined",
        "description": "Helper text rendered below the control and chained into aria-describedby."
      },
      {
        "name": "error",
        "type": "React.ReactNode",
        "defaultValue": "undefined",
        "description": "Marker-flagged error message rendered in a role=\"alert\" live region and setting aria-invalid=\"true\"."
      },
      {
        "name": "density",
        "type": "'comfortable' | 'compact'",
        "defaultValue": "'comfortable'",
        "description": "Propagates comfortable or compact density to child Input, Textarea, Checkbox, RadioGroup, Switch, or Select controls."
      },
      {
        "name": "required / disabled",
        "type": "boolean",
        "defaultValue": "false",
        "description": "Propagates required and disabled states to child controls via FieldContext."
      },
      {
        "name": "id / htmlFor",
        "type": "string",
        "defaultValue": "useId()",
        "description": "Explicit base ID or target control ID for programmatic <label htmlFor> association."
      }
    ],
    "stateBehavior": "Provides FieldContext (id, labelId, hintId, errorId, describedBy, invalid, disabled, required, density) and dynamically switches between a single linked <label htmlFor>, a <fieldset>/<legend> delegation for <RadioGroup>, or a <div role=\"group\" aria-labelledby> for multi-option groups.",
    "a11yNotes": [
      "Prevents duplicate labels, hints, and error alerts when wrapping Input, Textarea, Checkbox, Switch, RadioGroup, or Select. For single Input/Textarea/Select controls, <Field label=\"...\"> takes precedence over a child label; for Checkbox/Switch children with their own label (or multiple controls), <Field> becomes role=\"group\" with aria-labelledby while each option keeps its own <label htmlFor>.",
      "Supports both FieldContext-aware components and render-prop children ((field) => ...) or native <input>/<textarea>/<select> elements. Do not nest <Field> inside another <Field>."
    ],
    "keyboardNotes": [
      "Clicking the linked <label> focuses the associated form control directly."
    ],
    "themeBehavior": "Uses --f-ink for labels, --f-ink-2 for hint copy, and --f-marker with --f-marker-ink for validation error flags in both themes.",
    "responsiveBehavior": "Stacks label, control, hint, and error vertically with zero horizontal overflow at 390px mobile widths.",
    "grammarNotes": [
      "Uses .f12-label uppercase monospace headers and .f12-error-flag marker badges for validation alerts."
    ],
    "commonErrors": [
      "Adding a manual <label> or duplicate error <div> next to a child <Input> that is already wrapped in <Field label=\"...\" error=\"...\">.",
      "Setting required on a <Field> wrapping multiple independent <Checkbox> options when any single checked option satisfies the group (Field automatically suppresses per-checkbox required in control groups)."
    ],
    "usageTemplate": "import { Field, Input } from '@/components/frame12';\n\nexport function EndpointField() {\n  return (\n    <Field\n      label=\"Webhook endpoint URL\"\n      hint=\"Must accept TLS 1.3 POST requests\"\n      required\n    >\n      <Input defaultValue=\"https://api.acme.dev/webhooks/f12\" />\n    </Field>\n  );\n}"
  },
  {
    "slug": "textarea",
    "title": "Textarea",
    "category": "Controls",
    "summary": "Ink-framed multi-line text input with linked monospace label, hint, marker-flagged error alert, and FieldContext integration.",
    "registryUrl": "https://frame12.dev/r/textarea.json",
    "sourceFile": "registry/ui/textarea.tsx",
    "whenToUse": [
      "For multi-line text entry such as escalation bios, incident runbooks, webhook payload templates, or audit notes."
    ],
    "whenNotToUse": [
      "Do not use Textarea for single-line identifiers, slugs, or URLs; use <Input> instead."
    ],
    "props": [
      {
        "name": "label",
        "type": "React.ReactNode",
        "defaultValue": "undefined",
        "description": "Visible label text programmatically linked to the <textarea> via htmlFor/id (optional inside <Field>)."
      },
      {
        "name": "hint",
        "type": "React.ReactNode",
        "defaultValue": "undefined",
        "description": "Optional helper text linked via aria-describedby."
      },
      {
        "name": "error",
        "type": "React.ReactNode",
        "defaultValue": "undefined",
        "description": "Validation error message rendered in a role=\"alert\" live region."
      },
      {
        "name": "density",
        "type": "'comfortable' | 'compact'",
        "defaultValue": "'comfortable'",
        "description": "Switches to a 1.5px rule and tighter padding for dense operational forms."
      },
      {
        "name": "fieldClassName",
        "type": "string",
        "defaultValue": "undefined",
        "description": "Additional class names applied to the outer .f12-field wrapper when Textarea renders standalone."
      }
    ],
    "stateBehavior": "Supports controlled (value + onChange) and uncontrolled (defaultValue) modes, forwarding ref to the native <textarea> element.",
    "a11yNotes": [
      "Forwards ref to a native <textarea> element for direct compatibility with FormData and react-hook-form register().",
      "Chains hintId, errorId, and FieldContext describedBy IDs into aria-describedby."
    ],
    "keyboardNotes": [
      "Supports standard multi-line keyboard navigation, Enter newlines, and Tab focus traversal."
    ],
    "themeBehavior": "Renders --f-panel background, --f-ink text, and 2.5px (1.5px compact) --f-rule borders in both light and dark themes.",
    "responsiveBehavior": "Stretches to 100% container width with vertical-only resize (resize: vertical) so users cannot break horizontal page layout.",
    "grammarNotes": [
      "Square 2.5px ink rule (1.5px in compact density) with vertical resize and dashed border when disabled."
    ],
    "commonErrors": [
      "Allowing horizontal resize on custom textareas, which can cause horizontal overflow inside narrow panels."
    ],
    "usageTemplate": "import { Textarea } from '@/components/frame12';\n\nexport function RunbookNotes() {\n  return (\n    <Textarea\n      label=\"Incident runbook notes\"\n      hint=\"Included in webhook alert payloads\"\n      defaultValue=\"Escalate to on-call if 5xx exceeds 1.5% over 3 consecutive cuts.\"\n    />\n  );\n}"
  },
  {
    "slug": "checkbox",
    "title": "Checkbox",
    "category": "Controls",
    "summary": "Native ink-framed checkbox with crisp SVG checkmark, SSR-safe indeterminate mixed mark, and 24×24px minimum target size.",
    "registryUrl": "https://frame12.dev/r/checkbox.json",
    "sourceFile": "registry/ui/checkbox.tsx",
    "whenToUse": [
      "For binary opt-in choices, multi-select channel toggles (Webhook, Email, Pager), or parent batch-selection controls using indeterminate."
    ],
    "whenNotToUse": [
      "Do not use Checkbox when options are mutually exclusive; use <RadioGroup> or <SegmentedControl> instead.",
      "Do not use Checkbox for immediate live hardware/mode toggles where a switch metaphor is clearer; use <Switch> instead."
    ],
    "props": [
      {
        "name": "label",
        "type": "React.ReactNode",
        "defaultValue": "undefined",
        "description": "Inline label linked to the native <input type=\"checkbox\"> via htmlFor/id."
      },
      {
        "name": "indeterminate",
        "type": "boolean",
        "defaultValue": "false",
        "description": "Renders the horizontal mixed-state mark in SSR HTML/CSS and syncs DOM input.indeterminate across user activation and form.reset()."
      },
      {
        "name": "onCheckedChange",
        "type": "(checked: boolean) => void",
        "defaultValue": "undefined",
        "description": "Convenience callback invoked with the boolean checked state on change."
      },
      {
        "name": "density",
        "type": "'comfortable' | 'compact'",
        "defaultValue": "'comfortable'",
        "description": "Reduces border weight to 1.5px while preserving a 24×24px WCAG 2.5.8 click target."
      },
      {
        "name": "hint / error",
        "type": "React.ReactNode",
        "defaultValue": "undefined",
        "description": "Optional helper text and role=\"alert\" validation message chained into aria-describedby."
      },
      {
        "name": "fieldClassName",
        "type": "string",
        "defaultValue": "undefined",
        "description": "Additional class names applied to the outer .f12-field wrapper."
      }
    ],
    "stateBehavior": "Supports controlled (checked + onCheckedChange/onChange) and uncontrolled (defaultChecked) state, plus SSR-safe indeterminate mixed state synchronized with DOM input.indeterminate across user activation and form.reset().",
    "a11yNotes": [
      "Built on a native <input type=\"checkbox\"> with appearance: none so FormData, form.reset(), required, form=, label clicks, and react-hook-form register() work natively.",
      "Provides explicit system-color rules under @media (forced-colors: active)."
    ],
    "keyboardNotes": [
      "Focusable via Tab and toggled via Spacebar using native <input type=\"checkbox\"> semantics."
    ],
    "themeBehavior": "Unchecked frame uses --f-panel and --f-rule; checked and indeterminate states invert to --f-ink with a --f-sheet SVG checkmark or bar, plus explicit @media (forced-colors: active) rules.",
    "responsiveBehavior": "Guarantees a minimum 24×24px touch and pointer hit target in both comfortable and compact densities.",
    "grammarNotes": [
      "Uses a square 24×24px ink frame that fills with --f-ink when checked or indeterminate."
    ],
    "commonErrors": [
      "Mutating ref.current.indeterminate imperatively instead of passing the indeterminate prop to <Checkbox>."
    ],
    "usageTemplate": "import { Checkbox } from '@/components/frame12';\n\nexport function AuditToggle() {\n  return (\n    <Checkbox\n      label=\"Require dual-key signoff on production cuts\"\n      hint=\"Enforced for all expressive storyboard sheets\"\n      defaultChecked\n    />\n  );\n}"
  },
  {
    "slug": "radio-group",
    "title": "RadioGroup",
    "category": "Controls",
    "summary": "Accessible radio group built on native <fieldset>, <legend>, and <input type=\"radio\"> elements with vertical or horizontal layout.",
    "registryUrl": "https://frame12.dev/r/radio-group.json",
    "sourceFile": "registry/ui/radio-group.tsx",
    "whenToUse": [
      "When the user must select exactly one option from 2–6 mutually exclusive choices with visible labels and optional per-option hints (e.g., digest cadence, density mode)."
    ],
    "whenNotToUse": [
      "Do not use RadioGroup when multiple options can be selected simultaneously; use <Checkbox> inside <Field> instead.",
      "Do not use RadioGroup for compact header view switchers; use <SegmentedControl> instead."
    ],
    "props": [
      {
        "name": "label",
        "type": "React.ReactNode",
        "defaultValue": "undefined",
        "description": "Group caption rendered inside <legend className=\"f12-label\">."
      },
      {
        "name": "options",
        "type": "RadioOption[]",
        "defaultValue": "undefined",
        "description": "Shorthand array of { value, label, hint?, disabled? } items; or pass <RadioGroupItem> children."
      },
      {
        "name": "orientation",
        "type": "'vertical' | 'horizontal'",
        "defaultValue": "'vertical'",
        "description": "Stacks radio items vertically or wraps them horizontally."
      },
      {
        "name": "density",
        "type": "'comfortable' | 'compact'",
        "defaultValue": "'comfortable'",
        "description": "Switches to 1.5px radio borders and tighter spacing while keeping 24×24px targets."
      },
      {
        "name": "name",
        "type": "string",
        "defaultValue": "useId()",
        "description": "Shared form control name applied to child <input type=\"radio\"> inputs."
      },
      {
        "name": "value / defaultValue",
        "type": "string",
        "defaultValue": "undefined",
        "description": "Controlled or uncontrolled active radio option value."
      },
      {
        "name": "onValueChange",
        "type": "(value: string) => void",
        "defaultValue": "undefined",
        "description": "Callback invoked when the selected radio option changes."
      },
      {
        "name": "hint / error",
        "type": "React.ReactNode",
        "defaultValue": "undefined",
        "description": "Group-level helper text and role=\"alert\" validation message linked via aria-describedby on the <fieldset>."
      },
      {
        "name": "required / disabled",
        "type": "boolean",
        "defaultValue": "false",
        "description": "Propagates required and disabled states to every radio option in the group."
      }
    ],
    "stateBehavior": "Supports controlled (value + onValueChange) and uncontrolled (defaultValue) modes on native <fieldset> + <input type=\"radio\"> elements, preserving native FormData and form.reset().",
    "a11yNotes": [
      "Relies on native <input type=\"radio\"> inside <fieldset> + <legend> for browser-native arrow-key navigation, single tab stop, FormData, and form.reset().",
      "When wrapped in <Field label=\"...\"> (including via render-prop or wrapper), renders the Field label as the <fieldset> <legend> so no invalid <label htmlFor=\"fieldset\"> or duplicate label is produced.",
      "For react-hook-form, spread {...register(\"field\")} onto each <RadioGroupItem>, or wrap <RadioGroup> in <Controller> when using the options prop."
    ],
    "keyboardNotes": [
      "Single Tab stop enters the checked (or first enabled) radio button; ArrowUp/ArrowLeft and ArrowDown/ArrowRight move focus and selection across options natively."
    ],
    "themeBehavior": "Renders circular 24×24px --f-rule frames with an inner --f-ink dot when checked in both light and dark themes.",
    "responsiveBehavior": "Stacks vertically by default or wraps cleanly when orientation=\"horizontal\" on narrow mobile viewports.",
    "grammarNotes": [
      "Uses circular 24×24px ink frames to distinguish single-choice radio buttons from square multi-choice checkboxes."
    ],
    "commonErrors": [
      "Wrapping <RadioGroup> in a custom <label> instead of letting RadioGroup (or <Field>) render a semantic <legend> inside <fieldset>."
    ],
    "usageTemplate": "import { RadioGroup } from '@/components/frame12';\n\nexport function CadenceRadio() {\n  return (\n    <RadioGroup\n      label=\"Digest cadence\"\n      name=\"cadence\"\n      defaultValue=\"daily\"\n      options={[\n        { value: 'realtime', label: 'Real-time', hint: 'Immediate webhook dispatch' },\n        { value: 'daily', label: 'Daily cut', hint: '09:00 UTC exposure sheet summary' },\n        { value: 'weekly', label: 'Weekly rollup', hint: 'Monday 09:00 UTC digest' },\n      ]}\n    />\n  );\n}"
  },
  {
    "slug": "switch",
    "title": "Switch",
    "category": "Controls",
    "summary": "Exposure-sheet toggle switch built on native <input type=\"checkbox\" role=\"switch\"> with configurable ON/OFF glyph, RTL-ready logical thumb, and stepped 12fps motion.",
    "registryUrl": "https://frame12.dev/r/switch.json",
    "sourceFile": "registry/ui/switch.tsx",
    "whenToUse": [
      "For binary on/off operational settings (e.g., Enforce signed commits, Respect prefers-reduced-motion, Auto-replay webhooks)."
    ],
    "whenNotToUse": [
      "Do not use Switch for multi-item selection lists or terms-of-service consent checkboxes; use <Checkbox> instead."
    ],
    "props": [
      {
        "name": "label",
        "type": "React.ReactNode",
        "defaultValue": "undefined",
        "description": "Inline label linked to the native <input type=\"checkbox\" role=\"switch\">."
      },
      {
        "name": "onLabel / offLabel",
        "type": "React.ReactNode",
        "defaultValue": "'ON' / 'OFF'",
        "description": "Configurable visual track glyphs (marked aria-hidden=\"true\" so role=\"switch\" never double-announces English text)."
      },
      {
        "name": "onCheckedChange",
        "type": "(checked: boolean) => void",
        "defaultValue": "undefined",
        "description": "Callback fired with the boolean checked state on toggle."
      },
      {
        "name": "density",
        "type": "'comfortable' | 'compact'",
        "defaultValue": "'comfortable'",
        "description": "Selects 54×28px (2.5px border) or 48×24px (1.5px border) exposure-sheet cell dimensions."
      },
      {
        "name": "hint / error",
        "type": "React.ReactNode",
        "defaultValue": "undefined",
        "description": "Optional helper text and role=\"alert\" validation message chained into aria-describedby."
      },
      {
        "name": "fieldClassName",
        "type": "string",
        "defaultValue": "undefined",
        "description": "Additional class names applied to the outer .f12-field wrapper."
      }
    ],
    "stateBehavior": "Supports controlled (checked + onCheckedChange/onChange) and uncontrolled (defaultChecked) state on a native <input type=\"checkbox\" role=\"switch\">.",
    "a11yNotes": [
      "Built on a native <input type=\"checkbox\" role=\"switch\"> so FormData, form.reset(), required, form=, label clicks, and react-hook-form register() work out of the box.",
      "Uses logical inset-inline-start positioning so the thumb moves in the reverse direction under dir=\"rtl\"."
    ],
    "keyboardNotes": [
      "Focusable via Tab and toggled via Spacebar; announces role=\"switch\" and aria-checked state without double-announcing the decorative ON/OFF track glyphs."
    ],
    "themeBehavior": "Inverts track from --f-panel to --f-ink when checked, with a --f-panel thumb and 3px solid --f-ink focus-visible ring.",
    "responsiveBehavior": "Uses logical inset-inline-start positioning for automatic RTL flip and maintains >= 24px height in compact density.",
    "grammarNotes": [
      "When checked, the track inverts to --f-ink with a --f-panel thumb that steps across the track in 3 held poses (steps(3, end)) in stepped motion mode."
    ],
    "commonErrors": [
      "Removing aria-hidden=\"true\" from custom track glyphs, causing screen readers to announce \"ON\" or \"OFF\" alongside the native switch state."
    ],
    "usageTemplate": "import { Switch } from '@/components/frame12';\n\nexport function ReplaySwitch() {\n  return (\n    <Switch\n      label=\"Auto-replay failed webhook deliveries\"\n      hint=\"Retries up to 3 times with exponential backoff\"\n      defaultChecked\n    />\n  );\n}"
  },
  {
    "slug": "tabs",
    "title": "Tabs",
    "category": "Controls",
    "summary": "WAI-ARIA tablist, tab, and tabpanel primitives with roving focus, automatic or manual keyboard activation, and default quiet panel context.",
    "registryUrl": "https://frame12.dev/r/tabs.json",
    "sourceFile": "registry/ui/tabs.tsx",
    "whenToUse": [
      "To organize distinct content sections or settings categories (e.g., Profile, Workspace, Notifications, Danger Zone) into separate tabpanels."
    ],
    "whenNotToUse": [
      "Do not use Tabs to filter a single chart or switch date ranges (7D / 30D / 90D) on the same panel; use <SegmentedControl> instead."
    ],
    "props": [
      {
        "name": "value / defaultValue",
        "type": "string",
        "defaultValue": "''",
        "description": "Controlled or uncontrolled active tab value."
      },
      {
        "name": "onValueChange",
        "type": "(value: string) => void",
        "defaultValue": "undefined",
        "description": "Callback invoked when the active tab changes."
      },
      {
        "name": "orientation",
        "type": "'horizontal' | 'vertical'",
        "defaultValue": "'horizontal'",
        "description": "Tab list orientation (vertical stacks automatically below 760px container width)."
      },
      {
        "name": "density",
        "type": "'comfortable' | 'compact'",
        "defaultValue": "'comfortable'",
        "description": "Adjusts tab trigger padding and rule weight (2.5px vs 1.5px)."
      },
      {
        "name": "activationMode",
        "type": "'automatic' | 'manual'",
        "defaultValue": "'automatic'",
        "description": "Whether arrow keys activate the focused tab immediately (automatic) or only move focus until Enter/Space (manual)."
      },
      {
        "name": "idPrefix",
        "type": "string",
        "defaultValue": "useId()",
        "description": "Deterministic prefix for generated tab (${idPrefix}-tab-${value}) and tabpanel (${idPrefix}-panel-${value}) IDs."
      },
      {
        "name": "ariaLabel / forceMount",
        "type": "string / boolean",
        "defaultValue": "undefined / false",
        "description": "Subcomponent props on TabsListProps (accessible tablist label) and TabsContentProps (keep inactive panel mounted in DOM)."
      }
    ],
    "stateBehavior": "Supports controlled (value + onValueChange) and uncontrolled (defaultValue) state. Automatically provides a Quiet panel default context inside <TabsContent> so switching tabs never renumbers sheet-level C-01..C-0n cuts.",
    "a11yNotes": [
      "Implements WAI-ARIA role=\"tablist\", role=\"tab\" (aria-selected, aria-controls), and role=\"tabpanel\" (aria-labelledby) with roving tabIndex and Home/End/Arrow key support.",
      "Inactive TabsContent elements remain mounted with hidden so aria-controls always references a valid DOM ID. Always pass defaultValue (or value) when wrapping TabsTrigger in custom components so the initial panel renders visibly in SSR HTML before hydration."
    ],
    "keyboardNotes": [
      "Implements roving tabIndex on role=\"tab\" triggers with ArrowLeft/ArrowRight (horizontal), ArrowUp/ArrowDown (vertical), Home, and End navigation, plus automatic or manual activationMode."
    ],
    "themeBehavior": "Active TabsTrigger inverts to --f-ink background with --f-sheet text and a --f-marker bottom indicator rule.",
    "responsiveBehavior": "Horizontal tab lists scroll or wrap cleanly without horizontal page overflow, and vertical tab lists stack above content below 760px.",
    "grammarNotes": [
      "Use <Tabs> when switching between distinct content panels (e.g., Routing vs. Retries vs. Signing Keys); use <SegmentedControl> when changing the view or time range of the same content.",
      "Panels inside <TabsContent> default to variant=\"quiet\" and suppress CSS autoCut counters so switching tabs never shifts C-01/C-02 cut numbers on the sheet."
    ],
    "commonErrors": [
      "Omitting defaultValue on uncontrolled <Tabs> when wrapping <TabsTrigger> in custom components, which prevents SSR from knowing which panel is initially active.",
      "Forcing expressive auto-numbered panels inside <TabsContent>, which would cause sheet cut numbers to change when tabs switch."
    ],
    "usageTemplate": "import { Tabs, TabsList, TabsTrigger, TabsContent, Panel, Input } from '@/components/frame12';\n\nexport function SettingsTabs() {\n  return (\n    <Tabs defaultValue=\"routing\">\n      <TabsList ariaLabel=\"Pipeline configuration\">\n        <TabsTrigger value=\"routing\">Routing</TabsTrigger>\n        <TabsTrigger value=\"retries\">Retries</TabsTrigger>\n      </TabsList>\n      <TabsContent value=\"routing\">\n        <Panel label=\"Routing configuration\">\n          <Input label=\"Primary endpoint\" defaultValue=\"https://api.acme.dev/hooks\" />\n        </Panel>\n      </TabsContent>\n      <TabsContent value=\"retries\">\n        <Panel label=\"Retry configuration\">\n          <Input label=\"Max retry attempts\" defaultValue=\"5\" />\n        </Panel>\n      </TabsContent>\n    </Tabs>\n  );\n}"
  },
  {
    "slug": "badge",
    "title": "Badge",
    "category": "Controls",
    "summary": "Bordered marker-yellow badge with ink text and an optional 14-ray SVG impact burst drawn for two frames.",
    "registryUrl": "https://frame12.dev/r/badge.json",
    "sourceFile": "registry/ui/badge.tsx",
    "whenToUse": [
      "To highlight a focal leader callout (with pop and burst) or a bordered semantic status stamp (status=\"info\" | \"success\" | \"warning\" | \"danger\")."
    ],
    "whenNotToUse": [
      "Do not use Badge with burst={true} on every row of a dense table; use <Tag> for compact inline row statuses.",
      "Do not invent green, red, or amber hex colors for status badges; pass the semantic status prop instead."
    ],
    "props": [
      {
        "name": "status",
        "type": "'neutral' | 'info' | 'success' | 'warning' | 'danger'",
        "defaultValue": "undefined",
        "description": "Non-color semantic status combining [i]/[+]/[!]/[×] glyph prefix, screen-reader status announcement, border weight/style, and fill inversion."
      },
      {
        "name": "glyph",
        "type": "string | false",
        "defaultValue": "undefined",
        "description": "Overrides or suppresses (false) the automatic status glyph prefix."
      },
      {
        "name": "srLabel",
        "type": "string | false",
        "defaultValue": "undefined",
        "description": "Overrides or suppresses (false) the screen-reader status announcement prefix (e.g., for localized labels)."
      },
      {
        "name": "pop",
        "type": "boolean",
        "defaultValue": "false",
        "description": "Triggers the 4-pose popStep animation and 2-frame impact burst when true."
      },
      {
        "name": "burst",
        "type": "boolean",
        "defaultValue": "true",
        "description": "Renders the decorative 14-line radial SVG Burst behind the badge."
      }
    ],
    "stateBehavior": "Stateless inline callout; passing pop={changed} (from useChanged(key)) triggers the 4-pose stepped pop animation only after user interaction.",
    "a11yNotes": [
      "The radial SVG impact burst is marked aria-hidden=\"true\".",
      "Always renders --f-marker-ink text over --f-marker background."
    ],
    "keyboardNotes": [
      "Non-interactive status indicator; decorative SVG burst rays carry aria-hidden=\"true\" while semantic status prefixes are announced via .f12-sr-only."
    ],
    "themeBehavior": "Default marker badge pairs --f-marker with --f-marker-ink; semantic statuses use ink/paper inversion and diagonal hatch patterns with >= 14.6:1 contrast in both themes.",
    "responsiveBehavior": "Inline-flex layout with white-space: nowrap that scales cleanly inside headers, metrics, and bar lists.",
    "grammarNotes": [
      "Pair pop={changed} with useChanged(key) so the impact burst fires only on user-triggered changes, never on initial page load."
    ],
    "commonErrors": [
      "Hardcoding pop={true} on initial render, which violates the FRAME/12 rule that sheets render complete at rest on load."
    ],
    "usageTemplate": "import { Badge } from '@/components/frame12';\n\nexport function LeaderBadge() {\n  return <Badge pop burst>Top performer</Badge>;\n}"
  },
  {
    "slug": "tag",
    "title": "Tag",
    "category": "Controls",
    "summary": "Flat inline highlighter strip (--f-marker background under --f-marker-ink uppercase monospace text).",
    "registryUrl": "https://frame12.dev/r/tag.json",
    "sourceFile": "registry/ui/tag.tsx",
    "whenToUse": [
      "For compact inline metadata labels, table cell status chips (status=\"success\" | \"warning\" | \"danger\"), and eyebrow markers."
    ],
    "whenNotToUse": [
      "Do not use Tag as an interactive filter button; use <Button size=\"sm\"> or <SegmentedControl> for clickable controls."
    ],
    "props": [
      {
        "name": "status",
        "type": "'neutral' | 'info' | 'success' | 'warning' | 'danger'",
        "defaultValue": "undefined",
        "description": "Non-color semantic status combining [i]/[+]/[!]/[×] glyph prefix, screen-reader status announcement, border weight/style, and fill inversion."
      },
      {
        "name": "glyph",
        "type": "string | false",
        "defaultValue": "undefined",
        "description": "Overrides or suppresses (false) the automatic status glyph prefix."
      },
      {
        "name": "srLabel",
        "type": "string | false",
        "defaultValue": "undefined",
        "description": "Overrides or suppresses (false) the screen-reader status announcement prefix (e.g., for localized labels)."
      },
      {
        "name": "children",
        "type": "React.ReactNode",
        "defaultValue": "required",
        "description": "Short metadata label rendered inside the marker strip."
      }
    ],
    "stateBehavior": "Stateless inline metadata marker supporting default highlighter yellow or non-color semantic status variants.",
    "a11yNotes": [
      "Maintains 14.8:1 contrast ratio in both light and dark themes because --f-marker-ink stays dark ink."
    ],
    "keyboardNotes": [
      "Non-interactive inline text element; includes a visually hidden .f12-sr-only status prefix (\"Info: \", \"Success: \", \"Warning: \", \"Error: \") when status is set."
    ],
    "themeBehavior": "Default Tag uses --f-marker background with --f-marker-ink text; status variants use --f-panel, --f-ink, and diagonal --f-tone hatch fills.",
    "responsiveBehavior": "Compact inline strip that fits inside dense compact Table cells without clipping.",
    "grammarNotes": [
      "Marker yellow flags metadata and status callouts; it is never used as a text color or line stroke."
    ],
    "commonErrors": [
      "Using --f-marker as a text color on a dark background instead of using <Tag> with --f-marker background and --f-marker-ink text."
    ],
    "usageTemplate": "import { Tag } from '@/components/frame12';\n\nexport function EyebrowTag() {\n  return <Tag>Example data</Tag>;\n}"
  },
  {
    "slug": "alert",
    "title": "Alert & Notice",
    "category": "Controls",
    "summary": "Inline non-color semantic status notices and alerts with restrained ARIA live regions, orthographic status glyphs, and optional dismiss control.",
    "registryUrl": "https://frame12.dev/r/alert.json",
    "sourceFile": "registry/ui/alert.tsx",
    "whenToUse": [
      "Use <Notice> (live=\"off\", role=\"note\") for static page-load operational callouts, key-rotation notices, and sandbox disclaimers.",
      "Use <Alert> for dynamic validation summaries, degraded service warnings, and critical failure banners (status=\"danger\" defaults to role=\"alert\")."
    ],
    "whenNotToUse": [
      "Do not use Alert with live=\"assertive\" for static informational banners rendered on initial page load; use <Notice> so screen readers are not interrupted.",
      "Do not use Alert for ephemeral action confirmations that should auto-dismiss; use <Toast> instead."
    ],
    "props": [
      {
        "name": "status",
        "type": "'neutral' | 'info' | 'success' | 'warning' | 'danger'",
        "defaultValue": "'info'",
        "description": "Non-color semantic status combining [i]/[+]/[!]/[×] glyph prefix, screen-reader prefix, and border/rail treatment."
      },
      {
        "name": "title",
        "type": "React.ReactNode",
        "defaultValue": "undefined",
        "description": "Optional inline title or use <AlertTitle> compound subcomponent."
      },
      {
        "name": "live",
        "type": "'off' | 'polite' | 'assertive'",
        "defaultValue": "Notice: 'off' | Alert: 'assertive' on danger, 'off' otherwise",
        "description": "Controls ARIA live-region behavior: off -> role=\"note\", polite -> role=\"status\", assertive -> role=\"alert\"."
      },
      {
        "name": "onDismiss",
        "type": "() => void",
        "defaultValue": "undefined",
        "description": "Renders a 24×24px minimum dismiss button when provided."
      },
      {
        "name": "description / actions",
        "type": "React.ReactNode",
        "defaultValue": "undefined",
        "description": "Optional description body and action control slot (or use <AlertDescription> and <AlertActions>)."
      },
      {
        "name": "glyph / srLabel",
        "type": "string | false",
        "defaultValue": "undefined",
        "description": "Overrides or suppresses (false) the automatic status glyph ([i]/[+]/[!]/[×]) and screen-reader status prefix."
      },
      {
        "name": "density / dismissLabel",
        "type": "'comfortable' | 'compact' / string",
        "defaultValue": "'comfortable' / 'Dismiss notice'",
        "description": "Adjusts banner padding/border weight and customizes the aria-label on the optional dismiss button."
      },
      {
        "name": "NoticeProps / AlertTitleProps / AlertDescriptionProps / AlertActionsProps",
        "type": "Subcomponent Prop Aliases",
        "defaultValue": "HTMLDivElement attributes",
        "description": "Exported prop type aliases for <Notice>, <AlertTitle>, <AlertDescription>, and <AlertActions>."
      }
    ],
    "stateBehavior": "Stateless banner component with optional onDismiss callback to render a 24×24px close button.",
    "a11yNotes": [
      "Notice defaults to role=\"note\" so static page load notices never spam screen-reader live regions.",
      "Alert defaults to role=\"alert\" only when status=\"danger\" (or live=\"assertive\"), and role=\"status\" when live=\"polite\"."
    ],
    "keyboardNotes": [
      "Action buttons and the optional dismiss button are reachable in natural DOM Tab order with 3px solid --f-ink focus-visible outlines."
    ],
    "themeBehavior": "Maintains --f-panel interior surface contrast while encoding status via border style, inline-start rail weight, diagonal hatch (warning), or inverted header stamp (danger).",
    "responsiveBehavior": "Wraps title, description, and action buttons cleanly down to 320px without horizontal overflow.",
    "grammarNotes": [
      "Preserves --f-panel card contrast for inner text and action buttons while encoding status via border style, inline-start rail, and glyph stamp."
    ],
    "commonErrors": [
      "Rendering multiple role=\"alert\" banners on initial page mount instead of using <Notice> (role=\"note\") for static callouts."
    ],
    "usageTemplate": "import { Alert, Notice } from '@/components/frame12';\n\nexport function WebhookNotices() {\n  return (\n    <div className=\"f12-stack-pair\">\n      <Notice status=\"info\" title=\"Dual-key rotation window\">\n        Both webhook signing keys remain valid for 24 hours.\n      </Notice>\n      <Alert status=\"danger\" title=\"Dead-letter queue threshold exceeded\">\n        14 checkout events require manual replay.\n      </Alert>\n    </div>\n  );\n}"
  },
  {
    "slug": "toast",
    "title": "Toast",
    "category": "Controls",
    "summary": "Bounded exposure-sheet notification stack with hover/focus timer pause, Escape dismissal, +N QUEUED indicator, and stepped 12fps entrance.",
    "registryUrl": "https://frame12.dev/r/toast.json",
    "sourceFile": "registry/ui/toast.tsx",
    "whenToUse": [
      "For ephemeral, non-blocking feedback after user actions such as saving settings, rotating an API key, replaying a webhook, or copying an install command."
    ],
    "whenNotToUse": [
      "Do not use Toast for persistent page-level errors or form validation errors; use <Alert> or <Field error=\"...\"> instead.",
      "Do not import external toast libraries (sonner, react-hot-toast)."
    ],
    "props": [
      {
        "name": "maxVisible",
        "type": "number",
        "defaultValue": "3",
        "description": "Maximum simultaneously visible toasts before showing the +N QUEUED indicator."
      },
      {
        "name": "duration",
        "type": "number",
        "defaultValue": "5000",
        "description": "Auto-dismiss timeout in milliseconds (0 disables auto-dismiss; pauses on hover or focus-within)."
      },
      {
        "name": "status",
        "type": "'neutral' | 'info' | 'success' | 'warning' | 'danger'",
        "defaultValue": "'neutral'",
        "description": "Non-color semantic status with [i]/[+]/[!]/[×] glyph and deduplicated screen-reader prefix."
      },
      {
        "name": "title / description / action",
        "type": "React.ReactNode",
        "defaultValue": "undefined",
        "description": "Headline, supporting body text, and optional interactive action button or ToastActionDescriptor."
      },
      {
        "name": "glyph / srLabel",
        "type": "string | false",
        "defaultValue": "undefined",
        "description": "Overrides or suppresses (false) the status glyph stamp and screen-reader live-region announcement prefix."
      },
      {
        "name": "dismissible / dismissLabel / onDismiss",
        "type": "boolean / string / () => void",
        "defaultValue": "true / 'Dismiss notification'",
        "description": "Controls whether the close button is rendered, its accessible label, and the callback fired on dismissal."
      },
      {
        "name": "density / paused / resetKey",
        "type": "'comfortable' | 'compact' / boolean / number",
        "defaultValue": "'comfortable' / false / 0",
        "description": "Controls card padding/border weight, timer pause state, and timer reset counter on in-place toast updates."
      },
      {
        "name": "defaultDuration / label / renderViewport / hotkey / altText / ToastTitleProps / ToastDescriptionProps / ToastCloseProps",
        "type": "number / string / boolean / string[] / string / Subcomponent Prop Aliases",
        "defaultValue": "5000 / 'Notifications' / true / ['F8'] / undefined",
        "description": "Subcomponent props on ToastProviderProps, ToastViewportProps, ToastActionProps, and exported ToastTitle/Description/Close prop aliases."
      }
    ],
    "stateBehavior": "Managed via <ToastProvider> and useToast() (or standalone <Toast>). Queues notifications beyond maxVisible (default 3) with a +N QUEUED badge, pauses timers on pointer hover, focus-within, or backgrounded document tabs, and portals into any active modal <dialog[open]> top layer.",
    "a11yNotes": [
      "Announces notifications through shared .f12-sr-only live regions (aria-live=\"assertive\" for status=\"danger\" and aria-live=\"polite\" for all other statuses, portaled alongside ToastViewport into any open modal <dialog>); individual <Toast> cards are non-live by default unless an explicit role or aria-live prop is passed.",
      "Pauses auto-dismiss timers while hovered or focused, and dismisses the newest visible toast on Escape."
    ],
    "keyboardNotes": [
      "Pressing F8 jumps focus to the active ToastViewport; pressing Escape while focused inside the viewport dismisses the newest visible toast."
    ],
    "themeBehavior": "Renders --f-panel surface with 2.5px --f-rule border and hard 4px 4px 0 var(--f-rule) offset shadow, inheriting light/dark theme tokens even when portaled into a modal <dialog>.",
    "responsiveBehavior": "Anchors to bottom-right on desktop and spans full viewport width (inset-inline: 12px) on narrow mobile screens.",
    "grammarNotes": [
      "Enters on twos (steps(3, end)) with a hard ink offset shadow and zero opacity blur."
    ],
    "commonErrors": [
      "Calling useToast() outside a <ToastProvider> without a fallback (use useOptionalToast() in shared components that may render with or without a provider)."
    ],
    "usageTemplate": "import { ToastProvider, useToast, Button } from '@/components/frame12';\n\nfunction ReplayTrigger() {\n  const { toast } = useToast();\n  return (\n    <Button\n      variant=\"secondary\"\n      onClick={() =>\n        toast({\n          status: 'success',\n          title: 'Webhook replayed',\n          description: 'Dispatched cut C-04 to primary endpoint.',\n        })\n      }\n    >\n      Trigger Toast\n    </Button>\n  );\n}\n\nexport function ToastDemo() {\n  return (\n    <ToastProvider>\n      <ReplayTrigger />\n    </ToastProvider>\n  );\n}"
  },
  {
    "slug": "skeleton",
    "title": "Skeleton",
    "category": "Controls",
    "summary": "Zero-CLS loading placeholder using rotated screentone dot fills (var(--f-tone)) and stepped 12fps opacity cadence.",
    "registryUrl": "https://frame12.dev/r/skeleton.json",
    "sourceFile": "registry/ui/skeleton.tsx",
    "whenToUse": [
      "To represent loading states for metrics (variant=\"metric\"), text blocks (<SkeletonText>), or panels (variant=\"panel\") while preserving exact populated dimensions (zero CLS)."
    ],
    "whenNotToUse": [
      "Do not use CSS linear-gradient shimmer animations; FRAME/12 skeletons use rotated screentone dot fills (--f-tone) stepped at 12fps."
    ],
    "props": [
      {
        "name": "variant",
        "type": "'block' | 'line' | 'circle' | 'metric' | 'panel'",
        "defaultValue": "'block'",
        "description": "Selects pre-sized geometry matching text lines, avatars, KPI metrics, or full panels."
      },
      {
        "name": "label",
        "type": "string",
        "defaultValue": "undefined",
        "description": "When omitted, renders aria-hidden=\"true\"; when provided, renders role=\"status\" aria-busy=\"true\" with a .f12-sr-only label."
      },
      {
        "name": "animated",
        "type": "boolean",
        "defaultValue": "true",
        "description": "Enables the 4-step 12fps opacity pulse (automatically disabled under prefers-reduced-motion: reduce)."
      },
      {
        "name": "width / height",
        "type": "number | string",
        "defaultValue": "variant default",
        "description": "Explicit pixel or CSS dimension overrides so loading placeholders match populated geometry with zero CLS."
      },
      {
        "name": "density",
        "type": "'comfortable' | 'compact'",
        "defaultValue": "'comfortable'",
        "description": "Matches comfortable or compact row and panel heights."
      },
      {
        "name": "lines / lastLineWidth",
        "type": "number / number | string",
        "defaultValue": "3 / '68%'",
        "description": "Subcomponent props on SkeletonTextProps controlling line count and trailing line width."
      }
    ],
    "stateBehavior": "Stateless placeholder; defaults to aria-hidden=\"true\" unless a descriptive label prop is provided on the primary loading container.",
    "a11yNotes": [
      "Decorative skeletons default to aria-hidden=\"true\" so screen readers are not flooded; pass label=\"Loading metrics\" on the container skeleton for a single polite status announcement."
    ],
    "keyboardNotes": [
      "Non-interactive placeholder skipped by keyboard Tab navigation."
    ],
    "themeBehavior": "Uses --f-tone halftone dots and --f-rule dashed borders that automatically adapt between light paper and dark ink themes.",
    "responsiveBehavior": "Accepts fluid percentage or pixel width/height overrides to match responsive panel and table layouts.",
    "grammarNotes": [
      "Uses --f-tone halftone dots framed by a dashed --f-rule border instead of blurred shimmer gradients."
    ],
    "commonErrors": [
      "Passing label=\"...\" on every individual skeleton line inside a loading panel, causing screen readers to announce dozens of busy regions instead of a single container label."
    ],
    "usageTemplate": "import { Skeleton, SkeletonText } from '@/components/frame12';\n\nexport function LoadingPanel() {\n  return (\n    <div className=\"f12-stack-pair\">\n      <Skeleton variant=\"metric\" label=\"Loading revenue metric\" />\n      <SkeletonText lines={3} />\n    </div>\n  );\n}"
  },
  {
    "slug": "empty-state",
    "title": "EmptyState",
    "category": "Controls",
    "summary": "Structured zero-data and filtered-empty state with registration-mark glyph ([ ∅ ]), monospace code badge, and primary/secondary action slots.",
    "registryUrl": "https://frame12.dev/r/empty-state.json",
    "sourceFile": "registry/ui/empty-state.tsx",
    "whenToUse": [
      "When a table, search query, or dataset returns zero items (e.g., filtered empty ledger or brand-new workspace state) and needs a clear recovery action."
    ],
    "whenNotToUse": [
      "Do not render a blank panel or a single unstyled paragraph when a filter matches zero rows; always provide an EmptyState with a reset/recovery button."
    ],
    "props": [
      {
        "name": "title",
        "type": "React.ReactNode",
        "defaultValue": "undefined",
        "description": "Headline title for the empty state (or use <EmptyStateTitle>)."
      },
      {
        "name": "description",
        "type": "React.ReactNode",
        "defaultValue": "undefined",
        "description": "Supporting explanation or recovery guidance (or use <EmptyStateDescription>)."
      },
      {
        "name": "code",
        "type": "string",
        "defaultValue": "undefined",
        "description": "Optional uppercase monospace status code stamp (e.g., \"0 MATCHING ROWS\")."
      },
      {
        "name": "variant",
        "type": "'dashed' | 'quiet'",
        "defaultValue": "'dashed'",
        "description": "Selects a 2px dashed ink frame or a quiet 1px exposure-sheet frame."
      },
      {
        "name": "icon",
        "type": "React.ReactNode | false",
        "defaultValue": "'[ ∅ ]'",
        "description": "Custom registration glyph or false to hide the decorative stamp."
      },
      {
        "name": "action / secondaryAction",
        "type": "React.ReactNode",
        "defaultValue": "undefined",
        "description": "Primary and secondary recovery action slots (e.g., Reset filters or Restore live fixture)."
      },
      {
        "name": "density / headingLevel",
        "type": "'comfortable' | 'compact' / 'h2' | 'h3' | 'h4' | 'div'",
        "defaultValue": "'comfortable' / 'h3'",
        "description": "Controls frame padding and semantic heading tag for document outline hierarchy."
      },
      {
        "name": "as / EmptyStateIconProps / EmptyStateDescriptionProps / EmptyStateActionsProps",
        "type": "'h2' | 'h3' | 'h4' | 'div' / Subcomponent Prop Aliases",
        "defaultValue": "'h3'",
        "description": "Subcomponent prop on EmptyStateTitleProps (as) and exported EmptyState compound subcomponent prop aliases."
      }
    ],
    "stateBehavior": "Stateless presentation component supporting both shorthand props (title, description, code, action, secondaryAction) and compound subcomponents.",
    "a11yNotes": [
      "Default [ ∅ ] registration glyph is marked aria-hidden=\"true\" while title, description, and action buttons remain in natural reading order."
    ],
    "keyboardNotes": [
      "Primary and secondary action buttons follow natural reading order immediately after the description."
    ],
    "themeBehavior": "Frames the [ ∅ ] registration glyph and copy inside a 2px dashed --f-rule (or 1px quiet) container on --f-panel.",
    "responsiveBehavior": "Centers copy and wraps action buttons cleanly at 390px mobile widths.",
    "grammarNotes": [
      "Centers an inked registration stamp and clear recovery actions inside a dashed storyboard frame."
    ],
    "commonErrors": [
      "Omitting the action slot on filtered-empty states, leaving users without a one-click way to clear active search or select filters."
    ],
    "usageTemplate": "import { EmptyState, Button } from '@/components/frame12';\n\nexport function ZeroLedger({ onReset }: { onReset: () => void }) {\n  return (\n    <EmptyState\n      code=\"0 MATCHING ROWS\"\n      title=\"No matching interventions\"\n      description=\"Clear the search filter or broaden the exposure window.\"\n      action={<Button variant=\"secondary\" size=\"sm\" onClick={onReset}>Reset filters</Button>}\n    />\n  );\n}"
  },
  {
    "slug": "breadcrumb",
    "title": "Breadcrumb",
    "category": "Controls",
    "summary": "Accessible hierarchical path navigation (<nav aria-label=\"Breadcrumb\"> + <ol>) with monospace separators, React 18/19 asChild links, and ellipsis collapse.",
    "registryUrl": "https://frame12.dev/r/breadcrumb.json",
    "sourceFile": "registry/ui/breadcrumb.tsx",
    "whenToUse": [
      "At the top of application blocks, multi-level settings screens, or drill-down ledgers to show hierarchical location and jump back to parent views."
    ],
    "whenNotToUse": [
      "Do not use Breadcrumb for primary site-wide navigation menus or tab switching across peer sections."
    ],
    "props": [
      {
        "name": "items",
        "type": "BreadcrumbEntry[]",
        "defaultValue": "undefined",
        "description": "Optional shorthand array of { label, href?, current?, onClick? } items."
      },
      {
        "name": "separator",
        "type": "React.ReactNode",
        "defaultValue": "'/'",
        "description": "Custom visual separator rendered between breadcrumb items with aria-hidden=\"true\"."
      },
      {
        "name": "ariaLabel",
        "type": "string",
        "defaultValue": "'Breadcrumb'",
        "description": "Accessible landmark label for the outer <nav> element."
      },
      {
        "name": "density",
        "type": "'comfortable' | 'compact'",
        "defaultValue": "'comfortable'",
        "description": "Adjusts font scale and spacing while keeping 24×24px minimum interactive link targets."
      },
      {
        "name": "asChild / aria-current / BreadcrumbListProps / BreadcrumbItemProps / BreadcrumbSeparatorProps / BreadcrumbEllipsisProps",
        "type": "boolean / React.AriaAttributes['aria-current'] / Subcomponent Prop Aliases",
        "defaultValue": "false / 'page'",
        "description": "Subcomponent props on BreadcrumbLinkProps (asChild), BreadcrumbPageProps (aria-current), and compound list/item/separator/ellipsis prop aliases."
      }
    ],
    "stateBehavior": "Stateless navigation landmark (<nav aria-label=\"Breadcrumb\">) supporting shorthand items array or compound BreadcrumbList / BreadcrumbItem / BreadcrumbLink / BreadcrumbPage children.",
    "a11yNotes": [
      "Marks the active page with aria-current=\"page\" and hides separators with role=\"presentation\" aria-hidden=\"true\".",
      "BreadcrumbEllipsis keeps its .f12-sr-only label outside the aria-hidden glyph so screen readers announce collapsed levels."
    ],
    "keyboardNotes": [
      "All ancestor BreadcrumbLink items are standard keyboard-focusable links (or buttons when onClick is used without href); the active BreadcrumbPage carries aria-current=\"page\"."
    ],
    "themeBehavior": "Renders ancestor links in --f-ink-2 with --f-ink hover/current states and --f-marker focus rings.",
    "responsiveBehavior": "Wraps path items across multiple lines on narrow 390px viewports while keeping >= 24×24px interactive hit targets.",
    "grammarNotes": [
      "Uses uppercase monospace path tokens with 24×24px minimum interactive link targets."
    ],
    "commonErrors": [
      "Making the current page breadcrumb item a self-referential link instead of marking it current: true (<BreadcrumbPage>)."
    ],
    "usageTemplate": "import { Breadcrumb } from '@/components/frame12';\n\nexport function SheetPath() {\n  return (\n    <Breadcrumb\n      items={[\n        { label: 'Workspace', href: '#workspace' },\n        { label: 'Sheets', href: '#sheets' },\n        { label: 'Cut C-04 Ledger', current: true },\n      ]}\n    />\n  );\n}"
  },
  {
    "slug": "pagination",
    "title": "Pagination",
    "category": "Controls",
    "summary": "Deterministic page navigation (<nav aria-label=\"Pagination\">) with ink-inverted aria-current=\"page\" buttons, ellipsis range builder, and exposure-sheet summary.",
    "registryUrl": "https://frame12.dev/r/pagination.json",
    "sourceFile": "registry/ui/pagination.tsx",
    "whenToUse": [
      "Below multi-page operational tables and request log ledgers to navigate deterministic page ranges with an exposure-sheet summary (PAGE X OF Y)."
    ],
    "whenNotToUse": [
      "Do not use Pagination for small lists under 10 rows that fit comfortably in a single quiet panel."
    ],
    "props": [
      {
        "name": "page / totalPages",
        "type": "number",
        "defaultValue": "undefined",
        "description": "Current 1-indexed page and total page count for data-driven rendering."
      },
      {
        "name": "onPageChange",
        "type": "(page: number) => void",
        "defaultValue": "undefined",
        "description": "Callback fired when a page number or Prev/Next button is activated."
      },
      {
        "name": "showSummary",
        "type": "boolean",
        "defaultValue": "false",
        "description": "Renders the monospace PAGE X OF Y exposure-sheet counter alongside the page buttons."
      },
      {
        "name": "density",
        "type": "'comfortable' | 'compact'",
        "defaultValue": "'comfortable'",
        "description": "Switches to 1.5px rules and compact padding while preserving >= 24×24px targets."
      },
      {
        "name": "defaultPage / siblingCount / boundaryCount",
        "type": "number",
        "defaultValue": "1 / 1 / 1",
        "description": "Uncontrolled initial page and number of sibling/boundary page buttons shown around the active page before ellipsis collapse."
      },
      {
        "name": "totalItems / pageSize / formatSummary",
        "type": "number / number / (details: PaginationSummaryDetails) => React.ReactNode",
        "defaultValue": "undefined",
        "description": "Optional item count metadata and custom formatter for the exposure-sheet range summary."
      },
      {
        "name": "ariaLabel / previousLabel / nextLabel / ellipsisLabel",
        "type": "string / React.ReactNode",
        "defaultValue": "'Pagination' / '← PREV' / 'NEXT →' / 'More pages'",
        "description": "Accessible landmark label and customizable button/ellipsis labels."
      },
      {
        "name": "getItemAriaLabel / getItemHref",
        "type": "function",
        "defaultValue": "undefined",
        "description": "Optional callbacks for custom aria-label strings and anchor href generation on page links."
      },
      {
        "name": "type / disabled / isActive / onClick / PaginationContentProps / PaginationItemProps / PaginationPreviousProps / PaginationNextProps / PaginationEllipsisProps",
        "type": "'button' | 'submit' | 'reset' / boolean / boolean / React.MouseEventHandler<HTMLElement> / Subcomponent Prop Aliases",
        "defaultValue": "'button' / false / false / undefined",
        "description": "Subcomponent props on PaginationLinkProps and exported compound pagination prop aliases."
      }
    ],
    "stateBehavior": "Supports controlled (page + onPageChange) and uncontrolled (defaultPage) modes, computing deterministic page + ellipsis ranges via buildPaginationRange().",
    "a11yNotes": [
      "Sets aria-current=\"page\" on the active page control and disables Previous/Next at range boundaries.",
      "PaginationEllipsis exposes a .f12-sr-only \"More pages\" label outside its aria-hidden visual glyph."
    ],
    "keyboardNotes": [
      "All page buttons and Prev/Next controls are native <button> (or <a> when getItemHref is provided) elements with aria-current=\"page\" on the active page."
    ],
    "themeBehavior": "Active page button inverts to --f-ink background with --f-sheet text; disabled Prev/Next controls use dashed --f-rule borders.",
    "responsiveBehavior": "Wraps summary and page controls cleanly on 390px mobile screens while maintaining >= 24×24px button targets.",
    "grammarNotes": [
      "Active page control inverts to --f-ink background with --f-sheet text for high-contrast storyboard clarity."
    ],
    "commonErrors": [
      "Forgetting to clamp or reset the active page to 1 when a user changes a search filter that reduces totalPages."
    ],
    "usageTemplate": "import { Pagination } from '@/components/frame12';\n\nexport function LedgerPagination({ page, onChange }: { page: number; onChange: (p: number) => void }) {\n  return (\n    <Pagination\n      page={page}\n      totalPages={12}\n      onPageChange={onChange}\n      showSummary\n    />\n  );\n}"
  },
  {
    "slug": "metric",
    "title": "Metric",
    "category": "Data & Charts",
    "summary": "Headline KPI display with stepped count-up on twos, screen-reader polite live region, directional marker delta, and optional ToneSpark slot.",
    "registryUrl": "https://frame12.dev/r/metric.json",
    "sourceFile": "registry/ui/metric.tsx",
    "whenToUse": [
      "In expressive mode (default, optionally with big={true}) for hero C-01/C-02/C-03 storyboard KPIs that count up on twos.",
      "In quiet mode (variant=\"quiet\") for compact 22px tabular monospace operational posture readouts and summary strip cells."
    ],
    "whenNotToUse": [
      "Do not use expressive big={true} metrics inside dense 6-column summary strips; use variant=\"quiet\" so headline hierarchy stays clear."
    ],
    "props": [
      {
        "name": "label",
        "type": "string",
        "defaultValue": "required",
        "description": "Uppercase monospace metric heading (.f12-m-label)."
      },
      {
        "name": "value",
        "type": "number",
        "defaultValue": "required",
        "description": "Numeric metric value interpolated on twos via useCountUp."
      },
      {
        "name": "format",
        "type": "(value: number) => string",
        "defaultValue": "fmtCurrency",
        "description": "Formatter function converting numeric values to display strings."
      },
      {
        "name": "delta",
        "type": "number",
        "defaultValue": "undefined",
        "description": "Optional relative change (percentage or percentage points)."
      },
      {
        "name": "deltaKind",
        "type": "'pct' | 'pp'",
        "defaultValue": "'pct'",
        "description": "Formats delta as percentage (%) or percentage points (pp)."
      },
      {
        "name": "big",
        "type": "boolean",
        "defaultValue": "false",
        "description": "Uses fluid clamp(36px, 6cqi, 56px) display scale for establishing C-01 panels."
      },
      {
        "name": "variant",
        "type": "'expressive' | 'quiet'",
        "defaultValue": "'expressive'",
        "description": "Selects display headline scale on twos (expressive) or 22px tabular monospace exposure-sheet scale with instant cut default (quiet)."
      },
      {
        "name": "spark",
        "type": "React.ReactNode",
        "defaultValue": "undefined",
        "description": "Optional bottom slot for a ToneSpark daily bar strip."
      },
      {
        "name": "comparisonLabel / range / note",
        "type": "string / number | string / string",
        "defaultValue": "undefined",
        "description": "Contextual comparison label (e.g., \"vs prior 30d\"), day window badge, or secondary footnote."
      },
      {
        "name": "headingLevel / motion",
        "type": "'h2' | 'h3' | 'h4' | 'div' | 'p' / MotionMode",
        "defaultValue": "'h2' / 'stepped' ('cut' in quiet variant)",
        "description": "Semantic element tag for the metric label and motion mode override for useCountUp."
      },
      {
        "name": "kind",
        "type": "'pct' | 'pp'",
        "defaultValue": "'pct'",
        "description": "Subcomponent prop on DeltaProps selecting percentage (%) or percentage-point (pp) formatting."
      }
    ],
    "stateBehavior": "Interpolates numeric value changes at 12fps via useCountUp in expressive mode (and defaults to instant cut in quiet mode).",
    "a11yNotes": [
      "Exposes the final formatted value inside .f12-sr-only while hiding intermediate count-up frames with aria-hidden=\"true\" so screen readers announce the change once.",
      "Includes \"Up\" or \"Down\" screen-reader text alongside the ▲ / ▼ delta symbol."
    ],
    "keyboardNotes": [
      "Non-interactive readout; exposes a single polite .f12-sr-only live region with the final formatted value and directional delta (\"Up\" / \"Down\") so assistive tech never reads intermediate count-up frames."
    ],
    "themeBehavior": "Uses --f-ink for numerals and --f-marker background with --f-marker-ink text on the directional Delta badge.",
    "responsiveBehavior": "Uses fluid clamp(36px, 6cqi, 56px) typography in big mode and tabular-nums so figures never overflow or jitter during transitions.",
    "grammarNotes": [
      "Uses tabular-nums so numerals never jitter horizontally while counting on twos."
    ],
    "commonErrors": [
      "Formatting the number into a string before passing it to value (Metric requires a numeric value and a format={(v) => string} function)."
    ],
    "usageTemplate": "import { Metric, fmtCurrency } from '@/components/frame12';\n\nexport function HeroKpi() {\n  return (\n    <Metric\n      label=\"Recovered revenue\"\n      value={120054}\n      format={fmtCurrency}\n      delta={0.114}\n      deltaKind=\"pct\"\n      range={30}\n      big\n    />\n  );\n}"
  },
  {
    "slug": "tone-area-chart",
    "title": "ToneAreaChart",
    "category": "Data & Charts",
    "summary": "Screentone halftone area chart with 4-band dot-density fade, speech-balloon peak callout, keyboard/pointer crosshair, and collapsible data table.",
    "registryUrl": "https://frame12.dev/r/tone-area-chart.json",
    "sourceFile": "registry/ui/tone-area-chart.tsx",
    "whenToUse": [
      "For primary time-series and trend visualizations (revenue recovery, request throughput, error rate over time) with optional prior-period or focus comparison series."
    ],
    "whenNotToUse": [
      "Do not import Recharts, Chart.js, D3, or Visx; always use ToneAreaChart for time-series area/line charts in FRAME/12.",
      "Do not set showTable={false} in production screens unless an equivalent accessible table of the same series is rendered immediately adjacent."
    ],
    "props": [
      {
        "name": "data",
        "type": "ToneAreaDatum[]",
        "defaultValue": "required",
        "description": "Array of { label, longLabel?, value, compareValue? } points."
      },
      {
        "name": "seriesLabel",
        "type": "string",
        "defaultValue": "'Value'",
        "description": "Primary series label shown in the crosshair readout and table header."
      },
      {
        "name": "compareLabel",
        "type": "string",
        "defaultValue": "undefined",
        "description": "Optional dashed comparison series label."
      },
      {
        "name": "height",
        "type": "number",
        "defaultValue": "260",
        "description": "SVG chart height in pixels."
      },
      {
        "name": "showTable",
        "type": "boolean",
        "defaultValue": "true",
        "description": "Renders the accessible <details className=\"tbl\"> semantic data table."
      },
      {
        "name": "labelColumnHeader / tableSummary / ariaLabel",
        "type": "string",
        "defaultValue": "'Label' / 'Show data table' / auto",
        "description": "First column header in the semantic data table, <summary> toggle text, and SVG aria-label override."
      },
      {
        "name": "formatValue / formatShort",
        "type": "(v: number) => string",
        "defaultValue": "defaultFormatValue / defaultFormatShort",
        "description": "Formatters for full crosshair/table values and compact Y-axis tick labels (pass fmtCurrency / fmtCurrencyShort for USD)."
      },
      {
        "name": "annotation / motion",
        "type": "{ index: number; text: string } | null / MotionMode",
        "defaultValue": "undefined (auto-peak) / 'stepped'",
        "description": "Custom speech-balloon annotation point (or null to hide) and 12fps chart reveal motion mode."
      }
    ],
    "stateBehavior": "Manages interactive pointer/keyboard crosshair index state internally and animates series reveal on twos via useOnTwos when data or range changes.",
    "a11yNotes": [
      "Focusable SVG (tabIndex={0}) supports ArrowLeft, ArrowRight, and Escape for full keyboard inspection.",
      "Always includes a collapsible <details className=\"f12-tbl\"> table with <th scope=\"col\"> headers."
    ],
    "keyboardNotes": [
      "The SVG chart surface is focusable (tabIndex={0}): ArrowLeft and ArrowRight step point-by-point across the series, announcing values in the crosshair readout; Escape clears the active crosshair.",
      "The collapsible <details className=\"f12-tbl\"> data table is keyboard-toggleable via Enter or Space on its <summary>."
    ],
    "themeBehavior": "Draws 4-band 45° rotated screentone dot patterns with --f-tone, primary strokes with --f-ink, dashed comparison strokes with hollow diamond markers, and peak dots with --f-marker.",
    "responsiveBehavior": "Measures container width via useSize (ResizeObserver) to recompute SVG coordinates, tick density, and speech-balloon clamping so annotations never clip at 390px mobile widths.",
    "grammarNotes": [
      "Replaces CSS/SVG color gradients with four vertical 45° rotated screentone dot-radius bands (1.25px to 0.62px).",
      "Peak annotation is a speech balloon with a mitered tail pointing to the marker-yellow peak dot."
    ],
    "commonErrors": [
      "Setting showTable={false}, which removes the semantic <details className=\"f12-tbl\"> table required by FRAME/12 accessibility rules.",
      "Passing CSS color gradients instead of relying on ToneAreaChart built-in 4-band SVG screentone patterns."
    ],
    "usageTemplate": "import { ToneAreaChart, fmtCurrency } from '@/components/frame12';\n\nexport function RecoveryTrend({ data }: { data: Array<{ label: string; value: number }> }) {\n  return (\n    <ToneAreaChart\n      data={data}\n      seriesLabel=\"Recovered revenue\"\n      formatValue={fmtCurrency}\n      height={240}\n    />\n  );\n}"
  },
  {
    "slug": "tone-bar-list",
    "title": "ToneBarList",
    "category": "Data & Charts",
    "summary": "Interactive ranked comparison list with screentone fill bars, share percentages, and impact-burst leader badge.",
    "registryUrl": "https://frame12.dev/r/tone-bar-list.json",
    "sourceFile": "registry/ui/tone-bar-list.tsx",
    "whenToUse": [
      "For ranked categorical comparisons (e.g., revenue by intervention channel, traffic share by service, regional volume breakdown) that can optionally filter linked charts and tables on selection."
    ],
    "whenNotToUse": [
      "Do not use ToneBarList for chronological time-series data; use <ToneAreaChart> or <ToneSpark> instead.",
      "Do not scatter random pattern (\"dots\" | \"hatch\" | \"dense\") values across bars unless the pattern encodes a meaningful secondary category (such as service tier or channel class)."
    ],
    "props": [
      {
        "name": "items",
        "type": "ToneBarItem[]",
        "defaultValue": "required",
        "description": "Ranked items with id, name, value, formattedValue, share (0..1), and optional badge."
      },
      {
        "name": "selectedId",
        "type": "string | null",
        "defaultValue": "null",
        "description": "Currently selected row ID for chart comparison filtering."
      },
      {
        "name": "onSelect",
        "type": "(id: string | null) => void",
        "defaultValue": "undefined",
        "description": "Callback fired when a row is toggled."
      },
      {
        "name": "changed",
        "type": "boolean",
        "defaultValue": "false",
        "description": "Triggers the 3-pose .f12-enter list cascade and leader badge pop."
      },
      {
        "name": "density",
        "type": "'comfortable' | 'compact'",
        "defaultValue": "'comfortable'",
        "description": "Reduces row padding and bar height for high-density operational lists."
      },
      {
        "name": "title / subtitle",
        "type": "string",
        "defaultValue": "undefined",
        "description": "Optional header title and right-aligned monospace subtitle above the ranked bar list."
      },
      {
        "name": "motion / idPrefix",
        "type": "MotionMode / string",
        "defaultValue": "'stepped' / undefined",
        "description": "Controls 12fps bar-width wipe cadence and deterministic button ID prefix (int-${idPrefix}-${item.id})."
      }
    ],
    "stateBehavior": "Controlled selection via selectedId and onSelect(id | null); clicking the currently selected bar toggles selection off (null).",
    "a11yNotes": [
      "Each row is a native <button type=\"button\" aria-pressed={selected}> inside a semantic list.",
      "Selected rows invert to --f-ink with a --f-marker bar fill for unmistakable visual and ARIA state."
    ],
    "keyboardNotes": [
      "Each bar row is a native <button type=\"button\" aria-pressed={selected}> reachable via Tab and toggled via Enter or Space."
    ],
    "themeBehavior": "Unselected rows use --f-panel with --f-tone pattern bars; the selected row inverts to --f-ink background with a high-contrast --f-marker bar fill.",
    "responsiveBehavior": "Stacks row metadata and bar tracks cleanly down to 320px viewports in both comfortable and compact densities.",
    "grammarNotes": [
      "Unselected bars use a 5px × 5px halftone dot pattern (--f-tone) framed by a 2px ink rule."
    ],
    "commonErrors": [
      "Forgetting to wire onSelect to clear or toggle when the user clicks the already-active row."
    ],
    "usageTemplate": "import { ToneBarList } from '@/components/frame12';\n\nexport function ChannelBreakdown({ items }: { items: Array<{ id: string; name: string; value: number; share: number }> }) {\n  return (\n    <ToneBarList\n      title=\"Revenue by intervention\"\n      subtitle=\"Last 30 days\"\n      items={items}\n    />\n  );\n}"
  },
  {
    "slug": "tone-spark",
    "title": "ToneSpark",
    "category": "Data & Charts",
    "summary": "Compact daily bar sparkline filled with 45° rotated SVG screentone dots that wipe on twos.",
    "registryUrl": "https://frame12.dev/r/tone-spark.json",
    "sourceFile": "registry/ui/tone-spark.tsx",
    "whenToUse": [
      "Inside <Metric spark={<ToneSpark ... />} />, <PanelPair>, or service health cards to show a compact daily bar strip (7–24 bars)."
    ],
    "whenNotToUse": [
      "Do not use ToneSpark as a full primary chart with axis labels and crosshairs; use <ToneAreaChart> instead."
    ],
    "props": [
      {
        "name": "values",
        "type": "number[]",
        "defaultValue": "required",
        "description": "Daily numeric values rendered as one screentone bar per day."
      },
      {
        "name": "label",
        "type": "string",
        "defaultValue": "required",
        "description": "Uppercase monospace caption rendered above the sparkline."
      },
      {
        "name": "rangeKey",
        "type": "string | number",
        "defaultValue": "undefined",
        "description": "Key that replays the stepped bar reveal when changed."
      },
      {
        "name": "ariaLabel / motion / height",
        "type": "string / MotionMode / number",
        "defaultValue": "auto / 'stepped' / 36",
        "description": "Accessible role=\"img\" label override, 12fps bar reveal mode, and SVG sparkline height in pixels."
      }
    ],
    "stateBehavior": "Stateless SVG bar strip that replays a stepped 12fps vertical wipe via useOnTwos whenever rangeKey changes.",
    "a11yNotes": [
      "Renders role=\"img\" with a descriptive aria-label summarizing the series and bar count."
    ],
    "keyboardNotes": [
      "Non-interactive graphic (role=\"img\") with an accessible aria-label summarizing the caption and sample count."
    ],
    "themeBehavior": "Fills bars with a 45° rotated 4×4px --f-tone dot pattern over a 2px solid --f-rule baseline in both themes.",
    "responsiveBehavior": "Uses a fluid SVG viewBox that scales smoothly to any card or panel column width.",
    "grammarNotes": [
      "Uses a 4px × 4px rotated SVG pattern (#uid-st) with a 2px solid --f-rule baseline."
    ],
    "commonErrors": [
      "Passing an empty values={[]} array without fallback data."
    ],
    "usageTemplate": "import { ToneSpark } from '@/components/frame12';\n\nexport function DailyProfitSpark() {\n  return <ToneSpark label=\"Daily profit\" values={[420, 510, 490, 610, 580, 640, 710]} rangeKey={7} />;\n}"
  },
  {
    "slug": "balloon",
    "title": "Balloon",
    "category": "Data & Charts",
    "summary": "Standalone speech-balloon callout with mitered SVG tail and inked marker-yellow target dot.",
    "registryUrl": "https://frame12.dev/r/balloon.json",
    "sourceFile": "registry/ui/balloon.tsx",
    "whenToUse": [
      "For static editorial callouts, peak data annotations, or storyboard notes anchored to a specific target point."
    ],
    "whenNotToUse": [
      "Do not use Balloon for hover/focus help hints on buttons (use <Tooltip>) or for interactive dropdown menus (use <DropdownMenu>)."
    ],
    "props": [
      {
        "name": "tailOffset",
        "type": "number",
        "defaultValue": "0",
        "description": "Horizontal tail tip offset in pixels (-36 to +36)."
      },
      {
        "name": "showDot",
        "type": "boolean",
        "defaultValue": "true",
        "description": "Renders the 4px marker-yellow target dot with 2px ink stroke below the tail."
      }
    ],
    "stateBehavior": "Stateless callout box with configurable horizontal tailOffset (-36 to +36) and optional target dot.",
    "a11yNotes": [
      "Keeps annotation text in the DOM while marking the decorative SVG tail aria-hidden=\"true\"."
    ],
    "keyboardNotes": [
      "Non-interactive text container; decorative SVG tail and target dot carry aria-hidden=\"true\"."
    ],
    "themeBehavior": "Frames --f-panel background with a 2px solid --f-rule border and a无缝 .f12-balloon-gap bridge so the tail joins the border cleanly in both themes.",
    "responsiveBehavior": "Clamps tailOffset within [-36, 36] so the mitered tail stays inside the balloon width on narrow screens.",
    "grammarNotes": [
      "Replaces floating shadow popovers with an inked speech balloon and seamless .f12-balloon-gap bridge."
    ],
    "commonErrors": [
      "Using floating drop-shadow popovers for peak annotations instead of <Balloon>."
    ],
    "usageTemplate": "import { Balloon } from '@/components/frame12';\n\nexport function PeakCallout() {\n  return <Balloon tailOffset={-8} showDot>Peak Oct 26 · $6,120</Balloon>;\n}"
  },
  {
    "slug": "use-on-twos",
    "title": "useOnTwos",
    "category": "Motion Hooks",
    "summary": "Core motion hooks (useOnTwos, useCountUp, useChanged, useSize, useReducedMotion) that sample transitions at 12 poses per second (83.33ms per pose).",
    "registryUrl": "https://frame12.dev/r/use-on-twos.json",
    "sourceFile": "registry/hooks/use-on-twos.ts",
    "whenToUse": [
      "Whenever building custom transitions, animated SVG paths, count-up numerals (useCountUp), or post-mount change triggers (useChanged) that must obey FRAME/12 12fps stepped motion."
    ],
    "whenNotToUse": [
      "Do not use useOnTwos to delay continuous pointer interactions (hover, typing, dragging, chart crosshairs); continuous pointer feedback must remain 0ms immediate."
    ],
    "props": [
      {
        "name": "key",
        "type": "unknown",
        "defaultValue": "required",
        "description": "Dependency value; changing key replays the 0..1 progress transition."
      },
      {
        "name": "duration",
        "type": "number",
        "defaultValue": "600",
        "description": "Total transition duration in milliseconds."
      },
      {
        "name": "motion",
        "type": "'stepped' | 'smooth' | 'cut'",
        "defaultValue": "'stepped'",
        "description": "Sampling mode: 12fps stepped poses, 60fps continuous, or instant hard cut."
      }
    ],
    "stateBehavior": "Returns 1 on initial mount so sheets render complete at rest; when key changes, steps progress from 0 to 1 in 83.33ms (1000/12 ms) increments using a cubic ease-out curve.",
    "a11yNotes": [
      "useReducedMotion() listens to (prefers-reduced-motion: reduce) and forces instant hard cuts.",
      "Returns 1 on initial mount so pages render complete at rest with zero layout shift."
    ],
    "keyboardNotes": [
      "Does not intercept keyboard events; useReducedMotion() automatically forces cut mode (instant 1) when prefers-reduced-motion: reduce is active."
    ],
    "themeBehavior": "Theme-agnostic timing hooks.",
    "responsiveBehavior": "Exports useSize(ref) backed by ResizeObserver so SVG frames and charts adapt to responsive container widths.",
    "grammarNotes": [
      "Quantizes elapsed time into FRAME_MS = 1000 / 12 (83.33ms) steps and applies cubic easeOut."
    ],
    "commonErrors": [
      "Animating elements on initial page mount instead of using useChanged(key) to gate entrance animations to user-initiated state changes."
    ],
    "usageTemplate": "import { useOnTwos, useCountUp, useChanged } from '@/hooks/use-on-twos';\n\nexport function AnimatedStat({ value }: { value: number }) {\n  const shown = useCountUp(value, 'stepped', 600);\n  const changed = useChanged(value);\n  const progress = useOnTwos(value, 600, 'stepped');\n  return <output data-changed={changed} data-p={progress.toFixed(2)}>{Math.round(shown)}</output>;\n}"
  },
  {
    "slug": "dialog",
    "title": "Dialog",
    "category": "Primitive Adapters",
    "summary": "Native modal <dialog> adapter with .showModal(), screentone backdrop, light-dismiss fallback, and sequential cut label.",
    "registryUrl": "https://frame12.dev/r/dialog.json",
    "sourceFile": "registry/ui/dialog.tsx",
    "whenToUse": [
      "For modal confirmations (e.g., destructive Danger Zone actions, unsaved-change navigation guards), RBAC invite forms, and deep-dive event inspection drawers/modals."
    ],
    "whenNotToUse": [
      "Do not use window.confirm() or window.alert(), and do not import raw @radix-ui/react-dialog directly in application screens."
    ],
    "props": [
      {
        "name": "open / onOpenChange",
        "type": "boolean / (open: boolean) => void",
        "defaultValue": "uncontrolled",
        "description": "Controlled or uncontrolled modal state synchronized with native dialog.showModal()."
      },
      {
        "name": "cut",
        "type": "string",
        "defaultValue": "undefined",
        "description": "Optional sequential cut badge rendered on the top edge of DialogContent."
      },
      {
        "name": "defaultOpen",
        "type": "boolean",
        "defaultValue": "false",
        "description": "Initial open state when Dialog is rendered as an uncontrolled modal."
      },
      {
        "name": "asChild",
        "type": "boolean",
        "defaultValue": "false",
        "description": "Subcomponent prop on DialogTriggerProps and DialogCloseProps to merge behavior onto a custom child button."
      }
    ],
    "stateBehavior": "Supports controlled (open + onOpenChange) and uncontrolled (defaultOpen) state synchronized with native HTML <dialog>.showModal(). Automatically coordinates with nested Select, DropdownMenu, and Toast portals.",
    "a11yNotes": [
      "Uses native HTML <dialog> with .showModal() so the browser marks background content inert automatically.",
      "Links DialogTitle via aria-labelledby and supports Escape key + backdrop click dismissal."
    ],
    "keyboardNotes": [
      "Browser-native modal focus containment via .showModal(); Escape closes the dialog (unless a nested Select or DropdownMenu popup is open, in which case Escape closes the nested popup first) and restores focus to the trigger."
    ],
    "themeBehavior": "Renders a 6×6px halftone screentone ::backdrop and inherits light/dark theme tokens onto the native <dialog> element.",
    "responsiveBehavior": "Sizes up to min(560px, calc(100vw - 32px)) with max-height calc(100dvh - 32px) and internal overflow-y: auto so modals fit 390px mobile viewports without clipping.",
    "grammarNotes": [
      "Installs into components/frame12/dialog.tsx with 2.5px ink borders and a 6px × 6px screentone backdrop without overwriting existing components/ui/ files."
    ],
    "commonErrors": [
      "Omitting DialogTitle inside DialogContent, which leaves the modal dialog without an accessible aria-labelledby name."
    ],
    "usageTemplate": "import {\n  Dialog, DialogTrigger, DialogContent, DialogHeader,\n  DialogTitle, DialogDescription, DialogFooter, DialogClose,\n} from '@/components/frame12';\n\nexport function ConfirmModal() {\n  return (\n    <Dialog>\n      <DialogTrigger variant=\"marker\">Open Modal</DialogTrigger>\n      <DialogContent>\n        <DialogHeader>\n          <DialogTitle>Rotate webhook secret?</DialogTitle>\n          <DialogDescription>Active endpoints will verify both keys for 24 hours.</DialogDescription>\n        </DialogHeader>\n        <DialogFooter>\n          <DialogClose variant=\"secondary\">Cancel</DialogClose>\n          <DialogClose variant=\"primary\">Confirm</DialogClose>\n        </DialogFooter>\n      </DialogContent>\n    </Dialog>\n  );\n}"
  },
  {
    "slug": "select",
    "title": "Select",
    "category": "Primitive Adapters",
    "summary": "Accessible listbox selector adapter with linked label, marker-yellow ▼ caret, and ink-inverted active item.",
    "registryUrl": "https://frame12.dev/r/select.json",
    "sourceFile": "registry/ui/select.tsx",
    "whenToUse": [
      "For single-value selection from a dropdown list of 4+ options (e.g., region selector, role assignment, channel filter, retention window)."
    ],
    "whenNotToUse": [
      "Do not use Select for 2–3 view-switching options that should be immediately visible in a toolbar; use <SegmentedControl> instead.",
      "Do not import raw @radix-ui/react-select directly in application screens."
    ],
    "props": [
      {
        "name": "value / defaultValue",
        "type": "string",
        "defaultValue": "''",
        "description": "Controlled or uncontrolled selected item value."
      },
      {
        "name": "onValueChange",
        "type": "(value: string) => void",
        "defaultValue": "undefined",
        "description": "Callback fired when an option is selected."
      },
      {
        "name": "label",
        "type": "string",
        "defaultValue": "undefined",
        "description": "Optional visible <label> automatically linked to the trigger button."
      },
      {
        "name": "density",
        "type": "'comfortable' | 'compact'",
        "defaultValue": "'comfortable'",
        "description": "Reduces trigger padding and border width for dense operational forms."
      },
      {
        "name": "id",
        "type": "string",
        "defaultValue": "useId()",
        "description": "Explicit trigger button ID linked to the visible <label> or outer <Field>."
      },
      {
        "name": "ariaLabel / SelectValueProps / SelectContentProps / SelectItemProps / SelectGroupProps / SelectLabelProps / SelectSeparatorProps",
        "type": "string / Radix Select Contracts",
        "defaultValue": "undefined / Radix defaults",
        "description": "Subcomponent prop on SelectTriggerProps (ariaLabel) and exported Radix Select compound prop aliases."
      }
    ],
    "stateBehavior": "Supports controlled (value + onValueChange) and uncontrolled (defaultValue) state, plus native <form> FormData participation when name or required is passed.",
    "a11yNotes": [
      "Exposes aria-haspopup=\"listbox\", aria-expanded, and role=\"listbox\" with aria-selected on options.",
      "Dismisses on Escape or outside pointer down."
    ],
    "keyboardNotes": [
      "Full WAI-ARIA listbox keyboard navigation: Enter, Space, or ArrowDown opens the menu; ArrowUp/ArrowDown/Home/End and character typeahead move highlight; Enter/Space selects; Escape closes and restores focus to SelectTrigger."
    ],
    "themeBehavior": "Portaled SelectContent automatically inherits .f12-theme-light or .f12-theme-dark from the trigger ancestor (and portals inside any open modal <dialog> so it remains interactive in the top layer).",
    "responsiveBehavior": "Matches trigger width (--radix-select-trigger-width) and constrains popup height within the available viewport collision boundary.",
    "grammarNotes": [
      "Uses a marker-yellow ▼ caret badge and a ✓ marker check on the selected option."
    ],
    "commonErrors": [
      "Omitting both label on <Select> and ariaLabel on <SelectTrigger>, leaving the combobox trigger without an accessible name."
    ],
    "usageTemplate": "import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/frame12';\n\nexport function ChannelSelect() {\n  return (\n    <Select defaultValue=\"cart\" label=\"Intervention channel\">\n      <SelectTrigger><SelectValue /></SelectTrigger>\n      <SelectContent>\n        <SelectItem value=\"cart\">Abandoned-cart email</SelectItem>\n        <SelectItem value=\"exit\">Exit-intent offer</SelectItem>\n        <SelectItem value=\"stock\">Back-in-stock alert</SelectItem>\n      </SelectContent>\n    </Select>\n  );\n}"
  },
  {
    "slug": "tooltip",
    "title": "Tooltip",
    "category": "Primitive Adapters",
    "summary": "Keyboard- and hover-accessible ink-framed tooltip adapter with hard offset shadow.",
    "registryUrl": "https://frame12.dev/r/tooltip.json",
    "sourceFile": "registry/ui/tooltip.tsx",
    "whenToUse": [
      "For brief supplementary hints on compact controls, abbreviations, or icon-accompanied triggers when hovered or focused."
    ],
    "whenNotToUse": [
      "Do not put essential instructions, interactive buttons, or links inside TooltipContent; use <Balloon>, <Notice>, or <Dialog> instead."
    ],
    "props": [
      {
        "name": "TooltipTrigger",
        "type": "{ asChild?: boolean; children: React.ReactElement }",
        "defaultValue": "required",
        "description": "Trigger element that opens the tooltip on hover or keyboard focus."
      },
      {
        "name": "TooltipContent",
        "type": "React.HTMLAttributes<HTMLDivElement>",
        "defaultValue": "required",
        "description": "Tooltip surface linked to the trigger via aria-describedby."
      },
      {
        "name": "open / defaultOpen / onOpenChange",
        "type": "boolean / boolean / (open: boolean) => void",
        "defaultValue": "uncontrolled",
        "description": "Controlled or uncontrolled visibility state for the tooltip popup."
      },
      {
        "name": "asChild",
        "type": "boolean",
        "defaultValue": "false",
        "description": "Subcomponent prop on TooltipTriggerProps to attach trigger handlers and aria-describedby directly to a child element."
      }
    ],
    "stateBehavior": "Supports controlled (open + onOpenChange) and uncontrolled (defaultOpen) visibility, opening on pointer enter or keyboard focus.",
    "a11yNotes": [
      "Opens on both pointer enter and keyboard focus, and dismisses immediately on Escape.",
      "Links trigger to role=\"tooltip\" content via aria-describedby when open."
    ],
    "keyboardNotes": [
      "Focusing TooltipTrigger via Tab opens the tooltip immediately; pressing Escape dismisses the tooltip without moving focus."
    ],
    "themeBehavior": "Renders --f-panel background with 2px solid --f-rule border and 3px 3px 0 var(--f-rule) hard shadow in both themes.",
    "responsiveBehavior": "Positions relative to the trigger with collision padding so hints stay within viewport edges.",
    "grammarNotes": [
      "Framed with a 2px solid --f-rule border and 3px 3px 0 var(--f-rule) offset shadow."
    ],
    "commonErrors": [
      "Placing TooltipTrigger around a disabled button without a focusable wrapper, preventing keyboard users from reaching the tooltip."
    ],
    "usageTemplate": "import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent, Button } from '@/components/frame12';\n\nexport function HoldoutHint() {\n  return (\n    <TooltipProvider>\n      <Tooltip>\n        <TooltipTrigger asChild><Button variant=\"secondary\" size=\"sm\">Holdout spec</Button></TooltipTrigger>\n        <TooltipContent>10% randomized checkout holdout cohort</TooltipContent>\n      </Tooltip>\n    </TooltipProvider>\n  );\n}"
  },
  {
    "slug": "dropdown-menu",
    "title": "DropdownMenu",
    "category": "Primitive Adapters",
    "summary": "Ink-framed action menu adapter with keyboard Escape/outside-click dismissal and ink-inverted item focus.",
    "registryUrl": "https://frame12.dev/r/dropdown-menu.json",
    "sourceFile": "registry/ui/dropdown-menu.tsx",
    "whenToUse": [
      "For contextual row action menus (e.g., Replay webhook, Inspect payload, Rotate key, Revoke access) triggered by an action button."
    ],
    "whenNotToUse": [
      "Do not use DropdownMenu for form field value selection; use <Select> instead."
    ],
    "props": [
      {
        "name": "DropdownMenuTrigger",
        "type": "{ asChild?: boolean; children: React.ReactElement }",
        "defaultValue": "required",
        "description": "Button that toggles the role=\"menu\" popup."
      },
      {
        "name": "DropdownMenuItem",
        "type": "{ onSelect?: () => void }",
        "defaultValue": "optional",
        "description": "Focusable role=\"menuitem\" button that closes the menu on activation."
      },
      {
        "name": "asChild / DropdownMenuProps / DropdownMenuContentProps / DropdownMenuLabelProps / DropdownMenuSeparatorProps / DropdownMenuItemProps / DropdownMenuGroupProps",
        "type": "boolean / Radix Menu Contracts",
        "defaultValue": "false / Radix defaults",
        "description": "Subcomponent prop on DropdownMenuTriggerProps (asChild) and exported Radix menu subcomponent prop aliases."
      }
    ],
    "stateBehavior": "Manages menu open/close state via Radix DropdownMenu primitive and portals into any active modal <dialog[open]> when used inside a dialog.",
    "a11yNotes": [
      "Sets aria-haspopup=\"menu\" and aria-expanded on the trigger and role=\"menuitem\" on each action."
    ],
    "keyboardNotes": [
      "Enter, Space, or ArrowDown opens the menu and focuses the first item; ArrowDown/ArrowUp/Home/End cycle through items; Enter/Space activates and closes; Escape dismisses and returns focus to DropdownMenuTrigger."
    ],
    "themeBehavior": "Renders 2.5px --f-rule borders, --f-panel surface, and --f-ink inverted highlight on focused/hovered menu items.",
    "responsiveBehavior": "Automatically flips alignment when near the right or bottom viewport edge.",
    "grammarNotes": [
      "Uses 2.5px ink rules, uppercase monospace DropdownMenuLabel, and 1px --f-grid separators."
    ],
    "commonErrors": [
      "Using DropdownMenuItem for navigation links without handling keyboard activation or focus management."
    ],
    "usageTemplate": "import {\n  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,\n  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem,\n} from '@/components/frame12';\n\nexport function RowActions() {\n  return (\n    <DropdownMenu>\n      <DropdownMenuTrigger variant=\"secondary\" size=\"sm\">Actions ▼</DropdownMenuTrigger>\n      <DropdownMenuContent>\n        <DropdownMenuLabel>Webhook</DropdownMenuLabel>\n        <DropdownMenuSeparator />\n        <DropdownMenuItem>Replay payload</DropdownMenuItem>\n        <DropdownMenuItem>Inspect headers</DropdownMenuItem>\n      </DropdownMenuContent>\n    </DropdownMenu>\n  );\n}"
  },
  {
    "slug": "table",
    "title": "Table",
    "category": "Primitive Adapters",
    "summary": "Semantic data table adapter with uppercase monospace column headers, 2.5px ink header rule, and tabular-nums alignment.",
    "registryUrl": "https://frame12.dev/r/table.json",
    "sourceFile": "registry/ui/table.tsx",
    "whenToUse": [
      "For structured operational ledgers, request logs, cohort comparisons, and RBAC member directories."
    ],
    "whenNotToUse": [
      "Do not use Table for page layout grids; use <Scene> and <Panel> instead."
    ],
    "props": [
      {
        "name": "density",
        "type": "'comfortable' | 'compact'",
        "defaultValue": "'comfortable'",
        "description": "Reduces cell padding and header rule weight for high-row-count operational ledgers."
      },
      {
        "name": "TableHead",
        "type": "React.ThHTMLAttributes<HTMLTableCellElement>",
        "defaultValue": "scope=\"col\"",
        "description": "Header cell defaulting to scope=\"col\" with 2.5px bottom ink border."
      },
      {
        "name": "TableCaption",
        "type": "React.HTMLAttributes<HTMLTableCaptionElement>",
        "defaultValue": "optional",
        "description": "Accessible table caption placed at the bottom edge in monospace type."
      },
      {
        "name": "wrapperProps",
        "type": "React.HTMLAttributes<HTMLDivElement>",
        "defaultValue": "undefined",
        "description": "HTML attributes (such as tabIndex, role, or aria-label) forwarded to the outer .f12-table-wrap scroll container."
      }
    ],
    "stateBehavior": "Stateless semantic <table> adapter family (Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell, TableCaption) with comfortable and compact density modes.",
    "a11yNotes": [
      "Wraps <table> in an overflow-x: auto container (.f12-table-wrap) so narrow mobile viewports scroll the table without page overflow.",
      "Defaults TableHead to scope=\"col\" for screen-reader cell header association."
    ],
    "keyboardNotes": [
      "Wraps <table> in .f12-table-wrap (overflow-x: auto) and accepts wrapperProps so keyboard users can scroll wide tables horizontally when needed."
    ],
    "themeBehavior": "Uses 2.5px solid --f-rule under <thead>, 1px solid --f-grid between rows, and subtle screentone hover highlight on body rows.",
    "responsiveBehavior": "Scrolls horizontally inside .f12-table-wrap on 390px mobile viewports so wide multi-column tables never cause document-level horizontal overflow.",
    "grammarNotes": [
      "Uses 2.5px solid --f-rule under thead, 1px solid --f-grid between rows, and 2px solid --f-rule above tfoot."
    ],
    "commonErrors": [
      "Using raw <th> without scope=\"col\" or forgetting tabular-nums alignment on numeric columns."
    ],
    "usageTemplate": "import {\n  Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableCaption, Tag,\n} from '@/components/frame12';\n\nexport function RecoveryTable() {\n  return (\n    <Table>\n      <TableCaption>Recent recovered checkouts</TableCaption>\n      <TableHeader>\n        <TableRow>\n          <TableHead>Order</TableHead>\n          <TableHead>Intervention</TableHead>\n          <TableHead>Status</TableHead>\n          <TableHead>Amount</TableHead>\n        </TableRow>\n      </TableHeader>\n      <TableBody>\n        <TableRow>\n          <TableCell>ORD-9041</TableCell>\n          <TableCell>Abandoned-cart email</TableCell>\n          <TableCell><Tag>Recovered</Tag></TableCell>\n          <TableCell>$184</TableCell>\n        </TableRow>\n      </TableBody>\n    </Table>\n  );\n}"
  }
];

const RAW_BLOCK_CATALOG: BlockCatalogEntry[] = [
  {
    "slug": "developer-console",
    "title": "Developer Console Block",
    "route": "/blocks/developer-console",
    "registryUrl": "https://frame12.dev/r/developer-console.json",
    "sourceFile": "registry/blocks/developer-console.tsx",
    "summary": "Flagship API & webhook control-plane Developer Console combining Expressive telemetry (C-01 Metric, C-02 ToneAreaChart, C-03 ToneBarList) with Quiet operational ledgers (Services & Endpoints, Masked Fictional API Keys f12_sim_*, and Request Logs) plus C-04/C-05/C-06 modal workflows.",
    "architectureNotes": [
      "Hybrid Expressive + Quiet architecture: the Overview tab uses <Sheet autoCut> to number the establishing KPI strip (C-01), throughput & error-rate ToneAreaChart (C-02), and service breakdown ToneBarList (C-03), while operational tabs inside <TabsContent> default to <Panel variant=\"quiet\"> (1px rules, unnumbered) so switching tabs never renumbers sheet cuts.",
      "Cross-filtered state machine: selecting a service in C-03 ToneBarList or clicking a service row filters the endpoint directory and request logs, while breadcrumb and reset controls restore the full control-plane scope.",
      "Self-contained ToastProvider wrapper: exports DeveloperConsole with an internal ToastProvider fallback (via useOptionalToast) so action feedback works out of the box when installed into any Next.js app."
    ],
    "fixtureNotes": [
      "Deterministic multi-environment fixtures for Production (us-east-1) and Staging (eu-central-1) across 24H, 7D, and 30D windows.",
      "Mathematically reconciled telemetry: total requests, error counts, basis-point error rates, and service-level request shares reconcile across the C-01 KPIs, C-02 chart series, C-03 bar list, and endpoint tables.",
      "All API keys use unmistakably fictional prefixes (f12_sim_live_* and f12_sim_stage_*) so secret scanners never flag fixture tokens."
    ],
    "componentDependencies": [
      "sheet",
      "scene",
      "panel",
      "segmented-control",
      "tabs",
      "button",
      "field",
      "input",
      "checkbox",
      "radio-group",
      "switch",
      "select",
      "badge",
      "tag",
      "alert",
      "toast",
      "skeleton",
      "empty-state",
      "breadcrumb",
      "pagination",
      "metric",
      "tone-area-chart",
      "tone-bar-list",
      "tone-spark",
      "dialog",
      "table",
      "use-on-twos"
    ],
    "props": [
      {
        "name": "defaultSection / initialSection",
        "type": "'overview' | 'endpoints' | 'keys' | 'logs'",
        "defaultValue": "'overview'",
        "description": "Initial active console tab section on mount (initialSection is supported as a backwards-compatible alias)."
      },
      {
        "name": "defaultDatasetState / initialDatasetState",
        "type": "'populated' | 'loading' | 'empty' | 'error'",
        "defaultValue": "'populated'",
        "description": "Initial dataset sandbox posture for testing zero-CLS skeletons, empty states, and fault recovery."
      },
      {
        "name": "defaultTimeRange / initialTimeRange",
        "type": "'24h' | '7d' | '30d'",
        "defaultValue": "'24h'",
        "description": "Initial telemetry exposure window."
      },
      {
        "name": "defaultEnvironment / initialEnvironment",
        "type": "'prod' | 'staging'",
        "defaultValue": "'prod'",
        "description": "Initial control-plane target environment."
      },
      {
        "name": "motion / theme",
        "type": "MotionMode / 'light' | 'dark'",
        "defaultValue": "'stepped' / undefined",
        "description": "Presentation overrides for 12fps/60fps/Cut motion and explicit light/dark sheet theme."
      },
      {
        "name": "idPrefix / showSandboxControls",
        "type": "string / boolean",
        "defaultValue": "'dc' / true",
        "description": "Deterministic DOM ID prefix for multi-instance rendering and toggle for the top demo state switcher bar."
      },
      {
        "name": "headerSlot / footerSlot / className",
        "type": "React.ReactNode / React.ReactNode / string",
        "defaultValue": "undefined",
        "description": "Optional slots rendered above the header or below the main scenes, plus custom outer className."
      }
    ],
    "customizationGuidance": [
      "Hide the sandbox state switcher in production by passing showSandboxControls={false} and binding your own data-fetching state to defaultDatasetState.",
      "Replace CONSOLE_SNAPSHOTS, CONSOLE_SERVICES, CONSOLE_ENDPOINTS, and INITIAL_LOGS in components/frame12/blocks/developer-console.tsx with your API hooks or React Server Component props.",
      "Pass headerSlot or footerSlot to inject organization-specific navigation or audit footers without modifying the internal scene grid."
    ],
    "a11yNotes": [
      "Zero axe-core WCAG AA violations across Overview, Endpoints, API Keys, and Request Logs in both light and dark themes.",
      "Modals C-04 (Create API Key), C-05 (Revoke Key Confirmation), and C-06 (Request Log Payload Inspector) use native <dialog>.showModal() with Escape isolation and focus restoration.",
      "Throughput ToneAreaChart includes keyboard Left/Right crosshair inspection and a semantic <details className=\"f12-tbl\"> data table."
    ],
    "knownLimitations": [
      "Key creation, rotation, revocation, and webhook replay actions mutate in-memory React state only and reset on full page reload unless wired to a persistence API."
    ],
    "usageTemplate": "import { DeveloperConsole } from '@/components/frame12/blocks/developer-console';\n\nexport default function ConsolePage() {\n  return (\n    <DeveloperConsole\n      defaultSection=\"overview\"\n      defaultEnvironment=\"prod\"\n      defaultTimeRange=\"24h\"\n      showSandboxControls={false}\n    />\n  );\n}"
  },
  {
    "slug": "workspace-settings",
    "title": "Workspace Settings Block",
    "route": "/blocks/workspace-settings",
    "registryUrl": "https://frame12.dev/r/workspace-settings.json",
    "sourceFile": "registry/blocks/workspace-settings.tsx",
    "summary": "Quiet-first operational Workspace & Operator Settings ledger with 1 Expressive posture header (C-01) and 7 Quiet configuration tabs (Profile, Workspace, Notifications, Appearance, Motion, Team & Roles, Danger Zone), cross-tab dirty tracking, validation with focus transfer, and C-02/C-03/C-04 modal guards.",
    "architectureNotes": [
      "Quiet-led hierarchy: limits Expressive 2.5px polygon framing to a single establishing posture header (C-01) and renders all 7 configuration tabs inside <Panel variant=\"quiet\"> with compact 1.5px form controls.",
      "Snapshot vs. Draft state engine: maintains per-workspace saved snapshots and editable drafts, computing section-level dirty diffs, arming a beforeunload + in-app link click + popstate navigation guard (C-02), and validating fields across all 7 tabs before committing.",
      "Live sheet preview binding: toggling Appearance (theme, compact/comfortable density, registration pegs, high-contrast rules) or Motion (12fps stepped, 60fps smooth, cut) previews immediately on the block Sheet without polluting the saved snapshot until Save Changes is clicked."
    ],
    "fixtureNotes": [
      "Includes two deterministic workspace targets: Atelier Koma Production (us-east-1, 5/10 seats, REV-042) and Atelier Koma Staging (eu-central-1, 3/10 seats, REV-019).",
      "Pre-populates realistic operator signing metadata (Ed25519 fingerprint), webhook routing thresholds, RBAC member roster with primary-owner lock, and buffered telemetry purge counters."
    ],
    "componentDependencies": [
      "sheet",
      "panel",
      "segmented-control",
      "tabs",
      "button",
      "field",
      "input",
      "textarea",
      "checkbox",
      "radio-group",
      "switch",
      "select",
      "badge",
      "tag",
      "alert",
      "toast",
      "skeleton",
      "empty-state",
      "breadcrumb",
      "metric",
      "tone-spark",
      "dialog",
      "table",
      "use-on-twos"
    ],
    "props": [
      {
        "name": "defaultSection / initialSection",
        "type": "'profile' | 'workspace' | 'notifications' | 'appearance' | 'motion' | 'team' | 'danger'",
        "defaultValue": "'profile'",
        "description": "Initial active settings tab section on mount."
      },
      {
        "name": "defaultDatasetState / initialDatasetState",
        "type": "'populated' | 'loading' | 'empty' | 'error'",
        "defaultValue": "'populated'",
        "description": "Initial dataset state for previewing loading skeletons, empty team roster, or fault banners."
      },
      {
        "name": "defaultWorkspaceId / initialWorkspaceId",
        "type": "'prod' | 'staging'",
        "defaultValue": "'prod'",
        "description": "Initial workspace configuration target."
      },
      {
        "name": "motion / theme",
        "type": "MotionMode / 'light' | 'dark'",
        "defaultValue": "undefined",
        "description": "Host presentation overrides applied without marking the user draft as dirty on initial mount."
      },
      {
        "name": "onDirtyChange",
        "type": "(isDirty: boolean, dirtySections: SettingsSection[]) => void",
        "defaultValue": "undefined",
        "description": "Callback fired whenever unsaved draft state or modified sections change."
      },
      {
        "name": "idPrefix / showSandboxControls",
        "type": "string / boolean",
        "defaultValue": "'ws' / true",
        "description": "Deterministic DOM ID prefix and toggle for the top demo state switcher bar."
      },
      {
        "name": "headerSlot / footerSlot / className",
        "type": "React.ReactNode / React.ReactNode / string",
        "defaultValue": "undefined",
        "description": "Optional header/footer slots and outer container className."
      }
    ],
    "customizationGuidance": [
      "Wire onDirtyChange and your backend PATCH endpoint to handleSaveAll so committed snapshots persist to your database.",
      "Pass showSandboxControls={false} in production deployments to hide the PROD/STAGE and LIVE/LOAD/ZERO/ERR sandbox toggles.",
      "Customize validateDraft() rules in workspace-settings.tsx to match your organization slug format, webhook domain allowlist, and seat quota limits."
    ],
    "a11yNotes": [
      "Submitting invalid settings renders a clickable cross-section Alert summary that switches to the offending tab and moves keyboard focus directly to the invalid input.",
      "Destructive actions in the Danger Zone require explicit modal confirmation (C-04) with normalized slug verification before archiving.",
      "All grouped checkboxes (Alert delivery channels) use Field role=\"group\" semantics without falsely requiring every checkbox to be checked."
    ],
    "knownLimitations": [
      "Client-side draft cache persists across in-app route transitions during the current browser session only; full page reload resets to initial fixtures unless backed by an API."
    ],
    "usageTemplate": "import { WorkspaceSettings } from '@/components/frame12/blocks/workspace-settings';\n\nexport default function SettingsPage() {\n  return (\n    <WorkspaceSettings\n      defaultSection=\"profile\"\n      defaultWorkspaceId=\"prod\"\n      showSandboxControls={false}\n    />\n  );\n}"
  },
  {
    "slug": "analytics-dashboard",
    "title": "Analytics Dashboard Block",
    "route": "/blocks/analytics-dashboard",
    "registryUrl": "https://frame12.dev/r/analytics-dashboard.json",
    "sourceFile": "registry/blocks/analytics-dashboard.tsx",
    "summary": "Installable Revenue Recovery Analytics Dashboard sharing the authoritative mulberry32(1207) 180-day recovery dataset with the homepage, combining Expressive C-01..C-04 storyboard scenes with Quiet period-over-period comparisons, checkout segment breakdowns, filterable daily attribution ledger, and C-05 inspection modal.",
    "architectureNotes": [
      "Shared single-source-of-truth core: exports both RevenueRecoveryCoreScenes (rendered on the public `/` homepage) and the full AnalyticsDashboard block so the homepage and `/blocks/analytics-dashboard` never drift.",
      "Expressive Storyboard + Quiet Analytical Depth: Scenes 1 & 2 use expressive 2.5px mitered panels (C-01 Recovered Revenue & ToneAreaChart, C-02/C-03 Profit & Lift PanelPair, C-04 Intervention ToneBarList), followed by Quiet 1px exposure-sheet panels for Period-over-Period Reconciliation, Checkout Segment Breakdown, and the Daily Attribution Ledger.",
      "Bidirectional focus scoping: clicking an intervention bar in C-04 or selecting a checkout segment scopes the KPIs, comparison series, segment table, and daily attribution ledger simultaneously."
    ],
    "fixtureNotes": [
      "Generated deterministically from mulberry32(1207) across 180 days (90 current days + 90 prior-window baseline days) for Fernwood Supply Co.",
      "Reconciles to the dollar: daily intervention and checkout-segment amounts sum to each day total, and daily totals sum to the 7D ($28,042), 30D ($120,054), and 90D ($313,448) headline figures."
    ],
    "componentDependencies": [
      "sheet",
      "scene",
      "panel",
      "panel-pair",
      "segmented-control",
      "button",
      "input",
      "select",
      "badge",
      "tag",
      "alert",
      "toast",
      "skeleton",
      "empty-state",
      "breadcrumb",
      "pagination",
      "metric",
      "tone-area-chart",
      "tone-bar-list",
      "tone-spark",
      "dialog",
      "table",
      "use-on-twos"
    ],
    "props": [
      {
        "name": "defaultRange / initialRange",
        "type": "7 | 30 | 90",
        "defaultValue": "30",
        "description": "Initial date range window in days."
      },
      {
        "name": "defaultFocusId / initialFocusId",
        "type": "string | null",
        "defaultValue": "null",
        "description": "Initial focused intervention channel ID (\"cart\" | \"exit\" | \"pay\" | \"stock\" | \"browse\" | null)."
      },
      {
        "name": "defaultComparisonMode / initialComparisonMode",
        "type": "'prior' | 'none'",
        "defaultValue": "'prior'",
        "description": "Whether to overlay the dashed prior-period baseline series and deltas by default."
      },
      {
        "name": "defaultDatasetState / initialDatasetState",
        "type": "'populated' | 'loading' | 'empty' | 'error'",
        "defaultValue": "'populated'",
        "description": "Initial dataset state for testing loading skeletons, zero-data empty states, and fault recovery."
      },
      {
        "name": "motion / theme",
        "type": "MotionMode / 'light' | 'dark'",
        "defaultValue": "'stepped' / undefined",
        "description": "Controls 12fps stepped count-up/chart wipe motion and explicit light/dark theme override."
      },
      {
        "name": "idPrefix / showSandboxControls",
        "type": "string / boolean",
        "defaultValue": "useId() / true",
        "description": "Instance-scoped ID prefix (safe for mounting multiple dashboards on one page) and sandbox toolbar toggle."
      },
      {
        "name": "headerSlot / footerSlot / className",
        "type": "React.ReactNode / React.ReactNode / string",
        "defaultValue": "undefined",
        "description": "Optional header/footer slots and outer container className."
      },
      {
        "name": "range / focus / onSelectFocus / chartHeight / datasetState / comparisonMode / onRestorePopulated",
        "type": "RevenueRecoveryCoreScenesProps",
        "defaultValue": "required / optional",
        "description": "Props accepted by the exported <RevenueRecoveryCoreScenes> subcomponent shared between the homepage and the Analytics Dashboard block."
      }
    ],
    "customizationGuidance": [
      "Use <RevenueRecoveryCoreScenes> when embedding only the 4 expressive hero panels (C-01..C-04), or <AnalyticsDashboard> for the full analytical workstation with period/segment/daily tables.",
      "Replace SERIES_180D and computeRangeSummary() in analytics-dashboard.tsx with your warehouse query results while keeping ToneAreaDatum and ToneBarItem shapes."
    ],
    "a11yNotes": [
      "C-01 ToneAreaChart exposes keyboard Left/Right crosshair navigation and a collapsible semantic data table (<details className=\"f12-tbl\">).",
      "Inspecting any daily ledger row opens modal C-05 (<dialog>.showModal()) with full per-intervention and per-segment attribution breakdowns and focus restoration on close."
    ],
    "knownLimitations": [
      "CSV summary export copies a deterministic tabular ledger snapshot to the clipboard / toast notification in the browser sandbox rather than streaming a backend file download."
    ],
    "usageTemplate": "import { AnalyticsDashboard } from '@/components/frame12/blocks/analytics-dashboard';\n\nexport default function AnalyticsPage() {\n  return (\n    <AnalyticsDashboard\n      defaultRange={30}\n      defaultComparisonMode=\"prior\"\n      showSandboxControls={false}\n    />\n  );\n}"
  }
];

export const CATALOG: CatalogEntry[] = RAW_CATALOG.map((entry) => ({
  ...entry,
  registryUrl: `${REGISTRY_BASE_URL}/${entry.slug}.json`,
}));

export const BLOCK_CATALOG: BlockCatalogEntry[] = RAW_BLOCK_CATALOG.map((entry) => ({
  ...entry,
  registryUrl: `${REGISTRY_BASE_URL}/${entry.slug}.json`,
}));

export function getCatalogEntry(slug: string): CatalogEntry | undefined {
  return CATALOG.find((c) => c.slug === slug);
}

export function getBlockCatalogEntry(slug: string): BlockCatalogEntry | undefined {
  return BLOCK_CATALOG.find((b) => b.slug === slug);
}
