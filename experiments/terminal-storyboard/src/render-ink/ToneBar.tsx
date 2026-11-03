import * as React from 'react';
import { Text } from 'ink';

export interface ToneBarProps {
  /** Ratio in [0, 1] */
  ratio: number;
  /** Number of cells in the bar (default: 16) */
  width?: number;
  /** Terminal width in columns; omits bar below 48 columns to prevent narrow-terminal overflow */
  columns?: number;
  colorEnabled?: boolean;
  ascii?: boolean;
}

/**
 * Segmented terminal screentone bar inspired by FRAME/12 ToneBarList.
 * Uses '▄' / '░' in Unicode mode and '#' / '-' in --ascii mode.
 */
export function ToneBar({
  ratio,
  width = 16,
  columns = 80,
  colorEnabled = true,
  ascii = false,
}: ToneBarProps): React.ReactElement | null {
  if (columns < 48) {
    return null;
  }
  const safeWidth = Math.max(4, Math.min(24, Math.floor(width)));
  const clamped = Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : 0;
  const filledCount = Math.round(clamped * safeWidth);
  const emptyCount = Math.max(0, safeWidth - filledCount);

  const fillChar = ascii ? '#' : '▄';
  const emptyChar = ascii ? '-' : '░';
  const filledStr = fillChar.repeat(filledCount);
  const emptyStr = emptyChar.repeat(emptyCount);

  if (!colorEnabled) {
    return <Text>{`${filledStr}${emptyStr}`}</Text>;
  }

  return (
    <Text>
      <Text bold>{filledStr}</Text>
      <Text dimColor>{emptyStr}</Text>
    </Text>
  );
}
