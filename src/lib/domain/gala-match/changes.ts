/**
 * CAMBIOS DE ENCAJE · por qué ha cambiado un match desde que el atleta lo guardó.
 *
 * Al guardar se congela una foto mínima del resultado del motor (porcentaje, confianza y estado de cada factor).
 * Después se compara con el cálculo actual y se explica la diferencia factor a factor.
 * No se inventan motivos: si el porcentaje cambia pero ningún factor lo explica, se dice que cambió el método.
 */
import type { FactorStatus, GalaMatch, MatchConfidence, MissingSide } from './engine.ts';
import { CONFIDENCE_LABEL } from './engine.ts';

/** Foto guardada en `saved_items.match_snapshot` (claves cortas para que ocupe poco). */
export interface MatchSnapshot {
  /** Versión del motor. */
  v: string;
  /** Porcentaje (null = datos insuficientes). */
  s: number | null;
  /** Confianza. */
  c: MatchConfidence;
  /** Factor → [estado, etiqueta, quién debía aportar el dato si faltaba]. */
  f: Record<string, [FactorStatus, string, MissingSide | null]>;
}

export function snapshotOf(m: GalaMatch): MatchSnapshot {
  const f: MatchSnapshot['f'] = {};
  for (const d of m.dimensions) for (const x of d.factors) f[x.id] = [x.status, x.label.slice(0, 80), x.missingSide ?? null];
  return { v: m.version, s: m.score, c: m.confidence, f };
}

/** Valida lo que viene de base de datos: una foto corrupta no debe romper el panel. */
export function parseSnapshot(raw: unknown): MatchSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<MatchSnapshot>;
  if (typeof r.v !== 'string' || !r.f || typeof r.f !== 'object' || !['high', 'medium', 'low'].includes(r.c as string)) return null;
  if (r.s !== null && typeof r.s !== 'number') return null;
  return r as MatchSnapshot;
}

export type ChangeReason = { factor: string; direction: 'up' | 'down'; text: string };
export interface MatchChange {
  from: number | null;
  to: number | null;
  confidenceFrom: MatchConfidence;
  confidenceTo: MatchConfidence;
  reasons: ChangeReason[];
  /** El motor cambió de versión y ningún factor explica la diferencia. */
  methodChanged: boolean;
}

const RANK: Record<FactorStatus, number> = { unmet: 0, partial: 1, met: 2, unknown: -1 };

function reasonFor(id: string, before: MatchSnapshot['f'][string] | undefined, now: { status: FactorStatus; label: string; missingSide?: MissingSide }): ChangeReason | null {
  const prev = before?.[0] ?? 'unknown';
  if (prev === now.status) return null;
  const label = now.label;
  if (prev === 'unknown') {
    const byAthlete = (before?.[2] ?? null) === 'athlete';
    const good = now.status !== 'unmet';
    return {
      factor: id, direction: good ? 'up' : 'down',
      text: byAthlete ? `Completaste «${label}» en tu Passport.` : `Se publicó información nueva sobre «${label}».`,
    };
  }
  if (now.status === 'unknown') {
    return { factor: id, direction: 'down', text: `Ya no tenemos el dato de «${label}» (se eliminó o dejó de estar visible).` };
  }
  const up = RANK[now.status] > RANK[prev];
  return { factor: id, direction: up ? 'up' : 'down', text: up ? `Ahora cumples mejor «${label}».` : `«${label}» encaja peor que antes.` };
}

/**
 * Explica la diferencia entre la foto guardada y el resultado actual.
 * Devuelve null si no hay cambio visible (mismo porcentaje y misma confianza).
 */
export function explainChange(prev: MatchSnapshot, cur: GalaMatch): MatchChange | null {
  if (prev.s === cur.score && prev.c === cur.confidence) return null;
  const reasons: ChangeReason[] = [];
  for (const d of cur.dimensions) for (const x of d.factors) {
    const r = reasonFor(x.id, prev.f[x.id], x);
    if (r) reasons.push(r);
  }
  // Primero lo que el atleta hizo y mejora el encaje: es lo que le enseña el valor de completar el Passport.
  reasons.sort((a, b) => (a.direction === b.direction ? 0 : a.direction === 'up' ? -1 : 1));
  return {
    from: prev.s, to: cur.score, confidenceFrom: prev.c, confidenceTo: cur.confidence,
    reasons: reasons.slice(0, 3),
    methodChanged: reasons.length === 0 && prev.v !== cur.version,
  };
}

export function describeConfidence(c: MatchChange) {
  return c.confidenceFrom === c.confidenceTo ? null : `Confianza: ${CONFIDENCE_LABEL[c.confidenceFrom]} → ${CONFIDENCE_LABEL[c.confidenceTo]}`;
}
