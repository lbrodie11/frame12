import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terminal (@frame12/terminal)',
  description:
    'One real Repo Archaeology run read three ways: the rich terminal renderer, an exposure sheet of its events, and the twelve lines of NDJSON any program can print to get the same output.',
};

export default function TerminalLayout({ children }: { children: React.ReactNode }) {
  return children;
}
