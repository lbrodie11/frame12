'use client';

import * as React from 'react';
import Link from 'next/link';
import { Panel, Badge, Tag } from '@/components/frame12';
import { WorkspaceSettings } from '@/components/frame12/blocks/workspace-settings';
import { useSiteSettings } from '@/components/site-shell';
import { CopyCommand } from '@/components/copy-command';
import { REGISTRY_BASE_URL } from '@/lib/config';

export default function WorkspaceSettingsShowcasePage() {
  const { motion } = useSiteSettings();

  return (
    <WorkspaceSettings
      idPrefix="ws-settings"
      motion={motion}
      headerSlot={
        <Panel variant="quiet" label="Install Workspace Settings registry block">
          <div className="f12-stack-pair">
            <div className="f12-row-between">
              <div className="f12-row-pair">
                <Badge burst={false}>registry:block · workspace-settings.json</Badge>
                <span className="f12-mono-note">
                  Installs @/components/frame12/blocks/workspace-settings.tsx + full FRAME/12 kit
                </span>
              </div>
              <div className="f12-row-pair">
                <Link
                  href="/blocks/developer-console"
                  className="f12-link-btn"
                  id="block-settings-goto-console"
                >
                  Developer Console Block →
                </Link>
                <Link
                  href="/components"
                  className="f12-link-btn"
                  id="block-settings-back-components"
                >
                  All Components &amp; Blocks →
                </Link>
              </div>
            </div>
            <CopyCommand
              id="copy-install-workspace-settings"
              label="Install Workspace Settings block via shadcn CLI"
              command={`npx shadcn@latest add ${REGISTRY_BASE_URL}/workspace-settings.json`}
            />
          </div>
        </Panel>
      }
      footerSlot={
        <Panel variant="quiet" label="Block architecture and Quiet-first hierarchy notes">
          <div className="f12-stack-pair">
            <div className="f12-row-pair">
              <span className="f12-console-quiet-title">
                ARCHITECTURE &amp; GRAMMAR NOTES (WP7 OPERATIONAL SETTINGS BLOCK)
              </span>
              <Tag status="neutral">QUIET-FIRST LEDGER</Tag>
            </div>
            <div className="f12-console-kv-list">
              <div className="f12-console-kv-item">
                <span className="f12-console-kv-label">Single Expressive Posture Cut (C-01)</span>
                <span className="f12-console-kv-value">
                  Revision Posture &amp; Reconciled Seat/Channel Counters
                </span>
                <span className="f12-mono-note">
                  Uses one top mitered cut to anchor revision status while keeping all 7 settings
                  tabs in Quiet 1px operational panels.
                </span>
              </div>
              <div className="f12-console-kv-item">
                <span className="f12-console-kv-label">
                  Unsaved-Change Detection &amp; Navigation Guard
                </span>
                <span className="f12-console-kv-value">
                  Cross-Tab Draft Diffing + Guard Modal (C-02)
                </span>
                <span className="f12-mono-note">
                  Tracks modified sections, arms beforeunload, and prompts before switching
                  workspace targets with unsaved edits.
                </span>
              </div>
              <div className="f12-console-kv-item">
                <span className="f12-console-kv-label">
                  Destructive Confirmation Modals (C-03..C-04)
                </span>
                <span className="f12-console-kv-value">
                  RBAC Member Removal, Secret Rotation &amp; Slug-Verified Archive
                </span>
                <span className="f12-mono-note">
                  Every destructive simulated action requires explicit confirmation and restores
                  keyboard focus deterministically.
                </span>
              </div>
            </div>
          </div>
        </Panel>
      }
    />
  );
}
