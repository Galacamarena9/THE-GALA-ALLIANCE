/**
 * Fase 2 de la auditoría: límites del plan de agencia y prueba de 30 días.
 * La base de datos es quien los hace cumplir (triggers); aquí solo se traducen para la interfaz.
 */

export type AgencyPlanStatus = {
  source: 'subscription' | 'trial' | 'none';
  plan_code: string | null;
  trial_ends_at: string | null;
  athletes_limit: number;
  athletes_used: number;
  seats_limit: number;
  seats_used: number;
};

export const TRIAL_DAYS = 30;

/** Mensaje claro para los errores de límite que lanza la base de datos; null si no es uno de ellos. */
export function planLimitMessage(dbMessage: string | null | undefined): string | null {
  const m = dbMessage ?? '';
  if (m.includes('plan_athlete_limit')) {
    return 'Has llegado al número de atletas de tu plan (propuestas e invitaciones abiertas cuentan). Cambia de plan en Facturación o cancela invitaciones que ya no uses.';
  }
  if (m.includes('plan_seat_limit')) {
    return 'La agencia ha usado todos los puestos de su plan. Quien la dirige puede ampliar el plan en Facturación.';
  }
  return null;
}

/** Días que quedan de prueba (0 si ya acabó o no hay fecha). */
export function trialDaysLeft(trialEndsAt: string | null, now: Date = new Date()): number {
  if (!trialEndsAt) return 0;
  const ms = new Date(trialEndsAt).getTime() - now.getTime();
  return ms > 0 ? Math.ceil(ms / 86_400_000) : 0;
}

/** «12 de 25», «12 · sin límite» o «sin plan». */
export function usageLabel(used: number, limit: number): string {
  if (limit === -1) return `${used} · sin límite`;
  if (limit <= 0) return `${used} · sin plan activo`;
  return `${used} de ${limit}`;
}

/** Proporción usada (0–1) para la barra; 0 si no hay límite numérico. */
export function usageRatio(used: number, limit: number): number {
  if (limit <= 0) return limit === 0 && used > 0 ? 1 : 0;
  return Math.min(1, used / limit);
}

/** Resumen de una línea del estado del plan, con tono para el aviso. */
export function planSummary(s: AgencyPlanStatus, now: Date = new Date()): { text: string; tone: 'ok' | 'warn' | 'danger' } {
  if (s.source === 'subscription') return { text: 'Plan contratado.', tone: 'ok' };
  if (s.source === 'trial') {
    const d = trialDaysLeft(s.trial_ends_at, now);
    return {
      text: `Prueba gratuita: ${d === 1 ? 'queda 1 día' : `quedan ${d} días`}. Durante la prueba tienes el plan Agencia completo.`,
      tone: d <= 7 ? 'warn' : 'ok',
    };
  }
  return {
    text: 'La prueba ha terminado. Conservas todo lo que tienes, pero para añadir atletas o miembros necesitas un plan.',
    tone: 'danger',
  };
}
