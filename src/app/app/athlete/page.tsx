import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { loadPassport } from '@/lib/data/athlete';
import { roadmapFor } from '@/lib/domain/roadmap';
import { matchAthleteToOpportunity, OVER_BUDGET_LABEL, TIER_LABEL } from '@/lib/domain/match';
import { ATHLETE_STATUS_LABEL } from '@/lib/domain/labels';
import type { ApplicationStatus, Opportunity } from '@/lib/types';
import { Badge, ButtonLink, Card, CardTitle, EmptyState, Meter, PageHeader, cx } from '@/components/ui';

export const metadata: Metadata = { title: 'Mi camino' };


export default async function MyPathPage() {
  const session = await requireSession(['athlete']);
  const supabase = await createClient();
  const passport = await loadPassport(session.userId);
  const { profile, academics, readiness } = passport;

  const [{ data: opps }, { data: apps }] = await Promise.all([
    supabase
      .from('opportunities')
      .select('id, title, type, sport_id, position_ids, graduation_years, division, min_gpa_4, english_required, annual_cost_usd, aid_amount_usd, deadline, organizations(name)')
      .eq('status', 'published')
      .eq('sport_id', profile?.sport_id ?? '')
      .order('deadline', { ascending: true, nullsFirst: false })
      .limit(50),
    supabase
      .from('applications')
      .select('id, status, updated_at, opportunities(title, organizations(name))')
      .eq('athlete_id', session.userId)
      .neq('status', 'withdrawn')
      .order('updated_at', { ascending: false })
      .limit(5),
  ]);

  const matches = profile
    ? (opps ?? [])
        .map((o) => ({ o, m: matchAthleteToOpportunity({ ...profile, annual_budget_usd: passport.annualBudgetUsd }, academics, o as unknown as Opportunity) }))
        .filter((x) => x.m.tier !== 'not_eligible')
        .sort((a, b) => b.m.score - a.m.score)
        .slice(0, 3)
    : [];

  const roadmap = roadmapFor(profile?.graduation_year ?? null, profile?.target_divisions ?? []);
  const current = roadmap.find((s) => s.state === 'current');

  return (
    <>
      <PageHeader kicker="Mi camino" title={`Hola, ${session.displayName.split(' ')[0]}`} description="Lo que importa hoy para acercarte a una universidad en EE. UU." />

      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <Card className="paper-grain">
          <CardTitle kicker="Opportunity readiness">Tu Passport está al {readiness.score}%</CardTitle>
          <p className="-mt-2 mb-5 text-sm text-muted">Mide lo preparado que está tu perfil para que un coach pueda evaluarte. No es una nota de talento ni una probabilidad de beca.</p>
          {readiness.nextAction ? (
            <div className="rounded-xl border border-brass/40 bg-ink/60 p-5">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-brass">Siguiente paso</p>
              <p className="mt-1.5 font-display text-xl text-paper">{readiness.nextAction.action}</p>
              <ButtonLink href={readiness.nextAction.href} className="mt-4">Hacerlo ahora</ButtonLink>
            </div>
          ) : (
            <p className="stamp-in inline-block rounded-md border-2 border-ok/60 px-3 py-1 font-display text-lg text-ok">Passport completo</p>
          )}
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {readiness.blocks.map((b) => <Meter key={b.block} value={b.pct} label={b.label} />)}
          </div>
        </Card>

        <Card>
          <CardTitle kicker="Candidaturas" action={<Link href="/app/applications" className="text-sm text-brass hover:underline">Ver todas</Link>}>
            En marcha
          </CardTitle>
          {apps?.length ? (
            <ul className="divide-y divide-line">
              {apps.map((a) => {
                const opp = a.opportunities as unknown as { title: string; organizations: { name: string } | null } | null;
                return (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-paper">{opp?.title}</span>
                      <span className="block truncate text-xs text-faint">{opp?.organizations?.name}</span>
                    </span>
                    <Badge tone={a.status === 'offer' ? 'ok' : 'brass'}>{ATHLETE_STATUS_LABEL[a.status as ApplicationStatus]}</Badge>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted">Aún no has aplicado a ninguna oportunidad.</p>
          )}
        </Card>
      </div>

      <Card className="mt-5">
        <CardTitle kicker="Encaje" action={<Link href="/app/opportunities" className="text-sm text-brass hover:underline">Explorar todas</Link>}>
          Tus mejores oportunidades ahora
        </CardTitle>
        {matches.length ? (
          <ul className="grid gap-3 md:grid-cols-3">
            {matches.map(({ o, m }) => (
              <li key={o.id}>
                <Link href={`/app/opportunities/${o.id}`} className="flex h-full flex-col rounded-xl border border-line bg-ink/40 p-4 transition-colors hover:border-brass/60">
                  <span className="flex items-center justify-between">
                    <span className="flex flex-wrap items-center gap-1.5"><Badge tone={m.tier === 'strong' ? 'ok' : 'brass'}>{TIER_LABEL[m.tier]}</Badge>{m.overBudget && <Badge tone="danger">{OVER_BUDGET_LABEL}</Badge>}</span>
                    <span className="font-display text-2xl tabular-nums text-paper">{m.score}</span>
                  </span>
                  <span className="mt-3 text-sm font-medium text-paper">{o.title}</span>
                  <span className="text-xs text-faint">{(o.organizations as unknown as { name: string } | null)?.name}</span>
                  {m.missing.length > 0 && <span className="mt-3 text-xs text-warn">Falta: {m.missing[0]}</span>}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Todavía no hay oportunidades publicadas para tu deporte">
            Solo mostramos oportunidades revisadas de organizaciones verificadas. Mientras llegan, completa tu Passport: es lo primero que miran los coaches.
          </EmptyState>
        )}
      </Card>

      <Card className="mt-5">
        <CardTitle kicker="Roadmap">{current ? `Etapa actual: ${current.label}` : 'Tu proceso'}</CardTitle>
        <ol className="mb-6 flex flex-wrap gap-2">
          {roadmap.map((s) => (
            <li key={s.id} className={cx('rounded-full border px-3 py-1 text-xs', s.state === 'current' ? 'border-brass text-brass' : s.state === 'past' ? 'border-line text-faint line-through' : 'border-line text-muted')}>
              {s.label}
            </li>
          ))}
        </ol>
        {current && (
          <ul className="grid gap-3 md:grid-cols-2">
            {current.tasks.map((t) => (
              <li key={t.id} className="rounded-xl border border-line bg-ink/40 p-4">
                <p className="text-sm font-medium text-paper">{t.title}</p>
                <p className="mt-1 text-sm text-muted">{t.why}</p>
                <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-faint">
                  <Badge>{t.owner === 'ambos' ? 'Atleta y familia' : t.owner === 'familia' ? 'Familia' : 'Atleta'}</Badge>
                  {t.source && <a href={t.source.url} target="_blank" rel="noopener noreferrer" className="text-brass hover:underline">Fuente oficial: {t.source.label} ↗</a>}
                </p>
              </li>
            ))}
          </ul>
        )}
        <a href="/app/athlete/calendar.ics" className="mt-5 inline-block text-sm text-brass hover:underline">Añadir mis plazos a mi calendario (.ics) →</a>
        <p className="mt-3 text-xs text-faint">Los requisitos de elegibilidad cambian. Comprueba siempre la fuente oficial: la plataforma no garantiza elegibilidad.</p>
      </Card>
    </>
  );
}
