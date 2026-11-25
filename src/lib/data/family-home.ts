import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { GuardianState } from '@/lib/domain/guardian-verification';
import type { SessionContext } from '@/lib/session';
import type { FamilyApproval, FamilyDeadline, FamilyOffer } from '@/lib/domain/family';
import { budgetFit, familyCost, type CostScenario } from '@/lib/domain/family-cost';

export interface GuardianLink {
  id: string;
  athleteId: string;
  name: string;
  relationship: string;
  verification: 'unverified' | 'athlete_confirmed' | 'admin_verified';
  status: 'approved' | 'restricted';
  /** false = vínculo vigente pero sin acceso (pausado o revisión de mayoría de edad vencida). */
  active: boolean;
  /** Fase 5: si puede decidir por el menor (declaración + revisión). Opcional en las vistas previas. */
  guardianState?: GuardianState;
  scopes: { profile: boolean; applications: boolean; academics: boolean; edit: boolean; costs: boolean; budget: boolean; documents: boolean; contacts: boolean; messages: boolean };
}

const LINK_COLS = 'id, athlete_id, status, relationship, verification_status, can_view_profile, can_view_applications, can_view_academics, can_edit_profile, can_view_costs, can_view_budget, can_view_documents, can_view_contacts, can_view_messages';

/** Relaciones del tutor (una por hijo/a, con permisos independientes). */
export async function guardianLinks(session: SessionContext): Promise<GuardianLink[]> {
  const supabase = await createClient();
  const { data: links } = await supabase.from('parent_athlete_links').select(LINK_COLS)
    .eq('parent_id', session.userId).in('status', ['approved', 'restricted']).order('created_at');
  const ids = (links ?? []).map((l) => l.athlete_id as string).filter(Boolean);
  if (!ids.length) return [];
  const [{ data: profiles }, actives, states] = await Promise.all([
    supabase.from('profiles').select('id, display_name').in('id', ids),
    Promise.all(ids.map((id) => supabase.rpc('is_active_guardian', { p_athlete: id }).then((r) => [id, r.data === true] as const))),
    Promise.all((links ?? []).map((l) => supabase.rpc('guardian_verification_state', { p_link: l.id as string }).then((r) => [l.id as string, (r.data as GuardianState | null) ?? undefined] as const))),
  ]);
  const stateOf = new Map(states);
  const activeOf = new Map(actives);
  return (links ?? []).filter((l) => l.athlete_id).map((l) => ({
    id: l.id as string,
    athleteId: l.athlete_id as string,
    name: (profiles?.find((p) => p.id === l.athlete_id)?.display_name as string | undefined) ?? 'Tu hijo/a',
    relationship: l.relationship as string,
    verification: l.verification_status as GuardianLink['verification'],
    status: l.status as GuardianLink['status'],
    active: l.status === 'approved' && activeOf.get(l.athlete_id as string) === true,
    guardianState: stateOf.get(l.id as string),
    scopes: {
      profile: !!l.can_view_profile, applications: !!l.can_view_applications, academics: !!l.can_view_academics, edit: !!l.can_edit_profile,
      costs: !!l.can_view_costs, budget: !!l.can_view_budget, documents: !!l.can_view_documents, contacts: !!l.can_view_contacts, messages: !!l.can_view_messages,
    },
  }));
}

export interface FamilyContact { id: string; org: string; orgVerified: boolean; status: string; createdAt: string }
export interface FamilyNote { id: string; body: string; visibility: 'guardians' | 'family'; mine: boolean; author: string; createdAt: string }

export interface FamilyChildHome {
  approvals: FamilyApproval[];
  deadlines: FamilyDeadline[];
  offers: FamilyOffer[];
  process: { saved: number; applications: number; offers: number };
  scenarios: { total: number; incomplete: number };
  missingDocuments: number;
  pendingDocRequests: number;
  contacts: FamilyContact[];
  notes: FamilyNote[];
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Resumen de un hijo/a para su familia. Cada consulta pasa por la RLS con la sesión del tutor:
 * si un permiso está desactivado, esa parte llega vacía (y la pantalla lo dice), nunca con datos de más.
 */
export async function loadFamilyChild(session: SessionContext, link: GuardianLink): Promise<FamilyChildHome> {
  const supabase = await createClient();
  const a = link.athleteId;
  const name = link.name;
  const today = new Date();
  const horizon = iso(new Date(today.getTime() + 30 * 86_400_000));
  const OPP = 'opportunities(id, title, deadline, organizations(name))';
  const [regs, enrs, contacts, infos, apps, saved, offers, tasks, docs, scen, notes] = await Promise.all([
    supabase.from('opportunity_registrations').select('id, opportunity_id, opportunities(title, organizations(name))').eq('athlete_id', a).eq('guardian_status', 'pending').limit(10),
    supabase.from('program_enrollments').select('id, opportunity_id, opportunities(title, organizations(name))').eq('athlete_id', a).eq('guardian_status', 'pending').limit(10),
    supabase.from('contact_requests').select('id, status, created_at, organizations(name, verification_status)').eq('athlete_id', a).order('created_at', { ascending: false }).limit(8),
    supabase.from('info_requests').select('id, kind, status, organizations(name)').eq('athlete_id', a).in('status', ['pending', 'pending_guardian']).limit(10),
    supabase.from('applications').select(`id, status, ${OPP}`).eq('athlete_id', a).neq('status', 'withdrawn').limit(50),
    supabase.from('saved_items').select('id', { count: 'exact', head: true }).eq('athlete_id', a).is('archived_at', null),
    supabase.from('athlete_offers').select('id, university_name, deadline, status').eq('athlete_id', a).eq('status', 'pending').limit(10),
    supabase.from('pipeline_tasks').select('id, title, due_date, owner').eq('athlete_id', a).is('done_at', null).not('due_date', 'is', null).lte('due_date', horizon).limit(20),
    supabase.from('athlete_documents').select('id, storage_path').eq('athlete_id', a),
    supabase.from('family_cost_scenarios').select('currency, tuition, fees, housing, meals, insurance, travel, other_costs, athletic_aid, academic_aid, other_aid, housing_included').eq('athlete_id', a),
    supabase.from('family_notes').select('id, body, visibility, author_id, created_at, profiles:author_id(display_name)').eq('athlete_id', a).order('created_at', { ascending: false }).limit(20),
  ]);

  type O = { id?: string; title: string; deadline?: string | null; organizations: { name: string } | null } | null;
  const opp = (r: { opportunities?: unknown }) => r.opportunities as O;
  const approvals: FamilyApproval[] = [
    ...(contacts.data ?? []).filter((c) => c.status === 'pending_guardian').map((c) => ({
      kind: 'contact' as const, athleteName: name, href: '/app/inbox',
      what: `${(c.organizations as unknown as { name: string } | null)?.name ?? 'Una organización'} quiere contactar`,
    })),
    ...(infos.data ?? []).filter((r) => r.status === 'pending_guardian').map((r) => ({
      kind: 'document' as const, athleteName: name, href: '/app/requests',
      what: `${(r.organizations as unknown as { name: string } | null)?.name ?? 'Una organización'} pide información`,
    })),
    ...(['registration', 'enrollment'] as const).flatMap((type) => ((type === 'registration' ? regs.data : enrs.data) ?? []).map((r) => ({
      kind: 'participation' as const, athleteName: name, href: `/app/opportunities/${r.opportunity_id}`,
      what: `${opp(r)?.title ?? 'Una actividad'} · ${opp(r)?.organizations?.name ?? ''}`.trim(),
      ref: { type, id: r.id as string, opportunity: r.opportunity_id as string },
    }))),
  ];

  const deadlines: FamilyDeadline[] = [
    ...(apps.data ?? []).map((r) => opp(r)).filter((o): o is NonNullable<O> => !!o?.deadline && o.deadline >= iso(today) && o.deadline <= horizon)
      .map((o) => ({ date: o.deadline!, label: `Plazo: ${o.title}`, athleteName: name, kind: 'official' as const, href: `/app/opportunities/${o.id}` })),
    ...(tasks.data ?? []).map((t) => ({ date: t.due_date as string, label: t.title as string, athleteName: name,
      kind: (t.owner === 'athlete' ? 'recommended' : 'personal') as FamilyDeadline['kind'], href: '/app/pipeline' })),
  ].sort((x, y) => x.date.localeCompare(y.date));

  const offerItems: FamilyOffer[] = (offers.data ?? []).map((o) => ({ athleteName: name, org: o.university_name as string, deadline: (o.deadline as string | null) ?? null, href: '/app/offers' }));
  const scenarios = (scen.data ?? []) as unknown as CostScenario[];

  return {
    approvals,
    deadlines,
    offers: offerItems,
    process: { saved: saved.count ?? 0, applications: (apps.data ?? []).length, offers: offerItems.length },
    scenarios: { total: scenarios.length, incomplete: scenarios.filter((s) => familyCost(s).status !== 'complete').length },
    missingDocuments: (docs.data ?? []).filter((d) => !d.storage_path).length,
    pendingDocRequests: (infos.data ?? []).length,
    contacts: (contacts.data ?? []).map((c) => {
      const o = c.organizations as unknown as { name: string; verification_status: string } | null;
      return { id: c.id as string, org: o?.name ?? 'Organización', orgVerified: o?.verification_status === 'verified', status: c.status as string, createdAt: c.created_at as string };
    }),
    notes: (notes.data ?? []).map((n) => ({
      id: n.id as string, body: n.body as string, visibility: n.visibility as FamilyNote['visibility'], mine: n.author_id === session.userId,
      author: (n.profiles as unknown as { display_name: string } | null)?.display_name ?? 'Familia', createdAt: n.created_at as string,
    })),
  };
}

/** Opciones de coste y presupuesto de un hijo/a (RLS: atleta o tutor con permiso de costes). Para Gala AI. */
export async function familyCostOverview(athleteId: string, canSeeBudget = true) {
  const supabase = await createClient();
  const [{ data: sc }, { data: fin }] = await Promise.all([
    supabase.from('family_cost_scenarios').select('label, currency, tuition, fees, housing, meals, insurance, travel, other_costs, athletic_aid, academic_aid, other_aid, housing_included').eq('athlete_id', athleteId).limit(8),
    canSeeBudget ? supabase.from('athlete_finances').select('annual_budget_usd, budget_mode').eq('athlete_id', athleteId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const budget = { amount: (fin?.annual_budget_usd as number | null) ?? null, currency: 'USD' as const };
  return {
    budget: !canSeeBudget ? 'no compartido con este familiar' : budget.amount == null ? 'sin presupuesto definido' : { amount_usd: budget.amount, mode: fin?.budget_mode === 'hard_limit' ? 'límite estricto' : 'preferencia', private: true },
    options: (sc ?? []).map((x) => {
      const r = familyCost(x as unknown as CostScenario);
      return { option: x.label as string, status: r.status, summary: r.headline, missing: r.missing, budget_fit: budgetFit(r, budget) };
    }),
  };
}
