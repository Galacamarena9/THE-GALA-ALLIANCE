import 'server-only';
import { getLocale } from './server';
import { makeT } from './t';

/** Traductor de la petición actual (solo en páginas que ya son dinámicas). */
export async function getT() {
  const locale = await getLocale();
  return Object.assign(makeT(locale), { locale });
}
