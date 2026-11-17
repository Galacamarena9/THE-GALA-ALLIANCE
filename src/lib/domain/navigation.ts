import type { AppRole } from '@/lib/types';
import { ACTORS } from './roles.ts';

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
  { href: '/app/showcase', label: 'Showcase Day', icon: 'showcase', desc: 'Jornada mensual: los atletas inscritos ante universidades y clubes verificados, en directo.' },
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
    { href: '/app/match', label: 'Gala Match', icon: 'compass', desc: 'Las universidades y oportunidades que más encajan contigo, con las razones.' },
    { href: '/app/shortlist', label: 'Mi shortlist', icon: 'list', desc: 'Tus universidades guardadas, organizadas por nivel y listas para comparar.', more: true },
    { href: '/app/share', label: 'Compartir mi perfil', icon: 'megaphone', desc: 'Enlace privado para enviar tu ficha a coaches de EE. UU. y ver quién la abre.', more: true },
    { href: '/app/process', label: 'Mi pipeline', icon: 'pipeline', desc: 'Cada universidad y oportunidad que sigues: etapa, siguiente paso, tareas, documentos y ofertas.' },
    { href: '/app/applications', label: 'Mis candidaturas', icon: 'inbox', desc: 'Estado de cada beca a la que te has apuntado.', more: true },
    { href: '/app/plan', label: 'Mi plan', icon: 'tag', desc: 'Informe del perfil, CV deportivo, lista de universidades y calendario.', more: true },
    { href: '/app/documents', label: 'Documentos', icon: 'doc', desc: 'Checklist y archivos privados del proceso.', more: true },
    { href: '/app/requests', label: 'Solicitudes de información', icon: 'shield', desc: 'Universidades que te piden algo: tú decides qué compartes y hasta cuándo.', more: true },
    { href: '/app/offers', label: 'Comparar ofertas', icon: 'scale', desc: 'Coste neto, riesgos y memo de decisión.', more: true },
    { href: '/app/academia', label: 'Academia SAT/TOEFL', icon: 'grad', desc: 'Práctica con preguntas tipo examen y fechas oficiales.', more: true },
    { href: '/app/campaigns', label: 'Marcas y patrocinios', icon: 'megaphone', desc: 'Colaboraciones con marcas (solo mayores de edad).', more: true },
    { href: '/app/agents', label: 'Agentes', icon: 'handshake', desc: 'Agentes que quieren representarte y los que aceptaste.', more: true },
  ],
  parent: [
    { href: '/app/family', label: 'Panel familiar', icon: 'family', desc: 'El proceso de tu hijo o hija y lo que necesita tu aprobación.' },
    { href: '/app/share', label: 'Compartir su perfil', icon: 'megaphone', desc: 'Crea enlaces privados de reclutamiento para tu hijo o hija y ve quién los abre.' },
    { href: '/app/process', label: 'Su pipeline', icon: 'pipeline', desc: 'Los procesos de recruiting de tu hijo o hija y qué toca hacer en cada uno.' },
    { href: '/app/requests', label: 'Solicitudes de información', icon: 'shield', desc: 'Peticiones de universidades sobre tu hijo o hija: tú decides.', more: true },
    { href: '/app/plan', label: 'Plan familiar', icon: 'tag', desc: 'Informe, lista de universidades y calendario generados al momento.' },
    { href: '/app/documents', label: 'Documentos', icon: 'doc', desc: 'Checklist y archivos privados del proceso.', more: true },
    { href: '/app/offers', label: 'Comparar ofertas', icon: 'scale', desc: 'Coste neto, riesgos y memo de decisión.', more: true },
    { href: '/app/academia', label: 'Academia SAT/TOEFL', icon: 'grad', desc: 'Práctica con preguntas tipo examen y fechas oficiales.', more: true },
  ],
  university: [
    { href: '/app/recruit', label: 'Recruiting', icon: 'chart', desc: 'Tu espacio de recruiting: qué necesita atención, necesidades, equipo y tareas.' },
    { href: '/app/recruit/discover', label: 'Descubrir atletas', icon: 'compass', desc: 'Búsqueda que respeta la privacidad, con encaje con tus necesidades.' },
    { href: '/app/recruit/shortlists', label: 'Listas de seguimiento', icon: 'list', desc: 'Listas privadas o de equipo, con revisión, asignación y notas internas.' },
    { href: '/app/recruit/candidates', label: 'Procesos', icon: 'pipeline', desc: 'Candidatos por etapa interna, asignados y con historial.' },
    { href: '/app/opportunities?view=mine', label: 'Nuestras becas', icon: 'trophy', desc: 'Gestiona vuestras becas publicadas.', more: true },
    { href: '/app/opportunities/new', label: 'Publicar una beca', icon: 'megaphone', desc: 'Sale al momento si pasa los controles automáticos.', more: true },
    { href: '/app/applications', label: 'Candidaturas (vista clásica)', icon: 'inbox', desc: 'Candidaturas recibidas por oportunidad.', more: true },
    { href: '/app/lists', label: 'Listas personales', icon: 'list', desc: 'Atletas guardados y búsquedas con alertas.', more: true },
    { href: '/app/organization', label: 'Perfil y equipo', icon: 'building', desc: 'Datos de la universidad, verificación y miembros.', more: true },
  ],
  coach: [
    { href: '/app/recruit', label: 'Recruiting', icon: 'chart', desc: 'Tu espacio de recruiting: qué necesita atención, necesidades, equipo y tareas.' },
    { href: '/app/recruit/discover', label: 'Descubrir atletas', icon: 'compass', desc: 'Búsqueda que respeta la privacidad, con encaje con tus necesidades.' },
    { href: '/app/recruit/shortlists', label: 'Listas de seguimiento', icon: 'list', desc: 'Listas privadas o de equipo, con revisión, asignación y notas internas.' },
    { href: '/app/recruit/candidates', label: 'Procesos', icon: 'pipeline', desc: 'Candidatos por etapa interna, asignados y con historial.' },
    { href: '/app/lists', label: 'Listas personales', icon: 'list', desc: 'Atletas guardados y búsquedas con alertas.', more: true },
    { href: '/app/applications', label: 'Candidaturas (vista clásica)', icon: 'inbox', desc: 'Candidaturas recibidas por oportunidad.', more: true },
    { href: '/app/organization', label: 'Mi universidad o club', icon: 'building', desc: 'Datos de la organización, verificación y equipo.', more: true },
    { href: '/app/club', label: 'Portal de club', icon: 'users', desc: 'Plantilla, validación de estadísticas y colocaciones.', more: true },
  ],
  agent: [
    { href: '/app/portfolio', label: 'Cartera', icon: 'handshake', desc: 'Tu cartera: representados, propuestas, notas internas y seguimientos.' },
    { href: '/app/pipeline', label: 'Procesos', icon: 'pipeline', desc: 'Cada atleta con cada universidad: fase, responsable, tareas e historial.' },
    { href: '/app/contacts', label: 'Universidades y coaches', icon: 'campus', desc: 'Contactos de programas, privados de tu agencia.', more: true },
    { href: '/app/lists', label: 'Listas', icon: 'list', desc: 'Atletas guardados y búsquedas con alertas.' },
    { href: '/app/organization', label: 'Agencia', icon: 'building', desc: 'Datos de la agencia, verificación y equipo.' },
  ],
  brand: [
    { href: '/app/campaigns?view=mine', label: 'Mis campañas', icon: 'megaphone', desc: 'Campañas con atletas mayores de edad y sus candidaturas.' },
    { href: '/app/lists', label: 'Listas', icon: 'list', desc: 'Atletas que te interesan, agrupados en listas.' },
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

const FAMILY_SIDE: AppRole[] = ['athlete', 'parent'];
const ORG_SIDE: AppRole[] = ['university', 'coach', 'agent', 'brand'];
const pick = (list: NavItem[], href: string, extra: Partial<NavItem> = {}): NavItem[] => list.filter((i) => i.href === href).map((i) => ({ ...i, ...extra }));

/**
 * Barra lateral por actor: lo que se usa a diario a la vista (máx. 8) y lo demás tras "Ver más" o en el buscador.
 * Atleta y familia: Mi espacio · Descubrir (becas, universidades) · Mensajes · Aprender y decidir.
 * Organizaciones: Mi espacio · Talento (escaparate) · Mensajes · Herramientas (plegada).
 * Las notificaciones viven en la campana de la cabecera, no en la barra.
 */
export function sidebarFor(roles: AppRole[]): NavSection[] {
  const family = roles.some((r) => FAMILY_SIDE.includes(r));
  const org = roles.some((r) => ORG_SIDE.includes(r));
  const sections: NavSection[] = [{ title: 'Inicio', items: [{ href: '/app', label: 'Inicio', icon: 'home', desc: 'Tu resumen y los siguientes pasos.' }] }];
  if (org) sections.push({ title: 'Talento', items: pick(NETWORK_SERVICES, '/app/discover') });
  const order: AppRole[] = ['athlete', 'parent', 'university', 'coach', 'agent', 'brand', 'admin'];
  for (const role of order) {
    if (!roles.includes(role)) continue;
    const label = role === 'admin' ? 'Administración' : `Mi espacio · ${ACTORS.find((a) => a.role === role)?.label}`;
    sections.push({ title: label, items: PERSONAL_SERVICES[role] });
  }
  if (family) {
    sections.push({
      title: 'Descubrir',
      items: [
        ...pick(OPPORTUNITY_SERVICES, '/app/opportunities', { label: 'Becas' }),
        ...pick(OPPORTUNITY_SERVICES, '/app/universities'),
        ...pick(OPPORTUNITY_SERVICES, '/app/universities/compare', { more: true }),
        ...pick(NETWORK_SERVICES, '/app/discover', { more: true }),
      ],
    });
  }
  sections.push({
    title: 'Red',
    items: [...pick(NETWORK_SERVICES, '/app/inbox'), ...pick(NETWORK_SERVICES, '/app/showcase', family ? { more: true } : {}), ...pick(NETWORK_SERVICES, '/app/news', { more: true }), ...(family ? [] : pick(OPPORTUNITY_SERVICES, '/app/opportunities', { label: 'Becas', more: true }))],
  });
  sections.push({ title: family ? 'Aprender y decidir' : 'Herramientas', items: LEARN_SERVICES, collapsed: true });
  sections.push({ title: 'Cuenta', items: ACCOUNT_SERVICES, collapsed: true });
  // Sin duplicados entre secciones (p. ej. atleta + familia): se queda la primera aparición.
  const seen = new Set<string>();
  return sections.map((s) => ({ ...s, items: s.items.filter((i) => (seen.has(i.href) ? false : (seen.add(i.href), true))) })).filter((s) => s.items.length);
}
