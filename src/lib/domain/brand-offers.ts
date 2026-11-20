/**
 * Prompt 13 · Ofertas de marca: cómo se explica una compensación sin engañar.
 * Producto no es dinero, un bonus condicionado no es un ingreso seguro y «no especificado» se dice tal cual.
 */
export type ComponentKind = 'cash' | 'product' | 'travel' | 'equipment' | 'performance_bonus' | 'other';
export interface OfferComponent { kind: ComponentKind; amount: number | null; currency: string; guaranteed: boolean; description: string }

export const COMPONENT_LABEL: Record<ComponentKind, string> = {
  cash: 'Dinero', product: 'Producto', travel: 'Viaje', equipment: 'Material', performance_bonus: 'Bonus por resultados', other: 'Otro',
};
export const DELIVERABLE_LABEL: Record<string, string> = {
  reel: 'Reel', story: 'Story', post: 'Publicación', video: 'Vídeo', appearance: 'Aparición', event: 'Evento', photo_shoot: 'Sesión de fotos', other: 'Otro',
};
export const DELIVERABLE_STATUS_LABEL: Record<string, string> = {
  not_started: 'Sin empezar', in_progress: 'En curso', submitted: 'Enviado, en revisión', changes_requested: 'Cambios pedidos',
  approved: 'Aprobado', completed: 'Completado', cancelled: 'Cancelado',
};
export const PAYMENT_LABEL: Record<string, string> = {
  not_applicable: 'Sin pago en dinero', pending: 'Pendiente de pago', paid_declared: 'La marca dice que ha pagado', confirmed: 'Pago confirmado', disputed: 'Pago en disputa',
};

export function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency, maximumFractionDigits: amount % 1 ? 2 : 0 }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export interface CompensationSummary {
  /** Frase corta para la tarjeta, sin inflar: «Solo producto (valor 350 €) · 0 € en dinero». */
  headline: string;
  /** Una línea por componente, con «garantizado» o «condicionado». */
  lines: string[];
  /** Dinero garantizado por moneda (los bonus condicionados no cuentan). */
  guaranteedCash: { currency: string; amount: number }[];
  productOnly: boolean;
  unknown: boolean;
}

export function describeCompensation(components: OfferComponent[], unknown = false): CompensationSummary {
  const cash = new Map<string, number>();
  for (const c of components) if (c.kind === 'cash' && c.guaranteed && c.amount) cash.set(c.currency, (cash.get(c.currency) ?? 0) + c.amount);
  const guaranteedCash = [...cash].map(([currency, amount]) => ({ currency, amount }));
  const lines = components.map((c) => {
    const value = c.amount != null ? ` · ${c.kind === 'cash' || c.kind === 'performance_bonus' ? '' : 'valor '}${money(c.amount, c.currency)}` : '';
    return `${COMPONENT_LABEL[c.kind]}${value} · ${c.guaranteed ? 'garantizado' : 'condicionado'} — ${c.description}`;
  });
  const nonCash = components.filter((c) => c.kind !== 'cash');
  const productOnly = components.length > 0 && !components.some((c) => c.kind === 'cash' || c.kind === 'performance_bonus');
  if (!components.length) {
    return { headline: unknown ? 'Compensación no especificada: pregunta antes de aceptar' : 'Sin compensación', lines, guaranteedCash, productOnly: false, unknown };
  }
  const productValue = nonCash.filter((c) => c.amount != null && c.kind !== 'performance_bonus');
  const valueText = productValue.length === 1 ? ` (valor ${money(productValue[0].amount as number, productValue[0].currency)})` : '';
  let headline: string;
  if (productOnly) headline = `Solo producto${valueText} · 0 en dinero`;
  else if (guaranteedCash.length) headline = `${guaranteedCash.map((g) => money(g.amount, g.currency)).join(' + ')} garantizado${nonCash.length ? ' + extras' : ''}`;
  else headline = 'Sin dinero garantizado: solo condicionado';
  return { headline, lines, guaranteedCash, productOnly, unknown };
}

export function usageSummary(o: { usage_months: number; usage_channels: string[]; usage_territory: string; organic_use: boolean; paid_media: boolean }): string {
  if (!o.usage_months) return 'Sin derechos de uso posteriores';
  const where = o.usage_channels.length ? o.usage_channels.join(', ') : 'canales no indicados';
  const kind = [o.organic_use ? 'orgánico' : null, o.paid_media ? 'publicidad pagada' : null].filter(Boolean).join(' y ') || 'uso no indicado';
  return `${o.usage_months} meses · ${where} · ${o.usage_territory === 'WORLD' ? 'todo el mundo' : o.usage_territory} · ${kind}`;
}

export function exclusivitySummary(o: { exclusivity_category: string | null; exclusivity_days: number }): string {
  return o.exclusivity_days > 0 && o.exclusivity_category
    ? `No puedes trabajar con otras marcas de «${o.exclusivity_category}» durante ${o.exclusivity_days} días`
    : 'Sin exclusividad';
}
