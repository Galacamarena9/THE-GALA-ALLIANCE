import { requireAdminMfa } from '@/lib/mfa';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { runRetentionNow } from '@/app/actions/autonomy';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { Badge, Card, CardTitle, PageHeader, inputClass } from '@/components/ui';
import { growthPct, isoDaysAgo, weeklyBuckets } from '@/lib/domain/funnel';
import { CASE_STAGES } from '@/lib/domain/agency-cases';
import { CountUp } from '@/components/CountUp';
import { updateServiceRequest } from '@/app/actions/growth';
import { planByCode } from '@/content/plans';
import { daysSince } from '@/lib/domain/labels';

export const metadata: Metadata = { title: 'Panel de mando' };

type Metrics = {
  north_star: number;
  new_users: number;
  users_by_role: Record<string, number>;
  funnel: Record<'athletes' | 'passport' | 'academics' | 'video' | 'applied' | 'contacted' | 'offer' | 'placed', number>;
  organizations: Record<string, number>;
  opportunities: Record<string, number>;
  queues: Record<'orgs_to_verify' | 'opportunities_to_review' | 'reports_open' | 'reports_child_safety' | 'dsr_open' | 'service_requests_new', number>;
  minors_share: number | null;
};

const FUNNEL: [keyof Metrics['funnel'], string][] = [
  ['athletes', 'Registrados'], ['passport', 'Passport básico'], ['academics', 'Con notas'], ['video', 'Con vídeo'],
  ['applied', 'Han aplicado'], ['contacted', 'Contactados'], ['offer', 'Con oferta'], ['placed', 'Colocados'],
];
const ROLE: Record<string, string> = { athlete: 'Atletas', parent: 'Familias', university: 'Universidades', coach: 'Coaches', agent: 'Agentes', brand: 'Marcas', admin: 'Admin' };
const STATUS: Record<string, string> = { new: 'Nueva', contacted: 'Contactada', won: 'Ganada', lost: 'Perdida' };

export default async function AdminPanelPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const session = await requireSession(['admin']);
  await requireAdminMfa();
  if (!session.roles.includes('admin')) redirect('/app');
  const days = [7, 30, 90].includes(Number((await searchParams).days)) ? Number((await searchParams).days) : 30;
  const supabase = await createClient();

  const [{ data: m }, { data: liquidity }, { data: requests }, { data: feedback }, { data: events }, { data: paid }, { data: lastRetention }, { data: m2 }, { data: signupRows }, { data: agencyRaw }] = await Promise.all([
    supabase.rpc('admin_metrics', { p_days: days }),
    supabase.rpc('admin_liquidity'),
    supabase.from('service_requests').select('id, plan_code, message, status, admin_note, created_at, profiles:user_id(display_name), organizations(name)').order('created_at', { ascending: false }).limit(50),
    supabase.from('user_feedback').select('id, page, rating, message, created_at').order('created_at', { ascending: false }).limit(20),
    supabase.rpc('admin_event_counts', { p_days: days }),
    supabase.from('entitlements').select('plan_code, source').is('revoked_at', null),
    supabase.from('audit_logs').select('created_at, details').eq('action', 'retention.run').order('created_at', { ascending: false }).limit(1),
    // Periodo doble para comparar con el anterior (doble - actual = anterior).
    supabase.rpc('admin_metrics', { p_days: days * 2 }),
    // Altas reales (perfiles), no el evento: con confirmación por email el evento llega sin sesión.
    supabase.from('profiles').select('created_at').gte('created_at', isoDaysAgo(56)).limit(5000),
    supabase.rpc('admin_agency_metrics', { p_days: days }),
  ]);
  const eventRows = (events ?? []) as { event: string; users: number; total: number }[];
  const paidBy = (paid ?? []).reduce<Record<string, number>>((acc, e) => ({ ...acc, [e.plan_code]: (acc[e.plan_code] ?? 0) + 1 }), {});
  const metrics = m as Metrics | null;
  const ag = agencyRaw as null | {
    agencies_total: number; agencies_with_cases: number; agencies_active_period: number; cases_total: number; cases_opened: number;
    cases_committed: number; stage_changes: number; interactions: number; tasks_done: number; contacts_total: number;
    shared_with_athlete: number; by_stage: Record<string, number>;
  };
  if (!metrics) {
    return <PageHeader kicker="Admin" title="Panel de mando" description="No se han podido cargar las métricas." />;
  }
  const f = metrics.funnel;
  const both = m2 as Metrics | null;
  const prevUsers = both ? both.new_users - metrics.new_users : 0;
  const prevStar = both ? both.north_star - metrics.north_star : 0;
  const growthBadge = (cur: number, prev: number) => {
    const g = growthPct(cur, prev);
    return g === null ? <span className="text-xs text-faint">sin periodo previo</span> : <Badge tone={g >= 0 ? 'ok' : 'danger'}>{g >= 0 ? '+' : ''}{g}% vs. {days} días antes</Badge>;
  };
  const weeks = weeklyBuckets((signupRows ?? []).map((r) => r.created_at as string), new Date(), 8);
  const maxWeek = Math.max(1, ...weeks.map((w) => w.count));
  const top = Math.max(f.athletes, 1);
  const q = metrics.queues;

  return (
    <>
      <PageHeader
        kicker="Dirección"
        title="Panel de mando"
        description="Métricas reales de la base de datos, sin datos de demostración. Agregadas: aquí no hay perfiles individuales."
        action={
          <nav className="flex gap-1 text-xs" aria-label="Periodo">
            {[7, 30, 90].map((n) => (
              <Link key={n} href={`/app/admin/panel?days=${n}`} className={`rounded-full px-3 py-1.5 ${n === days ? 'bg-brass text-ink' : 'border border-line text-muted'}`}>{n} días</Link>
            ))}
          </nav>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative overflow-hidden rounded-[var(--radius-card)] bg-night p-5 text-white">
          <div className="court-lines absolute inset-0 opacity-30" aria-hidden />
          <div className="relative">
            <p className="text-sm font-semibold text-lime">North Star</p>
            <p className="mt-1 font-display text-5xl font-bold leading-none"><CountUp value={metrics.north_star} /></p>
            <div className="mt-2">{growthBadge(metrics.north_star, prevStar)}</div>
            <p className="mt-2 text-xs text-lavender">Conexiones cualificadas en {days} días: contacto aceptado o candidatura que avanza a contacto, entrevista, prueba, preselección u oferta.</p>
          </div>
        </div>
        <Card><p className="text-sm text-muted">Altas nuevas</p><p className="font-display text-5xl font-bold leading-none text-paper"><CountUp value={metrics.new_users} /></p><div className="mt-2">{growthBadge(metrics.new_users, prevUsers)}</div></Card>
        <Card><p className="text-sm text-muted">Colocaciones</p><p className="font-display text-5xl font-bold leading-none text-paper"><CountUp value={f.placed} /></p><p className="mt-2 text-xs text-muted">candidaturas aceptadas (histórico)</p></Card>
        <Card><p className="text-sm text-muted">Atletas menores</p><p className="font-display text-5xl font-bold leading-none text-paper">{metrics.minors_share ?? 0} %</p><p className="mt-2 text-xs text-muted">exige circuito familiar y verificación</p></Card>
      </div>

      <Card className="mt-5">
        <CardTitle kicker="Crecimiento">Registros por semana</CardTitle>
        <div className="flex h-44 items-end gap-2" role="img" aria-label={`Registros de las últimas 8 semanas: ${weeks.map((w) => w.count).join(', ')}`}>
          {weeks.map((w, i) => (
            <div key={w.start} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-xs font-semibold text-paper">{w.count}</span>
              <div className={`w-full rounded-t-lg ${i === weeks.length - 1 ? 'bg-lime' : 'bg-brass/70'}`} style={{ height: `${Math.max(4, (w.count / maxWeek) * 130)}px` }} />
              <span className="text-xs text-faint">{w.start.slice(8)}/{w.start.slice(5, 7)}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-faint">Semanas de lunes a domingo; la verde es la semana en curso.</p>
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardTitle kicker="Activación y resultado">Embudo del atleta</CardTitle>
          <ul className="space-y-2">
            {FUNNEL.map(([k, label]) => (
              <li key={k} className="grid grid-cols-[120px_1fr_48px] items-center gap-3 text-sm">
                <span className="text-muted">{label}</span>
                <span className="h-2 overflow-hidden rounded-full bg-line"><span className="block h-full bg-brass" style={{ width: `${Math.round((f[k] / top) * 100)}%` }} /></span>
                <span className="text-right text-paper">{f[k]}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardTitle kicker="Operación" action={<Link href="/app/admin" className="text-xs text-brass hover:underline">Ir a revisión →</Link>}>Colas pendientes</CardTitle>
          <ul className="grid grid-cols-2 gap-3 text-sm">
            {([
              ['Seguridad infantil', q.reports_child_safety, 'danger'],
              ['Denuncias abiertas', q.reports_open, 'warn'],
              ['Organizaciones por verificar', q.orgs_to_verify, 'warn'],
              ['Oportunidades por revisar', q.opportunities_to_review, 'warn'],
              ['Derechos RGPD abiertos', q.dsr_open, 'warn'],
              ['Solicitudes comerciales nuevas', q.service_requests_new, 'brass'],
            ] as const).map(([label, n, tone]) => (
              <li key={label} className="flex items-center justify-between rounded-lg border border-line px-3 py-2">
                <span className="text-muted">{label}</span><Badge tone={n ? tone : 'ok'}>{n}</Badge>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            {Object.entries(metrics.users_by_role).map(([r, n]) => <Badge key={r}>{ROLE[r] ?? r}: {n}</Badge>)}
          </div>
        </Card>
      </div>

      {ag && (
        <Card className="mt-5">
          <CardTitle kicker={`Agency Core · últimos ${days} días`} action={<Link href="/app/admin" className="text-xs text-brass hover:underline">Verificar agencias →</Link>}>Uso real por agencias</CardTitle>
          <p className="mb-4 text-sm text-muted">Cifras de la base de datos, sin estimaciones. Mientras ninguna agencia pague, esto mide uso, no ingresos.</p>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Agencias registradas', ag.agencies_total],
              ['Con algún proceso', ag.agencies_with_cases],
              ['Activas en el periodo', ag.agencies_active_period],
              ['Procesos abiertos en el periodo', ag.cases_opened],
              ['Cambios de fase', ag.stage_changes],
              ['Interacciones registradas', ag.interactions],
              ['Tareas completadas', ag.tasks_done],
              ['Compromisos (histórico)', ag.cases_committed],
            ].map(([k, v]) => (
              <div key={k as string} className="rounded-2xl border border-line p-3">
                <dt className="text-xs text-faint">{k}</dt>
                <dd className="font-display text-3xl font-bold text-paper">{v as number}</dd>
              </div>
            ))}
          </dl>
          {ag.cases_total > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-xs text-faint">Procesos por fase ({ag.cases_total} en total · {ag.shared_with_athlete} compartidos con el atleta · {ag.contacts_total} contactos de programas)</p>
              <ul className="space-y-1.5">
                {CASE_STAGES.filter((st) => ag.by_stage[st.id]).map((st) => (
                  <li key={st.id} className="flex items-center gap-3 text-sm">
                    <span className="w-48 shrink-0 text-muted">{st.label}</span>
                    <span className="h-2 rounded-full bg-brass" style={{ width: `${Math.max(4, (ag.by_stage[st.id] / ag.cases_total) * 100)}%` }} aria-hidden />
                    <span className="text-paper">{ag.by_stage[st.id]}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      <Card className="mt-5">
        <CardTitle kicker="Liquidez del marketplace">Oferta frente a demanda por posición</CardTitle>
        <p className="mb-3 text-sm text-muted">Demanda = oportunidades publicadas + búsquedas guardadas con alertas. Un ratio alto indica posiciones donde faltan atletas: ahí conviene captar academias y clubes.</p>
        {liquidity?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-faint"><th className="py-2">Deporte</th><th>Posición</th><th className="text-right">Atletas</th><th className="text-right">Demanda</th><th className="text-right">Ratio</th></tr></thead>
              <tbody>
                {liquidity.map((r: { sport_id: string; position_id: number; position_name: string; supply: number; demand: number }) => {
                  const ratio = r.demand / Math.max(r.supply, 1);
                  return (
                    <tr key={`${r.sport_id}-${r.position_id}`} className="border-t border-line">
                      <td className="py-2 text-muted">{r.sport_id}</td><td className="text-paper">{r.position_name}</td>
                      <td className="text-right">{r.supply}</td><td className="text-right">{r.demand}</td>
                      <td className="text-right"><Badge tone={ratio >= 2 ? 'danger' : ratio >= 1 ? 'warn' : 'ok'}>{ratio.toFixed(1)}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <p className="text-sm text-faint">Aún no hay atletas con posición ni demanda registrada.</p>}
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardTitle kicker="Ventas (validación concierge)">Solicitudes de planes y servicios</CardTitle>
          {requests?.length ? (
            <ul className="divide-y divide-line">
              {requests.map((r) => {
                const who = (r.profiles as unknown as { display_name: string } | null)?.display_name;
                const org = (r.organizations as unknown as { name: string } | null)?.name;
                return (
                  <li key={r.id} className="py-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={r.status === 'won' ? 'ok' : r.status === 'lost' ? 'neutral' : 'brass'}>{STATUS[r.status]}</Badge>
                      <span className="text-paper">{planByCode(r.plan_code)?.name ?? r.plan_code}</span>
                      <span className="text-muted">· {who}{org ? ` (${org})` : ''}</span>
                      <span className="text-faint">· hace {daysSince(r.created_at)} día(s)</span>
                    </div>
                    {r.message && <p className="mt-1 text-muted">{r.message}</p>}
                    <form action={updateServiceRequest} className="mt-2 flex flex-wrap gap-2">
                      <input type="hidden" name="id" value={r.id} />
                      <select name="status" defaultValue={r.status} aria-label="Estado" className={`${inputClass} w-36 py-1.5`}>
                        {Object.entries(STATUS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                      <input name="admin_note" defaultValue={r.admin_note ?? ''} placeholder="Nota interna" aria-label="Nota interna" className={`${inputClass} max-w-xs py-1.5`} />
                      <button className="rounded-lg border border-line px-3 py-1.5 text-xs text-paper hover:border-brass/60">Guardar</button>
                    </form>
                  </li>
                );
              })}
            </ul>
          ) : <p className="text-sm text-faint">Sin solicitudes todavía. Comparte /precios con academias y familias del piloto.</p>}
        </Card>
        <Card>
          <CardTitle kicker={`Últimos ${days} días`}>Eventos del embudo</CardTitle>
          {eventRows.length ? (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-faint"><th className="py-1.5 font-normal">Evento</th><th className="text-right font-normal">Personas</th><th className="text-right font-normal">Veces</th></tr></thead>
              <tbody className="divide-y divide-line">
                {eventRows.map((e) => <tr key={e.event}><td className="py-1.5 text-paper">{e.event}</td><td className="text-right tabular-nums text-muted">{e.users}</td><td className="text-right tabular-nums text-muted">{e.total}</td></tr>)}
              </tbody>
            </table>
          ) : <p className="text-sm text-faint">Aún no hay eventos. Se registran solos al usar la plataforma (lista cerrada, sin datos personales en las propiedades).</p>}
        </Card>
        <Card>
          <CardTitle kicker="Funciona sola">Automatizaciones</CardTitle>
          <ul className="space-y-2 text-sm text-muted">
            <li>• <span className="text-paper">Verificación de organizaciones</span>: automática si el correo confirmado es del dominio de su web (.edu para universidades).</li>
            <li>• <span className="text-paper">Publicación de oportunidades</span>: automática si la organización está verificada y no hay señales de alarma; si las hay, queda en revisión.</li>
            <li>• <span className="text-paper">Denuncias</span>: seguridad infantil o 3 denunciantes ocultan el contenido al momento.</li>
            <li>• <span className="text-paper">Pagos</span>: Stripe concede el plan solo (Core {paidBy.family_core ?? 0} · Elite {paidBy.family_elite ?? 0} · Signature {paidBy.family_signature ?? 0} activos).</li>
            <li>• <span className="text-paper">Bajas</span>: cada persona borra su cuenta desde Privacidad.</li>
            <li>• <span className="text-paper">Retención</span>: borrado diario automático (pg_cron, 03:17).{lastRetention?.[0] ? ` Última ejecución: ${lastRetention[0].created_at.slice(0, 10)}.` : ' Aún no se ha ejecutado.'}</li>
          </ul>
          <form action={runRetentionNow} className="mt-4">
            <button className="rounded-lg border border-line px-3 py-1.5 text-xs text-paper hover:border-brass/60">Ejecutar retención ahora</button>
          </form>
        </Card>
        <Card>
          <CardTitle kicker="Piloto">Feedback de usuarios</CardTitle>
          {feedback?.length ? (
            <ul className="space-y-3 text-sm">
              {feedback.map((fb) => (
                <li key={fb.id} className="rounded-lg border border-line px-3 py-2">
                  <p className="text-paper">{fb.message}</p>
                  <p className="mt-1 text-xs text-faint">{fb.rating ? `${'★'.repeat(fb.rating)} · ` : ''}{fb.page ?? ''} · hace {daysSince(fb.created_at)} día(s)</p>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-faint">Sin comentarios todavía.</p>}
        </Card>
      </div>
    </>
  );
}
