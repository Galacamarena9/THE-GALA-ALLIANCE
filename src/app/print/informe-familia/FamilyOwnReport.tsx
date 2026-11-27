import { notFound } from 'next/navigation';
import type { SessionContext } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { guardianLinks, loadFamilyChild, type GuardianLink } from '@/lib/data/family-home';
import { familyCost, fourYearLine, validFx, type CostScenario, type FxRate } from '@/lib/domain/family-cost';
import { getT } from '@/lib/i18n/server-t';
import { PrintButton } from '@/components/autonomy';

const PURPOSE: Record<string, string> = { application_review: 'Revisión de candidatura', recruiting: 'Proceso de recruiting', trial: 'Trial', enrollment: 'Inscripción' };

/**
 * Informe que la familia genera sin depender de un agente (QA familia, hallazgo 15). Lo pueden abrir el tutor activo
 * y el propio atleta. Cada consulta pasa por la RLS con su sesión: si un permiso no está concedido, esa sección lo dice
 * y llega vacía. El presupuesto familiar no aparece (puede imprimirse y enseñarse a terceros).
 */
export async function FamilyOwnReport({ session, athleteParam }: { session: SessionContext; athleteParam?: string }) {
  const tx = await getT();
  const lang = tx.locale === 'en' ? 'en' : 'es';
  const dl = lang === 'en' ? 'en-US' : 'es-ES';
  const fmtDate = (d: string | null | undefined) => (d ? new Date(d.length === 10 ? `${d}T12:00:00` : d).toLocaleDateString(dl, { day: 'numeric', month: 'long', year: 'numeric' }) : '—');

  let link: GuardianLink | null = null;
  if (session.roles.includes('parent')) {
    const links = (await guardianLinks(session)).filter((l) => l.active);
    link = links.find((l) => l.athleteId === athleteParam) ?? (athleteParam ? null : links[0] ?? null);
  } else if (session.roles.includes('athlete') && (!athleteParam || athleteParam === session.userId)) {
    const all = { profile: true, applications: true, academics: true, edit: true, costs: true, budget: true, documents: true, contacts: true, messages: true };
    link = { id: session.userId, athleteId: session.userId, name: session.displayName, relationship: 'self', verification: 'admin_verified', status: 'approved', active: true, scopes: all };
  }
  if (!link) notFound();

  const supabase = await createClient();
  const s = link.scopes;
  const [home, { data: scen }, { data: fxRow }, { data: grants }] = await Promise.all([
    loadFamilyChild(session, link),
    s.costs
      ? supabase.from('family_cost_scenarios').select('label, currency, tuition, fees, housing, meals, insurance, travel, other_costs, athletic_aid, academic_aid, other_aid, housing_included')
          .eq('athlete_id', link.athleteId).order('updated_at', { ascending: false }).limit(8)
      : Promise.resolve({ data: null }),
    s.costs ? supabase.from('family_cost_settings').select('eur_per_usd, rate_date, rate_source').eq('athlete_id', link.athleteId).maybeSingle() : Promise.resolve({ data: null }),
    s.documents
      ? supabase.from('document_access_grants').select('id, purpose, expires_at, revoked_at, athlete_documents(title), organizations(name)')
          .eq('athlete_id', link.athleteId).is('revoked_at', null).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(30)
      : Promise.resolve({ data: null }),
  ]);
  const fxCandidate = fxRow ? { eurPerUsd: Number(fxRow.eur_per_usd), date: fxRow.rate_date as string, source: fxRow.rate_source as string } : null;
  const fx: FxRate | null = validFx(fxCandidate) ? fxCandidate : null;
  type G = { id: string; purpose: string; expires_at: string; athlete_documents: { title: string } | null; organizations: { name: string } | null };
  const activeGrants = (grants ?? []) as unknown as G[];
  const options = ((scen ?? []) as unknown as (CostScenario & { label: string })[]).map((x) => ({ label: x.label, r: familyCost(x, lang) }));
  const notShared = <p className="mt-1 text-neutral-600">{tx('No compartido contigo: el atleta no ha activado este permiso.')}</p>;

  return (
    <main className="mx-auto max-w-3xl px-8 py-10 text-[13px] leading-relaxed">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-neutral-100 p-3 text-sm">
        <span>{tx('Vuestro informe, generado por vosotros. Guárdalo en PDF o imprímelo. No incluye el presupuesto familiar.')}</span>
        <PrintButton label={tx('Imprimir o guardar en PDF')} />
      </div>
      <header className="border-b-2 border-neutral-900 pb-3">
        <p className="text-xs uppercase tracking-widest text-neutral-500">The Gala Alliance · {tx('Informe para la familia')}</p>
        <h1 className="mt-1 font-display text-3xl">{link.name}</h1>
        <p className="text-neutral-600">{tx('Generado el')} {fmtDate(new Date().toISOString())}</p>
      </header>

      <section className="mt-5 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-md border border-neutral-200 p-3"><p className="font-display text-2xl">{home.approvals.length}</p><p className="text-xs text-neutral-500">{tx('esperan vuestra aprobación')}</p></div>
        <div className="rounded-md border border-neutral-200 p-3"><p className="font-display text-2xl">{s.applications ? home.process.applications : '—'}</p><p className="text-xs text-neutral-500">{tx('candidaturas')}</p></div>
        <div className="rounded-md border border-neutral-200 p-3"><p className="font-display text-2xl">{home.offers.length}</p><p className="text-xs text-neutral-500">{tx('ofertas pendientes')}</p></div>
      </section>

      <H2>{tx('Pendiente de vuestra aprobación')}</H2>
      {home.approvals.length === 0 ? <p className="mt-1">{tx('Nada pendiente ahora mismo.')}</p> : (
        <ul className="mt-1 list-disc pl-5">{home.approvals.map((a, i) => <li key={`${a.kind}-${i}`}>{a.what}</li>)}</ul>
      )}

      <H2>{tx('Plazos de los próximos 30 días')}</H2>
      {!s.applications && home.deadlines.length === 0 ? notShared : home.deadlines.length === 0 ? <p className="mt-1">{tx('No hay plazos en los próximos 30 días.')}</p> : (
        <table className="mt-2 w-full border-collapse">
          <tbody>{home.deadlines.map((d, i) => (
            <tr key={`${d.date}-${i}`} className="border-b border-neutral-100"><td className="py-1.5">{d.label}</td><td className="text-right tabular-nums">{fmtDate(d.date)}</td></tr>
          ))}</tbody>
        </table>
      )}

      <H2>{tx('Ofertas')}</H2>
      {home.offers.length === 0 ? <p className="mt-1">{tx('Sin ofertas pendientes (o no compartidas contigo).')}</p> : (
        <table className="mt-2 w-full border-collapse">
          <tbody>{home.offers.map((o, i) => (
            <tr key={`${o.org}-${i}`} className="border-b border-neutral-100"><td className="py-1.5">{o.org}</td><td className="text-right tabular-nums">{tx('Responder antes de')} {fmtDate(o.deadline)}</td></tr>
          ))}</tbody>
        </table>
      )}

      <H2>{tx('Coste real por opción')}</H2>
      {!s.costs ? notShared : options.length === 0 ? <p className="mt-1">{tx('Aún no habéis añadido opciones de coste.')}</p> : (
        <ul className="mt-1 space-y-2">
          {options.map(({ label, r }) => (
            <li key={label} className="border-b border-neutral-100 pb-2">
              <strong>{label}</strong>: {r.headline}
              {fourYearLine(r, fx, lang) && <span className="block text-neutral-600">{fourYearLine(r, fx, lang)}</span>}
            </li>
          ))}
          <li className="text-xs text-neutral-500">
            {fx
              ? `${tx('Tipo de cambio indicado por la familia')}: 1 US$ = ${fx.eurPerUsd.toLocaleString(dl, { maximumFractionDigits: 4 })} € · ${fmtDate(fx.date)} · ${tx('Fuente')}: ${fx.source}.`
              : tx('Sin tipo de cambio: importes solo en la moneda de la fuente.')}
          </li>
        </ul>
      )}

      <H2>{tx('Quién tiene acceso a sus documentos')}</H2>
      {!s.documents ? notShared : activeGrants.length === 0 ? <p className="mt-1">{tx('Ninguna organización tiene acceso a sus documentos ahora mismo.')}</p> : (
        <table className="mt-2 w-full border-collapse">
          <tbody>{activeGrants.map((g) => (
            <tr key={g.id} className="border-b border-neutral-100">
              <td className="py-1.5">{g.organizations?.name ?? tx('Organización')}</td>
              <td>{g.athlete_documents?.title ?? '—'} · {tx(PURPOSE[g.purpose] ?? g.purpose)}</td>
              <td className="text-right tabular-nums">{tx('hasta')} {fmtDate(g.expires_at)}</td>
            </tr>
          ))}</tbody>
        </table>
      )}

      <H2>{tx('Quién le contacta')}</H2>
      {!s.contacts && home.contacts.length === 0 ? notShared : home.contacts.length === 0 ? <p className="mt-1">{tx('Ninguna organización le ha contactado todavía.')}</p> : (
        <ul className="mt-1 list-disc pl-5">{home.contacts.map((c) => <li key={c.id}>{c.org}{c.orgVerified ? ` (${tx('verificada')})` : ''} · {fmtDate(c.createdAt)}</li>)}</ul>
      )}

      <footer className="mt-8 border-t border-neutral-200 pt-3 text-xs text-neutral-500">
        {tx('Las cifras de coste son las que habéis introducido; lo que falta aparece como «sin dato», nunca como 0. La decisión es siempre de la familia y del atleta.')}
      </footer>
    </main>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-6 text-xs font-semibold uppercase tracking-widest text-neutral-500">{children}</h2>;
}
