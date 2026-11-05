import { CATALOG, BLOCK_CATALOG, COMPONENT_CATEGORIES } from '@/lib/catalog';
import { SITE_URL, REGISTRY_BASE_URL } from '@/lib/config';

export const dynamic = 'force-static';

export async function GET() {
  const lines: string[] = [
    '# FRAME/12',
    '',
    '> Storyboard-grade React + TypeScript UI design system and shadcn-compatible registry where interfaces read like comic pages and move on twos (12fps).',
    '',
    'FRAME/12 combines sequential print composition (2.5px ink-framed panels, mitered 16px slanted gutters, automatic CSS-counter cut numbering via `<Sheet autoCut>`, and 45-degree SVG screentone halftone charts) with 12fps stepped motion ("on twos", 83.33ms per pose) and a deterministic static grammar checker (`scripts/check-frame12.mjs`).',
    '',
    '## Quick Install & AI Agent Setup',
    '',
    '- Full kit (styles, hooks, 26 components, 5 primitive adapters):',
    `  \`npx shadcn@latest add ${REGISTRY_BASE_URL}/frame12.json\``,
    '- Flagship Developer Console application block (`registry:block`):',
    `  \`npx shadcn@latest add ${REGISTRY_BASE_URL}/developer-console.json\``,
    '- Operational Workspace Settings application block (`registry:block`):',
    `  \`npx shadcn@latest add ${REGISTRY_BASE_URL}/workspace-settings.json\``,
    '- Revenue Recovery Analytics application block (`registry:block`):',
    `  \`npx shadcn@latest add ${REGISTRY_BASE_URL}/analytics-dashboard.json\``,
    '- Base configuration + typography (`registry:base` + `registry:font`):',
    `  \`npx shadcn@latest add ${REGISTRY_BASE_URL}/frame12-base.json\``,
    '- Individual component (resolves shared `frame12-styles` and `use-on-twos` via `registryDependencies`):',
    `  \`npx shadcn@latest add ${REGISTRY_BASE_URL}/sheet.json ${REGISTRY_BASE_URL}/panel.json\``,
    '- Upgrading or adding components when `styles/frame12.css` already exists:',
    '  Never edit `styles/frame12.css` directly (put custom token overrides in your own stylesheet); pass `--overwrite` when adding components after an update (`npx shadcn@latest add ... --overwrite`); and coding agents should always verify that `components/frame12/<name>.tsx` exists on disk after `shadcn add` rather than trusting exit code `0`.',
    '- Portable AI Agent Skill (`SKILL.md` for Claude Code, Cursor, Codex):',
    '  `npx skills add lbrodie11/frame12 --skill frame12`',
    '- shadcn MCP Registry Namespace (`components.json`):',
    `  Add \`"registries": { "@frame12": "${REGISTRY_BASE_URL}/{name}.json" }\` to \`components.json\` and run \`npx shadcn@latest mcp\` to let MCP-enabled coding agents browse and install \`@frame12/*\` items directly.`,
    '',
    '## Documentation & Machine-Readable Endpoints',
    '',
    `- [Overview & Interactive Recovery Dashboard](${SITE_URL}/): Interactive demo dashboard demonstrating \`<Sheet autoCut>\`, \`Scene\`, \`Panel\`, \`PanelPair\`, \`Metric\`, \`ToneAreaChart\`, and \`ToneBarList\`.`,
    `- [Motion on Twos Studio](${SITE_URL}/motion): Side-by-side 12fps stepped vs 60fps smooth vs instant cut timing comparison.`,
    `- [Component Catalog](${SITE_URL}/components): Interactive previews, prop tables, and install commands for all 31 components and adapters.`,
    `- [Developer Console Flagship Block](${SITE_URL}/blocks/developer-console): Installable API & webhook control-plane console (\`${REGISTRY_BASE_URL}/developer-console.json\`) combining Expressive hero telemetry with Quiet operational views for services, masked API keys, and request logs.`,
    `- [Workspace Settings Operational Block](${SITE_URL}/blocks/workspace-settings): Installable Quiet-first operational settings experience (\`${REGISTRY_BASE_URL}/workspace-settings.json\`) covering profile, workspace preferences, notification routing, appearance, motion grammar, team RBAC directory, and danger zone confirmation flows.`,
    `- [Revenue Recovery Analytics Block](${SITE_URL}/blocks/analytics-dashboard): Installable analytics composition (\`${REGISTRY_BASE_URL}/analytics-dashboard.json\`) combining the Expressive Storyboard (\`C-01\`–\`C-04\`) with Quiet period-over-period comparison, checkout segment breakdown, and filterable daily attribution ledgers (\`C-05\`).`,
    `- [AI Agent Skill & Static Linter](${SITE_URL}/agents): Documentation for \`SKILL.md\`, \`scripts/check-frame12.mjs\`, and ESLint integration.`,
    `- [Style Sheet & Tokens](${SITE_URL}/style-sheet): Token tables, typography hierarchy, screentone specimens, and gutter rules.`,
    `- [Get Started Guide](${SITE_URL}/get-started): Step-by-step Next.js App Router, font binding, and theme setup.`,
    `- [Full LLM Context (${SITE_URL}/llms-full.txt)](${SITE_URL}/llms-full.txt): Complete single-file reference combining \`SKILL.md\`, progressive-disclosure references, registry manifest index, and all component prop tables and code templates.`,
    `- [shadcn Registry Index (${REGISTRY_BASE_URL}/registry.json)](${REGISTRY_BASE_URL}/registry.json): Machine-readable shadcn registry catalog (41 items).`,
    '',
    '## Core Design Grammar Rules',
    '',
    '1. **Tokens, not literals (`color-literal`):** Use `--f-*` and `--font-f-*` CSS variables; never hardcode hex/RGB/HSL literals or raw font stacks.',
    '2. **Gutter grammar (`illegal-gutter`):** Use `<Scene gutter="pair" | "scene" | "change">` (`12px`, `20px`, `32px`); arbitrary grid gaps are rejected by `scripts/check-frame12.mjs`.',
    '3. **Cut numbering (`cut-order` & `explicit-cut-in-autocut`):** Prefer `<Sheet autoCut>` so `<Panel>` and `<PanelPair>` elements number automatically (`C-01`, `C-02`…) in DOM order via CSS counters (`cut={false}` hides a cut on an unnumbered panel; `DialogContent` cuts remain explicit). Never mix explicit string `cut` props inside `autoCut`.',
    '4. **Marker-yellow discipline (`marker-misuse`):** `var(--f-marker)` is used strictly as a highlight surface paired with `var(--f-marker-ink)` text or as an inked peak dot with a `2px` `var(--f-rule)` stroke—never as raw text or border color.',
    '5. **Adapter boundary (`raw-shadcn-import`):** Import `Dialog`, `Select`, `Tooltip`, `DropdownMenu`, and `Table` from `@/components/frame12` rather than raw `@/components/ui/*`.',
    '6. **Motion on twos (`useOnTwos`):** Discrete state transitions sample at 12fps (`83.33ms` per pose); pointer hover, scrolling, typing, and crosshairs stay immediate (`0ms`); `prefers-reduced-motion: reduce` forces instant cuts.',
    '',
    '## Component Registry Catalog',
    '',
  ];

  for (const category of COMPONENT_CATEGORIES) {
    lines.push(`### ${category}`, '');
    const entries = CATALOG.filter((entry) => entry.category === category);
    for (const entry of entries) {
      lines.push(
        `- [${entry.title}](${SITE_URL}/components/${entry.slug}) ([JSON](${entry.registryUrl})): ${entry.summary}`,
      );
    }
    lines.push('');
  }

  lines.push('### Application Blocks (`registry:block`)', '');
  for (const block of BLOCK_CATALOG) {
    lines.push(
      `- [${block.title}](${SITE_URL}${block.route}) ([JSON](${block.registryUrl})): ${block.summary}`,
    );
  }
  lines.push('');

  return new Response(lines.join('\n').trimEnd() + '\n', {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
