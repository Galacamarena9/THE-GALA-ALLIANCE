import type { Locale } from './locale.ts';
import { EN, EN_PATTERNS } from './en.ts';

/**
 * Traductor de interfaz (fase 4b). Las claves son el propio texto en castellano: en castellano devuelve la
 * clave tal cual (cero riesgo de cambiar lo que ya funciona); en inglés busca la frase exacta y, si no está,
 * prueba los patrones con números o nombres. Lo que falte sale en castellano (una prueba vigila que no falte nada).
 */
export type T = (es: string) => string;

export function makeT(locale: Locale): T {
  if (locale === 'es') return (s) => s;
  return (s) => {
    if (s == null) return s;
    const hit = EN[s];
    if (hit != null) return hit;
    for (const [re, fn] of EN_PATTERNS) {
      const m = s.match(re);
      if (m) return fn(m);
    }
    return s;
  };
}

/** Formato de fecha/hora del idioma. */
export const dateLocale = (locale: Locale) => (locale === 'en' ? 'en-US' : 'es-ES');
