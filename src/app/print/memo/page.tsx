import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/session';
import { familyPlan, managedAthletes, PLAN_RANK } from '@/lib/data/family';
import { loadOffers, memoFor } from '@/lib/data/offers';
import { usd } from '@/lib/domain/labels';
import { TRUST_LABEL } from '@/lib/domain/trust';
import { PrintButton } from '@/components/autonomy';

export const metadata: Metadata = { title: 'Memo de decisión' };

export default async function MemoPrintPage({ searchParams }: { searchParams: Promise<{ a?: string; k?: string }> }) {
  const session = await requireSession(['athlete', 'parent']);
  const sp = await searchParams;
  const athletes = await managedAthletes(session);
  const athlete = athletes.find((a) => a.id === sp.a) ?? athletes[0];
  if (!athlete) redirect('/app');
  if (PLAN_RANK[await familyPlan([session.userId, athlete.id])] < PLAN_RANK.family_elite) redirect('/precios');
  const keys = (sp.k ?? '').split(',').filter(Boolean);
  const all = await loadOffers(athlete.id);
  const offers = (keys.length ? all.filter((o) => keys.includes(o.key)) : all).slice(0, 5);
  const memo = memoFor(offers);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="mx-auto max-w-3xl px-8 py-10 text-[13px] leading-relaxed">
      <div className="no-print mb-6 flex items-center justify-between gap-3 rounded-lg bg-neutral-100 p-3 text-sm">
        <span>Memo para decidir en familia. Guárdalo en PDF o imprímelo.</span>
        <PrintButton />
      </div>
      <header className="border-b-2 border-neutral-900 pb-3">
        <p className="text-xs uppercase tracking-widest text-neutral-500">The Gala Alliance · Memo de decisión · {today}</p>
        <h1 className="mt-1 font-display text-3xl">{athlete.name}</h1>
      </header>
      <section className="mt-5">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Conclusión con los datos actuales</h2>
        <p className="mt-1 text-lg">{memo.recommended ? `La opción más sólida hoy es ${memo.recommended}.` : 'Ninguna oferta está libre de riesgos graves: resuélvelos antes de comprometerte.'}</p>
        {memo.decideBy && <p>Primer plazo para responder: {memo.decideBy}.</p>}
      </section>
      <section className="mt-5">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Comparación</h2>
        <table className="mt-2 w-full border-collapse">
          <thead><tr className="border-b border-neutral-300 text-left text-[11px] text-neutral-500"><th className="py-1 font-normal">Oferta</th><th className="text-right font-normal">Coste/año</th><th className="text-right font-normal">Ayuda/año</th><th className="text-right font-normal">Neto/año</th><th className="text-right font-normal">Confianza</th></tr></thead>
          <tbody>
            {offers.map((o) => (
              <tr key={o.key} className="border-b border-neutral-100 align-top">
                <td className="py-1.5">{o.title}<br /><span className="text-[11px] text-neutral-500">{o.source === 'platform' ? o.orgName : 'Recibida fuera de la plataforma'}</span></td>
                <td className="text-right tabular-nums">{usd(o.costUsd)}</td>
                <td className="text-right tabular-nums">{usd(o.aidUsd)}</td>
                <td className="text-right tabular-nums font-medium">{o.netUsd == null ? 'Incompleto' : usd(o.netUsd)}</td>
                <td className="text-right">{o.trust ? `${o.trust}/5 ${TRUST_LABEL[o.trust]}` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="mt-5">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Riesgos por oferta</h2>
        {offers.map((o) => (
          <div key={o.key} className="mt-2">
            <p className="font-medium">{o.title}</p>
            {o.flags.length ? <ul className="ml-4 list-disc">{o.flags.map((f) => <li key={f.code}>{f.severity === 'high' ? 'Grave: ' : ''}{f.text}</li>)}</ul> : <p className="text-neutral-600">Sin señales de alarma detectadas.</p>}
          </div>
        ))}
      </section>
      {memo.questions.length > 0 && (
        <section className="mt-5">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Preguntas que hacer antes de firmar</h2>
          <ol className="ml-4 mt-1 list-decimal">{memo.questions.map((q) => <li key={q}>{q}</li>)}</ol>
        </section>
      )}
      <footer className="mt-8 border-t border-neutral-300 pt-3 text-[11px] text-neutral-500">
        Generado automáticamente con los datos introducidos y los publicados por las organizaciones. Es una ayuda para decidir, no asesoramiento financiero ni jurídico.
        Ninguna ayuda es firme hasta que figura en la oferta escrita y firmada.
      </footer>
    </main>
  );
}
