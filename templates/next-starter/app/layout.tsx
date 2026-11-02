import type { Metadata } from 'next';
import {
  Dela_Gothic_One,
  Zen_Kaku_Gothic_New,
  M_PLUS_1_Code,
} from 'next/font/google';
import '@/styles/frame12.css';

const delaGothicOne = Dela_Gothic_One({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-f-display',
  display: 'swap',
});

const zenKakuGothicNew = Zen_Kaku_Gothic_New({
  weight: ['400', '500', '700'],
  subsets: ['latin'],
  variable: '--font-f-body',
  display: 'swap',
});

const mPlus1Code = M_PLUS_1_Code({
  weight: ['400', '500', '700'],
  subsets: ['latin'],
  variable: '--font-f-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'FRAME/12 Starter — Storyboard UI & Motion on Twos',
  description:
    'Next.js App Router starter pre-configured with @frame12/registry components, 12/20/32px gutter grammar, 45° SVG screentone charts, and AI agent guardrails.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${delaGothicOne.variable} ${zenKakuGothicNew.variable} ${mPlus1Code.variable}`}
      suppressHydrationWarning
    >
      <body style={{ margin: 0, background: 'var(--f-desk)', color: 'var(--f-ink)' }}>
        {children}
      </body>
    </html>
  );
}
