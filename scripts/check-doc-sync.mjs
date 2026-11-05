#!/usr/bin/env node
/**
 * Canonical TypeScript API <-> Documentation & Skill Synchronization Checker (WP9 §15.1 & §15.2)
 *
 * Parses exported TypeScript `*Props` interfaces in `registry/ui/*.tsx`, `registry/blocks/*.tsx`,
 * and `registry/hooks/use-on-twos.ts` and verifies 100% synchronization with:
 *   1. `site/src/lib/catalog.ts` (`CATALOG` and `BLOCK_CATALOG`)
 *   2. `skills/frame12/references/components-and-adapters.md`
 *   3. `site/public/r/*.json` registry manifests
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(path.join(process.cwd(), 'package.json'));
const ts = require('typescript');

const errors = [];

function loadCatalogModule() {
  const catalogPath = path.join(process.cwd(), 'site/src/lib/catalog.ts');
  const src = fs.readFileSync(catalogPath, 'utf8');
  const transpiled = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const mod = { exports: {} };
  const customRequire = (id) =>
    id === '@/lib/config' ? { REGISTRY_BASE_URL: 'https://frame12.dev/r' } : require(id);
  new Function('exports', 'require', 'module', transpiled)(mod.exports, customRequire, mod);
  return mod.exports;
}

function getExpandedCatalogPropNames(propsArray) {
  const set = new Set();
  for (const p of propsArray) {
    for (const part of p.name.split('/')) {
      const trimmed = part.trim();
      if (trimmed) set.add(trimmed);
    }
  }
  return set;
}

function getPrimaryInterfaceProps(filePath, expectedInterfaceName) {
  const src = fs.readFileSync(filePath, 'utf8');
  const sf = ts.createSourceFile(filePath, src, ts.ScriptTarget.Latest, true);
  const props = [];
  sf.forEachChild((node) => {
    if (
      ts.isInterfaceDeclaration(node) &&
      node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) &&
      node.name.text === expectedInterfaceName
    ) {
      for (const m of node.members) {
        if (ts.isPropertySignature(m)) {
          props.push(m.name.getText(sf).replace(/['"]/g, ''));
        }
      }
    }
  });
  return props;
}

const { CATALOG, BLOCK_CATALOG } = loadCatalogModule();
const skillRef = fs.readFileSync(
  path.join(process.cwd(), 'skills/frame12/references/components-and-adapters.md'),
  'utf8',
);

// 1. Verify every registry/ui/*.tsx file is in CATALOG
const uiFiles = fs
  .readdirSync(path.join(process.cwd(), 'registry/ui'))
  .filter((f) => f.endsWith('.tsx'))
  .sort();

for (const file of uiFiles) {
  const rel = `registry/ui/${file}`;
  if (!CATALOG.some((c) => c.sourceFile === rel)) {
    errors.push(`Missing CATALOG entry for ${rel}`);
  }
}

if (!CATALOG.some((c) => c.sourceFile === 'registry/hooks/use-on-twos.ts')) {
  errors.push('Missing CATALOG entry for registry/hooks/use-on-twos.ts');
}

// 2. Verify every registry/blocks/*.tsx file is in BLOCK_CATALOG
const blockFiles = fs
  .readdirSync(path.join(process.cwd(), 'registry/blocks'))
  .filter((f) => f.endsWith('.tsx'))
  .sort();

for (const file of blockFiles) {
  const rel = `registry/blocks/${file}`;
  if (!BLOCK_CATALOG.some((b) => b.sourceFile === rel)) {
    errors.push(`Missing BLOCK_CATALOG entry for ${rel}`);
  }
}

// 3. Verify all 13 Section 15.1 fields and canonical TypeScript prop sync for CATALOG
const PRIMARY_INTERFACE_OVERRIDES = {
  alert: 'AlertProps',
  'use-on-twos': null,
};

for (const entry of CATALOG) {
  const requiredStrings = [
    'slug',
    'title',
    'category',
    'summary',
    'registryUrl',
    'sourceFile',
    'stateBehavior',
    'themeBehavior',
    'responsiveBehavior',
    'usageTemplate',
  ];
  for (const field of requiredStrings) {
    if (typeof entry[field] !== 'string' || entry[field].trim().length === 0) {
      errors.push(`CATALOG[${entry.slug}] has empty or missing string field "${field}"`);
    }
  }
  const requiredArrays = [
    'whenToUse',
    'whenNotToUse',
    'props',
    'a11yNotes',
    'keyboardNotes',
    'grammarNotes',
    'commonErrors',
  ];
  for (const field of requiredArrays) {
    if (!Array.isArray(entry[field]) || entry[field].length === 0) {
      errors.push(`CATALOG[${entry.slug}] has empty or missing array field "${field}"`);
    }
  }

  // Verify sourceFile and registry manifest exist
  if (!fs.existsSync(path.join(process.cwd(), entry.sourceFile))) {
    errors.push(`CATALOG[${entry.slug}] sourceFile does not exist: ${entry.sourceFile}`);
  }
  const manifestPath = path.join(process.cwd(), `site/public/r/${entry.slug}.json`);
  if (!fs.existsSync(manifestPath)) {
    errors.push(`CATALOG[${entry.slug}] registry manifest missing: site/public/r/${entry.slug}.json`);
  }

  // Verify skill reference mentions the component sourceFile or title
  const shortSource = entry.sourceFile.replace(/^registry\//, '');
  if (!skillRef.includes(shortSource)) {
    errors.push(
      `skills/frame12/references/components-and-adapters.md does not reference ${shortSource}`,
    );
  }

  // Verify canonical TypeScript props
  const interfaceName =
    entry.slug in PRIMARY_INTERFACE_OVERRIDES
      ? PRIMARY_INTERFACE_OVERRIDES[entry.slug]
      : `${entry.title.replace(/\s+/g, '')}Props`;

  if (interfaceName) {
    const tsProps = getPrimaryInterfaceProps(
      path.join(process.cwd(), entry.sourceFile),
      interfaceName,
    );
    const documentedProps = getExpandedCatalogPropNames(entry.props);
    for (const propName of tsProps) {
      if (propName === 'children' || propName === 'className') continue;
      if (!documentedProps.has(propName)) {
        errors.push(
          `CATALOG[${entry.slug}] is missing TypeScript prop "${propName}" from ${interfaceName} (${entry.sourceFile})`,
        );
      }
    }
  }
}

// 4. Verify all Section 15.2 fields and canonical TypeScript prop sync for BLOCK_CATALOG
const BLOCK_INTERFACE_MAP = {
  'developer-console': 'DeveloperConsoleProps',
  'workspace-settings': 'WorkspaceSettingsProps',
  'analytics-dashboard': 'AnalyticsDashboardProps',
};

const catalogSlugSet = new Set(CATALOG.map((c) => c.slug));

for (const block of BLOCK_CATALOG) {
  const requiredStrings = [
    'slug',
    'title',
    'route',
    'registryUrl',
    'sourceFile',
    'summary',
    'usageTemplate',
  ];
  for (const field of requiredStrings) {
    if (typeof block[field] !== 'string' || block[field].trim().length === 0) {
      errors.push(`BLOCK_CATALOG[${block.slug}] has empty or missing string field "${field}"`);
    }
  }
  const requiredArrays = [
    'architectureNotes',
    'fixtureNotes',
    'componentDependencies',
    'props',
    'customizationGuidance',
    'a11yNotes',
    'knownLimitations',
  ];
  for (const field of requiredArrays) {
    if (!Array.isArray(block[field]) || block[field].length === 0) {
      errors.push(`BLOCK_CATALOG[${block.slug}] has empty or missing array field "${field}"`);
    }
  }

  for (const dep of block.componentDependencies) {
    if (!catalogSlugSet.has(dep)) {
      errors.push(`BLOCK_CATALOG[${block.slug}] lists unknown component dependency "${dep}"`);
    }
  }

  const manifestPath = path.join(process.cwd(), `site/public/r/${block.slug}.json`);
  if (!fs.existsSync(manifestPath)) {
    errors.push(
      `BLOCK_CATALOG[${block.slug}] registry manifest missing: site/public/r/${block.slug}.json`,
    );
  }

  const shortSource = block.sourceFile.replace(/^registry\//, '');
  if (!skillRef.includes(shortSource)) {
    errors.push(
      `skills/frame12/references/components-and-adapters.md does not reference ${shortSource}`,
    );
  }

  const interfaceName = BLOCK_INTERFACE_MAP[block.slug];
  const tsProps = getPrimaryInterfaceProps(
    path.join(process.cwd(), block.sourceFile),
    interfaceName,
  );
  const documentedProps = getExpandedCatalogPropNames(block.props);
  for (const propName of tsProps) {
    if (propName === 'children') continue;
    if (!documentedProps.has(propName)) {
      errors.push(
        `BLOCK_CATALOG[${block.slug}] is missing TypeScript prop "${propName}" from ${interfaceName} (${block.sourceFile})`,
      );
    }
  }
}

if (errors.length > 0) {
  console.error('check-doc-sync failed with', errors.length, 'issue(s):');
  for (const err of errors) {
    console.error('  -', err);
  }
  process.exit(1);
}

console.log(
  `check-doc-sync passed: ${CATALOG.length} components and ${BLOCK_CATALOG.length} application blocks synchronized with canonical TypeScript definitions and skill references.`,
);
