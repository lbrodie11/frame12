import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'The Edit Room: CutMorph state changes',
  description:
    'Cut or match cut: FRAME/12 CutMorph turns state changes into film edits on the platform View Transitions. Filter, reorder, open and cut demos with a live pose inspector.',
  alternates: { canonical: '/motion/edit-room' },
};

export default function EditRoomLayout({ children }: { children: React.ReactNode }) {
  return children;
}
