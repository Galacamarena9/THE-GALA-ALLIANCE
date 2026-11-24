import { FOUNDER_PRICE_CENTS, founderSeats } from '@/lib/domain/fee-attestation';
import type { Metadata } from 'next';
import { requireSession } from '@/lib/session';
import { logEvent } from '@/lib/events';
import { createClient } from '@/lib/supabase/server';
import { myOrganizations } from '@/lib/data/orgs';
import { Badge, Card, CardTitle, EmptyState, Notice, PageHeader, buttonClass } from '@/components/ui';
import { assignSeat, openBillingPortal, startSubscription } from '@/app/actions/billing';

export const metadata: Metadata = { title: 'Facturación' };

const STATUS: Record<string, { label: string; tone: 'ok' | 'warn' | 'danger' | 'neutral' }> = {
  active: { label: 'Activa', tone: 'ok' }, trialing: { label: 'En prueba', tone: 'ok' }, past_due: { label: 'Pago pendiente', tone: 'warn' },
  unpaid: { label: 'Impagada', tone: 'danger' }, canceled: { label: 'Cancelada', tone: 'neutral' }, incomplete: { label: 'Incompleta', tone: 'warn' },
  incomplete_expired: { label: 'Caducada', tone: 'neutral' }, paused: { label: 'En pausa', tone: 'neutral' },
};
const NOTICE: Record<string, { tone: 'ok' | 'warn' | 'danger' | 'neutral'; text: string }> = {
  ok: { tone: 'ok', text: 'Pago completado. Tu suscripción se activa en cuanto Stripe nos lo confirma (unos segundos).' },
  cancelado: { tone: 'neutral', text: 'No se ha cobrado nada.' },
  no_disponible: { tone: 'neutral', text: 'El pago online de este plan aún no está disponible. Mientras tanto sigues con lo incluido sin coste.' },
  no_permitido: { tone: 'warn', text: 'Solo quien dirige la organización gestiona su facturación.' },
  sin_asientos: { tone: 'warn', text: 'No quedan asientos libres. Amplía el plan desde el portal de facturación.' },
  asientos: { tone: 'ok', text: 'Asientos actualizados.' },
  error: { tone: 'danger', text: 'Algo no ha ido bien. No se ha cobrado nada; inténtalo de nuevo.' },
};
const date = (d: string) => new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(d));
const eur = (c: number, cur: string) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: cur }).format(c / 100);

/**
 * 15 · Facturación de organizaciones: plan, estado real (lo escribe el webhook), asientos y portal de Stripe.
 * La visibilidad del atleta nunca se paga; aquí solo se gestionan herramientas de organizaciones.
 */
export default async function BillingPage({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const session = await requireSession(['agent', 'coach', 'university', 'brand']);
  const sp = await searchParams;
  void logEvent('billing_viewed');
  // Solo se ofrece «Contratar» si el pago online está configurado en este entorno (sin claves: nunca un botón roto).
  const canPay = Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
  const supabase = await createClient();
  const orgs = (await myOrganizations(session.userId)).filter((o) => ['owner', 'admin'].includes(o.member_role as string));
  if (!orgs.length) return (<><PageHeader kicker="Cuenta" title="Facturación" /><EmptyState title="Nada que facturar">La facturación la gestiona quien dirige la organización.</EmptyState></>);

  const ids = orgs.map((o) => o.id);
  const [{ data: accounts }, { data: catalog }, { data: members }, { data: founderRows }] = await Promise.all([
    supabase.from('billing_accounts').select('id, organization_id, stripe_customer_id, subscriptions(id, plan_code, status, seats, current_period_end, cancel_at_period_end, seat_assignments(user_id)), billing_ledger(kind, amount_cents, currency, occurred_at)').in('organization_id', ids),
    supabase.from('plan_catalog').select('code, audience, name, billing_interval, price_cents, currency, seats_included, free_until, stripe_price_id').eq('active', true),
    supabase.from('organization_members').select('organization_id, user_id, profiles:user_id(display_name)').in('organization_id', ids),
    supabase.rpc('agency_founder_status'),
  ]);
  const founder = founderSeats((founderRows as { cap: number; taken: number; remaining: number }[] | null)?.[0]);
  type Sub = { id: string; plan_code: string; status: string; seats: number; current_period_end: string | null; cancel_at_period_end: boolean; seat_assignments: { user_id: string }[] };
  type Acct = { id: string; organization_id: string; stripe_customer_id: string | null; subscriptions: Sub[]; billing_ledger: { kind: string; amount_cents: number; currency: string; occurred_at: string }[] };
  const accountByOrg = new Map(((accounts ?? []) as unknown as Acct[]).map((a) => [a.organization_id, a]));
  const audienceOf: Record<string, string> = { agency: 'agent', university: 'organization', club: 'organization', academy: 'academy', brand: 'brand' };
  const n = sp.estado ? NOTICE[sp.estado] : null;

  return (
    <>
      <PageHeader kicker="Cuenta" title="Facturación" description="El plan de tu organización, su estado real y los asientos de tu equipo. Cancelar es tan fácil como contratar." />
      {n && <div className="mb-5"><Notice tone={n.tone}>{n.text}</Notice></div>}
      <div className="space-y-5">
        {orgs.map((o) => {
          const acct = accountByOrg.get(o.id);
          const sub = acct?.subscriptions.find((s) => !['canceled', 'incomplete_expired'].includes(s.status)) ?? null;
          const plans = (catalog ?? []).filter((p) => p.audience === audienceOf[o.type as string]);
          const launch = plans.find((p) => p.free_until && (p.free_until as string) >= new Date().toISOString().slice(0, 10));
          const team = (members ?? []).filter((m) => m.organization_id === o.id);
          return (
            <Card key={o.id}>
              <CardTitle kicker={o.name} action={sub ? <Badge tone={STATUS[sub.status]?.tone ?? 'neutral'}>{STATUS[sub.status]?.label ?? sub.status}</Badge> : <Badge>Sin suscripción</Badge>}>
                {sub ? plans.find((p) => p.code === sub.plan_code)?.name ?? sub.plan_code : launch ? `${launch.name} · incluido gratis hasta el ${date(launch.free_until as string)}` : 'Plan gratuito'}
              </CardTitle>
              {sub ? (
                <>
                  <p className="text-sm text-muted">{sub.cancel_at_period_end ? 'Se cancelará' : 'Se renueva'} {sub.current_period_end ? `el ${date(sub.current_period_end)}` : ''} · {sub.seat_assignments.length} de {sub.seats} asientos en uso.</p>
                  {sub.status === 'past_due' && <div className="mt-3"><Notice tone="warn">No pudimos cobrar. Mantienes el acceso 7 días; actualiza tu tarjeta en el portal.</Notice></div>}
                  <details className="mt-3"><summary className="cursor-pointer text-sm text-brass">Asientos del equipo</summary>
                    <ul className="mt-2 divide-y divide-line text-sm">
                      {team.map((m) => {
                        const has = sub.seat_assignments.some((s) => s.user_id === m.user_id);
                        return (
                          <li key={m.user_id} className="flex items-center justify-between gap-2 py-2">
                            <span className="text-paper">{(m.profiles as unknown as { display_name?: string } | null)?.display_name ?? 'Miembro'}</span>
                            <form action={assignSeat}><input type="hidden" name="subscription_id" value={sub.id} /><input type="hidden" name="user_id" value={m.user_id} /><input type="hidden" name="assign" value={has ? 'no' : 'yes'} />
                              <button className={buttonClass('secondary', 'sm')}>{has ? 'Quitar asiento' : 'Dar asiento'}</button></form>
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                </>
              ) : (
                <>
                {audienceOf[o.type as string] === 'agent' && <p className="mt-2 text-sm text-brass" data-testid="founder-seats">{founder.text}</p>}
                <ul className="mt-2 grid gap-3 sm:grid-cols-3">
                  {plans.filter((p) => ['month', 'year'].includes(p.billing_interval as string)).map((p) => (
                    <li key={p.code} className="rounded-xl border border-line p-3">
                      <p className="font-semibold text-paper">{p.name}</p>
                      {(() => {
                        const fp = founder.open ? FOUNDER_PRICE_CENTS[p.code as string] : undefined;
                        const per = `/${p.billing_interval === 'year' ? 'año' : 'mes'}`;
                        return fp ? (
                          <p className="text-sm text-muted" data-testid="founder-price">
                            <span className="font-semibold text-paper">{eur(fp, p.currency as string)}{per}</span> de por vida{' '}
                            <s className="text-faint">{eur(p.price_cents as number, p.currency as string)}</s> · {p.seats_included} asiento{p.seats_included === 1 ? '' : 's'}
                          </p>
                        ) : (
                          <p className="text-sm text-muted">{p.price_cents ? `${eur(p.price_cents as number, p.currency as string)}${per}` : 'Precio a medida'} · {p.seats_included} asiento{p.seats_included === 1 ? '' : 's'}</p>
                        );
                      })()}
                      {canPay && (p.stripe_price_id || (p.price_cents as number | null))
                        ? <form action={startSubscription} className="mt-2"><input type="hidden" name="org_id" value={o.id} /><input type="hidden" name="plan_code" value={p.code as string} /><button className={buttonClass('primary', 'md')}>{p.audience === 'agent' ? 'Empezar 30 días gratis' : 'Contratar'}</button></form>
                        : <p className="mt-2 text-xs text-faint">Contratación online próximamente.</p>}
                    </li>
                  ))}
                </ul>
                </>
              )}
              {acct?.stripe_customer_id && (
                <form action={openBillingPortal} className="mt-4"><input type="hidden" name="org_id" value={o.id} /><button className="text-sm text-brass hover:underline">Facturas, tarjeta y cancelación →</button></form>
              )}
              {acct && acct.billing_ledger.length > 0 && (
                <details className="mt-3"><summary className="cursor-pointer text-xs text-faint">Movimientos ({acct.billing_ledger.length})</summary>
                  <ul className="mt-2 space-y-1 text-xs text-muted">{[...acct.billing_ledger].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)).map((l, i) => <li key={i}>{date(l.occurred_at)} · {l.kind === 'charge' ? 'Cobro' : l.kind === 'refund' ? 'Reembolso' : l.kind === 'credit' ? 'Abono' : 'Disputa'} · {eur(Number(l.amount_cents), l.currency)}</li>)}</ul>
                </details>
              )}
            </Card>
          );
        })}
      </div>
      <p className="mt-6 text-xs text-faint">Los pagos los procesa Stripe. Gala no guarda datos de tarjeta. El estado de tu suscripción solo cambia cuando Stripe lo confirma.</p>
    </>
  );
}
