import { type Child, type Html } from './html.js';
export type SemanticStatus = 'neutral' | 'info' | 'success' | 'warning' | 'danger';
export type TagVariant = 'default' | 'stamp';
/** Same glyphs as React's `STATUS_GLYPHS`. */
export declare const STATUS_GLYPHS: Readonly<Record<SemanticStatus, string | undefined>>;
/** Same labels as React's `STATUS_SR_LABELS`. */
export declare const STATUS_SR_LABELS: Readonly<Record<SemanticStatus, string | undefined>>;
export interface TagOpts {
    variant?: TagVariant;
    status?: SemanticStatus;
    glyph?: string | false;
    srLabel?: string | false;
    children: Child;
}
/** Mirrors `<Tag>`. Stamps are `tag({ variant: 'stamp' })`, as `<Stamp>` is `<Tag variant="stamp">`. */
export declare function tag(o: TagOpts): Html;
export interface BadgeOpts {
    status?: SemanticStatus;
    glyph?: string | false;
    srLabel?: string | false;
    children: Child;
}
/** Mirrors `<Badge>` at rest (no `pop` motion; the burst SVG appears when `status` is unset). */
export declare function badge(o: BadgeOpts): Html;
export interface BalloonOpts {
    /** Tail offset in px from the balloon centre, within [-36, 36]. */
    tailOffset?: number;
    showDot?: boolean;
    children: Child;
}
/** Mirrors `<Balloon>`: a speech balloon with a mitered tail and optional marker dot. */
export declare function balloon(o: BalloonOpts): Html;
