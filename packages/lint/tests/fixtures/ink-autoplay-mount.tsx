import * as React from 'react';
import { InkSequence, InkStroke } from '@/components/frame12';

const ALWAYS = true;

// Values constant at mount: a `true` constant, an unchanging useState(true), and state flipped to
// true in a mount effect. Each plays on load just like a literal.
export function MountAutoplay() {
  const [frozen] = React.useState(true);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);
  return (
    <>
      <svg aria-hidden="true">
        <InkStroke d="M0 0H10" play={ALWAYS} />
        <InkStroke d="M0 0H10" play={frozen} />
      </svg>
      <InkSequence beats={[6]} play={mounted} />
    </>
  );
}
