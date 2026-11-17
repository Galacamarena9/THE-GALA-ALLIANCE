/**
 * Opportunity Passport v2: catálogos y utilidades puras (sin acceso a datos).
 * Todo lo configurable del Passport vive aquí para no repetir etiquetas por la aplicación.
 */
import type { DataSource, Visibility } from '@/lib/types';

export const VISIBILITY_OPTIONS: { value: Visibility; label: string; hint: string }[] = [
  { value: 'public', label: 'Público', hint: 'Cualquiera con el enlace' },
  { value: 'members', label: 'Solo usuarios de Gala', hint: 'Personas con cuenta' },
  { value: 'verified_orgs', label: 'Solo organizaciones verificadas', hint: 'Universidades, clubes y academias verificados' },
  { value: 'private', label: 'Privado', hint: 'Solo tú y tu familia vinculada' },
];
export const VISIBILITY_LABEL: Record<Visibility, string> = {
  public: 'Público', members: 'Solo usuarios de Gala', verified_orgs: 'Solo organizaciones verificadas', connections: 'Solo mis conexiones', private: 'Privado',
};

/** Bloques configurables y su columna de visibilidad. */
export const PRIVACY_BLOCKS = [
  { key: 'profile_visibility', label: 'Información personal', text: 'Nombre, foto, ciudad, edad y titular' },
  { key: 'sport_visibility', label: 'Datos deportivos', text: 'Trayectoria, equipos y logros' },
  { key: 'stats_visibility', label: 'Estadísticas', text: 'Cifras por temporada y competición' },
  { key: 'academics_visibility', label: 'Información académica', text: 'Notas, exámenes e inglés' },
  { key: 'videos_visibility', label: 'Vídeos', text: 'Highlights, partidos y clips' },
  { key: 'goals_visibility', label: 'Objetivos', text: 'Qué buscas y tus preferencias' },
] as const;
export type PrivacyKey = (typeof PRIVACY_BLOCKS)[number]['key'];

/** Bloques que nunca se publican, sea cual sea la configuración. */
export const FIXED_PRIVATE = [
  { label: 'Datos de contacto', text: 'Tu email y teléfono nunca aparecen en el Passport. El contacto pasa por Gala y, si eres menor, con aprobación familiar.' },
  { label: 'Documentación', text: 'Pasaporte, expedientes y certificados se guardan cifrados y solo los ves tú y tu familia.' },
  { label: 'Presupuesto familiar', text: 'Solo se usa para calcular tu encaje económico. Nadie más lo ve.' },
];

export const PROVENANCE_LABEL: Record<DataSource, { short: string; long: string; who: string }> = {
  self_reported: { short: 'Declarado', long: 'Declarado por el atleta', who: 'Lo ha indicado el propio atleta.' },
  documented: { short: 'Documentado', long: 'Respaldado con documentación', who: 'Gala ha revisado un documento que lo respalda.' },
  club_verified: { short: 'Verificado', long: 'Verificado por una organización', who: 'Lo ha confirmado un club o academia verificados.' },
};

export const VIDEO_KIND_LABEL = {
  highlight: 'Highlight Reel', full_game: 'Partido completo', training: 'Entrenamiento', clip: 'Clip', season: 'Resumen de temporada',
} as const;

export const ACHIEVEMENT_KIND_LABEL = {
  championship: 'Campeonato', national_team: 'Selección', award: 'Premio', recognition: 'Reconocimiento',
  ranking: 'Ranking', captaincy: 'Capitanía', academic: 'Académico', other: 'Hito',
} as const;
export const ACHIEVEMENT_LEVEL_LABEL = { club: 'Club', regional: 'Regional', national: 'Nacional', international: 'Internacional' } as const;

export const EDUCATION_SYSTEM_LABEL = {
  es: 'España (ESO / Bachillerato)', us: 'Estados Unidos (High School)', uk: 'Reino Unido (GCSE / A-Levels)', fr: 'Francia (Baccalauréat)',
  it: 'Italia (Maturità)', de: 'Alemania (Abitur)', pt: 'Portugal (Secundário)', ib: 'Bachillerato Internacional (IB)', latam: 'Latinoamérica', other: 'Otro sistema',
} as const;

export const PATHWAY_GROUPS = [
  { label: 'Estados Unidos', items: [['ncaa_d1', 'NCAA División I'], ['ncaa_d2', 'NCAA División II'], ['ncaa_d3', 'NCAA División III'], ['naia', 'NAIA'], ['njcaa', 'NJCAA / JUCO']] },
  { label: 'Internacional', items: [['intl_university', 'Universidades internacionales'], ['club', 'Clubes'], ['academy', 'Academias'], ['professional', 'Oportunidades profesionales'], ['camp', 'Camps'], ['showcase', 'Showcases']] },
] as const;
export const PATHWAY_LABEL: Record<string, string> = Object.fromEntries(PATHWAY_GROUPS.flatMap((g) => g.items.map(([k, v]) => [k, v])));
export const DIVISION_PATHWAYS = ['ncaa_d1', 'ncaa_d2', 'ncaa_d3', 'naia', 'njcaa'] as const;

export const SCHOOL_SIZE_LABEL = { small: 'Pequeña (< 5.000)', medium: 'Mediana (5.000–15.000)', large: 'Grande (> 15.000)', any: 'Me da igual' } as const;
export const SPORT_LEVEL_LABEL = { top: 'Máximo nivel', competitive: 'Competitivo', development: 'Para crecer y jugar minutos', any: 'Abierto' } as const;
export const SCHOLARSHIP_LABEL = { full: 'Necesito beca completa', partial: 'Me basta una beca parcial', none: 'No necesito beca', unsure: 'Aún no lo sé' } as const;
export const CAMPUS_LABEL = { urban: 'Urbano', suburban: 'Periferia', rural: 'Rural', any: 'Me da igual' } as const;

/** Nombre de usuario para /athlete/<username>: minúsculas, números y guiones. */
export const USERNAME_RE = /^[a-z0-9](?:[a-z0-9-]{1,28})[a-z0-9]$/;
const RESERVED = new Set(['admin', 'app', 'api', 'new', 'edit', 'me', 'settings', 'gala', 'thegalaalliance', 'support', 'help']);
export function validUsername(u: string) {
  return USERNAME_RE.test(u) && !RESERVED.has(u);
}
export function suggestUsername(displayName: string) {
  const base = displayName
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
  return base.length >= 3 ? base : `atleta-${base || 'gala'}`.slice(0, 30);
}

/**
 * Vídeo incrustable: solo YouTube y Vimeo (iframes con privacidad mejorada).
 * El resto de plataformas (Hudl, Drive, etc.) se muestran como enlace externo.
 */
export function videoEmbed(url: string): { provider: 'youtube' | 'vimeo' | 'link'; embedUrl: string | null; host: string } {
  let u: URL;
  try { u = new URL(url); } catch { return { provider: 'link', embedUrl: null, host: '' }; }
  const host = u.hostname.replace(/^www\./, '');
  if (host === 'youtu.be') {
    const id = u.pathname.slice(1).split('/')[0];
    if (/^[\w-]{6,20}$/.test(id)) return { provider: 'youtube', embedUrl: `https://www.youtube-nocookie.com/embed/${id}`, host };
  }
  if (host === 'youtube.com' || host === 'm.youtube.com') {
    const id = u.searchParams.get('v') ?? (u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{6,20})/)?.[1] ?? null);
    if (id && /^[\w-]{6,20}$/.test(id)) return { provider: 'youtube', embedUrl: `https://www.youtube-nocookie.com/embed/${id}`, host };
  }
  if (host === 'vimeo.com') {
    const id = u.pathname.match(/^\/(\d{6,12})/)?.[1];
    if (id) return { provider: 'vimeo', embedUrl: `https://player.vimeo.com/video/${id}?dnt=1`, host };
  }
  return { provider: 'link', embedUrl: null, host };
}

export const ISO_COUNTRIES: [string, string][] = [
  ['ES', 'España'], ['US', 'Estados Unidos'], ['GB', 'Reino Unido'], ['FR', 'Francia'], ['IT', 'Italia'], ['DE', 'Alemania'], ['PT', 'Portugal'],
  ['NL', 'Países Bajos'], ['BE', 'Bélgica'], ['CA', 'Canadá'], ['MX', 'México'], ['AR', 'Argentina'], ['CO', 'Colombia'], ['CL', 'Chile'],
  ['BR', 'Brasil'], ['VE', 'Venezuela'], ['PE', 'Perú'], ['UY', 'Uruguay'], ['AD', 'Andorra'], ['IE', 'Irlanda'], ['SE', 'Suecia'],
  ['NO', 'Noruega'], ['DK', 'Dinamarca'], ['FI', 'Finlandia'], ['PL', 'Polonia'], ['GR', 'Grecia'], ['HR', 'Croacia'], ['RS', 'Serbia'],
  ['AU', 'Australia'], ['NZ', 'Nueva Zelanda'], ['MA', 'Marruecos'], ['SN', 'Senegal'], ['NG', 'Nigeria'], ['JP', 'Japón'], ['CN', 'China'],
];
export const COUNTRY_NAME: Record<string, string> = Object.fromEntries(ISO_COUNTRIES);

/**
 * Previsualización "¿Cómo lo ve otra persona?": replica en puro las reglas de can_view_athlete (la RLS sigue siendo
 * la que manda). Devuelve qué bloques vería cada tipo de visitante.
 */
export type Audience = 'anonymous' | 'member' | 'verified_org';
export const AUDIENCE_LABEL: Record<Audience, string> = { anonymous: 'Cualquiera con el enlace', member: 'Un usuario de Gala', verified_org: 'Un coach verificado' };
export type BlockVisibility = Record<'profile' | 'sport' | 'stats' | 'academics' | 'videos' | 'goals', Visibility>;

export function visibleBlocks(v: BlockVisibility, audience: Audience, isMinor: boolean) {
  const allowed = (level: Visibility) => {
    if (level === 'private' || level === 'connections') return false;
    if (isMinor) return audience === 'verified_org';
    if (level === 'public') return true;
    if (level === 'members') return audience !== 'anonymous';
    return audience === 'verified_org';
  };
  const profile = allowed(v.profile);
  const out = { profile, sport: false, stats: false, academics: false, videos: false, goals: false };
  if (!profile) return out;
  for (const k of ['sport', 'stats', 'academics', 'videos', 'goals'] as const) out[k] = allowed(v[k]);
  // Objetivos: nunca para anónimos (la RLS solo los sirve a usuarios con sesión).
  if (audience === 'anonymous') out.goals = false;
  return out;
}
