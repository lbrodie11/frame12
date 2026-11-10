import { type Child, type Html } from './html.js';
/** Same as React's `fmtPct`: absolute ratio as a one-decimal percentage. */
export declare const fmtPct: (v: number) => string;
/** Same as React's `fmtPPAbs`: absolute percentage points with two decimals. */
export declare const fmtPPAbs: (v: number) => string;
/** Same as React's `fmtMoney`: whole dollars, `en-US` grouping. */
export declare const fmtMoney: (v: number) => string;
export type MetricHeadingLevel = 'h2' | 'h3' | 'h4' | 'div' | 'p';
export type MetricVariant = 'expressive' | 'quiet';
export interface MetricOpts {
    label: string;
    value: number;
    format?: (value: number) => string;
    delta?: number;
    deltaKind?: 'pct' | 'pp';
    comparisonLabel?: string;
    range?: number | string;
    note?: string;
    big?: boolean;
    variant?: MetricVariant;
    headingLevel?: MetricHeadingLevel;
    spark?: Html;
}
/** Mirrors `<Metric>` at rest: the settled value, delta, note and optional spark. */
export declare function metric(o: MetricOpts): Html;
export type ToneBarPattern = 'dots' | 'hatch' | 'dense';
export type ToneBarDensity = 'comfortable' | 'compact';
export interface ToneBarItem {
    id: string;
    name: string;
    value: number;
    formattedValue?: string;
    share?: number;
    badge?: string;
    pattern?: ToneBarPattern;
}
export interface ToneBarListOpts {
    title?: string;
    subtitle?: string;
    items: ToneBarItem[];
    selectedId?: string | null;
    density?: ToneBarDensity;
    idPrefix?: string;
}
/**
 * Mirrors `<ToneBarList>` without interaction: rows are `<div data-static>` (not inert buttons)
 * and the selected row carries `aria-current="true"`.
 */
export declare function toneBarList(o: ToneBarListOpts): Html;
export type GhostWireOrientation = 'auto' | 'horizontal' | 'vertical';
export interface GhostWireOpts {
    from: Child;
    to: Child;
    label?: string;
    strength?: number;
    orientation?: GhostWireOrientation;
}
/** Mirrors `<GhostWire>` at rest: the co-change wire fully revealed, `auto` drawn horizontal. */
export declare function ghostWire(o: GhostWireOpts): Html;
export type ReceiptKind = 'commit' | 'file' | 'link';
export type ReceiptOrigin = 'human' | 'agent' | 'bot';
/** Same as React's `RECEIPT_ORIGIN_META`. */
export declare const RECEIPT_ORIGIN_META: Readonly<Record<ReceiptOrigin, {
    readonly glyph: string;
    readonly srLabel: string;
}>>;
export interface ReceiptOpts {
    kind: ReceiptKind;
    value: string;
    href?: string;
    title?: string;
    date?: string;
    origin?: ReceiptOrigin;
}
/** Mirrors `<Receipt>`: an evidence chip (commit, file or link). Unsafe hrefs render as text. */
export declare function receipt(o: ReceiptOpts): Html;
export interface ReceiptListOpts {
    items: ReceiptOpts[];
    /** Accessible name of the list. Defaults to "Evidence receipts", as in React. */
    ariaLabel?: string;
}
/** Mirrors `<ReceiptList>` with one `<Receipt>` per item. */
export declare function receiptList(o: ReceiptListOpts): Html;
