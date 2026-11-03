import * as React from 'react';
import { Box, Text } from 'ink';
import type { ResultSnapshot } from '../model/index.js';
import { sanitizeTerminalText } from '../render-plain/index.js';

export interface RunSummaryProps {
  snapshot: ResultSnapshot;
  reportWritten?: boolean;
  colorEnabled?: boolean;
  ascii?: boolean;
}

/**
 * Concise single-line run status footer for the Ink storyboard.
 */
export function RunSummary({
  snapshot,
  reportWritten = false,
  colorEnabled = true,
  ascii = false,
}: RunSummaryProps): React.ReactElement {
  const sep = ascii ? ' | ' : ' · ';
  const statusLabel =
    snapshot.status === 'completed'
      ? 'Completed'
      : snapshot.status === 'failed'
        ? 'Failed'
        : 'Canceled';

  const count = snapshot.findings.length;
  const findingsLabel = `${count} ranked ${count === 1 ? 'finding' : 'findings'}`;
  const tailParts: string[] = [findingsLabel];

  if (reportWritten) {
    tailParts.push('HTML report ready');
  }
  if (snapshot.error) {
    tailParts.push(sanitizeTerminalText(snapshot.error));
  } else if (snapshot.warnings.length > 0 && count === 0) {
    tailParts.push(sanitizeTerminalText(snapshot.warnings[0]));
  }

  const statusColor =
    snapshot.status === 'completed'
      ? 'green'
      : snapshot.status === 'failed'
        ? 'red'
        : 'yellow';

  return (
    <Box flexDirection="row">
      <Text wrap="wrap">
        <Text color={colorEnabled ? statusColor : undefined} bold={Boolean(colorEnabled)}>
          {statusLabel}
        </Text>
        <Text dimColor={Boolean(colorEnabled)}>{`${sep}${tailParts.join(sep)}`}</Text>
      </Text>
    </Box>
  );
}
