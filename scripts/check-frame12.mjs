#!/usr/bin/env node
// Automated design-grammar checker for FRAME/12.
// Enforces:
//   1. color-literal      — No hard-coded hex/rgb/hsl colors or font stacks outside token files
//   2. illegal-gutter     — Only 12px (pair), 20px (scene), and 32px (change) gutters
//   3. marker-misuse      — --f-marker / #ffd60a only as background paired with --f-marker-ink
//   4. cut-order          — Sequential C-01, C-02, C-03... in DOM/reading order without gaps or duplicates
//   5. raw-shadcn-import  — No raw @/components/ui/*, @radix-ui/*, or external chart/animation imports

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { resolve, relative, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const CODE_EXTENSIONS = new Set(['.tsx', '.ts', '.jsx', '.js', '.css']);
const TOKEN_BASENAMES = new Set(['frame12.css', 'frame12-tailwind.css', 'og-image.tsx']);
const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', '.next', '.f12-run', 'test-results']);

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

const FORBIDDEN_SHADCN_MODULES = new Set([
  'button',
  'input',
  'badge',
  'tag',
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

const FORBIDDEN_EXTERNAL_PACKAGES = new Set([
  'recharts',
  'chart.js',
  'react-chartjs-2',
  'd3',
  'framer-motion',
  'gsap',
]);

/**
 * Replaces JS/CSS comments with spaces while preserving newlines so line numbers stay accurate.
 */
function stripCommentsPreservingLines(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (match) => ' '.repeat(match.length));
}

function lineNumberAt(src, index) {
  let line = 1;
  for (let i = 0; i < index && i < src.length; i++) {
    if (src.charCodeAt(i) === 10) line++;
  }
  return line;
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
 * Lints a single source string and returns an array of violation objects:
 * { rule, file, line, message, snippet }
 */
export function lintSource(content, filePath = 'input.tsx') {
  const violations = [];
  const base = basename(filePath);
  const ext = extname(filePath);
  if (!CODE_EXTENSIONS.has(ext)) return violations;

  const isTokenFile = TOKEN_BASENAMES.has(base);
  const normalizedPath = filePath.replace(/\\/g, '/');
  const isRegistryImplementation =
    normalizedPath.includes('/registry/ui/') ||
    normalizedPath.startsWith('registry/ui/') ||
    normalizedPath.includes('/registry/hooks/') ||
    normalizedPath.startsWith('registry/hooks/');

  const stripped = stripCommentsPreservingLines(content);

  // =========================================================================
  // 1. color-literal (Hard-coded colors & font stacks outside token files)
  // =========================================================================
  if (!isTokenFile) {
    let colorScan = stripped;
    if (base === 'tone-area-chart.tsx') {
      colorScan = colorScan.replace(
        /stopColor="#fff"/g,
        (m) => ' '.repeat(m.length),
      );
    }

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
        message: `Hard-coded color function "${m[0]}" is forbidden outside token files. Use a var(--f-*) token.`,
        snippet: m[0],
      });
    }

    // Hard-coded font names
    const fontRegex = /\b(?:Dela Gothic One|Zen Kaku Gothic New|M PLUS 1 Code)\b/g;
    while ((m = fontRegex.exec(colorScan)) !== null) {
      violations.push({
        rule: 'color-literal',
        file: filePath,
        line: lineNumberAt(content, m.index),
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
    const sceneGutterStrRegex = /<Scene\b[^>]*?\bgutter\s*=\s*(?:['"]([^'"]*)['"]|\{\s*['"`]([^'"`]*)['"`]\s*\})/g;
    while ((m = sceneGutterStrRegex.exec(stripped)) !== null) {
      const val = m[1] ?? m[2] ?? '';
      if (!LEGAL_GUTTER_NAMES.has(val)) {
        violations.push({
          rule: 'illegal-gutter',
          file: filePath,
          line: lineNumberAt(content, m.index),
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
        message: `Invalid numeric Scene gutter "{${m[1]}}". Must be "pair" (12px), "scene" (20px), or "change" (32px).`,
        snippet: m[0],
      });
    }

    // 2b. Inline style object or CSS gap / rowGap / columnGap / gridGap
    if (ext === '.css') {
      const cssGapRegex = /\b(?:gap|grid-gap|row-gap|column-gap)\s*:\s*([^;}\n]+)/gi;
      while ((m = cssGapRegex.exec(stripped)) !== null) {
        const val = m[1].trim();
        if (!isLegalGapValue(val)) {
          violations.push({
            rule: 'illegal-gutter',
            file: filePath,
            line: lineNumberAt(content, m.index),
            message: `Illegal CSS gutter "${m[0].trim()}". Only 12px (pair), 20px (scene), or 32px (change) are allowed.`,
            snippet: m[0].trim(),
          });
        }
      }
    } else {
      // JSX inline style object: gap: '16px', gap: 16, rowGap: '24px', columnGap: 8
      const jsxGapRegex = /\b(?:gap|gridGap|rowGap|columnGap)\s*:\s*(?:(['"`])([^'"`]*)\1|(-?\d+(?:\.\d+)?)\b)/g;
      while ((m = jsxGapRegex.exec(stripped)) !== null) {
        const raw = m[2] !== undefined ? m[2] : m[3];
        if (!isLegalGapValue(raw)) {
          violations.push({
            rule: 'illegal-gutter',
            file: filePath,
            line: lineNumberAt(content, m.index),
            message: `Illegal inline gutter "${m[0].trim()}". Use 12px (var(--f-gutter-pair)), 20px (var(--f-gutter-scene)), or 32px (var(--f-gutter-change)).`,
            snippet: m[0].trim(),
          });
        }
      }

      // 2c. Tailwind gap-* classes in className
      const classAttrRegex = /\bclassName\s*=\s*(?:['"]([^'"]*)['"]|\{\s*['"`]([^'"`]*)['"`]\s*\})/g;
      while ((m = classAttrRegex.exec(stripped)) !== null) {
        const clsStr = m[1] ?? m[2] ?? '';
        const tokens = clsStr.split(/\s+/).filter(Boolean);
        for (const tok of tokens) {
          if (/^gap-(?:x-|y-)?/.test(tok) && !LEGAL_TAILWIND_GAP_CLASSES.has(tok)) {
            violations.push({
              rule: 'illegal-gutter',
              file: filePath,
              line: lineNumberAt(content, m.index),
              message: `Illegal Tailwind gutter class "${tok}". Use Scene gutter="pair|scene|change" or 12px/20px/32px tokens.`,
              snippet: tok,
            });
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
      if (/--f-marker-ink\b/.test(val) && !/--f-marker(?!-ink)\b/i.test(val) && !/#ffd60a\b/i.test(val)) {
        continue;
      }
      violations.push({
        rule: 'marker-misuse',
        file: filePath,
        line: lineNumberAt(content, m.index),
        message: `Marker yellow (--f-marker / #ffd60a) cannot be used on "${prop}". It may only be a background under --f-marker-ink text.`,
        snippet: m[0].trim(),
      });
    }

    // 3b. SVG JSX attributes stroke="var(--f-marker)" or fill="var(--f-marker)"
    const svgMarkerAttrRegex = /\b(stroke|fill|color)\s*=\s*['"][^'"]*(?:--f-marker(?!-ink)|#ffd60a)[^'"]*['"]/gi;
    while ((m = svgMarkerAttrRegex.exec(stripped)) !== null) {
      violations.push({
        rule: 'marker-misuse',
        file: filePath,
        line: lineNumberAt(content, m.index),
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
  // 4. cut-order (Sequential C-01, C-02, C-03... in DOM order without gaps/dups)
  // =========================================================================
  if (ext !== '.css') {
    const cutMatches = [];
    // Match JSX attributes cut="...", topCut="...", bottomCut="..." or object properties cut: '...'
    const cutPropRegex =
      /\b(?:cut|topCut|bottomCut)\s*(?:=\s*(?:['"]([^'"]+)['"]|\{\s*['"`]([^'"`]+)['"`]\s*\})|:\s*['"`]([^'"`]+)['"`])/g;
    let m;
    while ((m = cutPropRegex.exec(stripped)) !== null) {
      const rawCut = m[1] ?? m[2] ?? m[3] ?? '';
      const line = lineNumberAt(content, m.index);
      const parsed = rawCut.match(/^C-(\d{2,})$/);
      if (!parsed) {
        violations.push({
          rule: 'cut-order',
          file: filePath,
          line,
          message: `Malformed cut label "${rawCut}". Cut numbers must use two-digit format "C-01", "C-02", etc.`,
          snippet: m[0],
        });
      } else {
        cutMatches.push({
          raw: rawCut,
          num: parseInt(parsed[1], 10),
          line,
          snippet: m[0],
        });
      }
    }

    if (cutMatches.length > 0) {
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
            message: `First cut in file is "${cur.raw}", but cuts must start at "C-01".`,
            snippet: cur.snippet,
          });
        } else if (seen.has(cur.num)) {
          violations.push({
            rule: 'cut-order',
            file: filePath,
            line: cur.line,
            message: `Duplicate cut number "${cur.raw}". Expected "${expectedLabel}" in reading/DOM order.`,
            snippet: cur.snippet,
          });
        } else if (cur.num !== expectedNum) {
          const prevLabel = i > 0 ? cutMatches[i - 1].raw : 'start';
          violations.push({
            rule: 'cut-order',
            file: filePath,
            line: cur.line,
            message: `Out-of-order or skipped cut "${cur.raw}" after "${prevLabel}". Expected sequential "${expectedLabel}".`,
            snippet: cur.snippet,
          });
        }
        seen.add(cur.num);
      }
    }
  }

  // =========================================================================
  // 5. raw-shadcn-import (Forbidden raw @/components/ui/*, @radix-ui/*, or charting libs)
  // =========================================================================
  if (ext !== '.css' && !isRegistryImplementation) {
    const importRegex = /\b(?:import|export)\b[\s\S]*?\bfrom\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    let m;
    while ((m = importRegex.exec(stripped)) !== null) {
      const spec = m[1] ?? m[2] ?? '';
      const line = lineNumberAt(content, m.index);

      if (spec.startsWith('@radix-ui/')) {
        violations.push({
          rule: 'raw-shadcn-import',
          file: filePath,
          line,
          message: `Raw Radix primitive import "${spec}" is forbidden. Import the FRAME/12 adapter from "@frame12/registry".`,
          snippet: m[0].trim(),
        });
        continue;
      }

      if (FORBIDDEN_EXTERNAL_PACKAGES.has(spec)) {
        violations.push({
          rule: 'raw-shadcn-import',
          file: filePath,
          line,
          message: `External library "${spec}" is forbidden in FRAME/12. Use ToneAreaChart, ToneBarList, ToneSpark, and useOnTwos from "@frame12/registry".`,
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
            message: `Raw shadcn import "${spec}" is forbidden where a FRAME/12 component or adapter exists. Import from "@frame12/registry".`,
            snippet: m[0].trim(),
          });
        }
      }
    }
  }

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

// CLI execution when invoked directly
const isMain =
  process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1]);

if (isMain) {
  const cwd = process.cwd();
  const cliArgs = process.argv.slice(2);
  const defaultTargets = ['registry/ui', 'registry/hooks', 'eval/screens', 'site/src', 'site/app'].filter((p) =>
    existsSync(resolve(cwd, p)),
  );
  const targets = cliArgs.length > 0 ? cliArgs : defaultTargets;

  const { files, violations } = lintFiles(targets);

  if (violations.length === 0) {
    console.log(`PASS  check-frame12: ${files.length} file(s) checked, 0 violations.`);
    process.exit(0);
  } else {
    for (const v of violations) {
      const rel = relative(cwd, v.file) || v.file;
      console.error(`FAIL  [${v.rule}] ${rel}:${v.line} — ${v.message}`);
      if (v.snippet) {
        console.error(`      > ${v.snippet}`);
      }
    }
    console.error(`\n${violations.length} FRAME/12 violation(s) found across ${files.length} file(s).`);
    process.exit(1);
  }
}
