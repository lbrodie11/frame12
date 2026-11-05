import { OG_SIZE, OG_CONTENT_TYPE, renderFrame12OgImage } from '@/lib/og-image';

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'Workspace Settings Operational Block — FRAME/12';

export default function OgImage() {
  return renderFrame12OgImage({
    cutLabel: 'BLOCK 02',
    tag: 'registry:block · workspace-settings',
    title: 'Workspace Settings',
    subtitle:
      'Quiet-first operational settings across 7 sections with validation, unsaved-change detection, navigation protection, and destructive action confirmation.',
  });
}
