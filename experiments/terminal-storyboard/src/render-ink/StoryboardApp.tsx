import * as React from 'react';
import { Box, Static, Text } from 'ink';
import type { CochangeFinding, ResultSnapshot } from '../model/index.js';
import { getDisplayWidth, sanitizeTerminalText } from '../render-plain/index.js';
import { abbreviatePathMiddle, splitDirAndBase } from './FilePair.js';
import { FindingPanel } from './FindingPanel.js';
import { RunSummary } from './RunSummary.js';
import { StepLine, type StepLineProps } from './StepLine.js';

export interface StoryboardStepItem extends Omit<StepLineProps, 'columns' | 'colorEnabled' | 'ascii'> {
  id: string;
}

export interface StoryboardAppProps {
  snapshot?: ResultSnapshot | null;
  completedSteps: StoryboardStepItem[];
  activeStep?: StoryboardStepItem | null;
  columns?: number;
  colorEnabled?: boolean;
  ascii?: boolean;
  reportWritten?: boolean;
  isReplay?: boolean;
  useStatic?: boolean;
  includeHeaderAndSteps?: boolean;
}

interface StaticHeaderOrStep {
  key: string;
  kind: 'header' | 'notice' | 'step';
  text?: string;
  step?: StoryboardStepItem;
}

function SecondaryFindingRow({
  finding,
  width,
  columns,
  colorEnabled,
  ascii,
}: {
  finding: CochangeFinding;
  width: number;
  columns: number;
  colorEnabled: boolean;
  ascii: boolean;
}): React.ReactElement {
  const id = sanitizeTerminalText(finding.id);
  const sharedLabel = `${finding.cochangeCount} shared`;
  const arrow = ascii ? ' <-> ' : ' ⇆ ';

  if (columns < 52) {
    const pairBudget = Math.max(16, width - 4 - getDisplayWidth(arrow));
    const halfBudget = Math.max(8, Math.floor(pairBudget / 2));
    const abbrA = abbreviatePathMiddle(finding.files[0], halfBudget, ascii);
    const abbrB = abbreviatePathMiddle(finding.files[1], pairBudget - getDisplayWidth(abbrA), ascii);
    return (
      <Box flexDirection="column" width={width}>
        <Box flexDirection="row" justifyContent="space-between" width={width}>
          <Text dimColor={Boolean(colorEnabled)}>{`  ${id}`}</Text>
          <Text dimColor={Boolean(colorEnabled)}>{sharedLabel}</Text>
        </Box>
        <Text wrap="truncate-end">{`    ${abbrA}${arrow}${abbrB}`}</Text>
      </Box>
    );
  }

  const prefix = `  ${id}  `;
  const suffix = `  ${sharedLabel}`;
  const availForPair = Math.max(
    20,
    width - getDisplayWidth(prefix) - getDisplayWidth(suffix) - getDisplayWidth(arrow),
  );
  const rawLenA = getDisplayWidth(sanitizeTerminalText(finding.files[0]));
  const rawLenB = getDisplayWidth(sanitizeTerminalText(finding.files[1]));

  let budgetA = Math.floor(availForPair / 2);
  let budgetB = availForPair - budgetA;
  if (rawLenA < budgetA) {
    budgetA = rawLenA;
    budgetB = availForPair - budgetA;
  } else if (rawLenB < budgetB) {
    budgetB = rawLenB;
    budgetA = availForPair - budgetB;
  }

  const abbrA = abbreviatePathMiddle(finding.files[0], budgetA, ascii);
  const abbrB = abbreviatePathMiddle(finding.files[1], budgetB, ascii);
  const { dirPrefix: dirA, baseName: baseA } = splitDirAndBase(abbrA);
  const { dirPrefix: dirB, baseName: baseB } = splitDirAndBase(abbrB);

  return (
    <Box flexDirection="row" justifyContent="space-between" width={width}>
      <Text wrap="truncate-end">
        <Text dimColor={Boolean(colorEnabled)}>{prefix}</Text>
        {dirA ? <Text dimColor={Boolean(colorEnabled)}>{dirA}</Text> : null}
        <Text>{baseA}</Text>
        <Text dimColor={Boolean(colorEnabled)}>{arrow}</Text>
        {dirB ? <Text dimColor={Boolean(colorEnabled)}>{dirB}</Text> : null}
        <Text>{baseB}</Text>
      </Text>
      <Text dimColor={Boolean(colorEnabled)}>{sharedLabel}</Text>
    </Box>
  );
}

/**
 * Top-level FRAME/12 Ink storyboard layout.
 * Uses <Static> for completed step rows so completed steps are emitted once without redraw churn.
 */
export function StoryboardApp({
  snapshot = null,
  completedSteps,
  activeStep = null,
  columns = 80,
  colorEnabled = true,
  ascii = false,
  reportWritten = false,
  isReplay = false,
  useStatic = true,
  includeHeaderAndSteps = true,
}: StoryboardAppProps): React.ReactElement {
  const safeCols = Math.max(32, Math.floor(columns || 80));
  const layoutWidth = Math.max(32, Math.min(safeCols, 88));
  const ruleChar = ascii ? '-' : '─';
  const ruleLine = ruleChar.repeat(layoutWidth);
  const subRuleLine = `  ${ruleChar.repeat(Math.max(10, layoutWidth - 2))}`;
  const baseHeader =
    safeCols < 44 ? 'FRAME/12 / STORYBOARD' : 'FRAME/12  /  TERMINAL STORYBOARD';
  const headerTitle = isReplay ? `[REPLAY] ${baseHeader}` : baseHeader;

  const staticItems: StaticHeaderOrStep[] = includeHeaderAndSteps
    ? [
        { key: 'header', kind: 'header' },
        ...(snapshot?.reconstructed
          ? [
              {
                key: 'reconstructed',
                kind: 'notice' as const,
                text: '[RECONSTRUCTED · NOT LIVE EVENTS]',
              },
            ]
          : []),
        ...(completedSteps.length === 0 && !activeStep && snapshot
          ? [
              {
                key: 'snapshot-only',
                kind: 'notice' as const,
                text: '[SNAPSHOT ONLY · NO LIVE EVENT STREAM]',
              },
            ]
          : []),
        ...completedSteps.map((s) => ({
          key: `step-${s.id}`,
          kind: 'step' as const,
          step: s,
        })),
      ]
    : [];

  const renderStaticItem = (item: StaticHeaderOrStep) => {
    if (item.kind === 'header') {
      return (
        <Box key={item.key}>
          <Text bold={Boolean(colorEnabled)} wrap="wrap">
            {headerTitle}
          </Text>
        </Box>
      );
    }
    if (item.kind === 'notice') {
      return (
        <Box key={item.key}>
          <Text dimColor={Boolean(colorEnabled)} wrap="wrap">
            {item.text}
          </Text>
        </Box>
      );
    }
    const s = item.step!;
    return (
      <Box key={item.key}>
        <StepLine
          cutLabel={s.cutLabel}
          stepId={s.stepId}
          title={s.title}
          status={s.status}
          summary={s.summary}
          columns={safeCols}
          colorEnabled={colorEnabled}
          ascii={ascii}
        />
      </Box>
    );
  };

  const topFinding = snapshot?.findings[0] ?? null;
  const secondaryFindings = snapshot ? snapshot.findings.slice(1) : [];

  return (
    <Box flexDirection="column" width={layoutWidth}>
      {includeHeaderAndSteps &&
        (useStatic ? (
          <Static items={staticItems}>{renderStaticItem}</Static>
        ) : (
          <Box flexDirection="column">{staticItems.map(renderStaticItem)}</Box>
        ))}

      {includeHeaderAndSteps && activeStep && (
        <StepLine
          cutLabel={activeStep.cutLabel}
          stepId={activeStep.stepId}
          title={activeStep.title}
          status={activeStep.status}
          summary={activeStep.summary}
          columns={safeCols}
          colorEnabled={colorEnabled}
          ascii={ascii}
        />
      )}

      {snapshot && (
        <Box flexDirection="column">
          <Text dimColor={Boolean(colorEnabled)}>{ruleLine}</Text>

          {topFinding ? (
            <FindingPanel
              finding={topFinding}
              columns={safeCols}
              colorEnabled={colorEnabled}
              ascii={ascii}
            />
          ) : (
            <Box
              borderStyle={ascii ? 'classic' : 'single'}
              paddingX={1}
              width={layoutWidth}
              flexDirection="column"
            >
              <Text bold={Boolean(colorEnabled)}>
                {snapshot.status === 'failed'
                  ? 'RUN FAILED'
                  : snapshot.status === 'canceled'
                    ? 'RUN CANCELED'
                    : 'NO RANKED CO-CHANGE FINDINGS'}
              </Text>
              <Text dimColor={Boolean(colorEnabled)} wrap="wrap">
                {snapshot.error
                  ? sanitizeTerminalText(snapshot.error)
                  : `Examined ${snapshot.commitsExamined} commits (${snapshot.uniqueFilesObserved} active files) with 0 qualifying pairs.`}
              </Text>
            </Box>
          )}

          {secondaryFindings.length > 0 && (
            <Box flexDirection="column">
              {secondaryFindings.map((f, idx) => (
                <Box key={sanitizeTerminalText(f.id)} flexDirection="column">
                  {idx > 0 && <Text dimColor={Boolean(colorEnabled)}>{subRuleLine}</Text>}
                  <SecondaryFindingRow
                    finding={f}
                    width={layoutWidth}
                    columns={safeCols}
                    colorEnabled={colorEnabled}
                    ascii={ascii}
                  />
                </Box>
              ))}
            </Box>
          )}

          <Text dimColor={Boolean(colorEnabled)}>{ruleLine}</Text>
          <RunSummary
            snapshot={snapshot}
            reportWritten={reportWritten}
            isReplay={Boolean(isReplay)}
            width={layoutWidth}
            colorEnabled={colorEnabled}
            ascii={ascii}
          />
        </Box>
      )}
    </Box>
  );
}
