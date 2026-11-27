import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { familyPlan, managedAthletes, PLAN_RANK } from '@/lib/data/family';
import { loadOffers, memoFor, type OfferView } from '@/lib/data/offers';
import { ATHLETE_STATUS_LABEL, usd } from '@/lib/domain/labels';
import { TRUST_LABEL } from '@/lib/domain/trust';
import type { ApplicationStatus } from '@/lib/types';
import { Badge, ButtonLink, Card, CardTitle, EmptyState, Notice, PageHeader } from '@/components/ui';
import { ExternalOfferForm } from '@/components/autonomy';
import { deleteExternalOffer } from '@/app/actions/autonomy';

export const metadata: Metadata = { title: 'Comparador de ofertas' };

const MAX = 5;

function FlagList({ o }: { o: OfferView }) {
  if (!o.flags.length) return <span className="text-xs text-ok">Sin señales de alarma</span>;
  return (
    <ul className="space-y-1 text-xs">
      {o.flags.map((f) => <li key={f.code} className={f.severity === 'high' ? 'text-danger' : 'text-warn'}>{f.severity === 'high' ? '● Grave: ' : '○ '}{f.text}</li>)}
    </ul>
  );
}

export default async function OffersPage({ searchParams }: { searchParams: Promise<{ a?: string; k?: string }> }) {
  const session = await requireSession(['athlete', 'parent']);
  const sp = await searchParams;
  const athletes = await managedAthletes(session);
  if (!athletes.length) {
    return (
      <>
        <PageHeader kicker="Decisión" title="Comparador de ofertas" />
        <EmptyState title="Vincula primero a tu hijo o hija" action={<ButtonLink href="/app/family">Ir a Familia</ButtonLink>} />
      </>
    );
  }
  const athlete = athletes.find((a) => a.id === sp.a) ?? athletes[0];
  const [offers, plan] = await Promise.all([loadOffers(athlete.id), familyPlan([session.userId, athlete.id])]);
  const elite = PLAN_RANK[plan] >= PLAN_RANK.family_elite;
  const keys = (sp.k ?? '').split(',').filter(Boolean);
  const selected = (keys.length ? offers.filter((o) => keys.includes(o.key)) : offers).slice(0, MAX);
  const memo = elite && selected.length ? memoFor(selected) : null;
  const qs = (k: string[]) => `/app/offers?a=${athlete.id}${k.length ? `&k=${k.join(',')}` : ''}`;
  const selKeys = selected.map((o) => o.key);

  return (
    <>
      <PageHeader
        kicker="Decisión"
        title="Comparador de ofertas"
        description="Coste neto, sello de confianza y señales de alarma de cada oferta, y un memo con la opción más sólida y lo que falta por preguntar."
        action={memo ? <ButtonLink href={`/print/memo?a=${athlete.id}&k=${selKeys.join(',')}`} variant="secondary">Memo imprimible</ButtonLink> : undefined}
      />
      {athletes.length > 1 && (
        <nav className="mb-5 flex flex-wrap gap-2" aria-label="Atleta">
          {athletes.map((a) => <Link key={a.id} href={`/app/offers?a=${a.id}`} className={`rounded-full border px-3 py-1 text-sm ${a.id === athlete.id ? 'border-brass text-paper' : 'border-line text-muted'}`}>{a.name}</Link>)}
        </nav>
      )}

      {offers.length === 0 && (
        <div className="mb-5"><EmptyState title="Aún no hay ofertas que comparar">Aparecerán aquí tus candidaturas en la plataforma{elite ? ' y las ofertas que añadas a mano' : ''}.</EmptyState></div>
      )}

      {!elite && offers.length > 0 && (
        <div className="mb-5"><Notice tone="brass">Ves las señales de alarma de cada oferta gratis. La tabla comparativa, el memo de decisión y añadir ofertas recibidas por email son parte de Elite. <Link href="/precios" className="underline">Ver planes</Link></Notice></div>
      )}

      {offers.length > 0 && (
        <Card className="mb-5">
          <CardTitle kicker={elite ? `${selected.length} de ${MAX} seleccionadas` : 'Tus ofertas'}>Ofertas</CardTitle>
          <ul className="divide-y divide-line">
            {offers.map((o) => {
              const on = selKeys.includes(o.key);
              return (
                <li key={o.key} className="grid gap-2 py-3 sm:grid-cols-[1fr_auto] sm:items-start">
                  <div>
                    <p className="text-paper">{o.title} <span className="text-xs text-faint">· {o.source === 'platform' ? o.orgName : 'añadida a mano'}</span></p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {o.status && <Badge>{ATHLETE_STATUS_LABEL[o.status as ApplicationStatus] ?? o.status}</Badge>}
                      {o.trust && <Badge tone={o.trust >= 4 ? 'ok' : 'brass'}>Confianza {o.trust}/5 · {TRUST_LABEL[o.trust]}</Badge>}
                    </div>
                    <div className="mt-2"><FlagList o={o} /></div>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    {elite && (on
                      ? <Link href={qs(selKeys.filter((k) => k !== o.key))} className="text-faint hover:text-paper">Quitar de la comparación</Link>
                      : selKeys.length < MAX && <Link href={qs([...selKeys, o.key])} className="text-brass hover:underline">Comparar</Link>)}
                    {elite && o.source === 'external' && (
                      <form action={deleteExternalOffer}><input type="hidden" name="id" value={o.id} /><input type="hidden" name="athlete_id" value={athlete.id} /><button className="text-xs text-faint hover:text-danger">Borrar</button></form>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {memo && (
        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <Card>
            <CardTitle kicker="Comparación">Coste neto por año</CardTitle>
            <div className="overflow-x-auto">
              <table className="data-table w-full min-w-[520px] text-sm">
                <thead><tr className="text-left text-xs text-faint"><th className="py-2 pr-3 font-normal">Oferta</th><th className="pr-3 text-right font-normal">Coste</th><th className="pr-3 text-right font-normal">Ayuda</th><th className="pr-3 text-right font-normal">Neto</th><th className="text-right font-normal">4 años</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {selected.map((o) => (
                    <tr key={o.key}>
                      <th scope="row" className="py-2.5 pr-3 text-left font-normal text-paper">{o.title}</th>
                      <td className="pr-3 text-right tabular-nums text-muted">{usd(o.costUsd)}</td>
                      <td className="pr-3 text-right tabular-nums text-muted">{usd(o.aidUsd)}</td>
                      <td className="pr-3 text-right tabular-nums text-paper">{o.netUsd == null ? 'Incompleto' : usd(o.netUsd)}</td>
                      <td className="text-right tabular-nums text-muted">{o.netUsd == null ? '—' : usd(o.netUsd * 4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-faint">A 4 años sin subidas: compruébalo con la <Link href="/app/calculator" className="text-brass hover:underline">calculadora</Link>, que incluye viajes, seguro y subidas anuales.</p>
          </Card>
          <Card className="paper-grain">
            <CardTitle kicker="Memo de decisión">{memo.recommended ? `La más sólida hoy: ${memo.recommended}` : 'Ninguna está libre de riesgos graves'}</CardTitle>
            <ol className="space-y-1 text-sm text-muted">
              {memo.ranking.map((r, i) => <li key={r.title}>{i + 1}. <span className="text-paper">{r.title}</span> · {r.highRisks} graves · {r.mediumRisks} de atención · neto {r.netCostUsd == null ? 'incompleto' : usd(r.netCostUsd)}</li>)}
            </ol>
            {memo.decideBy && <p className="mt-3 text-sm text-paper">Primer plazo: {memo.decideBy}</p>}
            {memo.questions.length > 0 && (
              <>
                <p className="mt-4 text-xs uppercase tracking-wide text-faint">Preguntas pendientes</p>
                <ul className="mt-1 space-y-1 text-sm text-muted">{memo.questions.map((q) => <li key={q}>• {q}</li>)}</ul>
              </>
            )}
            <p className="mt-4 text-xs text-faint">Ordena por riesgos graves, después de atención y después por coste neto. Es una ayuda para decidir, no una recomendación profesional.</p>
          </Card>
        </div>
      )}

      {elite && athlete.canEdit && (
        <Card className="mt-5">
          <CardTitle kicker="Ofertas por email">Añadir una oferta recibida fuera de la plataforma</CardTitle>
          <ExternalOfferForm athleteId={athlete.id} />
        </Card>
      )}
    </>
  );
}
