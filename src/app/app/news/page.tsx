import type { Metadata } from 'next';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { myOrganizations } from '@/lib/data/orgs';
import { NEWS_KIND_LABEL, domainOf } from '@/lib/domain/labels';
import { Badge, Card, CardTitle, EmptyState, PageHeader, buttonClass } from '@/components/ui';
import { NewsForm, ReportButton } from '@/components/forms';
import { respondNewsTag } from '@/app/actions/organization';

export const metadata: Metadata = { title: 'Actualidad' };

export default async function NewsPage() {
  const session = await requireSession();
  const supabase = await createClient();
  const [{ data: posts }, { data: pendingTags }, orgs] = await Promise.all([
    supabase.from('news_posts').select('id, kind, title, body, source_url, created_at, organization_id, organizations(name)').eq('status', 'published').order('created_at', { ascending: false }).limit(50),
    session.roles.includes('athlete')
      ? supabase.from('news_posts').select('id, title, body, organizations(name)').eq('athlete_id', session.userId).eq('status', 'pending_consent')
      : Promise.resolve({ data: [] }),
    myOrganizations(session.userId),
  ]);
  const verifiedOrgs = orgs.filter((o) => o.verification_status === 'verified').map((o) => ({ id: o.id, name: o.name }));
  const isAdmin = session.roles.includes('admin');

  return (
    <>
      <PageHeader kicker="Actualidad" title="Lo que pasa en el reclutamiento internacional" description="Comunicados de organizaciones verificadas, fichajes publicados con el consentimiento del atleta y cambios de normativa con su fuente oficial." />

      {pendingTags && pendingTags.length > 0 && (
        <Card className="mb-5 border-brass/50">
          <CardTitle kicker="Necesita tu permiso">Te han mencionado</CardTitle>
          <ul className="space-y-4">
            {pendingTags.map((p) => (
              <li key={p.id}>
                <p className="text-paper">{p.title} <span className="text-faint">· {(p.organizations as unknown as { name: string } | null)?.name}</span></p>
                <p className="text-sm text-muted">{p.body}</p>
                <div className="mt-2 flex gap-2">
                  <form action={respondNewsTag}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="status" value="published" /><button className={buttonClass('primary', 'sm')}>Permitir publicación</button></form>
                  <form action={respondNewsTag}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="status" value="hidden" /><button className={buttonClass('secondary', 'sm')}>No permitir</button></form>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {(verifiedOrgs.length > 0 || isAdmin) && (
        <Card className="mb-5">
          <CardTitle kicker="Publicar">Comparte una novedad</CardTitle>
          <NewsForm organizations={verifiedOrgs} isAdmin={isAdmin} />
        </Card>
      )}

      {posts?.length ? (
        <ul className="space-y-4">
          {posts.map((p) => (
            <li key={p.id}>
              <Card>
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-faint">
                  <Badge tone={p.kind === 'rule_update' ? 'warn' : p.kind === 'signing' ? 'ok' : 'brass'}>{NEWS_KIND_LABEL[p.kind]}</Badge>
                  <span>{(p.organizations as unknown as { name: string } | null)?.name ?? 'The Gala Alliance'}</span>
                  <span>· {new Date(p.created_at).toLocaleDateString('es-ES')}</span>
                </div>
                <h2 className="text-xl text-paper">{p.title}</h2>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted">{p.body}</p>
                <div className="mt-3 flex items-center justify-between">
                  {p.source_url ? <a href={p.source_url} target="_blank" rel="noopener noreferrer" className="text-sm text-brass hover:underline">Fuente: {domainOf(p.source_url)} ↗</a> : <span />}
                  <ReportButton entityType="news_post" entityId={p.id} />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="Aún no hay publicaciones">Las organizaciones verificadas y el equipo editorial publicarán aquí.</EmptyState>
      )}
    </>
  );
}
