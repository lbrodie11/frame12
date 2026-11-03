import { posix } from 'node:path';
import * as React from 'react';
import { Box, Text } from 'ink';
import type { CochangeFinding } from '../model/index.js';
import { sanitizeTerminalText } from '../render-plain/index.js';
import { FilePair } from './FilePair.js';
import { MarkerLabel } from './MarkerLabel.js';
import { ToneBar } from './ToneBar.js';

export interface FindingPanelProps {
  finding: CochangeFinding;
  columns?: number;
  colorEnabled?: boolean;
  ascii?: boolean;
}

/**
 * Framed hero panel for the top co-change finding (F-01 / TOP FINDING).
 * Uses borderStyle="single" in Unicode mode and borderStyle="classic" (+---+) in --ascii mode.
 */
export function FindingPanel({
  finding,
  columns = 80,
  colorEnabled = true,
  ascii = false,
}: FindingPanelProps): React.ReactElement {
  const panelWidth = Math.max(32, Math.min(columns, 88));
  const innerWidth = Math.max(24, panelWidth - 4);
  const sep = ascii ? ' | ' : ' · ';

  const id = sanitizeTerminalText(finding.id);
  const baseA = posix.basename(sanitizeTerminalText(finding.files[0]));
  const baseB = posix.basename(sanitizeTerminalText(finding.files[1]));
  const unionCommits = Math.max(
    1,
    finding.fileACommits + finding.fileBCommits - finding.cochangeCount,
  );
  const jaccardRatio =
    typeof finding.jaccardRatio === 'number' && Number.isFinite(finding.jaccardRatio)
      ? Math.max(0, Math.min(1, finding.jaccardRatio))
      : Math.max(0, Math.min(1, finding.cochangeCount / unionCommits));
  const jaccardPct = Math.round(jaccardRatio * 100);
  const commitsNoun = unionCommits === 1 ? 'commit' : 'commits';

  const metricsLead =
    columns < 52
      ? `${finding.cochangeCount}/${unionCommits} combined ${commitsNoun}${sep}${jaccardPct}% Jaccard`
      : `${finding.cochangeCount} of ${unionCommits} combined ${commitsNoun} (${jaccardPct}% Jaccard)`;

  const directionalLine = `${baseA}: ${finding.cochangeCount}/${finding.fileACommits}${sep}${baseB}: ${finding.cochangeCount}/${finding.fileBCommits}`;
  const barSegments = Math.max(4, Math.min(12, Math.floor((innerWidth + 1) / 5)));

  return (
    <Box
      flexDirection="column"
      borderStyle={ascii ? 'classic' : 'single'}
      paddingX={1}
      width={panelWidth}
    >
      <Box flexDirection="row" justifyContent="space-between" width={innerWidth}>
        <Text bold={Boolean(colorEnabled)}>
          {columns < 46 ? `${id} / TOP` : `${id} / TOP FINDING`}
        </Text>
        <MarkerLabel label="REVIEW" colorEnabled={colorEnabled} ascii={ascii} />
      </Box>

      <Box marginTop={1}>
        <FilePair
          fileA={finding.files[0]}
          fileB={finding.files[1]}
          maxWidth={innerWidth}
          colorEnabled={colorEnabled}
          ascii={ascii}
        />
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text wrap="wrap">{metricsLead}</Text>
        {columns >= 48 && (
          <Box>
            <ToneBar
              ratio={jaccardRatio}
              segments={barSegments}
              columns={columns}
              colorEnabled={colorEnabled}
              ascii={ascii}
            />
          </Box>
        )}
        <Text dimColor={Boolean(colorEnabled)} wrap="wrap">
          {directionalLine}
        </Text>
        <Text dimColor={Boolean(colorEnabled)} wrap="wrap">
          {`Historical co-change${sep}not proof of dependency`}
        </Text>
      </Box>
    </Box>
  );
}
