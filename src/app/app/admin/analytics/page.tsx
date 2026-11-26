import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/admin-guard';
import { createClient } from '@/lib/supabase/server';
import { Card, CardTitle, Notice, PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Analítica' };

type M = {
  period_days: number;
  active: { daily: number; weekly: number; monthly: number; athletes_weekly: number; organizations_weekly: number };
  athlete_activation: { signups: number; activated: number; rate: number | null };
  liquidity: { published: number; with_application_14d: number; rate: number | null };
  time_to_value_days: number | null;
  supply_demand: { sport: string; athletes: number; opportunities: number }[];
  retention: { cohort: string; size: number; w1: number; w2: number; w4: number }[];
  agents: { active_representations: number; pending_guardian: number; open_conflicts: number };
  brands: { offers_sent: number; offers_accepted: number; declared_cash: Record<string, number>; payments_disputed: number };
  revenue: Record<string, number>;
  trust: { reports: number; child_safety_reports: number; actions: number; appeals_overturned: number };
  top_events: { event: string; count: number }[];
};

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-xs uppercase tracking-wide text-faint">{label}</p>
      <p className="mt-1 font-display text-3xl font-bold text-paper tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}
const pct = (v: number | null) => (v == null ? '—' : `${v} %`);
const money = (cents: number, cur: string) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(cents / 100);

/**
 * 17 · Analítica del marketplace: cada número con su definición escrita (metric_definitions), todo agregado,
 * grupos de menos de 5 ocultos y sin ningún ranking de personas. El dinero real sale de Stripe, no de lo declarado.
 */
export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  await requireAdmin('/app/admin/analytics');
  const sp = await searchParams;
  const days = [7, 30, 90].includes(Number(sp.d)) ? Number(sp.d) : 30;
  const supabase = await createClient();
  const [{ data, error }, { data: defs }, { data: base }] = await Promise.all([
    supabase.rpc('admin_marketplace_metrics', { p_days: days }),
    supabase.from('metric_definitions').select('key, name, definition'),
    supabase.rpc('admin_metrics', { p_days: days }),
  ]);
  if (error || !data) return (<><PageHeader kicker="Admin" title="Analítica" /><Notice tone="warn">No se han podido calcular las métricas.</Notice></>);
  const m = data as M;
  const def = new Map((defs ?? []).map((d) => [d.key as string, d.definition as string]));
  const northStar = (base as { north_star?: number } | null)?.north_star ?? 0;

  return (
    <>
      <PageHeader kicker="Admin" title="Analítica" description="Qué pasa en el marketplace, con la definición de cada número. Sin datos personales." />
      <nav className="mb-5 flex gap-1 rounded-full border border-line bg-surface p-1 text-sm sm:w-fit" aria-label="Periodo">
        {[7, 30, 90].map((d) => <Link key={d} href={`/app/admin/analytics?d=${d}`} className={`rounded-full px-4 py-1.5 ${d === days ? 'bg-brass text-ink' : 'text-muted hover:text-paper'}`}>{d} días</Link>)}
      </nav>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Conexiones cualificadas" value={northStar} hint={def.get('north_star')} />
        <Stat label="Activación de atletas" value={pct(m.athlete_activation.rate)} hint={`${m.athlete_activation.activated} de ${m.athlete_activation.signups} altas (14 días)`} />
        <Stat label="Liquidez" value={pct(m.liquidity.rate)} hint={`${m.liquidity.with_application_14d} de ${m.liquidity.published} oportunidades con candidatura en 14 días`} />
        <Stat label="Tiempo hasta valor" value={m.time_to_value_days == null ? '—' : `${Math.round(m.time_to_value_days)} d`} hint="Mediana hasta el primer contacto aceptado" />
        <Stat label="Activos hoy" value={m.active.daily} />
        <Stat label="Activos 7 días" value={m.active.weekly} hint={`${m.active.athletes_weekly} atletas · ${m.active.organizations_weekly} organizaciones`} />
        <Stat label="Activos 30 días" value={m.active.monthly} />
        <Stat label="Ingresos (Stripe)" value={Object.entries(m.revenue).map(([c, v]) => money(v, c)).join(' · ') || '0'} hint={def.get('revenue')} />
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card>
          <CardTitle kicker="Marketplace">Oferta y demanda por deporte</CardTitle>
          {m.supply_demand.length ? (
            <table className="w-full text-sm"><thead><tr className="text-left text-faint"><th className="py-1 font-normal">Deporte</th><th className="font-normal">Atletas</th><th className="font-normal">Oportunidades</th></tr></thead>
              <tbody>{m.supply_demand.map((r) => <tr key={r.sport} className="border-t border-line"><td className="py-1.5 text-paper">{r.sport}</td><td className="tabular-nums">{r.athletes}</td><td className={`tabular-nums ${r.opportunities === 0 ? 'text-warn' : ''}`}>{r.opportunities}</td></tr>)}</tbody></table>
          ) : <p className="text-sm text-muted">Aún no hay deportes con 5 atletas o más (los grupos pequeños se ocultan).</p>}
        </Card>
        <Card>
          <CardTitle kicker="Retención">Cohortes semanales</CardTitle>
          {m.retention.length ? (
            <table className="w-full text-sm"><thead><tr className="text-left text-faint"><th className="py-1 font-normal">Semana</th><th className="font-normal">Altas</th><th className="font-normal">S1</th><th className="font-normal">S2</th><th className="font-normal">S4</th></tr></thead>
              <tbody>{m.retention.map((r) => <tr key={r.cohort} className="border-t border-line"><td className="py-1.5 text-paper">{r.cohort}</td><td>{r.size}</td><td>{r.w1} %</td><td>{r.w2} %</td><td>{r.w4} %</td></tr>)}</tbody></table>
          ) : <p className="text-sm text-muted">Cohortes con menos de 5 altas ocultas.</p>}
        </Card>
        <Card>
          <CardTitle kicker="Agentes y marcas">Relaciones comerciales</CardTitle>
          <ul className="space-y-1 text-sm text-muted">
            <li>Representaciones activas: <span className="text-paper">{m.agents.active_representations}</span> · esperando a la familia: <span className="text-paper">{m.agents.pending_guardian}</span> · conflictos abiertos: <span className="text-paper">{m.agents.open_conflicts}</span></li>
            <li>Ofertas de marca enviadas: <span className="text-paper">{m.brands.offers_sent}</span> · aceptadas: <span className="text-paper">{m.brands.offers_accepted}</span> · pagos en disputa: <span className="text-paper">{m.brands.payments_disputed}</span></li>
            <li>Valor declarado en dinero: <span className="text-paper">{Object.entries(m.brands.declared_cash).map(([c, v]) => `${Number(v).toLocaleString('es-ES')} ${c}`).join(' · ') || '0'}</span> <span className="text-xs">(acordado, no cobrado)</span></li>
          </ul>
        </Card>
        <Card>
          <CardTitle kicker="Confianza">Seguridad</CardTitle>
          <ul className="space-y-1 text-sm text-muted">
            <li>Denuncias: <span className="text-paper">{m.trust.reports}</span> · de seguridad infantil: <span className={m.trust.child_safety_reports ? 'text-danger' : 'text-paper'}>{m.trust.child_safety_reports}</span></li>
            <li>Medidas tomadas: <span className="text-paper">{m.trust.actions}</span> · apelaciones estimadas: <span className="text-paper">{m.trust.appeals_overturned}</span></li>
          </ul>
        </Card>
      </div>

      <Card className="mt-5">
        <CardTitle kicker="Uso">Eventos más frecuentes</CardTitle>
        <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">{m.top_events.map((e) => <li key={e.event} className="flex justify-between"><span className="text-muted">{e.event}</span><span className="tabular-nums text-paper">{e.count}</span></li>)}</ul>
      </Card>

      <details className="mt-5"><summary className="cursor-pointer text-sm text-brass">Definiciones de cada métrica</summary>
        <dl className="mt-3 space-y-2 text-sm">{(defs ?? []).map((d) => <div key={d.key}><dt className="font-medium text-paper">{d.name}</dt><dd className="text-muted">{d.definition}</dd></div>)}</dl>
      </details>
    </>
  );
}
