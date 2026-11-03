import * as React from 'react';
import { Box, Text } from 'ink';
import { getDisplayWidth, sanitizeTerminalText } from '../render-plain/index.js';

const graphemeSegmenter =
  typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter('en', { granularity: 'grapheme' })
    : null;

function sliceEndByDisplayWidth(text: string, maxCols: number): string {
  if (maxCols <= 0) return '';
  const segments = graphemeSegmenter
    ? Array.from(graphemeSegmenter.segment(text), (s) => s.segment)
    : Array.from(text);
  let width = 0;
  const kept: string[] = [];
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i];
    const w = getDisplayWidth(seg);
    if (width + w > maxCols) break;
    kept.unshift(seg);
    width += w;
  }
  return kept.join('');
}

/**
 * Abbreviates middle directory segments (e.g. "src/…/map.ts" or "src/.../map.ts")
 * only when the full path exceeds maxCols, preserving the filename basename.
 */
export function abbreviatePathMiddle(
  rawPath: string,
  maxCols: number,
  ascii = false,
): string {
  const safe = sanitizeTerminalText(rawPath);
  const budget = Math.max(8, Math.floor(maxCols));
  if (getDisplayWidth(safe) <= budget) {
    return safe;
  }

  const ellipsis = ascii ? '...' : '…';
  const parts = safe.split('/').filter(Boolean);
  if (parts.length <= 1) {
    if (getDisplayWidth(safe) <= budget) return safe;
    const tailBudget = Math.max(4, budget - getDisplayWidth(ellipsis));
    return `${ellipsis}${sliceEndByDisplayWidth(safe, tailBudget)}`;
  }

  const base = parts[parts.length - 1] ?? safe;
  const first = parts[0] ?? '';

  if (parts.length >= 4) {
    const twoTail = `${first}/${ellipsis}/${parts.slice(-2).join('/')}`;
    if (getDisplayWidth(twoTail) <= budget) {
      return twoTail;
    }
  }

  if (parts.length >= 3) {
    const candidate = `${first}/${ellipsis}/${base}`;
    if (getDisplayWidth(candidate) <= budget) {
      return candidate;
    }
  }

  const shortCandidate = `${ellipsis}/${base}`;
  if (getDisplayWidth(shortCandidate) <= budget) {
    return shortCandidate;
  }

  if (getDisplayWidth(base) <= budget) {
    return base;
  }

  const tailBudget = Math.max(4, budget - getDisplayWidth(ellipsis));
  return `${ellipsis}${sliceEndByDisplayWidth(base, tailBudget)}`;
}

export function splitDirAndBase(formattedPath: string): { dirPrefix: string; baseName: string } {
  const lastSlash = formattedPath.lastIndexOf('/');
  if (lastSlash === -1) {
    return { dirPrefix: '', baseName: formattedPath };
  }
  return {
    dirPrefix: formattedPath.slice(0, lastSlash + 1),
    baseName: formattedPath.slice(lastSlash + 1),
  };
}

export interface FilePairProps {
  fileA: string;
  fileB: string;
  maxWidth?: number;
  colorEnabled?: boolean;
  ascii?: boolean;
}

/**
 * Renders the coupled file pair across two lines:
 *   Line 1: primary file (dimmed directory prefix + bold basename)
 *   Line 2: ⇆ (or <-> in --ascii) + companion file
 */
export function FilePair({
  fileA,
  fileB,
  maxWidth = 68,
  colorEnabled = true,
  ascii = false,
}: FilePairProps): React.ReactElement {
  const arrow = ascii ? '<->' : '⇆';
  const line1Budget = Math.max(12, maxWidth);
  const line2Prefix = `  ${arrow} `;
  const line2Budget = Math.max(12, maxWidth - getDisplayWidth(line2Prefix));

  const abbrA = abbreviatePathMiddle(fileA, line1Budget, ascii);
  const abbrB = abbreviatePathMiddle(fileB, line2Budget, ascii);

  const { dirPrefix: dirA, baseName: baseA } = splitDirAndBase(abbrA);
  const { dirPrefix: dirB, baseName: baseB } = splitDirAndBase(abbrB);

  return (
    <Box flexDirection="column">
      <Text wrap="truncate-end">
        {dirA ? <Text dimColor={Boolean(colorEnabled)}>{dirA}</Text> : null}
        <Text bold={Boolean(colorEnabled)}>{baseA}</Text>
      </Text>
      <Text wrap="truncate-end">
        <Text dimColor={Boolean(colorEnabled)}>{line2Prefix}</Text>
        {dirB ? <Text dimColor={Boolean(colorEnabled)}>{dirB}</Text> : null}
        <Text bold={Boolean(colorEnabled)}>{baseB}</Text>
      </Text>
    </Box>
  );
}
