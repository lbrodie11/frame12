import fs from 'node:fs';
import path from 'node:path';
import { CATALOG, COMPONENT_CATEGORIES } from '@/lib/catalog';
import { SITE_URL, REGISTRY_BASE_URL } from '@/lib/config';

export const dynamic = 'force-static';

function readRepoFile(relPath: string): string {
  const candidates = [
    path.resolve(process.cwd(), '..', relPath),
    path.resolve(process.cwd(), relPath),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return fs.readFileSync(candidate, 'utf8').trim();
    }
  }
  throw new Error(`Unable to locate canonical source file for llms-full.txt: ${relPath}`);
}

export async function GET() {
  const skillMd = readRepoFile('skills/frame12/SKILL.md');
  const refsComponents = readRepoFile('skills/frame12/references/components-and-adapters.md');
  const refsExamples = readRepoFile('skills/frame12/references/examples-and-mistakes.md');
  const registryJsonRaw = readRepoFile('registry/registry.json');
  const registryJson = JSON.parse(registryJsonRaw) as {
    items: Array<{
      name: string;
      type: string;
      title?: string;
      description?: string;
      dependencies?: string[];
      registryDependencies?: string[];
    }>;
  };

  const sections: string[] = [
    '# FRAME/12 — Complete LLM & Coding Agent Reference (`/llms-full.txt`)',
    '',
    `> Generated directly from canonical source files (\`skills/frame12/SKILL.md\`, \`skills/frame12/references/*.md\`, \`registry/registry.json\`, and \`site/src/lib/catalog.ts\`). Summary index available at ${SITE_URL}/llms.txt.`,
    '',
    '---',
    '',
    '## Part 1: Canonical Agent Skill (`skills/frame12/SKILL.md`)',
    '',
    skillMd,
    '',
    '---',
    '',
    '## Part 2: Component & Adapter Reference (`skills/frame12/references/components-and-adapters.md`)',
    '',
    refsComponents,
    '',
    '---',
    '',
    '## Part 3: Examples & Common Mistakes (`skills/frame12/references/examples-and-mistakes.md`)',
    '',
    refsExamples,
    '',
    '---',
    '',
    '## Part 4: Registry Payloads & `shadcn` MCP Discovery (`registry/registry.json`)',
    '',
    '### Configuring `shadcn` MCP for `@frame12`',
    '',
    'To enable the official `shadcn` MCP server (`npx shadcn@latest mcp`) to search, inspect, and install FRAME/12 items in Cursor, Claude Code, or Windsurf, add the `@frame12` namespace to `components.json`:',
    '',
    '```json',
    '{',
    '  "$schema": "https://ui.shadcn.com/schema.json",',
    '  "registries": {',
    `    "@frame12": "${REGISTRY_BASE_URL}/{name}.json"`,
    '  }',
    '}',
    '```',
    '',
    '### Registry Manifest Table',
    '',
    '| Name | Type | Endpoint | NPM Dependencies | Registry Dependencies |',
    '| --- | --- | --- | --- | --- |',
    ...registryJson.items.map((item) => {
      const npmDeps = item.dependencies?.length ? item.dependencies.map((d) => `\`${d}\``).join(', ') : '—';
      const regDeps = item.registryDependencies?.length
        ? item.registryDependencies
            .map((d) => `\`${d.replace(/^https?:\/\/[^/]+\/r\//, '')}\``)
            .join(', ')
        : '—';
      return `| \`${item.name}\` | \`${item.type}\` | \`${REGISTRY_BASE_URL}/${item.name}.json\` | ${npmDeps} | ${regDeps} |`;
    }),
    '',
    '---',
    '',
    '## Part 5: Complete Component Catalog, Props, Accessibility & Usage Templates',
    '',
  ];

  for (const category of COMPONENT_CATEGORIES) {
    sections.push(`### Category: ${category}`, '');
    const entries = CATALOG.filter((e) => e.category === category);
    for (const entry of entries) {
      sections.push(
        `#### ${entry.title} (\`${entry.slug}\`)`,
        '',
        `- **Summary:** ${entry.summary}`,
        `- **Docs URL:** ${SITE_URL}/components/${entry.slug}`,
        `- **Registry URL:** \`${entry.registryUrl}\``,
        `- **Source File:** \`${entry.sourceFile}\``,
        '',
        '| Prop | Type | Default | Description |',
        '| --- | --- | --- | --- |',
        ...entry.props.map(
          (p) => `| \`${p.name}\` | \`${p.type.replace(/\|/g, '\\|')}\` | \`${p.defaultValue}\` | ${p.description} |`,
        ),
        '',
        '**Accessibility Notes:**',
        ...entry.a11yNotes.map((n) => `- ${n}`),
        '',
        '**Grammar Notes:**',
        ...entry.grammarNotes.map((n) => `- ${n}`),
        '',
        '**Usage Template:**',
        '```tsx',
        entry.usageTemplate,
        '```',
        '',
      );
    }
  }

  return new Response(sections.join('\n').trimEnd() + '\n', {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
