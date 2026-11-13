import type { Metadata } from 'next';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { Badge, Card, CardTitle, EmptyState, Notice, PageHeader } from '@/components/ui';
import { respondRepresentation } from '@/app/actions/marketplace';

export const metadata: Metadata = { title: 'Agentes' };

export default async function AthleteAgentsPage() {
  const session = await requireSession(['athlete']);
  const supabase = await createClient();
  const { data: reps } = await supabase
    .from('agent_representations')
    .select('id, status, message, created_at, organizations(name, website, verification_status)')
    .eq('athlete_id', session.userId)
    .order('created_at', { ascending: false });

  return (
    <>
      <PageHeader kicker="Agentes" title="Quién quiere representarte" description="Tú decides. Nadie te representa sin tu aceptación expresa, y puedes terminar la relación cuando quieras." />
      {session.isMinor && <div className="mb-5"><Notice tone="neutral">Mientras seas menor de edad, los agentes no pueden proponerte representación en la plataforma.</Notice></div>}
      <div className="mb-5"><Notice tone="neutral">Antes de firmar con un agente, consulta las normas de agentes de la NCAA/NAIA y de tu federación: algunos acuerdos pueden afectar a tu elegibilidad.</Notice></div>
      {reps?.length ? (
        <ul className="space-y-4">
          {reps.map((r) => {
            const org = r.organizations as unknown as { name: string; website: string | null; verification_status: string } | null;
            return (
              <li key={r.id}>
                <Card>
                  <CardTitle kicker={org?.verification_status === 'verified' ? 'Agencia verificada ✓' : 'Agencia sin verificar'} action={<Badge tone={r.status === 'active' ? 'ok' : r.status === 'requested' ? 'warn' : 'neutral'}>{r.status}</Badge>}>
                    {org?.name}
                  </CardTitle>
                  {r.message && <p className="text-sm text-muted">“{r.message}”</p>}
                  {org?.website && <a href={org.website} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm text-brass hover:underline">Web de la agencia ↗</a>}
                  <div className="mt-4 flex gap-2">
                    {r.status === 'requested' && (
                      <>
                        <form action={respondRepresentation}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="active" /><button className="rounded-lg bg-brass px-3 py-1.5 text-sm text-ink">Aceptar</button></form>
                        <form action={respondRepresentation}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="declined" /><button className="rounded-lg border border-line-strong px-3 py-1.5 text-sm text-paper">Rechazar</button></form>
                      </>
                    )}
                    {r.status === 'active' && <form action={respondRepresentation}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="ended" /><button className="text-sm text-faint hover:text-danger">Terminar representación</button></form>}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      ) : <EmptyState title="Ninguna propuesta por ahora">No necesitas agente para usar la plataforma: tu Passport ya es visible para universidades verificadas.</EmptyState>}
    </>
  );
}
