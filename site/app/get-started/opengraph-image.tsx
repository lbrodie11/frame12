import { OG_SIZE, OG_CONTENT_TYPE, renderFrame12OgImage } from '@/lib/og-image';

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'Get Started with FRAME/12';

export default function OgImage() {
  return renderFrame12OgImage({
    cutLabel: 'CUT 06',
    tag: 'Next.js + shadcn CLI',
    title: 'Get Started',
    subtitle:
      'Five steps from zero to a verified FRAME/12 storyboard sheet with self-hosted fonts and static grammar checks.',
  });
}
