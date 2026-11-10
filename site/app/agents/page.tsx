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
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from '@/components/frame12';
import { CopyCommand } from '@/components/copy-command';
import { REGISTRY_BASE_URL } from '@/lib/config';

type PromptKey = 'settings' | 'landing' | 'table';

const PROMPT_OPTIONS: Array<{ value: PromptKey; label: string; unit: string }> = [
  { value: 'settings', label: '01', unit: 'settings' },
  { value: 'landing', label: '02', unit: 'landing' },
  { value: 'table', label: '03', unit: 'ledger' },
];

const EXAMPLE_PROMPTS: Record<
  PromptKey,
  { title: string; file: string; summary: string; promptText: string }
> = {
  settings: {
    title: '01 · SaaS Workspace & Dispatch Settings',
    file: 'eval/prompts/01-settings.md',
    summary:
      'Environment switcher, validated threshold input with marker alert, paired delivery health KPIs (12px slanted gutter), API keys table, and revocation modal.',
    promptText: `Build a workspace and notification settings page for a checkout recovery SaaS product using @/components/frame12 and following skills/frame12/SKILL.md.
1. Sheet Header: registration pegs, eyebrow tags, title "Workspace & Dispatch Settings", and SegmentedControl for Production / Staging / Sandbox.
2. Scene 1 (gutter="scene", layout="split"):
   - Panel 1 (establishing): Input fields for Workspace display name, Alert lift threshold (%) with validation alert when < 10, Webhook endpoint URL, Select for Primary delivery channel, and Save/Reset buttons with a Tooltip.
   - PanelPair (2 & 3 across 12px slanted gutter): Webhook delivery rate Metric + ToneSpark over Mean dispatch latency Metric + ToneSpark.
3. Scene 2 (gutter="change", layout="equal"):
   - Panel 4: API Signing Keys semantic Table + DropdownMenu.
   - Panel 5: Danger Zone with Balloon warning and modal Dialog (cut 6) to revoke active signing secret.`,
  },
  landing: {
    title: '02 · Product Landing Hero + Capability Breakdown',
    file: 'eval/prompts/02-landing-hero.md',
    summary:
      'Display headline, 7/30/90-day live interactive recovery showcase, paired margin & lift KPIs, capability comparison ToneBarList, and trial onboarding modal.',
    promptText: `Build a product landing page hero, live interactive metric/chart showcase, and feature breakdown using @/components/frame12 and following skills/frame12/SKILL.md.
1. Sheet Header: registration pegs, Tag ("Release 2.4"), Badge ("On Twos · 12fps"), headline "Checkout Recovery Drawn in Ink", and 7/30/90-day SegmentedControl.
2. Scene 1 (gutter="scene", layout="split"):
   - Panel 1: big Metric ("Recovered checkout revenue") + ToneAreaChart with 45° screentone fill, speech-balloon peak callout, and collapsible data table.
   - PanelPair (2 & 3): Net margin retained Metric + ToneSpark over Checkout conversion lift Metric + ToneSpark.
3. Scene 2 (gutter="change", layout="equal"):
   - Panel 4: ToneBarList ranking recovery capabilities; clicking a row overlays its comparison curve onto Panel 1's chart.
   - Panel 5: Architecture guarantees Table, standalone Balloon callout, and trial onboarding Dialog (cut 6).`,
  },
  table: {
    title: '03 · Order Recovery Ledger & Dispatch Audit',
    file: 'eval/prompts/03-data-table.md',
    summary:
      'Multi-criteria filter bar, semantic order recovery table, stepped count-up summary KPIs, channel share ToneBarList, and webhook replay dialog.',
    promptText: `Build an order recovery ledger data table screen with multi-criteria filtering, summary KPIs, and row inspection using @/components/frame12 and following skills/frame12/SKILL.md.
1. Sheet Header: registration pegs, title "Order Recovery Ledger", and SegmentedControl to filter by All / Recovered / Pending / Holdout.
2. Scene 1 (gutter="scene", layout="split"):
   - Panel 1: Filter bar (Search Input, Channel Select, Export DropdownMenu, Reset Button) + semantic Table of order dispatches.
   - PanelPair (2 & 3): Filtered recovery total Metric + ToneSpark over Filtered recovery rate Metric + Balloon callout.
3. Scene 2 (gutter="change", layout="equal"):
   - Panel 4: ToneBarList breaking down recovered revenue across channels; clicking a bar filters the table.
   - Panel 5: Dispatch inspection timeline + modal Dialog (cut 6) to inspect and replay webhook payload headers.`,
  },
};

const EIGHT_RULES = [
  {
    num: '01',
    rule: 'Tokens, not literals (color-literal)',
    spec: 'Use --f-* and --font-f-* custom properties exclusively. Never write raw hex, rgb/hsl color functions, or font-family names outside frame12.css.',
  },
  {
    num: '02',
    rule: 'Gutter grammar (illegal-gutter)',
    spec: 'Gutters inside Scene come strictly from 12px (pair), 20px (scene), and 32px (change). Arbitrary gaps (8px, 16px, 24px) are rejected.',
  },
  {
    num: '03',
    rule: 'Sequential cut numbers (cut-order)',
    spec: 'Number panels sequentially starting at C-01 in reading order. Visual order, reading order, and DOM order always match.',
  },
  {
    num: '04',
    rule: 'Marker yellow discipline (marker-misuse)',
    spec: '--f-marker only sits as a background under --f-marker-ink text or inked target dots. Never a line, chart series, or text color.',
  },
  {
    num: '05',
    rule: 'Motion on twos',
    spec: 'Discrete state changes step at 12fps (83.33ms poses). Hover, scroll, drag, typing, and crosshairs stay immediate. Reduced motion forces instant cuts. Ink line art never draws on load (the ink-autoplay lint rule).',
  },
  {
    num: '06',
    rule: 'Accessibility (WCAG AA)',
    spec: '4.5:1 body / 3:1 large text contrast in light & dark themes, visible :focus-visible outline, named controls, and a <details className="f12-tbl"> table for every chart.',
  },
  {
    num: '07',
    rule: 'Describe the craft, never name people',
    spec: 'Never cite specific artists, studios, or franchises in code, comments, or copy. Refer strictly to panels, screentone, registration pegs, exposure sheets, and twos.',
  },
  {
    num: '08',
    rule: 'Zero external chart or motion libraries',
    spec: 'Do not import recharts, chart.js, d3, framer-motion, or gsap. Use @/components/frame12 and @/hooks/use-on-twos.',
  },
];

export default function AgentsPage() {
  const [activePrompt, setActivePrompt] = React.useState<PromptKey>('settings');
  const currentPrompt = EXAMPLE_PROMPTS[activePrompt];

  return (
    <Sheet autoCut pegs>
      <header className="f12-hd">
        <div className="f12-hd-text">
          <p className="f12-eyebrow">
            AI Agent Skill · Static Rule Linter · Guardrail Fixture Suite
            <Tag>skills/frame12/SKILL.md</Tag>
          </p>
          <h1 className="f12-title">FRAME/12 for coding agents</h1>
          <p className="f12-muted-copy">
            Most design systems degrade into generic cards and arbitrary spacing after two prompts.
            FRAME/12 pairs a compact agent skill (<code className="f12-code-inline">SKILL.md</code>)
            with a deterministic static rule checker (
            <code className="f12-code-inline">check-frame12.mjs</code>) so AI agents can catch and
            fix layout, token, and motion drift automatically.
          </p>
        </div>
      </header>

      <Scene gutter="scene" layout="split">
        <Panel label="Supported coding agents and skill installation">
          <div className="f12-stack-scene">
            <div className="f12-stack-pair">
              <div className="f12-row-pair">
                <Badge burst={false}>Claude Code · Cursor · Antigravity · Windsurf</Badge>
                <span className="f12-mono-note">Zero-config markdown skill</span>
              </div>
              <h2 className="f12-section-title">Drop SKILL.md into your agent workspace</h2>
              <p className="f12-body-copy">
                The skill teaches the 8 non-negotiable grammar rules, storyboard panel composition,
                component selection table, and pre-flight verification loop in under 140 lines—with
                progressive disclosure references for full TypeScript signatures and drift fixes.
              </p>
            </div>

            <Table>
              <TableCaption>Standard skill locations for AI coding assistants</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Agent</TableHead>
                  <TableHead scope="col">Workspace Path</TableHead>
                  <TableHead scope="col">Activation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>
                    <strong>Antigravity / Claude Code</strong>
                  </TableCell>
                  <TableCell>
                    <code className="f12-code-inline">.claude/skills/frame12/SKILL.md</code> or{' '}
                    <code className="f12-code-inline">skills/frame12/SKILL.md</code>
                  </TableCell>
                  <TableCell>Automatic frontmatter discovery on UI tasks</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>Cursor</strong>
                  </TableCell>
                  <TableCell>
                    <code className="f12-code-inline">.cursor/rules/frame12.mdc</code> (copy from
                    SKILL.md)
                  </TableCell>
                  <TableCell>Attached to *.tsx and *.css globs</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>Windsurf / Codex / Generic</strong>
                  </TableCell>
                  <TableCell>
                    <code className="f12-code-inline">AGENTS.md</code> +{' '}
                    <code className="f12-code-inline">skills/frame12/</code>
                  </TableCell>
                  <TableCell>Referenced in repository instructions</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </Panel>

        <PanelPair
          top={{
            label: 'Install skill and components',
            children: (
              <div className="f12-stack-pair">
                <div className="f12-row-pair">
                  <Tag>Step 1 · Registry + Skill</Tag>
                </div>
                <h2 className="f12-section-title">Add the kit</h2>
                <p className="f12-muted-copy">
                  Install the component registry via the official{' '}
                  <code className="f12-code-inline">@frame12</code> namespace (or URL) and copy{' '}
                  <code className="f12-code-inline">skills/frame12/</code> into your repo:
                </p>
                <CopyCommand
                  id="agents-copy-registry"
                  label="Install FRAME/12 registry (@frame12 namespace)"
                  command="npx shadcn@latest add @frame12/frame12"
                />
                <CopyCommand
                  id="agents-copy-registry-url"
                  label="Full manifest URL alternative"
                  command={`npx shadcn@latest add ${REGISTRY_BASE_URL}/frame12.json`}
                />
              </div>
            ),
          }}
          bottom={{
            label: 'Run static grammar checker',
            children: (
              <div className="f12-stack-pair">
                <div className="f12-row-pair">
                  <Tag>Step 2 · Automated Linter</Tag>
                </div>
                <h2 className="f12-section-title">Verify with check-frame12.mjs</h2>
                <p className="f12-muted-copy">
                  Catches color literals, illegal gutters, marker misuse, out-of-order cuts, and raw
                  shadcn imports in milliseconds:
                </p>
                <CopyCommand
                  id="agents-copy-linter"
                  label="Run grammar checker"
                  command="node scripts/check-frame12.mjs src app"
                />
              </div>
            ),
          }}
        />
      </Scene>

      <Scene gutter="scene" layout="stack">
        <Panel label="The 8 non-negotiable rules">
          <div className="f12-stack-pair">
            <div className="f12-row-pair">
              <Tag>Enforced Grammar</Tag>
              <span className="f12-mono-note">
                Static source &amp; regex linter + Playwright DOM verification
              </span>
            </div>
            <h2 className="f12-section-title">The 8 non-negotiable rules</h2>
            <Table>
              <TableCaption>
                Every screen generated with skills/frame12/SKILL.md is verified against these 8
                rules.
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">#</TableHead>
                  <TableHead scope="col">Rule</TableHead>
                  <TableHead scope="col">Requirement</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {EIGHT_RULES.map((item) => (
                  <TableRow key={item.num}>
                    <TableCell>
                      <Tag>{item.num}</Tag>
                    </TableCell>
                    <TableCell>
                      <strong>{item.rule}</strong>
                    </TableCell>
                    <TableCell>{item.spec}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Panel>
      </Scene>

      <Scene gutter="scene" layout="split">
        <Panel label="Worked agent prompts">
          <div className="f12-stack-scene">
            <div className="f12-row-between">
              <div className="f12-stack-pair">
                <div className="f12-row-pair">
                  <Tag>Benchmark Prompts</Tag>
                  <span className="f12-mono-note">{currentPrompt.file}</span>
                </div>
                <h2 className="f12-section-title">{currentPrompt.title}</h2>
                <p className="f12-muted-copy">{currentPrompt.summary}</p>
              </div>
              <SegmentedControl
                idPrefix="agent-prompt"
                ariaLabel="Select example prompt"
                options={PROMPT_OPTIONS}
                value={activePrompt}
                onChange={setActivePrompt}
              />
            </div>

            <CopyCommand
              id="agents-copy-prompt"
              label={`Prompt (${currentPrompt.file})`}
              command={currentPrompt.promptText}
            />
          </div>
        </Panel>

        <Panel label="Milestone 3 reproduction benchmark results">
          <div className="f12-stack-pair">
            <div className="f12-row-pair">
              <Badge burst={false}>eval/RESULTS.md</Badge>
              <span className="f12-mono-note">3 product archetypes · 17/17 linter unit tests</span>
            </div>
            <h2 className="f12-section-title">Reproduction benchmark matrix</h2>
            <p className="f12-muted-copy">
              Three non-dashboard product archetypes were built from plain prompts using only{' '}
              <code className="f12-code-inline">SKILL.md</code> and{' '}
              <code className="f12-code-inline">@/components/frame12</code>, then audited across
              desktop (1280px) and mobile (390px) viewports in light and dark themes.
            </p>
            <Table>
              <TableCaption>
                Summary from eval/RESULTS.md (including pre-check mobile container-query fix cycle)
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Verification Check</TableHead>
                  <TableHead scope="col">01-settings</TableHead>
                  <TableHead scope="col">02-landing</TableHead>
                  <TableHead scope="col">03-table</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>check-frame12.mjs violations</TableCell>
                  <TableCell>0</TableCell>
                  <TableCell>0</TableCell>
                  <TableCell>0</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>TypeScript (tsc --noEmit)</TableCell>
                  <TableCell>Pass</TableCell>
                  <TableCell>Pass</TableCell>
                  <TableCell>Pass</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Sequential cuts & reading order</TableCell>
                  <TableCell>5 + modal</TableCell>
                  <TableCell>5 + modal</TableCell>
                  <TableCell>5 + modal</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Gutters (12 / 20 / 32px only)</TableCell>
                  <TableCell>Pass</TableCell>
                  <TableCell>Pass</TableCell>
                  <TableCell>Pass</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>WCAG AA contrast (Light & Dark)</TableCell>
                  <TableCell>Pass</TableCell>
                  <TableCell>Pass</TableCell>
                  <TableCell>Pass</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Visible :focus-visible (all tab stops)</TableCell>
                  <TableCell>100%</TableCell>
                  <TableCell>100%</TableCell>
                  <TableCell>100%</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>1280px & 390px zero overflow</TableCell>
                  <TableCell>Pass</TableCell>
                  <TableCell>Pass</TableCell>
                  <TableCell>Pass</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </Panel>
      </Scene>

      <Scene gutter="scene" layout="stack">
        <Panel variant="quiet" label="4-condition × 6-task guardrail and reference fixture suite">
          <div className="f12-stack-pair" id="agents-four-condition-eval">
            <div className="f12-row-pair">
              <Tag status="info">eval/agent-eval/results/REPORT.md</Tag>
              <span className="f12-mono-note">
                4 conditions × 6 application tasks (24 fixture screens) · Universal Quality vs. FRAME/12 Grammar
              </span>
            </div>
            <h2 className="f12-section-title">
              4-condition × 6-task guardrail &amp; reference fixture suite
            </h2>
            <p className="f12-body-copy">
              Regression-tests 6 application tasks (
              <code className="f12-code-inline">01-dashboard</code>,{' '}
              <code className="f12-code-inline">02-settings</code>,{' '}
              <code className="f12-code-inline">03-developer-console</code>,{' '}
              <code className="f12-code-inline">04-data-heavy</code>,{' '}
              <code className="f12-code-inline">05-landing-page</code>,{' '}
              <code className="f12-code-inline">06-multi-step-form</code>) across 4 committed
              fixture conditions: a conventional shadcn/Tailwind baseline (Condition 1), a negative
              fixture suite with planted linter &amp; runtime violations across all 6 static checker
              rules (Condition 2), pre-checker reference fixtures with planted single-rule drift in
              Tasks 02 and 04 (Condition 3), and checker-verified reference fixtures after
              remediation (Condition 4). Universal UI quality metrics (esbuild compile,{' '}
              <code className="f12-code-inline">tsc --noEmit</code>, axe WCAG AA, light/dark
              contrast, keyboard reachability, interactive workflows, 1280px/390px overflow) are
              measured separately from FRAME/12 grammar compliance so the conventional baseline
              (Condition 1) is never penalized for FRAME/12-specific rules.
            </p>
            <CopyCommand
              id="agents-copy-eval-runner"
              label="Run 24-screen guardrail fixture suite"
              command="node eval/agent-eval/run-eval.mjs"
            />
            <Table density="compact">
              <TableCaption>
                Deterministic fixture results from eval/agent-eval/results/summary.json (6 application tasks per condition; no live LLM calls)
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Condition</TableHead>
                  <TableHead scope="col">Universal UI Quality</TableHead>
                  <TableHead scope="col">Axe WCAG AA Violations</TableHead>
                  <TableHead scope="col">Contrast Failures (L+D)</TableHead>
                  <TableHead scope="col">FRAME/12 Grammar Pass</TableHead>
                  <TableHead scope="col">Static Checker Violations</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>
                    <strong>C1 · Conventional shadcn/Tailwind Baseline</strong>
                  </TableCell>
                  <TableCell>
                    <Tag status="success">6 / 6 Pass</Tag>
                  </TableCell>
                  <TableCell>0</TableCell>
                  <TableCell>0</TableCell>
                  <TableCell>N/A (Baseline)</TableCell>
                  <TableCell>N/A (Baseline)</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>C2 · Negative Fixture Suite (Planted Violations)</strong>
                  </TableCell>
                  <TableCell>
                    <Tag status="danger">0 / 6 Pass</Tag>
                  </TableCell>
                  <TableCell>7</TableCell>
                  <TableCell>15 (planted low-contrast &amp; marker misuse)</TableCell>
                  <TableCell>
                    <Tag status="danger">0 / 6 Pass</Tag>
                  </TableCell>
                  <TableCell>58 (all 6 static rules exercised: 13, 11, 9, 4, 8, 13)</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>C3 · Pre-Checker Reference Fixtures (Planted Drift)</strong>
                  </TableCell>
                  <TableCell>
                    <Tag status="success">6 / 6 Pass</Tag>
                  </TableCell>
                  <TableCell>0</TableCell>
                  <TableCell>0</TableCell>
                  <TableCell>
                    <Tag status="info">4 / 6 Pass</Tag>
                  </TableCell>
                  <TableCell>2 (explicit-cut-in-autocut in 02, 16px illegal-gutter in 04)</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>C4 · Checker-Verified Reference Fixtures (Remediated)</strong>
                  </TableCell>
                  <TableCell>
                    <Tag status="success">6 / 6 Pass</Tag>
                  </TableCell>
                  <TableCell>0</TableCell>
                  <TableCell>0</TableCell>
                  <TableCell>
                    <Tag status="success">6 / 6 Pass</Tag>
                  </TableCell>
                  <TableCell>0</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </Panel>
      </Scene>

      <Scene gutter="scene" layout="stack">
        <Panel label="Agent Approval Inbox — Interactive Experiment">
          <div className="f12-stack-pair" id="agents-experiment-approval-entry">
            <div className="f12-row-pair">
              <Tag status="warning">[!] EXPERIMENTAL PROTOTYPE · SIMULATED LOCAL DATA</Tag>
              <Tag>Not a production approval system</Tag>
            </div>
            <h2 className="f12-section-title" id="agents-experiment-approval-heading">
              Agent Approval Inbox — Interactive Experiment
            </h2>
            <p className="f12-body-copy" id="agents-experiment-approval-desc">
              Explore how FRAME/12 helps reviewers compare an AI agent&apos;s explanation against
              its actual proposed actions and independent evidence.
            </p>
            <p className="f12-muted-copy">
              This interactive showcase runs entirely on deterministic simulated local data to
              demonstrate human-in-the-loop verification—not a production approval system.
            </p>
            <div className="f12-row-pair">
              <Link
                href="/experiments/agent-approval"
                id="agents-experiment-approval-link"
                className="f12-btn primary"
              >
                Explore Interactive Demo
              </Link>
            </div>
          </div>
        </Panel>
      </Scene>
    </Sheet>
  );
}
