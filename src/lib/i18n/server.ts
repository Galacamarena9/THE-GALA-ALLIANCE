import 'server-only';
import { cookies, headers } from 'next/headers';
import { LOCALE_COOKIE, pickLocale, type Locale } from './locale';

/** Idioma de la petición actual (hace la página dinámica: úsalo solo en páginas que ya lo son). */
export async function getLocale(): Promise<Locale> {
  const [c, h] = await Promise.all([cookies(), headers()]);
  return pickLocale(c.get(LOCALE_COOKIE)?.value, h.get('accept-language'));
}
