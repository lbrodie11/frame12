/**
 * Static class manifest: every class and attribute each renderer can emit.
 *
 * `scripts/build-static-css.mjs` keeps a rule from `registry/styles/frame12.css` only when every
 * class and attribute its selector references is listed here, and fails the build when a
 * manifest class matches no kept rule (unless it is listed in `CLASS_EXCEPTIONS` with a
 * reason) or when the output references a class that isn't listed (dead weight).
 * `tests/manifest.test.mjs` checks this file against the renderers' real output.
 */
export const MANIFEST_CLASSES = Object.freeze({
    sheet: ['f12-dash', 'f12-frame', 'f12-m-cut', 'f12-theme-light', 'f12-theme-dark', 'f12-sheet', 'f12-pegs', 'f12-peg', 'slot', 'round'],
    scene: [
        'f12-scene',
        'f12-scene-split',
        'f12-scene-stack',
        'f12-scene-equal',
        'f12-scene-three',
        'f12-scene-areas',
        'f12-scene-pair',
        'f12-scene-scene',
        'f12-scene-change',
        'f12-scene-area',
    ],
    panel: ['f12-panel', 'f12-rect', 'f12-slant-bottom', 'f12-slant-top', 'f12-panel-quiet', 'f12-panel-frame', 'f12-cut', 'f12-panel-body'],
    panelPair: ['f12-pair'],
    balloon: ['f12-balloon-standalone', 'f12-balloon', 'f12-balloon-gap', 'f12-balloon-standalone-svg', 'f12-tail', 'f12-peak-dot'],
    tag: [
        'f12-tag',
        'f12-tag-stamp',
        'f12-status-neutral',
        'f12-status-info',
        'f12-status-success',
        'f12-status-warning',
        'f12-status-danger',
        'f12-status-glyph',
        'f12-sr-only',
    ],
    badge: ['f12-badge', 'f12-burst', 'f12-badge-t'],
    metric: [
        'f12-metric',
        'big',
        'f12-metric-quiet',
        'f12-m-label',
        'f12-m-value',
        'f12-m-note',
        'f12-delta',
        'up',
        'down',
        'flat',
        'f12-delta-sym',
        'f12-delta-ref',
    ],
    toneBarList: [
        'f12-ints',
        'f12-ints-compact',
        'f12-ints-hd',
        'f12-ints-sub',
        'f12-ints-list',
        'f12-int-row',
        'f12-int-name',
        'f12-int-bar',
        'f12-int-fill',
        'f12-int-fill-hatch',
        'f12-int-fill-dense',
        'f12-int-val',
        'f12-int-share',
    ],
    ghostWire: [
        'f12-ghost-wire',
        'f12-ghost-wire-auto',
        'f12-ghost-wire-horizontal',
        'f12-ghost-wire-vertical',
        'f12-ghost-wire-endpoint',
        'f12-ghost-wire-from',
        'f12-ghost-wire-to',
        'f12-ghost-wire-connector',
        'f12-ghost-wire-svg',
        'f12-ghost-wire-reveal',
        'f12-ghost-wire-line',
        'f12-ghost-wire-label',
    ],
    receipt: [
        'f12-receipt',
        'f12-receipt-commit',
        'f12-receipt-file',
        'f12-receipt-link',
        'f12-receipt-origin',
        'f12-receipt-origin-human',
        'f12-receipt-origin-agent',
        'f12-receipt-origin-bot',
        'f12-receipt-value',
        'f12-receipt-code',
        'f12-receipt-sha-sr',
        'f12-receipt-title',
        'f12-receipt-date',
        'f12-receipt-list',
        'f12-receipt-item',
    ],
});
/** Attributes the renderers emit that stylesheet selectors may test. */
export const MANIFEST_ATTRIBUTES = Object.freeze([
    'class',
    'id',
    'style',
    'role',
    'lang',
    'href',
    'title',
    'data-theme',
    'data-f12-variant',
    'data-autocut',
    'data-gutter',
    'data-layout',
    'data-columns',
    'data-breakpoint',
    'data-scene-bp',
    'data-area',
    'data-variant',
    'data-status',
    'data-density',
    'data-static',
    'data-pattern',
    'data-fill',
    'data-orientation',
    'data-strength',
    'data-endpoint',
    'data-kind',
    'data-origin',
    'aria-hidden',
    'aria-label',
    'aria-live',
    'aria-current',
    'focusable',
]);
/** Custom properties the renderers set inline (so the stylesheet need not define them). */
export const INLINE_CUSTOM_PROPERTIES = Object.freeze([
    '--f12-autocut-display',
    '--f12-scene-cols',
    '--f12-scene-areas',
    '--f12-area',
    '--f12-m-chars',
]);
/**
 * Manifest classes allowed to match no rule in the generated CSS, each with the reason.
 * Every entry is re-checked by the build: an exception that no longer needs to be one fails it.
 */
export const CLASS_EXCEPTIONS = Object.freeze({
    'f12-theme-light': 'Theme blocks for .f12-theme-light live in @frame12/tokens (tokens.css / cssText), not in static.css.',
    'f12-theme-dark': 'Theme blocks for .f12-theme-dark live in @frame12/tokens (tokens.css / cssText), not in static.css.',
    flat: 'Delta direction marker kept for React parity; a flat delta uses the base .f12-delta styling.',
    'f12-receipt-sha-sr': 'Hook for tests and consumers; styled through f12-sr-only on the same element.',
    'f12-ghost-wire-auto': 'Orientation marker kept for React parity; static resolves auto to data-orientation="horizontal", which carries the styling.',
    'f12-ghost-wire-horizontal': 'Horizontal is the default layout; only the vertical modifier has rules.',
    'f12-receipt-commit': 'Kind marker kept for React parity; commit styling is on f12-receipt-code.',
    'f12-receipt-file': 'Kind marker kept for React parity; no kind-specific rule.',
    'f12-receipt-origin-human': 'Origin marker kept for React parity; the glyph carries the meaning.',
    'f12-receipt-origin-agent': 'Origin marker kept for React parity; the glyph carries the meaning.',
    'f12-receipt-origin-bot': 'Origin marker kept for React parity; the glyph carries the meaning.',
});
/** All manifest classes, deduplicated and sorted. */
export function manifestClasses() {
    return [...new Set(Object.values(MANIFEST_CLASSES).flat())].sort();
}
