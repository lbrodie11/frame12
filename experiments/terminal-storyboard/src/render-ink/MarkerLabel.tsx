import * as React from 'react';
import { Text } from 'ink';
import { sanitizeTerminalText } from '../render-plain/index.js';

export interface MarkerLabelProps {
  label: string;
  colorEnabled?: boolean;
  ascii?: boolean;
}

/**
 * Restrained FRAME/12 marker callout badge for terminal panels.
 * Uses yellow background with black text when ANSI color is enabled,
 * and degrades cleanly to bracketed [LABEL] under NO_COLOR or --ascii.
 */
export function MarkerLabel({
  label,
  colorEnabled = true,
  ascii = false,
}: MarkerLabelProps): React.ReactElement {
  const safe = sanitizeTerminalText(label).trim().toUpperCase();
  if (!colorEnabled || ascii) {
    return <Text bold={Boolean(colorEnabled)}>{`[${safe}]`}</Text>;
  }
  return (
    <Text backgroundColor="yellow" color="black" bold>
      {` ${safe} `}
    </Text>
  );
}
