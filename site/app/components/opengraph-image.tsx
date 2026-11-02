import { OG_SIZE, OG_CONTENT_TYPE, renderFrame12OgImage } from '@/lib/og-image';

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'Components & Primitive Adapters — FRAME/12';

export default function OgImage() {
  return renderFrame12OgImage({
    cutLabel: 'CUT 03',
    tag: '20 Registry Items',
    title: 'Components & Adapters',
    subtitle:
      'Copy-in React + TypeScript components, motion hooks, and accessible primitive adapters via shadcn CLI.',
  });
}
