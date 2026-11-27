import { getT } from '@/lib/i18n/server-t';
import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { currentRecruitOrg } from '@/lib/data/recruit';
import { Card, EmptyState, Notice, PageHeader, inputClass } from '@/components/ui';
import { RecruitShell } from '@/components/recruit/RecruitShell';
import { ShortlistCreateForm } from '@/components/recruit/RecruitForms';
import { archiveShortlist } from '@/app/actions/recruit';
import { importPersonalLists } from '@/app/actions/saved-searches';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('Shortlists') };
}

const ago = (d: string, tx: (s: string) => string) => {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  return days <= 0 ? tx('Actualizada hoy') : days === 1 ? tx('Actualizada ayer') : tx(`Actualizada hace ${days} días`);
};

export default async function ShortlistsPage({ searchParams }: { searchParams: Promise<{ org?: string; f?: string }> }) {
  const tx = await getT();
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
  // Listas personales antiguas (saved_athletes): no se borran; se pueden copiar a una shortlist del equipo.
  const { count: personal } = org ? await supabase.from('saved_athletes').select('athlete_id', { count: 'exact', head: true }).eq('owner_id', session.userId) : { count: 0 };
  const active = new Set((cands ?? []).filter((c) => ['contact', 'call', 'active', 'offer'].includes(c.internal_stage)).map((c) => c.athlete_id));
  const filter = sp.f === 'mine' || sp.f === 'shared' || sp.f === 'archived' ? sp.f : 'all';
  const shown = (lists ?? []).filter((l) => (filter === 'archived' ? l.archived_at : !l.archived_at) && (filter === 'mine' ? l.owner_id === session.userId : filter === 'shared' ? l.owner_id !== session.userId || l.visibility !== 'private' : true));

  return (
    <>
      <PageHeader kicker={tx('Recruiting')} title={tx('Shortlists')} description={tx('Interés preliminar del staff. Una shortlist no es un proceso: cuando quieras avanzar, inicia el recruiting.')} />
      <RecruitShell org={org} orgs={orgs} active="/app/recruit/shortlists">
        {org && !org.caps.has('shortlist') ? <Notice tone="warn">{tx('Tu rol o el estado de verificación no permite usar shortlists.')}</Notice> : org && (
          <div className="space-y-5">
            {(personal ?? 0) > 0 && org.caps.has('shortlist') && (lists ?? []).some((l) => !l.archived_at) && (
              <Card>
                <p className="text-sm font-semibold text-paper">{tx('Tienes atletas guardados en tus listas personales')} ({personal})</p>
                <p className="mt-1 text-xs text-muted">{tx('Ahora tu organización trabaja con un solo sistema de listas: las shortlists del equipo. Cópialos a una para que el staff los vea; tus listas personales no se borran.')}</p>
                <form action={importPersonalLists} className="mt-3 flex flex-wrap items-end gap-2">
                  <label className="text-xs text-muted">{tx('Copiar a')}
                    <select name="list" className={inputClass}>{(lists ?? []).filter((l) => !l.archived_at).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
                  </label>
                  <button className="min-h-11 rounded-full bg-brass px-5 text-sm font-semibold text-ink">{tx('Copiar a la shortlist')}</button>
                </form>
              </Card>
            )}
            <nav aria-label={tx('Filtrar shortlists')} className="flex gap-2 text-xs">
              {[['all', tx('Todas')], ['mine', tx('Mías')], ['shared', tx('De equipo')], ['archived', tx('Archivadas')]].map(([k, l]) => (
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
                        <p className="text-xs text-muted">{{ private: tx('🔒 Privada'), shared: tx('Compartida'), program: tx('Programa'), team: tx('Equipo') }[l.visibility as string] ?? tx('Equipo')} · {ago(l.updated_at, tx)}</p>
                        <p className="mt-2 text-sm text-paper">{m.length} atleta{m.length === 1 ? '' : 's'} · {m.filter((x) => x.review_status === 'to_review').length} por revisar · {m.filter((x) => active.has(x.athlete_id)).length} en recruiting activo</p>
                        <form action={archiveShortlist} className="mt-2"><input type="hidden" name="list" value={l.id} /><input type="hidden" name="archive" value={l.archived_at ? '0' : '1'} /><button className="text-xs text-muted hover:text-paper">{l.archived_at ? tx('Recuperar') : tx('Archivar')}</button></form>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            ) : <EmptyState title={tx('Sin shortlists')}>{tx('Crea la primera, por ejemplo «2027 Point Guards», y añade atletas desde Descubrir.')}</EmptyState>}
            <Card>
              <h2 className="mb-3 font-display text-lg font-bold text-paper">{tx('+ Nueva shortlist')}</h2>
              <ShortlistCreateForm org={org.id} programs={(programs ?? []).map((p) => ({ id: p.id, name: p.name }))} needs={(needs ?? []).map((n) => ({ id: n.id, name: n.title }))} />
            </Card>
          </div>
        )}
      </RecruitShell>
    </>
  );
}
