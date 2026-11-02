import { OG_SIZE, OG_CONTENT_TYPE, renderFrame12OgImage } from '@/lib/og-image';

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'FRAME/12 Style Sheet & Specimen';

export default function OgImage() {
  return renderFrame12OgImage({
    cutLabel: 'CUT 05',
    tag: 'Phase 1 Specimen',
    title: 'Style Sheet',
    subtitle:
      'Panel grammar diagram, six construction details, exposure-sheet film strip, type scale, and palette tokens.',
  });
}
