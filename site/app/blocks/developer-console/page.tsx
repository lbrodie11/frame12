'use client';

import * as React from 'react';
import Link from 'next/link';
import { Panel, Badge, Tag } from '@/components/frame12';
import { DeveloperConsole } from '@/components/frame12/blocks/developer-console';
import { useSiteSettings } from '@/components/site-shell';
import { CopyCommand } from '@/components/copy-command';
import { REGISTRY_BASE_URL } from '@/lib/config';

export default function DeveloperConsoleShowcasePage() {
  const { motion } = useSiteSettings();

  return (
    <DeveloperConsole
      motion={motion}
      headerSlot={
        <Panel variant="quiet" label="Install Developer Console registry block">
          <div className="f12-stack-pair">
            <div className="f12-row-between">
              <div className="f12-row-pair">
                <Badge burst={false}>registry:block · developer-console.json</Badge>
                <span className="f12-mono-note">
                  Installs @/components/frame12/blocks/developer-console.tsx + full FRAME/12 kit
                </span>
              </div>
              <Link href="/components" className="f12-link-btn" id="block-console-back-components">
                All Components &amp; Blocks →
              </Link>
            </div>
            <CopyCommand
              id="copy-install-developer-console"
              label="Install Developer Console block via shadcn CLI"
              command={`npx shadcn@latest add ${REGISTRY_BASE_URL}/developer-console.json`}
            />
          </div>
        </Panel>
      }
      footerSlot={
        <Panel variant="quiet" label="Block architecture and Expressive/Quiet hierarchy notes">
          <div className="f12-stack-pair">
            <div className="f12-row-pair">
              <span className="f12-console-quiet-title">
                ARCHITECTURE &amp; GRAMMAR NOTES (WP6 FLAGSHIP BLOCK)
              </span>
              <Tag status="neutral">RECONCILED FIXTURES</Tag>
            </div>
            <div className="f12-console-kv-list">
              <div className="f12-console-kv-item">
                <span className="f12-console-kv-label">
                  Expressive Cuts (C-01..C-03 + Modal C-04..C-05)
                </span>
                <span className="f12-console-kv-value">
                  Hero KPIs, 45° Halftone Chart &amp; Ranked Insights
                </span>
                <span className="f12-mono-note">
                  Uses 2.5px SVG mitered frames, --font-f-display numerals, and speech-balloon peak
                  callouts.
                </span>
              </div>
              <div className="f12-console-kv-item">
                <span className="f12-console-kv-label">Quiet Operational Ledgers</span>
                <span className="f12-console-kv-value">
                  Services, Masked API Keys &amp; Paginated Logs
                </span>
                <span className="f12-mono-note">
                  Uses 1px orthographic rules, compact tabular density, and unnumbered exposure-sheet
                  subgroups.
                </span>
              </div>
              <div className="f12-console-kv-item">
                <span className="f12-console-kv-label">100% Data Reconciliation</span>
                <span className="f12-console-kv-value">
                  1,482,900 Requests Across 4 Services &amp; 8 Routes
                </span>
                <span className="f12-mono-note">
                  Service shares (44% / 30% / 17% / 9%) and endpoint 24h totals sum to the exact
                  gateway KPI.
                </span>
              </div>
            </div>
          </div>
        </Panel>
      }
    />
  );
}
