/**
 * Arquitectura de marca (fuente única). Cualquier texto de posicionamiento sale de aquí:
 * metadatos, home, pie, datos estructurados y vistas previas al compartir.
 *
 * The Gala Alliance ya no se presenta solo como "becas en EE. UU.": es una red global de
 * oportunidades deportivas. College Recruiting (becas en EE. UU.) es una vertical esencial, no la única.
 * El nombre de la red y el claim se mantienen en inglés porque son activos de marca internacionales.
 */
export const BRAND = {
  name: 'The Gala Alliance',
  network: 'The Global Sports Opportunity Network',
  claim: 'One profile. Every opportunity.',
  /** Mensaje secundario (castellano, idioma principal de la interfaz). */
  secondary: 'La red deportiva que conecta a atletas con universidades, clubes, coaches, agentes y marcas verificados.',
  heroTitle: ['Tu talento merece', 'ser descubierto.'] as const,
  heroText: 'Crea tu Sports Passport y conecta con universidades, clubes y oportunidades de todo el mundo.',
  /** Mensaje de confianza: tres promesas verificables en el producto. */
  trust: ['Gratis para atletas', 'Organizaciones verificadas', 'Nadie paga por salir primero'] as const,
  metaTitle: 'The Gala Alliance · The Global Sports Opportunity Network',
  metaDescription:
    'Un perfil deportivo verificable que conecta a cada atleta con universidades, clubes, coaches, agentes y marcas. Becas en EE. UU., pruebas en clubes, patrocinios y eventos, con encaje explicado y coste real.',
} as const;

export type VerticalStatus = 'live' | 'pilot';

/** Verticales de oportunidad. Solo se listan las que existen en la plataforma (tipos reales de la base de datos). */
export const VERTICALS: {
  key: 'college' | 'clubs' | 'brands' | 'events';
  name: string;
  tag: string;
  status: VerticalStatus;
  text: string;
  items: string[];
  href: string;
}[] = [
  {
    key: 'college',
    name: 'College Recruiting',
    tag: 'Becas en EE. UU.',
    status: 'live',
    text: 'Becas deportivas y plazas en universidades NCAA, NAIA y JUCO, con coste neto y datos oficiales.',
    items: ['Becas deportivas', 'Plazas en el equipo', 'Admisión y requisitos'],
    href: '/para/atletas',
  },
  {
    key: 'clubs',
    name: 'Clubes y academias',
    tag: 'Internacional',
    status: 'pilot',
    text: 'Pruebas, captación y programas de academia publicados por clubes verificados.',
    items: ['Pruebas (trials)', 'Captación de clubes', 'Academias'],
    href: '/para/coaches',
  },
  {
    key: 'brands',
    name: 'Marcas',
    tag: 'Solo mayores de edad',
    status: 'live',
    text: 'Patrocinios y campañas con marcas verificadas, con aviso NIL para atletas universitarios.',
    items: ['Patrocinio', 'Embajadores', 'Creación de contenido'],
    href: '/para/marcas',
  },
  {
    key: 'events',
    name: 'Eventos',
    tag: 'Showcase Day',
    status: 'live',
    text: 'Camps y showcases, y una jornada mensual en directo ante universidades y clubes verificados.',
    items: ['Showcase Day', 'Camps', 'Showcases'],
    href: '/signup?role=athlete',
  },
];

export const VERTICAL_STATUS_LABEL: Record<VerticalStatus, string> = { live: 'Disponible', pilot: 'Piloto' };
