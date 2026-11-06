#!/usr/bin/env node
// Backward-compatibility audit (WP10): compares exported symbols, `*Props` members, heritage
// clauses and destructuring defaults in registry/ui + registry/hooks between a base git ref
// (default `v0.1.0`) and the working tree. Prints a JSON report; review `typeChanged` entries by
// hand (widenings are compatible, narrowings are breaking).
//
//   node scripts/check-api-compat.mjs [base-ref]
//   node scripts/check-api-compat.mjs --self-test
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

export function parse(src, name) {
  const sf = ts.createSourceFile(name, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const exports = new Set();
  const ifaces = new Map();
  const defaults = new Map();
  const norm = (t) => t.replace(/\s+/g, ' ').trim();

  function extractDefaults(fnNode, fnName) {
    const d = new Map();
    const pat = fnNode?.parameters?.[0]?.name;
    if (pat && ts.isObjectBindingPattern(pat)) {
      for (const el of pat.elements) {
        const prop = (el.propertyName || el.name).getText(sf);
        if (el.initializer) d.set(prop, norm(el.initializer.getText(sf)));
      }
    }
    defaults.set(fnName, d);
  }

  function unwrapCallback(expr) {
    let cur = expr;
    while (cur && ts.isParenthesizedExpression(cur)) cur = cur.expression;
    if (!cur) return null;
    if (ts.isFunctionExpression(cur) || ts.isArrowFunction(cur)) return cur;
    if (ts.isCallExpression(cur)) {
      for (const arg of cur.arguments) {
        const inner = unwrapCallback(arg);
        if (inner) return inner;
      }
    }
    return null;
  }

  const allIfaces = new Map();
  function visit(n) {
    const isExp = n.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (
      isExp &&
      (ts.isFunctionDeclaration(n) ||
        ts.isInterfaceDeclaration(n) ||
        ts.isTypeAliasDeclaration(n) ||
        ts.isClassDeclaration(n)) &&
      n.name
    ) {
      exports.add(n.name.text);
    }
    if (isExp && ts.isVariableStatement(n)) {
      for (const d of n.declarationList.declarations) {
        if (!ts.isIdentifier(d.name)) continue;
        exports.add(d.name.text);
        const fn = unwrapCallback(d.initializer);
        if (fn) extractDefaults(fn, d.name.text);
      }
    }
    if (ts.isExportDeclaration(n) && n.exportClause && ts.isNamedExports(n.exportClause)) {
      for (const e of n.exportClause.elements) exports.add(e.name.text);
    }
    if (ts.isInterfaceDeclaration(n)) {
      const m = new Map();
      for (const mem of n.members) {
        if (ts.isPropertySignature(mem) && mem.name) {
          m.set(mem.name.getText(sf).replace(/['"]/g, ''), {
            type: mem.type ? norm(mem.type.getText(sf)) : '?',
            optional: !!mem.questionToken,
          });
        }
      }
      allIfaces.set(n.name.text, {
        members: m,
        heritage: norm((n.heritageClauses || []).map((h) => h.getText(sf)).join(' ')),
      });
    }
    if (ts.isTypeAliasDeclaration(n)) {
      allIfaces.set(n.name.text, { alias: norm(n.type.getText(sf)) });
    }
    if (ts.isFunctionDeclaration(n) && n.name && isExp) {
      extractDefaults(n, n.name.text);
    }
    ts.forEachChild(n, visit);
  }
  visit(sf);
  for (const [name, val] of allIfaces) {
    if (exports.has(name)) ifaces.set(name, val);
  }
  return { exports, ifaces, defaults };
}

export function compareParsed(f, base, head, findings) {
  for (const e of base.exports) {
    if (!head.exports.has(e)) findings.removedExports.push(`${f}: ${e}`);
  }
  for (const [name, b] of base.ifaces) {
    const h = head.ifaces.get(name);
    if (!h) continue;
    if (b.alias !== undefined) {
      if (h.alias !== b.alias) {
        findings.aliasChanged.push(`${f}: ${name}: \`${b.alias}\` → \`${h.alias ?? '(interface)'}\``);
      }
      continue;
    }
    if (!h.members) {
      findings.aliasChanged.push(`${f}: ${name}: interface → type alias`);
      continue;
    }
    if (b.heritage !== h.heritage) {
      findings.heritageChanged.push(`${f}: ${name}: \`${b.heritage}\` → \`${h.heritage}\``);
    }
    for (const [prop, bm] of b.members) {
      const hm = h.members.get(prop);
      if (!hm) {
        findings.removedProps.push(`${f}: ${name}.${prop}`);
        continue;
      }
      if (bm.optional && !hm.optional) findings.newlyRequired.push(`${f}: ${name}.${prop}`);
      if (bm.type !== hm.type) {
        findings.typeChanged.push(`${f}: ${name}.${prop}: \`${bm.type}\` → \`${hm.type}\``);
      }
    }
    for (const [prop, hm] of h.members) {
      if (!b.members.has(prop) && !hm.optional) {
        findings.newlyRequired.push(`${f}: ${name}.${prop}`);
      }
    }
  }
  for (const [fn, bd] of base.defaults) {
    if (!head.exports.has(fn)) continue;
    const hd = head.defaults.get(fn) ?? new Map();
    for (const [prop, v] of bd) {
      if (hd.get(prop) !== v) {
        findings.defaultChanged.push(
          `${f}: ${fn}.${prop}: \`${v}\` → \`${hd.get(prop) ?? '(no initializer)'}\``,
        );
      }
    }
  }
}

function emptyFindings() {
  return {
    removedFiles: [],
    removedExports: [],
    removedProps: [],
    newlyRequired: [],
    typeChanged: [],
    heritageChanged: [],
    aliasChanged: [],
    defaultChanged: [],
  };
}

function runSelfTest() {
  const baseSrc = `
    import * as React from 'react';
    export interface WidgetProps {
      label?: string;
    }
    export const Widget = React.forwardRef<HTMLButtonElement, WidgetProps>(
      function Widget({ label = 'ok' }, ref) {
        return <button ref={ref}>{label}</button>;
      },
    );
  `;

  // 1. Newly added required property on existing interface -> flagged in newlyRequired
  const f1 = emptyFindings();
  compareParsed(
    'widget.tsx',
    parse(baseSrc, 'widget.tsx'),
    parse(
      `export interface WidgetProps { label?: string; requiredId: string; }
       export const Widget = ({ label = 'ok' }: WidgetProps) => null;`,
      'widget.tsx',
    ),
    f1,
  );
  assert.deepEqual(f1.newlyRequired, ['widget.tsx: WidgetProps.requiredId']);

  // 2. Newly added optional property -> compatible (0 newlyRequired)
  const f2 = emptyFindings();
  compareParsed(
    'widget.tsx',
    parse(baseSrc, 'widget.tsx'),
    parse(
      `export interface WidgetProps { label?: string; optionalId?: string; }
       export const Widget = ({ label = 'ok' }: WidgetProps) => null;`,
      'widget.tsx',
    ),
    f2,
  );
  assert.deepEqual(f2.newlyRequired, []);

  // 3. Existing optional property changed to required -> flagged in newlyRequired
  const f3 = emptyFindings();
  compareParsed(
    'widget.tsx',
    parse(baseSrc, 'widget.tsx'),
    parse(
      `export interface WidgetProps { label: string; }
       export const Widget = ({ label = 'ok' }: WidgetProps) => null;`,
      'widget.tsx',
    ),
    f3,
  );
  assert.deepEqual(f3.newlyRequired, ['widget.tsx: WidgetProps.label']);

  // 4. Default changed inside React.forwardRef callback -> reported in defaultChanged
  const f4 = emptyFindings();
  compareParsed(
    'widget.tsx',
    parse(baseSrc, 'widget.tsx'),
    parse(
      `import * as React from 'react';
       export interface WidgetProps { label?: string; }
       export const Widget = React.forwardRef<HTMLButtonElement, WidgetProps>(
         function Widget({ label = 'changed' }, ref) {
           return <button ref={ref}>{label}</button>;
         },
       );`,
      'widget.tsx',
    ),
    f4,
  );
  assert.deepEqual(f4.defaultChanged, ["widget.tsx: Widget.label: `'ok'` → `'changed'`"]);

  // 5. Destructured parameter replaced with plain `props` parameter -> reports removed default
  const f5 = emptyFindings();
  compareParsed(
    'widget.tsx',
    parse(baseSrc, 'widget.tsx'),
    parse(
      `import * as React from 'react';
       export interface WidgetProps { label?: string; }
       export const Widget = React.forwardRef<HTMLButtonElement, WidgetProps>(
         function Widget(props, ref) {
           return <button ref={ref}>{props.label}</button>;
         },
       );`,
      'widget.tsx',
    ),
    f5,
  );
  assert.deepEqual(f5.defaultChanged, ["widget.tsx: Widget.label: `'ok'` → `(no initializer)`"]);

  console.log(
    'PASS  check-api-compat self-test: required addition, optional addition, optional-to-required, forwardRef default changes, and removed destructured defaults verified.',
  );
}

if (process.argv[2] === '--self-test') {
  runSelfTest();
  process.exit(0);
}

const BASE = process.argv[2] || 'v0.1.0';
const root = execSync('git rev-parse --show-toplevel').toString().trim();
const baseFiles = execSync(`git ls-tree -r --name-only ${BASE} -- registry/ui registry/hooks`, {
  cwd: root,
})
  .toString()
  .trim()
  .split('\n')
  .filter((f) => /\.(tsx?|ts)$/.test(f));

const findings = emptyFindings();
for (const f of baseFiles) {
  const base = parse(execSync(`git show ${BASE}:${f}`, { cwd: root }).toString(), f);
  const p = path.join(root, f);
  if (!fs.existsSync(p)) {
    findings.removedFiles.push(f);
    continue;
  }
  const head = parse(fs.readFileSync(p, 'utf8'), f);
  compareParsed(f, base, head, findings);
}
console.log(JSON.stringify({ base: BASE, filesCompared: baseFiles.length, ...findings }, null, 2));
const breaking =
  findings.removedFiles.length +
  findings.removedExports.length +
  findings.removedProps.length +
  findings.newlyRequired.length;
if (breaking > 0) {
  console.error(`✗ ${breaking} breaking change(s) against ${BASE}`);
  process.exit(1);
}
