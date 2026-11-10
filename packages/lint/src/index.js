#!/usr/bin/env node
// @frame12/lint — Automated design-grammar checker for FRAME/12.
// Enforces:
//   1. color-literal           — No hard-coded hex/rgb/hsl colors, CSS gradients, or font stacks outside token files
//   2. illegal-gutter          — Only 12px (pair), 20px (scene), and 32px (change) gutters
//   3. marker-misuse           — --f-marker / #ffd60a only as background paired with --f-marker-ink
//   4. cut-order               — Sequential C-01, C-02, C-03... in DOM/reading order without gaps or duplicates
//   5. explicit-cut-in-autocut — No explicit cut/topCut/bottomCut on Panel/PanelPair inside <Sheet autoCut>
//   6. raw-shadcn-import       — No raw @/components/ui/*, @radix-ui/*, or external chart/animation imports
//   7. unsafe-html             — No external scripts/resources, iframes/embeds, inline on*= handlers, or javascript: URLs in HTML

import { readdirSync, readFileSync, realpathSync, statSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, relative, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RULES = Object.freeze({
  'color-literal':
    'Forbid hard-coded color literals (#hex, rgb/hsl/oklch, CSS gradients, font names) outside token definitions; use var(--f-*) tokens.',
  'illegal-gutter':
    'Permit only 0, 12px (--f-gutter-pair), 20px (--f-gutter-scene), or 32px (--f-gutter-change) gutters on gap, grid-gap, row-gap, and column-gap.',
  'marker-misuse':
    'Permit --f-marker (#ffd60a) only as a surface background paired with color: var(--f-marker-ink) in the same rule; never on text, borders, outlines, shadows, or SVG strokes/fills.',
  'cut-order':
    'Require panel cut labels (C-01, C-02, …) to use two-digit formatting and appear in strict sequential reading order starting at C-01 without gaps or duplicates.',
  'explicit-cut-in-autocut':
    'Forbid explicit cut props on Panel/PanelPair inside <Sheet autoCut> where cuts are numbered automatically.',
  'raw-shadcn-import':
    'Forbid raw @/components/ui/*, @radix-ui/*, or third-party chart/motion imports where a FRAME/12 component or adapter exists.',
  'unsafe-html':
    'Forbid external resource loads (<script src>, <link href>, <img src>, CSS @import/url()), embedded frames (<iframe>, <object>, <embed>, srcdoc), <meta http-equiv="refresh">, <base href>, inline on*= handlers, and javascript: URLs in generated HTML.',
});

const CODE_EXTENSIONS = new Set(['.tsx', '.ts', '.jsx', '.js', '.css', '.html', '.htm']);
const TOKEN_BASENAMES = new Set([
  'frame12.css',
  'frame12-tokens.css',
  'frame12-tailwind.css',
  'og-image.tsx',
  'apple-icon.tsx',
]);
const TOKEN_EXEMPT_PATHS = ['packages/tokens/dist/tokens.css'];
const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  '.next',
  '.f12-run',
  'test-results',
]);

const LEGAL_GUTTER_NAMES = new Set(['pair', 'scene', 'change']);
const LEGAL_GUTTER_TOKENS = new Set([
  '0',
  '0px',
  '12',
  '12px',
  '20',
  '20px',
  '32',
  '32px',
  'var(--f-gutter-pair)',
  'var(--f-gutter-scene)',
  'var(--f-gutter-change)',
]);

const LEGAL_TAILWIND_GAP_CLASSES = new Set([
  'gap-0',
  'gap-x-0',
  'gap-y-0',
  'gap-gutter-pair',
  'gap-gutter-scene',
  'gap-gutter-change',
  'gap-[12px]',
  'gap-[20px]',
  'gap-[32px]',
  'gap-[var(--f-gutter-pair)]',
  'gap-[var(--f-gutter-scene)]',
  'gap-[var(--f-gutter-change)]',
]);

export const FORBIDDEN_SHADCN_MODULES = new Set([
  'button',
  'input',
  'textarea',
  'checkbox',
  'radio-group',
  'switch',
  'field',
  'label',
  'badge',
  'tag',
  'alert',
  'toast',
  'toaster',
  'sonner',
  'skeleton',
  'empty-state',
  'breadcrumb',
  'pagination',
  'card',
  'tabs',
  'dialog',
  'select',
  'tooltip',
  'dropdown-menu',
  'table',
  'sheet',
  'panel',
]);

export const FORBIDDEN_EXTERNAL_PACKAGES = new Set([
  'recharts',
  'chart.js',
  'react-chartjs-2',
  'd3',
  'framer-motion',
  'gsap',
]);

const CUT_PROP_NAMES = new Set(['cut', 'topCut', 'bottomCut']);
const CUT_OWNER_TAGS = new Set(['Panel', 'PanelPair', 'DialogContent']);

const HTML_VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

const FORBIDDEN_EMBED_TAGS = new Set(['iframe', 'object', 'embed']);
const EXTERNAL_SUBRESOURCE_TAGS = new Set(['link', 'img', 'source', 'video', 'audio', 'track', 'image']);
const EXTERNAL_SUBRESOURCE_ATTRS = new Set(['src', 'srcset', 'href', 'xlink:href', 'poster']);

let cachedTs = undefined;
let warnedTypeScriptFallback = false;

try {
  const tsMod = await import('typescript');
  cachedTs = tsMod.default ?? tsMod;
} catch {
  cachedTs = undefined;
}

function loadTypeScript() {
  if (cachedTs !== undefined) return cachedTs;
  const searchAnchors = [import.meta.url, resolve(process.cwd(), 'package.json')];
  for (const anchor of searchAnchors) {
    try {
      const req = createRequire(anchor);
      cachedTs = req('typescript');
      return cachedTs;
    } catch {
      // try next anchor
    }
  }
  cachedTs = null;
  return null;
}

/**
 * Replaces JS/CSS comments with spaces while preserving newlines and string literals
 * so URLs like "https://example.com" inside strings are never treated as // comments.
 */
function stripCommentsPreservingLines(src) {
  let out = '';
  let i = 0;
  const len = src.length;
  let state = 'code'; // 'code' | 'single' | 'double' | 'template' | 'line-comment' | 'block-comment'

  while (i < len) {
    const ch = src[i];
    const next = i + 1 < len ? src[i + 1] : '';

    if (state === 'code') {
      if (ch === '/' && next === '/') {
        state = 'line-comment';
        out += '  ';
        i += 2;
        continue;
      }
      if (ch === '/' && next === '*') {
        state = 'block-comment';
        out += '  ';
        i += 2;
        continue;
      }
      const prev = i > 0 ? src[i - 1] : '';
      const precededByWord = /[a-zA-Z0-9_$]/.test(prev);
      if (ch === "'" && !precededByWord) {
        state = 'single';
        out += ch;
        i++;
        continue;
      }
      if (ch === '"' && !precededByWord) {
        state = 'double';
        out += ch;
        i++;
        continue;
      }
      if (ch === '`') {
        state = 'template';
        out += ch;
        i++;
        continue;
      }
      out += ch;
      i++;
    } else if (state === 'single') {
      if (ch === '\\' && i + 1 < len) {
        out += ch + next;
        i += 2;
        continue;
      }
      if (ch === "'" || ch === '\n') {
        state = 'code';
      }
      out += ch;
      i++;
    } else if (state === 'double') {
      if (ch === '\\' && i + 1 < len) {
        out += ch + next;
        i += 2;
        continue;
      }
      if (ch === '"' || ch === '\n') {
        state = 'code';
      }
      out += ch;
      i++;
    } else if (state === 'template') {
      if (ch === '\\' && i + 1 < len) {
        out += ch + next;
        i += 2;
        continue;
      }
      if (ch === '`') {
        state = 'code';
      }
      out += ch;
      i++;
    } else if (state === 'line-comment') {
      if (ch === '\n') {
        state = 'code';
        out += '\n';
      } else {
        out += ' ';
      }
      i++;
    } else if (state === 'block-comment') {
      if (ch === '*' && next === '/') {
        state = 'code';
        out += '  ';
        i += 2;
        continue;
      }
      out += ch === '\n' ? '\n' : ' ';
      i++;
    }
  }

  return out;
}

/**
 * Replaces CSS block comments (`/* ... * /`) with spaces while preserving newlines
 * without treating `//` inside URLs or selectors as line comments.
 */
function stripCssCommentsPreservingLines(src) {
  let out = '';
  let i = 0;
  const len = src.length;
  let state = 'code'; // 'code' | 'single' | 'double' | 'block-comment'

  while (i < len) {
    const ch = src[i];
    const next = i + 1 < len ? src[i + 1] : '';

    if (state === 'code') {
      if (ch === '/' && next === '*') {
        state = 'block-comment';
        out += '  ';
        i += 2;
        continue;
      }
      if (ch === "'") {
        state = 'single';
        out += ch;
        i++;
        continue;
      }
      if (ch === '"') {
        state = 'double';
        out += ch;
        i++;
        continue;
      }
      out += ch;
      i++;
    } else if (state === 'single') {
      if (ch === '\\' && i + 1 < len) {
        out += ch + next;
        i += 2;
        continue;
      }
      if (ch === "'" || ch === '\n') state = 'code';
      out += ch;
      i++;
    } else if (state === 'double') {
      if (ch === '\\' && i + 1 < len) {
        out += ch + next;
        i += 2;
        continue;
      }
      if (ch === '"' || ch === '\n') state = 'code';
      out += ch;
      i++;
    } else if (state === 'block-comment') {
      if (ch === '*' && next === '/') {
        state = 'code';
        out += '  ';
        i += 2;
        continue;
      }
      out += ch === '\n' ? '\n' : ' ';
      i++;
    }
  }

  return out;
}

function lineNumberAt(src, index) {
  let line = 1;
  for (let i = 0; i < index && i < src.length; i++) {
    if (src.charCodeAt(i) === 10) line++;
  }
  return line;
}

function columnNumberAt(src, index) {
  const clamped = Math.max(0, Math.min(index, src.length));
  const lastNl = src.lastIndexOf('\n', clamped - 1);
  return clamped - lastNl;
}

function isLegalGapValue(rawVal) {
  const cleaned = rawVal
    .trim()
    .replace(/^['"`]|['"`]$/g, '')
    .replace(/!important$/i, '')
    .trim();
  if (!cleaned) return true;
  if (LEGAL_GUTTER_TOKENS.has(cleaned)) return true;
  // Support 2-token shorthand like "12px 20px" or "var(--f-gutter-pair) var(--f-gutter-scene)"
  const parts = cleaned.match(/var\([^)]+\)|\S+/g) || [];
  if (parts.length >= 1 && parts.length <= 2 && parts.every((p) => LEGAL_GUTTER_TOKENS.has(p))) {
    return true;
  }
  return false;
}

/**
 * Extracts balanced {...} content starting at the opening '{' at openIdx.
 */
function extractBalancedBraces(src, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return src.slice(openIdx + 1, i);
      }
    }
  }
  return src.slice(openIdx + 1);
}

/**
 * Validates sequential C-01, C-02, ... cut matches and appends any violations.
 */
function validateCutSequence(cutMatches, filePath, violations) {
  if (cutMatches.length === 0) return;
  const seen = new Set();
  for (let i = 0; i < cutMatches.length; i++) {
    const cur = cutMatches[i];
    const expectedNum = i + 1;
    const expectedLabel = `C-${String(expectedNum).padStart(2, '0')}`;

    if (i === 0 && cur.num !== 1) {
      violations.push({
        rule: 'cut-order',
        file: filePath,
        line: cur.line,
        column: cur.column,
        message: `First cut in file is "${cur.raw}", but cuts must start at "C-01".`,
        snippet: cur.snippet,
      });
    } else if (seen.has(cur.num)) {
      violations.push({
        rule: 'cut-order',
        file: filePath,
        line: cur.line,
        column: cur.column,
        message: `Duplicate cut number "${cur.raw}". Expected "${expectedLabel}" in reading/DOM order.`,
        snippet: cur.snippet,
      });
    } else if (cur.num !== expectedNum) {
      const prevLabel = i > 0 ? cutMatches[i - 1].raw : 'start';
      violations.push({
        rule: 'cut-order',
        file: filePath,
        line: cur.line,
        column: cur.column,
        message: `Out-of-order or skipped cut "${cur.raw}" after "${prevLabel}". Expected sequential "${expectedLabel}".`,
        snippet: cur.snippet,
      });
    }
    seen.add(cur.num);
  }
}

/**
 * Uses the TypeScript compiler AST (`ts.createSourceFile(..., ScriptKind.TSX)`)
 * to validate `cut-order` and `explicit-cut-in-autocut` across JSX elements,
 * attributes, spread objects, and nested `<Sheet autoCut>` boundaries.
 */
function lintCutsWithTypeScript(ts, content, filePath, violations) {
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TSX,
  );

  const UNSET = Symbol('unset');
  const deferredVarInitializers = new Set();
  const visitedDeferredInitializers = new Set();
  const activeInitializers = new Set();
  let trackDeferredInitializers = false;
  let inTabsContent = false;

  function resolveLocalIdentifier(idNode, seenIds = new Set()) {
    const name = idNode.text;
    if (name === 'undefined') return idNode;
    if (seenIds.has(name)) return null;
    seenIds.add(name);

    for (let cur = idNode.parent; cur; cur = cur.parent) {
      if (
        (ts.isFunctionDeclaration(cur) ||
          ts.isFunctionExpression(cur) ||
          ts.isArrowFunction(cur) ||
          ts.isMethodDeclaration(cur)) &&
        cur.parameters
      ) {
        for (const param of cur.parameters) {
          if (ts.isIdentifier(param.name) && param.name.text === name) {
            if (param.initializer) return param.initializer;
            return null;
          }
        }
      }

      const statements = ts.isSourceFile(cur)
        ? cur.statements
        : ts.isBlock(cur) || ts.isModuleBlock(cur)
          ? cur.statements
          : null;
      if (!statements) continue;

      for (const stmt of statements) {
        if (!ts.isVariableStatement(stmt)) continue;
        for (const decl of stmt.declarationList.declarations) {
          if (ts.isIdentifier(decl.name) && decl.name.text === name && decl.initializer) {
            if (trackDeferredInitializers) {
              deferredVarInitializers.add(decl.initializer);
            }
            if (ts.isIdentifier(decl.initializer)) {
              if (decl.initializer.text === 'undefined') return decl.initializer;
              return resolveLocalIdentifier(decl.initializer, seenIds) ?? decl.initializer;
            }
            return decl.initializer;
          }
        }
      }
    }
    return null;
  }

  function unwrapExpression(node) {
    let cur = node;
    const seen = new Set();
    while (cur && !seen.has(cur)) {
      seen.add(cur);
      if (ts.isJsxExpression(cur)) {
        cur = cur.expression;
      } else if (
        ts.isParenthesizedExpression(cur) ||
        ts.isAsExpression(cur) ||
        ts.isTypeAssertionExpression?.(cur) ||
        ts.isSatisfiesExpression?.(cur) ||
        ts.isNonNullExpression(cur)
      ) {
        cur = cur.expression;
      } else if (ts.isIdentifier(cur)) {
        if (cur.text === 'undefined') break;
        const resolved = resolveLocalIdentifier(cur);
        if (!resolved) break;
        cur = resolved;
      } else {
        break;
      }
    }
    return cur || null;
  }

  function getCanonicalTagName(tagNameNode) {
    const raw = tagNameNode.getText(sourceFile);
    if (CUT_OWNER_TAGS.has(raw) || raw === 'Sheet' || raw === 'TabsContent') return raw;
    if (ts.isIdentifier(tagNameNode)) {
      const resolved = unwrapExpression(tagNameNode);
      if (resolved && ts.isIdentifier(resolved)) {
        const targetName = resolved.text;
        if (
          CUT_OWNER_TAGS.has(targetName) ||
          targetName === 'Sheet' ||
          targetName === 'TabsContent'
        ) {
          return targetName;
        }
      }
    }
    return raw;
  }

  function isExplicitUndefined(node) {
    if (!node) return false;
    const expr = unwrapExpression(node);
    if (!expr) return false;
    if (ts.isIdentifier(expr) && expr.text === 'undefined') return true;
    if (ts.isVoidExpression(expr)) return true;
    return false;
  }

  function getStringValue(node) {
    const expr = unwrapExpression(node);
    if (!expr) return null;
    if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
      return expr.text;
    }
    return null;
  }

  function getBooleanValue(node) {
    const expr = unwrapExpression(node);
    if (!expr) return null;
    if (expr.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (expr.kind === ts.SyntaxKind.FalseKeyword) return false;
    return null;
  }

  const cutMatches = [];

  function resolveObjectProps(rawExpr, seenObjs = new Set()) {
    const obj = unwrapExpression(rawExpr);
    const resolved = {
      variant: UNSET,
      cut: UNSET,
      topCut: UNSET,
      bottomCut: UNSET,
      autoCut: UNSET,
      top: UNSET,
      bottom: UNSET,
      children: UNSET,
      extraNodes: [],
    };
    if (!obj || !ts.isObjectLiteralExpression(obj) || seenObjs.has(obj)) return resolved;
    if (!trackDeferredInitializers) {
      visitedDeferredInitializers.add(obj);
    }
    const nextSeen = new Set(seenObjs);
    nextSeen.add(obj);

    for (const prop of obj.properties) {
      if (ts.isSpreadAssignment(prop)) {
        const sub = resolveObjectProps(prop.expression, nextSeen);
        if (sub.variant !== UNSET) resolved.variant = sub.variant;
        if (sub.cut !== UNSET) resolved.cut = sub.cut;
        if (sub.topCut !== UNSET) resolved.topCut = sub.topCut;
        if (sub.bottomCut !== UNSET) resolved.bottomCut = sub.bottomCut;
        if (sub.autoCut !== UNSET) resolved.autoCut = sub.autoCut;
        if (sub.top !== UNSET) resolved.top = sub.top;
        if (sub.bottom !== UNSET) resolved.bottom = sub.bottom;
        if (sub.children !== UNSET) resolved.children = sub.children;
        if (sub.extraNodes.length > 0) resolved.extraNodes.push(...sub.extraNodes);
        continue;
      }

      let propName = null;
      let valExpr = null;
      if (ts.isPropertyAssignment(prop)) {
        if (ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name)) {
          propName = prop.name.text;
          valExpr = prop.initializer;
        }
      } else if (ts.isShorthandPropertyAssignment(prop)) {
        propName = prop.name.text;
        valExpr = prop.name;
      }
      if (!propName || !valExpr) continue;

      if (propName === 'variant') {
        const val = getStringValue(valExpr);
        if (val !== null) {
          resolved.variant = val;
        } else if (isExplicitUndefined(valExpr)) {
          resolved.variant = null;
        }
      } else if (CUT_PROP_NAMES.has(propName)) {
        const strVal = getStringValue(valExpr);
        if (strVal !== null) {
          resolved[propName] = strVal === '' ? false : { raw: strVal, node: prop };
        } else if (getBooleanValue(valExpr) === false) {
          resolved[propName] = false;
        } else if (isExplicitUndefined(valExpr)) {
          resolved[propName] = null;
        }
      } else if (propName === 'autoCut') {
        const boolVal = getBooleanValue(valExpr);
        if (boolVal !== null) {
          resolved.autoCut = boolVal;
        } else if (isExplicitUndefined(valExpr)) {
          resolved.autoCut = null;
        }
      } else if (propName === 'top' || propName === 'bottom') {
        if (isExplicitUndefined(valExpr) || unwrapExpression(valExpr)?.kind === ts.SyntaxKind.NullKeyword) {
          resolved[propName] = null;
        } else {
          resolved[propName] = resolveObjectProps(valExpr, nextSeen);
        }
      } else if (propName === 'children') {
        if (isExplicitUndefined(valExpr) || unwrapExpression(valExpr)?.kind === ts.SyntaxKind.NullKeyword) {
          resolved.children = null;
        } else {
          resolved.children = valExpr;
        }
      } else {
        resolved.extraNodes.push(valExpr);
      }
    }
    return resolved;
  }

  function resolveElementProps(attributes) {
    const resolved = {
      variant: UNSET,
      cut: UNSET,
      topCut: UNSET,
      bottomCut: UNSET,
      autoCut: UNSET,
      top: UNSET,
      bottom: UNSET,
      children: UNSET,
      extraNodes: [],
    };
    for (const prop of attributes.properties) {
      if (ts.isJsxSpreadAttribute(prop)) {
        const sub = resolveObjectProps(prop.expression);
        if (sub.variant !== UNSET) resolved.variant = sub.variant;
        if (sub.cut !== UNSET) resolved.cut = sub.cut;
        if (sub.topCut !== UNSET) resolved.topCut = sub.topCut;
        if (sub.bottomCut !== UNSET) resolved.bottomCut = sub.bottomCut;
        if (sub.autoCut !== UNSET) resolved.autoCut = sub.autoCut;
        if (sub.top !== UNSET) resolved.top = sub.top;
        if (sub.bottom !== UNSET) resolved.bottom = sub.bottom;
        if (sub.children !== UNSET) resolved.children = sub.children;
        if (sub.extraNodes.length > 0) resolved.extraNodes.push(...sub.extraNodes);
      } else if (ts.isJsxAttribute(prop)) {
        const attrName = prop.name.getText(sourceFile);
        if (attrName === 'variant') {
          if (!prop.initializer) continue;
          const val = getStringValue(prop.initializer);
          if (val !== null) {
            resolved.variant = val;
          } else if (isExplicitUndefined(prop.initializer)) {
            resolved.variant = null;
          }
        } else if (CUT_PROP_NAMES.has(attrName)) {
          if (!prop.initializer) continue;
          const strVal = getStringValue(prop.initializer);
          if (strVal !== null) {
            resolved[attrName] = strVal === '' ? false : { raw: strVal, node: prop };
          } else if (getBooleanValue(prop.initializer) === false) {
            resolved[attrName] = false;
          } else if (isExplicitUndefined(prop.initializer)) {
            resolved[attrName] = null;
          }
        } else if (attrName === 'autoCut') {
          if (!prop.initializer) {
            resolved.autoCut = true;
          } else {
            const boolVal = getBooleanValue(prop.initializer);
            if (boolVal !== null) {
              resolved.autoCut = boolVal;
            } else if (isExplicitUndefined(prop.initializer)) {
              resolved.autoCut = null;
            }
          }
        } else if (attrName === 'top' || attrName === 'bottom') {
          if (
            prop.initializer &&
            ts.isJsxExpression(prop.initializer) &&
            prop.initializer.expression
          ) {
            const expr = prop.initializer.expression;
            if (isExplicitUndefined(expr) || unwrapExpression(expr)?.kind === ts.SyntaxKind.NullKeyword) {
              resolved[attrName] = null;
            } else {
              resolved[attrName] = resolveObjectProps(expr);
            }
          }
        } else if (attrName === 'children') {
          if (!prop.initializer) {
            resolved.children = null;
          } else if (ts.isJsxExpression(prop.initializer)) {
            const expr = prop.initializer.expression;
            if (
              !expr ||
              isExplicitUndefined(expr) ||
              unwrapExpression(expr)?.kind === ts.SyntaxKind.NullKeyword
            ) {
              resolved.children = null;
            } else {
              resolved.children = expr;
            }
          } else {
            resolved.children = prop.initializer;
          }
        } else if (prop.initializer) {
          resolved.extraNodes.push(prop.initializer);
        }
      }
    }
    return resolved;
  }

  function getSheetAutoCut(attributes) {
    const props = resolveElementProps(attributes);
    return props.autoCut === true;
  }

  function extractReactChildrenFromExpr(rawExpr, out) {
    const expr = unwrapExpression(rawExpr);
    if (!expr) return out;
    if (
      expr.kind === ts.SyntaxKind.NullKeyword ||
      expr.kind === ts.SyntaxKind.TrueKeyword ||
      expr.kind === ts.SyntaxKind.FalseKeyword ||
      isExplicitUndefined(expr)
    ) {
      return out;
    }
    if (ts.isArrayLiteralExpression(expr)) {
      for (const el of expr.elements) {
        if (ts.isSpreadElement(el)) {
          extractReactChildrenFromExpr(el.expression, out);
        } else {
          extractReactChildrenFromExpr(el, out);
        }
      }
      return out;
    }
    out.push(expr);
    return out;
  }

  function extractReactChildrenArray(nodes, out = []) {
    for (const child of nodes) {
      if (!child) continue;
      if (ts.isJsxText(child)) {
        if (child.getText(sourceFile).trim() !== '') {
          out.push(child);
        }
        continue;
      }
      if (ts.isJsxExpression(child)) {
        if (!child.expression) continue;
        extractReactChildrenFromExpr(child.expression, out);
        continue;
      }
      out.push(child);
    }
    return out;
  }

  function recordCut(rawCut, node, ownerTag, inAutoCut, isQuiet = false) {
    const start = node.getStart(sourceFile);
    const pos = sourceFile.getLineAndCharacterOfPosition(start);
    const line = pos.line + 1;
    const column = pos.character + 1;
    const snippet = node.getText(sourceFile);
    const isDialogContentCut = ownerTag === 'DialogContent';

    if (inAutoCut && !isDialogContentCut) {
      violations.push({
        rule: 'explicit-cut-in-autocut',
        file: filePath,
        line,
        column,
        message: 'Cut numbers are automatic inside <Sheet autoCut>; remove the cut prop.',
        snippet,
      });
      return;
    }

    if (isQuiet && !isDialogContentCut) {
      violations.push({
        rule: 'cut-order',
        file: filePath,
        line,
        column,
        message:
          'Quiet panels (<Panel variant="quiet">) are subordinate operational groups and should not carry storyboard cut numbers; remove the cut prop or use variant="expressive".',
        snippet,
      });
      return;
    }

    const parsed = rawCut.match(/^C-(\d{2,})$/);
    if (!parsed) {
      violations.push({
        rule: 'cut-order',
        file: filePath,
        line,
        column,
        message: `Malformed cut label "${rawCut}". Cut numbers must use two-digit format "C-01", "C-02", etc.`,
        snippet,
      });
    } else if (!inAutoCut) {
      cutMatches.push({
        raw: rawCut,
        num: parseInt(parsed[1], 10),
        line,
        column,
        snippet,
      });
    }
  }

  const panelSlotInheritedMap = new Map();

  function processPairDescriptorSlot(slotObj, fallbackCut, pairVariant, inAutoCut) {
    const slotVariant =
      (slotObj && slotObj.variant !== UNSET && slotObj.variant !== null
        ? slotObj.variant
        : undefined) ?? pairVariant;
    const slotCutProp =
      slotObj && slotObj.cut !== UNSET && slotObj.cut !== null ? slotObj.cut : undefined;
    const validFallback =
      fallbackCut && fallbackCut !== UNSET && fallbackCut !== false ? fallbackCut : null;

    if (inAutoCut && slotCutProp && slotCutProp !== false && validFallback) {
      recordCut(
        validFallback.raw,
        validFallback.node,
        'PanelPair',
        inAutoCut,
        slotVariant === 'quiet',
      );
    }

    const effectiveCut =
      slotCutProp === false ? null : (slotCutProp ?? validFallback);
    if (effectiveCut) {
      recordCut(
        effectiveCut.raw,
        effectiveCut.node,
        'PanelPair',
        inAutoCut,
        slotVariant === 'quiet',
      );
    }

    if (slotObj) {
      for (const extra of slotObj.extraNodes) {
        visit(extra, inAutoCut);
      }
      if (slotObj.children !== UNSET && slotObj.children !== null) {
        visitRenderedExpr(slotObj.children, inAutoCut);
      }
    }
  }

  function slotHasDirectPanel(slotNode, seen = new Set()) {
    if (!slotNode || seen.has(slotNode)) return false;
    seen.add(slotNode);
    const unwrapped = unwrapExpression(slotNode) || slotNode;
    if (ts.isBinaryExpression(unwrapped)) {
      const op = unwrapped.operatorToken.kind;
      if (op === ts.SyntaxKind.AmpersandAmpersandToken) {
        return slotHasDirectPanel(unwrapped.right, seen);
      }
      if (op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken) {
        return (
          slotHasDirectPanel(unwrapped.left, seen) ||
          slotHasDirectPanel(unwrapped.right, seen)
        );
      }
    }
    if (ts.isConditionalExpression(unwrapped)) {
      return (
        slotHasDirectPanel(unwrapped.whenTrue, seen) ||
        slotHasDirectPanel(unwrapped.whenFalse, seen)
      );
    }
    return (
      (ts.isJsxElement(unwrapped) &&
        getCanonicalTagName(unwrapped.openingElement.tagName) === 'Panel') ||
      (ts.isJsxSelfClosingElement(unwrapped) &&
        getCanonicalTagName(unwrapped.tagName) === 'Panel')
    );
  }

  function processPairChildSlot(
    slotNode,
    fallbackCut,
    pairVariant,
    inAutoCut,
    slotState = {
      fallbackRecorded: false,
      quietFallbackChecked: false,
      hasDirectPanel: slotHasDirectPanel(slotNode),
    },
  ) {
    const unwrapped = unwrapExpression(slotNode) || slotNode;
    if (ts.isBinaryExpression(unwrapped)) {
      const op = unwrapped.operatorToken.kind;
      if (op === ts.SyntaxKind.AmpersandAmpersandToken) {
        visit(unwrapped.left, inAutoCut);
        processPairChildSlot(unwrapped.right, fallbackCut, pairVariant, inAutoCut, slotState);
        return;
      }
      if (op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken) {
        processPairChildSlot(unwrapped.left, fallbackCut, pairVariant, inAutoCut, slotState);
        processPairChildSlot(unwrapped.right, fallbackCut, pairVariant, inAutoCut, slotState);
        return;
      }
    }
    if (ts.isConditionalExpression(unwrapped)) {
      visit(unwrapped.condition, inAutoCut);
      processPairChildSlot(unwrapped.whenTrue, fallbackCut, pairVariant, inAutoCut, slotState);
      processPairChildSlot(unwrapped.whenFalse, fallbackCut, pairVariant, inAutoCut, slotState);
      return;
    }

    const isPanelElement =
      (ts.isJsxElement(unwrapped) &&
        getCanonicalTagName(unwrapped.openingElement.tagName) === 'Panel') ||
      (ts.isJsxSelfClosingElement(unwrapped) &&
        getCanonicalTagName(unwrapped.tagName) === 'Panel');

    if (isPanelElement) {
      visitedDeferredInitializers.add(unwrapped);
      panelSlotInheritedMap.set(unwrapped, {
        variant: pairVariant,
        fallbackCut,
        slotState,
      });
      visit(unwrapped, inAutoCut);
    } else {
      const isNonJsxBranch =
        !ts.isJsxElement(unwrapped) &&
        !ts.isJsxSelfClosingElement(unwrapped) &&
        !ts.isJsxFragment(unwrapped);
      if (
        !(isNonJsxBranch && slotState.hasDirectPanel) &&
        !slotState.fallbackRecorded &&
        fallbackCut &&
        fallbackCut !== UNSET &&
        fallbackCut !== false
      ) {
        slotState.fallbackRecorded = true;
        recordCut(
          fallbackCut.raw,
          fallbackCut.node,
          'PanelPair',
          inAutoCut,
          pairVariant === 'quiet',
        );
      }
      visitRenderedExpr(slotNode, inAutoCut);
    }
  }

  function preScanRenderedExpr(expr, seenInits = new Set()) {
    if (!expr) return;
    if (
      ts.isParenthesizedExpression(expr) ||
      ts.isAsExpression(expr) ||
      ts.isTypeAssertionExpression?.(expr) ||
      ts.isSatisfiesExpression?.(expr) ||
      ts.isNonNullExpression(expr)
    ) {
      preScanRenderedExpr(expr.expression, seenInits);
      return;
    }
    if (ts.isIdentifier(expr)) {
      if (expr.text === 'undefined') return;
      const init = resolveLocalIdentifier(expr);
      if (init && !seenInits.has(init)) {
        seenInits.add(init);
        preScanRenderedExpr(init, seenInits);
      }
      return;
    }
    if (ts.isBinaryExpression(expr)) {
      preScanRenderedExpr(expr.left, seenInits);
      preScanRenderedExpr(expr.right, seenInits);
      return;
    }
    if (ts.isConditionalExpression(expr)) {
      preScanRenderedExpr(expr.condition, seenInits);
      preScanRenderedExpr(expr.whenTrue, seenInits);
      preScanRenderedExpr(expr.whenFalse, seenInits);
      return;
    }
    if (ts.isArrayLiteralExpression(expr)) {
      for (const el of expr.elements) {
        if (ts.isSpreadElement(el)) {
          preScanRenderedExpr(el.expression, seenInits);
        } else {
          preScanRenderedExpr(el, seenInits);
        }
      }
    }
  }

  function visitRenderedExpr(expr, inAutoCut) {
    if (!expr) return;
    if (
      ts.isParenthesizedExpression(expr) ||
      ts.isAsExpression(expr) ||
      ts.isTypeAssertionExpression?.(expr) ||
      ts.isSatisfiesExpression?.(expr) ||
      ts.isNonNullExpression(expr)
    ) {
      visitRenderedExpr(expr.expression, inAutoCut);
      return;
    }
    if (ts.isIdentifier(expr)) {
      if (expr.text === 'undefined') return;
      const init = resolveLocalIdentifier(expr);
      if (init && !activeInitializers.has(init)) {
        visitedDeferredInitializers.add(init);
        activeInitializers.add(init);
        visitRenderedExpr(init, inAutoCut);
        activeInitializers.delete(init);
      }
      return;
    }
    if (ts.isBinaryExpression(expr)) {
      const op = expr.operatorToken.kind;
      if (op === ts.SyntaxKind.AmpersandAmpersandToken) {
        visit(expr.left, inAutoCut);
        visitRenderedExpr(expr.right, inAutoCut);
        return;
      }
      if (op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken) {
        visitRenderedExpr(expr.left, inAutoCut);
        visitRenderedExpr(expr.right, inAutoCut);
        return;
      }
    }
    if (ts.isConditionalExpression(expr)) {
      visit(expr.condition, inAutoCut);
      visitRenderedExpr(expr.whenTrue, inAutoCut);
      visitRenderedExpr(expr.whenFalse, inAutoCut);
      return;
    }
    if (ts.isArrayLiteralExpression(expr)) {
      for (const el of expr.elements) {
        if (ts.isSpreadElement(el)) {
          visitRenderedExpr(el.expression, inAutoCut);
        } else {
          visitRenderedExpr(el, inAutoCut);
        }
      }
      return;
    }
    visit(expr, inAutoCut);
  }

  function visitJsxChild(child, inAutoCut) {
    if (!child) return;
    if (ts.isJsxExpression(child)) {
      if (child.expression) {
        visitRenderedExpr(child.expression, inAutoCut);
      }
      return;
    }
    visit(child, inAutoCut);
  }

  function visitCutOwnerOrElement(node, tagName, attributes, inAutoCut) {
    const isCutOwner = CUT_OWNER_TAGS.has(tagName);
    if (!isCutOwner && tagName !== 'Sheet' && tagName !== 'TabsContent') {
      for (const prop of attributes.properties) {
        if (ts.isJsxAttribute(prop) && prop.name.getText(sourceFile) === 'children') {
          if (prop.initializer) {
            if (ts.isJsxExpression(prop.initializer) && prop.initializer.expression) {
              visitRenderedExpr(prop.initializer.expression, inAutoCut);
            } else {
              visit(prop.initializer, inAutoCut);
            }
          }
        } else {
          ts.forEachChild(prop, (child) => visit(child, inAutoCut));
        }
      }
      if (ts.isJsxElement(node)) {
        for (const child of node.children) {
          visitJsxChild(child, inAutoCut);
        }
      }
      return;
    }

    const props = resolveElementProps(attributes);

    if (tagName === 'Sheet' || tagName === 'TabsContent') {
      for (const extra of props.extraNodes) {
        visit(extra, inAutoCut);
      }
      if (ts.isJsxElement(node) && node.children.length > 0) {
        for (const child of node.children) {
          visitJsxChild(child, inAutoCut);
        }
      } else if (props.children !== UNSET && props.children !== null) {
        visitRenderedExpr(props.children, inAutoCut);
      }
      return;
    }

    if (tagName === 'Panel' || tagName === 'DialogContent') {
      const inheritedSlot = tagName === 'Panel' ? panelSlotInheritedMap.get(node) : null;
      const slotState = inheritedSlot?.slotState;
      const propVariant =
        props.variant !== UNSET && props.variant !== null ? props.variant : undefined;
      const defaultVariant = tagName === 'Panel' && inTabsContent ? 'quiet' : 'expressive';
      const effectiveVariant = propVariant ?? inheritedSlot?.variant ?? defaultVariant;
      const childCut = props.cut !== UNSET && props.cut !== null ? props.cut : undefined;
      const fallbackCut =
        inheritedSlot?.fallbackCut &&
        inheritedSlot.fallbackCut !== UNSET &&
        inheritedSlot.fallbackCut !== false
          ? inheritedSlot.fallbackCut
          : null;

      if (inAutoCut && tagName === 'Panel' && childCut && childCut !== false && fallbackCut) {
        if (!slotState || !slotState.fallbackRecorded) {
          if (slotState) slotState.fallbackRecorded = true;
          recordCut(
            fallbackCut.raw,
            fallbackCut.node,
            'PanelPair',
            inAutoCut,
            effectiveVariant === 'quiet',
          );
        }
      }

      if (childCut !== false) {
        if (childCut) {
          recordCut(
            childCut.raw,
            childCut.node,
            tagName,
            inAutoCut,
            effectiveVariant === 'quiet',
          );
        } else if (fallbackCut) {
          const isQuiet = effectiveVariant === 'quiet';
          if (isQuiet) {
            if (!slotState || !slotState.quietFallbackChecked) {
              if (slotState) slotState.quietFallbackChecked = true;
              recordCut(fallbackCut.raw, fallbackCut.node, tagName, inAutoCut, true);
            }
          } else if (!slotState || !slotState.fallbackRecorded) {
            if (slotState) slotState.fallbackRecorded = true;
            recordCut(fallbackCut.raw, fallbackCut.node, tagName, inAutoCut, false);
          }
        }
      }

      for (const extra of props.extraNodes) {
        visit(extra, inAutoCut);
      }
      if (ts.isJsxElement(node) && node.children.length > 0) {
        for (const child of node.children) {
          visitJsxChild(child, inAutoCut);
        }
      } else if (props.children !== UNSET && props.children !== null) {
        visitRenderedExpr(props.children, inAutoCut);
      }
      return;
    }

    // tagName === 'PanelPair'
    const defaultPairVariant = inTabsContent ? 'quiet' : 'expressive';
    const pairVariant =
      (props.variant !== UNSET && props.variant !== null ? props.variant : undefined) ??
      defaultPairVariant;
    const pairTopCut =
      props.topCut !== UNSET && props.topCut !== null ? props.topCut : undefined;
    const pairBottomCut =
      props.bottomCut !== UNSET && props.bottomCut !== null ? props.bottomCut : undefined;

    if (props.cut && props.cut !== UNSET && props.cut !== false) {
      recordCut(props.cut.raw, props.cut.node, 'PanelPair', inAutoCut, pairVariant === 'quiet');
    }

    for (const extra of props.extraNodes) {
      visit(extra, inAutoCut);
    }

    const topObj = props.top !== UNSET && props.top !== null ? props.top : undefined;
    const bottomObj = props.bottom !== UNSET && props.bottom !== null ? props.bottom : undefined;

    if (topObj && bottomObj) {
      processPairDescriptorSlot(topObj, pairTopCut, pairVariant, inAutoCut);
      processPairDescriptorSlot(bottomObj, pairBottomCut, pairVariant, inAutoCut);
      return;
    }

    let childSlots = [];
    if (ts.isJsxElement(node)) {
      childSlots = extractReactChildrenArray(node.children);
    }
    if (childSlots.length === 0 && props.children !== UNSET && props.children !== null) {
      childSlots = extractReactChildrenFromExpr(props.children, []);
    }

    if (childSlots.length > 0) {
      if (inAutoCut && topObj?.cut && topObj.cut !== UNSET && topObj.cut !== false) {
        recordCut(topObj.cut.raw, topObj.cut.node, 'PanelPair', inAutoCut, pairVariant === 'quiet');
      }
      processPairChildSlot(childSlots[0], pairTopCut, pairVariant, inAutoCut);
      if (inAutoCut && bottomObj?.cut && bottomObj.cut !== UNSET && bottomObj.cut !== false) {
        recordCut(
          bottomObj.cut.raw,
          bottomObj.cut.node,
          'PanelPair',
          inAutoCut,
          pairVariant === 'quiet',
        );
      }
      if (childSlots[1] !== undefined) {
        processPairChildSlot(childSlots[1], pairBottomCut, pairVariant, inAutoCut);
      } else if (inAutoCut && pairBottomCut && pairBottomCut !== false) {
        recordCut(
          pairBottomCut.raw,
          pairBottomCut.node,
          'PanelPair',
          inAutoCut,
          pairVariant === 'quiet',
        );
      }
      if (inAutoCut) {
        for (let i = 2; i < childSlots.length; i++) {
          visitRenderedExpr(childSlots[i], inAutoCut);
        }
      }
    } else if (inAutoCut) {
      processPairDescriptorSlot(topObj, pairTopCut, pairVariant, inAutoCut);
      processPairDescriptorSlot(bottomObj, pairBottomCut, pairVariant, inAutoCut);
    }
  }

  function preScanDeferrals(node) {
    if (ts.isJsxElement(node)) {
      const tagName = getCanonicalTagName(node.openingElement.tagName);
      if (CUT_OWNER_TAGS.has(tagName) || tagName === 'Sheet' || tagName === 'TabsContent') {
        const props = resolveElementProps(node.openingElement.attributes);
        if (props.children !== UNSET && props.children !== null) {
          preScanRenderedExpr(props.children);
        }
        if (props.top && props.top !== UNSET && props.top.children !== UNSET && props.top.children !== null) {
          preScanRenderedExpr(props.top.children);
        }
        if (props.bottom && props.bottom !== UNSET && props.bottom.children !== UNSET && props.bottom.children !== null) {
          preScanRenderedExpr(props.bottom.children);
        }
      } else {
        for (const prop of node.openingElement.attributes.properties) {
          if (
            ts.isJsxAttribute(prop) &&
            prop.name.getText(sourceFile) === 'children' &&
            prop.initializer &&
            ts.isJsxExpression(prop.initializer) &&
            prop.initializer.expression
          ) {
            preScanRenderedExpr(prop.initializer.expression);
          }
        }
      }
      if (tagName === 'PanelPair') {
        extractReactChildrenArray(node.children);
      }
      for (const child of node.children) {
        if (ts.isJsxExpression(child) && child.expression) {
          preScanRenderedExpr(child.expression);
        }
      }
    } else if (ts.isJsxSelfClosingElement(node)) {
      const tagName = getCanonicalTagName(node.tagName);
      if (CUT_OWNER_TAGS.has(tagName) || tagName === 'Sheet' || tagName === 'TabsContent') {
        const props = resolveElementProps(node.attributes);
        if (props.children !== UNSET && props.children !== null) {
          preScanRenderedExpr(props.children);
        }
        if (props.top && props.top !== UNSET && props.top.children !== UNSET && props.top.children !== null) {
          preScanRenderedExpr(props.top.children);
        }
        if (props.bottom && props.bottom !== UNSET && props.bottom.children !== UNSET && props.bottom.children !== null) {
          preScanRenderedExpr(props.bottom.children);
        }
      } else {
        for (const prop of node.attributes.properties) {
          if (
            ts.isJsxAttribute(prop) &&
            prop.name.getText(sourceFile) === 'children' &&
            prop.initializer &&
            ts.isJsxExpression(prop.initializer) &&
            prop.initializer.expression
          ) {
            preScanRenderedExpr(prop.initializer.expression);
          }
        }
      }
    } else if (ts.isJsxFragment(node)) {
      for (const child of node.children) {
        if (ts.isJsxExpression(child) && child.expression) {
          preScanRenderedExpr(child.expression);
        }
      }
    }
    ts.forEachChild(node, preScanDeferrals);
  }

  trackDeferredInitializers = true;
  preScanDeferrals(sourceFile);
  trackDeferredInitializers = false;

  function visit(node, inAutoCut) {
    if (!node) return;

    if (
      ts.isVariableDeclaration(node) &&
      node.initializer &&
      deferredVarInitializers.has(node.initializer)
    ) {
      return;
    }

    if (ts.isJsxElement(node)) {
      const tagName = getCanonicalTagName(node.openingElement.tagName);
      const nextAutoCut =
        tagName === 'Sheet' ? getSheetAutoCut(node.openingElement.attributes) : inAutoCut;
      const prevTabs = inTabsContent;
      if (tagName === 'TabsContent') inTabsContent = true;
      try {
        visitCutOwnerOrElement(node, tagName, node.openingElement.attributes, nextAutoCut);
      } finally {
        inTabsContent = prevTabs;
      }
      return;
    }

    if (ts.isJsxSelfClosingElement(node)) {
      const tagName = getCanonicalTagName(node.tagName);
      const nextAutoCut = tagName === 'Sheet' ? getSheetAutoCut(node.attributes) : inAutoCut;
      const prevTabs = inTabsContent;
      if (tagName === 'TabsContent') inTabsContent = true;
      try {
        visitCutOwnerOrElement(node, tagName, node.attributes, nextAutoCut);
      } finally {
        inTabsContent = prevTabs;
      }
      return;
    }

    if (ts.isJsxFragment(node)) {
      for (const child of node.children) {
        visitJsxChild(child, inAutoCut);
      }
      return;
    }

    ts.forEachChild(node, (child) => visit(child, inAutoCut));
  }

  visit(sourceFile, false);

  for (const init of deferredVarInitializers) {
    if (!visitedDeferredInitializers.has(init)) {
      visit(init, false);
    }
  }

  validateCutSequence(cutMatches, filePath, violations);
}

/**
 * Regex fallback for `cut-order` and `explicit-cut-in-autocut` when the optional
 * `typescript` peer dependency is not installed.
 */
function lintCutsFallback(stripped, rawContent, filePath, violations) {
  const autoCutRanges = [];
  const autoCutSheetRe =
    /<Sheet\b[^>]*?\bautoCut(?:\s*=\s*(?:\{\s*true\s*\}|["']true["']))?(?![\w-])[^>]*>([\s\S]*?)<\/Sheet>/g;
  let m;
  while ((m = autoCutSheetRe.exec(stripped)) !== null) {
    const start = m.index;
    const end = m.index + m[0].length;
    autoCutRanges.push([start, end]);
  }

  const isInsideAutoCut = (idx) =>
    autoCutRanges.some(([start, end]) => idx > start && idx < end);

  const cutMatches = [];
  const tagRe = /<(Panel|PanelPair|DialogContent)\b([^>]*?)\/?>/g;
  while ((m = tagRe.exec(stripped)) !== null) {
    const ownerTag = m[1];
    const attrs = m[2];
    const attrsStart = m.index + 1 + ownerTag.length;
    const inAutoCut = isInsideAutoCut(m.index);
    const isQuiet = /\bvariant\s*=\s*(?:['"]quiet['"]|\{\s*['"`]quiet['"`]\s*\})/.test(attrs);
    const propRe =
      /\b(cut|topCut|bottomCut)\s*=\s*(?:(['"])([^'"]*)\2|\{\s*(['"`])([^'"`]*)\4\s*\})/g;
    let pm;
    while ((pm = propRe.exec(attrs)) !== null) {
      const rawCut = pm[3] ?? pm[5] ?? '';
      if (rawCut === '') continue;
      const absIdx = attrsStart + pm.index;
      const line = lineNumberAt(rawContent, absIdx);
      const column = columnNumberAt(rawContent, absIdx);
      const snippet = pm[0];
      const isDialogContentCut = ownerTag === 'DialogContent';

      if (inAutoCut && !isDialogContentCut) {
        violations.push({
          rule: 'explicit-cut-in-autocut',
          file: filePath,
          line,
          column,
          message: 'Cut numbers are automatic inside <Sheet autoCut>; remove the cut prop.',
          snippet,
        });
        continue;
      }

      if (isQuiet && !isDialogContentCut) {
        violations.push({
          rule: 'cut-order',
          file: filePath,
          line,
          column,
          message:
            'Quiet panels (<Panel variant="quiet">) are subordinate operational groups and should not carry storyboard cut numbers; remove the cut prop or use variant="expressive".',
          snippet,
        });
        continue;
      }

      const parsed = rawCut.match(/^C-(\d{2,})$/);
      if (!parsed) {
        violations.push({
          rule: 'cut-order',
          file: filePath,
          line,
          column,
          message: `Malformed cut label "${rawCut}". Cut numbers must use two-digit format "C-01", "C-02", etc.`,
          snippet,
        });
      } else if (!inAutoCut) {
        cutMatches.push({
          raw: rawCut,
          num: parseInt(parsed[1], 10),
          line,
          column,
          snippet,
        });
      }
    }
  }

  validateCutSequence(cutMatches, filePath, violations);
}

/**
 * Lints a single source string and returns an array of violation objects:
 * { rule, file, line, column, message, snippet }
 */
export function lintSource(content, filePath = 'input.tsx', opts = {}) {
  const violations = [];
  const base = basename(filePath);
  const ext = extname(filePath);
  if (ext === '.html' || ext === '.htm') {
    return lintHtml(content, { file: filePath });
  }
  if (!CODE_EXTENSIONS.has(ext)) return violations;

  const normalizedPath = filePath.replace(/\\/g, '/');
  const isTokenFile =
    TOKEN_BASENAMES.has(base) ||
    TOKEN_EXEMPT_PATHS.some(
      (p) => normalizedPath === p || normalizedPath.endsWith(`/${p}`),
    );
  const isRegistryImplementation =
    normalizedPath.includes('/registry/ui/') ||
    normalizedPath.startsWith('registry/ui/') ||
    normalizedPath.includes('/registry/hooks/') ||
    normalizedPath.startsWith('registry/hooks/') ||
    normalizedPath.includes('/components/frame12/') ||
    normalizedPath.startsWith('components/frame12/') ||
    normalizedPath.includes('/hooks/use-on-twos') ||
    normalizedPath.startsWith('hooks/use-on-twos');

  const stripped = stripCommentsPreservingLines(content);

  // =========================================================================
  // 1. color-literal (Hard-coded colors, CSS gradients & font stacks outside token files)
  // =========================================================================
  if (!isTokenFile) {
    const colorScan = stripped;

    // Hex colors (#rgb, #rgba, #rrggbb, #rrggbbaa) not preceded by url( or href=
    const hexRegex = /#[0-9a-fA-F]{3,8}\b/g;
    let m;
    while ((m = hexRegex.exec(colorScan)) !== null) {
      const hex = m[0];
      if (![4, 5, 7, 9].includes(hex.length)) continue;
      const before = colorScan.slice(Math.max(0, m.index - 12), m.index);
      if (/url\(\s*$/i.test(before) || /href\s*=\s*['"]$/i.test(before)) continue;
      violations.push({
        rule: 'color-literal',
        file: filePath,
        line: lineNumberAt(content, m.index),
        column: columnNumberAt(content, m.index),
        message: `Hard-coded hex color "${hex}" is forbidden outside token files. Use a var(--f-*) token.`,
        snippet: hex,
      });
    }

    // rgb(), rgba(), hsl(), hsla(), oklch(), oklab()
    const fnColorRegex = /\b(?:rgb|rgba|hsl|hsla|oklch|oklab)\s*\([^)]*\)/gi;
    while ((m = fnColorRegex.exec(colorScan)) !== null) {
      violations.push({
        rule: 'color-literal',
        file: filePath,
        line: lineNumberAt(content, m.index),
        column: columnNumberAt(content, m.index),
        message: `Hard-coded color function "${m[0]}" is forbidden outside token files. Use a var(--f-*) token.`,
        snippet: m[0],
      });
    }

    // CSS gradients (linear-gradient, radial-gradient, conic-gradient)
    // Exempts only the screentone dot pattern radial-gradient(circle, var(--f-tone)...)
    const gradientRegex =
      /\b(?:repeating-)?(?:linear|radial|conic)-gradient\s*\([^;}\n)]*\)/gi;
    while ((m = gradientRegex.exec(colorScan)) !== null) {
      const grad = m[0];
      if (/^radial-gradient\(\s*circle\s*,\s*var\(--f-tone\)/i.test(grad)) continue;
      violations.push({
        rule: 'color-literal',
        file: filePath,
        line: lineNumberAt(content, m.index),
        column: columnNumberAt(content, m.index),
        message: `CSS gradient "${grad}" is forbidden in FRAME/12. Use 45° SVG screentone patterns or flat var(--f-*) surfaces.`,
        snippet: grad,
      });
    }

    // Hard-coded font names
    const fontRegex = /\b(?:Dela Gothic One|Zen Kaku Gothic New|M PLUS 1 Code)\b/g;
    while ((m = fontRegex.exec(colorScan)) !== null) {
      violations.push({
        rule: 'color-literal',
        file: filePath,
        line: lineNumberAt(content, m.index),
        column: columnNumberAt(content, m.index),
        message: `Hard-coded font family "${m[0]}" is forbidden outside token files. Use var(--font-f-*).`,
        snippet: m[0],
      });
    }
  }

  // =========================================================================
  // 2. illegal-gutter (Only 12px/pair, 20px/scene, 32px/change)
  // =========================================================================
  if (!isTokenFile) {
    let m;

    // 2a. <Scene gutter="..." /> prop check
    const sceneGutterStrRegex =
      /<Scene\b[^>]*?\bgutter\s*=\s*(?:['"]([^'"]*)['"]|\{\s*['"`]([^'"`]*)['"`]\s*\})/g;
    while ((m = sceneGutterStrRegex.exec(stripped)) !== null) {
      const val = m[1] ?? m[2] ?? '';
      if (!LEGAL_GUTTER_NAMES.has(val)) {
        violations.push({
          rule: 'illegal-gutter',
          file: filePath,
          line: lineNumberAt(content, m.index),
          column: columnNumberAt(content, m.index),
          message: `Invalid Scene gutter "${val}". Must be "pair" (12px), "scene" (20px), or "change" (32px).`,
          snippet: m[0],
        });
      }
    }

    // <Scene gutter={16} /> numeric check
    const sceneGutterNumRegex = /<Scene\b[^>]*?\bgutter\s*=\s*\{\s*(-?\d+(?:\.\d+)?)\s*\}/g;
    while ((m = sceneGutterNumRegex.exec(stripped)) !== null) {
      violations.push({
        rule: 'illegal-gutter',
        file: filePath,
        line: lineNumberAt(content, m.index),
        column: columnNumberAt(content, m.index),
        message: `Invalid numeric Scene gutter "{${m[1]}}". Must be "pair" (12px), "scene" (20px), or "change" (32px).`,
        snippet: m[0],
      });
    }

    // 2b. Inline style object or CSS gap / rowGap / columnGap / gridGap
    if (ext === '.css') {
      const cssGapRegex = /(?<![-\w])(?:gap|grid-gap|row-gap|column-gap)\s*:\s*([^;}\n]+)/gi;
      while ((m = cssGapRegex.exec(stripped)) !== null) {
        const val = m[1].trim();
        if (!isLegalGapValue(val)) {
          violations.push({
            rule: 'illegal-gutter',
            file: filePath,
            line: lineNumberAt(content, m.index),
            column: columnNumberAt(content, m.index),
            message: `Illegal CSS gutter "${m[0].trim()}". Only 12px (pair), 20px (scene), or 32px (change) are allowed.`,
            snippet: m[0].trim(),
          });
        }
      }
    } else {
      // JSX inline style object: gap: '16px', gap: 16, rowGap: '24px', columnGap: 8
      const jsxGapRegex =
        /\b(?:gap|gridGap|rowGap|columnGap)\s*:\s*(?:(['"`])([^'"`]*)\1|(-?\d+(?:\.\d+)?)\b)/g;
      while ((m = jsxGapRegex.exec(stripped)) !== null) {
        const raw = m[2] !== undefined ? m[2] : m[3];
        if (!isLegalGapValue(raw)) {
          violations.push({
            rule: 'illegal-gutter',
            file: filePath,
            line: lineNumberAt(content, m.index),
            column: columnNumberAt(content, m.index),
            message: `Illegal inline gutter "${m[0].trim()}". Use 12px (var(--f-gutter-pair)), 20px (var(--f-gutter-scene)), or 32px (var(--f-gutter-change)).`,
            snippet: m[0].trim(),
          });
        }
      }

      // 2c. Tailwind gap-* classes in className (including string literals, template literals, cn(), clsx())
      const classStartRegex = /\bclassName\s*=\s*/g;
      while ((m = classStartRegex.exec(stripped)) !== null) {
        const valStart = m.index + m[0].length;
        const firstCh = stripped[valStart];
        const stringFragments = [];

        if (firstCh === '"' || firstCh === "'") {
          const endIdx = stripped.indexOf(firstCh, valStart + 1);
          if (endIdx !== -1) {
            stringFragments.push(stripped.slice(valStart + 1, endIdx));
          }
        } else if (firstCh === '{') {
          const expr = extractBalancedBraces(stripped, valStart);
          const strLitRegex = /(['"`])((?:\\.|(?!\1)[\s\S])*)\1/g;
          let sm;
          while ((sm = strLitRegex.exec(expr)) !== null) {
            // Strip ${...} interpolation blocks inside template literals while keeping static class tokens
            const cleaned = sm[2].replace(/\$\{[^}]*\}/g, ' ');
            stringFragments.push(cleaned);
          }
        }

        for (const clsStr of stringFragments) {
          const tokens = clsStr.split(/\s+/).filter(Boolean);
          for (const tok of tokens) {
            if (/^gap-(?:x-|y-)?/.test(tok) && !LEGAL_TAILWIND_GAP_CLASSES.has(tok)) {
              violations.push({
                rule: 'illegal-gutter',
                file: filePath,
                line: lineNumberAt(content, m.index),
                column: columnNumberAt(content, m.index),
                message: `Illegal Tailwind gutter class "${tok}". Use Scene gutter="pair|scene|change" or 12px/20px/32px tokens.`,
                snippet: tok,
              });
            }
          }
        }
      }
    }
  }

  // =========================================================================
  // 3. marker-misuse (--f-marker / #ffd60a only as background under --f-marker-ink)
  // =========================================================================
  if (!isTokenFile) {
    let m;

    // 3a. Forbidden CSS/inline properties using --f-marker or #ffd60a
    const forbiddenMarkerPropRegex =
      /(?<![-\w])(color|stroke|fill|border|borderColor|border-color|borderTop|borderBottom|borderLeft|borderRight|borderTopColor|borderBottomColor|borderLeftColor|borderRightColor|outline|outlineColor|outline-color|textDecorationColor|boxShadow|box-shadow)\s*:\s*([^;,\n}]*(?:--f-marker\b|#ffd60a\b)[^;,\n}]*)/gi;
    while ((m = forbiddenMarkerPropRegex.exec(stripped)) !== null) {
      const prop = m[1];
      const val = m[2].trim();
      // Make sure we didn't match --f-marker-ink on color
      if (
        /--f-marker-ink\b/.test(val) &&
        !/--f-marker(?!-ink)\b/i.test(val) &&
        !/#ffd60a\b/i.test(val)
      ) {
        continue;
      }
      violations.push({
        rule: 'marker-misuse',
        file: filePath,
        line: lineNumberAt(content, m.index),
        column: columnNumberAt(content, m.index),
        message: `Marker yellow (--f-marker / #ffd60a) cannot be used on "${prop}". It may only be a background under --f-marker-ink text.`,
        snippet: m[0].trim(),
      });
    }

    // 3b. SVG JSX attributes stroke="var(--f-marker)" or fill="var(--f-marker)"
    const svgMarkerAttrRegex =
      /\b(stroke|fill|color)\s*=\s*['"][^'"]*(?:--f-marker(?!-ink)|#ffd60a)[^'"]*['"]/gi;
    while ((m = svgMarkerAttrRegex.exec(stripped)) !== null) {
      violations.push({
        rule: 'marker-misuse',
        file: filePath,
        line: lineNumberAt(content, m.index),
        column: columnNumberAt(content, m.index),
        message: `Marker yellow cannot be used as an SVG/JSX "${m[1]}" attribute. Use <Tag>, <Badge>, or <Balloon>.`,
        snippet: m[0],
      });
    }

    // 3c. Tailwind marker classes on text/border/stroke/fill/ring
    const twMarkerMisuseRegex =
      /\b(?:text|border|stroke|fill|ring|outline)-(?:f-marker\b|\[[^\]]*(?:--f-marker(?!-ink)|#ffd60a)[^\]]*\])/g;
    while ((m = twMarkerMisuseRegex.exec(stripped)) !== null) {
      violations.push({
        rule: 'marker-misuse',
        file: filePath,
        line: lineNumberAt(content, m.index),
        column: columnNumberAt(content, m.index),
        message: `Marker yellow utility "${m[0]}" is forbidden. Marker yellow may only be used as a background paired with --f-marker-ink text.`,
        snippet: m[0],
      });
    }

    // 3d. Inline style object or CSS rule setting background/backgroundColor to --f-marker without color: var(--f-marker-ink)
    const styleObjRegex = /style\s*=\s*\{\s*\{([\s\S]*?)\}\s*\}/g;
    while ((m = styleObjRegex.exec(stripped)) !== null) {
      const body = m[1];
      const hasMarkerBg =
        /\b(?:background|backgroundColor)\s*:\s*['"`][^'"`]*(?:--f-marker(?!-ink)|#ffd60a)[^'"`]*['"`]/i.test(
          body,
        );
      if (hasMarkerBg) {
        const hasMarkerInkColor = /\bcolor\s*:\s*['"`][^'"`]*--f-marker-ink\b/i.test(body);
        if (!hasMarkerInkColor) {
          violations.push({
            rule: 'marker-misuse',
            file: filePath,
            line: lineNumberAt(content, m.index),
            column: columnNumberAt(content, m.index),
            message:
              'Marker yellow background in inline style must be paired with color: "var(--f-marker-ink)".',
            snippet: m[0].replace(/\s+/g, ' ').trim(),
          });
        }
      }
    }

    if (ext === '.css') {
      const cssBlockRegex = /\{([^{}]*)\}/g;
      while ((m = cssBlockRegex.exec(stripped)) !== null) {
        const body = m[1];
        const hasMarkerBg =
          /\bbackground(?:-color)?\s*:\s*[^;]*(?:--f-marker(?!-ink)|#ffd60a)/i.test(body);
        if (hasMarkerBg) {
          const hasMarkerInkColor = /\bcolor\s*:\s*[^;]*--f-marker-ink\b/i.test(body);
          if (!hasMarkerInkColor) {
            violations.push({
              rule: 'marker-misuse',
              file: filePath,
              line: lineNumberAt(content, m.index),
              column: columnNumberAt(content, m.index),
              message:
                'Marker yellow background in CSS rule must be paired with color: var(--f-marker-ink).',
              snippet: body.replace(/\s+/g, ' ').trim(),
            });
          }
        }
      }
    }
  }

  // =========================================================================
  // 4. cut-order & explicit-cut-in-autocut (via TypeScript TSX AST or fallback)
  // =========================================================================
  if (ext !== '.css') {
    const ts = opts?.disableTypeScript ? null : loadTypeScript();
    if (!ts) {
      if (!warnedTypeScriptFallback && !opts?.quietFallbackWarning) {
        warnedTypeScriptFallback = true;
        console.warn(
          'WARN  [@frame12/lint] Optional peer dependency "typescript" is not installed; falling back to regex cut-order checks for JSX/TSX files.',
        );
      }
      lintCutsFallback(stripped, content, filePath, violations);
    } else {
      lintCutsWithTypeScript(ts, content, filePath, violations);
    }
  }

  // =========================================================================
  // 5. raw-shadcn-import (Forbidden raw @/components/ui/*, @radix-ui/*, or charting libs)
  // =========================================================================
  if (ext !== '.css' && !isRegistryImplementation) {
    const importRegex =
      /\b(?:import|export)\b[\s\S]*?\bfrom\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    let m;
    while ((m = importRegex.exec(stripped)) !== null) {
      const spec = m[1] ?? m[2] ?? '';
      const line = lineNumberAt(content, m.index);
      const column = columnNumberAt(content, m.index);

      if (spec.startsWith('@radix-ui/')) {
        violations.push({
          rule: 'raw-shadcn-import',
          file: filePath,
          line,
          column,
          message: `Raw Radix primitive import "${spec}" is forbidden. Import the FRAME/12 adapter from "@/components/frame12".`,
          snippet: m[0].trim(),
        });
        continue;
      }

      if (FORBIDDEN_EXTERNAL_PACKAGES.has(spec)) {
        violations.push({
          rule: 'raw-shadcn-import',
          file: filePath,
          line,
          column,
          message: `External library "${spec}" is forbidden in FRAME/12. Use ToneAreaChart, ToneBarList, ToneSpark from "@/components/frame12" and useOnTwos from "@/hooks/use-on-twos".`,
          snippet: m[0].trim(),
        });
        continue;
      }

      const uiMatch = spec.match(/^(?:@\/|\.\.?\/.*)?components\/ui\/([a-z0-9-]+)$/i);
      if (uiMatch) {
        const modName = uiMatch[1].toLowerCase();
        if (FORBIDDEN_SHADCN_MODULES.has(modName)) {
          violations.push({
            rule: 'raw-shadcn-import',
            file: filePath,
            line,
            column,
            message: `Raw shadcn import "${spec}" is forbidden where a FRAME/12 component or adapter exists. Import from "@/components/frame12".`,
            snippet: m[0].trim(),
          });
        }
      }
    }
  }

  return violations;
}

/**
 * Lints a CSS text fragment (from a `<style>` element or an inline `style="..."` attribute)
 * and maps all violations back to 1-based line and column positions in `fullHtml`.
 */
function lintCssInHtml(cssText, baseOffset, fullHtml, filePath, violations, isInlineAttr) {
  const clean = stripCssCommentsPreservingLines(cssText);
  let m;

  // unsafe-html in CSS: @import and external url(https://...) / url(//...)
  const cssImportRegex = /@import\b[^;\n]*/gi;
  while ((m = cssImportRegex.exec(clean)) !== null) {
    const absIdx = baseOffset + m.index;
    violations.push({
      rule: 'unsafe-html',
      file: filePath,
      line: lineNumberAt(fullHtml, absIdx),
      column: columnNumberAt(fullHtml, absIdx),
      message: 'CSS "@import" is forbidden in self-contained generated HTML.',
      snippet: m[0].trim(),
    });
  }

  const externalCssUrlRegex = /\burl\(\s*(['"]?)\s*((?:https?:)?\/\/[^)'"\s]+)\s*\1\s*\)/gi;
  while ((m = externalCssUrlRegex.exec(clean)) !== null) {
    const absIdx = baseOffset + m.index;
    violations.push({
      rule: 'unsafe-html',
      file: filePath,
      line: lineNumberAt(fullHtml, absIdx),
      column: columnNumberAt(fullHtml, absIdx),
      message: `External CSS url("${m[2]}") is forbidden in self-contained generated HTML.`,
      snippet: m[0].trim(),
    });
  }

  // 1a. Hex colors (#rgb, #rgba, #rrggbb, #rrggbbaa)
  const hexRegex = /#[0-9a-fA-F]{3,8}\b/g;
  while ((m = hexRegex.exec(clean)) !== null) {
    const hex = m[0];
    if (![4, 5, 7, 9].includes(hex.length)) continue;
    const before = clean.slice(Math.max(0, m.index - 12), m.index);
    if (/url\(\s*['"]?$/i.test(before) || /href\s*=\s*['"]$/i.test(before)) continue;
    const absIdx = baseOffset + m.index;
    violations.push({
      rule: 'color-literal',
      file: filePath,
      line: lineNumberAt(fullHtml, absIdx),
      column: columnNumberAt(fullHtml, absIdx),
      message: `Hard-coded hex color "${hex}" is forbidden outside token files. Use a var(--f-*) token.`,
      snippet: hex,
    });
  }

  // 1b. Color functions
  const fnColorRegex = /\b(?:rgb|rgba|hsl|hsla|oklch|oklab)\s*\([^)]*\)/gi;
  while ((m = fnColorRegex.exec(clean)) !== null) {
    const absIdx = baseOffset + m.index;
    violations.push({
      rule: 'color-literal',
      file: filePath,
      line: lineNumberAt(fullHtml, absIdx),
      column: columnNumberAt(fullHtml, absIdx),
      message: `Hard-coded color function "${m[0]}" is forbidden outside token files. Use a var(--f-*) token.`,
      snippet: m[0],
    });
  }

  // 1c. CSS gradients
  const gradientRegex =
    /\b(?:repeating-)?(?:linear|radial|conic)-gradient\s*\([^;}\n)]*\)/gi;
  while ((m = gradientRegex.exec(clean)) !== null) {
    const grad = m[0];
    if (/^radial-gradient\(\s*circle\s*,\s*var\(--f-tone\)/i.test(grad)) continue;
    const absIdx = baseOffset + m.index;
    violations.push({
      rule: 'color-literal',
      file: filePath,
      line: lineNumberAt(fullHtml, absIdx),
      column: columnNumberAt(fullHtml, absIdx),
      message: `CSS gradient "${grad}" is forbidden in FRAME/12. Use 45° SVG screentone patterns or flat var(--f-*) surfaces.`,
      snippet: grad,
    });
  }

  // 1d. Hard-coded font names
  const fontRegex = /\b(?:Dela Gothic One|Zen Kaku Gothic New|M PLUS 1 Code)\b/g;
  while ((m = fontRegex.exec(clean)) !== null) {
    const absIdx = baseOffset + m.index;
    violations.push({
      rule: 'color-literal',
      file: filePath,
      line: lineNumberAt(fullHtml, absIdx),
      column: columnNumberAt(fullHtml, absIdx),
      message: `Hard-coded font family "${m[0]}" is forbidden outside token files. Use var(--font-f-*).`,
      snippet: m[0],
    });
  }

  // 2. illegal-gutter
  const cssGapRegex = /(?<![-\w])(?:gap|grid-gap|row-gap|column-gap)\s*:\s*([^;}\n]+)/gi;
  while ((m = cssGapRegex.exec(clean)) !== null) {
    const val = m[1].trim();
    if (!isLegalGapValue(val)) {
      const absIdx = baseOffset + m.index;
      violations.push({
        rule: 'illegal-gutter',
        file: filePath,
        line: lineNumberAt(fullHtml, absIdx),
        column: columnNumberAt(fullHtml, absIdx),
        message: `Illegal CSS gutter "${m[0].trim()}". Only 12px (pair), 20px (scene), or 32px (change) are allowed.`,
        snippet: m[0].trim(),
      });
    }
  }

  // 3a. marker-misuse on forbidden CSS properties
  const forbiddenMarkerPropRegex =
    /(?<![-\w])(color|stroke|fill|border|border-color|border-top|border-bottom|border-left|border-right|border-top-color|border-bottom-color|border-left-color|border-right-color|outline|outline-color|text-decoration-color|box-shadow)\s*:\s*([^;,\n}]*(?:--f-marker\b|#ffd60a\b)[^;,\n}]*)/gi;
  while ((m = forbiddenMarkerPropRegex.exec(clean)) !== null) {
    const prop = m[1];
    const val = m[2].trim();
    if (
      /--f-marker-ink\b/.test(val) &&
      !/--f-marker(?!-ink)\b/i.test(val) &&
      !/#ffd60a\b/i.test(val)
    ) {
      continue;
    }
    const absIdx = baseOffset + m.index;
    violations.push({
      rule: 'marker-misuse',
      file: filePath,
      line: lineNumberAt(fullHtml, absIdx),
      column: columnNumberAt(fullHtml, absIdx),
      message: `Marker yellow (--f-marker / #ffd60a) cannot be used on "${prop}". It may only be a background under --f-marker-ink text.`,
      snippet: m[0].trim(),
    });
  }

  // 3b. marker-misuse on background without --f-marker-ink
  if (isInlineAttr) {
    const bgMatch =
      /(?<![-\w])background(?:-color)?\s*:\s*[^;]*(?:--f-marker(?!-ink)|#ffd60a)/i.exec(clean);
    if (bgMatch) {
      const hasMarkerInkColor = /(?<![-\w])color\s*:\s*[^;]*--f-marker-ink\b/i.test(clean);
      if (!hasMarkerInkColor) {
        const absIdx = baseOffset + bgMatch.index;
        violations.push({
          rule: 'marker-misuse',
          file: filePath,
          line: lineNumberAt(fullHtml, absIdx),
          column: columnNumberAt(fullHtml, absIdx),
          message:
            'Marker yellow background in inline style must be paired with color: "var(--f-marker-ink)".',
          snippet: clean.replace(/\s+/g, ' ').trim(),
        });
      }
    }
  } else {
    const cssBlockRegex = /\{([^{}]*)\}/g;
    while ((m = cssBlockRegex.exec(clean)) !== null) {
      const body = m[1];
      const bgMatch =
        /(?<![-\w])background(?:-color)?\s*:\s*[^;]*(?:--f-marker(?!-ink)|#ffd60a)/i.exec(body);
      if (bgMatch) {
        const hasMarkerInkColor = /(?<![-\w])color\s*:\s*[^;]*--f-marker-ink\b/i.test(body);
        if (!hasMarkerInkColor) {
          const absIdx = baseOffset + m.index + 1 + bgMatch.index;
          violations.push({
            rule: 'marker-misuse',
            file: filePath,
            line: lineNumberAt(fullHtml, absIdx),
            column: columnNumberAt(fullHtml, absIdx),
            message:
              'Marker yellow background in CSS rule must be paired with color: var(--f-marker-ink).',
            snippet: body.replace(/\s+/g, ' ').trim(),
          });
        }
      }
    }
  }
}

/**
 * Decodes basic numeric/named HTML character references and strips control characters/whitespace
 * to detect obfuscated `javascript:` or external URLs in attribute values.
 */
function normalizeUrlValueForSchemeCheck(rawVal) {
  const decoded = rawVal
    .replace(/&#x([0-9a-fA-F]+);?/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);?/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&colon;/gi, ':')
    .replace(/&tab;/gi, '\t')
    .replace(/&newline;/gi, '\n');
  // Strip ASCII whitespace and control characters
  return decoded.replace(/[\x00-\x20]+/g, '');
}

/**
 * Parses attributes of an opening HTML tag starting at `startIdx` (right after `<tagName`).
 * Returns `{ attrs, endIdx, selfClosing }`.
 */
function parseHtmlTagAttributes(html, startIdx) {
  const attrs = [];
  const len = html.length;
  let pos = startIdx;
  let selfClosing = false;

  while (pos < len) {
    while (pos < len && /\s/.test(html[pos])) pos++;
    if (pos >= len) break;

    if (html[pos] === '>') {
      pos++;
      break;
    }
    if (html[pos] === '/' && html[pos + 1] === '>') {
      selfClosing = true;
      pos += 2;
      break;
    }
    if (html[pos] === '/') {
      pos++;
      continue;
    }

    const nameOffset = pos;
    while (pos < len && !/[\s=/>"'<]/.test(html[pos])) pos++;
    if (pos === nameOffset) {
      pos++;
      continue;
    }
    const name = html.slice(nameOffset, pos);
    const lowerName = name.toLowerCase();

    let afterName = pos;
    while (afterName < len && /\s/.test(html[afterName])) afterName++;

    let hasValue = false;
    let value = '';
    let valueOffset = afterName;

    if (html[afterName] === '=') {
      hasValue = true;
      pos = afterName + 1;
      while (pos < len && /\s/.test(html[pos])) pos++;
      const ch = html[pos];
      if (ch === '"' || ch === "'") {
        const quote = ch;
        pos++;
        valueOffset = pos;
        const closeQuote = html.indexOf(quote, pos);
        if (closeQuote === -1) {
          value = html.slice(pos);
          pos = len;
        } else {
          value = html.slice(pos, closeQuote);
          pos = closeQuote + 1;
        }
      } else {
        valueOffset = pos;
        while (pos < len && !/[\s>]/.test(html[pos]) && !(html[pos] === '/' && html[pos + 1] === '>')) {
          pos++;
        }
        value = html.slice(valueOffset, pos);
      }
    }

    const raw = html.slice(nameOffset, pos);
    attrs.push({
      name,
      lowerName,
      hasValue,
      value,
      nameOffset,
      valueOffset,
      raw,
    });
  }

  return { attrs, endIdx: pos, selfClosing };
}

/**
 * Lints an HTML document or fragment against FRAME/12 design-grammar rules:
 * - `color-literal`, `illegal-gutter`, `marker-misuse` inside `<style>` elements
 *   (excluding `<style data-f12-tokens>` and `opts.tokenStyleIds`), `style="..."`
 *   attributes, `class="..."` attributes, and SVG presentation attributes.
 * - `cut-order` on `[data-cut]` and `.f12-cut` elements in DOM reading order.
 * - `unsafe-html` on external `<script src="...">`, external subresource loads
 *   (`<link href>`, `<img src>`, CSS `@import`/`url()`), embedded frames
 *   (`<iframe>`, `<object>`, `<embed>`, `srcdoc`), `<meta http-equiv="refresh">`,
 *   `<base href>`, `on*=` attributes, and `javascript:` URLs.
 */
export function lintHtml(input, opts = {}) {
  // Accept objects with a string form (e.g. @frame12/static `Html` values) by converting them
  // once; indexing a non-string character by character would never terminate or lint nothing.
  const html = typeof input === 'string' ? input : String(input ?? '');
  const filePath = opts.file ?? 'input.html';
  const tokenStyleIds = new Set(opts.tokenStyleIds ?? []);
  const violations = [];
  const pendingCuts = [];
  const openStack = [];

  const len = html.length;
  let i = 0;

  const appendTextToOpenBadges = (text) => {
    if (!text) return;
    for (const entry of openStack) {
      if (entry.isCutBadge) {
        entry.textBuffer += text;
      }
    }
  };

  const finalizeElementOnClose = (entry, closeEndIdx) => {
    if (!entry.isCutBadge || !entry.cutRecord) return;
    const trimmed = entry.textBuffer.trim();
    if (!trimmed || trimmed.toLowerCase() === 'auto') {
      entry.cutRecord.ignore = true;
      return;
    }
    if (
      entry.ancestorWithDataCut &&
      !entry.ancestorWithDataCut.consumedChildCut &&
      entry.ancestorWithDataCut.explicitDataCut === trimmed
    ) {
      entry.ancestorWithDataCut.consumedChildCut = true;
      entry.cutRecord.ignore = true;
      return;
    }
    entry.cutRecord.raw = trimmed;
    if (closeEndIdx !== undefined) {
      entry.cutRecord.snippet = html.slice(entry.tagStartOffset, closeEndIdx);
    }
  };

  while (i < len) {
    if (html[i] !== '<') {
      const nextLt = html.indexOf('<', i);
      const chunk = nextLt === -1 ? html.slice(i) : html.slice(i, nextLt);
      appendTextToOpenBadges(chunk);
      i = nextLt === -1 ? len : nextLt;
      continue;
    }

    // 1. HTML comment <!-- ... -->
    if (html.startsWith('<!--', i)) {
      const endComment = html.indexOf('-->', i + 4);
      i = endComment === -1 ? len : endComment + 3;
      continue;
    }

    // 2. CDATA <![CDATA[ ... ]]>
    if (html.slice(i, i + 9).toUpperCase() === '<![CDATA[') {
      const endCdata = html.indexOf(']]>', i + 9);
      if (endCdata === -1) {
        appendTextToOpenBadges(html.slice(i + 9));
        break;
      }
      appendTextToOpenBadges(html.slice(i + 9, endCdata));
      i = endCdata + 3;
      continue;
    }

    // 3. Declaration <!DOCTYPE ...> or processing instruction <? ... ?>
    if (html[i + 1] === '!' || html[i + 1] === '?') {
      const endDecl = html.indexOf('>', i + 2);
      i = endDecl === -1 ? len : endDecl + 1;
      continue;
    }

    // 4. Closing tag </tagName ...>
    if (html[i + 1] === '/') {
      const closeMatch = /^<\/\s*([A-Za-z][A-Za-z0-9:_-]*)[^>]*>/.exec(html.slice(i));
      if (closeMatch) {
        const closeTag = closeMatch[1].toLowerCase();
        const closeEndIdx = i + closeMatch[0].length;
        for (let s = openStack.length - 1; s >= 0; s--) {
          if (openStack[s].tagName === closeTag) {
            while (openStack.length > s) {
              const popped = openStack.pop();
              finalizeElementOnClose(popped, closeEndIdx);
            }
            break;
          }
        }
        i = closeEndIdx;
        continue;
      }
    }

    // 5. Opening tag <tagName ...>
    const tagMatch = /^<([A-Za-z][A-Za-z0-9:_-]*)/.exec(html.slice(i));
    if (!tagMatch) {
      appendTextToOpenBadges('<');
      i++;
      continue;
    }

    const tagStartOffset = i;
    const rawTagName = tagMatch[1];
    const lowerTag = rawTagName.toLowerCase();
    const { attrs, endIdx: tagEndOffset, selfClosing } = parseHtmlTagAttributes(
      html,
      i + tagMatch[0].length,
    );

    // unsafe-html: forbidden embedded frame/object tags (<iframe>, <object>, <embed>)
    if (FORBIDDEN_EMBED_TAGS.has(lowerTag)) {
      violations.push({
        rule: 'unsafe-html',
        file: filePath,
        line: lineNumberAt(html, tagStartOffset),
        column: columnNumberAt(html, tagStartOffset),
        message: `Embedded <${lowerTag}> element is forbidden in self-contained generated HTML.`,
        snippet: html.slice(tagStartOffset, tagEndOffset),
      });
    }

    // Check attributes on this element
    let idAttr = null;
    let hasDataF12Tokens = false;
    let dataCutAttr = null;
    let hasDataAutocut = false;
    let classAttr = null;

    for (const attr of attrs) {
      if (attr.lowerName === 'id') idAttr = attr;
      if (attr.lowerName === 'data-f12-tokens' && attr.value.toLowerCase() !== 'false') {
        hasDataF12Tokens = true;
      }
      if (attr.lowerName === 'data-cut') dataCutAttr = attr;
      if (attr.lowerName === 'data-autocut' && attr.value.toLowerCase() !== 'false') {
        hasDataAutocut = true;
      }
      if (attr.lowerName === 'class') classAttr = attr;

      // unsafe-html: inline event handlers (on*=)
      if (/^on[a-z]+$/i.test(attr.lowerName)) {
        violations.push({
          rule: 'unsafe-html',
          file: filePath,
          line: lineNumberAt(html, attr.nameOffset),
          column: columnNumberAt(html, attr.nameOffset),
          message: `Inline event handler attribute "${attr.name}" is forbidden in generated HTML.`,
          snippet: attr.raw,
        });
      }

      // unsafe-html: srcdoc attribute
      if (attr.lowerName === 'srcdoc') {
        violations.push({
          rule: 'unsafe-html',
          file: filePath,
          line: lineNumberAt(html, attr.nameOffset),
          column: columnNumberAt(html, attr.nameOffset),
          message: 'Inline "srcdoc" attribute is forbidden in generated HTML.',
          snippet: attr.raw,
        });
      }

      // unsafe-html: <meta http-equiv="refresh">
      if (
        lowerTag === 'meta' &&
        attr.lowerName === 'http-equiv' &&
        attr.value.trim().toLowerCase() === 'refresh'
      ) {
        violations.push({
          rule: 'unsafe-html',
          file: filePath,
          line: lineNumberAt(html, attr.nameOffset),
          column: columnNumberAt(html, attr.nameOffset),
          message: '<meta http-equiv="refresh"> redirect is forbidden in generated HTML.',
          snippet: attr.raw,
        });
      }

      // unsafe-html: <base href="...">
      if (lowerTag === 'base' && attr.lowerName === 'href') {
        violations.push({
          rule: 'unsafe-html',
          file: filePath,
          line: lineNumberAt(html, attr.nameOffset),
          column: columnNumberAt(html, attr.nameOffset),
          message: '<base href="…"> is forbidden in self-contained generated HTML.',
          snippet: attr.raw,
        });
      }

      // unsafe-html: javascript: URLs and external subresource loads
      if (attr.hasValue && attr.value) {
        const normalizedUrl = normalizeUrlValueForSchemeCheck(attr.value);
        if (/^(?:javascript|vbscript):/i.test(normalizedUrl)) {
          violations.push({
            rule: 'unsafe-html',
            file: filePath,
            line: lineNumberAt(html, attr.nameOffset),
            column: columnNumberAt(html, attr.nameOffset),
            message: `Unsafe "javascript:" URL in "${attr.name}" attribute is forbidden in generated HTML.`,
            snippet: attr.raw,
          });
        } else if (
          EXTERNAL_SUBRESOURCE_TAGS.has(lowerTag) &&
          EXTERNAL_SUBRESOURCE_ATTRS.has(attr.lowerName)
        ) {
          const hasExternalOrigin =
            /^(?:https?:)?\/\//i.test(normalizedUrl) ||
            (attr.lowerName === 'srcset' && /(?:^|[\s,])(?:https?:)?\/\//i.test(attr.value));
          const isExternalStylesheetLink =
            lowerTag === 'link' &&
            attrs.some(
              (a) =>
                a.lowerName === 'rel' &&
                a.value.toLowerCase().split(/\s+/).includes('stylesheet'),
            );
          if (hasExternalOrigin || isExternalStylesheetLink) {
            violations.push({
              rule: 'unsafe-html',
              file: filePath,
              line: lineNumberAt(html, attr.nameOffset),
              column: columnNumberAt(html, attr.nameOffset),
              message: `External resource load <${lowerTag} ${attr.name}="${attr.value}"> is forbidden in self-contained generated HTML.`,
              snippet: attr.raw,
            });
          }
        }
      }

      // Inline style="..." attribute
      if (attr.lowerName === 'style' && attr.hasValue) {
        lintCssInHtml(attr.value, attr.valueOffset, html, filePath, violations, true);
      }

      // Presentation attributes stroke / fill / color
      if (
        (attr.lowerName === 'stroke' ||
          attr.lowerName === 'fill' ||
          attr.lowerName === 'color') &&
        attr.hasValue
      ) {
        if (/(?:--f-marker(?!-ink)|#ffd60a)/i.test(attr.value)) {
          violations.push({
            rule: 'marker-misuse',
            file: filePath,
            line: lineNumberAt(html, attr.nameOffset),
            column: columnNumberAt(html, attr.nameOffset),
            message: `Marker yellow cannot be used as an SVG/HTML "${attr.name}" attribute. Use <Tag>, <Badge>, or <Balloon>.`,
            snippet: attr.raw,
          });
        }
        const hexRe = /#[0-9a-fA-F]{3,8}\b/g;
        let hm;
        while ((hm = hexRe.exec(attr.value)) !== null) {
          const hex = hm[0];
          if (![4, 5, 7, 9].includes(hex.length)) continue;
          const before = attr.value.slice(Math.max(0, hm.index - 12), hm.index);
          if (/url\(\s*['"]?$/i.test(before)) continue;
          const absIdx = attr.valueOffset + hm.index;
          violations.push({
            rule: 'color-literal',
            file: filePath,
            line: lineNumberAt(html, absIdx),
            column: columnNumberAt(html, absIdx),
            message: `Hard-coded hex color "${hex}" is forbidden outside token files. Use a var(--f-*) token.`,
            snippet: hex,
          });
        }
        const fnRe = /\b(?:rgb|rgba|hsl|hsla|oklch|oklab)\s*\([^)]*\)/gi;
        while ((hm = fnRe.exec(attr.value)) !== null) {
          const absIdx = attr.valueOffset + hm.index;
          violations.push({
            rule: 'color-literal',
            file: filePath,
            line: lineNumberAt(html, absIdx),
            column: columnNumberAt(html, absIdx),
            message: `Hard-coded color function "${hm[0]}" is forbidden outside token files. Use a var(--f-*) token.`,
            snippet: hm[0],
          });
        }
      }
    }

    // Check class="..." attribute for Tailwind illegal-gutter or marker-misuse utilities
    let classTokens = [];
    if (classAttr && classAttr.hasValue) {
      classTokens = classAttr.value.split(/\s+/).filter(Boolean);
      for (const tok of classTokens) {
        if (/^gap-(?:x-|y-)?/.test(tok) && !LEGAL_TAILWIND_GAP_CLASSES.has(tok)) {
          const tokIdx = classAttr.value.indexOf(tok);
          const absIdx = classAttr.valueOffset + (tokIdx >= 0 ? tokIdx : 0);
          violations.push({
            rule: 'illegal-gutter',
            file: filePath,
            line: lineNumberAt(html, absIdx),
            column: columnNumberAt(html, absIdx),
            message: `Illegal Tailwind gutter class "${tok}". Use Scene gutter="pair|scene|change" or 12px/20px/32px tokens.`,
            snippet: tok,
          });
        }
        if (
          /^(?:text|border|stroke|fill|ring|outline)-(?:f-marker\b|\[[^\]]*(?:--f-marker(?!-ink)|#ffd60a)[^\]]*\])/.test(
            tok,
          )
        ) {
          const tokIdx = classAttr.value.indexOf(tok);
          const absIdx = classAttr.valueOffset + (tokIdx >= 0 ? tokIdx : 0);
          violations.push({
            rule: 'marker-misuse',
            file: filePath,
            line: lineNumberAt(html, absIdx),
            column: columnNumberAt(html, absIdx),
            message: `Marker yellow utility "${tok}" is forbidden. Marker yellow may only be used as a background paired with --f-marker-ink text.`,
            snippet: tok,
          });
        }
      }
    }

    // Handle <script> tags
    if (lowerTag === 'script') {
      const srcAttr = attrs.find((a) => a.lowerName === 'src');
      if (srcAttr) {
        violations.push({
          rule: 'unsafe-html',
          file: filePath,
          line: lineNumberAt(html, srcAttr.nameOffset),
          column: columnNumberAt(html, srcAttr.nameOffset),
          message: `External <script src="${srcAttr.value}"> is forbidden in generated HTML. Only inline <script> without src is allowed.`,
          snippet: srcAttr.raw,
        });
      }
      if (!selfClosing) {
        const closeScriptRe = /<\/\s*script\s*>/gi;
        closeScriptRe.lastIndex = tagEndOffset;
        const closeMatch = closeScriptRe.exec(html);
        i = closeMatch ? closeMatch.index + closeMatch[0].length : len;
      } else {
        i = tagEndOffset;
      }
      continue;
    }

    // Handle <style> tags
    if (lowerTag === 'style') {
      let styleContent = '';
      const contentStartOffset = tagEndOffset;
      if (!selfClosing) {
        const closeStyleRe = /<\/\s*style\s*>/gi;
        closeStyleRe.lastIndex = tagEndOffset;
        const closeMatch = closeStyleRe.exec(html);
        if (closeMatch) {
          styleContent = html.slice(contentStartOffset, closeMatch.index);
          i = closeMatch.index + closeMatch[0].length;
        } else {
          styleContent = html.slice(contentStartOffset);
          i = len;
        }
      } else {
        i = tagEndOffset;
      }

      const isExemptTokenStyle =
        hasDataF12Tokens || (idAttr && idAttr.hasValue && tokenStyleIds.has(idAttr.value));
      if (!isExemptTokenStyle && styleContent) {
        lintCssInHtml(styleContent, contentStartOffset, html, filePath, violations, false);
      }
      continue;
    }

    // Track data-cut and .f12-cut in DOM reading order
    let explicitDataCut = null;
    if (dataCutAttr && dataCutAttr.hasValue) {
      const val = dataCutAttr.value.trim();
      if (val !== '' && val.toLowerCase() !== 'auto') {
        explicitDataCut = val;
        pendingCuts.push({
          raw: val,
          line: lineNumberAt(html, dataCutAttr.nameOffset),
          column: columnNumberAt(html, dataCutAttr.nameOffset),
          snippet: dataCutAttr.raw,
          ignore: false,
        });
      }
    }

    const isCutBadge =
      !dataCutAttr && !hasDataAutocut && classTokens.includes('f12-cut');

    let ancestorWithDataCut = null;
    if (isCutBadge) {
      for (let s = openStack.length - 1; s >= 0; s--) {
        if (openStack[s].explicitDataCut) {
          ancestorWithDataCut = openStack[s];
          break;
        }
      }
    }

    let cutRecord = null;
    if (isCutBadge) {
      cutRecord = {
        raw: '',
        line: lineNumberAt(html, tagStartOffset),
        column: columnNumberAt(html, tagStartOffset),
        snippet: html.slice(tagStartOffset, tagEndOffset),
        ignore: false,
      };
      pendingCuts.push(cutRecord);
    }

    const isVoid = selfClosing || HTML_VOID_ELEMENTS.has(lowerTag);
    if (!isVoid) {
      openStack.push({
        tagName: lowerTag,
        tagStartOffset,
        explicitDataCut,
        consumedChildCut: false,
        isCutBadge,
        textBuffer: '',
        cutRecord,
        ancestorWithDataCut,
      });
    } else if (isCutBadge && cutRecord) {
      cutRecord.ignore = true;
    }

    i = tagEndOffset;
  }

  // Finalize any unclosed tags at EOF
  while (openStack.length > 0) {
    const popped = openStack.pop();
    finalizeElementOnClose(popped, len);
  }

  // Validate collected cut entries
  const validCutMatches = [];
  for (const c of pendingCuts) {
    if (c.ignore) continue;
    const parsed = /^C-(\d{2,})$/.exec(c.raw);
    if (!parsed) {
      violations.push({
        rule: 'cut-order',
        file: filePath,
        line: c.line,
        column: c.column,
        message: `Malformed cut label "${c.raw}". Cut numbers must use two-digit format "C-01", "C-02", etc.`,
        snippet: c.snippet,
      });
    } else {
      validCutMatches.push({
        raw: c.raw,
        num: parseInt(parsed[1], 10),
        line: c.line,
        column: c.column,
        snippet: c.snippet,
      });
    }
  }

  validateCutSequence(validCutMatches, filePath, violations);

  return violations;
}

/**
 * Recursively collects lintable files under the given paths.
 */
export function collectFiles(targetPaths) {
  const files = [];
  const walk = (p) => {
    if (!existsSync(p)) return;
    const st = statSync(p);
    if (st.isDirectory()) {
      const name = basename(p);
      if (IGNORED_DIRS.has(name)) return;
      for (const entry of readdirSync(p)) {
        walk(resolve(p, entry));
      }
    } else if (st.isFile() && CODE_EXTENSIONS.has(extname(p))) {
      files.push(p);
    }
  };
  for (const p of targetPaths) {
    walk(resolve(p));
  }
  return files.sort();
}

export function lintFiles(targetPaths) {
  const files = collectFiles(targetPaths);
  const allViolations = [];
  for (const f of files) {
    const content = readFileSync(f, 'utf8');
    const v = lintSource(content, f);
    allViolations.push(...v);
  }
  return { files, violations: allViolations };
}

export const lintDirectory = lintFiles;

/**
 * Runs the CLI checker and returns the exit code (0 on pass, 1 on violations or missing files).
 */
export function runCli(argv = process.argv.slice(2), cwd = process.cwd()) {
  const defaultTargets = [
    'registry/ui',
    'registry/hooks',
    'eval/screens',
    'site/src',
    'site/app',
  ].filter((p) => existsSync(resolve(cwd, p)));
  const rawTargets = argv.length > 0 ? argv : defaultTargets;
  const targets = rawTargets.map((p) => resolve(cwd, p));

  if (targets.length === 0) {
    console.error(
      'FAIL  check-frame12: No lintable files (.tsx, .ts, .jsx, .js, .css, .html) found. Pass one or more files or directories to check.',
    );
    return 1;
  }

  const { files, violations } = lintFiles(targets);

  if (files.length === 0) {
    console.error(
      'FAIL  check-frame12: No lintable files (.tsx, .ts, .jsx, .js, .css, .html) found. Pass one or more files or directories to check.',
    );
    return 1;
  }

  if (violations.length === 0) {
    console.log(`PASS  check-frame12: ${files.length} file(s) checked, 0 violations.`);
    return 0;
  }

  for (const v of violations) {
    const rel = relative(cwd, v.file) || v.file;
    console.error(`FAIL  [${v.rule}] ${rel}:${v.line} — ${v.message}`);
    if (v.snippet) {
      console.error(`      > ${v.snippet}`);
    }
  }
  console.error(`\n${violations.length} FRAME/12 violation(s) found across ${files.length} file(s).`);
  return 1;
}

function safeRealpath(p) {
  try {
    return realpathSync(p);
  } catch {
    return resolve(p);
  }
}

const isMain =
  process.argv[1] &&
  safeRealpath(fileURLToPath(import.meta.url)) === safeRealpath(process.argv[1]);

if (isMain) {
  process.exit(runCli());
}
