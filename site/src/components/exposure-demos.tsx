'use client';

import * as React from 'react';
import { ExposureScrubber, Panel, Scene, Tag, type ExposureFrame } from '@/components/frame12';
import { buildCiRunDemo, type ExposureDemo } from '@/lib/exposure-demo-data';

/** Pure: renders only what the frame carries. A light version while scrubbing. */
function renderDemoFrame(frame: ExposureFrame, _index: number, ctx: { scrubbing: boolean; settled: boolean }) {
  if (ctx.scrubbing) return <p className="f12-mono-note">{frame.kind ?? 'step'}</p>;
  return (
    <div className="f12-stack-pair">
      {frame.detail ? <p className="f12-body-copy">{frame.detail}</p> : <p className="f12-mono-note">No detail recorded.</p>}
      {frame.at ? <p className="f12-mono-note">{frame.at}</p> : <p className="f12-mono-note">No timestamp in the data.</p>}
    </div>
  );
}

/**
 * A compact scrubber for the light/dark preview panels (the recorded CI run). The page renders
 * one per theme, so the theme is part of its accessible name: two landmarks with the same name
 * cannot be told apart (axe landmark-unique).
 */
export function ExposurePreview({ idPrefix, theme }: { idPrefix: string; theme: 'light' | 'dark' }) {
  const demo = React.useMemo(() => buildCiRunDemo(), []);
  return (
    <ExposureScrubber
      label={`${demo.label} (${theme} preview)`}
      frames={demo.frames}
      renderFrame={renderDemoFrame}
      primaryMarker={demo.primaryMarker}
      defaultValue={demo.defaultValue}
      idPrefix={idPrefix}
      density="compact"
      timing="elapsed"
    />
  );
}

function DemoPair({ demo, idPrefix }: { demo: ExposureDemo; idPrefix: string }) {
  const logId = `${idPrefix}-log`;
  return (
    <Scene gutter="scene" layout="split">
      <Panel label={`${demo.title}: exposure sheet`}>
        <div className="f12-stack-pair">
          <div className="f12-row-pair">
            {demo.illustrative ? (
              <Tag status="warning">Illustrative</Tag>
            ) : demo.recorded ? (
              <Tag status="info">Recorded run</Tag>
            ) : (
              <Tag status="info">From fixtures</Tag>
            )}
            <span className="f12-mono-note">{demo.source}</span>
          </div>
          <h2 className="f12-section-title">{demo.title}</h2>
          <ExposureScrubber
            label={demo.label}
            frames={demo.frames}
            renderFrame={renderDemoFrame}
            primaryMarker={demo.primaryMarker}
            defaultValue={demo.defaultValue}
            idPrefix={idPrefix}
            timing="elapsed"
          />
        </div>
      </Panel>
      <Panel variant="quiet" label={`${demo.title}: find the cause`}>
        <div className="f12-stack-pair">
          <p className="f12-mono-note">FIND THE CAUSE · same run, raw log</p>
          <h2 className="f12-section-title">{demo.question}</h2>
          <p className="f12-body-copy">
            Answer it twice: first from the raw log below, then from the sheet. Note which was faster.
          </p>
          <pre className="f12-xs-demo-log" id={logId} tabIndex={0} role="region" aria-label={`${demo.title}: raw log (one JSON record per line)`}>
            {demo.rawLog}
          </pre>
          <details className="f12-xs-demo-answer">
            <summary>Show the answer (from the data)</summary>
            <p className="f12-body-copy">{demo.answer}</p>
          </details>
        </div>
      </Panel>
    </Scene>
  );
}

const DEEP_LINK = `'use client';
import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { ExposureScrubber, type ExposureFrame } from '@/components/frame12';

// useSearchParams needs a Suspense boundary (static prerendering bails out without one).
export function SharedReplayPage({ frames }: { frames: ExposureFrame[] }) {
  return (
    <React.Suspense fallback={null}>
      <SharedReplay frames={frames} />
    </React.Suspense>
  );
}

function SharedReplay({ frames }: { frames: ExposureFrame[] }) {
  const params = useSearchParams();
  const [frame, setFrame] = React.useState(() => params.get('frame') ?? frames[0]?.id);
  return (
    <ExposureScrubber
      label="Run 042 replay"
      frames={frames}
      value={frame}
      onValueChange={(id, { reason }) => {
        setFrame(id);
        // Replace, never push: scrubbing must not flood history. Skip playback ticks.
        if (reason !== 'playback') {
          const url = new URL(window.location.href);
          url.searchParams.set('frame', id);
          window.history.replaceState(null, '', url);
        }
      }}
      renderFrame={(f) => <p>{f.detail ?? f.label}</p>}
    />
  );
}`;

/**
 * The two faithful demos with "find the cause" panels, and the usage guide. `agent` is built on
 * the server (lib/exposure-agent-demo.ts) and arrives already redacted: redaction happens before
 * the data reaches this client component, not just before it is rendered.
 */
export function ExposureDemos({ agent }: { agent: ExposureDemo }) {
  const ci = React.useMemo(() => buildCiRunDemo(), []);
  return (
    <>
      <DemoPair demo={agent} idPrefix="xs-demo-agent" />
      <DemoPair demo={ci} idPrefix="xs-demo-ci" />
      <Scene gutter="scene" layout="equal">
        <Panel variant="quiet" label="ExposureScrubber guide: when to use it and the rules">
          <div className="f12-stack-pair">
            <h2 className="f12-section-title">Sheet, log or TraceTimeline?</h2>
            <ul className="f12-stack-pair" role="list">
              <li className="f12-body-copy">
                <strong>ExposureScrubber</strong> when the run is finished and its shape matters: where the time went, the
                one moment that matters, and what the data says led there.
              </li>
              <li className="f12-body-copy">
                <strong>A log list</strong> for a handful of lines with no timing, marker or causes; it reads faster.
              </li>
              <li className="f12-body-copy">
                <strong>TraceTimeline</strong> (planned) for nested agent steps with payloads; it will reuse this
                component&apos;s engine, <code>useExposure</code>.
              </li>
            </ul>
            <h2 className="f12-section-title">Rules</h2>
            <ul className="f12-stack-pair" role="list">
              <li className="f12-body-copy">
                <strong>Order is not causality.</strong> <code>causes</code> must come from your data (a parent id, a
                tool call id, a cut). The sheet never infers them, and drops links to unknown, later or self frames.
              </li>
              <li className="f12-body-copy">
                <strong>Redact first.</strong> Remove secrets, tokens and personal data from tool payloads before they
                reach any client component: build the frames on the server and pass only the redacted result. Raw data
                imported into a <code>&apos;use client&apos;</code> module ships to the browser even if it is never rendered.
                The agent demo is built that way and redacts the tool input&apos;s free-text memo.
              </li>
              <li className="f12-body-copy">
                <strong>renderFrame is pure.</strong> No fetching, logging or state updates in render; use{' '}
                <code>scrubbing</code> to render a light version mid-drag.
              </li>
              <li className="f12-body-copy">
                <strong>No autoplay.</strong> Playback starts from the viewer (or a controlled <code>playing</code> set in
                response to one).
              </li>
            </ul>
          </div>
        </Panel>
        <Panel variant="quiet" label="ExposureScrubber recipe: deep-link a frame with controlled value">
          <div className="f12-stack-pair">
            <h2 className="f12-section-title">Recipe: link to a frame</h2>
            <p className="f12-body-copy">
              URL syncing is not built in. Keep the frame id in the URL with a controlled <code>value</code>:
            </p>
            <pre className="f12-xs-demo-log" tabIndex={0} role="region" aria-label="Deep-link recipe code">
              {DEEP_LINK}
            </pre>
          </div>
        </Panel>
      </Scene>
    </>
  );
}
