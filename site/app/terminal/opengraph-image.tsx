import { OG_SIZE, OG_CONTENT_TYPE, renderFrame12OgImage } from '@/lib/og-image';

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = '@frame12/terminal: one run, three ways to read it';

export default function OgImage() {
  return renderFrame12OgImage({
    cutLabel: 'CUT 07',
    tag: '@frame12/terminal',
    title: 'One run. Three ways to read it.',
    subtitle: 'Watch the rich renderer, explore the events, build your own from twelve lines of NDJSON.',
  });
}
