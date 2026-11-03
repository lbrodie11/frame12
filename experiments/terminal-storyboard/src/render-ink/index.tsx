import { Writable } from 'node:stream';
import * as React from 'react';
import chalk from 'chalk';
import { Box, Text, render, type Instance as InkInstance } from 'ink';
import {
  validateEventStream,
  type ResultSnapshot,
  type StoryboardEvent,
} from '../model/index.js';
import {
  sanitizeTerminalText,
  shouldUseColor,
  type PlainRenderOptions,
} from '../render-plain/index.js';
import { FilePair, abbreviatePathMiddle, splitDirAndBase } from './FilePair.js';
import { FindingPanel } from './FindingPanel.js';
import { MarkerLabel } from './MarkerLabel.js';
import { RunSummary } from './RunSummary.js';
import { StepLine } from './StepLine.js';
import { StoryboardApp, type StoryboardStepItem } from './StoryboardApp.js';
import { ToneBar } from './ToneBar.js';

export {
  FilePair,
  FindingPanel,
  MarkerLabel,
  RunSummary,
  StepLine,
  StoryboardApp,
  ToneBar,
  abbreviatePathMiddle,
  splitDirAndBase,
  type StoryboardStepItem,
};

export const ON_TWOS_FRAME_MS = 1000 / 12;

export interface InkClock {
  now(): number;
  setTimer(callback: () => void, ms: number): unknown;
  clearTimer(handle: unknown): void;
}

const defaultClock: InkClock = {
  now: () => Date.now(),
  setTimer: (cb, ms) => setTimeout(cb, ms),
  clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export interface InkRenderOptions extends PlainRenderOptions {
  ascii?: boolean;
  reportWritten?: boolean;
  includeHeaderAndSteps?: boolean;
}

export interface InkStreamControllerOptions extends InkRenderOptions {
  write: (chunk: string) => void;
  clock?: InkClock;
  resizeTarget?: {
    columns?: number;
    on?: (event: 'resize', listener: () => void) => void;
    off?: (event: 'resize', listener: () => void) => void;
  };
}

class CaptureWritable extends Writable {
  public columns: number;
  public rows = 40;
  public isTTY = true;
  public frames: string[] = [];
  private lastEmitted: string | null = null;
  private onChunk?: (chunk: string) => void;

  constructor(columns: number, onChunk?: (chunk: string) => void) {
    super();
    this.columns = Math.max(32, Math.floor(columns || 80));
    this.onChunk = onChunk;
  }

  override _write(
    chunk: Buffer | string,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    const raw = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
    const str = raw.replace(/\x1b\[\?25[lh]/g, '');
    if (str.trim().length > 0 && str !== this.lastEmitted) {
      this.lastEmitted = str;
      this.frames.push(str);
      this.onChunk?.(str);
    }
    callback();
  }
}

function stripAnsiSgr(input: string): string {
  return input.replace(/\x1b\[[0-9;]*m/g, '');
}

function renderInkElementToString(
  element: React.ReactElement,
  columns: number,
  colorEnabled: boolean,
): string {
  const stream = new CaptureWritable(columns);
  const prevChalkLevel = chalk.level;
  chalk.level = colorEnabled ? (Math.max(1, prevChalkLevel || 3) as 1 | 2 | 3) : 0;

  let instance: InkInstance | null = null;
  try {
    instance = render(element, {
      stdout: stream as unknown as NodeJS.WriteStream,
      stderr: stream as unknown as NodeJS.WriteStream,
      debug: true,
      patchConsole: false,
      exitOnCtrlC: false,
    });
  } finally {
    try {
      instance?.unmount();
      instance?.cleanup();
    } finally {
      chalk.level = prevChalkLevel;
    }
  }

  const rawFrame = stream.frames[stream.frames.length - 1] ?? '';
  return colorEnabled ? rawFrame : stripAnsiSgr(rawFrame);
}

export function extractStoryboardSteps(
  snapshot: ResultSnapshot,
  events: StoryboardEvent[],
): StoryboardStepItem[] {
  if (events.length > 0) {
    const validated = validateEventStream(events);
    if (!validated.ok) {
      throw new Error(`Invalid event stream passed to Ink renderer: ${validated.error}`);
    }
    return validated.steps.map((s, idx) => ({
      id: s.stepId,
      cutLabel: `C-${String(idx + 1).padStart(2, '0')}`,
      stepId: s.stepId,
      title: s.title,
      status: s.status,
      summary: s.summary,
    }));
  }

  return [
    {
      id: 'validate-repo',
      cutLabel: 'C-01',
      stepId: 'validate-repo',
      title: 'Validate target repository',
      status: snapshot.status === 'failed' && snapshot.commitsExamined === 0 ? 'failed' : 'ok',
      summary: `repo: ${snapshot.repoLabel}`,
    },
    {
      id: 'read-history',
      cutLabel: 'C-02',
      stepId: 'read-history',
      title: 'Read commit history',
      status: 'ok',
      summary: `${snapshot.commitsExamined} commits · ${snapshot.uniqueFilesObserved} files`,
    },
    {
      id: 'pair-cochanges',
      cutLabel: 'C-03',
      stepId: 'pair-cochanges',
      title: 'Pair co-changing files',
      status: 'ok',
      summary: `${snapshot.totalPairsObserved} co-change pairs observed`,
    },
    {
      id: 'rank-findings',
      cutLabel: 'C-04',
      stepId: 'rank-findings',
      title: 'Rank coupled file pairs',
      status: snapshot.status === 'failed' ? 'failed' : 'ok',
      summary: `${snapshot.findings.length} findings ranked`,
    },
  ];
}

/**
 * Renders the FRAME/12 Ink storyboard (Header + C-01..C-04 steps when includeHeaderAndSteps !== false,
 * plus hero FindingPanel, secondary finding rows, and RunSummary) to a string.
 */
export function renderInkStaticSummary(
  snapshot: ResultSnapshot,
  events: StoryboardEvent[],
  options: InkRenderOptions = {},
): string {
  const cols = Math.max(32, Math.floor(options.columns || 80));
  const colorEnabled = shouldUseColor(options);
  const ascii = Boolean(options.ascii);
  const includeHeaderAndSteps = options.includeHeaderAndSteps ?? true;
  const completedSteps = includeHeaderAndSteps ? extractStoryboardSteps(snapshot, events) : [];

  const cleaned = renderInkElementToString(
    <StoryboardApp
      snapshot={snapshot}
      completedSteps={completedSteps}
      columns={cols}
      colorEnabled={colorEnabled}
      ascii={ascii}
      reportWritten={Boolean(options.reportWritten)}
      useStatic={true}
      includeHeaderAndSteps={includeHeaderAndSteps}
    />,
    cols,
    colorEnabled,
  );
  return cleaned.endsWith('\n') ? cleaned : `${cleaned}\n`;
}

/**
 * Live Ink stream controller with Motion-on-Twos (12 fps / 83.33ms) throttling:
 * - Emits the header and each completed C-01..C-04 step line once (never duplicating prior lines)
 * - Coalesces rapid step-progress updates to at most 1 redraw per 83.33ms window
 * - Skips no-op redraws when visible state has not changed
 * - Flushes lifecycle transitions (run-start, step-start, step-end, run-end) immediately
 * - Responds to terminal resize events and cleans up deterministically
 */
export class InkStreamController {
  private writeFn: (chunk: string) => void;
  private clock: InkClock;
  private columns: number;
  private colorEnabled: boolean;
  private ascii: boolean;
  private disposed = false;

  private completedSteps: StoryboardStepItem[] = [];
  private activeSteps = new Map<string, StoryboardStepItem>();
  private stepOrder = new Map<string, string>();
  private nextCutIndex = 0;

  private headerPrinted = false;
  private printedCompletedCount = 0;
  private lastPrintedProgressSig = '';
  private frames: string[] = [];

  private lastFlushAt = -Infinity;
  private pendingTimer: unknown = null;
  private lastSignature = '';
  private redrawCount = 0;
  private resizeCleanup?: () => void;

  constructor(options: InkStreamControllerOptions) {
    this.writeFn = options.write;
    this.clock = options.clock ?? defaultClock;
    this.columns = Math.max(32, Math.floor(options.columns || 80));
    this.colorEnabled = shouldUseColor(options);
    this.ascii = Boolean(options.ascii);

    if (options.resizeTarget?.on) {
      const target = options.resizeTarget;
      const onResize = () => {
        if (this.disposed) return;
        const nextCols = Math.max(32, Math.floor(target.columns || this.columns));
        if (nextCols !== this.columns) {
          this.columns = nextCols;
          this.flushImmediate();
        }
      };
      target.on?.('resize', onResize);
      this.resizeCleanup = () => {
        target.off?.('resize', onResize);
      };
    }
  }

  public getRenderCount(): number {
    return this.redrawCount;
  }

  public getFrames(): string[] {
    return [...this.frames];
  }

  public setColumns(columns: number): void {
    const nextCols = Math.max(32, Math.floor(columns || 80));
    if (nextCols !== this.columns) {
      this.columns = nextCols;
      this.flushImmediate();
    }
  }

  private getActiveStep(): StoryboardStepItem | null {
    let latest: StoryboardStepItem | null = null;
    for (const item of this.activeSteps.values()) {
      latest = item;
    }
    return latest;
  }

  private computeSignature(): string {
    const active = this.getActiveStep();
    return JSON.stringify({
      cols: this.columns,
      completed: this.completedSteps,
      active,
    });
  }

  private emitIncrementalLine(element: React.ReactElement): void {
    const line = renderInkElementToString(element, this.columns, this.colorEnabled);
    if (line.trim().length > 0) {
      this.frames.push(line);
      this.writeFn(`${line}\n`);
    }
  }

  private renderNow(): void {
    if (this.disposed) return;
    const sig = this.computeSignature();
    if (sig === this.lastSignature) {
      return;
    }
    this.lastSignature = sig;
    this.lastFlushAt = this.clock.now();
    this.redrawCount += 1;

    const layoutWidth = Math.max(32, Math.min(this.columns, 88));
    const headerTitle =
      this.columns < 44 ? 'FRAME/12 / STORYBOARD' : 'FRAME/12  /  TERMINAL STORYBOARD';

    if (!this.headerPrinted) {
      this.headerPrinted = true;
      this.emitIncrementalLine(
        <Box width={layoutWidth}>
          <Text bold={Boolean(this.colorEnabled)}>{headerTitle}</Text>
        </Box>,
      );
    }

    let printedAnyCompleted = false;
    while (this.printedCompletedCount < this.completedSteps.length) {
      const s = this.completedSteps[this.printedCompletedCount]!;
      this.printedCompletedCount += 1;
      printedAnyCompleted = true;
      this.lastPrintedProgressSig = '';
      this.emitIncrementalLine(
        <Box width={layoutWidth}>
          <StepLine
            cutLabel={s.cutLabel}
            stepId={s.stepId}
            title={s.title}
            status={s.status}
            summary={s.summary}
            columns={this.columns}
            colorEnabled={this.colorEnabled}
            ascii={this.ascii}
          />
        </Box>,
      );
    }

    const active = this.getActiveStep();
    if (!printedAnyCompleted && active && active.summary) {
      const progSig = `${active.id}:${active.summary}:${this.columns}`;
      if (progSig !== this.lastPrintedProgressSig) {
        this.lastPrintedProgressSig = progSig;
        this.emitIncrementalLine(
          <Box width={layoutWidth}>
            <StepLine
              cutLabel={active.cutLabel}
              stepId={active.stepId}
              title={active.title}
              status={active.status}
              summary={active.summary}
              columns={this.columns}
              colorEnabled={this.colorEnabled}
              ascii={this.ascii}
            />
          </Box>,
        );
      }
    }
  }

  private clearPendingTimer(): void {
    if (this.pendingTimer !== null) {
      this.clock.clearTimer(this.pendingTimer);
      this.pendingTimer = null;
    }
  }

  private flushImmediate(): void {
    this.clearPendingTimer();
    this.renderNow();
  }

  private scheduleThrottledFlush(): void {
    if (this.disposed) return;
    const sig = this.computeSignature();
    if (sig === this.lastSignature) {
      return;
    }
    const elapsed = this.clock.now() - this.lastFlushAt;
    if (elapsed >= ON_TWOS_FRAME_MS) {
      this.flushImmediate();
      return;
    }
    if (this.pendingTimer === null) {
      const remaining = Math.max(1, Math.ceil(ON_TWOS_FRAME_MS - elapsed));
      this.pendingTimer = this.clock.setTimer(() => {
        this.pendingTimer = null;
        this.renderNow();
      }, remaining);
    }
  }

  public onEvent(event: StoryboardEvent): void {
    if (this.disposed) return;

    if (event.type === 'run-start') {
      this.flushImmediate();
      return;
    }

    if (event.type === 'step-start') {
      const stepId = event.stepId ?? `step-${this.nextCutIndex + 1}`;
      this.nextCutIndex += 1;
      const cutLabel = `C-${String(this.nextCutIndex).padStart(2, '0')}`;
      this.stepOrder.set(stepId, cutLabel);
      this.activeSteps.set(stepId, {
        id: stepId,
        cutLabel,
        stepId,
        title: sanitizeTerminalText(String(event.payload.title ?? stepId)),
        status: 'running',
        summary: event.payload.detail ? sanitizeTerminalText(String(event.payload.detail)) : undefined,
      });
      this.flushImmediate();
      return;
    }

    if (event.type === 'step-progress' || (event.type as string) === 'progress') {
      const stepId = event.stepId ?? '';
      const current = this.activeSteps.get(stepId);
      if (current) {
        const nextSummary = sanitizeTerminalText(String(event.payload.message ?? ''));
        if (current.summary === nextSummary) {
          return;
        }
        this.activeSteps.set(stepId, {
          ...current,
          summary: nextSummary,
        });
        this.scheduleThrottledFlush();
      }
      return;
    }

    if (event.type === 'step-end') {
      const stepId = event.stepId ?? `step-${this.nextCutIndex + 1}`;
      const active = this.activeSteps.get(stepId);
      const cutLabel =
        active?.cutLabel ??
        this.stepOrder.get(stepId) ??
        `C-${String(++this.nextCutIndex).padStart(2, '0')}`;
      const title = active?.title ?? sanitizeTerminalText(stepId);
      this.activeSteps.delete(stepId);
      const rawStatus = String(event.payload.status ?? 'ok');
      const status =
        rawStatus === 'warning' ||
        rawStatus === 'error' ||
        rawStatus === 'skipped' ||
        rawStatus === 'ok'
          ? rawStatus
          : 'ok';
      this.completedSteps = [
        ...this.completedSteps,
        {
          id: stepId,
          cutLabel,
          stepId,
          title,
          status,
          summary: event.payload.summary
            ? sanitizeTerminalText(String(event.payload.summary))
            : undefined,
        },
      ];
      this.flushImmediate();
      return;
    }

    if (event.type === 'run-end') {
      this.flushImmediate();
    }
  }

  public async dispose(): Promise<void> {
    if (this.disposed) return;
    this.clearPendingTimer();
    this.disposed = true;
    try {
      this.resizeCleanup?.();
    } catch {
      // Ensure disposal never throws during error/SIGINT cleanup
    }
  }
}
