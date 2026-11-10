'use client';

import * as React from 'react';
import { Button } from '@/components/frame12';
import { InkSequence, type InkSequenceState } from '@/components/frame12/ink-sequence';
import { useResolvedMotion } from '@/hooks/use-tempo';

/**
 * The only client JavaScript of "How a frame gets made": the Play/Stop control and the
 * InkSequence state machine. The drawing and captions arrive as server-rendered children.
 */
export function StoryShell({
  beats,
  children,
}: {
  beats: readonly number[];
  children: React.ReactNode;
}) {
  const [playing, setPlaying] = React.useState(false);
  const still = useResolvedMotion('stepped') === 'cut';
  const onStateChange = React.useCallback((s: InkSequenceState) => {
    if (s !== 'playing') setPlaying(false);
  }, []);

  return (
    <InkSequence
      beats={beats}
      play={playing}
      scroll
      onStateChange={onStateChange}
      className="home-story-track"
      id="home-story"
    >
      <div className="home-story-stage">
        <div className="f12-row-between home-story-head">
          <div className="f12-stack-pair">
            <p className="f12-m-label">Signature · Production pipeline</p>
            <h2 className="f12-section-title" id="home-story-title">
              How a frame gets made
            </h2>
          </div>
          <div className="f12-row-pair">
            <Button
              id="home-story-play"
              aria-pressed={playing}
              disabled={still}
              aria-describedby={still ? 'home-story-still' : undefined}
              onClick={() => setPlaying((p) => !p)}
            >
              {playing ? 'Stop' : 'Watch it get made'}
            </Button>
            {still ? (
              <span id="home-story-still" className="f12-mono-note">
                Motion is off: the storyboard is shown finished.
              </span>
            ) : null}
          </div>
        </div>
        {children}
      </div>
    </InkSequence>
  );
}
