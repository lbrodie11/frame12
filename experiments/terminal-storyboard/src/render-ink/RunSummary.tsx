import * as React from 'react';
import { Box, Text } from 'ink';
import type { ResultSnapshot } from '../model/index.js';
import { sanitizeTerminalText, wrapLineToWidth } from '../render-plain/index.js';

export interface RunSummaryProps {
  snapshot: ResultSnapshot;
  reportWritten?: boolean;
  isReplay?: boolean;
  width?: number;
  colorEnabled?: boolean;
  ascii?: boolean;
}

/**
 * Concise run status footer for the Ink storyboard, including replay/reconstructed
 * provenance and all run warnings regardless of finding count.
 */
export function RunSummary({
  snapshot,
  reportWritten = false,
  isReplay = false,
  width,
  colorEnabled = true,
  ascii = false,
}: RunSummaryProps): React.ReactElement {
  const sep = ascii ? ' | ' : ' · ';
  const baseStatusLabel =
    snapshot.status === 'completed'
      ? 'Completed'
      : snapshot.status === 'failed'
        ? 'Failed'
        : 'Canceled';
  const statusLabel = isReplay ? `[REPLAY] ${baseStatusLabel}` : baseStatusLabel;

  const count = snapshot.findings.length;
  const findingsLabel = `${count} ranked ${count === 1 ? 'finding' : 'findings'}`;
  const tailParts: string[] = [findingsLabel];

  if (snapshot.reconstructed) {
    const src = sanitizeTerminalText(snapshot.reconstructed.source);
    const ver = sanitizeTerminalText(snapshot.reconstructed.originalSchemaVersion);
    tailParts.push(`RECONSTRUCTED (${src} v${ver})`);
  }

  if (reportWritten) {
    tailParts.push('HTML report ready');
  }
  if (snapshot.error) {
    tailParts.push(sanitizeTerminalText(snapshot.error));
  }

  const statusColor =
    snapshot.status === 'completed'
      ? 'green'
      : snapshot.status === 'failed'
        ? 'red'
        : 'yellow';

  return (
    <Box flexDirection="column" width={width}>
      <Box flexDirection="row">
        <Text wrap="wrap">
          <Text color={colorEnabled ? statusColor : undefined} bold={Boolean(colorEnabled)}>
            {statusLabel}
          </Text>
          <Text dimColor={Boolean(colorEnabled)}>{`${sep}${tailParts.join(sep)}`}</Text>
        </Text>
      </Box>
      {snapshot.warnings.map((w, idx) => {
        const innerWidth = Math.max(24, (width ?? 80) - 2);
        const wrappedLines = wrapLineToWidth(
          `! Warning: ${sanitizeTerminalText(w)}`,
          innerWidth,
          '  ',
        );
        return (
          <Box key={idx} flexDirection="column" paddingLeft={2} width={width}>
            {wrappedLines.map((line, lineIdx) => (
              <Text key={lineIdx} dimColor={Boolean(colorEnabled)}>
                {line}
              </Text>
            ))}
          </Box>
        );
      })}
    </Box>
  );
}
