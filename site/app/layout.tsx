import type { Metadata } from 'next';
import localFont from 'next/font/local';
import '@/styles/frame12.css';
import './site.css';
import { SiteShell } from '@/components/site-shell';

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
  adjustFontFallback: false,
  fallback: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://frame12.dev'),
  title: {
    default: 'FRAME/12 — Interface Design Language & Component Registry',
    template: '%s | FRAME/12',
  },
  description:
    'An interface design language built from page composition and cel-animation production craft: ink-framed panels, 12/20/32px gutter grammar, 45° SVG screentone, and motion held on twos (12fps).',
};

const FOUC_SCRIPT = `try{var s=localStorage.getItem("color-scheme");var d=(s==="light"||s==="dark")?s:(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");var m=document.querySelector('meta[name="color-scheme"]');if(m)m.content=(s==="light"||s==="dark")?s:"light dark";document.documentElement.setAttribute("data-theme",d);}catch(e){}`;

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
      <head>
        <meta name="color-scheme" content="light dark" />
        <script dangerouslySetInnerHTML={{ __html: FOUC_SCRIPT }} />
      </head>
      <body>
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
