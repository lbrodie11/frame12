import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Style Sheet & Construction Manual',
  description:
    'Visual grammar reference for FRAME/12: 2.5px mitered ink panels, 12px/20px/32px gutters, 45° SVG screentone, typography tokens, and flashback dark mode.',
};

export default function StyleSheetLayout({ children }: { children: React.ReactNode }) {
  return children;
}
