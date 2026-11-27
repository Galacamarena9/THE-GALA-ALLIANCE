import type { Metadata } from 'next';
import { z } from 'zod';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/session';
import { loadAthlete360 } from '@/lib/data/athlete-360';
import { buildMonthlyReport, isMonth } from '@/lib/domain/agent-report';
import { usd } from '@/lib/domain/labels';
import { PrintButton } from '@/components/autonomy';
import { FamilyOwnReport } from './FamilyOwnReport';

export const metadata: Metadata = { title: 'Informe para la familia' };

/**
 * Informe mensual que el agente entrega a la familia (imprimir o guardar en PDF).
 * Mismos permisos que la ficha del atleta (loadAthlete360 + RLS). Solo procesos compartidos con el atleta:
 * las notas internas de la agencia nunca aparecen.
 */
export default async function FamilyReportPage({ searchParams }: { searchParams: Promise<{ a?: string; m?: string }> }) {
  const session = await requireSession(['agent', 'parent', 'athlete']);
  const sp = await searchParams;
  // QA familia (hallazgo 15): la familia y el atleta generan su propio informe, sin depender del agente.
  if (session.roles.includes('parent') || session.roles.includes('athlete') || !session.roles.includes('agent')) {
    if (sp.a && !z.string().uuid().safeParse(sp.a).success) notFound();
    return <FamilyOwnReport session={session} athleteParam={sp.a} />;
  }
  if (!z.string().uuid().safeParse(sp.a).success) notFound();
  const month = isMonth(sp.m) ? sp.m : new Date().toISOString().slice(0, 7);
  const data = await loadAthlete360(session.userId, sp.a as string);
  if (!data || !data.access.active) notFound();
  const e = data.ws.current;
  const r = buildMonthlyReport({ month, cases: data.cases, offers: data.offers?.map((o) => ({ title: o.title, orgName: o.orgName, netUsd: o.netUsd, deadline: o.deadline })) ?? null });
  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="mx-auto max-w-3xl px-8 py-10 text-[13px] leading-relaxed">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-neutral-100 p-3 text-sm">
        <span>Informe para la familia. Guárdalo en PDF o imprímelo y envíalo tú. Solo incluye procesos compartidos con el atleta.</span>
        <PrintButton />
      </div>
      <header className="border-b-2 border-neutral-900 pb-3">
        <p className="text-xs uppercase tracking-widest text-neutral-500">The Gala Alliance · Informe mensual · {r.monthLabel}</p>
        <h1 className="mt-1 font-display text-3xl">{e.name}</h1>
        <p className="text-neutral-600">{[e.sportName, e.positionName, e.graduationYear && `Promoción ${e.graduationYear}`].filter(Boolean).join(' · ')}</p>
      </header>

      <section className="mt-5 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-md border border-neutral-200 p-3"><p className="font-display text-2xl">{r.active}</p><p className="text-xs text-neutral-500">procesos abiertos</p></div>
        <div className="rounded-md border border-neutral-200 p-3"><p className="font-display text-2xl">{r.started.length + r.moved.length}</p><p className="text-xs text-neutral-500">con novedades este mes</p></div>
        <div className="rounded-md border border-neutral-200 p-3"><p className="font-display text-2xl">{r.offers.length}</p><p className="text-xs text-neutral-500">ofertas en estudio</p></div>
      </section>

      <H2>Novedades del mes</H2>
      {r.started.length + r.moved.length + r.committed.length === 0 ? <p className="mt-1">Sin cambios de fase este mes.</p> : (
        <ul className="mt-1 list-disc pl-5">
          {r.committed.map((x) => <li key={`c-${x.name}`}><strong>{x.name}</strong>: compromiso o matrícula confirmados.</li>)}
          {r.started.map((x) => <li key={`s-${x.name}`}>Nuevo proceso con <strong>{x.name}</strong> ({x.stage}).</li>)}
          {r.moved.map((x) => <li key={`m-${x.name}`}><strong>{x.name}</strong> avanza a «{x.stage}».</li>)}
        </ul>
      )}

      <H2>Próximos pasos</H2>
      {r.nextSteps.length === 0 ? <p className="mt-1">No hay pasos con fecha pendientes.</p> : (
        <table className="mt-2 w-full border-collapse">
          <thead><tr className="border-b border-neutral-300 text-left text-xs text-neutral-500"><th className="py-1 font-normal">Programa</th><th className="font-normal">Qué toca</th><th className="text-right font-normal">Para</th></tr></thead>
          <tbody>{r.nextSteps.map((s) => (
            <tr key={`${s.name}-${s.action}`} className="border-b border-neutral-100"><td className="py-1.5">{s.name}</td><td>{s.action}</td><td className="text-right tabular-nums">{s.due ?? 'Sin fecha'}</td></tr>
          ))}</tbody>
        </table>
      )}

      {r.offers.length > 0 && (
        <>
          <H2>Ofertas</H2>
          <table className="mt-2 w-full border-collapse">
            <thead><tr className="border-b border-neutral-300 text-left text-xs text-neutral-500"><th className="py-1 font-normal">Oferta</th><th className="text-right font-normal">Coste neto/año</th><th className="text-right font-normal">Responder antes de</th></tr></thead>
            <tbody>{r.offers.map((o) => (
              <tr key={`${o.title}-${o.orgName}`} className="border-b border-neutral-100"><td className="py-1.5">{o.title}<br /><span className="text-xs text-neutral-500">{o.orgName}</span></td><td className="text-right tabular-nums">{o.netUsd == null ? 'Incompleto' : usd(o.netUsd)}</td><td className="text-right tabular-nums">{o.deadline ?? '—'}</td></tr>
            ))}</tbody>
          </table>
        </>
      )}

      <footer className="mt-8 border-t border-neutral-200 pt-3 text-xs text-neutral-500">
        Generado el {today} desde The Gala Alliance. Las cifras de coste son estimaciones con los datos disponibles; la decisión es siempre de la familia y del atleta.
      </footer>
    </main>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-6 text-xs font-semibold uppercase tracking-widest text-neutral-500">{children}</h2>;
}
