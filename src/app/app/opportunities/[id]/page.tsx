import type { Metadata } from 'next';
import Link from 'next/link';
import { TrustSeal } from '@/components/TrustSeal';
import { assessOpportunity } from '@/lib/domain/trust';
import { logEvent } from '@/lib/events';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { loadCatalog, loadPassport } from '@/lib/data/athlete';
import { matchAthleteToOpportunity, TIER_LABEL } from '@/lib/domain/match';
import { DIVISION_LABEL, OPPORTUNITY_STATUS_LABEL, OPPORTUNITY_TYPE_LABEL, domainOf, usd } from '@/lib/domain/labels';
import type { Opportunity } from '@/lib/types';
import { Badge, Card, CardTitle, EmptyState, Notice, PageHeader } from '@/components/ui';
import { ApplyOpportunityForm, ReportButton } from '@/components/forms';
import { deleteOpportunity, submitForReview } from '@/app/actions/opportunities';

export const metadata: Metadata = { title: 'Oportunidad' };

export default async function OpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
  const isMember = Boolean(membership);
  const isAthlete = session.roles.includes('athlete');
  if (isAthlete && !isMember) await logEvent('opportunity_viewed');

  const passport = isAthlete ? await loadPassport(session.userId) : null;
  const match = passport?.profile ? matchAthleteToOpportunity({ ...passport.profile, annual_budget_usd: passport.annualBudgetUsd }, passport.academics, opp) : null;
  const { data: myApp } = isAthlete
    ? await supabase.from('applications').select('id, status').eq('opportunity_id', id).eq('athlete_id', session.userId).maybeSingle()
    : { data: null };

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
            {opp.organizations?.verification_status === 'verified' && <span className="ml-2 text-brass">✓ Organización verificada</span>}
            {opp.organizations?.website && (
              <> · <a href={opp.organizations.website} target="_blank" rel="noopener noreferrer" className="text-brass hover:underline">{domainOf(opp.organizations.website)} ↗</a></>
            )}
            {opp.organizations?.institution_id && (
              <> · <Link href={`/app/universities/${opp.organizations.institution_id}`} className="text-brass hover:underline">Ficha de la universidad</Link></>
            )}
          </span>
        }
      />

      {isMember && (
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <Badge tone={opp.status === 'published' ? 'ok' : opp.status === 'rejected' ? 'danger' : 'warn'}>{OPPORTUNITY_STATUS_LABEL[opp.status]}</Badge>
          {opp.review_note && <span className="text-sm text-muted">Nota de revisión: {opp.review_note}</span>}
          {(opp.status === 'draft' || opp.status === 'rejected') && (
            <>
              <form action={submitForReview}><input type="hidden" name="id" value={opp.id} /><button className="rounded-lg bg-brass px-3 py-1.5 text-sm text-ink">Enviar a revisión</button></form>
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

          <TrustSeal {...assessOpportunity(opp)} />
        </div>

        <div className="space-y-5">
          {match && (
            <Card className="paper-grain">
              <CardTitle kicker="Tu encaje" action={<span className="font-display text-4xl tabular-nums text-paper">{match.score}</span>}>
                {TIER_LABEL[match.tier]}
              </CardTitle>
              {match.met.length > 0 && <ul className="space-y-1 text-sm text-ok">{match.met.map((m) => <li key={m}>✓ {m}</li>)}</ul>}
              {match.unmet.length > 0 && <ul className="mt-2 space-y-1 text-sm text-danger">{match.unmet.map((m) => <li key={m}>✗ {m}</li>)}</ul>}
              {match.missing.length > 0 && <ul className="mt-2 space-y-1 text-sm text-warn">{match.missing.map((m) => <li key={m}>? {m}</li>)}</ul>}
              <p className="mt-4 text-xs text-faint">Compatibilidad, no probabilidad de admisión ni de beca. Motor {match.version}.</p>
            </Card>
          )}

          {isAthlete && opp.status === 'published' && (
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
                    <span className="w-10 text-right font-display text-xl tabular-nums text-paper">{m.score}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Aún no hay atletas compatibles visibles para ti">Los perfiles aparecen aquí cuando encajan con deporte, posición, año y nota. Los menores solo son visibles para organizaciones verificadas.</EmptyState>
          )}
        </Card>
      )}
    </>
  );
}
