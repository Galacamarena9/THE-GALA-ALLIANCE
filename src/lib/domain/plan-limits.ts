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

/**
 * Días de prueba que se mandan a Stripe al contratar (QA agente, hallazgo 2): nunca una prueba nueva encima de la
 * de la app. Solo agencias; si la prueba de la app sigue en curso, los días que le quedan; si ya acabó, si la
 * agencia ya tuvo una suscripción (cancelar y volver a contratar no regala otro mes) o si no hay estado, 0.
 */
export function checkoutTrialDays(p: { audience: string; status: AgencyPlanStatus | null; hadSubscription: boolean; now?: Date }): number {
  if (p.audience !== 'agent' || p.hadSubscription || !p.status || p.status.source !== 'trial') return 0;
  return trialDaysLeft(p.status.trial_ends_at, p.now ?? new Date());
}

/** Días que quedan a partir de los cuales el aviso de la prueba pasa a ser urgente. */
export const TRIAL_WARN_DAYS = 5;

export interface PlanBanner {
  tone: 'neutral' | 'warn' | 'danger';
  /** Clave del mensaje (el texto lo pone la interfaz con tx()). */
  kind: 'trial' | 'trial_ending' | 'ended' | 'limit_near' | 'limit_full';
  daysLeft: number;
  used: number;
  /** -1 = sin límite. */
  limit: number;
}

/**
 * Aviso de plan para Hoy y Mis atletas (QA agente, hallazgo 1). Durante la prueba siempre se ve (días y cupo);
 * con ≤ 5 días es urgente; sin plan, en rojo. Con plan contratado solo aparece al acercarse al límite de atletas (≥ 80 %).
 */
export function planBanner(s: AgencyPlanStatus | null | undefined, now: Date = new Date()): PlanBanner | null {
  if (!s) return null;
  const used = s.athletes_used; const limit = s.athletes_limit;
  const full = limit > 0 && used >= limit;
  const near = limit > 0 && used / limit >= 0.8;
  if (s.source === 'none') return { tone: 'danger', kind: 'ended', daysLeft: 0, used, limit };
  if (s.source === 'trial') {
    const d = trialDaysLeft(s.trial_ends_at, now);
    return { tone: d <= TRIAL_WARN_DAYS || full ? 'warn' : 'neutral', kind: d <= TRIAL_WARN_DAYS ? 'trial_ending' : 'trial', daysLeft: d, used, limit };
  }
  if (full) return { tone: 'danger', kind: 'limit_full', daysLeft: 0, used, limit };
  if (near) return { tone: 'warn', kind: 'limit_near', daysLeft: 0, used, limit };
  return null;
}
