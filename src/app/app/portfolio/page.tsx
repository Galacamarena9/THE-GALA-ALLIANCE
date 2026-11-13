import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { myOrganizations } from '@/lib/data/orgs';
import { Badge, ButtonLink, Card, CardTitle, EmptyState, Notice, PageHeader } from '@/components/ui';
import { respondRepresentation } from '@/app/actions/marketplace';

export const metadata: Metadata = { title: 'Mi cartera' };

export default async function PortfolioPage() {
  const session = await requireSession(['agent']);
  const supabase = await createClient();
  const agencies = (await myOrganizations(session.userId)).filter((o) => o.type === 'agency');
  const ids = agencies.map((a) => a.id);
  const { data: reps } = ids.length
    ? await supabase.from('agent_representations').select('id, athlete_id, status, created_at, responded_at').in('agency_id', ids).order('created_at', { ascending: false })
    : { data: [] };
  const athleteIds = (reps ?? []).map((r) => r.athlete_id);
  const { data: dir } = athleteIds.length
    ? await supabase.from('athlete_directory').select('user_id, display_name, graduation_year, current_team').in('user_id', athleteIds)
    : { data: [] };
  const byId = new Map((dir ?? []).map((d) => [d.user_id, d]));
  const active = (reps ?? []).filter((r) => r.status === 'active');
  const pending = (reps ?? []).filter((r) => r.status === 'requested');

  return (
    <>
      <PageHeader kicker="Agentes" title="Mi cartera" description="Solo representas a quien lo acepta expresamente. Propón representación desde el perfil de un atleta en el escaparate." action={<ButtonLink href="/app/discover">Buscar talento</ButtonLink>} />
      {agencies.some((a) => a.verification_status !== 'verified') && <div className="mb-5"><Notice>Tu agencia está pendiente de verificación: hasta entonces no puedes contactar atletas por la plataforma.</Notice></div>}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardTitle kicker="Representados">{active.length} atleta(s)</CardTitle>
          {active.length ? (
            <ul className="divide-y divide-line">
              {active.map((r) => {
                const a = byId.get(r.athlete_id);
                return (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                    <Link href={`/athletes/${r.athlete_id}`} className="text-paper hover:text-brass">{a?.display_name ?? 'Atleta'}<span className="block text-xs text-faint">Clase {a?.graduation_year ?? '—'} · {a?.current_team ?? '—'}</span></Link>
                    <form action={respondRepresentation}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="ended" /><button className="text-xs text-faint hover:text-danger">Terminar</button></form>
                  </li>
                );
              })}
            </ul>
          ) : <EmptyState title="Aún no representas a nadie" />}
        </Card>
        <Card>
          <CardTitle kicker="Propuestas enviadas">{pending.length} pendiente(s)</CardTitle>
          {pending.length ? (
            <ul className="divide-y divide-line text-sm">
              {pending.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-3">
                  <span className="text-paper">{byId.get(r.athlete_id)?.display_name ?? 'Atleta'}</span>
                  <Badge tone="warn">Esperando respuesta</Badge>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted">Sin propuestas pendientes.</p>}
        </Card>
      </div>
    </>
  );
}
