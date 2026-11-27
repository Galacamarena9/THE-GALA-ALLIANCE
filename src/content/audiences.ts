/**
 * Páginas «Para …» (QA web #6/#14): un mensaje y un CTA por audiencia. El cliente que paga es la agencia;
 * atletas, familias y clubes no pagan por estar. Todo lo que se afirma aquí existe en el producto: nada de cifras,
 * testimonios ni logos sin fuente. Los textos son la clave de traducción (tx) y tienen su inglés en `lib/i18n/en.ts`.
 */
import type { ActorRole } from '@/lib/domain/roles';

export type FooterAudience = 'agent' | 'athlete' | 'family' | 'club' | 'university' | 'coach' | 'brand';

export interface AudiencePage {
  slug: string;
  /** Tipo de cuenta con el que se da de alta (los clubes y academias usan la cuenta de coach o club). */
  role: ActorRole;
  /** Nombre en la navegación («Para …»). */
  nav: string;
  kicker: string;
  title: string;
  lead: string;
  problem: string;
  answer: string;
  services: string[];
  /** Qué cuesta, en una línea y sin letra pequeña. */
  price: string;
  primary: { label: string; href: string };
  secondary?: { label: string; href: string };
  footer: FooterAudience;
  metaTitle: string;
  metaDescription: string;
}

/** Orden: primero la agencia (cliente que paga) y después el resto de la alianza. */
export const AUDIENCES: AudiencePage[] = [
  {
    slug: 'agentes',
    role: 'agent',
    nav: 'Agencias',
    kicker: 'Para agentes y agencias',
    title: 'El sistema de trabajo de tu agencia, de Europa a la NCAA.',
    lead: 'Cada atleta, cada universidad y cada papel en un solo sitio, compartido con tu equipo y, si quieres, con el atleta y su familia.',
    problem: 'Llevas cada atleta y cada universidad entre hojas de cálculo, emails y WhatsApp, y los procesos se olvidan.',
    answer: 'Un tablero con cada proceso en 5 fases (introducción, evaluación, visita o prueba, oferta y decisión), quién lo lleva y qué toca hacer. Tu agencia, verificada; tus atletas, siempre con su consentimiento.',
    services: [
      'Cartera de atletas importable desde Excel (CSV), con su consentimiento',
      'Procesos por universidad en 5 fases, con próxima acción, tareas e historial',
      'Contactos de programas privados de tu agencia, importables desde Excel',
      'Bandeja con cada atleta (y su familia, si es menor) en el mismo hilo',
      'Roles de equipo y responsable por proceso',
      'Perfil de agencia verificada',
    ],
    price: 'Agente 79 €/mes y Agencia 199 €/mes, con 30 días gratis. Precio fundador −40 % de por vida para las 15 primeras agencias. Sin comisiones ni cobro por contactar.',
    primary: { label: 'Probar 30 días gratis', href: '/signup?role=agent&plan=agent_solo' },
    secondary: { label: 'Ver la demo sin registrarte', href: '/demo/agente' },
    footer: 'agent',
    metaTitle: 'Software para agencias de recruiting deportivo',
    metaDescription: 'Lleva cada atleta con cada universidad en 5 fases, con tu equipo y con su permiso. 30 días gratis, sin comisiones ni cobro por contactar.',
  },
  {
    slug: 'atletas',
    role: 'athlete',
    nav: 'Atletas',
    kicker: 'Para atletas',
    title: 'Si tienes nivel, que te puedan encontrar.',
    lead: 'Un solo Passport ante universidades, clubes y marcas verificados, juegues en la liga que juegues. Gratis para siempre.',
    problem: 'Hoy, si no vas con la selección, no juegas los mejores campeonatos o nadie mueve tu perfil, es fácil pasar desapercibido.',
    answer: 'Tu Passport te pone delante de organizaciones verificadas por tu nivel real, con datos comparables y el encaje con cada beca explicado.',
    services: ['Passport: tu perfil en el escaparate', 'Encaje explicado con cada beca', 'Roadmap y plazos según tu año', 'Candidaturas con seguimiento', 'Ofertas de marcas (18+)', 'Sports CV en PDF'],
    price: 'Gratis para siempre: la visibilidad nunca se paga.',
    primary: { label: 'Crear mi Passport gratis', href: '/signup?role=athlete' },
    secondary: { label: 'Hacer el test de opciones', href: '/test-opciones' },
    footer: 'athlete',
    metaTitle: 'Para atletas: tu Passport gratis ante universidades verificadas',
    metaDescription: 'Crea tu Passport deportivo gratis y aparece ante universidades, clubes y marcas verificados, con el encaje de cada beca explicado.',
  },
  {
    slug: 'familias',
    role: 'parent',
    nav: 'Familias',
    kicker: 'Para familias',
    title: 'El proceso, los plazos y el coste real de cada opción, en un solo lugar.',
    lead: 'Acompañas a tu hijo o hija con la información a la vista y nada se comparte sin vuestro permiso.',
    problem: 'Un proceso en otro idioma, con plazos que no conoces y costes que nadie te explica con claridad.',
    answer: 'El proceso paso a paso, el coste neto real de cada opción y el control de la privacidad de tu hijo o hija. Si trabajáis con una agencia, la veis en el mismo proceso y decidís qué puede ver.',
    services: ['Panel del proceso de tu hijo o hija', 'Calculadora de coste neto y comparador', 'Plazos y documentos por etapa', 'Control de privacidad y permisos', 'Con menores, nada sin la firma del tutor'],
    price: 'Crear la cuenta es gratis. Los servicios Core y Elite son opcionales y de pago único.',
    primary: { label: 'Crear cuenta de familia', href: '/signup?role=parent' },
    secondary: { label: 'Calcular el coste real', href: '/calculadora' },
    footer: 'family',
    metaTitle: 'Para familias: el proceso y el coste real de una beca en EE. UU.',
    metaDescription: 'Plazos, documentos y coste neto real de cada opción para estudiar y competir en EE. UU., con control de la privacidad de tu hijo o hija.',
  },
  {
    slug: 'clubes',
    role: 'coach',
    nav: 'Clubes',
    kicker: 'Para clubes y academias',
    title: 'Tus jugadores, con datos confirmados por su club.',
    lead: 'Da visibilidad internacional a tu roster, confirma sus datos y organiza tus pruebas desde un mismo sitio.',
    problem: 'Tus jugadores con nivel dependen de vídeos sueltos y de datos que nadie puede comprobar.',
    answer: 'Confirmas las estadísticas de tus jugadores (sello «confirmado por el club»), publicas pruebas y sigues sus candidaturas, siempre con su consentimiento y el de su familia si son menores.',
    services: ['Roster por temporada con enlace de invitación y consentimiento de cada atleta', 'Validación de estadísticas por el club', 'Pruebas (trials) con inscripción y lista de convocados', 'Seguimiento de candidaturas y colocaciones de quien lo comparte'],
    price: 'Gratis durante el piloto.',
    primary: { label: 'Registrar mi club', href: '/signup?role=coach' },
    secondary: { label: 'Cómo protegemos a menores y datos', href: '/seguridad' },
    footer: 'club',
    metaTitle: 'Para clubes y academias: roster verificado y pruebas',
    metaDescription: 'Confirma los datos de tus jugadores, publica pruebas y sigue sus candidaturas a universidades y clubes verificados. Gratis durante el piloto.',
  },
  {
    slug: 'universidades',
    role: 'university',
    nav: 'Universidades',
    kicker: 'Para universidades',
    title: 'Publica becas, recibe candidatos compatibles y gestiona tus candidatos internacionales.',
    lead: 'Talento europeo con datos comparables, el origen de cada dato a la vista y una agencia verificada al otro lado cuando la hay.',
    problem: 'Encontrar talento internacional exige comparar perfiles en formatos distintos y comprobar cada dato a mano.',
    answer: 'Perfiles estructurados con el origen de cada dato, matching por beca y un pipeline propio. El contacto respeta la ventana de reclutamiento de la NCAA.',
    services: ['Perfil verificado en el directorio', 'Publicación de becas y plazas', 'Talento compatible por beca', 'Pipeline de recruiting con notas privadas', 'Equipo de coaches'],
    price: 'Gratis durante el piloto.',
    primary: { label: 'Registrar mi universidad', href: '/signup?role=university' },
    secondary: { label: 'Cómo protegemos a menores y datos', href: '/seguridad' },
    footer: 'university',
    metaTitle: 'Para universidades: talento europeo verificado para tu programa',
    metaDescription: 'Publica becas y recibe candidatos europeos con datos comparables y verificables, con un pipeline de recruiting propio. Gratis durante el piloto.',
  },
  {
    slug: 'coaches',
    role: 'coach',
    nav: 'Coaches',
    kicker: 'Para coaches y scouts',
    title: 'Encuentra talento europeo con datos comparables y el origen de cada dato.',
    lead: 'Busca por deporte, posición, año, nota y vídeo, y guarda tus listas con notas privadas.',
    problem: 'Horas viendo vídeos sueltos sin contexto académico ni económico.',
    answer: 'Búsqueda por deporte, posición, año, nota y vídeo, shortlists privadas y Gala IA para buscar en lenguaje natural.',
    services: ['Búsqueda avanzada por deporte, posición, año, nota…', 'Shortlists privadas con notas', 'Pipeline de tu universidad o club', 'Gala IA: búsqueda en lenguaje natural'],
    price: 'Gratis durante el piloto.',
    primary: { label: 'Crear cuenta de coach', href: '/signup?role=coach' },
    secondary: { label: 'Ver oportunidades', href: '/oportunidades' },
    footer: 'coach',
    metaTitle: 'Para coaches y scouts: talento europeo comparable',
    metaDescription: 'Busca atletas europeos por deporte, posición, año, nota y vídeo, con shortlists privadas y el origen de cada dato. Gratis durante el piloto.',
  },
  {
    slug: 'marcas',
    role: 'brand',
    nav: 'Marcas',
    kicker: 'Para marcas',
    title: 'Publica ofertas y ficha atletas mayores de edad para promocionar tu marca.',
    lead: 'Colaboraciones transparentes, solo con atletas mayores de edad y con condiciones claras.',
    problem: 'Encontrar atletas auténticos con los que colaborar de forma transparente es caro y lento.',
    answer: 'Publica ofertas con condiciones claras y recibe candidaturas de atletas mayores de edad, con aviso NIL para los universitarios.',
    services: ['Ofertas de embajador, contenido, eventos…', 'Candidatos a cada oferta', 'Búsqueda de atletas 18+', 'Perfil de marca verificada'],
    price: 'Campañas de pago solo tras la revisión legal de contratos, fiscalidad e inmigración.',
    primary: { label: 'Crear cuenta de marca', href: '/signup?role=brand' },
    secondary: { label: 'Ver colaboraciones', href: '/oportunidades?v=brands' },
    footer: 'brand',
    metaTitle: 'Para marcas: colaboraciones con atletas mayores de edad',
    metaDescription: 'Publica ofertas de embajador, contenido o eventos y recibe candidaturas de atletas mayores de edad, con condiciones claras y aviso NIL.',
  },
];

export const audienceBySlug = (slug: string) => AUDIENCES.find((a) => a.slug === slug);
