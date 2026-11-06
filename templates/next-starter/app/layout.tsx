import type { Metadata } from 'next';
import localFont from 'next/font/local';
import '@/styles/frame12.css';

const delaGothicOne = localFont({
  src: '../src/fonts/dela-gothic-one-400.woff2',
  weight: '400',
  variable: '--font-dela-gothic-one',
  display: 'swap',
});

const zenKakuGothicNew = localFont({
  src: [
    { path: '../src/fonts/zen-kaku-gothic-new-400.woff2', weight: '400', style: 'normal' },
    { path: '../src/fonts/zen-kaku-gothic-new-500.woff2', weight: '500', style: 'normal' },
    { path: '../src/fonts/zen-kaku-gothic-new-700.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-zen-kaku-gothic-new',
  display: 'swap',
});

const mPlus1Code = localFont({
  src: [
    { path: '../src/fonts/m-plus-1-code-400.woff2', weight: '400', style: 'normal' },
    { path: '../src/fonts/m-plus-1-code-500.woff2', weight: '500', style: 'normal' },
    { path: '../src/fonts/m-plus-1-code-700.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-m-plus-1-code',
  display: 'swap',
  // next/font only generates Arial/Times fallbacks. M PLUS 1 Code is a narrow (0.5em) monospace,
  // so it gets metric-matched monospace fallbacks instead (`f12MonoFallback*` in
  // styles/frame12.css): a cold font load then reflows nothing when the webfont swaps in.
  adjustFontFallback: false,
  fallback: ['f12MonoFallbackConsolas', 'f12MonoFallback', 'ui-monospace', 'monospace'],
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
