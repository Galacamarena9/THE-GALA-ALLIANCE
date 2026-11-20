import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { logEvent } from '@/lib/events';
import { createClient } from '@/lib/supabase/server';
import { Badge, ButtonLink, Card, CardTitle, EmptyState, Notice, PageHeader, buttonClass } from '@/components/ui';
import { SubmitDeliverableForm } from '@/components/brand/OfferForms';
import { respondBrandOffer, updateBrandPayment } from '@/app/actions/brand-offers';
import {
  DELIVERABLE_LABEL, DELIVERABLE_STATUS_LABEL, PAYMENT_LABEL, describeCompensation, exclusivitySummary, usageSummary, type OfferComponent,
} from '@/lib/domain/brand-offers';

export const metadata: Metadata = { title: 'Mis colaboraciones' };

type Offer = {
  id: string; status: string; version: number; expires_at: string; created_at: string; terms: string | null; compensation_unknown: boolean;
  usage_months: number; usage_channels: string[]; usage_territory: string; organic_use: boolean; paid_media: boolean;
  exclusivity_category: string | null; exclusivity_days: number; payment_status: string; campaign_id: string;
  brand_campaigns: { title: string } | null; organizations: { name: string } | null;
  campaign_offer_components: OfferComponent[];
  campaign_deliverables: { id: string; kind: string; platform: string | null; quantity: number; due_date: string | null; description: string; status: string; feedback: string | null;
    campaign_deliverable_submissions: { version: number; url: string; submitted_at: string }[] }[];
};

const date = (d: string) => new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d));

/**
 * 13 · El atleta ve cada oferta de marca con todo explícito antes de decidir: qué cobra (y qué no es dinero),
 * qué tiene que entregar, cuánto tiempo y dónde puede usarse su imagen y si hay exclusividad.
 */
export default async function CollaborationsPage() {
  const session = await requireSession(['athlete']);
  if (session.isMinor) {
    return (<><PageHeader kicker="Marcas" title="Mis colaboraciones" /><Notice tone="neutral">Las colaboraciones con marcas están disponibles a partir de los 18 años.</Notice></>);
  }
  void logEvent('collaborations_viewed');
  const supabase = await createClient();
  const { data } = await supabase.from('campaign_offers')
    .select(`id, status, version, expires_at, created_at, terms, compensation_unknown, usage_months, usage_channels, usage_territory, organic_use, paid_media,
      exclusivity_category, exclusivity_days, payment_status, campaign_id, brand_campaigns(title), organizations(name),
      campaign_offer_components(kind, amount, currency, guaranteed, description),
      campaign_deliverables(id, kind, platform, quantity, due_date, description, status, feedback, campaign_deliverable_submissions(version, url, submitted_at))`)
    .eq('athlete_id', session.userId).in('status', ['sent', 'accepted', 'declined', 'expired', 'withdrawn']).order('created_at', { ascending: false }).limit(50);
  const offers = (data ?? []) as unknown as Offer[];
  const open = offers.filter((o) => o.status === 'sent');
  const active = offers.filter((o) => o.status === 'accepted');
  const past = offers.filter((o) => !['sent', 'accepted'].includes(o.status));

  return (
    <>
      <PageHeader kicker="Marcas" title="Mis colaboraciones" description="Ofertas recibidas, lo que tienes que entregar y el estado de cada pago." />
      {!offers.length && (
        <EmptyState title="Aún no tienes ofertas de marcas" action={<ButtonLink href="/app/campaigns" variant="secondary">Ver campañas abiertas</ButtonLink>}>
          Cuando una marca te seleccione y te envíe su oferta, la verás aquí con todas sus condiciones.
        </EmptyState>
      )}

      {open.length > 0 && <h2 className="mb-3 font-display text-xl font-bold uppercase text-paper">Por decidir</h2>}
      <ul className="space-y-4">
        {open.map((o) => {
          const comp = describeCompensation(o.campaign_offer_components, o.compensation_unknown);
          return (
            <li key={o.id}>
              <Card>
                <CardTitle kicker={`${o.organizations?.name ?? 'Marca'} · versión ${o.version}`} action={<Badge tone="warn">Caduca el {date(o.expires_at)}</Badge>}>{o.brand_campaigns?.title}</CardTitle>
                <p className="text-lg font-semibold text-paper">{comp.headline}</p>
                {comp.lines.length > 0 && <ul className="mt-1 space-y-0.5 text-sm text-muted">{comp.lines.map((l) => <li key={l}>{l}</li>)}</ul>}
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div className="sm:col-span-2"><dt className="text-faint">Qué tienes que entregar</dt>
                    <dd className="text-paper"><ul>{o.campaign_deliverables.map((d) => <li key={d.id}>{d.quantity} × {DELIVERABLE_LABEL[d.kind] ?? d.kind}{d.platform ? ` en ${d.platform}` : ''}{d.due_date ? ` · antes del ${date(d.due_date)}` : ''} — {d.description}</li>)}</ul></dd></div>
                  <div><dt className="text-faint">Uso de tu imagen</dt><dd className="text-paper">{usageSummary(o)}</dd></div>
                  <div><dt className="text-faint">Exclusividad</dt><dd className="text-paper">{exclusivitySummary(o)}</dd></div>
                  {o.terms && <div className="sm:col-span-2"><dt className="text-faint">Otras condiciones</dt><dd className="whitespace-pre-line text-paper">{o.terms}</dd></div>}
                </dl>
                <p className="mt-4 rounded-xl bg-surface-2 p-3 text-xs text-muted">Si compites en la NCAA o tienes visado de estudiante, revisa tu normativa (NIL Go, límites de ingresos) antes de aceptar. Tu agente puede ayudarte, pero la decisión es tuya.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <form action={respondBrandOffer}><input type="hidden" name="id" value={o.id} /><input type="hidden" name="accept" value="yes" /><button className={buttonClass('primary', 'md')}>Aceptar</button></form>
                  <details>
                    <summary className="inline-flex min-h-11 cursor-pointer items-center rounded-full border border-line-strong px-5 text-sm text-paper">Rechazar</summary>
                    <form action={respondBrandOffer} className="mt-2 flex max-w-md flex-col gap-2 rounded-xl border border-line p-3">
                      <input type="hidden" name="id" value={o.id} /><input type="hidden" name="accept" value="no" />
                      <label className="text-xs text-muted">Motivo (opcional, la marca lo verá)<input name="reason" maxLength={500} className="mt-1 w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-paper" /></label>
                      <button className={buttonClass('danger', 'md')}>Rechazar la oferta</button>
                    </form>
                  </details>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>

      {active.length > 0 && <h2 className="mb-3 mt-8 font-display text-xl font-bold uppercase text-paper">En marcha</h2>}
      <ul className="space-y-4">
        {active.map((o) => (
          <li key={o.id}>
            <Card>
              <CardTitle kicker={o.organizations?.name ?? 'Marca'} action={<Badge tone={o.payment_status === 'confirmed' ? 'ok' : o.payment_status === 'disputed' ? 'danger' : 'neutral'}>{PAYMENT_LABEL[o.payment_status]}</Badge>}>{o.brand_campaigns?.title}</CardTitle>
              <ul className="divide-y divide-line">
                {o.campaign_deliverables.map((d) => {
                  const last = [...d.campaign_deliverable_submissions].sort((a, b) => b.version - a.version)[0];
                  const canSubmit = ['not_started', 'in_progress', 'changes_requested'].includes(d.status);
                  return (
                    <li key={d.id} className="py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium text-paper">{d.quantity} × {DELIVERABLE_LABEL[d.kind] ?? d.kind}{d.due_date ? ` · antes del ${date(d.due_date)}` : ''}</p>
                        <Badge tone={d.status === 'approved' || d.status === 'completed' ? 'ok' : d.status === 'changes_requested' ? 'warn' : 'neutral'}>{DELIVERABLE_STATUS_LABEL[d.status]}</Badge>
                      </div>
                      <p className="text-xs text-muted">{d.description}</p>
                      {d.feedback && d.status === 'changes_requested' && <p className="mt-2 rounded-lg bg-warn/10 p-2 text-xs text-warn">La marca pide: {d.feedback}</p>}
                      {last && <p className="mt-1 text-xs text-faint">Última entrega: versión {last.version} · <a href={last.url} target="_blank" rel="noopener noreferrer" className="text-brass hover:underline">ver</a></p>}
                      {canSubmit && <div className="mt-2"><SubmitDeliverableForm id={d.id} /></div>}
                    </li>
                  );
                })}
              </ul>
              {(o.payment_status === 'pending' || o.payment_status === 'paid_declared') && (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                  <p className="w-full text-xs text-muted">{o.payment_status === 'paid_declared' ? 'La marca indica que ha pagado. Confírmalo solo cuando lo hayas recibido.' : 'Cuando recibas el pago, confírmalo aquí.'}</p>
                  <form action={updateBrandPayment}><input type="hidden" name="id" value={o.id} /><input type="hidden" name="status" value="confirmed" /><button className={buttonClass('primary', 'md')}>He recibido el pago</button></form>
                  <form action={updateBrandPayment}><input type="hidden" name="id" value={o.id} /><input type="hidden" name="status" value="disputed" /><button className={buttonClass('danger', 'md')}>Hay un problema</button></form>
                </div>
              )}
            </Card>
          </li>
        ))}
      </ul>

      {past.length > 0 && (
        <details className="mt-8">
          <summary className="cursor-pointer text-sm text-faint">Historial ({past.length})</summary>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            {past.map((o) => <li key={o.id}>{o.organizations?.name} · {o.brand_campaigns?.title} · {o.status === 'declined' ? 'rechazada' : o.status === 'expired' ? 'caducada' : 'retirada por la marca'}</li>)}
          </ul>
        </details>
      )}
      <p className="mt-8 text-xs text-faint">¿Algo no cuadra con una marca? <Link href="/app/inbox" className="text-brass hover:underline">Denúnciala o bloquéala desde la bandeja</Link>.</p>
    </>
  );
}
