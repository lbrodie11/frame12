// Server-renderable tree for the CutMorph hydration test (no window access at import time).
import * as React from 'react';
import { TempoProvider } from '@/components/frame12/tempo';
import { CutMorphName, useCutMorph } from '@/components/frame12/cut-morph';

function List() {
  const [rows, setRows] = React.useState(['s1', 's2', 's3']);
  const cut = useCutMorph();
  return (
    <div id="ssr">
      <button type="button" id="ssr-sort" onClick={() => void cut(() => setRows((r) => [...r].reverse()))}>
        sort
      </button>
      <ul>
        {rows.map((r) => (
          <CutMorphName key={r} name={`ssr-${r}`}>
            <li data-id={r} style={{ color: 'rgb(9, 9, 9)' }}>
              {r}
            </li>
          </CutMorphName>
        ))}
      </ul>
    </div>
  );
}

export function SsrApp() {
  return (
    <TempoProvider value="twos">
      <List />
    </TempoProvider>
  );
}
