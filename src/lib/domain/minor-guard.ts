/**
 * Protección de menores (QA atleta/familia, hallazgos 1 y 3). Reglas puras que la UI y las acciones comparten;
 * la base de datos las vuelve a exigir (guard_minor_guardian_change, can_view_athlete).
 */
export interface MinorGuardSession { isMinor: boolean; roles: readonly string[] }

/** Dónde se pide a la familia (invitación y vínculo existentes en Privacidad › Familia). */
export const FAMILY_ASK_HREF = '/app/settings#familia';

/** Un atleta menor no paga ni acepta condiciones de pago: lo hace su madre, padre o tutor. */
export function paysThroughFamily(s: MinorGuardSession): boolean {
  return s.isMinor && s.roles.includes('athlete');
}

/** Solo los planes que compra la familia (pago único de atleta/familia) pasan por el tutor. */
export function familyPaysPlan(s: MinorGuardSession, audience: string): boolean {
  return paysThroughFamily(s) && (audience === 'family' || audience === 'athlete');
}

/**
 * ¿Puede el atleta pausar o desvincular a este familiar por sí solo?
 * Un menor no, si el vínculo está activo (aprobado o en pausa): el tutor puede renunciar y soporte lo revisa.
 */
export function athleteCanRemoveGuardian(args: { athleteIsMinor: boolean; linkStatus: string }): boolean {
  if (!args.athleteIsMinor) return true;
  return !['approved', 'restricted'].includes(args.linkStatus);
}

/** Error de la base de datos cuando un menor intenta quitar a su tutor. */
export const GUARDIAN_CHANGE_ERROR = 'guardian_change_requires_guardian';
export function isGuardianChangeError(message: string | null | undefined): boolean {
  return !!message && message.includes(GUARDIAN_CHANGE_ERROR);
}
