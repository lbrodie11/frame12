import { OG_SIZE, OG_CONTENT_TYPE, renderFrame12OgImage } from '@/lib/og-image';
import { COMPONENT_COUNT } from '@/lib/catalog';

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'Components & Primitive Adapters — FRAME/12';

export default function OgImage() {
  return renderFrame12OgImage({
    cutLabel: 'CUT 03',
    tag: `${COMPONENT_COUNT} Components · 34 Payloads`,
    title: 'Components & Adapters',
    subtitle:
      'Copy-in React + TypeScript components, motion hooks, and accessible primitive adapters via shadcn CLI.',
  });
}
