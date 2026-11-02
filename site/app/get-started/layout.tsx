import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Get Started & shadcn CLI Setup',
  description:
    'Install FRAME/12 in 10 seconds with npx shadcn@latest add https://frame12.dev/r/frame12.json, configure self-hosted fonts, and wire check-frame12.mjs.',
};

export default function GetStartedLayout({ children }: { children: React.ReactNode }) {
  return children;
}
