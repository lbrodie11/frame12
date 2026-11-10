import * as React from 'react';
import { InkSequence as Story, InkStroke as Line } from '@/components/frame12/ink-sequence';
import { InkReveal } from '@/components/frame12/ink-reveal';

export function Forms({ done }: { done: () => void }) {
  return (
    <>
      {/* Flagged: `play` after an attribute whose value contains `=>` and `>`. */}
      <Story beats={[6]} onEnd={() => (done(), 1 > 0)} play />
      {/* Flagged: aliased imports are still ink primitives. */}
      <Line d="M0 0H10" play={true} />
      {/* Clean: the word "play" inside a string value is not the prop. */}
      <InkReveal aria-label="press play to draw" play={false}>
        <div />
      </InkReveal>
    </>
  );
}
