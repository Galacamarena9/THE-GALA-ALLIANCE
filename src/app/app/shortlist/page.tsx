import type { Metadata } from 'next';
import Link from 'next/link';
import { Scale } from 'lucide-react';
import { requireSession } from '@/lib/session';
import { loadAthleteContext, loadOneMatch, loadSaved } from '@/lib/data/gala-match';
import { setShortlistTier } from '@/app/actions/match';
import { ConfidenceBadge, MatchScore, SaveButton } from '@/components/match/MatchParts';
import { EmptyState, Notice, PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Mi shortlist' };

/** Niveles que decide el atleta. Gala no etiqueta nunca una universidad como "segura" o "garantizada". */
const TIERS = [['dream', 'Sueño'], ['target', 'Objetivo'], ['strong_fit', 'Encaje fuerte'], ['backup', 'Alternativa']] as const;

export default async function ShortlistPage() {
  const session = await requireSession(['athlete']);
  const loaded = await loadAthleteContext(session.userId);
  if (!loaded) return <Notice tone="warn">Completa tu Passport para crear tu shortlist.</Notice>;
  const saved = (await loadSaved(session.userId)).filter((s) => s.target_kind === 'institution');
  const withMatch = await Promise.all(saved.map(async (s) => ({ s, r: await loadOneMatch(session.userId, loaded.ctx, 'institution', s.target_id) })));
  const groups = [...TIERS.map(([k, l]) => ({ key: k as string, label: l })), { key: '', label: 'Sin clasificar' }];
  const ids = saved.map((s) => s.target_id);

  return (
    <>
      <PageHeader
        kicker="Universidades"
        title="Mi shortlist"
        description="Tú decides el nivel de cada universidad; Gala aporta la información objetiva. Pasa de cientos de opciones a una lista realista."
        action={ids.length > 1 ? <Link href={`/app/universities/compare?ids=${ids.slice(0, 5).join(',')}`} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brass px-5 text-sm font-semibold text-ink"><Scale className="h-4 w-4" aria-hidden />Comparar (hasta 5)</Link> : undefined}
      />
      {!saved.length ? (
        <EmptyState title="Tu shortlist está vacía" action={<Link href="/app/match" className="inline-flex min-h-11 items-center rounded-full bg-brass px-5 text-sm font-semibold text-ink">Ver mis matches</Link>}>
          Guarda universidades desde Gala Match o desde el directorio y organízalas aquí.
        </EmptyState>
      ) : (
        <div className="space-y-8">
          {groups.map((g) => {
            const items = withMatch.filter(({ s }) => (s.shortlist_tier ?? '') === g.key);
            if (!items.length) return null;
            return (
              <section key={g.key || 'none'} aria-labelledby={`tier-${g.key || 'none'}`}>
                <h2 id={`tier-${g.key || 'none'}`} className="mb-3 font-display text-2xl font-bold uppercase text-paper">{g.label} <span className="text-base text-muted">· {items.length}</span></h2>
                <ul className="grid gap-3 lg:grid-cols-2">
                  {items.map(({ s, r }) => (
                    <li key={s.id} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
                      <div className="flex items-start gap-4">
                        {r && <MatchScore m={r.m} size="sm" />}
                        <div className="min-w-0 flex-1">
                          <Link href={`/app/universities/${s.target_id}`} className="font-display text-lg font-bold uppercase leading-tight text-paper hover:text-brass">{s.name}</Link>
                          <p className="text-xs text-muted">{s.sub}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            {r && <ConfidenceBadge m={r.m} />}
                            {r && s.match_score_at_save != null && r.m.score != null && r.m.score !== s.match_score_at_save && (
                              <span className="text-[11px] text-muted">Al guardarla: {s.match_score_at_save}% → ahora {r.m.score}%</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <form action={setShortlistTier} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="id" value={s.id} />
                        <label htmlFor={`tier-sel-${s.id}`} className="text-xs text-muted">Nivel</label>
                        <select id={`tier-sel-${s.id}`} name="tier" defaultValue={s.shortlist_tier ?? ''} className="min-h-10 rounded-full border border-line-strong bg-surface px-3 text-sm text-paper">
                          <option value="">Sin clasificar</option>{TIERS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                        </select>
                        <button className="min-h-10 rounded-full border border-line-strong px-4 text-sm text-paper hover:border-brass">Guardar</button>
                        <span className="ml-auto"><SaveButton kind="institution" id={s.target_id} saved score={r?.m.score ?? null} /></span>
                      </form>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
