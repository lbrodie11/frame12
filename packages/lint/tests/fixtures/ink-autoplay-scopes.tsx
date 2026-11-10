import * as React from 'react';
import { InkSequence, InkStroke } from '@/components/frame12';

const ON = true;

// A: clean. `setPlaying` changes only through the button.
export function UserDriven() {
  const [playing, setPlaying] = React.useState(false);
  return (
    <>
      <button type="button" aria-pressed={playing} onClick={() => setPlaying((p) => !p)}>
        Draw
      </button>
      <svg aria-hidden="true">
        <InkStroke d="M0 0H10" play={playing} />
      </svg>
    </>
  );
}

// B: genuine autoplay. Its own, same-named setter flips to true in a mount effect.
export function MountDriven() {
  const [playing, setPlaying] = React.useState(false);
  React.useEffect(() => {
    setPlaying(true);
  }, []);
  return <InkSequence beats={[6]} play={playing} />;
}

// C: clean. A nested helper shadows `setPlaying`; its mount effect never touches C's state.
export function Shadowed() {
  const [playing, setPlaying] = React.useState(false);
  function Inner() {
    const setPlaying = (_v: boolean) => {};
    React.useEffect(() => {
      setPlaying(true);
    }, []);
    return null;
  }
  return (
    <>
      <Inner />
      <button type="button" onClick={() => setPlaying(true)}>
        Draw
      </button>
      <InkSequence beats={[6]} play={playing} />
    </>
  );
}

// D: clean. The parameter `ON` shadows the module-level `true` constant.
export function FromProps({ ON }: { ON: boolean }) {
  return (
    <svg aria-hidden="true">
      <InkStroke d="M0 0H10" play={ON} />
    </svg>
  );
}

// E: genuine autoplay. Here `ON` is the module-level constant.
export function FromConstant() {
  return (
    <svg aria-hidden="true">
      <InkStroke d="M0 0H10" play={ON} />
    </svg>
  );
}
