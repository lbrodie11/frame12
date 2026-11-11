// Browser entry for registry/tests/cut-morph.mjs (bundled for React 18.3 and 19).
//
// `window.__cm.mount(config)` mounts stages; `window.__cm.stages[id].cut(label, next, opts)` runs
// one useCutMorph call from inside that stage. Every update logs its label (in the order updates
// RUN) to `__cm.log`, and every call's outcome to `__cm.results`.
import * as React from 'react';
import { createRoot, hydrateRoot, type Root } from 'react-dom/client';
import { TempoProvider } from '@/components/frame12/tempo';
import {
  CutMorphName,
  useCutMorph,
  type CutMorphKind,
} from '@/components/frame12/cut-morph';
import type { Tempo } from '@/hooks/use-tempo';

export interface StageState {
  label: string;
  rows: string[];
  x: number;
  color: string;
  button?: boolean;
  lazy?: boolean;
  explode?: boolean;
}
export interface CallOpts {
  kind?: CutMorphKind;
  throws?: boolean;
  asyncUpdate?: boolean;
}

interface Cm {
  log: string[];
  results: Array<{ label: string; status: 'resolved' | 'rejected'; error?: string; logAtSettle: number }>;
  stages: Record<
    string,
    {
      cut: (label: string, next: Partial<StageState>, opts?: CallOpts) => Promise<void>;
      set: (next: Partial<StageState>) => void;
      setTransition: (next: Partial<StageState>) => void;
    }
  >;
  clicks: string[];
  renders: number;
  mount: (cfg: MountConfig) => void;
  mountSecond: (cfg: MountConfig) => void;
  unmount: () => void;
  unmountSecond: () => void;
  setTempo: (t: Tempo) => void;
  names: (variant: string) => void;
  hydrate?: (cfg: MountConfig) => void;
}
export interface MountConfig {
  tempo?: Tempo;
  nestedStill?: boolean;
  strict?: boolean;
  scoped?: boolean;
  stageId?: string;
  initial?: Partial<StageState>;
}

declare global {
  interface Window {
    __cm: Cm;
  }
}

const cm: Cm = (window.__cm = {
  log: [],
  results: [],
  stages: {},
  clicks: [],
  renders: 0,
} as unknown as Cm);

const INITIAL: StageState = { label: 'A0', rows: ['r1', 'r2', 'r3'], x: 0, color: 'rgb(255, 0, 0)' };

// Never resolves: the lazy child stays suspended so the fallback is observable.
const pending = new Promise<never>(() => {});
function Lazy(): React.ReactElement {
  throw pending;
}
function Explode(): React.ReactElement {
  throw new Error('render-boom');
}
class Boundary extends React.Component<{ children: React.ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  componentDidCatch() {}
  render() {
    return this.state.error ? <p id="boundary">caught</p> : this.props.children;
  }
}

function Stage({ id, scoped, initial }: { id: string; scoped?: boolean; initial?: Partial<StageState> }) {
  const [st, setSt] = React.useState<StageState>({ ...INITIAL, ...initial });
  const scope = React.useRef<HTMLDivElement>(null);
  const cut = useCutMorph(scoped ? { scope } : undefined);
  cm.renders++;
  React.useEffect(() => {
    cm.stages[id] = {
      cut: (label, next, opts = {}) => {
        const p = cut(
          (() => {
            cm.log.push(label);
            if (opts.throws) throw new Error(`boom-${label}`);
            setSt((s) => ({ ...s, ...next, label }));
            if (opts.asyncUpdate) return Promise.resolve();
            return undefined;
          }) as () => void,
          { kind: opts.kind },
        );
        p.then(
          () => cm.results.push({ label, status: 'resolved', logAtSettle: cm.log.length }),
          (e: unknown) =>
            cm.results.push({ label, status: 'rejected', error: String((e as Error)?.message ?? e), logAtSettle: cm.log.length }),
        );
        return p;
      },
      set: (next) => setSt((s) => ({ ...s, ...next })),
      setTransition: (next) => React.startTransition(() => setSt((s) => ({ ...s, ...next }))),
    };
    return () => {
      delete cm.stages[id];
    };
  }, [cut, id]);
  return (
    <div id={`stage-${id}`} ref={scope} className="stage" data-label={st.label}>
      <CutMorphName name={`${id}-mover`}>
        <div className="mover" id={`${id}-mover`} style={{ left: st.x, background: st.color }} />
      </CutMorphName>
      <ul className="rows">
        {st.rows.map((r) => (
          <CutMorphName key={r} name={`${id}-${r}`}>
            <li className="row" data-id={r}>
              {r}
            </li>
          </CutMorphName>
        ))}
      </ul>
      <p role="status" id={`${id}-status`}>
        {st.label}
      </p>
      {st.button ? (
        <button type="button" id={`${id}-late`} className="late" onClick={() => cm.clicks.push(`${id}-late`)}>
          late
        </button>
      ) : null}
      {st.lazy ? (
        <React.Suspense fallback={<p id={`${id}-fallback`}>loading</p>}>
          <Lazy />
        </React.Suspense>
      ) : null}
      <Boundary>{st.explode ? <Explode /> : <span id={`${id}-fine`}>fine</span>}</Boundary>
    </div>
  );
}

function App({ tempo = 'twos', nestedStill, scoped, stageId = 'a', initial }: MountConfig) {
  const [t, setT] = React.useState<Tempo>(tempo);
  cm.setTempo = setT;
  return (
    <TempoProvider value={t} onChange={setT}>
      <Stage id={stageId} scoped={scoped} initial={initial} />
      {nestedStill ? (
        <TempoProvider value="still">
          <Stage id="still" />
        </TempoProvider>
      ) : null}
    </TempoProvider>
  );
}

const wrap = (cfg: MountConfig) => (cfg.strict ? <React.StrictMode><App {...cfg} /></React.StrictMode> : <App {...cfg} />);

let root: Root | null = null;
let second: Root | null = null;
cm.mount = (cfg) => {
  root?.unmount();
  root = createRoot(document.getElementById('root')!);
  root.render(wrap(cfg));
};
cm.unmount = () => {
  root?.unmount();
  root = null;
};
cm.mountSecond = (cfg) => {
  second?.unmount();
  let el = document.getElementById('root2');
  if (!el) {
    el = document.createElement('div');
    el.id = 'root2';
    document.body.appendChild(el);
  }
  second = createRoot(el);
  second.render(wrap({ stageId: 'b', ...cfg }));
};
cm.unmountSecond = () => {
  second?.unmount();
  second = null;
};

// ------------------------------------------------------------------- CutMorphName playground
const Forwarding = React.forwardRef<HTMLSpanElement, { style?: React.CSSProperties; children?: React.ReactNode }>(
  function Forwarding(props, ref) {
    return <span ref={ref} id="fwd" {...props} />;
  },
);

function Names({ variant }: { variant: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [n, setN] = React.useState(0);
  React.useEffect(() => {
    (window as unknown as { __refOk: boolean }).__refOk = ref.current?.id === 'merge';
  });
  switch (variant) {
    case 'merge':
      return (
        <CutMorphName name="merge-me" className="f12-match extra">
          <div
            id="merge"
            ref={ref}
            className="own"
            style={{ color: 'rgb(1, 2, 3)' }}
            data-n={n}
            onClick={() => setN((x) => x + 1)}
          />
        </CutMorphName>
      );
    case 'forward':
      return (
        <CutMorphName name="fwd-name">
          <Forwarding style={{ color: 'rgb(4, 5, 6)' }}>fwd</Forwarding>
        </CutMorphName>
      );
    case 'fragment':
      return (
        <CutMorphName name="frag">
          <>
            <i id="frag-child">frag</i>
          </>
        </CutMorphName>
      );
    case 'string':
      return <CutMorphName name="str">{'just text' as unknown as React.ReactElement}</CutMorphName>;
    case 'array':
      return <CutMorphName name="arr">{[<i key="1">a</i>, <i key="2">b</i>] as unknown as React.ReactElement}</CutMorphName>;
    case 'duplicate':
      return (
        <div>
          <CutMorphName name="twin">
            <i id="twin-1">1</i>
          </CutMorphName>
          <CutMorphName name="twin">
            <i id="twin-2">2</i>
          </CutMorphName>
        </div>
      );
    case 'swap-same-name':
      // The old element unmounts and a new one with the same name mounts in one commit: not a duplicate.
      return (
        <CutMorphName key={`k${n}`} name="swapper">
          <i id="swapper" onClick={() => setN((x) => x + 1)}>
            {n}
          </i>
        </CutMorphName>
      );
    default:
      if (variant.startsWith('bad:')) {
        return (
          <CutMorphName name={variant.slice(4)}>
            <i id="bad">bad</i>
          </CutMorphName>
        );
      }
      return <i id="nothing" />;
  }
}

let namesRoot: Root | null = null;
cm.names = (variant) => {
  namesRoot?.unmount();
  let el = document.getElementById('names');
  if (!el) {
    el = document.createElement('div');
    el.id = 'names';
    document.body.appendChild(el);
  }
  namesRoot = createRoot(el);
  namesRoot.render(variant === 'none' ? null : variant.startsWith('strict:') ? <React.StrictMode><Names variant={variant.slice(7)} /></React.StrictMode> : <Names variant={variant} />);
};

// Server-rendered markup to hydrate (set by the test before this script runs).
const ssr = (window as unknown as { __cmSsr?: MountConfig }).__cmSsr;
if (ssr) {
  root = hydrateRoot(document.getElementById('root')!, wrap(ssr));
}

export { App, wrap };
