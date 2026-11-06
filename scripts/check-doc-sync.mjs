#!/usr/bin/env node
/**
 * Canonical TypeScript API <-> Documentation & Skill Synchronization Checker (WP9 §15.1 & §15.2)
 *
 * Parses exported TypeScript `*Props` interfaces and type aliases in `registry/ui/*.tsx`,
 * `registry/blocks/*.tsx`, and `registry/hooks/use-on-twos.ts` and verifies synchronization with:
 *   1. `site/src/lib/catalog.ts` (`CATALOG` and `BLOCK_CATALOG` — 1-row-per-prop, types, defaults, subcomponents)
 *   2. `skills/frame12/references/components-and-adapters.md` (fenced TypeScript AST contract parity)
 *   3. `site/public/r/*.json` registry manifests
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(path.join(process.cwd(), 'package.json'));
const ts = require('typescript');

const errors = [];

const PRIMARY_INTERFACE_BY_SLUG = {
  sheet: 'SheetProps',
  scene: 'SceneProps',
  panel: 'PanelProps',
  'panel-pair': 'PanelPairProps',
  'segmented-control': 'SegmentedControlProps',
  button: 'ButtonProps',
  input: 'InputProps',
  field: 'FieldProps',
  textarea: 'TextareaProps',
  checkbox: 'CheckboxProps',
  'radio-group': 'RadioGroupProps',
  switch: 'SwitchProps',
  tabs: 'TabsProps',
  badge: 'BadgeProps',
  tag: 'TagProps',
  alert: 'AlertProps',
  toast: 'ToastProps',
  skeleton: 'SkeletonProps',
  'empty-state': 'EmptyStateProps',
  breadcrumb: 'BreadcrumbProps',
  pagination: 'PaginationProps',
  metric: 'MetricProps',
  'tone-area-chart': 'ToneAreaChartProps',
  'tone-bar-list': 'ToneBarListProps',
  'tone-spark': 'ToneSparkProps',
  balloon: 'BalloonProps',
  dialog: 'DialogProps',
  select: 'SelectProps',
  tooltip: 'TooltipProps',
  'dropdown-menu': 'DropdownMenuTriggerProps',
  table: 'TableProps',
  'developer-console': 'DeveloperConsoleProps',
  'workspace-settings': 'WorkspaceSettingsProps',
  'analytics-dashboard': 'AnalyticsDashboardProps',
};

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

function parseSourceFileContracts(filePath, codeOverride) {
  const src = codeOverride ?? fs.readFileSync(filePath, 'utf8');
  const sf = ts.createSourceFile(
    filePath,
    src,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const contracts = new Map();
  const typeAliases = new Map();
  const defaults = new Map();

  function visit(node) {
    if (ts.isTypeAliasDeclaration(node)) {
      const isExported = Boolean(
        node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword),
      );
      const rawType = node.type.getText(sf).replace(/\s+/g, ' ').trim();
      typeAliases.set(node.name.text, { exported: isExported, type: rawType });
      if (isExported && node.name.text.endsWith('Props')) {
        contracts.set(node.name.text, {
          name: node.name.text,
          kind: 'type',
          type: rawType,
          props: new Map(),
        });
      }
    } else if (ts.isInterfaceDeclaration(node)) {
      const isExported = Boolean(
        node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword),
      );
      if (isExported && node.name.text.endsWith('Props')) {
        const props = new Map();
        for (const m of node.members) {
          if (ts.isPropertySignature(m) && m.name) {
            const propName = m.name.getText(sf).replace(/^['"]|['"]$/g, '');
            const propType = m.type ? m.type.getText(sf).replace(/\s+/g, ' ').trim() : 'unknown';
            const optional = Boolean(m.questionToken);
            props.set(propName, { name: propName, type: propType, optional });
          }
        }
        contracts.set(node.name.text, {
          name: node.name.text,
          kind: 'interface',
          props,
        });
      }
    }
    if (ts.isObjectBindingPattern(node)) {
      for (const el of node.elements) {
        if (el.initializer) {
          const propName = (el.propertyName || el.name)
            .getText(sf)
            .replace(/^['"]|['"]$/g, '');
          if (!defaults.has(propName)) {
            defaults.set(propName, el.initializer.getText(sf).trim());
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  return { contracts, typeAliases, defaults };
}

function getAllowedTypesForProp(rawType, typeAliases) {
  const allowed = new Set([rawType]);
  if (typeAliases.has(rawType)) {
    const aliasType = typeAliases.get(rawType).type;
    allowed.add(aliasType);
    if (typeAliases.has(aliasType)) {
      allowed.add(typeAliases.get(aliasType).type);
    }
  }
  if (
    rawType === 'SemanticStatus' ||
    rawType === 'BadgeStatus' ||
    rawType === 'AlertStatus' ||
    rawType === 'ToastStatus'
  ) {
    allowed.add("'neutral' | 'info' | 'success' | 'warning' | 'danger'");
  }
  return allowed;
}

function validateCatalogEntryPropsAndSubcomponents(entry, labelPrefix) {
  if (entry.slug === 'use-on-twos') return;

  // 1. Enforce 1-row-per-prop (no slash-joined prop names or *Props type names in props table)
  const documentedPropsByName = new Map();
  for (const p of entry.props) {
    if (p.name.includes('/')) {
      errors.push(
        `${labelPrefix}[${entry.slug}] contains slash-joined prop row "${p.name}". Use one row per prop.`,
      );
    }
    if (/^[A-Z].*Props$/.test(p.name)) {
      errors.push(
        `${labelPrefix}[${entry.slug}] lists type name "${p.name}" in props[]. Put subcomponent contracts in subcomponents[].`,
      );
    }
    documentedPropsByName.set(p.name, p);
  }

  const fullPath = path.join(process.cwd(), entry.sourceFile);
  if (!fs.existsSync(fullPath)) return;
  const { contracts, typeAliases, defaults } = parseSourceFileContracts(fullPath);

  const primaryName = PRIMARY_INTERFACE_BY_SLUG[entry.slug];
  const primaryContract = contracts.get(primaryName);
  if (!primaryContract) {
    errors.push(
      `${labelPrefix}[${entry.slug}] could not find primary interface "${primaryName}" in ${entry.sourceFile}`,
    );
    return;
  }

  // 2. Verify every source prop on primary interface is documented with matching type & default
  for (const [propName, propMeta] of primaryContract.props) {
    if (propName === 'children' || propName === 'className') continue;
    const docProp = documentedPropsByName.get(propName);
    if (!docProp) {
      errors.push(
        `${labelPrefix}[${entry.slug}] is missing prop "${propName}" from ${primaryName} (${entry.sourceFile})`,
      );
      continue;
    }
    const allowedTypes = getAllowedTypesForProp(propMeta.type, typeAliases);
    if (!allowedTypes.has(docProp.type)) {
      errors.push(
        `${labelPrefix}[${entry.slug}].props["${propName}"] type mismatch: documented "${docProp.type}", source has "${propMeta.type}"`,
      );
    }
    if (defaults.has(propName)) {
      const srcDefault = defaults.get(propName);
      if (docProp.defaultValue !== srcDefault && !docProp.defaultValue.startsWith(srcDefault)) {
        errors.push(
          `${labelPrefix}[${entry.slug}].props["${propName}"] default mismatch: documented "${docProp.defaultValue}", source destructuring has "${srcDefault}"`,
        );
      }
    }
  }

  // 3. Reject extra/unknown props in entry.props that do not exist on primaryContract
  for (const [docPropName] of documentedPropsByName) {
    if (!primaryContract.props.has(docPropName)) {
      errors.push(
        `${labelPrefix}[${entry.slug}] documents prop "${docPropName}" which does not exist on ${primaryName} (${entry.sourceFile})`,
      );
    }
  }

  // 4. Verify all secondary exported *Props contracts in the source file appear in entry.subcomponents
  const subPropTypes = new Set((entry.subcomponents ?? []).map((s) => s.propsType));
  for (const [contractName] of contracts) {
    if (contractName === primaryName) continue;
    if (!subPropTypes.has(contractName)) {
      errors.push(
        `${labelPrefix}[${entry.slug}].subcomponents is missing exported contract "${contractName}" (${entry.sourceFile})`,
      );
    }
  }
}

const { CATALOG, BLOCK_CATALOG } = loadCatalogModule();
const skillRefPath = path.join(
  process.cwd(),
  'skills/frame12/references/components-and-adapters.md',
);
const skillRef = fs.readFileSync(skillRefPath, 'utf8');
const skillTsxBlocks = [...skillRef.matchAll(/```tsx\n([\s\S]*?)```/g)]
  .map((m) => m[1])
  .join('\n\n');
const skillParsed = parseSourceFileContracts(skillRefPath, skillTsxBlocks);

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

// 3. Verify all CATALOG entries
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

  if (!fs.existsSync(path.join(process.cwd(), entry.sourceFile))) {
    errors.push(`CATALOG[${entry.slug}] sourceFile does not exist: ${entry.sourceFile}`);
  }
  const manifestPath = path.join(process.cwd(), `site/public/r/${entry.slug}.json`);
  if (!fs.existsSync(manifestPath)) {
    errors.push(
      `CATALOG[${entry.slug}] registry manifest missing: site/public/r/${entry.slug}.json`,
    );
  }

  validateCatalogEntryPropsAndSubcomponents(entry, 'CATALOG');
}

// 4. Verify all BLOCK_CATALOG entries
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

  validateCatalogEntryPropsAndSubcomponents(block, 'BLOCK_CATALOG');
}

// 5. Verify AST-level contract parity between registry/{ui,blocks}/*.tsx and skills/frame12/references/components-and-adapters.md
const allSourceFiles = [
  ...uiFiles.map((f) => `registry/ui/${f}`),
  ...blockFiles.map((f) => `registry/blocks/${f}`),
];

let totalContractsChecked = 0;
for (const relPath of allSourceFiles) {
  const fullPath = path.join(process.cwd(), relPath);
  const { contracts } = parseSourceFileContracts(fullPath);
  for (const [contractName, srcContract] of contracts) {
    totalContractsChecked++;
    const docContract = skillParsed.contracts.get(contractName);
    if (!docContract) {
      errors.push(
        `skills/frame12/references/components-and-adapters.md is missing exported TypeScript contract "${contractName}" (${relPath})`,
      );
      continue;
    }
    if (srcContract.kind !== docContract.kind) {
      errors.push(
        `skills/frame12/references/components-and-adapters.md contract "${contractName}" kind mismatch: expected ${srcContract.kind}, got ${docContract.kind}`,
      );
      continue;
    }
    if (srcContract.kind === 'interface') {
      for (const [propName, srcProp] of srcContract.props) {
        if (propName === 'children' || propName === 'className') continue;
        const docProp = docContract.props.get(propName);
        if (!docProp) {
          errors.push(
            `skills/frame12/references/components-and-adapters.md contract "${contractName}" is missing property "${propName}" (${relPath})`,
          );
        } else {
          if (docProp.optional !== srcProp.optional) {
            errors.push(
              `skills/frame12/references/components-and-adapters.md contract "${contractName}.${propName}" optionality mismatch: expected optional=${srcProp.optional}, got optional=${docProp.optional}`,
            );
          }
          if (docProp.type !== srcProp.type) {
            errors.push(
              `skills/frame12/references/components-and-adapters.md contract "${contractName}.${propName}" type mismatch: expected "${srcProp.type}", got "${docProp.type}"`,
            );
          }
        }
      }
      for (const [docPropName] of docContract.props) {
        if (docPropName === 'children' || docPropName === 'className') continue;
        if (!srcContract.props.has(docPropName)) {
          errors.push(
            `skills/frame12/references/components-and-adapters.md contract "${contractName}" documents unsupported extra property "${docPropName}" not in ${relPath}`,
          );
        }
      }
    } else if (srcContract.type !== docContract.type) {
      errors.push(
        `skills/frame12/references/components-and-adapters.md type alias "${contractName}" mismatch: expected "${srcContract.type}", got "${docContract.type}"`,
      );
    }
  }
}

if (errors.length > 0) {
  console.error(`✗ Documentation synchronization check failed (${errors.length} error(s)):`);
  for (const err of errors) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
}

console.log(
  `✓ Documentation synchronization check passed (${CATALOG.length} catalog entries, ${BLOCK_CATALOG.length} block entries, ${totalContractsChecked} TypeScript contracts verified for names, types, optionality, and defaults).`,
);
