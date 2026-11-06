import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Agent Approval Inbox (Experimental Prototype)',
  description:
    'Experimental FRAME/12 prototype for evidence-based human review of AI agent tool calls: actual tool arguments first, labeled local fixture records second, and untrusted agent prose third.',
};

export default function AgentApprovalExperimentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
