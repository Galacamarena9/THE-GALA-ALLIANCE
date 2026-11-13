import type { AthleteProfile, Division } from '@/lib/types';

/**
 * Encaje atleta ↔ universidad (antes de que exista una beca concreta).
 * Explicable: deporte ofrecido, división objetivo y coste oficial frente a presupuesto.
 */
export function institutionFit(
  athlete: Pick<AthleteProfile, 'sport_id' | 'target_divisions'>,
  budgetUsd: number | null,
  inst: { sports_offered: string[]; division: Division | null; cost_attendance_usd: number | null },
) {
  const reasons: { ok: boolean | null; label: string }[] = [];
  reasons.push({
    ok: inst.sports_offered.length ? Boolean(athlete.sport_id && inst.sports_offered.includes(athlete.sport_id)) : null,
    label: inst.sports_offered.length ? 'Tiene tu deporte' : 'Deportes sin confirmar',
  });
  reasons.push({
    ok: inst.division && athlete.target_divisions.length ? athlete.target_divisions.includes(inst.division) : null,
    label: 'División en tus objetivos',
  });
  reasons.push({
    ok: inst.cost_attendance_usd != null && budgetUsd != null ? inst.cost_attendance_usd <= budgetUsd : null,
    label: 'Coste oficial sin beca dentro de tu presupuesto',
  });
  const known = reasons.filter((r) => r.ok !== null);
  const okCount = known.filter((r) => r.ok).length;
  const sportFails = reasons[0].ok === false;
  const level: 'alto' | 'medio' | 'bajo' | 'sin datos' = sportFails
    ? 'bajo'
    : known.length === 0
      ? 'sin datos'
      : okCount === known.length
        ? 'alto'
        : okCount >= 1
          ? 'medio'
          : 'bajo';
  return { level, reasons };
}
