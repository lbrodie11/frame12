import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { CATALOG, getCatalogEntry } from '@/lib/catalog';
import { ComponentDetailView } from '@/components/component-detail-view';

// Next.js 15+: dynamic route params are delivered as a Promise.
type SlugParams = Promise<{ slug: string }>;

export function generateStaticParams() {
  return CATALOG.map((entry) => ({
    slug: entry.slug,
  }));
}

export async function generateMetadata({ params }: { params: SlugParams }): Promise<Metadata> {
  const { slug } = await params;
  const entry = getCatalogEntry(slug);
  if (!entry) {
    return { title: 'Component Not Found' };
  }
  return {
    title: `${entry.title} (${entry.category})`,
    description: entry.summary,
  };
}

export default async function ComponentSlugPage({ params }: { params: SlugParams }) {
  const { slug } = await params;
  const entry = getCatalogEntry(slug);
  if (!entry) {
    notFound();
  }
  return <ComponentDetailView entry={entry} />;
}
