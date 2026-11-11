import Link from 'next/link';
import { Sheet, Scene, Panel, Tag } from '@/components/frame12';
import { CopyCommand } from '@/components/copy-command';
import { TerminalExplore } from '@/components/terminal-explore';
import { TerminalWatch } from '@/components/terminal-watch';
import { exploreDemo, HELLO_NDJSON, RECORDING_FILE, WATCH_COMMAND, watchSteps } from '@/lib/terminal-run';

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** /terminal: one real recorded run, read three ways. Everything here comes from the recording. */
export default function TerminalPage() {
  const steps = watchSteps();
  const explore = exploreDemo();
  const top = explore.topFinding;
  return (
    <Sheet autoCut pegs id="terminal-intro">
      <header className="f12-hd">
        <div className="f12-hd-text">
          <p className="f12-eyebrow">
            Package <Tag>@frame12/terminal</Tag>
          </p>
          <h1 className="f12-title">One run. Three ways to read it.</h1>
          <p className="f12-sub">
            Repo Archaeology asked which files usually change with a hono commit, and recorded the run. Below is that
            recording, unedited: as the terminal shows it, as a sheet of its events, and as the format any program can
            print to get the same output.{' '}
            <Link href="/terminal/docs" id="terminal-docs-link">
              Read the docs
            </Link>
            .
          </p>
        </div>
      </header>

      <Scene gutter="scene" layout="split">
        <Panel label="Watch: the run in the rich renderer">
          <div className="f12-stack-pair">
            <h2 className="f12-section-title">Watch</h2>
            <p className="f12-body-copy">
              The rich renderer&apos;s own output for the recording, converted from ANSI to styled text. Narration
              (each cut as it ends) comes first, then the results, drawn once from the run&apos;s snapshot.
            </p>
            <TerminalWatch steps={steps} label="Rich renderer output for the recorded run" idPrefix="terminal-watch" />
            <p className="f12-mono-note">
              {RECORDING_FILE} · <code>{WATCH_COMMAND}</code>
            </p>
          </div>
        </Panel>
        <Panel variant="quiet" label="Where the recording comes from">
          <div className="f12-stack-pair">
            <h2 className="f12-section-title">A real run</h2>
            <p className="f12-body-copy">
              The <code>repo-archaeology</code> reference app wrapped repo-archaeology 0.10.0 as a child process on{' '}
              <a href="https://github.com/honojs/hono/commit/61f7c59e50244ab4d2dd83c151928cf7ea448510">honojs/hono at 61f7c59</a>{' '}
              (the last six commits against 2,774 of history) and wrote <code>--record {RECORDING_FILE}</code>. The
              page replays that file; nothing is typed, generated or retouched.
            </p>
            <p className="f12-body-copy">
              The percentages are co-change confidence with a 95% interval: how often the files changed together in
              the past. They are not a measure of correctness.
            </p>
          </div>
        </Panel>
      </Scene>

      <Scene gutter="scene" layout="split">
        <Panel label="Explore: the same events on an exposure sheet">
          <div className="f12-stack-pair">
            <h2 className="f12-section-title">Explore</h2>
            <p className="f12-body-copy">
              The same {explore.frames.length} events, one frame each, marked at the top finding. Scrub, step with the
              arrow keys, or follow a frame&apos;s causes.
            </p>
            <TerminalExplore demo={explore} />
          </div>
        </Panel>
        <Panel variant="quiet" label="What the run found">
          <div className="f12-stack-pair">
            <h2 className="f12-section-title">Top finding</h2>
            <p className="f12-body-copy">{top.title}</p>
            {top.summary ? <p className="f12-body-copy">{top.summary.split('. ')[0]}.</p> : null}
            {top.strength ? (
              <p className="f12-body-copy">
                Co-change confidence {pct(top.strength.value)}
                {top.strength.low !== undefined && top.strength.high !== undefined
                  ? ` (95% interval ${pct(top.strength.low)}–${pct(top.strength.high)})`
                  : ''}
. {top.evidence} evidence commits are listed as receipts.
              </p>
            ) : null}
            <p className="f12-mono-note">Historical activity, not correctness.</p>
          </div>
        </Panel>
      </Scene>

      <Scene gutter="scene" layout="split">
        <Panel label="Build: twelve lines of NDJSON">
          <div className="f12-stack-pair">
            <h2 className="f12-section-title">Build</h2>
            <p className="f12-body-copy">
              Any program that prints JSON lines gets this output. A complete run is twelve lines: start, two cuts,
              a metric, a finding with its receipts, a warning, the end, and the snapshot every renderer draws from.
            </p>
            <pre className="f12-xs-demo-log" tabIndex={0} role="region" aria-label="hello.ndjson: a complete run in twelve lines" id="terminal-hello">
              {HELLO_NDJSON}
            </pre>
          </div>
        </Panel>
        <Panel variant="quiet" label="Run it">
          <div className="f12-stack-pair">
            <h2 className="f12-section-title">Run it</h2>
            <p className="f12-body-copy">Save the lines as hello.ndjson, then:</p>
            <CopyCommand command="npx -p @frame12/terminal frame12-term render --from hello.ndjson" label="Render hello.ndjson (rich)" id="terminal-cmd-rich" />
            <CopyCommand command="npx -p @frame12/terminal frame12-term render --from hello.ndjson --plain" label="Render hello.ndjson (plain)" id="terminal-cmd-plain" />
            <CopyCommand command="npx -p @frame12/terminal frame12-term render --from hello.ndjson --replay --record hello.f12rec" label="Replay and record hello.ndjson" id="terminal-cmd-record" />
            <p className="f12-body-copy">
              <code>--format live</code> adds the keyboard view; it needs <code>ink</code> and <code>react</code>{' '}
              installed. Recipes for wrapping an existing CLI or emitting from Go and Python are in{' '}
              <Link href="/terminal/docs#recipes">the docs</Link>.
            </p>
          </div>
        </Panel>
      </Scene>
    </Sheet>
  );
}
