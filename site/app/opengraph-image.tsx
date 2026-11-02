import { OG_SIZE, OG_CONTENT_TYPE, renderFrame12OgImage } from '@/lib/og-image';

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'FRAME/12 — Interface Design Language & Component Registry';

export default function OgImage() {
  return renderFrame12OgImage({
    cutLabel: 'CUT 01',
    tag: 'Design Language & Registry',
    title: 'FRAME/12',
    subtitle:
      'Ink-framed panels, 12/20/32px gutter grammar, 45° SVG screentone, and motion held on twos (12fps).',
  });
}
