import type { AppRole } from '@/lib/types';

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  /** Una frase que explica para qué sirve (buscador, inicio y ayudas). */
  desc?: string;
  /** Secundario: aparece tras "Ver más" para que la barra no abrume. */
  more?: boolean;
  /** Otras rutas exactas que también marcan esta entrada como activa (p. ej. «Inicio» = espacio de trabajo). */
  aliases?: string[];
  /** Navegación contextual: aparece bajo el destino cuando estás en él, en las migas y en el buscador. */
  children?: NavItem[];
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
  | 'grad' | 'bell' | 'tag' | 'chart' | 'compare' | 'doc' | 'scale' | 'user' | 'compass' | 'search' | 'more';

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
    { href: '/app/athlete', label: 'Mi camino', icon: 'path', desc: 'Tu siguiente paso y los plazos según tu año.', more: true },
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
    { href: '/app/family/costs', label: 'Coste real', icon: 'list', desc: 'Coste publicado, ayuda confirmada y lo que falta, opción por opción.' },
    { href: '/app/share', label: 'Compartir su perfil', icon: 'megaphone', desc: 'Crea enlaces privados de reclutamiento para tu hijo o hija y ve quién los abre.', more: true },
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
    { href: '/app/opportunities?view=mine', label: 'Nuestras becas', icon: 'trophy', desc: 'Gestiona vuestras becas publicadas y quién se ha apuntado.' },
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
    { href: '/app/verify', label: 'Mi verificación', icon: 'shield', desc: 'Correo institucional, afiliación, programa y cargo: qué está verificado y qué falta.', more: true },
    { href: '/app/club', label: 'Portal de club', icon: 'users', desc: 'Plantilla, validación de estadísticas y colocaciones.', more: true },
  ],
  agent: [
    { href: '/app/portfolio', label: 'Cartera', icon: 'handshake', desc: 'Tu cartera: representados, propuestas, notas internas y seguimientos.' },
    { href: '/app/portfolio/trials', label: 'Trials y programas', icon: 'trophy', desc: 'Trials de clubes y academias para tus representados: inscripciones, costes y seguimiento en un solo sitio.' },
    { href: '/app/pipeline', label: 'Procesos', icon: 'pipeline', desc: 'Cada atleta con cada universidad: fase, responsable, tareas e historial.' },
    { href: '/app/contacts', label: 'Universidades y coaches', icon: 'campus', desc: 'Contactos de programas, privados de tu agencia.', more: true },
    { href: '/app/lists', label: 'Listas', icon: 'list', desc: 'Atletas guardados y búsquedas con alertas.' },
    { href: '/app/organization', label: 'Agencia', icon: 'building', desc: 'Datos de la agencia, verificación y equipo.', more: true },
  ],
  brand: [
    { href: '/app/campaigns?view=mine', label: 'Mis campañas', icon: 'megaphone', desc: 'Campañas con atletas mayores de edad y sus candidaturas.' },
    { href: '/app/lists', label: 'Listas', icon: 'list', desc: 'Atletas que te interesan, agrupados en listas.' },
    { href: '/app/organization', label: 'Marca', icon: 'building', desc: 'Datos de la marca, verificación y equipo.' },
  ],
  admin: [
    { href: '/app/admin/panel', label: 'Panel de mando', icon: 'chart', desc: 'Métricas, embudo, automatizaciones y ventas.' },
    { href: '/app/admin', label: 'Revisión y verificación', icon: 'shield', desc: 'Colas de verificación y denuncias.' },
    { href: '/app/admin/safety', label: 'Trust & Safety', icon: 'shield', desc: 'Casos, medidas proporcionales y apelaciones.' },
    { href: '/app/admin/analytics', label: 'Analítica', icon: 'chart', desc: 'Liquidez, activación, retención y oferta/demanda, con sus definiciones.' },
    { href: '/app/admin/ops', label: 'Operaciones', icon: 'chart', desc: 'Interruptores, soporte, aprobaciones y conflictos.' },
  ],
};

export const ACCOUNT_SERVICES: NavItem[] = [
  { href: '/precios', label: 'Planes y servicios', icon: 'tag', desc: 'Gratis para atletas; Core, Elite y Signature para familias.' },
  { href: '/app/settings', label: 'Privacidad y datos', icon: 'shield', desc: 'Visibilidad, descarga de datos y baja de la cuenta.' },
  { href: '/app/support', label: 'Ayuda', icon: 'book', desc: 'Escríbenos y te respondemos aquí.' },
  { href: '/app/invitar', label: 'Invitar', icon: 'spark', desc: 'Comparte The Gala Alliance con tu equipo.' },
  { href: '/app/trust', label: 'Confianza y seguridad', icon: 'shield', desc: 'Quién ve tus datos ahora, medidas que te afecten y cómo apelar.' },
];

export const LEARN_SERVICES: NavItem[] = [
  { href: '/app/ia', label: 'Gala IA', icon: 'spark', desc: 'Pregunta lo que quieras sobre el proceso, a cualquier hora.' },
  { href: '/app/calculator', label: 'Calculadora de coste', icon: 'calc', desc: 'Coste real a 4 años con viajes, seguro y subidas.' },
  { href: '/app/guia', label: 'Centro de información', icon: 'book', desc: 'Divisiones, requisitos, documentos y visado con fuentes oficiales.' },
];

/**
 * Roles cuyo «Inicio» ES su espacio de trabajo: con los primeros pasos hechos, /app lleva directo aquí,
 * y la barra no repite la misma página con otro nombre.
 */
export const WORKSPACE_HOME: Partial<Record<AppRole, string>> = {
  parent: '/app/family',
  coach: '/app/recruit',
  university: '/app/recruit',
  brand: '/app/campaigns?view=mine',
  admin: '/app/admin',
};

/** Rol principal para la navegación: el primero en este orden (el atleta manda sobre la familia). */
export function navPrimary(roles: AppRole[]): AppRole | undefined {
  return (['athlete', 'agent', 'parent', 'university', 'coach', 'brand', 'admin'] as AppRole[]).find((r) => roles.includes(r));
}


// ================================================================================================
// Prompt 4 · UNA plataforma, CUATRO modos (+ familia y marca). Cada actor ve SU producto:
// pocos destinos de primer nivel y el resto como navegación contextual dentro de cada destino.
// Las rutas físicas no cambian (enlaces profundos y servicios intactos): cambia cómo se agrupan.
// ================================================================================================

export type NavModeId = 'agent' | 'athlete' | 'family' | 'university' | 'brand' | 'operations';
export interface NavMode {
  id: NavModeId;
  label: string;
  /** Destinos de primer nivel (barra lateral, raíl de tablet). */
  primary: NavItem[];
  /** «Más»: un único destino plegado (cuenta como uno). Vacío = sin «Más». */
  more: NavItem[];
  /** Barra inferior móvil: 4 accesos + «Menú». */
  tabs: NavItem[];
  /** Solo buscador (⌘K) y menú de usuario: herramientas y cuenta que no merecen un destino. */
  extra: NavItem[];
}

const it = (href: string, label: string, icon: IconName, desc?: string, x: Partial<NavItem> = {}): NavItem => ({ href, label, icon, desc, ...x });

const MESSAGES = it('/app/inbox', 'Mensajes', 'chat', 'Conversaciones seguras; con menores, la familia aprueba y ve el hilo.');
const TOOLS: NavItem[] = [
  it('/app/ia', 'Gala IA', 'spark', 'Pregunta lo que quieras sobre el proceso, a cualquier hora.'),
  it('/app/calculator', 'Calculadora de coste', 'calc', 'Coste real a 4 años con viajes, seguro y subidas.'),
  it('/app/guia', 'Centro de información', 'book', 'Divisiones, requisitos, documentos y visado con fuentes oficiales.'),
];

/**
 * En pausa (auditoría 22-nov-2026): siguen funcionando y se encuentran con el buscador (⌘K),
 * pero no ocupan sitio en el menú hasta que el núcleo (agencias y familias) tenga clientes de pago.
 */
export const PAUSED: NavItem[] = [
  it('/app/news', 'Actualidad', 'news', 'Novedades de atletas, comunicados oficiales y cambios de normativa.'),
  it('/app/showcase', 'Showcase Day', 'showcase', 'Jornada mensual ante universidades y clubes verificados.'),
  it('/app/academia', 'Academia SAT/TOEFL', 'grad', 'Práctica con preguntas tipo examen y fechas oficiales.'),
];
const ACCOUNT = (org: boolean): NavItem[] => [
  org ? it('/app/billing', 'Plan y facturación', 'tag', 'Tu plan, asientos, uso y facturas.') : it('/precios', 'Planes y servicios', 'tag', 'Gratis para atletas; Core, Elite y Signature para familias.'),
  it('/app/settings', 'Privacidad y datos', 'shield', 'Visibilidad, descarga de datos y baja de la cuenta.'),
  it('/app/trust', 'Confianza y seguridad', 'shield', 'Quién ve tus datos ahora, medidas que te afecten y cómo apelar.'),
  it('/app/support', 'Ayuda', 'book', 'Escríbenos y te respondemos aquí.'),
  it('/app/invitar', 'Invitar', 'spark', 'Comparte The Gala Alliance con tu equipo.'),
];

/** Agencia (reforma 180°): Hoy · Atletas · Procesos · Oportunidades · Mensajes. Cuenta y herramientas en «Más». */
function agentMode(): NavMode {
  const athletes = it('/app/portfolio', 'Atletas', 'users', 'Tu cartera: representados, propuestas, notas y seguimientos.', {
    children: [
      it('/app/portfolio', 'Mis atletas', 'users', 'Representados y propuestas, con su estado y siguiente paso.'),
      it('/app/discover', 'Buscar talento', 'search', 'Filtra por deporte, posición, físico, nacionalidad, promoción, nivel e idioma.'),
      it('/app/lists', 'Listas', 'list', 'Atletas guardados y búsquedas con alertas.'),
    ],
  });
  const processes = it('/app/pipeline', 'Procesos', 'pipeline', 'Cada atleta con cada universidad o club: fase, responsable, tareas e historial.', {
    children: [
      it('/app/pipeline', 'Tablero de procesos', 'pipeline', 'Tablero y tabla de procesos con plazos y responsables.'),
      it('/app/contacts', 'Universidades y coaches', 'campus', 'Contactos de programas, privados de tu agencia.'),
      it('/app/pipeline/team', 'Equipo', 'users', 'Quién lleva cada proceso en tu agencia.'),
    ],
  });
  const opportunities = it('/app/opportunities/discover', 'Oportunidades', 'trophy', 'Elige un atleta y ve lo que encaja, por qué y qué falta saber.', {
    children: [
      it('/app/opportunities/discover', 'Buscar para un atleta', 'search', 'Recomendaciones explicadas para cada atleta que representas.'),
      it('/app/portfolio/trials', 'Trials y programas', 'trophy', 'Trials de clubes y academias para tus representados.'),
      it('/app/universities', 'Universidades', 'campus', 'Directorio con datos oficiales del U.S. Department of Education.'),
      it('/app/universities/compare', 'Comparar universidades', 'compare', 'Hasta 5 universidades lado a lado.'),
    ],
  });
  const home = it('/app', 'Hoy', 'home', 'Lo que toca hoy: vencidos, ofertas que caducan, documentos y respuestas.');
  return {
    id: 'agent', label: 'Agencia',
    primary: [home, athletes, processes, opportunities, MESSAGES],
    more: [it('/app/organization', 'Agencia', 'building', 'Datos de la agencia, verificación y miembros.'), ...TOOLS, ...ACCOUNT(true)],
    tabs: [home, athletes, processes, MESSAGES],
    extra: PAUSED,
  };
}

/** Atleta (reforma 180°): Hoy · Mi perfil · Oportunidades · Mi proceso · Mensajes (exactamente 5, sin «Más»). */
function athleteMode(adult: boolean): NavMode {
  const home = it('/app', 'Hoy', 'home', 'Tu siguiente paso, tus plazos y quién te ha visto.');
  const profile = it('/app/athlete/passport', 'Mi perfil', 'id', 'Tu Passport: lo que ven universidades, clubes y agentes.', {
    children: [
      it('/app/athlete/passport', 'Mi Passport', 'id', 'Tu perfil deportivo y académico.'),
      it('/app/share', 'Compartir mi perfil', 'megaphone', 'Enlace privado para coaches y quién lo abre.'),
      it('/app/agents', 'Agentes', 'handshake', 'Agentes que quieren representarte y los que aceptaste.'),
      ...(adult ? [it('/app/collaborations', 'Colaboraciones', 'megaphone', 'Tus colaboraciones con marcas.')] : []),
      it('/app/settings', 'Privacidad y datos', 'shield', 'Quién ve cada bloque, descarga de datos y baja.'),
    ],
  });
  const opportunities = it('/app/opportunities', 'Oportunidades', 'trophy', 'Becas, universidades que encajan contigo y tu shortlist.', {
    children: [
      it('/app/match', 'Gala Match', 'compass', 'Las universidades y oportunidades que más encajan contigo, con las razones.'),
      it('/app/opportunities', 'Becas', 'trophy', 'Ofertas de organizaciones verificadas con sello de confianza y coste neto.'),
      it('/app/universities', 'Universidades', 'campus', 'Directorio con datos oficiales.'),
      it('/app/shortlist', 'Mi shortlist', 'list', 'Tus universidades guardadas, listas para comparar.'),
      it('/app/universities/compare', 'Comparar universidades', 'compare', 'Hasta 5 universidades lado a lado.'),
      ...(adult ? [it('/app/campaigns', 'Marcas y patrocinios', 'megaphone', 'Colaboraciones con marcas (solo mayores de edad).')] : []),
    ],
  });
  const journey = it('/app/process', 'Mi proceso', 'path', 'Tus procesos, candidaturas, ofertas, documentos y plan.', {
    children: [
      it('/app/process', 'Mis procesos', 'pipeline', 'Cada universidad que sigues: etapa, siguiente paso, tareas y documentos.'),
      it('/app/applications', 'Candidaturas', 'inbox', 'Estado de cada beca a la que te has apuntado.'),
      it('/app/offers', 'Ofertas', 'scale', 'Coste neto, riesgos y memo de decisión.'),
      it('/app/documents', 'Documentos', 'doc', 'Checklist y archivos privados del proceso.'),
      it('/app/requests', 'Solicitudes', 'shield', 'Universidades que te piden algo: tú decides qué compartes.'),
      it('/app/plan', 'Mi plan', 'tag', 'Informe del perfil, CV deportivo, lista de universidades y calendario.'),
      it('/app/athlete', 'Plazos por curso', 'path', 'Lo que toca según tu año.'),
    ],
  });
  return {
    id: 'athlete', label: 'Atleta',
    primary: [home, profile, opportunities, journey, MESSAGES],
    more: [],
    tabs: [home, { ...opportunities, label: 'Oportun.' }, journey, MESSAGES],
    extra: [...TOOLS, ...ACCOUNT(false).filter((i) => i.href !== '/app/settings'), ...PAUSED],
  };
}

/** Familia (reforma 180°): Hoy · Su proceso · Costes · Aprobaciones · Mensajes. */
function familyMode(): NavMode {
  const home = it('/app', 'Hoy', 'home', 'Panel familiar: lo que necesita vuestra decisión y los plazos.', { aliases: ['/app/family'] });
  const journey = it('/app/process', 'Su proceso', 'path', 'Procesos, ofertas, documentos y plan de tu hijo o hija.', {
    children: [
      it('/app/process', 'Procesos', 'pipeline', 'Los procesos de recruiting y qué toca hacer en cada uno.'),
      it('/app/documents', 'Documentos', 'doc', 'Checklist y archivos privados del proceso.'),
      it('/app/plan', 'Plan familiar', 'tag', 'Informe, lista de universidades y calendario.'),
      it('/app/opportunities', 'Becas', 'trophy', 'Ofertas de organizaciones verificadas.'),
      it('/app/universities', 'Universidades', 'campus', 'Directorio con datos oficiales.'),
    ],
  });
  const costs = it('/app/family/costs', 'Costes', 'scale', 'Coste publicado, ayuda confirmada y lo que falta, opción por opción.', {
    children: [
      it('/app/family/costs', 'Coste real', 'scale', 'Coste neto por opción. Solo lo ve la familia.'),
      it('/app/offers', 'Comparar ofertas', 'scale', 'Coste neto, riesgos y memo de decisión.'),
    ],
  });
  const approvals = it('/app/family/approvals', 'Aprobaciones', 'shield', 'Todo lo que espera tu permiso: contactos, documentos y actividades, en una sola lista.', {
    children: [
      it('/app/family/approvals', 'Pendientes', 'shield', 'Contactos, documentos y actividades que esperan tu decisión.'),
      it('/app/requests', 'Solicitudes de información', 'shield', 'Peticiones de universidades sobre tu hijo o hija: tú decides qué compartir.'),
      it('/app/family/safety', 'Seguridad y permisos', 'shield', 'Quién puede contactar y ver a tu hijo o hija.'),
    ],
  });
  return {
    id: 'family', label: 'Familia',
    primary: [home, journey, costs, approvals, MESSAGES],
    more: [it('/app/share', 'Compartir su perfil', 'megaphone', 'Enlaces privados de reclutamiento.'), ...TOOLS, ...ACCOUNT(false)],
    tabs: [home, journey, costs, approvals],
    extra: PAUSED,
  };
}

/** Club o universidad (reforma 180°): Hoy · Buscar atletas · Mis listas · Procesos · Becas y pruebas. */
function universityMode(club: boolean, isCoach: boolean): NavMode {
  const home = it('/app', 'Hoy', 'home', 'Recruiting: qué necesita atención, necesidades por posición y agenda.', { aliases: ['/app/recruit'] });
  const discover = it('/app/recruit/discover', 'Buscar atletas', 'search', 'Búsqueda con privacidad y encaje con tus necesidades.', {
    children: [
      it('/app/recruit/discover', 'Descubrir atletas', 'search', 'Búsqueda que respeta la privacidad, con encaje.'),
      it('/app/recruit/compare', 'Comparar', 'compare', 'Candidatos lado a lado.'),
      it('/app/recruit/needs', 'Necesidades', 'chart', 'Plazas por posición, temporada y promoción.'),
    ],
  });
  const lists = it('/app/recruit/shortlists', 'Mis listas', 'list', 'Listas privadas o de equipo, con revisión y notas.', {
    children: [
      it('/app/recruit/shortlists', 'Listas de seguimiento', 'list', 'Listas privadas o de equipo, con revisión y notas.'),
      it('/app/lists', 'Listas personales', 'list', 'Atletas guardados y búsquedas con alertas.'),
    ],
  });
  const processes = it('/app/recruit/candidates', 'Procesos', 'pipeline', 'Candidatos por etapa interna, asignados y con historial.', {
    children: [
      it('/app/recruit/candidates', 'Candidatos', 'pipeline', 'Candidatos por etapa interna.'),
      it('/app/applications', 'Candidaturas recibidas', 'inbox', 'Quién se ha apuntado a cada oportunidad.'),
      it('/app/recruit/tasks', 'Tareas del equipo', 'list', 'Quién hace qué y para cuándo.'),
    ],
  });
  const published = it('/app/opportunities?view=mine', 'Becas y pruebas', 'trophy', 'Vuestras becas, trials y programas publicados.', {
    children: [
      it('/app/opportunities?view=mine', 'Publicadas', 'trophy', 'Gestiona lo que habéis publicado.'),
      it('/app/opportunities/new', 'Publicar', 'megaphone', 'Sale al momento si pasa los controles automáticos.'),
      it('/app/recruit/trials', 'Trials', 'trophy', 'Inscripciones, plazas y asistencia.'),
    ],
  });
  return {
    id: 'university', label: club ? 'Club / academia' : 'Universidad',
    primary: [home, discover, lists, processes, published],
    more: [MESSAGES, it('/app/organization', club ? 'Club / academia' : 'Universidad y equipo', 'building', 'Datos, verificación y miembros.'),
      ...(isCoach ? [it('/app/verify', 'Mi verificación', 'shield', 'Correo institucional, afiliación y cargo.'), it('/app/club', 'Portal de club', 'users', 'Plantilla, validación de estadísticas y colocaciones.')] : []),
      ...TOOLS, ...ACCOUNT(true)],
    tabs: [home, discover, lists, processes],
    extra: PAUSED,
  };
}

/** Marca: campañas (su inicio), talento y listas. Las colaboraciones viven dentro de cada campaña. */
function brandMode(): NavMode {
  const home = it('/app', 'Hoy', 'home', 'Tus campañas y sus candidaturas.', { aliases: ['/app/campaigns'] });
  const talent = it('/app/discover', 'Talento', 'search', 'Atletas mayores de edad que aceptan colaboraciones.');
  const lists = it('/app/lists', 'Listas', 'list', 'Atletas que te interesan, agrupados en listas.');
  return {
    id: 'brand', label: 'Marca',
    primary: [home, talent, lists, MESSAGES],
    more: [it('/app/campaigns/new', 'Nueva campaña', 'megaphone', 'Publica una campaña para atletas mayores de edad.'),
      it('/app/organization', 'Marca', 'building', 'Datos de la marca, verificación y equipo.'), ...TOOLS, ...ACCOUNT(true)],
    tabs: [home, talent, lists, MESSAGES],
    extra: PAUSED,
  };
}

/** Gala Operations: Verificación, Cumplimiento, Confianza, Moderación, Soporte. */
function operationsMode(): NavMode {
  const verification = it('/app/admin', 'Verificación', 'shield', 'Organizaciones, becas, campañas, enlaces y reclamaciones.');
  const compliance = it('/app/admin/ops', 'Cumplimiento', 'scale', 'Salud, interruptores, aprobaciones dobles, conflictos y jobs.');
  const trust = it('/app/admin/safety', 'Confianza', 'shield', 'Casos, medidas proporcionales y apelaciones.');
  const moderation = it('/app/admin?view=moderation', 'Moderación', 'bell', 'Denuncias por prioridad.');
  const support = it('/app/admin/ops?view=support', 'Soporte', 'chat', 'Búsqueda mínima y casos de soporte.');
  return {
    id: 'operations', label: 'Operaciones Gala',
    primary: [verification, compliance, trust, moderation, support],
    more: [it('/app/admin/difusion', 'Difusión', 'compass', 'Agencias, universidades y federaciones a las que invitar, con su respuesta.'),
      it('/app/admin/panel', 'Panel de mando', 'chart', 'Métricas, embudo, automatizaciones y ventas.'),
      it('/app/admin/analytics', 'Analítica', 'chart', 'Liquidez, activación y retención, con sus definiciones.'), MESSAGES, ...TOOLS],
    tabs: [verification, moderation, trust, support],
    extra: [],
  };
}

export interface NavContext { roles: AppRole[]; primaryRole?: AppRole | null; isMinor?: boolean; clubStaff?: boolean }

/** El modo lo decide el rol principal del perfil (o el primero que tenga). */
export function navModeFor({ roles, primaryRole, isMinor = false, clubStaff = false }: NavContext): NavMode {
  const primary = primaryRole && roles.includes(primaryRole) ? primaryRole : navPrimary(roles);
  switch (primary) {
    case 'agent': return withOtherRoles(agentMode(), roles, primary);
    case 'athlete': return withOtherRoles(athleteMode(!isMinor), roles, primary);
    case 'parent': return withOtherRoles(familyMode(), roles, primary);
    case 'university': case 'coach': return withOtherRoles(universityMode(clubStaff, roles.includes('coach')), roles, primary);
    case 'brand': return withOtherRoles(brandMode(), roles, primary);
    case 'admin': return operationsMode();
    default: return { id: 'athlete', label: 'Cuenta', primary: [it('/app', 'Hoy', 'home'), MESSAGES], more: [...TOOLS, ...ACCOUNT(false)], tabs: [it('/app', 'Hoy', 'home'), MESSAGES], extra: [] };
  }
}

/** Con varios roles, los otros espacios quedan en «Más» (ningún espacio inaccesible). Admin: acceso a Operaciones. */
function withOtherRoles(mode: NavMode, roles: AppRole[], primary: AppRole): NavMode {
  const others: NavItem[] = [];
  const seen = new Set(flattenMode(mode).map((i) => i.href.split('?')[0]));
  for (const r of roles) {
    if (r === primary) continue;
    if (r === 'admin') { others.push(it('/app/admin', 'Operaciones Gala', 'shield', 'Verificación, cumplimiento, confianza, moderación y soporte.')); continue; }
    const extra = r === 'agent' ? agentMode() : r === 'parent' ? familyMode() : r === 'brand' ? brandMode() : r === 'athlete' ? athleteMode(false) : universityMode(false, r === 'coach');
    for (const i of flattenMode(extra)) {
      const k = i.href.split('?')[0];
      if (i.href === '/app' || seen.has(k)) continue;
      seen.add(k);
      others.push({ ...i, children: undefined });
    }
    if (r === 'parent' && !seen.has('/app/family')) others.unshift(it('/app/family', 'Panel familiar', 'family', 'El proceso de tu hijo o hija.'));
  }
  return others.length ? { ...mode, more: [...others, ...mode.more] } : mode;
}

/** Todos los destinos del modo (primer nivel, contextuales, «Más» y extra), sin duplicar. */
export function flattenMode(mode: NavMode): NavItem[] {
  const out: NavItem[] = [];
  const seen = new Set<string>();
  const add = (i: NavItem) => { if (!seen.has(i.href)) { seen.add(i.href); out.push(i); } };
  for (const p of mode.primary) { add(p); p.children?.forEach(add); }
  mode.more.forEach(add);
  mode.extra.forEach(add);
  return out;
}

/** Número de destinos de primer nivel: los primarios más «Más» si existe. */
export const topLevelCount = (mode: NavMode) => mode.primary.length + (mode.more.length ? 1 : 0);

/** Compatibilidad: secciones para la barra lateral, el menú móvil y el buscador. */
export function sidebarFor(roles: AppRole[], primaryRole?: AppRole | null, ctx: Partial<NavContext> = {}): NavSection[] {
  const mode = navModeFor({ roles, primaryRole, ...ctx });
  const sections: NavSection[] = [{ title: mode.label, items: mode.primary }];
  if (mode.more.length) sections.push({ title: 'Más', items: mode.more, collapsed: true });
  if (mode.extra.length) sections.push({ title: 'Herramientas y cuenta', items: mode.extra, collapsed: true });
  return sections;
}

/** Migas de pan: destino de primer nivel › vista contextual (si es distinta). */
export function breadcrumbsFor(mode: NavMode, pathname: string, search = ''): NavItem[] {
  const current = `${pathname}${search ? `?${search}` : ''}`;
  const matches = (i: NavItem) => {
    const base = i.href.split('?')[0];
    if (i.href === current || i.aliases?.includes(pathname)) return 3;
    if (base === '/app') return pathname === '/app' ? 2 : 0;
    if (pathname === base && !i.href.includes('?')) return 2;
    return pathname.startsWith(`${base}/`) ? 1 : 0;
  };
  let best: { top: NavItem; child?: NavItem; score: number; len: number } | null = null;
  for (const top of [...mode.primary, ...mode.more]) {
    for (const c of [top, ...(top.children ?? [])]) {
      const sc = matches(c);
      if (!sc) continue;
      const len = c.href.length;
      if (!best || sc > best.score || (sc === best.score && len > best.len)) best = { top, child: c === top ? undefined : c, score: sc, len };
    }
  }
  if (!best) return [];
  return best.child && best.child.href !== best.top.href ? [best.top, best.child] : [best.top];
}

/** Fase 4 (U2): la navegación en inglés. Las claves son los textos en castellano; lo que falte queda en castellano. */
const NAV_EN: Record<string, string> = {
  "Invitar": "Invite",
  "Comparte The Gala Alliance con tu equipo.": "Share The Gala Alliance with your team.",
  "Hoy": "Today",
  "Recruiting: qué necesita atención, necesidades por posición y agenda.": "Recruiting: what needs attention, needs by position and schedule.",
  "Buscar atletas": "Find athletes",
  "Búsqueda con privacidad y encaje con tus necesidades.": "Privacy-respecting search matched to your needs.",
  "Descubrir atletas": "Discover athletes",
  "Búsqueda que respeta la privacidad, con encaje.": "Privacy-respecting search with fit.",
  "Comparar": "Compare",
  "Candidatos lado a lado.": "Candidates side by side.",
  "Necesidades": "Needs",
  "Plazas por posición, temporada y promoción.": "Spots by position, season and class.",
  "Mis listas": "My lists",
  "Listas privadas o de equipo, con revisión y notas.": "Private or team lists, with review and notes.",
  "Listas de seguimiento": "Watch lists",
  "Listas personales": "Personal lists",
  "Atletas guardados y búsquedas con alertas.": "Saved athletes and searches with alerts.",
  "Procesos": "Processes",
  "Candidatos por etapa interna, asignados y con historial.": "Candidates by internal stage, assigned and with history.",
  "Candidatos": "Candidates",
  "Candidatos por etapa interna.": "Candidates by internal stage.",
  "Candidaturas recibidas": "Applications received",
  "Quién se ha apuntado a cada oportunidad.": "Who applied to each opportunity.",
  "Tareas del equipo": "Team tasks",
  "Quién hace qué y para cuándo.": "Who does what, and by when.",
  "Becas y pruebas": "Scholarships & tryouts",
  "Vuestras becas, trials y programas publicados.": "Your published scholarships, tryouts and programs.",
  "Publicadas": "Published",
  "Gestiona lo que habéis publicado.": "Manage what you have published.",
  "Publicar": "Post",
  "Sale al momento si pasa los controles automáticos.": "Goes live right away if it passes automatic checks.",
  "Trials": "Tryouts",
  "Inscripciones, plazas y asistencia.": "Sign-ups, spots and attendance.",
  "Club / academia": "Club / academy",
  "Universidad": "University",
  "Universidad y equipo": "University and team",
  "Datos, verificación y miembros.": "Details, verification and members.",
  "Mi verificación": "My verification",
  "Correo institucional, afiliación y cargo.": "Institutional email, affiliation and role.",
  "Portal de club": "Club portal",
  "Plantilla, validación de estadísticas y colocaciones.": "Roster, stat validation and placements.",
  "Mensajes": "Messages",
  "Conversaciones seguras; con menores, la familia aprueba y ve el hilo.": "Secure conversations; with minors, the family approves and sees the thread.",
  "Pregunta lo que quieras sobre el proceso, a cualquier hora.": "Ask anything about the process, any time.",
  "Calculadora de coste": "Cost calculator",
  "Coste real a 4 años con viajes, seguro y subidas.": "Real 4-year cost with travel, insurance and increases.",
  "Centro de información": "Information center",
  "Divisiones, requisitos, documentos y visado con fuentes oficiales.": "Divisions, requirements, documents and visas with official sources.",
  "Plan y facturación": "Plan & billing",
  "Tu plan, asientos, uso y facturas.": "Your plan, seats, usage and invoices.",
  "Planes y servicios": "Plans & services",
  "Privacidad y datos": "Privacy & data",
  "Visibilidad, descarga de datos y baja de la cuenta.": "Visibility, data download and account deletion.",
  "Confianza y seguridad": "Trust & safety",
  "Quién ve tus datos ahora, medidas que te afecten y cómo apelar.": "Who sees your data now, measures that affect you and how to appeal.",
  "Ayuda": "Help",
  "Escríbenos y te respondemos aquí.": "Write to us and we reply here.",
  "Actualidad": "News",
  "Novedades de atletas, comunicados oficiales y cambios de normativa.": "Athlete updates, official notices and rule changes.",
  "Academia SAT/TOEFL": "SAT/TOEFL Academy",
  "Práctica con preguntas tipo examen y fechas oficiales.": "Exam-style practice and official dates.",
  "Jornada mensual ante universidades y clubes verificados.": "Monthly showcase for verified universities and clubs.",
  "Cuenta": "Account",
  "Operaciones Gala": "Gala Operations",
};
const tr = (v: string | undefined) => (v == null ? v : NAV_EN[v] ?? v);
export function localizeNavItem(i: NavItem): NavItem {
  return { ...i, label: tr(i.label)!, desc: tr(i.desc), children: i.children?.map(localizeNavItem) };
}
export function localizeMode(mode: NavMode, locale: 'es' | 'en'): NavMode {
  if (locale === 'es') return mode;
  return { ...mode, label: tr(mode.label)!, primary: mode.primary.map(localizeNavItem), more: mode.more.map(localizeNavItem), tabs: mode.tabs.map(localizeNavItem), extra: mode.extra.map(localizeNavItem) };
}
