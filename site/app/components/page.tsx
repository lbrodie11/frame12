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
} from '@frame12/registry';
import { CATALOG, type ComponentCategory } from '@/lib/catalog';
import { useSiteSettings } from '@/components/site-shell';
import { CopyCommand } from '@/components/copy-command';

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
          <TableHead scope="col">Component</TableHead>
          <TableHead scope="col">Summary</TableHead>
          <TableHead scope="col">Registry Slug</TableHead>
          <TableHead scope="col">Inspect</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.slug}>
            <TableCell>
              <strong>{entry.title}</strong>
            </TableCell>
            <TableCell>{entry.summary}</TableCell>
            <TableCell>
              <code className="f12-code-inline">/r/{entry.slug}.json</code>
            </TableCell>
            <TableCell>
              <Link
                href={`/components/${entry.slug}`}
                id={`comp-link-${entry.slug}`}
                className="f12-link-btn"
              >
                Open {entry.title}
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function ComponentsIndexPage() {
  const { theme, motion } = useSiteSettings();
  const hookAndAdapterEntries = CATALOG.filter(
    (c) => c.category === 'Motion Hooks' || c.category === 'Primitive Adapters',
  );

  return (
    <Sheet pegs motion={motion} theme={theme}>
      <header className="hd">
        <div className="hd-text">
          <p className="eyebrow">
            @frame12/registry · shadcn-compatible JSON
            <Tag>20 Registry Items</Tag>
          </p>
          <h1 className="title">Components & adapters</h1>
          <p className="f12-muted-copy">
            Copy-in React + TypeScript components, motion hooks, and accessible primitive adapters.
            Every component works standalone with <code className="f12-code-inline">frame12.css</code>{' '}
            and zero external chart or animation libraries.
          </p>
        </div>
      </header>

      <Scene gutter="scene" layout="stack">
        <Panel cut="C-01" label="Install full kit or individual components">
          <div className="f12-stack-scene">
            <div className="f12-row-between">
              <div className="f12-stack-pair">
                <div className="f12-row-pair">
                  <Badge burst={false}>Bundle · frame12.json</Badge>
                  <span className="f12-mono-note">
                    14 core components + 5 primitive adapters + useOnTwos hooks + CSS tokens
                  </span>
                </div>
                <h2 className="f12-section-title">Install via shadcn CLI</h2>
              </div>
              <Link href="/get-started" className="f12-link-btn primary" id="comp-index-get-started">
                Full Setup Guide
              </Link>
            </div>
            <CopyCommand
              id="comp-copy-bundle"
              label="Install full FRAME/12 registry bundle"
              command="npx shadcn@latest add https://frame12.dev/r/frame12.json"
            />
          </div>
        </Panel>
      </Scene>

      <Scene gutter="scene" layout="equal">
        <Panel cut="C-02" label="Layout components">
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

        <Panel cut="C-03" label="Control components">
          <div className="f12-stack-pair">
            <div className="f12-row-pair">
              <Tag>02 · Controls</Tag>
              <span className="f12-mono-note">SegmentedControl · Button · Input · Badge · Tag</span>
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
        <Panel cut="C-04" label="Data and visualization components">
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
        <Panel cut="C-05" label="Motion hooks and primitive adapters">
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
                Motion hooks and thin adapters that declare shadcn registryDependencies while
                enforcing FRAME/12 ink rules.
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Item</TableHead>
                  <TableHead scope="col">Category</TableHead>
                  <TableHead scope="col">Summary</TableHead>
                  <TableHead scope="col">Registry Slug</TableHead>
                  <TableHead scope="col">Inspect</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hookAndAdapterEntries.map((entry) => (
                  <TableRow key={entry.slug}>
                    <TableCell>
                      <strong>{entry.title}</strong>
                    </TableCell>
                    <TableCell>
                      <Tag>{entry.category}</Tag>
                    </TableCell>
                    <TableCell>{entry.summary}</TableCell>
                    <TableCell>
                      <code className="f12-code-inline">/r/{entry.slug}.json</code>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/components/${entry.slug}`}
                        id={`comp-link-${entry.slug}`}
                        className="f12-link-btn"
                      >
                        Open {entry.title}
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
