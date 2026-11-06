'use client';

import * as React from 'react';
import Link from 'next/link';
import { Panel, Tag } from '@/components/frame12';
import { getBlockCatalogEntry } from '@/lib/catalog';

export function BlockDocumentationSection({
  slug,
}: {
  slug: 'developer-console' | 'workspace-settings' | 'analytics-dashboard';
}) {
  const block = getBlockCatalogEntry(slug);
  if (!block) return null;

  return (
    <div className="f12-stack-scene" id={`block-doc-${block.slug}`}>
      <Panel
        variant="quiet"
        label={`${block.title} fixture model, component dependencies, and customization`}
      >
        <div className="f12-stack-scene">
          <div className="f12-stack-pair">
            <div className="f12-row-pair">
              <Tag status="info">Fixture data model</Tag>
              <span className="f12-mono-note">{block.sourceFile}</span>
            </div>
            <h2 className="f12-section-title">Deterministic fixture & reconciliation model</h2>
            <ul className="f12-stack-pair" role="list">
              {block.fixtureNotes.map((note, i) => (
                <li key={i} className="f12-body-copy">
                  {note}
                </li>
              ))}
            </ul>
          </div>

          <div className="f12-stack-pair">
            <div className="f12-row-pair">
              <Tag>Dependencies ({block.componentDependencies.length})</Tag>
              <span className="f12-mono-note">
                Installed automatically via {block.slug}.json
              </span>
            </div>
            <h2 className="f12-section-title">Component & hook dependencies</h2>
            <div className="f12-row-pair">
              {block.componentDependencies.map((dep) => (
                <Link
                  key={dep}
                  href={`/components/${dep}`}
                  className="f12-link-btn"
                  id={`block-${block.slug}-dep-${dep}`}
                >
                  {dep}
                </Link>
              ))}
            </div>
          </div>

          <div className="f12-stack-pair">
            <div className="f12-row-pair">
              <Tag status="success">Customization</Tag>
              <span className="f12-mono-note">Production integration guidance</span>
            </div>
            <h2 className="f12-section-title">Customization & production wiring</h2>
            <ul className="f12-stack-pair" role="list">
              {block.customizationGuidance.map((item, i) => (
                <li key={i} className="f12-body-copy">
                  {item}
                </li>
              ))}
            </ul>
            <div className="f12-cmd-box">
              <div className="f12-cmd-head">
                <span className="f12-cmd-label">Production usage ({block.title})</span>
              </div>
              <pre
                className="f12-cmd-pre"
                tabIndex={0}
                role="region"
                aria-label={`Production usage (${block.title})`}
              >
                <code>{block.usageTemplate}</code>
              </pre>
            </div>
          </div>

          <div className="f12-stack-pair">
            <h2 className="f12-section-title">Block props & TypeScript API</h2>
            <div className="f12-console-kv-list" role="list" aria-label={`${block.title} props`}>
              {block.props.map((p) => (
                <div key={p.name} className="f12-console-kv-item" role="listitem">
                  <span className="f12-console-kv-label">
                    {p.name} · default: {p.defaultValue}
                  </span>
                  <span className="f12-console-kv-value">{p.type}</span>
                  <span className="f12-mono-note">{p.description}</span>
                </div>
              ))}
            </div>
            {block.subcomponents && block.subcomponents.length > 0 && (
              <div
                className="f12-console-kv-list"
                role="list"
                aria-label={`${block.title} exported subcomponents`}
              >
                {block.subcomponents.map((sub) => (
                  <div key={sub.propsType} className="f12-console-kv-item" role="listitem">
                    <span className="f12-console-kv-label">&lt;{sub.name}&gt;</span>
                    <span className="f12-console-kv-value">{sub.propsType}</span>
                    <span className="f12-mono-note">{sub.description}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="f12-stack-pair">
            <div className="f12-row-pair">
              <Tag>WCAG AA</Tag>
              <Tag status="warning">Known limitations</Tag>
            </div>
            <h2 className="f12-section-title">Accessibility guarantees & known limitations</h2>
            <ul className="f12-stack-pair" role="list">
              {block.a11yNotes.map((note, i) => (
                <li key={`a11y-${i}`} className="f12-body-copy">
                  <strong>Accessibility:</strong> {note}
                </li>
              ))}
              {block.knownLimitations.map((lim, i) => (
                <li key={`lim-${i}`} className="f12-body-copy">
                  <strong>Known limitation:</strong> {lim}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Panel>
    </div>
  );
}
