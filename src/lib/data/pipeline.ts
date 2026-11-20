import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { urgencyOf, type Urgency } from '@/lib/domain/pipeline';

const PROC_COLS = 'id, target_kind, target_id, status, shortlist_tier, note, match_score_at_save, match_snapshot, created_at, updated_at, archived_at, next_action, next_action_due, close_reason, stage_changed_at, decided_at';

export interface ProcessRow {
  id: string; target_kind: 'institution' | 'opportunity'; target_id: string; status: string; shortlist_tier: string | null; note: string | null;
  match_score_at_save: number | null; match_snapshot?: unknown; created_at: string; updated_at: string; archived_at: string | null; next_action: string | null;
  next_action_due: string | null; close_reason: string | null; stage_changed_at: string; decided_at: string | null;
  name: string; sub: string; official_deadline: string | null; org_verified: boolean | null;
  application: { id: string; status: string } | null; open_tasks: number; open_task_due: string | null; offers: number;
  urgency: Urgency; urgencyReason: string;
}

type Supa = Awaited<ReturnType<typeof createClient>>;

async function decorate(supabase: Supa, athleteId: string, rows: Omit<ProcessRow, 'name' | 'sub' | 'official_deadline' | 'org_verified' | 'application' | 'open_tasks' | 'open_task_due' | 'offers' | 'urgency' | 'urgencyReason'>[]) {
  const iIds = rows.filter((r) => r.target_kind === 'institution').map((r) => r.target_id);
  const oIds = rows.filter((r) => r.target_kind === 'opportunity').map((r) => r.target_id);
  const pIds = rows.map((r) => r.id);
  const [insts, opps, apps, tasks, offers] = await Promise.all([
    iIds.length ? supabase.from('institutions').select('id, name, city, state').in('id', iIds) : Promise.resolve({ data: [] }),
    oIds.length ? supabase.from('opportunities').select('id, title, deadline, organizations(name, verification_status)').in('id', oIds) : Promise.resolve({ data: [] }),
    oIds.length ? supabase.from('applications').select('id, status, opportunity_id').eq('athlete_id', athleteId).in('opportunity_id', oIds) : Promise.resolve({ data: [] }),
    pIds.length ? supabase.from('pipeline_tasks').select('process_id, due_date').eq('athlete_id', athleteId).is('done_at', null).in('process_id', pIds) : Promise.resolve({ data: [] }),
    pIds.length ? supabase.from('athlete_offers').select('process_id').eq('athlete_id', athleteId).in('process_id', pIds) : Promise.resolve({ data: [] }),
  ]);
  const im = new Map(((insts.data ?? []) as { id: string; name: string; city: string | null; state: string | null }[]).map((i) => [i.id, i]));
  const om = new Map(((opps.data ?? []) as unknown as { id: string; title: string; deadline: string | null; organizations: { name: string; verification_status: string } | null }[]).map((o) => [o.id, o]));
  const am = new Map(((apps.data ?? []) as { id: string; status: string; opportunity_id: string }[]).map((a) => [a.opportunity_id, a]));
  const taskRows = (tasks.data ?? []) as { process_id: string; due_date: string | null }[];
  const offerRows = (offers.data ?? []) as { process_id: string }[];
  return rows.map((r) => {
    const i = r.target_kind === 'institution' ? im.get(r.target_id) : undefined;
    const o = r.target_kind === 'opportunity' ? om.get(r.target_id) : undefined;
    const pt = taskRows.filter((t) => t.process_id === r.id);
    const due = pt.map((t) => t.due_date).filter((d): d is string => !!d).sort()[0] ?? null;
    const official = o?.deadline ?? null;
    const u = urgencyOf({ ...r, official_deadline: official, open_task_due: due });
    return {
      ...r,
      name: i?.name ?? o?.title ?? (r.target_kind === 'institution' ? 'Universidad' : 'Oportunidad (ya no publicada)'),
      sub: i ? [i.city, i.state].filter(Boolean).join(', ') : o?.organizations?.name ?? '',
      official_deadline: official,
      org_verified: o ? o.organizations?.verification_status === 'verified' : null,
      application: o ? (am.get(o.id) ? { id: am.get(o.id)!.id, status: am.get(o.id)!.status } : null) : null,
      open_tasks: pt.length, open_task_due: due,
      offers: offerRows.filter((x) => x.process_id === r.id).length,
      urgency: u.urgency, urgencyReason: u.reason,
    } satisfies ProcessRow;
  });
}

/** Todos los procesos del atleta (RLS: el atleta o su familia vinculada). */
export async function loadPipeline(athleteId: string): Promise<ProcessRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('saved_items').select(PROC_COLS).eq('athlete_id', athleteId).order('updated_at', { ascending: false }).limit(300);
  if (error) throw error;
  return decorate(supabase, athleteId, (data ?? []) as never);
}

/** Un proceso con todo su detalle. */
export async function loadProcess(athleteId: string, id: string) {
  const supabase = await createClient();
  const { data: row } = await supabase.from('saved_items').select(PROC_COLS).eq('athlete_id', athleteId).eq('id', id).maybeSingle();
  if (!row) return null;
  const [[p], events, tasks, contacts, docs, vault, offers] = await Promise.all([
    decorate(supabase, athleteId, [row as never]),
    supabase.from('pipeline_events').select('id, kind, source, channel, title, body, occurred_at').eq('process_id', id).order('occurred_at', { ascending: false }).limit(100),
    supabase.from('pipeline_tasks').select('id, title, due_date, done_at, created_at').eq('process_id', id).order('done_at', { ascending: true, nullsFirst: true }).order('due_date', { ascending: true, nullsFirst: false }),
    supabase.from('pipeline_contacts').select('id, name, role, email, phone').eq('process_id', id).order('created_at'),
    supabase.from('process_documents').select('kind, document_id, sent_at').eq('process_id', id),
    supabase.from('athlete_documents').select('id, kind, title, uploaded_at').eq('athlete_id', athleteId).order('created_at', { ascending: false }),
    supabase.from('athlete_offers').select('id, university_name, annual_cost_usd, aid_amount_usd, renewable, in_writing, deadline, status, source, scholarship_type, created_at').eq('process_id', id).order('created_at', { ascending: false }),
  ]);
  return { p, events: events.data ?? [], tasks: tasks.data ?? [], contacts: contacts.data ?? [], docs: docs.data ?? [], vault: vault.data ?? [], offers: offers.data ?? [] };
}
export type ProcessDetail = NonNullable<Awaited<ReturnType<typeof loadProcess>>>;

/** Tareas personales abiertas con fecha (para el dashboard). */
export async function loadOpenTasks(athleteId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from('pipeline_tasks').select('id, title, due_date, process_id').eq('athlete_id', athleteId).is('done_at', null).not('due_date', 'is', null).order('due_date').limit(20);
  return data ?? [];
}
