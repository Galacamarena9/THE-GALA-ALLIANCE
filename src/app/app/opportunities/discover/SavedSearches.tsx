'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Bookmark, X } from 'lucide-react';
import { deleteDiscoverySearch, markDiscoverySearchSeen, saveDiscoverySearch, type DiscoveryActionState } from '@/app/actions/discovery';
import type { SavedSearchView } from './DiscoveryView';

/** Búsquedas guardadas de este atleta: volver a ellas en un clic y ver qué es nuevo desde la última visita. */
export function SavedSearches({ athleteId, filters, searches, activeId, demo }: { athleteId: string; filters: Record<string, string>; searches: SavedSearchView[]; activeId: string | null; demo?: boolean }) {
  const [state, save, pending] = useActionState<DiscoveryActionState, FormData>(saveDiscoverySearch, undefined);
  return (
    <section aria-label="Búsquedas guardadas" className="flex flex-wrap items-center gap-2">
      {searches.map((s) => (
        <span key={s.id} className={`inline-flex items-center rounded-full border text-sm ${s.id === activeId ? 'border-brass bg-brass/10 text-brass' : 'border-line text-paper'}`}>
          <Link href={s.href} className="inline-flex min-h-10 items-center gap-1.5 pl-3.5 pr-2" aria-current={s.id === activeId ? 'true' : undefined}>
            <Bookmark className="h-3.5 w-3.5" aria-hidden />{s.label}
            {s.newCount > 0 && <span className="rounded-full bg-brass px-1.5 text-[10px] font-bold text-ink">{s.newCount} nuevas</span>}
          </Link>
          <form action={deleteDiscoverySearch}>
            <input type="hidden" name="id" value={s.id} />
            <button disabled={demo} className="grid h-10 w-9 place-items-center text-muted hover:text-danger" aria-label={`Borrar la búsqueda ${s.label}`}><X className="h-3.5 w-3.5" aria-hidden /></button>
          </form>
        </span>
      ))}
      {activeId && (
        <form action={markDiscoverySearchSeen}>
          <input type="hidden" name="id" value={activeId} />
          <button disabled={demo} className="min-h-10 px-2 text-xs text-muted underline underline-offset-4 hover:text-paper">Marcar todo como visto</button>
        </form>
      )}
      <form action={save} className="flex items-center gap-2">
        <input type="hidden" name="athlete" value={athleteId} />
        {Object.entries(filters).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        <label htmlFor="search-label" className="sr-only">Nombre de la búsqueda</label>
        <input id="search-label" name="label" required minLength={2} maxLength={80} placeholder="Nombre de la búsqueda"
          className="h-10 w-44 rounded-full border border-line bg-ink px-3.5 text-sm text-paper placeholder:text-faint focus:border-brass focus:outline-none" />
        <button disabled={pending || demo} className="inline-flex min-h-10 items-center rounded-full border border-line-strong px-3.5 text-sm text-paper hover:border-brass disabled:opacity-60">
          {pending ? 'Guardando…' : 'Guardar búsqueda'}
        </button>
      </form>
      {state?.error && <p role="alert" className="w-full text-xs text-danger">{state.error}</p>}
      {state?.ok && <p role="status" className="w-full text-xs text-ok">{state.message}</p>}
    </section>
  );
}
