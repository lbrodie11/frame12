#!/usr/bin/env node
// Backward-compatibility audit (WP10): compares exported symbols, `*Props` members, heritage
// clauses and destructuring defaults in registry/ui + registry/hooks between a base git ref
// (default `v0.1.0`) and the working tree. Prints a JSON report; review `typeChanged` entries by
// hand (widenings are compatible, narrowings are breaking).
//
//   node scripts/check-api-compat.mjs [base-ref]
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const BASE = process.argv[2] || 'v0.1.0';
const root = execSync('git rev-parse --show-toplevel').toString().trim();
const baseFiles = execSync(`git ls-tree -r --name-only ${BASE} -- registry/ui registry/hooks`, { cwd: root })
  .toString().trim().split('\n').filter((f) => /\.(tsx?|ts)$/.test(f));

function parse(src, name) {
  const sf = ts.createSourceFile(name, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const exports = new Set();
  const ifaces = new Map();
  const defaults = new Map();
  const norm = (t) => t.replace(/\s+/g, ' ').trim();
  function visit(n) {
    const isExp = n.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (isExp && (ts.isFunctionDeclaration(n) || ts.isInterfaceDeclaration(n) || ts.isTypeAliasDeclaration(n) || ts.isClassDeclaration(n)) && n.name) exports.add(n.name.text);
    if (isExp && ts.isVariableStatement(n)) for (const d of n.declarationList.declarations) if (ts.isIdentifier(d.name)) exports.add(d.name.text);
    if (ts.isExportDeclaration(n) && n.exportClause && ts.isNamedExports(n.exportClause)) for (const e of n.exportClause.elements) exports.add(e.name.text);
    if (ts.isInterfaceDeclaration(n)) {
      const m = new Map();
      for (const mem of n.members) if (ts.isPropertySignature(mem) && mem.name) m.set(mem.name.getText(sf).replace(/['"]/g, ''), { type: mem.type ? norm(mem.type.getText(sf)) : '?', optional: !!mem.questionToken });
      ifaces.set(n.name.text, { members: m, heritage: norm((n.heritageClauses || []).map((h) => h.getText(sf)).join(' ')) });
    }
    if (ts.isTypeAliasDeclaration(n)) ifaces.set(n.name.text, { alias: norm(n.type.getText(sf)) });
    if (ts.isFunctionDeclaration(n) && n.name && isExp && n.parameters[0] && ts.isObjectBindingPattern(n.parameters[0].name)) {
      const d = new Map();
      for (const el of n.parameters[0].name.elements) {
        const prop = (el.propertyName || el.name).getText(sf);
        if (el.initializer) d.set(prop, norm(el.initializer.getText(sf)));
      }
      defaults.set(n.name.text, d);
    }
    ts.forEachChild(n, visit);
  }
  visit(sf);
  return { exports, ifaces, defaults };
}

const findings = { removedFiles: [], removedExports: [], removedProps: [], newlyRequired: [], typeChanged: [], heritageChanged: [], aliasChanged: [], defaultChanged: [] };
for (const f of baseFiles) {
  const base = parse(execSync(`git show ${BASE}:${f}`, { cwd: root }).toString(), f);
  const p = path.join(root, f);
  if (!fs.existsSync(p)) { findings.removedFiles.push(f); continue; }
  const head = parse(fs.readFileSync(p, 'utf8'), f);
  for (const e of base.exports) if (!head.exports.has(e)) findings.removedExports.push(`${f}: ${e}`);
  for (const [name, b] of base.ifaces) {
    const h = head.ifaces.get(name);
    if (!h) continue;
    if (b.alias !== undefined) { if (h.alias !== b.alias) findings.aliasChanged.push(`${f}: ${name}: \`${b.alias}\` → \`${h.alias ?? '(interface)'}\``); continue; }
    if (!h.members) { findings.aliasChanged.push(`${f}: ${name}: interface → type alias`); continue; }
    if (b.heritage !== h.heritage) findings.heritageChanged.push(`${f}: ${name}: \`${b.heritage}\` → \`${h.heritage}\``);
    for (const [prop, bm] of b.members) {
      const hm = h.members.get(prop);
      if (!hm) { findings.removedProps.push(`${f}: ${name}.${prop}`); continue; }
      if (bm.optional && !hm.optional) findings.newlyRequired.push(`${f}: ${name}.${prop}`);
      if (bm.type !== hm.type) findings.typeChanged.push(`${f}: ${name}.${prop}: \`${bm.type}\` → \`${hm.type}\``);
    }
  }
  for (const [fn, bd] of base.defaults) {
    const hd = head.defaults.get(fn);
    if (!hd) continue;
    for (const [prop, v] of bd) if (hd.get(prop) !== v) findings.defaultChanged.push(`${f}: ${fn}.${prop}: \`${v}\` → \`${hd.get(prop) ?? '(no initializer)'}\``);
  }
}
console.log(JSON.stringify({ base: BASE, filesCompared: baseFiles.length, ...findings }, null, 2));
const breaking =
  findings.removedFiles.length + findings.removedExports.length + findings.removedProps.length + findings.newlyRequired.length;
if (breaking > 0) {
  console.error(`✗ ${breaking} breaking change(s) against ${BASE}`);
  process.exit(1);
}
