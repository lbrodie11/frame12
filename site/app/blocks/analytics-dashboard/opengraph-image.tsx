import { OG_SIZE, OG_CONTENT_TYPE, renderFrame12OgImage } from '@/lib/og-image';

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'Revenue Recovery Analytics Block — FRAME/12';

export default function OgImage() {
  return renderFrame12OgImage({
    cutLabel: 'BLOCK 03',
    tag: 'registry:block · analytics-dashboard',
    title: 'Revenue Recovery Analytics',
    subtitle:
      'Expressive storyboard establishing shot (C-01..C-04) paired with Quiet period-comparison, checkout-segment, and daily attribution ledgers.',
  });
}
