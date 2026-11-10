// Scenarios for registry/tests/tempo.mjs and flash-safety.mjs. `window.__render(name, props)`
// mounts one scenario; probes expose what useTempo()/useResolvedMotion() see as data attributes.
import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Metric, Sheet, TempoControl, TempoProvider, ToneAreaChart, ToneBarList } from '@/components/frame12';
import { useResolvedMotion, useTempo, type Tempo } from '@/hooks/use-tempo';
import { CONSUMERS } from './consumers';

function Probe({ id }: { id: string }) {
  const t = useTempo();
  const stepped = useResolvedMotion('stepped');
  const smooth = useResolvedMotion('smooth');
  const cut = useResolvedMotion('cut');
  const none = useResolvedMotion();
  return (
    <output
      id={id}
      data-tempo={t.tempo}
      data-effective={t.effectiveTempo}
      data-ancestor-still={String(t.ancestorStill)}
      data-in-provider={String(t.inProvider)}
      data-reduced={String(t.reduced)}
      data-stepped={stepped}
      data-smooth={smooth}
      data-cut={cut}
      data-none={none}
    />
  );
}

declare global {
  interface Window {
    __render: (name: string, props?: Record<string, unknown>) => void;
    __changes: string[];
    __accept: boolean;
    __setTempo: (t: Tempo) => void;
    __step: () => void;
    __renders: Record<string, number>;
    __mounts: Record<string, number>;
  }
}
window.__changes = [];
window.__accept = true;
window.__renders = {};
window.__mounts = {};

let stepSetter: React.Dispatch<React.SetStateAction<number>> = () => {};
function useStep(): number {
  const [step, set] = React.useState(0);
  stepSetter = set;
  return step;
}
window.__step = () => stepSetter((s) => s + 1);

/** Exposes the nearest provider's setTempo to the test. */
function TempoHandle() {
  const { setTempo } = useTempo();
  window.__setTempo = setTempo;
  return null;
}

function Controlled({ initial = 'auto' }: { initial?: Tempo }) {
  const [t, setT] = React.useState<Tempo>(initial);
  return (
    <TempoProvider
      value={t}
      onChange={(next) => {
        window.__changes.push(next);
        if (window.__accept) setT(next);
      }}
    >
      <TempoControl idPrefix="ctl" showLegend />
      <Probe id="probe" />
    </TempoProvider>
  );
}

function Uncontrolled({ defaultValue, storageKey = 'fx-tempo' }: { defaultValue?: Tempo; storageKey?: string }) {
  return (
    <TempoProvider defaultValue={defaultValue} storageKey={storageKey}>
      <TempoControl idPrefix="ctl" />
      <TempoHandle />
      <Probe id="probe" />
      <Sheet id="fx-sheet">
        <p>sheet</p>
      </Sheet>
    </TempoProvider>
  );
}

function Nested({ outer, inner }: { outer: Tempo; inner: Tempo }) {
  return (
    <TempoProvider value={outer}>
      <Probe id="outer" />
      <Sheet id="outer-sheet">
        <TempoProvider value={inner}>
          <Probe id="inner" />
          <Sheet id="inner-sheet">
            <p>inner</p>
          </Sheet>
        </TempoProvider>
      </Sheet>
    </TempoProvider>
  );
}

function AsChild() {
  const kids = (
    <>
      <header style={{ height: 40 }}>head</header>
      <main style={{ height: 120 }}>main</main>
      <footer style={{ height: 30 }}>foot</footer>
    </>
  );
  const grid: React.CSSProperties = { display: 'grid', gridTemplateRows: 'auto 1fr auto', gap: 20, minHeight: 300 };
  return (
    <div>
      <div id="bare" style={grid}>
        {kids}
      </div>
      <TempoProvider value="twos" asChild>
        <div id="as-child" style={grid}>
          {kids}
        </div>
      </TempoProvider>
      <div id="wrapped" style={grid}>
        <TempoProvider value="twos">{kids}</TempoProvider>
      </div>
    </div>
  );
}

/** Every motion consumer under one persisted provider, plus a TempoControl. */
function AllConsumers({ only, tempo }: { only?: string[]; tempo?: Tempo }) {
  const step = useStep();
  const names = only ?? Object.keys(CONSUMERS).filter((n) => !CONSUMERS[n].trigger);
  return (
    <TempoProvider storageKey="fx-tempo" defaultValue={tempo}>
      <TempoControl idPrefix="ctl" />
      <TempoHandle />
      <Probe id="probe" />
      {names.map((n) => (
        <section key={n} data-consumer={n} style={{ marginBottom: 20 }}>
          {CONSUMERS[n].render({ step })}
        </section>
      ))}
      {!only && (
        // ToneBarList is CSS-only: it follows its nearest resolved emitter (here a Sheet).
        <section data-consumer="tone-bar-list-in-sheet">
          <Sheet>
            <ToneBarList
              idPrefix="fx-bars-sheet"
              changed={step > 0}
              items={[
                { id: 'a', name: 'Exit offer', value: 400 + step * 120, badge: 'Top' },
                { id: 'b', name: 'Reminder', value: 300 },
              ]}
            />
          </Sheet>
        </section>
      )}
    </TempoProvider>
  );
}

function CountRenders({ id, children }: { id: string; children: React.ReactNode }) {
  window.__renders[id] = (window.__renders[id] ?? 0) + 1;
  React.useEffect(() => {
    window.__mounts[id] = (window.__mounts[id] ?? 0) + 1;
  }, [id]);
  return <>{children}</>;
}

const PERF_DATA = Array.from({ length: 90 }, (_, i) => ({ label: `D${i + 1}`, value: 100 + ((i * 37) % 90) }));
/** A chart beside an unrelated heavy subtree that does not read the tempo. */
const Unrelated = React.memo(function Unrelated() {
  return (
    <CountRenders id="unrelated">
      <ul>
        {Array.from({ length: 200 }, (_, i) => (
          <li key={i}>row {i}</li>
        ))}
      </ul>
    </CountRenders>
  );
});
function Perf() {
  return (
    <TempoProvider storageKey="fx-tempo">
      <TempoControl idPrefix="ctl" />
      <TempoHandle />
      <CountRenders id="chart">
        <ToneAreaChart data={PERF_DATA} seriesLabel="Perf" height={160} />
      </CountRenders>
      <Unrelated />
    </TempoProvider>
  );
}

function MetricLive({ tempo }: { tempo?: Tempo }) {
  const step = useStep();
  return (
    <TempoProvider storageKey="fx-tempo" defaultValue={tempo}>
      <TempoControl idPrefix="ctl" />
      <TempoHandle />
      <Metric label="Live" value={step % 2 ? 10000 : 0} range={step} format={(v) => String(Math.round(v))} />
    </TempoProvider>
  );
}

/** Two persisted providers: only the outer one may own <html data-f12-tempo>. */
function NestedStorage() {
  return (
    <TempoProvider storageKey="fx-outer">
      <TempoControl idPrefix="outer" />
      <TempoProvider storageKey="fx-inner">
        <TempoControl idPrefix="inner" />
      </TempoProvider>
    </TempoProvider>
  );
}

const SCENARIOS: Record<string, (p: never) => React.ReactElement> = {
  'nested-storage': NestedStorage,
  controlled: Controlled,
  uncontrolled: Uncontrolled,
  both: () => (
    <TempoProvider value="twos" defaultValue="ones">
      <Probe id="probe" />
    </TempoProvider>
  ),
  nested: Nested,
  'no-provider-control': () => (
    <>
      <TempoControl idPrefix="ctl" />
      <Probe id="probe" />
    </>
  ),
  'as-child': AsChild,
  consumers: AllConsumers,
  perf: Perf,
  'metric-live': MetricLive,
};

let root: Root | null = null;
window.__render = (name, props = {}) => {
  const C = SCENARIOS[name] as (p: Record<string, unknown>) => React.ReactElement;
  root?.unmount();
  root = createRoot(document.getElementById('root')!);
  root.render(<C {...props} />);
};
