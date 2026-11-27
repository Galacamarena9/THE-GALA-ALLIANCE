import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { guardianLinks } from '@/lib/data/family-home';
import { Card, CardTitle, EmptyState, Notice, PageHeader } from '@/components/ui';
import { CostComparison, type ScenarioRow } from '@/components/family/CostComparison';
import { BudgetForm, CostScenarioForm, FxForm } from '@/components/family/FamilyForms';
import { convert, money, validFx, type FxRate } from '@/lib/domain/family-cost';
import { getT } from '@/lib/i18n/server-t';

export const metadata: Metadata = { title: 'Coste real' };

const SCENARIO_COLS = 'id, label, currency, tuition, fees, housing, meals, insurance, travel, other_costs, athletic_aid, academic_aid, other_aid, housing_included, source_note';

/** Centro de costes: lo usan la familia (con permiso de costes) y el propio atleta. Privado para ambos. */
export default async function FamilyCostsPage({ searchParams }: { searchParams: Promise<{ child?: string }> }) {
  const session = await requireSession(['parent', 'athlete']);
  const sp = await searchParams;
  const supabase = await createClient();

  let athleteId: string | null = null;
  let name = 'tu hijo/a';
  let canEditBudget = false;
  let canSeeBudget = true;
  let links: Awaited<ReturnType<typeof guardianLinks>> = [];
  if (session.roles.includes('parent')) {
    links = (await guardianLinks(session)).filter((l) => l.active && l.scopes.costs);
    const current = links.find((l) => l.athleteId === sp.child) ?? links[0];
    if (current) {
      athleteId = current.athleteId; name = current.name; canSeeBudget = current.scopes.budget;
      // QA menores: el tutor de un menor fija el presupuesto con el permiso de presupuesto, sin «editar perfil».
      // Misma regla que la RLS de athlete_finances (guardian_sets_family_budget).
      canEditBudget = current.scopes.budget && (current.scopes.edit
        || (await supabase.rpc('guardian_sets_family_budget', { p_athlete: current.athleteId })).data === true);
    }
  } else {
    athleteId = session.userId; name = 'ti'; canEditBudget = true;
  }

  const header = (
    <PageHeader
      kicker="Coste real"
      title="¿Cuánto nos costaría de verdad?"
      description="Coste publicado, ayuda confirmada y lo que todavía no se sabe, opción por opción. Preferimos decir «falta información» a darte una cifra falsa."
    />
  );
  if (!athleteId) {
    return (
      <>
        {header}
        <EmptyState title="Sin acceso a costes" action={<Link href="/app/family" className="text-sm text-brass hover:underline">Volver a familia</Link>}>
          Tu hijo o hija no comparte los costes contigo, o aún no estáis vinculados. Puede activarlo en sus ajustes.
        </EmptyState>
      </>
    );
  }

  const tx = await getT();
  const lang = tx.locale === 'en' ? 'en' : 'es';
  const [{ data: scenarios }, { data: fin }, { data: offers }, { data: fxRow }] = await Promise.all([
    supabase.from('family_cost_scenarios').select(SCENARIO_COLS).eq('athlete_id', athleteId).order('updated_at', { ascending: false }).limit(12),
    supabase.from('athlete_finances').select('annual_budget_usd, budget_mode').eq('athlete_id', athleteId).maybeSingle(),
    supabase.from('athlete_offers').select('id, university_name, status').eq('athlete_id', athleteId).in('status', ['pending', 'accepted']).limit(20),
    supabase.from('family_cost_settings').select('eur_per_usd, rate_date, rate_source').eq('athlete_id', athleteId).maybeSingle(),
  ]);
  // Tipo de cambio de la familia: sin valor por defecto. Incompleto o ausente = solo la moneda de la fuente.
  const fxCandidate = fxRow ? { eurPerUsd: Number(fxRow.eur_per_usd), date: fxRow.rate_date as string, source: fxRow.rate_source as string } : null;
  const fx: FxRate | null = validFx(fxCandidate) ? fxCandidate : null;
  const rows = (scenarios ?? []) as unknown as ScenarioRow[];
  const budget = { amount: (fin?.annual_budget_usd as number | null) ?? null, currency: 'USD' as const };

  return (
    <>
      {header}
      {links.length > 1 && (
        <nav aria-label="Elegir hijo o hija" className="mb-5 flex flex-wrap gap-2">
          {links.map((l) => (
            <Link key={l.id} href={`/app/family/costs?child=${l.athleteId}`} aria-current={l.athleteId === athleteId ? 'page' : undefined}
              className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium ${l.athleteId === athleteId ? 'border-brass bg-brass/10 text-paper' : 'border-line text-muted'}`}>{l.name}</Link>
          ))}
        </nav>
      )}
      <p className="mb-4 text-sm"><Link href={`/print/informe-familia?a=${athleteId}`} className="font-semibold text-brass hover:underline">{tx('Generar nuestro informe (PDF)')}</Link></p>
      <div className="space-y-5">
        <Card>
          <CardTitle kicker="Comparación">{rows.length ? `${rows.length} opción(es)` : `Opciones para ${name}`}</CardTitle>
          {rows.length ? (
            <CostComparison scenarios={rows.slice(0, 4)} budget={budget} fx={fx} />
          ) : (
            <p className="text-sm text-muted">Añade la primera opción abajo. Con dos o más verás la comparación lado a lado, con lo que falta bien a la vista.</p>
          )}
          {rows.length > 4 && <p className="mt-2 text-xs text-faint">Se comparan las 4 más recientes.</p>}
        </Card>

        <Card>
          <CardTitle kicker="Privado">Presupuesto familiar</CardTitle>
          <Notice tone="neutral">Solo lo ven el atleta y la familia con permiso de costes. Ninguna universidad, club ni agente lo ve; Gala lo usa solo para comparar y para el encaje económico.</Notice>
          <div className="mt-4">
            {canSeeBudget
              ? <BudgetForm athleteId={athleteId} amount={budget.amount} mode={(fin?.budget_mode as 'preference' | 'hard_limit' | undefined) ?? 'preference'} canEdit={canEditBudget} />
              : <p className="text-sm text-muted">{name} no comparte el presupuesto familiar contigo. La comparación de costes sigue disponible, sin el encaje con el presupuesto.</p>}
          </div>
        </Card>

        <Card>
          <CardTitle kicker={tx('Privado')}>{tx('Ver en euros')}</CardTitle>
          {fx ? (
            <p className="mb-3 text-sm text-muted">
              {tx('Con el tipo indicado se muestran también los euros.')}
              {canSeeBudget && budget.amount != null && <> {tx('Vuestro presupuesto')}: {money(budget.amount, 'USD', lang)} ≈ {money(convert(budget.amount, 'USD', 'EUR', fx) ?? 0, 'EUR', lang)} {tx('al año')}.</>}
            </p>
          ) : (
            <div className="mb-3"><Notice tone="warn">{tx('Sin tipo de cambio: mostramos solo dólares (US$). No usamos ningún tipo por defecto; si queréis ver euros, indicad uno con su fecha y su fuente.')}</Notice></div>
          )}
          <FxForm athleteId={athleteId} fx={fx} />
        </Card>

        <Card>
          <CardTitle kicker="Nueva opción">Añadir una universidad u oferta</CardTitle>
          <CostScenarioForm athleteId={athleteId} offers={(offers ?? []).map((o) => ({ id: o.id as string, label: o.university_name as string }))} />
        </Card>
      </div>
    </>
  );
}
