import { OG_SIZE, OG_CONTENT_TYPE, renderFrame12OgImage } from '@/lib/og-image';

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'Developer Console Flagship Block — FRAME/12';

export default function OgImage() {
  return renderFrame12OgImage({
    cutLabel: 'BLOCK 01',
    tag: 'registry:block · developer-console',
    title: 'Developer Console',
    subtitle:
      'Expressive KPI storyboards paired with Quiet exposure-sheet ledgers for services, masked API keys, and request logs.',
  });
}
