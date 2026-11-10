/**
 * @frame12/static: framework-free HTML renderers with the FRAME/12 React components' contract.
 * Pure, deterministic functions that return escaped `Html` strings. See PARITY.md.
 */
export { escapeHtml, fragment, isHtml, unsafeRaw } from './html.js';
export { safeUrl } from './url.js';
export { GUTTERS, panel, panelPair, scene, sceneArea, sheet, } from './layout.js';
export { STATUS_GLYPHS, STATUS_SR_LABELS, badge, balloon, tag, } from './text.js';
export { RECEIPT_ORIGIN_META, fmtMoney, fmtPPAbs, fmtPct, ghostWire, metric, receipt, receiptList, toneBarList, } from './data.js';
export { document } from './document.js';
export { staticCss } from './static-css.js';
