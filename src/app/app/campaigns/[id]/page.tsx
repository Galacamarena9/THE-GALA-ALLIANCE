import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { CAMPAIGN_KIND_LABEL, COMPENSATION_LABEL, usd } from '@/lib/domain/labels';
import { NIL_GO_THRESHOLD_USD, nilGoApplies } from '@/lib/domain/ncaa';
import { Badge, Card, CardTitle, EmptyState, Notice, PageHeader, buttonClass } from '@/components/ui';
import { CampaignApplyForm, ReportButton } from '@/components/forms';
import { moveCampaignApplication, setCampaignStatus } from '@/app/actions/marketplace';
import { updateBrandPayment, withdrawBrandOffer } from '@/app/actions/brand-offers';
import { BrandOfferForm, ReviewDeliverableForm } from '@/components/brand/OfferForms';
import { DELIVERABLE_LABEL, DELIVERABLE_STATUS_LABEL, PAYMENT_LABEL, describeCompensation, exclusivitySummary, usageSummary, type OfferComponent } from '@/lib/domain/brand-offers';

export const metadata: Metadata = { title: 'Oferta de marca' };

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const session = await requireSession(['athlete', 'brand']);
  const supabase = await createClient();
  const { data: c } = await supabase.from('brand_campaigns').select('*, organizations(id, name, website)').eq('id', id).maybeSingle();
  if (!c) notFound();
  const org = c.organizations as { id: string; name: string; website: string | null } | null;
  const { data: membership } = await supabase.from('organization_members').select('member_role').eq('organization_id', c.brand_org_id).eq('user_id', session.userId).maybeSingle();
  const isMember = Boolean(membership);

  const { data: apps } = isMember
    ? await supabase.from('campaign_applications').select('id, status, message, athlete_id, created_at').eq('campaign_id', id).order('created_at', { ascending: false })
    : await supabase.from('campaign_applications').select('id, status, message, athlete_id, created_at').eq('campaign_id', id).eq('athlete_id', session.userId);
  const athleteIds = (apps ?? []).map((a) => a.athlete_id);
  const { data: dir } = isMember && athleteIds.length ? await supabase.from('athlete_directory').select('user_id, display_name, sport_id, country').in('user_id', athleteIds) : { data: [] };
  const nameById = new Map((dir ?? []).map((d) => [d.user_id, d]));
  const mine = !isMember ? apps?.[0] : null;
  type O = { id: string; application_id: string; status: string; version: number; payment_status: string; compensation_unknown: boolean;
    campaign_offer_components: OfferComponent[];
    campaign_deliverables: { id: string; kind: string; quantity: number; status: string; campaign_deliverable_submissions: { version: number; url: string }[] }[] };
  const { data: offerRows } = isMember
    ? await supabase.from('campaign_offers').select('id, application_id, status, version, payment_status, compensation_unknown, campaign_offer_components(kind, amount, currency, guaranteed, description), campaign_deliverables(id, kind, quantity, status, campaign_deliverable_submissions(version, url))')
        .eq('campaign_id', id).neq('status', 'superseded').order('version', { ascending: false })
    : { data: [] };
  const offerByApp = new Map<string, O>();
  for (const o of (offerRows ?? []) as unknown as O[]) if (!offerByApp.has(o.application_id)) offerByApp.set(o.application_id, o);

  return (
    <>
      <PageHeader kicker={`${CAMPAIGN_KIND_LABEL[c.kind]} · ${org?.name}`} title={c.title} description={org?.website ? <a href={org.website} target="_blank" rel="noopener noreferrer" className="text-brass hover:underline">Web oficial de la marca ↗</a> : undefined} />
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <p className="whitespace-pre-line leading-relaxed text-muted">{c.description}</p>
          <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
            <div className="sm:col-span-2"><dt className="text-faint">Entregables</dt><dd className="whitespace-pre-line text-paper">{c.deliverables}</dd></div>
            <div><dt className="text-faint">Compensación</dt><dd className="text-paper">{COMPENSATION_LABEL[c.compensation_kind]}{c.compensation_usd != null ? ` · ${usd(c.compensation_usd)}` : ''}</dd></div>
            <div><dt className="text-faint">Territorio</dt><dd className="text-paper">{c.territory ?? 'No indicado'}</dd></div>
            {c.product_description && <div><dt className="text-faint">Producto</dt><dd className="text-paper">{c.product_description}{c.product_value_usd != null ? ` · valor ${usd(c.product_value_usd)} (no es dinero)` : ''}</dd></div>}
            <div><dt className="text-faint">Uso de la imagen</dt><dd className="text-paper">{c.usage_months != null ? usageSummary({ usage_months: c.usage_months, usage_channels: c.usage_channels ?? [], usage_territory: c.territory ?? 'WORLD', organic_use: true, paid_media: !!c.paid_media }) : 'No indicado: pregunta antes de aceptar'}</dd></div>
            <div><dt className="text-faint">Exclusividad</dt><dd className="text-paper">{exclusivitySummary({ exclusivity_category: c.exclusivity_category ?? null, exclusivity_days: c.exclusivity_days ?? 0 })}</dd></div>
            {c.usage_rights && <div className="sm:col-span-2"><dt className="text-faint">Otras condiciones de uso</dt><dd className="text-paper">{c.usage_rights}</dd></div>}
            <div><dt className="text-faint">Plazo</dt><dd className="text-paper">{c.application_deadline ?? 'Abierto'}</dd></div>
          </dl>
          <div className="mt-6 rounded-2xl border border-line bg-surface-2 p-4 text-sm leading-relaxed text-muted">
            <p className="font-semibold text-paper">Cumplimiento NIL en EE. UU.</p>
            <p className="mt-1">
              {nilGoApplies(c.compensation_usd)
                ? `Este acuerdo supera los ${NIL_GO_THRESHOLD_USD} $: si el atleta compite en NCAA División I, debe declararlo en NIL Go (College Sports Commission) en los 5 días hábiles siguientes a firmarlo.`
                : `Si el acuerdo llega a ${NIL_GO_THRESHOLD_USD} $ o más (sumando pagos del mismo pagador) y el atleta compite en NCAA División I, debe declararlo en NIL Go en 5 días hábiles.`}{' '}
              Los atletas internacionales con visado de estudiante tienen límites para cobrar en EE. UU.: consultadlo con un abogado de inmigración antes de firmar.
            </p>
          </div>
        </Card>
        <div className="space-y-5">
          {isMember ? (
            <Card>
              <CardTitle kicker="Estado">{c.status}</CardTitle>
              {c.review_note && <p className="mb-3 text-sm text-muted">Nota de revisión: {c.review_note}</p>}
              <div className="flex gap-2">
                {(c.status === 'draft' || c.status === 'rejected') && <form action={setCampaignStatus}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="status" value="pending_review" /><button className={buttonClass('primary', 'sm')}>Enviar a revisión</button></form>}
                {c.status === 'published' && <form action={setCampaignStatus}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="status" value="closed" /><button className={buttonClass('secondary', 'sm')}>Cerrar oferta</button></form>}
              </div>
            </Card>
          ) : session.isMinor ? (
            <Notice tone="neutral">Disponible a partir de los 18 años.</Notice>
          ) : mine ? (
            <Card><CardTitle kicker="Tu candidatura">{mine.status === 'selected' ? 'Seleccionado' : mine.status}</CardTitle>
              <p className="text-sm text-muted">{mine.status === 'selected' ? 'La marca te ha seleccionado. Su oferta, con todas las condiciones, te llegará a «Mis colaboraciones».' : 'La marca te contactará por la plataforma si te selecciona.'}</p>
              {mine.status === 'selected' && <Link href="/app/collaborations" className="mt-2 inline-block text-sm text-brass hover:underline">Ir a Mis colaboraciones →</Link>}
            </Card>
          ) : c.status === 'published' ? (
            <Card><CardTitle kicker="Aplicar">¿Te interesa?</CardTitle><CampaignApplyForm campaignId={c.id} /></Card>
          ) : null}
          <div className="text-right"><ReportButton entityType="campaign" entityId={c.id} label="Denunciar esta oferta" /></div>
        </div>
      </div>

      {isMember && (
        <Card className="mt-5">
          <CardTitle kicker="Candidatos">Atletas que han aplicado</CardTitle>
          {apps?.length ? (
            <ul className="divide-y divide-line">
              {apps.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <Link href={`/athletes/${a.athlete_id}`} className="text-paper hover:text-brass">{nameById.get(a.athlete_id)?.display_name ?? 'Atleta'}</Link>
                    {a.message && <p className="line-clamp-2 text-sm text-muted">“{a.message}”</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={a.status === 'selected' ? 'ok' : a.status === 'declined' ? 'danger' : 'brass'}>{a.status}</Badge>
                    {(['shortlisted', 'selected', 'declined'] as const).filter((s) => s !== a.status && a.status !== 'withdrawn').map((s) => (
                      <form key={s} action={moveCampaignApplication}>
                        <input type="hidden" name="id" value={a.id} /><input type="hidden" name="status" value={s} /><input type="hidden" name="campaign_id" value={c.id} />
                        <button className={buttonClass('secondary', 'sm')}>{s === 'shortlisted' ? 'Preseleccionar' : s === 'selected' ? 'Seleccionar' : 'Descartar'}</button>
                      </form>
                    ))}
                  </div>
                  {a.status === 'selected' && (() => {
                    const o = offerByApp.get(a.id);
                    const comp = o ? describeCompensation(o.campaign_offer_components, o.compensation_unknown) : null;
                    return (
                      <div className="w-full rounded-xl border border-line bg-surface-2/40 p-3">
                        {o && comp ? (
                          <>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm text-paper">Oferta v{o.version} · {comp.headline}</p>
                              <Badge tone={o.status === 'accepted' ? 'ok' : o.status === 'sent' ? 'brass' : 'neutral'}>{o.status === 'sent' ? 'Esperando al atleta' : o.status === 'accepted' ? 'Aceptada' : o.status === 'declined' ? 'Rechazada' : o.status === 'expired' ? 'Caducada' : 'Retirada'}</Badge>
                            </div>
                            {o.status === 'sent' && <form action={withdrawBrandOffer} className="mt-2"><input type="hidden" name="id" value={o.id} /><input type="hidden" name="campaign_id" value={c.id} /><button className="text-xs text-faint hover:text-danger">Retirar oferta</button></form>}
                            {o.status === 'accepted' && (
                              <>
                                <ul className="mt-2 space-y-2">
                                  {o.campaign_deliverables.map((d) => {
                                    const last = [...d.campaign_deliverable_submissions].sort((x, y) => y.version - x.version)[0];
                                    return (
                                      <li key={d.id} className="text-sm">
                                        <span className="text-paper">{d.quantity} × {DELIVERABLE_LABEL[d.kind] ?? d.kind}</span> · <span className="text-muted">{DELIVERABLE_STATUS_LABEL[d.status]}</span>
                                        {last && <> · <a href={last.url} target="_blank" rel="noopener noreferrer" className="text-brass hover:underline">versión {last.version}</a></>}
                                        {d.status === 'submitted' && <div className="mt-2"><ReviewDeliverableForm id={d.id} campaignId={c.id} /></div>}
                                      </li>
                                    );
                                  })}
                                </ul>
                                <p className="mt-2 text-xs text-muted">Pago: {PAYMENT_LABEL[o.payment_status]}</p>
                                {(o.payment_status === 'pending' || o.payment_status === 'disputed') && (
                                  <form action={updateBrandPayment} className="mt-1"><input type="hidden" name="id" value={o.id} /><input type="hidden" name="status" value="paid_declared" /><input type="hidden" name="campaign_id" value={c.id} />
                                    <button className={buttonClass('secondary', 'sm')}>Ya hemos pagado</button></form>
                                )}
                              </>
                            )}
                          </>
                        ) : <p className="text-sm text-muted">Seleccionado. Envía tu oferta con todas las condiciones explícitas.</p>}
                        {(!o || o.status !== 'accepted') && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-sm font-medium text-brass">{o?.status === 'sent' ? 'Enviar una nueva versión' : 'Enviar oferta'}</summary>
                            <div className="mt-3"><BrandOfferForm applicationId={a.id} campaignId={c.id} /></div>
                          </details>
                        )}
                      </div>
                    );
                  })()}
                </li>
              ))}
            </ul>
          ) : <EmptyState title="Aún no hay candidatos" />}
        </Card>
      )}
    </>
  );
}
