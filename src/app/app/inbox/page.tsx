import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { Badge, Card, EmptyState, PageHeader, buttonClass } from '@/components/ui';
import { respondContact } from '@/app/actions/connect';
import { loadAgentInbox } from '@/lib/data/inbox';
import { AgentInboxView } from '@/components/inbox/AgentInbox';

export const metadata: Metadata = { title: 'Mensajes' };

const STATUS_LABEL: Record<string, string> = {
  pending_guardian: 'Esperando a la familia',
  pending: 'Esperando al atleta',
  accepted: 'Conversación abierta',
  declined: 'Rechazada',
  blocked: 'Bloqueada',
};

export default async function InboxPage() {
  const session = await requireSession();
  // Agente (sin otros papeles de atleta, familia u organización): bandeja única por atleta con contexto.
  const agentOnly = session.roles.includes('agent') && !['athlete', 'parent', 'university', 'coach', 'brand'].some((r) => session.roles.includes(r as never));
  if (agentOnly) return <AgentInboxView groups={await loadAgentInbox(session.userId)} />;
  const supabase = await createClient();
  const { data: requests } = await supabase
    .from('contact_requests')
    .select('id, status, message, created_at, athlete_id, is_minor_at_request, organization_id, organizations(name, verification_status)')
    .order('created_at', { ascending: false })
    .limit(100);
  const athleteIds = [...new Set((requests ?? []).map((r) => r.athlete_id))];
  const { data: names } = athleteIds.length ? await supabase.from('profiles').select('id, display_name').in('id', athleteIds) : { data: [] };
  const nameById = new Map((names ?? []).map((n) => [n.id, n.display_name]));
  const { data: links } = session.roles.includes('parent')
    ? await supabase.from('parent_athlete_links').select('athlete_id').eq('parent_id', session.userId).eq('status', 'approved')
    : { data: [] };
  const guardianOf = new Set((links ?? []).map((l) => l.athlete_id));

  return (
    <>
      <PageHeader
        kicker="Mensajes"
        title="Conversaciones seguras"
        description="Solo organizaciones verificadas pueden iniciar contacto. Con menores, la familia aprueba primero, ve la conversación y no se comparten datos personales."
      />
      {requests?.length ? (
        <ul className="space-y-3">
          {requests.map((r) => {
            const org = r.organizations as unknown as { name: string; verification_status: string } | null;
            const iAmAthlete = r.athlete_id === session.userId;
            const iAmGuardian = guardianOf.has(r.athlete_id);
            return (
              <li key={r.id}>
                <Card className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-paper">
                        {org?.name} <span className="text-brass">✓</span>
                        <span className="text-muted"> → {iAmAthlete ? 'ti' : nameById.get(r.athlete_id) ?? 'atleta'}</span>
                      </p>
                      <p className="mt-1 line-clamp-2 text-sm text-muted">{r.message}</p>
                    </div>
                    <Badge tone={r.status === 'accepted' ? 'ok' : r.status.startsWith('pending') ? 'warn' : 'neutral'}>{STATUS_LABEL[r.status]}</Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {r.status === 'accepted' && <Link href={`/app/inbox/${r.id}`} className="rounded-lg bg-brass px-3 py-1.5 text-sm text-ink">Abrir conversación</Link>}
                    {r.status === 'pending_guardian' && iAmGuardian && (
                      <>
                        <form action={respondContact}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="pending" /><button className={buttonClass('primary', 'sm')}>Aprobar (pasa a mi hijo/a)</button></form>
                        <form action={respondContact}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="declined" /><button className={buttonClass('secondary', 'sm')}>Rechazar</button></form>
                      </>
                    )}
                    {r.status === 'pending' && iAmAthlete && (
                      <>
                        <form action={respondContact}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="accepted" /><button className={buttonClass('primary', 'sm')}>Aceptar</button></form>
                        <form action={respondContact}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="declined" /><button className={buttonClass('secondary', 'sm')}>Rechazar</button></form>
                      </>
                    )}
                    {(iAmAthlete || iAmGuardian) && r.status !== 'blocked' && r.status !== 'declined' && (
                      <form action={respondContact}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="blocked" /><button className="text-xs text-faint hover:text-danger">Bloquear</button></form>
                    )}
                    <span className="ml-auto text-xs text-faint">{new Date(r.created_at).toLocaleDateString('es-ES')}{r.is_minor_at_request ? ' · menor (familia en copia)' : ''}</span>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState title="Sin conversaciones todavía">
          {session.roles.includes('athlete') ? 'Cuando una universidad, coach, agente o marca verificada quiera hablar contigo, lo verás aquí.' : 'Inicia contacto desde el perfil de un atleta del escaparate.'}
        </EmptyState>
      )}
    </>
  );
}
