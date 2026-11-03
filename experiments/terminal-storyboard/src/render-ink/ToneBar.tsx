import * as React from 'react';
import { Text } from 'ink';

export interface ToneBarProps {
  /** Ratio in [0, 1] */
  ratio: number;
  /** Number of 4-cell segments in the bar (default: 12) */
  segments?: number;
  /** Backwards-compatible alias for segments */
  width?: number;
  /** Terminal width in columns; omits bar below 48 columns to prevent narrow-terminal overflow */
  columns?: number;
  colorEnabled?: boolean;
  ascii?: boolean;
}

/**
 * Segmented terminal screentone bar inspired by FRAME/12 ToneBarList.
 * Renders discrete 4-cell segments separated by spaces (e.g. "▄▄▄▄ ▄▄▄▄ ░░░░")
 * in Unicode mode and "#### #### ----" in --ascii mode.
 */
export function ToneBar({
  ratio,
  segments,
  width,
  columns = 80,
  colorEnabled = true,
  ascii = false,
}: ToneBarProps): React.ReactElement | null {
  if (columns < 48) {
    return null;
  }
  const rawSegments = segments ?? (width ? Math.max(4, Math.min(14, Math.round(width))) : 12);
  const maxSegmentsForWidth = Math.max(4, Math.floor((columns - 8 + 1) / 5));
  const safeSegments = Math.max(4, Math.min(14, rawSegments, maxSegmentsForWidth));

  const clamped = Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : 0;
  const filledSegments = Math.round(clamped * safeSegments);
  const emptySegments = Math.max(0, safeSegments - filledSegments);

  const fillUnit = ascii ? '####' : '▄▄▄▄';
  const emptyUnit = ascii ? '----' : '░░░░';

  const filledPart = Array.from({ length: filledSegments }, () => fillUnit).join(' ');
  const emptyPart = Array.from({ length: emptySegments }, () => emptyUnit).join(' ');

  if (!colorEnabled) {
    const joined = [filledPart, emptyPart].filter(Boolean).join(' ');
    return <Text>{joined}</Text>;
  }

  return (
    <Text>
      {filledPart ? <Text bold>{filledPart}</Text> : null}
      {filledPart && emptyPart ? <Text> </Text> : null}
      {emptyPart ? <Text dimColor>{emptyPart}</Text> : null}
    </Text>
  );
}
