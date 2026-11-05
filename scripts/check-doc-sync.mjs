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

function getExportedPropsContracts(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  const sf = ts.createSourceFile(filePath, src, ts.ScriptTarget.Latest, true);
  const contracts = [];
  sf.forEachChild((node) => {
    const isExported = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (!isExported) return;

    if (ts.isInterfaceDeclaration(node) && node.name.text.endsWith('Props')) {
      const props = [];
      for (const m of node.members) {
        if (ts.isPropertySignature(m)) {
          props.push(m.name.getText(sf).replace(/['"]/g, ''));
        }
      }
      contracts.push({ name: node.name.text, kind: 'interface', props });
    } else if (ts.isTypeAliasDeclaration(node) && node.name.text.endsWith('Props')) {
      const props = [];
      if (ts.isTypeLiteralNode(node.type)) {
        for (const m of node.type.members) {
          if (ts.isPropertySignature(m)) {
            props.push(m.name.getText(sf).replace(/['"]/g, ''));
          }
        }
      }
      contracts.push({ name: node.name.text, kind: 'type', props });
    }
  });
  return contracts;
}

function getSkillSectionForSource(markdown, shortSource) {
  const escaped = shortSource.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const lines = markdown.split('\n');
  let startLine = -1;
  let startLevel = 0;

  for (let i = 0; i < lines.length; i++) {
    if (new RegExp(`\\(\`${escaped}\`\\)`).test(lines[i])) {
      startLine = i;
      const headingMatch = lines[i].match(/^(#{2,4})\s+/);
      startLevel = headingMatch ? headingMatch[1].length : 0;
      break;
    }
  }
  if (startLine === -1) return null;

  const sectionLines = [lines[startLine]];
  for (let i = startLine + 1; i < lines.length; i++) {
    const line = lines[i];
    if (startLevel > 0) {
      const h = line.match(/^(#{2,4})\s+/);
      if (h && h[1].length <= startLevel) break;
    } else {
      if (/^\d+\.\s+\*\*/.test(line) || /^#{2,4}\s+/.test(line) || /^---\s*$/.test(line)) {
        break;
      }
    }
    sectionLines.push(line);
  }
  return sectionLines.join('\n');
}

function sectionContainsIdentifier(sectionText, identifier) {
  const escaped = identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-zA-Z0-9_])${escaped}([^a-zA-Z0-9_]|$)`).test(sectionText);
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

  // Verify skill reference section and canonical TypeScript props across ALL exported *Props interfaces & type aliases
  const shortSource = entry.sourceFile.replace(/^registry\//, '');
  const skillSection = getSkillSectionForSource(skillRef, shortSource);
  if (!skillSection) {
    errors.push(
      `skills/frame12/references/components-and-adapters.md does not have a section for ${shortSource}`,
    );
  }

  if (entry.slug !== 'use-on-twos') {
    const contracts = getExportedPropsContracts(path.join(process.cwd(), entry.sourceFile));
    if (contracts.length === 0) {
      errors.push(`No exported *Props contracts found in ${entry.sourceFile}`);
    }
    const documentedProps = getExpandedCatalogPropNames(entry.props);
    for (const contract of contracts) {
      if (contract.kind === 'type' && contract.props.length === 0) {
        // Wrapper type alias (e.g., DropdownMenuContentProps): verify the contract alias is documented
        if (!documentedProps.has(contract.name)) {
          errors.push(
            `CATALOG[${entry.slug}] is missing exported type alias "${contract.name}" (${entry.sourceFile})`,
          );
        }
        if (skillSection && !sectionContainsIdentifier(skillSection, contract.name)) {
          errors.push(
            `skills/frame12/references/components-and-adapters.md (${shortSource}) is missing exported type alias "${contract.name}"`,
          );
        }
      }
      for (const propName of contract.props) {
        if (propName === 'children' || propName === 'className') continue;
        if (!documentedProps.has(propName)) {
          errors.push(
            `CATALOG[${entry.slug}] is missing TypeScript prop "${propName}" from ${contract.name} (${entry.sourceFile})`,
          );
        }
        if (skillSection && !sectionContainsIdentifier(skillSection, propName)) {
          errors.push(
            `skills/frame12/references/components-and-adapters.md (${shortSource}) is missing TypeScript prop "${propName}" from ${contract.name}`,
          );
        }
      }
    }
  }
}

// 4. Verify all Section 15.2 fields and canonical TypeScript prop sync for BLOCK_CATALOG
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
  const skillSection = getSkillSectionForSource(skillRef, shortSource);
  if (!skillSection) {
    errors.push(
      `skills/frame12/references/components-and-adapters.md does not have a section for ${shortSource}`,
    );
  }

  const contracts = getExportedPropsContracts(path.join(process.cwd(), block.sourceFile));
  if (contracts.length === 0) {
    errors.push(`No exported *Props contracts found in ${block.sourceFile}`);
  }
  const documentedProps = getExpandedCatalogPropNames(block.props);
  for (const contract of contracts) {
    for (const propName of contract.props) {
      if (propName === 'children') continue;
      if (!documentedProps.has(propName)) {
        errors.push(
          `BLOCK_CATALOG[${block.slug}] is missing TypeScript prop "${propName}" from ${contract.name} (${block.sourceFile})`,
        );
      }
      if (skillSection && !sectionContainsIdentifier(skillSection, propName)) {
        errors.push(
          `skills/frame12/references/components-and-adapters.md (${shortSource}) is missing TypeScript prop "${propName}" from ${contract.name}`,
        );
      }
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
