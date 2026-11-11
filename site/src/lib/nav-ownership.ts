/**
 * Route ownership for the primary navigation.
 *
 * Every route maps to at most one nav item. The item whose own page is showing gets
 * `aria-current="page"`; the item that owns a child page (a component detail, an experiment)
 * gets `aria-current="true"`. Unknown routes highlight nothing. Prefix matching is deliberately
 * avoided: `/experiments/agent-approval` belongs to Agents even though it shares no prefix.
 */

export type NavItemId =
  | 'nav-home'
  | 'nav-motion'
  | 'nav-components'
  | 'nav-developer-console'
  | 'nav-workspace-settings'
  | 'nav-analytics-dashboard'
  | 'nav-agents'
  | 'nav-static'
  | 'nav-terminal'
  | 'nav-style-sheet'
  | 'nav-get-started';

export interface NavItem {
  href: string;
  label: string;
  id: NavItemId;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: '/', label: 'Home', id: 'nav-home' },
  { href: '/motion', label: 'Motion', id: 'nav-motion' },
  { href: '/components', label: 'Components', id: 'nav-components' },
  { href: '/blocks/developer-console', label: 'Developer Console', id: 'nav-developer-console' },
  { href: '/blocks/workspace-settings', label: 'Workspace Settings', id: 'nav-workspace-settings' },
  { href: '/blocks/analytics-dashboard', label: 'Analytics Block', id: 'nav-analytics-dashboard' },
  { href: '/agents', label: 'Agents', id: 'nav-agents' },
  { href: '/static', label: 'Static HTML', id: 'nav-static' },
  { href: '/terminal', label: 'Terminal', id: 'nav-terminal' },
  { href: '/style-sheet', label: 'Style Sheet', id: 'nav-style-sheet' },
  { href: '/get-started', label: 'Get Started', id: 'nav-get-started' },
];

/**
 * Ownership table. `exact` patterns match one path; `child` patterns use a single trailing `*`
 * standing for exactly one non-empty path segment. Order does not matter: exact matches win.
 */
export const NAV_OWNERSHIP: ReadonlyArray<{ pattern: string; id: NavItemId }> = [
  { pattern: '/', id: 'nav-home' },
  { pattern: '/motion', id: 'nav-motion' },
  { pattern: '/motion/*', id: 'nav-motion' },
  { pattern: '/components', id: 'nav-components' },
  { pattern: '/components/*', id: 'nav-components' },
  { pattern: '/blocks/developer-console', id: 'nav-developer-console' },
  { pattern: '/blocks/workspace-settings', id: 'nav-workspace-settings' },
  { pattern: '/blocks/analytics-dashboard', id: 'nav-analytics-dashboard' },
  { pattern: '/agents', id: 'nav-agents' },
  { pattern: '/experiments/agent-approval', id: 'nav-agents' },
  { pattern: '/static', id: 'nav-static' },
  { pattern: '/terminal', id: 'nav-terminal' },
  { pattern: '/terminal/*', id: 'nav-terminal' },
  { pattern: '/style-sheet', id: 'nav-style-sheet' },
  { pattern: '/get-started', id: 'nav-get-started' },
];

export interface NavOwnership {
  id: NavItemId;
  /** `'page'` when the nav item's own page is showing, `'true'` when it owns this child page. */
  current: 'page' | 'true';
}

function normalizePath(pathname: string): string {
  const path = (pathname || '/').split(/[?#]/)[0] || '/';
  return path.length > 1 ? path.replace(/\/+$/, '') || '/' : path;
}

function matches(pattern: string, path: string): boolean {
  if (!pattern.endsWith('/*')) return pattern === path;
  const base = pattern.slice(0, -2);
  if (!path.startsWith(`${base}/`)) return false;
  const rest = path.slice(base.length + 1);
  return rest.length > 0 && !rest.includes('/');
}

export function resolveNavOwnership(pathname: string): NavOwnership | null {
  const path = normalizePath(pathname);
  for (const row of NAV_OWNERSHIP) {
    if (matches(row.pattern, path)) {
      const item = NAV_ITEMS.find((n) => n.id === row.id);
      return { id: row.id, current: item && item.href === path ? 'page' : 'true' };
    }
  }
  return null;
}
