import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { loadCatalog } from '@/lib/data/athlete';
import { currentRecruitOrg } from '@/lib/data/recruit';
import { Badge, Card, EmptyState, Notice, PageHeader } from '@/components/ui';
import { RecruitShell } from '@/components/recruit/RecruitShell';
import { NeedForm } from '@/components/recruit/RecruitForms';
import { setNeedStatus } from '@/app/actions/recruit';

export const metadata: Metadata = { title: 'Necesidades de recruiting' };

const STATUS = { active: 'Activa', paused: 'En pausa', filled: 'Cubierta', closed: 'Cerrada' } as const;

export default async function NeedsPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const session = await requireSession();
  const sp = await searchParams;
  const { orgs, org } = await currentRecruitOrg(session.userId, sp.org);
  const supabase = await createClient();
  const [catalog, { data: needs }, { data: programs }, { data: cands }, { data: slm }] = await Promise.all([
    loadCatalog(),
    org ? supabase.from('recruiting_needs').select('*').eq('organization_id', org.id).order('status').order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
    org ? supabase.from('org_programs').select('id, name').eq('organization_id', org.id).is('archived_at', null) : Promise.resolve({ data: [] }),
    org ? supabase.from('org_candidates').select('need_id, internal_stage').eq('organization_id', org.id).is('archived_at', null) : Promise.resolve({ data: [] }),
    org ? supabase.from('org_shortlists').select('need_id, org_shortlist_members(athlete_id)').eq('organization_id', org.id).is('archived_at', null) : Promise.resolve({ data: [] }),
  ]);
  const posName = new Map(catalog.positions.map((p) => [p.id, p.name_es]));
  const canEdit = org?.caps.has('needs') ?? false;

  return (
    <>
      <PageHeader kicker="Recruiting" title="Necesidades" description="Lo que buscáis, en privado. Alimentan Gala Match inverso; solo se hacen públicas si publicas una oportunidad." />
      <RecruitShell org={org} orgs={orgs} active="/app/recruit/needs">
        {org && (
          <div className="space-y-5">
            {(needs ?? []).length ? (
              <ul className="grid gap-3 lg:grid-cols-2">
                {(needs ?? []).map((n) => {
                  const shortlisted = new Set((slm ?? []).filter((s) => s.need_id === n.id).flatMap((s) => (s.org_shortlist_members as unknown as { athlete_id: string }[]).map((m) => m.athlete_id))).size;
                  const c = (cands ?? []).filter((x) => x.need_id === n.id);
                  return (
                    <li key={n.id}>
                      <Card className="h-full">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-display text-lg font-bold uppercase text-paper">{n.title}</p>
                          <Badge tone={n.status === 'active' ? 'ok' : 'neutral'}>{STATUS[n.status as keyof typeof STATUS]}</Badge>
                        </div>
                        <p className="text-xs text-muted">{[catalog.sports.find((s) => s.id === n.sport_id)?.name_es, (n.position_ids as number[]).map((p) => posName.get(p)).join(' / '), (n.class_years as number[]).join(', '), n.start_term, n.slots && `${n.slots} plaza${n.slots > 1 ? 's' : ''}`].filter(Boolean).join(' · ')}</p>
                        <p className="mt-2 text-sm text-paper">{shortlisted} en shortlists · {c.filter((x) => ['contact', 'call', 'active'].includes(x.internal_stage)).length} en contacto · {c.filter((x) => x.internal_stage === 'offer').length} oferta{c.filter((x) => x.internal_stage === 'offer').length === 1 ? '' : 's'} · {c.filter((x) => x.internal_stage === 'committed').length} comprometido{c.filter((x) => x.internal_stage === 'committed').length === 1 ? '' : 's'}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {org.caps.has('discover') && <Link href={`/app/recruit/discover?need=${n.id}`} className="inline-flex min-h-11 items-center rounded-full bg-brass px-4 text-xs font-semibold text-ink">Ver atletas compatibles →</Link>}
                          {n.opportunity_id ? <Link href={`/app/opportunities/${n.opportunity_id}`} className="text-xs text-brass underline">Oportunidad publicada</Link> : org.caps.has('opportunities') && <Link href={`/app/opportunities/new?need=${n.id}`} className="text-xs text-muted underline">Publicar como oportunidad</Link>}
                          {canEdit && (
                            <form action={setNeedStatus} className="ml-auto flex items-center gap-1">
                              <input type="hidden" name="id" value={n.id} />
                              <label className="sr-only" htmlFor={`ns-${n.id}`}>Estado</label>
                              <select id={`ns-${n.id}`} name="status" defaultValue={n.status} className="min-h-9 rounded-lg border border-line bg-ink/40 px-2 text-xs text-paper">{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                              <button className="min-h-9 px-2 text-xs text-brass">OK</button>
                            </form>
                          )}
                        </div>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            ) : <EmptyState title="Sin necesidades">Ejemplo: «2027 · Base», baloncesto femenino, clase 2027, Fall 2027.</EmptyState>}
            {canEdit ? (
              <Card>
                <h2 className="mb-3 font-display text-lg font-bold text-paper">Nueva necesidad</h2>
                <NeedForm org={org.id} sports={catalog.sports.map((s) => ({ id: s.id, name: s.name_es }))} positions={catalog.positions} programs={(programs ?? []).map((p) => ({ id: p.id, name: p.name }))} />
              </Card>
            ) : <Notice tone="warn">Tu rol no permite crear necesidades.</Notice>}
          </div>
        )}
      </RecruitShell>
    </>
  );
}
