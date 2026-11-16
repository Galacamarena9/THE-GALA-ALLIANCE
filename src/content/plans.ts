/**
 * Modelo de negocio de The Gala Alliance.
 *
 * Principio no negociable (misión): la visibilidad del atleta nunca se paga. Perfil, escaparate,
 * candidaturas y recibir contacto son gratis para siempre. Ningún plan compra prioridad en búsquedas,
 * "destacados" encubiertos ni garantiza una beca.
 *
 * Operación autónoma: Core y Elite se entregan solos (generados desde el Passport y datos oficiales),
 * se pagan con Stripe Checkout y el derecho al plan lo concede el webhook sin intervención humana.
 * El único servicio con trabajo personal de la fundadora es Signature (plazas limitadas, a medida).
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
  /** signup: gratis; checkout: pago automático (si Stripe está configurado, si no se solicita); request: a medida. */
  cta: 'signup' | 'checkout' | 'request';
  /** automatic: se entrega solo, sin esperas; personal: incluye trabajo 1:1 de una persona. */
  delivery: 'automatic' | 'personal';
  /** Importe en céntimos de euro para Stripe Checkout (solo planes de pago único con precio cerrado). */
  checkoutCents?: number;
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
      'Candidaturas ilimitadas y sello de confianza con señales de alarma en cada oferta',
      'Centro de documentos familiar y comparador de hasta 5 universidades',
      'Calculadora de coste neto, guía oficial y Academia SAT/TOEFL',
      'Gala IA para resolver dudas del proceso',
    ],
    cta: 'signup',
    delivery: 'automatic',
  },
  {
    code: 'family_core',
    audience: 'family',
    name: 'Core',
    price: '247 €',
    priceNote: 'pago único',
    pitch: 'Tu plan completo, generado al momento desde tu Passport y datos oficiales. Sin esperas ni citas.',
    includes: [
      'Informe del Passport con las mejoras ordenadas por impacto',
      'Sports CV en inglés listo para imprimir o guardar en PDF',
      'Shortlist automática de universidades reales con su coste oficial y el porqué de cada una',
      'Calendario de exámenes y documentos con fechas según tu promoción',
      'Se actualiza solo cada vez que mejoras tu Passport',
    ],
    cta: 'checkout',
    delivery: 'automatic',
    checkoutCents: 24700,
    highlight: true,
  },
  {
    code: 'family_elite',
    audience: 'family',
    name: 'Elite',
    price: '497 €',
    priceNote: 'pago único',
    pitch: 'Todo Core más las herramientas para decidir entre ofertas con cifras y riesgos claros.',
    includes: [
      'Todo lo de Core',
      'Comparador de hasta 5 ofertas con coste neto y sello de confianza',
      'Memo de decisión imprimible: opción más sólida, riesgos y preguntas pendientes',
      'Checklist de visado y llegada (I-20, SEVIS, DS-160) con fechas',
      'Acceso para toda la familia con los permisos que decida el atleta',
    ],
    cta: 'checkout',
    delivery: 'automatic',
    checkoutCents: 49700,
  },
  {
    code: 'family_signature',
    audience: 'family',
    name: 'Signature 1:1 con Gala',
    price: 'A medida',
    priceNote: 'plazas limitadas',
    pitch: 'Acompañamiento personal de la fundadora, de la estrategia a la firma.',
    includes: [
      'Todo lo de Elite',
      'Sesiones 1:1 de estrategia con Gala',
      'Revisión personal del vídeo, el CV y los mensajes a coaches',
      'Acompañamiento en la comparación y negociación de ofertas',
      'Canal directo durante todo el proceso',
    ],
    cta: 'request',
    delivery: 'personal',
  },
  {
    code: 'org_recruit',
    audience: 'organization',
    name: 'Recruit',
    price: 'Gratis en el piloto',
    priceNote: 'programa fundador',
    pitch: 'Talento internacional comparable y un pipeline de recruiting de principio a fin.',
    includes: [
      'Verificación automática con el correo de tu dominio oficial',
      'Escaparate con filtros, búsquedas guardadas y alertas de perfiles nuevos',
      'Publicación de becas: si pasan los controles automáticos, salen al momento',
      'Pipeline de candidaturas con historial y notas internas',
      'Contacto seguro (con circuito familiar para menores)',
    ],
    cta: 'signup',
    delivery: 'automatic',
    highlight: true,
  },
  {
    code: 'academy_portal',
    audience: 'academy',
    name: 'Portal de academia o club',
    price: 'Gratis en el piloto',
    priceNote: 'programa fundador',
    pitch: 'Tu roster gana visibilidad internacional y tú, control y reporting de colocaciones.',
    includes: [
      'Roster por temporada con enlace de invitación y consentimiento de cada atleta',
      'Validación de estadísticas por el club ("confirmado por el club")',
      'Seguimiento de candidaturas y colocaciones de quien lo comparte',
      'Programa de afiliados por cada familia que contrata Core o Elite (con los pagos activos)',
    ],
    cta: 'signup',
    delivery: 'automatic',
  },
  {
    code: 'agent_solo',
    audience: 'agent',
    name: 'Agente',
    price: '39 €/mes',
    priceNote: '390 €/año · gratis hasta el 31/03/2027',
    pitch: 'Para quien trabaja solo y lleva su cartera entre hojas de cálculo y WhatsApp.',
    includes: [
      '1 usuario y hasta 25 atletas con procesos abiertos',
      'Procesos por universidad: 13 fases, próxima acción, tareas e historial',
      'Contactos de programas privados, importables desde Excel',
      'Vista compartida con el atleta y exportación CSV',
      'Sin comisiones ni cobro por contactar',
    ],
    cta: 'signup',
    delivery: 'automatic',
  },
  {
    code: 'agent_team',
    audience: 'agent',
    name: 'Agencia',
    price: '99 €/mes',
    priceNote: '990 €/año · gratis hasta el 31/03/2027',
    pitch: 'Para equipos que se reparten atletas y universidades.',
    includes: [
      'Hasta 5 usuarios y 100 atletas con procesos abiertos',
      'Todo lo de Agente',
      'Roles del equipo (incluido solo lectura) y responsable por proceso',
      'Panel de procesos vencidos y parados',
      'Sin comisiones ni cobro por contactar',
    ],
    cta: 'signup',
    delivery: 'automatic',
    highlight: true,
  },
  {
    code: 'agent_scale',
    audience: 'agent',
    name: 'Agencia grande',
    price: 'Desde 249 €/mes',
    priceNote: 'más de 5 usuarios o 100 atletas',
    pitch: 'Para agencias con varias oficinas o deportes.',
    includes: [
      'Usuarios y atletas según volumen',
      'Todo lo de Agencia',
      'Ayuda para migrar vuestros datos actuales',
      'Sin comisiones ni cobro por contactar',
    ],
    cta: 'request',
    delivery: 'automatic',
  },
  {
    code: 'brand_campaigns',
    audience: 'brand',
    name: 'Campañas',
    price: 'Tras validación legal',
    pitch: 'Campañas con atletas mayores de edad, revisadas y con condiciones claras.',
    includes: [
      'Publicación de campañas revisadas',
      'Candidaturas de atletas que han leído la normativa de su universidad',
      'Pagos y comisiones solo cuando estén revisados contratos, fiscalidad e inmigración',
    ],
    cta: 'request',
    delivery: 'automatic',
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
