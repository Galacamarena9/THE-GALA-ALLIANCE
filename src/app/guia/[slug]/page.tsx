import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { GUIDE, guideChapter } from '@/content/guide';
import { GuideArticle } from '@/components/GuideView';
import { PublicFooter, PublicHeader } from '@/components/PublicShell';
import { ButtonLink } from '@/components/ui';

export function generateStaticParams() {
  return GUIDE.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const c = guideChapter(slug);
  return { title: c?.title ?? 'Guía', description: c?.summary };
}

export default async function PublicGuideChapter({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const chapter = guideChapter(slug);
  if (!chapter) notFound();
  return (
    <>
      <PublicHeader />
      <main id="main-content" className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
        <GuideArticle chapter={chapter} base="/guia" />
        <div className="mt-12 max-w-3xl rounded-[var(--radius-card)] border border-brass/40 bg-surface p-6">
          <p className="font-display text-xl text-paper">¿Y en tu caso?</p>
          <p className="mt-2 text-sm text-muted">Crea tu Passport gratis y Gala IA te dirá qué te falta, con tu roadmap según tu año de graduación.</p>
          <ButtonLink href="/signup?role=athlete" className="mt-4">Empezar gratis</ButtonLink>
        </div>
      </main>
      <PublicFooter />
    </>
  );
}
