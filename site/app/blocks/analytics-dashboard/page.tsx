'use client';

import * as React from 'react';
import Link from 'next/link';
import { Panel, Badge, Tag } from '@/components/frame12';
import { AnalyticsDashboard } from '@/components/frame12/blocks/analytics-dashboard';
import { CopyCommand } from '@/components/copy-command';
import { BlockDocumentationSection } from '@/components/block-doc-footer';
import { REGISTRY_BASE_URL } from '@/lib/config';

export default function AnalyticsDashboardShowcasePage() {

  return (
    <AnalyticsDashboard
      idPrefix="analytics"
      footerSlot={
        <div className="f12-stack-scene">
          <Panel variant="quiet" label="Install Revenue Recovery Analytics registry block">
            <div className="f12-stack-pair">
              <div className="f12-row-between">
                <div className="f12-row-pair">
                  <Badge burst={false}>registry:block · @frame12/analytics-dashboard</Badge>
                  <span className="f12-mono-note">
                    Installs @/components/frame12/blocks/analytics-dashboard.tsx + full FRAME/12 kit
                  </span>
                </div>
                <div className="f12-row-pair">
                  <Link
                    href="/blocks/developer-console"
                    className="f12-link-btn"
                    id="block-analytics-goto-console"
                  >
                    Developer Console Block →
                  </Link>
                  <Link
                    href="/blocks/workspace-settings"
                    className="f12-link-btn"
                    id="block-analytics-goto-settings"
                  >
                    Workspace Settings Block →
                  </Link>
                  <Link
                    href="/components"
                    className="f12-link-btn"
                    id="block-analytics-back-components"
                  >
                    All Components &amp; Blocks →
                  </Link>
                </div>
              </div>
              <CopyCommand
                id="copy-install-analytics-dashboard"
                label="Install Revenue Recovery Analytics block via shadcn CLI (@frame12 namespace)"
                command="npx shadcn@latest add @frame12/analytics-dashboard"
              />
              <CopyCommand
                id="copy-install-analytics-dashboard-url"
                label="Full manifest URL alternative"
                command={`npx shadcn@latest add ${REGISTRY_BASE_URL}/analytics-dashboard.json`}
              />
            </div>
          </Panel>

          <Panel variant="quiet" label="Block architecture and data reconciliation notes">
            <div className="f12-stack-pair">
              <div className="f12-row-pair">
                <span className="f12-console-quiet-title">
                  ARCHITECTURE &amp; GRAMMAR NOTES (WP8 ANALYTICS BLOCK)
                </span>
                <Tag status="neutral">SINGLE FIXTURE · 100% RECONCILED</Tag>
              </div>
              <div className="f12-console-kv-list">
                <div className="f12-console-kv-item">
                  <span className="f12-console-kv-label">EXPRESSIVE STORYBOARD (C-01..C-04)</span>
                  <span className="f12-console-kv-value">
                    Shared Core Composition with Public Homepage
                  </span>
                  <span className="f12-mono-note">
                    Extracts RevenueRecoveryCoreScenes so both `/` and `/blocks/analytics-dashboard`
                    render from one source without duplicating the mulberry32(1207) generator.
                  </span>
                </div>
                <div className="f12-console-kv-item">
                  <span className="f12-console-kv-label">PERIOD &amp; SEGMENT RECONCILIATION</span>
                  <span className="f12-console-kv-value">
                    Prior Window Overlay &amp; 3-Segment Partition
                  </span>
                  <span className="f12-mono-note">
                    Every day and intervention partitions into Returning VIP, First-Time Mobile, and
                    High-AOV Desktop with exact integer remainder so segment and ledger totals match
                    C-01 and C-02 to the dollar.
                  </span>
                </div>
                <div className="f12-console-kv-item">
                  <span className="f12-console-kv-label">FILTERABLE DAILY LEDGER &amp; EVIDENCE (C-05)</span>
                  <span className="f12-console-kv-value">
                    Search, Scope, Pagination &amp; Daily Attribution Modal
                  </span>
                  <span className="f12-mono-note">
                    Quiet ledger supports text search, intervention/segment scoping, sorting,
                    pagination, and per-day attribution inspection via native modal Dialog (C-05).
                  </span>
                </div>
              </div>
            </div>
          </Panel>

          <BlockDocumentationSection slug="analytics-dashboard" />
        </div>
      }
    />
  );
}
