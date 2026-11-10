import * as React from 'react';
import { InkSequence, InkStroke } from '@/components/frame12';

// Clean: `play` starts false and only a user action (or useChanged) turns it on.
export function UserPlay({ external }: { external: boolean }) {
  const [playing, setPlaying] = React.useState(false);
  return (
    <>
      <button type="button" aria-pressed={playing} onClick={() => setPlaying((p) => !p)}>
        Watch it get made
      </button>
      <svg aria-hidden="true">
        <InkStroke d="M0 0H10" play={playing} />
        <InkStroke d="M0 0H10" play={false} />
        <InkStroke d="M0 0H10" play={external} />
      </svg>
      <InkSequence beats={[6]} play={playing} onEnd={() => setPlaying(false)} />
    </>
  );
}
