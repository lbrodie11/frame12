import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    default: 'Components & Primitive Adapters',
    template: '%s | FRAME/12',
  },
  description:
    '19 copy-in React + TypeScript components, accessible Radix/native primitive adapters, and 12fps motion hooks distributed across 22 shadcn registry payloads.',
};

export default function ComponentsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
