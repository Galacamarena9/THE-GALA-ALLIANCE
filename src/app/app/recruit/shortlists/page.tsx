import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { currentRecruitOrg } from '@/lib/data/recruit';
import { Card, EmptyState, Notice, PageHeader } from '@/components/ui';
import { RecruitShell } from '@/components/recruit/RecruitShell';
import { ShortlistCreateForm } from '@/components/recruit/RecruitForms';
import { archiveShortlist } from '@/app/actions/recruit';

export const metadata: Metadata = { title: 'Shortlists' };

const ago = (d: string) => {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  return days <= 0 ? 'Actualizada hoy' : days === 1 ? 'Actualizada ayer' : `Actualizada hace ${days} días`;
};

export default async function ShortlistsPage({ searchParams }: { searchParams: Promise<{ org?: string; f?: string }> }) {
  const session = await requireSession();
  const sp = await searchParams;
  const { orgs, org } = await currentRecruitOrg(session.userId, sp.org);
  const supabase = await createClient();
  const [{ data: lists }, { data: members }, { data: cands }, { data: programs }, { data: needs }] = org ? await Promise.all([
    supabase.from('org_shortlists').select('id, name, visibility, owner_id, archived_at, updated_at, program_id').eq('organization_id', org.id).order('updated_at', { ascending: false }),
    supabase.from('org_shortlist_members').select('shortlist_id, athlete_id, review_status').eq('organization_id', org.id),
    supabase.from('org_candidates').select('athlete_id, internal_stage').eq('organization_id', org.id).is('archived_at', null),
    supabase.from('org_programs').select('id, name').eq('organization_id', org.id).is('archived_at', null),
    supabase.from('recruiting_needs').select('id, title').eq('organization_id', org.id).eq('status', 'active'),
  ]) : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }];
  const active = new Set((cands ?? []).filter((c) => ['contact', 'call', 'active', 'offer'].includes(c.internal_stage)).map((c) => c.athlete_id));
  const filter = sp.f === 'mine' || sp.f === 'shared' || sp.f === 'archived' ? sp.f : 'all';
  const shown = (lists ?? []).filter((l) => (filter === 'archived' ? l.archived_at : !l.archived_at) && (filter === 'mine' ? l.owner_id === session.userId : filter === 'shared' ? l.visibility === 'team' : true));

  return (
    <>
      <PageHeader kicker="Recruiting" title="Shortlists" description="Interés preliminar del staff. Una shortlist no es un proceso: cuando quieras avanzar, inicia el recruiting." />
      <RecruitShell org={org} orgs={orgs} active="/app/recruit/shortlists">
        {org && !org.caps.has('shortlist') ? <Notice tone="warn">Tu rol o el estado de verificación no permite usar shortlists.</Notice> : org && (
          <div className="space-y-5">
            <nav aria-label="Filtrar shortlists" className="flex gap-2 text-xs">
              {[['all', 'Todas'], ['mine', 'Mías'], ['shared', 'De equipo'], ['archived', 'Archivadas']].map(([k, l]) => (
                <Link key={k} href={`/app/recruit/shortlists${k === 'all' ? '' : `?f=${k}`}`} aria-current={filter === k ? 'page' : undefined} className={`inline-flex min-h-9 items-center rounded-full border px-3 ${filter === k ? 'border-brass text-brass' : 'border-line text-muted'}`}>{l}</Link>
              ))}
            </nav>
            {shown.length ? (
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {shown.map((l) => {
                  const m = (members ?? []).filter((x) => x.shortlist_id === l.id);
                  return (
                    <li key={l.id}>
                      <Card className="h-full">
                        <Link href={`/app/recruit/shortlists/${l.id}`} className="font-display text-lg font-bold uppercase text-paper hover:text-brass">{l.name}</Link>
                        <p className="text-xs text-muted">{l.visibility === 'private' ? '🔒 Privada' : 'Equipo'} · {ago(l.updated_at)}</p>
                        <p className="mt-2 text-sm text-paper">{m.length} atleta{m.length === 1 ? '' : 's'} · {m.filter((x) => x.review_status === 'to_review').length} por revisar · {m.filter((x) => active.has(x.athlete_id)).length} en recruiting activo</p>
                        <form action={archiveShortlist} className="mt-2"><input type="hidden" name="list" value={l.id} /><input type="hidden" name="archive" value={l.archived_at ? '0' : '1'} /><button className="text-xs text-muted hover:text-paper">{l.archived_at ? 'Recuperar' : 'Archivar'}</button></form>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            ) : <EmptyState title="Sin shortlists">Crea la primera, por ejemplo «2027 Point Guards», y añade atletas desde Descubrir.</EmptyState>}
            <Card>
              <h2 className="mb-3 font-display text-lg font-bold text-paper">+ Nueva shortlist</h2>
              <ShortlistCreateForm org={org.id} programs={(programs ?? []).map((p) => ({ id: p.id, name: p.name }))} needs={(needs ?? []).map((n) => ({ id: n.id, name: n.title }))} />
            </Card>
          </div>
        )}
      </RecruitShell>
    </>
  );
}
