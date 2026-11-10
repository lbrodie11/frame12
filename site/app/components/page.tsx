'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Sheet,
  Scene,
  Panel,
  Tag,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from '@/components/frame12';
import { CATALOG, BLOCK_CATALOG, type ComponentCategory } from '@/lib/catalog';
import { CopyCommand } from '@/components/copy-command';
import { REGISTRY_BASE_URL } from '@/lib/config';
import {
  catalogGroupAnchorId,
  catalogOriginToken,
  type CatalogGroupId,
} from '@/lib/return-context';
import { returnFocusProps } from '@/lib/history-focus';

/** "Inspect →" link that carries its catalog group as an origin token and remembers focus. */
function InspectLink({ slug, title, group }: { slug: string; title: string; group: CatalogGroupId }) {
  const id = `comp-link-${slug}`;
  return (
    <Link
      href={`/components/${slug}?from=${catalogOriginToken(group)}`}
      id={id}
      className="f12-link-btn f12-nowrap"
      aria-label={`Inspect ${title}`}
      {...returnFocusProps(catalogGroupAnchorId(group))}
    >
      Inspect →
    </Link>
  );
}

function GroupHeading({ group, children }: { group: CatalogGroupId; children: React.ReactNode }) {
  return (
    <h2 className="f12-section-title f12-anchor-target" id={catalogGroupAnchorId(group)} tabIndex={-1}>
      {children}
    </h2>
  );
}

function CategoryTable({
  category,
  caption,
  group,
}: {
  category: ComponentCategory;
  caption: string;
  group: CatalogGroupId;
}) {
  const entries = CATALOG.filter((c) => c.category === category);
  return (
    <Table>
      <TableCaption>{caption}</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead scope="col">Component &amp; Registry</TableHead>
          <TableHead scope="col">Summary</TableHead>
          <TableHead scope="col">Inspect</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.slug}>
            <TableCell>
              <div className="f12-comp-cell">
                <strong>{entry.title}</strong>
                <code className="f12-code-inline f12-nowrap">/r/{entry.slug}.json</code>
              </div>
            </TableCell>
            <TableCell>{entry.summary}</TableCell>
            <TableCell>
              <InspectLink slug={entry.slug} title={entry.title} group={group} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function ComponentsIndexPage() {
  const componentCount = CATALOG.filter((c) => c.category !== 'Motion Hooks').length;
  const hookAndAdapterEntries = CATALOG.filter(
    (c) => c.category === 'Motion Hooks' || c.category === 'Primitive Adapters',
  );

  return (
    <Sheet autoCut pegs>
      <header className="f12-hd">
        <div className="f12-hd-text">
          <p className="f12-eyebrow">
            @/components/frame12 · shadcn-compatible JSON
            <Tag>{componentCount} Components · 41 Registry Payloads</Tag>
          </p>
          <h1 className="f12-title">Components & adapters</h1>
          <p className="f12-muted-copy">
            Copy-in React + TypeScript components, motion hooks, and accessible primitive adapters.
            Every component works standalone with <code className="f12-code-inline">frame12.css</code>{' '}
            and zero external chart or animation libraries.
          </p>
        </div>
      </header>

      <Scene gutter="scene" layout="stack">
        <Panel label="Install full kit or individual components">
          <div className="f12-stack-scene">
            <div className="f12-row-between">
              <div className="f12-stack-pair">
                <div className="f12-row-pair">
                  <Badge burst={false}>Bundle · @frame12/frame12</Badge>
                  <span className="f12-mono-note">
                    26 core components + 5 primitive adapters + useOnTwos hooks + CSS tokens
                  </span>
                </div>
                <h2 className="f12-section-title">Install via shadcn CLI (@frame12 namespace or URL)</h2>
              </div>
              <div className="f12-row-pair">
                <Link
                  href="/blocks/developer-console"
                  className="f12-link-btn"
                  id="comp-index-developer-console"
                >
                  Block: Developer Console →
                </Link>
                <Link
                  href="/blocks/workspace-settings"
                  className="f12-link-btn"
                  id="comp-index-workspace-settings"
                >
                  Block: Workspace Settings →
                </Link>
                <Link
                  href="/blocks/analytics-dashboard"
                  className="f12-link-btn"
                  id="comp-index-analytics-dashboard"
                >
                  Block: Revenue Recovery →
                </Link>
                <Link href="/get-started" className="f12-link-btn primary" id="comp-index-get-started">
                  Full Setup Guide
                </Link>
              </div>
            </div>
            <CopyCommand
              id="comp-copy-bundle"
              label="Install full FRAME/12 registry bundle (@frame12 namespace)"
              command="npx shadcn@latest add @frame12/frame12"
            />
            <CopyCommand
              id="comp-copy-bundle-url"
              label="Full manifest URL alternative"
              command={`npx shadcn@latest add ${REGISTRY_BASE_URL}/frame12.json`}
            />
          </div>
        </Panel>
      </Scene>

      <Scene gutter="scene" layout="equal">
        <Panel label="Layout components">
          <div className="f12-stack-pair">
            <div className="f12-row-pair">
              <Tag>01 · Layout</Tag>
              <span className="f12-mono-note">Sheet · Scene · Panel · PanelPair</span>
            </div>
            <GroupHeading group="layout">Storyboard layout & gutters</GroupHeading>
            <CategoryTable
              category="Layout"
              group="layout"
              caption="Layout components enforcing 12px/20px/32px gutters and mitered 2.5px ink borders."
            />
          </div>
        </Panel>

        <Panel label="Control components">
          <div className="f12-stack-pair">
            <div className="f12-row-pair">
              <Tag>02 · Controls</Tag>
              <span className="f12-mono-note">
                SegmentedControl · Tabs · Button · Field · Input · Textarea · Checkbox · RadioGroup · Switch · Badge · Tag · Alert · Toast · Skeleton · EmptyState · Breadcrumb · Pagination
              </span>
            </div>
            <GroupHeading group="controls">Exposure-sheet controls & markers</GroupHeading>
            <CategoryTable
              category="Controls"
              group="controls"
              caption="Interactive controls with immediate hover feedback and stepped state transitions."
            />
          </div>
        </Panel>
      </Scene>

      <Scene gutter="scene" layout="stack">
        <Panel label="Data and visualization components">
          <div className="f12-stack-pair">
            <div className="f12-row-pair">
              <Tag>03 · Data & Charts</Tag>
              <span className="f12-mono-note">
                Metric · ToneAreaChart · ToneBarList · ToneSpark · Balloon
              </span>
            </div>
            <GroupHeading group="data-charts">Screentone visualizations & speech balloons</GroupHeading>
            <CategoryTable
              category="Data & Charts"
              group="data-charts"
              caption="Zero-dependency SVG visualizations using 45° halftone dot patterns and semantic data tables."
            />
          </div>
        </Panel>
      </Scene>

      <Scene gutter="scene" layout="stack">
        <Panel label="Motion hooks and primitive adapters">
          <div className="f12-stack-pair">
            <div className="f12-row-pair">
              <Tag>04 · Hooks & Primitive Adapters</Tag>
              <span className="f12-mono-note">
                useOnTwos · Dialog · Select · Tooltip · DropdownMenu · Table
              </span>
            </div>
            <GroupHeading group="hooks-adapters">12fps motion hooks & accessible primitive skins</GroupHeading>
            <Table>
              <TableCaption>
                Motion hooks and accessible Radix/native primitive adapters styled with FRAME/12 ink rules.
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Item &amp; Registry</TableHead>
                  <TableHead scope="col">Category</TableHead>
                  <TableHead scope="col">Summary</TableHead>
                  <TableHead scope="col">Inspect</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hookAndAdapterEntries.map((entry) => (
                  <TableRow key={entry.slug}>
                    <TableCell>
                      <div className="f12-comp-cell">
                        <strong>{entry.title}</strong>
                        <code className="f12-code-inline f12-nowrap">/r/{entry.slug}.json</code>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Tag>{entry.category}</Tag>
                    </TableCell>
                    <TableCell>{entry.summary}</TableCell>
                    <TableCell>
                      <InspectLink slug={entry.slug} title={entry.title} group="hooks-adapters" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Panel>
      </Scene>

      <Scene gutter="scene" layout="stack">
        <Panel variant="quiet" label="Application blocks (registry:block)">
          <div className="f12-stack-pair">
            <div className="f12-row-pair">
              <Tag status="info">05 · Application Blocks</Tag>
              <span className="f12-mono-note">
                DeveloperConsole · WorkspaceSettings · AnalyticsDashboard (registry:block)
              </span>
            </div>
            <h2 className="f12-section-title">Installable full-screen application blocks</h2>
            <Table>
              <TableCaption>
                Production-ready application blocks combining Expressive storyboard cuts with Quiet operational ledgers and deterministic fixtures.
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Block &amp; Registry</TableHead>
                  <TableHead scope="col">Dependencies</TableHead>
                  <TableHead scope="col">Summary</TableHead>
                  <TableHead scope="col">Interactive Showcase</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {BLOCK_CATALOG.map((block) => (
                  <TableRow key={block.slug}>
                    <TableCell>
                      <div className="f12-comp-cell">
                        <strong>{block.title}</strong>
                        <code className="f12-code-inline f12-nowrap">/r/{block.slug}.json</code>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Tag>{block.componentDependencies.length} items</Tag>
                    </TableCell>
                    <TableCell>{block.summary}</TableCell>
                    <TableCell>
                      <Link
                        href={block.route}
                        id={`block-link-${block.slug}`}
                        className="f12-link-btn f12-nowrap"
                        aria-label={`Open ${block.title}`}
                      >
                        Open Block →
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Panel>
      </Scene>
    </Sheet>
  );
}
