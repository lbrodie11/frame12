import * as React from 'react';
import { Box, Text } from 'ink';
import { sanitizeTerminalText } from '../render-plain/index.js';

export type StepDisplayStatus =
  | 'running'
  | 'ok'
  | 'warning'
  | 'warn'
  | 'error'
  | 'failed'
  | 'skipped'
  | 'canceled';

export interface StepLineProps {
  cutLabel: string;
  stepId?: string;
  title: string;
  status: StepDisplayStatus;
  summary?: string;
  columns?: number;
  colorEnabled?: boolean;
  ascii?: boolean;
}

function formatEditorialStepText(
  stepId: string | undefined,
  title: string,
  status: StepLineProps['status'],
  summary?: string,
  ascii = false,
): string {
  const sep = ascii ? ' | ' : ' · ';
  const rawSummary = summary ? sanitizeTerminalText(summary) : '';

  if (status === 'running') {
    const baseTitle = sanitizeTerminalText(title);
    return rawSummary ? `${baseTitle}${sep}${rawSummary}` : `${baseTitle}...`;
  }

  if (stepId === 'validate-repo' && status === 'ok') {
    return 'Repository validated';
  }

  if (stepId === 'pair-cochanges' && status === 'ok' && rawSummary) {
    const match = rawSummary.match(/^(\d+)\s+co-change pairs observed$/i);
    if (match) {
      return `${match[1]} relationships observed`;
    }
  }

  if (rawSummary) {
    return ascii ? rawSummary.replace(/\s*·\s*/g, ' | ') : rawSummary;
  }

  return sanitizeTerminalText(title);
}

/**
 * Compact editorial step row for the Ink storyboard header.
 */
export function StepLine({
  cutLabel,
  stepId,
  title,
  status,
  summary,
  colorEnabled = true,
  ascii = false,
}: StepLineProps): React.ReactElement {
  const safeCut = sanitizeTerminalText(cutLabel);
  const text = formatEditorialStepText(stepId, title, status, summary, ascii);

  let icon: string;
  let iconColor: 'green' | 'yellow' | 'red' | undefined;

  if (status === 'ok') {
    icon = ascii ? '[OK]' : '✓';
    iconColor = 'green';
  } else if (status === 'warning' || status === 'warn') {
    icon = ascii ? '[!!]' : '!';
    iconColor = 'yellow';
  } else if (status === 'error' || status === 'failed') {
    icon = ascii ? '[XX]' : '✗';
    iconColor = 'red';
  } else if (status === 'skipped' || status === 'canceled') {
    icon = ascii ? '[--]' : '○';
    iconColor = 'yellow';
  } else {
    icon = ascii ? '[..]' : '▸';
    iconColor = 'yellow';
  }

  return (
    <Box flexDirection="row">
      <Text dimColor={Boolean(colorEnabled)}>{`${safeCut} `}</Text>
      <Text
        color={colorEnabled ? iconColor : undefined}
        bold={Boolean(colorEnabled)}
      >{`${icon} `}</Text>
      <Text wrap="wrap">{text}</Text>
    </Box>
  );
}
