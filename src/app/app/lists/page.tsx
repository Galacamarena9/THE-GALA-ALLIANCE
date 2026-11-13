import type { Metadata } from 'next';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { loadCatalog } from '@/lib/data/athlete';
import { AthleteCard, type DirectoryRow } from '@/components/AthleteCard';
import { ButtonLink, EmptyState, PageHeader, inputClass } from '@/components/ui';
import { removeSavedAthlete, updateSavedNote } from '@/app/actions/lists';

export const metadata: Metadata = { title: 'Mis listas' };

export default async function ListsPage() {
  const session = await requireSession(['university', 'coach', 'agent', 'brand']);
  const supabase = await createClient();
  const catalog = await loadCatalog();
  const { data: saved } = await supabase
    .from('saved_athletes')
    .select('athlete_id, list_name, private_note, created_at')
    .eq('owner_id', session.userId)
    .order('created_at', { ascending: false });

  const ids = (saved ?? []).map((s) => s.athlete_id);
  const { data: dir } = ids.length ? await supabase.from('athlete_directory').select('*').in('user_id', ids) : { data: [] };
  const byId = new Map(((dir ?? []) as DirectoryRow[]).map((d) => [d.user_id, d]));

  return (
    <>
      <PageHeader kicker="Scouting" title="Mis listas" description="Privadas: nadie más ve a quién sigues ni tus notas." action={<ButtonLink href="/app/discover" variant="secondary">Buscar talento</ButtonLink>} />
      {saved?.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {saved.map((s) => {
            const a = byId.get(s.athlete_id);
            if (!a) {
              return (
                <li key={`${s.athlete_id}-${s.list_name}`} className="rounded-[var(--radius-card)] border border-dashed border-line p-5 text-sm text-faint">
                  Este perfil ya no está disponible (el atleta cambió su visibilidad o cerró su cuenta).
                  <form action={removeSavedAthlete} className="mt-3"><input type="hidden" name="athlete_id" value={s.athlete_id} /><input type="hidden" name="list_name" value={s.list_name} /><button className="text-xs hover:text-danger">Quitar</button></form>
                </li>
              );
            }
            return (
              <li key={`${s.athlete_id}-${s.list_name}`}>
                <AthleteCard
                  a={a}
                  sportName={catalog.sports.find((x) => x.id === a.sport_id)?.name_es}
                  positionName={catalog.positions.find((p) => p.id === a.primary_position_id)?.name_es}
                  footer={
                    <div className="space-y-2">
                      <form action={updateSavedNote} className="flex gap-2">
                        <input type="hidden" name="athlete_id" value={s.athlete_id} />
                        <input type="hidden" name="list_name" value={s.list_name} />
                        <input name="private_note" defaultValue={s.private_note ?? ''} placeholder="Nota privada" aria-label="Nota privada" className={inputClass} />
                        <button className="rounded-lg border border-line-strong px-3 text-xs text-paper hover:border-brass">Guardar</button>
                      </form>
                      <form action={removeSavedAthlete}>
                        <input type="hidden" name="athlete_id" value={s.athlete_id} />
                        <input type="hidden" name="list_name" value={s.list_name} />
                        <button className="text-xs text-faint hover:text-danger">Quitar de {s.list_name}</button>
                      </form>
                    </div>
                  }
                />
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState title="Tu shortlist está vacía" action={<ButtonLink href="/app/discover">Descubrir atletas</ButtonLink>}>
          Guarda atletas desde el buscador para seguirlos y añadir notas privadas.
        </EmptyState>
      )}
    </>
  );
}
