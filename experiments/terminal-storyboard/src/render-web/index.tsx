import { existsSync, readFileSync } from 'node:fs';
import { dirname, posix, resolve } from 'node:path';
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
import {
  validateEventStream,
  type ResultSnapshot,
  type StepExecutionRecord,
  type StoryboardEvent,
} from '../model/index.js';
import { sanitizeTerminalText } from '../render-plain/index.js';
import { classifyCochangePair, describeCochangeRelationship } from '../workload/git-history.js';

export interface WebReportOptions {
  theme?: 'light' | 'dark';
  title?: string;
}

declare const __FRAME12_CSS__: string | undefined;

function loadFrame12Css(): string {
  if (typeof __FRAME12_CSS__ === 'string' && __FRAME12_CSS__.length > 0) {
    return __FRAME12_CSS__;
  }
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
  '.f12-run-summary-banner { display: flex; flex-wrap: wrap; align-items: center; gap: var(--f-gutter-pair); padding: 8px 12px; margin-top: 8px; border: 2px solid var(--f-rule); background: var(--f-panel); font-family: var(--font-f-mono); font-size: 12px; color: var(--f-ink); }',
  '.f12-sec-title { font-family: var(--font-f-mono); font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--f-ink-2); margin: 0; }',
  '.f12-mono-code { font-family: var(--font-f-mono); font-size: 12px; color: var(--f-ink); word-break: normal; overflow-wrap: break-word; }',
  '.f12-mono-note { font-family: var(--font-f-mono); font-size: 11px; color: var(--f-ink-2); line-height: 1.45; margin: 0; word-break: normal; overflow-wrap: break-word; }',
  '.f12-body-copy { font-family: var(--font-f-body); font-size: 13px; color: var(--f-ink); line-height: 1.5; margin: 0; word-break: normal; overflow-wrap: break-word; }',
  '.f12-path { font-family: var(--font-f-mono); font-size: 12.5px; color: var(--f-ink); word-break: normal; overflow-wrap: break-word; line-height: 1.45; }',
  '.f12-path-dir { color: var(--f-ink-2); font-weight: 400; }',
  '.f12-path-base { color: var(--f-ink); font-weight: 700; }',
  '.f12-pair-arrow { color: var(--f-ink-2); padding: 0 4px; font-weight: 400; }',
  '.f12-static-bar-li { list-style: none; }',
  '.f12-static-bar-item { display: flex; flex-direction: column; gap: var(--f-gutter-pair); padding: 12px 4px; min-width: 0; }',
  '.f12-static-bar-head { display: flex; flex-wrap: wrap; align-items: center; gap: var(--f-gutter-pair); min-width: 0; }',
  '.f12-static-bar-pair { min-width: 0; flex: 1; line-height: 1.4; }',
  '.f12-static-bar-track-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: var(--f-gutter-pair); width: 100%; min-width: 0; }',
  '.f12-static-bar-track-row > .f12-int-bar, .f12-static-bar-track-row > .f12-int-val { grid-area: auto; }',
  '.f12-hotspot-list { display: flex; flex-direction: column; gap: 0; padding: 0; margin: 0; list-style: none; border-top: 1px solid var(--f-grid); }',
  '.f12-hotspot-item { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: var(--f-gutter-pair); padding: 6px 0; border-bottom: 1px solid var(--f-grid); font-size: 12px; }',
  '.f12-finding-cards { display: flex; flex-direction: column; gap: var(--f-gutter-scene); padding: 0; margin: 0; list-style: none; }',
  '.f12-finding-card { display: flex; flex-direction: column; gap: var(--f-gutter-pair); padding: 16px; border: 2px solid var(--f-rule); background: var(--f-panel); min-width: 0; }',
  '.f12-finding-card-hero { border-width: 2.5px; }',
  '.f12-finding-card-hd { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--f-gutter-pair); padding-bottom: 8px; border-bottom: 1px solid var(--f-grid); min-width: 0; }',
  '.f12-finding-card-badges { display: flex; flex-wrap: wrap; align-items: center; gap: var(--f-gutter-pair); }',
  '.f12-finding-card-files { display: flex; flex-direction: column; gap: 0; padding: 8px 12px; border-left: 2.5px solid var(--f-rule); background: var(--f-desk); min-width: 0; }',
  '.f12-finding-card-file-row { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0; min-width: 0; line-height: 1.5; }',
  '.f12-finding-card-metrics { display: flex; flex-direction: column; gap: 0; padding: 8px 12px; border: 1px solid var(--f-grid); min-width: 0; }',
  '.f12-finding-card-body { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: var(--f-gutter-pair); min-width: 0; }',
  '.f12-finding-card-col { display: flex; flex-direction: column; gap: 0; min-width: 0; }',
  '.f12-finding-card-evidence { padding-top: 8px; border-top: 1px dashed var(--f-grid); display: flex; flex-direction: column; gap: 0; min-width: 0; }',
  '.f12-action-list { display: flex; flex-direction: column; gap: var(--f-gutter-pair); padding: 0; margin: 0; list-style: none; }',
  '.f12-action-item { border-left: 2.5px solid var(--f-rule); padding-left: 10px; display: flex; flex-direction: column; gap: 0; }',
  '.f12-tag, .f12-nowrap { white-space: nowrap; }',
  '.f12-tag.f12-tag-ink, .f12-badge.f12-badge-ink { background: var(--f-ink); color: var(--f-panel); border-color: var(--f-rule); }',
  '.f12-tag.f12-tag-muted, .f12-badge.f12-badge-muted { background: var(--f-panel); color: var(--f-ink); border: 1.5px solid var(--f-rule); }',
  '.f12-metric.big .f12-m-value { font-size: clamp(22px, 3.4cqi, 34px); line-height: 1.18; word-break: normal; overflow-wrap: break-word; }',
  '.f12-metric .f12-m-note { max-width: 68ch; }',
  '.f12-table td, .f12-title, .f12-sub { word-break: normal; overflow-wrap: break-word; }',
  '@media (max-width: 760px) { .f12-static-bar-track-row { grid-template-columns: minmax(0, 1fr); } .f12-int-val { justify-content: flex-start; } .f12-finding-card { padding: 12px; } .f12-finding-card-body { grid-template-columns: minmax(0, 1fr); } .f12-table th, .f12-table td { padding: 6px 4px 6px 0; font-size: 11px; overflow-wrap: anywhere; word-break: break-word; } .f12-table .f12-mono-code, .f12-table .f12-mono-note, .f12-table .f12-body-copy, .f12-table .f12-path, .f12-finding-card .f12-path, .f12-finding-card .f12-mono-code, .f12-finding-card .f12-mono-note { overflow-wrap: anywhere; word-break: break-word; } }',
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

/**
 * Formats a repository file path with dimmed directory segments, bold filename
 * basename, and <wbr /> break opportunities after every '/' so long paths wrap
 * cleanly at directory boundaries instead of mid-word.
 */
function renderFormattedPath(rawPath: string): React.ReactNode {
  const safe = sanitizeTerminalText(rawPath);
  const parts = safe.split('/');
  const base = parts.pop() ?? safe;
  return (
    <span className="f12-path" data-path={safe}>
      {parts.length > 0 && (
        <span className="f12-path-dir">
          {parts.map((seg, idx) => (
            <React.Fragment key={idx}>
              {seg}/<wbr />
            </React.Fragment>
          ))}
        </span>
      )}
      <strong className="f12-path-base">{base}</strong>
    </span>
  );
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
  const maxSharedCommits = topFinding ? Math.max(1, topFinding.cochangeCount) : 1;

  const topClassification = topFinding
    ? (topFinding.classification ?? classifyCochangePair(topFinding.files[0], topFinding.files[1]))
    : undefined;
  const topRel = topFinding
    ? describeCochangeRelationship({
        files: topFinding.files,
        cochangeCount: topFinding.cochangeCount,
        fileACommits: topFinding.fileACommits,
        fileBCommits: topFinding.fileBCommits,
        jaccardRatio: topFinding.jaccardRatio,
        sampleSubjects: topFinding.evidence.sampleSubjects,
        classification: topClassification,
      })
    : null;

  const topBaseA = topFinding ? posix.basename(sanitizeTerminalText(topFinding.files[0])) : '';
  const topBaseB = topFinding ? posix.basename(sanitizeTerminalText(topFinding.files[1])) : '';
  const topUnionCommits = topFinding
    ? Math.max(1, topFinding.fileACommits + topFinding.fileBCommits - topFinding.cochangeCount)
    : 1;
  const topJaccardPct = topFinding
    ? Math.round(
        (typeof topFinding.jaccardRatio === 'number' && Number.isFinite(topFinding.jaccardRatio)
          ? topFinding.jaccardRatio
          : topFinding.cochangeCount / topUnionCommits) * 100,
      )
    : 0;

  const calloutText = topFinding
    ? `Changed together in ${topFinding.cochangeCount} of ${topUnionCommits} commits (${topBaseA}: ${topFinding.cochangeCount}/${topFinding.fileACommits} · ${topBaseB}: ${topFinding.cochangeCount}/${topFinding.fileBCommits} · ${topJaccardPct}% Jaccard)`
    : snapshot.error
      ? `Run failed: ${sanitizeTerminalText(snapshot.error)}`
      : `Status: ${safeStatus} (${snapshot.commitsExamined} commits examined · 0 qualifying pairs)`;

  return (
    <main className="f12-report-main">
      <Sheet pegs motion="cut" theme={theme}>
        <header className="f12-hd">
          <div>
            <div className="f12-eyebrow">
              <span>FRAME/12 STORYBOARD REPORT</span>
              <span>·</span>
              <Tag className="f12-tag-ink">{safeStatus}</Tag>
              {snapshot.reconstructed && (
                <Badge burst={false} className="f12-badge-muted">
                  RECONSTRUCTED SNAPSHOT · NOT LIVE EVENTS
                </Badge>
              )}
              {snapshotOnly && !snapshot.reconstructed && (
                <Badge burst={false} className="f12-badge-muted">
                  SNAPSHOT ONLY · NO LIVE EVENT STREAM
                </Badge>
              )}
            </div>
            <h1 className="f12-title">Co-Change Storyboard: {safeRepo}</h1>
            <div className="f12-run-summary-banner">
              <span>
                <strong>{snapshot.commitsExamined}</strong> commits examined
              </span>
              <span>·</span>
              <span>
                <strong>{snapshot.uniqueFilesObserved}</strong> active files
              </span>
              <span>·</span>
              <span>
                <strong>{snapshot.totalPairsObserved}</strong> observed co-change pairs
              </span>
              <span>·</span>
              <span>
                <strong>Top {snapshot.findings.length}</strong> ranked findings
              </span>
            </div>
          </div>
        </header>

        {/* Scene 1: Primary Finding Hero & Executive Summary */}
        <Scene gutter="scene" layout="split">
          <Panel cut="C-01" label="Primary Co-Change Finding and Ranked Pairs">
            <div className="f12-report-stack">
              <Metric
                big
                motion="cut"
                headingLevel="h2"
                label={
                  topFinding && topRel
                    ? `Primary Co-Change Finding (${sanitizeTerminalText(topFinding.id)} · ${topRel.patternLabel})`
                    : 'Primary Co-Change Finding'
                }
                value={topFinding ? topFinding.cochangeCount : 0}
                format={() =>
                  topFinding ? `${topBaseA} ↔ ${topBaseB}` : 'No coupled pairs above threshold'
                }
                note={
                  topFinding
                    ? `${sanitizeTerminalText(topFinding.files[0])} + ${sanitizeTerminalText(topFinding.files[1])}`
                    : `Target repository: ${safeRepo} (${snapshot.commitsExamined} commits examined)`
                }
              />
              <Balloon showDot tailOffset={0}>
                {calloutText}
              </Balloon>

              {/* Static non-interactive screentone bar list (zero <button> elements, label above bar) */}
              <div className="f12-ints">
                <div className="f12-ints-hd">
                  <h3 className="f12-sec-title">Coupled File Pairs by Shared Commits</h3>
                  <p className="f12-ints-sub">
                    Screentone fill = shared commits · right label = shared of combined union
                    commits
                  </p>
                </div>
                <ul className="f12-ints-list">
                  {snapshot.findings.length === 0 ? (
                    <li className="f12-static-bar-li">
                      <div className="f12-static-bar-item">
                        <div className="f12-static-bar-head">
                          <span className="f12-mono-note">
                            No coupled file pairs met the minimum threshold in this window.
                          </span>
                        </div>
                        <div className="f12-static-bar-track-row">
                          <span className="f12-int-bar">
                            <span className="f12-int-fill" style={{ width: '0%' }} />
                          </span>
                          <span className="f12-int-val">
                            <span>0 commits</span>
                          </span>
                        </div>
                      </div>
                    </li>
                  ) : (
                    snapshot.findings.map((f) => {
                      const id = sanitizeTerminalText(f.id);
                      const unionCommits = Math.max(
                        1,
                        f.fileACommits + f.fileBCommits - f.cochangeCount,
                      );
                      const jaccardRatio =
                        typeof f.jaccardRatio === 'number' && Number.isFinite(f.jaccardRatio)
                          ? f.jaccardRatio
                          : Math.min(1, Math.round((f.cochangeCount / unionCommits) * 100) / 100);
                      const jaccardPct = Math.round(jaccardRatio * 100);
                      const barPct = Math.max(
                        8,
                        Math.min(100, Math.round((f.cochangeCount / maxSharedCommits) * 100)),
                      );
                      return (
                        <li key={id} className="f12-static-bar-li">
                          <div className="f12-static-bar-item">
                            <div className="f12-static-bar-head">
                              <Tag className={f.id === 'F-01' ? '' : 'f12-tag-muted'}>{id}</Tag>
                              <span className="f12-static-bar-pair">
                                {renderFormattedPath(f.files[0])}
                                <span className="f12-pair-arrow">↔</span>
                                {renderFormattedPath(f.files[1])}
                              </span>
                              {f.id === 'F-01' && <Badge burst={false}>TOP PAIR</Badge>}
                            </div>
                            <div className="f12-static-bar-track-row">
                              <span className="f12-int-bar">
                                <span
                                  className="f12-int-fill"
                                  style={{ width: `${barPct}%` }}
                                />
                              </span>
                              <span className="f12-int-val">
                                <span>{`${f.cochangeCount} of ${unionCommits} commits`}</span>
                                <span className="f12-int-share">{`${jaccardPct}% Jaccard`}</span>
                              </span>
                            </div>
                          </div>
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>
            </div>
          </Panel>

          <PanelPair
            topCut="C-02"
            bottomCut="C-03"
            topLabel="Executive Summary and Recommended Action"
            bottomLabel="Analysis Coverage and Active Hotspots"
          >
            <div className="f12-report-stack">
              <h2 className="f12-sec-title">Executive Summary &amp; Recommended Action</h2>
              {topFinding && topRel ? (
                <>
                  <div className="f12-report-meta-row">
                    <Tag>{sanitizeTerminalText(topFinding.id)}</Tag>
                    <Badge burst={false} className="f12-badge-ink">
                      {topRel.patternLabel.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="f12-body-copy">
                    <strong>{sanitizeTerminalText(topRel.summary)}</strong>
                  </p>
                  <div className="f12-action-item">
                    <p className="f12-body-copy">
                      <strong>Recommended next step:</strong> {sanitizeTerminalText(topRel.actionHint)}
                    </p>
                    <p className="f12-mono-note">
                      Supporting commits:{' '}
                      {topFinding.evidence.commitShas
                        .slice(0, 5)
                        .map((s) => sanitizeTerminalText(s))
                        .join(', ')}
                    </p>
                    {topFinding.evidence.sampleSubjects[0] && (
                      <p className="f12-mono-note">
                        Latest commit: &ldquo;
                        {sanitizeTerminalText(topFinding.evidence.sampleSubjects[0])}&rdquo;
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <p className="f12-body-copy">
                  No high-frequency co-change pairs were triggered in this window. Widen{' '}
                  <code>--max-commits</code> or pass <code>--include-noise</code> if investigating
                  test/doc/lockfile activity.
                </p>
              )}
            </div>

            <div className="f12-report-stack">
              <Metric
                motion="cut"
                headingLevel="h2"
                label="Analysis Coverage & Active Hotspots"
                value={snapshot.findings.length}
                format={(v) => `Top ${Math.round(v)} ranked pairs`}
                note={`Selected from ${snapshot.totalPairsObserved} observed pairs across ${snapshot.commitsExamined} commits and ${snapshot.uniqueFilesObserved} active files`}
              />
              {snapshot.hotFiles.length > 0 && (
                <ul className="f12-hotspot-list" aria-label="Most frequently changed files">
                  {snapshot.hotFiles.slice(0, 4).map((h) => (
                    <li key={sanitizeTerminalText(h.file)} className="f12-hotspot-item">
                      <span>{renderFormattedPath(h.file)}</span>
                      <span className="f12-mono-note">
                        {h.commits} commits ({Math.round(h.share * 100)}%)
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </PanelPair>
        </Scene>

        {/* Scene 2: Ranked Findings & Commit Evidence Ledger */}
        <Scene gutter="scene" layout="stack">
          <Panel cut="C-04" label="Ranked Co-Change Findings and Commit Evidence">
            <div className="f12-report-stack">
              <div className="f12-report-meta-row">
                <h2 className="f12-sec-title">Ranked Co-Change Findings &amp; Commit Evidence</h2>
                <Tag className="f12-tag-muted">{`${snapshot.findings.length} FINDINGS`}</Tag>
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
                <>
                  <p className="f12-mono-note">
                    Historical file co-change evidence for {safeRepo} ({snapshot.commitsExamined}{' '}
                    commits inspected). Each card presents shared commit counts, directional touch
                    counts, observed commit history, and a suggested review action.
                  </p>
                  <ol className="f12-finding-cards" aria-label="Ranked co-change findings">
                    {snapshot.findings.map((f) => {
                      const id = sanitizeTerminalText(f.id);
                      const baseA = posix.basename(sanitizeTerminalText(f.files[0]));
                      const baseB = posix.basename(sanitizeTerminalText(f.files[1]));
                      const overlapPct = Math.round(f.couplingRatio * 100);
                      const unionCommits = Math.max(
                        1,
                        f.fileACommits + f.fileBCommits - f.cochangeCount,
                      );
                      const unionNoun = unionCommits === 1 ? 'commit' : 'commits';
                      const jaccardRatio =
                        typeof f.jaccardRatio === 'number' && Number.isFinite(f.jaccardRatio)
                          ? f.jaccardRatio
                          : Math.min(1, Math.round((f.cochangeCount / unionCommits) * 100) / 100);
                      const jaccardPct = Math.round(jaccardRatio * 100);
                      const shas = f.evidence.commitShas
                        .map((s) => sanitizeTerminalText(s))
                        .join(', ');
                      const classification =
                        f.classification ?? classifyCochangePair(f.files[0], f.files[1]);
                      const rel = describeCochangeRelationship({
                        files: f.files,
                        cochangeCount: f.cochangeCount,
                        fileACommits: f.fileACommits,
                        fileBCommits: f.fileBCommits,
                        jaccardRatio,
                        sampleSubjects: f.evidence.sampleSubjects,
                        classification,
                      });
                      const classificationLabel =
                        classification === 'test-companion'
                          ? 'TEST COMPANION'
                          : classification === 'docs-release'
                            ? 'DOCS / RELEASE'
                            : classification === 'workspace-mirror'
                              ? 'WORKSPACE MIRROR'
                              : classification === 'same-module'
                                ? 'SAME MODULE'
                                : 'CROSS-MODULE';

                      return (
                        <li
                          key={id}
                          className={
                            f.id === 'F-01'
                              ? 'f12-finding-card f12-finding-card-hero'
                              : 'f12-finding-card'
                          }
                        >
                          <div className="f12-finding-card-hd">
                            <div className="f12-finding-card-badges">
                              <Tag className={f.id === 'F-01' ? '' : 'f12-tag-muted'}>{id}</Tag>
                              {f.id === 'F-01' && <Badge burst={false}>TOP PAIR · REVIEW</Badge>}
                              <Badge burst={false} className="f12-badge-ink">
                                {rel.patternLabel.toUpperCase()}
                              </Badge>
                              <Tag className="f12-tag-muted">{classificationLabel}</Tag>
                            </div>
                            <span className="f12-mono-code">
                              <strong>
                                {f.cochangeCount} of {unionCommits} combined {unionNoun} (
                                {jaccardPct}% Jaccard)
                              </strong>
                            </span>
                          </div>

                          <div className="f12-finding-card-files">
                            <div className="f12-finding-card-file-row">
                              {renderFormattedPath(f.files[0])}
                            </div>
                            <div className="f12-finding-card-file-row">
                              <span className="f12-pair-arrow">⇆</span>
                              {renderFormattedPath(f.files[1])}
                            </div>
                          </div>

                          <div className="f12-finding-card-metrics">
                            <span className="f12-mono-code">
                              Changed together in <strong>{f.cochangeCount}</strong> of{' '}
                              <strong>{unionCommits}</strong> combined commits · {baseA}:{' '}
                              {f.cochangeCount}/{f.fileACommits} · {baseB}: {f.cochangeCount}/
                              {f.fileBCommits} · {jaccardPct}% Jaccard ({overlapPct}% overlap)
                            </span>
                          </div>

                          <div className="f12-finding-card-body">
                            <div className="f12-finding-card-col">
                              <span className="f12-mono-note">OBSERVED HISTORY</span>
                              <p className="f12-body-copy">{sanitizeTerminalText(rel.summary)}</p>
                            </div>
                            <div className="f12-finding-card-col">
                              <span className="f12-mono-note">SUGGESTED REVIEW ACTION</span>
                              <p className="f12-body-copy">{sanitizeTerminalText(rel.actionHint)}</p>
                            </div>
                          </div>

                          <div className="f12-finding-card-evidence">
                            <span className="f12-mono-code">
                              <strong>Supporting commit SHAs:</strong> {shas}
                            </span>
                            {f.evidence.sampleSubjects[0] && (
                              <span className="f12-mono-note">
                                Latest commit subject: &ldquo;
                                {sanitizeTerminalText(f.evidence.sampleSubjects[0])}&rdquo;
                              </span>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </>
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
                {snapshotOnly && (
                  <Badge burst={false} className="f12-badge-muted">
                    SNAPSHOT ONLY · NO LIVE EVENT STREAM
                  </Badge>
                )}
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
                          <span className="f12-mono-code f12-nowrap">{`Step ${idx + 1}`}</span>
                        </TableCell>
                        <TableCell>
                          <div className="f12-mono-code">{sanitizeTerminalText(s.stepId)}</div>
                          <div className="f12-mono-note">{sanitizeTerminalText(s.title)}</div>
                        </TableCell>
                        <TableCell>
                          <Tag className="f12-tag-muted">
                            {sanitizeTerminalText(s.status.toUpperCase())}
                          </Tag>
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

          <Panel cut="C-06" label="Scope, Active Filters and Replay Metadata">
            <div className="f12-report-stack">
              <h2 className="f12-sec-title">Scope, Active Filters &amp; Warnings</h2>
              <ul className="f12-action-list">
                <li className="f12-action-item">
                  <p className="f12-body-copy">
                    <strong>Default noise &amp; pair classification:</strong> Bulk sweep commits
                    (&gt;50 files), lockfiles, and binary assets are filtered by default, while full
                    co-change evidence is preserved and classified (<code>CROSS-MODULE</code>,{' '}
                    <code>SAME MODULE</code>, <code>TEST COMPANION</code>, <code>DOCS / RELEASE</code>
                    , or <code>WORKSPACE MIRROR</code>). Use <code>--exclude &lt;glob&gt;</code> to
                    exclude specific paths or <code>--include-noise</code> to include lockfiles and
                    bulk commits.
                  </p>
                </li>
                <li className="f12-action-item">
                  <p className="f12-body-copy">
                    <strong>Metric definitions:</strong> Shared commit frequency reports{' '}
                    <em>shared ÷ combined union commits</em> (Jaccard) alongside directional per-file
                    counts and <em>shared ÷ commits of less-changed file</em> (overlap).
                  </p>
                </li>
                {snapshot.reconstructed && (
                  <li className="f12-action-item">
                    <p className="f12-body-copy">
                      <strong>Reconstructed artifact notice:</strong>{' '}
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
                <li className="f12-action-item">
                  <p className="f12-mono-note">
                    Run metadata: runId <code>{safeRunId}</code> · window {snapshot.maxCommits}{' '}
                    commits · schema <code>{sanitizeTerminalText(snapshot.schemaVersion)}</code>
                    {snapshot.reconstructed
                      ? ` · source ${sanitizeTerminalText(snapshot.reconstructed.source)} (v${sanitizeTerminalText(snapshot.reconstructed.originalSchemaVersion)})`
                      : ''}
                  </p>
                </li>
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
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data:; font-src data:;" />',
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
