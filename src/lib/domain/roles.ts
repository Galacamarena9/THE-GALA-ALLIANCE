import type { AppRole } from '@/lib/types';

export type ActorRole = Exclude<AppRole, 'admin'>;

/** Los 6 tipos de usuario. "admin" es interno y no aparece en el registro. */
export const ACTORS: {
  role: ActorRole;
  slug: string;
  intent: string;
  label: string;
  plural: string;
  promise: string;
  home: string;
  adultsOnly: boolean;
  services: string[];
}[] = [
  {
    role: 'athlete',
    slug: 'atletas',
    intent: 'Soy deportista y busco una beca en EE. UU.',
    label: 'Atleta',
    plural: 'Atletas',
    promise: 'Un solo Passport ante universidades, clubes y marcas verificados, juegues en la liga que juegues.',
    home: '/app/athlete',
    adultsOnly: false,
    services: ['Passport: tu perfil en el escaparate', 'Encaje explicado con cada beca', 'Roadmap y plazos según tu año', 'Candidaturas con seguimiento', 'Ofertas de marcas (18+)', 'Sports CV en PDF'],
  },
  {
    role: 'parent',
    slug: 'familias',
    intent: 'Acompaño a un/a deportista (familia o tutor legal)',
    label: 'Familia',
    plural: 'Familias',
    promise: 'El proceso, los plazos y el coste real de cada opción, en un solo lugar.',
    home: '/app/family',
    adultsOnly: true,
    services: ['Panel del proceso de tu hijo/a', 'Calculadora de coste neto y comparador', 'Plazos y documentos por etapa', 'Control de privacidad y permisos'],
  },
  {
    role: 'university',
    slug: 'universidades',
    intent: 'Gestiono el recruiting de una universidad o college',
    label: 'Universidad',
    plural: 'Universidades',
    promise: 'Publica becas, recibe candidatos compatibles y gestiona tus candidatos internacionales.',
    home: '/app/opportunities?view=mine',
    adultsOnly: true,
    services: ['Perfil verificado en el directorio', 'Publicación de becas y plazas', 'Talento compatible por beca', 'Pipeline de recruiting con notas privadas', 'Equipo de coaches'],
  },
  {
    role: 'coach',
    slug: 'coaches',
    intent: 'Soy coach o scout y busco talento',
    label: 'Coach',
    plural: 'Coaches',
    promise: 'Encuentra talento con datos comparables, sin depender de quién tiene mejor agente.',
    home: '/app/recruit/discover',
    adultsOnly: true,
    services: ['Búsqueda avanzada por deporte, posición, año, nota…', 'Shortlists privadas con notas', 'Pipeline de tu universidad o club', 'Gala IA: búsqueda en lenguaje natural'],
  },
  {
    role: 'agent',
    slug: 'agentes',
    intent: 'Soy agente o agencia',
    label: 'Agente',
    plural: 'Agentes',
    promise: 'Lleva cada atleta con cada universidad en un solo sitio, en equipo y con su permiso.',
    home: '/app/portfolio',
    adultsOnly: true,
    services: ['Cartera de representados (con su consentimiento)', 'Procesos por universidad: fase, responsable, tareas e historial', 'Contactos de programas privados de tu agencia, importables desde Excel', 'Perfil de agencia verificada'],
  },
  {
    role: 'brand',
    slug: 'marcas',
    intent: 'Represento a una marca',
    label: 'Marca',
    plural: 'Marcas',
    promise: 'Publica ofertas y ficha atletas mayores de edad para promocionar tu marca.',
    home: '/app/campaigns?view=mine',
    adultsOnly: true,
    services: ['Ofertas de embajador, contenido, eventos…', 'Candidatos a cada oferta', 'Búsqueda de atletas 18+', 'Perfil de marca verificada'],
  },
];

export function actorBySlug(slug: string) {
  return ACTORS.find((a) => a.slug === slug);
}

export function roleHome(role: AppRole | null | undefined) {
  if (role === 'admin') return '/app/admin';
  return ACTORS.find((a) => a.role === role)?.home ?? '/onboarding';
}

export function roleLabel(role: AppRole) {
  return role === 'admin' ? 'Admin' : (ACTORS.find((a) => a.role === role)?.label ?? role);
}

/** Roles que buscan y guardan talento. */
/** Fase 4 (U2): textos del alta en inglés (mismo orden y sentido que ACTORS). */
export const ACTOR_EN: Record<ActorRole, { intent: string; promise: string }> = {
  athlete: { intent: "I'm an athlete looking for a US scholarship", promise: 'One Passport for verified universities, clubs and brands, whatever league you play in.' },
  parent: { intent: "I'm supporting an athlete (family or legal guardian)", promise: 'The process, the deadlines and the real cost of each option, in one place.' },
  university: { intent: 'I run recruiting for a university or college', promise: 'Post scholarships, receive matching candidates and manage your international recruits.' },
  coach: { intent: "I'm a coach or scout looking for talent", promise: 'Find talent with comparable data, without depending on who has the best agent.' },
  agent: { intent: "I'm an agent or an agency", promise: 'Track every athlete with every university in one place, as a team and with their permission.' },
  brand: { intent: 'I represent a brand', promise: 'Post offers and sign adult athletes to promote your brand.' },
};

export const TALENT_ROLES: AppRole[] = ['university', 'coach', 'agent', 'brand'];
/** Roles que publican o gestionan becas. */
export const RECRUITING_ROLES: AppRole[] = ['university', 'coach'];
