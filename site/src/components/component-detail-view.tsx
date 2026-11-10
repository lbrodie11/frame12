'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Breadcrumb,
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
import { ComponentPreview } from '@/components/component-preview';
import { ExposureDemos } from '@/components/exposure-demos';
import { CopyCommand } from '@/components/copy-command';
import { resolveReturnTarget } from '@/lib/return-context';

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

/**
 * Header navigation. With a valid `?from=` origin token: a "Return path" trail plus a primary
 * contextual return link (a real URL built from an allowlist, not `history.back()`) and the
 * secondary "Browse all components" link. Without one (direct open, unknown or malformed token):
 * just today's "← All Components". The static HTML always contains the plain link, so it works
 * without JavaScript.
 */
function DetailHeaderNav({ entry }: { entry: CatalogEntry }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const target = resolveReturnTarget(searchParams?.get('from') ?? null);
  if (!target) return <PlainBackLink />;
  return (
    <div className="f12-stack-pair">
      <Breadcrumb
        id="detail-return-trail"
        ariaLabel="Return path"
        density="compact"
        items={[
          ...target.trail.map((crumb) => ({
            label: crumb.label,
            href: crumb.href,
            // Breadcrumb only calls this for plain primary clicks; modified clicks open natively.
            onClick: crumb.href
              ? (event: React.MouseEvent<HTMLAnchorElement>) => {
                  event.preventDefault();
                  router.push(crumb.href as string);
                }
              : undefined,
          })),
          { label: entry.title, current: true },
        ]}
      />
      <div className="f12-row-pair">
        <Link href={target.href} className="f12-link-btn primary" id="detail-return-context">
          {target.label}
        </Link>
        <Link href="/components" className="f12-link-btn" id="detail-browse-components">
          Browse all components
        </Link>
      </div>
    </div>
  );
}

function PlainBackLink() {
  return (
    <div className="f12-row-pair">
      <Link href="/components" className="f12-link-btn" id="detail-back-components">
        ← All Components
      </Link>
    </div>
  );
}

export function ComponentDetailView({ entry }: { entry: CatalogEntry }) {
  const namespaceInstallCmd = `npx shadcn@latest add @frame12/${entry.slug}`;
  const urlInstallCmd = `npx shadcn@latest add ${entry.registryUrl}`;

  return (
    <Sheet autoCut pegs>
      <header className="f12-hd">
        <div className="f12-hd-text">
          <p className="f12-eyebrow">
            {entry.category}
            <Tag>{entry.sourceFile}</Tag>
            <span>@frame12/{entry.slug} · /r/{entry.slug}.json</span>
          </p>
          <h1 className="f12-title">{withCamelCaseBreaks(entry.title)}</h1>
          <p className="f12-muted-copy">{entry.summary}</p>
        </div>
        {/* `?from=` is read on the client so detail pages stay statically generated; the
            fallback is the plain link that direct opens (and no-JS visitors) get anyway. */}
        <React.Suspense fallback={<PlainBackLink />}>
          <DetailHeaderNav entry={entry} />
        </React.Suspense>
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
            <ComponentPreview slug={entry.slug} previewTheme="light" />
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
            <ComponentPreview slug={entry.slug} previewTheme="dark" />
          </div>
        </Panel>
      </Scene>

      {entry.slug === 'exposure-scrubber' && <ExposureDemos />}

      <Scene gutter="scene" layout="equal">
        <Panel variant="quiet" label={`${entry.title} when to use and when not to use`}>
          <div className="f12-stack-scene">
            <div className="f12-stack-pair">
              <div className="f12-row-pair">
                <Tag status="success">When to use</Tag>
                <span className="f12-mono-note">Recommended storyboard & ledger contexts</span>
              </div>
              <h2 className="f12-section-title">When to use {entry.title}</h2>
              <ul className="f12-stack-pair" role="list">
                {entry.whenToUse.map((item, i) => (
                  <li key={i} className="f12-body-copy">
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="f12-stack-pair">
              <div className="f12-row-pair">
                <Tag status="warning">When not to use</Tag>
                <span className="f12-mono-note">Anti-patterns & better alternatives</span>
              </div>
              <h2 className="f12-section-title">When not to use {entry.title}</h2>
              <ul className="f12-stack-pair" role="list">
                {entry.whenNotToUse.map((item, i) => (
                  <li key={i} className="f12-body-copy">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Panel>

        <Panel variant="quiet" label={`${entry.title} state, theme, and responsive behavior`}>
          <div className="f12-stack-scene">
            <div className="f12-stack-pair">
              <div className="f12-row-pair">
                <Tag status="info">State model</Tag>
                <span className="f12-mono-note">Controlled & uncontrolled behavior</span>
              </div>
              <h2 className="f12-section-title">Controlled & uncontrolled state</h2>
              <p className="f12-body-copy">{entry.stateBehavior}</p>
            </div>

            <div className="f12-stack-pair">
              <div className="f12-row-pair">
                <Tag>Light & Dark</Tag>
                <span className="f12-mono-note">Theme & viewport adaptation</span>
              </div>
              <h2 className="f12-section-title">Theme & responsive behavior</h2>
              <p className="f12-body-copy">
                <strong>Light / Dark theme:</strong> {entry.themeBehavior}
              </p>
              <p className="f12-body-copy">
                <strong>Responsive (1280px → 320px):</strong> {entry.responsiveBehavior}
              </p>
            </div>
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
                label={`shadcn CLI (@frame12/${entry.slug})`}
                command={namespaceInstallCmd}
              />
              <CopyCommand
                id={`copy-install-url-${entry.slug}`}
                label={`Full manifest URL (${entry.slug}.json)`}
                command={urlInstallCmd}
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
                <span className="f12-mono-note">Accessibility & keyboard guarantees</span>
              </div>
              <h2 className="f12-section-title">Accessibility & keyboard interactions</h2>
              <ul className="f12-stack-pair" role="list">
                {entry.a11yNotes.map((note, i) => (
                  <li key={`a11y-${i}`} className="f12-body-copy">
                    {note}
                  </li>
                ))}
                {entry.keyboardNotes.map((note, i) => (
                  <li key={`kbd-${i}`} className="f12-body-copy">
                    <strong>Keyboard:</strong> {note}
                  </li>
                ))}
              </ul>
            </div>

            <div className="f12-stack-pair">
              <div className="f12-row-pair">
                <Tag>Grammar</Tag>
                <span className="f12-mono-note">FRAME/12 rules & common pitfalls</span>
              </div>
              <h2 className="f12-section-title">Design grammar & common errors</h2>
              <ul className="f12-stack-pair" role="list">
                {entry.grammarNotes.map((note, i) => (
                  <li key={`gram-${i}`} className="f12-body-copy">
                    {note}
                  </li>
                ))}
                {entry.commonErrors.map((err, i) => (
                  <li key={`err-${i}`} className="f12-body-copy">
                    <strong>Common error:</strong> {err}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Panel>
      </Scene>

      <Scene gutter="scene" layout="stack">
        <Panel label={`${entry.title} props reference`}>
          <div className="f12-stack-scene">
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

            {entry.subcomponents && entry.subcomponents.length > 0 && (
              <div className="f12-stack-pair">
                <h2 className="f12-section-title">Compound Subcomponents & Exported Types</h2>
                <Table>
                  <TableCaption>
                    Compound subcomponents and exported TypeScript prop contracts for {entry.title}
                  </TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col">Subcomponent</TableHead>
                      <TableHead scope="col">Exported Props Type</TableHead>
                      <TableHead scope="col">Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entry.subcomponents.map((sub) => (
                      <TableRow key={`${sub.name}-${sub.propsType}`}>
                        <TableCell>
                          <code className="f12-code-inline">&lt;{sub.name}&gt;</code>
                        </TableCell>
                        <TableCell>
                          <code className="f12-code-inline">{sub.propsType}</code>
                        </TableCell>
                        <TableCell>{sub.description}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </Panel>
      </Scene>
    </Sheet>
  );
}
