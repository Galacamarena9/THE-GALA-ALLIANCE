import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { loadCatalog, loadPassport } from '@/lib/data/athlete';
import { DIVISION_LABEL, domainOf, usd } from '@/lib/domain/labels';
import { institutionFit } from '@/lib/domain/institutionFit';
import type { Division } from '@/lib/types';
import { Badge, EmptyState, PageHeader, inputClass } from '@/components/ui';

export const metadata: Metadata = { title: 'Universidades' };

type Inst = {
  id: string; name: string; city: string | null; state: string | null; division: Division | null; conference: string | null;
  sports_offered: string[]; website_url: string | null; cost_attendance_usd: number | null; links_verified_at: string | null; virtual_tour_url: string | null;
};

export default async function UniversitiesPage({ searchParams }: { searchParams: Promise<{ q?: string; division?: string; sport?: string; state?: string }> }) {
  const session = await requireSession();
  const sp = await searchParams;
  const supabase = await createClient();
  const catalog = await loadCatalog();

  let query = supabase
    .from('institutions')
    .select('id, name, city, state, division, conference, sports_offered, website_url, cost_attendance_usd, links_verified_at, virtual_tour_url')
    .order('name')
    .limit(60);
  if (sp.q) query = query.ilike('name', `%${sp.q.replace(/[%_,()]/g, '').slice(0, 60)}%`);
  if (sp.division && sp.division in DIVISION_LABEL) query = query.eq('division', sp.division);
  if (sp.sport) query = query.contains('sports_offered', [sp.sport]);
  if (sp.state && /^[A-Z]{2}$/.test(sp.state)) query = query.eq('state', sp.state);
  const { data } = await query;
  const rows = (data ?? []) as Inst[];

  const passport = session.roles.includes('athlete') ? await loadPassport(session.userId) : null;

  return (
    <>
      <PageHeader
        kicker="Universidades"
        title="Directorio con datos oficiales"
        description="Coste y web de College Scorecard (U.S. Department of Education). Enlaces deportivos, de admisiones y campus virtual revisados por nuestro equipo o por la propia universidad verificada."
      />
      <form method="get" className="mb-6 grid gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:grid-cols-5">
        <input name="q" defaultValue={sp.q} placeholder="Nombre de la universidad" aria-label="Buscar universidad" className={`${inputClass} sm:col-span-2`} />
        <select name="division" defaultValue={sp.division ?? ''} aria-label="División" className={inputClass}>
          <option value="">División</option>
          {Object.entries(DIVISION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select name="sport" defaultValue={sp.sport ?? passport?.profile?.sport_id ?? ''} aria-label="Deporte" className={inputClass}>
          <option value="">Deporte</option>
          {catalog.sports.map((s) => <option key={s.id} value={s.id}>{s.name_es}</option>)}
        </select>
        <div className="flex gap-2">
          <input name="state" defaultValue={sp.state} placeholder="Estado (IN)" maxLength={2} aria-label="Estado" className={`${inputClass} uppercase`} />
          <button className="rounded-lg bg-brass px-4 text-sm font-medium text-ink">Buscar</button>
        </div>
      </form>

      {rows.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((u) => {
            const fit = passport?.profile ? institutionFit(passport.profile, passport.annualBudgetUsd, u) : null;
            return (
              <li key={u.id}>
                <Link href={`/app/universities/${u.id}`} className="flex h-full flex-col rounded-[var(--radius-card)] border border-line bg-surface p-5 transition-colors hover:border-brass/60">
                  <span className="font-display text-lg leading-snug text-paper">{u.name}</span>
                  <span className="text-xs text-muted">{[u.city, u.state].filter(Boolean).join(', ')}{u.website_url && ` · ${domainOf(u.website_url)}`}</span>
                  <span className="mt-3 flex flex-wrap gap-1.5">
                    {u.division && <Badge>{DIVISION_LABEL[u.division]}</Badge>}
                    {u.conference && <Badge>{u.conference}</Badge>}
                    {u.virtual_tour_url && <Badge tone="brass">Campus virtual</Badge>}
                    {fit && <Badge tone={fit.level === 'alto' ? 'ok' : fit.level === 'medio' ? 'brass' : 'neutral'}>Encaje {fit.level}</Badge>}
                  </span>
                  <span className="mt-auto pt-4 text-xs text-faint">Coste anual oficial: <span className="tabular-nums text-paper">{usd(u.cost_attendance_usd)}</span></span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState title="Sin universidades con estos filtros">
          Incorporamos universidades con datos oficiales una a una: nunca mostramos fichas inventadas. Si representas a una universidad, <Link href="/signup?role=university" className="text-brass hover:underline">da de alta su cuenta oficial</Link>.
        </EmptyState>
      )}
    </>
  );
}
