// Renders the docs demos' data (site/src/lib/exposure-*-demo*.ts) through the registry harness,
// for registry/scripts/exposure-screenshots.mjs. `window.__demo(opts)` mounts one configuration.
import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ExposureScrubber, TempoProvider, type ExposureFrame } from '@/components/frame12';
import { buildCiRunDemo } from '../../../site/src/lib/exposure-demo-data';
// Test harness only (not a shipped client component): the screenshots need the agent frames.
import { buildAgentRunDemo } from '../../../site/src/lib/exposure-agent-demo';

declare global {
  interface Window {
    __demo: (o: { demo?: 'agent' | 'ci' | 'empty' | 'one'; width?: number; theme?: 'light' | 'dark'; variant?: 'expressive' | 'quiet'; timing?: 'even' | 'elapsed' | 'flipbook'; frames?: number }) => void;
  }
}

function render(frame: ExposureFrame, _i: number, ctx: { scrubbing: boolean }) {
  if (ctx.scrubbing) return <p>{frame.kind}</p>;
  return <p style={{ margin: 0 }}>{frame.detail ?? frame.label}</p>;
}

let root: Root | null = null;
window.__demo = ({ demo = 'agent', width, theme = 'light', variant = 'expressive', timing = 'elapsed', frames }) => {
  document.documentElement.setAttribute('data-theme', theme);
  const d = demo === 'ci' ? buildCiRunDemo() : buildAgentRunDemo();
  let fs: ExposureFrame[] = d.frames;
  if (demo === 'empty') fs = [];
  if (demo === 'one') fs = d.frames.slice(-1);
  if (frames) fs = Array.from({ length: frames }, (_, i) => ({ ...d.frames[i % d.frames.length], id: `x${i}`, causes: undefined, marker: i % 37 === 5, hold: (i % 3) + 1 }));
  root?.unmount();
  root = createRoot(document.getElementById('root')!);
  root.render(
    <TempoProvider defaultValue="twos">
      <div id="demo-box" style={{ width: width ? `${width}px` : undefined, padding: 20, background: 'var(--f-sheet)' }}>
        <ExposureScrubber
          label={d.label}
          frames={fs}
          renderFrame={render}
          primaryMarker={demo === 'agent' || demo === 'ci' ? d.primaryMarker : undefined}
          defaultValue={demo === 'agent' || demo === 'ci' ? d.defaultValue : undefined}
          idPrefix="demo"
          variant={variant}
          timing={timing}
        />
      </div>
    </TempoProvider>,
  );
};
