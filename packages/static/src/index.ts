/**
 * @frame12/static: framework-free HTML renderers with the FRAME/12 React components' contract.
 * Pure, deterministic functions that return escaped `Html` strings. See PARITY.md.
 */
export { escapeHtml, fragment, isHtml, unsafeRaw, type Child, type Html } from './html.js';
export { toIdent } from './ident.js';
export { safeUrl } from './url.js';
export {
  GUTTERS,
  panel,
  panelPair,
  scene,
  sceneArea,
  sheet,
  type PanelOpts,
  type PanelPairOpts,
  type PanelShape,
  type PanelVariant,
  type SceneAreaOpts,
  type SceneGutter,
  type SceneLayout,
  type SceneOpts,
  type SheetOpts,
} from './layout.js';
export {
  STATUS_GLYPHS,
  STATUS_SR_LABELS,
  badge,
  balloon,
  tag,
  type BadgeOpts,
  type BalloonOpts,
  type SemanticStatus,
  type TagOpts,
  type TagVariant,
} from './text.js';
export {
  RECEIPT_ORIGIN_META,
  fmtMoney,
  fmtPPAbs,
  fmtPct,
  ghostWire,
  metric,
  receipt,
  receiptList,
  toneBarList,
  type GhostWireOpts,
  type GhostWireOrientation,
  type MetricHeadingLevel,
  type MetricOpts,
  type MetricVariant,
  type ReceiptKind,
  type ReceiptListOpts,
  type ReceiptOpts,
  type ReceiptOrigin,
  type ToneBarDensity,
  type ToneBarItem,
  type ToneBarListOpts,
  type ToneBarPattern,
} from './data.js';
export { dedupeIds, document, type DocumentOpts } from './document.js';
export { staticCss } from './static-css.js';
