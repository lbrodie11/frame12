import { OG_SIZE, OG_CONTENT_TYPE, renderFrame12OgImage } from '@/lib/og-image';

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'FRAME/12 for AI Coding Agents';

export default function OgImage() {
  return renderFrame12OgImage({
    cutLabel: 'CUT 04',
    tag: 'SKILL.md + check-frame12.mjs',
    title: 'FRAME/12 for Agents',
    subtitle:
      '8 non-negotiable grammar rules and deterministic static linting for Claude Code, Cursor, and Antigravity.',
  });
}
