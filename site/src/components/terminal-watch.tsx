'use client';

import * as React from 'react';
import { Button } from '@/components/frame12';
import { useTempo } from '@/hooks/use-tempo';
import { segmentClass } from '@/lib/ansi';
import type { WatchStep } from '@/lib/terminal-run';

/**
 * The CLI's output for a recorded run, as styled, selectable text. The whole run is on the page
 * from the first paint. "Replay" shows it again in the order and with the waits the CLI used;
 * lines not yet written keep their space (hidden, not removed), so nothing below moves. Every line
 * appears whole, the moment the CLI wrote it: no typing effect. At the Still tempo (or with the
 * OS reduced-motion setting) there is no replay.
 */
export function TerminalWatch({ steps, label, idPrefix }: { steps: WatchStep[]; label: string; idPrefix: string }) {
  const { effectiveTempo } = useTempo();
  const still = effectiveTempo === 'still';
  const [shown, setShown] = React.useState(steps.length);
  const timers = React.useRef<ReturnType<typeof setTimeout>[]>([]);
  const replaying = shown < steps.length;

  const stop = React.useCallback(() => {
    for (const t of timers.current) clearTimeout(t);
    timers.current = [];
    setShown(steps.length);
  }, [steps.length]);

  React.useEffect(() => () => timers.current.forEach(clearTimeout), []);
  // Switching to Still mid-replay finishes it at once.
  React.useEffect(() => {
    if (still) stop();
  }, [still, stop]);

  const replay = () => {
    for (const t of timers.current) clearTimeout(t);
    setShown(0);
    let at = 0;
    timers.current = steps.map((s, i) => {
      at += s.waitMs;
      return setTimeout(() => setShown(i + 1), at);
    });
  };

  const statusId = `${idPrefix}-status`;
  return (
    <div className="f12-stack-pair">
      <div className="f12-row-pair">
        {replaying ? (
          <Button size="sm" onClick={stop} id={`${idPrefix}-stop`}>
            Show all
          </Button>
        ) : (
          <Button size="sm" onClick={replay} disabled={still} aria-describedby={statusId} id={`${idPrefix}-replay`}>
            Replay
          </Button>
        )}
        <span className="f12-mono-note" id={statusId} role="status">
          {still
            ? 'Tempo is Still: the whole run is shown, with no replay.'
            : replaying
              ? `Replaying: ${shown} of ${steps.length} writes`
              : `${steps.length} writes, as the CLI made them`}
        </span>
      </div>
      <pre className="f12-term-out" tabIndex={0} role="region" aria-label={label} id={`${idPrefix}-output`}>
        {steps.map((step, i) => (
          <span key={i} className="f12-term-step" data-stream={step.stream} data-pending={i >= shown ? '' : undefined}>
            {step.lines.map((line, j) => (
              <span key={j} className="f12-term-line">
                {line.map((seg, k) => (
                  <span key={k} className={segmentClass(seg)}>
                    {seg.text}
                  </span>
                ))}
                {'\n'}
              </span>
            ))}
          </span>
        ))}
      </pre>
    </div>
  );
}
