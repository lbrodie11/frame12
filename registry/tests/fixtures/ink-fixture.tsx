// Scenarios for registry/tests/ink.mjs. `window.__render(name, opts)` mounts one scenario inside a
// TempoProvider; `window.__toggle()` flips the scenario's `play` flag (a user action);
// `window.__setTempo(t)` changes the tempo mid-play.
import * as React from 'react';
import { createRoot, hydrateRoot, type Root } from 'react-dom/client';
import { Panel, PanelPair, TempoProvider } from '@/components/frame12';
import { InkStroke, inkPencil } from '@/components/frame12/ink';
import { InkReveal } from '@/components/frame12/ink-reveal';
import { InkBeat, InkLand, InkSequence, type InkSequenceState } from '@/components/frame12/ink-sequence';
import type { Tempo } from '@/hooks/use-tempo';
import { SsrScene } from './ink-ssr';

declare global {
  interface Window {
    __render: (name: string, opts?: Record<string, unknown>) => void;
    __toggle: () => void;
    __setTempo: (t: Tempo) => void;
    __ends: number;
    __states: string[];
    __pencil: (seed?: number) => string;
    __hydrate: (html: string) => void;
  }
}
window.__ends = 0;
window.__states = [];
window.__pencil = (seed = 12) =>
  inkPencil(
    [
      [10, 10, 290, 10],
      [10, 10, 10, 190],
      [150, 10, 150, 190],
    ],
    seed,
  );

let toggle: () => void = () => {};
let setTempoOuter: (t: Tempo) => void = () => {};
window.__toggle = () => toggle();
window.__setTempo = (t) => setTempoOuter(t);

function usePlay(initial = false): [boolean, (p: boolean) => void] {
  const [play, setPlay] = React.useState(initial);
  toggle = () => setPlay((p) => !p);
  return [play, setPlay];
}

// A closed, mitered rectangle: the start corner is where a dash seam would show.
const RECT = 'M20 20H280V180H20Z';

function Stroke({ poses, motion, initial }: { poses?: number; motion?: 'stepped' | 'smooth' | 'cut'; initial?: boolean }) {
  const [play] = usePlay(Boolean(initial));
  return (
    <svg id="stage" width="300" height="200" viewBox="0 0 300 200" aria-hidden="true" style={{ display: 'block', background: 'var(--f-panel)' }}>
      <InkStroke id="ink" d={RECT} weight="frame" poses={poses} motion={motion} play={play} onEnd={() => window.__ends++} />
    </svg>
  );
}

function PlainStroke() {
  return (
    <svg id="stage" width="300" height="200" viewBox="0 0 300 200" aria-hidden="true" style={{ display: 'block', background: 'var(--f-panel)' }}>
      <path d={RECT} className="f12-ink f12-ink-frame" fill="none" stroke="currentColor" />
    </svg>
  );
}

function RevealPanel({ wrapped, dir, width, pair }: { wrapped?: boolean; dir?: 'rtl' | 'ltr'; width?: number; pair?: boolean }) {
  const [play] = usePlay(false);
  const panel = pair ? (
    <PanelPair
      id="panel"
      top={{ label: 'Top', cut: 'C-01', children: <p id="content">Top content</p> }}
      bottom={{ label: 'Bottom', cut: 'C-02', children: <p>Bottom content</p> }}
    />
  ) : (
    <Panel id="panel" cut="C-01" label="Revealed">
      <p id="content">
        Panel content
        {/* Content's own CSS animation: ink's fallbacks must never remove it. */}
        <span id="spin" style={{ display: 'inline-block', animation: 'f12InkClockA 1000ms linear infinite' }} />
      </p>
    </Panel>
  );
  return (
    <div dir={dir} id="host" style={{ width: width ?? 320, padding: 20, background: 'var(--f-sheet)' }}>
      {wrapped ? (
        <InkReveal play={play} onEnd={() => window.__ends++}>
          {panel}
        </InkReveal>
      ) : (
        panel
      )}
    </div>
  );
}

const BEATS = [12, 12, 12, 12] as const;
function Sequence({ scroll }: { scroll?: boolean }) {
  const [play, setPlay] = usePlay(false);
  return (
    <InkSequence
      id="seq"
      beats={BEATS}
      play={play}
      scroll={scroll}
      onEnd={() => {
        window.__ends++;
        setPlay(false);
      }}
      onStateChange={(s: InkSequenceState) => window.__states.push(s)}
    >
      <svg width="400" height="240" viewBox="0 0 400 240" aria-hidden="true" style={{ display: 'block', background: 'var(--f-panel)' }}>
        <InkBeat beat={0}>
          <InkStroke id="b0" weight="pencil" d={inkPencil([[10, 10, 390, 10], [10, 230, 390, 230]])} />
        </InkBeat>
        <InkBeat beat={1}>
          <InkStroke id="b1" weight="frame" d="M20 20H380V220H20Z" />
        </InkBeat>
        <InkBeat beat={2}>
          <InkLand id="b2" reveal="wipe">
            <rect x="40" y="40" width="120" height="80" fill="var(--f-tone)" />
          </InkLand>
        </InkBeat>
        <InkBeat beat={3}>
          <InkLand id="b3" at={2}>
            <text x="300" y="60" fill="var(--f-ink)">C-01</text>
          </InkLand>
        </InkBeat>
      </svg>
    </InkSequence>
  );
}

function App({ name, opts }: { name: string; opts: Record<string, unknown> }) {
  const [tempo, setTempo] = React.useState<Tempo>((opts.tempo as Tempo) ?? 'auto');
  setTempoOuter = setTempo;
  let body: React.ReactElement;
  if (name === 'stroke') body = <Stroke poses={opts.poses as number | undefined} motion={opts.motion as never} initial={Boolean(opts.initial)} />;
  else if (name === 'plain-stroke') body = <PlainStroke />;
  else if (name === 'reveal') body = <RevealPanel wrapped dir={opts.dir as never} width={opts.width as number | undefined} pair={Boolean(opts.pair)} />;
  else if (name === 'plain-panel') body = <RevealPanel dir={opts.dir as never} width={opts.width as number | undefined} />;
  else body = <Sequence scroll={Boolean(opts.scroll)} />;
  return (
    <TempoProvider value={tempo} onChange={setTempo}>
      {body}
    </TempoProvider>
  );
}

let root: Root | null = null;
window.__render = (name, opts = {}) => {
  root?.unmount();
  window.__ends = 0;
  window.__states = [];
  root = createRoot(document.getElementById('root')!);
  root.render(<App name={name} opts={opts} />);
};

window.__hydrate = (html) => {
  root?.unmount();
  root = null;
  const el = document.getElementById('root')!;
  el.innerHTML = html;
  root = hydrateRoot(el, <SsrScene play />);
};
