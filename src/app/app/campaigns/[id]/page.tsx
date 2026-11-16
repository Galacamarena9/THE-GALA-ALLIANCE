import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { CAMPAIGN_KIND_LABEL, COMPENSATION_LABEL, usd } from '@/lib/domain/labels';
import { NIL_GO_THRESHOLD_USD, nilGoApplies } from '@/lib/domain/ncaa';
import { Badge, Card, CardTitle, EmptyState, Notice, PageHeader } from '@/components/ui';
import { CampaignApplyForm, ReportButton } from '@/components/forms';
import { moveCampaignApplication, setCampaignStatus } from '@/app/actions/marketplace';

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
            <div className="sm:col-span-2"><dt className="text-faint">Derechos de uso</dt><dd className="text-paper">{c.usage_rights ?? 'No indicados: pregunta antes de aceptar'}</dd></div>
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
                {(c.status === 'draft' || c.status === 'rejected') && <form action={setCampaignStatus}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="status" value="pending_review" /><button className="rounded-lg bg-brass px-3 py-1.5 text-sm text-ink">Enviar a revisión</button></form>}
                {c.status === 'published' && <form action={setCampaignStatus}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="status" value="closed" /><button className="rounded-lg border border-line-strong px-3 py-1.5 text-sm text-paper">Cerrar oferta</button></form>}
              </div>
            </Card>
          ) : session.isMinor ? (
            <Notice tone="neutral">Disponible a partir de los 18 años.</Notice>
          ) : mine ? (
            <Card><CardTitle kicker="Tu candidatura">{mine.status}</CardTitle><p className="text-sm text-muted">La marca te contactará por la plataforma si te selecciona.</p></Card>
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
                        <button className="rounded-lg border border-line-strong px-2.5 py-1 text-xs text-paper hover:border-brass">{s === 'shortlisted' ? 'Preseleccionar' : s === 'selected' ? 'Seleccionar' : 'Descartar'}</button>
                      </form>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          ) : <EmptyState title="Aún no hay candidatos" />}
        </Card>
      )}
    </>
  );
}
