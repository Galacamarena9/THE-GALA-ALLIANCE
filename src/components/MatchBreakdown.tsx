import { CircleAlert, CircleCheck, CircleX, Info } from 'lucide-react';
import { CONFIDENCE_LABEL, MATCH_AREA_LABEL, TIER_LABEL, type MatchResult } from '@/lib/domain/match';
import { cx } from '@/components/ui';

/**
 * Gala Match explicado: puntuación global, áreas, confianza y la lista de por qué encaja / qué falta.
 * Nunca presenta una puntuación con confianza baja como firme.
 */
export function MatchBreakdown({ match, editHref = '/app/athlete/passport' }: { match: MatchResult; editHref?: string }) {
  const low = match.confidence === 'low';
  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-brass">Gala Match</p>
          <p className="mt-1 text-lg font-bold text-paper">{TIER_LABEL[match.tier]}</p>
        </div>
        <p className={cx('font-display text-5xl font-bold tabular-nums leading-none', low ? 'text-faint' : 'text-paper')}>
          {low && <span className="sr-only">Estimación provisional: </span>}
          {match.score}<span className="text-xl text-faint">%</span>
        </p>
      </div>

      <p className={cx('mt-3 flex items-start gap-2 rounded-xl px-3 py-2 text-xs', low ? 'bg-warn/10 text-paper' : 'bg-surface-2 text-muted')}>
        <Info className={cx('mt-0.5 h-3.5 w-3.5 shrink-0', low ? 'text-warn' : 'text-faint')} aria-hidden />
        <span>
          <strong className="font-semibold text-paper">{CONFIDENCE_LABEL[match.confidence]}</strong> · calculado con el {match.coverage} % de los datos necesarios.
          {low && ' Completa los datos que faltan para que el encaje sea fiable.'}
        </span>
      </p>

      <ul className="mt-4 space-y-2.5" aria-label="Encaje por áreas">
        {match.areas.map((a) => (
          <li key={a.area}>
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-paper">{MATCH_AREA_LABEL[a.area]}</span>
              <span className="tabular-nums text-muted">
                {a.score == null ? 'Sin datos' : `${a.score} %`}
                {a.score != null && a.evaluated < a.total && <span className="text-faint"> · {a.evaluated} de {a.total} criterios</span>}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
              {a.score != null && <div className={cx('h-full rounded-full', a.score >= 80 ? 'bg-ok' : a.score >= 50 ? 'bg-brass' : 'bg-danger')} style={{ width: `${Math.max(a.score, 3)}%` }} />}
            </div>
          </li>
        ))}
      </ul>

      {match.met.length > 0 && (
        <div className="mt-5">
          <p className="mb-1.5 text-xs font-bold text-paper">Por qué encajas</p>
          <ul className="space-y-1 text-sm">{match.met.map((m) => <li key={m} className="flex items-start gap-2 text-paper"><CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-ok" aria-hidden />{m}</li>)}</ul>
        </div>
      )}
      {match.unmet.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-xs font-bold text-paper">No cumples ahora</p>
          <ul className="space-y-1 text-sm">{match.unmet.map((m) => <li key={m} className="flex items-start gap-2 text-paper"><CircleX className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />{m}</li>)}</ul>
        </div>
      )}
      {match.missing.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-xs font-bold text-paper">Qué falta</p>
          <ul className="space-y-1 text-sm">{match.missing.map((m) => <li key={m} className="flex items-start gap-2 text-muted"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden />{m}</li>)}</ul>
          <a href={editHref} className="mt-2 inline-block text-sm font-semibold text-brass hover:underline">Completar mi Passport →</a>
        </div>
      )}
      <p className="mt-4 text-xs text-faint">Compatibilidad según tus datos y los requisitos publicados, no probabilidad de admisión ni de beca. Motor {match.version}.</p>
    </div>
  );
}
