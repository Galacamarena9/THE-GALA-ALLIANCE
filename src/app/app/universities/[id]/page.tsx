import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, BadgeCheck, CheckCircle2, ExternalLink, Info, Scale, Trash2 } from 'lucide-react';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { loadCatalog } from '@/lib/data/athlete';
import { loadAthleteContext, loadOneMatch } from '@/lib/data/gala-match';
import { myOrganizations } from '@/lib/data/orgs';
import { DIVISION_LABEL, domainOf } from '@/lib/domain/labels';
import { STATE_NAME, estimatedIntlCost, usdFmt } from '@/lib/domain/gala-match/engine';
import { MAJORS, programMatch, resolveMajor } from '@/lib/domain/gala-match/majors';
import {
  ASSOCIATION_LABEL, GENDER_LABEL, LOCALE_LABEL, OPPORTUNITY_SOURCE_LABEL, OPPORTUNITY_STATE_LABEL, OWNERSHIP_LABEL, PROGRAM_SOURCE_LABEL,
  RECRUITING_JOURNEY, opportunitySource, opportunityState, programFamilies,
} from '@/lib/domain/university';
import { logEvent } from '@/lib/events';
import { deleteProgram } from '@/app/actions/universities';
import { ConfidenceBadge, MatchBreakdownV2, MatchScore, SaveButton } from '@/components/match/MatchParts';
import { ClaimForm, ProgramForm } from '@/components/university-forms';
import { InstitutionAdminForm, ReportButton } from '@/components/forms';
import { Card, CardTitle, EmptyState, cx } from '@/components/ui';

export const metadata: Metadata = { title: 'Universidad' };

const TABS = [['resumen', 'Resumen'], ['deportes', 'Deportes'], ['academico', 'Académico'], ['costes', 'Costes'], ['oportunidades', 'Oportunidades'], ['match', 'Tu match'], ['internacional', 'Internacional']] as const;
type Tab = (typeof TABS)[number][0];
const NA = <span className="text-faint">No disponible</span>;

function Fact({ label, children, note }: { label: string; children: React.ReactNode; note?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 font-display text-2xl font-bold tabular-nums text-paper">{children}</dd>
      {note && <p className="mt-1 text-[11px] text-faint">{note}</p>}
    </div>
  );
}

export default async function UniversityPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { tab: t } = await searchParams;
  const session = await requireSession();
  const supabase = await createClient();
  const { data: inst } = await supabase.from('institutions').select('*').eq('id', id).maybeSingle();
  if (!inst) notFound();
  const tab: Tab = TABS.find(([k]) => k === t)?.[0] ?? 'resumen';
  const isAthlete = session.roles.includes('athlete');
  const isAdmin = session.roles.includes('admin');

  const [catalog, { data: programs }, { data: orgs }, myOrgs] = await Promise.all([
    loadCatalog(),
    supabase.from('institution_programs').select('id, sport_id, gender, association, division, conference, program_url, source, source_url, verified_at, updated_at').eq('institution_id', id).order('sport_id'),
    supabase.from('organizations').select('id, name, type, international_support, verification_status').eq('institution_id', id).eq('verification_status', 'verified'),
    myOrganizations(session.userId),
  ]);
  const orgIds = (orgs ?? []).map((o) => o.id);
  const { data: opps } = orgIds.length
    ? await supabase.from('opportunities').select('id, title, type, sport_id, division, deadline, status, updated_at, last_confirmed_at, aid_kind, financial_source, organizations(name, verification_status, type)').in('organization_id', orgIds).eq('status', 'published').order('deadline', { ascending: true, nullsFirst: false })
    : { data: [] };
  const active = (opps ?? []).filter((o) => opportunityState(o) !== 'expired');
  const loaded = isAthlete ? await loadAthleteContext(session.userId) : null;
  const match = loaded ? await loadOneMatch(session.userId, loaded.ctx, 'institution', id) : null;
  if (isAthlete) await logEvent('university_viewed');
  const canManage = isAdmin || myOrgs.some((o) => orgIds.includes(o.id));
  const recruiterOrgs = myOrgs.filter((o) => ['university', 'college'].includes(o.type) && o.verification_status === 'verified');
  const sportName = (s: string) => catalog.sports.find((c) => c.id === s)?.name_es ?? s;
  const intlCost = estimatedIntlCost(inst);
  const confirmedAid = active.some((o) => o.financial_source === 'organization_provided' || o.financial_source === 'platform_verified');
  const fetched = inst.source_fetched_at ? new Date(inst.source_fetched_at).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }) : null;
  const sourceLine = inst.data_source === 'college_scorecard'
    ? <>Fuente: <a className="text-brass hover:underline" href="https://collegescorecard.ed.gov/" target="_blank" rel="noopener noreferrer">College Scorecard, U.S. Department of Education ↗</a>{fetched && ` · actualizado en ${fetched}`}</>
    : <>Fuente: revisión del equipo de Gala{fetched && ` · ${fetched}`}</>;

  return (
    <>
      <Link href="/app/universities" className="text-sm text-brass hover:underline">← Universidades</Link>

      {/* ===== Cabecera: University Recruiting Profile ===== */}
      <header className="carbon mb-5 mt-3 overflow-hidden rounded-[28px] p-5 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="eyebrow text-lime">{[inst.association && ASSOCIATION_LABEL[inst.association as keyof typeof ASSOCIATION_LABEL], inst.division && DIVISION_LABEL[inst.division as keyof typeof DIVISION_LABEL], inst.conference].filter(Boolean).join(' · ') || 'Universidad'}</p>
            <h1 className="mt-2 font-display text-4xl font-bold uppercase leading-[0.9] text-white sm:text-6xl [overflow-wrap:anywhere]">{inst.name}</h1>
            <p className="mt-2 text-sm text-white/75">{[inst.city, STATE_NAME(inst.state)].filter(Boolean).join(', ')}</p>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {[...new Set((programs ?? []).map((p) => p.sport_id))].map((s) => <li key={s} className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/90">{sportName(s)}</li>)}
              {active.length > 0 && <li className="rounded-full bg-lime px-3 py-1 text-xs font-bold text-night">{active.length} oportunidad{active.length > 1 ? 'es' : ''} activa{active.length > 1 ? 's' : ''}</li>}
              {(orgs ?? []).length > 0 && <li className="inline-flex items-center gap-1 rounded-full border border-lime/40 px-3 py-1 text-xs text-lime"><BadgeCheck className="h-3.5 w-3.5" aria-hidden />Cuenta verificada</li>}
            </ul>
          </div>
          {match && (
            <Link href={`?tab=match`} className="flex items-center gap-4 rounded-2xl bg-white/[0.06] p-4 hover:bg-white/10">
              <MatchScore m={match.m} />
              <span><span className="block text-xs text-white/70">Tu Gala Match</span><ConfidenceBadge m={match.m} /></span>
            </Link>
          )}
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          {active.length > 0 && <Link href="?tab=oportunidades" className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-lime px-4 text-sm font-bold text-night">Ver oportunidades<ArrowRight className="h-4 w-4" aria-hidden /></Link>}
          {match && <SaveButton kind="institution" id={id} saved={match.saved} score={match.m.score} />}
          <Link href={`/app/universities/compare?ids=${id}`} className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 text-sm text-white ring-1 ring-white/25 hover:bg-white/10"><Scale className="h-4 w-4" aria-hidden />Comparar</Link>
          {inst.website_url && <a href={inst.website_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 text-sm text-white ring-1 ring-white/25 hover:bg-white/10">Web oficial<ExternalLink className="h-4 w-4" aria-hidden /></a>}
        </div>
      </header>

      <nav aria-label="Secciones de la universidad" className="sticky top-14 z-20 -mx-4 mb-5 overflow-x-auto border-b border-line bg-ink/90 px-4 py-2 backdrop-blur [scrollbar-width:none] md:static md:mx-0 md:rounded-2xl md:border md:px-2">
        <ul className="flex w-max gap-1">
          {TABS.filter(([k]) => k !== 'match' || match).map(([k, l]) => (
            <li key={k}><Link href={`?tab=${k}`} aria-current={tab === k ? 'page' : undefined} className={cx('inline-flex min-h-10 items-center rounded-full px-4 text-sm', tab === k ? 'bg-paper text-ink' : 'text-muted hover:text-paper')}>{l}</Link></li>
          ))}
        </ul>
      </nav>

      {/* ===== RESUMEN ===== */}
      {tab === 'resumen' && (
        <div className="space-y-5">
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Fact label="Tipo">{inst.ownership ? OWNERSHIP_LABEL[inst.ownership as keyof typeof OWNERSHIP_LABEL] : NA}</Fact>
            <Fact label="Estudiantes de grado">{inst.enrollment != null ? Number(inst.enrollment).toLocaleString('es-ES') : NA}</Fact>
            <Fact label="Tasa de graduación" note="En 6 años (150 % del tiempo)">{inst.graduation_rate != null ? `${Math.round(Number(inst.graduation_rate) * 100)} %` : NA}</Fact>
            <Fact label="Entorno">{inst.locale ? LOCALE_LABEL[inst.locale as keyof typeof LOCALE_LABEL] : NA}</Fact>
          </dl>
          <p className="text-xs text-faint">{sourceLine}. Confirma los datos con la universidad antes de decidir.</p>
          <Card>
            <CardTitle kicker="Orientativo">Tu recorrido de recruiting</CardTitle>
            <ol className="relative space-y-4 border-l border-line pl-6">
              {RECRUITING_JOURNEY.map((s, i) => (
                <li key={s.key} className="relative">
                  <span className="absolute -left-[31px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-line-strong bg-surface text-[10px] text-muted">{i + 1}</span>
                  <p className="font-semibold text-paper">{s.label}</p><p className="text-sm text-muted">{s.text}</p>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-xs text-muted">No mostramos fechas regulatorias: dependen de la asociación, la división y el deporte. Consulta la <Link href="/app/guia" className="text-brass hover:underline">guía del proceso</Link>.</p>
          </Card>
        </div>
      )}

      {/* ===== DEPORTES ===== */}
      {tab === 'deportes' && (
        <div className="space-y-5">
          <Card>
            <CardTitle kicker="Programas deportivos">Deportes y categorías</CardTitle>
            {(programs ?? []).length ? (
              <ul className="divide-y divide-line">
                {(programs ?? []).map((p) => (
                  <li key={p.id} className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm">
                    <span>
                      <span className="font-semibold text-paper">{sportName(p.sport_id)} · {GENDER_LABEL[p.gender as keyof typeof GENDER_LABEL]}</span>
                      <span className="block text-muted">{[p.association && ASSOCIATION_LABEL[p.association as keyof typeof ASSOCIATION_LABEL], p.division && DIVISION_LABEL[p.division as keyof typeof DIVISION_LABEL], p.conference].filter(Boolean).join(' · ') || 'Asociación y división no confirmadas'}</span>
                      <span className="block text-[11px] text-faint">{PROGRAM_SOURCE_LABEL[p.source as keyof typeof PROGRAM_SOURCE_LABEL]}{p.source_url && <> · <a href={p.source_url} target="_blank" rel="noopener noreferrer" className="text-brass">fuente ↗</a></>} · actualizado el {new Date(p.updated_at).toLocaleDateString('es-ES')}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      {p.program_url && <a href={p.program_url} target="_blank" rel="noopener noreferrer" className="text-brass hover:underline">Web del equipo ↗</a>}
                      {canManage && <form action={deleteProgram}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="institution_id" value={id} /><button aria-label="Quitar programa" className="rounded-lg p-2 text-faint hover:text-danger"><Trash2 className="h-4 w-4" aria-hidden /></button></form>}
                    </span>
                  </li>
                ))}
              </ul>
            ) : <EmptyState title="Programas deportivos sin confirmar">Aún no tenemos confirmados los deportes de esta universidad. Si la representas, puedes reclamar su perfil.</EmptyState>}
            {inst.athletics_url && <p className="mt-4 text-sm"><a href={inst.athletics_url} target="_blank" rel="noopener noreferrer" className="text-brass hover:underline">Departamento deportivo (web oficial) ↗</a></p>}
          </Card>
          <Card>
            <CardTitle kicker="Cuerpo técnico">Contacto con coaches</CardTitle>
            <p className="text-sm text-muted">No publicamos emails recopilados de internet. Cuando la universidad tiene cuenta verificada, su cuerpo técnico puede contactar contigo dentro de Gala, con tu familia en el circuito si eres menor.</p>
          </Card>
          {canManage && <Card><CardTitle kicker={isAdmin ? 'Admin' : 'Tu universidad'}>Añadir o actualizar un programa</CardTitle><ProgramForm institutionId={id} sports={catalog.sports} isAdmin={isAdmin} /></Card>}
          {isAdmin && <Card><CardTitle kicker="Admin">Asociación, división y enlaces</CardTitle><InstitutionAdminForm inst={inst} /></Card>}
        </div>
      )}

      {/* ===== ACADÉMICO ===== */}
      {tab === 'academico' && (
        <div className="space-y-5">
          {loaded && loaded.ctx.intended_majors.length > 0 && (
            <Card>
              <CardTitle kicker="Academic fit">Lo que quieres estudiar</CardTitle>
              <ul className="space-y-2 text-sm">
                {loaded.ctx.intended_majors.map((txt) => {
                  const m = resolveMajor(txt);
                  const r = m && (inst.program_cips ?? []).length ? programMatch(m, inst.program_cips) : null;
                  return (
                    <li key={txt} className="flex items-start gap-2 text-paper">
                      {r === 'exact' ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-ok" aria-hidden /> : <Info className="mt-0.5 h-4 w-4 text-faint" aria-hidden />}
                      <span><strong>{txt}</strong>: {!m ? 'no lo reconocemos; prueba con un nombre más común.' : !(inst.program_cips ?? []).length ? 'no tenemos el listado oficial de programas de esta universidad.' : r === 'exact' ? `ofrece ${m.label} (coincidencia exacta).` : r === 'related' ? `ofrece programas relacionados con ${m.label}, no el programa exacto.` : 'no figura un programa de grado de ese campo.'}</span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
          <Card>
            <CardTitle kicker="Programas de grado (bachelor)">Áreas de estudio</CardTitle>
            {(inst.program_cips ?? []).length ? (
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {programFamilies(inst.program_cips).map((f) => <li key={f.family} className="flex justify-between rounded-xl border border-line px-3 py-2 text-sm"><span className="text-paper">{f.label}</span><span className="text-muted">{f.programs}</span></li>)}
              </ul>
            ) : <EmptyState title="Programas no disponibles">No tenemos el listado oficial de programas de esta universidad.</EmptyState>}
            <p className="mt-3 text-xs text-faint">{sourceLine}. Taxonomía: CIP (U.S. Department of Education). Ejemplos que reconocemos: {MAJORS.slice(0, 6).map((m) => m.label).join(', ')}…</p>
          </Card>
          <dl className="grid grid-cols-2 gap-3">
            <Fact label="SAT medio de admitidos" note="Orientativo; no es un mínimo y muchas son test-optional">{inst.sat_avg ?? NA}</Fact>
            <Fact label="Tasa de admisión">{inst.admission_rate != null ? `${Math.round(Number(inst.admission_rate) * 100)} %` : NA}</Fact>
          </dl>
        </div>
      )}

      {/* ===== COSTES ===== */}
      {tab === 'costes' && (
        <div className="space-y-5">
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Fact label="Matrícula publicada (no residentes)" note="La que suele pagar un estudiante internacional">{inst.tuition_out_of_state_usd != null ? usdFmt(inst.tuition_out_of_state_usd) : NA}</Fact>
            <Fact label="Coste de asistencia publicado" note="Matrícula, tasas, alojamiento y vida (media oficial)">{inst.cost_attendance_usd != null ? usdFmt(inst.cost_attendance_usd) : NA}</Fact>
            <Fact label="Coste estimado para un internacional" note={inst.ownership === 'public' ? 'Con matrícula de no residente en lugar de la de residente' : 'Igual al coste publicado'}>{intlCost != null ? usdFmt(intlCost) : NA}</Fact>
            <Fact label="Precio neto medio publicado" note="Solo estudiantes con ayuda federal de EE. UU.: no aplica directamente a internacionales">{inst.net_price_usd != null ? usdFmt(inst.net_price_usd) : NA}</Fact>
            <Fact label="Beca deportiva">{confirmedAid ? 'Publicada en una oportunidad' : <span className="text-faint">No confirmada</span>}</Fact>
            <Fact label="Otras ayudas (académicas, por mérito…)"><span className="text-faint">No disponible</span></Fact>
          </dl>
          <Card>
            <CardTitle kicker="Importante">Coste ≠ lo que pagarás</CardTitle>
            <ul className="space-y-1.5 text-sm text-muted">
              <li>· Estas cifras son <strong className="text-paper">antes de becas</strong>. No restamos ninguna beca deportiva que no esté confirmada por escrito.</li>
              <li>· Que una universidad ofrezca becas no significa que tengas una: solo cuenta la que figure en una oferta.</li>
              <li>· Las cifras son medias publicadas; confirma el coste exacto con la universidad.</li>
            </ul>
            {inst.price_calculator_url && <a href={inst.price_calculator_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex text-sm text-brass hover:underline">Calculadora oficial de la universidad ↗</a>}
            <p className="mt-3 text-xs text-faint">{sourceLine}.</p>
          </Card>
        </div>
      )}

      {/* ===== OPORTUNIDADES ===== */}
      {tab === 'oportunidades' && (
        active.length ? (
          <ul className="grid gap-3 lg:grid-cols-2">
            {active.map((o) => {
              const st = opportunityState(o);
              const src = opportunitySource(o.organizations as unknown as { verification_status: string; type: string });
              return (
                <li key={o.id} className="flex h-full flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-display text-xl font-bold uppercase leading-tight text-paper">{o.title}</h2>
                    <span className={cx('shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold', st === 'closing_soon' ? 'border border-warn/40 text-warn' : 'bg-brass text-ink')}>{OPPORTUNITY_STATE_LABEL[st]}</span>
                  </div>
                  <p className="text-sm text-muted">{[sportName(o.sport_id), o.division && DIVISION_LABEL[o.division as keyof typeof DIVISION_LABEL], o.deadline && `Plazo: ${o.deadline}`].filter(Boolean).join(' · ')}</p>
                  <p className="flex items-center gap-1.5 text-xs text-paper"><BadgeCheck className="h-3.5 w-3.5 text-ok" aria-hidden />{OPPORTUNITY_SOURCE_LABEL[src].label}</p>
                  <p className="text-[11px] text-faint">Última actualización: {new Date(o.updated_at).toLocaleDateString('es-ES')}</p>
                  <div className="mt-auto flex flex-wrap gap-2 border-t border-line pt-3">
                    <Link href={`/app/opportunities/${o.id}`} className="inline-flex min-h-10 items-center rounded-full bg-paper px-4 text-sm font-semibold text-ink">Ver oportunidad</Link>
                    {isAthlete && <Link href={`/app/match/opportunity/${o.id}`} className="inline-flex min-h-10 items-center rounded-full px-3 text-sm text-muted hover:text-paper">Ver match</Link>}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState title="Sin oportunidades verificadas activas ahora mismo" action={match && <SaveButton kind="institution" id={id} saved={match.saved} score={match.m.score} />}>
            {match ? 'Guarda esta universidad: te avisaremos cuando publique una oportunidad.' : 'Vuelve más adelante.'} Una universidad en el directorio no implica que tenga becas abiertas.
          </EmptyState>
        )
      )}

      {tab === 'match' && match && <MatchBreakdownV2 m={match.m} />}

      {/* ===== INTERNACIONAL ===== */}
      {tab === 'internacional' && (
        <div className="space-y-5">
          <Card>
            <CardTitle kicker="Para atletas internacionales">Qué implica para ti</CardTitle>
            <ul className="space-y-3 text-sm text-muted">
              <li><strong className="text-paper">Admisión académica.</strong> Es independiente del interés deportivo: la universidad evalúa tu expediente con su propio método. No convertimos tu nota a GPA.</li>
              <li><strong className="text-paper">Inglés.</strong> Muchas universidades piden TOEFL, IELTS, Duolingo u otro certificado; el requisito exacto depende de cada una.</li>
              <li><strong className="text-paper">Evaluación de credenciales.</strong> Algunas piden que un servicio externo evalúe tu expediente extranjero. Confírmalo con admisiones.</li>
              <li><strong className="text-paper">Elegibilidad deportiva.</strong> Depende de la asociación (NCAA, NAIA, NJCAA) y de tu historial; solo la determina el organismo correspondiente.</li>
              <li><strong className="text-paper">Visado y documentación.</strong> Como estudiante necesitarás la documentación que emita la universidad para el visado. No es asesoramiento migratorio: confírmalo con la oficina internacional.</li>
              <li><strong className="text-paper">Coste.</strong> Los internacionales no reciben ayuda federal de EE. UU.; por eso el precio neto publicado no te aplica directamente.</li>
            </ul>
            <p className="mt-4 text-xs text-muted">Más detalle en la <Link href="/app/guia" className="text-brass hover:underline">guía del proceso</Link>.</p>
          </Card>
          {(orgs ?? []).find((o) => o.international_support) && (
            <Card><CardTitle kicker="Según la universidad verificada">Apoyo a internacionales</CardTitle><p className="whitespace-pre-line text-sm leading-relaxed text-muted">{(orgs ?? []).find((o) => o.international_support)!.international_support}</p></Card>
          )}
          <Card>
            <CardTitle kicker="Enlaces oficiales">Información de primera mano</CardTitle>
            <ul className="space-y-1.5 text-sm">
              {([['Admisiones', inst.admissions_url], ['Oficina internacional', inst.international_url], ['Campus virtual', inst.virtual_tour_url]] as const).map(([l, u]) => (
                <li key={l} className="flex justify-between gap-3"><span className="text-muted">{l}</span>{u ? <a href={u} target="_blank" rel="noopener noreferrer" className="truncate text-brass hover:underline">{domainOf(u)} ↗</a> : NA}</li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-faint">{inst.links_verified_at ? `Enlaces revisados el ${new Date(inst.links_verified_at).toLocaleDateString('es-ES')}.` : 'Enlaces pendientes de revisión.'}</p>
          </Card>
        </div>
      )}

      {/* ===== Reclamar ===== */}
      {(session.roles.includes('university') || session.roles.includes('coach')) && !canManage && (
        <Card className="mt-6">
          <CardTitle kicker="¿Trabajas en esta universidad?">Reclamar este perfil</CardTitle>
          <p className="mb-4 text-sm text-muted">Revisamos tu email institucional y tu cargo. Una vez verificada, tu universidad podrá gestionar su perfil, publicar oportunidades y añadir staff.</p>
          <ClaimForm institutionId={id} orgs={recruiterOrgs.map((o) => ({ id: o.id, name: o.name }))} />
        </Card>
      )}
      <div className="mt-6 text-right"><ReportButton entityType="institution" entityId={id} label="Informar de un dato incorrecto" /></div>
    </>
  );
}
