/**
 * Ficha 360 con datos FICTICIOS (solo /preview): la misma lógica real (currentJourney, documentChecklist,
 * activityProjection, a360Access) sobre la cartera de ejemplo.
 */
import type { Athlete360, Workspace } from '@/lib/data/athlete-360';
import { DOC_CHECKLIST } from '@/content/documents';
import { buildAttention, matchingOpportunities } from '@/lib/domain/agent-home';
import { stageLabel } from '@/lib/domain/agency-cases';
import { verificationText } from '@/lib/domain/athletes-crm';
import { classifyOfficialLink, officialSearchLinks } from '@/lib/domain/official-sources';
import { a360Access, activityProjection, currentJourney, documentChecklist, evidenceSignals, keyCompleteness } from '@/lib/domain/athlete-360';
import { previewAgentHomeInput } from './agent-home';
import { previewCases, previewPortfolio } from './fixtures';

const now = Date.now();
const ago = (d: number) => new Date(now - d * 864e5).toISOString();

export type Preview360 = 'full' | 'empty' | 'viewer' | 'no-permissions';

export function previewAthlete360(variant: Preview360 = 'full'): Athlete360 {
  const athleteId = variant === 'empty' ? 'a4' : 'a1';
  const base = previewPortfolio.entries.find((e) => e.athleteId === 'a1')!;
  const current = variant === 'empty'
    ? { ...base, repId: 'r4', athleteId: 'a4', name: 'Nora Costa', sportId: 'tennis', sportName: 'Tenis', positionName: null, country: 'PT', graduationYear: 2028, currentTeam: null, lastNoteAt: null }
    : base;
  const permissions = variant === 'no-permissions' ? ['passport.view', 'pipeline.view'] : ['passport.view', 'pipeline.view', 'pipeline.manage', 'offers.view', 'documents.view', 'documents.request_share', 'messages.participate'];
  const agencyRole = variant === 'viewer' ? 'viewer' : 'recruiter';
  const repRole = variant === 'viewer' ? null : 'primary';
  const access = a360Access({ repStatus: current.status, permissions, agencyRole, repRole });

  const allNotes = variant === 'empty' ? [] : [
    { id: 'n1', agency_id: current.agencyId, athlete_id: athleteId, author_id: 'me', kind: 'note' as const, body: 'Prefiere costa este de EE. UU.; la familia pide información de becas académicas.', due_date: null, done: false, done_at: null, created_at: ago(1), updated_at: ago(1) },
    { id: 'n2', agency_id: current.agencyId, athlete_id: athleteId, author_id: 'u-ana', kind: 'follow_up' as const, body: 'Confirmar fechas de la visita', due_date: new Date(now + 5 * 864e5).toISOString().slice(0, 10), done: false, done_at: null, created_at: ago(3), updated_at: ago(3) },
  ];
  const notes = access.noteBodies ? allNotes : allNotes.map((n) => ({ ...n, body: '' }));
  const ws: Workspace = {
    scope: { type: 'exclusive', startDate: ago(58).slice(0, 10), endDate: new Date(now + 300 * 864e5).toISOString().slice(0, 10), dbStatus: 'active', sports: [], territories: ['NORTH_AMERICA'], categories: ['university'], permissions, daysLeft: 300, myRole: repRole },
    roster: previewPortfolio.entries.filter((e) => e.status === 'active').map((e) => ({ athleteId: e.athleteId, name: e.name })),
    current, history: [current], notes,
    authorName: new Map([['u-ana', 'Ana Gil']]),
    detail: variant === 'empty'
      ? { headline: null, bio: null, heightCm: null, dominantSide: null, city: null, competitiveLevel: null, targetDivisions: [], intendedMajor: null, videoUrl: null, gpa: null, gpaScale: null, englishTest: null, englishScore: null, sat: null, schoolYear: null }
      : { headline: 'Base zurdo con visión de juego', bio: null, heightCm: 188, dominantSide: 'left', city: 'Valencia', competitiveLevel: 'Liga EBA', targetDivisions: ['ncaa_d1', 'ncaa_d2'], intendedMajor: 'Business', videoUrl: null, gpa: 3.4, gpaScale: 4, englishTest: 'toefl', englishScore: '92', sat: null, schoolYear: 'bach_2' },
    agencies: [],
  } as unknown as Workspace;

  const input = previewAgentHomeInput();
  const attention = variant === 'empty' ? [] : buildAttention(input);
  const cases = variant === 'empty' ? [] : previewCases.filter((c) => c.athleteId === athleteId);
  const journey = currentJourney({ athleteId, repStatus: current.status, attention, cases: variant === 'empty' ? [] : input.cases, tasks: input.tasks, offers: variant === 'empty' ? [] : input.offers });
  const docs = variant === 'empty' ? [] : [{ id: 'd1', kind: 'transcript', title: 'Certificado de notas 1.º Bachillerato', uploadedAt: ago(10) }, { id: 'd2', kind: 'passport', title: 'Pasaporte', uploadedAt: ago(30) }];
  const requests = variant === 'empty' ? [] : [{ kind: 'english_certificate', status: 'pending', documentKind: null, createdAt: ago(2) }];
  const acts = variant === 'empty' ? [] : [
    { id: 'x1', caseId: 'c1', kind: 'stage_change', fromStage: 'contacted', toStage: 'response_received', body: null, at: ago(1), actorId: null },
    { id: 'x2', caseId: 'c2', kind: 'call', fromStage: null, toStage: null, body: 'El assistant coach quiere ver un partido completo.', at: ago(4), actorId: 'u-ana' },
  ];
  const nameOf = (id: string | null) => (!id ? null : id === 'me' ? 'Tú' : ws.authorName.get(id) ?? null);
  const me = input.athletes.find((a) => a.id === athleteId);

  return {
    ws, access, agencyRole, journey,
    verification: verificationText(variant === 'empty' ? null : { verifiedStats: true, video: true }),
    completeness: keyCompleteness({
      'Deporte y posición': Boolean(current.sportName && current.positionName), 'Promoción': current.graduationYear != null, 'Equipo actual': Boolean(current.currentTeam),
      'Altura': ws.detail.heightCm != null, 'Nota media': ws.detail.gpa != null, 'Inglés': Boolean(ws.detail.englishTest), 'Vídeo': variant !== 'empty', 'Estadísticas validadas': variant !== 'empty',
    }),
    cases,
    offers: !access.offers ? null : variant === 'empty' ? [] : [
      { key: 'ext:o1', id: 'o1', source: 'external', title: 'Lakeshore College', orgName: 'Lakeshore College', costUsd: 52000, aidUsd: 18000, netUsd: 34000, deadline: new Date(now + 2 * 864e5).toISOString().slice(0, 10), status: null, trust: null, flags: [{ code: 'external', severity: 'medium', text: 'Recibida fuera de la plataforma: comprueba que el email llega de un dominio .edu de la universidad.' }], missing: [], renewable: 'unknown' },
    ],
    opportunities: me && variant !== 'empty' ? matchingOpportunities(input.opportunities, [me], new Date().toISOString().slice(0, 10)).map((x) => x.o) : [],
    documents: documentChecklist(DOC_CHECKLIST, docs, requests, access.documents),
    evidence: evidenceSignals({ verifiedStats: variant === 'empty' ? null : true, video: variant === 'empty' ? null : true, gradeSource: 'documented', englishSource: 'self_reported', academicsVisible: variant !== 'empty' }),
    activity: activityProjection({ entries: [current], notes, caseActivities: acts, cases: cases.map((c) => ({ id: c.id, institution: c.institutionName })), stageLabel, noteBodies: access.noteBodies, nameOf }),
    conversation: variant === 'empty' ? null : { id: 'cr1', status: 'accepted' },
    links: variant === 'empty' ? [] : [
      { id: 'l1', kind: 'federation_stats', url: 'https://www.feb.es/jugador/ejemplo', verified: true },
      { id: 'l2', kind: 'ranking', url: 'https://www.fiba.basketball/en/players/000000-ejemplo', verified: false },
      { id: 'l3', kind: 'highlight_video', url: 'https://video.ejemplo.test/partido', verified: false },
    ].map((l) => ({ ...l, official: classifyOfficialLink(l.url) })),
    officialSearch: officialSearchLinks({ name: current.name, country: current.country }),
    partial: [],
  };
}
