import type { Metadata } from 'next';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { loadCatalog } from '@/lib/data/athlete';
import { ButtonLink, EmptyState, PageHeader } from '@/components/ui';
import { OpportunityForm } from './OpportunityForm';

export const metadata: Metadata = { title: 'Nueva oportunidad' };

export default async function NewOpportunityPage() {
  const session = await requireSession(['university', 'coach']);
  const supabase = await createClient();
  const [catalog, { data: memberships }] = await Promise.all([
    loadCatalog(),
    supabase.from('organization_members').select('organizations(id, name, type, verification_status, division)').eq('user_id', session.userId),
  ]);
  const orgs = (memberships ?? [])
    .map((m) => m.organizations as unknown as { id: string; name: string; type: string; verification_status: string; division: string | null } | null)
    .filter((o): o is NonNullable<typeof o> => Boolean(o && ['university', 'college', 'club', 'academy'].includes(o.type)));

  const { data: needs } = orgs.length
    ? await supabase.from('recruiting_needs').select('id, organization_id, title').in('organization_id', orgs.map((o) => o.id)).eq('status', 'active').limit(100)
    : { data: [] };

  return (
    <>
      <PageHeader kicker="Recruiting" title="Nueva oportunidad" description="Cuanto más concreta (posiciones, años, coste y ayuda), mejores candidaturas recibirás." />
      {orgs.length ? (
        <OpportunityForm orgs={orgs} catalog={catalog} needs={needs ?? []} />
      ) : (
        <EmptyState title="Primero necesitas una organización" action={<ButtonLink href="/app/organization">Crear organización</ButtonLink>} />
      )}
    </>
  );
}
