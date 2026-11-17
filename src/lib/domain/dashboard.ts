/**
 * ATHLETE COMMAND CENTER · inteligencia del dashboard (pura y determinista).
 * Decide qué ve primero el atleta con reglas explicables. Sin urgencia artificial: un plazo solo es urgente
 * si existe y está cerca; las fechas oficiales nunca se mezclan con las recomendadas por Gala.
 */
import type { Readiness } from './readiness.ts';

export type Stage = 'early' | 'discovery' | 'active' | 'decision';
export const STAGE_LABEL: Record<Stage, { label: string; focus: string }> = {
  early: { label: 'Preparación', focus: 'Construye tu Passport y entiende el proceso.' },
  discovery: { label: 'Descubrimiento', focus: 'Encuentra universidades que encajan y crea tu shortlist.' },
  active: { label: 'Recruiting activo', focus: 'Candidaturas, plazos y conversaciones.' },
  decision: { label: 'Decisión', focus: 'Compara ofertas, costes y toma tu decisión.' },
};

export interface DashboardInput {
  readiness: Pick<Readiness, 'score' | 'plan' | 'items'>;
  /** Universidades con encaje ≥ 70 % que aún no has visto, guardado ni ocultado. */
  unseenMatches: number;
  savedUniversities: number;
  savedOpportunities: number;
  applications: { status: string; deadline: string | null; title: string; id: string }[];
  offers: { id: string; university_name: string; deadline: string | null; in_writing: boolean }[];
  /** Oportunidades guardadas o activas con plazo oficial. */
  officialDeadlines: { id: string; title: string; date: string; href: string }[];
  /** Oportunidades activas con encaje alto (≥ 80 %) que el atleta no ha guardado. */
  highMatchOpportunities: number;
  isMinor: boolean;
  /** Objetivos: si no busca universidad en EE. UU., el panel cambia de foco. */
  seeksUSCollege: boolean;
  now?: Date;
}

export type Priority = 'urgent' | 'important' | 'recommended';
export const PRIORITY_LABEL: Record<Priority, string> = { urgent: 'Urgente', important: 'Importante', recommended: 'Recomendado' };

export interface ActionItem {
  key: string;
  title: string;
  reason: string;
  href: string;
  cta: string;
  priority: Priority;
  /** Peso para ordenar (mayor primero dentro de la misma prioridad). */
  weight: number;
  group: 'passport' | 'recruiting';
  done?: boolean;
}

const DAY = 86400000;
export function daysUntil(date: string, now = new Date()) {
  const end = new Date(`${date}T23:59:59`);
  return Math.ceil((end.getTime() - now.getTime()) / DAY);
}

export function stageOf(i: Pick<DashboardInput, 'readiness' | 'offers' | 'applications' | 'savedUniversities' | 'savedOpportunities'>): Stage {
  if (i.offers.length > 0) return 'decision';
  if (i.applications.some((a) => !['declined', 'withdrawn'].includes(a.status))) return 'active';
  if (i.readiness.score >= 50 || i.savedUniversities + i.savedOpportunities > 0) return 'discovery';
  return 'early';
}

/** Lista priorizada de acciones (la primera es el NEXT BEST ACTION). */
export function prioritize(i: DashboardInput): ActionItem[] {
  const now = i.now ?? new Date();
  const out: ActionItem[] = [];

  // 1. Plazos oficiales cercanos (≤ 3 días urgente, ≤ 14 importante).
  for (const d of i.officialDeadlines) {
    const n = daysUntil(d.date, now);
    if (n < 0 || n > 14) continue;
    out.push({
      key: `deadline:${d.id}`, group: 'recruiting', href: d.href, cta: 'Revisar',
      title: `${d.title}: cierra ${n === 0 ? 'hoy' : n === 1 ? 'mañana' : `en ${n} días`}`,
      reason: 'Plazo oficial publicado por la organización.',
      priority: n <= 3 ? 'urgent' : 'important', weight: 100 - n,
    });
  }
  // 2. Ofertas con fecha límite.
  for (const o of i.offers) {
    if (!o.deadline) continue;
    const n = daysUntil(o.deadline, now);
    if (n < 0 || n > 21) continue;
    out.push({
      key: `offer:${o.id}`, group: 'recruiting', href: '/app/offers', cta: 'Revisar oferta',
      title: `Oferta de ${o.university_name}: responde ${n <= 1 ? 'ya' : `en ${n} días`}`,
      reason: o.in_writing ? 'Tienes la oferta por escrito.' : 'Pide la oferta por escrito antes de decidir.',
      priority: n <= 3 ? 'urgent' : 'important', weight: 95 - n,
    });
  }
  // 3. Candidaturas con información solicitada (evento real de la organización).
  for (const a of i.applications.filter((x) => x.status === 'information_requested')) {
    out.push({ key: `app:${a.id}`, group: 'recruiting', href: '/app/applications', cta: 'Responder', title: `${a.title}: te piden información`, reason: 'La organización ha solicitado información adicional.', priority: 'urgent', weight: 90 });
  }
  // 4. Passport muy incompleto.
  if (i.readiness.score < 60 && i.readiness.plan[0]) {
    const p = i.readiness.plan[0];
    out.push({ key: `passport:${p.key}`, group: 'passport', href: p.href, cta: 'Completar', title: p.action, reason: `Tu Recruiting Readiness es ${i.readiness.score}/100. Es la acción que más suma (+${p.points}).`, priority: 'important', weight: 70 + p.points });
  }
  // 5. Oportunidad activa con encaje alto.
  if (i.seeksUSCollege && i.highMatchOpportunities > 0) {
    out.push({ key: 'opps:high', group: 'recruiting', href: '/app/match?tab=oportunidades', cta: 'Ver oportunidades', title: `${i.highMatchOpportunities} oportunidad${i.highMatchOpportunities > 1 ? 'es' : ''} activa${i.highMatchOpportunities > 1 ? 's' : ''} con encaje alto`, reason: 'Publicadas por organizaciones verificadas y con encaje ≥ 80 % con tu Passport.', priority: 'important', weight: 65 });
  }
  // 6. Matches sin revisar.
  if (i.seeksUSCollege && i.unseenMatches > 0) {
    out.push({ key: 'matches:new', group: 'recruiting', href: '/app/match', cta: 'Ver matches', title: `Revisa ${i.unseenMatches} match${i.unseenMatches > 1 ? 'es' : ''} sin ver`, reason: 'Universidades con encaje ≥ 70 % que todavía no has abierto.', priority: 'recommended', weight: 50 });
  }
  // 7. Comparar cuando ya hay varias guardadas.
  if (i.savedUniversities >= 2) {
    out.push({ key: 'compare', group: 'recruiting', href: '/app/shortlist', cta: 'Comparar', title: 'Compara tu shortlist', reason: `Tienes ${i.savedUniversities} universidades guardadas.`, priority: 'recommended', weight: 40 });
  }
  // 8. Resto del Passport (las tres acciones de más impacto).
  for (const p of i.readiness.plan) {
    if (out.some((x) => x.key === `passport:${p.key}`)) continue;
    out.push({ key: `passport:${p.key}`, group: 'passport', href: p.href, cta: 'Completar', title: p.action, reason: `+${p.points} en tu Recruiting Readiness.`, priority: p.points >= 6 ? 'important' : 'recommended', weight: 30 + p.points });
  }
  // 9. Menores: familia vinculada.
  const fam = i.readiness.items.find((x) => x.key === 'family');
  if (i.isMinor && fam && !fam.done && !out.some((x) => x.key === 'passport:family')) {
    out.push({ key: 'passport:family', group: 'passport', href: fam.href, cta: 'Vincular', title: fam.action, reason: 'Con menores, la familia aprueba cada contacto.', priority: 'important', weight: 60 });
  }

  const rank: Record<Priority, number> = { urgent: 0, important: 1, recommended: 2 };
  return out.sort((a, b) => rank[a.priority] - rank[b.priority] || b.weight - a.weight);
}

/** Recorrido real del atleta según sus datos (no una plantilla estática). */
export function journey(i: Pick<DashboardInput, 'readiness' | 'savedUniversities' | 'savedOpportunities' | 'applications' | 'offers'>) {
  const applied = i.applications.length > 0;
  const conversations = i.applications.some((a) => ['contacted', 'information_requested', 'interview', 'tryout', 'shortlist', 'offer'].includes(a.status));
  const decided = i.applications.some((a) => a.status === 'accepted');
  const steps = [
    { key: 'passport', label: 'Passport', done: i.readiness.score >= 60 },
    { key: 'discover', label: 'Descubrir', done: i.savedUniversities + i.savedOpportunities > 0 || applied },
    { key: 'shortlist', label: 'Shortlist', done: i.savedUniversities >= 3 || applied },
    { key: 'applications', label: 'Candidaturas', done: applied },
    { key: 'conversations', label: 'Conversaciones', done: conversations || i.offers.length > 0 },
    { key: 'offers', label: 'Ofertas', done: i.offers.length > 0 },
    { key: 'decision', label: 'Decisión', done: decided },
  ];
  const current = steps.findIndex((s) => !s.done);
  return steps.map((s, idx) => ({ ...s, current: idx === current }));
}
