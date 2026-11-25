import { getT } from '@/lib/i18n/server-t';
import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { currentRecruitOrg, loadMembers } from '@/lib/data/recruit';
import { BOARD_INTERNAL, INTERNAL_STAGES, INTERNAL_STAGE_LABEL, type InternalStage } from '@/lib/domain/recruit';
import { Badge, Card, EmptyState, Notice, PageHeader } from '@/components/ui';
import { RecruitShell } from '@/components/recruit/RecruitShell';
import { bulkCandidates } from '@/app/actions/recruit';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('Pipeline de recruiting') };
}

const daysIn = (d: string) => Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
const SOURCE: Record<string, string> = { discovery: 'Descubierto', application: 'Candidatura', shortlist: 'Shortlist', referral: 'Recomendación' };

export default async function CandidatesPage({ searchParams }: { searchParams: Promise<{ org?: string; stage?: string; mine?: string; archived?: string; error?: string }> }) {
  const tx = await getT();
  const session = await requireSession();
  const sp = await searchParams;
  const { orgs, org } = await currentRecruitOrg(session.userId, sp.org);
  const supabase = await createClient();
  let q = org ? supabase.from('org_candidates').select('id, athlete_id, internal_stage, assigned_to, source, application_id, stage_changed_at, archived_at').eq('organization_id', org.id).order('stage_changed_at', { ascending: false }).limit(500) : null;
  if (q) q = sp.archived ? q.not('archived_at', 'is', null) : q.is('archived_at', null);
  if (q && sp.mine) q = q.eq('assigned_to', session.userId);
  const [{ data: rows }, members] = org && q ? await Promise.all([q, loadMembers(org.id)]) : [{ data: [] }, []];
  const ids = (rows ?? []).map((r) => r.athlete_id);
  const { data: dir } = ids.length ? await supabase.from('athlete_directory').select('user_id, display_name, graduation_year, country').in('user_id', ids) : { data: [] };
  const dm = new Map((dir ?? []).map((d) => [d.user_id, d]));
  const memberName = new Map(members.map((m) => [m.id, m.name]));
  const stageFilter = INTERNAL_STAGES.includes(sp.stage as InternalStage) ? (sp.stage as InternalStage) : null;
  const list = (rows ?? []).filter((r) => !stageFilter || r.internal_stage === stageFilter);

  return (
    <>
      <PageHeader kicker={tx('Recruiting')} title={tx('Pipeline')} description={tx('Estado interno de cada candidato. El atleta nunca ve estas etapas: solo el estado de su candidatura.')} />
      <RecruitShell org={org} orgs={orgs} active="/app/recruit/candidates">
        {sp.error === 'document' && <Notice tone="danger">{tx('El documento ya no está compartido contigo o la concesión ha caducado.')}</Notice>}
        {org && !org.caps.has('candidates') ? <Notice tone="warn">{tx('Tu rol no incluye ver candidatos.')}</Notice> : org && (
          <div className="space-y-4">
            <nav aria-label={tx('Filtros')} className="flex flex-wrap gap-2 text-xs">
              <Link href="/app/recruit/candidates" className={`inline-flex min-h-9 items-center rounded-full border px-3 ${!stageFilter && !sp.mine && !sp.archived ? 'border-brass text-brass' : 'border-line text-muted'}`}>Todos ({(rows ?? []).length})</Link>
              <Link href="/app/recruit/candidates?mine=1" className={`inline-flex min-h-9 items-center rounded-full border px-3 ${sp.mine ? 'border-brass text-brass' : 'border-line text-muted'}`}>{tx('Asignados a mí')}</Link>
              {BOARD_INTERNAL.map((s) => {
                const n = (rows ?? []).filter((r) => r.internal_stage === s).length;
                return <Link key={s} href={`/app/recruit/candidates?stage=${s}`} className={`inline-flex min-h-9 items-center rounded-full border px-3 ${stageFilter === s ? 'border-brass bg-brass/10 text-brass' : 'border-line text-muted'}`}>{tx(INTERNAL_STAGE_LABEL[s])} · {n}</Link>;
              })}
              <Link href="/app/recruit/candidates?archived=1" className={`inline-flex min-h-9 items-center rounded-full border px-3 ${sp.archived ? 'border-brass text-brass' : 'border-line text-muted'}`}>{tx('Archivados')}</Link>
            </nav>
            {!list.length ? <EmptyState title={tx('Sin candidatos aquí')}>{tx('Llegan solos cuando un atleta se presenta a una oportunidad, o al iniciar un proceso desde una shortlist o desde Descubrir.')}</EmptyState> : (
              <form action={bulkCandidates}>
                <Card className="p-0">
                  <ul className="divide-y divide-line">
                    {list.map((r) => {
                      const d = dm.get(r.athlete_id);
                      return (
                        <li key={r.id} className="flex items-center gap-3 p-3">
                          {org.caps.has('pipeline') && <input type="checkbox" name="ids" value={r.id} aria-label={`Seleccionar ${d?.display_name ?? 'candidato'}`} className="h-5 w-5" />}
                          <div className="min-w-0 flex-1">
                            <Link href={`/app/recruit/candidates/${r.athlete_id}`} className="font-semibold text-paper hover:text-brass">{d?.display_name ?? tx('Perfil no visible')}</Link>
                            <p className="text-xs text-muted">{[d?.graduation_year && `${tx('Clase')} ${d.graduation_year}`, d?.country, tx(SOURCE[r.source])].filter(Boolean).join(' · ')}{r.assigned_to ? ` · ${memberName.get(r.assigned_to) ?? tx('Asignado')}` : tx(' · Sin asignar')}</p>
                          </div>
                          <div className="text-right">
                            <Badge tone={r.internal_stage === 'new' ? 'warn' : 'brass'}>{tx(INTERNAL_STAGE_LABEL[r.internal_stage as InternalStage])}</Badge>
                            <p className="mt-1 text-[11px] text-faint">{daysIn(r.stage_changed_at)} d en la etapa</p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </Card>
                {org.caps.has('pipeline') && (
                  <div className="sticky bottom-20 mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface p-3 lg:bottom-4">
                    <span className="text-xs text-muted">{tx('Seleccionados:')}</span>
                    <label className="sr-only" htmlFor="bulk-stage">{tx('Nueva etapa')}</label>
                    <select id="bulk-stage" name="stage" className="min-h-11 rounded-lg border border-line bg-ink/40 px-2 text-sm text-paper">{INTERNAL_STAGES.map((s) => <option key={s} value={s}>{tx(INTERNAL_STAGE_LABEL[s])}</option>)}</select>
                    <button name="op" value="stage" className="min-h-11 rounded-full border border-line px-4 text-xs font-semibold text-paper">{tx('Cambiar etapa')}</button>
                    <button name="op" value="archive" className="min-h-11 rounded-full px-3 text-xs text-muted">{tx('Archivar')}</button>
                    <span className="text-[11px] text-faint">{tx('Sin mensajes masivos: el contacto siempre es individual.')}</span>
                  </div>
                )}
              </form>
            )}
          </div>
        )}
      </RecruitShell>
    </>
  );
}
