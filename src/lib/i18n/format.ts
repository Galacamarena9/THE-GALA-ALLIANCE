import type { Locale } from './locale.ts';

/**
 * Formatos únicos (fase 7, U3). Antes cada pantalla escribía la altura y el dinero a su manera
 * («198 cm», «1.98 m», «18.000 $/año»). Ahora:
 *   - Altura: castellano «1,98 m»; inglés «6′6″ (198 cm)», como lo lee un coach de EE. UU.
 *   - Dólares: castellano «18.000 US$»; inglés «$18,000». Con `perYear`, «/año» o «/yr».
 */
export function feetInches(cm: number): string {
  const inches = Math.round(cm / 2.54);
  return `${Math.floor(inches / 12)}′${inches % 12}″`;
}

export function formatHeight(cm: number | null | undefined, locale: Locale = 'es'): string | null {
  if (cm == null || !Number.isFinite(cm) || cm <= 0) return null;
  if (locale === 'en') return `${feetInches(cm)} (${Math.round(cm)} cm)`;
  return `${(cm / 100).toFixed(2).replace('.', ',')} m`;
}

export function formatUsd(n: number | null | undefined, locale: Locale = 'es', opts: { perYear?: boolean } = {}): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  const s = new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'es-ES', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0, currencyDisplay: locale === 'en' ? 'symbol' : 'code',
  }).format(Math.round(n));
  // es-ES con código da «18.000 USD»; usamos «US$», la forma habitual en castellano.
  const base = locale === 'en' ? s : s.replace('USD', 'US$').replace(/ /g, ' ');
  return opts.perYear ? `${base}${locale === 'en' ? '/yr' : '/año'}` : base;
}

/** Números grandes con el separador del idioma (1.200 / 1,200). */
export function formatInt(n: number | null | undefined, locale: Locale = 'es'): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'es-ES', { maximumFractionDigits: 0, useGrouping: true }).format(n);
}
