/**
 * Registro de fuentes oficiales (comprobado el 22-11-2026).
 * - Las 50 federaciones de FIBA Europa con su página oficial en FIBA (about.fiba.basketball/en/regions/europe/national-federations).
 *   La web propia solo figura cuando se ha comprobado en esa página; el resto se añade cuando Operaciones la verifique.
 * - Fuentes globales: FIBA, NCAA, ESPN, EuroLeague. Ninguna ofrece una API pública con licencia para terceros:
 *   la plataforma ENLAZA y VERIFICA; no copia sus datos (sus condiciones lo prohíben). Ver docs/OFFICIAL-SOURCES.md.
 */

export interface Federation { country: string; iso2: string; name: string | null; fibaPage: string; website: string | null }

const F = (iso2: string, country: string, path: string, name: string | null = null, website: string | null = null): Federation =>
  ({ iso2, country, name, website, fibaPage: `https://about.fiba.basketball/en/regions/europe/national-federations/${path}` });

export const FIBA_EUROPE_FEDERATIONS: Federation[] = [
  F('AL', 'Albania', '9-albania'), F('AD', 'Andorra', '273-andorra'), F('AM', 'Armenia', '645-armenia'), F('AT', 'Austria', '17-austria'),
  F('AZ', 'Azerbaiyán', '875-azerbaijan'), F('BY', 'Bielorrusia', '631-belarus'), F('BE', 'Bélgica', '22-belgium'),
  F('BA', 'Bosnia y Herzegovina', '876-bosnia-and-herzegovina'), F('BG', 'Bulgaria', '30-bulgaria'), F('HR', 'Croacia', '622-croatia'),
  F('CY', 'Chipre', '46-cyprus'), F('CZ', 'Chequia', '886-czechia'), F('DK', 'Dinamarca', '48-denmark'), F('EE', 'Estonia', '609-estonia'),
  F('FI', 'Finlandia', '58-finland'), F('FR', 'Francia', '59-france', 'Fédération Française de Basketball', 'https://www.ffbb.com'),
  F('GE', 'Georgia', '632-georgia'), F('DE', 'Alemania', '64-germany'), F('GI', 'Gibraltar', '66-gibraltar'), F('GB', 'Gran Bretaña', '976-great-britain'),
  F('GR', 'Grecia', '67-greece'), F('HU', 'Hungría', '75-hungary'), F('IS', 'Islandia', '76-iceland'), F('IE', 'Irlanda', '81-ireland'),
  F('IL', 'Israel', '82-israel'), F('IT', 'Italia', '83-italy'), F('XK', 'Kosovo', '9795-kosovo'), F('LV', 'Letonia', '610-latvia'),
  F('LT', 'Lituania', '611-lithuania'), F('LU', 'Luxemburgo', '96-luxembourg'), F('MT', 'Malta', '101-malta'), F('MD', 'Moldavia', '882-moldova'),
  F('MC', 'Mónaco', '222-monaco'), F('ME', 'Montenegro', '8310-montenegro'), F('NL', 'Países Bajos', '110-netherlands'),
  F('MK', 'Macedonia del Norte', '878-north-macedonia'), F('NO', 'Noruega', '117-norway'), F('PL', 'Polonia', '123-poland'),
  F('PT', 'Portugal', '124-portugal'), F('RO', 'Rumanía', '127-romania'), F('RU', 'Rusia', '156-russia'), F('SM', 'San Marino', '130-san-marino'),
  F('RS', 'Serbia', '8323-serbia'), F('SK', 'Eslovaquia', '885-slovakia'), F('SI', 'Eslovenia', '618-slovenia'),
  F('ES', 'España', '138-spain', 'Federación Española de Baloncesto', 'https://www.feb.es'),
  F('SE', 'Suecia', '143-sweden'), F('CH', 'Suiza', '144-switzerland'), F('TR', 'Turquía', '152-turkiye'), F('UA', 'Ucrania', '628-ukraine'),
];

export type GlobalSourceId = 'fiba' | 'ncaa' | 'espn' | 'euroleague';

export interface GlobalSource {
  id: GlobalSourceId; name: string; hosts: string[];
  /** Ruta de una ficha de jugador en esa fuente (si se reconoce). */
  profilePath: RegExp | null;
  /** Dominio para buscar el nombre desde la app (búsqueda web limitada a esa fuente; no se copia nada). */
  searchSite: string;
  access: string;
}

export const GLOBAL_SOURCES: GlobalSource[] = [
  { id: 'fiba', name: 'FIBA', hosts: ['fiba.basketball', 'about.fiba.basketball'], profilePath: /^\/(?:[a-z]{2}\/)?players?\/\d+/, searchSite: 'fiba.basketball/en/players',
    access: 'Fichas públicas de selecciones (fiba.basketball/en/players/<id>). Sus condiciones prohíben duplicar o redistribuir contenido; los datos se licencian vía Genius Sports.' },
  { id: 'ncaa', name: 'NCAA', hosts: ['ncaa.com', 'ncaa.org', 'stats.ncaa.org', 'web3.ncaa.org'], profilePath: /^\/(?:player|players|people)\b/, searchSite: 'stats.ncaa.org',
    access: 'Estadísticas oficiales en stats.ncaa.org. Sus condiciones prohíben reproducir contenido sin permiso escrito de la NCAA.' },
  { id: 'espn', name: 'ESPN', hosts: ['espn.com', 'espn.go.com'], profilePath: /\/player\//, searchSite: 'espn.com',
    access: 'Sin API pública desde 2014. Solo enlace a la ficha.' },
  { id: 'euroleague', name: 'EuroLeague', hosts: ['euroleaguebasketball.net'], profilePath: /\/players?\//, searchSite: 'euroleaguebasketball.net',
    access: 'Web oficial de la Euroliga y la EuroCup. Uso de datos solo con permiso de Euroleague Basketball.' },
];
