import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Static HTML (@frame12/static)',
  description:
    'The same pull-request report rendered by the FRAME/12 React kit and by @frame12/static, a framework-free HTML renderer with the same DOM, classes and stylesheet.',
};

export default function StaticLayout({ children }: { children: React.ReactNode }) {
  return children;
}
