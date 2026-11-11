'use client';

import * as React from 'react';
import { Panel, Scene, Sheet, Tag, TempoControl, getCutMorphSupport, type CutMorphSupport } from '@/components/frame12';
import { CopyCommand } from '@/components/copy-command';
import { FilterDemo, OpenDemo, PoseInspector, ReorderDemo } from '@/components/edit-room-demos';
import { REGISTRY_BASE_URL } from '@/lib/config';
import { ENGINE_SUPPORT } from '@/lib/edit-room-data';

const HOOK_RECIPE = `import { CutMorphName, useCutMorph } from '@/components/frame12/cut-morph';

function ShotList({ shots }: { shots: Shot[] }) {
  const [stage, setStage] = React.useState('all');
  const cutMorph = useCutMorph();          // the opt-in: resolves tempo here
  return (
    <>
      <StageFilter onChange={(v) => cutMorph(() => setStage(v))} />
      <ul>
        {shots.filter(byStage(stage)).map((s) => (
          <CutMorphName key={s.id} name={\`shot-\${s.id}\`}>  {/* a stable data id */}
            <li>{s.title}</li>
          </CutMorphName>
        ))}
      </ul>
    </>
  );
}`;

const REACT_RECIPE = `import { ViewTransition, startTransition } from 'react';
import { useResolvedMotion } from '@/hooks/use-tempo';
import { withCutMorphMode } from '@/components/frame12/cut-morph';

const mode = useResolvedMotion('stepped');
const select = (id: string) =>
  mode === 'cut'
    ? setSelected(id)                      // a cut: no Transition at all
    : withCutMorphMode(mode, () => startTransition(() => setSelected(id)));

<ViewTransition name={\`shot-\${id}\`} default="f12-match">
  <li>…</li>
</ViewTransition>`;

function EngineLine() {
  const [s, setS] = React.useState<CutMorphSupport | null>(null);
  React.useEffect(() => setS(getCutMorphSupport()), []);
  if (!s) return <p className="f12-mono-note" id="er-engine">Checking this browser…</p>;
  return (
    <p className="f12-mono-note" id="er-engine">
      This browser:{' '}
      {s.viewTransitions
        ? `match cuts animate${s.elementScoped ? ', element-scoped (each demo is its own scope)' : ', document-scoped with the page held still'}`
        : 'no View Transitions with view-transition-class, so every edit is an instant cut'}
      .
    </p>
  );
}

export default function EditRoomPage() {
  return (
    <Sheet autoCut pegs motion="stepped">
      <header className="f12-hd">
        <div className="f12-hd-text">
          <p className="f12-eyebrow">
            Motion Grammar · CutMorph
            <Tag>Opt-in · View Transitions</Tag>
          </p>
          <h1 className="f12-title">The Edit Room</h1>
          <p className="f12-muted-copy">
            When state changes, a film editor chooses: a <strong>cut</strong> (the shot changes at once) or a{' '}
            <strong>match cut</strong> (the same subject keeps its identity into the next shot). CutMorph brings that
            choice to the interface on the browser&rsquo;s own View Transitions. Animate the subject, not the page.
          </p>
          <EngineLine />
        </div>
        <TempoControl idPrefix="er-tempo" legend="Tempo for every demo" showLegend />
      </header>

      <Scene gutter="scene" layout="stack">
        <Panel label="Filter: 200 shots match-cut into place">
          <div className="f12-stack-scene">
            <h2 className="f12-section-title">Filter</h2>
            <p className="f12-body-copy">
              200 rows, each a named subject. Pick a stage: the shots that stay match-cut into their new places on twos;
              the rest cut out at the swap.
            </p>
            <FilterDemo idPrefix="er-filter" label="Filter demo" />
          </div>
        </Panel>
      </Scene>

      <Scene gutter="scene" layout="equal">
        <Panel label="Reorder: sort by a column">
          <div className="f12-stack-scene">
            <h2 className="f12-section-title">Reorder</h2>
            <p className="f12-body-copy">Sort by cut, length or stage. Focus stays on the sort control.</p>
            <ReorderDemo idPrefix="er-reorder" />
          </div>
        </Panel>
        <Panel label="Open: a row match-cuts into a detail panel">
          <div className="f12-stack-scene">
            <h2 className="f12-section-title">Open</h2>
            <p className="f12-body-copy">
              The row and the panel share one name, so the subject carries across. The demo moves focus to the panel
              heading, and back to the row on Close or Escape. CutMorph never moves focus.
            </p>
            <OpenDemo idPrefix="er-open" />
          </div>
        </Panel>
      </Scene>

      <Scene gutter="scene" layout="equal">
        <Panel label="Cut: the same change as a hard cut">
          <div className="f12-stack-scene">
            <h2 className="f12-section-title">Cut</h2>
            <p className="f12-body-copy">
              The same filter with <code className="f12-code-inline">{"{ kind: 'cut' }"}</code>: no View Transition, no
              flushSync, the shot just changes. Compare it with the filter above.
            </p>
            <FilterDemo idPrefix="er-cut" kind="cut" count={24} label="Cut demo" />
          </div>
        </Panel>
        <Panel label="Pose inspector">
          <div className="f12-stack-scene">
            <h2 className="f12-section-title">Pose inspector</h2>
            <p className="f12-body-copy">
              Pauses a live stepped edit through <code className="f12-code-inline">document.getAnimations()</code>: C-01
              (pose 1 holds it), poses 2 and 3 (83.33 ms each, the hard image swap at the second pose boundary), then
              C-02. Docs only; not part of the registry item.
            </p>
            <PoseInspector idPrefix="er-inspect" />
          </div>
        </Panel>
      </Scene>

      <Scene gutter="scene" layout="stack">
        <Panel label="When to cut, when to match">
          <div className="f12-stack-scene">
            <h2 className="f12-section-title">When to cut, when to match</h2>
            <ul className="f12-body-copy er-rules">
              <li>
                <strong>Match</strong> one subject the reader is following: a row that moves, a row that opens. Name only
                that subject.
              </li>
              <li>
                <strong>Cut</strong> everything else: page changes, content that appears or goes, anything the reader
                isn&rsquo;t tracking.
              </li>
              <li>
                Never for typing, drag, scrubbing, playback or focus movement: direct manipulation is never stepped or
                delayed.
              </li>
              <li>
                Tempo 0 and reduced motion make every match a cut, in JavaScript and in CSS. Tempo 12 plays three held
                poses; 60 plays it smooth.
              </li>
              <li>Focus is the caller&rsquo;s job. Move it in the same update, as the Open demo does.</li>
            </ul>
          </div>
        </Panel>
      </Scene>

      <Scene gutter="scene" layout="equal">
        <Panel label="The hook (React 18.3 and later)">
          <div className="f12-stack-scene">
            <h2 className="f12-section-title">The hook</h2>
            <p className="f12-body-copy">
              <code className="f12-code-inline">useCutMorph()</code> runs each update exactly once, in call order, even
              when calls interrupt each other. It never cancels a transition it does not own, and its promise resolves
              once the edit is committed.
            </p>
            <pre className="f12-cmd-pre" tabIndex={0} role="region" aria-label="useCutMorph example">
              <code>{HOOK_RECIPE}</code>
            </pre>
            <CopyCommand id="er-install" command={`npx shadcn@latest add ${REGISTRY_BASE_URL}/cut-morph.json`} />
          </div>
        </Panel>
        <Panel label="React 19.3 ViewTransition recipe">
          <div className="f12-stack-scene">
            <h2 className="f12-section-title">React 19.3 &lt;ViewTransition&gt;</h2>
            <p className="f12-body-copy">
              The grammar is CSS, so React&rsquo;s own <code className="f12-code-inline">&lt;ViewTransition&gt;</code>{' '}
              plays it too. <code className="f12-code-inline">withCutMorphMode</code> sets the mode key for the
              transition React starts. Prefer it on 19.3 when the update can suspend: the hook&rsquo;s{' '}
              <code className="f12-code-inline">flushSync</code> shows Suspense fallbacks at once.
            </p>
            <pre className="f12-cmd-pre" tabIndex={0} role="region" aria-label="React 19.3 recipe">
              <code>{REACT_RECIPE}</code>
            </pre>
          </div>
        </Panel>
      </Scene>

      <Scene gutter="scene" layout="equal">
        <Panel label="Support by engine">
          <div className="f12-stack-scene">
            <h2 className="f12-section-title">Support by engine</h2>
            <div className="er-table-wrap" tabIndex={0} role="region" aria-label="CutMorph support by engine">
              <table className="er-table">
                <caption className="f12-mono-note">Recorded by the F12-10 spike on 2026-11-11 (Playwright 1.64.1).</caption>
                <thead>
                  <tr>
                    <th scope="col">Engine</th>
                    <th scope="col">Match cuts</th>
                    <th scope="col">scope option</th>
                    <th scope="col">Scroll mid-edit</th>
                    <th scope="col">overflow: hidden</th>
                  </tr>
                </thead>
                <tbody>
                  {ENGINE_SUPPORT.map((e) => (
                    <tr key={e.engine}>
                      <th scope="row">
                        {e.engine} {e.version}
                      </th>
                      <td>{e.animates}</td>
                      <td>{e.scoped}</td>
                      <td>{e.scroll}</td>
                      <td>{e.clip}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Panel>
        <Panel label="Not supported">
          <div className="f12-stack-scene">
            <h2 className="f12-section-title">Not supported</h2>
            <ul className="f12-body-copy er-rules">
              <li>Cross-document (multi-page) transitions.</li>
              <li>Scrubbing (including ExposureScrubber), drag, typing, playback and any continuous input.</li>
              <li>
                Named subjects inside scroll or <code className="f12-code-inline">overflow: hidden</code> containers: the
                snapshots are not clipped in Firefox or WebKit.
              </li>
              <li>Automatic transitions: no FRAME/12 component animates through CutMorph unless you call it.</li>
            </ul>
          </div>
        </Panel>
      </Scene>
    </Sheet>
  );
}
