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
import { useSiteSettings } from '@/components/site-shell';
import { CopyCommand } from '@/components/copy-command';
import { REGISTRY_BASE_URL } from '@/lib/config';

type SetupTrack = 'new' | 'existing';

const TRACK_OPTIONS: Array<{ value: SetupTrack; label: string; unit: string }> = [
  { value: 'new', label: 'New', unit: 'next app' },
  { value: 'existing', label: 'Existing', unit: 'project' },
];

const LAYOUT_FONT_SNIPPET = `import {
  Dela_Gothic_One,
  Zen_Kaku_Gothic_New,
  M_PLUS_1_Code,
} from 'next/font/google';
import '@/styles/frame12.css';

const displayFont = Dela_Gothic_One({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-f-display',
  display: 'swap',
});
const bodyFont = Zen_Kaku_Gothic_New({
  weight: ['400', '500', '700'],
  subsets: ['latin'],
  variable: '--font-f-body',
  display: 'swap',
});
const monoFont = M_PLUS_1_Code({
  weight: ['400', '500', '700'],
  subsets: ['latin'],
  variable: '--font-f-mono',
  display: 'swap',
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={\`\${displayFont.variable} \${bodyFont.variable} \${monoFont.variable}\`}>
      <body>{children}</body>
    </html>
  );
}`;

const FIRST_SHEET_SNIPPET = `import {
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
    <Sheet pegs motion="stepped">
      <header className="f12-hd">
        <div className="f12-hd-text">
          <p className="f12-eyebrow">Fernwood Supply Co. <Tag>Live</Tag></p>
          <h1 className="f12-title">Revenue recovery</h1>
        </div>
      </header>

      <Scene gutter="scene" layout="split">
        <Panel ${'cut'}="C-01" label="Recovered revenue over time">
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
          top={{ ${'cut'}: 'C-02', label: 'Incremental profit', children: <Metric label="Incremental profit" value={38420} format={fmtCurrency} /> }}
          bottom={{ ${'cut'}: 'C-03', label: 'Conversion lift', children: <Metric label="Conversion lift" value={55} format={(v) => \`+\${v} bps\`} /> }}
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
  const { theme, motion } = useSiteSettings();
  const [track, setTrack] = React.useState<SetupTrack>('new');

  return (
    <Sheet pegs motion={motion} theme={theme}>
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

      <Scene gutter="scene" layout="split">
        <Panel cut="C-01" label="Step 1: Project setup and self-hosted fonts">
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
                  : 'Bind --font-f-display, --font-f-body, and --font-f-mono in app/layout.tsx'}
              </h2>
              <p className="f12-body-copy">
                {track === 'new'
                  ? 'Create a fresh Next.js App Router project with TypeScript, then load the display, body, and monospace typefaces through next/font/google so fonts are self-hosted at build time.'
                  : 'In your existing app/layout.tsx, bind the three CSS custom properties (--font-f-display, --font-f-body, --font-f-mono) on <html> so every FRAME/12 component picks up the exact type scale without touching your existing font classes.'}
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
            cut: 'C-02',
            label: 'Step 2: Add components via shadcn CLI',
            children: (
              <div className="f12-stack-pair">
                <div className="f12-row-pair">
                  <Tag>Step 2 · Registry Install</Tag>
                </div>
                <h2 className="f12-section-title">Add the registry kit</h2>
                <p className="f12-muted-copy">
                  Install the complete kit (<code className="f12-code-inline">frame12.json</code>) or
                  pick individual components into <code className="f12-code-inline">components/frame12/</code>. Note:{' '}
                  <code className="f12-code-inline">frame12.dev</code> is the canonical deployment
                  domain; to install locally right now, run the site server and point the CLI at{' '}
                  <code className="f12-code-inline">http://localhost:3000/r/frame12.json</code>:
                </p>
                <CopyCommand
                  id="start-copy-full-kit"
                  label="Full kit"
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
            cut: 'C-03',
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
                  <code className="f12-code-inline">@theme</code> token utilities:
                </p>
                <CopyCommand
                  id="start-copy-styles-only"
                  label="Stylesheet registry item"
                  command={`npx shadcn@latest add ${REGISTRY_BASE_URL}/frame12-styles.json`}
                />
              </div>
            ),
          }}
        />
      </Scene>

      <Scene gutter="scene" layout="stack">
        <Panel cut="C-04" label="Step 4: Compose your first Sheet, Scene, and Panel">
          <div className="f12-stack-scene">
            <div className="f12-row-between">
              <div className="f12-stack-pair">
                <div className="f12-row-pair">
                  <Tag>Step 4 · First Storyboard Screen</Tag>
                  <span className="f12-mono-note">
                    Sheet → Scene (gutter=&quot;scene&quot;, layout=&quot;split&quot;) → Panel + PanelPair
                  </span>
                </div>
                <h2 className="f12-section-title">
                  Compose your first Sheet + Scene + Panel
                </h2>
                <p className="f12-body-copy">
                  Number each panel sequentially in reading order starting at cut 01. Place your
                  establishing chart in the wide left column and pair coupled KPIs across a 12px
                  slanted gutter on the right.
                </p>
              </div>
              <Link href="/components" className="f12-link-btn" id="start-link-components">
                Browse 19 Components
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
        <Panel cut="C-05" label="Step 5: Enforce grammar with ESLint and check-frame12.mjs">
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
