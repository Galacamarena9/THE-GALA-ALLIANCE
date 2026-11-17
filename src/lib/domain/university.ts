/**
 * Fase 03 · capa de presentación de universidades y oportunidades (pura, sin datos).
 * Universidad ≠ oportunidad: una universidad del directorio no implica beca ni recruiting activo.
 */

export type OpportunityState = 'active' | 'closing_soon' | 'closed' | 'filled' | 'expired' | 'draft' | 'in_review';
export const OPPORTUNITY_STATE_LABEL: Record<OpportunityState, string> = {
  active: 'Activa', closing_soon: 'Cierra pronto', closed: 'Cerrada', filled: 'Plaza cubierta', expired: 'Expirada', draft: 'Borrador', in_review: 'En revisión',
};

/** Estado visible de una oportunidad, calculado con su estado real y su plazo (nunca "activa" para siempre). */
export function opportunityState(o: { status: string; deadline: string | null }, now = new Date()): OpportunityState {
  if (o.status === 'draft' || o.status === 'rejected') return 'draft';
  if (o.status === 'pending_review') return 'in_review';
  if (o.status === 'closed') return 'closed';
  if (o.status === 'filled') return 'filled';
  if (o.status === 'expired') return 'expired';
  if (o.deadline) {
    const end = new Date(`${o.deadline}T23:59:59`);
    if (end < now) return 'expired';
    if ((end.getTime() - now.getTime()) / 86400000 <= 14) return 'closing_soon';
  }
  return 'active';
}

export type OpportunitySource = 'verified_university_posting' | 'verified_organization' | 'official_external' | 'unconfirmed';
export const OPPORTUNITY_SOURCE_LABEL: Record<OpportunitySource, { label: string; text: string }> = {
  verified_university_posting: { label: 'Publicada por la universidad verificada', text: 'La ha publicado directamente una universidad con cuenta verificada en Gala.' },
  verified_organization: { label: 'Publicada por una organización verificada', text: 'La ha publicado una organización verificada (club, academia o evento).' },
  official_external: { label: 'Fuente oficial externa', text: 'Información obtenida de una fuente oficial; no la ha publicado el cuerpo técnico en Gala.' },
  unconfirmed: { label: 'Sin confirmar', text: 'No está confirmada por la organización.' },
};
export function opportunitySource(org: { verification_status: string; type?: string | null } | null): OpportunitySource {
  if (!org || org.verification_status !== 'verified') return 'unconfirmed';
  return org.type === 'university' || org.type === 'college' ? 'verified_university_posting' : 'verified_organization';
}

export const OWNERSHIP_LABEL = { public: 'Pública', private_nonprofit: 'Privada sin ánimo de lucro', private_forprofit: 'Privada con ánimo de lucro' } as const;
export const LOCALE_LABEL = { city: 'Urbano', suburb: 'Periferia', town: 'Ciudad pequeña', rural: 'Rural' } as const;
export const GENDER_LABEL = { men: 'Masculino', women: 'Femenino', coed: 'Mixto / sin especificar' } as const;
export const ASSOCIATION_LABEL = { ncaa: 'NCAA', naia: 'NAIA', njcaa: 'NJCAA', other: 'Otra' } as const;
export const PROGRAM_SOURCE_LABEL = { manual_admin: 'Revisado por Gala', organization: 'Aportado por la universidad', official_external: 'Fuente oficial externa' } as const;

/** Familias de estudios (CIP de 2 dígitos) más habituales, para explorar programas sin mostrar códigos. */
export const CIP_FAMILY: Record<string, string> = {
  '01': 'Agricultura', '03': 'Recursos naturales', '04': 'Arquitectura', '05': 'Estudios culturales', '09': 'Comunicación y periodismo',
  '10': 'Tecnologías de la comunicación', '11': 'Informática', '13': 'Educación', '14': 'Ingeniería', '15': 'Tecnología de ingeniería',
  '16': 'Idiomas y lingüística', '19': 'Ciencias de la familia', '22': 'Estudios legales', '23': 'Lengua y literatura inglesa', '24': 'Humanidades generales',
  '26': 'Biología', '27': 'Matemáticas y estadística', '30': 'Estudios interdisciplinares', '31': 'Deporte, ocio y actividad física', '38': 'Filosofía y religión',
  '40': 'Ciencias físicas', '42': 'Psicología', '43': 'Seguridad y justicia', '44': 'Administración pública', '45': 'Ciencias sociales',
  '50': 'Artes visuales y escénicas', '51': 'Ciencias de la salud', '52': 'Empresa, gestión y marketing', '54': 'Historia',
};
export function programFamilies(cips: string[]) {
  const count = new Map<string, number>();
  for (const c of cips) count.set(c.slice(0, 2), (count.get(c.slice(0, 2)) ?? 0) + 1);
  return [...count.entries()].filter(([f]) => CIP_FAMILY[f]).map(([f, n]) => ({ family: f, label: CIP_FAMILY[f], programs: n })).sort((a, b) => b.programs - a.programs);
}

/**
 * Recorrido orientativo del recruiting por etapas. No incluye fechas regulatorias:
 * dependen de la asociación, la división y el deporte, y solo se muestran con una fuente fiable.
 */
export const RECRUITING_JOURNEY = [
  { key: 'passport', label: 'Completa tu Passport', text: 'Vídeo, estadísticas, notas e inglés.' },
  { key: 'shortlist', label: 'Construye tu shortlist', text: 'Guarda universidades que encajen y compáralas.' },
  { key: 'documents', label: 'Prepara la documentación académica', text: 'Expediente, certificado de inglés y, si aplica, SAT/ACT.' },
  { key: 'contact', label: 'Contacto y candidaturas', text: 'Candidaturas a oportunidades y contacto con organizaciones verificadas.' },
  { key: 'offers', label: 'Ofertas', text: 'Compara coste y ayudas por escrito.' },
  { key: 'decision', label: 'Decisión', text: 'Elige con toda la información delante.' },
] as const;
