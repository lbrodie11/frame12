'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Sheet,
  Scene,
  Panel,
  PanelPair,
  SegmentedControl,
  Metric,
  ToneAreaChart,
  ToneBarList,
  ToneSpark,
  Tag,
  Badge,
} from '@/components/frame12';
import { useChanged } from '@/hooks/use-on-twos';
import { REGISTRY_BASE_URL } from '@/lib/config';
import {
  SUMMARIES,
  STORE,
  END_LABEL,
  RANGES,
  DEFAULT_RANGE,
  INTERVENTIONS,
  fmtMoney,
  fmtMoneyShort,
  fmtPP,
  type RangeDays,
} from '@/lib/data';
import { useSiteSettings } from '@/components/site-shell';
import { CopyCommand } from '@/components/copy-command';

const RANGE_OPTIONS = RANGES.map((r) => ({
  value: r,
  label: String(r),
  unit: 'days',
}));

const PROFIT_NOTE = 'Margin on recovered orders, after offer costs';
const LIFT_NOTE = 'Checkout conversion vs. holdout group';

export default function HomePage() {
  const { motion } = useSiteSettings();
  const [range, setRange] = React.useState<RangeDays>(DEFAULT_RANGE);
  const [focus, setFocus] = React.useState<string | null>(null);
  const changed = useChanged(range);

  const s = SUMMARIES[range];
  const focusItem = focus ? INTERVENTIONS.find((i) => i.id === focus) ?? null : null;

  const chartData = React.useMemo(
    () =>
      s.days.map((d) => ({
        label: d.label,
        longLabel: d.long,
        value: d.total,
        compareValue: focusItem ? d.byId[focusItem.id] : undefined,
      })),
    [s.days, focusItem],
  );

  const barItems = React.useMemo(
    () =>
      s.rows.map((r, idx) => ({
        id: r.id,
        name: r.name,
        value: r.value,
        formattedValue: fmtMoney(r.value),
        share: r.share,
        badge: idx === 0 ? 'Top performer' : undefined,
      })),
    [s.rows],
  );

  return (
    <Sheet autoCut pegs motion={motion}>
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

      <Scene gutter="scene" layout="split">
        <Panel className="c01" label="Recovered revenue over time">
          <div className="f12-c01-hd">
            <Metric
              label="Recovered revenue"
              value={s.revenue}
              format={fmtMoney}
              delta={s.revenueDelta}
              deltaKind="pct"
              range={range}
              motion={motion}
              big
            />
            {focusItem ? (
              <ul className="f12-legend" aria-label="Chart legend" role="list">
                <li>
                  <i className="f12-sw f12-sw-total" aria-hidden="true" />
                  All interventions
                </li>
                <li>
                  <i className="f12-sw f12-sw-focus" aria-hidden="true" />
                  {focusItem.name}
                </li>
              </ul>
            ) : (
              <p className="f12-legend f12-legend-hint">
                Select an intervention in C-04 to compare it with the total.
              </p>
            )}
          </div>
          <ToneAreaChart
            data={chartData}
            seriesLabel="Recovered revenue"
            labelColumnHeader="Date"
            compareLabel={focusItem?.name}
            formatValue={fmtMoney}
            formatShort={fmtMoneyShort}
            motion={motion}
            height={320}
          />
        </Panel>

        <PanelPair
          top={{
            label: 'Incremental profit',
            children: (
              <Metric
                label="Incremental profit"
                value={s.profit}
                format={fmtMoney}
                delta={s.profitDelta}
                deltaKind="pct"
                range={range}
                note={PROFIT_NOTE}
                motion={motion}
                spark={
                  <ToneSpark
                    values={s.days.map((d) => d.profit)}
                    label="Daily profit"
                    rangeKey={range}
                    motion={motion}
                  />
                }
              />
            ),
          }}
          bottom={{
            label: 'Conversion lift',
            children: (
              <Metric
                label="Conversion lift"
                value={s.lift}
                format={fmtPP}
                delta={s.liftDelta}
                deltaKind="pp"
                range={range}
                note={LIFT_NOTE}
                motion={motion}
                spark={
                  <ToneSpark
                    values={s.days.map((d) => d.lift)}
                    label="Daily lift"
                    rangeKey={range}
                    motion={motion}
                  />
                }
              />
            ),
          }}
        />
      </Scene>

      <Scene gutter="scene" layout="stack">
        <Panel className="c04" label="Revenue by intervention">
          <ToneBarList
            title="Revenue by intervention"
            subtitle={`Last ${s.range} days · share of recovered revenue`}
            items={barItems}
            selectedId={focus}
            onSelect={setFocus}
            motion={motion}
            changed={changed}
            idPrefix="home"
          />
        </Panel>
      </Scene>

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
              order (<code className="f12-code-inline">C-01</code>,{' '}
              <code className="f12-code-inline">C-02</code>…). Gutter width encodes relationships
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
                Browse 19 Components
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
                <Link href="/agents" className="f12-link-btn" id="home-link-agents">
                  Agent Skill & Linter
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
