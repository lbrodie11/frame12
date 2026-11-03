'use client';

import * as React from 'react';
import { type MotionMode, useChanged } from '@/hooks/use-on-twos';
import {
  fmtMoney,
  fmtCurrencyShort,
  Sheet,
  Scene,
  Panel,
  PanelPair,
  SegmentedControl,
  Button,
  Badge,
  Tag,
  Metric,
  ToneAreaChart,
  ToneBarList,
  ToneSpark,
  Balloon,
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/frame12';

type WindowDays = 7 | 30 | 90;

interface CapabilityItem {
  id: string;
  name: string;
  value: number;
  share: number;
  badge?: string;
  dailyFactor: number;
}

interface WindowDataset {
  revenue: number;
  revenueDelta: number;
  margin: number;
  marginDelta: number;
  liftPP: number;
  liftDelta: number;
  days: Array<{ label: string; longLabel: string; value: number; margin: number; lift: number }>;
  capabilities: CapabilityItem[];
}

const DATASETS: Record<WindowDays, WindowDataset> = {
  7: {
    revenue: 38420,
    revenueDelta: 0.164,
    margin: 19840,
    marginDelta: 0.148,
    liftPP: 2.84,
    liftDelta: 0.42,
    days: [
      { label: 'Oct 25', longLabel: 'Oct 25, 2026', value: 4820, margin: 2490, lift: 2.5 },
      { label: 'Oct 26', longLabel: 'Oct 26, 2026', value: 5190, margin: 2680, lift: 2.7 },
      { label: 'Oct 27', longLabel: 'Oct 27, 2026', value: 5040, margin: 2600, lift: 2.6 },
      { label: 'Oct 28', longLabel: 'Oct 28, 2026', value: 5680, margin: 2940, lift: 2.9 },
      { label: 'Oct 29', longLabel: 'Oct 29, 2026', value: 6410, margin: 3320, lift: 3.3 },
      { label: 'Oct 30', longLabel: 'Oct 30, 2026', value: 5520, margin: 2850, lift: 2.8 },
      { label: 'Oct 31', longLabel: 'Oct 31, 2026', value: 5760, margin: 2960, lift: 3.1 },
    ],
    capabilities: [
      { id: 'cart', name: 'Abandoned-cart dispatch', value: 16520, share: 0.43, badge: 'Leader', dailyFactor: 0.43 },
      { id: 'exit', name: 'Exit-intent holdout offer', value: 11140, share: 0.29, dailyFactor: 0.29 },
      { id: 'retry', name: 'Payment-retry cadence', value: 6530, share: 0.17, dailyFactor: 0.17 },
      { id: 'stock', name: 'Back-in-stock reservation', value: 4230, share: 0.11, dailyFactor: 0.11 },
    ],
  },
  30: {
    revenue: 148200,
    revenueDelta: 0.192,
    margin: 76400,
    marginDelta: 0.171,
    liftPP: 3.18,
    liftDelta: 0.56,
    days: [
      { label: 'Oct 02', longLabel: 'Oct 02, 2026', value: 12400, margin: 6400, lift: 2.7 },
      { label: 'Oct 06', longLabel: 'Oct 06, 2026', value: 14100, margin: 7250, lift: 2.9 },
      { label: 'Oct 10', longLabel: 'Oct 10, 2026', value: 15800, margin: 8120, lift: 3.0 },
      { label: 'Oct 14', longLabel: 'Oct 14, 2026', value: 17200, margin: 8890, lift: 3.1 },
      { label: 'Oct 18', longLabel: 'Oct 18, 2026', value: 19400, margin: 10020, lift: 3.3 },
      { label: 'Oct 22', longLabel: 'Oct 22, 2026', value: 22900, margin: 11810, lift: 3.6 },
      { label: 'Oct 26', longLabel: 'Oct 26, 2026', value: 21100, margin: 10890, lift: 3.2 },
      { label: 'Oct 31', longLabel: 'Oct 31, 2026', value: 25300, margin: 13020, lift: 3.5 },
    ],
    capabilities: [
      { id: 'cart', name: 'Abandoned-cart dispatch', value: 62240, share: 0.42, badge: 'Leader', dailyFactor: 0.42 },
      { id: 'exit', name: 'Exit-intent holdout offer', value: 44460, share: 0.30, dailyFactor: 0.30 },
      { id: 'retry', name: 'Payment-retry cadence', value: 25190, share: 0.17, dailyFactor: 0.17 },
      { id: 'stock', name: 'Back-in-stock reservation', value: 16310, share: 0.11, dailyFactor: 0.11 },
    ],
  },
  90: {
    revenue: 412600,
    revenueDelta: 0.228,
    margin: 214500,
    marginDelta: 0.205,
    liftPP: 3.42,
    liftDelta: 0.74,
    days: [
      { label: 'Aug 05', longLabel: 'Aug 05, 2026', value: 38200, margin: 19800, lift: 2.9 },
      { label: 'Aug 19', longLabel: 'Aug 19, 2026', value: 44600, margin: 23100, lift: 3.1 },
      { label: 'Sep 02', longLabel: 'Sep 02, 2026', value: 49100, margin: 25500, lift: 3.2 },
      { label: 'Sep 16', longLabel: 'Sep 16, 2026', value: 55800, margin: 29000, lift: 3.4 },
      { label: 'Sep 30', longLabel: 'Sep 30, 2026', value: 68400, margin: 35600, lift: 3.8 },
      { label: 'Oct 14', longLabel: 'Oct 14, 2026', value: 74200, margin: 38600, lift: 3.6 },
      { label: 'Oct 31', longLabel: 'Oct 31, 2026', value: 82300, margin: 42900, lift: 3.9 },
    ],
    capabilities: [
      { id: 'cart', name: 'Abandoned-cart dispatch', value: 173290, share: 0.42, badge: 'Leader', dailyFactor: 0.42 },
      { id: 'exit', name: 'Exit-intent holdout offer', value: 119650, share: 0.29, dailyFactor: 0.29 },
      { id: 'retry', name: 'Payment-retry cadence', value: 74270, share: 0.18, dailyFactor: 0.18 },
      { id: 'stock', name: 'Back-in-stock reservation', value: 45390, share: 0.11, dailyFactor: 0.11 },
    ],
  },
};

const WINDOW_OPTIONS: Array<{ value: WindowDays; label: string; unit: string }> = [
  { value: 7, label: '7', unit: 'days' },
  { value: 30, label: '30', unit: 'days' },
  { value: 90, label: '90', unit: 'days' },
];

const MOTION_OPTIONS: Array<{ value: MotionMode; label: string; unit: string }> = [
  { value: 'stepped', label: '12', unit: 'fps' },
  { value: 'smooth', label: '60', unit: 'fps' },
  { value: 'cut', label: 'Cut', unit: '0ms' },
];

export function LandingScreen({ initialTheme }: { initialTheme?: 'light' | 'dark' }) {
  const [windowDays, setWindowDays] = React.useState<WindowDays>(30);
  const [motion, setMotion] = React.useState<MotionMode>('stepped');
  const [theme] = React.useState<'light' | 'dark' | undefined>(initialTheme);
  const [selectedCapId, setSelectedCapId] = React.useState<string | null>(null);
  const [trialEmail, setTrialEmail] = React.useState<string>('ops@koma-commerce.io');
  const [trialTier, setTrialTier] = React.useState<string>('growth');
  const [ctaStatus, setCtaStatus] = React.useState<string>('Interactive benchmark ready');

  const dataset = DATASETS[windowDays];
  const changed = useChanged(windowDays);
  const selectedCap = selectedCapId
    ? dataset.capabilities.find((c) => c.id === selectedCapId) ?? null
    : null;

  const chartData = React.useMemo(
    () =>
      dataset.days.map((d) => ({
        label: d.label,
        longLabel: d.longLabel,
        value: d.value,
        compareValue: selectedCap ? Math.round(d.value * selectedCap.dailyFactor) : undefined,
      })),
    [dataset, selectedCap],
  );

  const barItems = React.useMemo(
    () =>
      dataset.capabilities.map((c, idx) => ({
        id: c.id,
        name: c.name,
        value: c.value,
        formattedValue: fmtMoney(c.value),
        share: c.share,
        badge: c.badge,
        pattern: (idx === 0 ? 'dense' : idx === 1 ? 'hatch' : 'dots') as 'dense' | 'hatch' | 'dots',
      })),
    [dataset],
  );

  return (
    <main className="eval-screen-root">
      <Sheet motion={motion} theme={theme} id="landing-sheet">
        <header className="f12-hd">
          <div className="f12-hd-text">
            <p className="f12-eyebrow">
              FRAME/12 Recovery Engine
              <Tag>Release 2.4</Tag>
              <Badge pop={changed} burst>
                On Twos · 12fps
              </Badge>
            </p>
            <h1 className="f12-title">Checkout Recovery Drawn in Ink</h1>
            <p className="f12-sub" id="landing-status">
              Deterministic cart, exit-intent, and retry dispatches · {ctaStatus}
            </p>
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 'var(--f-gutter-pair)',
              alignItems: 'center',
            }}
          >
            <SegmentedControl
              options={WINDOW_OPTIONS}
              value={windowDays}
              onChange={(w) => {
                setWindowDays(w);
                setCtaStatus(`Window: ${w} days`);
              }}
              ariaLabel="Live showcase window"
              idPrefix="land-win"
            />
            <SegmentedControl
              options={MOTION_OPTIONS}
              value={motion}
              onChange={setMotion}
              ariaLabel="Motion mode"
              idPrefix="land-mo"
            />
          </div>
        </header>

        <Scene gutter="scene" layout="split" id="landing-scene-hero">
          <Panel cut="C-01" className="c01" label="Live checkout recovery showcase">
            <div className="f12-c01-hd">
              <Metric
                label="Recovered checkout revenue"
                value={dataset.revenue}
                format={fmtMoney}
                delta={dataset.revenueDelta}
                deltaKind="pct"
                range={windowDays}
                motion={motion}
                big
              />
              {selectedCap ? (
                <ul className="f12-legend" aria-label="Chart series legend">
                  <li>
                    <i className="f12-sw f12-sw-total" aria-hidden="true" />
                    All capabilities
                  </li>
                  <li>
                    <i className="f12-sw f12-sw-focus" aria-hidden="true" />
                    {selectedCap.name}
                  </li>
                </ul>
              ) : (
                <p className="f12-legend f12-legend-hint">
                  Select a capability in C-04 to compare its daily trajectory.
                </p>
              )}
            </div>
            <ToneAreaChart
              data={chartData}
              seriesLabel="Recovered revenue"
              labelColumnHeader="Date"
              compareLabel={selectedCap?.name}
              formatValue={fmtMoney}
              formatShort={fmtCurrencyShort}
              motion={motion}
              height={280}
            />
          </Panel>

          <PanelPair
            id="landing-kpis"
            top={{
              cut: 'C-02',
              label: 'Net margin retained',
              children: (
                <Metric
                  label="Net margin retained"
                  value={dataset.margin}
                  format={fmtMoney}
                  delta={dataset.marginDelta}
                  deltaKind="pct"
                  range={windowDays}
                  note="After incentive discounts and carrier fees"
                  motion={motion}
                  spark={
                    <ToneSpark
                      values={dataset.days.map((d) => d.margin)}
                      label="Period margin"
                      rangeKey={windowDays}
                      motion={motion}
                    />
                  }
                />
              ),
            }}
            bottom={{
              cut: 'C-03',
              label: 'Checkout conversion lift',
              children: (
                <Metric
                  label="Checkout conversion lift"
                  value={dataset.liftPP}
                  format={(v) => `+${v.toFixed(2)} pp`}
                  delta={dataset.liftDelta}
                  deltaKind="pp"
                  range={windowDays}
                  note="Measured against 10% randomized holdout"
                  motion={motion}
                  spark={
                    <ToneSpark
                      values={dataset.days.map((d) => d.lift)}
                      label="Holdout lift (pp)"
                      rangeKey={windowDays}
                      motion={motion}
                    />
                  }
                />
              ),
            }}
          />
        </Scene>

        <Scene gutter="change" layout="equal" id="landing-scene-features">
          <Panel cut="C-04" label="Capability breakdown">
            <ToneBarList
              title="Recovery by capability"
              subtitle={`Last ${windowDays} days · click a bar to overlay on C-01`}
              items={barItems}
              selectedId={selectedCapId}
              onSelect={(id) => {
                setSelectedCapId(id);
                setCtaStatus(id ? `Comparing capability: ${id}` : 'Showing total recovery');
              }}
              motion={motion}
              changed={changed}
              idPrefix="land"
            />
          </Panel>

          <Panel cut="C-05" label="Production guarantees and onboarding">
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--f-gutter-scene)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 'var(--f-gutter-pair)',
                }}
              >
                <h2 className="f12-m-label">Production Craft &amp; SLA Guarantees</h2>
                <Balloon tailOffset={12}>Zero CLS · p99 &lt; 180ms</Balloon>
              </div>

              <Table>
                <TableCaption>Verified production telemetry targets</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Guarantee</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Verification</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>Webhook dispatch p99</TableCell>
                    <TableCell>&lt; 180 ms</TableCell>
                    <TableCell>
                      <Tag>EDGE</Tag>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Holdout attribution</TableCell>
                    <TableCell>90 / 10 split</TableCell>
                    <TableCell>
                      <Tag>DETERMINISTIC</Tag>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Client script payload</TableCell>
                    <TableCell>4.2 KB brotli</TableCell>
                    <TableCell>
                      <Tag>ZERO-DEP</Tag>
                    </TableCell>
                  </TableRow>
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={2}>SLA Uptime Commitment</TableCell>
                    <TableCell>99.99%</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 'var(--f-gutter-pair)',
                  alignItems: 'center',
                }}
              >
                <Dialog>
                  <DialogTrigger id="landing-trial-open" variant="primary">
                    Start recovery sheet
                  </DialogTrigger>
                  <DialogContent cut="C-06">
                    <DialogHeader>
                      <DialogTitle>Provision Trial Recovery Sheet</DialogTitle>
                      <DialogDescription>
                        Deploy deterministic holdout split and webhook dispatch in under 5 minutes.
                      </DialogDescription>
                    </DialogHeader>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 'var(--f-gutter-pair)',
                      }}
                    >
                      <Input
                        id="landing-trial-email"
                        label="Operations email"
                        value={trialEmail}
                        onChange={(e) => setTrialEmail(e.target.value)}
                        hint="We send your HMAC signing secret to this address"
                      />
                      <Select
                        id="landing-trial-tier"
                        label="Monthly checkout volume"
                        value={trialTier}
                        onValueChange={setTrialTier}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="starter">Up to 10,000 orders / mo</SelectItem>
                          <SelectItem value="growth">10,000 – 100,000 orders / mo</SelectItem>
                          <SelectItem value="scale">100,000+ orders / mo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <DialogFooter>
                      <DialogClose id="landing-trial-cancel" variant="secondary">
                        Cancel
                      </DialogClose>
                      <DialogClose
                        id="landing-trial-confirm"
                        variant="marker"
                        onClick={() =>
                          setCtaStatus(`Provisioned ${trialTier} sheet for ${trialEmail}`)
                        }
                      >
                        Issue trial key
                      </DialogClose>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Button
                  id="landing-spec-btn"
                  variant="secondary"
                  onClick={() => setCtaStatus('Opened technical specification v2.4')}
                >
                  Read specification
                </Button>
              </div>
            </div>
          </Panel>
        </Scene>
      </Sheet>
    </main>
  );
}
