/**
 * Fase 4 de la auditoría (U2): segundo idioma (inglés) sin cambiar URLs.
 * Prioridad: preferencia guardada (cookie tga_lang, la pone el selector) > idioma del navegador > castellano.
 * Esta pieza es pura (sin Next) para poder usarla en servidor, cliente y pruebas.
 */
export const LOCALES = ['es', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'es';
export const LOCALE_COOKIE = 'tga_lang';
/** Un año: es una preferencia que pide la propia persona (cookie esencial/funcional de idioma). */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLocale(v: unknown): v is Locale {
  return typeof v === 'string' && (LOCALES as readonly string[]).includes(v);
}

/**
 * Elige idioma a partir de la cookie y de Accept-Language («en-US,en;q=0.9,es;q=0.8»).
 * Gana el primer idioma soportado por orden de preferencia (q); si no hay ninguno, castellano.
 */
export function pickLocale(cookieValue: string | null | undefined, acceptLanguage: string | null | undefined): Locale {
  if (isLocale(cookieValue)) return cookieValue;
  const ranked = (acceptLanguage ?? '')
    .split(',')
    .map((part, i) => {
      const [tag, ...params] = part.trim().toLowerCase().split(';');
      const q = Number(params.find((p) => p.trim().startsWith('q='))?.split('=')[1] ?? 1);
      return { lang: tag.split('-')[0], q: Number.isFinite(q) ? q : 0, i };
    })
    .filter((x) => x.lang && x.q > 0)
    .sort((a, b) => b.q - a.q || a.i - b.i);
  return ranked.map((x) => x.lang).find(isLocale) ?? DEFAULT_LOCALE;
}

/** Elige el texto del idioma; si falta la traducción, castellano (nunca una clave vacía). */
export function pick<T>(dict: { es: T; en: T }, locale: Locale): T {
  return dict[locale] ?? dict.es;
}
