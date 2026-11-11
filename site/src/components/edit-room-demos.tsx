'use client';

// The Edit Room demos (/motion/edit-room): the real useCutMorph hook on lists built from FRAME/12
// primitives. Also mounted by the registry's flash-safety, performance and accessibility tests
// (registry/tests/fixtures/edit-room-entry.tsx), so imports stay relative and free of Next.js.
import * as React from 'react';
import { flushSync } from 'react-dom';
import {
  Button,
  CutMorphName,
  SegmentedControl,
  getCutMorphSupport,
  useCutMorph,
  withCutMorphMode,
  type CutMorphKind,
} from '@/components/frame12';
import { useResolvedMotion } from '@/hooks/use-tempo';
import {
  SHOT_SORTS,
  SHOT_STAGES,
  buildShots,
  filterShots,
  sortShots,
  type Shot,
  type ShotSort,
  type ShotStage,
} from '../lib/edit-room-data';

function ShotCells({ shot }: { shot: Shot }) {
  return (
    <>
      <span className="er-cut">{shot.cut}</span>
      <span className="er-title">{shot.title}</span>
      <span className="er-stage">{shot.stage}</span>
      <span className="er-len">{shot.frames}f</span>
    </>
  );
}

/** C-01 / C-04: filter a shot list by pipeline stage. `kind="cut"` is the same change as a hard cut. */
export function FilterDemo({
  idPrefix,
  kind = 'match',
  count = 200,
  label,
}: {
  idPrefix: string;
  kind?: CutMorphKind;
  count?: number;
  label: string;
}) {
  const shots = React.useMemo(() => buildShots(count), [count]);
  const [stage, setStage] = React.useState<ShotStage | 'all'>('all');
  const scope = React.useRef<HTMLDivElement>(null);
  const cutMorph = useCutMorph({ scope });
  const visible = filterShots(shots, stage);
  const options = SHOT_STAGES.map((o) => ({
    value: o.value,
    label: o.label,
    unit: String(filterShots(shots, o.value).length),
  }));
  const stageLabel = SHOT_STAGES.find((o) => o.value === stage)?.label ?? 'All';
  return (
    <div className="er-demo" ref={scope} data-er-demo={idPrefix}>
      <div className="er-controls">
        <SegmentedControl
          idPrefix={`${idPrefix}-filter`}
          ariaLabel={`${label}: filter by stage`}
          options={options}
          value={stage}
          onChange={(v) => void cutMorph(() => setStage(v), { kind })}
        />
      </div>
      <p role="status" className="f12-mono-note" id={`${idPrefix}-status`}>
        Showing {visible.length} of {shots.length} shots{stage === 'all' ? '' : ` · ${stageLabel}`}
      </p>
      <ul className="er-list" aria-label={`${label}: ${visible.length} shots`} id={`${idPrefix}-list`}>
        {visible.map((s) =>
          kind === 'match' ? (
            <CutMorphName key={s.id} name={`${idPrefix}-${s.id}`}>
              <li className="er-row" data-id={s.id}>
                <ShotCells shot={s} />
              </li>
            </CutMorphName>
          ) : (
            <li key={s.id} className="er-row" data-id={s.id}>
              <ShotCells shot={s} />
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

/** C-02: sort by a column. Focus stays on the sort control. */
export function ReorderDemo({ idPrefix, count = 16 }: { idPrefix: string; count?: number }) {
  const shots = React.useMemo(() => buildShots(count), [count]);
  const [by, setBy] = React.useState<ShotSort>('cut');
  const scope = React.useRef<HTMLDivElement>(null);
  const cutMorph = useCutMorph({ scope });
  const sorted = sortShots(shots, by);
  const word = by === 'length' ? 'length, longest first' : by === 'stage' ? 'pipeline stage' : 'cut order';
  return (
    <div className="er-demo" ref={scope} data-er-demo={idPrefix}>
      <div className="er-controls">
        <SegmentedControl
          idPrefix={`${idPrefix}-sort`}
          ariaLabel="Sort shots by"
          options={SHOT_SORTS.map((o) => ({ ...o }))}
          value={by}
          onChange={(v) => void cutMorph(() => setBy(v))}
        />
      </div>
      <p role="status" className="f12-mono-note" id={`${idPrefix}-status`}>
        Sorted by {word}
      </p>
      <ol className="er-list er-list-table" aria-label={`Shots sorted by ${word}`} id={`${idPrefix}-list`}>
        {sorted.map((s) => (
          <CutMorphName key={s.id} name={`${idPrefix}-${s.id}`}>
            <li className="er-row" data-id={s.id}>
              <ShotCells shot={s} />
            </li>
          </CutMorphName>
        ))}
      </ol>
    </div>
  );
}

/**
 * C-03: a row opens into a detail panel. The row and the panel share one name, so the subject
 * carries over; the row's slot gets its own name and appears on the cut. Focus is the demo's
 * job (not CutMorph's): it moves to the panel heading on open and back to the row on close.
 */
export function OpenDemo({ idPrefix, count = 8 }: { idPrefix: string; count?: number }) {
  const shots = React.useMemo(() => buildShots(count), [count]);
  const [open, setOpen] = React.useState<string | null>(null);
  const scope = React.useRef<HTMLDivElement>(null);
  const heading = React.useRef<HTMLHeadingElement>(null);
  const focusNext = React.useRef<{ to: 'panel' } | { to: 'row'; id: string } | null>(null);
  const cutMorph = useCutMorph({ scope });
  const detailId = `${idPrefix}-detail`;

  // Runs in the same commit as the update (inside the transition's update callback), so the new
  // snapshot already shows the focus ring where it belongs.
  React.useLayoutEffect(() => {
    const f = focusNext.current;
    focusNext.current = null;
    if (!f) return;
    if (f.to === 'panel') heading.current?.focus();
    else document.getElementById(`${idPrefix}-row-${f.id}`)?.focus();
  }, [open, idPrefix]);

  const openShot = (id: string) => {
    focusNext.current = { to: 'panel' };
    void cutMorph(() => setOpen(id));
  };
  const close = () => {
    if (!open) return;
    focusNext.current = { to: 'row', id: open };
    void cutMorph(() => setOpen(null));
  };
  const current = shots.find((s) => s.id === open) ?? null;

  return (
    <div className="er-demo er-open" ref={scope} data-er-demo={idPrefix}>
      <ul className="er-open-list" aria-label="Shots">
        {shots.map((s) => (
          <li key={s.id}>
            <CutMorphName name={open === s.id ? `${idPrefix}-${s.id}-slot` : `${idPrefix}-${s.id}`}>
              <button
                type="button"
                id={`${idPrefix}-row-${s.id}`}
                className="er-open-row"
                aria-expanded={open === s.id}
                aria-controls={open === s.id ? detailId : undefined}
                onClick={() => (open === s.id ? close() : openShot(s.id))}
              >
                <ShotCells shot={s} />
              </button>
            </CutMorphName>
          </li>
        ))}
      </ul>
      {current ? (
        <CutMorphName name={`${idPrefix}-${current.id}`}>
          <section
            id={detailId}
            className="er-detail"
            aria-labelledby={`${detailId}-title`}
            onKeyDown={(e) => {
              if (e.key === 'Escape') close();
            }}
          >
            <h3 id={`${detailId}-title`} className="f12-section-title" tabIndex={-1} ref={heading}>
              {current.cut} · {current.title}
            </h3>
            <dl className="er-facts">
              <div>
                <dt>Scene</dt>
                <dd>{current.scene}</dd>
              </div>
              <div>
                <dt>Stage</dt>
                <dd>{current.stage}</dd>
              </div>
              <div>
                <dt>Length</dt>
                <dd>
                  {current.frames} frames ({(current.frames / 24).toFixed(2)} s)
                </dd>
              </div>
            </dl>
            <Button id={`${idPrefix}-close`} variant="secondary" size="sm" onClick={close}>
              Close
            </Button>
          </section>
        </CutMorphName>
      ) : (
        <p className="f12-mono-note er-detail-empty" id={`${idPrefix}-empty`}>
          Open a shot: it match-cuts into this panel.
        </p>
      )}
    </div>
  );
}

const STOPS = [
  { key: 'c01', label: 'C-01', note: 'before (pose 1 holds it, 0–83 ms)', t: 0 },
  { key: 'p2', label: 'Pose 2', note: '83–167 ms, old image', t: 125 },
  { key: 'p3', label: 'Pose 3', note: '167–250 ms, new image: the hard swap is at 166.67 ms', t: 208 },
  { key: 'c02', label: 'C-02', note: 'after', t: 250 },
] as const;

type VtHandle = { finished: Promise<unknown>; ready: Promise<unknown>; skipTransition(): void };

/**
 * Docs only (never shipped in the registry item): pauses a live stepped transition at each pose
 * through document.getAnimations(). It starts its own transition with withCutMorphMode (the same
 * path as the React 19.3 recipe), so the hook's skip-on-pointerdown never ends the inspection.
 */
export function PoseInspector({ idPrefix }: { idPrefix: string }) {
  const motion = useResolvedMotion('stepped');
  const [live, setLive] = React.useState<boolean | null>(null);
  const [slot, setSlot] = React.useState<0 | 1>(0);
  const [stop, setStop] = React.useState<number | null>(null);
  const run = React.useRef<{ vt: VtHandle; anims: Animation[] } | null>(null);

  React.useEffect(() => {
    setLive(getCutMorphSupport().viewTransitions && typeof document.getAnimations === 'function');
  }, []);

  const release = React.useCallback(() => {
    const r = run.current;
    if (!r) return;
    for (const a of r.anims) a.finish();
  }, []);

  React.useEffect(() => {
    if (stop === null) return;
    // A paused document snapshot would detach from its content on scroll: end the inspection.
    const onScroll = () => release();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [stop, release]);

  const seek = (i: number) => {
    const r = run.current;
    if (!r) return;
    for (const a of r.anims) a.currentTime = STOPS[i].t;
    setStop(i);
  };

  const inspect = () => {
    if (run.current || motion === 'cut') return;
    const doc = document as unknown as { startViewTransition: (cb: () => void) => VtHandle };
    let vt: VtHandle | null = null;
    withCutMorphMode('stepped', () => {
      vt = doc.startViewTransition(() => flushSync(() => setSlot((s) => (s === 0 ? 1 : 0))));
    });
    const started = vt as VtHandle | null;
    if (!started) return;
    started.ready.then(
      () => {
        const anims = document
          .getAnimations()
          .filter((a) => {
            const pe = (a.effect as KeyframeEffect | null)?.pseudoElement ?? '';
            return pe.startsWith('::view-transition') && pe.includes(`${idPrefix}-subject`);
          });
        for (const a of anims) a.pause();
        run.current = { vt: started, anims };
        seek(0);
      },
      () => {},
    );
    const done = () => {
      run.current = null;
      setStop(null);
    };
    started.finished.then(done, done);
  };

  const off = motion === 'cut';
  const statusText =
    stop === null
      ? off
        ? 'Motion is off (tempo 0 or reduced motion): this edit is a cut. Recorded frames below.'
        : 'Press Inspect to pause a live edit at each pose.'
      : `Paused at ${STOPS[stop].label}: ${STOPS[stop].note}.`;

  return (
    <div className="er-inspector" data-er-demo={idPrefix}>
      <div className="er-stage-strip" aria-hidden="true">
        <span className="er-slot er-slot-a" />
        <span className="er-slot er-slot-b" />
        <CutMorphName name={`${idPrefix}-subject`}>
          <div className={`er-subject er-subject-${slot}`}>{slot === 0 ? 'C-01' : 'C-02'}</div>
        </CutMorphName>
      </div>
      <div className="f12-row-pair">
        <Button id={`${idPrefix}-inspect`} variant="marker" size="sm" onClick={inspect} disabled={off || live === false || stop !== null}>
          Inspect an edit
        </Button>
        <div className="er-stops" role="group" aria-label="Poses">
          {STOPS.map((s, i) => (
            <button
              key={s.key}
              type="button"
              id={`${idPrefix}-stop-${s.key}`}
              className="er-stop"
              aria-pressed={stop === i}
              disabled={stop === null}
              onClick={() => (i === STOPS.length - 1 ? release() : seek(i))}
            >
              {s.label}
              {s.key === 'p3' ? ' ◆' : ''}
            </button>
          ))}
        </div>
      </div>
      <p role="status" className="f12-mono-note" id={`${idPrefix}-status`}>
        {statusText}
      </p>
      {live === false || off ? (
        <figure className="er-recorded">
          <div className="er-recorded-row">
            {[40, 120, 200].map((t, i) => (
              <img
                key={t}
                src={`/edit-room/pose-${i + 1}.png`}
                width={420}
                height={50}
                alt={`Pose ${i + 1} at ${t} ms: the subject ${i === 2 ? 'two thirds of the way, new image' : i === 1 ? 'one third of the way, old image' : 'where it started, old image'}`}
              />
            ))}
          </div>
          <figcaption className="f12-mono-note">Recorded screenshots (Chromium 153, the F12-10 spike), not this browser.</figcaption>
        </figure>
      ) : null}
    </div>
  );
}
