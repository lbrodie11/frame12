// Every FRAME/12 motion consumer, rendered with deterministic data and NO TempoProvider.
// Used by the no-provider compatibility test (baseline recorded before tempo existed) and,
// wrapped in a provider by tempo-fixture.tsx, by the tempo and flash-safety tests.
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import {
  Badge,
  GhostWire,
  Metric,
  SegmentedControl,
  Sheet,
  Skeleton,
  ToneAreaChart,
  ToneBarList,
  ToneSpark,
  Switch,
} from '@/components/frame12';
import { AnalyticsDashboard } from '@/components/frame12/blocks/analytics-dashboard';
import { DeveloperConsole } from '@/components/frame12/blocks/developer-console';
import { WorkspaceSettings } from '@/components/frame12/blocks/workspace-settings';

type Step = { step: number };

const series = (step: number) =>
  Array.from({ length: step % 2 ? 14 : 7 }, (_, i) => ({
    label: `D${i + 1}`,
    value: 100 + ((i * 37 + step * 53) % 90),
  }));

function SheetCss({ step, motion }: Step & { motion?: 'stepped' | 'smooth' | 'cut' }) {
  const opts = [
    { value: 7, label: '7', unit: 'days' },
    { value: 30, label: '30', unit: 'days' },
    { value: 90, label: '90', unit: 'days' },
  ];
  return (
    <Sheet motion={motion}>
      <div className="f12-stack-pair">
        <SegmentedControl
          idPrefix="fx-seg"
          ariaLabel="Range"
          options={opts}
          value={opts[step % 3].value}
          onChange={() => {}}
        />
        <Switch id="fx-switch" label="Live" checked={step % 2 === 1} onCheckedChange={() => {}} />
        <Skeleton variant="line" animated />
        <Badge pop={step > 0} burst key={step}>
          Pose {step}
        </Badge>
      </div>
    </Sheet>
  );
}

export const CONSUMERS: Record<string, { render: (p: Step) => React.ReactElement; trigger?: 'click' }> = {
  'metric': { render: ({ step }) => <Metric label="Revenue" value={step % 2 ? 48210 : 12040} range={step} /> },
  'metric-quiet': {
    render: ({ step }) => <Metric label="Quiet" variant="quiet" value={step % 2 ? 48210 : 12040} range={step} />,
  },
  'metric-smooth': {
    render: ({ step }) => <Metric label="Smooth" motion="smooth" value={step % 2 ? 900 : 100} range={step} />,
  },
  'ghost-wire': {
    render: ({ step }) => (
      <GhostWire from="checkout.ts" to={step % 2 ? 'pricing.ts' : 'cart.ts'} strength={0.6} orientation="horizontal" />
    ),
  },
  'sheet-stepped': { render: ({ step }) => <SheetCss step={step} /> },
  'sheet-smooth': { render: ({ step }) => <SheetCss step={step} motion="smooth" /> },
  'sheet-cut': { render: ({ step }) => <SheetCss step={step} motion="cut" /> },
  'tone-bar-list': {
    render: ({ step }) => (
      <div className="f12-m-stepped">
        <ToneBarList
          idPrefix="fx-bars"
          changed={step > 0}
          items={[
            { id: 'a', name: 'Exit offer', value: 400 + step * 120, badge: 'Top' },
            { id: 'b', name: 'Reminder', value: 300 },
          ]}
        />
      </div>
    ),
  },
  'tone-spark': {
    render: ({ step }) => (
      <ToneSpark label="Spark" values={series(step).map((d) => d.value)} rangeKey={step} />
    ),
  },
  'tone-area-chart': {
    render: ({ step }) => <ToneAreaChart data={series(step)} seriesLabel="Revenue" height={160} />,
  },
  'analytics-dashboard': { render: () => <AnalyticsDashboard />, trigger: 'click' },
  'developer-console': { render: () => <DeveloperConsole />, trigger: 'click' },
  'workspace-settings': { render: () => <WorkspaceSettings />, trigger: 'click' },
};

export function renderConsumer(name: string, step: number, wrap?: (el: React.ReactElement) => React.ReactElement) {
  const el = CONSUMERS[name].render({ step });
  return wrap ? wrap(el) : el;
}

declare global {
  interface Window {
    __mount: (name: string) => void;
    __step: () => void;
    __names: string[];
  }
}

if (typeof window !== 'undefined' && !(window as unknown as { __F12_NO_AUTO?: boolean }).__F12_NO_AUTO) {
  let setStep: React.Dispatch<React.SetStateAction<number>> = () => {};
  function Host({ name }: { name: string }) {
    const [step, set] = React.useState(0);
    setStep = set;
    return renderConsumer(name, step);
  }
  window.__names = Object.keys(CONSUMERS);
  window.__mount = (name: string) => {
    createRoot(document.getElementById('root')!).render(<Host name={name} />);
  };
  window.__step = () => setStep((s) => s + 1);
}
