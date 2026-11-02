import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { CATALOG, getCatalogEntry } from '@/lib/catalog';
import { ComponentDetailView } from '@/components/component-detail-view';

export function generateStaticParams() {
  return CATALOG.map((entry) => ({
    slug: entry.slug,
  }));
}

export function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Metadata {
  const entry = getCatalogEntry(params.slug);
  if (!entry) {
    return { title: 'Component Not Found' };
  }
  return {
    title: `${entry.title} (${entry.category})`,
    description: entry.summary,
  };
}

export default function ComponentSlugPage({
  params,
}: {
  params: { slug: string };
}) {
  const entry = getCatalogEntry(params.slug);
  if (!entry) {
    notFound();
  }
  return <ComponentDetailView entry={entry} />;
}
