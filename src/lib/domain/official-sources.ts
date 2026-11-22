/**
 * Fuentes oficiales: reconoce de dónde es un enlace (FIBA, NCAA, ESPN, EuroLeague, federación nacional) y
 * construye búsquedas del nombre del atleta en esas fuentes. No llama a ninguna web ni copia datos: enlaza.
 * «Fuente oficial» = el enlace es de un sitio oficial. «Verificado» = Operaciones ha comprobado que la ficha es de ese atleta.
 */
import { FIBA_EUROPE_FEDERATIONS, GLOBAL_SOURCES, type Federation, type GlobalSourceId } from '../../content/official-sources.ts';

export type OfficialKind = 'player_profile' | 'stats' | 'federation' | 'other_official';
export interface OfficialLink { source: GlobalSourceId | 'federation'; sourceName: string; kind: OfficialKind; country: string | null; label: string }

const hostOf = (url: string): string | null => {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return u.hostname.toLowerCase().replace(/^www\./, '');
  } catch { return null; }
};
const matchesHost = (host: string, base: string) => host === base || host.endsWith(`.${base}`);

const FED_BY_HOST = FIBA_EUROPE_FEDERATIONS.filter((f) => f.website).map((f) => ({ f, host: hostOf(f.website!)! }));

export function federationFor(iso2: string | null | undefined): Federation | null {
  if (!iso2) return null;
  return FIBA_EUROPE_FEDERATIONS.find((f) => f.iso2 === iso2.toUpperCase()) ?? null;
}

/** ¿De qué fuente oficial es este enlace? `null` si no es de ninguna reconocida (un dominio parecido NO cuenta). */
export function classifyOfficialLink(url: string): OfficialLink | null {
  const host = hostOf(url);
  if (!host) return null;
  const path = (() => { try { return new URL(url).pathname; } catch { return '/'; } })();
  for (const s of GLOBAL_SOURCES) {
    if (!s.hosts.some((h) => matchesHost(host, h))) continue;
    const isProfile = s.profilePath ? s.profilePath.test(path) : false;
    const kind: OfficialKind = isProfile ? 'player_profile' : s.id === 'ncaa' && host === 'stats.ncaa.org' ? 'stats' : 'other_official';
    return { source: s.id, sourceName: s.name, kind, country: null, label: isProfile ? `Ficha en ${s.name}` : `Página de ${s.name}` };
  }
  const fed = FED_BY_HOST.find(({ host: h }) => matchesHost(host, h));
  if (fed) return { source: 'federation', sourceName: fed.f.name ?? `Federación de ${fed.f.country}`, kind: 'federation', country: fed.f.iso2, label: `Federación (${fed.f.country})` };
  return null;
}

export interface OfficialSearch { id: string; label: string; href: string; note: string }

/**
 * Enlaces para buscar a un atleta por su nombre en cada fuente oficial (búsqueda web limitada a ese sitio).
 * La federación del país del atleta, si la conocemos, va primero.
 */
export function officialSearchLinks(p: { name: string; country?: string | null }): OfficialSearch[] {
  const name = p.name.trim().replace(/\s+/g, ' ');
  if (name.length < 2) return [];
  const q = (site: string) => `https://www.google.com/search?q=${encodeURIComponent(`site:${site} "${name}"`)}`;
  const out: OfficialSearch[] = [];
  const fed = federationFor(p.country);
  if (fed) {
    const site = fed.website ? hostOf(fed.website) : null;
    out.push(site
      ? { id: 'federation', label: `Federación (${fed.country})`, href: q(site), note: fed.name ?? 'Federación nacional' }
      : { id: 'federation', label: `Federación (${fed.country})`, href: fed.fibaPage, note: 'Página oficial de la federación en FIBA' });
  }
  for (const s of GLOBAL_SOURCES) out.push({ id: s.id, label: s.name, href: q(s.searchSite), note: s.id === 'ncaa' ? 'Estadísticas universitarias' : s.id === 'fiba' ? 'Selecciones y competiciones FIBA' : s.id === 'espn' ? 'Ficha de medios' : 'Euroliga y EuroCup' });
  return out;
}
