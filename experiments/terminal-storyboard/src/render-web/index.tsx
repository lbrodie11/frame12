import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Badge } from '@/components/frame12/badge';
import { Balloon } from '@/components/frame12/balloon';
import { Metric } from '@/components/frame12/metric';
import { Panel } from '@/components/frame12/panel';
import { PanelPair } from '@/components/frame12/panel-pair';
import { Scene } from '@/components/frame12/scene';
import { Sheet } from '@/components/frame12/sheet';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/frame12/table';
import { Tag } from '@/components/frame12/tag';
import { ToneBarList, type ToneBarItem } from '@/components/frame12/tone-bar-list';
import {
  validateEventStream,
  type ResultSnapshot,
  type StepExecutionRecord,
  type StoryboardEvent,
} from '../model/index.js';
import { sanitizeTerminalText } from '../render-plain/index.js';

export interface WebReportOptions {
  theme?: 'light' | 'dark';
  title?: string;
}

function loadFrame12Css(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(here, '../../../registry/styles/frame12.css'),
    resolve(here, '../../../../registry/styles/frame12.css'),
    resolve(process.cwd(), 'registry/styles/frame12.css'),
    resolve(process.cwd(), '../../registry/styles/frame12.css'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      return readFileSync(p, 'utf8');
    }
  }
  throw new Error('Could not locate registry/styles/frame12.css for inlining.');
}

const REPORT_LAYOUT_CSS = [
  ':root { padding: 0; }',
  'body { margin: 0; background: var(--f-desk); color: var(--f-ink); font-family: var(--font-f-body); overflow-x: hidden; }',
  '.f12-report-main { max-width: 1200px; margin: 0 auto; width: 100%; box-sizing: border-box; }',
  '.f12-report-stack { display: flex; flex-direction: column; gap: var(--f-gutter-pair); min-width: 0; }',
  '.f12-report-meta-row { display: flex; flex-wrap: wrap; align-items: center; gap: var(--f-gutter-pair); }',
  '.f12-sec-title { font-family: var(--font-f-mono); font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--f-ink-2); margin: 0; }',
  '.f12-mono-code { font-family: var(--font-f-mono); font-size: 12px; color: var(--f-ink); overflow-wrap: anywhere; word-break: break-word; }',
  '.f12-mono-note { font-family: var(--font-f-mono); font-size: 11px; color: var(--f-ink-2); line-height: 1.45; margin: 0; overflow-wrap: anywhere; word-break: break-word; }',
  '.f12-body-copy { font-family: var(--font-f-body); font-size: 13px; color: var(--f-ink); line-height: 1.5; margin: 0; overflow-wrap: anywhere; word-break: break-word; }',
  '.f12-action-list { display: flex; flex-direction: column; gap: var(--f-gutter-pair); padding: 0; margin: 0; list-style: none; }',
  '.f12-action-item { border-left: 2.5px solid var(--f-rule); padding-left: 10px; display: flex; flex-direction: column; gap: 0; }',
  '.f12-tag { white-space: nowrap; }',
  '.f12-table td, .f12-int-name, .f12-title, .f12-sub { overflow-wrap: break-word; }',
  '@media (max-width: 760px) { .f12-table th, .f12-table td { padding: 6px 6px 6px 0; font-size: 11px; overflow-wrap: anywhere; word-break: break-word; } .f12-mono-code, .f12-int-name { overflow-wrap: anywhere; word-break: break-word; } }',
].join('\n');

function extractSteps(events: StoryboardEvent[]): {
  steps: StepExecutionRecord[];
  snapshotOnly: boolean;
} {
  if (events.length === 0) {
    return { steps: [], snapshotOnly: true };
  }
  const validated = validateEventStream(events);
  if (!validated.ok) {
    throw new Error(`Invalid event stream passed to renderWebReportHtml: ${validated.error}`);
  }
  return { steps: validated.steps, snapshotOnly: false };
}

function StoryboardReportView({
  snapshot,
  events,
  theme = 'light',
}: {
  snapshot: ResultSnapshot;
  events: StoryboardEvent[];
  theme: 'light' | 'dark';
}) {
  const safeRepo = sanitizeTerminalText(snapshot.repoLabel);
  const safeRunId = sanitizeTerminalText(snapshot.runId);
  const safeStatus = sanitizeTerminalText(snapshot.status.toUpperCase());
  const { steps, snapshotOnly } = extractSteps(events);
  const topFinding = snapshot.findings[0];
  const topHotFile = snapshot.hotFiles[0];

  const toneItems: ToneBarItem[] =
    snapshot.findings.length > 0
      ? snapshot.findings.map((f) => ({
          id: sanitizeTerminalText(f.id),
          name: `${sanitizeTerminalText(f.id)} · ${sanitizeTerminalText(f.files[0])} + ${sanitizeTerminalText(f.files[1])}`,
          value: f.cochangeCount,
          formattedValue: `${f.cochangeCount} commits`,
          share: f.couplingRatio,
          badge: f.id === 'F-01' ? 'TOP PAIR' : undefined,
        }))
      : [
          {
            id: 'none',
            name: 'No coupled pairs above threshold',
            value: 0,
            formattedValue: '0 commits',
            share: 0,
          },
        ];

  const calloutText = topFinding
    ? `${sanitizeTerminalText(topFinding.id)}: ${sanitizeTerminalText(topFinding.files[0])} & ${sanitizeTerminalText(topFinding.files[1])} (${topFinding.cochangeCount} shared commits)`
    : snapshot.error
      ? `Run failed: ${sanitizeTerminalText(snapshot.error)}`
      : `Status: ${safeStatus} (${snapshot.commitsExamined} commits examined)`;

  return (
    <main className="f12-report-main">
      <Sheet pegs motion="cut" theme={theme}>
        <header className="f12-hd">
          <div>
            <div className="f12-eyebrow">
              <span>FRAME/12 STORYBOARD REPORT</span>
              <span>·</span>
              <Tag>{safeStatus}</Tag>
              {snapshot.reconstructed && (
                <Badge burst={false}>RECONSTRUCTED SNAPSHOT · NOT LIVE EVENTS</Badge>
              )}
              {snapshotOnly && !snapshot.reconstructed && (
                <Badge burst={false}>SNAPSHOT ONLY · NO LIVE EVENT STREAM</Badge>
              )}
            </div>
            <h1 className="f12-title">Co-Change Storyboard: {safeRepo}</h1>
            <p className="f12-sub">
              runId: {safeRunId} · window: {snapshot.maxCommits} commits · schema:{' '}
              {sanitizeTerminalText(snapshot.schemaVersion)}
              {snapshot.reconstructed
                ? ` · source: ${sanitizeTerminalText(snapshot.reconstructed.source)} (v${sanitizeTerminalText(snapshot.reconstructed.originalSchemaVersion)})`
                : ''}
            </p>
          </div>
        </header>

        {/* Scene 1: Establishing Overview & Supporting Metrics */}
        <Scene gutter="scene" layout="split">
          <Panel cut="C-01" label="Establishing Co-Change Overview">
            <div className="f12-report-stack">
              <Metric
                big
                motion="cut"
                headingLevel="h2"
                label="Commits Examined in Window"
                value={snapshot.commitsExamined}
                format={(v) => `${Math.round(v)} commits`}
                note={`Target repository: ${safeRepo} (${snapshot.findings.length} coupled pairs ranked)`}
              />
              <Balloon showDot tailOffset={0}>
                {calloutText}
              </Balloon>
              <ToneBarList
                title="Coupled File Pairs by Shared Commits"
                subtitle="Bar width = shared commits · percentage = overlap (shared ÷ commits of less-changed file)"
                items={toneItems}
                motion="cut"
                idPrefix="cochange"
              />
              <p className="f12-mono-note">
                Offline static HTML mode (motion=&quot;cut&quot;, zero client JS): Panel uses its SSR
                viewBox frame and ToneBarList renders static screentone fills.
              </p>
            </div>
          </Panel>

          <PanelPair
            topCut="C-02"
            bottomCut="C-03"
            topLabel="Unique Files Observed"
            bottomLabel="Co-Change Pairs Ranked"
          >
            <div className="f12-report-stack">
              <Metric
                motion="cut"
                headingLevel="h2"
                label="Unique Files Observed"
                value={snapshot.uniqueFilesObserved}
                format={(v) => `${Math.round(v)} files`}
                note={
                  topHotFile
                    ? `Most active file: ${sanitizeTerminalText(topHotFile.file)} (${topHotFile.commits} commits)`
                    : 'No file activity recorded in window'
                }
              />
            </div>
            <div className="f12-report-stack">
              <Metric
                motion="cut"
                headingLevel="h2"
                label="Co-Change Pairs Ranked"
                value={snapshot.findings.length}
                format={(v) => `${Math.round(v)} pairs`}
                note={`Out of ${snapshot.totalPairsObserved} total file pairs observed across history`}
              />
            </div>
          </PanelPair>
        </Scene>

        {/* Scene 2: Ranked Findings & Commit Evidence Ledger */}
        <Scene gutter="scene" layout="stack">
          <Panel cut="C-04" label="Ranked Co-Change Findings and Commit Evidence">
            <div className="f12-report-stack">
              <div className="f12-report-meta-row">
                <h2 className="f12-sec-title">Ranked Co-Change Findings &amp; Commit Evidence</h2>
                <Tag>{`${snapshot.findings.length} FINDINGS`}</Tag>
              </div>
              {snapshot.findings.length === 0 ? (
                <p className="f12-body-copy">
                  {snapshot.error
                    ? `Analysis failed before ranking findings: ${sanitizeTerminalText(snapshot.error)}`
                    : snapshot.status === 'canceled'
                      ? 'Analysis was canceled before co-change ranking completed.'
                      : 'No file pairs met the co-change threshold in this commit window.'}
                </p>
              ) : (
                <Table>
                  <TableCaption>
                    Historical file co-change evidence for {safeRepo} ({snapshot.commitsExamined}{' '}
                    commits inspected). Overlap = shared ÷ commits of less-changed file; Jaccard =
                    shared ÷ union.
                  </TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Coupled File Pair</TableHead>
                      <TableHead>Coupling &amp; Directional Counts</TableHead>
                      <TableHead>Supporting Commit SHAs</TableHead>
                      <TableHead>Why Review Together</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {snapshot.findings.map((f) => {
                      const id = sanitizeTerminalText(f.id);
                      const fileA = sanitizeTerminalText(f.files[0]);
                      const fileB = sanitizeTerminalText(f.files[1]);
                      const overlapPct = Math.round(f.couplingRatio * 100);
                      const unionCommits = Math.max(
                        1,
                        f.fileACommits + f.fileBCommits - f.cochangeCount,
                      );
                      const jaccardRatio =
                        typeof f.jaccardRatio === 'number' && Number.isFinite(f.jaccardRatio)
                          ? f.jaccardRatio
                          : Math.min(1, Math.round((f.cochangeCount / unionCommits) * 100) / 100);
                      const jaccardPct = Math.round(jaccardRatio * 100);
                      const shas = f.evidence.commitShas
                        .map((s) => sanitizeTerminalText(s))
                        .join(', ');
                      const reason = sanitizeTerminalText(f.reason);
                      return (
                        <TableRow key={id}>
                          <TableCell>
                            <Tag>{id}</Tag>
                          </TableCell>
                          <TableCell>
                            <div className="f12-mono-code">{fileA}</div>
                            <div className="f12-mono-code">{fileB}</div>
                          </TableCell>
                          <TableCell>
                            <div className="f12-mono-code">
                              {f.cochangeCount} shared ({overlapPct}% overlap · {jaccardPct}%
                              Jaccard)
                            </div>
                            <div className="f12-mono-note">
                              {fileA}: {f.cochangeCount}/{f.fileACommits} · {fileB}:{' '}
                              {f.cochangeCount}/{f.fileBCommits}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="f12-mono-code">{shas}</div>
                          </TableCell>
                          <TableCell>
                            <div className="f12-body-copy">{reason}</div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </Panel>
        </Scene>

        {/* Scene 3: Execution Storyboard Log & Scope Guidance */}
        <Scene gutter="scene" layout="equal">
          <Panel cut="C-05" label="Execution Storyboard Step Log">
            <div className="f12-report-stack">
              <div className="f12-report-meta-row">
                <h2 className="f12-sec-title">Execution Storyboard Step Log</h2>
                {snapshotOnly && <Badge burst={false}>SNAPSHOT ONLY · NO LIVE EVENT STREAM</Badge>}
              </div>
              {snapshotOnly ? (
                <p className="f12-body-copy">
                  Rendered from a standalone ResultSnapshot without an accompanying StoryboardEvent
                  stream. Step-level execution timing and intermediate progress events were not
                  recorded for this artifact.
                </p>
              ) : (
                <Table>
                  <TableCaption>
                    Semantic workflow steps executed during run {safeRunId}.
                  </TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order</TableHead>
                      <TableHead>Semantic Step ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Summary</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {steps.map((s, idx) => (
                      <TableRow key={s.stepId}>
                        <TableCell>
                          <span className="f12-mono-code">{`Step ${idx + 1}`}</span>
                        </TableCell>
                        <TableCell>
                          <div className="f12-mono-code">{sanitizeTerminalText(s.stepId)}</div>
                          <div className="f12-mono-note">{sanitizeTerminalText(s.title)}</div>
                        </TableCell>
                        <TableCell>
                          <Tag>{sanitizeTerminalText(s.status.toUpperCase())}</Tag>
                        </TableCell>
                        <TableCell>
                          <span className="f12-mono-note">
                            {sanitizeTerminalText(s.summary ?? '—')}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </Panel>

          <Panel cut="C-06" label="Recommended Review Actions and Scope Notes">
            <div className="f12-report-stack">
              <h2 className="f12-sec-title">Recommended Review Actions &amp; Scope</h2>
              <ul className="f12-action-list">
                {topFinding ? (
                  <li className="f12-action-item">
                    <p className="f12-body-copy">
                      <strong>1. Inspect top coupled pair together ({sanitizeTerminalText(topFinding.id)}):</strong>{' '}
                      When modifying{' '}
                      <span className="f12-mono-code">{sanitizeTerminalText(topFinding.files[0])}</span>,
                      verify whether{' '}
                      <span className="f12-mono-code">{sanitizeTerminalText(topFinding.files[1])}</span>{' '}
                      requires a lockstep update ({topFinding.cochangeCount} shared commits:{' '}
                      <span className="f12-mono-code">
                        {topFinding.evidence.commitShas.map((s) => sanitizeTerminalText(s)).join(', ')}
                      </span>
                      ).
                    </p>
                  </li>
                ) : (
                  <li className="f12-action-item">
                    <p className="f12-body-copy">
                      <strong>1. No high-frequency co-change pairs triggered:</strong> Check run status (
                      {safeStatus}) or widen <code>--max-commits</code> if investigating deeper history.
                    </p>
                  </li>
                )}
                <li className="f12-action-item">
                  <p className="f12-body-copy">
                    <strong>2. Scope qualification:</strong> Overlap measures shared commits divided
                    by the less-frequently changed file&apos;s commits; Jaccard measures shared
                    commits divided by the union of both files&apos; commits. Bulk commits (&gt;50
                    files) and lockfile/binary/generated paths are excluded by default.
                  </p>
                </li>
                {snapshot.reconstructed && (
                  <li className="f12-action-item">
                    <p className="f12-body-copy">
                      <strong>3. Reconstructed artifact notice:</strong>{' '}
                      {sanitizeTerminalText(snapshot.reconstructed.note)}.
                    </p>
                  </li>
                )}
                {snapshot.warnings.map((w, idx) => (
                  <li key={idx} className="f12-action-item">
                    <p className="f12-mono-note">Warning: {sanitizeTerminalText(w)}</p>
                  </li>
                ))}
                {snapshot.error && (
                  <li className="f12-action-item">
                    <p className="f12-mono-note">Error: {sanitizeTerminalText(snapshot.error)}</p>
                  </li>
                )}
              </ul>
            </div>
          </Panel>
        </Scene>
      </Sheet>
    </main>
  );
}

/**
 * Renders a self-contained, offline static HTML document using real FRAME/12
 * registry components and inlined registry/styles/frame12.css.
 */
export function renderWebReportHtml(
  snapshot: ResultSnapshot,
  events: StoryboardEvent[] = [],
  options: WebReportOptions = {},
): string {
  const theme: 'light' | 'dark' = options.theme === 'dark' ? 'dark' : 'light';
  const safeTitle = sanitizeTerminalText(
    options.title ?? `FRAME/12 Storyboard Report — ${snapshot.repoLabel}`,
  );
  const frame12Css = loadFrame12Css();
  const markup = renderToStaticMarkup(
    <StoryboardReportView snapshot={snapshot} events={events} theme={theme} />,
  );

  return [
    '<!doctype html>',
    `<html lang="en" data-theme="${theme}" class="f12-theme-${theme}">`,
    '<head>',
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data:;" />',
    `<title>${escapeHtmlText(safeTitle)}</title>`,
    '<style>',
    frame12Css,
    REPORT_LAYOUT_CSS,
    '</style>',
    '</head>',
    '<body>',
    markup,
    '</body>',
    '</html>',
  ].join('\n');
}

function escapeHtmlText(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
