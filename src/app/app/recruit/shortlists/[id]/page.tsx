import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { loadCatalog } from '@/lib/data/athlete';
import { currentRecruitOrg, loadMembers } from '@/lib/data/recruit';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui';
import { RecruitShell } from '@/components/recruit/RecruitShell';
import { OrgNoteForm } from '@/components/recruit/RecruitForms';
import { AssignSheet, PromoteSheet } from '@/components/recruit/ShortlistActions';
import { shareShortlist, updateShortlistMember } from '@/app/actions/recruit';
import { INTERNAL_STAGE_LABEL, type InternalStage } from '@/lib/domain/recruit';

export const metadata: Metadata = { title: 'Shortlist' };

export default async function ShortlistDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const session = await requireSession();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await createClient();
  const { data: list } = await supabase.from('org_shortlists').select('id, name, visibility, organization_id, need_id, program_id, owner_id, org_programs(name)').eq('id', id).maybeSingle();
  if (!list) notFound();
  const { orgs, org } = await currentRecruitOrg(session.userId, list.organization_id);
  if (!org) notFound();
  const [{ data: rows }, members, catalog, { data: cands }, { data: needs }, { data: opps }, { data: access }] = await Promise.all([
    supabase.from('org_shortlist_members').select('athlete_id, review_status, priority, assigned_to, fit_at_add, position, added_at').eq('shortlist_id', id).order('position').order('added_at'),
    loadMembers(org.id),
    loadCatalog(),
    supabase.from('org_candidates').select('athlete_id, internal_stage').eq('organization_id', org.id).is('archived_at', null),
    supabase.from('recruiting_needs').select('id, title').eq('organization_id', org.id).eq('status', 'active'),
    supabase.from('opportunities').select('id, title').eq('organization_id', org.id).eq('status', 'published'),
    supabase.from('shortlist_access').select('user_id, access_role, revoked_at').eq('shortlist_id', id).is('revoked_at', null),
  ]);
  const isOwner = list.owner_id === session.userId;
  const programName = (list.org_programs as unknown as { name: string } | null)?.name ?? null;
  const VIS: Record<string, string> = { private: 'Shortlist privada', shared: 'Compartida con personas concretas', program: 'Staff del programa', team: 'Shortlist de equipo' };
  const ids = (rows ?? []).map((r) => r.athlete_id);
  const { data: dir } = ids.length ? await supabase.from('athlete_directory').select('user_id, display_name, primary_position_id, graduation_year, country, has_video, height_cm').in('user_id', ids) : { data: [] };
  const { data: stats } = ids.length ? await supabase.from('athlete_statistics').select('athlete_id, source').in('athlete_id', ids).neq('source', 'self_reported') : { data: [] };
  const dm = new Map((dir ?? []).map((d) => [d.user_id, d]));
  const posName = new Map(catalog.positions.map((p) => [p.id, p.name_es]));
  const memberName = new Map(members.map((m) => [m.id, m.name]));
  const stage = new Map((cands ?? []).map((c) => [c.athlete_id, c.internal_stage as InternalStage]));
  const tab = ['to_review', 'reviewed', 'active'].includes(sp.tab ?? '') ? sp.tab : 'all';
  const shown = (rows ?? []).filter((r) => tab === 'all' ? true : tab === 'active' ? ['contact', 'call', 'active', 'offer'].includes(stage.get(r.athlete_id) ?? '') : r.review_status === tab);
  const hidden = ids.length - (dir ?? []).length;

  return (
    <>
      <p className="mb-2 text-sm"><Link href="/app/recruit/shortlists" className="text-muted hover:text-brass">← Shortlists</Link></p>
      <PageHeader kicker={VIS[list.visibility] ?? 'Shortlist'} title={list.name} description={`${ids.length} atleta${ids.length === 1 ? '' : 's'}`}
        action={ids.length > 1 ? <span className="flex gap-2">
          <Link href={`/app/recruit/compare?ids=${ids.slice(0, 3).join(',')}`} className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm font-semibold text-paper">Comparar</Link>
          {org.caps.has('export') && <a href={`/api/recruit/export?list=${id}`} className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm font-semibold text-paper">Exportar CSV</a>}
        </span> : undefined} />
      <RecruitShell org={org} orgs={orgs} active="/app/recruit/shortlists">
        <nav aria-label="Filtrar atletas" className="flex gap-2 text-xs">
          {[['all', 'Todos'], ['to_review', 'Por revisar'], ['reviewed', 'Revisados'], ['active', 'En recruiting']].map(([k, l]) => (
            <Link key={k} href={`/app/recruit/shortlists/${id}${k === 'all' ? '' : `?tab=${k}`}`} aria-current={tab === k ? 'page' : undefined} className={`inline-flex min-h-9 items-center rounded-full border px-3 ${tab === k ? 'border-brass text-brass' : 'border-line text-muted'}`}>{l}</Link>
          ))}
        </nav>
        {hidden > 0 && <p className="text-xs text-muted">{hidden} atleta{hidden > 1 ? 's' : ''} ya no comparte{hidden > 1 ? 'n' : ''} su perfil contigo y no se muestra{hidden > 1 ? 'n' : ''}.</p>}
        {!shown.length ? <EmptyState title="Nada en este filtro">Añade atletas desde <Link href="/app/recruit/discover" className="text-brass underline">Descubrir</Link>.</EmptyState> : (
          <ul className="space-y-3">
            {shown.map((r, i) => {
              const d = dm.get(r.athlete_id);
              if (!d) return null;
              const st = stage.get(r.athlete_id);
              const hasVerified = (stats ?? []).some((s) => s.athlete_id === r.athlete_id);
              const hiddenFields = (op: string, extra: Record<string, string> = {}) => (<><input type="hidden" name="list" value={id} /><input type="hidden" name="athlete" value={r.athlete_id} /><input type="hidden" name="op" value={op} />{Object.entries(extra).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}</>);
              return (
                <li key={r.athlete_id}>
                  <Card>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link href={`/app/recruit/candidates/${r.athlete_id}`} className="font-display text-lg font-bold uppercase text-paper hover:text-brass">{r.priority ? '★ ' : ''}{d.display_name}</Link>
                        <p className="text-xs text-muted">{[d.primary_position_id && posName.get(d.primary_position_id), d.graduation_year, d.country].filter(Boolean).join(' · ')}</p>
                        <p className="mt-1 text-xs text-paper">{r.fit_at_add != null ? `${r.fit_at_add}% encaje al añadir · ` : ''}Vídeo {d.has_video ? '✓' : '—'} · Stats {hasVerified ? 'verificadas ✓' : 'declaradas'}{r.assigned_to ? ` · Asignado: ${memberName.get(r.assigned_to) ?? '—'}` : ''}</p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge tone={r.review_status === 'reviewed' ? 'ok' : 'warn'}>{r.review_status === 'reviewed' ? 'Revisado' : 'Por revisar'}</Badge>
                        {st && <Badge tone="brass">{INTERNAL_STAGE_LABEL[st]}</Badge>}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Link href={`/app/recruit/candidates/${r.athlete_id}`} className="inline-flex min-h-11 items-center rounded-full bg-brass px-4 text-xs font-semibold text-ink">Ver ficha y vídeo</Link>
                      <form action={updateShortlistMember}>{hiddenFields(r.review_status === 'reviewed' ? 'to_review' : 'reviewed')}<button className="min-h-11 rounded-full border border-line px-3 text-xs text-paper">{r.review_status === 'reviewed' ? 'Marcar por revisar' : 'Marcar revisado'}</button></form>
                      <details className="relative">
                        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center rounded-full border border-line px-3 text-xs text-paper" aria-label={`Más acciones para ${d.display_name}`}>Más ⋯</summary>
                        <div className="mt-2 space-y-3 rounded-2xl border border-line bg-surface p-3 sm:w-96">
                          <AssignSheet list={id} athlete={r.athlete_id} current={r.assigned_to} members={members.filter((m) => !['viewer', 'admissions', 'compliance'].includes(m.role)).map((m) => ({ id: m.id, name: m.name }))} />
                          <div className="flex flex-wrap gap-2">
                            <form action={updateShortlistMember}>{hiddenFields(r.priority ? 'unpriority' : 'priority')}<button className="min-h-11 rounded-lg border border-line px-3 text-xs text-paper">{r.priority ? 'Quitar prioridad' : 'Prioridad'}</button></form>
                            {i > 0 && <form action={updateShortlistMember}>{hiddenFields('up')}<button className="min-h-11 rounded-lg border border-line px-3 text-xs text-paper" aria-label="Subir">↑</button></form>}
                            {i < shown.length - 1 && <form action={updateShortlistMember}>{hiddenFields('down')}<button className="min-h-11 rounded-lg border border-line px-3 text-xs text-paper" aria-label="Bajar">↓</button></form>}
                            <form action={updateShortlistMember}>{hiddenFields('remove')}<button className="min-h-11 rounded-lg px-3 text-xs text-danger">Quitar de la lista</button></form>
                          </div>
                          {org.caps.has('notes') && <OrgNoteForm org={org.id} athlete={r.athlete_id} />}
                          {org.caps.has('pipeline') && (
                            <PromoteSheet list={id} athlete={r.athlete_id} name={d.display_name} program={programName} defaultNeed={list.need_id}
                              needs={(needs ?? []).map((n) => ({ id: n.id, name: n.title }))} opportunities={(opps ?? []).map((o) => ({ id: o.id, name: o.title }))} />
                          )}
                        </div>
                      </details>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
        {(isOwner || org.caps.has('manage_members')) && list.visibility !== 'team' && (
          <section aria-labelledby="share" className="mt-6 rounded-2xl border border-line p-4">
            <h2 id="share" className="mb-2 font-display text-lg font-bold text-paper">Compartir con el staff</h2>
            <ul className="mb-3 space-y-1 text-sm">
              {(access ?? []).map((a) => (
                <li key={a.user_id} className="flex items-center justify-between gap-2">
                  <span className="text-paper">{memberName.get(a.user_id) ?? 'Miembro'} <span className="text-xs text-muted">· {a.access_role === 'editor' ? 'Editor' : a.access_role === 'contributor' ? 'Colaborador' : 'Solo lectura'}</span></span>
                  <form action={shareShortlist}><input type="hidden" name="list" value={id} /><input type="hidden" name="user" value={a.user_id} /><input type="hidden" name="revoke" value="1" /><button className="min-h-11 px-2 text-xs text-danger">Quitar acceso</button></form>
                </li>
              ))}
              {!(access ?? []).length && <li className="text-xs text-muted">Nadie más tiene acceso todavía.</li>}
            </ul>
            <form action={shareShortlist} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_160px_auto]">
              <input type="hidden" name="list" value={id} />
              <label className="sr-only" htmlFor="sh-user">Persona</label>
              <select id="sh-user" name="user" required className="min-h-11 rounded-lg border border-line bg-ink/40 px-2 text-sm text-paper">
                {members.filter((m) => m.id !== list.owner_id && !(access ?? []).some((a) => a.user_id === m.id)).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <label className="sr-only" htmlFor="sh-role">Permiso</label>
              <select id="sh-role" name="role" className="min-h-11 rounded-lg border border-line bg-ink/40 px-2 text-sm text-paper"><option value="viewer">Solo lectura</option><option value="contributor">Colaborador</option><option value="editor">Editor</option></select>
              <button className="min-h-11 rounded-lg bg-brass px-4 text-sm font-semibold text-ink">Compartir</button>
            </form>
            <p className="mt-2 text-[11px] text-faint">Solo personas de tu organización con acceso a shortlists. No hay enlaces públicos.</p>
          </section>
        )}
      </RecruitShell>
    </>
  );
}
