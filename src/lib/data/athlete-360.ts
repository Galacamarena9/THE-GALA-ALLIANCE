import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { loadAthleteWorkspace } from '@/lib/data/portfolio';
import { loadAgencyCases, type CaseRow } from '@/lib/data/agency-cases';
import { loadAgentSources } from '@/lib/data/agent-home';
import { loadOffers, type OfferView } from '@/lib/data/offers';
import { DOC_CHECKLIST } from '@/content/documents';
import { buildAttention, matchingOpportunities, type HomeOpportunity } from '@/lib/domain/agent-home';
import { stageLabel } from '@/lib/domain/agency-cases';
import { verificationText } from '@/lib/domain/athletes-crm';
import {
  a360Access, activityProjection, currentJourney, documentChecklist, evidenceSignals, keyCompleteness,
  type A360Access, type ActivityItem, type CaseActivity, type ChecklistRow, type Evidence, type Journey,
} from '@/lib/domain/athlete-360';

export type Workspace = NonNullable<Awaited<ReturnType<typeof loadAthleteWorkspace>>>;

/**
 * Contrato de la ficha 360. Todo se lee con la sesión del agente (RLS) y se compone desde las fuentes canónicas:
 * cartera, procesos de la agencia, ofertas, concesiones de documentos y actividad. No se escribe nada.
 * Las notas internas solo llevan texto si el rol puede leerlas (`access.noteBodies`); si no, el texto no sale del servidor.
 */
export interface Athlete360 {
  ws: Workspace;
  access: A360Access;
  agencyRole: string | null;
  journey: Journey;
  verification: string;
  completeness: { done: number; total: number; missing: string[] };
  cases: CaseRow[];
  offers: OfferView[] | null;
  opportunities: HomeOpportunity[];
  documents: ChecklistRow[];
  evidence: Evidence[];
  activity: ActivityItem[];
  conversation: { id: string; status: string } | null;
  partial: string[];
}

export async function loadAthlete360(userId: string, athleteId: string, now: Date = new Date()): Promise<Athlete360 | null> {
  const raw = await loadAthleteWorkspace(userId, athleteId);
  if (!raw) return null;
  const [src, agencyCases] = await Promise.all([loadAgentSources(userId, now), loadAgencyCases(userId)]);
  const e = raw.current;
  const agencyRole = agencyCases.myRole.get(e.agencyId) ?? null;
  const access = a360Access({ repStatus: e.status, permissions: raw.scope.permissions, agencyRole, repRole: raw.scope.myRole });

  // Sin permiso de lectura de notas, el texto se elimina aquí: no llega a ningún componente ni al HTML.
  const ws: Workspace = access.noteBodies ? raw : { ...raw, notes: raw.notes.map((n) => ({ ...n, body: '' })) };

  const supabase = await createClient();
  const cases = agencyCases.cases.filter((c) => c.athleteId === athleteId && c.agencyId === e.agencyId);
  const caseIds = cases.map((c) => c.id);
  const partial: string[] = [...(src?.partial ?? [])];

  const [dirRes, acadRes, docsRes, reqRes, actRes, convRes, offers] = await Promise.all([
    supabase.from('athlete_directory').select('user_id, has_verified_stats, has_video').eq('user_id', athleteId).maybeSingle(),
    supabase.from('athlete_academics').select('gpa_source, english_source').eq('athlete_id', athleteId).maybeSingle(),
    access.documents
      ? supabase.from('athlete_documents').select('id, kind, title, uploaded_at').eq('athlete_id', athleteId)
      : Promise.resolve({ data: [], error: null }),
    access.documents
      ? supabase.from('info_requests').select('kind, status, created_at, athlete_documents(kind)').eq('athlete_id', athleteId).eq('organization_id', e.agencyId)
      : Promise.resolve({ data: [], error: null }),
    caseIds.length
      ? supabase.from('recruiting_case_activities')
          // Sin permiso de notas, la columna `body` ni siquiera se pide.
          .select(access.noteBodies ? 'id, case_id, kind, from_stage, to_stage, body, created_at, actor_id' : 'id, case_id, kind, from_stage, to_stage, created_at, actor_id')
          .in('case_id', caseIds).order('created_at', { ascending: false }).limit(100)
      : Promise.resolve({ data: [], error: null }),
    supabase.from('contact_requests').select('id, status').eq('athlete_id', athleteId).eq('organization_id', e.agencyId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    access.offers ? loadOffers(athleteId).catch(() => { partial.push('ofertas'); return [] as OfferView[]; }) : Promise.resolve(null),
  ]);
  if (docsRes.error || reqRes.error) partial.push('documentos');
  if (actRes.error) partial.push('actividad');

  const input = src?.input;
  const attention = input ? buildAttention(input, now) : [];
  const journey = currentJourney({
    athleteId, repStatus: e.status, attention, cases: input?.cases ?? [], tasks: input?.tasks ?? [], offers: input?.offers ?? [], now,
  });

  const dir = dirRes.data as { has_verified_stats: boolean | null; has_video: boolean | null } | null;
  const acad = acadRes.data as { gpa_source: string | null; english_source: string | null } | null;
  const today = now.toISOString().slice(0, 10);
  const me = input?.athletes.find((a) => a.id === athleteId);

  const docs = ((docsRes.data ?? []) as { id: string; kind: string; title: string; uploaded_at: string | null }[])
    .map((d) => ({ id: d.id, kind: d.kind, title: d.title, uploadedAt: d.uploaded_at }));
  const requests = ((reqRes.data ?? []) as unknown as { kind: string; status: string; created_at: string; athlete_documents: { kind: string } | null }[])
    .map((r) => ({ kind: r.kind, status: r.status, createdAt: r.created_at, documentKind: r.athlete_documents?.kind ?? null }));

  const acts = ((actRes.data ?? []) as unknown as { id: string; case_id: string; kind: string; from_stage: string | null; to_stage: string | null; body?: string | null; created_at: string; actor_id: string | null }[])
    .map((a): CaseActivity => ({ id: a.id, caseId: a.case_id, kind: a.kind, fromStage: a.from_stage, toStage: a.to_stage, body: a.body ?? null, at: a.created_at, actorId: a.actor_id }));
  const members = agencyCases.members.get(e.agencyId) ?? [];
  const memberName = new Map(members.map((m) => [m.userId, m.name]));
  const nameOf = (id: string | null) => (!id ? null : id === userId ? 'Tú' : ws.authorName.get(id) ?? memberName.get(id) ?? null);

  const d = ws.detail;
  return {
    ws, access, agencyRole, journey,
    verification: verificationText(dir ? { verifiedStats: Boolean(dir.has_verified_stats), video: Boolean(dir.has_video) } : null),
    completeness: keyCompleteness({
      'Deporte y posición': Boolean(e.sportName && e.positionName),
      'Promoción': e.graduationYear != null,
      'Equipo actual': Boolean(e.currentTeam),
      'Altura': d.heightCm != null,
      'Nota media': d.gpa != null,
      'Inglés': Boolean(d.englishTest && d.englishTest !== 'none'),
      'Vídeo': Boolean(d.videoUrl || dir?.has_video),
      'Estadísticas validadas': Boolean(dir?.has_verified_stats),
    }),
    cases,
    offers,
    opportunities: me && input ? matchingOpportunities(input.opportunities, [{ ...me, status: 'active' }], today).map((x) => x.o).slice(0, 10) : [],
    documents: documentChecklist(DOC_CHECKLIST, docs, requests, access.documents),
    evidence: evidenceSignals({
      verifiedStats: dir ? Boolean(dir.has_verified_stats) : null, video: dir ? Boolean(dir.has_video) : null,
      gradeSource: acad?.gpa_source, englishSource: acad?.english_source, academicsVisible: Boolean(acad),
    }),
    activity: activityProjection({
      entries: ws.history, notes: ws.notes, caseActivities: acts, cases: cases.map((c) => ({ id: c.id, institution: c.institutionName })),
      stageLabel, noteBodies: access.noteBodies, nameOf, limit: 60,
    }),
    conversation: convRes.data ? { id: convRes.data.id as string, status: convRes.data.status as string } : null,
    partial: [...new Set(partial)],
  };
}
