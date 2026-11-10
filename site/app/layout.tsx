import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { Analytics } from '@vercel/analytics/next';
import '@/styles/frame12.css';
import './site.css';
import { SiteShell } from '@/components/site-shell';
import { STORED_TEMPOS, TEMPO_STORAGE_KEY } from '@/lib/tempo-storage';

const delaGothicOne = localFont({
  src: '../src/fonts/dela-gothic-one-400.woff2',
  weight: '400',
  variable: '--font-dela-gothic-one',
  display: 'swap',
  adjustFontFallback: false,
  fallback: ['f12DisplayFallback', 'f12DisplayFallbackDejaVu', 'sans-serif'],
});

const zenKakuGothicNew = localFont({
  src: [
    { path: '../src/fonts/zen-kaku-gothic-new-400.woff2', weight: '400', style: 'normal' },
    { path: '../src/fonts/zen-kaku-gothic-new-500.woff2', weight: '500', style: 'normal' },
    { path: '../src/fonts/zen-kaku-gothic-new-700.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-zen-kaku-gothic-new',
  display: 'swap',
  adjustFontFallback: false,
  fallback: ['f12BodyFallback', 'f12BodyFallbackDejaVu', 'sans-serif'],
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
  metadataBase: new URL('https://frame12.dev'),
  title: {
    default: 'FRAME/12 — Interface Design Language & Component Registry',
    template: '%s | FRAME/12',
  },
  description:
    'An interface design language built from page composition and cel-animation production craft: ink-framed panels, 12/20/32px gutter grammar, 45° SVG screentone, and motion held on twos (12fps).',
};

// Runs before first paint: applies the stored theme, and marks <html data-f12-tempo> with the stored
// tempo (TEMPO_STORAGE_KEY, shared with the site's TempoProvider) so a stored `still` shows no
// motion even before React hydrates (frame12.css). Invalid values read as `auto`.
const FOUC_SCRIPT = `try{var s=localStorage.getItem("color-scheme");var d=(s==="light"||s==="dark")?s:(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");var m=document.querySelector('meta[name="color-scheme"]');if(m)m.content=(s==="light"||s==="dark")?s:"light dark";document.documentElement.setAttribute("data-theme",d);}catch(e){}try{var t=localStorage.getItem(${JSON.stringify(TEMPO_STORAGE_KEY)});document.documentElement.setAttribute("data-f12-tempo",${JSON.stringify(STORED_TEMPOS)}.indexOf(t)>=0?t:"auto");}catch(e){document.documentElement.setAttribute("data-f12-tempo","auto");}`;

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
        {process.env.VERCEL === '1' ? <Analytics /> : null}
      </body>
    </html>
  );
}
