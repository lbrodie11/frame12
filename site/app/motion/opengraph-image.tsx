import { OG_SIZE, OG_CONTENT_TYPE, renderFrame12OgImage } from '@/lib/og-image';

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'Motion on Twos (12fps vs 60fps) — FRAME/12';

export default function OgImage() {
  return renderFrame12OgImage({
    cutLabel: 'CUT 02',
    tag: '12fps · 83.33ms Poses',
    title: 'Motion on Twos',
    subtitle:
      'Discrete state transitions held for two frames at 24fps, paired with immediate pointer tracking.',
  });
}
