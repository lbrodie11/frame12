import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Agent Skill & Grammar Linter',
  description:
    'Portable SKILL.md, deterministic static grammar checker (check-frame12.mjs), and ESLint rules for Claude Code, Cursor, Antigravity, and Windsurf.',
};

export default function AgentsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
