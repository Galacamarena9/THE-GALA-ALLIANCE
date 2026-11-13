/**
 * Modelo de negocio de The Gala Alliance.
 *
 * Principio no negociable (misión): la visibilidad del atleta nunca se paga. Perfil, escaparate,
 * candidaturas y recibir contacto son gratis para siempre. Ningún plan compra prioridad en búsquedas,
 * "destacados" encubiertos ni garantiza una beca.
 *
 * Ingresos: servicios estandarizados para familias (pago único), SaaS para organizaciones,
 * portal para academias/clubes con programa de afiliados y, tras validación legal, campañas de marca.
 *
 * Estado: no hay cobros online activos. Las solicitudes entran en el pipeline comercial del admin
 * (validación concierge) y se activará el pago cuando estén revisados términos, desistimiento y fiscalidad.
 */
export type PlanAudience = 'athlete' | 'family' | 'organization' | 'academy' | 'agent' | 'brand';

export interface Plan {
  code: string;
  audience: PlanAudience;
  name: string;
  price: string;
  priceNote?: string;
  pitch: string;
  includes: string[];
  cta: 'signup' | 'request';
  highlight?: boolean;
}

export const VISIBILITY_PROMISE =
  'La visibilidad nunca se paga: tu perfil, el escaparate, las candidaturas y recibir contacto de organizaciones verificadas son gratis para siempre.';

export const PLANS: Plan[] = [
  {
    code: 'athlete_free',
    audience: 'athlete',
    name: 'Passport',
    price: '0 €',
    priceNote: 'para siempre',
    pitch: 'Todo lo que necesitas para que te encuentren y para saber qué hacer hoy.',
    includes: [
      'Opportunity Passport con vídeo, estadísticas, notas e idiomas',
      'Aparecer en el escaparate para organizaciones verificadas',
      'Candidaturas ilimitadas a oportunidades revisadas',
      'Mi camino: siguiente paso, calendario y readiness',
      'Calculadora de coste neto, guía oficial y Academia SAT/TOEFL',
      'Gala IA para resolver dudas del proceso',
    ],
    cta: 'signup',
  },
  {
    code: 'family_core',
    audience: 'family',
    name: 'Core',
    price: '247 €',
    priceNote: 'pago único',
    pitch: 'Un especialista revisa tu caso y te entrega un plan con universidades reales y su coste.',
    includes: [
      'Revisión del Passport por un especialista en recruiting',
      'Sports CV en inglés listo para enviar',
      'Shortlist razonada de universidades con coste neto estimado',
      'Plan de exámenes (SAT/TOEFL) y documentos según tu curso',
    ],
    cta: 'request',
    highlight: true,
  },
  {
    code: 'family_elite',
    audience: 'family',
    name: 'Elite',
    price: '497 €',
    priceNote: 'pago único',
    pitch: 'Acompañamiento por hitos hasta que la familia toma la decisión.',
    includes: [
      'Todo lo de Core',
      'Sesión de estrategia familiar (90 min)',
      'Revisión formal de documentos (checklist, no asesoría jurídica)',
      'Comparador de ofertas y memo de decisión con riesgos y preguntas pendientes',
      'Seguimiento por hitos: shortlist, ofertas y compromiso',
    ],
    cta: 'request',
  },
  {
    code: 'org_recruit',
    audience: 'organization',
    name: 'Recruit',
    price: 'Gratis en el piloto',
    priceNote: 'programa fundador',
    pitch: 'Talento internacional comparable y un pipeline de recruiting de principio a fin.',
    includes: [
      'Escaparate con filtros, búsquedas guardadas y alertas de perfiles nuevos',
      'Publicación de becas y oportunidades revisadas',
      'Pipeline de candidaturas con historial y notas internas',
      'Contacto seguro (con circuito familiar para menores)',
      'Equipo: invita a tus coaches',
    ],
    cta: 'request',
    highlight: true,
  },
  {
    code: 'academy_portal',
    audience: 'academy',
    name: 'Portal de academia o club',
    price: 'A medida',
    priceNote: 'anual',
    pitch: 'Tu roster gana visibilidad internacional y tú, control y reporting de colocaciones.',
    includes: [
      'Roster por temporada y promoción, con invitación y consentimiento',
      'Validación del club con alcance concreto ("confirmado por el club")',
      'Seguimiento de interés universitario y colocaciones',
      'Programa de afiliados: comisión pactada por cada familia que contrata Core o Elite',
    ],
    cta: 'request',
  },
  {
    code: 'agent_pro',
    audience: 'agent',
    name: 'Agencia',
    price: 'Gratis en el piloto',
    priceNote: 'programa fundador',
    pitch: 'Detecta talento y gestiona tu cartera con transparencia.',
    includes: [
      'Prospectos y cartera con representaciones aceptadas por el atleta',
      'Búsquedas guardadas y alertas',
      'Solo atletas mayores de edad, por diseño',
    ],
    cta: 'request',
  },
  {
    code: 'brand_campaigns',
    audience: 'brand',
    name: 'Campañas',
    price: 'Tras validación legal',
    pitch: 'Campañas con atletas mayores de edad, revisadas y con condiciones claras.',
    includes: [
      'Publicación de campañas revisadas por el equipo',
      'Candidaturas de atletas que han leído la normativa de su universidad',
      'Pagos y comisiones solo cuando estén revisados contratos, fiscalidad e inmigración',
    ],
    cta: 'request',
  },
];

export const AUDIENCE_LABEL: Record<PlanAudience, string> = {
  athlete: 'Atletas',
  family: 'Familias',
  organization: 'Universidades y coaches',
  academy: 'Academias y clubes',
  agent: 'Agentes',
  brand: 'Marcas',
};

export const planByCode = (code: string) => PLANS.find((p) => p.code === code);
