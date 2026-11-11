// React 19.3 recipe: <ViewTransition default="f12-match"> + withCutMorphMode around
// startTransition, plus a useCutMorph stage to prove CutMorph never cancels React's transition.
import * as React from 'react';
import { ViewTransition, startTransition } from 'react';
import { createRoot } from 'react-dom/client';
import { TempoProvider } from '@/components/frame12/tempo';
import { useResolvedMotion } from '@/hooks/use-tempo';
import { useCutMorph, withCutMorphMode } from '@/components/frame12/cut-morph';

declare global {
  interface Window {
    __r19: { move: () => void; cut: (label: string) => void; log: string[]; results: string[] };
  }
}
window.__r19 = { move: () => {}, cut: () => {}, log: [], results: [] };

function Recipe() {
  const [x, setX] = React.useState(0);
  const [label, setLabel] = React.useState('L0');
  const mode = useResolvedMotion('stepped');
  const cut = useCutMorph();
  React.useEffect(() => {
    window.__r19.move = () => {
      const go = () => startTransition(() => setX((v) => (v === 0 ? 300 : 0)));
      if (mode === 'cut') setX((v) => (v === 0 ? 300 : 0));
      else withCutMorphMode(mode, go);
    };
    window.__r19.cut = (l: string) => {
      cut(() => {
        window.__r19.log.push(l);
        setLabel(l);
      }).then(
        () => window.__r19.results.push(`${l}:resolved`),
        () => window.__r19.results.push(`${l}:rejected`),
      );
    };
  }, [mode, cut]);
  return (
    <div>
      <ViewTransition name="r19-box" default="f12-match">
        <div id="r19-box" style={{ position: 'absolute', top: 20, left: x, width: 100, height: 50, background: 'rgb(255, 0, 0)' }} />
      </ViewTransition>
      <p id="r19-label" style={{ position: 'absolute', top: 120 }}>
        {label}
      </p>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <TempoProvider value="twos">
    <Recipe />
  </TempoProvider>,
);
