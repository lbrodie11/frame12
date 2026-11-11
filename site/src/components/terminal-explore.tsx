'use client';

import * as React from 'react';
import { ExposureScrubber, type ExposureFrame } from '@/components/frame12';
import type { ExploreDemo } from '@/lib/terminal-run';

function renderFrame(frame: ExposureFrame, _index: number, ctx: { scrubbing: boolean; settled: boolean }) {
  if (ctx.scrubbing) return <p className="f12-mono-note">{frame.kind ?? 'event'}</p>;
  return (
    <div className="f12-stack-pair">
      {frame.detail ? <p className="f12-body-copy">{frame.detail}</p> : <p className="f12-mono-note">No detail in this event.</p>}
      {frame.at ? <p className="f12-mono-note">{frame.at}</p> : null}
    </div>
  );
}

/** The recording's events in ExposureScrubber: one frame per event, marked at the top finding. */
export function TerminalExplore({ demo }: { demo: ExploreDemo }) {
  return (
    <ExposureScrubber
      label={demo.label}
      frames={demo.frames}
      renderFrame={renderFrame}
      primaryMarker={demo.primaryMarker}
      defaultValue={demo.defaultValue}
      idPrefix="terminal-explore"
      timing="elapsed"
    />
  );
}
