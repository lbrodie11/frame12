// The Edit Room demos (site/src/components/edit-room-demos.tsx) through the registry harness, for
// flash-safety.mjs, scripts/measure-cut-morph-perf.mjs and the WebKit isolation checks.
// `window.__er.mount({ demo, tempo })` mounts one demo inside a TempoProvider.
import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { TempoProvider } from '@/components/frame12/tempo';
import type { Tempo } from '@/hooks/use-tempo';
import { FilterDemo, OpenDemo, PoseInspector, ReorderDemo } from '../../../site/src/components/edit-room-demos';

type Demo = 'filter' | 'filter-cut' | 'reorder' | 'open' | 'cut' | 'inspector' | 'all';
declare global {
  interface Window {
    __er: { mount: (o: { demo: Demo; tempo?: Tempo; count?: number }) => void; unmount: () => void };
  }
}

function Demos({ demo, count }: { demo: Demo; count?: number }) {
  const all = demo === 'all';
  return (
    <div style={{ display: 'grid', gap: 20, padding: 20, maxWidth: 1024 }}>
      {all || demo === 'filter' ? <FilterDemo idPrefix="er-filter" label="Filter demo" count={count ?? 200} /> : null}
      {demo === 'filter-cut' ? <FilterDemo idPrefix="er-filter" label="Filter demo" kind="cut" count={count ?? 200} /> : null}
      {all || demo === 'reorder' ? <ReorderDemo idPrefix="er-reorder" /> : null}
      {all || demo === 'open' ? <OpenDemo idPrefix="er-open" /> : null}
      {all || demo === 'cut' ? <FilterDemo idPrefix="er-cut" kind="cut" count={24} label="Cut demo" /> : null}
      {all || demo === 'inspector' ? <PoseInspector idPrefix="er-inspect" /> : null}
    </div>
  );
}

let root: Root | null = null;
window.__er = {
  mount: ({ demo, tempo = 'twos', count }) => {
    root?.unmount();
    root = createRoot(document.getElementById('root')!);
    root.render(
      <TempoProvider value={tempo}>
        <Demos demo={demo} count={count} />
      </TempoProvider>,
    );
  },
  unmount: () => {
    root?.unmount();
    root = null;
  },
};
