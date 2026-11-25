import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { loadCatalog } from '@/lib/data/athlete';
import { managedAthletes } from '@/lib/data/family';
import { Badge, Card, CardTitle, EmptyState, PageHeader, inputClass } from '@/components/ui';
import { createShowcaseEvent, joinShowcase, leaveShowcase } from '@/app/actions/showcase';

export const metadata: Metadata = { title: 'Showcase Day' };

const fmt = (d: string) => new Date(d).toLocaleString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

/**
 * Showcase Day: jornadas reales. El atleta se inscribe; mientras está en directo, los reclutadores
 * verificados ven la selección y piden contacto. Si no hay ninguna programada, se dice tal cual.
 */
export default async function ShowcasePage() {
  const session = await requireSession();
  const supabase = await createClient();
  const isFamily = session.roles.some((r) => r === 'athlete' || r === 'parent');
  const isAdmin = session.roles.includes('admin');
  const [{ data: events }, catalog, athletes] = await Promise.all([
    supabase.from('showcase_events').select('id, title, description, sport_id, starts_at, ends_at').gt('ends_at', new Date().toISOString()).order('starts_at').limit(6),
    loadCatalog(),
    isFamily ? managedAthletes(session) : Promise.resolve([]),
  ]);
  const ids = (events ?? []).map((e) => e.id);
  const { data: entries } = ids.length
    ? await supabase.from('showcase_entries').select('event_id, athlete_id, athlete_profiles(user_id, graduation_year, profiles(display_name))').in('event_id', ids)
    : { data: [] };
  // Fase 6 (S4): el equipo es del bloque deportivo; se lee con su visibilidad.
  const entryIds = [...new Set((entries ?? []).map((x) => x.athlete_id as string))];
  const { data: blocks } = entryIds.length ? await supabase.rpc('athlete_block_fields_many', { p_athletes: entryIds }) : { data: [] };
  const teamOf = new Map(((blocks ?? []) as { user_id: string; current_team: string | null }[]).map((b) => [b.user_id, b.current_team]));
  const sportName = (id: string | null) => catalog.sports.find((s) => s.id === id)?.name_es ?? 'Todos los deportes';
  const now = new Date();

  return (
    <>
      <PageHeader kicker="Networking" title="Showcase Day" description="Una jornada al mes en la que universidades y clubes verificados revisan a los atletas inscritos y piden contacto en directo. Es real o no es: si no hay jornada programada, te lo decimos." />

      {isAdmin && (
        <Card className="mb-5">
          <CardTitle kicker="Administración">Programar una jornada</CardTitle>
          <form action={createShowcaseEvent} className="grid gap-3 sm:grid-cols-4">
            <input name="title" required minLength={4} placeholder="Showcase baloncesto diciembre" aria-label="Título" className={`${inputClass} sm:col-span-2`} />
            <select name="sport_id" aria-label="Deporte" className={inputClass}><option value="">Todos los deportes</option>{catalog.sports.map((s) => <option key={s.id} value={s.id}>{s.name_es}</option>)}</select>
            <span />
            <label className="text-xs text-muted">Empieza<input type="datetime-local" name="starts_at" required className={inputClass} /></label>
            <label className="text-xs text-muted">Termina (máx. 7 días)<input type="datetime-local" name="ends_at" required className={inputClass} /></label>
            <button className="self-end rounded-xl bg-brass px-4 py-2.5 text-sm font-semibold text-ink hover:bg-brass-soft">Programar</button>
          </form>
        </Card>
      )}

      {(events ?? []).length === 0 ? (
        <EmptyState title="No hay ninguna jornada programada ahora mismo">No vamos a inventarla. Cuando haya una con universidades confirmadas aparecerá aquí y te avisaremos.</EmptyState>
      ) : (
        <ul className="space-y-5">
          {(events ?? []).map((e) => {
            const live = new Date(e.starts_at) <= now && now <= new Date(e.ends_at);
            const mine = (entries ?? []).filter((x) => x.event_id === e.id);
            return (
              <li key={e.id}>
                <section className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
                  <div className="court-lines relative bg-night px-6 py-6 text-white">
                    <div className="relative flex flex-wrap items-end justify-between gap-4">
                      <div>
                        <p className="mb-2 inline-flex items-center gap-2 text-sm text-lavender">{live ? <><span className="live-dot" aria-hidden /> En directo</> : 'Próxima jornada'} · {sportName(e.sport_id)}</p>
                        <h2 className="font-display text-4xl font-bold uppercase leading-none">{e.title}</h2>
                        <p className="mt-2 text-sm text-lavender">{fmt(e.starts_at)} → {fmt(e.ends_at)}</p>
                      </div>
                      {live && <Badge tone="ok">{mine.length} inscrito{mine.length === 1 ? '' : 's'} visibles</Badge>}
                    </div>
                  </div>
                  <div className="p-6">
                    {isFamily && athletes.length > 0 && (
                      <div className="flex flex-wrap gap-3">
                        {athletes.map((a) => {
                          const joined = mine.some((x) => x.athlete_id === a.id);
                          return (
                            <form key={a.id} action={joined ? leaveShowcase : joinShowcase}>
                              <input type="hidden" name="event_id" value={e.id} />
                              <input type="hidden" name="athlete_id" value={a.id} />
                              <button className={joined ? 'rounded-xl border border-line-strong px-4 py-2 text-sm text-paper hover:border-danger' : 'rounded-xl bg-lime px-4 py-2 text-sm font-bold text-night hover:-translate-y-0.5'}>
                                {joined ? `${athletes.length > 1 ? a.name + ': ' : ''}Inscrito · retirarme` : `Inscribir${athletes.length > 1 ? ' a ' + a.name : 'me'}`}
                              </button>
                            </form>
                          );
                        })}
                      </div>
                    )}
                    {!isFamily && !live && <p className="text-sm text-muted">Los perfiles inscritos serán visibles para reclutadores verificados durante la jornada.</p>}
                    {!isFamily && live && (mine.length ? (
                      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {mine.map((x) => {
                          const apRaw = x.athlete_profiles as unknown as { user_id: string; graduation_year: number | null; profiles: { display_name: string } | null } | null;
                          const ap = apRaw ? { ...apRaw, current_team: teamOf.get(apRaw.user_id) ?? null } : null;
                          return (
                            <li key={x.athlete_id}>
                              <Link href={`/athletes/${x.athlete_id}`} className="hover-lift block rounded-2xl border border-line p-4">
                                <span className="block font-display text-xl font-bold uppercase text-paper">{ap?.profiles?.display_name ?? 'Atleta'}</span>
                                <span className="text-sm text-muted">{[ap?.graduation_year && `Promoción ${ap.graduation_year}`, ap?.current_team].filter(Boolean).join(' · ')}</span>
                                <span className="mt-2 block text-sm font-semibold text-brass">Ver perfil y pedir contacto</span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    ) : <p className="text-sm text-muted">Aún no hay inscritos visibles para tu organización. Solo aparecen perfiles que tu organización verificada puede ver.</p>)}
                  </div>
                </section>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
