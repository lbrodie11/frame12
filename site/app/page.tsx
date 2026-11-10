'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Sheet,
  Scene,
  Panel,
  SegmentedControl,
  Tag,
  Badge,
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

export default function HomePage() {
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

      <Scene gutter="scene" layout="three">
        <Panel label="Signature 1: Panel grammar">
          <div className="f12-stack-pair">
            <div className="f12-row-pair">
              <Tag>01 · Layout</Tag>
              <span className="f12-mono-note">12px · 20px · 32px</span>
            </div>
            <h2 className="f12-section-title">Panel grammar</h2>
            <p className="f12-body-copy">
              Every section is an ink-framed SVG polygon (2.5px mitered stroke) numbered in reading
              order (<code className="f12-code-inline f12-nowrap">C-01</code>,{' '}
              <code className="f12-code-inline f12-nowrap">C-02</code>…). Gutter width encodes relationships
              before any label is read: 12px pairs coupled metrics across a diagonal slant, 20px
              groups one scene, and 32px starts a new scene.
            </p>
            <div className="f12-row-pair">
              <Link href="/style-sheet" className="f12-link-btn" id="home-link-style-sheet">
                Inspect Style Sheet
              </Link>
            </div>
          </div>
        </Panel>

        <Panel label="Signature 2: Screentone">
          <div className="f12-stack-pair">
            <div className="f12-row-pair">
              <Tag>02 · Surface</Tag>
              <span className="f12-mono-note">45° SVG Halftone</span>
            </div>
            <h2 className="f12-section-title">Screentone</h2>
            <p className="f12-body-copy">
              Rotated 45° halftone dot patterns replace CSS gradients and arbitrary opacity. Dot
              density carries hierarchy, prints cleanly, and survives grayscale in both paper-light
              and flashback-dark themes.
            </p>
            <div className="sp-tones" aria-hidden="true">
              <span className="tone t1" />
              <span className="tone t2" />
              <span className="tone t3" />
            </div>
            <div className="f12-row-pair">
              <Link href="/components" className="f12-link-btn" id="home-link-components">
                Browse 31 Components
              </Link>
            </div>
          </div>
        </Panel>

        <Panel label="Signature 3: Motion on twos">
          <div className="f12-stack-pair">
            <div className="f12-row-pair">
              <Badge burst={false}>03 · Timing</Badge>
              <span className="f12-mono-note">12fps · 83.33ms poses</span>
            </div>
            <h2 className="f12-section-title">Motion on twos</h2>
            <p className="f12-body-copy">
              Discrete state changes—switching date ranges, redrawing charts, popping leader
              badges—hold each pose for two frames at 24fps (83.33ms per drawing). Direct-hand
              inputs like hover, scroll, and crosshairs stay immediate.
            </p>
            <div className="f12-row-pair">
              <Link href="/motion" className="f12-link-btn marker" id="home-link-motion">
                Compare 12fps vs 60fps
              </Link>
            </div>
          </div>
        </Panel>
      </Scene>

      <Scene gutter="scene" layout="stack">
        <Panel label="Install and explore">
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
