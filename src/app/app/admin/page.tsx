import { requireAdminMfa } from '@/lib/mfa';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { ORG_TYPE_LABEL, LINK_KIND_LABEL, daysSince, domainOf, usd } from '@/lib/domain/labels';
import type { OrgType } from '@/lib/types';
import { Badge, Card, CardTitle, PageHeader, inputClass } from '@/components/ui';
import { ScorecardImportForm } from '@/components/forms';
import { decideReport, resolveDataRequest, reviewCampaign, reviewOpportunity, reviewOrganization, verifyAthleteLink } from '@/app/actions/admin';

export const metadata: Metadata = { title: 'Revisión' };

const REASON: Record<string, string> = { child_safety: 'Seguridad infantil', harassment: 'Acoso', fake_or_misleading: 'Falso / engañoso', spam: 'Spam', illegal_content: 'Ilegal', privacy: 'Privacidad', other: 'Otro' };

export default async function AdminPage() {
  const session = await requireSession(['admin']);
  await requireAdminMfa();
  if (!session.roles.includes('admin')) redirect('/app');
  const supabase = await createClient();

  const [orgs, opps, camps, reports, dsr, links, insts] = await Promise.all([
    supabase.from('organizations').select('id, name, type, website, requester_email_domain, created_at').eq('verification_status', 'submitted').order('created_at'),
    supabase.from('opportunities').select('id, title, annual_cost_usd, aid_amount_usd, organizations(name, verification_status)').eq('status', 'pending_review').order('created_at'),
    supabase.from('brand_campaigns').select('id, title, compensation_kind, compensation_usd, organizations(name, verification_status)').eq('status', 'pending_review').order('created_at'),
    supabase.from('content_reports').select('id, entity_type, entity_id, reason, details, status, priority, created_at').in('status', ['open', 'reviewing']).order('priority').order('created_at'),
    supabase.from('data_subject_requests').select('id, user_id, request_type, details, status, created_at').in('status', ['received', 'in_progress']).order('created_at'),
    supabase.from('athlete_links').select('id, athlete_id, kind, url').eq('verified', false).order('created_at').limit(30),
    supabase.from('institutions').select('id, name, state').order('name').limit(500),
  ]);

  const queue = (n: number) => <Badge tone={n ? 'warn' : 'ok'}>{n}</Badge>;

  return (
    <>
      <PageHeader kicker="Trust & Safety" title="Revisión y verificación" description="Todo lo que se publica pasa por aquí. Cada decisión queda en el registro de auditoría." />
      <div className="space-y-5">
        <Card>
          <CardTitle kicker="Denuncias (DSA)" action={queue(reports.data?.length ?? 0)}>Cola por prioridad</CardTitle>
          <ul className="divide-y divide-line">
            {(reports.data ?? []).map((r) => (
              <li key={r.id} className="py-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge tone={r.priority === 0 ? 'danger' : r.priority === 1 ? 'warn' : 'neutral'}>{REASON[r.reason]}</Badge>
                  <span className="text-paper">{r.entity_type}</span>
                  <span className="text-faint">· hace {daysSince(r.created_at)} día(s)</span>
                </div>
                {r.details && <p className="mt-1 text-sm text-muted">{r.details}</p>}
                <form action={decideReport} className="mt-2 flex flex-wrap gap-2">
                  <input type="hidden" name="id" value={r.id} />
                  <input name="decision_reason" placeholder="Motivo de la decisión (obligatorio para cerrar)" aria-label="Motivo" className={`${inputClass} max-w-md py-1.5`} />
                  <button name="status" value="actioned" className="rounded-lg bg-brass px-3 text-xs text-ink">Actuar</button>
                  <button name="status" value="dismissed" className="rounded-lg border border-line-strong px-3 text-xs text-paper">Desestimar</button>
                  <button name="status" value="reviewing" className="text-xs text-muted">Marcar en revisión</button>
                </form>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardTitle kicker="Organizaciones" action={queue(orgs.data?.length ?? 0)}>Verificación pendiente</CardTitle>
          <ul className="divide-y divide-line">
            {(orgs.data ?? []).map((o) => {
              const web = domainOf(o.website);
              const match = web && o.requester_email_domain ? o.requester_email_domain.endsWith(web) : null;
              return (
                <li key={o.id} className="py-3">
                  <p className="text-paper">{o.name} <span className="text-faint">· {ORG_TYPE_LABEL[o.type as OrgType]}</span></p>
                  <p className="text-xs text-muted">
                    Web: {o.website ? <a href={o.website} target="_blank" rel="noopener noreferrer" className="text-brass">{web} ↗</a> : 'sin web'} · Email del solicitante: @{o.requester_email_domain ?? '—'}{' '}
                    {match === true ? <span className="text-ok">coincide con el dominio ✓</span> : match === false ? <span className="text-warn">no coincide: pedir documentación</span> : null}
                  </p>
                  <form action={reviewOrganization} className="mt-2 flex flex-wrap gap-2">
                    <input type="hidden" name="id" value={o.id} />
                    {(o.type === 'university' || o.type === 'college') && (
                      <select name="institution_id" aria-label="Vincular institución oficial" className={`${inputClass} max-w-xs py-1.5`}>
                        <option value="">Vincular institución oficial…</option>
                        {(insts.data ?? []).map((i) => <option key={i.id} value={i.id}>{i.name} ({i.state})</option>)}
                      </select>
                    )}
                    <button name="status" value="verified" className="rounded-lg bg-brass px-3 text-xs text-ink">Verificar</button>
                    <button name="status" value="rejected" className="rounded-lg border border-line-strong px-3 text-xs text-paper">Rechazar</button>
                  </form>
                </li>
              );
            })}
          </ul>
        </Card>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardTitle kicker="Becas" action={queue(opps.data?.length ?? 0)}>Oportunidades en revisión</CardTitle>
            <ul className="divide-y divide-line">
              {(opps.data ?? []).map((o) => {
                const org = o.organizations as unknown as { name: string; verification_status: string } | null;
                return (
                  <li key={o.id} className="py-3">
                    <Link href={`/app/opportunities/${o.id}`} className="text-paper hover:text-brass">{o.title}</Link>
                    <p className="text-xs text-muted">{org?.name} {org?.verification_status !== 'verified' && <span className="text-warn">(organización sin verificar: no se puede publicar)</span>} · coste {usd(o.annual_cost_usd)} · ayuda {usd(o.aid_amount_usd)}</p>
                    <form action={reviewOpportunity} className="mt-2 flex gap-2">
                      <input type="hidden" name="id" value={o.id} />
                      <input name="review_note" placeholder="Nota (si rechazas)" aria-label="Nota" className={`${inputClass} py-1.5`} />
                      <button name="status" value="published" className="rounded-lg bg-brass px-3 text-xs text-ink">Publicar</button>
                      <button name="status" value="rejected" className="rounded-lg border border-line-strong px-3 text-xs text-paper">Rechazar</button>
                    </form>
                  </li>
                );
              })}
            </ul>
          </Card>
          <Card>
            <CardTitle kicker="Marcas" action={queue(camps.data?.length ?? 0)}>Ofertas en revisión</CardTitle>
            <ul className="divide-y divide-line">
              {(camps.data ?? []).map((c) => (
                <li key={c.id} className="py-3">
                  <Link href={`/app/campaigns/${c.id}`} className="text-paper hover:text-brass">{c.title}</Link>
                  <p className="text-xs text-muted">{(c.organizations as unknown as { name: string } | null)?.name} · {c.compensation_kind} {c.compensation_usd != null ? usd(c.compensation_usd) : ''}</p>
                  <form action={reviewCampaign} className="mt-2 flex gap-2">
                    <input type="hidden" name="id" value={c.id} />
                    <input name="review_note" placeholder="Nota (si rechazas)" aria-label="Nota" className={`${inputClass} py-1.5`} />
                    <button name="status" value="published" className="rounded-lg bg-brass px-3 text-xs text-ink">Publicar</button>
                    <button name="status" value="rejected" className="rounded-lg border border-line-strong px-3 text-xs text-paper">Rechazar</button>
                  </form>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardTitle kicker="Datos de atletas" action={queue(links.data?.length ?? 0)}>Enlaces por verificar</CardTitle>
            <ul className="divide-y divide-line text-sm">
              {(links.data ?? []).map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0"><span className="text-paper">{LINK_KIND_LABEL[l.kind]}</span> · <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-brass">{domainOf(l.url)} ↗</a></span>
                  <form action={verifyAthleteLink}><input type="hidden" name="id" value={l.id} /><button className="text-xs text-ok">Verificar</button></form>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardTitle kicker="RGPD" action={queue(dsr.data?.length ?? 0)}>Solicitudes de derechos (plazo: 1 mes)</CardTitle>
            <ul className="divide-y divide-line text-sm">
              {(dsr.data ?? []).map((d) => (
                <li key={d.id} className="py-2.5">
                  <p className="text-paper">{d.request_type} <span className="text-faint">· hace {daysSince(d.created_at)} día(s)</span>{daysSince(d.created_at) > 21 && <span className="text-danger"> · urgente</span>}</p>
                  {d.details && <p className="text-xs text-muted">{d.details}</p>}
                  <form action={resolveDataRequest} className="mt-1 flex gap-2">
                    <input type="hidden" name="id" value={d.id} />
                    <button name="status" value="in_progress" className="text-xs text-muted">En curso</button>
                    <button name="status" value="completed" className="text-xs text-ok">Completada</button>
                    <button name="status" value="rejected" className="text-xs text-danger">Rechazada</button>
                  </form>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-faint">Las supresiones de cuenta se ejecutan con service role desde el panel de Supabase (Auth → Users) tras verificar la identidad.</p>
          </Card>
        </div>

        <Card>
          <CardTitle kicker="Directorio">Importar universidad con datos oficiales</CardTitle>
          <p className="mb-4 text-sm text-muted">Busca por nombre en College Scorecard (U.S. Department of Education). Se guardan nombre, ciudad, estado, web, calculadora de precio y coste oficial con fecha de consulta. Después completa división, deportes y enlaces desde la ficha.</p>
          <ScorecardImportForm />
        </Card>
      </div>
    </>
  );
}
