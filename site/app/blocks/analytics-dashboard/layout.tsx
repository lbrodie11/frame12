import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Revenue Recovery Analytics Block',
  description:
    'Installable FRAME/12 e-commerce revenue recovery analytics block combining Expressive storyboard cuts (C-01..C-04) with Quiet period-comparison, checkout-segment, and daily attribution ledgers.',
};

export default function AnalyticsDashboardBlockLayout({ children }: { children: React.ReactNode }) {
  return children;
}
