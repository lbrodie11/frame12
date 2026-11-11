import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terminal docs (@frame12/terminal)',
  description:
    'Install, the event contract, the grammar, every environment variable, motion, accessibility, security, the compatibility matrix and recipes for @frame12/terminal.',
};

export default function TerminalDocsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
