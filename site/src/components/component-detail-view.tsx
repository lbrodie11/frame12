'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Sheet,
  Scene,
  Panel,
  Tag,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from '@/components/frame12';
import type { CatalogEntry } from '@/lib/catalog';
import { useSiteSettings } from '@/components/site-shell';
import { ComponentPreview } from '@/components/component-preview';
import { CopyCommand } from '@/components/copy-command';

/**
 * Component names like `SegmentedControl` are a single unbreakable word that outgrows a 320px
 * sheet at the display face's minimum size; offer a <wbr> at each camelCase boundary so the
 * title wraps as "Segmented / Control" without altering its text for copy or screen readers.
 */
function withCamelCaseBreaks(title: string): React.ReactNode {
  const parts = title.split(/(?<=[a-z])(?=[A-Z])/);
  if (parts.length < 2) return title;
  return parts.map((part, idx) => (
    <React.Fragment key={idx}>
      {idx > 0 ? <wbr /> : null}
      {part}
    </React.Fragment>
  ));
}

export function ComponentDetailView({ entry }: { entry: CatalogEntry }) {
  const { motion } = useSiteSettings();
  const installCmd = `npx shadcn@latest add ${entry.registryUrl}`;

  return (
    <Sheet autoCut pegs motion={motion}>
      <header className="f12-hd">
        <div className="f12-hd-text">
          <p className="f12-eyebrow">
            {entry.category}
            <Tag>{entry.sourceFile}</Tag>
            <span>/r/{entry.slug}.json</span>
          </p>
          <h1 className="f12-title">{withCamelCaseBreaks(entry.title)}</h1>
          <p className="f12-muted-copy">{entry.summary}</p>
        </div>
        <div className="f12-row-pair">
          <Link href="/components" className="f12-link-btn" id="detail-back-components">
            ← All Components
          </Link>
        </div>
      </header>

      <Scene gutter="scene" layout="equal">
        <Panel label={`${entry.title} light theme preview`}>
          <div className="f12-stack-pair">
            <div className="f12-row-between">
              <div className="f12-row-pair">
                <Tag>Light · Paper</Tag>
                <span className="f12-mono-note">.f12-theme-light</span>
              </div>
              <span className="f12-mono-note">Interactive preview</span>
            </div>
            <ComponentPreview slug={entry.slug} previewTheme="light" motion={motion} />
          </div>
        </Panel>

        <Panel label={`${entry.title} dark theme preview`}>
          <div className="f12-stack-pair">
            <div className="f12-row-between">
              <div className="f12-row-pair">
                <Tag>Dark · Flashback</Tag>
                <span className="f12-mono-note">.f12-theme-dark</span>
              </div>
              <span className="f12-mono-note">Interactive preview</span>
            </div>
            <ComponentPreview slug={entry.slug} previewTheme="dark" motion={motion} />
          </div>
        </Panel>
      </Scene>

      <Scene gutter="scene" layout="split">
        <Panel label={`${entry.title} installation and usage`}>
          <div className="f12-stack-scene">
            <div className="f12-stack-pair">
              <h2 className="f12-section-title">Install & copy-in source</h2>
              <CopyCommand
                id={`copy-install-${entry.slug}`}
                label={`shadcn CLI (${entry.slug}.json)`}
                command={installCmd}
              />
            </div>

            <div className="f12-cmd-box">
              <div className="f12-cmd-head">
                <span className="f12-cmd-label">Usage example ({entry.title})</span>
              </div>
              <pre
                className="f12-cmd-pre"
                tabIndex={0}
                role="region"
                aria-label={`Usage example (${entry.title})`}
              >
                <code>{entry.usageTemplate}</code>
              </pre>
            </div>
          </div>
        </Panel>

        <Panel label={`${entry.title} accessibility and grammar notes`}>
          <div className="f12-stack-scene">
            <div className="f12-stack-pair">
              <div className="f12-row-pair">
                <Tag>WCAG AA</Tag>
                <span className="f12-mono-note">Accessibility guarantees</span>
              </div>
              <h2 className="f12-section-title">Accessibility notes</h2>
              <ul className="f12-stack-pair" role="list">
                {entry.a11yNotes.map((note, i) => (
                  <li key={i} className="f12-body-copy">
                    {note}
                  </li>
                ))}
              </ul>
            </div>

            <div className="f12-stack-pair">
              <div className="f12-row-pair">
                <Tag>Grammar</Tag>
                <span className="f12-mono-note">FRAME/12 rules</span>
              </div>
              <h2 className="f12-section-title">Design grammar</h2>
              <ul className="f12-stack-pair" role="list">
                {entry.grammarNotes.map((note, i) => (
                  <li key={i} className="f12-body-copy">
                    {note}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Panel>
      </Scene>

      <Scene gutter="scene" layout="stack">
        <Panel label={`${entry.title} props reference`}>
          <div className="f12-stack-pair">
            <h2 className="f12-section-title">Props & TypeScript API</h2>
            <Table>
              <TableCaption>
                Exported from{' '}
                {entry.slug === 'use-on-twos' ? '@/hooks/use-on-twos' : '@/components/frame12'} (
                {entry.sourceFile})
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Prop</TableHead>
                  <TableHead scope="col">Type</TableHead>
                  <TableHead scope="col">Default</TableHead>
                  <TableHead scope="col">Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entry.props.map((p) => (
                  <TableRow key={p.name}>
                    <TableCell>
                      <code className="f12-code-inline">{p.name}</code>
                    </TableCell>
                    <TableCell>
                      <code className="f12-code-inline">{p.type}</code>
                    </TableCell>
                    <TableCell>
                      <code className="f12-code-inline">{p.defaultValue}</code>
                    </TableCell>
                    <TableCell>{p.description}</TableCell>
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
