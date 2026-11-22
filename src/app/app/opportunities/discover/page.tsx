import type { Metadata } from 'next';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { loadDiscovery, loadDiscoveryRoster } from '@/lib/data/opportunity-discovery';
import { filtersToRecord, parseDiscoveryFilters } from '@/lib/domain/opportunity-discovery';
import { DiscoveryView, type RosterItem, type DiscoveryViewProps } from './DiscoveryView';

export const metadata: Metadata = { title: 'Buscar oportunidades' };

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Buscador de oportunidades del agente: «¿Para quién buscas?» → recomendaciones explicadas para ese atleta. */
export default async function DiscoverPage({ searchParams }: { searchParams: Promise<SP> }) {
  const session = await requireSession(['agent']);
  const sp = await searchParams;
  const supabase = await createClient();
  const [roster, { data: sportRows }] = await Promise.all([
    loadDiscoveryRoster(session.userId),
    supabase.from('sports').select('id, name_es').eq('active', true).order('name_es'),
  ]);
  const sports = (sportRows ?? []).map((s) => ({ id: s.id as string, name: s.name_es as string }));
  const items: RosterItem[] = roster.map((a) => ({ id: a.id, name: a.name, sub: [a.sportName, a.graduationYear && `Promoción ${a.graduationYear}`].filter(Boolean).join(' · ') }));

  const base = { roster: items, sports };
  if (!items.length) return <DiscoveryView {...base} athlete={null} state="no_roster" />;

  // Con un solo atleta no hace falta elegir.
  const requested = one(sp.athlete);
  const athleteId = UUID.test(requested) ? requested : items.length === 1 ? items[0].id : '';
  if (!athleteId) return <DiscoveryView {...base} athlete={null} state="pick" />;
  const athlete = items.find((a) => a.id === athleteId) ?? null;
  // Un UUID que no está en la cartera no se consulta: «sin acceso», sin revelar si existe.
  if (!athlete) return <DiscoveryView {...base} athlete={null} state="forbidden" />;

  const searchId = UUID.test(one(sp.search)) ? one(sp.search) : null;
  const result = await loadDiscovery(session.userId, athleteId, parseDiscoveryFilters(sp), searchId);
  if (result.state !== 'ok') return <DiscoveryView {...base} athlete={athlete} state={result.state} />;

  const newCount = result.cards.filter((c) => c.isNew).length;
  const props: DiscoveryViewProps = {
    ...base, athlete, state: 'ok', cards: result.cards, filters: result.effective, hiddenIneligible: result.hiddenIneligible,
    activeSearchId: result.activeSearch?.id ?? null,
    searches: result.savedSearches.map((s) => ({
      id: s.id, label: s.label, newCount: s.id === result.activeSearch?.id ? newCount : 0,
      href: `/app/opportunities/discover?${new URLSearchParams({ athlete: athleteId, search: s.id, ...filtersToRecord(parseDiscoveryFilters(s.filters)) }).toString()}`,
    })),
  };
  return <DiscoveryView {...props} />;
}
