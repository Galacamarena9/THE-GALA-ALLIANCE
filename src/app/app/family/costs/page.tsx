import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { guardianLinks } from '@/lib/data/family-home';
import { Card, CardTitle, EmptyState, Notice, PageHeader } from '@/components/ui';
import { CostComparison, type ScenarioRow } from '@/components/family/CostComparison';
import { BudgetForm, CostScenarioForm } from '@/components/family/FamilyForms';

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
  let links: Awaited<ReturnType<typeof guardianLinks>> = [];
  if (session.roles.includes('parent')) {
    links = (await guardianLinks(session)).filter((l) => l.active && l.scopes.costs);
    const current = links.find((l) => l.athleteId === sp.child) ?? links[0];
    if (current) { athleteId = current.athleteId; name = current.name; canEditBudget = current.scopes.edit; }
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

  const [{ data: scenarios }, { data: fin }, { data: offers }] = await Promise.all([
    supabase.from('family_cost_scenarios').select(SCENARIO_COLS).eq('athlete_id', athleteId).order('updated_at', { ascending: false }).limit(12),
    supabase.from('athlete_finances').select('annual_budget_usd, budget_mode').eq('athlete_id', athleteId).maybeSingle(),
    supabase.from('athlete_offers').select('id, university_name, status').eq('athlete_id', athleteId).in('status', ['pending', 'accepted']).limit(20),
  ]);
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
      <div className="space-y-5">
        <Card>
          <CardTitle kicker="Comparación">{rows.length ? `${rows.length} opción(es)` : `Opciones para ${name}`}</CardTitle>
          {rows.length ? (
            <CostComparison scenarios={rows.slice(0, 4)} budget={budget} />
          ) : (
            <p className="text-sm text-muted">Añade la primera opción abajo. Con dos o más verás la comparación lado a lado, con lo que falta bien a la vista.</p>
          )}
          {rows.length > 4 && <p className="mt-2 text-xs text-faint">Se comparan las 4 más recientes.</p>}
        </Card>

        <Card>
          <CardTitle kicker="Privado">Presupuesto familiar</CardTitle>
          <Notice tone="neutral">Solo lo ven el atleta y la familia con permiso de costes. Ninguna universidad, club ni agente lo ve; Gala lo usa solo para comparar y para el encaje económico.</Notice>
          <div className="mt-4">
            <BudgetForm athleteId={athleteId} amount={budget.amount} mode={(fin?.budget_mode as 'preference' | 'hard_limit' | undefined) ?? 'preference'} canEdit={canEditBudget} />
          </div>
        </Card>

        <Card>
          <CardTitle kicker="Nueva opción">Añadir una universidad u oferta</CardTitle>
          <CostScenarioForm athleteId={athleteId} offers={(offers ?? []).map((o) => ({ id: o.id as string, label: o.university_name as string }))} />
        </Card>
      </div>
    </>
  );
}
