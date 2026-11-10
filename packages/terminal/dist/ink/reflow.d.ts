/** Erases `count` rows upward from the cursor, ending at the top one (like ansi-escapes eraseLines). */
export declare function eraseLines(count: number): string;
/** Rows a line of text occupies at `columns` once the terminal wraps it (at least 1). */
export declare function wrappedRows(line: string, columns: number): number;
/**
 * The cleanup to write before Ink clears its frame after the width shrank: erase every row the
 * re-wrapped frame covers, then move the cursor down so Ink's erase of its `lines.length` rows ends
 * exactly at the top of the old frame. Empty when nothing re-wrapped.
 */
export declare function reflowCleanup(frameLines: readonly string[], columns: number): string;
/** The frame text in one of Ink's writes: what follows its erase sequence, without cursor controls. */
export declare function frameFromWrite(chunk: string): string | undefined;
type Out = NodeJS.WriteStream;
/**
 * A stdout for Ink that remembers the last frame it wrote. It inherits everything else (columns,
 * rows, isTTY, events) from the real stream.
 */
export declare function createFrameTracker(stdout: Out): {
    stream: Out;
    lastFrameLines(): string[];
};
export {};
