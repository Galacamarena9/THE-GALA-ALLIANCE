/**
 * Funciones de pago de atletas y familias, visibles aunque estén bloqueadas: el usuario ve qué gana
 * con cada plan. La visibilidad del atleta nunca se paga (ver content/plans.ts): esto son herramientas.
 */
export type PaidPlan = 'family_core' | 'family_elite';
export type AnyFamilyPlan = 'free' | PaidPlan | 'family_signature';

export interface PremiumFeature { key: string; plan: PaidPlan; title: string; text: string; href: string; preview: string[] }

const RANK: Record<AnyFamilyPlan, number> = { free: 0, family_core: 1, family_elite: 2, family_signature: 3 };

export const PREMIUM_FEATURES: PremiumFeature[] = [
  { key: 'report', plan: 'family_core', title: 'Informe del Passport', text: 'Todas tus mejoras ordenadas por el impacto que tienen en cómo te ve un coach.', href: '/app/plan', preview: ['Sube un vídeo de partido completo', 'Añade tu nota de inglés', 'Completa 3 estadísticas clave'] },
  { key: 'cv', plan: 'family_core', title: 'CV deportivo en inglés', text: 'Listo para imprimir o enviar en PDF a cualquier coach.', href: '/app/plan', preview: ['Athletic profile', 'Academic record', 'Highlights & references'] },
  { key: 'shortlist', plan: 'family_core', title: 'Lista automática de universidades', text: 'Universidades reales que encajan contigo, con su coste oficial y el porqué.', href: '/app/plan', preview: ['Encaje deportivo alto', 'Coste neto dentro de tu presupuesto', 'Tu nivel académico encaja'] },
  { key: 'calendar', plan: 'family_core', title: 'Calendario por promoción', text: 'Exámenes, documentos y ventanas NCAA con fechas según tu curso.', href: '/app/plan', preview: ['SAT / TOEFL', 'Registro en NCAA Eligibility', 'Ventana de contacto D-I'] },
  { key: 'offers', plan: 'family_elite', title: 'Comparador de ofertas', text: 'Hasta 5 ofertas lado a lado con coste neto real y sello de confianza.', href: '/app/offers', preview: ['Coste neto a 4 años', 'Riesgos de cada oferta', 'Sello de confianza'] },
  { key: 'memo', plan: 'family_elite', title: 'Memo de decisión', text: 'La opción más sólida, sus riesgos y las preguntas que aún debes hacer.', href: '/app/offers', preview: ['Opción recomendada', 'Riesgos', 'Preguntas pendientes'] },
  { key: 'visa', plan: 'family_elite', title: 'Visado y llegada', text: 'Checklist de I-20, SEVIS y DS-160 con fechas, para no perder ningún plazo.', href: '/app/documents', preview: ['I-20 de la universidad', 'Pago SEVIS', 'Cita DS-160'] },
  { key: 'family', plan: 'family_elite', title: 'Acceso para toda la familia', text: 'Cada familiar con los permisos que decide el atleta.', href: '/app/family', preview: ['Ver progreso', 'Aprobar contactos', 'Documentos compartidos'] },
];

export const featureState = (plan: AnyFamilyPlan, f: PremiumFeature) => (RANK[plan] >= RANK[f.plan] ? 'unlocked' : 'locked');

export function unlockSummary(plan: AnyFamilyPlan) {
  const unlocked = PREMIUM_FEATURES.filter((f) => featureState(plan, f) === 'unlocked').length;
  const next: PaidPlan | null = RANK[plan] < RANK.family_core ? 'family_core' : RANK[plan] < RANK.family_elite ? 'family_elite' : null;
  return { unlocked, total: PREMIUM_FEATURES.length, next };
}
