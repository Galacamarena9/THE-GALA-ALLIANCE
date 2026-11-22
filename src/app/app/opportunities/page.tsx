import type { Metadata } from 'next';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { loadPassport } from '@/lib/data/athlete';
import { matchAthleteToOpportunity, type MatchTier } from '@/lib/domain/match';
import { DIVISION_LABEL, OPPORTUNITY_TYPE_LABEL } from '@/lib/domain/labels';
import type { Division, Opportunity, OpportunityType } from '@/lib/types';
import { OpportunityCard, type OpportunityCardData } from '@/components/OpportunityCard';
import { ButtonLink, EmptyState, PageHeader, inputClass, cx } from '@/components/ui';
import Link from 'next/link';
import { redirect } from 'next/navigation';

function ViewTabs({ current }: { current: 'mine' | 'all' }) {
  return (
    <div className="mb-6 flex gap-1 rounded-full border border-line bg-surface p-1 text-sm sm:w-fit">
      {([['mine', 'De mi organización', '/app/opportunities?view=mine'], ['all', 'Todas las publicadas', '/app/opportunities']] as const).map(([k, l, href]) => (
        <Link key={k} href={href} className={cx('rounded-full px-4 py-1.5', current === k ? 'bg-brass text-ink' : 'text-muted hover:text-paper')}>{l}</Link>
      ))}
    </div>
  );
}

export const metadata: Metadata = { title: 'Oportunidades' };

const SELECT =
  'id, title, type, sport_id, position_ids, graduation_years, division, min_gpa_4, english_required, location, deadline, annual_cost_usd, aid_amount_usd, status, organization_id, description, financial_source, is_reviewed, updated_at, organizations(name, verification_status, website, type)';

export default async function OpportunitiesPage({ searchParams }: { searchParams: Promise<{ type?: string; division?: string; tier?: string; view?: string }> }) {
  const session = await requireSession();
  const sp = await searchParams;
  const supabase = await createClient();
  const isRecruiter = session.roles.includes('university') || session.roles.includes('coach');
  const isAthlete = session.roles.includes('athlete');
  // El agente busca siempre PARA un atleta: su entrada es el buscador explicado.
  if (session.roles.includes('agent') && !isRecruiter && !isAthlete) redirect('/app/opportunities/discover');

  // Universidad / coach: oportunidades de sus organizaciones (todos los estados).
  if (isRecruiter && sp.view === 'mine') {
    const { data: memberships } = await supabase.from('organization_members').select('organization_id').eq('user_id', session.userId);
    const orgIds = (memberships ?? []).map((m) => m.organization_id);
    const { data } = orgIds.length
      ? await supabase.from('opportunities').select(SELECT).in('organization_id', orgIds).order('created_at', { ascending: false })
      : { data: [] };
    return (
      <>
        <PageHeader
          kicker="Recruiting"
          title="Nuestras becas y plazas"
          description="Cada oportunidad se revisa antes de publicarse. Si editas una publicada, vuelve a revisión. Dentro de cada una verás el talento compatible."
          action={<ButtonLink href="/app/opportunities/new">Nueva oportunidad</ButtonLink>}
        />
        <ViewTabs current="mine" />
        {data?.length ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((o) => <li key={o.id}><OpportunityCard o={o as unknown as OpportunityCardData} showStatus /></li>)}
          </ul>
        ) : (
          <EmptyState title="Aún no has creado oportunidades" action={<ButtonLink href="/app/opportunities/new">Crear la primera</ButtonLink>}>
            Publica becas, plazas de recruiting o pruebas. Los atletas verán su encaje explicado y el coste real.
          </EmptyState>
        )}
      </>
    );
  }

  let query = supabase.from('opportunities').select(SELECT).eq('status', 'published').order('deadline', { ascending: true, nullsFirst: false }).limit(200);
  // Atajos móviles: «Trials» (pruebas, campus, captación) y «Academias» (programas) agrupan varios tipos.
  if (sp.type === 'trials') query = query.in('type', ['tryout', 'camp_showcase', 'club_recruitment']);
  else if (sp.type === 'academies') query = query.in('type', ['academy', 'development_program']);
  else if (sp.type && sp.type in OPPORTUNITY_TYPE_LABEL) query = query.eq('type', sp.type);
  if (sp.division && sp.division in DIVISION_LABEL) query = query.eq('division', sp.division);
  const today = new Date().toISOString().slice(0, 10);
  query = query.or(`deadline.is.null,deadline.gte.${today}`);

  const passport = isAthlete ? await loadPassport(session.userId) : null;
  if (passport?.profile?.sport_id) query = query.eq('sport_id', passport.profile.sport_id);
  const { data } = await query;

  let items = (data ?? []).map((o) => ({
    o: o as unknown as OpportunityCardData & Opportunity,
    m: passport?.profile
      ? matchAthleteToOpportunity({ ...passport.profile, annual_budget_usd: passport.annualBudgetUsd }, passport.academics, o as unknown as Opportunity)
      : undefined,
  }));
  if (passport) items = items.sort((a, b) => (b.m?.score ?? 0) - (a.m?.score ?? 0));
  if (sp.tier) items = items.filter((i) => i.m?.tier === (sp.tier as MatchTier));

  return (
    <>
      <PageHeader
        kicker="Oportunidades"
        title={isAthlete ? 'Dónde encajas' : 'Oportunidades publicadas'}
        description="Solo oportunidades revisadas de organizaciones verificadas. La compatibilidad no es una probabilidad de admisión ni de beca."
      />
      {isRecruiter && <ViewTabs current="all" />}
      {isAthlete && (
        <nav aria-label="Tipo de oportunidad" className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1 text-sm">
          {([['', 'Todas'], ['trials', 'Trials'], ['academies', 'Academias'], ['athletic_scholarship', 'Becas']] as const).map(([v, label]) => (
            <Link key={v} href={v ? `/app/opportunities?type=${v}` : '/app/opportunities'} aria-current={(sp.type ?? '') === v ? 'page' : undefined}
              className={`inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 font-semibold ${(sp.type ?? '') === v ? 'border-brass bg-brass/10 text-brass' : 'border-line text-muted'}`}>{label}</Link>
          ))}
        </nav>
      )}
      <form method="get" className="mb-6 flex flex-wrap gap-3">
        <select name="type" defaultValue={sp.type ?? ''} aria-label="Tipo" className={`${inputClass} w-auto`}>
          <option value="">Todos los tipos</option>
          {(Object.keys(OPPORTUNITY_TYPE_LABEL) as OpportunityType[]).map((t) => <option key={t} value={t}>{OPPORTUNITY_TYPE_LABEL[t]}</option>)}
        </select>
        <select name="division" defaultValue={sp.division ?? ''} aria-label="División" className={`${inputClass} w-auto`}>
          <option value="">Todas las divisiones</option>
          {(Object.keys(DIVISION_LABEL) as Division[]).map((d) => <option key={d} value={d}>{DIVISION_LABEL[d]}</option>)}
        </select>
        {isAthlete && (
          <select name="tier" defaultValue={sp.tier ?? ''} aria-label="Encaje" className={`${inputClass} w-auto`}>
            <option value="">Cualquier encaje</option>
            <option value="strong">Encaje fuerte</option>
            <option value="potential">Encaje posible</option>
            <option value="reach">Exigente</option>
            <option value="not_eligible">No encaja ahora</option>
          </select>
        )}
        <button className="rounded-lg border border-line-strong px-4 py-2.5 text-sm text-paper hover:border-brass">Filtrar</button>
      </form>
      {items.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(({ o, m }) => <li key={o.id}><OpportunityCard o={o} match={m} /></li>)}
        </ul>
      ) : (
        <EmptyState title="No hay oportunidades con estos filtros">
          Ahora mismo no hay ofertas reales que encajen con estos filtros, y no vamos a inventarlas. Estamos incorporando universidades verificadas: mientras tanto, mejora tu Passport para estar listo cuando lleguen.
        </EmptyState>
      )}
    </>
  );
}
