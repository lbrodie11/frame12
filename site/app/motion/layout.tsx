import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Motion on Twos (12fps vs 60fps)',
  description:
    'Interactive exposure-sheet comparator contrasting 12fps stepped motion ("on twos", 83.33ms per pose) against 60fps smooth interpolation and instant cuts.',
};

export default function MotionLayout({ children }: { children: React.ReactNode }) {
  return children;
}
