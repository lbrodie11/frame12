import type { Metadata } from 'next';
import {
  Dela_Gothic_One,
  Zen_Kaku_Gothic_New,
  M_PLUS_1_Code,
} from 'next/font/google';
import '../../registry/styles/frame12.css';
import './site.css';
import { SiteShell } from '@/components/site-shell';

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
  metadataBase: new URL('https://frame12.dev'),
  title: {
    default: 'FRAME/12 — Interface Design Language & Component Registry',
    template: '%s | FRAME/12',
  },
  description:
    'An interface design language built from page composition and cel-animation production craft: ink-framed panels, 12/20/32px gutter grammar, 45° SVG screentone, and motion held on twos (12fps).',
};

const FOUC_SCRIPT = `try{var s=localStorage.getItem("color-scheme");var m=document.querySelector('meta[name="color-scheme"]');if(m)m.content=(s==="light"||s==="dark")?s:"light dark";if(s==="light"||s==="dark")document.documentElement.setAttribute("data-theme",s);}catch(e){}`;

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
