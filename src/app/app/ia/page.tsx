import type { Metadata } from 'next';
import { requireSession } from '@/lib/session';
import { Card, PageHeader } from '@/components/ui';
import { AskGala } from '@/components/AskGala';

export const metadata: Metadata = { title: 'Gala IA' };

export default async function GalaIaPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireSession();
  const { q } = await searchParams;
  return (
    <>
      <PageHeader
        kicker="Gala IA"
        title="Tu asistente para el proceso, 24/7"
        description="Conoce tu Passport, la guía con fuentes oficiales y las becas publicadas. Te explica, compara y te dice el siguiente paso. Nunca promete becas."
      />
      <Card className="paper-grain"><AskGala initialQuestion={(q ?? '').slice(0, 500)} /></Card>
    </>
  );
}
