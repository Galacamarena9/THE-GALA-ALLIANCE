/** Crecimiento y tendencia semanal para el panel de mando. */
export const growthPct = (current: number, previous: number) => (previous > 0 ? Math.round(((current - previous) / previous) * 100) : null);

/** Agrupa fechas en semanas que empiezan en lunes (UTC); el último cubo es la semana actual. */
export function weeklyBuckets(dates: string[], now = new Date(), weeks = 8) {
  const day = (now.getUTCDay() + 6) % 7;
  const thisMonday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day);
  const WEEK = 7 * 86_400_000;
  const buckets = Array.from({ length: weeks }, (_, i) => ({ start: new Date(thisMonday - (weeks - 1 - i) * WEEK).toISOString().slice(0, 10), count: 0 }));
  for (const d of dates) {
    const t = Date.parse(d);
    const i = t >= thisMonday ? weeks - 1 : weeks - 1 - Math.ceil((thisMonday - t) / WEEK);
    if (i >= 0 && i < weeks) buckets[i].count++;
  }
  return buckets;
}

export const isoDaysAgo = (days: number, now = new Date()) => new Date(now.getTime() - days * 86_400_000).toISOString();
