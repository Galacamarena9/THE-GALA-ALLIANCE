/**
 * Datos de ejemplo SOLO para el probador interno (/preview), que no existe en producción.
 * Son ficticios y nunca se escriben en la base de datos.
 */
import type { MyOrg } from '@/lib/data/orgs';
import type { CaseRow } from '@/lib/data/agency-cases';
import { portfolioStats, type AgencyNote, type PortfolioEntry } from '@/lib/domain/portfolio';

const now = Date.now();
const ago = (days: number) => new Date(now - days * 86_400_000).toISOString();
const inDays = (days: number) => new Date(now + days * 86_400_000).toISOString().slice(0, 10);

export const previewAgencies: MyOrg[] = [
  { id: 'org-1', name: 'Norte Sports Management', type: 'agency', verification_status: 'verified', division: null, member_role: 'admin' },
];

const base = { agencyId: 'org-1', agencyName: 'Norte Sports Management', agentId: 'agent-1', message: null, endedAt: null, avatarUrl: null, hasVideo: true, lastNoteAt: null } as const;

export const previewEntries: PortfolioEntry[] = [
  { ...base, repId: 'r1', athleteId: 'a1', status: 'active', createdAt: ago(60), respondedAt: ago(58), name: 'Marcos Jiménez', country: 'ES', sportId: 'basketball', sportName: 'Baloncesto', positionName: 'Base', graduationYear: 2027, currentTeam: 'Valencia U18', lastNoteAt: ago(1) },
  { ...base, repId: 'r2', athleteId: 'a2', status: 'active', createdAt: ago(45), respondedAt: ago(40), name: 'Sofía Martín', country: 'ES', sportId: 'volleyball', sportName: 'Voleibol', positionName: 'Receptora', graduationYear: 2026, currentTeam: 'CV Castellón' },
  { ...base, repId: 'r3', athleteId: 'a3', status: 'ended', createdAt: ago(31), respondedAt: ago(29), endedAt: ago(2), name: 'Daniel Kim', country: 'KR', sportId: 'football', sportName: 'Fútbol', positionName: 'Mediocentro', graduationYear: 2027, currentTeam: 'Levante Juvenil', hasVideo: false },
  { ...base, repId: 'r4', athleteId: 'a4', status: 'requested', createdAt: ago(2), respondedAt: null, name: 'Lucía Ferrer', country: 'ES', sportId: 'tennis', sportName: 'Tenis', positionName: null, graduationYear: 2027, currentTeam: null },
  { ...base, repId: 'r5', athleteId: 'a5', status: 'requested', createdAt: ago(6), respondedAt: null, name: 'Álex Romero', country: 'AR', sportId: 'athletics', sportName: 'Atletismo', positionName: '400 m', graduationYear: 2026, currentTeam: 'CA Buenos Aires' },
  { ...base, repId: 'r6', athleteId: 'a6', status: 'declined', createdAt: ago(20), respondedAt: ago(18), name: 'Nora Vidal', country: 'ES', sportId: 'swimming', sportName: 'Natación', positionName: 'Mariposa', graduationYear: 2026, currentTeam: null },
];

const note = (id: string, athlete: string, kind: AgencyNote['kind'], body: string, created: number, due: string | null = null, done = false): AgencyNote => ({
  id, agency_id: 'org-1', athlete_id: athlete, author_id: 'agent-1', kind, body, due_date: due, done, done_at: done ? ago(0) : null, created_at: ago(created), updated_at: ago(created),
});

export const previewNotes: AgencyNote[] = [
  note('n1', 'a1', 'follow_up', 'Enviar highlights al coach de Northfield University', 3, inDays(-1)),
  note('n2', 'a2', 'follow_up', 'Llamada con el asistente de Westbrook State', 1, inDays(0)),
  note('n3', 'a3', 'follow_up', 'Revisar traducción del expediente académico', 2, inDays(2)),
  note('n4', 'a1', 'note', 'Muy buen lanzamiento tras bloqueo; mejorar defensa en el uno contra uno.', 1),
];

export const previewPortfolio = {
  agencies: previewAgencies,
  entries: previewEntries,
  notes: previewNotes,
  stats: portfolioStats(previewEntries, previewNotes),
};

export const previewSports = [
  { id: 'basketball', name_es: 'Baloncesto' }, { id: 'football', name_es: 'Fútbol' }, { id: 'volleyball', name_es: 'Voleibol' },
  { id: 'tennis', name_es: 'Tenis' }, { id: 'athletics', name_es: 'Atletismo' }, { id: 'swimming', name_es: 'Natación' },
];

/** Procesos ficticios del probador (universidades inventadas: nunca se muestran en producción). */
const pc = (id: string, athleteId: string, athleteName: string, institutionName: string, sportId: string, stage: string, days: number,
  extra: Partial<CaseRow> = {}): CaseRow => ({
  id, agencyId: 'org-1', athleteId, athleteName, institutionName, sportId, cycle: '2027-28', stage, ownerId: 'u1', ownerName: 'Carlos Ruiz',
  contactId: null, nextAction: null, nextActionDue: null, sharedWithAthlete: false, outcomeReason: null, updatedAt: ago(days), createdAt: ago(days + 20), ...extra,
});
export const previewCases: CaseRow[] = [
  pc('c1', 'a1', 'Marcos Jiménez', 'Northfield University', 'basketball', 'contacted', 2, { nextAction: 'Enviar vídeo de la temporada', nextActionDue: inDays(3), sharedWithAthlete: true }),
  pc('c2', 'a1', 'Marcos Jiménez', 'Lakeshore College', 'basketball', 'active_conversation', 5, { nextAction: 'Llamada con el assistant coach', nextActionDue: inDays(-1) }),
  pc('c3', 'a2', 'Sofía Martín', 'Westbrook State', 'volleyball', 'evaluation_visit', 3, { ownerName: 'Ana Gil', sharedWithAthlete: true }),
  pc('c4', 'a3', 'Daniel Kim', 'Pinecrest University', 'football', 'research', 20),
  pc('c5', 'a2', 'Sofía Martín', 'Harbor Tech', 'volleyball', 'offer_discussion', 8, { nextAction: 'Revisar coste neto' }),
  pc('c6', 'a3', 'Daniel Kim', 'Ridgeview College', 'football', 'closed', 30, { outcomeReason: 'Plantilla completa en su posición' }),
];
