import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';
import { requireSession } from '@/lib/session';
import { loadAthlete360 } from '@/lib/data/athlete-360';
import { ButtonLink, EmptyState } from '@/components/ui';
import { a360Href, parseA360Tab } from '@/lib/domain/athlete-360';
import { Athlete360View } from './Athlete360View';

export const metadata: Metadata = { title: 'Ficha del atleta' };

export default async function Athlete360Page({
  params, searchParams,
}: { params: Promise<{ athleteId: string }>; searchParams: Promise<{ tab?: string | string[] }> }) {
  const session = await requireSession(['agent']);
  const { athleteId } = await params;
  if (!z.string().uuid().safeParse(athleteId).success) notFound();
  const { tab, legacy } = parseA360Tab((await searchParams).tab);
  // Enlaces antiguos (?tab=notas|pasos|procesos) → URL canónica de la pestaña nueva.
  if (legacy) redirect(a360Href(athleteId, tab));

  const data = await loadAthlete360(session.userId, athleteId);
  if (!data) {
    // Mismo resultado para un UUID inexistente y para un atleta de otra agencia: no se revela si existe.
    return (
      <EmptyState title="Atleta no disponible" action={<ButtonLink href="/app/portfolio" variant="secondary">Volver a Mis atletas</ButtonLink>}>
        Este atleta no forma parte de la cartera de tu agencia, o no tienes permiso para ver su ficha.
      </EmptyState>
    );
  }
  return <Athlete360View data={data} tab={tab} userId={session.userId} />;
}
