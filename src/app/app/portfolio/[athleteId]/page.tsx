import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { requireSession } from '@/lib/session';
import { loadAthleteWorkspace } from '@/lib/data/portfolio';
import { loadAgencyCases } from '@/lib/data/agency-cases';
import { ButtonLink, EmptyState } from '@/components/ui';
import { AthleteWorkspaceView, TAB_IDS, type Tab } from './AthleteWorkspaceView';

export const metadata: Metadata = { title: 'Ficha del atleta' };

export default async function AthleteWorkspacePage({
  params, searchParams,
}: { params: Promise<{ athleteId: string }>; searchParams: Promise<{ tab?: string }> }) {
  const session = await requireSession(['agent']);
  const { athleteId } = await params;
  if (!z.string().uuid().safeParse(athleteId).success) notFound();
  const sp = await searchParams;
  const tab: Tab = TAB_IDS.find((t) => t === sp.tab) ?? 'resumen';

  const [ws, agency] = await Promise.all([loadAthleteWorkspace(session.userId, athleteId), loadAgencyCases(session.userId)]);
  if (!ws) {
    return (
      <EmptyState title="Atleta no disponible" action={<ButtonLink href="/app/portfolio" variant="secondary">Volver al portfolio</ButtonLink>}>
        Este atleta no forma parte de la cartera de tu agencia, o no tienes permiso para ver su ficha de gestión.
      </EmptyState>
    );
  }
  return <AthleteWorkspaceView ws={ws} tab={tab} userId={session.userId} cases={agency.cases.filter((c) => c.athleteId === athleteId)} />;
}
