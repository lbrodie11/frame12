import Link from 'next/link';
import { Sheet, Scene, Panel, Tag, Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/frame12';
import { CopyCommand } from '@/components/copy-command';
import { InlineMd } from '@/components/inline-md';
import { COMPAT_TABLE, EMITTERS, ENV_TABLE, type ReadmeTable } from '@/lib/terminal-run';

const EVENTS: Array<[string, string]> = [
  ['run-start', 'title, product?, command?'],
  ['scene-start / scene-end', 'scene, title / scene'],
  ['cut-start', 'cut, title, scene?'],
  ['cut-progress', 'cut, done?, total?, unit?, note? (done never decreases)'],
  ['metric', 'metric: { name, label?, value, unit? }, cut?'],
  ['finding', 'finding: Finding, cut?'],
  ['receipt', 'finding (its id), receipt'],
  ['log', 'level: debug | info | warn | error, text, stream?, cut?'],
  ['warning', 'message, code?, cut?'],
  ['cut-end', 'cut, status: ok | warning | error | skipped | canceled, summary?, durationMs?'],
  ['run-end', 'status: completed | failed | canceled, error?'],
  ['snapshot', 'snapshot: Snapshot (the result every renderer draws from)'],
];

const ENTRY_POINTS: Array<[string, string]> = [
  ['@frame12/terminal', 'The contract and its validators, capabilities, motion, the sanitizer, width, tokens and the Director. No React, Ink, Git or child processes.'],
  ['@frame12/terminal/render', 'The linear renderers (rich, plain, json) and the grammar as pure functions. Zero dependencies.'],
  ['@frame12/terminal/ink', 'The live view. Needs the optional peers ink@^8 and react@^19.3; nothing else loads them.'],
  ['@frame12/terminal/process', 'spawnLogged: run a child process into a cut, without a shell.'],
  ['@frame12/terminal/testing', 'Deterministic event factories, fake streams and the v1 fixtures.'],
  ['@frame12/terminal/schema.json', 'The JSON Schema for contract v1.'],
  ['frame12-term', 'The CLI: render NDJSON from any program, record and replay .f12rec files.'],
];

const WRAP_SNIPPET = `import { detectCapabilities, resolveTerminalMotion } from '@frame12/terminal';
import { startLive } from '@frame12/terminal/ink';
import { spawnLogged } from '@frame12/terminal/process';

const caps = detectCapabilities(process.env, process, process.argv);
const { tempo } = resolveTerminalMotion({ argv: process.argv, env: process.env, caps });
const run = startLive({ caps, motion: tempo }); // falls back to linear lines without a terminal
const at = () => new Date().toISOString();
const startedAt = at();
let seq = 0;
const emit = (type, fields) => run.push({ schemaVersion: 1, type, runId: 'lint-1', seq: ++seq, ts: at(), id: \`lint-1-\${seq}\`, ...fields });

emit('run-start', { title: 'Lint the workspace', command: 'eslint .' });
emit('cut-start', { cut: 'lint', title: 'Lint' });
// The existing CLI runs unchanged (no shell); its lines become log events in this cut.
const { code } = await spawnLogged(run.director, process.execPath, ['node_modules/eslint/bin/eslint.js', '.'], { cut: 'lint' });
const status = code === 0 ? 'ok' : 'error';
emit('cut-end', { cut: 'lint', status });
emit('run-end', { status: code === 0 ? 'completed' : 'failed' });
// Findings parsed from the CLI's own output go here; the reference apps show how.
emit('snapshot', { snapshot: { schemaVersion: 1, runId: 'lint-1', title: 'Lint the workspace', status: code === 0 ? 'completed' : 'failed',
  startedAt, finishedAt: at(), cuts: [{ cut: 'lint', title: 'Lint', status }], metrics: [], findings: [], warnings: [] } });
process.exitCode = await run.end();`;

function DocTable({ table, caption, id }: { table: ReadmeTable; caption: string; id: string }) {
  return (
    <Table id={id}>
      <TableCaption>{caption}</TableCaption>
      <TableHeader>
        <TableRow>
          {table.header.map((h, i) => (
            <TableHead key={i} scope="col">
              {h || 'Area'}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {table.rows.map((row, i) => (
          <TableRow key={i}>
            {row.map((cell, j) =>
              j === 0 ? (
                <TableHead key={j} scope="row">
                  <InlineMd text={cell} />
                </TableHead>
              ) : (
                <TableCell key={j}>
                  <InlineMd text={cell} />
                </TableCell>
              ),
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

const SECTIONS: Array<[string, string]> = [
  ['install', 'Install'],
  ['contract', 'The event contract'],
  ['grammar', 'The grammar'],
  ['capabilities', 'Capabilities and environment variables'],
  ['motion', 'Motion'],
  ['accessibility', 'Accessibility'],
  ['security', 'Security'],
  ['compatibility', 'Compatibility'],
  ['recipes', 'Recipes'],
];

/** /terminal/docs: the package reference. Tables and emitters come from the package README. */
export default function TerminalDocsPage() {
  return (
    <Sheet autoCut pegs id="terminal-docs">
      <header className="f12-hd">
        <div className="f12-hd-text">
          <p className="f12-eyebrow">
            Docs <Tag>@frame12/terminal</Tag>
          </p>
          <h1 className="f12-title">Terminal docs</h1>
          <p className="f12-sub">
            FRAME/12 for the command line: one event contract, safe and width-correct output, and the storyboard grammar
            for long-running developer workflows. See it on a real run on <Link href="/terminal">the launch page</Link>.
          </p>
        </div>
      </header>

      <nav aria-label="On this page" className="f12-term-toc">
        <ol className="f12-row-pair" role="list">
          {SECTIONS.map(([id, title]) => (
            <li key={id}>
              <a href={`#${id}`}>{title}</a>
            </li>
          ))}
        </ol>
      </nav>

      <Scene gutter="scene" layout="split">
        <Panel label="Install">
          <div className="f12-stack-pair">
            <h2 className="f12-section-title" id="install">
              Install
            </h2>
            <CopyCommand command="npm install @frame12/terminal" label="Install @frame12/terminal" id="terminal-docs-install" />
            <p className="f12-body-copy">
              Node.js 22 or later. The only dependency is @frame12/tokens. For the live view, also install{' '}
              <code>ink@^8</code> and <code>react@^19.3</code>. To render events from any program without writing
              JavaScript: <code>my-tool --events | npx -p @frame12/terminal frame12-term render</code>.
            </p>
          </div>
        </Panel>
        <Panel variant="quiet" label="Entry points">
          <ul className="f12-stack-pair" role="list">
            {ENTRY_POINTS.map(([name, what]) => (
              <li key={name} className="f12-body-copy">
                <code>{name}</code>: {what}
              </li>
            ))}
          </ul>
        </Panel>
      </Scene>

      <Scene gutter="scene" layout="equal">
        <Panel label="The event contract">
          <div className="f12-stack-pair">
            <h2 className="f12-section-title" id="contract">
              The event contract (v1)
            </h2>
            <p className="f12-body-copy">
              A run is NDJSON: one event per line, then one authoritative <code>snapshot</code>. Every event carries{' '}
              <code>schemaVersion: 1</code>, <code>type</code>, <code>runId</code>, <code>seq</code> (strictly
              increasing), <code>ts</code> (ISO 8601 with a zone) and <code>id</code> (unique in the run). Ids are
              stable data (<code>read-history</code>); labels like <code>C-01</code> are presentation and are rejected
              as ids.
            </p>
            <Table density="compact">
              <TableCaption>Event types and their fields</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Event</TableHead>
                  <TableHead scope="col">Fields</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {EVENTS.map(([type, fields]) => (
                  <TableRow key={type}>
                    <TableHead scope="row">
                      <code>{type}</code>
                    </TableHead>
                    <TableCell>{fields}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="f12-body-copy">
              Limits: 8 KiB per event and 1 MiB per snapshot. Validation never throws; it returns typed issues. Unknown
              event types are ignored with a warning, so older renderers keep working with newer producers. The stream
              validator also checks the lifecycle: <code>run-start</code> first, each cut started before it progresses
              or ends, and receipts only for announced findings. The schema ships as{' '}
              <code>@frame12/terminal/schema.json</code>.
            </p>
          </div>
        </Panel>
      </Scene>

      <Scene gutter="scene" layout="split">
        <Panel label="The grammar">
          <div className="f12-stack-pair">
            <h2 className="f12-section-title" id="grammar">
              The grammar
            </h2>
            <ul className="f12-stack-pair" role="list">
              <li className="f12-body-copy">
                <strong>Cuts</strong> (<code>C-01</code>) are the steps of a run, each ending with a status word and its
                duration. <strong>Frames</strong> (<code>F-01</code>) are findings, the one that matters first.{' '}
                <strong>Receipts</strong> (<code>E-01</code>) are the evidence behind each claim.
              </li>
              <li className="f12-body-copy">
                <strong>One marker chip per render,</strong> on the top finding&apos;s label: a background with ink
                text, never yellow text. Only the top finding gets the heavy rule.
              </li>
              <li className="f12-body-copy">
                <strong>Every status is a word:</strong> done, warning, failed, skipped, canceled for cuts; needs
                review, info, ok, warning, danger for findings. Glyphs and color only repeat it.
              </li>
              <li className="f12-body-copy">
                <strong>Results come from the snapshot.</strong> Narration (stderr) never invents them; results
                (stdout) are drawn once, so <code>cmd &gt; out.txt</code> captures only results.
              </li>
              <li className="f12-body-copy">
                <strong>No line is wider than the terminal</strong> at any width from 20 columns. Paths are
                middle-truncated, keeping the file name; strengths always print their number and interval.
              </li>
            </ul>
          </div>
        </Panel>
        <Panel variant="quiet" label="Four renderers, one run">
          <ul className="f12-stack-pair" role="list">
            <li className="f12-body-copy">
              <strong>rich</strong>: the grammar with styling, for people at a terminal (the default).
            </li>
            <li className="f12-body-copy">
              <strong>plain</strong>: self-describing lines with no escape sequences, for logs, CI and screen readers.
            </li>
            <li className="f12-body-copy">
              <strong>json</strong>: the snapshot, one document on stdout, for other programs.
            </li>
            <li className="f12-body-copy">
              <strong>live</strong>: the keyboard view (Ink), when stdin and stdout are terminals. Its results are
              printed linearly when it closes.
            </li>
          </ul>
        </Panel>
      </Scene>

      <Scene gutter="scene" layout="equal">
        <Panel label="Capabilities and environment variables">
          <div className="f12-stack-pair">
            <h2 className="f12-section-title" id="capabilities">
              Capabilities and environment variables
            </h2>
            <p className="f12-body-copy">
              <code>detectCapabilities(process.env, process, process.argv)</code> is pure: everything it reads is passed
              in. Color is resolved separately for stdout and stderr. This is every environment variable the package
              reads, and the flag that overrides it; a flag beats a variable.
            </p>
            <DocTable table={ENV_TABLE} caption="Environment variables and flags" id="terminal-env-table" />
          </div>
        </Panel>
      </Scene>

      <Scene gutter="scene" layout="split">
        <Panel label="Motion">
          <div className="f12-stack-pair">
            <h2 className="f12-section-title" id="motion">
              Motion
            </h2>
            <p className="f12-body-copy">
              Terminals have no reduced-motion signal, so set <code>NO_MOTION=1</code> in your shell profile if you
              want stillness everywhere. The tempo, in order: <code>--motion auto|twos|ones|still</code>, then{' '}
              <code>FRAME12_MOTION</code>, then <code>NO_MOTION</code>/<code>REDUCED_MOTION</code>, then still for
              anything not interactive (CI, a screen reader, <code>TERM=dumb</code>), else twos (12 poses a second).
            </p>
            <p className="f12-body-copy">
              Motion only paces decoration: progress glyphs, tone-bar fills, cut transitions. Key echo, errors, cut and
              run endings, and cancellation always appear at once.
            </p>
          </div>
        </Panel>
        <Panel label="Accessibility">
          <div className="f12-stack-pair">
            <h2 className="f12-section-title" id="accessibility">
              Accessibility
            </h2>
            <ul className="f12-stack-pair" role="list">
              <li className="f12-body-copy">
                <code>--screen-reader</code> (or <code>FRAME12_SCREEN_READER=1</code>): append-only plain lines, no
                cursor movement, no motion.
              </li>
              <li className="f12-body-copy">Meaning never rests on color or glyphs alone; every glyph has an ASCII twin.</li>
              <li className="f12-body-copy">
                <code>NO_COLOR</code> is honored; bold, dim and inverse remain so statuses still read.
              </li>
              <li className="f12-body-copy">
                The live view is keyboard-only: <code>j</code>/<code>k</code> move, <code>Enter</code> inspects every
                receipt, <code>?</code> shows help, <code>q</code> quits. Nothing important exists only in a redraw.
              </li>
            </ul>
          </div>
        </Panel>
      </Scene>

      <Scene gutter="scene" layout="equal">
        <Panel label="Security">
          <div className="f12-stack-pair">
            <h2 className="f12-section-title" id="security">
              Security
            </h2>
            <p className="f12-body-copy">Every string from a producer is untrusted, and is cleaned before any renderer sees it.</p>
            <ul className="f12-stack-pair" role="list">
              <li className="f12-body-copy">
                <strong>Sanitization:</strong> CSI, OSC (including smuggled links and OSC 52 clipboard writes), DCS, APC,
                PM and SOS sequences are removed; carriage returns and backspaces cannot paint over text; bidi controls
                (Trojan Source) and zero-width characters in ids and paths are shown as escapes.
              </li>
              <li className="f12-body-copy">
                <strong>Redaction:</strong> GitHub, OpenAI, Anthropic and Slack tokens, AWS access key ids, JWTs and URL
                credentials are masked as <code>[redacted]</code> in every text field. Pass your own{' '}
                <code>redact</code> for anything else; its output is sanitized again.
              </li>
              <li className="f12-body-copy">
                <strong>Links:</strong> https only, credentials removed, and the only OSC 8 sequences in the output are
                the package&apos;s own. The live view opens one only after a y/N confirmation.
              </li>
              <li className="f12-body-copy">
                <strong>Child processes:</strong> <code>spawnLogged</code> never uses a shell, and its lines are
                sanitized and redacted like events.
              </li>
            </ul>
          </div>
        </Panel>
      </Scene>

      <Scene gutter="scene" layout="equal">
        <Panel label="Compatibility">
          <div className="f12-stack-pair">
            <h2 className="f12-section-title" id="compatibility">
              Compatibility
            </h2>
            <DocTable table={COMPAT_TABLE} caption="What each target is verified by in this release" id="terminal-compat-table" />
            <p className="f12-body-copy">Bun and Deno: best effort, not guaranteed.</p>
          </div>
        </Panel>
      </Scene>

      <Scene gutter="scene" layout="split">
        <Panel label="Recipe: wrap an existing CLI">
          <div className="f12-stack-pair">
            <h2 className="f12-section-title" id="recipes">
              Recipes
            </h2>
            <h3 className="f12-body-copy">
              <strong>Wrap an existing CLI</strong>
            </h3>
            <p className="f12-body-copy">
              Run it unchanged through <code>spawnLogged</code> inside a cut; its output streams into the log and its
              failure reaches CI logs. The Repo Archaeology reference app does exactly this and maps the CLI&apos;s JSON
              to findings.
            </p>
            <pre className="f12-cmd-pre" tabIndex={0} aria-label="Wrap an existing CLI (JavaScript)">
              <code>{WRAP_SNIPPET}</code>
            </pre>
          </div>
        </Panel>
        <Panel label="Recipe: drive it from Go or Python">
          <div className="f12-stack-pair">
            <h3 className="f12-body-copy">
              <strong>Drive it from Go or Python</strong>
            </h3>
            <p className="f12-body-copy">
              Print the events and pipe them in: <code>python3 build.py | npx -p @frame12/terminal frame12-term render</code>.
              Both programs below are run through <code>frame12-term render --strict</code> by the package&apos;s tests.
            </p>
            <pre className="f12-cmd-pre" tabIndex={0} aria-label="Python emitter">
              <code>{EMITTERS.python}</code>
            </pre>
            <pre className="f12-cmd-pre" tabIndex={0} aria-label="Go emitter">
              <code>{EMITTERS.go}</code>
            </pre>
          </div>
        </Panel>
      </Scene>
    </Sheet>
  );
}
