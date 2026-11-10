'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Sheet,
  Scene,
  Panel,
  PanelPair,
  SegmentedControl,
  Tag,
  Badge,
} from '@/components/frame12';
import { CopyCommand } from '@/components/copy-command';
import { REGISTRY_BASE_URL } from '@/lib/config';
import { COMPONENT_COUNT } from '@/lib/catalog';

type SetupTrack = 'new' | 'existing';

const TRACK_OPTIONS: Array<{ value: SetupTrack; label: string; unit: string }> = [
  { value: 'new', label: 'New', unit: 'next app' },
  { value: 'existing', label: 'Existing', unit: 'project' },
];

const LAYOUT_FONT_SNIPPET = `import { Dela_Gothic_One, Zen_Kaku_Gothic_New, M_PLUS_1_Code } from 'next/font/google';
import '@/styles/frame12.css';

const displayFont = Dela_Gothic_One({ weight: '400', subsets: ['latin'], variable: '--font-dela-gothic-one', display: 'swap' });
const bodyFont = Zen_Kaku_Gothic_New({ weight: ['400', '500', '700'], subsets: ['latin'], variable: '--font-zen-kaku-gothic-new', display: 'swap' });
const monoFont = M_PLUS_1_Code({
  weight: ['400', '500', '700'],
  subsets: ['latin'],
  variable: '--font-m-plus-1-code',
  display: 'swap',
  adjustFontFallback: false,
  fallback: ['f12MonoFallbackConsolas', 'f12MonoFallback', 'ui-monospace', 'monospace'],
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={\`\${displayFont.variable} \${bodyFont.variable} \${monoFont.variable}\`}>
      <body>{children}</body>
    </html>
  );
}`;

const FIRST_SHEET_SNIPPET = `'use client';

import {
  Sheet,
  Scene,
  Panel,
  PanelPair,
  Metric,
  ToneAreaChart,
  Tag,
  fmtCurrency,
} from '@/components/frame12';

export default function RecoveryPage() {
  return (
    <Sheet autoCut pegs motion="stepped">
      <header className="f12-hd">
        <div className="f12-hd-text">
          <p className="f12-eyebrow">Fernwood Supply Co. <Tag>Live</Tag></p>
          <h1 className="f12-title">Revenue recovery</h1>
        </div>
      </header>

      <Scene gutter="scene" layout="split">
        <Panel label="Recovered revenue over time">
          <Metric label="Recovered revenue" value={120054} format={fmtCurrency} big />
          <ToneAreaChart
            data={[
              { label: 'Oct 29', value: 3820 },
              { label: 'Oct 30', value: 4410 },
              { label: 'Oct 31', value: 5190 },
            ]}
            seriesLabel="Recovered revenue"
            labelColumnHeader="Date"
            formatValue={fmtCurrency}
          />
        </Panel>
        <PanelPair
          top={{ label: 'Incremental profit', children: <Metric label="Incremental profit" value={38420} format={fmtCurrency} /> }}
          bottom={{ label: 'Conversion lift', children: <Metric label="Conversion lift" value={55} format={(v) => \`+\${Math.round(v)} bps\`} /> }}
        />
      </Scene>
    </Sheet>
  );
}`;

const ESLINT_SNIPPET = `// eslint.config.mjs
import frame12Rules from './skills/frame12/eslint.frame12.mjs';

export default [
  ...frame12Rules,
];`;

export default function GetStartedPage() {
  const [track, setTrack] = React.useState<SetupTrack>('new');

  return (
    <Sheet autoCut pegs>
      <header className="f12-hd">
        <div className="f12-hd-text">
          <p className="f12-eyebrow">
            Installation & Onboarding
            <Tag>Next.js App Router + TypeScript</Tag>
          </p>
          <h1 className="f12-title">Get started with FRAME/12</h1>
          <p className="f12-muted-copy">
            Go from zero to a verified FRAME/12 storyboard sheet in five steps. Switch between the{' '}
            <strong>New Next.js App</strong> and <strong>Existing Project</strong> tracks below.
          </p>
        </div>
        <SegmentedControl
          idPrefix="start-track"
          ariaLabel="Installation track"
          options={TRACK_OPTIONS}
          value={track}
          onChange={setTrack}
        />
      </header>

      <Scene gutter="scene" layout="stack">
        <Panel variant="quiet" label="1-minute onboarding summary">
          <div className="f12-stack-pair" id="onboarding-one-minute-summary">
            <div className="f12-row-between">
              <div className="f12-row-pair">
                <Tag status="info">60-Second Overview</Tag>
                <span className="f12-mono-note">
                  What · Why · What to Build · Install · Customize · Agent Skill · Grammar Enforcement
                </span>
              </div>
              <div className="f12-row-pair">
                <Link href="/blocks/developer-console" className="f12-link-btn">
                  Developer Console →
                </Link>
                <Link href="/blocks/workspace-settings" className="f12-link-btn">
                  Workspace Settings →
                </Link>
                <Link href="/blocks/analytics-dashboard" className="f12-link-btn">
                  Analytics Dashboard →
                </Link>
              </div>
            </div>
            <h2 className="f12-section-title">Understand FRAME/12 in 1 minute</h2>
            <div className="f12-console-kv-list">
              <div className="f12-console-kv-item">
                <span className="f12-console-kv-label">1. What FRAME/12 Is &amp; Why It Exists</span>
                <span className="f12-console-kv-value">
                  Page-Composition &amp; Cel-Animation Interface System (41 Registry Payloads)
                </span>
                <span className="f12-mono-note">
                  Replaces generic SaaS cards, color gradients, and continuous micro-animations with
                  2.5px mitered ink panels, 45° rotated SVG screentone fills, sequential C-01..C-0n
                  cuts, 1px Quiet operational ledgers, and 12fps stepped motion (&quot;on twos&quot;).
                </span>
              </div>
              <div className="f12-console-kv-item">
                <span className="f12-console-kv-label">2. What You Can Build &amp; How to Install</span>
                <span className="f12-console-kv-value">
                  26 Core Components + 5 Primitive Adapters + 3 Full Application Blocks (MIT)
                </span>
                <span className="f12-mono-note">
                  Build analytics workstations, API control planes, dense settings ledgers, and
                  product pages. Published in the official shadcn directory as @frame12: run npx
                  shadcn@latest add @frame12/frame12 (or @frame12/sheet, @frame12/developer-console,
                  @frame12/workspace-settings, @frame12/analytics-dashboard) or use full URLs (
                  {REGISTRY_BASE_URL}/frame12.json).
                </span>
              </div>
              <div className="f12-console-kv-item">
                <span className="f12-console-kv-label">
                  3. How to Customize, Guide Agents &amp; Enforce Grammar
                </span>
                <span className="f12-console-kv-value">
                  --f-* Token Overrides · Expressive/Quiet Hierarchy · SKILL.md + check-frame12.mjs
                </span>
                <span className="f12-mono-note">
                  Override --f-* CSS variables in globals.css, mix Expressive hero panels with{' '}
                  &lt;Panel variant=&quot;quiet&quot;&gt; and compact density, load skills/frame12/SKILL.md (or
                  /llms-full.txt) into your AI coding agent, and run node scripts/check-frame12.mjs in
                  CI. All {COMPONENT_COUNT} components and 3 blocks remain free under MIT; see
                  docs/roadmap/v0.3-v0.4-roadmap.md and share feedback via GitHub Issues/Discussions.
                </span>
              </div>
            </div>
          </div>
        </Panel>
      </Scene>

      <Scene gutter="scene" layout="split">
        <Panel label="Step 1: Project setup and self-hosted fonts">
          <div className="f12-stack-scene">
            <div className="f12-stack-pair">
              <div className="f12-row-pair">
                <Badge burst={false}>
                  {track === 'new'
                    ? 'Step 1 · New Next.js App'
                    : 'Step 1 · Existing Next.js App'}
                </Badge>
                <span className="f12-mono-note">Zero runtime Google Fonts requests</span>
              </div>
              <h2 className="f12-section-title">
                {track === 'new'
                  ? 'Scaffold Next.js and bind the three font variables'
                  : 'Bind --font-dela-gothic-one, --font-zen-kaku-gothic-new, and --font-m-plus-1-code'}
              </h2>
              <p className="f12-body-copy">
                {track === 'new'
                  ? 'Create a fresh Next.js App Router project with TypeScript, then load the display, body, and monospace typefaces through next/font/google (or install frame12-base.json) so fonts are self-hosted at build time.'
                  : 'In your existing app/layout.tsx, bind --font-dela-gothic-one, --font-zen-kaku-gothic-new, and --font-m-plus-1-code on <html> (or install frame12-base.json) so frame12.css resolves --font-f-display, --font-f-body, and --font-f-mono with their fallback stacks intact.'}
              </p>
            </div>

            {track === 'new' ? (
              <CopyCommand
                id="start-copy-create-next"
                label="1a. Create Next.js project"
                command="npx create-next-app@latest my-frame12-app --typescript --app --eslint"
              />
            ) : (
              <CopyCommand
                id="start-copy-shadcn-init"
                label="1a. Verify shadcn components.json"
                command="npx shadcn@latest init"
              />
            )}

            <CopyCommand
              id="start-copy-layout"
              label="1b. Configure app/layout.tsx"
              command={LAYOUT_FONT_SNIPPET}
            />
          </div>
        </Panel>

        <PanelPair
          top={{
            label: 'Step 2: Add components via shadcn CLI',
            children: (
              <div className="f12-stack-pair">
                <div className="f12-row-pair">
                  <Tag>Step 2 · Registry Install (@frame12)</Tag>
                </div>
                <h2 className="f12-section-title">Add the registry kit</h2>
                <p className="f12-muted-copy">
                  Install the complete kit via the official{' '}
                  <code className="f12-code-inline">@frame12</code> namespace (or pick individual
                  components like <code className="f12-code-inline">@frame12/sheet</code> or blocks
                  like <code className="f12-code-inline">@frame12/developer-console</code>) into{' '}
                  <code className="f12-code-inline">components/frame12/</code>, or use the full
                  manifest URL (<code className="f12-code-inline">{REGISTRY_BASE_URL}/frame12.json</code>):
                </p>
                <CopyCommand
                  id="start-copy-full-kit"
                  label="Full kit (@frame12 namespace)"
                  command="npx shadcn@latest add @frame12/frame12"
                />
                <CopyCommand
                  id="start-copy-url-kit"
                  label="Full URL alternative"
                  command={`npx shadcn@latest add ${REGISTRY_BASE_URL}/frame12.json`}
                />
                <CopyCommand
                  id="start-copy-local-kit"
                  label="Local dev server install"
                  command="npx shadcn@latest add http://localhost:3000/r/frame12.json"
                />
              </div>
            ),
          }}
          bottom={{
            label: 'Step 3: Choose standalone CSS or Tailwind v4',
            children: (
              <div className="f12-stack-pair">
                <div className="f12-row-pair">
                  <Tag>Step 3 · Stylesheet</Tag>
                </div>
                <h2 className="f12-section-title">Import frame12.css</h2>
                <p className="f12-muted-copy">
                  Every component works standalone with{' '}
                  <code className="f12-code-inline">frame12.css</code>. Using Tailwind v4? Import{' '}
                  <code className="f12-code-inline">frame12-tailwind.css</code> for{' '}
                  <code className="f12-code-inline">@theme</code> token utilities. Put any custom{' '}
                  <code className="f12-code-inline">--f-*</code> overrides in your own stylesheet
                  (never edit <code className="f12-code-inline">frame12.css</code> directly), and pass{' '}
                  <code className="f12-code-inline">--overwrite</code> when adding or upgrading
                  components later:
                </p>
                <CopyCommand
                  id="start-copy-styles-only"
                  label="Stylesheet registry item (@frame12 or URL)"
                  command="npx shadcn@latest add @frame12/frame12-styles"
                />
              </div>
            ),
          }}
        />
      </Scene>

      <Scene gutter="scene" layout="stack">
        <Panel label="Step 4: Compose your first Sheet, Scene, and Panel">
          <div className="f12-stack-scene">
            <div className="f12-row-between">
              <div className="f12-stack-pair">
                <div className="f12-row-pair">
                  <Tag>Step 4 · First Storyboard Screen</Tag>
                  <span className="f12-mono-note">
                    Sheet (autoCut) → Scene (gutter=&quot;scene&quot;, layout=&quot;split&quot;) → Panel + PanelPair
                  </span>
                </div>
                <h2 className="f12-section-title">
                  Compose your first Sheet + Scene + Panel
                </h2>
                <p className="f12-body-copy">
                  Enable <code className="f12-code-inline">&lt;Sheet autoCut&gt;</code> so panels
                  number automatically in reading order starting at cut 01. Place your establishing
                  chart in the wide left column and pair coupled KPIs across a 12px slanted gutter
                  on the right.
                </p>
              </div>
              <Link href="/components" className="f12-link-btn" id="start-link-components">
                Browse {COMPONENT_COUNT} Components
              </Link>
            </div>

            <CopyCommand
              id="start-copy-first-sheet"
              label="app/page.tsx"
              command={FIRST_SHEET_SNIPPET}
            />
          </div>
        </Panel>
      </Scene>

      <Scene gutter="scene" layout="stack">
        <Panel label="Step 5: Enforce grammar with ESLint and check-frame12.mjs">
          <div className="f12-stack-scene">
            <div className="f12-row-between">
              <div className="f12-stack-pair">
                <div className="f12-row-pair">
                  <Tag>Step 5 · Automated Guardrails</Tag>
                  <span className="f12-mono-note">Automated grammar checks in CI and AI agent loops</span>
                </div>
                <h2 className="f12-section-title">
                  Wire check-frame12.mjs and ESLint into your test script
                </h2>
                <p className="f12-body-copy">
                  Run <code className="f12-code-inline">node scripts/check-frame12.mjs</code> in CI
                  and enable <code className="f12-code-inline">eslint.frame12.mjs</code> in your
                  editor so hard-coded colors, illegal gutters, marker misuse, and out-of-order cut
                  numbers are caught immediately.
                </p>
              </div>
              <Link href="/agents" className="f12-link-btn marker" id="start-link-agents">
                Agent Skill Docs
              </Link>
            </div>

            <Scene gutter="scene" layout="equal">
              <CopyCommand
                id="start-copy-cli-check"
                label="CLI grammar check"
                command="node scripts/check-frame12.mjs src app"
              />
              <CopyCommand
                id="start-copy-eslint"
                label="ESLint flat config"
                command={ESLINT_SNIPPET}
              />
            </Scene>
          </div>
        </Panel>
      </Scene>
    </Sheet>
  );
}
