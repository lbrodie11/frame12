/**
 * The live view's Ink components. They draw the PR 2 grammar's own text (cut lines, evidence
 * cards, receipt lists), so the live and linear views say the same things; the live view only adds
 * focus, the Inspector, key hints and completed cuts in Ink's <Static> (emitted once, no redraw).
 */
import * as React from 'react';
import { Box, Static, Text, useInput } from 'ink';
import type { CutState, Director, RunState } from '../core/director.js';
import type { Finding } from '../core/contract.js';
import { glyph } from '../core/glyphs.js';
import { safeLink } from '../core/safety.js';
import { paint } from '../core/tokens.js';
import { truncateEnd } from '../core/width.js';
import {
  FINDING_STATUS_WORDS,
  compactFinding,
  cut,
  evidenceCard,
  masthead,
  toneBar,
  type NextStep,
  type RenderCaps,
} from '../render/grammar.js';
import { orderFindings } from '../render/index.js';

/** Re-renders when the Director publishes; reads its current state. */
export function useRunState(director: Director): Readonly<RunState> {
  React.useSyncExternalStore(
    React.useCallback((cb) => director.subscribe(() => cb()), [director]),
    () => director.snapshot().version,
  );
  return director.snapshot();
}

export interface StoryboardProps {
  director: Director;
  rc: RenderCaps;
  /** Terminal rows, for fitting the findings list. */
  rows: number;
  product?: string;
  nextSteps?: NextStep[];
  /** `q`: finish (the host decides whether a running job is canceled first). */
  onQuit: () => void;
  /** Ctrl-C in raw mode (it arrives as a key, not SIGINT). */
  onInterrupt: () => void;
  /** Opens a vetted https URL after the person confirmed it. */
  onOpen?: (url: string) => void;
}

/** Findings the live view lists: the snapshot's once it arrives, otherwise the narrated ones. */
function liveFindings(state: Readonly<RunState>): Finding[] {
  return state.snapshot ? state.snapshot.findings : state.findings;
}

function firstLink(finding: Finding | undefined): string | undefined {
  if (!finding) return undefined;
  for (const r of finding.receipts ?? []) if (safeLink(r.href)) return safeLink(r.href);
  for (const s of finding.subject) if (safeLink(s.href)) return safeLink(s.href);
  return undefined;
}

/** One cut that is still running: its label, title, a pose-driven indicator and its progress. */
export function Cut({ cutState, rc, pose }: { cutState: CutState; rc: RenderCaps; pose: number }) {
  const p = cutState.progress;
  const dots = [0, 1, 2].map((i) => (i === pose % 3 ? glyph('dot', rc) : ' ')).join('');
  const head = truncateEnd(`${cutState.label} ${glyph('dot', rc)} ${cutState.title.toUpperCase()}`, Math.max(10, rc.columns - 22), rc);
  const fraction =
    p?.total !== undefined && p.total > 0 && p.done !== undefined
      ? `  ${toneBar({ value: p.done / p.total }, rc, 18, 6).split('\n')[0]}  ${p.done}/${p.total}${p.unit ? ` ${p.unit}` : ''}`
      : p?.done !== undefined
        ? `  ${p.done}${p.unit ? ` ${p.unit}` : ''}`
        : '';
  return (
    <Box aria-role="progressbar" aria-label={`${cutState.label} ${cutState.title}: running`} aria-state={{ busy: true }}>
      <Text wrap="truncate-end">
        {paint(head, 'strong', rc.style)} {paint(dots, 'ink2', rc.style)} running{fraction}
      </Text>
    </Box>
  );
}

export function HintBar({ rc, inspecting, helpOpen }: { rc: RenderCaps; inspecting: boolean; helpOpen: boolean }) {
  const hints = helpOpen
    ? 'j/k or up/down: move   enter: inspect   esc: close   o: open link   q: quit   ctrl-c: cancel'
    : `j/k move  ${inspecting ? 'esc close' : 'enter inspect'}  o open  ? help  q quit`;
  return (
    <Box aria-role="toolbar" aria-label="Keys">
      <Text wrap="truncate-end">{paint(hints, 'ink2', rc.style)}</Text>
    </Box>
  );
}

/** The focused finding, expanded in place with every receipt. */
export function Inspector({ finding, frame, firstReceipt, rc, marker }: { finding: Finding; frame: string; firstReceipt: number; rc: RenderCaps; marker: boolean }) {
  return (
    <Box aria-label={`${frame} details`} aria-state={{ expanded: true }} flexDirection="column">
      <Text>{evidenceCard(finding, { frame, firstReceipt, marker, maxReceipts: Number.POSITIVE_INFINITY }, rc)}</Text>
    </Box>
  );
}

/** The live view's root. */
export function Storyboard({ director, rc, rows, product, nextSteps, onQuit, onInterrupt, onOpen }: StoryboardProps) {
  const state = useRunState(director);
  // Only a render trigger for focus moves; the focus itself lives in the refs below.
  const [, setFocus] = React.useState(0);
  const [inspecting, setInspecting] = React.useState(false);
  const [helpOpen, setHelpOpen] = React.useState(false);
  const [confirmUrl, setConfirmUrl] = React.useState<string | undefined>(undefined);

  // Completed cuts move into <Static>: written once, never redrawn. Append in the order they end.
  // Static memoizes `items.slice(index)` on the array's identity, so every append must hand it a
  // new array; pushing into the same one would let its index move past entries it never drew.
  const doneRef = React.useRef<Array<{ key: string; text: string }>>([]);
  const doneIds = React.useRef(new Set<string>());
  const added: Array<{ key: string; text: string }> = [];
  if (!doneIds.current.has(' masthead') && state.title !== undefined) {
    doneIds.current.add(' masthead');
    added.push({ key: ' masthead', text: masthead({ product: product ?? state.product ?? 'FRAME/12', title: state.title }, rc) });
  }
  for (const c of state.cuts) {
    if (c.status === 'running' || doneIds.current.has(c.cut)) continue;
    doneIds.current.add(c.cut);
    added.push({
      key: c.cut,
      text: cut({ label: c.label, title: c.title, status: c.status, ...(c.durationMs !== undefined ? { durationMs: c.durationMs } : {}), ...(c.summary ? { summary: c.summary } : {}) }, rc),
    });
  }
  if (added.length > 0) doneRef.current = [...doneRef.current, ...added];

  const ordered = orderFindings(liveFindings(state));
  // Focus follows the finding, not its row: when the snapshot arrives or a new finding is narrated
  // and the order changes, the cursor (and an open Inspector) stays on the same finding. If that
  // finding is gone, focus stays on the same row.
  const focusIdRef = React.useRef<string | undefined>(undefined);
  const lastIndexRef = React.useRef(0);
  let focusIndex = focusIdRef.current === undefined ? -1 : ordered.findIndex((o) => o.finding.id === focusIdRef.current);
  if (focusIndex === -1) focusIndex = Math.min(lastIndexRef.current, Math.max(0, ordered.length - 1));
  focusIdRef.current = ordered[focusIndex]?.finding.id;
  lastIndexRef.current = focusIndex;
  const focused = ordered[focusIndex];
  const running = state.cuts.filter((c) => c.status === 'running');

  useInput((input, key) => {
    // Keys that arrive together (key repeat, a paste, a fast typist over SSH) come as one string;
    // handle them one at a time so none is lost. Special keys (arrows, Enter, Esc) come alone.
    const plain = !key.ctrl && !key.meta && !key.return && !key.escape && !key.upArrow && !key.downArrow;
    if (plain && [...input].length > 1) {
      for (const ch of input) handleKey(ch, key);
      return;
    }
    handleKey(input, key);
  });

  /** Focus moves are computed from the latest focus, so a batch of keys moves several rows. */
  function moveFocus(delta: number) {
    const next = Math.min(Math.max(lastIndexRef.current + delta, 0), Math.max(0, ordered.length - 1));
    lastIndexRef.current = next;
    focusIdRef.current = ordered[next]?.finding.id;
    setFocus(next);
  }

  function handleKey(input: string, key: Parameters<Parameters<typeof useInput>[0]>[1]) {
    // Every key is echoed in the same render: nothing here waits for the tempo.
    if (key.ctrl && input === 'c') return onInterrupt();
    if (confirmUrl !== undefined) {
      if (input === 'y' || input === 'Y') onOpen?.(confirmUrl);
      setConfirmUrl(undefined);
      return;
    }
    if (key.escape) {
      if (helpOpen) setHelpOpen(false);
      else setInspecting(false);
      return;
    }
    if (input === '?') return setHelpOpen((v) => !v);
    if (input === 'q') return onQuit();
    if (key.downArrow || input === 'j') return moveFocus(1);
    if (key.upArrow || input === 'k') return moveFocus(-1);
    if (key.return) return setInspecting((v) => !v);
    if (input === 'o') {
      const url = firstLink(ordered[lastIndexRef.current]?.finding);
      if (url) setConfirmUrl(url);
    }
  }

  // Fit the findings list to the rows left for it, keeping the focused row in view.
  const reserved = 6 + running.length + (inspecting ? 0 : 3);
  const room = Math.max(3, rows - reserved);
  const start = Math.max(0, Math.min(focusIndex - Math.floor(room / 2), ordered.length - room));
  const visible = inspecting ? [] : ordered.slice(start, start + room);
  const lastWarning = state.warnings.at(-1);
  let lastProblem: (typeof state.logs)[number] | undefined;
  for (let i = state.logs.length - 1; i >= 0 && !lastProblem; i--) if (state.logs[i]!.level === 'error' || state.logs[i]!.level === 'warn') lastProblem = state.logs[i];

  return (
    <>
      <Static items={doneRef.current}>{(item) => <Text key={item.key}>{item.text}</Text>}</Static>
      <Box flexDirection="column">
        {running.map((c) => (
          <Cut key={c.cut} cutState={c} rc={rc} pose={state.pose} />
        ))}
        {state.status === 'canceled' && state.canceled ? (
          <Text>{paint(`${glyph('canceled', rc)} canceled: ${state.canceled.reason}`, 'status-warning', rc.style)}</Text>
        ) : null}
        {ordered.length > 0 ? (
          <Box flexDirection="column" aria-role="list" aria-label={`Findings: ${ordered.length}`}>
            <Text>
              {paint('FINDINGS', 'strong', rc.style)} {paint(`${ordered.length}${state.snapshot ? '' : ' so far'}`, 'ink2', rc.style)}
            </Text>
            {inspecting && focused ? (
              <Inspector finding={focused.finding} frame={focused.frame} firstReceipt={focused.firstReceipt} rc={rc} marker={focused.finding.prominence === 'hero'} />
            ) : (
              visible.map((o) => {
                const selected = o === focused;
                const mark = selected ? glyph('focus', rc) : ' ';
                const line = compactFinding(o.finding, o.frame, { ...rc, columns: rc.columns - 2 }).split('\n')[0] ?? '';
                return (
                  <Box key={o.finding.id} aria-role="listitem" aria-label={`${o.frame} ${o.finding.title}: ${FINDING_STATUS_WORDS[o.finding.status]}`} aria-state={{ selected }}>
                    <Text wrap="truncate-end">
                      {paint(mark, 'strong', rc.style)} {line}
                    </Text>
                  </Box>
                );
              })
            )}
          </Box>
        ) : null}
        {lastProblem ? <Text wrap="truncate-end">{paint(`${lastProblem.level}: ${lastProblem.text.split('\n')[0]}`, lastProblem.level === 'error' ? 'status-danger' : 'ink2', rc.style)}</Text> : null}
        {lastWarning ? <Text wrap="truncate-end">{paint(`${glyph('warning', rc)} warning: ${lastWarning}`, 'status-warning', rc.style)}{state.warnings.length > 1 ? paint(` (+${state.warnings.length - 1} more)`, 'ink2', rc.style) : ''}</Text> : null}
        {confirmUrl !== undefined ? (
          <Box aria-role="menu" aria-label="Confirm opening a link">
            <Text wrap="truncate-end">Open {confirmUrl} in your browser? y/N</Text>
          </Box>
        ) : (
          <HintBar rc={rc} inspecting={inspecting} helpOpen={helpOpen} />
        )}
        {nextSteps && nextSteps.length > 0 && state.status !== 'running' && state.status !== 'idle' ? (
          <Text>{paint(`next: ${nextSteps[0]!.command}`, 'ink2', rc.style)}</Text>
        ) : null}
      </Box>
    </>
  );
}

