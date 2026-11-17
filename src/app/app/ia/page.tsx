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
        description="Consulta tus datos reales (Passport, Gala Match, pipeline y plazos) y la guía con fuentes oficiales. Explica, compara, prepara borradores y te propone acciones que tú confirmas. Nunca promete becas ni envía nada por ti."
      />
      <Card className="paper-grain"><AskGala initialQuestion={(q ?? '').slice(0, 500)} /></Card>
    </>
  );
}
