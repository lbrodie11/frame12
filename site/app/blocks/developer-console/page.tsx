import { DeveloperConsoleShowcase } from './showcase';

// The active tab lives in `?section=`. Rendering per request lets the server HTML show that tab
// (so it works without JavaScript and the page height is right before first paint, which keeps
// native Back/Forward scroll restoration accurate).
//
// Trade-off (accepted for a docs site): this page is no longer statically cached on the CDN and
// each visit runs a server render. If that cost matters, pre-render one page per section
// (`/blocks/<slug>/[section]` via generateStaticParams) and rewrite `?section=` to it.
export const dynamic = 'force-dynamic';

export default function DeveloperConsoleShowcasePage() {
  return <DeveloperConsoleShowcase />;
}
