'use client';

import { useEffect, useMemo, useState } from 'react';
import { BadgeCheck, CircleAlert, CircleCheck, CircleX, Pause, Play } from 'lucide-react';
import { CONFIDENCE_LABEL, MATCH_AREA_LABEL, TIER_LABEL, matchAthleteToOpportunity, type MatchResult } from '@/lib/domain/match';

/**
 * Gala Match "vivo" en la home. Los casos son FICTICIOS, pero cada resultado lo calcula el motor real
 * (src/lib/domain/match.ts): lo que se ve aquí es exactamente cómo explica el producto un encaje.
 * Rota cada 6 s, se puede pausar y no rota con prefers-reduced-motion.
 */
type Case = { org: string; kind: string; result: MatchResult };

function useCases(): Case[] {
  return useMemo(() => {
    const opp = { sport_id: 'basketball', position_ids: [1, 2], graduation_years: [2027], division: 'ncaa_d2' as const, min_gpa_4: 2.5, english_required: 'TOEFL 79', annual_cost_usd: 42000, aid_amount_usd: 30000 };
    return [
      {
        org: 'Universidad de ejemplo', kind: 'Beca parcial · NCAA D-II',
        result: matchAthleteToOpportunity(
          { sport_id: 'basketball', primary_position_id: 1, secondary_position_id: null, graduation_year: 2027, target_divisions: ['ncaa_d2'], annual_budget_usd: 15000 },
          { gpa: 8.4, gpa_scale: 10, english_test: 'toefl', english_score: '88' }, opp),
      },
      {
        org: 'College de ejemplo', kind: 'Plaza en el equipo · NCAA D-II',
        result: matchAthleteToOpportunity(
          { sport_id: 'basketball', primary_position_id: 1, secondary_position_id: null, graduation_year: 2027, target_divisions: ['ncaa_d2'], annual_budget_usd: 6000 },
          { gpa: 7.1, gpa_scale: 10, english_test: null, english_score: null }, opp),
      },
      {
        org: 'Universidad de ejemplo', kind: 'Beca parcial · NCAA D-II',
        result: matchAthleteToOpportunity(
          { sport_id: 'basketball', primary_position_id: null, secondary_position_id: null, graduation_year: 2027, target_divisions: [], annual_budget_usd: null },
          null, opp),
      },
    ];
  }, []);
}

export function LiveMatch() {
  const cases = useCases();
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    // Sin rotación automática si el sistema pide reducir el movimiento (se puede avanzar con los puntos).
    if (!playing || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setI((v) => (v + 1) % cases.length), 6000);
    return () => clearInterval(t);
  }, [playing, cases.length]);

  const { org, kind, result: m } = cases[i];
  const low = m.confidence === 'low';

  return (
    <div className="rounded-3xl border border-line bg-surface p-6 text-paper shadow-[var(--shadow-premium)]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-brass">Gala Match · ejemplo</p>
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          className="flex h-8 w-8 items-center justify-center rounded-full text-faint transition-colors hover:bg-surface-2 hover:text-paper"
          aria-label={playing ? 'Pausar los ejemplos' : 'Reanudar los ejemplos'}
        >
          {playing ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
        </button>
      </div>

      <div key={i} className="animate-fade-in-up" aria-live="polite">
        <div className="mt-2 flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold">{org}</p>
            <p className="flex items-center gap-1 text-xs text-muted"><BadgeCheck className="h-3.5 w-3.5 text-ok" aria-hidden />{kind}</p>
          </div>
          <div className="text-right">
            <p className={`font-display text-4xl font-bold leading-none tabular-nums ${low ? 'text-faint' : ''}`}>{m.score}<span className="text-lg text-faint">%</span></p>
            <p className="text-xs text-muted">{TIER_LABEL[m.tier]}</p>
          </div>
        </div>

        <ul className="mt-4 space-y-2" aria-label="Encaje por áreas">
          {m.areas.map((a) => (
            <li key={a.area}>
              <div className="mb-1 flex justify-between text-xs">
                <span>{MATCH_AREA_LABEL[a.area]}</span>
                <span className="tabular-nums text-muted">{a.score == null ? 'Sin datos' : `${a.score} %`}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
                {a.score != null && <div className={`h-full rounded-full transition-[width] duration-700 ${a.score >= 80 ? 'bg-ok' : a.score >= 50 ? 'bg-brass' : 'bg-danger'}`} style={{ width: `${Math.max(a.score, 3)}%` }} />}
              </div>
            </li>
          ))}
        </ul>

        <ul className="mt-4 space-y-1.5 text-xs">
          {m.met.slice(0, 2).map((t) => <li key={t} className="flex items-start gap-2"><CircleCheck className="mt-px h-3.5 w-3.5 shrink-0 text-ok" aria-hidden />{t}</li>)}
          {m.unmet.slice(0, 1).map((t) => <li key={t} className="flex items-start gap-2"><CircleX className="mt-px h-3.5 w-3.5 shrink-0 text-danger" aria-hidden />{t}</li>)}
          {m.missing.slice(0, 2).map((t) => <li key={t} className="flex items-start gap-2 text-muted"><CircleAlert className="mt-px h-3.5 w-3.5 shrink-0 text-warn" aria-hidden />{t}</li>)}
        </ul>

        <p className={`mt-4 rounded-xl px-3 py-2 text-xs ${low ? 'bg-warn/10' : 'bg-surface-2 text-muted'}`}>
          <strong className="font-semibold text-paper">{CONFIDENCE_LABEL[m.confidence]}</strong> · con el {m.coverage} % de los datos
          {low && '. Con tan pocos datos, la cifra no es fiable.'}
        </p>
      </div>

      <div className="mt-3 flex justify-center gap-1" role="group" aria-label="Elegir ejemplo">
        {cases.map((_, k) => (
          <button key={k} type="button" onClick={() => { setI(k); setPlaying(false); }} aria-label={`Ejemplo ${k + 1}`} aria-pressed={k === i} className="flex h-6 min-w-6 items-center justify-center">
            <span className={`h-1.5 rounded-full transition-all duration-300 ${k === i ? 'w-6 bg-brass' : 'w-1.5 bg-line-strong'}`} />
          </button>
        ))}
      </div>
      <p className="mt-3 text-[11px] leading-snug text-faint">Casos ficticios calculados con el motor real. Compatibilidad, no probabilidad de beca.</p>
    </div>
  );
}
