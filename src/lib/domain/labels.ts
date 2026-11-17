import type { ApplicationStatus, Division, OpportunityStatus, OpportunityType, OrgType, VerificationStatus, Visibility } from '@/lib/types';

export const DIVISION_LABEL: Record<Division, string> = {
  ncaa_d1: 'NCAA D1',
  ncaa_d2: 'NCAA D2',
  ncaa_d3: 'NCAA D3',
  naia: 'NAIA',
  njcaa: 'NJCAA (JUCO)',
};

export const VISIBILITY_LABEL: Record<Visibility, string> = {
  public: 'Pública',
  members: 'Solo usuarios de Gala',
  verified_orgs: 'Solo organizaciones verificadas',
  connections: 'Solo organizaciones con las que conectes',
  private: 'Privada',
};

export const OPPORTUNITY_TYPE_LABEL: Record<OpportunityType, string> = {
  athletic_scholarship: 'Beca deportiva',
  university_recruitment: 'Recruiting universitario',
  club_recruitment: 'Fichaje de club',
  academy: 'Academia',
  tryout: 'Prueba',
  camp_showcase: 'Campus / Showcase',
};

export const OPPORTUNITY_STATUS_LABEL: Record<OpportunityStatus, string> = {
  draft: 'Borrador',
  pending_review: 'En revisión',
  published: 'Publicada',
  rejected: 'Rechazada',
  expired: 'Caducada',
  closed: 'Cerrada',
  filled: 'Plaza cubierta',
};

export const ORG_TYPE_LABEL: Record<OrgType, string> = {
  university: 'Universidad',
  college: 'College',
  club: 'Club',
  academy: 'Academia',
  agency: 'Agencia',
  brand: 'Marca',
};

export const VERIFICATION_LABEL: Record<VerificationStatus, string> = {
  unverified: 'Sin verificar',
  submitted: 'Verificación solicitada',
  verified: 'Verificada',
  rejected: 'Verificación rechazada',
};

/** Lo que ve el atleta: una línea temporal amable, sin el detalle interno del pipeline. */
export const ATHLETE_STATUS_LABEL: Record<ApplicationStatus, string> = {
  applied: 'Enviada',
  reviewed: 'Vista por el equipo',
  contacted: 'Te han contactado',
  information_requested: 'Te piden más información',
  interview: 'Entrevista',
  tryout: 'Prueba',
  shortlist: 'En evaluación',
  offer: 'Oferta',
  accepted: 'Aceptada',
  declined: 'No seleccionada',
  withdrawn: 'Retirada',
};

export const PIPELINE_STATUS_LABEL: Record<ApplicationStatus, string> = {
  applied: 'Nueva',
  reviewed: 'Revisada',
  contacted: 'Contactada',
  information_requested: 'Info solicitada',
  interview: 'Entrevista',
  tryout: 'Prueba',
  shortlist: 'Preselección',
  offer: 'Oferta',
  accepted: 'Aceptada',
  declined: 'Descartada',
  withdrawn: 'Retirada por el atleta',
};

export const PIPELINE_STATUSES: ApplicationStatus[] = [
  'applied', 'reviewed', 'contacted', 'information_requested', 'interview', 'tryout', 'shortlist', 'offer', 'accepted', 'declined',
];

export const usd = (n: number | null | undefined) =>
  n == null ? 'Sin dato' : new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

export const LINK_KIND_LABEL: Record<string, string> = {
  club_profile: 'Ficha en la web del club',
  federation_stats: 'Estadísticas de la federación',
  ranking: 'Ranking oficial (UTR, RFEA…)',
  highlight_video: 'Vídeo (partido completo, highlights)',
  school: 'Centro educativo',
  social: 'Red social deportiva',
};

export const CAMPAIGN_KIND_LABEL: Record<string, string> = {
  ambassador: 'Embajador/a',
  social_content: 'Contenido en redes',
  event: 'Evento',
  product_testing: 'Prueba de producto',
  sponsorship: 'Patrocinio',
};

export const COMPENSATION_LABEL: Record<string, string> = {
  product: 'Producto',
  fixed_fee: 'Pago fijo',
  mixed: 'Producto + pago',
};

export const NEWS_KIND_LABEL: Record<string, string> = {
  announcement: 'Comunicado',
  signing: 'Fichaje',
  rule_update: 'Normativa',
  event: 'Evento',
  story: 'Historia',
};

/** Muestra el dominio de un enlace para que el usuario vea a dónde va antes de pulsar. */
export function domainOf(url: string | null | undefined) {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/** Días hasta una fecha (YYYY-MM-DD) al final de ese día; negativo si ya pasó. */
export function daysUntil(date: string, now: number = Date.now()) {
  return Math.ceil((new Date(`${date}T23:59:59`).getTime() - now) / 86_400_000);
}

/** Días transcurridos desde una marca de tiempo ISO. */
export function daysSince(iso: string, now: number = Date.now()) {
  return Math.floor((now - new Date(iso).getTime()) / 86_400_000);
}

/** Semilla que cambia cada minuto (para barajar preguntas de forma estable en servidor y cliente). */
export function minuteSeed(now: number = Date.now()) {
  return Math.floor(now / 60_000);
}
