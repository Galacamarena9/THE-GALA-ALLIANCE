import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { runRetentionNow } from '@/app/actions/autonomy';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { Badge, Card, CardTitle, PageHeader, inputClass } from '@/components/ui';
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
  if (!session.roles.includes('admin')) redirect('/app');
  const days = [7, 30, 90].includes(Number((await searchParams).days)) ? Number((await searchParams).days) : 30;
  const supabase = await createClient();

  const [{ data: m }, { data: liquidity }, { data: requests }, { data: feedback }, { data: events }, { data: paid }, { data: lastRetention }] = await Promise.all([
    supabase.rpc('admin_metrics', { p_days: days }),
    supabase.rpc('admin_liquidity'),
    supabase.from('service_requests').select('id, plan_code, message, status, admin_note, created_at, profiles:user_id(display_name), organizations(name)').order('created_at', { ascending: false }).limit(50),
    supabase.from('user_feedback').select('id, page, rating, message, created_at').order('created_at', { ascending: false }).limit(20),
    supabase.rpc('admin_event_counts', { p_days: days }),
    supabase.from('entitlements').select('plan_code, source').is('revoked_at', null),
    supabase.from('audit_logs').select('created_at, details').eq('action', 'retention.run').order('created_at', { ascending: false }).limit(1),
  ]);
  const eventRows = (events ?? []) as { event: string; users: number; total: number }[];
  const paidBy = (paid ?? []).reduce<Record<string, number>>((acc, e) => ({ ...acc, [e.plan_code]: (acc[e.plan_code] ?? 0) + 1 }), {});
  const metrics = m as Metrics | null;
  if (!metrics) {
    return <PageHeader kicker="Admin" title="Panel de mando" description="No se han podido cargar las métricas." />;
  }
  const f = metrics.funnel;
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
        <Card className="border-brass/50">
          <p className="text-xs uppercase tracking-wider text-brass">North Star</p>
          <p className="font-display text-4xl text-paper">{metrics.north_star}</p>
          <p className="text-xs text-muted">Conexiones cualificadas en {days} días: contacto aceptado o candidatura que avanza a contacto, entrevista, prueba, shortlist u oferta.</p>
        </Card>
        <Card><p className="text-xs uppercase tracking-wider text-faint">Altas nuevas</p><p className="font-display text-4xl text-paper">{metrics.new_users}</p><p className="text-xs text-muted">en {days} días</p></Card>
        <Card><p className="text-xs uppercase tracking-wider text-faint">Colocaciones</p><p className="font-display text-4xl text-paper">{f.placed}</p><p className="text-xs text-muted">candidaturas aceptadas (histórico)</p></Card>
        <Card><p className="text-xs uppercase tracking-wider text-faint">Atletas menores</p><p className="font-display text-4xl text-paper">{metrics.minors_share ?? 0} %</p><p className="text-xs text-muted">exige circuito familiar y verificación</p></Card>
      </div>

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
