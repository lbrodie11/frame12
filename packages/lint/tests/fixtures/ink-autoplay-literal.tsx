import { InkReveal, InkSequence, InkStroke, Panel } from '@/components/frame12';

// Literal `true` (and its shorthand): every one plays on load.
export function LiteralAutoplay() {
  return (
    <>
      <svg aria-hidden="true">
        <InkStroke d="M0 0H10" play />
        <InkStroke d="M0 0H10" play={true} />
      </svg>
      <InkReveal play={!0}>
        <Panel label="A" />
      </InkReveal>
      <InkSequence beats={[6]} play={true} />
    </>
  );
}
