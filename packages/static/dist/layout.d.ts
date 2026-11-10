import { type Child, type Html } from './html.js';
export type SceneGutter = 'pair' | 'scene' | 'change';
export type SceneLayout = 'split' | 'stack' | 'equal' | 'three' | 'areas';
export type PanelShape = 'rect' | 'slant-bottom' | 'slant-top';
export type PanelVariant = 'expressive' | 'quiet';
/** Gutter widths in px, identical to React's `GUTTERS`. */
export declare const GUTTERS: Readonly<Record<SceneGutter, number>>;
export interface SheetOpts {
    pegs?: boolean;
    autoCut?: boolean;
    theme?: 'light' | 'dark';
    children: Child;
}
/** Mirrors `<Sheet>`: the desk frame, the sheet, optional peg holes, and auto-cut numbering. */
export declare function sheet(o: SheetOpts): Html;
export interface SceneOpts {
    gutter?: SceneGutter;
    layout?: SceneLayout;
    areas?: string[];
    columns?: number;
    breakpoint?: number | string;
    children: Child;
}
/** Mirrors `<Scene>`: a grid scene with gutter grammar (12/20/32px) and optional named areas. */
export declare function scene(o: SceneOpts): Html;
export interface SceneAreaOpts {
    area: string;
    children: Child;
}
/** Mirrors `<SceneArea>`: places its children in a named `Scene` area. */
export declare function sceneArea(o: SceneAreaOpts): Html;
export interface PanelOpts {
    cut?: string | false;
    shape?: PanelShape;
    variant?: PanelVariant;
    label?: string;
    area?: string;
    /** Static-only: exact box width in px, for the measured (pixel) polygon. Requires `height`. */
    width?: number;
    /** Static-only: exact box height in px, for the measured (pixel) polygon. Requires `width`. */
    height?: number;
    children?: Child;
}
/** The SSR polygon points React's `Panel` draws in a 0 0 100 100 viewBox. */
export declare function ssrPoints(shape: PanelShape): string;
/** The pixel polygon points React's `Panel` draws once it has measured `w`×`h`. */
export declare function exactPoints(shape: PanelShape, w: number, h: number): string;
/** Mirrors `<Panel>`: an ink-framed panel with a cut label. */
export declare function panel(o: PanelOpts): Html;
export interface PanelPairOpts {
    variant?: PanelVariant;
    area?: string;
    top?: Omit<PanelOpts, 'shape'>;
    bottom?: Omit<PanelOpts, 'shape'>;
    topCut?: string | false;
    bottomCut?: string | false;
    topLabel?: string;
    bottomLabel?: string;
    /** Inserted verbatim when `top`/`bottom` aren't both given (see PARITY.md). */
    children?: Child;
}
/** Mirrors `<PanelPair>`: two panels on a 12px pair gutter with complementary slants. */
export declare function panelPair(o: PanelPairOpts): Html;
