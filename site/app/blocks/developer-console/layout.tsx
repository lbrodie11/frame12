import type { Metadata } from 'next';

export const metadata: Metadata = {
  // Canonical without `?section=` so shareable tab URLs never become duplicate pages.
  alternates: { canonical: '/blocks/developer-console' },
  title: 'Developer Console Flagship Block',
  description:
    'Installable FRAME/12 API & webhook control-plane Developer Console combining Expressive telemetry cuts with Quiet operational views for services, masked API keys, and request logs.',
};

export default function DeveloperConsoleBlockLayout({ children }: { children: React.ReactNode }) {
  return children;
}
