import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/session';
import { GUIDE, guideChapter } from '@/content/guide';
import { GuideArticle } from '@/components/GuideView';

export function generateStaticParams() {
  return GUIDE.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: guideChapter(slug)?.title ?? 'Guía' };
}

export default async function AppGuideChapter({ params }: { params: Promise<{ slug: string }> }) {
  await requireSession();
  const { slug } = await params;
  const chapter = guideChapter(slug);
  if (!chapter) notFound();
  return <GuideArticle chapter={chapter} base="/app/guia" />;
}
