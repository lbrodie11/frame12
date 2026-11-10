/**
 * The live view's Ink components. They draw the PR 2 grammar's own text (cut lines, evidence
 * cards, receipt lists), so the live and linear views say the same things; the live view only adds
 * focus, the Inspector, key hints and completed cuts in Ink's <Static> (emitted once, no redraw).
 */
import * as React from 'react';
import type { CutState, Director, RunState } from '../core/director.js';
import type { Finding } from '../core/contract.js';
import { CUT_STATUS_WORDS, type NextStep, type RenderCaps } from '../render/grammar.js';
/** Re-renders when the Director publishes; reads its current state. */
export declare function useRunState(director: Director): Readonly<RunState>;
export interface StoryboardProps {
    director: Director;
    rc: RenderCaps;
    /** Terminal rows, for fitting the findings list. */
    rows: number;
    product?: string;
    nextSteps?: NextStep[];
    /** `q`: finish (the host decides whether a running job is canceled first). */
    onQuit: () => void;
    /** Ctrl-C in raw mode (it arrives as a key, not SIGINT). */
    onInterrupt: () => void;
    /** Opens a vetted https URL after the person confirmed it. */
    onOpen?: (url: string) => void;
}
/** One cut that is still running: its label, title, a pose-driven indicator and its progress. */
export declare function Cut({ cutState, rc, pose }: {
    cutState: CutState;
    rc: RenderCaps;
    pose: number;
}): React.JSX.Element;
export declare function HintBar({ rc, inspecting, helpOpen }: {
    rc: RenderCaps;
    inspecting: boolean;
    helpOpen: boolean;
}): React.JSX.Element;
/** The focused finding, expanded in place with every receipt. */
export declare function Inspector({ finding, frame, firstReceipt, rc, marker }: {
    finding: Finding;
    frame: string;
    firstReceipt: number;
    rc: RenderCaps;
    marker: boolean;
}): React.JSX.Element;
/** The live view's root. */
export declare function Storyboard({ director, rc, rows, product, nextSteps, onQuit, onInterrupt, onOpen }: StoryboardProps): React.JSX.Element;
export { CUT_STATUS_WORDS };
