import type { Metadata } from 'next';
import Link from 'next/link';
import { setOpportunityLifecycle } from '@/app/actions/universities';
import { OPPORTUNITY_SOURCE_LABEL, OPPORTUNITY_STATE_LABEL, opportunitySource, opportunityState } from '@/lib/domain/university';
import { TrustSeal } from '@/components/TrustSeal';
import { assessOpportunity } from '@/lib/domain/trust';
import { logEvent } from '@/lib/events';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { loadCatalog, loadPassport } from '@/lib/data/athlete';
import { CONFIDENCE_LABEL, matchAthleteToOpportunity, TIER_LABEL } from '@/lib/domain/match';
import { MatchBreakdown } from '@/components/MatchBreakdown';
import { DIVISION_LABEL, OPPORTUNITY_STATUS_LABEL, OPPORTUNITY_TYPE_LABEL, domainOf, usd } from '@/lib/domain/labels';
import type { Opportunity } from '@/lib/types';
import { Badge, Card, CardTitle, EmptyState, Notice, PageHeader, buttonClass } from '@/components/ui';
import { ApplyOpportunityForm, ReportButton } from '@/components/forms';
import { deleteOpportunity, submitForReview } from '@/app/actions/opportunities';
import { AnswerQuestionForm, AskQuestionForm } from '@/components/QuestionForms';
import { ProgramPanel, type PanelEnrollment, type ProgramDetails } from '@/components/trials/ProgramPanel';
import { PARTICIPANT_FILTERS, TrialPanel, type PanelDetails, type PanelMaterial, type PanelRequirement, type ParticipantFilter } from '@/components/trials/TrialPanel';
import { CLUB_TYPES, PUBLISH_GAP_LABEL, isProgramType, isTrialType, type AttendanceStatus, type CostComponent, type InvitationStatus, type Outcome, type RegistrationStatus } from '@/lib/domain/trials';
import { CONTACT_METHOD_LABEL, INTERNATIONAL_LABEL, REQUIRED_MATERIAL_LABEL, ROLE_CAPS, ROLE_LABEL, SCHOLARSHIP_LABEL, type OrgRole } from '@/lib/domain/recruit';

export const metadata: Metadata = { title: 'Oportunidad' };
const CLUB_TYPES_LIST: readonly string[] = CLUB_TYPES;

export default async function OpportunityPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ view?: string; publish?: string; pf?: string; pq?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const session = await requireSession();
  const supabase = await createClient();

  const { data: raw } = await supabase
    .from('opportunities')
    .select('*, organizations(id, name, type, verification_status, website, institution_id)')
    .eq('id', id)
    .maybeSingle();
  if (!raw) notFound();
  const opp = raw as Opportunity & { organizations: { id: string; name: string; type: string; verification_status: string; website: string | null; institution_id: string | null } | null };
  const catalog = await loadCatalog();
  const positions = catalog.positions.filter((p) => opp.position_ids.includes(p.id)).map((p) => p.name_es);
  const sport = catalog.sports.find((s) => s.id === opp.sport_id)?.name_es;

  const { data: membership } = await supabase.from('organization_members').select('member_role').eq('organization_id', opp.organization_id).eq('user_id', session.userId).maybeSingle();
  const member = Boolean(membership);
  // «Ver como atleta»: el staff revisa exactamente lo que verá un atleta antes de publicar (sin controles internos).
  const preview = member && sp.view === 'athlete';
  const isMember = member && !preview;
  const isAthlete = session.roles.includes('athlete');
  const extra = raw as unknown as { scholarship_status?: string; required_materials?: string[]; international_eligible?: string; contact_method?: string; expires_at?: string | null };
  // Quién verá las candidaturas: roles del equipo con permiso sobre candidatos (espejo de org_role_caps).
  const { data: staff } = preview ? await supabase.from('organization_members').select('member_role').eq('organization_id', opp.organization_id) : { data: null };
  const reviewers = [...new Set((staff ?? []).map((m) => m.member_role as OrgRole).filter((r) => ROLE_CAPS[r]?.includes('candidates')))];
  if (isAthlete && !isMember) await logEvent('opportunity_viewed');
  const { data: questions } = await supabase.from('opportunity_questions').select('id, body, answer, answered_at, created_at').eq('opportunity_id', id).order('created_at', { ascending: false }).limit(50);
  const answered = (questions ?? []).filter((q) => q.answered_at);
  const pending = (questions ?? []).filter((q) => !q.answered_at);

  const passport = isAthlete ? await loadPassport(session.userId) : null;
  const match = passport?.profile ? matchAthleteToOpportunity({ ...passport.profile, annual_budget_usd: passport.annualBudgetUsd }, passport.academics, opp) : null;
  const { data: myApp } = isAthlete
    ? await supabase.from('applications').select('id, status').eq('opportunity_id', id).eq('athlete_id', session.userId).maybeSingle()
    : { data: null };

  // Trials: detalles, costes, requisitos y participación (inscripciones, invitaciones, candidaturas) en paralelo; la RLS filtra.
  const trial = isTrialType(opp.type);
  // Programas de academia: mismas tablas de costes/requisitos/candidaturas + su especialización y matrículas (11E · QA-02).
  const program = isProgramType(opp.type);
  const [{ data: eventDetails }, { data: costRows }, { data: reqRows }, { data: matRows }, { data: trialRegs }, { data: trialInvs }, { data: trialApps }, { data: confirmedCount }] = trial || program
    ? await Promise.all([
        program ? supabase.from('academy_program_details').select('*').eq('opportunity_id', id).maybeSingle() : supabase.from('trial_details').select('*').eq('opportunity_id', id).maybeSingle(),
        supabase.from('opportunity_cost_components').select('component_type, label, amount, currency, required, included, period').eq('opportunity_id', id).order('sort'),
        supabase.from('opportunity_requirements').select('kind, strength, label, params').eq('opportunity_id', id).order('sort'),
        supabase.from('opportunity_required_materials').select('material, label, required, sensitivity').eq('opportunity_id', id),
        supabase.from('opportunity_registrations').select('id, athlete_id, status, origin, needs_athlete_ok, guardian_status, materials_status, athlete_update, updated_at, opportunity_attendance(status, check_in_at)').eq('opportunity_id', id).order('updated_at', { ascending: false }).limit(300),
        supabase.from('opportunity_invitations').select('id, athlete_id, status, guardian_required').eq('opportunity_id', id).limit(300),
        supabase.from('applications').select('id, athlete_id, status, guardian_consent_status, materials_complete').eq('opportunity_id', id).limit(300),
        supabase.rpc('opportunity_visible_confirmed_count', { p_opp: id }),
      ])
    : [{ data: null }, { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: 0 }];
  // Resultados internos: solo los lee el staff con permiso (RLS); el atleta nunca los recibe.
  const { data: outcomeRows } = trial && member ? await supabase.from('opportunity_outcomes').select('registration_id, outcome').eq('opportunity_id', id) : { data: [] };
  const outcomeOf = new Map((outcomeRows ?? []).map((o) => [o.registration_id as string, o.outcome as string]));
  const { data: enrRows } = program
    ? await supabase.from('program_enrollments').select('id, athlete_id, status, guardian_status, aid_amount, aid_currency, starts_on, ends_on').eq('opportunity_id', id).limit(300)
    : { data: [] };
  const regAthleteIds = [...new Set([...(trialRegs ?? []), ...(trialInvs ?? []), ...(trialApps ?? []), ...(enrRows ?? [])].map((r) => r.athlete_id as string))];
  const { data: regNames } = regAthleteIds.length ? await supabase.from('athlete_directory').select('user_id, display_name').in('user_id', regAthleteIds) : { data: [] };
  const nameOf = Object.fromEntries((regNames ?? []).map((n) => [n.user_id, n.display_name ?? 'Atleta']));
  const who = (athleteId: string) => (athleteId === session.userId ? 'Tú' : nameOf[athleteId] ?? 'Atleta');
  // Qué falta para publicar (lo calcula la base de datos, la misma regla que bloquea la publicación).
  const { data: gaps } = isMember && CLUB_TYPES_LIST.includes(opp.type) && ['draft', 'rejected'].includes(opp.status) ? await supabase.rpc('opportunity_publish_gaps', { p_opp: id }) : { data: null };
  const publishGaps = ((gaps as string[] | null) ?? []).map((g) => PUBLISH_GAP_LABEL[g] ?? g);
  const oppCore = raw as unknown as { start_at: string | null; end_at: string | null; timezone: string | null; city: string | null; region: string | null; country: string | null; venue_name: string | null; age_category_code: string | null; age_category_custom: string | null };
  if (program && isAthlete && !member) void logEvent('academy_program_viewed');
  if (trial && isAthlete && !member) {
    void logEvent('trial_viewed');
    if (/Mobi|Android/i.test((await headers()).get('user-agent') ?? '')) void logEvent('trial_mobile_viewed');
  }

  const net = opp.annual_cost_usd != null && opp.aid_amount_usd != null ? opp.annual_cost_usd - opp.aid_amount_usd : null;
  const closed = opp.deadline ? new Date(`${opp.deadline}T23:59:59`) < new Date() : false;

  // Matching inverso: talento compatible para la organización (solo lo que la RLS deja ver).
  let compatible: { a: { user_id: string; display_name: string | null; graduation_year: number | null; current_team: string | null; has_video: boolean }; m: ReturnType<typeof matchAthleteToOpportunity> }[] = [];
  if (isMember && opp.status === 'published') {
    const { data: dir } = await supabase
      .from('athlete_directory')
      .select('user_id, display_name, sport_id, primary_position_id, secondary_position_id, graduation_year, target_divisions, current_team, has_video')
      .eq('sport_id', opp.sport_id)
      .eq('open_to_opportunities', true)
      .limit(200);
    const ids = (dir ?? []).map((d) => d.user_id);
    const { data: acads } = ids.length ? await supabase.from('athlete_academics').select('athlete_id, gpa, gpa_scale, english_test, english_score').in('athlete_id', ids) : { data: [] };
    const acadById = new Map((acads ?? []).map((a) => [a.athlete_id, a]));
    compatible = (dir ?? [])
      .map((a) => ({ a, m: matchAthleteToOpportunity(a, acadById.get(a.user_id) ?? null, opp) }))
      .filter((x) => x.m.tier !== 'not_eligible')
      .sort((x, y) => y.m.score - x.m.score)
      .slice(0, 12);
  }

  return (
    <>
      <PageHeader
        kicker={`${OPPORTUNITY_TYPE_LABEL[opp.type]}${opp.division ? ` · ${DIVISION_LABEL[opp.division]}` : ''}`}
        title={opp.title}
        description={
          <span>
            {opp.organizations?.name}
            {opp.organizations?.verification_status === 'verified' && <span className="ml-2 text-brass">✓ {OPPORTUNITY_SOURCE_LABEL[opportunitySource(opp.organizations)].label}</span>}
            {!isMember && <span className="ml-2 rounded-full border border-line px-2 py-0.5 text-xs text-paper">{OPPORTUNITY_STATE_LABEL[opportunityState(opp)]}</span>}
            {opp.organizations?.website && (
              <> · <a href={opp.organizations.website} target="_blank" rel="noopener noreferrer" className="text-brass hover:underline">{domainOf(opp.organizations.website)} ↗</a></>
            )}
            {opp.organizations?.institution_id && (
              <> · <Link href={`/app/universities/${opp.organizations.institution_id}`} className="text-brass hover:underline">Ficha de la universidad</Link></>
            )}
          </span>
        }
      />

      {publishGaps.length > 0 && (
        <div className="mb-5">
          <Notice tone={sp.publish === 'incomplete' ? 'danger' : 'warn'}>
            <strong>{sp.publish === 'incomplete' ? 'No se ha enviado a revisión: faltan datos.' : 'Antes de publicar:'}</strong>
            <ul className="mt-1 list-disc pl-5">{publishGaps.map((g) => <li key={g}>{g}</li>)}</ul>
          </Notice>
        </div>
      )}

      {preview && (
        <div className="mb-5">
          <Notice tone="brass">
            <strong>Vista previa como atleta.</strong> Así verá esta oportunidad un atleta: requisitos, información económica y materiales que pedís.
            {' '}Las candidaturas las podrán ver: {reviewers.length ? reviewers.map((r) => ROLE_LABEL[r] ?? r).join(', ') : 'los miembros con permiso sobre candidatos'} de vuestra organización. Las notas internas y la necesidad vinculada nunca se muestran.
            {' '}<Link href={`/app/opportunities/${opp.id}`} className="font-semibold underline">Salir de la vista previa</Link>
          </Notice>
        </div>
      )}

      {isMember && (
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <Link href={`/app/opportunities/${opp.id}?view=athlete`} className="rounded-lg border border-line-strong px-3 py-1.5 text-sm text-paper hover:border-brass">Ver como atleta</Link>
          <Badge tone={opp.status === 'published' ? 'ok' : opp.status === 'rejected' ? 'danger' : 'warn'}>{OPPORTUNITY_STATUS_LABEL[opp.status]}</Badge>
          {opp.review_note && <span className="text-sm text-muted">Nota de revisión: {opp.review_note}</span>}
          {opp.status === 'published' && (
            <>
              <form action={setOpportunityLifecycle}><input type="hidden" name="id" value={opp.id} /><button name="action" value="confirm" className={buttonClass('secondary', 'sm')}>Confirmar que sigue abierta</button></form>
              <form action={setOpportunityLifecycle}><input type="hidden" name="id" value={opp.id} /><button name="action" value="filled" className={buttonClass('secondary', 'sm')}>Marcar plaza cubierta</button></form>
              <form action={setOpportunityLifecycle}><input type="hidden" name="id" value={opp.id} /><button name="action" value="closed" className="text-sm text-faint hover:text-danger">Cerrar</button></form>
            </>
          )}
          {(opp.status === 'draft' || opp.status === 'rejected') && (
            <>
              <form action={submitForReview}><input type="hidden" name="id" value={opp.id} /><button className={buttonClass('primary', 'sm')}>Enviar a revisión</button></form>
              <form action={deleteOpportunity}><input type="hidden" name="id" value={opp.id} /><button className="text-sm text-faint hover:text-danger">Eliminar</button></form>
            </>
          )}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          <Card>
            <CardTitle kicker="La oportunidad">Descripción</CardTitle>
            <p className="whitespace-pre-line leading-relaxed text-muted">{opp.description}</p>
            <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
              <div><dt className="text-faint">Deporte</dt><dd className="text-paper">{sport}</dd></div>
              <div><dt className="text-faint">Posiciones</dt><dd className="text-paper">{positions.length ? positions.join(', ') : 'Cualquiera'}</dd></div>
              <div><dt className="text-faint">Clase (graduación)</dt><dd className="text-paper">{opp.graduation_years.length ? opp.graduation_years.join(', ') : 'Cualquiera'}</dd></div>
              <div><dt className="text-faint">Nota mínima</dt><dd className="text-paper">{opp.min_gpa_4 != null ? `${opp.min_gpa_4} / 4.0` : 'No indicada'}</dd></div>
              <div><dt className="text-faint">Inglés</dt><dd className="text-paper">{opp.english_required ?? 'No indicado'}</dd></div>
              <div><dt className="text-faint">Plazas</dt><dd className="text-paper">{opp.places ?? 'No indicado'}</dd></div>
              <div><dt className="text-faint">Ubicación</dt><dd className="text-paper">{opp.location ?? '—'}</dd></div>
              <div><dt className="text-faint">Inicio · Plazo</dt><dd className="text-paper">{opp.start_term ?? '—'} · {opp.deadline ?? 'Abierto'}</dd></div>
            </dl>
          </Card>

          <Card>
            <CardTitle kicker="Transparencia financiera">Coste real</CardTitle>
            <dl className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-ink/50 p-4"><dt className="text-xs text-faint">Coste anual</dt><dd className="font-display text-2xl tabular-nums text-paper">{usd(opp.annual_cost_usd)}</dd></div>
              <div className="rounded-xl bg-ink/50 p-4"><dt className="text-xs text-faint">Ayuda anual</dt><dd className="font-display text-2xl tabular-nums text-paper">{usd(opp.aid_amount_usd)}</dd></div>
              <div className="rounded-xl border border-brass/40 bg-ink/50 p-4"><dt className="text-xs text-brass">Neto familia / año</dt><dd className="font-display text-2xl tabular-nums text-paper">{net == null ? 'Incompleto' : usd(net)}</dd></div>
            </dl>
            <p className="mt-4 text-xs text-faint">
              Origen de las cifras: {opp.financial_source === 'platform_verified' ? 'verificadas por la plataforma' : opp.financial_source === 'organization_provided' ? 'aportadas por la organización (sin verificar)' : 'sin cifras publicadas'}.
              Una ayuda solo cuenta cuando está por escrito en la oferta. <Link href="/app/calculator" className="text-brass hover:underline">Calcular a 4 años →</Link>
            </p>
          </Card>

          <Card>
            <CardTitle kicker="Antes de aplicar">Requisitos y proceso</CardTitle>
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div><dt className="text-faint">Beca</dt><dd className="text-paper">{SCHOLARSHIP_LABEL[extra.scholarship_status ?? 'not_provided']}</dd></div>
              <div><dt className="text-faint">Atletas internacionales</dt><dd className="text-paper">{INTERNATIONAL_LABEL[extra.international_eligible ?? 'unknown']}</dd></div>
              <div><dt className="text-faint">Contacto</dt><dd className="text-paper">{CONTACT_METHOD_LABEL[extra.contact_method ?? 'gala']}</dd></div>
              <div><dt className="text-faint">Activa hasta</dt><dd className="text-paper">{extra.expires_at ?? opp.deadline ?? 'No indicado'}</dd></div>
            </dl>
            <div className="mt-4">
              <p className="text-sm text-faint">Qué te pedirán</p>
              {extra.required_materials?.length ? (
                <ul className="mt-1 flex flex-wrap gap-2">{extra.required_materials.map((m) => <li key={m} className="rounded-full border border-line px-3 py-1 text-xs text-paper">{REQUIRED_MATERIAL_LABEL[m] ?? m}</li>)}</ul>
              ) : <p className="text-sm text-muted">La organización no ha indicado materiales concretos.</p>}
              <p className="mt-2 text-[11px] text-faint">Aplicar no comparte tus documentos privados: cada documento se comparte solo si tú (o tu familia, si eres menor) lo autorizas.</p>
            </div>
          </Card>

          <TrustSeal {...assessOpportunity(opp)} />
        </div>

        <div className="space-y-5">
          {match && (
            <Card className="paper-grain">
              <MatchBreakdown match={match} />
              {isAthlete && <Link href={`/app/match/opportunity/${opp.id}`} className="mt-4 inline-flex text-sm font-semibold text-brass hover:underline">Ver el desglose completo de Gala Match →</Link>}
            </Card>
          )}

          {program && (
            <ProgramPanel
              opportunityId={opp.id}
              details={(eventDetails as unknown as ProgramDetails) ?? null}
              core={{ start_at: oppCore.start_at, end_at: oppCore.end_at, timezone: oppCore.timezone, city: oppCore.city, region: oppCore.region, country: oppCore.country, venue_name: oppCore.venue_name, age_category: oppCore.age_category_code ?? oppCore.age_category_custom }}
              costs={(costRows ?? []) as unknown as CostComponent[]}
              requirements={(reqRows ?? []) as unknown as PanelRequirement[]}
              materials={(matRows ?? []) as unknown as PanelMaterial[]}
              me={isAthlete && !member ? session.userId : null}
              enrollments={(enrRows ?? []).map((e) => ({ ...(e as unknown as PanelEnrollment), name: who(e.athlete_id as string), aid_amount: e.aid_amount == null ? null : Number(e.aid_amount) }))}
              applications={isMember ? (trialApps ?? []).map((a) => ({ id: a.id as string, athlete_id: a.athlete_id as string, status: a.status as string, guardian_consent_status: a.guardian_consent_status as string, name: who(a.athlete_id as string) })) : []}
              asClub={isMember}
              asFamily={session.roles.includes('parent')}
            />
          )}

          {trial && (
            <TrialPanel
              opportunityId={opp.id}
              open={opp.status === 'published' && !closed}
              details={(eventDetails as unknown as PanelDetails) ?? null}
              core={{ start_at: oppCore.start_at, end_at: oppCore.end_at, timezone: oppCore.timezone, city: oppCore.city, region: oppCore.region, country: oppCore.country, venue_name: oppCore.venue_name, age_category: oppCore.age_category_code ?? oppCore.age_category_custom }}
              costs={(costRows ?? []) as unknown as CostComponent[]}
              requirements={(reqRows ?? []) as unknown as PanelRequirement[]}
              materials={(matRows ?? []) as unknown as PanelMaterial[]}
              confirmed={Number(confirmedCount ?? 0)}
              me={isAthlete && !member ? session.userId : null}
              registrations={(trialRegs ?? []).map((r) => {
                const att = (r.opportunity_attendance as unknown as { status: AttendanceStatus; check_in_at: string | null } | null);
                return {
                  id: r.id as string, athlete_id: r.athlete_id as string, status: r.status as RegistrationStatus, origin: r.origin as string, needs_athlete_ok: r.needs_athlete_ok as boolean,
                  guardian_status: r.guardian_status as string, name: who(r.athlete_id as string), athlete_update: r.athlete_update as string | null,
                  attendance: att?.status ?? null, check_in_at: att?.check_in_at ?? null, outcome: (outcomeOf.get(r.id as string) as Outcome | undefined) ?? null,
                  materials_status: r.materials_status as 'not_required' | 'pending' | 'complete',
                };
              })}
              invitations={(trialInvs ?? []).map((i) => ({ id: i.id as string, athlete_id: i.athlete_id as string, status: i.status as InvitationStatus, guardian_required: i.guardian_required as boolean, name: who(i.athlete_id as string) }))}
              applications={isMember ? (trialApps ?? []).map((a) => ({ id: a.id as string, athlete_id: a.athlete_id as string, status: a.status as string, guardian_consent_status: a.guardian_consent_status as string, materials_complete: a.materials_complete as boolean, name: who(a.athlete_id as string) })) : (trialApps ?? []).filter((a) => a.athlete_id === session.userId).map((a) => ({ id: a.id as string, athlete_id: a.athlete_id as string, status: a.status as string, guardian_consent_status: a.guardian_consent_status as string, name: 'Tú' }))}
              asClub={isMember}
              asFamily={session.roles.includes('parent')}
              preview={preview}
              participantFilter={sp.pf && sp.pf in PARTICIPANT_FILTERS ? (sp.pf as ParticipantFilter) : 'all'}
              filterHref={(f) => `/app/opportunities/${opp.id}?pf=${f}${sp.pq ? `&pq=${encodeURIComponent(sp.pq)}` : ''}#participantes`}
              participantQuery={(sp.pq ?? '').slice(0, 60)}
            />
          )}

          {!trial && isAthlete && opp.status === 'published' && (
            <Card>
              <CardTitle kicker="Candidatura">{myApp ? 'Ya has aplicado' : closed ? 'Plazo cerrado' : 'Aplicar'}</CardTitle>
              {myApp ? (
                <Link href="/app/applications" className="text-sm text-brass hover:underline">Ver el estado de tu candidatura →</Link>
              ) : closed ? (
                <p className="text-sm text-muted">El plazo de esta oportunidad terminó.</p>
              ) : (
                <ApplyOpportunityForm
                  opportunityId={opp.id}
                  warning={match?.tier === 'not_eligible' ? 'No cumples algún requisito obligatorio. Puedes aplicar igualmente, pero revisa los puntos en rojo.' : undefined}
                />
              )}
            </Card>
          )}

          {!isAthlete && !isMember && <Notice tone="neutral">Las candidaturas las envían los atletas desde su Passport.</Notice>}
          <div className="text-right"><ReportButton entityType="opportunity" entityId={opp.id} label="Denunciar esta oportunidad" /></div>
        </div>
      </div>

      {isMember && opp.status === 'published' && (
        <Card className="mt-5">
          <CardTitle kicker="Matching" action={<Link href="/app/applications" className="text-sm text-brass hover:underline">Ver candidaturas</Link>}>Talento compatible</CardTitle>
          {compatible.length ? (
            <ul className="divide-y divide-line">
              {compatible.map(({ a, m }) => (
                <li key={a.user_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <Link href={`/athletes/${a.user_id}`} className="min-w-0 text-paper hover:text-brass">
                    {a.display_name}
                    <span className="block text-xs text-faint">Clase {a.graduation_year ?? '—'} · {a.current_team ?? 'Equipo sin indicar'}{a.has_video ? ' · ▶ vídeo' : ''}</span>
                  </Link>
                  <span className="flex items-center gap-3">
                    {m.missing.length > 0 && <span className="hidden text-xs text-warn sm:inline">{m.missing.length} dato(s) por confirmar</span>}
                    <Badge tone={m.tier === 'strong' ? 'ok' : 'brass'}>{TIER_LABEL[m.tier]}</Badge>
                    {m.confidence === 'low' && <Badge tone="warn">{CONFIDENCE_LABEL.low}</Badge>}
                    <span className={`w-10 text-right font-display text-xl tabular-nums ${m.confidence === 'low' ? 'text-faint' : 'text-paper'}`}>{m.score}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Aún no hay atletas compatibles visibles para ti">Los perfiles aparecen aquí cuando encajan con deporte, posición, año y nota. Los menores solo son visibles para organizaciones verificadas.</EmptyState>
          )}
        </Card>
      )}
      {opp.status === 'published' && (
        <Card className="mt-5">
          <CardTitle kicker="Preguntas y respuestas">Lo que otros atletas han preguntado</CardTitle>
          {answered.length > 0 ? (
            <ul className="mb-5 divide-y divide-line">
              {answered.map((q) => (
                <li key={q.id} className="py-4 first:pt-0">
                  <p className="font-semibold text-paper">{q.body}</p>
                  <p className="mt-1.5 border-l-2 border-brass pl-3 text-sm leading-relaxed text-muted"><span className="font-semibold text-brass">{opp.organizations?.name ?? 'La universidad'}:</span> {q.answer}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-5 text-sm text-muted">Aún no hay preguntas respondidas. Las respuestas que dé la universidad quedarán aquí para todos.</p>
          )}
          {isMember && pending.length > 0 && (
            <div className="mb-5 rounded-2xl border border-brass/30 bg-brass/5 p-4">
              <p className="mb-3 text-sm font-semibold text-paper">{pending.length} pregunta{pending.length > 1 ? 's' : ''} por responder</p>
              <ul className="space-y-4">
                {pending.map((q) => <li key={q.id}><p className="text-sm text-paper">“{q.body}”</p><AnswerQuestionForm id={q.id} opportunityId={opp.id} /></li>)}
              </ul>
            </div>
          )}
          {!isMember && pending.length > 0 && <p className="mb-4 text-xs text-faint">Tienes {pending.length} pregunta{pending.length > 1 ? 's' : ''} pendiente{pending.length > 1 ? 's' : ''} de respuesta.</p>}
          {!isMember && <AskQuestionForm opportunityId={opp.id} />}
        </Card>
      )}
    </>
  );
}
