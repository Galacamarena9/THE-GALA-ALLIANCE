/**
 * Clave canónica del nombre de una organización. Espejo exacto de public.org_name_key (migración 11E):
 * minúsculas, sin acentos, sin artículos ni formas jurídicas (club, S.A., S.L., SAD), sin signos ni espacios.
 * «Valencia Basket», «VALENCIA BASKET», «Valencia Basket Club» y «ValenciaBasket» → «valenciabasket».
 */
const FROM = 'áàäâãåéèëêíìïîóòöôõúùüûñçß';
const TO = 'aaaaaaeeeeiiiiooooouuuuncs';
// Solo artículos y formas jurídicas. CF/CB/FC/Academy NO: distinguen entidades reales.
const GENERIC = /\b(club|sad|sa|sl|the|el|la|de|del)\b/g;

export function orgNameKey(name: string): string | null {
  const lowered = [...name.trim().toLowerCase()].map((c) => { const i = FROM.indexOf(c); return i >= 0 ? TO[i] : c; }).join('');
  // Los puntos de las siglas se quitan antes («C.F.» = «CF»).
  const key = lowered.replace(/\./g, '').replace(GENERIC, '').replace(/[^a-z0-9]/g, '');
  return key || null;
}
