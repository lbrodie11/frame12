'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Sheet,
  Scene,
  Panel,
  SegmentedControl,
  Tag,
} from '@/components/frame12';
import {
  RevenueRecoveryCoreScenes,
  STORE,
  END_LABEL,
  DEFAULT_RANGE,
  RANGE_OPTIONS,
  type RangeDays,
} from '@/components/frame12/blocks/analytics-dashboard';
import { REGISTRY_BASE_URL } from '@/lib/config';
import { CopyCommand } from '@/components/copy-command';

/**
 * The interactive home sheet. `story` is server-rendered ("How a frame gets made": the drawing and
 * captions ship as HTML, not JavaScript) and slotted in below the hero dashboard.
 */
export function HomeDashboard({ story }: { story: React.ReactNode }) {
  const [range, setRange] = React.useState<RangeDays>(DEFAULT_RANGE);
  const [focus, setFocus] = React.useState<string | null>(null);

  return (
    <Sheet autoCut pegs>
      <header className="f12-hd">
        <div className="f12-hd-text">
          <p className="f12-eyebrow">
            <span>FRAME/12 React Design System</span>
            <Tag>Live Storyboard Demo</Tag>
            <span>
              {STORE} · Through {END_LABEL}
            </span>
          </p>
          <h1 className="f12-title">Revenue recovery</h1>
          <p className="f12-muted-copy">
            <strong>FRAME/12</strong> is a copy-in React component registry and AI agent skill drawn
            from comic page composition and cel-animation production: ink-framed panels, 12/20/32px
            gutters, 45° SVG screentone, and motion held on twos (12fps). Explore the live
            dashboard below.
          </p>
        </div>
        <SegmentedControl
          idPrefix="home-rng"
          ariaLabel="Date range"
          options={RANGE_OPTIONS}
          value={range}
          onChange={setRange}
        />
      </header>

      <RevenueRecoveryCoreScenes
        range={range}
        focus={focus}
        onSelectFocus={setFocus}
        idPrefix="home"
        chartHeight={320}
      />

      <Scene gutter="scene" layout="stack">
        {story}
      </Scene>

      <Scene gutter="scene" layout="stack">
        <Panel label="Install and explore" id="home-install">
          <div className="f12-stack-scene">
            <div className="f12-row-between">
              <div className="f12-stack-pair">
                <p className="f12-m-label">Ship FRAME/12 in your app or AI coding agent</p>
                <h2 className="f12-section-title">
                  Zero chart or animation libraries. Copy-in React source.
                </h2>
              </div>
              <div className="f12-row-pair">
                <Link href="/get-started" className="f12-link-btn primary" id="home-link-start">
                  Get Started Guide
                </Link>
                <Link
                  href="/blocks/analytics-dashboard"
                  className="f12-link-btn"
                  id="home-link-analytics-block"
                >
                  Analytics Block →
                </Link>
                <Link href="/agents" className="f12-link-btn" id="home-link-agents">
                  Agent Skill &amp; Linter
                </Link>
              </div>
            </div>
            <CopyCommand
              id="home-copy-install"
              label="Full registry kit (shadcn CLI)"
              command={`npx shadcn@latest add ${REGISTRY_BASE_URL}/frame12.json`}
            />
          </div>
        </Panel>
      </Scene>
    </Sheet>
  );
}
