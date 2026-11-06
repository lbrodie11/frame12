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
import { useSiteSettings } from '@/components/site-shell';
import { CopyCommand } from '@/components/copy-command';
import { REGISTRY_BASE_URL } from '@/lib/config';

function CategoryTable({
  category,
  caption,
}: {
  category: ComponentCategory;
  caption: string;
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
              <Link
                href={`/components/${entry.slug}`}
                id={`comp-link-${entry.slug}`}
                className="f12-link-btn f12-nowrap"
                aria-label={`Inspect ${entry.title}`}
              >
                Inspect →
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function ComponentsIndexPage() {
  const { motion } = useSiteSettings();
  const componentCount = CATALOG.filter((c) => c.category !== 'Motion Hooks').length;
  const hookAndAdapterEntries = CATALOG.filter(
    (c) => c.category === 'Motion Hooks' || c.category === 'Primitive Adapters',
  );

  return (
    <Sheet autoCut pegs motion={motion}>
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
                  <Badge burst={false}>Bundle · frame12.json</Badge>
                  <span className="f12-mono-note">
                    26 core components + 5 primitive adapters + useOnTwos hooks + CSS tokens
                  </span>
                </div>
                <h2 className="f12-section-title">Install via shadcn CLI</h2>
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
              label="Install full FRAME/12 registry bundle"
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
            <h2 className="f12-section-title">Storyboard layout & gutters</h2>
            <CategoryTable
              category="Layout"
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
            <h2 className="f12-section-title">Exposure-sheet controls & markers</h2>
            <CategoryTable
              category="Controls"
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
            <h2 className="f12-section-title">Screentone visualizations & speech balloons</h2>
            <CategoryTable
              category="Data & Charts"
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
            <h2 className="f12-section-title">12fps motion hooks & accessible primitive skins</h2>
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
                      <Link
                        href={`/components/${entry.slug}`}
                        id={`comp-link-${entry.slug}`}
                        className="f12-link-btn f12-nowrap"
                        aria-label={`Inspect ${entry.title}`}
                      >
                        Inspect →
                      </Link>
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
