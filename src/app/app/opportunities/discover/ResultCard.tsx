'use client';

import Link from 'next/link';
import { useActionState, useRef } from 'react';
import { BadgeCheck, CalendarClock, CircleHelp, Check, Minus, X } from 'lucide-react';
import { shortlistOpportunity, type DiscoveryActionState } from '@/app/actions/discovery';
import { REQUIREMENT_LABEL, type DiscoveryCard, type RequirementResult } from '@/lib/domain/opportunity-discovery';

const FIT_TONE: Record<DiscoveryCard['fit'], string> = {
  strong: 'border-ok/40 bg-ok/10 text-ok',
  good: 'border-brass/40 bg-brass/10 text-brass',
  partial: 'border-line-strong bg-surface-2 text-paper',
  insufficient: 'border-line-strong bg-surface-2 text-muted',
  not_eligible: 'border-danger/50 bg-danger/10 text-danger',
};
const RESULT_TONE: Record<RequirementResult, string> = { PASS: 'text-ok', FAIL: 'text-danger', UNKNOWN: 'text-warn' };
const ResultIcon = ({ r }: { r: RequirementResult }) => (r === 'PASS' ? <Check className="h-4 w-4" aria-hidden /> : r === 'FAIL' ? <X className="h-4 w-4" aria-hidden /> : <CircleHelp className="h-4 w-4" aria-hidden />);
const dateEs = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** Tarjeta de resultado: un único CTA principal («Revisar») y uno secundario (shortlist). */
export function ResultCard({ c, athleteId, demo }: { c: DiscoveryCard; athleteId: string; demo?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = `opp-${c.id}`;
  return (
    <article aria-labelledby={titleId} data-testid="discovery-card" data-fit={c.fit}
      className={`flex h-full flex-col rounded-[var(--radius-card)] border p-5 sm:p-6 ${c.eligible ? 'border-line bg-surface' : 'border-danger/30 bg-surface/60'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${FIT_TONE[c.fit]}`} data-testid="fit-badge">{c.fitLabel}</span>
        {c.eligible && c.score != null && <span className="text-xs text-muted">{c.score}% · confianza {c.confidenceLabel.toLowerCase()}</span>}
        {c.eligible && c.score == null && <span className="text-xs text-muted">Confianza {c.confidenceLabel.toLowerCase()}</span>}
        {c.isNew && <span className="rounded-full bg-brass px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-ink">Nueva</span>}
        {c.shortlisted && <span className="text-xs text-ok">En tu shortlist</span>}
      </div>

      <p className="mt-4 flex items-center gap-1.5 text-sm text-muted">
        {c.organization}{c.organizationVerified && <BadgeCheck className="h-4 w-4 text-brass" aria-label="Organización verificada" />}
      </p>
      <h3 id={titleId} className="mt-1 text-lg font-semibold leading-snug text-paper">{c.title}</h3>
      <p className="mt-1 text-xs text-faint">{[c.typeLabel, c.division, c.destination, c.aid].filter(Boolean).join(' · ')}</p>

      {!c.eligible ? (
        <p className="mt-4 rounded-xl border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger" data-testid="ineligible-reason">
          No elegible: {c.why.requirements.find((r) => r.result === 'FAIL')?.explanation}
        </p>
      ) : c.reasons.length ? (
        <ul className="mt-4 space-y-1.5 text-sm text-paper" aria-label="Por qué encaja">
          {c.reasons.map((r) => <li key={r} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-ok" aria-hidden />{r}</li>)}
        </ul>
      ) : null}

      {c.keyUnknown && (
        <p className="mt-3 flex gap-2 text-sm text-warn" data-testid="key-unknown">
          <CircleHelp className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /><span><span className="font-semibold">Falta saber:</span> {c.keyUnknown.explanation}</span>
        </p>
      )}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
        <p className={`flex items-center gap-1.5 text-xs ${c.deadlineSoon ? 'text-warn' : 'text-muted'}`}>
          <CalendarClock className="h-4 w-4" aria-hidden />{c.deadline ? `Plazo: ${dateEs(c.deadline)}` : 'Sin plazo publicado'}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <ShortlistButton c={c} athleteId={athleteId} demo={demo} variant="secondary" />
          <button type="button" onClick={() => dialog.current?.showModal()} data-testid="review"
            className="inline-flex min-h-11 items-center rounded-xl bg-brass px-5 text-sm font-semibold text-ink hover:bg-brass-soft">
            Revisar
          </button>
        </div>
      </div>

      <WhyDrawer ref={dialog} c={c} athleteId={athleteId} demo={demo} />
    </article>
  );
}

function ShortlistButton({ c, athleteId, demo, variant }: { c: DiscoveryCard; athleteId: string; demo?: boolean; variant: 'secondary' | 'primary' }) {
  const [state, action, pending] = useActionState<DiscoveryActionState, FormData>(shortlistOpportunity, undefined);
  if (!c.eligible) return <span className="text-xs text-faint" data-testid="shortlist-blocked">No se puede añadir</span>;
  if (c.shortlisted || state?.ok) return <span className="inline-flex min-h-11 items-center gap-1 text-sm text-ok"><Check className="h-4 w-4" aria-hidden />En la shortlist</span>;
  return (
    <form action={action} className="flex flex-col items-end">
      <input type="hidden" name="athlete" value={athleteId} />
      <input type="hidden" name="opportunity" value={c.id} />
      <button disabled={pending || demo} data-testid="shortlist"
        className={variant === 'primary'
          ? 'inline-flex min-h-11 items-center rounded-xl bg-brass px-5 text-sm font-semibold text-ink hover:bg-brass-soft disabled:opacity-60'
          : 'inline-flex min-h-11 items-center rounded-xl border border-line-strong px-4 text-sm text-paper hover:border-brass disabled:opacity-60'}>
        {pending ? 'Añadiendo…' : 'Añadir a la shortlist'}
      </button>
      {state?.error && <p role="alert" className="mt-1 max-w-56 text-right text-xs text-danger">{state.error}</p>}
    </form>
  );
}

/** «Por qué encaja»: requisitos obligatorios (CUMPLE / NO CUMPLE / DESCONOCIDO), compatibilidad y confianza. */
function WhyDrawer({ ref, c, athleteId, demo }: { ref: React.Ref<HTMLDialogElement>; c: DiscoveryCard; athleteId: string; demo?: boolean }) {
  const close = (e: React.MouseEvent<HTMLElement>) => (e.currentTarget.closest('dialog') as HTMLDialogElement | null)?.close();
  return (
    <dialog ref={ref} aria-labelledby={`why-${c.id}`} data-testid="why-drawer"
      className="m-0 ml-auto h-dvh max-h-dvh w-full max-w-xl overflow-y-auto border-l border-line bg-ink p-0 text-paper backdrop:bg-night/70 backdrop:backdrop-blur-sm">
      <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-ink/95 px-6 py-5 backdrop-blur">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-brass">Por qué encaja</p>
          <h2 id={`why-${c.id}`} className="mt-1 text-3xl">{c.title}</h2>
          <p className="mt-1 text-sm text-muted">{c.organization}</p>
        </div>
        <button type="button" onClick={close} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line text-muted hover:text-paper" aria-label="Cerrar">
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <div className="space-y-8 px-6 py-6">
        <section aria-labelledby={`req-${c.id}`}>
          <h3 id={`req-${c.id}`} className="text-xl">Requisitos obligatorios</h3>
          <p className="mt-1 text-xs text-muted">Si alguno no se cumple, no es elegible, aunque el resto encaje.</p>
          {c.why.requirements.length ? (
            <ul className="mt-3 divide-y divide-line rounded-xl border border-line" data-testid="requirements">
              {c.why.requirements.map((r) => (
                <li key={r.id} className="flex items-start gap-3 px-4 py-3" data-result={r.result}>
                  <span className={`mt-0.5 inline-flex shrink-0 items-center gap-1 text-xs font-bold uppercase ${RESULT_TONE[r.result]}`}><ResultIcon r={r.result} />{REQUIREMENT_LABEL[r.result]}</span>
                  <span className="text-sm"><span className="font-semibold">{r.label}.</span> {r.explanation} <span className="text-faint">· {r.source}</span></span>
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 text-sm text-muted">Esta oportunidad no publica requisitos obligatorios.</p>}
        </section>

        <section aria-labelledby={`fit-${c.id}`}>
          <h3 id={`fit-${c.id}`} className="text-xl">Compatibilidad</h3>
          <div className="mt-3 space-y-4">
            {c.why.compatibility.map((d) => (
              <div key={d.dimension}>
                <p className="flex justify-between text-sm font-semibold"><span>{d.dimension}</span><span className="text-muted">{d.score == null ? 'Sin datos' : `${d.score}%`}</span></p>
                <ul className="mt-1.5 space-y-1 text-sm">
                  {d.items.map((i) => (
                    <li key={i.id} className="flex gap-2 text-muted">
                      {i.status === 'met' ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-ok" aria-label="Encaja" /> : i.status === 'unknown' ? <CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-label="Desconocido" /> : i.status === 'partial' ? <Minus className="mt-0.5 h-4 w-4 shrink-0 text-brass" aria-label="Encaja en parte" /> : <X className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-label="No encaja" />}
                      <span>{i.explanation}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {!c.why.compatibility.length && <p className="text-sm text-muted">Sin preferencias que comparar.</p>}
          </div>
        </section>

        <section aria-labelledby={`ev-${c.id}`}>
          <h3 id={`ev-${c.id}`} className="text-xl">Confianza de la evidencia</h3>
          <p className="mt-2 text-sm text-muted">
            Confianza {c.why.evidence.confidenceLabel.toLowerCase()}: conocemos el {c.why.evidence.coverage}% de lo que pesa en el encaje.
            {c.why.evidence.gaps.length ? ` Un coach mirará también: ${c.why.evidence.gaps.join(', ').toLowerCase()}.` : ''}
          </p>
          <p className="mt-2 text-xs text-faint">Lo desconocido se queda desconocido: nunca lo contamos como cumplido. El encaje no es una probabilidad de admisión, de beca ni de fichaje.</p>
        </section>

        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-6">
          <ShortlistButton c={c} athleteId={athleteId} demo={demo} variant="primary" />
          <Link href={`/app/opportunities/${c.id}`} className="inline-flex min-h-11 items-center rounded-xl px-4 text-sm text-muted underline-offset-4 hover:text-paper hover:underline">Ver la oportunidad completa</Link>
        </div>
      </div>
    </dialog>
  );
}
