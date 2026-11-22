import Link from 'next/link';
import { Search } from 'lucide-react';
import { ButtonLink, EmptyState, PageHeader, inputClass } from '@/components/ui';
import { DIVISION_LABEL } from '@/lib/domain/labels';
import {
  AID_LABEL, DESTINATION_LABEL, DISCOVERY_TYPES, DISCOVERY_TYPE_LABEL, FILTER_LABEL, advancedCount, filtersToRecord,
  type DiscoveryCard, type DiscoveryFilters,
} from '@/lib/domain/opportunity-discovery';
import { ResultCard } from './ResultCard';
import { SavedSearches } from './SavedSearches';

export interface RosterItem { id: string; name: string; sub: string }
export interface SavedSearchView { id: string; label: string; href: string; newCount: number }

export type DiscoveryViewProps = {
  roster: RosterItem[];
  athlete: RosterItem | null;
  sports: { id: string; name: string }[];
  /** Vista previa (probador): sin acciones reales. */
  demo?: boolean;
} & (
  | { state: 'pick' | 'no_roster' | 'forbidden' | 'error' }
  | { state: 'ok'; cards: DiscoveryCard[]; filters: DiscoveryFilters; hiddenIneligible: number; searches: SavedSearchView[]; activeSearchId: string | null }
);

const BASE = '/app/opportunities/discover';
const hrefFor = (athlete: string, f: Record<string, string> = {}) => `${BASE}?${new URLSearchParams({ athlete, ...f }).toString()}`;

export function DiscoveryView(p: DiscoveryViewProps) {
  return (
    <>
      <PageHeader
        kicker="Oportunidades"
        title="¿Para quién buscas?"
        description="Elige a tu atleta y te enseñamos lo que encaja, por qué, y lo que falta saber. Lo que no cumple un requisito nunca aparece como elegible."
      />

      {p.state === 'no_roster' ? (
        <EmptyState title="Aún no representas a ningún atleta" action={<ButtonLink href="/app/portfolio">Ir a mis atletas</ButtonLink>}>
          Cuando un atleta (o su familia, si es menor) acepte tu representación, podrás buscar oportunidades para él aquí.
        </EmptyState>
      ) : (
        <AthletePicker roster={p.roster} current={p.athlete?.id ?? null} />
      )}

      {p.state === 'pick' && (
        <p className="mt-8 rounded-2xl border border-dashed border-line-strong px-6 py-10 text-center text-muted">Elige un atleta para ver sus oportunidades.</p>
      )}
      {p.state === 'forbidden' && (
        <div className="mt-8"><EmptyState title="Sin acceso a este perfil" action={<ButtonLink href={BASE} variant="secondary">Elegir otro atleta</ButtonLink>}>
          Tu representación no incluye ver el perfil de este atleta, o está pendiente, caducada o a la espera del tutor. No mostramos nada hasta que el permiso esté activo.
        </EmptyState></div>
      )}
      {p.state === 'error' && (
        <div className="mt-8"><EmptyState title="No hemos podido cargar las oportunidades" action={p.athlete ? <ButtonLink href={hrefFor(p.athlete.id)} variant="secondary">Reintentar</ButtonLink> : null}>
          Es un fallo nuestro, no de tus datos. Vuelve a intentarlo en unos segundos.
        </EmptyState></div>
      )}

      {p.state === 'ok' && p.athlete && (
        <div className="mt-8 space-y-6">
          <Filters athleteId={p.athlete.id} f={p.filters} sports={p.sports} />
          <SavedSearches athleteId={p.athlete.id} filters={filtersToRecord(p.filters)} searches={p.searches} activeId={p.activeSearchId} demo={p.demo} />
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-3xl text-paper">{p.cards.length} {p.cards.length === 1 ? 'oportunidad' : 'oportunidades'} para {p.athlete.name.split(' ')[0]}</h2>
            {p.hiddenIneligible > 0 && (
              <Link href={hrefFor(p.athlete.id, { ...filtersToRecord({ ...p.filters, eligible: undefined }) })} className="text-sm text-muted underline decoration-line-strong underline-offset-4 hover:text-paper">
                {p.hiddenIneligible} no elegibles ocultas · mostrar
              </Link>
            )}
          </div>
          {p.cards.length ? (
            <ul className="grid gap-4 lg:grid-cols-2" aria-label="Oportunidades recomendadas">
              {p.cards.map((c) => <li key={c.id}><ResultCard c={c} athleteId={p.athlete!.id} demo={p.demo} /></li>)}
            </ul>
          ) : (
            <EmptyState title="Nada encaja con estos filtros" action={<ButtonLink href={hrefFor(p.athlete.id)} variant="secondary">Quitar filtros</ButtonLink>}>
              No inventamos oportunidades: ahora mismo no hay ninguna publicada que cumpla estos filtros. Guarda la búsqueda y te marcaremos lo nuevo cuando vuelvas.
            </EmptyState>
          )}
          <p className="text-xs text-faint">El encaje compara lo que sabemos del perfil con lo publicado por la organización. No es una probabilidad de admisión, de beca ni de fichaje.</p>
        </div>
      )}
    </>
  );
}

function AthletePicker({ roster, current }: { roster: RosterItem[]; current: string | null }) {
  return (
    <nav aria-label="Atleta" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {roster.map((a) => (
        <Link key={a.id} href={hrefFor(a.id)} aria-current={a.id === current ? 'page' : undefined}
          className={`flex min-h-14 shrink-0 flex-col justify-center rounded-2xl border px-4 py-2 text-left transition-colors ${a.id === current ? 'border-brass bg-brass/10' : 'border-line bg-surface hover:border-brass/50'}`}>
          <span className={`text-sm font-semibold ${a.id === current ? 'text-brass' : 'text-paper'}`}>{a.name}</span>
          {a.sub && <span className="text-xs text-muted">{a.sub}</span>}
        </Link>
      ))}
    </nav>
  );
}

const sel = `${inputClass} w-full`;

function Filters({ athleteId, f, sports }: { athleteId: string; f: DiscoveryFilters; sports: { id: string; name: string }[] }) {
  const year = new Date().getFullYear();
  const adv = advancedCount(f);
  return (
    <form method="get" action={BASE} className="rounded-2xl border border-line bg-surface p-4 sm:p-5" aria-label="Filtros">
      <input type="hidden" name="athlete" value={athleteId} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Select name="sport" label={FILTER_LABEL.sport} value={f.sport} options={sports.map((s) => [s.id, s.name])} any="Todos" />
        <Select name="destination" label={FILTER_LABEL.destination} value={f.destination} options={Object.entries(DESTINATION_LABEL)} any="Cualquiera" />
        <Select name="level" label={FILTER_LABEL.level} value={f.level} options={Object.entries(DIVISION_LABEL)} any="Cualquiera" />
        <Select name="aid" label={FILTER_LABEL.aid} value={f.aid} options={Object.entries(AID_LABEL)} any="Con o sin ayuda" />
        <Select name="intake" label={FILTER_LABEL.intake} value={f.intake ? String(f.intake) : undefined} options={Array.from({ length: 6 }, (_, i) => [String(year + i), String(year + i)])} any="Cualquiera" />
      </div>
      <details className="group mt-3" open={adv > 0}>
        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-semibold text-muted hover:text-paper">
          Más filtros{adv > 0 ? ` (${adv})` : ''} <span aria-hidden className="transition-transform group-open:rotate-180">⌄</span>
        </summary>
        <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select name="type" label={FILTER_LABEL.type} value={f.type} options={DISCOVERY_TYPES.map((t) => [t, DISCOVERY_TYPE_LABEL[t]])} any="Todos" />
          <Select name="closing" label={FILTER_LABEL.closing} value={f.closing ? String(f.closing) : undefined} options={[['30', 'Cierra en 30 días'], ['90', 'Cierra en 90 días']]} any="Cualquiera" />
          <Select name="verified" label={FILTER_LABEL.verified} value={f.verified ? '1' : undefined} options={[['1', 'Solo verificadas']]} any="Todas" />
          <Select name="eligible" label={FILTER_LABEL.eligible} value={f.eligible ? '1' : undefined} options={[['1', 'Ocultar no elegibles']]} any="Mostrar todas" />
        </div>
      </details>
      <div className="mt-4 flex flex-wrap gap-2">
        <button className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brass px-5 text-sm font-semibold text-ink hover:bg-brass-soft"><Search className="h-4 w-4" aria-hidden />Buscar</button>
        <Link href={hrefFor(athleteId)} className="inline-flex min-h-11 items-center rounded-xl px-4 text-sm text-muted hover:text-paper">Restablecer</Link>
      </div>
    </form>
  );
}

function Select({ name, label, value, options, any }: { name: string; label: string; value?: string; options: [string, string][] | string[][]; any: string }) {
  const id = `f-${name}`;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-semibold text-muted">{label}</label>
      <select id={id} name={name} defaultValue={value ?? ''} className={sel}>
        <option value="">{any}</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}

