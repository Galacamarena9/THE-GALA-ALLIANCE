/** Siguiente mejor acción de la familia. Pura y determinista: el orden refleja seguridad → plazos → decisiones. */
export type ApprovalKind = 'contact' | 'document' | 'participation';
export interface FamilyApproval { kind: ApprovalKind; athleteName: string; what: string; href: string }
export interface FamilyDeadline { date: string; label: string; athleteName: string; kind: 'official' | 'personal' | 'recommended'; href: string }
export interface FamilyOffer { athleteName: string; org: string; deadline: string | null; href: string }

export interface FamilyInput {
  today: string; // YYYY-MM-DD
  approvals: FamilyApproval[];
  deadlines: FamilyDeadline[];
  offers: FamilyOffer[];
  incompleteCosts: number;
  missingDocuments: number;
  hasAthlete: boolean;
}

export interface FamilyAction { title: string; why: string; href: string; urgent: boolean }

const APPROVAL_ORDER: ApprovalKind[] = ['contact', 'document', 'participation'];
const APPROVAL_TITLE: Record<ApprovalKind, string> = {
  contact: 'Revisa una solicitud de contacto',
  document: 'Revisa una solicitud de documentos',
  participation: 'Revisa una inscripción que necesita tu aprobación',
};

export const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

export function familyNextAction(i: FamilyInput): FamilyAction {
  if (!i.hasAthlete) {
    return { title: 'Vincula a tu hijo o hija', why: 'Cuando acepte la invitación con su propia cuenta, verás aquí su proceso.', href: '/app/family#vincular', urgent: false };
  }
  const approval = [...i.approvals].sort((a, b) => APPROVAL_ORDER.indexOf(a.kind) - APPROVAL_ORDER.indexOf(b.kind))[0];
  if (approval) {
    return { title: APPROVAL_TITLE[approval.kind], why: `${approval.athleteName} · ${approval.what}. Nada se comparte ni se confirma sin tu decisión.`, href: approval.href, urgent: true };
  }
  const soonOffer = i.offers.filter((o) => o.deadline && daysBetween(i.today, o.deadline) >= 0 && daysBetween(i.today, o.deadline) <= 7)
    .sort((a, b) => a.deadline!.localeCompare(b.deadline!))[0];
  if (soonOffer) {
    const d = daysBetween(i.today, soonOffer.deadline!);
    return { title: `Decidid sobre la oferta de ${soonOffer.org}`, why: `${soonOffer.athleteName} · vence ${d === 0 ? 'hoy' : d === 1 ? 'mañana' : `en ${d} días`}. La decisión es vuestra.`, href: soonOffer.href, urgent: true };
  }
  const soon = i.deadlines.filter((d) => daysBetween(i.today, d.date) >= 0 && daysBetween(i.today, d.date) <= 7)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.kind === 'official' ? -1 : 1))[0];
  if (soon) {
    const d = daysBetween(i.today, soon.date);
    return { title: soon.label, why: `${soon.athleteName} · ${soon.kind === 'official' ? 'plazo oficial' : soon.kind === 'personal' ? 'fecha vuestra' : 'fecha recomendada'} ${d === 0 ? 'hoy' : d === 1 ? 'mañana' : `en ${d} días`}.`, href: soon.href, urgent: soon.kind === 'official' };
  }
  if (i.offers.length && i.incompleteCosts) {
    return { title: 'Completad el coste real de las ofertas', why: `${i.incompleteCosts} opción(es) con datos de coste incompletos. Mejor saber qué falta que comparar cifras a medias.`, href: '/app/family/costs', urgent: false };
  }
  if (i.missingDocuments) {
    return { title: 'Faltan documentos por subir', why: `${i.missingDocuments} documento(s) del checklist sin archivo.`, href: '/app/documents', urgent: false };
  }
  return { title: 'Estáis al día', why: 'No hay nada pendiente de la familia esta semana.', href: '/app/family/costs', urgent: false };
}

/**
 * GUARDIAN ACCESS REVIEW al cumplir 18 (espejo de family_link_lapsed en la base de datos, que es quien decide).
 * none = no aplica · due = el atleta debe confirmar antes de `dueDate` · lapsed = acceso suspendido hasta que confirme.
 */
export function guardianReview(i: { dob: string | null; today: string; minorLink: boolean; lastReviewed: string | null; windowDays?: number }):
  { state: 'none' | 'due' | 'lapsed'; dueDate: string | null } {
  if (!i.dob || !i.minorLink) return { state: 'none', dueDate: null };
  const [y, m, d] = i.dob.split('-').map(Number);
  const adult = new Date(Date.UTC(y + 18, m - 1, d)).toISOString().slice(0, 10);
  if (i.today < adult) return { state: 'none', dueDate: null };
  if (i.lastReviewed && i.lastReviewed.slice(0, 10) >= adult) return { state: 'none', dueDate: null };
  const due = new Date(Date.parse(`${adult}T00:00:00Z`) + (i.windowDays ?? 30) * 86_400_000).toISOString().slice(0, 10);
  return { state: i.today > due ? 'lapsed' : 'due', dueDate: due };
}
