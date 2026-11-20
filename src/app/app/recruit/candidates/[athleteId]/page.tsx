import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { loadCatalog } from '@/lib/data/athlete';
import { currentRecruitOrg, loadCandidate } from '@/lib/data/recruit';
import { INFO_KIND_LABEL, INTERNAL_STAGES, INTERNAL_STAGE_LABEL, needFit, type InternalStage, type NeedCriteria } from '@/lib/domain/recruit';
import { PROVENANCE_LABEL } from '@/lib/domain/passport';
import { Badge, Card, CardTitle, Notice, PageHeader } from '@/components/ui';
import { MediaSwitcher } from '@/components/recruit/MediaSwitcher';
import { RecruitShell } from '@/components/recruit/RecruitShell';
import { AddToShortlist, InfoRequestForm, OrgNoteForm, OrgOfferForm, OrgTaskForm } from '@/components/recruit/RecruitForms';
import { ContactRequestForm, ReportButton } from '@/components/forms';
import { addCandidate, deleteOrgNote, openSharedDocument, toggleOrgTask, updateCandidate } from '@/app/actions/recruit';
import type { DataSource } from '@/lib/types';

export const metadata: Metadata = { title: 'Candidato' };

const ACT: Record<string, string> = {
  candidate_created: 'Entró en el pipeline', stage_changed: 'Cambio de etapa', assigned: 'Asignado', shortlisted: 'Añadido a shortlist', unshortlisted: 'Quitado de shortlist',
  reviewed: 'Revisado', note_added: 'Nota interna', task_created: 'Tarea creada', task_done: 'Tarea hecha', info_requested: 'Información solicitada',
  info_shared: 'El atleta compartió información', info_declined: 'El atleta rechazó la solicitud', document_accessed: 'Documento consultado', offer_recorded: 'Oferta registrada',
};
const fmt = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' });
const Locked = ({ what }: { what: string }) => <p className="flex items-center gap-2 text-sm text-muted">🔒 {what}: privado o no compartido con vuestra organización.</p>;

export default async function CandidatePage({ params, searchParams }: { params: Promise<{ athleteId: string }>; searchParams: Promise<{ org?: string; need?: string }> }) {
  const session = await requireSession();
  const [{ athleteId }, sp] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/.test(athleteId)) notFound();
  const { orgs, org } = await currentRecruitOrg(session.userId, sp.org);
  if (!org) notFound();
  const [d, catalog] = await Promise.all([loadCandidate(org, athleteId), loadCatalog()]);
  if (!d) {
    return (<><PageHeader kicker="Candidato" title="Perfil no disponible" /><Notice tone="warn">Este atleta no comparte su perfil con vuestra organización (o ya no está disponible). Gala no muestra datos que no tengas permiso para ver.</Notice></>);
  }
  const supabase = await createClient();
  const [{ data: minorRow }, { data: needs }, { data: lists }] = await Promise.all([
    supabase.rpc('viewer_is_minor', { p_user: athleteId }),
    supabase.from('recruiting_needs').select('id, title, sport_id, position_ids, class_years, min_height_cm, requires_video, requires_documented_academics, countries').eq('organization_id', org.id).eq('status', 'active'),
    supabase.from('org_shortlists').select('id, name').eq('organization_id', org.id).is('archived_at', null),
  ]);
  const minor = minorRow !== false;
  const need = (needs ?? []).find((n) => n.id === sp.need) ?? (needs ?? [])[0];
  const verifiedStats = d.stats.filter((s) => s.source !== 'self_reported').length;
  const fit = need ? needFit(need as NeedCriteria, { ...d.dir, academics_documented: d.academics ? d.academics.gpa_source !== 'self_reported' : null, verified_stats: d.stats.length ? verifiedStats : null }) : null;
  const pos = catalog.positions.find((p) => p.id === d.dir.primary_position_id)?.name_es;
  const sport = catalog.sports.find((s) => s.id === d.dir.sport_id)?.name_es;
  const memberName = new Map(d.members.map((m) => [m.id, m.name]));
  const c = d.candidate;
  const highlight = d.videos.find((v) => v.kind === 'highlight') ?? d.videos[0];

  return (
    <>
      <p className="mb-2 text-sm"><Link href="/app/recruit/candidates" className="text-muted hover:text-brass">← Pipeline</Link></p>
      <PageHeader kicker={[sport, pos, d.dir.graduation_year && `Clase ${d.dir.graduation_year}`].filter(Boolean).join(' · ') || 'Candidato'} title={d.dir.display_name}
        description={<>{d.dir.country ?? ''}{d.dir.height_cm ? ` · ${(d.dir.height_cm / 100).toFixed(2)} m` : ''}{d.dir.current_team ? ` · ${d.dir.current_team}` : ''}</>}
        action={<span className="flex flex-wrap gap-2"><Link href={`/athletes/${athleteId}`} className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm font-semibold text-paper">Passport completo</Link><AddToShortlist athlete={athleteId} lists={(lists ?? []).map((l) => ({ id: l.id, name: l.name }))} fit={fit?.score ?? null} /></span>} />
      <RecruitShell org={org} orgs={orgs} active="/app/recruit/candidates">
        {minor && <Notice tone="brass">🛡️ Protecciones de menor activas: sin datos de contacto directos; cualquier contacto o solicitud pasa por Gala y su familia.</Notice>}
        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <div className="min-w-0 space-y-6">
            {/* Vídeo primero: es lo primero que mira un coach. */}
            <Card>
              <CardTitle kicker="Vídeo">{highlight ? highlight.title || 'Highlight reel' : 'Vídeo'}</CardTitle>
              {highlight ? (
                <>
                  <MediaSwitcher videos={d.videos} athlete={d.dir.display_name ?? 'Atleta'} />
                  {!d.videos.some((v) => v.kind === 'full_game') && <p className="mt-2 text-xs text-warn">⚠ Sin partido completo compartido. Puedes solicitarlo abajo.</p>}
                </>
              ) : d.dir.has_video ? <p className="text-sm text-muted">Vídeo disponible en el Passport.</p> : <Locked what="Vídeo" />}
            </Card>

            {fit && need && (
              <Card>
                <CardTitle kicker={`Encaje con «${need.title}»`}>{fit.blocked ? 'No cumple un requisito' : fit.score != null ? `${fit.score}%` : 'Datos insuficientes'}</CardTitle>
                <ul className="grid gap-1 text-sm sm:grid-cols-2">
                  {fit.met.map((x) => <li key={x.key} className="text-ok">✓ {x.label}</li>)}
                  {fit.unmet.map((x) => <li key={x.key} className="text-danger">✕ {x.label}</li>)}
                  {fit.missing.map((x) => <li key={x.key} className="text-warn">⚠ {x.label}: no disponible</li>)}
                </ul>
                <p className="mt-2 text-[11px] text-faint">Compatibilidad con criterios registrados, no valoración del talento ni ranking.</p>
                {(needs ?? []).length > 1 && <p className="mt-2 flex flex-wrap gap-2 text-xs">{(needs ?? []).map((n) => <Link key={n.id} href={`?need=${n.id}`} className={n.id === need.id ? 'font-semibold text-brass' : 'text-muted'}>{n.title}</Link>)}</p>}
              </Card>
            )}

            <Card>
              <CardTitle kicker="Rendimiento">Estadísticas</CardTitle>
              {d.stats.length ? (
                <ul className="divide-y divide-line text-sm">
                  {d.stats.map((s, i) => {
                    const def = s.sport_stat_definitions as unknown as { label_es: string; unit: string | null } | null;
                    return <li key={i} className="flex justify-between gap-2 py-2"><span className="text-paper">{def?.label_es} <span className="text-xs text-muted">· {s.season}{s.competition ? ` · ${s.competition}` : ''}</span></span><span className="font-semibold text-paper">{s.value}{def?.unit ? ` ${def.unit}` : ''} <Badge tone={s.source === 'self_reported' ? 'neutral' : 'ok'}>{PROVENANCE_LABEL[s.source as DataSource]?.short ?? s.source}</Badge></span></li>;
                  })}
                </ul>
              ) : <Locked what="Estadísticas" />}
              {d.achievements.length > 0 && <ul className="mt-3 space-y-1 text-sm text-paper">{d.achievements.map((a, i) => <li key={i}>🏅 {a.title}{a.year ? ` (${a.year})` : ''}</li>)}</ul>}
            </Card>

            <Card>
              <CardTitle kicker="Académico">Información autorizada</CardTitle>
              {d.academics && org.caps.has('academic') ? (
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <dt className="text-muted">Nota (sistema original)</dt><dd className="text-paper">{d.academics.grade_display ?? (d.academics.gpa != null ? `${d.academics.gpa}/${d.academics.gpa_scale}` : '—')} <Badge tone={d.academics.gpa_source === 'self_reported' ? 'neutral' : 'ok'}>{PROVENANCE_LABEL[d.academics.gpa_source as DataSource]?.short}</Badge></dd>
                  <dt className="text-muted">Sistema educativo</dt><dd className="text-paper">{d.academics.education_system ?? '—'}</dd>
                  <dt className="text-muted">Inglés</dt><dd className="text-paper">{d.academics.english_test ? `${d.academics.english_test} ${d.academics.english_score ?? ''}` : 'Sin certificado'} {d.academics.english_test && <Badge tone={d.academics.english_source === 'self_reported' ? 'neutral' : 'ok'}>{PROVENANCE_LABEL[d.academics.english_source as DataSource]?.short}</Badge>}</dd>
                  {(d.academics.sat_score || d.academics.act_score) && (<><dt className="text-muted">SAT / ACT</dt><dd className="text-paper">{d.academics.sat_score ?? '—'} / {d.academics.act_score ?? '—'}</dd></>)}
                </dl>
              ) : <Locked what="Académico" />}
              <p className="mt-2 text-[11px] text-faint">Contexto internacional: Gala muestra la nota en su sistema original y no hace equivalencias oficiales de GPA. La evaluación oficial corresponde a admisiones o al centro de elegibilidad.</p>
            </Card>

            <Card>
              <CardTitle kicker="Historial">Actividad del equipo</CardTitle>
              {d.activity.length ? (
                <ol className="relative space-y-3 border-l border-line pl-5">
                  {d.activity.map((a) => {
                    const det = a.detail as Record<string, string>;
                    return (
                      <li key={a.id} className="relative text-sm">
                        <span className="absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full bg-brass" aria-hidden />
                        <span className="text-paper">{ACT[a.kind] ?? a.kind}{a.kind === 'stage_changed' ? `: ${INTERNAL_STAGE_LABEL[det.to as InternalStage] ?? det.to}` : ''}{det.list ? ` · ${det.list}` : ''}{det.kind ? ` · ${INFO_KIND_LABEL[det.kind] ?? det.kind}` : ''}</span>
                        <span className="block text-xs text-faint">{fmt.format(new Date(a.created_at))} · {a.actor_id ? memberName.get(a.actor_id) ?? 'Atleta / sistema' : 'Sistema'}</span>
                      </li>
                    );
                  })}
                </ol>
              ) : <p className="text-sm text-muted">Sin actividad todavía.</p>}
            </Card>
          </div>

          <aside className="space-y-6" aria-label="Recruiting">
            <Card>
              <CardTitle kicker="Pipeline interno">{c ? INTERNAL_STAGE_LABEL[c.internal_stage as InternalStage] : 'Fuera del pipeline'}</CardTitle>
              {c ? (
                org.caps.has('pipeline') ? (
                  <div className="space-y-2">
                    <form action={updateCandidate} className="flex gap-2"><input type="hidden" name="id" value={c.id} /><input type="hidden" name="athlete" value={athleteId} /><input type="hidden" name="op" value="stage" />
                      <label className="sr-only" htmlFor="cs">Etapa</label>
                      <select id="cs" name="stage" defaultValue={c.internal_stage} className="min-h-11 flex-1 rounded-lg border border-line bg-ink/40 px-2 text-sm text-paper">{INTERNAL_STAGES.map((s) => <option key={s} value={s}>{INTERNAL_STAGE_LABEL[s]}</option>)}</select>
                      <button className="min-h-11 rounded-lg border border-line px-3 text-xs font-semibold text-paper">Cambiar</button>
                    </form>
                    <form action={updateCandidate} className="flex gap-2"><input type="hidden" name="id" value={c.id} /><input type="hidden" name="athlete" value={athleteId} /><input type="hidden" name="op" value="assign" />
                      <label className="sr-only" htmlFor="ca">Asignado a</label>
                      <select id="ca" name="assignee" defaultValue={c.assigned_to ?? ''} className="min-h-11 flex-1 rounded-lg border border-line bg-ink/40 px-2 text-sm text-paper"><option value="">Sin asignar</option>{d.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
                      <button className="min-h-11 rounded-lg border border-line px-3 text-xs font-semibold text-paper">Asignar</button>
                    </form>
                    <form action={updateCandidate}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="athlete" value={athleteId} /><input type="hidden" name="op" value={c.archived_at ? 'restore' : 'archive'} /><button className="text-xs text-muted hover:text-paper">{c.archived_at ? 'Recuperar' : 'Archivar'}</button></form>
                  </div>
                ) : <p className="text-sm text-muted">Asignado: {c.assigned_to ? memberName.get(c.assigned_to) : '—'}</p>
              ) : org.caps.has('pipeline') && (
                <form action={addCandidate}><input type="hidden" name="org" value={org.id} /><input type="hidden" name="athlete" value={athleteId} /><button className="min-h-11 rounded-full bg-brass px-4 text-xs font-semibold text-ink">Añadir al pipeline</button></form>
              )}
              {d.applications.length > 0 && (
                <div className="mt-3 border-t border-line pt-2 text-xs">
                  <p className="font-semibold text-faint">Candidaturas (estado que ve el atleta)</p>
                  {d.applications.map((a) => <p key={a.id} className="text-paper">{(a.opportunities as unknown as { title: string }).title} · {a.status}</p>)}
                </div>
              )}
              {d.lists.length > 0 && <p className="mt-2 text-xs text-muted">En shortlists: {d.lists.map((l) => (l.org_shortlists as unknown as { name: string } | null)?.name).filter(Boolean).join(', ')}</p>}
            </Card>

            {org.caps.has('notes') && (
              <Card>
                <CardTitle kicker="🔒 Interno">Notas del staff</CardTitle>
                {d.notes.length > 0 && (
                  <ul className="mb-3 space-y-2">
                    {d.notes.map((n) => (
                      <li key={n.id} className="rounded-xl bg-ink/40 p-2.5 text-sm">
                        <p className="whitespace-pre-line text-paper">{n.body}</p>
                        <p className="mt-1 text-[11px] text-faint">{n.author_id ? memberName.get(n.author_id) ?? 'Antiguo miembro' : '—'} · {fmt.format(new Date(n.created_at))}
                          {n.author_id === session.userId && <form action={deleteOrgNote} className="ml-2 inline"><input type="hidden" name="id" value={n.id} /><input type="hidden" name="athlete" value={athleteId} /><button className="hover:text-danger">Eliminar</button></form>}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
                <OrgNoteForm org={org.id} athlete={athleteId} />
              </Card>
            )}

            {org.caps.has('tasks') && (
              <Card>
                <CardTitle kicker="Equipo">Tareas</CardTitle>
                {d.tasks.length > 0 && (
                  <ul className="mb-3 space-y-1.5 text-sm">
                    {d.tasks.map((t) => (
                      <li key={t.id} className="flex items-center gap-2">
                        <form action={toggleOrgTask}><input type="hidden" name="id" value={t.id} /><input type="hidden" name="athlete" value={athleteId} /><input type="hidden" name="done" value={t.status === 'done' ? '0' : '1'} /><button aria-label={t.status === 'done' ? 'Reabrir' : 'Hecha'} className={`grid h-6 w-6 place-items-center rounded-md border ${t.status === 'done' ? 'border-brass bg-brass text-white' : 'border-line'}`}>{t.status === 'done' ? '✓' : ''}</button></form>
                        <span className={`flex-1 ${t.status === 'done' ? 'text-muted line-through' : 'text-paper'}`}>{t.title}</span>
                        <span className="text-xs text-muted">{t.assignee_id ? memberName.get(t.assignee_id) : ''} {t.due_date ?? ''}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <OrgTaskForm org={org.id} athlete={athleteId} members={d.members.map((m) => ({ id: m.id, name: m.name }))} />
              </Card>
            )}

            <Card>
              <CardTitle kicker="Documentos">Solicitudes de información</CardTitle>
              {d.requests.length > 0 && (
                <ul className="mb-3 space-y-2 text-sm">
                  {d.requests.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-paper">{INFO_KIND_LABEL[r.kind]}</span>
                      <span className="flex items-center gap-2">
                        <Badge tone={r.status === 'shared' ? 'ok' : r.status === 'declined' || r.status === 'revoked' ? 'danger' : 'warn'}>{({ pending: 'Pendiente', pending_guardian: 'Pendiente (familia)', shared: `Compartido hasta ${r.shared_until}`, declined: 'Rechazada', revoked: 'Retirado', expired: 'Caducado' } as Record<string, string>)[r.status as string] ?? r.status}</Badge>
                        {r.status === 'shared' && r.document_id && <form action={openSharedDocument}><input type="hidden" name="request" value={r.id} /><button className="text-xs font-semibold text-brass">Abrir</button></form>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mb-2 text-[11px] text-faint">«Disponible en el Passport» no significa «compartido con vosotros»: solo verás documentos que el atleta (o su familia) comparta, y hasta la fecha que elija.</p>
              {org.caps.has('request_info') ? <InfoRequestForm org={org.id} athlete={athleteId} minor={minor} /> : <p className="text-xs text-muted">Tu rol no permite solicitar información.</p>}
            </Card>

            {org.caps.has('contact') && (
              <Card>
                <CardTitle kicker="Comunicación segura">Contactar en Gala</CardTitle>
                <p className="mb-2 text-xs text-muted">{minor ? 'Al ser menor, la solicitud llega primero a su familia. Nunca se muestran teléfono ni email personales.' : 'El atleta decide si acepta. La conversación queda en Gala, con historial y opción de denuncia.'}</p>
                <ContactRequestForm organizations={[{ id: org.id, name: org.name }]} athleteId={athleteId} isMinor={minor} />
              </Card>
            )}

            {c && org.caps.has('offers') && ['active', 'offer', 'call', 'contact'].includes(c.internal_stage) && (
              <Card>
                <CardTitle kicker="Oferta">Registrar oferta real</CardTitle>
                <OrgOfferForm candidate={c.id} athlete={athleteId} />
              </Card>
            )}
            <div className="text-right"><ReportButton entityType="athlete_profile" entityId={athleteId} label="Reportar un problema con este perfil" /></div>
          </aside>
        </div>
      </RecruitShell>
    </>
  );
}
