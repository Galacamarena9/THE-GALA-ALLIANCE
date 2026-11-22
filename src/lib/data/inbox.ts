import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { loadAgencyCases } from '@/lib/data/agency-cases';
import { loadNextActions } from '@/lib/data/next-actions';
import { groupInbox, type InboxGroup, type InboxThread } from '@/lib/domain/inbox';
import type { NextAction } from '@/lib/domain/next-action';
import type { ThreadContextData } from '@/components/inbox/AgentInbox';

const REQUEST_LABEL: Record<string, string> = { transcript: 'Certificado de notas', english_certificate: 'Certificado de inglés', full_game_video: 'Vídeo de partido completo' };
const REQ_STATUS: Record<string, string> = { pending: 'esperando al atleta', pending_guardian: 'esperando a la familia' };

/** Bandeja del agente: conversaciones de sus agencias (RLS) agrupadas por atleta, con la siguiente acción de sus procesos. */
export async function loadAgentInbox(userId: string): Promise<InboxGroup[]> {
  const supabase = await createClient();
  const data = await loadAgencyCases(userId);
  const agencyIds = data.agencies.map((a) => a.id);
  if (!agencyIds.length) return [];
  const { data: reqs } = await supabase.from('contact_requests')
    .select('id, status, athlete_id, is_minor_at_request, created_at, organizations(name)')
    .in('organization_id', agencyIds).order('created_at', { ascending: false }).limit(300);
  const rows = reqs ?? [];
  if (!rows.length) return [];
  const athleteIds = [...new Set(rows.map((r) => r.athlete_id))];
  const [{ data: names }, { data: msgs }, actions] = await Promise.all([
    supabase.from('profiles').select('id, display_name').in('id', athleteIds),
    supabase.from('contact_messages').select('request_id, created_at').in('request_id', rows.map((r) => r.id)).order('created_at', { ascending: false }).limit(2000),
    loadNextActions(userId, data.cases.filter((c) => athleteIds.includes(c.athleteId))),
  ]);
  const name = new Map((names ?? []).map((n) => [n.id as string, (n.display_name as string) || 'Atleta']));
  const last = new Map<string, string>();
  for (const m of msgs ?? []) if (!last.has(m.request_id as string)) last.set(m.request_id as string, m.created_at as string);
  const byAthlete = new Map<string, NextAction[]>();
  for (const c of data.cases) {
    const a = actions.get(c.id);
    if (a) byAthlete.set(c.athleteId, [...(byAthlete.get(c.athleteId) ?? []), a]);
  }
  const threads: InboxThread[] = rows.map((r) => ({
    id: r.id as string, athleteId: r.athlete_id as string, athleteName: name.get(r.athlete_id as string) ?? 'Atleta',
    organization: (r.organizations as unknown as { name: string } | null)?.name ?? 'Organización', status: r.status as string,
    isMinor: Boolean(r.is_minor_at_request), lastMessageAt: last.get(r.id as string) ?? null, createdAt: r.created_at as string,
  }));
  return groupInbox(threads, byAthlete);
}

/** Contexto de una conversación para el agente. Cada bloque depende de su permiso real (agent_can), no de la pantalla. */
export async function loadThreadContext(userId: string, athleteId: string, organizationId: string, athleteName: string): Promise<ThreadContextData | null> {
  const supabase = await createClient();
  const data = await loadAgencyCases(userId);
  if (!data.agencies.some((a) => a.id === organizationId)) return null;
  const can = async (p: string) => Boolean((await supabase.rpc('agent_can', { p_athlete: athleteId, p_permission: p })).data);
  const [pipeline, docsOk, msgOk, hadRep] = await Promise.all([
    can('pipeline.view'), can('documents.view'), can('messages.participate'),
    supabase.from('agent_representations').select('id', { count: 'exact', head: true }).eq('agency_id', organizationId).eq('athlete_id', athleteId),
  ]);
  const cases = data.cases.filter((c) => c.athleteId === athleteId && c.agencyId === organizationId && c.stage !== 'closed');
  const actions = pipeline ? await loadNextActions(userId, cases) : new Map();
  const { data: reqs } = docsOk
    ? await supabase.from('info_requests').select('kind, status').eq('athlete_id', athleteId).eq('organization_id', organizationId).in('status', ['pending', 'pending_guardian'])
    : { data: null };
  // Misma regla que la base de datos: si hubo representación y ya no da permiso de mensajes, no se escribe.
  const blockedByRep = (hadRep.count ?? 0) > 0 && !msgOk;
  return {
    athleteId, athleteName,
    cases: pipeline ? cases.map((c) => ({ id: c.id, institution: c.institutionName, stage: c.stage, action: actions.get(c.id)! })).filter((c) => c.action) : null,
    docs: reqs === null ? null : (reqs ?? []).map((r) => ({ title: REQUEST_LABEL[r.kind as string] ?? 'Documento', status: REQ_STATUS[r.status as string] ?? (r.status as string) })),
    canMessage: !blockedByRep,
    canMessageReason: blockedByRep ? 'La representación ya no está activa o no incluye mensajes: no puedes escribir en esta conversación.' : null,
  };
}
