import Link from 'next/link';
import { AlertTriangle, ArrowRight, Bookmark, BookmarkCheck, Check, CircleSlash, EyeOff, HelpCircle, X } from 'lucide-react';
import { CONFIDENCE_LABEL, DIMENSION_LABEL, dimensionState, type Dimension, type Factor, type GalaMatch } from '@/lib/domain/gala-match/engine';
import { setHidden, toggleSaved } from '@/app/actions/match';

/** Porcentaje honesto: "datos insuficientes" si no hay base; "no encaja ahora" si hay un bloqueo. */
export function MatchScore({ m, size = 'md' }: { m: GalaMatch; size?: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'lg' ? 'h-28 w-28' : size === 'md' ? 'h-16 w-16' : 'h-12 w-12';
  const text = size === 'lg' ? 'text-4xl' : size === 'md' ? 'text-xl' : 'text-base';
  if (m.score == null) {
    return (
      <div className={`flex ${dim} shrink-0 flex-col items-center justify-center rounded-full border-2 border-dashed border-line-strong text-center`} role="img" aria-label="Datos insuficientes para calcular el encaje">
        <HelpCircle className="h-5 w-5 text-faint" aria-hidden />{size === 'lg' && <span className="mt-1 px-2 text-[10px] leading-tight text-muted">Datos insuficientes</span>}
      </div>
    );
  }
  const pct = m.score;
  return (
    <div className={`relative ${dim} shrink-0`} role="img" aria-label={`${m.blocked ? 'No encaja ahora. ' : ''}Encaje ${pct} %, confianza ${CONFIDENCE_LABEL[m.confidence].toLowerCase()}`}>
      <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="18" cy="18" r="15.9155" fill="none" className="stroke-line" strokeWidth="3" />
        <circle cx="18" cy="18" r="15.9155" fill="none" className={m.blocked ? 'stroke-danger' : 'stroke-brass'} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${pct} 100`} />
      </svg>
      <span className={`absolute inset-0 flex items-center justify-center font-display font-bold tabular-nums text-paper ${text}`} aria-hidden>{pct}<span className="text-[0.55em]">%</span></span>
    </div>
  );
}

export function ConfidenceBadge({ m }: { m: GalaMatch }) {
  const tone = m.confidence === 'high' ? 'border-ok/40 text-ok' : m.confidence === 'medium' ? 'border-warn/40 text-warn' : 'border-line-strong text-muted';
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${tone}`}>Confianza {CONFIDENCE_LABEL[m.confidence].toLowerCase()}</span>;
}

const ICON = { ok: Check, warn: AlertTriangle, no: X, blocked: CircleSlash, unknown: HelpCircle } as const;
const ORDER = ['blocked', 'no', 'ok', 'warn', 'unknown'];
/** Resumen por dimensión: icono + palabra (nunca solo color). Un 0 % o un coste fuera de presupuesto es «no encaja», no «parcial». */
export function DimensionChips({ m, max = 6 }: { m: GalaMatch; max?: number }) {
  const chips = m.dimensions.map((d) => ({ d: d.dimension, state: dimensionState(d) }))
    .sort((a, b) => ORDER.indexOf(a.state) - ORDER.indexOf(b.state)).slice(0, max);
  const tone = { ok: 'text-ok', warn: 'text-warn', no: 'text-danger', blocked: 'text-danger', unknown: 'text-faint' } as const;
  const sr = { ok: 'encaja', warn: 'encaje parcial', no: 'no encaja', blocked: 'bloqueo', unknown: 'datos insuficientes' } as const;
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1">
      {chips.map(({ d, state }) => {
        const I = ICON[state];
        return <li key={d} className="flex items-center gap-1 text-xs text-paper"><I className={`h-3.5 w-3.5 ${tone[state]}`} aria-hidden />{DIMENSION_LABEL[d as Dimension]}<span className="sr-only">: {sr[state]}</span></li>;
      })}
    </ul>
  );
}

export function SaveButton({ kind, id, saved, score, compact = false }: { kind: 'institution' | 'opportunity'; id: string; saved: boolean; score: number | null; compact?: boolean }) {
  return (
    <form action={toggleSaved}>
      <input type="hidden" name="kind" value={kind} /><input type="hidden" name="id" value={id} /><input type="hidden" name="score" value={score ?? ''} />
      <button aria-pressed={saved} className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors ${saved ? 'border-brass bg-brass/10 text-paper' : 'border-line-strong text-paper hover:border-brass'}`}>
        {saved ? <BookmarkCheck className="h-4 w-4 text-brass" aria-hidden /> : <Bookmark className="h-4 w-4" aria-hidden />}{compact ? <span className="sr-only">{saved ? 'Guardada' : 'Guardar'}</span> : saved ? 'Guardada' : 'Guardar'}
      </button>
    </form>
  );
}

export function HideButton({ kind, id, score, hidden = false }: { kind: 'institution' | 'opportunity'; id: string; score: number | null; hidden?: boolean }) {
  return (
    <form action={setHidden}>
      <input type="hidden" name="kind" value={kind} /><input type="hidden" name="id" value={id} /><input type="hidden" name="score" value={score ?? ''} /><input type="hidden" name="hide" value={hidden ? '0' : '1'} />
      <button className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm text-muted hover:text-paper"><EyeOff className="h-4 w-4" aria-hidden />{hidden ? 'Mostrar de nuevo' : 'Ocultar'}</button>
    </form>
  );
}

function FactorRow({ f }: { f: Factor }) {
  const I = f.status === 'met' ? Check : f.status === 'partial' ? AlertTriangle : f.status === 'unmet' ? (f.kind === 'hard' ? CircleSlash : X) : HelpCircle;
  const tone = f.status === 'met' ? 'text-ok' : f.status === 'partial' ? 'text-warn' : f.status === 'unmet' ? 'text-danger' : 'text-faint';
  const word = { met: 'Cumple', partial: 'Parcial', unmet: f.kind === 'hard' ? 'Bloqueo' : 'No encaja', unknown: 'Datos insuficientes' }[f.status];
  const src = { official: 'Dato oficial', organization: 'Publicado por la organización', passport: 'Tu Passport', inferred: 'Inferido de tus preferencias' }[f.source];
  return (
    <li className="flex gap-3 py-3">
      <I className={`mt-0.5 h-4 w-4 shrink-0 ${tone}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 text-sm font-semibold text-paper">{f.label}<span className={`text-xs font-normal ${tone}`}>{word}</span>{f.kind === 'hard' && <span className="rounded border border-line px-1.5 text-[10px] uppercase tracking-wide text-muted">Obligatorio</span>}</p>
        <p className="text-sm text-muted">{f.detail}</p>
        <p className="mt-0.5 text-[11px] text-faint">{src}{f.status === 'unknown' && f.missingSide === 'target' ? ' · falta información de la universidad u organización' : ''}</p>
        {f.fix && <Link href={f.fix.href} className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-brass hover:underline">{f.fix.action}<ArrowRight className="h-3.5 w-3.5" aria-hidden /></Link>}
      </div>
    </li>
  );
}

/** Desglose completo: dimensiones, por qué encaja, qué falta, bloqueos y siguiente paso. */
export function MatchBreakdownV2({ m }: { m: GalaMatch }) {
  return (
    <div className="space-y-5">
      {m.blockers.length > 0 && (
        <section aria-labelledby="blockers-t" className="rounded-2xl border border-danger/40 bg-danger/5 p-5">
          <h3 id="blockers-t" className="flex items-center gap-2 font-semibold text-danger"><CircleSlash className="h-4 w-4" aria-hidden />Posibles bloqueos</h3>
          <ul className="mt-2 space-y-1 text-sm text-paper">{m.blockers.map((b) => <li key={b.id}>· {b.label}: {b.detail}</li>)}</ul>
        </section>
      )}
      <div className="grid gap-5 md:grid-cols-2">
        <section aria-labelledby="why-t" className="rounded-2xl border border-line bg-surface p-5">
          <h3 id="why-t" className="font-semibold text-paper">Por qué encajas</h3>
          {m.why.length ? <ul className="mt-2 space-y-1.5 text-sm">{m.why.map((f) => <li key={f.id} className="flex gap-2 text-paper"><Check className={`mt-0.5 h-4 w-4 shrink-0 ${f.status === 'met' ? 'text-ok' : 'text-warn'}`} aria-hidden />{f.detail}</li>)}</ul> : <p className="mt-2 text-sm text-muted">Aún no hay criterios cumplidos con los datos disponibles.</p>}
        </section>
        <section aria-labelledby="missing-t" className="rounded-2xl border border-line bg-surface p-5">
          <h3 id="missing-t" className="font-semibold text-paper">Lo que falta</h3>
          {m.missing.length || m.evidenceGaps.length ? (
            <ul className="mt-2 space-y-1.5 text-sm">
              {m.missing.map((f) => <li key={f.id} className="flex gap-2 text-paper"><HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-faint" aria-hidden />{f.detail}</li>)}
              {m.evidenceGaps.map((g) => <li key={g.label} className="flex gap-2 text-paper"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden /><Link href={g.href} className="hover:underline">{g.label} en tu Passport</Link></li>)}
            </ul>
          ) : <p className="mt-2 text-sm text-muted">No falta nada para calcular este encaje.</p>}
        </section>
      </div>
      {m.nextStep && (
        <Link href={m.nextStep.href} className="group flex items-center justify-between gap-4 rounded-2xl bg-brass p-5 text-ink">
          <span><span className="block text-xs font-semibold uppercase tracking-wider opacity-80">Siguiente paso</span><span className="block text-lg font-bold">{m.nextStep.action}</span><span className="block text-sm opacity-80">{m.nextStep.reason}</span></span>
          <ArrowRight className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1" aria-hidden />
        </Link>
      )}
      <section aria-labelledby="dims-t">
        <h3 id="dims-t" className="mb-3 font-semibold text-paper">Cómo se ha calculado</h3>
        <div className="space-y-2">
          {m.dimensions.map((d) => (
            <details key={d.dimension} className="group rounded-2xl border border-line bg-surface">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
                <span className="font-semibold text-paper">{DIMENSION_LABEL[d.dimension]}</span>
                <span className="flex items-center gap-3">
                  {d.score == null ? <span className="text-sm text-muted">Datos insuficientes</span> : (
                    <>
                      <span className="hidden h-1.5 w-28 overflow-hidden rounded-full bg-line sm:block" aria-hidden><span className="block h-full rounded-full bg-brass" style={{ width: `${d.score}%` }} /></span>
                      <span className="font-display text-lg tabular-nums text-paper">{d.score}%</span>
                    </>
                  )}
                  <span className="text-xs text-faint group-open:hidden">Ver</span>
                </span>
              </summary>
              <ul className="divide-y divide-line border-t border-line px-5">{d.factors.map((f) => <FactorRow key={f.id} f={f} />)}</ul>
            </details>
          ))}
        </div>
      </section>
      <p className="text-xs text-muted">Gala Match mide la <strong className="text-paper">compatibilidad</strong> entre tu Passport y la información disponible (calculado con el {m.coverage}% de los criterios). No es una probabilidad de admisión, de beca ni de recibir una oferta. Motor {m.version}.</p>
    </div>
  );
}
