import type { AppRole } from '@/lib/types';
import { ACTORS } from './roles';

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  /** Una frase que explica para qué sirve (buscador, inicio y ayudas). */
  desc?: string;
  /** Secundario: aparece tras "Ver más" para que la barra no abrume. */
  more?: boolean;
}
export interface NavSection {
  title: string;
  items: NavItem[];
  /** Plegada por defecto (se abre sola si contiene la página actual). */
  collapsed?: boolean;
}
export type IconName =
  | 'home' | 'showcase' | 'trophy' | 'campus' | 'book' | 'calc' | 'spark' | 'path' | 'id' | 'inbox'
  | 'megaphone' | 'handshake' | 'family' | 'pipeline' | 'list' | 'building' | 'shield' | 'users' | 'chat' | 'news'
  | 'grad' | 'bell' | 'tag' | 'chart' | 'compare' | 'doc' | 'scale' | 'user' | 'compass';

/** Red y visibilidad: el lado "LinkedIn deportivo" (perfiles, conversaciones, actualidad). */
export const NETWORK_SERVICES: NavItem[] = [
  { href: '/app/discover', label: 'Escaparate de atletas', icon: 'showcase', desc: 'Perfiles comparables: filtra por deporte, posición, año, división o nota.' },
  { href: '/app/inbox', label: 'Mensajes', icon: 'chat', desc: 'Conversaciones seguras; con menores, la familia aprueba y ve el hilo.' },
  { href: '/app/news', label: 'Actualidad', icon: 'news', desc: 'Novedades de atletas, comunicados oficiales y cambios de normativa.' },
  { href: '/app/notifications', label: 'Notificaciones', icon: 'bell', desc: 'Respuestas, cambios de estado y avisos de tu cuenta.' },
];

/** Oportunidades: becas, universidades y comparadores. */
export const OPPORTUNITY_SERVICES: NavItem[] = [
  { href: '/app/opportunities', label: 'Becas y oportunidades', icon: 'trophy', desc: 'Ofertas de organizaciones verificadas con sello de confianza y coste neto.' },
  { href: '/app/universities', label: 'Universidades', icon: 'campus', desc: 'Directorio con datos oficiales del U.S. Department of Education.' },
  { href: '/app/universities/compare', label: 'Comparar universidades', icon: 'compare', desc: 'Hasta 5 universidades lado a lado: coste, SAT, admisión y encaje.' },
];

/** Herramientas: resolver dudas y calcular. */
export const TOOL_SERVICES: NavItem[] = [
  { href: '/app/ia', label: 'Gala IA', icon: 'spark', desc: 'Pregunta lo que quieras sobre el proceso, a cualquier hora.' },
  { href: '/app/calculator', label: 'Calculadora de coste', icon: 'calc', desc: 'Coste real a 4 años con viajes, seguro y subidas.' },
  { href: '/app/guia', label: 'Centro de información', icon: 'book', desc: 'Divisiones, requisitos, documentos y visado con fuentes oficiales.' },
];

/** Compatibilidad: servicios comunes a todos los usuarios. */
export const COMMON_SERVICES: NavItem[] = [...NETWORK_SERVICES, ...OPPORTUNITY_SERVICES, ...TOOL_SERVICES];

/** Servicios personales por tipo de usuario. */
export const PERSONAL_SERVICES: Record<AppRole, NavItem[]> = {
  athlete: [
    { href: '/app/athlete', label: 'Mi camino', icon: 'path', desc: 'Tu siguiente paso y los plazos según tu año.' },
    { href: '/app/athlete/passport', label: 'Mi Passport', icon: 'id', desc: 'Tu perfil deportivo y académico: lo que ven las universidades.' },
    { href: '/app/applications', label: 'Mis candidaturas', icon: 'inbox', desc: 'Estado de cada beca a la que te has apuntado.' },
    { href: '/app/plan', label: 'Mi plan', icon: 'tag', desc: 'Informe del perfil, Sports CV, shortlist y calendario.' },
    { href: '/app/documents', label: 'Documentos', icon: 'doc', desc: 'Checklist y archivos privados del proceso.' },
    { href: '/app/offers', label: 'Comparar ofertas', icon: 'scale', desc: 'Coste neto, riesgos y memo de decisión.', more: true },
    { href: '/app/academia', label: 'Academia SAT/TOEFL', icon: 'grad', desc: 'Práctica con preguntas tipo examen y fechas oficiales.', more: true },
    { href: '/app/campaigns', label: 'Marcas y patrocinios', icon: 'megaphone', desc: 'Colaboraciones con marcas (solo mayores de edad).', more: true },
    { href: '/app/agents', label: 'Agentes', icon: 'handshake', desc: 'Agentes que quieren representarte y los que aceptaste.', more: true },
  ],
  parent: [
    { href: '/app/family', label: 'Panel familiar', icon: 'family', desc: 'El proceso de tu hijo o hija y lo que necesita tu aprobación.' },
    { href: '/app/plan', label: 'Plan familiar', icon: 'tag', desc: 'Informe, shortlist y calendario generados al momento.' },
    { href: '/app/documents', label: 'Documentos', icon: 'doc', desc: 'Checklist y archivos privados del proceso.' },
    { href: '/app/offers', label: 'Comparar ofertas', icon: 'scale', desc: 'Coste neto, riesgos y memo de decisión.' },
    { href: '/app/academia', label: 'Academia SAT/TOEFL', icon: 'grad', desc: 'Práctica con preguntas tipo examen y fechas oficiales.', more: true },
  ],
  university: [
    { href: '/app/opportunities?view=mine', label: 'Nuestras becas', icon: 'trophy', desc: 'Gestiona vuestras becas publicadas.' },
    { href: '/app/opportunities/new', label: 'Publicar una beca', icon: 'megaphone', desc: 'Sale al momento si pasa los controles automáticos.' },
    { href: '/app/applications', label: 'Pipeline de recruiting', icon: 'pipeline', desc: 'Candidatos por estado, con historial y notas.' },
    { href: '/app/lists', label: 'Shortlists', icon: 'list', desc: 'Atletas guardados y búsquedas con alertas.' },
    { href: '/app/organization', label: 'Perfil y equipo', icon: 'building', desc: 'Datos de la universidad, verificación y miembros.' },
  ],
  coach: [
    { href: '/app/lists', label: 'Mis shortlists', icon: 'list', desc: 'Atletas guardados y búsquedas con alertas.' },
    { href: '/app/applications', label: 'Pipeline', icon: 'pipeline', desc: 'Candidatos por estado, con historial y notas.' },
    { href: '/app/organization', label: 'Mi universidad o club', icon: 'building', desc: 'Datos de la organización, verificación y equipo.' },
    { href: '/app/club', label: 'Portal de academia o club', icon: 'users', desc: 'Roster, validación de estadísticas y colocaciones.' },
  ],
  agent: [
    { href: '/app/portfolio', label: 'Mi cartera', icon: 'handshake', desc: 'Atletas que representas (con su aceptación).' },
    { href: '/app/lists', label: 'Prospectos', icon: 'list', desc: 'Atletas guardados y búsquedas con alertas.' },
    { href: '/app/organization', label: 'Agencia', icon: 'building', desc: 'Datos de la agencia, verificación y equipo.' },
  ],
  brand: [
    { href: '/app/campaigns?view=mine', label: 'Mis campañas', icon: 'megaphone', desc: 'Campañas con atletas mayores de edad y sus candidaturas.' },
    { href: '/app/lists', label: 'Atletas guardados', icon: 'list', desc: 'Atletas que te interesan.' },
    { href: '/app/organization', label: 'Marca', icon: 'building', desc: 'Datos de la marca, verificación y equipo.' },
  ],
  admin: [
    { href: '/app/admin/panel', label: 'Panel de mando', icon: 'chart', desc: 'Métricas, embudo, automatizaciones y ventas.' },
    { href: '/app/admin', label: 'Revisión y verificación', icon: 'shield', desc: 'Colas de verificación y denuncias.' },
  ],
};

export const ACCOUNT_SERVICES: NavItem[] = [
  { href: '/precios', label: 'Planes y servicios', icon: 'tag', desc: 'Gratis para atletas; Core, Elite y Signature para familias.' },
  { href: '/app/settings', label: 'Privacidad y datos', icon: 'shield', desc: 'Visibilidad, descarga de datos y baja de la cuenta.' },
];

export const LEARN_SERVICES: NavItem[] = [
  { href: '/app/ia', label: 'Gala IA', icon: 'spark', desc: 'Pregunta lo que quieras sobre el proceso, a cualquier hora.' },
  { href: '/app/calculator', label: 'Calculadora de coste', icon: 'calc', desc: 'Coste real a 4 años con viajes, seguro y subidas.' },
  { href: '/app/guia', label: 'Centro de información', icon: 'book', desc: 'Divisiones, requisitos, documentos y visado con fuentes oficiales.' },
  { href: '/app/portal/atletas', label: 'Portales por perfil', icon: 'compass', desc: 'Qué ofrece la plataforma a cada tipo de usuario.', more: true },
];

/**
 * Barra lateral por actor: lo esencial a la vista y lo secundario tras "Ver más".
 * Grupos: Mi espacio (por rol) · Descubrir · Red · Aprender y decidir · Cuenta (plegada).
 */
export function sidebarFor(roles: AppRole[]): NavSection[] {
  const sections: NavSection[] = [{ title: 'Inicio', items: [{ href: '/app', label: 'Inicio', icon: 'home', desc: 'Tu resumen y los siguientes pasos.' }] }];
  const order: AppRole[] = ['athlete', 'parent', 'university', 'coach', 'agent', 'brand', 'admin'];
  for (const role of order) {
    if (!roles.includes(role)) continue;
    const label = role === 'admin' ? 'Administración' : `Mi espacio · ${ACTORS.find((a) => a.role === role)?.label}`;
    sections.push({ title: label, items: PERSONAL_SERVICES[role] });
  }
  sections.push({ title: 'Descubrir', items: [...NETWORK_SERVICES.filter((i) => i.href === '/app/discover'), ...OPPORTUNITY_SERVICES] });
  sections.push({ title: 'Red', items: NETWORK_SERVICES.filter((i) => i.href !== '/app/discover') });
  sections.push({ title: 'Aprender y decidir', items: LEARN_SERVICES });
  sections.push({ title: 'Cuenta', items: ACCOUNT_SERVICES, collapsed: true });
  // Sin duplicados entre secciones (p. ej. atleta + familia): se queda la primera aparición.
  const seen = new Set<string>();
  return sections.map((s) => ({ ...s, items: s.items.filter((i) => (seen.has(i.href) ? false : (seen.add(i.href), true))) })).filter((s) => s.items.length);
}
