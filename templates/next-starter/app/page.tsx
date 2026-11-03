'use client';

import * as React from 'react';
import {
  Sheet,
  Scene,
  Panel,
  PanelPair,
  SegmentedControl,
  Button,
  Input,
  Badge,
  Tag,
  Metric,
  ToneAreaChart,
  ToneBarList,
  ToneSpark,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/frame12';
import { useChanged, type MotionMode } from '@/hooks/use-on-twos';

type ThemeMode = 'light' | 'dark';
type WindowDays = 7 | 30 | 90;

interface WindowDataset {
  recovered: number;
  deltaPct: number;
  conversionRate: number;
  conversionDeltaPts: number;
  activeCarts: number;
  cartsDeltaPct: number;
  spark: number[];
  series: Array<{ label: string; longLabel: string; value: number }>;
  interventions: Array<{
    id: string;
    name: string;
    value: number;
    formattedValue: string;
    share: number;
    badge?: string;
  }>;
}

const DATASETS: Record<WindowDays, WindowDataset> = {
  7: {
    recovered: 34820,
    deltaPct: 14.2,
    conversionRate: 41.8,
    conversionDeltaPts: 3.4,
    activeCarts: 128,
    cartsDeltaPct: 9.1,
    spark: [4200, 4850, 4610, 5390, 6120, 4980, 4670],
    series: [
      { label: 'Oct 25', longLabel: 'Oct 25, 2026', value: 4200 },
      { label: 'Oct 26', longLabel: 'Oct 26, 2026', value: 4850 },
      { label: 'Oct 27', longLabel: 'Oct 27, 2026', value: 4610 },
      { label: 'Oct 28', longLabel: 'Oct 28, 2026', value: 5390 },
      { label: 'Oct 29', longLabel: 'Oct 29, 2026', value: 6120 },
      { label: 'Oct 30', longLabel: 'Oct 30, 2026', value: 4980 },
      { label: 'Oct 31', longLabel: 'Oct 31, 2026', value: 4670 },
    ],
    interventions: [
      {
        id: 'sms-1h',
        name: '1-hour SMS cart reminder',
        value: 16420,
        formattedValue: '$16,420',
        share: 47,
        badge: 'Top channel',
      },
      {
        id: 'exit-modal',
        name: 'Shipping-threshold exit prompt',
        value: 11240,
        formattedValue: '$11,240',
        share: 32,
      },
      {
        id: 'email-24h',
        name: '24-hour restock digest',
        value: 7160,
        formattedValue: '$7,160',
        share: 21,
      },
    ],
  },
  30: {
    recovered: 142840,
    deltaPct: 18.4,
    conversionRate: 39.6,
    conversionDeltaPts: 4.1,
    activeCarts: 512,
    cartsDeltaPct: 12.6,
    spark: [31200, 34900, 39420, 37320, 41200, 38900, 42150, 44800],
    series: [
      { label: 'Oct 02', longLabel: 'Oct 02, 2026', value: 4120 },
      { label: 'Oct 06', longLabel: 'Oct 06, 2026', value: 4680 },
      { label: 'Oct 10', longLabel: 'Oct 10, 2026', value: 4490 },
      { label: 'Oct 14', longLabel: 'Oct 14, 2026', value: 5340 },
      { label: 'Oct 19', longLabel: 'Oct 19, 2026', value: 7420 },
      { label: 'Oct 23', longLabel: 'Oct 23, 2026', value: 6180 },
      { label: 'Oct 27', longLabel: 'Oct 27, 2026', value: 5890 },
      { label: 'Oct 31', longLabel: 'Oct 31, 2026', value: 6390 },
    ],
    interventions: [
      {
        id: 'sms-1h',
        name: '1-hour SMS cart reminder',
        value: 68560,
        formattedValue: '$68,560',
        share: 48,
        badge: 'Top channel',
      },
      {
        id: 'exit-modal',
        name: 'Shipping-threshold exit prompt',
        value: 44280,
        formattedValue: '$44,280',
        share: 31,
      },
      {
        id: 'email-24h',
        name: '24-hour restock digest',
        value: 30000,
        formattedValue: '$30,000',
        share: 21,
      },
    ],
  },
  90: {
    recovered: 418950,
    deltaPct: 22.1,
    conversionRate: 38.2,
    conversionDeltaPts: 5.0,
    activeCarts: 1490,
    cartsDeltaPct: 15.8,
    spark: [38900, 41200, 44100, 46800, 49200, 51400, 48900, 53600, 56250],
    series: [
      { label: 'Aug 05', longLabel: 'Aug 05, 2026', value: 3890 },
      { label: 'Aug 19', longLabel: 'Aug 19, 2026', value: 4420 },
      { label: 'Sep 02', longLabel: 'Sep 02, 2026', value: 4910 },
      { label: 'Sep 16', longLabel: 'Sep 16, 2026', value: 5580 },
      { label: 'Sep 30', longLabel: 'Sep 30, 2026', value: 6120 },
      { label: 'Oct 14', longLabel: 'Oct 14, 2026', value: 6490 },
      { label: 'Oct 19', longLabel: 'Oct 19, 2026', value: 7420 },
      { label: 'Oct 31', longLabel: 'Oct 31, 2026', value: 6840 },
    ],
    interventions: [
      {
        id: 'sms-1h',
        name: '1-hour SMS cart reminder',
        value: 196900,
        formattedValue: '$196,900',
        share: 47,
        badge: 'Top channel',
      },
      {
        id: 'exit-modal',
        name: 'Shipping-threshold exit prompt',
        value: 134060,
        formattedValue: '$134,060',
        share: 32,
      },
      {
        id: 'email-24h',
        name: '24-hour restock digest',
        value: 87990,
        formattedValue: '$87,990',
        share: 21,
      },
    ],
  },
};

const WINDOW_OPTIONS: Array<{ value: WindowDays; label: string; unit: string }> = [
  { value: 7, label: '7', unit: 'days' },
  { value: 30, label: '30', unit: 'days' },
  { value: 90, label: '90', unit: 'days' },
];

const MOTION_OPTIONS: Array<{ value: MotionMode; label: string; unit: string }> = [
  { value: 'stepped', label: '12', unit: 'on twos' },
  { value: 'smooth', label: '60', unit: 'smooth' },
  { value: 'cut', label: '0', unit: 'cut' },
];

const THEME_OPTIONS: Array<{ value: ThemeMode; label: string; unit: string }> = [
  { value: 'light', label: 'Light', unit: 'paper' },
  { value: 'dark', label: 'Dark', unit: 'flashback' },
];

const fmtCurrency = (n: number) => '$' + Math.round(n).toLocaleString('en-US');
const fmtCurrencyShort = (n: number) => {
  if (Math.abs(n) >= 1000) {
    const k = n / 1000;
    return '$' + (Number.isInteger(k) ? k.toFixed(0) : k.toFixed(1)) + 'k';
  }
  return '$' + Math.round(n);
};
const fmtPct = (n: number) => `${n.toFixed(1)}%`;

export default function StarterWorkspacePage() {
  const [windowDays, setWindowDays] = React.useState<WindowDays>(30);
  const [motion, setMotion] = React.useState<MotionMode>('stepped');
  const [theme, setTheme] = React.useState<ThemeMode>('light');
  const [webhookUrl, setWebhookUrl] = React.useState('https://api.fernwood.example/webhooks/recovery');
  const [savedNotice, setSavedNotice] = React.useState(false);

  const changed = useChanged(windowDays);
  const data = DATASETS[windowDays];

  return (
    <main style={{ maxWidth: 1280, margin: '0 auto', padding: '20px' }}>
      <Sheet autoCut pegs motion={motion} theme={theme}>
        <header className="f12-hd">
          <div>
            <p className="f12-eyebrow">
              FRAME/12 Next.js Starter · Fernwood Supply Co.
              <Tag>Example workspace</Tag>
            </p>
            <h1 className="f12-title">Checkout recovery storyboard</h1>
            <p className="f12-sub">
              Ink-framed panels (C-01..C-05) · 12/20/32px semantic gutters · 45° SVG screentone · 12fps motion on twos
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 'var(--f-gutter-pair)',
            }}
            role="group"
            aria-label="Sheet controls"
          >
            <SegmentedControl
              idPrefix="starter-win"
              ariaLabel="Observation window"
              options={WINDOW_OPTIONS}
              value={windowDays}
              onChange={setWindowDays}
            />
            <SegmentedControl
              idPrefix="starter-motion"
              ariaLabel="Motion grammar"
              options={MOTION_OPTIONS}
              value={motion}
              onChange={setMotion}
            />
            <SegmentedControl
              idPrefix="starter-theme"
              ariaLabel="Sheet theme"
              options={THEME_OPTIONS}
              value={theme}
              onChange={setTheme}
            />
          </div>
        </header>

        {/* Scene 1: Establishing shot (C-01) + Diagonal PanelPair (C-02 / C-03) */}
        <Scene gutter="scene" layout="split">
          <Panel label="Recovered revenue establishing shot">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--f-gutter-scene)' }}>
              <div className="f12-c01-hd">
                <Metric
                  label="Recovered checkout revenue"
                  value={data.recovered}
                  format={fmtCurrency}
                  delta={data.deltaPct}
                  deltaKind="pct"
                  range={windowDays}
                  motion={motion}
                  big
                />
                <Badge pop={changed} burst>
                  {motion === 'stepped' ? '12fps · On twos' : motion === 'smooth' ? '60fps · Smooth' : '0ms · Hard cut'}
                </Badge>
              </div>

              <ToneAreaChart
                data={data.series}
                seriesLabel="Recovered revenue"
                labelColumnHeader="Date"
                formatValue={fmtCurrency}
                formatShort={fmtCurrencyShort}
                motion={motion}
                height={230}
                tableSummary="Show daily recovered revenue table"
              />
            </div>
          </Panel>

          <PanelPair
            top={{
              label: 'Recovery conversion rate',
              children: (
                <Metric
                  label="Recovery conversion rate"
                  value={data.conversionRate}
                  format={fmtPct}
                  delta={data.conversionDeltaPts}
                  deltaKind="pp"
                  range={windowDays}
                  motion={motion}
                  note="Completed checkouts within 24h of intervention."
                />
              ),
            }}
            bottom={{
              label: 'Active carts in sequence',
              children: (
                <Metric
                  label="Active carts in sequence"
                  value={data.activeCarts}
                  format={(v) => Math.round(v).toLocaleString('en-US')}
                  delta={data.cartsDeltaPct}
                  deltaKind="pct"
                  range={windowDays}
                  motion={motion}
                  spark={
                    <ToneSpark
                      values={data.spark}
                      label={`Cadence across last ${windowDays} days`}
                      rangeKey={windowDays}
                      motion={motion}
                    />
                  }
                />
              ),
            }}
          />
        </Scene>

        {/* Scene 2: Ranked interventions (C-04) + Dispatch configuration & modal (C-05) */}
        <Scene gutter="scene" layout="equal">
          <Panel label="Top recovery interventions">
            <ToneBarList
              title="Intervention attribution"
              subtitle={`Last ${windowDays} days · rotated 45° halftone screentone bars`}
              items={data.interventions}
              motion={motion}
              changed={changed}
              idPrefix="starter-int"
            />
          </Panel>

          <Panel label="Webhook dispatch and guardrails">
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 'var(--f-gutter-scene)',
                flex: 1,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--f-gutter-pair)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--f-gutter-pair)' }}>
                  <Tag>AI Agent Ready</Tag>
                  {savedNotice && (
                    <Badge pop burst>
                      Saved
                    </Badge>
                  )}
                </div>
                <h2 style={{ fontFamily: 'var(--font-f-display)', fontSize: 20 }}>
                  Dispatch endpoint & grammar guardrails
                </h2>
                <p style={{ fontSize: 14, color: 'var(--f-ink-2)', lineHeight: 1.5 }}>
                  This starter includes <code style={{ fontFamily: 'var(--font-f-mono)' }}>.claude/skills/frame12/SKILL.md</code> and{' '}
                  <code style={{ fontFamily: 'var(--font-f-mono)' }}>scripts/check-frame12.mjs</code> so every new screen stays locked to FRAME/12 tokens, gutters, and sequential cuts.
                </p>

                <Input
                  id="starter-webhook-input"
                  label="Recovery webhook URL"
                  value={webhookUrl}
                  onChange={(e) => {
                    setWebhookUrl(e.target.value);
                    setSavedNotice(false);
                  }}
                  hint="Receives signed JSON events on cart recovery."
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 'var(--f-gutter-pair)',
                }}
              >
                <Button
                  type="button"
                  id="starter-save-btn"
                  variant="primary"
                  onClick={() => setSavedNotice(true)}
                >
                  Save endpoint
                </Button>

                <Dialog>
                  <DialogTrigger id="starter-inspect-modal-btn" variant="marker">
                    Inspect payload schema
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Signed recovery webhook payload</DialogTitle>
                      <DialogDescription>
                        Delivered over HTTPS with HMAC-SHA256 signature verification.
                      </DialogDescription>
                    </DialogHeader>
                    <pre
                      style={{
                        margin: 0,
                        padding: 12,
                        border: '2px solid var(--f-rule)',
                        background: 'var(--f-sheet)',
                        color: 'var(--f-ink)',
                        fontFamily: 'var(--font-f-mono)',
                        fontSize: 12,
                        overflowX: 'auto',
                      }}
                    >
                      {JSON.stringify(
                        {
                          event: 'checkout.recovered',
                          windowDays,
                          recoveredUsd: data.recovered,
                          endpoint: webhookUrl,
                        },
                        null,
                        2,
                      )}
                    </pre>
                    <DialogFooter>
                      <DialogClose id="starter-modal-close-btn" variant="secondary">
                        Close
                      </DialogClose>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </Panel>
        </Scene>
      </Sheet>
    </main>
  );
}
