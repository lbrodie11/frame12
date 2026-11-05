import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Workspace Settings Operational Block',
  description:
    'Installable FRAME/12 Quiet-first operational settings block covering operator profile, workspace preferences, alert routing, appearance, motion grammar, team RBAC roles, and danger zone confirmation flows.',
};

export default function WorkspaceSettingsBlockLayout({ children }: { children: React.ReactNode }) {
  return children;
}
