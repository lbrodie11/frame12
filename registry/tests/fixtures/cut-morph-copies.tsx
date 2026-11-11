// Two copies of cut-morph.tsx in one page (a copied-in file next to the registry one), each in
// its own React root. Both must share the one owner on globalThis[Symbol.for('frame12.cutmorph')].
// The test writes registry/.f12-run/cut-morph-copy.tsx before bundling this entry.
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { TempoProvider } from '@/components/frame12/tempo';
import { useCutMorph as useA, CutMorphName as NameA } from '@/components/frame12/cut-morph';
// eslint-disable-next-line import/no-unresolved
import { useCutMorph as useB, CutMorphName as NameB } from '../../.f12-run/cut-morph-copy';

declare global {
  interface Window {
    __copies: { log: string[]; results: string[]; a?: (l: string) => void; b?: (l: string) => void; sameHook: boolean };
  }
}
window.__copies = { log: [], results: [], sameHook: useA === useB };

function Side({ id, use, Name }: { id: 'a' | 'b'; use: typeof useA; Name: typeof NameA }) {
  const [x, setX] = React.useState(0);
  const cut = use();
  React.useEffect(() => {
    window.__copies[id] = (label: string) => {
      cut(() => {
        window.__copies.log.push(label);
        setX((v) => v + 100);
      }).then(
        () => window.__copies.results.push(`${label}:resolved`),
        () => window.__copies.results.push(`${label}:rejected`),
      );
    };
  }, [cut, id]);
  return (
    <Name name={`copy-${id}`}>
      <div id={`copy-${id}`} data-x={x} style={{ position: 'absolute', top: id === 'a' ? 10 : 80, left: x, width: 60, height: 40, background: 'rgb(255, 0, 0)' }} />
    </Name>
  );
}

for (const [id, use, Name] of [['a', useA, NameA], ['b', useB, NameB]] as const) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  createRoot(el).render(
    <TempoProvider value="twos">
      <Side id={id} use={use} Name={Name} />
    </TempoProvider>,
  );
}
