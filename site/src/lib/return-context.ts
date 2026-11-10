/**
 * Contextual return links ("← Back to Developer Console · Dependencies").
 *
 * Links into a component detail page carry an origin *token*, never a URL:
 *
 *   ?from=block.developer-console.request-logs.dependencies
 *   ?from=block.analytics-dashboard.dependencies          (blocks without tabs)
 *   ?from=catalog.controls
 *
 * The token is parsed with a strict grammar against allowlists, and the return target is built
 * from the tables below. Anything malformed, unknown or oversized parses to `null` (no contextual
 * link), so an off-site or arbitrary-path return target cannot be expressed at all.
 *
 * This module is framework-free so it can be unit tested and shared by server and client code.
 */

import type { ConsoleSection } from '@/components/frame12/blocks/developer-console';
import type { SettingsSection } from '@/components/frame12/blocks/workspace-settings';

export const CONSOLE_SECTIONS = [
  'overview',
  'services',
  'api-keys',
  'request-logs',
] as const satisfies readonly ConsoleSection[];

export const SETTINGS_SECTIONS = [
  'profile',
  'workspace',
  'notifications',
  'appearance',
  'motion',
  'team',
  'danger-zone',
] as const satisfies readonly SettingsSection[];

// Exhaustiveness: `satisfies` only proves each listed value is a real section. These fail to
// compile if a block gains a section that is missing here (which would otherwise make that tab
// parse as unknown and bounce the block back to its default tab).
type Missing<All, Listed> = Exclude<All, Listed>;
const consoleSectionsComplete: [Missing<ConsoleSection, (typeof CONSOLE_SECTIONS)[number]>] extends [never]
  ? true
  : never = true;
const settingsSectionsComplete: [Missing<SettingsSection, (typeof SETTINGS_SECTIONS)[number]>] extends [never]
  ? true
  : never = true;
void consoleSectionsComplete;
void settingsSectionsComplete;

export type BlockSlug = 'developer-console' | 'workspace-settings' | 'analytics-dashboard';

interface BlockReturnInfo {
  title: string;
  /** Allowed `?section=` values, first one is the block's default (omitted from URLs). */
  sections: readonly string[] | null;
  sectionLabels?: Record<string, string>;
}

export const BLOCK_RETURN_TABLE: Record<BlockSlug, BlockReturnInfo> = {
  'developer-console': {
    title: 'Developer Console',
    sections: CONSOLE_SECTIONS,
    sectionLabels: {
      overview: 'Overview',
      services: 'Services & Endpoints',
      'api-keys': 'API Keys',
      'request-logs': 'Request Logs',
    },
  },
  'workspace-settings': {
    title: 'Workspace Settings',
    sections: SETTINGS_SECTIONS,
    sectionLabels: {
      profile: 'Profile',
      workspace: 'Workspace',
      notifications: 'Notifications',
      appearance: 'Appearance',
      motion: 'Motion',
      team: 'Team & Roles',
      'danger-zone': 'Danger Zone',
    },
  },
  'analytics-dashboard': { title: 'Analytics Block', sections: null },
};

/** Catalog groups on `/components`; each renders a heading with id `catalog-<groupId>`. */
export const CATALOG_GROUPS = {
  layout: 'Layout',
  controls: 'Controls',
  'data-charts': 'Data & Charts',
  'hooks-adapters': 'Hooks & Adapters',
} as const;

export type CatalogGroupId = keyof typeof CATALOG_GROUPS;

/** Upper bound on token length; real tokens are well under 64 characters. */
export const MAX_TOKEN_LENGTH = 96;

const TOKEN_CHARSET = /^[a-z0-9.-]+$/;
const SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function hasOwn<T extends object>(obj: T, key: string): key is Extract<keyof T, string> {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

export type OriginToken =
  | { kind: 'block'; block: BlockSlug; section: string | null; anchor: 'dependencies' }
  | { kind: 'catalog'; group: CatalogGroupId };

export function parseOriginToken(raw: unknown): OriginToken | null {
  if (typeof raw !== 'string') return null;
  if (raw.length === 0 || raw.length > MAX_TOKEN_LENGTH) return null;
  if (!TOKEN_CHARSET.test(raw)) return null;
  const parts = raw.split('.');
  if (!parts.every((p) => SEGMENT.test(p))) return null;

  if (parts[0] === 'catalog') {
    if (parts.length !== 2 || !hasOwn(CATALOG_GROUPS, parts[1])) return null;
    return { kind: 'catalog', group: parts[1] };
  }

  if (parts[0] === 'block') {
    const slug = parts[1];
    if (!slug || !hasOwn(BLOCK_RETURN_TABLE, slug)) return null;
    const info = BLOCK_RETURN_TABLE[slug];
    if (info.sections) {
      // block.<slug>.<section>.dependencies
      if (parts.length !== 4 || parts[3] !== 'dependencies') return null;
      if (!info.sections.includes(parts[2])) return null;
      return { kind: 'block', block: slug, section: parts[2], anchor: 'dependencies' };
    }
    // block.<slug>.dependencies
    if (parts.length !== 3 || parts[2] !== 'dependencies') return null;
    return { kind: 'block', block: slug, section: null, anchor: 'dependencies' };
  }

  return null;
}

export function blockOriginToken(block: BlockSlug, section: string | null): string {
  const info = BLOCK_RETURN_TABLE[block];
  return info.sections && section
    ? `block.${block}.${section}.dependencies`
    : `block.${block}.dependencies`;
}

export function catalogOriginToken(group: CatalogGroupId): string {
  return `catalog.${group}`;
}

/** `/blocks/<slug>` plus `?section=` when it differs from the block's default section. */
export function blockHref(block: BlockSlug, section: string | null): string {
  const info = BLOCK_RETURN_TABLE[block];
  if (!info.sections || !section || section === info.sections[0]) return `/blocks/${block}`;
  return `/blocks/${block}?section=${section}`;
}

export function blockDependenciesAnchorId(block: BlockSlug): string {
  return `block-doc-${block}-dependencies`;
}

export function catalogGroupAnchorId(group: CatalogGroupId): string {
  return `catalog-${group}`;
}

export interface ReturnTarget {
  /** Same-origin path built from the tables above, never from the token text. */
  href: string;
  /** Primary link text, e.g. "← Back to Developer Console · Dependencies". */
  label: string;
  /** Breadcrumb-style trail describing where the visitor came from. */
  trail: Array<{ label: string; href?: string }>;
}

export function buildReturnTarget(token: OriginToken | null): ReturnTarget | null {
  if (!token) return null;
  if (token.kind === 'catalog') {
    const groupLabel = CATALOG_GROUPS[token.group];
    const href = `/components#${catalogGroupAnchorId(token.group)}`;
    return {
      href,
      label: `← Back to Components · ${groupLabel}`,
      trail: [{ label: 'Components', href: '/components' }, { label: groupLabel, href }],
    };
  }
  const info = BLOCK_RETURN_TABLE[token.block];
  const base = blockHref(token.block, token.section);
  const href = `${base}#${blockDependenciesAnchorId(token.block)}`;
  return {
    href,
    label: `← Back to ${info.title} · Dependencies`,
    trail: [{ label: 'Blocks' }, { label: info.title, href: base }, { label: 'Dependencies', href }],
  };
}

export function resolveReturnTarget(raw: unknown): ReturnTarget | null {
  return buildReturnTarget(parseOriginToken(raw));
}

/** Validates a `?section=` value for a block; anything unknown is `null` (the block default). */
export function parseBlockSection(block: BlockSlug, raw: unknown): string | null {
  const sections = BLOCK_RETURN_TABLE[block].sections;
  if (!sections || typeof raw !== 'string') return null;
  return sections.includes(raw) ? raw : null;
}
