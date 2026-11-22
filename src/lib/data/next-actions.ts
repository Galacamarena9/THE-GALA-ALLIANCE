import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { loadPortfolio } from '@/lib/data/portfolio';
import { DOC_KIND_LABEL, type DocKind } from '@/content/documents';
import { nextAction, type NAContext, type NextAction } from '@/lib/domain/next-action';
import type { CaseRow } from '@/lib/data/agency-cases';

const REQUEST_LABEL: Record<string, string> = { transcript: 'Certificado de notas', english_certificate: 'Certificado de inglés', full_game_video: 'Vídeo de partido completo' };

/**
 * Contexto para el motor de siguiente acción, leído con la sesión del agente (RLS):
 * representación efectiva, tareas abiertas, ofertas del atleta con esa organización y documentos pedidos sin respuesta.
 * Lo que la RLS no deja ver simplemente no llega (p. ej. ofertas sin permiso offers.view).
 */
export async function loadNextActions(userId: string, cases: CaseRow[], now: Date = new Date()): Promise<Map<string, NextAction>> {
  const open = cases.filter((c) => c.stage !== 'closed');
  if (!open.length) return new Map();
  const supabase = await createClient();
  const athleteIds = [...new Set(open.map((c) => c.athleteId))];
  const agencyIds = [...new Set(open.map((c) => c.agencyId))];
  const [portfolio, tasksRes, offersRes, reqRes] = await Promise.all([
    loadPortfolio(userId),
    supabase.from('recruiting_case_tasks').select('case_id, title, due_date').in('case_id', open.map((c) => c.id).slice(0, 500)).eq('done', false),
    supabase.from('athlete_offers').select('athlete_id, university_name, deadline').in('athlete_id', athleteIds),
    supabase.from('info_requests').select('athlete_id, organization_id, kind, status, created_at').in('athlete_id', athleteIds).in('organization_id', agencyIds).in('status', ['pending', 'pending_guardian']),
  ]);

  const active = new Set(portfolio.entries.filter((e) => e.status === 'active').map((e) => `${e.agencyId}:${e.athleteId}`));
  const tasks = new Map<string, { title: string; dueDate: string | null }[]>();
  for (const t of (tasksRes.data ?? []) as { case_id: string; title: string; due_date: string | null }[]) {
    tasks.set(t.case_id, [...(tasks.get(t.case_id) ?? []), { title: t.title, dueDate: t.due_date }]);
  }
  const offers = (offersRes.data ?? []) as { athlete_id: string; university_name: string; deadline: string | null }[];
  const reqs = ((reqRes.data ?? []) as { athlete_id: string; organization_id: string; kind: string; status: string; created_at: string }[])
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  const out = new Map<string, NextAction>();
  for (const c of open) {
    const offer = offers.find((o) => o.athlete_id === c.athleteId && o.university_name.trim().toLowerCase() === c.institutionName.trim().toLowerCase()) ?? null;
    const req = reqs.find((r) => r.athlete_id === c.athleteId && r.organization_id === c.agencyId) ?? null;
    const ctx: NAContext = {
      repActive: active.has(`${c.agencyId}:${c.athleteId}`),
      tasks: tasks.get(c.id) ?? [],
      offer: offer ? { deadline: offer.deadline } : null,
      docRequest: req ? { title: REQUEST_LABEL[req.kind] ?? DOC_KIND_LABEL[req.kind as DocKind] ?? 'Documento pedido', requestedAt: req.created_at, fromFamily: req.status === 'pending_guardian' } : null,
    };
    out.set(c.id, nextAction({ id: c.id, athleteId: c.athleteId, institution: c.institutionName, stage: c.stage, nextAction: c.nextAction, nextActionDue: c.nextActionDue, updatedAt: c.updatedAt }, ctx, now));
  }
  return out;
}
