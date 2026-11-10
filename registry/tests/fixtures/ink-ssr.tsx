// Server-renderable ink scene for registry/tests/ink.mjs: `play` is true AT MOUNT on purpose, which
// must never draw (rule 5). Rendered with react-dom/server, then hydrated by ink-fixture.tsx.
import * as React from 'react';
import { Panel } from '@/components/frame12';
import { InkStroke, inkPencil } from '@/components/frame12/ink';
import { InkReveal } from '@/components/frame12/ink-reveal';
import { InkBeat, InkSequence } from '@/components/frame12/ink-sequence';

export { inkPencil };

export function SsrScene({ play }: { play: boolean }) {
  return (
    <div id="ssr">
      <InkReveal play={play}>
        <Panel id="ssr-panel" cut="C-01" label="Server">
          <p>Server panel</p>
        </Panel>
      </InkReveal>
      <InkSequence id="ssr-seq" beats={[6, 6]} play={play} scroll>
        <svg width="200" height="100" viewBox="0 0 200 100" aria-hidden="true">
          <InkBeat beat={0}>
            <InkStroke id="ssr-stroke" weight="frame" d="M10 10H190V90H10Z" play={play} />
          </InkBeat>
          <InkBeat beat={1}>
            <InkStroke weight="pencil" d={inkPencil([[10, 50, 190, 50]])} />
          </InkBeat>
        </svg>
      </InkSequence>
    </div>
  );
}
