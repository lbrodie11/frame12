import { WorkspaceSettingsShowcase } from './showcase';

// The active tab lives in `?section=`. Rendering per request lets the server HTML show that tab
// (so it works without JavaScript and the page height is right before first paint, which keeps
// native Back/Forward scroll restoration accurate).
export const dynamic = 'force-dynamic';

export default function WorkspaceSettingsShowcasePage() {
  return <WorkspaceSettingsShowcase />;
}
